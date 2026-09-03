"""
Async HTTP client for ComfyUI to generate hero images using FLUX.1-schnell.

Submits a prompt to ComfyUI, polls for completion, and downloads the
resulting PNG to the local temp directory.
"""

import asyncio
import json
import uuid
from pathlib import Path
from typing import Any, Dict, Optional

import httpx
import structlog

from sync_daemon.config import DaemonSettings
from sync_daemon.utils.exceptions import ComfyUIWorkflowError

logger = structlog.get_logger(__name__)


class ComfyUIClient:
    """Asynchronous client for ComfyUI image generation."""

    def __init__(self, settings: DaemonSettings) -> None:
        """
        Initialize the client.

        Args:
            settings: DaemonSettings instance with COMFYUI_URL and COMFYUI_TIMEOUT.
        """
        self.base_url = str(settings.COMFYUI_URL).rstrip("/")
        self.timeout = settings.COMFYUI_TIMEOUT
        self.poll_interval = 1.0  # seconds

    async def generate_image(self, prompt: str, output_dir: Path) -> Path:
        """
        Generate a hero image from a text prompt using ComfyUI.

        Args:
            prompt: Text prompt for the image.
            output_dir: Directory to save the downloaded PNG.

        Returns:
            Path to the downloaded PNG file.

        Raises:
            ComfyUIWorkflowError: If submission, polling, or download fails.
        """
        workflow = self._build_workflow(prompt)
        prompt_id = await self._submit_workflow(workflow)
        logger.info("comfyui_workflow_submitted", prompt_id=prompt_id)

        image_filename = await self._poll_for_completion(prompt_id)
        output_path = await self._download_image(image_filename, output_dir)
        logger.info("comfyui_image_generated", path=str(output_path))
        return output_path

    def _build_workflow(self, prompt: str) -> Dict[str, Any]:
        """
        Build a minimal FLUX.1-schnell workflow.

        This uses a standard ComfyUI API format with a single text prompt
        and an empty latent image. Adjust node IDs and inputs as needed
        for your specific ComfyUI setup.
        """
        workflow = {
            "3": {
                "class_type": "KSampler",
                "inputs": {
                    "cfg": 1.0,
                    "denoise": 1.0,
                    "latent_image": ["5", 0],
                    "model": ["4", 0],
                    "negative": ["7", 0],
                    "positive": ["6", 0],
                    "sampler_name": "euler",
                    "scheduler": "normal",
                    "seed": 42,
                    "steps": 4,
                },
            },
            "4": {
                "class_type": "CheckpointLoaderSimple",
                "inputs": {"ckpt_name": "flux1-schnell.safetensors"},
            },
            "5": {
                "class_type": "EmptyLatentImage",
                "inputs": {"batch_size": 1, "height": 512, "width": 512},
            },
            "6": {
                "class_type": "CLIPTextEncode",
                "inputs": {"clip": ["4", 1], "text": prompt},
            },
            "7": {
                "class_type": "CLIPTextEncode",
                "inputs": {"clip": ["4", 1], "text": ""},
            },
            "8": {
                "class_type": "VAEDecode",
                "inputs": {"samples": ["3", 0], "vae": ["4", 2]},
            },
            "9": {
                "class_type": "SaveImage",
                "inputs": {"filename_prefix": "recipe_hero", "images": ["8", 0]},
            },
        }
        return workflow

    async def _submit_workflow(self, workflow: Dict[str, Any]) -> str:
        """
        Submit the workflow to ComfyUI and return the prompt ID.
        """
        payload = {"prompt": workflow, "client_id": str(uuid.uuid4())}
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.post(f"{self.base_url}/prompt", json=payload)
                resp.raise_for_status()
                data = resp.json()
                prompt_id = data.get("prompt_id")
                if not prompt_id:
                    raise ComfyUIWorkflowError("Response missing prompt_id")
                return prompt_id
        except httpx.HTTPError as exc:
            logger.error("comfyui_submit_failed", error=str(exc))
            raise ComfyUIWorkflowError(f"ComfyUI submit failed: {exc}") from exc

    async def _poll_for_completion(self, prompt_id: str) -> str:
        """
        Poll ComfyUI history until the workflow completes or fails.

        Returns:
            The filename of the generated image.

        Raises:
            ComfyUIWorkflowError: If polling times out or workflow fails.
        """
        max_attempts = int(self.timeout / self.poll_interval)
        for attempt in range(max_attempts):
            await asyncio.sleep(self.poll_interval)
            try:
                async with httpx.AsyncClient(timeout=10) as client:
                    resp = await client.get(f"{self.base_url}/history/{prompt_id}")
                    resp.raise_for_status()
                    history = resp.json()
            except httpx.HTTPError as exc:
                logger.warning("comfyui_poll_error", error=str(exc))
                continue

            if prompt_id in history:
                entry = history[prompt_id]
                status = entry.get("status", {})
                if status.get("completed"):
                    # Find the image filename from outputs
                    outputs = entry.get("outputs", {})
                    for node_output in outputs.values():
                        if "images" in node_output:
                            images = node_output["images"]
                            if images:
                                return images[0]["filename"]
                    raise ComfyUIWorkflowError("No image found in completed output")
                elif status.get("status_str") == "error":
                    raise ComfyUIWorkflowError("ComfyUI workflow reported error")

        raise ComfyUIWorkflowError(
            f"Timed out waiting for ComfyUI completion after {self.timeout}s"
        )

    async def _download_image(self, filename: str, output_dir: Path) -> Path:
        """
        Download the generated image from ComfyUI and save to output_dir.

        Args:
            filename: Image filename as returned by ComfyUI.
            output_dir: Directory to save the image.

        Returns:
            Path to the saved PNG file.

        Raises:
            ComfyUIWorkflowError: If download fails.
        """
        url = f"{self.base_url}/view?filename={filename}&subfolder=&type=output"
        output_path = output_dir / filename
        output_dir.mkdir(parents=True, exist_ok=True)

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                async with client.stream("GET", url) as resp:
                    resp.raise_for_status()
                    with open(output_path, "wb") as f:
                        async for chunk in resp.aiter_bytes():
                            f.write(chunk)
        except (httpx.HTTPError, OSError) as exc:
            logger.error("comfyui_download_failed", error=str(exc))
            raise ComfyUIWorkflowError(f"Image download failed: {exc}") from exc

        return output_path
