// src/components/ComprasDashboard.tsx
// ✅ 100% Supabase — sin Firebase, sin datos hardcoded
// ✅ Gen Z: voz, foto, interfaz simplificada, alertas visuales
import React, { useState, useEffect, useCallback } from 'react';
import { Package, FileText, RefreshCw, TrendingDown, TrendingUp, AlertTriangle, CheckCircle2, Clock, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../supabase';
import { cn } from '../lib/utils';
import AlbaranesView from './compras/AlbaranesView';
import { InvoicesView } from './compras/InvoicesView';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Stats {
  albaranesPendientes: number;
  facturasDescuadre: number;
  facturasPendientePago: number;
  totalMes: number;
  totalMesAnterior: number;
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({
  label, value, sub, icon, color = 'text-slate-700', alert = false, trend
}: {
  label: string; value: string | number; sub: string;
  icon: React.ReactNode; color?: string; alert?: boolean; trend?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'bg-white rounded-3xl p-6 border shadow-sm flex flex-col gap-3 relative overflow-hidden transition-all',
        alert ? 'border-rose-200 shadow-rose-100' : 'border-slate-200 hover:border-slate-300 hover:shadow-md'
      )}
    >
      {alert && (
        <span className="absolute top-3 right-3 w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse shadow-lg shadow-rose-300" />
      )}
      <div className="flex items-center justify-between">
        <span className="text-xs font-black uppercase tracking-widest text-slate-400">{label}</span>
        <div className="w-9 h-9 rounded-2xl bg-slate-50 flex items-center justify-center">{icon}</div>
      </div>
      <div>
        <p className={cn('text-3xl font-black tracking-tight', color)}>{value}</p>
        <p className="text-xs text-slate-400 font-medium mt-1 flex items-center gap-1">
          {trend !== undefined && (
            trend > 0
              ? <TrendingUp size={12} className="text-rose-400" />
              : <TrendingDown size={12} className="text-emerald-400" />
          )}
          {sub}
        </p>
      </div>
    </motion.div>
  );
}

// ─── Alert Banner ─────────────────────────────────────────────────────────────
function AlertBanner({ count, type, onClick }: { count: number; type: string; onClick: () => void }) {
  if (count === 0) return null;
  return (
    <motion.button
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      onClick={onClick}
      className="flex items-center gap-3 px-5 py-3 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-sm font-bold hover:bg-rose-100 transition-all shadow-sm shadow-rose-100"
    >
      <AlertTriangle size={16} className="shrink-0" />
      <span>{count} {type}</span>
      <span className="ml-auto text-rose-400 text-xs">Ver →</span>
    </motion.button>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export const ComprasDashboard = () => {
  const [activeSub, setActiveSub] = useState<'albaranes' | 'facturas'>('albaranes');
  const [syncing, setSyncing] = useState(false);
  const [stats, setStats] = useState<Stats>({
    albaranesPendientes: 0,
    facturasDescuadre: 0,
    facturasPendientePago: 0,
    totalMes: 0,
    totalMesAnterior: 0,
  });

  // ── Load stats from Supabase (no hardcoded data) ──────────────────────────
  const loadStats = useCallback(async () => {
    const now = new Date();
    const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const inicioMesAnterior = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
    const finMesAnterior = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];

    const [albPendRes, facMismatchRes, facPendRes, totalMesRes, totalMesAntRes] = await Promise.all([
      supabase.from('delivery_notes').select('id', { count: 'exact', head: true }).eq('estado', 'pendiente'),
      supabase.from('facturas').select('id', { count: 'exact', head: true }).eq('estado', 'mismatch'),
      supabase.from('facturas').select('id', { count: 'exact', head: true }).eq('pagada', false).neq('estado', 'paid'),
      supabase.from('delivery_notes').select('total').gte('fecha', inicioMes),
      supabase.from('delivery_notes').select('total').gte('fecha', inicioMesAnterior).lte('fecha', finMesAnterior),
    ]);

    const totalMes = (totalMesRes.data || []).reduce((s: number, r: any) => s + (r.total || 0), 0);
    const totalMesAnterior = (totalMesAntRes.data || []).reduce((s: number, r: any) => s + (r.total || 0), 0);

    setStats({
      albaranesPendientes: albPendRes.count || 0,
      facturasDescuadre: facMismatchRes.count || 0,
      facturasPendientePago: facPendRes.count || 0,
      totalMes,
      totalMesAnterior,
    });
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);

  const handleSync = async () => {
    setSyncing(true);
    await loadStats();
    await new Promise(r => setTimeout(r, 600));
    setSyncing(false);
  };

  const trendPct = stats.totalMesAnterior > 0
    ? ((stats.totalMes - stats.totalMesAnterior) / stats.totalMesAnterior) * 100
    : 0;

  const fmt = (n: number) => n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-4 md:p-8 space-y-6">

      {/* ── Header ── */}
      <header className="sticky top-4 z-[100] bg-white/80 backdrop-blur-xl border border-white/20 shadow-xl rounded-[2.5rem] p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-2xl shadow-lg">
            <Package className="w-5 h-5 text-indigo-400" />
            <span className="font-black text-sm tracking-tighter uppercase">Compras & Gastos</span>
          </div>

          {/* Sub-nav */}
          <nav className="flex bg-slate-100 p-1 rounded-2xl gap-1">
            {(['albaranes', 'facturas'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveSub(tab)}
                className={cn(
                  'px-5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 capitalize',
                  activeSub === tab ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                )}
              >
                {tab === 'albaranes' ? <Package size={14} /> : <FileText size={14} />}
                {tab === 'albaranes' ? 'Albaranes' : 'Facturas'}
                {tab === 'albaranes' && stats.albaranesPendientes > 0 && (
                  <span className="bg-rose-500 text-white text-[10px] px-1.5 py-0.5 rounded-full animate-pulse min-w-[20px] text-center">
                    {stats.albaranesPendientes}
                  </span>
                )}
                {tab === 'facturas' && stats.facturasDescuadre > 0 && (
                  <span className="bg-amber-500 text-white text-[10px] px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                    {stats.facturasDescuadre}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        <button
          onClick={handleSync}
          disabled={syncing}
          className="p-2.5 bg-white border border-slate-200 rounded-2xl text-slate-600 hover:bg-slate-50 transition shadow-sm disabled:opacity-50"
          title="Actualizar datos"
        >
          <RefreshCw size={18} className={syncing ? 'animate-spin' : ''} />
        </button>
      </header>

      {/* ── Alert banners (solo si hay problemas) ── */}
      <div className="flex flex-wrap gap-3">
        <AlertBanner
          count={stats.albaranesPendientes}
          type={`albarán${stats.albaranesPendientes !== 1 ? 'es' : ''} sin facturar`}
          onClick={() => setActiveSub('albaranes')}
        />
        <AlertBanner
          count={stats.facturasDescuadre}
          type={`factura${stats.facturasDescuadre !== 1 ? 's' : ''} con descuadre`}
          onClick={() => setActiveSub('facturas')}
        />
        <AlertBanner
          count={stats.facturasPendientePago}
          type={`factura${stats.facturasPendientePago !== 1 ? 's' : ''} pendiente${stats.facturasPendientePago !== 1 ? 's' : ''} de pago`}
          onClick={() => setActiveSub('facturas')}
        />
      </div>

      {/* ── Stats Grid ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Gasto este mes"
          value={fmt(stats.totalMes)}
          sub={trendPct !== 0 ? `${trendPct > 0 ? '+' : ''}${trendPct.toFixed(1)}% vs mes anterior` : 'Sin datos anteriores'}
          icon={<TrendingUp className={trendPct > 0 ? 'text-rose-400' : 'text-emerald-400'} size={18} />}
          color={trendPct > 5 ? 'text-rose-600' : 'text-slate-800'}
          trend={trendPct}
        />
        <StatCard
          label="Albaranes pendientes"
          value={stats.albaranesPendientes}
          sub="Sin facturar"
          icon={<Clock className="text-amber-400" size={18} />}
          color={stats.albaranesPendientes > 0 ? 'text-amber-600' : 'text-slate-800'}
          alert={stats.albaranesPendientes > 0}
        />
        <StatCard
          label="Facturas descuadre"
          value={stats.facturasDescuadre}
          sub="Revisión requerida"
          icon={<AlertTriangle className="text-rose-400" size={18} />}
          color={stats.facturasDescuadre > 0 ? 'text-rose-600' : 'text-slate-800'}
          alert={stats.facturasDescuadre > 0}
        />
        <StatCard
          label="Pendiente de pago"
          value={stats.facturasPendientePago}
          sub="Facturas abiertas"
          icon={<CheckCircle2 className={stats.facturasPendientePago === 0 ? 'text-emerald-400' : 'text-indigo-400'} size={18} />}
          color={stats.facturasPendientePago > 3 ? 'text-rose-600' : 'text-slate-800'}
        />
      </div>

      {/* ── Main Content ── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeSub}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.2 }}
        >
          {activeSub === 'albaranes'
            ? <AlbaranesView onStatsChange={loadStats} />
            : <InvoicesView onStatsChange={loadStats} />
          }
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default ComprasDashboard;
