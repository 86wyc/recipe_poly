# Sync Daemon

Local Python 3.12 CLI that turns recipe source documents into fully-ingested records on the Hono API: local AI vector extraction, image generation, PNG→WebP conversion, R2 upload, then API POST.

Runs on Pop!_OS with an RTX 5070 Ti.

## Stack

- CLI: Typer
- HTTP: httpx (async)
- S3/R2: aioboto3
- Image conversion: Pillow
- Structured logging: structlog

## Invocation

```bash
python cli.py sync --file <path>
python cli.py sync --file <path> --dry-run
python cli.py sync --file <path> --stub-services
```

- `--dry-run`: runs pipeline without uploading or POSTing.
- `--stub-services`: replaces Ollama, ComfyUI, and R2 with stubs. Required for local testing while R2 integration is not yet wired.

## Pipeline (Sequential)

1. **Ollama — Vector Extraction**
   Local Ollama (`llama3:8b-instruct-q8_0`) extracts a 4D vector `[speed, minimalPrep, protein, lowCalorie]` from recipe attributes. Output: JSON array, normalized to `[0, 1]`.

2. **ComfyUI — Image Generation**
   Sends workflow JSON to ComfyUI (`FLUX.1-schnell`) using the recipe title as prompt. Output: PNG path.

3. **PNG → WebP**
   Pillow converts PNG to WebP.

4. **Cloudflare R2 Upload** *(planned, not yet wired)*
   Upload WebP to `recipes/{recipe_id}.webp`. Returns public URL.

5. **Hono API Ingestion**
   `POST https://recipe-poly.vercel.app/api/recipes` with recipe JSON, `image_url`, and `attribute_vector`.

## Strict Halt Policy

- Batches processed sequentially.
- Any failure in any step halts the entire batch.
- No partial ingestion. Orphaned images (if any) are not referenced and can be cleaned up later.
- Non-zero exit code; manual intervention required to resume.

## Configuration (`.env.daemon`, local only)

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Direct Supabase connection |
| `OLLAMA_URL` | Default `http://127.0.0.1:11434` |
| `COMFYUI_URL` | Default `http://127.0.0.1:8188` |
| `R2_*` | Cloudflare R2 credentials (unused until wiring completed) |
| `HONO_API_URL` | `https://recipe-poly.vercel.app/api` |
| `TEMP_DIR` | Scratch directory for intermediate PNG/WebP |
| `LOG_LEVEL` | structlog level |
| `CONCURRENCY_LIMIT` | Max parallel pipeline jobs |

## Known Gaps

- Real ComfyUI + R2 integration is **not yet configured**; daemon runs with stubs by default.
- Only verified against `--stub-services` runs.
