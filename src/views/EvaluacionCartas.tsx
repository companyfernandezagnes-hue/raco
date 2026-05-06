// src/views/EvaluacionCartas.tsx
// ✅ 100% Supabase — sin mockData, sin datos hardcoded
// ✅ Popularidad REAL desde tickets (jsonb items vendidos)
// ✅ Costes REALES desde recipe_cost_summary (con merma)
// ✅ Matriz BCG ingeniería de menú: Estrella / Vaca / Puzzle / Perro
// ✅ Simulador de precio — ve el impacto en margen en tiempo real
// ✅ Análisis IA con recomendaciones concretas por plato
// ✅ Exportar a Excel con SheetJS
// ✅ Toast notifications, Gen Z UX
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  FileSpreadsheet, Loader2, Brain, TrendingUp, TrendingDown,
  Star, Download, RefreshCw, AlertTriangle, CheckCircle2,
  ChevronDown, ChevronUp, Zap, X, BarChart3, Tag, Edit2, Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../supabase';
import { GoogleGenAI } from '@google/genai';
import { cn } from '../lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Recipe {
  id: string;
  name: string;
  category: string;
  margin: number;
  active: boolean;
}

interface RecipeCost {
  id: string;
  name: string;
  category: string;
  margin: number;
  labor_cost: number;
  ingredient_cost: number;
  total_cost: number;
  suggested_price: number;
}

interface MenuItemAnalysis {
  id: string;
  name: string;
  category: string;
  // Costes reales (de recipe_cost_summary)
  total_cost: number;
  suggested_price: number;
  margin_pct: number;
  // Popularidad real (de tickets)
  units_sold: number;
  popularity_index: number; // 0-100 relativo al resto
  // Precio de carta (editable manualmente)
  sale_price: number;
  // Clasificación BCG
  classification: 'Estrella' | 'Vaca' | 'Puzzle' | 'Perro';
  // Revenue real
  revenue: number;
  profit: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const aiRef = { current: null as GoogleGenAI | null };
function getAI() {
  if (!aiRef.current) aiRef.current = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || '' });
  return aiRef.current;
}
function uid() { return Math.random().toString(36).slice(2, 10); }
function fmtEur(n: number) { return n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' }); }
function fmtPct(n: number) { return `${n.toFixed(1)}%`; }

const CAT_EMOJI: Record<string, string> = {
  'Entrante': '🥗', 'Plato principal': '🍽️', 'Postre': '🍮',
  'Bebida': '🥤', 'Cocktail': '🍹', 'Otro': '🔧',
};
const CAT_COLOR: Record<string, string> = {
  'Entrante':        'bg-amber-50 text-amber-700 border-amber-200',
  'Plato principal': 'bg-indigo-50 text-indigo-700 border-indigo-200',
  'Postre':          'bg-pink-50 text-pink-700 border-pink-200',
  'Bebida':          'bg-blue-50 text-blue-700 border-blue-200',
  'Cocktail':        'bg-purple-50 text-purple-700 border-purple-200',
  'Otro':            'bg-slate-50 text-slate-600 border-slate-200',
};

const CLASS_CONFIG = {
  'Estrella': { color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: '⭐', desc: 'Alta popularidad + alto margen' },
  'Vaca':     { color: 'bg-blue-100 text-blue-700 border-blue-200',          icon: '🐄', desc: 'Alta popularidad + bajo margen' },
  'Puzzle':   { color: 'bg-amber-100 text-amber-700 border-amber-200',       icon: '🧩', desc: 'Baja popularidad + alto margen' },
  'Perro':    { color: 'bg-rose-100 text-rose-700 border-rose-200',          icon: '🐕', desc: 'Baja popularidad + bajo margen' },
};

// ─── Toast ────────────────────────────────────────────────────────────────────
function useToast() {
  const [toasts, setToasts] = useState<{ id: string; msg: string; type: 'ok' | 'err' | 'warn' }[]>([]);
  const show = useCallback((msg: string, type: 'ok' | 'err' | 'warn' = 'ok') => {
    const id = uid(); setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000);
  }, []);
  const ToastContainer = () => (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[500] flex flex-col gap-2 items-center pointer-events-none">
      <AnimatePresence>
        {toasts.map(t => (
          <motion.div key={t.id} initial={{ opacity: 0, y: 20, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -10, scale: 0.9 }}
            className={cn('px-5 py-3 rounded-2xl text-sm font-bold shadow-2xl flex items-center gap-2',
              t.type === 'ok' ? 'bg-slate-900 text-white' : t.type === 'warn' ? 'bg-amber-500 text-white' : 'bg-rose-500 text-white')}>
            {t.type === 'ok' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
            {t.msg}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
  return { show, ToastContainer };
}

// ─── BCG Classifier ───────────────────────────────────────────────────────────
function classify(
  popularityIndex: number, marginPct: number,
  avgPopularity: number, avgMargin: number
): MenuItemAnalysis['classification'] {
  const highPop  = popularityIndex >= avgPopularity;
  const highMarg = marginPct >= avgMargin;
  if (highPop && highMarg)  return 'Estrella';
  if (highPop && !highMarg) return 'Vaca';
  if (!highPop && highMarg) return 'Puzzle';
  return 'Perro';
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN VIEW
// ════════════════════════════════════════════════════════════════════════════
export default function EvaluacionCartasView() {
  const { show: toast, ToastContainer } = useToast();

  const [items,    setItems]    = useState<MenuItemAnalysis[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<string | null>(null);

  // Precios de carta editables (override manual sobre suggested_price)
  const [prices, setPrices]    = useState<Record<string, number>>({});
  const [editingPrice, setEditingPrice] = useState<string | null>(null);

  const [filterCat,  setFilterCat]  = useState('Todos');
  const [filterClass, setFilterClass] = useState('Todos');
  const [sortBy, setSortBy]     = useState<'popularity' | 'margin' | 'profit' | 'name'>('profit');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Simulador de precio
  const [simItem,  setSimItem]  = useState<MenuItemAnalysis | null>(null);
  const [simPrice, setSimPrice] = useState(0);

  // ── Load ──────────────────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [costsRes, ticketsRes] = await Promise.all([
        supabase.from('recipe_cost_summary').select('*'),
        supabase.from('tickets')
          .select('items, status')
          .eq('status', 'Cerrado')
          .order('created_at', { ascending: false })
          .limit(2000),
      ]);

      const costs: RecipeCost[] = costsRes.data || [];

      // ── Contar unidades vendidas por nombre de plato (desde tickets.items JSONB)
      const unitMap: Record<string, number> = {};
      for (const ticket of ticketsRes.data || []) {
        const ticketItems = ticket.items as { name?: string; n?: string; qty?: number; q?: number; quantity?: number }[] || [];
        for (const ti of ticketItems) {
          const name = (ti.name || ti.n || '').trim().toLowerCase();
          const qty  = Number(ti.qty ?? ti.q ?? ti.quantity ?? 1);
          if (name) unitMap[name] = (unitMap[name] || 0) + qty;
        }
      }

      // ── Cruzar con recipes — match por nombre (case insensitive)
      const maxUnits = Math.max(1, ...Object.values(unitMap));

      const analyzed: MenuItemAnalysis[] = costs.map(c => {
        // Buscar ventas por nombre del plato
        const key = c.name.trim().toLowerCase();
        const sold = unitMap[key] || 0;
        const popIndex = Math.round((sold / maxUnits) * 100);

        const salePrice = c.suggested_price > 0 ? c.suggested_price : c.total_cost * 1.6;
        const revenue   = sold * salePrice;
        const profit    = sold * (salePrice - c.total_cost);
        const marginPct = salePrice > 0 ? ((salePrice - c.total_cost) / salePrice) * 100 : c.margin;

        return {
          id: c.id, name: c.name, category: c.category,
          total_cost: c.total_cost, suggested_price: salePrice,
          margin_pct: marginPct,
          units_sold: sold, popularity_index: popIndex,
          sale_price: salePrice,
          classification: 'Estrella', // placeholder, se recalcula abajo
          revenue, profit,
        };
      });

      // ── Clasificación BCG con medias reales
      const avgPop  = analyzed.length > 0 ? analyzed.reduce((s, i) => s + i.popularity_index, 0) / analyzed.length : 50;
      const avgMarg = analyzed.length > 0 ? analyzed.reduce((s, i) => s + i.margin_pct, 0) / analyzed.length : 60;

      const classified = analyzed.map(i => ({
        ...i,
        classification: classify(i.popularity_index, i.margin_pct, avgPop, avgMarg),
      }));

      setItems(classified);

      // Inicializar precios editables con suggested_price
      const initPrices: Record<string, number> = {};
      for (const i of classified) initPrices[i.id] = i.suggested_price;
      setPrices(initPrices);

    } catch (err: any) {
      toast('Error al cargar datos: ' + err.message, 'err');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Recalcular clasificación cuando cambian precios ───────────────────────
  const enrichedItems = useMemo(() => {
    if (items.length === 0) return [];
    const withPrices = items.map(i => {
      const sp = prices[i.id] || i.suggested_price;
      const marginPct = sp > 0 ? ((sp - i.total_cost) / sp) * 100 : i.margin_pct;
      const revenue   = i.units_sold * sp;
      const profit    = i.units_sold * (sp - i.total_cost);
      return { ...i, sale_price: sp, margin_pct: marginPct, revenue, profit };
    });
    const avgPop  = withPrices.reduce((s, i) => s + i.popularity_index, 0) / withPrices.length;
    const avgMarg = withPrices.reduce((s, i) => s + i.margin_pct, 0) / withPrices.length;
    return withPrices.map(i => ({
      ...i,
      classification: classify(i.popularity_index, i.margin_pct, avgPop, avgMarg),
    }));
  }, [items, prices]);

  // ── Stats ─────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const totalRevenue = enrichedItems.reduce((s, i) => s + i.revenue, 0);
    const totalProfit  = enrichedItems.reduce((s, i) => s + i.profit, 0);
    const avgMargin    = enrichedItems.length > 0 ? enrichedItems.reduce((s, i) => s + i.margin_pct, 0) / enrichedItems.length : 0;
    const estrellas    = enrichedItems.filter(i => i.classification === 'Estrella').length;
    const perros       = enrichedItems.filter(i => i.classification === 'Perro').length;
    return { totalRevenue, totalProfit, avgMargin, estrellas, perros };
  }, [enrichedItems]);

  // ── Filtered + sorted ─────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return enrichedItems
      .filter(i => (filterCat === 'Todos' || i.category === filterCat))
      .filter(i => (filterClass === 'Todos' || i.classification === filterClass))
      .sort((a, b) => {
        if (sortBy === 'popularity') return b.popularity_index - a.popularity_index;
        if (sortBy === 'margin')     return b.margin_pct - a.margin_pct;
        if (sortBy === 'profit')     return b.profit - a.profit;
        return a.name.localeCompare(b.name);
      });
  }, [enrichedItems, filterCat, filterClass, sortBy]);

  // ── BCG matrix data ───────────────────────────────────────────────────────
  const byClass = useMemo(() => {
    const map: Record<string, MenuItemAnalysis[]> = { Estrella: [], Vaca: [], Puzzle: [], Perro: [] };
    for (const i of enrichedItems) map[i.classification].push(i);
    return map;
  }, [enrichedItems]);

  // ── IA análisis ───────────────────────────────────────────────────────────
  async function handleAIAnalysis() {
    setAiLoading(true); setAiResult(null);
    try {
      const top5    = [...enrichedItems].sort((a, b) => b.profit - a.profit).slice(0, 5);
      const worst5  = [...enrichedItems].sort((a, b) => a.profit - b.profit).slice(0, 5);
      const estrellas = byClass['Estrella'].map(i => i.name).join(', ') || 'ninguno';
      const perros    = byClass['Perro'].map(i => i.name).join(', ') || 'ninguno';
      const puzzles   = byClass['Puzzle'].map(i => i.name).join(', ') || 'ninguno';

      const res = await getAI().models.generateContent({
        model: 'gemini-2.0-flash',
        contents: [{
          role: 'user', parts: [{
            text: `Eres un consultor experto en ingeniería de menú para restaurantes de Palma de Mallorca.
Analiza esta carta y da recomendaciones CONCRETAS por plato.

RESUMEN DE LA CARTA (${enrichedItems.length} platos):
- Ingresos totales periodo: ${fmtEur(stats.totalRevenue)}
- Beneficio total: ${fmtEur(stats.totalProfit)}
- Margen medio: ${fmtPct(stats.avgMargin)}
- Estrellas: ${stats.estrellas} platos | Perros: ${stats.perros} platos

ESTRELLAS (alta pop + alto margen): ${estrellas}
PUZZLES (baja pop + alto margen): ${puzzles}
PERROS (baja pop + bajo margen): ${perros}

TOP 5 MÁS RENTABLES:
${top5.map(i => `- ${i.name}: ${i.units_sold} uds vendidas, margen ${fmtPct(i.margin_pct)}, beneficio ${fmtEur(i.profit)}`).join('\n')}

TOP 5 MENOS RENTABLES:
${worst5.map(i => `- ${i.name}: ${i.units_sold} uds, margen ${fmtPct(i.margin_pct)}, coste ${fmtEur(i.total_cost)}`).join('\n')}

Dame 6 recomendaciones MUY CONCRETAS en español:
1. Qué estrellas destacar en la carta (posición, foto, descripción)
2. Qué puzzles convertir en estrellas y cómo (precio, descripción, posición)
3. Qué perros eliminar o transformar (y por qué)
4. Precio que deberías subir sin perder clientes
5. Plato con mejor oportunidad de mejora de margen
6. Una idea de plato nuevo que encajaría

Bullet points directos, máx 2 líneas cada uno. Menciona nombres de platos específicos.`
          }]
        }]
      });
      setAiResult(res.candidates?.[0]?.content?.parts?.[0]?.text || 'Sin análisis');
    } catch (err: any) { setAiResult('Error IA: ' + err.message); }
    finally { setAiLoading(false); }
  }

  // ── Exportar Excel ────────────────────────────────────────────────────────
  async function exportExcel() {
    await new Promise<void>((res, rej) => {
      if ((window as any).XLSX) { res(); return; }
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
      s.onload = () => res(); s.onerror = () => rej(); document.head.appendChild(s);
    });
    const XLSX = (window as any).XLSX;
    const data = [
      ['Plato', 'Categoría', 'Clasificación', 'Unidades vendidas', 'Coste (€)', 'Precio carta (€)', 'Margen (%)', 'Revenue (€)', 'Beneficio (€)'],
      ...enrichedItems.map(i => [
        i.name, i.category, i.classification, i.units_sold,
        i.total_cost.toFixed(2), i.sale_price.toFixed(2),
        i.margin_pct.toFixed(1), i.revenue.toFixed(2), i.profit.toFixed(2),
      ]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [{ wch: 28 }, { wch: 18 }, { wch: 12 }, { wch: 18 }, { wch: 12 }, { wch: 16 }, { wch: 12 }, { wch: 14 }, { wch: 14 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Análisis Carta');
    XLSX.writeFile(wb, `EvaluacionCarta_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast('Excel exportado ✓');
  }

  // ── Simulador ─────────────────────────────────────────────────────────────
  const simMargin   = simItem ? ((simPrice - simItem.total_cost) / simPrice) * 100 : 0;
  const simProfit   = simItem ? (simPrice - simItem.total_cost) * simItem.units_sold : 0;
  const simRevenue  = simItem ? simPrice * simItem.units_sold : 0;
  const currentProfit = simItem ? enrichedItems.find(i => i.id === simItem.id)?.profit || 0 : 0;

  // ─────────────────────────────────────────────────────────────────────────
  const CATEGORIES = ['Todos', 'Entrante', 'Plato principal', 'Postre', 'Bebida', 'Cocktail', 'Otro'];

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-4 md:p-8 space-y-6">
      <ToastContainer />

      {/* ── Header ── */}
      <header className="sticky top-4 z-[100] bg-white/80 backdrop-blur-xl border border-white/20 shadow-xl rounded-[2.5rem] p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-2xl shadow-lg">
            <FileSpreadsheet className="w-5 h-5 text-amber-400" />
            <span className="font-black text-sm tracking-tighter uppercase">Evaluación Carta</span>
          </div>
          <span className="text-sm font-bold text-slate-400 hidden sm:block">{enrichedItems.length} platos</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportExcel}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-2xl text-xs font-bold hover:bg-slate-50 transition-all shadow-sm">
            <Download size={14} /> Exportar Excel
          </button>
          <button onClick={handleAIAnalysis} disabled={aiLoading}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-2xl text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-sm shadow-indigo-200">
            {aiLoading ? <Loader2 size={14} className="animate-spin" /> : <Brain size={14} />}
            Análisis IA
          </button>
          <button onClick={loadAll} disabled={loading}
            className="p-2.5 bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 transition-all shadow-sm disabled:opacity-50">
            <RefreshCw size={16} className={loading ? 'animate-spin text-indigo-400' : 'text-slate-400'} />
          </button>
        </div>
      </header>

      {/* ── Stats globales ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Revenue total', value: fmtEur(stats.totalRevenue), icon: <TrendingUp size={16} className="text-emerald-400" />, color: 'text-emerald-600' },
          { label: 'Beneficio total', value: fmtEur(stats.totalProfit), icon: <BarChart3 size={16} className="text-indigo-400" />, color: 'text-indigo-600' },
          { label: 'Margen medio carta', value: fmtPct(stats.avgMargin), icon: <Tag size={16} className={stats.avgMargin >= 60 ? 'text-emerald-400' : 'text-amber-400'} />, color: stats.avgMargin >= 60 ? 'text-emerald-600' : 'text-amber-600' },
          { label: 'Platos estrella', value: `${stats.estrellas} ⭐`, icon: <Star size={16} className="text-amber-400" />, color: 'text-amber-600', alert: stats.perros > stats.estrellas },
        ].map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            className={cn('bg-white rounded-3xl p-5 border shadow-sm', s.alert ? 'border-rose-200' : 'border-slate-200')}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{s.label}</span>
              {s.icon}
            </div>
            <p className={cn('text-2xl font-black', s.color)}>{s.value}</p>
          </motion.div>
        ))}
      </div>

      {/* ── IA Result ── */}
      <AnimatePresence>
        {aiResult && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="bg-indigo-50 border border-indigo-200 rounded-3xl p-6 relative">
            <button onClick={() => setAiResult(null)} className="absolute top-4 right-4 p-1.5 rounded-xl hover:bg-indigo-100 text-slate-400 transition-all"><X size={16} /></button>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 bg-indigo-100 rounded-2xl flex items-center justify-center"><Brain size={18} className="text-indigo-600" /></div>
              <p className="font-black text-indigo-900">Análisis de la carta — Recomendaciones IA</p>
            </div>
            <pre className="text-sm text-indigo-800 whitespace-pre-wrap font-sans leading-relaxed">{aiResult}</pre>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Matriz BCG visual ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {(['Estrella', 'Vaca', 'Puzzle', 'Perro'] as const).map(cls => {
          const cfg = CLASS_CONFIG[cls];
          const clsItems = byClass[cls];
          return (
            <div key={cls} className={cn('bg-white rounded-3xl border p-5 shadow-sm', cfg.color.split(' ')[0] + ' border-' + cfg.color.split(' ').find(c => c.startsWith('border-'))?.replace('border-', '') || 'border-slate-200')}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">{cfg.icon}</span>
                <div>
                  <p className={cn('font-black text-sm', cfg.color.split(' ').slice(1).join(' '))}>{cls}</p>
                  <p className="text-[10px] text-slate-400">{cfg.desc}</p>
                </div>
              </div>
              <p className={cn('text-3xl font-black', cfg.color.split(' ').slice(1).join(' '))}>{clsItems.length}</p>
              <div className="mt-2 space-y-1">
                {clsItems.slice(0, 2).map(i => (
                  <p key={i.id} className="text-xs text-slate-500 truncate">• {i.name}</p>
                ))}
                {clsItems.length > 2 && <p className="text-[10px] text-slate-400">+{clsItems.length - 2} más</p>}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Filtros ── */}
      <div className="flex flex-wrap gap-3">
        <div className="flex bg-white border border-slate-200 rounded-2xl p-1 gap-1 shadow-sm overflow-x-auto">
          {CATEGORIES.map(c => (
            <button key={c} onClick={() => setFilterCat(c)}
              className={cn('px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap',
                filterCat === c ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-800')}>
              {c}
            </button>
          ))}
        </div>
        <div className="flex bg-white border border-slate-200 rounded-2xl p-1 gap-1 shadow-sm">
          {(['Todos', 'Estrella', 'Vaca', 'Puzzle', 'Perro'] as const).map(c => (
            <button key={c} onClick={() => setFilterClass(c)}
              className={cn('px-3 py-1.5 rounded-xl text-xs font-bold transition-all',
                filterClass === c ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-800')}>
              {c === 'Todos' ? 'Todos' : CLASS_CONFIG[c as keyof typeof CLASS_CONFIG]?.icon + ' ' + c}
            </button>
          ))}
        </div>
        <div className="flex bg-white border border-slate-200 rounded-2xl p-1 gap-1 shadow-sm ml-auto">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider px-2 flex items-center">Ordenar:</span>
          {[{ id: 'profit', label: 'Beneficio' }, { id: 'popularity', label: 'Popularidad' }, { id: 'margin', label: 'Margen' }, { id: 'name', label: 'Nombre' }].map(s => (
            <button key={s.id} onClick={() => setSortBy(s.id as typeof sortBy)}
              className={cn('px-3 py-1.5 rounded-xl text-xs font-bold transition-all',
                sortBy === s.id ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-800')}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tabla de platos ── */}
      {loading ? (
        <div className="flex justify-center py-20"><Loader2 size={32} className="animate-spin text-indigo-400" /></div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-center">
          <FileSpreadsheet size={48} className="text-slate-200 mb-4" />
          <p className="text-slate-400 font-bold">Sin platos en la carta</p>
          <p className="text-xs text-slate-400 mt-1">Añade recetas en el módulo de Escandallos para ver la evaluación aquí</p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                  {['Plato', 'Cat.', 'Unidades', 'Coste', 'Precio carta', 'Margen', 'Beneficio', 'Clasificación', ''].map(h => (
                    <th key={h} className="px-5 py-3 text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map(item => {
                  const cfg = CLASS_CONFIG[item.classification];
                  const isExpanded = expandedId === item.id;
                  return (
                    <React.Fragment key={item.id}>
                      <tr className="hover:bg-slate-50/50 transition-colors group cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : item.id)}>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{CAT_EMOJI[item.category] || '🍽️'}</span>
                            <span className="font-bold text-slate-900">{item.name}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <span className={cn('text-[10px] font-black px-2 py-0.5 rounded-lg border', CAT_COLOR[item.category] || CAT_COLOR['Otro'])}>
                            {item.category}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-800">{item.units_sold}</span>
                            <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full bg-indigo-400 rounded-full" style={{ width: `${item.popularity_index}%` }} />
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-slate-500">{fmtEur(item.total_cost)}</td>
                        <td className="px-5 py-3">
                          {editingPrice === item.id ? (
                            <input
                              type="number" step="0.10" min="0"
                              value={prices[item.id] || item.sale_price}
                              onChange={e => setPrices(p => ({ ...p, [item.id]: parseFloat(e.target.value) || 0 }))}
                              onBlur={() => setEditingPrice(null)}
                              autoFocus
                              className="w-24 px-2 py-1 bg-slate-50 border border-indigo-300 rounded-lg text-sm font-bold focus:outline-none"
                              onClick={e => e.stopPropagation()}
                            />
                          ) : (
                            <button
                              onClick={e => { e.stopPropagation(); setEditingPrice(item.id); }}
                              className="flex items-center gap-1 font-bold text-slate-800 hover:text-indigo-600 transition-colors group/price">
                              {fmtEur(prices[item.id] || item.sale_price)}
                              <Edit2 size={11} className="opacity-0 group-hover/price:opacity-100 transition-opacity" />
                            </button>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          <span className={cn('font-black text-sm',
                            item.margin_pct >= 65 ? 'text-emerald-600' : item.margin_pct >= 50 ? 'text-amber-600' : 'text-rose-600')}>
                            {fmtPct(item.margin_pct)}
                          </span>
                        </td>
                        <td className="px-5 py-3 font-black text-slate-900">{fmtEur(item.profit)}</td>
                        <td className="px-5 py-3">
                          <span className={cn('text-[10px] font-black px-2 py-0.5 rounded-lg border', cfg.color)}>
                            {cfg.icon} {item.classification}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                            <button
                              onClick={e => { e.stopPropagation(); setSimItem(item); setSimPrice(prices[item.id] || item.sale_price); }}
                              className="flex items-center gap-1 px-2.5 py-1.5 bg-amber-50 border border-amber-200 text-amber-700 rounded-xl text-[10px] font-bold hover:bg-amber-100 transition-all">
                              <Zap size={11} /> Simular
                            </button>
                            {isExpanded ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                          </div>
                        </td>
                      </tr>
                      {/* Fila expandida con detalle */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={9} className="px-5 py-0">
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                              className="py-4 border-t border-slate-50">
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {[
                                  { label: 'Revenue total', value: fmtEur(item.revenue), color: 'text-emerald-600' },
                                  { label: 'Beneficio total', value: fmtEur(item.profit), color: 'text-indigo-600' },
                                  { label: 'Popularidad', value: `${item.popularity_index}% del máximo`, color: 'text-slate-700' },
                                  { label: 'Precio sugerido BD', value: fmtEur(item.suggested_price), color: 'text-slate-500' },
                                ].map(s => (
                                  <div key={s.label} className="bg-slate-50 rounded-2xl px-4 py-3">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{s.label}</p>
                                    <p className={cn('font-black mt-0.5', s.color)}>{s.value}</p>
                                  </div>
                                ))}
                              </div>
                              {/* Recomendación rápida */}
                              <div className={cn('mt-3 px-4 py-3 rounded-2xl border text-xs font-medium', cfg.color)}>
                                {item.classification === 'Estrella' && `✓ Plato estrella — destácalo en la carta, ponlo en la primera página o con foto. Considera una versión premium.`}
                                {item.classification === 'Vaca'    && `💡 Muy popular pero margen bajo — sube el precio ${fmtEur(Math.max(0.5, item.total_cost * 0.15))} o reduce costes para mejorar rentabilidad.`}
                                {item.classification === 'Puzzle'  && `🎯 Buen margen pero poco pedido — mejora su visibilidad en carta, añade foto o descripción atractiva.`}
                                {item.classification === 'Perro'   && `⚠️ Baja popularidad y bajo margen — valora retirarlo de carta o rediseñarlo completamente.`}
                              </div>
                            </motion.div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 border-t border-slate-200">
                  <td colSpan={6} className="px-5 py-3 font-black text-slate-500 text-xs uppercase tracking-wider">
                    Total ({filtered.length} platos)
                  </td>
                  <td className="px-5 py-3 font-black text-slate-900">
                    {fmtEur(filtered.reduce((s, i) => s + i.profit, 0))}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ── Simulador de precio ── */}
      <AnimatePresence>
        {simItem && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
              className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex items-center gap-4">
                <div className="w-11 h-11 bg-amber-50 rounded-2xl flex items-center justify-center shrink-0">
                  <Zap size={20} className="text-amber-500" />
                </div>
                <div className="flex-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-amber-500">Simulador de precio</p>
                  <h2 className="text-lg font-black text-slate-900 truncate">{simItem.name}</h2>
                </div>
                <button onClick={() => setSimItem(null)} className="p-2 rounded-xl hover:bg-slate-100 transition-all text-slate-400"><X size={20} /></button>
              </div>

              <div className="p-6 space-y-5">
                {/* Precio actual */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 rounded-2xl p-4">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Coste del plato</p>
                    <p className="text-2xl font-black text-rose-600">{fmtEur(simItem.total_cost)}</p>
                  </div>
                  <div className="bg-slate-50 rounded-2xl p-4">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Unidades vendidas</p>
                    <p className="text-2xl font-black text-slate-900">{simItem.units_sold}</p>
                  </div>
                </div>

                {/* Slider precio */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-500">Nuevo precio de carta</label>
                    <span className="text-2xl font-black text-indigo-600">{fmtEur(simPrice)}</span>
                  </div>
                  <input type="range"
                    min={simItem.total_cost * 1.1}
                    max={simItem.total_cost * 4}
                    step={0.5}
                    value={simPrice}
                    onChange={e => setSimPrice(parseFloat(e.target.value))}
                    className="w-full accent-indigo-600"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 font-medium">
                    <span>Min: {fmtEur(simItem.total_cost * 1.1)}</span>
                    <span>Actual: {fmtEur(prices[simItem.id] || simItem.sale_price)}</span>
                    <span>Max: {fmtEur(simItem.total_cost * 4)}</span>
                  </div>
                  {/* Input manual */}
                  <div className="flex items-center gap-2">
                    <input type="number" step="0.5" value={simPrice}
                      onChange={e => setSimPrice(parseFloat(e.target.value) || 0)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-300 text-right" />
                    <span className="text-slate-400 font-bold">€</span>
                  </div>
                </div>

                {/* Impacto simulado */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Margen', value: fmtPct(simMargin), color: simMargin >= 65 ? 'text-emerald-600' : simMargin >= 50 ? 'text-amber-600' : 'text-rose-600' },
                    { label: 'Beneficio total', value: fmtEur(simProfit), color: simProfit > currentProfit ? 'text-emerald-600' : 'text-rose-600' },
                    { label: 'Vs actual', value: `${simProfit > currentProfit ? '+' : ''}${fmtEur(simProfit - currentProfit)}`, color: simProfit > currentProfit ? 'text-emerald-600' : 'text-rose-600' },
                  ].map(s => (
                    <div key={s.label} className="bg-slate-50 rounded-2xl px-3 py-3 text-center">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{s.label}</p>
                      <p className={cn('font-black text-sm mt-0.5', s.color)}>{s.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-6 border-t border-slate-100 flex gap-3">
                <button onClick={() => setSimItem(null)}
                  className="flex-1 py-3 border border-slate-200 rounded-2xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all">
                  Cancelar
                </button>
                <button onClick={() => {
                  setPrices(p => ({ ...p, [simItem.id]: simPrice }));
                  setSimItem(null);
                  toast(`Precio de ${simItem.name} actualizado a ${fmtEur(simPrice)}`);
                }}
                  className="flex-1 py-3 bg-indigo-600 text-white rounded-2xl text-sm font-bold hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-200">
                  <Check size={16} /> Aplicar precio
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
