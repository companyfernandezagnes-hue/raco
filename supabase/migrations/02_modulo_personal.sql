-- ============================================================
-- Módulo 2: Personal & RRHH
-- ============================================================

-- Tabla de perfiles de personal del restaurante
-- (distinto de 'employees' que es la tabla de autenticación)
CREATE TABLE IF NOT EXISTS staff_profiles (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  role          text NOT NULL CHECK (role IN ('Cocinero','Camarero','Maitre','Encargado','Limpieza','Otro')),
  dni           text,
  email         text,
  phone         text,
  contract_type text CHECK (contract_type IN ('Indefinido','Temporal','Prácticas','Parcial')),
  monthly_salary numeric(10,2) DEFAULT 0,
  contract_hours int DEFAULT 40,
  hourly_rate   numeric(8,2) GENERATED ALWAYS AS (
    CASE WHEN contract_hours > 0 THEN monthly_salary / (contract_hours * 4.33) ELSE 0 END
  ) STORED,
  status        text NOT NULL DEFAULT 'Activo' CHECK (status IN ('En turno','Descanso','Vacaciones','Baja','Activo')),
  photo_url     text,
  notes         text,
  hire_date     date,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Tabla de turnos / horarios
CREATE TABLE IF NOT EXISTS schedules (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id        uuid NOT NULL REFERENCES staff_profiles(id) ON DELETE CASCADE,
  date            date NOT NULL,
  shift           text NOT NULL CHECK (shift IN ('Mañana','Tarde','Noche','Partido','Libre')),
  start_time      time,
  end_time        time,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Tabla de solicitudes de vacaciones / ausencias
CREATE TABLE IF NOT EXISTS vacations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id        uuid NOT NULL REFERENCES staff_profiles(id) ON DELETE CASCADE,
  start_date      date NOT NULL,
  end_date        date NOT NULL,
  type            text NOT NULL DEFAULT 'Vacaciones' CHECK (type IN ('Vacaciones','Enfermedad','Asunto propio','Maternidad/Paternidad','Otro')),
  status          text NOT NULL DEFAULT 'Solicitada' CHECK (status IN ('Solicitada','Aprobada','Rechazada')),
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Tabla de gastos fijos (salarios + costes estructurales)
CREATE TABLE IF NOT EXISTS fixed_expenses (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  category        text NOT NULL CHECK (category IN ('Personal','Alquiler','Suministros','Seguros','Otros')),
  frequency       text NOT NULL DEFAULT 'Mensual' CHECK (frequency IN ('Mensual','Trimestral','Anual')),
  amount          numeric(12,2) NOT NULL DEFAULT 0,
  notes           text,
  active          boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Índices para búsquedas frecuentes
CREATE INDEX IF NOT EXISTS idx_staff_profiles_status ON staff_profiles(status);
CREATE INDEX IF NOT EXISTS idx_schedules_staff_id ON schedules(staff_id);
CREATE INDEX IF NOT EXISTS idx_schedules_date ON schedules(date);
CREATE INDEX IF NOT EXISTS idx_vacations_staff_id ON vacations(staff_id);
CREATE INDEX IF NOT EXISTS idx_vacations_status ON vacations(status);
CREATE INDEX IF NOT EXISTS idx_fixed_expenses_category ON fixed_expenses(category);

-- Row Level Security
ALTER TABLE staff_profiles  ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules        ENABLE ROW LEVEL SECURITY;
ALTER TABLE vacations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE fixed_expenses   ENABLE ROW LEVEL SECURITY;

-- Políticas RLS: acceso para usuarios autenticados
CREATE POLICY "staff_profiles_auth" ON staff_profiles  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "schedules_auth"      ON schedules        FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "vacations_auth"      ON vacations        FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "fixed_expenses_auth" ON fixed_expenses   FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_staff_profiles
  BEFORE UPDATE ON staff_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at_fixed_expenses
  BEFORE UPDATE ON fixed_expenses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
