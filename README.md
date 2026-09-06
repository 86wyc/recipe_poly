# Recipe Application (Local-First AI + Cloud Backend)

Monorepo for a recipe application with AI‑generated content and a vector‑based recommendation engine.

Production API: `https://recipe-poly.vercel.app`

## Repository Structure

```
.
├── backend/                  # Hono API (TypeScript)
│   ├── src/
│   │   ├── api/
│   │   │   └── app.ts        # Hono app with CORS and route mounting
│   │   ├── routes/
│   │   ├── db/
│   │   └── index.ts
│   ├── api/
│   │   └── [...path].ts      # Vercel serverless entrypoint
│   ├── migrations/
│   ├── vercel.json           # Rewrites /api/* to serverless function
│   ├── .env.example
│   └── package.json
├── frontend/                 # Next.js application
│   ├── app/
│   ├── components/
│   ├── lib/
│   ├── public/
│   ├── .env.local.example
│   └── package.json
├── daemon/                   # Python Local Admin Sync Daemon
│   ├── sync_daemon/
│   │   ├── main.py
│   │   ├── ollama_client.py
│   │   ├── comfy_client.py
│   │   └── api_client.py
│   ├── requirements.txt
│   └── .env.example
├── docs/
│   ├── diagrams/
│   ├── API.md
│   ├── DATABASE.md
│   ├── RECOMMENDATION_ENGINE.md
│   ├── SYNC_DAEMON.md
│   ├── FRONTEND.md
│   └── DEPLOYMENT.md
└── docker-compose.yml        # local PostgreSQL + pgvector (dev)
```

## Prerequisites

- **Backend**: Node.js 20+, PostgreSQL 16 with `pgvector` extension, Vercel account (for production).
- **Frontend**: Node.js 20+, npm/pnpm/yarn.
- **Daemon**: Linux (Pop!_OS), Python 3.11+, Ollama, ComfyUI, ImageMagick.
- **Cloud**: Cloudflare R2 bucket.

## Setup

### 1. Backend (Hono API)

```bash
cd backend
cp .env.example .env
# Fill in DATABASE_URL, R2_* credentials
npm install
npm run migrate
npm run dev
```

Local API runs at `http://localhost:3001`.  
Production is serverless on Vercel; deployment via `vercel` CLI or Git integration.

### 2. Frontend (Next.js)

```bash
cd frontend
cp .env.local.example .env.local
# Set NEXT_PUBLIC_API_URL=https://recipe-poly.vercel.app for production,
# or http://localhost:3001 for local dev.
npm install
npm run dev
```

Frontend runs at `http://localhost:3000`.

### 3. Daemon (Local Admin Sync)

```bash
cd daemon
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Set OLLAMA_URL, COMFYUI_URL, API_URL=https://recipe-poly.vercel.app, R2 credentials
python -m sync_daemon.main
```

## Environment Variables

### Backend `.env`

| Variable                 | Description                               |
|--------------------------|-------------------------------------------|
| `DATABASE_URL`           | PostgreSQL connection string with pgvector|
| `R2_ACCOUNT_ID`          | Cloudflare R2 account ID                  |
| `R2_ACCESS_KEY_ID`       | R2 access key                             |
| `R2_SECRET_ACCESS_KEY`   | R2 secret key                             |
| `R2_BUCKET_NAME`         | Bucket name                               |
| `R2_PUBLIC_URL`          | Public base URL for images                |

### Frontend `.env.local`

| Variable                 | Description                               |
|--------------------------|-------------------------------------------|
| `NEXT_PUBLIC_API_URL`    | Base URL of Hono API                      |

### Daemon `.env`

| Variable                 | Description                               |
|--------------------------|-------------------------------------------|
| `OLLAMA_URL`             | Local Ollama endpoint (default `http://127.0.0.1:11434`) |
| `COMFYUI_URL`            | Local ComfyUI endpoint (default `http://127.0.0.1:8188`) |
| `API_URL`                | Hono API base URL (production `https://recipe-poly.vercel.app`) |
| `R2_*`                   | Same as backend R2 credentials            |
| `LOCAL_DB_PATH`          | Path to SQLite cache file                 |

## Development Workflow

1. Start local PostgreSQL: `docker compose up -d`
2. Run backend and frontend locally.
3. For daemon development, ensure Ollama and ComfyUI are running.
4. Run migrations after schema changes.
5. Use the daemon to import recipes; it uploads images to R2 and POSTs to the API.

## Documentation

- [API Endpoints](docs/API.md)
- [Database Schema](docs/DATABASE.md)
- [Recommendation Engine](docs/RECOMMENDATION_ENGINE.md)
- [Sync Daemon](docs/SYNC_DAEMON.md)
- [Frontend Pages](docs/FRONTEND.md)
- [Deployment (Vercel)](docs/DEPLOYMENT.md)
