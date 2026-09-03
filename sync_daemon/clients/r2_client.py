"""
Async Cloudflare R2 upload client using aioboto3.

Uploads local files to an R2 bucket under a given object key.
Returns the public URL if R2_PUBLIC_BASE_URL is configured.
"""

from pathlib import Path
from typing import Optional

import aioboto3
import structlog

from sync_daemon.config import DaemonSettings
from sync_daemon.utils.exceptions import R2UploadError

logger = structlog.get_logger(__name__)


class R2Client:
    """Asynchronous uploader for Cloudflare R2 (S3-compatible)."""

    def __init__(self, settings: DaemonSettings) -> None:
        """
        Initialize the client.

        Args:
            settings: DaemonSettings instance with R2 credentials and bucket config.
        """
        self.endpoint_url = str(settings.R2_ENDPOINT_URL)
        self.access_key = settings.R2_ACCESS_KEY_ID
        self.secret_key = settings.R2_SECRET_ACCESS_KEY
        self.bucket_name = settings.R2_BUCKET_NAME
        self.timeout = settings.R2_UPLOAD_TIMEOUT
        # Public base URL for uploaded objects (e.g., https://pub-xxx.r2.dev)
        self.public_base_url = getattr(settings, "R2_PUBLIC_BASE_URL", None)

    async def upload_file(self, local_path: Path, object_key: str) -> str:
        """
        Upload a local file to R2 and return its public URL.

        Args:
            local_path: Path to the local file to upload.
            object_key: Destination key in the bucket (e.g., "recipes/2026/09/foo.webp").

        Returns:
            Public URL string if R2_PUBLIC_BASE_URL is set; otherwise returns object_key.

        Raises:
            R2UploadError: If upload fails or local file is missing.
        """
        if not local_path.is_file():
            raise R2UploadError(f"Local file not found: {local_path}")

        try:
            session = aioboto3.Session()
            async with session.client(
                "s3",
                endpoint_url=self.endpoint_url,
                aws_access_key_id=self.access_key,
                aws_secret_access_key=self.secret_key,
                region_name="auto",
                config=None,
            ) as s3:
                with open(local_path, "rb") as f:
                    await s3.upload_fileobj(
                        f,
                        self.bucket_name,
                        object_key,
                    )
        except Exception as exc:
            logger.error(
                "r2_upload_failed",
                error=str(exc),
                object_key=object_key,
                local_path=str(local_path),
            )
            raise R2UploadError(f"R2 upload failed: {exc}") from exc

        logger.info("r2_upload_success", object_key=object_key)

        if self.public_base_url:
            public_url = f"{str(self.public_base_url).rstrip('/')}/{object_key}"
            return public_url
        return object_key
