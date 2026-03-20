import { useState, useEffect } from 'react';
import { AppData, Albaran, FacturaExtended, BankTransaction } from '../types';

const MOCK_DATA: AppData = {
  albaranes: [
    {
      id: 'alb-1',
      date: '2026-03-10',
      num: 'ALB-2026-001',
      prov: 'Carnes Selectas SL',
      total: 890.20,
      base: 809.27,
      taxes: 80.93,
      items: [],
      invoiced: true,
      paid: true,
      status: 'ok',
      reconciled: true,
      socio: 'Socio A',
      unitId: 'REST'
    },
    {
      id: 'alb-2',
      date: '2026-03-12',
      num: 'ALB-2026-002',
      prov: 'Frutas Paco',
      total: 150.00,
      base: 144.23,
      taxes: 5.77,
      items: [],
      invoiced: false,
      paid: false,
      status: 'ok',
      reconciled: false,
      socio: 'Socio B',
      unitId: 'REST'
    }
  ],
  facturas: [
    {
      id: 'fac-1',
      tipo: 'compra',
      num: 'FAC-2026-001',
      date: '2026-03-10',
      dueDate: '2026-04-10',
      prov: 'Carnes Selectas SL',
      total: '890.20',
      base: '809.27',
      tax: '80.93',
      albaranIdsArr: ['alb-1'],
      paid: true,
      reconciled: true,
      bankTransactionId: 't2',
      category: 'Materia Prima',
      source: 'manual-group',
      status: 'paid',
      unidad_negocio: 'REST'
    }
  ],
  bankTransactions: [
    { id: 't1', date: '2026-03-10', description: 'TPV RESTAURANTE CAIXA', amount: 1240.50, balance: 12450.30, status: 'Conciliado', category: 'Ventas', source: 'api' },
    { id: 't2', date: '2026-03-09', description: 'PAGO PROVEEDOR CARNES SELECTAS', amount: -890.20, balance: 11209.80, status: 'Conciliado', category: 'Suministros', reconciledId: 'fac-1', source: 'api' },
    { id: 't3', date: '2026-03-09', description: 'NOMINA JUAN PEREZ', amount: -1850.00, balance: 12099.80, status: 'Pendiente', category: 'Personal', source: 'api' },
  ],
  socios: [
    { id: 's1', n: 'Socio A', active: true },
    { id: 's2', n: 'Socio B', active: true }
  ],
  priceHistory: [],
  platos: [],
  ventas_menu: [],
  cierres: []
};

export function useAppData() {
  const [data, setData] = useState<AppData>(() => {
    const saved = localStorage.getItem('erp_data');
    return saved ? JSON.parse(saved) : MOCK_DATA;
  });

  const onSave = async (newData: AppData) => {
    setData(newData);
    localStorage.setItem('erp_data', JSON.stringify(newData));
  };

  return { data, onSave };
}
