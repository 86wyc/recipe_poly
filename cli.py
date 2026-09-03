"""
Typer CLI entrypoint for the Local Admin Sync Daemon.

Usage:
    python cli.py sync --file <path>
    python cli.py sync-dir <dir>
"""

import asyncio
from pathlib import Path
from typing import Optional

import typer

from sync_daemon.config import DaemonSettings
from sync_daemon.pipeline.orchestrator import RecipePipelineOrchestrator
from sync_daemon.utils.logger import configure_logging, get_logger

app = typer.Typer()
logger = get_logger(__name__)


@app.command()
def sync(
    file: Path = typer.Option(..., "--file", help="Path to a recipe file (JSON/plain text)"),
    env_file: Optional[Path] = typer.Option(None, "--env-file", help="Path to .env.daemon file"),
):
    """
    Process a single recipe file.
    """
    settings = DaemonSettings(_env_file=env_file) if env_file else DaemonSettings()
    configure_logging(settings.LOG_LEVEL)
    orchestrator = RecipePipelineOrchestrator(settings)

    recipe_id = asyncio.run(orchestrator.run_file(file))
    if recipe_id:
        typer.echo(f"Success: recipe created with ID {recipe_id}")
    else:
        typer.echo("Pipeline failed for recipe.", err=True)
        raise typer.Exit(code=1)


@app.command()
def sync_dir(
    directory: Path = typer.Option(..., "--dir", help="Directory containing recipe files"),
    env_file: Optional[Path] = typer.Option(None, "--env-file", help="Path to .env.daemon file"),
):
    """
    Process all recipe files in a directory.
    """
    settings = DaemonSettings(_env_file=env_file) if env_file else DaemonSettings()
    configure_logging(settings.LOG_LEVEL)
    orchestrator = RecipePipelineOrchestrator(settings)

    summary = asyncio.run(orchestrator.run_directory(directory))
    typer.echo(f"Processing complete: {summary}")


if __name__ == "__main__":
    app()
