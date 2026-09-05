"""
Stub clients for dry-run and stub-services modes.
"""

from pathlib import Path
from typing import List

from PIL import Image

from sync_daemon.config import DaemonSettings


class OllamaClientStub:
    """Returns a fixed 4D vector without calling Ollama."""

    def __init__(self, settings: DaemonSettings) -> None:
        self.settings = settings

    async def generate_vector(self, text: str) -> List[float]:
        return [0.5, 0.5, 0.5, 0.5]


class ComfyClientStub:
    """Generates a simple PNG locally instead of calling ComfyUI."""

    def __init__(self, settings: DaemonSettings) -> None:
        self.temp_dir = settings.TEMP_DIR

    async def generate_image(self, prompt: str, output_dir: Path) -> Path:
        output_dir.mkdir(parents=True, exist_ok=True)
        image_path = output_dir / "stub_recipe.png"
        if not image_path.exists():
            img = Image.new("RGB", (512, 512), color=(200, 160, 120))
            img.save(image_path, "PNG")
        return image_path


class R2ClientStub:
    """Returns a mock URL without uploading to R2."""

    def __init__(self, settings: DaemonSettings) -> None:
        self.settings = settings

    async def upload_file(self, local_path: Path, object_key: str) -> str:
        return "https://assets.local.dev/recipes/stub.webp"
