-- 06_app_settings.sql
-- Tabla de configuración global de la aplicación Racó
-- Clave primaria: key (text), valor: jsonb

create table if not exists public.app_settings (
  key        text primary key,
  value      jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

-- RLS: solo admins pueden leer y escribir
alter table public.app_settings enable row level security;

-- Política de lectura: cualquier usuario autenticado puede leer
create policy "authenticated_read_app_settings"
  on public.app_settings for select
  to authenticated
  using (true);

-- Política de escritura: solo admins (rol = admin en staff_profiles)
create policy "admin_write_app_settings"
  on public.app_settings for all
  to authenticated
  using (
    exists (
      select 1 from public.staff_profiles
      where id = auth.uid()
        and rol = 'admin'
        and activo = true
    )
  )
  with check (
    exists (
      select 1 from public.staff_profiles
      where id = auth.uid()
        and rol = 'admin'
        and activo = true
    )
  );

-- Función para actualizar updated_at automáticamente
create or replace function public.update_app_settings_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_app_settings_updated_at
  before update on public.app_settings
  for each row execute function public.update_app_settings_updated_at();

-- Insertar valores por defecto
insert into public.app_settings (key, value) values
  ('notificaciones', '{"alertaCierreCaja": true, "stockCritico": true, "facturasVencidas": true, "email": "", "whatsapp": ""}'),
  ('contabilidad',   '{"iva": 10, "fondoMinimo": 200, "margenObjetivo": 30, "nombre": "", "cif": "", "direccion": "", "telefono": ""}'),
  ('horarios',       '{"lunes": {"abierto": true, "apertura": "09:00", "cierre": "23:00"}, "martes": {"abierto": true, "apertura": "09:00", "cierre": "23:00"}, "miercoles": {"abierto": true, "apertura": "09:00", "cierre": "23:00"}, "jueves": {"abierto": true, "apertura": "09:00", "cierre": "23:00"}, "viernes": {"abierto": true, "apertura": "09:00", "cierre": "23:00"}, "sabado": {"abierto": true, "apertura": "10:00", "cierre": "23:30"}, "domingo": {"abierto": false, "apertura": "10:00", "cierre": "16:00"}}'),
  ('integraciones',  '{"geminiApiKey": "", "whatsappBusiness": "", "googleCalendarClientId": "", "tpvMarca": "", "tpvModelo": "", "impresoraIp": "", "impresoraPuerto": "9100"}')
on conflict (key) do nothing;
