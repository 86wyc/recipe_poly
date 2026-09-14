# API

Base URL (production): `https://recipe-poly.vercel.app/api`
Local dev: `http://localhost:3000/api`

All requests and responses are JSON. Every response is wrapped in an envelope:

```json
{ "success": true, "data": { ... } }
```

```json
{ "success": false, "error": { "message": "...", "code": "..." } }
```

## Routes

| Method | Path | Description |
|---|---|---|
| GET | `/api` | Health check |
| GET | `/api/recipes/:id` | Recipe by UUID |
| GET | `/api/recipes/slug/:slug` | Recipe by slug |
| POST | `/api/recipes` | Create recipe (transactional) |
| POST | `/api/recommendations` | 4D vector cosine search + hydration |
| POST | `/api/substitutions` | Ingredient substitutions |

## GET /api

Health check.

Response `200`:

```json
{ "success": true, "data": { "status": "ok" } }
```

## GET /api/recipes/:id

Path param: `id` — UUID v4.

Response `200`:

```json
{
  "success": true,
  "data": {
    "id": "3f2b1a4c-8d5e-4a9b-b1c2-7e8f9a0b1c2d",
    "slug": "creamy-mushroom-risotto",
    "title": "Creamy Mushroom Risotto",
    "description": "Rich and savory risotto.",
    "instructions": {
      "steps": [
        { "id": "s1", "text": "Heat oil", "next": ["s2"] },
        { "id": "s2", "text": "Add onions", "next": ["s3"] },
        { "id": "s3", "text": "Add rice", "next": ["s4"] },
        { "id": "s4", "text": "Serve", "next": [] }
      ]
    },
    "cuisine": "Italian",
    "tags": ["vegetarian", "comfort-food"],
    "prep_time_min": 15,
    "cook_time_min": 30,
    "temperature_c": null,
    "calories": 450,
    "protein_g": 12.5,
    "attribute_vector": [0.82, 0.40, 0.65, 0.55],
    "image_url": "https://r2.example.com/recipes/creamy-mushroom-risotto.webp",
    "ingredients": [
      { "ingredient_id": "…", "name": "Arborio rice", "quantity": 0.25, "unit": "cups" }
    ],
    "variants": []
  }
}
```

- `instructions` is a JSONB step DAG, not a flat string array.
- `quantity` in ingredients is normalized to `base_servings = 1`.
- `temperature_c` is Celsius when present.

## GET /api/recipes/slug/:slug

Path param: `slug` — string. Same response shape as by ID.

## POST /api/recipes

Request body:

```json
{
  "title": "Spicy Tofu Stir-Fry",
  "description": "Quick weeknight dinner",
  "instructions": { "steps": [ { "id": "s1", "text": "Press tofu", "next": ["s2"] } ] },
  "cuisine": "Asian",
  "tags": ["vegan", "spicy"],
  "prep_time_min": 10,
  "cook_time_min": 15,
  "calories": 380,
  "protein_g": 22.0,
  "attribute_vector": [0.90, 0.75, 0.80, 0.70],
  "image_url": "https://r2.example.com/recipes/spicy-tofu-stir-fry.webp",
  "ingredients": [
    { "name": "Tofu", "quantity": 100, "unit": "g" },
    { "name": "Soy sauce", "quantity": 0.5, "unit": "tbsp" }
  ]
}
```

- Do **not** send `null` for optional fields — omit the key entirely.
- Ingredient `quantity` must be supplied at `base_servings = 1`.

Response `201`: same shape as `GET /api/recipes/:id`.

## POST /api/recommendations

Request:

```json
{
  "preferences": [0.8, 0.3, 0.9, 0.6],
  "limit": 10,
  "exclude_recipe_ids": ["…"]
}
```

- `preferences` = `[speed, minimalPrep, protein, lowCalorie]`, each `0..1`.
- `exclude_recipe_ids` optional; UUID v4 list.

Response `200`:

```json
{
  "success": true,
  "data": {
    "recommendations": [
      {
        "recipe_id": "…",
        "title": "High-Protein Omelette",
        "slug": "high-protein-omelette",
        "similarity": 0.94,
        "image_url": "https://r2.example.com/…",
        "attribute_vector": [0.95, 0.40, 0.92, 0.65]
      }
    ]
  }
}
```

> **Known issue (P0)**: intermittent 500 under certain slider inputs due to N+1 hydration in `buildRecipeWithDetails` under pool `max: 1`. See `agent.md` §12.

## POST /api/substitutions

Request:

```json
{
  "ingredient_id": "…",
  "dietary_restrictions": ["vegan", "gluten-free"]
}
```

Response `200`:

```json
{
  "success": true,
  "data": {
    "original_ingredient": "Milk",
    "substitutes": [
      { "ingredient_id": "…", "name": "Oat milk", "ratio": 1.0, "notes": "Works well in baking" }
    ]
  }
}
```

> **Status**: not yet integration-tested against real data.

## Error Responses

| Code | Meaning | Body |
|---|---|---|
| 400 | Bad request | `{"success": false, "error": {"message": "Invalid vector length", "code": "BAD_REQUEST"}}` |
| 404 | Not found | `{"success": false, "error": {"message": "Recipe not found", "code": "NOT_FOUND"}}` |
| 409 | Conflict | `{"success": false, "error": {"message": "Slug already exists", "code": "CONFLICT"}}` |
| 500 | Internal | `{"success": false, "error": {"message": "Database connection failed", "code": "INTERNAL"}}` |
