import React from 'react';
import { ComprasDashboard } from '../components/ComprasDashboard';

// Módulo Compras — ComprasDashboard ahora lee directamente de Supabase
// sin necesitar AppData ni onSave como props
export default function ComprasView() {
  return <ComprasDashboard />;
}
