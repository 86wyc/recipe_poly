# Deployment

Two Vercel projects plus a Supabase database.

| Project | Vercel name | Root dir | Framework |
|---|---|---|---|
| Backend | `recipe-poly` | `./` | Other |
| Frontend | `recipe-poly-one` | `frontend` | Next.js |

Supabase project: `pqspkbpfvbiciyhfhczz`, region `ap-southeast-2`.

## Backend (`recipe-poly`)

- Build command: **blank**
- Output directory: **blank**
- `vercel.json` at repo root rewrites `/api/*` → `api/[...path].ts`

```json
{
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/[...path]" }
  ]
}
```

### Environment Variables

| Variable | Notes |
|---|---|
| `DATABASE_URL` | Supabase **direct** connection (port 5432) |
| `DATABASE_URL_POOLED` | Supabase **Transaction Pooler** (port 6543, `?pgbouncer=true`) |
| `ALLOWED_ORIGINS` | Comma-separated; must include `https://recipe-poly-one.vercel.app` |

> **Stress point**: Current production deployment was verified with the **Session Pooler** on port 5432. The Transaction Pooler on 6543 was observed **hanging during `drizzle-kit push`**. Migration to 6543 is planned but must be validated separately under serverless load.

## Frontend (`recipe-poly-one`)

- Root directory: `frontend`
- Framework preset: **Next.js**

### Environment Variables

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | `https://recipe-poly.vercel.app/api` |

## Database Migrations — Dual Strategy

1. **Primary (local CLI)**:
   ```bash
   DATABASE_URL="postgres://…:5432/…" npx drizzle-kit push
   ```
   Uses the **direct** connection string.

2. **Fallback (SQL Editor)**:
   ```bash
   npx drizzle-kit generate
   ```
   Paste generated SQL into Supabase SQL Editor and execute.

## Sync Daemon

Runs locally on Pop!_OS, invoked manually:

```bash
python cli.py sync --file <path>
python cli.py sync --file <path> --dry-run
python cli.py sync --file <path> --stub-services
```

Not deployed to Vercel — this is intentional (needs local GPU access to Ollama and ComfyUI).

## Verification

Health check after backend deploy:

```bash
curl https://recipe-poly.vercel.app/api
```
