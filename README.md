# Recipe Poly

Local-first hybrid recipe application with a 4D pgvector recommendation engine.

**Pipeline:** Local Admin Studio (Ollama + ComfyUI) → Python Sync Daemon → Hono API (Vercel) → Supabase PostgreSQL + pgvector → Next.js frontend (Vercel).

## Live URLs

| Service | URL |
|---|---|
| Frontend | `https://recipe-poly-one.vercel.app` |
| Backend API | `https://recipe-poly.vercel.app` |
| Database | Supabase project `pqspkbpfvbiciyhfhczz` (region `ap-southeast-2`) |

## Repository Structure

```
recipe_poly/
├── api/                    # Vercel serverless entrypoint
│   └── [...path].ts
├── vercel.json             # Rewrite rules
├── drizzle/                # SQL migrations
├── drizzle.config.ts
├── src/
│   ├── api/                # Hono routes, middleware, validation
│   ├── db/                 # Drizzle schema, connection, repositories
│   │   ├── schema.ts
│   │   ├── connection.ts
│   │   ├── helpers/
│   │   └── repositories/
│   └── server.ts           # Local dev server entrypoint
├── frontend/               # Next.js app (separate Vercel project)
│   ├── src/app/
│   ├── src/components/
│   ├── src/lib/api-client.ts
│   └── vercel.json
├── sync_daemon/            # Python CLI (Local Admin Daemon)
│   ├── cli.py
│   ├── config.py
│   ├── clients/
│   ├── pipeline/
│   └── utils/
├── docs/
│   ├── diagrams/
│   ├── API.md
│   ├── DATABASE.md
│   ├── DEPLOYMENT.md
│   ├── FRONTEND.md
│   ├── RECOMMENDATION_ENGINE.md
│   └── SYNC_DAEMON.md
└── agent.md
```

## Prerequisites

- **Backend**: Node.js 24, Supabase account (PostgreSQL 16 + pgvector), Vercel account.
- **Frontend**: Node.js 24.
- **Sync Daemon**: Pop!_OS (Linux), Python 3.12, Ollama (`llama3:8b-instruct-q8_0`), ComfyUI + FLUX.1-schnell, ImageMagick.
- **Cloud**: Cloudflare R2 (planned, not yet wired).

## Setup

### 1. Backend (Hono API)

```bash
npm install
cp .env.example .env
# Fill in DATABASE_URL (port 5432), DATABASE_URL_POOLED (port 6543), ALLOWED_ORIGINS
npx drizzle-kit push          # apply schema via direct connection
npm run dev                   # tsx watch src/server.ts — port 3000
```

### 2. Frontend (Next.js)

```bash
cd frontend
npm install
cp .env.local.example .env.local
# Set NEXT_PUBLIC_API_BASE_URL=https://recipe-poly.vercel.app/api
npm run dev                   # port 3001
```

### 3. Sync Daemon (Local Admin)

```bash
cd sync_daemon
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.daemon.example .env.daemon
# Fill in DATABASE_URL, OLLAMA_URL, COMFYUI_URL, R2_*, HONO_API_URL
python cli.py sync --file <path>   # add --dry-run or --stub-services for testing
```

## Environment Variables

### Backend (Vercel project `recipe-poly`)

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Supabase direct connection (port 5432) |
| `DATABASE_URL_POOLED` | Supabase Transaction Pooler (port 6543, `?pgbouncer=true`) — **not yet validated under serverless load** |
| `ALLOWED_ORIGINS` | Comma-separated list, e.g. `https://recipe-poly-one.vercel.app,http://localhost:3001` |

### Frontend (Vercel project `recipe-poly-one`)

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | `https://recipe-poly.vercel.app/api` |

### Sync Daemon (`.env.daemon`, local only)

`DATABASE_URL`, `OLLAMA_URL`, `COMFYUI_URL`, `R2_*`, `HONO_API_URL`, `TEMP_DIR`, `LOG_LEVEL`, `CONCURRENCY_LIMIT`.

## Development Workflow

- Backend dev: `npm run dev` (port 3000)
- Frontend dev: `cd frontend && npm run dev` (port 3001)
- Local DB: PostgreSQL 16 on `localhost:5432`, database `recipe_app`
- Backend typecheck: `npx tsc --noEmit`
- Frontend typecheck: `cd frontend && npx tsc --noEmit`
- Frontend build check: `cd frontend && npm run build`

## Deployment

- **Backend (`recipe-poly`)**: push to `main` → auto-deploy. Root `./`, Framework **Other**, no build/output command. `vercel.json` rewrites `/api/*` to `api/[...path].ts`.
- **Frontend (`recipe-poly-one`)**: push to `main` → auto-deploy. Root `frontend`, Framework **Next.js**.
- **Database migrations**: dual strategy — primary `npx drizzle-kit push` on direct 5432, fallback `npx drizzle-kit generate` + manual run in Supabase SQL Editor.

## Documentation

- [API](docs/API.md)
- [Database](docs/DATABASE.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Frontend](docs/FRONTEND.md)
- [Recommendation Engine](docs/RECOMMENDATION_ENGINE.md)
- [Sync Daemon](docs/SYNC_DAEMON.md)
- [agent.md](agent.md) — project roles, conventions, known issues
