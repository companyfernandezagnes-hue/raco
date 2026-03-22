-- ============================================================
-- Módulo 4: Escandallos & Carta
-- ============================================================

-- Tabla de recetas (escandallos)
CREATE TABLE IF NOT EXISTS recipes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  category        text NOT NULL DEFAULT 'Plato principal' CHECK (category IN ('Entrante','Plato principal','Postre','Bebida','Cocktail','Otro')),
  servings        int NOT NULL DEFAULT 1,
  labor_cost      numeric(10,4) NOT NULL DEFAULT 0,
  margin          numeric(5,2) NOT NULL DEFAULT 30,
  instructions    text,
  photo_url       text,
  active          boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Tabla de ingredientes por receta
CREATE TABLE IF NOT EXISTS recipe_ingredients (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id         uuid NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  name              text NOT NULL,
  quantity          numeric(10,4) NOT NULL DEFAULT 0,
  unit              text NOT NULL DEFAULT 'kg',
  waste_percentage  numeric(5,2) NOT NULL DEFAULT 0,
  price_per_unit    numeric(10,4) NOT NULL DEFAULT 0,
  stock_item_id     uuid REFERENCES stock_items(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- Vista para calcular coste total de receta (incluye merma)
CREATE OR REPLACE VIEW recipe_cost_summary AS
SELECT
  r.id,
  r.name,
  r.category,
  r.servings,
  r.margin,
  r.labor_cost,
  COALESCE(
    SUM(ri.quantity * ri.price_per_unit * (1 + ri.waste_percentage / 100)),
    0
  ) AS ingredient_cost,
  COALESCE(
    SUM(ri.quantity * ri.price_per_unit * (1 + ri.waste_percentage / 100)),
    0
  ) + r.labor_cost AS total_cost,
  CASE
    WHEN r.margin > 0 THEN
      (COALESCE(SUM(ri.quantity * ri.price_per_unit * (1 + ri.waste_percentage / 100)), 0) + r.labor_cost)
      / (1 - r.margin / 100)
    ELSE 0
  END AS suggested_price
FROM recipes r
LEFT JOIN recipe_ingredients ri ON ri.recipe_id = r.id
WHERE r.active = true
GROUP BY r.id, r.name, r.category, r.servings, r.margin, r.labor_cost;

-- Índices
CREATE INDEX IF NOT EXISTS idx_recipes_category ON recipes(category);
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe ON recipe_ingredients(recipe_id);

-- RLS
ALTER TABLE recipes             ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_ingredients  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recipes_auth"             ON recipes             FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "recipe_ingredients_auth"  ON recipe_ingredients  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- Trigger updated_at
CREATE TRIGGER set_updated_at_recipes
  BEFORE UPDATE ON recipes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
