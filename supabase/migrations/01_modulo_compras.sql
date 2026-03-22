-- ============================================================
-- MÓDULO 1: COMPRAS & PROVEEDORES
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- ── Tabla suppliers (proveedores) ────────────────────────────────────────────
-- NOTA: Esta tabla puede ya existir parcialmente (usada por AlbaranesView)
-- Si ya existe, usar ALTER TABLE para añadir columnas que falten.

CREATE TABLE IF NOT EXISTS suppliers (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      text NOT NULL,
  categoria   text NOT NULL DEFAULT 'Otros',
  contacto    text,
  telefono    text,
  email       text,
  direccion   text,
  cif         text,
  iban        text,
  logo_url    text,
  notas       text,
  activo      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Índices para búsqueda rápida
CREATE INDEX IF NOT EXISTS idx_suppliers_nombre ON suppliers (nombre);
CREATE INDEX IF NOT EXISTS idx_suppliers_activo ON suppliers (activo);

-- ── Tabla delivery_notes (albaranes) ─────────────────────────────────────────
-- NOTA: Esta tabla puede ya existir (usada por AlbaranesView.tsx)
-- Campos en español para consistencia con AlbaranesView

CREATE TABLE IF NOT EXISTS delivery_notes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referencia      text,
  fecha           date NOT NULL,
  supplier_name   text NOT NULL,
  proveedor_id    uuid REFERENCES suppliers(id),
  estado          text NOT NULL DEFAULT 'pendiente'
                  CHECK (estado IN ('pendiente','recibido','facturado','rechazado')),
  base            numeric(12,2) NOT NULL DEFAULT 0,
  iva_total       numeric(12,2) NOT NULL DEFAULT 0,
  total           numeric(12,2) NOT NULL DEFAULT 0,
  items           jsonb NOT NULL DEFAULT '[]',
  notas           text,
  empleado_id     uuid,
  imagen_url      text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_delivery_notes_fecha ON delivery_notes (fecha DESC);
CREATE INDEX IF NOT EXISTS idx_delivery_notes_proveedor ON delivery_notes (supplier_name);
CREATE INDEX IF NOT EXISTS idx_delivery_notes_estado ON delivery_notes (estado);

-- ── Tabla facturas ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS facturas (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo            text NOT NULL DEFAULT 'compra'
                  CHECK (tipo IN ('compra','venta','caja')),
  num             text NOT NULL,
  fecha           date NOT NULL,
  fecha_venc      date,
  proveedor       text,
  cliente         text,
  total           numeric(12,2) NOT NULL DEFAULT 0,
  base            numeric(12,2) NOT NULL DEFAULT 0,
  impuesto        numeric(12,2) NOT NULL DEFAULT 0,
  albaran_ids     uuid[] NOT NULL DEFAULT '{}',
  pagada          boolean NOT NULL DEFAULT false,
  conciliada      boolean NOT NULL DEFAULT false,
  bank_tx_id      uuid,
  categoria       text,
  origen          text NOT NULL DEFAULT 'manual-group'
                  CHECK (origen IN ('gmail-sync','dropzone','manual-group','auto-from-albaran')),
  estado          text NOT NULL DEFAULT 'draft'
                  CHECK (estado IN ('draft','approved','paid','mismatch')),
  unidad_negocio  text NOT NULL DEFAULT 'REST'
                  CHECK (unidad_negocio IN ('REST','DLV','SHOP','CORP')),
  archivo_b64     text,  -- Imagen/PDF escaneado con IA (base64)
  email_de        text,
  email_asunto    text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_facturas_fecha ON facturas (fecha DESC);
CREATE INDEX IF NOT EXISTS idx_facturas_proveedor ON facturas (proveedor);
CREATE INDEX IF NOT EXISTS idx_facturas_estado ON facturas (estado);
CREATE INDEX IF NOT EXISTS idx_facturas_conciliada ON facturas (conciliada);

-- ── Tabla price_history (historial de precios) ───────────────────────────────
CREATE TABLE IF NOT EXISTS price_history (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proveedor     text NOT NULL,
  articulo      text NOT NULL,
  precio_unit   numeric(10,4) NOT NULL,
  fecha         date NOT NULL,
  delivery_note_id uuid REFERENCES delivery_notes(id),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_price_history_proveedor ON price_history (proveedor);
CREATE INDEX IF NOT EXISTS idx_price_history_articulo ON price_history (articulo);

-- ── Row Level Security (RLS) ──────────────────────────────────────────────────
-- Activar RLS en todas las tablas del módulo

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE facturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;

-- Política: empleados autenticados pueden leer todo
CREATE POLICY "Empleados pueden leer suppliers"
  ON suppliers FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Empleados pueden leer delivery_notes"
  ON delivery_notes FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Empleados pueden leer facturas"
  ON facturas FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Empleados pueden leer price_history"
  ON price_history FOR SELECT
  USING (auth.role() = 'authenticated');

-- Política: cualquier empleado puede insertar/actualizar albaranes
CREATE POLICY "Empleados pueden insertar delivery_notes"
  ON delivery_notes FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Empleados pueden actualizar delivery_notes"
  ON delivery_notes FOR UPDATE
  USING (auth.role() = 'authenticated');

-- Política: solo admin puede gestionar suppliers y facturas
-- (Para implementar: obtener rol del empleado via función RPC)
CREATE POLICY "Empleados pueden insertar suppliers"
  ON suppliers FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Empleados pueden actualizar suppliers"
  ON suppliers FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Empleados pueden insertar facturas"
  ON facturas FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Empleados pueden actualizar facturas"
  ON facturas FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Empleados pueden eliminar facturas"
  ON facturas FOR DELETE
  USING (auth.role() = 'authenticated');

-- ── Datos de ejemplo (opcional — ejecutar por separado) ──────────────────────
-- Descomentar para insertar proveedores de ejemplo:
/*
INSERT INTO suppliers (nombre, categoria, contacto, telefono, email, cif, activo) VALUES
  ('Carnes Selectas S.A.',  'Carnes',         'Juan García',    '+34600000001', 'pedidos@carnesselectas.com', 'A12345678', true),
  ('Pescados del Día',      'Pescados',        'María López',    '+34600000002', 'ventas@pescadosdia.es',      'B87654321', true),
  ('Frutas y Verduras Paco','Frutas/Verduras', 'Paco Jiménez',  '+34600000003', 'paco@frutaspaco.com',        'A11223344', true),
  ('Bodegas Riojanas',      'Bebidas',         'Elena Sanz',     '+34600000004', 'comercial@bodegasriojanas.es','B55667788', true),
  ('Suministros Hostelería','Suministros',     'Carlos Ruiz',    '+34600000005', 'info@suministrospro.com',   'A99887766', true)
ON CONFLICT DO NOTHING;
*/
