CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE "ingredient_substitutions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"original_ingredient_id" uuid NOT NULL,
	"substitute_ingredient_id" uuid NOT NULL,
	"conversion_ratio" double precision DEFAULT 1 NOT NULL,
	"dietary_tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ingredients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"category" varchar(100),
	"base_unit" varchar(50) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ingredients_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "recipe_ingredients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipe_id" uuid NOT NULL,
	"ingredient_id" uuid NOT NULL,
	"quantity_base" double precision NOT NULL,
	"unit" varchar(50) NOT NULL,
	"notes" text,
	"is_optional" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recipe_variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"base_recipe_id" uuid NOT NULL,
	"variant_recipe_id" uuid NOT NULL,
	"variant_type" varchar(100) NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recipe_variants_variant_recipe_id_unique" UNIQUE("variant_recipe_id")
);
--> statement-breakpoint
CREATE TABLE "recipe_vectors" (
	"recipe_id" uuid PRIMARY KEY NOT NULL,
	"attribute_vector" vector(4) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recipes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"description" text,
	"hero_image_url" text,
	"base_servings" integer DEFAULT 1 NOT NULL,
	"prep_time_minutes" integer DEFAULT 0 NOT NULL,
	"cook_time_minutes" integer DEFAULT 0 NOT NULL,
	"total_time_minutes" integer DEFAULT 0 NOT NULL,
	"calories_per_serving" integer,
	"protein_grams" numeric(6, 2),
	"step_dependency_graph" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recipes_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "ingredient_substitutions" ADD CONSTRAINT "ingredient_substitutions_original_ingredient_id_ingredients_id_fk" FOREIGN KEY ("original_ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingredient_substitutions" ADD CONSTRAINT "ingredient_substitutions_substitute_ingredient_id_ingredients_id_fk" FOREIGN KEY ("substitute_ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_ingredient_id_ingredients_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_variants" ADD CONSTRAINT "recipe_variants_base_recipe_id_recipes_id_fk" FOREIGN KEY ("base_recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_variants" ADD CONSTRAINT "recipe_variants_variant_recipe_id_recipes_id_fk" FOREIGN KEY ("variant_recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_vectors" ADD CONSTRAINT "recipe_vectors_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_substitutions_orig" ON "ingredient_substitutions" USING btree ("original_ingredient_id");--> statement-breakpoint
CREATE INDEX "idx_substitutions_sub" ON "ingredient_substitutions" USING btree ("substitute_ingredient_id");--> statement-breakpoint
CREATE INDEX "idx_substitutions_tags" ON "ingredient_substitutions" USING gin ("dietary_tags");--> statement-breakpoint
CREATE INDEX "idx_ingredients_name" ON "ingredients" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_recipe_ingredients_recipe" ON "recipe_ingredients" USING btree ("recipe_id");--> statement-breakpoint
CREATE INDEX "idx_recipe_ingredients_ingredient" ON "recipe_ingredients" USING btree ("ingredient_id");--> statement-breakpoint
CREATE INDEX "idx_recipe_ingredients_recipe_ingredient" ON "recipe_ingredients" USING btree ("recipe_id","ingredient_id");--> statement-breakpoint
CREATE INDEX "idx_recipe_variants_base" ON "recipe_variants" USING btree ("base_recipe_id");--> statement-breakpoint
CREATE INDEX "idx_recipe_variants_variant" ON "recipe_variants" USING btree ("variant_recipe_id");--> statement-breakpoint
CREATE INDEX "idx_recipe_vectors_ivfflat" ON "recipe_vectors" USING ivfflat ("attribute_vector" vector_cosine_ops) WITH (lists=1);--> statement-breakpoint
CREATE INDEX "idx_recipes_slug" ON "recipes" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_recipes_step_graph" ON "recipes" USING gin ("step_dependency_graph");
