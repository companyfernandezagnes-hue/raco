import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://xdnqctumnqxtfolmexcu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhkbnFjdHVtbnF4dGZvbG1leGN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwNjIzODcsImV4cCI6MjA4OTYzODM4N30.21C2M45TEaujTOmLjpspv7Lo7q_RN_52_LcOZ58BNsg';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Tipos del empleado segun la tabla employees
export type EmployeeRol = 'admin' | 'cocinero' | 'camarero';

export interface Employee {
  id: string;
  nombre: string;
  email: string;
  rol: EmployeeRol;
  activo: boolean;
  creado_por: string | null;
  created_at: string;
}
