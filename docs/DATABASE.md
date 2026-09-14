# Database Schema

PostgreSQL 16 with `pgvector` on Supabase (project `pqspkbpfvbiciyhfhczz`, region `ap-southeast-2`).

Extension required: `CREATE EXTENSION vector;`

All primary keys are **UUID v4**. Temperature values are **Celsius**. Ingredient quantities are stored at **`base_servings = 1`**.

## Tables

### `recipes`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | UUID v4 |
| slug | TEXT | UNIQUE NOT NULL | URL-friendly identifier |
| title | TEXT | NOT NULL | Recipe title |
| description | TEXT | | Short description |
| instructions | JSONB | NOT NULL | Step DAG (see below) |
| cuisine | TEXT | | Cuisine type |
| tags | TEXT[] | | Array of tags |
| prep_time_min | INTEGER | | Prep minutes |
| cook_time_min | INTEGER | | Cook minutes |
| total_time_min | INTEGER | | Derived |
| temperature_c | NUMERIC | | Cooking temperature in Celsius |
| calories | INTEGER | | Per serving |
| protein_g | NUMERIC(6,2) | | Per serving |
| carbs_g | NUMERIC(6,2) | | Per serving |
| fat_g | NUMERIC(6,2) | | Per serving |
| attribute_vector | vector(4) | NOT NULL | `[speed, minimalPrep, protein, lowCalorie]` |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | |

**Indexes**: IVFFlat on `attribute_vector` (cosine, `lists=1`); B-tree on `slug`; GIN on `tags`.

**`instructions` JSONB shape**:

```json
{
  "steps": [
    { "id": "s1", "text": "Heat oil", "next": ["s2"] },
    { "id": "s2", "text": "Add onions", "next": ["s3"], "condition": "until translucent" },
    { "id": "s3", "text": "Add rice", "next": ["s4"] },
    { "id": "s4", "text": "Serve", "next": [] }
  ]
}
```

### `recipe_variants`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | |
| base_recipe_id | UUID | NOT NULL, REFERENCES recipes(id) ON DELETE CASCADE | |
| variant_recipe_id | UUID | NOT NULL, UNIQUE, REFERENCES recipes(id) ON DELETE CASCADE | Each variant is itself a recipe |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |

### `ingredients`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | |
| name | TEXT | UNIQUE NOT NULL | |
| category | TEXT | | e.g. `dairy`, `grain` |
| nutrition_per_100g | JSONB | | |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |

### `recipe_ingredients`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | |
| recipe_id | UUID | NOT NULL, REFERENCES recipes(id) ON DELETE CASCADE | |
| ingredient_id | UUID | NOT NULL, REFERENCES ingredients(id) | |
| quantity | NUMERIC | | At `base_servings = 1` |
| unit | TEXT | | |
| note | TEXT | | |

**Constraints**: `UNIQUE(recipe_id, ingredient_id)`.

### `ingredient_substitutions`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | |
| original_ingredient_id | UUID | NOT NULL, REFERENCES ingredients(id) | |
| substitute_ingredient_id | UUID | NOT NULL, REFERENCES ingredients(id) | |
| ratio | NUMERIC | DEFAULT 1.0 | |
| dietary_tags | TEXT[] | | GIN indexed |
| notes | TEXT | | |

**Constraints**: `UNIQUE(original_ingredient_id, substitute_ingredient_id)`.
**Indexes**: GIN on `dietary_tags`.

### `recipe_vectors`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | |
| recipe_id | UUID | NOT NULL UNIQUE, REFERENCES recipes(id) ON DELETE CASCADE | |
| attribute_vector | vector(4) | NOT NULL | Copy of recipe vector |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | |

**Indexes**: IVFFlat on `attribute_vector` (cosine, `lists=1`).

## Vector Index Notes

- IVFFlat is configured with `lists=1`. With very small datasets (< a few hundred rows) the index may not be chosen by the planner; brute force is acceptable at that scale.
- Cosine operator: `<=>` (lower = more similar).
- Query example:

```sql
SELECT recipe_id, 1 - (attribute_vector <=> $1) AS similarity
FROM recipe_vectors
ORDER BY attribute_vector <=> $1
LIMIT $2;
```
