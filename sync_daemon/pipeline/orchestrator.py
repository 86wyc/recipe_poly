"""
Pipeline orchestrator for the Local Admin Sync Daemon.

Executes the sequential recipe ingestion pipeline:
  1. Ollama 4D vector extraction
  2. ComfyUI hero image generation
  3. PNG -> WebP conversion
  4. R2 upload
  5. Hono API ingestion

Strict halt policy: If ComfyUI or R2 fails, the recipe is aborted and
no API call is made.
"""

import asyncio
import hashlib
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional

import structlog

from sync_daemon.config import DaemonSettings
from sync_daemon.clients.ollama_client import OllamaClient
from sync_daemon.clients.comfy_client import ComfyUIClient
from sync_daemon.clients.hono_client import HonoAPIClient
from sync_daemon.clients.r2_client import R2Client
from sync_daemon.clients.stubs import OllamaClientStub, ComfyClientStub, R2ClientStub
from sync_daemon.pipeline.processors import (
    convert_png_to_webp,
    extract_recipe_text_from_file,
    slugify_title,
)
from sync_daemon.utils.exceptions import (
    ComfyUIWorkflowError,
    HonoAPIError,
    ImageProcessingError,
    OllamaAPIError,
    R2UploadError,
    RecipePipelineAbort,
    SyncDaemonError,
)

logger = structlog.get_logger(__name__)


class RecipePipelineOrchestrator:
    """Coordinates all clients to process a single recipe file."""

    def __init__(
        self,
        settings: DaemonSettings,
        dry_run: bool = False,
        stub_ollama: bool = False,
        stub_comfy: bool = False,
        stub_r2: bool = False,
    ) -> None:
        self.settings = settings
        self.dry_run = dry_run
        self.stub_ollama = stub_ollama
        self.stub_comfy = stub_comfy
        self.stub_r2 = stub_r2

        # Real clients
        self.ollama_real = OllamaClient(settings)
        self.comfy_real = ComfyUIClient(settings)
        self.hono = HonoAPIClient(settings)
        self.r2_real = R2Client(settings)

        # Stub clients
        self.ollama_stub = OllamaClientStub(settings)
        self.comfy_stub = ComfyClientStub(settings)
        self.r2_stub = R2ClientStub(settings)

        self.temp_dir = settings.TEMP_DIR

    async def run_file(self, file_path: Path) -> Optional[str]:
        """
        Process a single recipe file.

        Args:
            file_path: Path to the recipe file (JSON or plain text).

        Returns:
            Created recipe ID if successful, None if aborted due to failure.
        """
        logger.info("processing_file", file_path=str(file_path))
        try:
            recipe_data = extract_recipe_text_from_file(file_path)
        except Exception as exc:
            logger.error("recipe_parse_failed", error=str(exc), file=str(file_path))
            return None

        return await self.run_recipe(recipe_data)

    async def run_directory(self, dir_path: Path) -> Dict[str, Any]:
        """
        Process all recipe files in a directory sequentially.

        Args:
            dir_path: Directory containing recipe files.

        Returns:
            Summary dict with success, failure, and skipped counts.
        """
        if not dir_path.is_dir():
            logger.error("directory_not_found", dir_path=str(dir_path))
            return {"success": 0, "failed": 0, "skipped": 0}

        files = sorted(
            [p for p in dir_path.iterdir() if p.is_file() and p.suffix.lower() in {".json", ".txt", ".md"}]
        )
        logger.info("processing_directory", file_count=len(files), dir_path=str(dir_path))

        success = 0
        failed = 0
        for file_path in files:
            result = await self.run_file(file_path)
            if result:
                success += 1
            else:
                failed += 1

        summary = {"success": success, "failed": failed, "skipped": 0}
        logger.info("directory_processing_complete", **summary)
        return summary

    async def run_recipe(self, recipe_data: Dict[str, Any]) -> Optional[str]:
        """
        Execute the full pipeline for a single recipe data dict.

        Args:
            recipe_data: Parsed recipe data with title, description, ingredients, steps.

        Returns:
            Created recipe ID if successful, None if aborted.
        """
        title = recipe_data.get("title", "Untitled Recipe")
        slug = slugify_title(title)
        # Add short hash to avoid duplicate slug collisions
        slug_hash = hashlib.sha1(title.encode("utf-8")).hexdigest()[:8]
        slug = f"{slug}-{slug_hash}"

        # Step 1: Ollama vector extraction (stub or real)
        try:
            if self.stub_ollama:
                vector = await self.ollama_stub.generate_vector("")
            else:
                prompt_text = self._build_ollama_prompt(recipe_data)
                vector = await self.ollama_real.generate_vector(prompt_text)
            logger.info("vector_extracted", title=title, vector=vector)
        except (OllamaAPIError, Exception) as exc:
            logger.error("ollama_failed", title=title, error=str(exc))
            return None

        # Step 2: ComfyUI image generation (stub or real)
        try:
            if self.stub_comfy:
                png_path = await self.comfy_stub.generate_image("", self.temp_dir)
            else:
                image_prompt = self._build_image_prompt(recipe_data)
                png_path = await self.comfy_real.generate_image(image_prompt, self.temp_dir)
            logger.info("image_generated", title=title, png_path=str(png_path))
        except Exception as exc:
            logger.error("comfyui_failed", title=title, error=str(exc))
            return None

        # Step 3: Convert PNG to WebP
        try:
            webp_path = convert_png_to_webp(png_path, self.temp_dir)
            logger.info("image_converted", title=title, webp_path=str(webp_path))
        except ImageProcessingError as exc:
            logger.error("image_conversion_failed", title=title, error=str(exc))
            return None

                # Step 4: R2 upload (stub or real)
        try:
            object_key = self._build_object_key(slug, webp_path.suffix)
            if self.stub_r2:
                hero_url = await self.r2_stub.upload_file(webp_path, object_key)
            else:
                hero_url = await self.r2_real.upload_file(webp_path, object_key)
            logger.info("r2_uploaded", title=title, object_key=object_key, url=hero_url)
        except Exception as exc:
            logger.error("r2_upload_failed", title=title, error=str(exc))
            return None

        # Step 5: Hono API ingestion
        # Build payload for Hono
        payload = self._build_hono_payload(recipe_data, vector, hero_url, slug)

        if self.dry_run:
            import json
            logger.info("dry_run_payload", payload=json.dumps(payload, indent=2))
            return "dry-run"  # indicate success but no Hono call
        try:
            payload = self._build_hono_payload(recipe_data, vector, hero_url, slug)
            recipe_id = await self.hono.create_recipe(payload)
            logger.info("recipe_ingested", title=title, recipe_id=recipe_id)
            return recipe_id
        except HonoAPIError as exc:
            logger.error("hono_api_failed", title=title, error=str(exc))
            return None

        # Clean up local temp files (optional)
        # png_path and webp_path could be deleted here if desired

    def _build_ollama_prompt(self, recipe_data: Dict[str, Any]) -> str:
        """Build text prompt for Ollama vector extraction."""
        parts = []
        parts.append(f"Title: {recipe_data.get('title', '')}")
        if recipe_data.get("description"):
            parts.append(f"Description: {recipe_data['description']}")
        ingredients = recipe_data.get("ingredients", [])
        if ingredients:
            ing_lines = []
            for ing in ingredients:
                if isinstance(ing, dict):
                    name = ing.get("name", ing.get("ingredient", ""))
                    qty = ing.get("quantity", "")
                    unit = ing.get("unit", "")
                    ing_lines.append(f"{qty} {unit} {name}".strip())
                else:
                    ing_lines.append(str(ing))
            parts.append("Ingredients:\n" + "\n".join(ing_lines))
        steps = recipe_data.get("steps", [])
        if steps:
            parts.append("Steps:\n" + "\n".join(steps))
        return "\n\n".join(parts)

    def _build_image_prompt(self, recipe_data: Dict[str, Any]) -> str:
        """Build prompt for ComfyUI image generation."""
        title = recipe_data.get("title", "delicious recipe")
        description = recipe_data.get("description", "")
        prompt = (
            f"Professional food photography of {title}. "
            f"Appetizing, warm lighting, shallow depth of field, high resolution."
        )
        if description:
            prompt += f" {description}"
        return prompt

    def _build_object_key(self, slug: str, extension: str) -> str:
        """Generate R2 object key using date and slug."""
        now = datetime.utcnow()
        year = now.strftime("%Y")
        month = now.strftime("%m")
        return f"recipes/{year}/{month}/{slug}{extension}"

    def _build_hono_payload(
        self,
        recipe_data: Dict[str, Any],
        vector: list,
        hero_url: str,
        slug: str,
    ) -> Dict[str, Any]:
        """Build payload matching CreateRecipeInputSchema for Hono API."""
        ingredients_payload = []
        for ing in recipe_data.get("ingredients", []):
            if isinstance(ing, dict):
                ingredient_id = ing.get("id") or ing.get("ingredientId")
                if not ingredient_id:
                    logger.warning(
                        "ingredient_missing_id",
                        ingredient=ing,
                        message="Skipping ingredient without ID; Hono API requires existing ingredient IDs.",
                    )
                    continue

                ingredient_entry = {
                    "ingredientId": ingredient_id,
                    "quantityBase": float(ing.get("quantity", 0)),
                    "unit": ing.get("unit", "unit"),
                    "isOptional": ing.get("isOptional", False),
                }
                notes = ing.get("notes")
                if notes is not None:
                    ingredient_entry["notes"] = notes
                ingredients_payload.append(ingredient_entry)

        step_graph = recipe_data.get("stepDependencyGraph", [])
        if not step_graph:
            steps = recipe_data.get("steps", [])
            for idx, step in enumerate(steps):
                step_graph.append({
                    "step_id": f"step_{idx+1}",
                    "action_type": "instruction",
                    "description": step,
                    "is_passive": False,
                    "depends_on_step_ids": [],
                })

        payload = {
            "title": recipe_data.get("title", "Untitled"),
            "slug": slug,
            "stepDependencyGraph": step_graph,
            "ingredients": ingredients_payload,
            "attributeVector": vector,
        }

        # Optional fields: only include if present and not None
        if recipe_data.get("description") is not None:
            payload["description"] = recipe_data["description"]
        if recipe_data.get("heroImageUrl") is not None:
            payload["heroImageUrl"] = recipe_data["heroImageUrl"]
        if recipe_data.get("baseServings") is not None:
            payload["baseServings"] = recipe_data["baseServings"]
        if recipe_data.get("prepTimeMinutes") is not None:
            payload["prepTimeMinutes"] = recipe_data["prepTimeMinutes"]
        if recipe_data.get("cookTimeMinutes") is not None:
            payload["cookTimeMinutes"] = recipe_data["cookTimeMinutes"]
        if recipe_data.get("totalTimeMinutes") is not None:
            payload["totalTimeMinutes"] = recipe_data["totalTimeMinutes"]
        if recipe_data.get("caloriesPerServing") is not None:
            payload["caloriesPerServing"] = recipe_data["caloriesPerServing"]
        if recipe_data.get("proteinGrams") is not None:
            payload["proteinGrams"] = recipe_data["proteinGrams"]

        # Hero image URL is set from R2 upload; include it
        if hero_url:
            payload["heroImageUrl"] = hero_url

        return payload
