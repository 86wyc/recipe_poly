# agent.md — Recipe Poly Project

## 1. Project Overview
Local-first hybrid recipe application with a 4D pgvector recommendation engine.
Architecture pipeline: Local Admin Studio (Ollama + ComfyUI) → Python Sync Daemon → Hono API on Vercel → Supabase PostgreSQL + pgvector → Next.js frontend on Vercel.

## 2. Team Roles & Operational Scope
1. **UI/UX Product Designer** — Component design, visual specs, front-end data presentation.
2. **System Architect** — DB schemas, API contracts, recommendation algorithms, AI pipeline.
3. **Coder** — Implementation of approved specs (frontend, backend, DB, AI integration).
4. **Code Reviewer** — Audits for edge-case safety, GPU/memory efficiency, security, contract adherence.
5. **Librarian** — README, PlantUML diagrams, markdown documentation.
6. **Human Coordinator** — Routes handoffs, provides executive approval, manages project goals.

## 3. Operational Guidelines
- **Modular pacing**: Never write an entire module in one response. Always output an Implementation Roadmap first and pause for selection.
- **Architect feedback loop**: Propose changes via `[TARGET: SYSTEM ARCHITECT]` handoffs. Do not implement unapproved architectural changes.
- **Declared assumptions**: Every code deliverable must include "Assumptions & Stress Points".
- **Direct communication**: Skip greetings. Lead with deliverable.
- **Strict handoff protocol**: Never auto-generate handoff blocks without Human Coordinator's explicit approval.

## 4. Tech Stack (Current, Live)
| Layer | Technology | Hosting |
|-------|-----------|---------|
| Frontend | Next.js 16 (App Router, TS, Tailwind, Mermaid) | Vercel — `https://recipe-poly-one.vercel.app` |
| Backend API | Hono (Node.js 24 serverless) | Vercel — `https://recipe-poly.vercel.app` |
| Database | PostgreSQL 16 + pgvector | Supabase free tier (project `pqspkbpfvbiciyhfhczz`, region `ap-southeast-2`) |
| Object Storage | Cloudflare R2 (planned, not yet wired) | — |
| Sync Daemon | Python 3.12 CLI (Typer, httpx, aioboto3, Pillow, structlog) | Local Pop!_OS (RTX 5070 Ti) |
| Local AI | Ollama (`llama3:8b-instruct-q8_0`), ComfyUI + FLUX.1-schnell | Local |

## 5. Repository Structure
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
└── agent.md                # This file
```

## 6. Database Schema Summary
- `recipes` — Master dish, JSONB step DAG, temp in Celsius.
- `recipe_variants` — `base_recipe_id` + unique `variant_recipe_id`.
- `ingredients` — Normalized ingredient catalog.
- `recipe_ingredients` — Quantity stored at `base_servings = 1`.
- `ingredient_substitutions` — Ratio + dietary tags (GIN indexed).
- `recipe_vectors` — 4D pgvector `[speed, minimalPrep, protein, lowCalorie]`, IVFFlat cosine index with `lists=1`.

## 7. API Contracts
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api` | Health check |
| GET | `/api/recipes/:id` | Recipe by UUID |
| GET | `/api/recipes/slug/:slug` | Recipe by slug |
| POST | `/api/recipes` | Create recipe (transactional) |
| POST | `/api/recommendations` | 4D vector cosine search + hydration |
| POST | `/api/substitutions` | Ingredient substitutions |

## 8. Environment Variables

### Backend (Vercel project `recipe-poly`)
- `DATABASE_URL` — Supabase direct connection string (port 5432, direct host).
- `DATABASE_URL_POOLED` — Supabase **Transaction Pooler** string on port `6543` with `?pgbouncer=true`.
  - **Stress point**: Current production deployment was verified with the **Session Pooler** on port `5432` (transaction pooler on 6543 was observed hanging during `drizzle-kit push`). Migration to Transaction Pooler 6543 is planned but must be validated separately under serverless load.
- `ALLOWED_ORIGINS` — Comma-separated allowed origins (e.g., `https://recipe-poly-one.vercel.app,http://localhost:3001`).

### Frontend (Vercel project `recipe-poly-one`)
- `NEXT_PUBLIC_API_BASE_URL` = `https://recipe-poly.vercel.app/api`

### Sync Daemon (`.env.daemon`, local only)
- `DATABASE_URL`, `OLLAMA_URL`, `COMFYUI_URL`, `R2_*`, `HONO_API_URL`, `TEMP_DIR`, `LOG_LEVEL`, `CONCURRENCY_LIMIT`.

## 9. Deployment

### Backend (Vercel `recipe-poly`)
- Push to `main` → auto-deploy.
- Root directory: `./`. Framework Preset: **Other**. Build Command: blank. Output Directory: blank.
- `vercel.json` at root maps all `/api/*` to `api/[...path].ts` via rewrites.

### Frontend (Vercel `recipe-poly-one`)
- Push to `main` → auto-deploy.
- Root directory: `frontend`. Framework Preset: **Next.js**.

### Database Migrations — Dual Strategy
1. **Primary**: Local CLI migration via `DATABASE_URL="..." npx drizzle-kit push` using the **direct** connection string (port 5432).
2. **Secondary / Fallback**: Generate SQL locally with `npx drizzle-kit generate`, then execute the SQL manually in Supabase SQL Editor.

### Sync Daemon
- Runs locally, invoked manually: `python cli.py sync --file <path>` (with `--dry-run` or `--stub-services` for testing).

## 10. Development Workflow
- Local backend: `npm run dev` (tsx watch `src/server.ts`, port 3000).
- Local frontend: `cd frontend && npm run dev` (port 3001).
- Local database: PostgreSQL 16 on `localhost:5432`, database `recipe_app`.
- Typecheck backend: `npx tsc --noEmit`.
- Typecheck frontend: `cd frontend && npx tsc --noEmit`.
- Frontend build check: `cd frontend && npm run build`.

## 11. Handoff Protocol
- Inter-AI messages use `[TARGET: <ROLE>]` markdown code blocks.
- Coder must receive Human Coordinator's explicit approval before emitting handoff blocks.
- Approved handoff targets: **System Architect**, **Code Reviewer**, **Librarian**.

## 12. Known Issues / Open Work

### P0 — Critical Blocker
- **Intermittent 500 on `POST /api/recommendations`** under certain slider inputs.
  - Symptom: `Failed query: select "recipe_id", "attribute_vector", "updated_at" from "recipe_vectors" where "recipe_vectors"."recipe_id" = $1::uuid limit $2 params: <uuid>,1`
  - Hypothesis: N+1 hydration in `buildRecipeWithDetails` during serverless execution causes pool starvation under `max: 1`. Each recommendation call triggers ~25 round-trips (5 queries × 5 recipes) through a single connection.
  - Fix direction: Batch relation queries using `inArray`, then group in memory. Reduce to ~5 round-trips per request.

### P1 — Performance Tuning
- **Recommendation latency 10+ seconds** under certain inputs.
  - Hypothesis: Same N+1 pattern, plus no query-level caching. IVFFlat index may not be used due to low data volume.
  - Fix direction: Combine with P0 batching. Consider serverless in-memory LRU cache (short TTL) for hydration step.

### P2 — Feature / Integration Gaps
- Real ComfyUI + R2 integration not yet configured (daemon uses stubs).
- `POST /api/substitutions` not yet integration tested with real data.
- Seed data limited to 8 recipes.
- No recipe variant creation endpoint.

## 13. Conventions & Rules
- Never send `null` for optional fields to Hono API — omit the key entirely.
- Vectors are `[speed, minimalPrep, protein, lowCalorie]`, normalized to `[0, 1]`.
- All UUIDs are v4; validate format before DB queries.
- Serving scaling is client-side on frontend; API accepts `servings` param for legacy use.
- Structured logging via `structlog` in Python, `console.error` with structured fields in Node.
- All API responses wrap data in `{ success: true, data: ... }` or `{ success: false, error: { message, ... } }`.
