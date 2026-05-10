// src/components/DailyBriefing.tsx
// Widget "Briefing diario" — adaptado de Arume Pro a Raco.
// Muestra alertas inteligentes basadas en datos reales de Supabase:
//  - Cierres de caja pendientes
//  - Stock crítico
//  - Facturas vencidas (cobrar y pagar)
//  - Saldo bancario bajo
//  - Descuadres de caja
//  - Albaranes sin facturar
//
// Cada alerta tiene una severidad (crítico, warning, info) y una ruta para
// navegar al módulo correspondiente al hacer click.

import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle, Calendar, Package, Receipt,
  Wallet, Wrench, ChevronRight, RefreshCw, Loader2, Sparkles, CheckCircle2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import { cn } from '../lib/utils';

type Severity = 'critico' | 'warning' | 'info';

interface Alert {
  id:       string;
  severity: Severity;
  icon:     React.ReactNode;
  title:    string;
  detail:   string;
  path:     string;
}

const fmtEur = (n: number) => (n || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
const todayISO = () => new Date().toISOString().split('T')[0];

const SEVERITY_CFG: Record<Severity, { dot: string; bg: string; text: string }> = {
  critico: { dot: 'bg-rose-500',     bg: 'bg-rose-50 border-rose-200',     text: 'text-rose-700' },
  warning: { dot: 'bg-amber-500',    bg: 'bg-amber-50 border-amber-200',   text: 'text-amber-700' },
  info:    { dot: 'bg-indigo-500',   bg: 'bg-indigo-50 border-indigo-200', text: 'text-indigo-700' },
};

async function buildAlerts(): Promise<Alert[]> {
  const alerts: Alert[] = [];
  const today = todayISO();
  const hace7 = new Date(); hace7.setDate(hace7.getDate() - 7);
  const hace7iso = hace7.toISOString().split('T')[0];

  const [
    cierreHoyR,
    stockBajoR,
    custInvVencidasR,
    supInvVencidasR,
    bankBalR,
    descuadresR,
    albSinFactR,
  ] = await Promise.all([
    supabase.from('cash_closings').select('id,date').eq('date', today).limit(1),
    supabase.from('stock_items').select('name,current_stock,min_stock,unit').eq('active', true).filter('current_stock','lte','min_stock').limit(50),
    supabase.from('customer_invoices').select('id,number,client_name,total,due_date,status').eq('status','Vencida'),
    supabase.from('facturas').select('id,num,proveedor,total,fecha_venc,pagada').eq('tipo','compra').eq('pagada', false).lt('fecha_venc', today),
    supabase.from('bank_accounts').select('balance').limit(10),
    supabase.from('cash_closings').select('date,discrepancy').gte('date', hace7iso).lte('date', today),
    supabase.from('delivery_notes').select('id,fecha,supplier_name,total').gte('fecha', hace7iso).limit(50),
  ]);

  if (!cierreHoyR.data?.length) {
    alerts.push({
      id: 'cierre-pendiente', severity: 'warning', icon: <Calendar size={14} />,
      title: 'Cierre de caja de hoy pendiente',
      detail: 'Recuerda hacer el cierre al final del servicio',
      path: '/cierre-caja',
    });
  }

  const stock = stockBajoR.data || [];
  if (stock.length > 0) {
    const ejemplos = stock.slice(0, 3).map(s => s.name).join(', ');
    alerts.push({
      id: 'stock-critico', severity: stock.length >= 5 ? 'critico' : 'warning', icon: <Package size={14} />,
      title: `${stock.length} producto${stock.length > 1 ? 's' : ''} bajo mínimos`,
      detail: ejemplos + (stock.length > 3 ? `… y ${stock.length - 3} más` : ''),
      path: '/inventario',
    });
  }

  const cMor = custInvVencidasR.data || [];
  if (cMor.length > 0) {
    const total = cMor.reduce((s, f) => s + Number(f.total || 0), 0);
    alerts.push({
      id: 'cobros-vencidos', severity: 'critico', icon: <Receipt size={14} />,
      title: `${cMor.length} factura${cMor.length > 1 ? 's' : ''} vencida${cMor.length > 1 ? 's' : ''} sin cobrar`,
      detail: `${fmtEur(total)} — ${cMor.slice(0, 2).map(f => f.client_name).join(', ')}${cMor.length > 2 ? '…' : ''}`,
      path: '/facturacion-clientes',
    });
  }

  const sMor = supInvVencidasR.data || [];
  if (sMor.length > 0) {
    const total = sMor.reduce((s, f) => s + Number(f.total || 0), 0);
    alerts.push({
      id: 'pagos-vencidos', severity: 'critico', icon: <Receipt size={14} />,
      title: `${sMor.length} factura${sMor.length > 1 ? 's' : ''} de proveedor vencida${sMor.length > 1 ? 's' : ''}`,
      detail: `${fmtEur(total)} pendientes — ${sMor.slice(0, 2).map(f => f.proveedor || 'Prov.').join(', ')}${sMor.length > 2 ? '…' : ''}`,
      path: '/compras',
    });
  }

  const bank = bankBalR.data || [];
  const saldoTotal = bank.reduce((s, b) => s + Number(b.balance || 0), 0);
  if (bank.length > 0 && saldoTotal < 1000) {
    alerts.push({
      id: 'saldo-bajo', severity: saldoTotal < 0 ? 'critico' : 'warning', icon: <Wallet size={14} />,
      title: saldoTotal < 0 ? 'Saldo bancario en NEGATIVO' : 'Saldo bancario bajo',
      detail: `Saldo total: ${fmtEur(saldoTotal)}`,
      path: '/tesoreria',
    });
  }

  const descuadres = (descuadresR.data || []).filter(c => Math.abs(Number(c.discrepancy || 0)) > 5);
  if (descuadres.length > 0) {
    const total = descuadres.reduce((s, c) => s + Math.abs(Number(c.discrepancy || 0)), 0);
    alerts.push({
      id: 'descuadres', severity: total > 50 ? 'critico' : 'warning', icon: <Wrench size={14} />,
      title: `${descuadres.length} día${descuadres.length > 1 ? 's' : ''} con descuadre de caja`,
      detail: `Diferencia acumulada: ${fmtEur(total)} en últimos 7 días`,
      path: '/cierre-caja',
    });
  }

  const albs = albSinFactR.data || [];
  if (albs.length >= 5) {
    alerts.push({
      id: 'albaranes-pendientes', severity: 'info', icon: <Receipt size={14} />,
      title: `${albs.length} albaranes recientes`,
      detail: `Revisa que estén todos facturados antes del fin de mes`,
      path: '/compras',
    });
  }

  return alerts;
}

interface DailyBriefingProps { embedded?: boolean }

export default function DailyBriefing({ embedded = false }: DailyBriefingProps) {
  const [alerts,  setAlerts]  = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const navigate = useNavigate();

  const refresh = async () => {
    setLoading(true); setError(null);
    try {
      const list = await buildAlerts();
      setAlerts(list);
    } catch (err: any) {
      setError(err?.message || 'No se pudieron cargar las alertas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 5 * 60_000);
    return () => clearInterval(t);
  }, []);

  const grouped = useMemo(() => {
    const c = alerts.filter(a => a.severity === 'critico');
    const w = alerts.filter(a => a.severity === 'warning');
    const i = alerts.filter(a => a.severity === 'info');
    return [...c, ...w, ...i];
  }, [alerts]);

  const allClear = !loading && alerts.length === 0 && !error;

  return (
    <div className={cn(
      'bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden',
      embedded && 'shadow-none border-0',
    )}>
      <div className="px-5 py-3 flex items-center justify-between border-b border-slate-100 bg-gradient-to-br from-indigo-50 to-violet-50">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-indigo-600" />
          <h3 className="text-sm font-black text-slate-900">Briefing diario</h3>
          {alerts.length > 0 && (
            <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg bg-white text-indigo-600 border border-indigo-200">
              {alerts.length}
            </span>
          )}
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="p-1.5 rounded-xl hover:bg-white/60 text-slate-500 transition-all disabled:opacity-40"
          title="Actualizar"
        >
          <RefreshCw size={14} className={cn(loading && 'animate-spin')} />
        </button>
      </div>

      <div className="p-3 space-y-2">
        {loading && alerts.length === 0 && (
          <div className="flex items-center justify-center py-8 text-slate-400">
            <Loader2 size={18} className="animate-spin" />
          </div>
        )}

        {error && (
          <div className="px-4 py-3 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle size={14} /> {error}
          </div>
        )}

        {allClear && (
          <div className="flex flex-col items-center py-8 text-center">
            <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center mb-2">
              <CheckCircle2 size={24} className="text-emerald-600" />
            </div>
            <p className="text-sm font-bold text-slate-700">Todo en orden ✨</p>
            <p className="text-xs text-slate-400 mt-0.5">Sin alertas pendientes</p>
          </div>
        )}

        <AnimatePresence initial={false}>
          {grouped.map(a => {
            const cfg = SEVERITY_CFG[a.severity];
            return (
              <motion.button
                key={a.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                onClick={() => navigate(a.path)}
                className={cn(
                  'w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-2xl border transition-all hover:scale-[1.01]',
                  cfg.bg,
                )}
              >
                <div className={cn('w-7 h-7 rounded-xl flex items-center justify-center text-white shrink-0', cfg.dot)}>
                  {a.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn('text-xs font-black truncate', cfg.text)}>{a.title}</p>
                  <p className="text-[11px] text-slate-500 truncate">{a.detail}</p>
                </div>
                <ChevronRight size={14} className="text-slate-400 shrink-0" />
              </motion.button>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
