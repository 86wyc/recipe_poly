"""
Async HTTP client for Ollama to extract 4D recipe vectors.

The client sends a structured prompt to the configured Ollama model and
expects a JSON response containing four normalized values:
    [speed, minimalPrep, protein, lowCalorie]
Each value must be within [0.0, 1.0].
"""

from typing import Any, Dict, List

import httpx
import structlog

from sync_daemon.config import DaemonSettings
from sync_daemon.utils.exceptions import OllamaAPIError

logger = structlog.get_logger(__name__)


class OllamaClient:
    """Asynchronous client for Ollama vector extraction."""

    def __init__(self, settings: DaemonSettings) -> None:
        """
        Initialize the client with daemon settings.

        Args:
            settings: DaemonSettings instance containing OLLAMA_URL, OLLAMA_MODEL, OLLAMA_TIMEOUT.
        """
        self.base_url = str(settings.OLLAMA_URL).rstrip("/")
        self.model = settings.OLLAMA_MODEL
        self.timeout = settings.OLLAMA_TIMEOUT

    async def generate_vector(self, text: str) -> List[float]:
        """
        Generate a normalized 4D vector from recipe text using Ollama.

        Args:
            text: Raw recipe text (ingredients, steps, description).

        Returns:
            List of four floats: [speed, minimalPrep, protein, lowCalorie].

        Raises:
            OllamaAPIError: If the request fails, response is malformed,
                or vector values are out of bounds.
        """
        prompt = self._build_prompt(text)
        payload = {
            "model": self.model,
            "prompt": prompt,
            "stream": False,
            "format": "json",
        }

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    f"{self.base_url}/api/generate", json=payload
                )
                response.raise_for_status()
                data = response.json()
        except httpx.HTTPError as exc:
            logger.error("ollama_request_failed", error=str(exc))
            raise OllamaAPIError(f"Ollama request failed: {exc}") from exc

        vector = self._parse_vector(data)
        logger.debug("vector_generated", vector=vector)
        return vector

    def _build_prompt(self, text: str) -> str:
        """
        Construct the prompt instructing the model to output a 4D vector.
        """
        prompt = (
            "You are a recipe analysis assistant. Given the following recipe text, "
            "analyze it and output a JSON object with exactly four keys: "
            "'speed', 'minimalPrep', 'protein', 'lowCalorie'. "
            "Each value must be a floating-point number between 0.0 and 1.0, "
            "where higher values indicate:\n"
            "- speed: recipe is fast to prepare/cook\n"
            "- minimalPrep: recipe requires minimal preparation\n"
            "- protein: recipe is high in protein\n"
            "- lowCalorie: recipe is low in calories\n\n"
            "Return only the JSON object, no additional text.\n\n"
            f"Recipe text:\n{text}\n"
        )
        return prompt

    def _parse_vector(self, data: Dict[str, Any]) -> List[float]:
        """
        Parse and validate the Ollama response.

        Args:
            data: The JSON response from Ollama.

        Returns:
            List of four floats.

        Raises:
            OllamaAPIError: If response is missing expected fields or values are invalid.
        """
        # Ollama with format=json may return the JSON inside the "response" field
        response_text = data.get("response", "")
        if not response_text:
            raise OllamaAPIError("Ollama response did not contain 'response' field")

        try:
            import json

            vector_obj = json.loads(response_text)
        except json.JSONDecodeError as exc:
            raise OllamaAPIError(f"Could not parse JSON from Ollama response: {exc}") from exc

        required_keys = ["speed", "minimalPrep", "protein", "lowCalorie"]
        missing = [k for k in required_keys if k not in vector_obj]
        if missing:
            raise OllamaAPIError(f"Missing keys in vector response: {missing}")

        try:
            vector = [float(vector_obj[k]) for k in required_keys]
        except (TypeError, ValueError) as exc:
            raise OllamaAPIError("Vector values must be numeric") from exc

        if any(v < 0.0 or v > 1.0 for v in vector):
            raise OllamaAPIError(f"Vector values out of [0,1] range: {vector}")

        return vector
