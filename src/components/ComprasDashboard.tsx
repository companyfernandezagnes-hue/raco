import React, { useState, useEffect } from 'react';
import { Package, FileText, Zap, Plus, RefreshCw, Camera, Mail } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../supabase';
import { cn } from '../lib/utils';
import { AlbaranesView } from './compras/AlbaranesView';
import { InvoicesView } from './compras/InvoicesView';
import { fetchNewEmails, getLatestTelegramTicket } from '../services/supabase';

type BusinessUnit = 'REST' | 'DLV' | 'SHOP' | 'CORP';
const BUSINESS_UNITS = [
  { id: 'REST' as BusinessUnit, name: 'Restaurante', bg: 'bg-emerald-100', color: 'text-emerald-700' },
  { id: 'DLV' as BusinessUnit, name: 'Catering', bg: 'bg-indigo-100', color: 'text-indigo-700' },
  { id: 'SHOP' as BusinessUnit, name: 'Tienda', bg: 'bg-amber-100', color: 'text-amber-700' },
  { id: 'CORP' as BusinessUnit, name: 'Oficina', bg: 'bg-slate-100', color: 'text-slate-700' },
];

interface Stats {
  albaranesPendientes: number;
  facturasDescuadre: number;
  totalMes: number;
  ahorroIA: number;
}

export const ComprasDashboard = () => {
  const [activeSub, setActiveSub] = useState<'albaranes' | 'facturas'>('albaranes');
  const [syncing, setSyncing] = useState(false);
  const [stats, setStats] = useState<Stats>({ albaranesPendientes: 0, facturasDescuadre: 0, totalMes: 0, ahorroIA: 124.50 });

  useEffect(() => { loadStats(); }, []);

  async function loadStats() {
    const [albRes, facRes] = await Promise.all([
      supabase.from('delivery_notes').select('total, estado').eq('estado', 'pendiente'),
      supabase.from('facturas').select('total, estado').eq('estado', 'mismatch'),
    ]);
    const totalMesRes = await supabase.from('delivery_notes').select('total').gte('fecha', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
    const totalMes = (totalMesRes.data || []).reduce((acc: number, r: any) => acc + (r.total || 0), 0);
    setStats({
      albaranesPendientes: albRes.data?.length || 0,
      facturasDescuadre: facRes.data?.length || 0,
      totalMes,
      ahorroIA: 124.50,
    });
  }

  const handleSync = async () => {
    setSyncing(true);
    try {
      const emails = await fetchNewEmails();
      const ticket = await getLatestTelegramTicket();
      console.log('Sync result:', { emails, ticket });
      await new Promise(r => setTimeout(r, 1500));
    } finally { setSyncing(false); }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-4 md:p-8 space-y-8">
      {/* Header */}
      <header className="sticky top-4 z-[100] bg-white/80 backdrop-blur-xl border border-white/20 shadow-2xl rounded-[2.5rem] p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-2xl shadow-lg">
            <Package className="w-5 h-5 text-indigo-400" />
            <span className="font-black text-sm tracking-tighter uppercase">Compras & Gastos</span>
          </div>
          <nav className="flex bg-slate-100 p-1 rounded-2xl">
            <button onClick={() => setActiveSub('albaranes')} className={cn("px-6 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2", activeSub === 'albaranes' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600")}>
              <TruckIcon active={activeSub === 'albaranes'} /> ALBARANES
              {stats.albaranesPendientes > 0 && <span className="bg-rose-500 text-white text-[10px] px-1.5 py-0.5 rounded-full animate-pulse">{stats.albaranesPendientes}</span>}
            </button>
            <button onClick={() => setActiveSub('facturas')} className={cn("px-6 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2", activeSub === 'facturas' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600")}>
              <FileTextIcon active={activeSub === 'facturas'} /> FACTURAS
              {stats.facturasDescuadre > 0 && <span className="bg-amber-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{stats.facturasDescuadre}</span>}
            </button>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleSync} disabled={syncing} className={cn("p-2.5 bg-white border border-slate-200 rounded-2xl text-slate-600 hover:bg-slate-50 transition shadow-sm", syncing && "animate-spin")}>
            <RefreshCw size={18} />
          </button>
        </div>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard label="Gasto Mensual" value={(stats.totalMes).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })} sub="Total acumulado mes" icon={<Zap className="text-amber-500" />} trend="+12%" />
        <StatCard label="Albaranes Pendientes" value={stats.albaranesPendientes} sub="Sin facturar" icon={<Package className="text-indigo-500" />} color="text-indigo-600" />
        <StatCard label="Facturas Descuadre" value={stats.facturasDescuadre} sub="Revisión requerida" icon={<FileText className="text-rose-500" />} color="text-rose-600" />
        <StatCard label="Ahorro IA" value={(stats.ahorroIA).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })} sub="Optimización detectada" icon={<BotIcon />} color="text-emerald-600" />
      </div>

      {/* Business Unit Filter — solo visual por ahora */}
      <div className="flex items-center gap-3 overflow-x-auto pb-2">
        {BUSINESS_UNITS.map(unit => (
          <div key={unit.id} className={cn("px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap flex items-center gap-2 bg-white text-slate-500 border border-slate-200")}>
            <span className={cn("w-2 h-2 rounded-full", unit.id === 'REST' ? "bg-emerald-500" : unit.id === 'DLV' ? "bg-indigo-500" : unit.id === 'SHOP' ? "bg-amber-500" : "bg-slate-500")}></span>
            {unit.name}
          </div>
        ))}
      </div>

      {/* Main Content */}
      <main className="relative">
        <AnimatePresence mode="wait">
          {activeSub === 'albaranes' ? (
            <motion.div key="albaranes" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.2 }}>
              <AlbaranesView />
            </motion.div>
          ) : (
            <motion.div key="facturas" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
              <InvoicesView />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Quick Action Bar */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2 bg-slate-900/90 backdrop-blur-md p-2 rounded-3xl border border-white/10 shadow-2xl">
        <button className="p-3 text-white hover:bg-white/10 rounded-2xl transition flex flex-col items-center gap-1">
          <Camera size={20} /><span className="text-[8px] font-black uppercase">Foto Ticket</span>
        </button>
        <div className="w-px h-8 bg-white/10 mx-1"></div>
        <button onClick={handleSync} className="p-3 text-white hover:bg-white/10 rounded-2xl transition flex flex-col items-center gap-1">
          <Mail size={20} /><span className="text-[8px] font-black uppercase">Sync Gmail</span>
        </button>
      </div>
    </div>
  );
};

// ── Helpers ──────────────────────────────────────────────────────────────────
const StatCard = ({ label, value, sub, icon, trend, color = "text-slate-900" }: any) => (
  <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-md transition-shadow group">
    <div className="flex justify-between items-start mb-4">
      <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">{icon}</div>
      {trend && <span className="text-[10px] font-black text-emerald-500 bg-emerald-50 px-2 py-1 rounded-lg">{trend}</span>}
    </div>
    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
    <p className={cn("text-2xl font-black tracking-tighter", color)}>{value}</p>
    <p className="text-[10px] text-slate-400 font-bold mt-1">{sub}</p>
  </div>
);
const TruckIcon = ({ active }: { active: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={active ? "text-indigo-500" : ""}><rect x="1" y="3" width="15" height="13" /><polygon points="16 8 20 8 23 11 23 16 16 16 16 8" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" /></svg>
);
const FileTextIcon = ({ active }: { active: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={active ? "text-indigo-500" : ""}><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /></svg>
);
const BotIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500"><path d="M12 8V4H8" /><rect width="16" height="12" x="4" y="8" rx="2" /><path d="M2 14h2" /><path d="M20 14h2" /><path d="M15 13v2" /><path d="M9 13v2" /></svg>
);
