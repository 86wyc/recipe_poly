"""
Data processing utilities for the sync daemon pipeline.

Contains image conversion (PNG to WebP) and recipe text parsing helpers.
"""

import json
import re
from pathlib import Path
from typing import Any, Dict, Optional

import structlog
from PIL import Image

from sync_daemon.utils.exceptions import ImageProcessingError

logger = structlog.get_logger(__name__)


def convert_png_to_webp(
    input_path: Path,
    output_dir: Path,
    quality: int = 80,
) -> Path:
    """
    Convert a PNG image to WebP format.

    Args:
        input_path: Path to the source PNG file.
        output_dir: Directory where the WebP file will be saved.
        quality: WebP quality (0-100). Default 80.

    Returns:
        Path to the converted WebP file.

    Raises:
        ImageProcessingError: If conversion fails or input file is invalid.
    """
    if not input_path.is_file():
        raise ImageProcessingError(f"Input image not found: {input_path}")

    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / f"{input_path.stem}.webp"

    try:
        with Image.open(input_path) as img:
            # Convert to RGB if necessary (WebP does not support alpha in all modes)
            if img.mode in ("RGBA", "P"):
                img = img.convert("RGB")
            img.save(output_path, "WEBP", quality=quality)
    except Exception as exc:
        logger.error("image_conversion_failed", error=str(exc), input=str(input_path))
        raise ImageProcessingError(f"PNG to WebP conversion failed: {exc}") from exc

    logger.info("image_converted", input=str(input_path), output=str(output_path))
    return output_path


def slugify_title(title: str) -> str:
    """
    Convert a recipe title into a URL-friendly slug.

    Args:
        title: The recipe title.

    Returns:
        Lowercased slug with hyphens, retaining alphanumeric characters.
    """
    slug = title.lower()
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    slug = slug.strip("-")
    if not slug:
        slug = "recipe"
    return slug


def extract_recipe_text_from_file(file_path: Path) -> Dict[str, Any]:
    """
    Parse a recipe file (JSON, YAML, or plain text) into a structured dict.

    The resulting dict should contain at least:
        - title: str
        - description: Optional[str]
        - ingredients: list of dicts with keys: name, quantity, unit
        - steps: list of strings
        - optional: heroImageUrl, baseServings, times, etc.

    This implementation supports JSON and plain text fallback. YAML can be
    added later if needed.

    Args:
        file_path: Path to the recipe file.

    Returns:
        Dictionary with recipe fields.

    Raises:
        ImageProcessingError (or a more general parsing error) on failure.
    """
    if not file_path.is_file():
        raise ImageProcessingError(f"Recipe file not found: {file_path}")

    suffix = file_path.suffix.lower()
    if suffix == ".json":
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data
    else:
        # Fallback: treat as plain text with simple heuristics
        text = file_path.read_text(encoding="utf-8")
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        if not lines:
            raise ImageProcessingError(f"Empty recipe file: {file_path}")

        title = lines[0]
        # Assume ingredients start after a line containing "Ingredients"
        ingredients = []
        steps = []
        section = None
        for line in lines[1:]:
            if line.lower().startswith("ingredients"):
                section = "ingredients"
                continue
            elif line.lower().startswith("steps") or line.lower().startswith("instructions"):
                section = "steps"
                continue
            if section == "ingredients":
                # simple format: quantity unit name
                parts = line.split(" ", 2)
                if len(parts) >= 3:
                    ingredients.append({
                        "quantity": float(parts[0]) if parts[0].replace('.','',1).isdigit() else parts[0],
                        "unit": parts[1],
                        "name": parts[2],
                    })
            elif section == "steps":
                steps.append(line)

        return {
            "title": title,
            "description": None,
            "ingredients": ingredients,
            "steps": steps,
            "stepDependencyGraph": [],  # will be built later if needed
        }
