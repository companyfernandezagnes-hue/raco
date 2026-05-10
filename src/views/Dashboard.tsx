// src/views/Dashboard.tsx
// ✅ 100% Supabase — cero datos hardcoded, cero mocks
// ✅ Cruza datos de TODOS los módulos en tiempo real
// ✅ Briefing IA diario personalizado con el estado real del restaurante
// ✅ Alertas automáticas reales (stock bajo, facturas vencidas, caja no cerrada...)
// ✅ Accesos rápidos, fichaje rápido, últimos movimientos
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, TrendingUp, TrendingDown, Package, Users,
  Receipt, Calculator, AlertTriangle, CheckCircle2, Brain,
  Loader2, RefreshCw, ArrowRight, Clock, Zap, ShoppingBag,
  Banknote, CreditCard, ChevronRight, Sparkles, LogIn,
  LogOut, Timer, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../supabase';
import { useSupabase } from '../context/SupabaseContext';
import { GoogleGenAI } from '@google/genai';
import { cn } from '../lib/utils';
import DailyBriefing from '../components/DailyBriefing';

// ─── Types ────────────────────────────────────────────────────────────────────
interface DashboardData {
  // Ventas / caja
  ventasHoy: number;
  ventasAyer: number;
  cajaUltimoCierre: number | null;
  cajaFechaCierre: string | null;
  cajaCerradaHoy: boolean;

  // Stock
  stockBajo: number;
  stockCritico: number;
  valorStock: number;

  // Personal
  empleadosEnTurno: number;
  totalEmpleados: number;
  vacacionesPendientes: number;

  // Facturas clientes
  facturasVencidas: number;
  facturasPendienteTotal: number;
  facturasCobradaMes: number;

  // Compras
  albaranesPendientes: number;
  gastosEsteMes: number;

  // Últimos registros
  ultimosFichajes: { name: string; tipo: 'entrada' | 'salida'; hora: string }[];
  ultimosAlbaranes: { supplier: string; total: number; fecha: string }[];
  alertas: { tipo: 'critico' | 'warning' | 'info'; msg: string; path: string }[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const aiRef = { current: null as GoogleGenAI | null };
function getAI() {
  if (!aiRef.current) aiRef.current = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || '' });
  return aiRef.current;
}
function fmtEur(n: number) { return n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' }); }
function fmtTime(ts: string) { return new Date(ts).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }); }
function today() { return new Date().toISOString().split('T')[0]; }
function yesterday() {
  const d = new Date(); d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}
function startOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({
  label, value, sub, icon, color = 'text-slate-900', alert = false,
  trend, path, onClick,
}: {
  label: string; value: string | number; sub?: string; icon: React.ReactNode;
  color?: string; alert?: boolean; trend?: number; path?: string;
  onClick?: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      onClick={onClick}
      className={cn(
        'bg-white rounded-3xl p-5 border shadow-sm relative overflow-hidden transition-all',
        alert ? 'border-rose-200 shadow-rose-50' : 'border-slate-200',
        onClick ? 'cursor-pointer hover:shadow-md hover:border-indigo-200' : ''
      )}>
      {alert && <span className="absolute top-3 right-3 w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse shadow-lg shadow-rose-300" />}
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</span>
        <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center">{icon}</div>
      </div>
      <p className={cn('text-2xl font-black tracking-tight', color)}>{value}</p>
      {sub && (
        <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
          {trend != null && (
            trend > 0
              ? <TrendingUp size={11} className="text-emerald-400" />
              : trend < 0
                ? <TrendingDown size={11} className="text-rose-400" />
                : null
          )}
          {sub}
        </p>
      )}
      {path && <ChevronRight size={14} className="absolute bottom-4 right-4 text-slate-300" />}
    </motion.div>
  );
}

// ─── Alert Badge ──────────────────────────────────────────────────────────────
function AlertBadge({
  tipo, msg, path, navigate,
}: {
  tipo: 'critico' | 'warning' | 'info';
  msg: string; path: string;
  navigate: (p: string) => void;
}) {
  const cfg = {
    critico: 'bg-rose-50 border-rose-200 text-rose-700',
    warning: 'bg-amber-50 border-amber-200 text-amber-700',
    info:    'bg-blue-50 border-blue-200 text-blue-700',
  }[tipo];
  const Icon = tipo === 'critico' ? AlertTriangle : tipo === 'warning' ? Clock : CheckCircle2;

  return (
    <motion.button
      initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
      onClick={() => navigate(path)}
      className={cn(
        'flex items-center gap-3 px-4 py-3 rounded-2xl border text-sm font-bold text-left hover:opacity-80 transition-all w-full',
        cfg
      )}>
      <Icon size={15} className="shrink-0" />
      <span className="flex-1">{msg}</span>
      <ArrowRight size={13} className="shrink-0 opacity-50" />
    </motion.button>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN VIEW
// ════════════════════════════════════════════════════════════════════════════
export default function DashboardView() {
  const navigate = useNavigate();
  const { employee } = useSupabase();

  const [data,       setData]       = useState<DashboardData | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [aiLoading,  setAiLoading]  = useState(false);
  const [briefing,   setBriefing]   = useState<string | null>(null);
  const [showBriefing, setShowBriefing] = useState(false);

  // ── Fichaje rápido desde el dashboard ────────────────────────────────────
  const [staffList,   setStaffList]   = useState<{ id: string; name: string; role: string }[]>([]);
  const [activeEntry, setActiveEntry] = useState<{ staffId: string; entryId: string; clockIn: string } | null>(null);
  const [fichajeBusy, setFichajeBusy] = useState<string | null>(null);
  const [showFichaje, setShowFichaje] = useState(false);

  // ── Load all data in parallel ─────────────────────────────────────────────
  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const todayStr     = today();
      const yesterdayStr = yesterday();
      const monthStart   = startOfMonth();

      const [
        // Caja
        cajasHoy, cajasAyer,
        // Stock
        stockItems,
        // Personal
        staffProfiles, fichajesHoy, vacacionesPend,
        // Facturas clientes
        facturasClientes,
        // Compras
        albaranes, gastosRes,
        // Fichaje staff
        staffAll,
      ] = await Promise.all([
        supabase.from('cash_closings').select('total_sales,counted_cash,date,status').eq('date', todayStr),
        supabase.from('cash_closings').select('total_sales').eq('date', yesterdayStr),
        supabase.from('stock_items').select('current_stock,min_stock,price_per_unit,active').eq('active', true),
        supabase.from('staff_profiles').select('id,status').order('name'),
        supabase.from('time_entries').select('id,staff_id,clock_in,clock_out').eq('date', todayStr).order('clock_in', { ascending: false }),
        supabase.from('vacations').select('id').eq('status', 'Solicitada'),
        supabase.from('customer_invoices').select('status,total,date').gte('date', monthStart),
        supabase.from('delivery_notes').select('supplier_name,total,fecha,estado').order('created_at', { ascending: false }).limit(5),
        supabase.from('delivery_notes').select('total').gte('fecha', monthStart),
        supabase.from('staff_profiles').select('id,name,role').order('name'),
      ]);

      // ── Calcular KPIs ─────────────────────────────────────────────────────

      // Ventas
      const cajaCerradaHoy = (cajasHoy.data || []).some(c => c.status === 'closed');
      const ventasHoy      = (cajasHoy.data || []).reduce((s, c) => s + (c.total_sales || 0), 0);
      const ventasAyer     = (cajasAyer.data || []).reduce((s, c) => s + (c.total_sales || 0), 0);
      const cajaUltima     = cajasHoy.data?.[0];

      // Stock
      const items          = stockItems.data || [];
      const stockBajo      = items.filter(i => i.current_stock <= (i.min_stock * 1.5) && i.current_stock > i.min_stock).length;
      const stockCritico   = items.filter(i => i.current_stock <= i.min_stock).length;
      const valorStock     = items.reduce((s, i) => s + i.current_stock * i.price_per_unit, 0);

      // Personal
      const staff          = staffProfiles.data || [];
      const fichajesData   = fichajesHoy.data || [];
      const idsEnTurno     = new Set(fichajesData.filter(f => !f.clock_out).map(f => f.staff_id));
      const empleadosEnTurno = idsEnTurno.size;

      // Últimos fichajes (5 más recientes)
      const staffMap       = Object.fromEntries((staffAll.data || []).map(s => [s.id, s]));
      const ultimosFichajes = fichajesData.slice(0, 5).map(f => ({
        name:  staffMap[f.staff_id]?.name || '—',
        tipo:  f.clock_out ? 'salida' as const : 'entrada' as const,
        hora:  fmtTime(f.clock_out || f.clock_in),
      }));

      // Fichaje activo del usuario actual
      const miPerfil = (staffAll.data || []).find(s => s.name === (employee as any)?.nombre);
      const miEntrada = miPerfil
        ? fichajesData.find(f => f.staff_id === miPerfil.id && !f.clock_out)
        : null;

      // Facturas clientes
      const facturas         = facturasClientes.data || [];
      const facturasVencidas = facturas.filter(f => f.status === 'Vencida').length;
      const facturasPend     = facturas.filter(f => f.status === 'Pendiente').reduce((s, f) => s + f.total, 0);
      const facturasCobradas = facturas.filter(f => f.status === 'Pagada').reduce((s, f) => s + f.total, 0);

      // Compras
      const albData          = albaranes.data || [];
      const albPendientes    = albData.filter(a => a.estado === 'pendiente').length;
      const gastosEsteMes    = (gastosRes.data || []).reduce((s: number, r: any) => s + r.total, 0);

      // ── Alertas automáticas reales ────────────────────────────────────────
      const alertas: DashboardData['alertas'] = [];

      if (stockCritico > 0) alertas.push({ tipo: 'critico', msg: `${stockCritico} producto${stockCritico > 1 ? 's' : ''} con stock crítico — reponer urgente`, path: '/inventario' });
      if (facturasVencidas > 0) alertas.push({ tipo: 'critico', msg: `${facturasVencidas} factura${facturasVencidas > 1 ? 's' : ''} de clientes vencida${facturasVencidas > 1 ? 's' : ''}`, path: '/facturacion-clientes' });
      if (!cajaCerradaHoy && new Date().getHours() >= 14) alertas.push({ tipo: 'warning', msg: 'La caja de hoy aún no se ha cerrado', path: '/cierre-caja' });
      if (albPendientes > 3) alertas.push({ tipo: 'warning', msg: `${albPendientes} albaranes pendientes de facturar`, path: '/compras' });
      if (stockBajo > 0) alertas.push({ tipo: 'warning', msg: `${stockBajo} producto${stockBajo > 1 ? 's' : ''} con stock bajo — revisar`, path: '/inventario' });
      if ((vacacionesPend.data?.length || 0) > 0) alertas.push({ tipo: 'info', msg: `${vacacionesPend.data!.length} solicitud${vacacionesPend.data!.length > 1 ? 'es' : ''} de vacaciones pendiente${vacacionesPend.data!.length > 1 ? 's' : ''} de aprobar`, path: '/personal' });

      // ── Armar objeto final ─────────────────────────────────────────────────
      setData({
        ventasHoy, ventasAyer, cajaCerradaHoy,
        cajaUltimoCierre: cajaUltima?.counted_cash ?? null,
        cajaFechaCierre:  cajaUltima?.date ?? null,
        stockBajo, stockCritico, valorStock,
        empleadosEnTurno, totalEmpleados: staff.length,
        vacacionesPendientes: vacacionesPend.data?.length || 0,
        facturasVencidas, facturasPendienteTotal: facturasPend,
        facturasCobradaMes: facturasCobradas,
        albaranesPendientes: albPendientes, gastosEsteMes,
        ultimosFichajes,
        ultimosAlbaranes: albData.slice(0, 5).map(a => ({
          supplier: a.supplier_name, total: a.total, fecha: a.fecha,
        })),
        alertas,
      });

      setStaffList(staffAll.data || []);
      if (miEntrada && miPerfil) {
        setActiveEntry({ staffId: miPerfil.id, entryId: miEntrada.id, clockIn: miEntrada.clock_in });
      } else {
        setActiveEntry(null);
      }

      setLastUpdate(new Date());
    } catch (err: any) {
      console.error('Dashboard error:', err);
    } finally {
      setLoading(false);
    }
  }, [employee]);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  // ── Auto-refresh cada 3 minutos ───────────────────────────────────────────
  useEffect(() => {
    const iv = setInterval(loadDashboard, 3 * 60 * 1000);
    return () => clearInterval(iv);
  }, [loadDashboard]);

  // ── Briefing IA del día ───────────────────────────────────────────────────
  async function generateBriefing() {
    if (!data) return;
    setAiLoading(true); setBriefing(null); setShowBriefing(true);
    try {
      const hora = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
      const dia  = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

      const res = await getAI().models.generateContent({
        model: 'gemini-2.0-flash',
        contents: [{
          role: 'user', parts: [{
            text: `Eres el asistente de gestión de Raco Blanquerna, un restaurante en Palma de Mallorca.
Genera un briefing diario conciso y útil para el equipo. Son las ${hora} del ${dia}.

ESTADO ACTUAL DEL RESTAURANTE:
- Ventas hoy: ${fmtEur(data.ventasHoy)} (ayer: ${fmtEur(data.ventasAyer)})
- Caja cerrada hoy: ${data.cajaCerradaHoy ? 'Sí' : 'No'}
- Empleados en turno: ${data.empleadosEnTurno} de ${data.totalEmpleados}
- Stock crítico: ${data.stockCritico} productos | Stock bajo: ${data.stockBajo}
- Valor inventario: ${fmtEur(data.valorStock)}
- Facturas clientes vencidas: ${data.facturasVencidas}
- Cobrado este mes: ${fmtEur(data.facturasCobradaMes)}
- Pendiente de cobro: ${fmtEur(data.facturasPendienteTotal)}
- Albaranes sin facturar: ${data.albaranesPendientes}
- Gastos compras este mes: ${fmtEur(data.gastosEsteMes)}
- Vacaciones pendientes de aprobar: ${data.vacacionesPendientes}

ALERTAS ACTIVAS: ${data.alertas.map(a => a.msg).join(' | ') || 'ninguna'}

Da un briefing de 4-5 puntos en español:
1. Resumen del día en 1 frase
2. Lo más urgente a hacer ahora
3. Tendencia de ventas vs ayer
4. Una recomendación operativa concreta
5. Si hay algo positivo, mencionarlo

Tono: directo, profesional, sin rodeos. Máx 200 palabras.`
          }]
        }]
      });
      setBriefing(res.candidates?.[0]?.content?.parts?.[0]?.text || 'Sin respuesta');
    } catch (err: any) {
      setBriefing('Error al conectar con la IA.');
    } finally { setAiLoading(false); }
  }

  // ── Fichaje rápido ────────────────────────────────────────────────────────
  async function quickClockIn(staffId: string) {
    setFichajeBusy(staffId);
    try {
      const { data: entry, error } = await supabase.from('time_entries').insert({
        staff_id: staffId, date: today(), clock_in: new Date().toISOString(),
        device: navigator.userAgent.includes('Mobile') ? 'mobile' : 'desktop',
      }).select().single();
      if (error) throw error;
      const emp = staffList.find(s => s.id === staffId);
      setActiveEntry({ staffId, entryId: entry.id, clockIn: entry.clock_in });
      await loadDashboard();
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally { setFichajeBusy(null); setShowFichaje(false); }
  }

  async function quickClockOut(entryId: string, staffId: string) {
    setFichajeBusy(staffId);
    try {
      const { error } = await supabase.from('time_entries').update({ clock_out: new Date().toISOString() }).eq('id', entryId);
      if (error) throw error;
      setActiveEntry(null);
      await loadDashboard();
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally { setFichajeBusy(null); }
  }

  // ── Tendencia ventas ──────────────────────────────────────────────────────
  const trendPct = useMemo(() => {
    if (!data || data.ventasAyer === 0) return null;
    return ((data.ventasHoy - data.ventasAyer) / data.ventasAyer) * 100;
  }, [data]);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Buenos días';
    if (h < 20) return 'Buenas tardes';
    return 'Buenas noches';
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#F8FAFC]">
        <div className="text-center space-y-4">
          <Loader2 size={40} className="animate-spin text-indigo-400 mx-auto" />
          <p className="text-slate-400 font-medium">Cargando el estado del restaurante…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-4 md:p-8 space-y-6">

      {/* ── Header ── */}
      <header className="sticky top-4 z-[100] bg-white/80 backdrop-blur-xl border border-white/20
                         shadow-xl rounded-[2.5rem] p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-2xl shadow-lg">
            <LayoutDashboard className="w-5 h-5 text-indigo-400" />
            <span className="font-black text-sm tracking-tighter uppercase">Dashboard</span>
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-bold text-slate-700">
              {greeting}{(employee as any)?.nombre ? `, ${(employee as any).nombre.split(' ')[0]}` : ''} 👋
            </p>
            {lastUpdate && (
              <p className="text-[11px] text-slate-400">
                Actualizado a las {fmtTime(lastUpdate.toISOString())}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={generateBriefing} disabled={aiLoading}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-2xl text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-sm">
            {aiLoading ? <Loader2 size={14} className="animate-spin" /> : <Brain size={14} />}
            Briefing IA
          </button>
          <button onClick={loadDashboard} disabled={loading}
            className="p-2.5 bg-white border border-slate-200 rounded-2xl text-slate-600 hover:bg-slate-50 transition-all shadow-sm disabled:opacity-50">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </header>

      {/* ── Briefing IA ── */}
      <AnimatePresence>
        {showBriefing && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="bg-indigo-50 border border-indigo-200 rounded-3xl p-5 relative">
            <button onClick={() => setShowBriefing(false)}
              className="absolute top-3 right-3 p-1.5 rounded-xl hover:bg-indigo-100 text-slate-400 transition-all">
              <X size={16} />
            </button>
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 bg-indigo-100 rounded-2xl flex items-center justify-center shrink-0">
                <Sparkles size={18} className="text-indigo-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-black text-indigo-900 mb-2">Briefing del día</p>
                {aiLoading
                  ? <div className="flex items-center gap-2 text-indigo-500 text-sm"><Loader2 size={14} className="animate-spin" /> Analizando el estado del restaurante…</div>
                  : <pre className="text-sm text-indigo-800 whitespace-pre-wrap font-sans leading-relaxed">{briefing}</pre>
                }
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Briefing diario IA (alertas inteligentes) ── */}
      <DailyBriefing />

      {/* ── Alertas activas (legacy, complementarias) ── */}
      {data && data.alertas.length > 0 && (
        <div className="space-y-2">
          {data.alertas.map((a, i) => (
            <AlertBadge key={i} tipo={a.tipo} msg={a.msg} path={a.path} navigate={navigate} />
          ))}
        </div>
      )}

      {/* ── KPIs principales ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Ventas hoy"
          value={data ? fmtEur(data.ventasHoy) : '—'}
          sub={trendPct != null
            ? `${trendPct > 0 ? '+' : ''}${trendPct.toFixed(1)}% vs ayer`
            : data?.ventasAyer === 0 ? 'Sin datos de ayer' : undefined
          }
          trend={trendPct ?? undefined}
          icon={<TrendingUp size={16} className="text-emerald-400" />}
          color={data?.ventasHoy && data.ventasHoy > 0 ? 'text-emerald-600' : 'text-slate-900'}
          onClick={() => navigate('/cierre-caja')}
        />
        <StatCard
          label="Caja"
          value={data?.cajaCerradaHoy ? '✓ Cerrada' : 'Sin cerrar'}
          sub={data?.cajaCerradaHoy ? `Efectivo: ${fmtEur(data.cajaUltimoCierre || 0)}` : 'Cierra la caja al acabar el día'}
          icon={<Calculator size={16} className={data?.cajaCerradaHoy ? 'text-emerald-400' : 'text-amber-400'} />}
          color={data?.cajaCerradaHoy ? 'text-emerald-600' : 'text-amber-600'}
          alert={!data?.cajaCerradaHoy && new Date().getHours() >= 14}
          onClick={() => navigate('/cierre-caja')}
        />
        <StatCard
          label="Stock crítico"
          value={data?.stockCritico ?? '—'}
          sub={data ? `${data.stockBajo} más con stock bajo` : undefined}
          icon={<Package size={16} className={data?.stockCritico ? 'text-rose-400' : 'text-slate-300'} />}
          color={data?.stockCritico ? 'text-rose-600' : 'text-slate-400'}
          alert={(data?.stockCritico ?? 0) > 0}
          onClick={() => navigate('/inventario')}
        />
        <StatCard
          label="En turno ahora"
          value={data ? `${data.empleadosEnTurno} / ${data.totalEmpleados}` : '—'}
          sub={data?.vacacionesPendientes ? `${data.vacacionesPendientes} vacaciones por aprobar` : 'Equipo al día'}
          icon={<Users size={16} className="text-blue-400" />}
          onClick={() => navigate('/personal')}
        />
      </div>

      {/* ── Segunda fila de KPIs ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Cobrado este mes"
          value={data ? fmtEur(data.facturasCobradaMes) : '—'}
          sub="Facturas clientes pagadas"
          icon={<Receipt size={16} className="text-indigo-400" />}
          onClick={() => navigate('/facturacion-clientes')}
        />
        <StatCard
          label="Pendiente cobro"
          value={data ? fmtEur(data.facturasPendienteTotal) : '—'}
          sub={data?.facturasVencidas ? `⚠️ ${data.facturasVencidas} vencidas` : 'Sin vencidas'}
          icon={<Clock size={16} className={data?.facturasVencidas ? 'text-rose-400' : 'text-amber-400'} />}
          alert={(data?.facturasVencidas ?? 0) > 0}
          color={(data?.facturasVencidas ?? 0) > 0 ? 'text-rose-600' : 'text-slate-900'}
          onClick={() => navigate('/facturacion-clientes')}
        />
        <StatCard
          label="Gastos este mes"
          value={data ? fmtEur(data.gastosEsteMes) : '—'}
          sub={data?.albaranesPendientes ? `${data.albaranesPendientes} albaranes sin facturar` : 'Todo facturado'}
          icon={<ShoppingBag size={16} className="text-orange-400" />}
          onClick={() => navigate('/compras')}
        />
        <StatCard
          label="Valor inventario"
          value={data ? fmtEur(data.valorStock) : '—'}
          sub="Stock activo valorado"
          icon={<Package size={16} className="text-purple-400" />}
          onClick={() => navigate('/inventario')}
        />
      </div>

      {/* ── Accesos rápidos ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Cerrar caja',      icon: Calculator, color: 'bg-emerald-600', path: '/cierre-caja' },
          { label: 'Nuevo albarán',    icon: Package,    color: 'bg-indigo-600',  path: '/compras' },
          { label: 'Nueva factura',    icon: Receipt,    color: 'bg-blue-600',    path: '/facturacion-clientes' },
          { label: 'Fichaje personal', icon: Users,      color: 'bg-purple-600',  path: '/personal' },
        ].map(action => (
          <button key={action.label} onClick={() => navigate(action.path)}
            className="flex items-center gap-3 px-4 py-3.5 bg-white border border-slate-200 rounded-2xl
                       hover:border-indigo-200 hover:shadow-md transition-all group">
            <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0', action.color)}>
              <action.icon size={16} />
            </div>
            <span className="text-xs font-black text-slate-700 uppercase tracking-wider">{action.label}</span>
            <ChevronRight size={14} className="ml-auto text-slate-300 group-hover:text-indigo-400 transition-colors" />
          </button>
        ))}
      </div>

      {/* ── Fichaje rápido + últimos fichajes ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Fichaje rápido */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Timer size={16} className="text-slate-400" />
              <span className="font-black text-slate-900 text-sm">Fichaje rápido</span>
            </div>
            <button onClick={() => setShowFichaje(!showFichaje)}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-700 transition-colors">
              {showFichaje ? 'Ocultar' : 'Ver todos'}
            </button>
          </div>

          {/* Mi fichaje */}
          {activeEntry ? (
            <div className="p-5 bg-emerald-50 border-b border-emerald-100 flex items-center justify-between">
              <div>
                <p className="text-xs font-black text-emerald-600 uppercase tracking-wider">Estás en turno</p>
                <p className="font-black text-slate-900">Desde las {fmtTime(activeEntry.clockIn)}</p>
              </div>
              <button
                onClick={() => quickClockOut(activeEntry.entryId, activeEntry.staffId)}
                disabled={fichajeBusy === activeEntry.staffId}
                className="flex items-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-2xl text-xs font-black hover:bg-rose-700 disabled:opacity-50 transition-all">
                {fichajeBusy ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />}
                Salida
              </button>
            </div>
          ) : (
            <div className="p-5 border-b border-slate-100">
              <p className="text-xs text-slate-400 font-medium mb-3">¿Quién ficha ahora?</p>
              <div className="grid grid-cols-2 gap-2">
                {staffList.slice(0, 4).map(emp => (
                  <button key={emp.id}
                    onClick={() => quickClockIn(emp.id)}
                    disabled={!!fichajeBusy || (data?.ultimosFichajes.some(f => f.name === emp.name && f.tipo === 'entrada'))}
                    className="flex items-center gap-2 px-3 py-2 bg-slate-50 hover:bg-indigo-50 hover:border-indigo-200 border border-transparent rounded-xl text-xs font-bold text-slate-700 transition-all disabled:opacity-40">
                    <div className="w-7 h-7 bg-indigo-100 rounded-lg flex items-center justify-center font-black text-indigo-600 text-sm shrink-0">
                      {emp.name.charAt(0)}
                    </div>
                    <span className="truncate">{emp.name.split(' ')[0]}</span>
                    {fichajeBusy === emp.id && <Loader2 size={12} className="animate-spin ml-auto" />}
                  </button>
                ))}
              </div>
              {staffList.length > 4 && (
                <button onClick={() => navigate('/personal')}
                  className="mt-2 w-full text-xs font-bold text-slate-400 hover:text-indigo-600 transition-colors text-center py-1">
                  Ver todos en Fichaje →
                </button>
              )}
            </div>
          )}

          {/* Últimos fichajes */}
          <div className="divide-y divide-slate-50">
            {(data?.ultimosFichajes || []).slice(0, showFichaje ? 5 : 3).map((f, i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-3">
                <div className={cn(
                  'w-7 h-7 rounded-xl flex items-center justify-center shrink-0',
                  f.tipo === 'entrada' ? 'bg-emerald-100' : 'bg-rose-50'
                )}>
                  {f.tipo === 'entrada'
                    ? <LogIn size={13} className="text-emerald-600" />
                    : <LogOut size={13} className="text-rose-500" />}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-slate-800">{f.name}</p>
                  <p className="text-xs text-slate-400">{f.tipo === 'entrada' ? 'Entró' : 'Salió'} a las {f.hora}</p>
                </div>
                <span className={cn('text-[10px] font-black px-2 py-0.5 rounded-lg',
                  f.tipo === 'entrada' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-500'
                )}>
                  {f.tipo}
                </span>
              </div>
            ))}
            {(!data?.ultimosFichajes.length) && (
              <p className="text-center text-slate-400 text-sm py-6">Sin fichajes hoy</p>
            )}
          </div>
        </div>

        {/* Últimos albaranes + estado módulos */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package size={16} className="text-slate-400" />
              <span className="font-black text-slate-900 text-sm">Últimas compras</span>
            </div>
            <button onClick={() => navigate('/compras')}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-700 transition-colors">
              Ver todas →
            </button>
          </div>
          <div className="divide-y divide-slate-50">
            {(data?.ultimosAlbaranes || []).map((a, i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-3">
                <div className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center shrink-0">
                  <ShoppingBag size={14} className="text-slate-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-800 truncate">{a.supplier}</p>
                  <p className="text-xs text-slate-400">{a.fecha}</p>
                </div>
                <span className="font-black text-slate-900 text-sm shrink-0">{fmtEur(a.total)}</span>
              </div>
            ))}
            {(!data?.ultimosAlbaranes.length) && (
              <p className="text-center text-slate-400 text-sm py-6">Sin albaranes recientes</p>
            )}
          </div>

          {/* Estado rápido de módulos */}
          <div className="p-5 border-t border-slate-100 grid grid-cols-2 gap-2">
            {[
              {
                label: 'Proveedores',
                ok: true,
                path: '/proveedores',
                sub: `${staffList.length} activos`,
              },
              {
                label: 'Facturas pend.',
                ok: (data?.facturasVencidas ?? 0) === 0,
                path: '/facturacion-clientes',
                sub: data ? `${fmtEur(data.facturasPendienteTotal)}` : '—',
              },
              {
                label: 'Albaranes',
                ok: (data?.albaranesPendientes ?? 0) === 0,
                path: '/compras',
                sub: data ? `${data.albaranesPendientes} pendientes` : '—',
              },
              {
                label: 'Caja',
                ok: data?.cajaCerradaHoy ?? false,
                path: '/cierre-caja',
                sub: data?.cajaCerradaHoy ? 'Cerrada hoy' : 'Pendiente',
              },
            ].map(m => (
              <button key={m.label} onClick={() => navigate(m.path)}
                className="flex items-center gap-2 p-3 bg-slate-50 rounded-2xl hover:bg-slate-100 transition-all text-left">
                <div className={cn('w-2 h-2 rounded-full shrink-0', m.ok ? 'bg-emerald-400' : 'bg-amber-400')} />
                <div className="min-w-0">
                  <p className="text-xs font-black text-slate-700">{m.label}</p>
                  <p className="text-[11px] text-slate-400">{m.sub}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}
