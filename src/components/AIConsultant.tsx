// src/components/AIConsultant.tsx
// Director de Operaciones IA — adaptado de Arume Pro a Raco Blanquerna.
// Chat multi-turn que inyecta datos vivos del restaurante (ventas, stock,
// facturas pendientes, etc.) en el system prompt cada vez que envías.
//
// Usa el motor multi-proveedor src/services/aiProviders.ts (Claude →
// Cerebras → DeepSeek → Groq → Mistral → Gemini con fallback automático).

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Send, Bot, User, Sparkles, Loader2, AlertTriangle, Eraser,
  TrendingUp, Package, Receipt, Wallet, Copy, Check, X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../supabase';
import { cn } from '../lib/utils';
import { askAI, getActiveChatProvider, type ChatMessage } from '../services/aiProviders';

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface QuickAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  prompt: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  { id: 'rentabilidad', label: 'Rentabilidad mes', icon: <TrendingUp size={14} />, prompt: 'Resume la rentabilidad del mes en curso: ingresos, gastos, beneficio neto y % margen. Compara con lo que es razonable para un restaurante.' },
  { id: 'stock-critico', label: 'Stock crítico',     icon: <Package size={14} />,    prompt: 'Lista los productos con stock bajo mínimos y sugiere a qué proveedor pedir cada uno (basándote en proveedores activos).' },
  { id: 'facturas',     label: 'Facturas pendientes', icon: <Receipt size={14} />,   prompt: 'Listado de facturas de proveedor pendientes de pago, ordenadas por fecha de vencimiento más cercana. Indica cuáles están ya vencidas.' },
  { id: 'tesoreria',    label: 'Salud tesorería',     icon: <Wallet size={14} />,    prompt: 'Diagnóstico de tesorería: saldo bancario actual, ingresos/gastos del mes, qué facturas tengo que cobrar y pagar pronto, y predicción de tesorería para los próximos 15 días.' },
];

const INITIAL_MESSAGE: Message = {
  role: 'assistant',
  content: `¡Hola, Agnès! Soy el **Director de Operaciones IA** del Raco Blanquerna.\n\nTengo acceso en tiempo real a:\n- 🍷 Ventas y cierres de caja\n- 📦 Stock e inventario\n- 🧾 Facturas (cobrar y pagar)\n- 👥 Personal y horarios\n- 💸 Tesorería y movimientos bancarios\n\nPulsa una **acción rápida** abajo o pregúntame lo que necesites.`,
  timestamp: new Date(),
};

// ─── Helper: formato monetario y fecha ────────────────────────────────────────
const fmtEur = (n: number) => (n || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
const todayISO = () => new Date().toISOString().split('T')[0];
const monthStart = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
};
const monthEnd = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0];
};

// ─── Carga datos vivos del restaurante para inyectarlos al system prompt ──────
async function loadLiveContext() {
  const mS = monthStart();
  const mE = monthEnd();

  const [
    cierresR,         // cash_closings del mes
    cashEntriesR,     // movimientos caja
    customerInvR,     // facturas clientes pendientes
    supplierInvR,     // facturas proveedor pendientes
    stockR,           // items con stock bajo mínimo
    bankR,            // saldo bancario
    suppliersR,       // proveedores activos
    employeesR,       // personal activo
    deliveryNotesR,   // albaranes recientes
  ] = await Promise.all([
    supabase.from('cash_closings').select('date,total_sales,cash_sales,card_sales,delivery_sales,discrepancy,tips').gte('date', mS).lte('date', mE),
    supabase.from('cash_entries').select('date,type,category,amount').gte('date', mS).lte('date', mE),
    supabase.from('customer_invoices').select('id,number,date,due_date,client_name,total,status').in('status', ['Pendiente','Vencida']),
    supabase.from('facturas').select('id,num,fecha,fecha_venc,proveedor,total,pagada,estado').eq('tipo','compra').eq('pagada', false),
    supabase.from('stock_items').select('name,category,unit,current_stock,min_stock,price_per_unit,supplier_id').eq('active', true).filter('current_stock', 'lte', 'min_stock'),
    supabase.from('bank_accounts').select('name,balance').limit(10),
    supabase.from('suppliers').select('id,nombre,categoria').eq('activo', true),
    supabase.from('employees').select('nombre,rol,activo').eq('activo', true),
    supabase.from('delivery_notes').select('fecha,total,supplier_name').gte('fecha', mS).lte('fecha', mE).order('fecha', { ascending: false }).limit(20),
  ]);

  const cierres        = cierresR.data || [];
  const cashEntries    = cashEntriesR.data || [];
  const customerInv    = customerInvR.data || [];
  const supplierInv    = supplierInvR.data || [];
  const stock          = stockR.data || [];
  const bank           = bankR.data || [];
  const suppliers      = suppliersR.data || [];
  const employees      = employeesR.data || [];
  const deliveryNotes  = deliveryNotesR.data || [];

  const ventasMes      = cierres.reduce((s, c) => s + Number(c.total_sales || 0), 0);
  const propinasMes    = cierres.reduce((s, c) => s + Number(c.tips || 0), 0);
  const descuadres     = cierres.reduce((s, c) => s + Math.abs(Number(c.discrepancy || 0)), 0);
  const ingresosCaja   = cashEntries.filter(e => e.type === 'Ingreso').reduce((s, e) => s + Number(e.amount || 0), 0);
  const gastosCaja     = cashEntries.filter(e => e.type === 'Gasto').reduce((s, e) => s + Number(e.amount || 0), 0);
  const comprasMes     = deliveryNotes.reduce((s, a) => s + Number(a.total || 0), 0);
  const saldoBanco     = bank.reduce((s, b) => s + Number(b.balance || 0), 0);
  const facturasCobrar = customerInv.reduce((s, f) => s + Number(f.total || 0), 0);
  const facturasPagar  = supplierInv.reduce((s, f) => s + Number(f.total || 0), 0);

  // Facturas vencidas
  const hoy = new Date();
  const facturasVencidasCobrar = customerInv.filter(f => f.due_date && new Date(f.due_date) < hoy);
  const facturasVencidasPagar  = supplierInv.filter(f => f.fecha_venc && new Date(f.fecha_venc) < hoy);

  return {
    mes: `${hoy.getMonth() + 1}/${hoy.getFullYear()}`,
    ventas: {
      total_mes:           ventasMes,
      n_dias_cerrados:     cierres.length,
      propinas_mes:        propinasMes,
      descuadres_mes_abs:  descuadres,
      compras_proveedores: comprasMes,
      ingresos_caja_extra: ingresosCaja,
      gastos_caja:         gastosCaja,
      beneficio_aprox:     ventasMes - comprasMes - gastosCaja,
    },
    tesoreria: {
      saldo_bancario_actual:   saldoBanco,
      total_a_cobrar:          facturasCobrar,
      total_a_pagar:           facturasPagar,
      facturas_vencidas_cobro: facturasVencidasCobrar.length,
      facturas_vencidas_pago:  facturasVencidasPagar.length,
    },
    stock_critico: stock.slice(0, 25).map(s => ({
      nombre:   s.name,
      cat:      s.category,
      stock:    s.current_stock,
      min:      s.min_stock,
      unidad:   s.unit,
      proveedor_id: s.supplier_id,
    })),
    facturas_pendientes_cobro: customerInv.slice(0, 15).map(f => ({
      num: f.number, fecha: f.date, vence: f.due_date, cliente: f.client_name, total: Number(f.total), estado: f.status,
    })),
    facturas_pendientes_pago: supplierInv.slice(0, 15).map(f => ({
      num: f.num, fecha: f.fecha, vence: f.fecha_venc, proveedor: f.proveedor, total: Number(f.total),
    })),
    proveedores_activos: suppliers.length,
    personal_activo:     employees.length,
    proveedores_lista:   suppliers.slice(0, 30).map(s => ({ id: s.id, nombre: s.nombre, cat: s.categoria })),
  };
}

// ─── System prompt — Director de Operaciones de Raco Blanquerna ───────────────
function buildSystemPrompt(live: Awaited<ReturnType<typeof loadLiveContext>>): string {
  return `Eres el Director de Operaciones y Asesor Financiero del restaurante "Raco Blanquerna" (Palma de Mallorca).
Tu rol: ayudar a la dueña (Agnès) a tomar decisiones operativas y económicas usando datos REALES.

Conoces metodologías de gestión hostelera:
- Mise en Place (organización cocina)
- Ingeniería de menú BCG (Estrella / Vaca / Puzzle / Perro)
- Control de food cost (target ≤ 30%)
- Control de staff cost (target ≤ 30%)
- Break-even mensual y previsión de tesorería

DATOS REALES DEL MES ACTUAL (precalculados, NO los inventes):
${JSON.stringify(live, null, 2)}

Instrucciones:
- Responde en español, profesional pero cercano.
- Usa **tablas Markdown** para desgloses numéricos.
- Si los datos están a 0, indica que quizás no se han registrado todavía y sugiere dónde meterlos en la app.
- Nunca inventes cifras. Si no tienes datos suficientes, dilo claramente.
- Para sugerencias operativas, sé concreto y accionable (no consejos genéricos).
- Si te piden "qué hacer", da prioridad clara: 1º crítico, 2º importante, 3º opcional.`;
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function AIConsultant({ onClose }: { onClose?: () => void }) {
  const [messages,  setMessages]  = useState<Message[]>([INITIAL_MESSAGE]);
  const [input,     setInput]     = useState('');
  const [loading,   setLoading]   = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [liveCache, setLiveCache] = useState<Awaited<ReturnType<typeof loadLiveContext>> | null>(null);

  const provider = useMemo(() => getActiveChatProvider(), []);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  const handleClear = () => {
    if (!window.confirm('¿Borrar la conversación?')) return;
    setMessages([INITIAL_MESSAGE]);
  };

  const handleCopy = useCallback((content: string, idx: number) => {
    navigator.clipboard.writeText(content).then(() => {
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 1500);
    });
  }, []);

  const handleSend = useCallback(async (text: string = input) => {
    const trimmed = text.trim();
    if (!trimmed || loading || !provider) return;

    const userMsg: Message = { role: 'user', content: trimmed, timestamp: new Date() };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput('');
    setLoading(true);

    try {
      // Reaprovecha el contexto cacheado si lo tenemos (de la última llamada)
      // pero refresca cada 60s para no enviar datos viejos.
      let live = liveCache;
      if (!live) {
        live = await loadLiveContext();
        setLiveCache(live);
        setTimeout(() => setLiveCache(null), 60_000);
      }

      const systemPrompt = buildSystemPrompt(live);
      const history: ChatMessage[] = updated
        .filter(m => m.content !== INITIAL_MESSAGE.content)
        .map(m => ({ role: m.role, content: m.content }));

      const result = await askAI(history, systemPrompt);
      const reply  = result.text || 'Lo siento, no he podido procesar el análisis.';
      const footer = `\n\n_— ${result.provider} (${result.model})_`;

      setMessages(prev => [...prev, { role: 'assistant', content: reply + footer, timestamp: new Date() }]);
    } catch (err: any) {
      let msg = '⚠️ Error al conectar con la IA.';
      if (err?.message?.includes('Todos los proveedores'))   msg = '⚠️ No hay ningún proveedor de IA configurado. Ve a Ajustes → IA.';
      else if (err?.message?.includes('API_KEY'))            msg = '⚠️ Alguna clave API no es válida. Revísala en Ajustes.';
      else if (err?.message?.includes('quota'))              msg = '⚠️ Límite de cuota alcanzado. Espera unos minutos o configura otro proveedor.';
      else if (err?.message)                                 msg = '⚠️ ' + err.message;
      setMessages(prev => [...prev, { role: 'assistant', content: msg, timestamp: new Date() }]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, provider, messages, liveCache]);

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-gradient-to-br from-indigo-50 to-violet-50">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-md shadow-indigo-200">
            <Sparkles size={18} className="text-white" />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-900">Director IA</h3>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
              {provider ? `${provider} activo` : 'sin proveedor IA'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={handleClear} title="Limpiar" className="p-2 rounded-xl hover:bg-white/60 text-slate-500 transition-all">
            <Eraser size={16} />
          </button>
          {onClose && (
            <button onClick={onClose} title="Cerrar" className="p-2 rounded-xl hover:bg-white/60 text-slate-500 transition-all">
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Sin clave configurada */}
      {!provider && (
        <div className="m-4 p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900 text-sm">
          <div className="flex items-start gap-2">
            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">No hay proveedor de IA configurado</p>
              <p className="text-xs mt-1">
                Añade tu clave de Anthropic Claude (recomendado) o Gemini en{' '}
                <strong>Ajustes → IA</strong>. Una vez configurada, el chat se activará.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Mensajes */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        <AnimatePresence initial={false}>
          {messages.map((m, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn('flex gap-2', m.role === 'user' ? 'justify-end' : 'justify-start')}
            >
              {m.role === 'assistant' && (
                <div className="w-7 h-7 bg-indigo-600 rounded-xl flex items-center justify-center shrink-0">
                  <Bot size={14} className="text-white" />
                </div>
              )}
              <div className={cn(
                'max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm relative group',
                m.role === 'user'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-900'
              )}>
                <div className="whitespace-pre-wrap break-words leading-relaxed">{m.content}</div>
                {m.role === 'assistant' && (
                  <button
                    onClick={() => handleCopy(m.content, idx)}
                    className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-lg bg-white border border-slate-200 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-slate-500 hover:text-slate-900"
                    title="Copiar"
                  >
                    {copiedIdx === idx ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                  </button>
                )}
              </div>
              {m.role === 'user' && (
                <div className="w-7 h-7 bg-slate-200 rounded-xl flex items-center justify-center shrink-0">
                  <User size={14} className="text-slate-600" />
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {loading && (
          <div className="flex gap-2 justify-start">
            <div className="w-7 h-7 bg-indigo-600 rounded-xl flex items-center justify-center shrink-0">
              <Bot size={14} className="text-white" />
            </div>
            <div className="bg-slate-100 rounded-2xl px-3.5 py-3">
              <Loader2 size={16} className="animate-spin text-slate-500" />
            </div>
          </div>
        )}
      </div>

      {/* Quick actions */}
      {messages.length <= 2 && !loading && provider && (
        <div className="px-4 py-2 border-t border-slate-100 bg-slate-50/50">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Acciones rápidas</p>
          <div className="grid grid-cols-2 gap-1.5">
            {QUICK_ACTIONS.map(a => (
              <button
                key={a.id}
                onClick={() => handleSend(a.prompt)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-[11px] font-bold text-slate-700 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-700 transition-all text-left"
              >
                {a.icon}
                <span className="truncate">{a.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-3 border-t border-slate-100 bg-white">
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            disabled={!provider || loading}
            placeholder={provider ? 'Pregunta al Director IA…' : 'Configura una clave de IA en Ajustes'}
            rows={1}
            className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:opacity-50 resize-none max-h-24"
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || !provider || loading}
            className="w-10 h-10 bg-indigo-600 text-white rounded-2xl shadow-md shadow-indigo-200 disabled:opacity-40 hover:bg-indigo-700 transition-all flex items-center justify-center shrink-0"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
}
