"""
Structured logging configuration using structlog.

Provides a `get_logger` function that returns a bound logger for a module.
"""

import logging
import sys

import structlog


def configure_logging(log_level: str = "INFO") -> None:
    """
    Configure structlog and standard logging.

    Sets up a console renderer with human-readable output and a JSON renderer
    for file-based logging (optional). To keep the daemon lightweight, only
    console rendering is enabled by default.

    Args:
        log_level: One of DEBUG, INFO, WARNING, ERROR, CRITICAL.
    """
    numeric_level = getattr(logging, log_level.upper(), logging.INFO)

    # Standard logging baseline
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=numeric_level,
    )

    # Structlog configuration
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.dev.ConsoleRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(numeric_level),
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=True,
    )


def get_logger(name: str) -> structlog.BoundLogger:
    """
    Return a bound logger for a module.

    Args:
        name: Module name (e.g., __name__).

    Returns:
        A structlog BoundLogger.
    """
    return structlog.get_logger(name)
