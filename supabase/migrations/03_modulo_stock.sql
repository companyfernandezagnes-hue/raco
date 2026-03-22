-- ============================================================
-- Módulo 3: Stock & Almacén
-- ============================================================

-- Tabla principal de productos en stock
CREATE TABLE IF NOT EXISTS stock_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  category        text NOT NULL DEFAULT 'Comida' CHECK (category IN ('Comida','Bebida','Suministros','Limpieza','Otro')),
  unit            text NOT NULL DEFAULT 'kg' CHECK (unit IN ('kg','g','l','ml','ud','caja','bolsa','botella')),
  current_stock   numeric(10,3) NOT NULL DEFAULT 0,
  min_stock       numeric(10,3) NOT NULL DEFAULT 0,
  price_per_unit  numeric(10,4) NOT NULL DEFAULT 0,
  supplier_id     uuid REFERENCES suppliers(id) ON DELETE SET NULL,
  location        text,
  last_updated    timestamptz NOT NULL DEFAULT now(),
  notes           text,
  active          boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Tabla de movimientos de stock (entradas, salidas, ajustes)
CREATE TABLE IF NOT EXISTS stock_movements (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_item_id   uuid NOT NULL REFERENCES stock_items(id) ON DELETE CASCADE,
  type            text NOT NULL CHECK (type IN ('entrada','salida','ajuste','merma')),
  quantity        numeric(10,3) NOT NULL,
  unit_cost       numeric(10,4),
  total_cost      numeric(12,4) GENERATED ALWAYS AS (quantity * COALESCE(unit_cost, 0)) STORED,
  reason          text,
  reference       text,  -- Referencia a albarán u otro documento
  created_by      text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_stock_items_category ON stock_items(category);
CREATE INDEX IF NOT EXISTS idx_stock_items_supplier ON stock_items(supplier_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_item ON stock_movements(stock_item_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_type ON stock_movements(type);
CREATE INDEX IF NOT EXISTS idx_stock_movements_date ON stock_movements(created_at);

-- RLS
ALTER TABLE stock_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stock_items_auth"     ON stock_items     FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "stock_movements_auth" ON stock_movements FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- Función para actualizar stock automáticamente tras un movimiento
CREATE OR REPLACE FUNCTION apply_stock_movement()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.type = 'entrada' THEN
    UPDATE stock_items SET current_stock = current_stock + NEW.quantity, last_updated = now() WHERE id = NEW.stock_item_id;
  ELSIF NEW.type IN ('salida','merma') THEN
    UPDATE stock_items SET current_stock = GREATEST(0, current_stock - NEW.quantity), last_updated = now() WHERE id = NEW.stock_item_id;
  ELSIF NEW.type = 'ajuste' THEN
    UPDATE stock_items SET current_stock = NEW.quantity, last_updated = now() WHERE id = NEW.stock_item_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER after_stock_movement
  AFTER INSERT ON stock_movements
  FOR EACH ROW EXECUTE FUNCTION apply_stock_movement();

-- Trigger updated_at
CREATE TRIGGER set_updated_at_stock_items
  BEFORE UPDATE ON stock_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
