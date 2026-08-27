"""
Custom exception taxonomy for the Local Admin Sync Daemon.

Each exception corresponds to a specific failure domain. The orchestrator
catches these to apply strict halt policies and structured logging.
"""


class SyncDaemonError(Exception):
    """Base exception for all daemon errors."""


class OllamaAPIError(SyncDaemonError):
    """Raised when Ollama API request fails or returns invalid data."""


class ComfyUIWorkflowError(SyncDaemonError):
    """Raised when ComfyUI image generation fails or workflow is invalid."""


class ImageProcessingError(SyncDaemonError):
    """Raised when image conversion (PNG to WebP) fails."""


class R2UploadError(SyncDaemonError):
    """Raised when upload to Cloudflare R2 fails."""


class HonoAPIError(SyncDaemonError):
    """Raised when Hono API ingestion fails or returns non-2xx."""


class RecipePipelineAbort(SyncDaemonError):
    """Raised to abort the recipe pipeline before posting to Hono API."""
