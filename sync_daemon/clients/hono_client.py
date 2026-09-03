"""
Async HTTP client for the Hono API.

Submits recipe payloads to POST /api/recipes and returns the created recipe ID.
"""

from typing import Any, Dict

import httpx
import structlog

from sync_daemon.config import DaemonSettings
from sync_daemon.utils.exceptions import HonoAPIError

logger = structlog.get_logger(__name__)


class HonoAPIClient:
    """Asynchronous client for Hono backend API."""

    def __init__(self, settings: DaemonSettings) -> None:
        """
        Initialize the client.

        Args:
            settings: DaemonSettings instance containing HONO_API_URL and HONO_API_TIMEOUT.
        """
        self.base_url = str(settings.HONO_API_URL).rstrip("/")
        self.timeout = settings.HONO_API_TIMEOUT

    async def create_recipe(self, payload: Dict[str, Any]) -> str:
        """
        Submit a recipe payload to the Hono API.

        Args:
            payload: Dictionary matching CreateRecipeInputSchema.

        Returns:
            The created recipe ID (UUID string).

        Raises:
            HonoAPIError: If request fails or response is not 201.
        """
        url = f"{self.base_url}/api/recipes"
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(url, json=payload)
        except httpx.HTTPError as exc:
            logger.error("hono_api_request_failed", error=str(exc))
            raise HonoAPIError(f"Hono API request failed: {exc}") from exc

        if response.status_code != 201:
            logger.error(
                "hono_api_unexpected_status",
                status_code=response.status_code,
                body=response.text,
            )
            raise HonoAPIError(
                f"Hono API returned {response.status_code}: {response.text}"
            )

        data = response.json()
        recipe_id = data.get("recipeId")
        if not recipe_id:
            raise HonoAPIError("Response missing 'recipeId'")

        logger.info("recipe_created", recipe_id=recipe_id)
        return recipe_id
