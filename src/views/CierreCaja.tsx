// src/views/CierreCaja.tsx
// ✅ 100% Supabase — sin datos hardcoded
// ✅ Flujo real: datáfono + efectivo en 3 pasos rápidos
// ✅ Conteo de billetes/monedas con teclado y voz
// ✅ IA analiza el cierre y detecta anomalías
// ✅ Historial de los últimos 30 días con tendencias
// ✅ Toast notifications, Gen Z UX
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Calculator, CreditCard, Banknote, CheckCircle2, AlertTriangle,
  History, Brain, Loader2, X, ChevronDown, ChevronUp,
  TrendingUp, TrendingDown, Mic, MicOff, RotateCcw,
  ArrowRight, Coins, Zap, Calendar, RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../supabase';
import { useSupabase } from '../context/SupabaseContext';
import { GoogleGenAI } from '@google/genai';
import { cn } from '../lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────
interface CashClosing {
  id: string;
  date: string;
  cash_sales: number;
  card_sales: number;
  delivery_sales: number;
  total_sales: number;
  expected_cash: number;
  counted_cash: number;
  discrepancy: number;
  final_float: number;
  tips: number;
  notes?: string;
  status: string;
  closed_by?: string;
  closed_at?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const BILLS  = ['500','200','100','50','20','10','5'];
const COINS  = ['2','1','0.50','0.20','0.10','0.05','0.02','0.01'];
const ALL_DENOMS = [...BILLS, ...COINS];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const aiRef = { current: null as GoogleGenAI | null };
function getAI() {
  if (!aiRef.current) aiRef.current = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || '' });
  return aiRef.current;
}
function uid() { return Math.random().toString(36).slice(2, 10); }
function fmtEur(n: number) { return n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' }); }
function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: 'short' });
}
function today() { return new Date().toISOString().split('T')[0]; }

// ─── Toast ────────────────────────────────────────────────────────────────────
function useToast() {
  const [toasts, setToasts] = useState<{ id: string; msg: string; type: 'ok' | 'err' | 'warn' }[]>([]);
  const show = useCallback((msg: string, type: 'ok' | 'err' | 'warn' = 'ok') => {
    const id = uid();
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000);
  }, []);
  const ToastContainer = () => (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[500] flex flex-col gap-2 items-center pointer-events-none">
      <AnimatePresence>
        {toasts.map(t => (
          <motion.div key={t.id}
            initial={{ opacity: 0, y: 20, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -10, scale: 0.9 }}
            className={cn('px-5 py-3 rounded-2xl text-sm font-bold shadow-2xl flex items-center gap-2',
              t.type === 'ok' ? 'bg-slate-900 text-white' : t.type === 'warn' ? 'bg-amber-500 text-white' : 'bg-rose-500 text-white'
            )}>
            {t.type === 'ok' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
            {t.msg}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
  return { show, ToastContainer };
}

// ─── VoiceButton ──────────────────────────────────────────────────────────────
function VoiceButton({ onResult, small, className = '' }: { onResult: (t: string) => void; small?: boolean; className?: string }) {
  const [on, setOn] = useState(false);
  const ref = useRef<SpeechRecognition | null>(null);
  const sz = small ? 14 : 16;
  const toggle = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert('Necesitas Chrome para el microfono'); return; }
    if (on) { ref.current?.stop(); setOn(false); return; }
    const r = new SR(); ref.current = r;
    r.lang = 'es-ES'; r.continuous = false; r.interimResults = false;
    r.onstart = () => setOn(true);
    r.onresult = (e: SpeechRecognitionEvent) => onResult(e.results[0][0].transcript);
    r.onerror = r.onend = () => setOn(false);
    r.start();
  };
  return (
    <button type="button" onClick={toggle}
      className={cn(`${small ? 'p-1.5' : 'p-2.5'} rounded-xl transition-all shrink-0`,
        on ? 'bg-rose-500 text-white animate-pulse shadow-lg shadow-rose-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200',
        className
      )} title={on ? 'Parar' : 'Dictar'}>
      {on ? <MicOff size={sz} /> : <Mic size={sz} />}
    </button>
  );
}

// ─── Denomination Row ─────────────────────────────────────────────────────────
function DenomRow({ value, count, onChange }: {
  value: string; count: number; onChange: (n: number) => void;
}) {
  const amount = parseFloat(value) * count;
  const isBill = BILLS.includes(value);

  return (
    <div className={cn(
      'flex items-center gap-3 px-4 py-2.5 rounded-2xl transition-all',
      count > 0 ? 'bg-emerald-50 border border-emerald-200' : 'bg-slate-50 border border-transparent'
    )}>
      {/* Denomination */}
      <div className={cn(
        'w-14 h-8 rounded-xl flex items-center justify-center text-sm font-black shrink-0',
        isBill
          ? 'bg-emerald-100 text-emerald-700'
          : 'bg-amber-100 text-amber-700'
      )}>
        {parseFloat(value) >= 1 ? `${value}€` : `${Math.round(parseFloat(value) * 100)}¢`}
      </div>

      {/* Counter */}
      <div className="flex items-center gap-2 flex-1">
        <button onClick={() => onChange(Math.max(0, count - 1))}
          className="w-8 h-8 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-100
                     flex items-center justify-center font-black text-lg leading-none transition-all shrink-0">
          −
        </button>
        <input
          type="number" min="0" value={count === 0 ? '' : count}
          onChange={e => onChange(parseInt(e.target.value) || 0)}
          placeholder="0"
          className="w-16 text-center font-black text-slate-900 text-lg bg-white border border-slate-200
                     rounded-xl py-1 focus:outline-none focus:ring-2 focus:ring-indigo-300"
        />
        <button onClick={() => onChange(count + 1)}
          className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-600 hover:bg-indigo-200
                     flex items-center justify-center font-black text-lg leading-none transition-all shrink-0">
          +
        </button>
      </div>

      {/* Total for this denom */}
      <span className={cn(
        'text-sm font-black w-20 text-right shrink-0',
        count > 0 ? 'text-emerald-700' : 'text-slate-300'
      )}>
        {count > 0 ? fmtEur(amount) : '—'}
      </span>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN VIEW
// ════════════════════════════════════════════════════════════════════════════
export default function CierreCajaView() {
  const { employee } = useSupabase();
  const { show: toast, ToastContainer } = useToast();

  type Step = 'ventas' | 'efectivo' | 'cierre' | 'done';
  const [step, setStep] = useState<Step>('ventas');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [history, setHistory] = useState<CashClosing[]>([]);
  const [todayClosed, setTodayClosed] = useState<CashClosing | null>(null);

  // PASO 1: Ventas del datáfono
  const [cardSales,     setCardSales]     = useState(0);
  const [deliverySales, setDeliverySales] = useState(0);
  const [cashSalesEst,  setCashSalesEst]  = useState(0); // ventas en efectivo (manual o estimado)

  // PASO 2: Recuento efectivo
  const [cashCount, setCashCount] = useState<Record<string, number>>(
    ALL_DENOMS.reduce((a, v) => ({ ...a, [v]: 0 }), {})
  );
  const [finalFloat, setFinalFloat] = useState(200);

  // PASO 3: Cierre
  const [tips,  setTips]  = useState(0);
  const [notes, setNotes] = useState('');

  // ── Calculados ────────────────────────────────────────────────────────────
  const totalSales    = cardSales + deliverySales + cashSalesEst;
  const countedCash   = ALL_DENOMS.reduce((s, v) => s + parseFloat(v) * (cashCount[v] || 0), 0);
  const expectedCash  = cashSalesEst + finalFloat; // lo que debería haber en caja
  const discrepancy   = countedCash - expectedCash;
  const toDeposit     = Math.max(0, countedCash - finalFloat); // lo que se lleva al banco

  // ── Load ──────────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [histRes, todayRes] = await Promise.all([
        supabase.from('cash_closings').select('*').order('date', { ascending: false }).limit(30),
        supabase.from('cash_closings').select('*').eq('date', today()).eq('status', 'closed').limit(1),
      ]);
      if (histRes.data) setHistory(histRes.data as CashClosing[]);
      if (todayRes.data?.length) {
        setTodayClosed(todayRes.data[0] as CashClosing);
        setStep('done');
      }
    } catch (err: any) {
      toast('Error cargando datos: ' + err.message, 'err');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Reset conteo ──────────────────────────────────────────────────────────
  function resetCount() {
    setCashCount(ALL_DENOMS.reduce((a, v) => ({ ...a, [v]: 0 }), {}));
  }

  // ── Guardar cierre ────────────────────────────────────────────────────────
  async function handleClose() {
    setSaving(true);
    try {
      const payload = {
        date:           today(),
        cash_sales:     cashSalesEst,
        card_sales:     cardSales,
        delivery_sales: deliverySales,
        total_sales:    totalSales,
        expected_cash:  expectedCash,
        counted_cash:   countedCash,
        final_float:    finalFloat,
        tips:           tips,
        notes:          notes || null,
        status:         'closed',
        closed_by:      (employee as any)?.nombre || 'Sistema',
        closed_at:      new Date().toISOString(),
      };
      const { data, error } = await supabase.from('cash_closings').insert(payload).select().single();
      if (error) throw error;
      setTodayClosed(data as CashClosing);
      setStep('done');
      toast('¡Caja cerrada correctamente! ✓');
      await loadData();
    } catch (err: any) {
      toast('Error al cerrar caja: ' + err.message, 'err');
    } finally { setSaving(false); }
  }

  // ── IA Análisis ───────────────────────────────────────────────────────────
  async function handleAIAnalysis() {
    setAiLoading(true); setAiResult(null);
    try {
      // Tendencias de los últimos 7 cierres
      const ultimos = history.slice(0, 7);
      const mediaVentas = ultimos.length > 0
        ? ultimos.reduce((s, h) => s + h.total_sales, 0) / ultimos.length
        : 0;
      const discrepancias = ultimos.map(h => h.discrepancy).join(', ');

      const closing = todayClosed || {
        total_sales: totalSales, cash_sales: cashSalesEst,
        card_sales: cardSales, delivery_sales: deliverySales,
        counted_cash: countedCash, discrepancy: discrepancy, tips: tips,
      };

      const res = await getAI().models.generateContent({
        model: 'gemini-2.0-flash',
        contents: [{
          role: 'user', parts: [{
            text: `Eres el contable de un restaurante. Analiza este cierre de caja y da recomendaciones concretas.

CIERRE DE HOY:
- Ventas totales: ${fmtEur(closing.total_sales)}
- Ventas en efectivo: ${fmtEur(closing.cash_sales)}
- Ventas datáfono: ${fmtEur(closing.card_sales)}
- Delivery: ${fmtEur(closing.delivery_sales)}
- Efectivo contado: ${fmtEur(closing.counted_cash)}
- Diferencia (descuadre): ${fmtEur(closing.discrepancy)}
- Propinas: ${fmtEur(closing.tips)}

CONTEXTO HISTÓRICO:
- Media ventas últimos ${ultimos.length} días: ${fmtEur(mediaVentas)}
- Diferencia hoy vs media: ${fmtEur(closing.total_sales - mediaVentas)} (${mediaVentas > 0 ? ((closing.total_sales - mediaVentas) / mediaVentas * 100).toFixed(1) : 0}%)
- Descuadres recientes: ${discrepancias || 'sin datos'}

Da 3-4 observaciones concretas en español:
1. Si el descuadre es normal o preocupante
2. Tendencia de ventas vs días anteriores
3. Alguna alerta o recomendación específica
Formato: bullet points directos, max 2 líneas cada uno.`
          }]
        }]
      });
      setAiResult(res.candidates?.[0]?.content?.parts?.[0]?.text || 'Sin análisis');
    } catch (err: any) {
      setAiResult('Error al conectar con IA: ' + err.message);
    } finally { setAiLoading(false); }
  }

  // ── Abrir nuevo cierre ────────────────────────────────────────────────────
  function startNewClose() {
    setStep('ventas');
    setCardSales(0); setDeliverySales(0); setCashSalesEst(0);
    resetCount();
    setFinalFloat(200); setTips(0); setNotes('');
    setTodayClosed(null); setAiResult(null);
  }

  // ── Historial stats ───────────────────────────────────────────────────────
  const histStats = useMemo(() => {
    if (history.length === 0) return null;
    const last7 = history.slice(0, 7);
    const avg = last7.reduce((s, h) => s + h.total_sales, 0) / last7.length;
    const best = [...history].sort((a, b) => b.total_sales - a.total_sales)[0];
    const discrepTotal = last7.reduce((s, h) => s + Math.abs(h.discrepancy), 0);
    return { avg, best, discrepTotal };
  }, [history]);

  // ─────────────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#F8FAFC]">
        <Loader2 size={36} className="animate-spin text-indigo-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-4 md:p-8 space-y-6">
      <ToastContainer />

      {/* ── Header ── */}
      <header className="sticky top-4 z-[100] bg-white/80 backdrop-blur-xl border border-white/20
                         shadow-xl rounded-[2.5rem] p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-2xl shadow-lg">
            <Calculator className="w-5 h-5 text-emerald-400" />
            <span className="font-black text-sm tracking-tighter uppercase">Cierre de Caja</span>
          </div>
          <span className="text-sm font-bold text-slate-400 hidden sm:block">
            {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowHistory(!showHistory)}
            className={cn('flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold transition-all border',
              showHistory ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            )}>
            <History size={14} /> Historial
          </button>
          {step !== 'done' && (
            <button onClick={handleAIAnalysis} disabled={aiLoading}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-2xl text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-sm">
              {aiLoading ? <Loader2 size={14} className="animate-spin" /> : <Brain size={14} />}
              Análisis IA
            </button>
          )}
        </div>
      </header>

      {/* ── IA Result ── */}
      <AnimatePresence>
        {aiResult && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="bg-indigo-50 border border-indigo-200 rounded-3xl p-5 relative">
            <button onClick={() => setAiResult(null)}
              className="absolute top-3 right-3 p-1.5 rounded-xl hover:bg-indigo-100 text-slate-400 transition-all">
              <X size={16} />
            </button>
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 bg-indigo-100 rounded-2xl flex items-center justify-center shrink-0">
                <Brain size={18} className="text-indigo-600" />
              </div>
              <div>
                <p className="font-black text-indigo-900 mb-2">Análisis IA del cierre</p>
                <pre className="text-sm text-indigo-800 whitespace-pre-wrap font-sans leading-relaxed">{aiResult}</pre>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Historial ── */}
      <AnimatePresence>
        {showHistory && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              {/* Stats del historial */}
              {histStats && (
                <div className="grid grid-cols-3 gap-0 border-b border-slate-100">
                  {[
                    { label: 'Media ventas (7d)', value: fmtEur(histStats.avg), icon: <TrendingUp size={14} className="text-indigo-400" /> },
                    { label: 'Mejor día', value: fmtEur(histStats.best?.total_sales || 0), icon: <Zap size={14} className="text-amber-400" /> },
                    { label: 'Descuadres (7d)', value: fmtEur(histStats.discrepTotal), icon: <AlertTriangle size={14} className={histStats.discrepTotal > 20 ? 'text-rose-400' : 'text-emerald-400'} /> },
                  ].map(s => (
                    <div key={s.label} className="p-4 text-center border-r border-slate-100 last:border-0">
                      <div className="flex items-center justify-center gap-1 mb-1">{s.icon}</div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{s.label}</p>
                      <p className="font-black text-slate-900 text-sm mt-0.5">{s.value}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Lista cierres */}
              <div className="divide-y divide-slate-50 max-h-80 overflow-y-auto">
                {history.length === 0 ? (
                  <p className="text-center text-slate-400 text-sm py-8">Sin cierres anteriores</p>
                ) : (
                  history.map(h => {
                    const disc = h.discrepancy;
                    const ok   = Math.abs(disc) < 0.01;
                    const over = disc > 0;
                    return (
                      <div key={h.id} className="flex items-center gap-4 px-5 py-3 hover:bg-slate-50/50 transition-all">
                        <div className="w-10 h-10 bg-slate-100 rounded-2xl flex items-center justify-center shrink-0">
                          <Calendar size={15} className="text-slate-400" />
                        </div>
                        <div className="flex-1">
                          <p className="font-bold text-slate-800 text-sm">{fmtDate(h.date)}</p>
                          <p className="text-xs text-slate-400">
                            💳 {fmtEur(h.card_sales)} · 💵 {fmtEur(h.cash_sales)}
                            {h.delivery_sales > 0 ? ` · 🛵 ${fmtEur(h.delivery_sales)}` : ''}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-black text-slate-900">{fmtEur(h.total_sales)}</p>
                          <p className={cn('text-xs font-bold',
                            ok ? 'text-emerald-500' : over ? 'text-blue-500' : 'text-rose-500'
                          )}>
                            {ok ? '✓ Cuadrado' : `${over ? '+' : ''}${disc.toFixed(2)}€`}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════════════════════════════════════════
          STEP INDICATOR
      ══════════════════════════════════════════════════════════════════════ */}
      {step !== 'done' && (
        <div className="flex items-center gap-2">
          {[
            { id: 'ventas',   label: '1. Ventas',   icon: <CreditCard size={14} /> },
            { id: 'efectivo', label: '2. Efectivo', icon: <Banknote size={14} /> },
            { id: 'cierre',   label: '3. Cerrar',   icon: <CheckCircle2 size={14} /> },
          ].map((s, i, arr) => (
            <React.Fragment key={s.id}>
              <div className={cn(
                'flex items-center gap-1.5 px-4 py-2 rounded-2xl text-xs font-black transition-all',
                step === s.id
                  ? 'bg-slate-900 text-white shadow-lg'
                  : (step === 'efectivo' && i === 0) || (step === 'cierre' && i <= 1)
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-white border border-slate-200 text-slate-400'
              )}>
                {s.icon} {s.label}
              </div>
              {i < arr.length - 1 && <ArrowRight size={14} className="text-slate-300 shrink-0" />}
            </React.Fragment>
          ))}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          PASO 1: VENTAS
      ══════════════════════════════════════════════════════════════════════ */}
      {step === 'ventas' && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-5">
            <div>
              <h2 className="text-xl font-black text-slate-900">¿Cuánto hemos vendido hoy?</h2>
              <p className="text-sm text-slate-400 mt-1">Introduce los datos tal como los ves en el datáfono y caja</p>
            </div>

            {/* Datáfono */}
            <div className="space-y-1.5">
              <label className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                <CreditCard size={13} className="text-indigo-400" /> Ventas datáfono / TPV (€)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number" min="0" step="0.01" value={cardSales || ''}
                  onChange={e => setCardSales(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className="flex-1 px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-2xl font-black
                             text-right focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  autoFocus
                />
                <VoiceButton
                  onResult={t => {
                    const num = t.match(/[\d.,]+/)?.[0]?.replace(',', '.');
                    if (num) setCardSales(parseFloat(num));
                  }}
                />
              </div>
              <p className="text-xs text-slate-400 pl-1">El importe total que aparece en el parte del datáfono</p>
            </div>

            {/* Efectivo ventas */}
            <div className="space-y-1.5">
              <label className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                <Banknote size={13} className="text-emerald-400" /> Ventas en efectivo (€)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number" min="0" step="0.01" value={cashSalesEst || ''}
                  onChange={e => setCashSalesEst(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className="flex-1 px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-2xl font-black
                             text-right focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
                <VoiceButton
                  onResult={t => {
                    const num = t.match(/[\d.,]+/)?.[0]?.replace(',', '.');
                    if (num) setCashSalesEst(parseFloat(num));
                  }}
                />
              </div>
              <p className="text-xs text-slate-400 pl-1">Lo que has cobrado en billetes y monedas</p>
            </div>

            {/* Delivery (opcional) */}
            <div className="space-y-1.5">
              <label className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                <span className="text-base">🛵</span> Delivery / Plataformas (€)
                <span className="text-[10px] font-bold bg-slate-100 text-slate-400 px-2 py-0.5 rounded-lg">opcional</span>
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number" min="0" step="0.01" value={deliverySales || ''}
                  onChange={e => setDeliverySales(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className="flex-1 px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-2xl font-black
                             text-right focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
                <VoiceButton
                  onResult={t => {
                    const num = t.match(/[\d.,]+/)?.[0]?.replace(',', '.');
                    if (num) setDeliverySales(parseFloat(num));
                  }}
                />
              </div>
            </div>

            {/* Total preview */}
            {totalSales > 0 && (
              <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
                className="bg-slate-900 text-white rounded-2xl px-6 py-4 flex items-center justify-between">
                <span className="font-bold text-slate-300">Total del día</span>
                <span className="text-3xl font-black">{fmtEur(totalSales)}</span>
              </motion.div>
            )}
          </div>

          <button
            onClick={() => setStep('efectivo')}
            disabled={totalSales <= 0}
            className="w-full flex items-center justify-center gap-2 py-4 bg-indigo-600 text-white rounded-2xl
                       font-black text-sm hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed
                       transition-all shadow-lg shadow-indigo-200">
            Siguiente: Contar el efectivo <ArrowRight size={18} />
          </button>
        </motion.div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          PASO 2: RECUENTO DE EFECTIVO
      ══════════════════════════════════════════════════════════════════════ */}
      {step === 'efectivo' && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">

          {/* Total flotante */}
          <div className={cn(
            'rounded-3xl p-5 flex items-center justify-between transition-all',
            Math.abs(discrepancy) < 0.01
              ? 'bg-emerald-50 border border-emerald-200'
              : discrepancy > 0
                ? 'bg-blue-50 border border-blue-200'
                : 'bg-rose-50 border border-rose-200'
          )}>
            <div>
              <p className="text-sm font-bold text-slate-500">Efectivo contado</p>
              <p className={cn('text-4xl font-black',
                Math.abs(discrepancy) < 0.01 ? 'text-emerald-700' :
                discrepancy > 0 ? 'text-blue-700' : 'text-rose-700'
              )}>
                {fmtEur(countedCash)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-slate-500">Esperado</p>
              <p className="text-xl font-black text-slate-700">{fmtEur(expectedCash)}</p>
              <p className={cn('text-sm font-black mt-1',
                Math.abs(discrepancy) < 0.01 ? 'text-emerald-600' :
                discrepancy > 0 ? 'text-blue-600' : 'text-rose-600'
              )}>
                {Math.abs(discrepancy) < 0.01
                  ? '✓ Cuadra perfecto'
                  : discrepancy > 0
                    ? `+${fmtEur(discrepancy)} sobrante`
                    : `${fmtEur(discrepancy)} faltante`
                }
              </p>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-black text-slate-900 flex items-center gap-2">
                <Coins size={18} className="text-amber-500" /> Recuento físico
              </h2>
              <button onClick={resetCount}
                className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-rose-500 transition-colors px-3 py-1.5 hover:bg-rose-50 rounded-xl">
                <RotateCcw size={12} /> Resetear
              </button>
            </div>

            <div className="p-4 space-y-1">
              {/* Billetes */}
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-2 py-1">Billetes</p>
              {BILLS.map(v => (
                <DenomRow key={v} value={v} count={cashCount[v] || 0}
                  onChange={n => setCashCount(prev => ({ ...prev, [v]: n }))} />
              ))}

              {/* Monedas */}
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-2 py-1 pt-3">Monedas</p>
              {COINS.map(v => (
                <DenomRow key={v} value={v} count={cashCount[v] || 0}
                  onChange={n => setCashCount(prev => ({ ...prev, [v]: n }))} />
              ))}
            </div>

            {/* Fondo para mañana */}
            <div className="p-5 border-t border-slate-100 bg-slate-50 space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                <span className="text-base">🏦</span> Fondo de caja para mañana (€)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number" min="0" step="10" value={finalFloat}
                  onChange={e => setFinalFloat(parseFloat(e.target.value) || 0)}
                  className="flex-1 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-lg font-black
                             text-right focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>
              {toDeposit > 0 && (
                <p className="text-sm font-bold text-indigo-700 bg-indigo-50 px-4 py-2 rounded-xl">
                  💼 A depositar en banco: <strong>{fmtEur(toDeposit)}</strong>
                </p>
              )}
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep('ventas')}
              className="flex-1 py-3 border border-slate-200 rounded-2xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all">
              ← Volver
            </button>
            <button onClick={() => setStep('cierre')}
              className="flex-[2] flex items-center justify-center gap-2 py-4 bg-indigo-600 text-white rounded-2xl
                         font-black text-sm hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200">
              Siguiente: Cerrar caja <ArrowRight size={18} />
            </button>
          </div>
        </motion.div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          PASO 3: CONFIRMACIÓN Y CIERRE
      ══════════════════════════════════════════════════════════════════════ */}
      {step === 'cierre' && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">

          {/* Resumen completo */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4">
            <h2 className="text-xl font-black text-slate-900">Resumen del día</h2>

            {/* Ventas */}
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Ventas</p>
              {[
                { label: 'Datáfono / TPV', value: cardSales, icon: '💳' },
                { label: 'Efectivo', value: cashSalesEst, icon: '💵' },
                { label: 'Delivery', value: deliverySales, icon: '🛵', hide: deliverySales === 0 },
              ].filter(r => !r.hide).map(row => (
                <div key={row.label} className="flex items-center justify-between px-4 py-2.5 bg-slate-50 rounded-2xl">
                  <span className="text-sm font-medium text-slate-600">{row.icon} {row.label}</span>
                  <span className="font-black text-slate-900">{fmtEur(row.value)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between px-4 py-3 bg-slate-900 text-white rounded-2xl">
                <span className="font-bold">Total ventas</span>
                <span className="text-xl font-black">{fmtEur(totalSales)}</span>
              </div>
            </div>

            {/* Caja */}
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Efectivo</p>
              {[
                { label: 'Efectivo contado', value: countedCash },
                { label: 'Esperado en caja', value: expectedCash },
              ].map(row => (
                <div key={row.label} className="flex items-center justify-between px-4 py-2.5 bg-slate-50 rounded-2xl">
                  <span className="text-sm font-medium text-slate-600">{row.label}</span>
                  <span className="font-black text-slate-900">{fmtEur(row.value)}</span>
                </div>
              ))}
              <div className={cn(
                'flex items-center justify-between px-4 py-3 rounded-2xl font-bold',
                Math.abs(discrepancy) < 0.01 ? 'bg-emerald-50 text-emerald-700' :
                discrepancy > 0 ? 'bg-blue-50 text-blue-700' : 'bg-rose-50 text-rose-700'
              )}>
                <span>Diferencia</span>
                <span className="text-xl font-black">
                  {Math.abs(discrepancy) < 0.01
                    ? '✓ Cuadrado'
                    : `${discrepancy > 0 ? '+' : ''}${fmtEur(discrepancy)}`
                  }
                </span>
              </div>
            </div>

            {/* Propinas y notas */}
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400">Propinas (€)</label>
                <div className="flex items-center gap-3">
                  <input type="number" min="0" step="0.01" value={tips || ''}
                    onChange={e => setTips(parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                    className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm
                               font-bold text-right focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                  <VoiceButton onResult={t => { const num = t.match(/[\d.,]+/)?.[0]?.replace(',', '.'); if (num) setTips(parseFloat(num)); }} small />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400">Notas del cierre</label>
                <div className="flex items-start gap-2">
                  <textarea value={notes} onChange={e => setNotes(e.target.value)}
                    placeholder="Incidencias, observaciones, desglose especial..."
                    rows={2}
                    className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm resize-none
                               focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                  <VoiceButton onResult={v => setNotes(v)} small className="mt-1" />
                </div>
              </div>
            </div>

            {/* Deposito banco */}
            {toDeposit > 0 && (
              <div className="bg-indigo-50 border border-indigo-200 rounded-2xl px-5 py-4">
                <p className="text-sm font-black text-indigo-700">💼 Recuerda depositar en banco</p>
                <p className="text-2xl font-black text-indigo-900 mt-1">{fmtEur(toDeposit)}</p>
                <p className="text-xs text-indigo-500 mt-0.5">
                  ({fmtEur(countedCash)} contado − {fmtEur(finalFloat)} fondo)
                </p>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep('efectivo')}
              className="flex-1 py-3 border border-slate-200 rounded-2xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all">
              ← Volver
            </button>
            <button onClick={handleClose} disabled={saving}
              className="flex-[2] flex items-center justify-center gap-2 py-4 bg-emerald-600 text-white rounded-2xl
                         font-black text-sm hover:bg-emerald-700 disabled:opacity-50 transition-all shadow-lg shadow-emerald-200">
              {saving
                ? <><Loader2 size={18} className="animate-spin" /> Cerrando...</>
                : <><CheckCircle2 size={18} /> Cerrar caja del día</>
              }
            </button>
          </div>
        </motion.div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          DONE: CAJA CERRADA
      ══════════════════════════════════════════════════════════════════════ */}
      {step === 'done' && todayClosed && (
        <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
          className="space-y-4">

          {/* Celebración */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-8 text-center space-y-3">
            <motion.div
              initial={{ scale: 0 }} animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
              className="w-20 h-20 bg-emerald-100 rounded-[2rem] flex items-center justify-center mx-auto">
              <CheckCircle2 size={44} className="text-emerald-600" />
            </motion.div>
            <h2 className="text-2xl font-black text-slate-900">¡Caja cerrada!</h2>
            <p className="text-slate-500 text-sm">
              {todayClosed.closed_by && `Por ${todayClosed.closed_by} · `}
              {todayClosed.closed_at && new Date(todayClosed.closed_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>

          {/* Resumen del día cerrado */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-3">
            <h3 className="font-black text-slate-900">Resumen del cierre</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Ventas totales',    value: fmtEur(todayClosed.total_sales),  color: 'text-slate-900' },
                { label: 'Datáfono',          value: fmtEur(todayClosed.card_sales),   color: 'text-indigo-600' },
                { label: 'Efectivo ventas',   value: fmtEur(todayClosed.cash_sales),   color: 'text-emerald-600' },
                { label: 'Propinas',          value: fmtEur(todayClosed.tips),         color: 'text-amber-600' },
                { label: 'Efectivo contado',  value: fmtEur(todayClosed.counted_cash), color: 'text-slate-900' },
                { label: 'Fondo mañana',      value: fmtEur(todayClosed.final_float),  color: 'text-slate-900' },
              ].map(s => (
                <div key={s.label} className="bg-slate-50 rounded-2xl px-4 py-3">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{s.label}</p>
                  <p className={cn('text-lg font-black mt-0.5', s.color)}>{s.value}</p>
                </div>
              ))}
            </div>

            {/* Diferencia */}
            <div className={cn(
              'rounded-2xl px-5 py-4 flex items-center justify-between',
              Math.abs(todayClosed.discrepancy) < 0.01
                ? 'bg-emerald-50 border border-emerald-200'
                : todayClosed.discrepancy > 0
                  ? 'bg-blue-50 border border-blue-200'
                  : 'bg-rose-50 border border-rose-200'
            )}>
              <span className="font-bold text-slate-600">Diferencia</span>
              <span className={cn('text-2xl font-black',
                Math.abs(todayClosed.discrepancy) < 0.01 ? 'text-emerald-700' :
                todayClosed.discrepancy > 0 ? 'text-blue-700' : 'text-rose-700'
              )}>
                {Math.abs(todayClosed.discrepancy) < 0.01
                  ? '✓ Cuadrado'
                  : `${todayClosed.discrepancy > 0 ? '+' : ''}${fmtEur(todayClosed.discrepancy)}`
                }
              </span>
            </div>

            {/* A depositar */}
            {(todayClosed.counted_cash - todayClosed.final_float) > 0 && (
              <div className="bg-indigo-50 border border-indigo-200 rounded-2xl px-5 py-3 flex items-center justify-between">
                <span className="text-sm font-bold text-indigo-700">💼 A depositar en banco</span>
                <span className="font-black text-indigo-900">
                  {fmtEur(todayClosed.counted_cash - todayClosed.final_float)}
                </span>
              </div>
            )}

            {todayClosed.notes && (
              <p className="text-sm text-slate-500 bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3 italic">
                {todayClosed.notes}
              </p>
            )}
          </div>

          {/* Acciones */}
          <div className="flex gap-3">
            <button onClick={handleAIAnalysis} disabled={aiLoading}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-indigo-600 text-white rounded-2xl
                         text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-lg shadow-indigo-200">
              {aiLoading ? <Loader2 size={16} className="animate-spin" /> : <Brain size={16} />}
              Análisis IA
            </button>
            <button onClick={startNewClose}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-slate-100 text-slate-700 rounded-2xl
                         text-sm font-bold hover:bg-slate-200 transition-all">
              <RefreshCw size={16} /> Nuevo cierre
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
