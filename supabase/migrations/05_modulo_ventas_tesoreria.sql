-- ============================================================
-- Módulo 5: Ventas, Mesas, Caja & Tesorería
-- ============================================================

-- Tabla de mesas del restaurante
CREATE TABLE IF NOT EXISTS tables_config (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number      int NOT NULL UNIQUE,
  capacity    int NOT NULL DEFAULT 2,
  status      text NOT NULL DEFAULT 'available' CHECK (status IN ('available','occupied','reserved','cleaning')),
  x           int NOT NULL DEFAULT 100,
  y           int NOT NULL DEFAULT 100,
  type        text NOT NULL DEFAULT 'square' CHECK (type IN ('square','round','long')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Tabla de tickets / comandas
CREATE TABLE IF NOT EXISTS tickets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number      text NOT NULL,
  table_id    uuid REFERENCES tables_config(id) ON DELETE SET NULL,
  date        date NOT NULL DEFAULT CURRENT_DATE,
  total       numeric(12,2) NOT NULL DEFAULT 0,
  status      text NOT NULL DEFAULT 'Abierto' CHECK (status IN ('Abierto','Cerrado','Facturado')),
  items       jsonb NOT NULL DEFAULT '[]',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Tabla de cierre de caja
CREATE TABLE IF NOT EXISTS cash_closings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date            date NOT NULL DEFAULT CURRENT_DATE,
  cash_sales      numeric(12,2) NOT NULL DEFAULT 0,
  card_sales      numeric(12,2) NOT NULL DEFAULT 0,
  delivery_sales  numeric(12,2) NOT NULL DEFAULT 0,
  total_sales     numeric(12,2) NOT NULL DEFAULT 0,
  expected_cash   numeric(12,2) NOT NULL DEFAULT 0,
  counted_cash    numeric(12,2) NOT NULL DEFAULT 0,
  discrepancy     numeric(12,2) GENERATED ALWAYS AS (counted_cash - expected_cash) STORED,
  final_float     numeric(12,2) NOT NULL DEFAULT 200,
  tips            numeric(12,2) NOT NULL DEFAULT 0,
  notes           text,
  status          text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  closed_by       text,
  closed_at       timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Tabla de movimientos de caja / tesorería
CREATE TABLE IF NOT EXISTS cash_entries (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date            date NOT NULL DEFAULT CURRENT_DATE,
  type            text NOT NULL CHECK (type IN ('Ingreso','Gasto')),
  category        text NOT NULL,
  description     text NOT NULL,
  amount          numeric(12,2) NOT NULL,
  payment_method  text NOT NULL DEFAULT 'Efectivo' CHECK (payment_method IN ('Efectivo','Tarjeta','Transferencia','Banco')),
  reference       text,
  reconciled      boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Tabla de cuentas bancarias
CREATE TABLE IF NOT EXISTS bank_accounts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  bank_name       text NOT NULL,
  account_number  text,
  balance         numeric(14,2) NOT NULL DEFAULT 0,
  last_sync       timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Tabla de movimientos bancarios
CREATE TABLE IF NOT EXISTS bank_transactions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_account_id uuid REFERENCES bank_accounts(id) ON DELETE CASCADE,
  date            date NOT NULL,
  description     text NOT NULL,
  amount          numeric(14,2) NOT NULL,
  balance         numeric(14,2),
  category        text,
  status          text NOT NULL DEFAULT 'Pendiente' CHECK (status IN ('Conciliado','Pendiente')),
  document_id     text,
  reconciled_id   text,
  source          text DEFAULT 'manual' CHECK (source IN ('manual','api','csv')),
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Tabla de facturas a clientes
CREATE TABLE IF NOT EXISTS customer_invoices (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number          text NOT NULL UNIQUE,
  date            date NOT NULL DEFAULT CURRENT_DATE,
  due_date        date,
  client_name     text NOT NULL,
  client_cif      text,
  client_email    text,
  client_address  text,
  items           jsonb NOT NULL DEFAULT '[]',
  subtotal        numeric(12,2) NOT NULL DEFAULT 0,
  tax_rate        numeric(5,2) NOT NULL DEFAULT 21,
  tax_amount      numeric(12,2) NOT NULL DEFAULT 0,
  total           numeric(12,2) NOT NULL DEFAULT 0,
  status          text NOT NULL DEFAULT 'Pendiente' CHECK (status IN ('Pendiente','Pagada','Vencida','Cancelada')),
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_tickets_date ON tickets(date);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_cash_closings_date ON cash_closings(date);
CREATE INDEX IF NOT EXISTS idx_cash_entries_date ON cash_entries(date);
CREATE INDEX IF NOT EXISTS idx_cash_entries_type ON cash_entries(type);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_date ON bank_transactions(date);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_account ON bank_transactions(bank_account_id);
CREATE INDEX IF NOT EXISTS idx_customer_invoices_status ON customer_invoices(status);
CREATE INDEX IF NOT EXISTS idx_customer_invoices_date ON customer_invoices(date);

-- RLS
ALTER TABLE tables_config      ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets             ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_closings       ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_entries        ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_accounts       ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_transactions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_invoices   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tables_config_auth"     ON tables_config      FOR ALL USING (auth.role()='authenticated') WITH CHECK (auth.role()='authenticated');
CREATE POLICY "tickets_auth"           ON tickets             FOR ALL USING (auth.role()='authenticated') WITH CHECK (auth.role()='authenticated');
CREATE POLICY "cash_closings_auth"     ON cash_closings       FOR ALL USING (auth.role()='authenticated') WITH CHECK (auth.role()='authenticated');
CREATE POLICY "cash_entries_auth"      ON cash_entries        FOR ALL USING (auth.role()='authenticated') WITH CHECK (auth.role()='authenticated');
CREATE POLICY "bank_accounts_auth"     ON bank_accounts       FOR ALL USING (auth.role()='authenticated') WITH CHECK (auth.role()='authenticated');
CREATE POLICY "bank_transactions_auth" ON bank_transactions   FOR ALL USING (auth.role()='authenticated') WITH CHECK (auth.role()='authenticated');
CREATE POLICY "customer_invoices_auth" ON customer_invoices   FOR ALL USING (auth.role()='authenticated') WITH CHECK (auth.role()='authenticated');

-- Triggers updated_at
CREATE TRIGGER set_updated_at_tables   BEFORE UPDATE ON tables_config    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at_tickets  BEFORE UPDATE ON tickets           FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at_bank_acc BEFORE UPDATE ON bank_accounts     FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at_cust_inv BEFORE UPDATE ON customer_invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
