# Recommendation Engine

Each recipe carries a 4-dimensional vector stored in PostgreSQL via `pgvector`. Recommendations rank by cosine similarity against a user (or guest) preference vector.

## Vector Dimensions

`attribute_vector = [speed, minimalPrep, protein, lowCalorie]`

| Index | Dimension | Meaning | Range |
|---|---|---|---|
| 0 | speed | Quick to prepare | 0..1 |
| 1 | minimalPrep | Low prep effort | 0..1 |
| 2 | protein | High protein content | 0..1 |
| 3 | lowCalorie | Low calorie density | 0..1 |

All vectors normalized to unit length for cosine similarity.

## Similarity Search

Cosine distance operator: `<=>`. Similarity = `1 - (a <=> b)`.

```sql
SELECT recipe_id, 1 - (attribute_vector <=> $1) AS similarity
FROM recipe_vectors
ORDER BY attribute_vector <=> $1
LIMIT $2;
```

IVFFlat index with `lists=1`. At current data volume (< 100 recipes) the planner may still choose a sequential scan; that is acceptable.

## Guest Overlay Vector

Home page exposes four sliders + presets. Guest users (not logged in) adjust sliders directly; values are combined into a single `preferences` vector client-side and sent to `POST /api/recommendations`. No profile storage.

### Presets

| Preset | Vector |
|---|---|
| Balanced | `[0.5, 0.5, 0.5, 0.5]` |
| Quick & Easy | `[0.9, 0.9, 0.3, 0.4]` |
| High Protein | `[0.4, 0.3, 0.95, 0.6]` |
| Low Calorie | `[0.4, 0.4, 0.3, 0.95]` |

## Hydration

After the vector query returns recipe IDs and similarities, the API hydrates each result with recipe details (`buildRecipeWithDetails`).

## Known Issues

### P0 — Intermittent 500 under certain slider inputs

```
Failed query: select "recipe_id", "attribute_vector", "updated_at"
from "recipe_vectors"
where "recipe_vectors"."recipe_id" = $1::uuid
limit $2 params: <uuid>,1
```

**Hypothesis**: N+1 hydration in `buildRecipeWithDetails`. Each recommendation call triggers ~25 round-trips (5 queries × 5 recipes) through a `max: 1` serverless pool. Pool starvation under load.

**Fix direction**: Batch relation queries with `inArray`, group results in memory. Target ~5 round-trips per request.

### P1 — Latency

Recommendation latency exceeds 10 s under certain inputs. Same N+1 pattern, plus no caching and possibly no index use at low row counts.

**Fix direction**: Combine with P0 batching; consider a short-TTL in-memory LRU cache for hydration.

## Fallback Strategy

If no recipe clears a similarity threshold (default 0.5), the API returns the most recent recipes.
