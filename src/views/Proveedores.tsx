// src/views/Proveedores.tsx
// ✅ 100% Supabase — sin Firebase, sin datos hardcoded
// ✅ Voz, foto IA, historial real, valoración estrellas, alertas inactividad
// ✅ WhatsApp IA INTEGRADO — analiza stock, calcula pedido, genera mensaje listo
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Users, Search, Plus, Phone, Mail, Truck, Star, Clock,
  Camera, Loader2, X, Trash2, AlertTriangle, TrendingUp,
  Brain, Mic, MicOff, MessageCircle, MapPin, FileCheck,
  CheckCircle2, ShoppingBag, CreditCard, Edit2, Check,
  Package, Hash, RefreshCw, ShoppingCart, Edit3
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../supabase';
import { useSupabase } from '../context/SupabaseContext';
import { GoogleGenAI } from '@google/genai';
import { cn } from '../lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Supplier {
  id: string;
  nombre: string;
  categoria: string;
  contacto?: string;
  telefono?: string;
  email?: string;
  direccion?: string;
  cif?: string;
  iban?: string;
  logo_url?: string;
  notas?: string;
  valoracion?: number;
  activo: boolean;
  created_at: string;
}

interface DeliveryNote {
  id: string;
  referencia?: string;
  fecha: string;
  supplier_name: string;
  proveedor_id?: string;
  total: number;
  base: number;
  estado: string;
  items: any[];
}

interface StockItem {
  id: string;
  name: string;
  unit: string;
  current_stock: number;
  min_stock: number;
  price_per_unit: number;
  supplier_id?: string;
  category: string;
}

interface SupplierStats {
  totalGasto: number;
  numPedidos: number;
  ultimoPedido: string | null;
  diasSinPedido: number;
  ticketMedio: number;
  facturasPendientes: number;
}

interface OrderLine {
  id: string;
  name: string;
  unit: string;
  current: number;
  min: number;
  edited: number;
  urgency: 'critico' | 'bajo';
  price: number;
}

type SupplierForm = Omit<Supplier, 'id' | 'created_at' | 'activo'>;

// ─── Constants ────────────────────────────────────────────────────────────────
const CATEGORIAS = ['Carnes', 'Pescados', 'Frutas/Verduras', 'Bebidas', 'Lacteos', 'Panaderia', 'Suministros', 'Limpieza', 'Otros'];

const CAT_EMOJI: Record<string, string> = {
  'Carnes': '🥩', 'Pescados': '🐟', 'Frutas/Verduras': '🥦',
  'Bebidas': '🍷', 'Lacteos': '🧀', 'Panaderia': '🥖',
  'Suministros': '📦', 'Limpieza': '🧹', 'Otros': '🔧',
};

const CAT_STOCK_MAP: Record<string, string[]> = {
  'Carnes': ['Comida'], 'Pescados': ['Comida'], 'Frutas/Verduras': ['Comida'],
  'Bebidas': ['Bebida'], 'Lacteos': ['Comida'], 'Panaderia': ['Comida'],
  'Suministros': ['Suministros'], 'Limpieza': ['Limpieza'], 'Otros': ['Otro'],
};

function emptyForm(): SupplierForm {
  return {
    nombre: '', categoria: 'Carnes', contacto: '', telefono: '',
    email: '', direccion: '', cif: '', iban: '', logo_url: '', notas: '', valoracion: 0,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const aiRef = { current: null as GoogleGenAI | null };
function getAI() {
  if (!aiRef.current) aiRef.current = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || '' });
  return aiRef.current;
}
function uid() { return Math.random().toString(36).slice(2, 10); }
function fmtEur(n: number) { return n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' }); }
function fmtDate(d: string) {
  if (!d) return '—';
  return new Date(d + (d.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function useToast() {
  const [toasts, setToasts] = useState<{ id: string; msg: string; type: 'ok' | 'err' | 'warn' }[]>([]);
  const show = useCallback((msg: string, type: 'ok' | 'err' | 'warn' = 'ok') => {
    const id = uid();
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
  }, []);
  const ToastContainer = () => (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[600] flex flex-col gap-2 items-center pointer-events-none">
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
      )} title={on ? 'Parar' : 'Dictar por voz'}>
      {on ? <MicOff size={sz} /> : <Mic size={sz} />}
    </button>
  );
}

function VoiceField({ value, onChange, placeholder, type = 'text' }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
      <VoiceButton onResult={onChange} small />
    </div>
  );
}

// ─── StarRating ───────────────────────────────────────────────────────────────
function StarRating({ value, onChange, readonly = false }: { value: number; onChange?: (v: number) => void; readonly?: boolean }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <button key={i} type="button"
          onClick={() => !readonly && onChange?.(i)}
          onMouseEnter={() => !readonly && setHover(i)}
          onMouseLeave={() => !readonly && setHover(0)}
          disabled={readonly}
          className={cn('transition-all', readonly ? 'cursor-default' : 'hover:scale-110')}
        >
          <Star size={readonly ? 14 : 18}
            className={cn('transition-colors',
              (hover || value) >= i ? 'text-amber-400 fill-amber-400' : 'text-slate-200 fill-slate-100'
            )} />
        </button>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// WHATSAPP IA MODAL
// ════════════════════════════════════════════════════════════════════════════
function WhatsAppOrderModal({ supplier, onClose, toast }: {
  supplier: Supplier;
  onClose: () => void;
  toast: (msg: string, type?: 'ok' | 'err' | 'warn') => void;
}) {
  type Step = 'loading' | 'preview' | 'sent';
  const [step, setStep] = useState<Step>('loading');
  const [loadingMsg, setLoadingMsg] = useState('Leyendo el stock del restaurante...');
  const [orderLines, setOrderLines] = useState<OrderLine[]>([]);
  const [message, setMessage] = useState('');
  const [regenerating, setRegenerating] = useState(false);
  const [totalItems, setTotalItems] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        setLoadingMsg('Leyendo el stock del restaurante...');
        const { data: stockData, error: stockErr } = await supabase
          .from('stock_items')
          .select('id,name,unit,current_stock,min_stock,price_per_unit,supplier_id,category')
          .eq('active', true)
          .order('name');
        if (stockErr) throw stockErr;

        const allStock = (stockData || []) as StockItem[];
        setTotalItems(allStock.length);

        let relevant = allStock.filter(i => i.supplier_id === supplier.id);
        if (relevant.length === 0) {
          const cats = CAT_STOCK_MAP[supplier.categoria] || ['Comida'];
          relevant = allStock.filter(i => cats.includes(i.category));
        }

        setLoadingMsg('La IA calcula que falta y cuanto pedir...');

        const hoy = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

        const stockContexto = allStock
          .map(i => `${i.name}: ${i.current_stock}${i.unit} actual, min ${i.min_stock}${i.unit}, ${i.price_per_unit}eu/${i.unit}`)
          .join('\n');

        const productosProveedor = relevant.length > 0
          ? relevant.map(i => `${i.name}: ${i.current_stock}${i.unit} actual, min ${i.min_stock}${i.unit}`).join('\n')
          : `Sin productos especificos. Proveedor categoria: ${supplier.categoria}`;

        const calcRes = await getAI().models.generateContent({
          model: 'gemini-2.0-flash',
          contents: [{
            role: 'user', parts: [{
              text: `Eres el jefe de compras de un restaurante. Hoy es ${hoy}.

PROVEEDOR: ${supplier.nombre} (categoria: ${supplier.categoria})

PRODUCTOS DE ESTE PROVEEDOR:
${productosProveedor}

STOCK COMPLETO DEL RESTAURANTE:
${stockContexto}

Calcula que productos hay que pedir a este proveedor HOY.

REGLAS:
- Incluye solo productos con stock actual menor o igual a 1.5 veces el minimo
- Cantidad a pedir = (minimo x 2) - stock actual, redondeado a numero practico
- critico = stock actual menor o igual al minimo
- bajo = stock actual menor o igual a 1.5x minimo
- Si no hay productos asignados, sugiere productos tipicos de la categoria ${supplier.categoria}
- Redondea a kg enteros, cajas completas, unidades enteras

Responde SOLO con JSON valido sin markdown:
{
  "lineas": [
    {"name":"nombre","unit":"unidad","current":numero,"min":numero,"suggested":numero,"urgency":"critico o bajo","razon":"motivo"}
  ],
  "resumen": "frase corta del estado del stock"
}`
            }]
          }]
        });

        const rawCalc = calcRes.candidates?.[0]?.content?.parts?.[0]?.text || '{"lineas":[]}';
        const parsed = JSON.parse(rawCalc.replace(/```json|```/g, '').trim());

        const lines: OrderLine[] = (parsed.lineas || []).map((l: any) => ({
          id: uid(),
          name: String(l.name || ''),
          unit: String(l.unit || 'ud'),
          current: Number(l.current) || 0,
          min: Number(l.min) || 0,
          edited: Number(l.suggested) || 0,
          urgency: l.urgency === 'critico' ? 'critico' : 'bajo',
          price: relevant.find(i => i.name.toLowerCase().includes(String(l.name || '').toLowerCase()))?.price_per_unit || 0,
        }));

        setOrderLines(lines);

        setLoadingMsg('Redactando el mensaje de pedido...');
        const msg = await buildMessage(lines, supplier, parsed.resumen || '');
        setMessage(msg);
        setStep('preview');

      } catch (err: any) {
        toast('Error: ' + err.message, 'err');
        onClose();
      }
    })();
  }, []);

  async function buildMessage(lines: OrderLine[], sup: Supplier, resumen: string): Promise<string> {
    if (lines.length === 0) {
      return `Hola ${sup.nombre}!\n\nTodo el stock esta bien por ahora, no necesitamos pedido hoy.\n\nUn saludo,\nRaco Blanquerna`;
    }

    const hoy = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
    const criticos = lines.filter(l => l.urgency === 'critico');
    const lineasTexto = lines
      .sort((a, b) => (a.urgency === 'critico' ? -1 : 1))
      .map(l => `- ${l.name}: *${l.edited} ${l.unit}*${l.urgency === 'critico' ? ' URGENTE' : ''}`)
      .join('\n');
    const totalEst = lines.reduce((s, l) => s + l.edited * l.price, 0);

    const res = await getAI().models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [{
        role: 'user', parts: [{
          text: `Redacta un mensaje WhatsApp de pedido a un proveedor de restaurante.

Proveedor: ${sup.nombre}
Dia: ${hoy}
Restaurante: Raco Blanquerna
Productos urgentes: ${criticos.length > 0 ? criticos.map(c => c.name).join(', ') : 'ninguno'}
Lista completa:
${lineasTexto}
${totalEst > 0 ? `Importe estimado: ${fmtEur(totalEst)}` : ''}
Contexto: ${resumen}

INSTRUCCIONES:
- Saludo cordial y directo
- Lista los productos exactamente como aparecen arriba
- Si hay urgentes mencionalo al principio
- Pide confirmar disponibilidad y hora de entrega
- Firma: Raco Blanquerna
- Maximo 200 palabras, emojis moderados
- Listo para copiar y enviar por WhatsApp`
        }]
      }]
    });
    return res.candidates?.[0]?.content?.parts?.[0]?.text || lineasTexto;
  }

  async function regenerateMessage() {
    setRegenerating(true);
    try {
      const msg = await buildMessage(orderLines, supplier, '');
      setMessage(msg);
    } catch { /* mantener el anterior */ }
    finally { setRegenerating(false); }
  }

  function openWhatsApp() {
    if (!supplier.telefono) {
      toast('Anade el telefono del proveedor en su ficha', 'warn');
      return;
    }
    const phone = supplier.telefono.replace(/[^0-9]/g, '');
    const fullPhone = phone.startsWith('34') ? phone : `34${phone}`;
    window.open(`https://wa.me/${fullPhone}?text=${encodeURIComponent(message)}`, '_blank');
    setStep('sent');
  }

  async function copyMessage() {
    await navigator.clipboard.writeText(message);
    toast('Mensaje copiado al portapapeles');
  }

  const criticalCount = orderLines.filter(l => l.urgency === 'critico').length;
  const totalEst = orderLines.reduce((s, l) => s + l.edited * l.price, 0);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[400] flex items-end sm:items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm">
      <motion.div
        initial={{ y: 60, opacity: 0, scale: 0.96 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 60, opacity: 0, scale: 0.96 }}
        className="bg-white w-full max-w-2xl rounded-[2.5rem] flex flex-col max-h-[92vh] overflow-hidden shadow-2xl">

        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-center gap-4 shrink-0">
          <div className="w-12 h-12 bg-green-50 border border-green-200 rounded-2xl flex items-center justify-center shrink-0">
            <MessageCircle size={22} className="text-green-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-green-500">Pedido automatico por IA</p>
            <h2 className="text-xl font-black text-slate-900 truncate">{supplier.nombre}</h2>
            {supplier.telefono
              ? <p className="text-xs text-slate-400">{supplier.telefono}</p>
              : <p className="text-xs text-rose-400 font-bold">Sin telefono — añadelo en la ficha</p>
            }
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 transition-all text-slate-400 shrink-0">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">

          {/* LOADING */}
          {step === 'loading' && (
            <div className="flex flex-col items-center justify-center py-16 gap-6 px-8">
              <div className="relative">
                <div className="w-20 h-20 bg-green-50 rounded-[2rem] flex items-center justify-center">
                  <MessageCircle size={36} className="text-green-500" />
                </div>
                <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-lg">
                  <Loader2 size={18} className="animate-spin text-indigo-400" />
                </div>
              </div>
              <div className="text-center space-y-2">
                <p className="font-black text-slate-900 text-lg">{loadingMsg}</p>
                <p className="text-sm text-slate-400">
                  {totalItems > 0 ? `Analizando ${totalItems} productos del inventario...` : 'Conectando con el inventario...'}
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs font-bold flex-wrap justify-center">
                {[
                  { label: '1. Leer stock', active: loadingMsg.includes('stock') },
                  { label: '2. Calcular faltas', active: loadingMsg.includes('calcula') },
                  { label: '3. Redactar pedido', active: loadingMsg.includes('Redact') },
                ].map((s, i) => (
                  <React.Fragment key={s.label}>
                    <span className={cn('px-3 py-1.5 rounded-xl transition-all',
                      s.active ? 'bg-green-100 text-green-700 font-black' : 'bg-slate-100 text-slate-400'
                    )}>{s.label}</span>
                    {i < 2 && <span className="text-slate-300">→</span>}
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}

          {/* PREVIEW */}
          {step === 'preview' && (
            <div className="p-6 space-y-5">
              {orderLines.length === 0 ? (
                <div className="flex flex-col items-center py-8 text-center gap-3">
                  <div className="w-14 h-14 bg-emerald-50 rounded-[1.5rem] flex items-center justify-center">
                    <CheckCircle2 size={28} className="text-emerald-500" />
                  </div>
                  <p className="font-black text-emerald-700">Todo el stock esta bien</p>
                  <p className="text-sm text-slate-400">No hay productos bajos para este proveedor ahora mismo</p>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap gap-2">
                    {criticalCount > 0 && (
                      <span className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-black">
                        <AlertTriangle size={12} /> {criticalCount} URGENTE{criticalCount > 1 ? 'S' : ''}
                      </span>
                    )}
                    <span className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold">
                      <Package size={12} /> {orderLines.length} producto{orderLines.length > 1 ? 's' : ''} a pedir
                    </span>
                    {totalEst > 0 && (
                      <span className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-xl text-xs font-black ml-auto">
                        <ShoppingCart size={12} /> ~{fmtEur(totalEst)}
                      </span>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Productos del pedido</p>
                      <p className="text-[10px] text-slate-400">Ajusta las cantidades si lo necesitas</p>
                    </div>
                    {[...orderLines].sort((a, b) => (a.urgency === 'critico' ? -1 : 1)).map(line => (
                      <div key={line.id}
                        className={cn('flex items-center gap-3 px-4 py-3 rounded-2xl border',
                          line.urgency === 'critico' ? 'bg-rose-50 border-rose-200' : 'bg-amber-50 border-amber-200'
                        )}>
                        <span className={cn('w-2.5 h-2.5 rounded-full shrink-0',
                          line.urgency === 'critico' ? 'bg-rose-500 animate-pulse' : 'bg-amber-400'
                        )} />
                        <div className="flex-1 min-w-0">
                          <p className={cn('font-black text-sm', line.urgency === 'critico' ? 'text-rose-800' : 'text-amber-900')}>
                            {line.name}
                          </p>
                          <p className={cn('text-[11px] font-medium', line.urgency === 'critico' ? 'text-rose-400' : 'text-amber-500')}>
                            Ahora: {line.current}{line.unit} · min: {line.min}{line.unit}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => setOrderLines(prev => prev.map(l =>
                              l.id === line.id ? { ...l, edited: Math.max(0, parseFloat((l.edited - 1).toFixed(2))) } : l
                            ))}
                            className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 flex items-center justify-center font-black leading-none transition-all">−</button>
                          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl px-2 py-1">
                            <input type="number" min="0" step="0.5" value={line.edited}
                              onChange={e => setOrderLines(prev => prev.map(l =>
                                l.id === line.id ? { ...l, edited: parseFloat(e.target.value) || 0 } : l
                              ))}
                              className="w-12 text-center text-sm font-black text-slate-900 bg-transparent outline-none" />
                            <span className="text-xs text-slate-400 font-medium">{line.unit}</span>
                          </div>
                          <button
                            onClick={() => setOrderLines(prev => prev.map(l =>
                              l.id === line.id ? { ...l, edited: parseFloat((l.edited + 1).toFixed(2)) } : l
                            ))}
                            className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 flex items-center justify-center font-black leading-none transition-all">+</button>
                          <button
                            onClick={() => setOrderLines(prev => prev.filter(l => l.id !== line.id))}
                            className="w-7 h-7 ml-1 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 flex items-center justify-center transition-all">
                            <X size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Mensaje WhatsApp listo</p>
                  <button onClick={regenerateMessage} disabled={regenerating}
                    className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700 disabled:opacity-50 transition-all">
                    {regenerating ? <><Loader2 size={12} className="animate-spin" /> Regenerando...</> : <><RefreshCw size={12} /> Regenerar</>}
                  </button>
                </div>
                <div className="relative">
                  <textarea value={message} onChange={e => setMessage(e.target.value)} rows={11}
                    className="w-full px-5 py-4 bg-green-50 border-2 border-green-200 rounded-2xl text-sm text-slate-800 leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-green-300 font-medium" />
                  <span className="absolute bottom-3 right-3 text-[10px] text-slate-400 bg-white px-2 py-1 rounded-lg border border-slate-100">
                    {message.length} car.
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
                  <Edit3 size={11} /> Edita el texto antes de enviar si lo necesitas
                </p>
              </div>
            </div>
          )}

          {/* SENT */}
          {step === 'sent' && (
            <div className="flex flex-col items-center justify-center py-14 px-8 text-center gap-5">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200 }}
                className="w-24 h-24 bg-green-50 rounded-[2.5rem] flex items-center justify-center shadow-lg shadow-green-100">
                <MessageCircle size={44} className="text-green-500" />
              </motion.div>
              <div className="space-y-1">
                <p className="text-2xl font-black text-slate-900">Pedido enviado!</p>
                <p className="text-slate-500 text-sm">WhatsApp abierto con el mensaje para <strong>{supplier.nombre}</strong></p>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-2xl px-5 py-4 w-full text-left space-y-1.5">
                <p className="text-xs font-black uppercase text-green-600 mb-2">Resumen del pedido</p>
                {orderLines.map(l => (
                  <p key={l.id} className="text-sm text-slate-700">
                    {l.name}: <strong className="text-slate-900">{l.edited} {l.unit}</strong>
                    {l.urgency === 'critico' && <span className="ml-1 text-rose-500 text-xs font-black"> URGENTE</span>}
                  </p>
                ))}
                {totalEst > 0 && (
                  <p className="text-sm font-black text-green-700 pt-3 mt-2 border-t border-green-200">
                    Importe estimado: {fmtEur(totalEst)}
                  </p>
                )}
              </div>
              <p className="text-xs text-slate-400 bg-slate-50 rounded-2xl px-4 py-3 border border-slate-200 w-full text-left">
                Cuando llegue el pedido, entra en <strong>Compras - Albaranes</strong> y escanea el papel con la camara. El stock se actualiza automaticamente.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        {step === 'preview' && (
          <div className="p-5 border-t border-slate-100 flex flex-col gap-3 shrink-0">
            {!supplier.telefono && (
              <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-2xl text-sm text-amber-700 font-medium">
                <AlertTriangle size={15} className="shrink-0" />
                Sin telefono registrado. Anyadelo en la ficha del proveedor.
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={copyMessage}
                className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-2xl text-sm font-bold hover:bg-slate-200 transition-all flex items-center justify-center gap-2">
                Copiar mensaje
              </button>
              <button onClick={openWhatsApp} disabled={!supplier.telefono}
                className="flex-[2] py-3 bg-green-600 text-white rounded-2xl text-sm font-black hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-lg shadow-green-200">
                <MessageCircle size={18} /> Abrir WhatsApp y enviar
              </button>
            </div>
          </div>
        )}
        {step === 'sent' && (
          <div className="p-5 border-t border-slate-100 shrink-0">
            <button onClick={onClose}
              className="w-full py-3 bg-slate-900 text-white rounded-2xl text-sm font-bold hover:bg-slate-800 transition-all">
              Cerrar
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

// ─── Supplier Card ────────────────────────────────────────────────────────────
function SupplierCard({ supplier, stats, onClick, selected, onWhatsApp }: {
  supplier: Supplier; stats: SupplierStats; onClick: () => void; selected: boolean; onWhatsApp: () => void;
}) {
  const inactive = stats.diasSinPedido > 30 && stats.numPedidos > 0;
  const alert = inactive || stats.facturasPendientes > 0;
  return (
    <motion.div layout onClick={onClick}
      className={cn('bg-white rounded-3xl border p-5 cursor-pointer transition-all hover:shadow-lg group relative overflow-hidden',
        selected ? 'border-indigo-300 shadow-lg shadow-indigo-50 ring-2 ring-indigo-200' :
        alert ? 'border-amber-200 hover:border-amber-300' : 'border-slate-200 hover:border-indigo-200'
      )}>
      {alert && <span className="absolute top-3 right-3 w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse shadow-lg shadow-amber-300" />}
      <div className="flex items-start gap-3 mb-4">
        <div className="w-12 h-12 bg-gradient-to-br from-indigo-50 to-slate-100 rounded-2xl flex items-center justify-center shrink-0 text-2xl">
          {CAT_EMOJI[supplier.categoria] || '🔧'}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-black text-slate-900 text-sm leading-tight truncate">{supplier.nombre}</h3>
          <p className="text-[11px] text-slate-400 font-medium mt-0.5">{supplier.categoria}</p>
          <StarRating value={supplier.valoracion || 0} readonly />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="bg-slate-50 rounded-xl px-3 py-2">
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Gastado (año)</p>
          <p className="text-sm font-black text-slate-800">{fmtEur(stats.totalGasto)}</p>
        </div>
        <div className="bg-slate-50 rounded-xl px-3 py-2">
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Pedidos</p>
          <p className="text-sm font-black text-slate-800">{stats.numPedidos}</p>
        </div>
      </div>
      {stats.ultimoPedido ? (
        <div className={cn('flex items-center gap-1.5 text-[11px] font-medium px-3 py-1.5 rounded-xl',
          inactive ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-emerald-50 text-emerald-700'
        )}>
          <Clock size={11} />
          {inactive ? `Sin pedido hace ${stats.diasSinPedido} dias` : `Ultimo: ${fmtDate(stats.ultimoPedido)}`}
        </div>
      ) : (
        <div className="flex items-center gap-1.5 text-[11px] font-medium px-3 py-1.5 rounded-xl bg-slate-50 text-slate-400">
          <Package size={11} /> Sin pedidos registrados
        </div>
      )}
      <div className="flex gap-2 mt-3 opacity-0 group-hover:opacity-100 transition-all duration-200">
        {supplier.telefono && (
          <a href={`tel:${supplier.telefono}`} onClick={e => e.stopPropagation()}
            className="flex-1 flex items-center justify-center gap-1 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-200 transition-all">
            <Phone size={12} /> Llamar
          </a>
        )}
        <button onClick={e => { e.stopPropagation(); onWhatsApp(); }}
          className="flex-1 flex items-center justify-center gap-1 py-2 bg-green-600 text-white rounded-xl text-xs font-black hover:bg-green-700 transition-all shadow-sm shadow-green-200">
          <MessageCircle size={12} /> Pedir IA
        </button>
        {supplier.email && (
          <a href={`mailto:${supplier.email}`} onClick={e => e.stopPropagation()}
            className="flex-1 flex items-center justify-center gap-1 py-2 bg-blue-50 text-blue-700 rounded-xl text-xs font-bold hover:bg-blue-100 transition-all border border-blue-200">
            <Mail size={12} /> Email
          </a>
        )}
      </div>
    </motion.div>
  );
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────
function DetailPanel({ supplier, notes, stats, onEdit, onDelete, onClose, onRate, onWhatsApp }: {
  supplier: Supplier; notes: DeliveryNote[]; stats: SupplierStats;
  onEdit: () => void; onDelete: () => void; onClose: () => void;
  onRate: (val: number) => void; onWhatsApp: () => void;
}) {
  const [briefing, setBriefing] = useState('');
  const [briefingLoading, setBriefingLoading] = useState(false);

  async function generateBriefing() {
    setBriefingLoading(true); setBriefing('');
    try {
      const topItems = notes.slice(0, 5).flatMap(n => (n.items || []).slice(0, 3).map((i: any) => i.descripcion)).filter(Boolean).join(', ');
      const res = await getAI().models.generateContent({
        model: 'gemini-2.0-flash',
        contents: [{ role: 'user', parts: [{ text: `Briefing negociacion proveedor (max 150 palabras, español). Proveedor: ${supplier.nombre}, categoria: ${supplier.categoria}, gasto año: ${fmtEur(stats.totalGasto)}, pedidos: ${stats.numPedidos}, ticket medio: ${fmtEur(stats.ticketMedio)}, productos: ${topItems || 'no disponible'}, notas: ${supplier.notas || 'ninguna'}. Incluye: relacion comercial, puntos clave negociacion, alertas. Directo y util.` }] }]
      });
      setBriefing(res.candidates?.[0]?.content?.parts?.[0]?.text || 'Sin respuesta');
    } catch { setBriefing('Error al generar el briefing.'); }
    finally { setBriefingLoading(false); }
  }

  const pedidosPorMes = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('es-ES', { month: 'short' });
      const total = notes.filter(n => n.fecha?.startsWith(key)).reduce((s, n) => s + n.total, 0);
      return { label, total };
    });
  }, [notes]);
  const maxMes = Math.max(...pedidosPorMes.map(m => m.total), 1);

  return (
    <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 30 }}
      className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden flex flex-col h-full">
      <div className="p-6 border-b border-slate-100 flex items-start justify-between shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-gradient-to-br from-indigo-100 to-slate-100 rounded-2xl flex items-center justify-center text-3xl">
            {CAT_EMOJI[supplier.categoria] || '🔧'}
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900">{supplier.nombre}</h2>
            <p className="text-sm text-slate-400">{supplier.categoria}</p>
            <StarRating value={supplier.valoracion || 0} onChange={onRate} />
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={onEdit} className="p-2 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all"><Edit2 size={16} /></button>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 transition-all text-slate-400"><X size={18} /></button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* BOTON WHATSAPP IA DESTACADO */}
        <button onClick={onWhatsApp}
          className="w-full flex items-center gap-3 py-4 px-5 bg-green-600 text-white rounded-2xl font-black text-sm hover:bg-green-700 transition-all shadow-lg shadow-green-200 group">
          <MessageCircle size={20} className="shrink-0 group-hover:scale-110 transition-transform" />
          <div className="text-left">
            <p className="font-black">Hacer pedido por WhatsApp con IA</p>
            <p className="text-xs text-green-200 font-medium">Analiza stock → calcula cantidades → genera mensaje listo</p>
          </div>
        </button>

        {/* Contacto */}
        <section className="space-y-2">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Contacto</h3>
          {supplier.contacto && <div className="flex items-center gap-2 text-sm text-slate-700"><Users size={14} className="text-slate-400 shrink-0" /> {supplier.contacto}</div>}
          {supplier.telefono && (
            <div className="flex items-center gap-2">
              <Phone size={14} className="text-slate-400 shrink-0" />
              <a href={`tel:${supplier.telefono}`} className="text-sm text-indigo-600 font-medium hover:underline">{supplier.telefono}</a>
            </div>
          )}
          {supplier.email && (
            <div className="flex items-center gap-2 text-sm text-slate-700">
              <Mail size={14} className="text-slate-400 shrink-0" />
              <a href={`mailto:${supplier.email}`} className="text-indigo-600 hover:underline truncate">{supplier.email}</a>
            </div>
          )}
          {supplier.direccion && <div className="flex items-center gap-2 text-sm text-slate-600"><MapPin size={14} className="text-slate-400 shrink-0" /> {supplier.direccion}</div>}
          {(supplier.cif || supplier.iban) && (
            <div className="flex gap-2 flex-wrap mt-1">
              {supplier.cif && <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"><FileCheck size={12} className="text-indigo-400" /><span className="font-bold text-slate-600">CIF:</span><span className="font-mono text-slate-700">{supplier.cif}</span></div>}
              {supplier.iban && <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"><CreditCard size={12} className="text-indigo-400" /><span className="font-bold text-slate-600">IBAN:</span><span className="font-mono text-slate-700">{supplier.iban.slice(0, 10)}...</span></div>}
            </div>
          )}
        </section>

        {/* Stats */}
        <section className="space-y-2">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Resumen comercial</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Gasto total año', value: fmtEur(stats.totalGasto), icon: TrendingUp, color: 'text-indigo-600' },
              { label: 'Pedidos totales', value: stats.numPedidos, icon: ShoppingBag, color: 'text-slate-700' },
              { label: 'Ticket medio', value: fmtEur(stats.ticketMedio), icon: Hash, color: 'text-emerald-600' },
              { label: 'Facturas pend.', value: stats.facturasPendientes, icon: AlertTriangle, color: stats.facturasPendientes > 0 ? 'text-rose-600' : 'text-slate-400' },
            ].map(s => (
              <div key={s.label} className="bg-slate-50 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-1"><s.icon size={13} className={s.color} /><span className="text-[10px] font-black uppercase text-slate-400">{s.label}</span></div>
                <p className={cn('text-xl font-black', s.color)}>{s.value}</p>
              </div>
            ))}
          </div>
        </section>

        {stats.numPedidos > 0 && (
          <section className="space-y-2">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Gasto ultimos 6 meses</h3>
            <div className="bg-slate-50 rounded-2xl p-4">
              <div className="flex items-end gap-2 h-16">
                {pedidosPorMes.map((m, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full bg-indigo-300 rounded-t-md" style={{ height: `${(m.total / maxMes) * 48}px`, minHeight: m.total > 0 ? '4px' : '0' }} />
                    <span className="text-[9px] font-bold text-slate-400 uppercase">{m.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {notes.length > 0 && (
          <section className="space-y-2">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Ultimos pedidos ({notes.length})</h3>
            <div className="space-y-2">
              {notes.slice(0, 6).map(n => (
                <div key={n.id} className="flex items-center justify-between px-4 py-3 bg-slate-50 rounded-2xl hover:bg-slate-100 transition-all">
                  <div>
                    <p className="text-sm font-bold text-slate-800">{fmtDate(n.fecha)}</p>
                    {n.referencia && <p className="text-[11px] text-slate-400">#{n.referencia}</p>}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={cn('text-[10px] font-black px-2 py-0.5 rounded-lg',
                      n.estado === 'facturado' ? 'bg-emerald-50 text-emerald-600' :
                      n.estado === 'pendiente' ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-500'
                    )}>{n.estado}</span>
                    <span className="font-black text-slate-900">{fmtEur(n.total)}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {supplier.notas && (
          <section className="space-y-2">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Notas internas</h3>
            <p className="text-sm text-slate-600 bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3 italic">{supplier.notas}</p>
          </section>
        )}

        <section className="space-y-3">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Briefing negociacion IA</h3>
          {briefing ? (
            <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4">
              <pre className="text-sm text-indigo-900 whitespace-pre-wrap font-sans leading-relaxed">{briefing}</pre>
            </div>
          ) : (
            <button onClick={generateBriefing} disabled={briefingLoading}
              className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 text-white rounded-2xl text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-lg shadow-indigo-200">
              {briefingLoading ? <><Loader2 size={16} className="animate-spin" /> Generando...</> : <><Brain size={16} /> Generar briefing de negociacion</>}
            </button>
          )}
        </section>

        <button onClick={onDelete}
          className="w-full flex items-center justify-center gap-2 py-3 bg-rose-50 text-rose-600 border border-rose-200 rounded-2xl text-sm font-bold hover:bg-rose-100 transition-all">
          <Trash2 size={14} /> Desactivar proveedor
        </button>
      </div>
    </motion.div>
  );
}

// ─── MAIN VIEW ────────────────────────────────────────────────────────────────
export default function ProveedoresView() {
  const { employee } = useSupabase();
  const isAdmin = (employee as any)?.rol === 'admin';
  const { show: toast, ToastContainer } = useToast();

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [allNotes, setAllNotes] = useState<DeliveryNote[]>([]);
  const [facturasPend, setFacturasPend] = useState<{ proveedor: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('Todas');
  const [selected, setSelected] = useState<Supplier | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState<SupplierForm>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [photoScan, setPhotoScan] = useState(false);
  const [waSupplier, setWaSupplier] = useState<Supplier | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
    const [supRes, notesRes, facRes] = await Promise.all([
      supabase.from('suppliers').select('*').eq('activo', true).order('nombre'),
      supabase.from('delivery_notes').select('id,referencia,fecha,supplier_name,proveedor_id,total,base,estado,items').gte('fecha', yearStart).order('fecha', { ascending: false }),
      supabase.from('facturas').select('proveedor').eq('pagada', false).eq('tipo', 'compra'),
    ]);
    if (supRes.data) setSuppliers(supRes.data as Supplier[]);
    if (notesRes.data) setAllNotes(notesRes.data as DeliveryNote[]);
    if (facRes.data) setFacturasPend(facRes.data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const statsMap = useMemo(() => {
    const map: Record<string, SupplierStats> = {};
    for (const s of suppliers) {
      const notes = allNotes.filter(n => n.proveedor_id === s.id || n.supplier_name?.toLowerCase() === s.nombre.toLowerCase());
      const totalGasto = notes.reduce((sum, n) => sum + n.total, 0);
      const numPedidos = notes.length;
      const ultimoPedido = notes[0]?.fecha || null;
      const diasSinPedido = ultimoPedido ? Math.floor((Date.now() - new Date(ultimoPedido + 'T00:00:00').getTime()) / 86400000) : 999;
      const ticketMedio = numPedidos > 0 ? totalGasto / numPedidos : 0;
      const facturasPendientes = facturasPend.filter(f => f.proveedor?.toLowerCase() === s.nombre.toLowerCase()).length;
      map[s.id] = { totalGasto, numPedidos, ultimoPedido, diasSinPedido, ticketMedio, facturasPendientes };
    }
    return map;
  }, [suppliers, allNotes, facturasPend]);

  const sorted = useMemo(() => {
    return [...suppliers]
      .filter(s => {
        const q = search.toLowerCase();
        return (catFilter === 'Todas' || s.categoria === catFilter)
          && (!q || s.nombre.toLowerCase().includes(q) || s.contacto?.toLowerCase().includes(q) || s.email?.toLowerCase().includes(q));
      })
      .sort((a, b) => (statsMap[b.id]?.totalGasto || 0) - (statsMap[a.id]?.totalGasto || 0));
  }, [suppliers, search, catFilter, statsMap]);

  async function handleSave() {
    if (!form.nombre.trim()) { toast('El nombre es obligatorio', 'err'); return; }
    setSaving(true);
    try {
      if (editMode && selected) {
        const { error } = await supabase.from('suppliers').update({ ...form }).eq('id', selected.id);
        if (error) throw error;
        toast('Proveedor actualizado');
      } else {
        const { error } = await supabase.from('suppliers').insert({ ...form, activo: true });
        if (error) throw error;
        toast('Proveedor añadido');
      }
      await load(); setShowForm(false); setEditMode(false); setForm(emptyForm()); setSelected(null);
    } catch (err: any) { toast('Error: ' + err.message, 'err'); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!selected) return;
    if (!confirm(`Desactivar a ${selected.nombre}?`)) return;
    const { error } = await supabase.from('suppliers').update({ activo: false }).eq('id', selected.id);
    if (error) { toast('Error al desactivar', 'err'); return; }
    setSuppliers(prev => prev.filter(s => s.id !== selected.id));
    setSelected(null); toast('Proveedor desactivado');
  }

  async function handleRate(supplierId: string, val: number) {
    const { error } = await supabase.from('suppliers').update({ valoracion: val }).eq('id', supplierId);
    if (error) { toast('Error al guardar valoracion', 'err'); return; }
    setSuppliers(prev => prev.map(s => s.id === supplierId ? { ...s, valoracion: val } : s));
    if (selected?.id === supplierId) setSelected(prev => prev ? { ...prev, valoracion: val } : null);
    toast('Valoracion guardada');
  }

  async function handlePhotoScan(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setPhotoScan(true);
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((res, rej) => { reader.onload = ev => res((ev.target?.result as string).split(',')[1]); reader.onerror = rej; reader.readAsDataURL(file); });
      const resp = await getAI().models.generateContent({ model: 'gemini-2.0-flash', contents: [{ role: 'user', parts: [{ inlineData: { mimeType: file.type, data: base64 } }, { text: `Extrae datos de este documento. JSON: {"nombre":"","categoria":"Otros","contacto":"","telefono":"","email":"","direccion":"","cif":"","iban":"","notas":""}. Categorias: ${CATEGORIAS.join(', ')}` }] }] });
      const raw = resp.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
      const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
      setForm(f => ({ ...f, ...parsed })); setEditMode(false); setShowForm(true);
      toast('Datos extraidos — revisa y guarda', 'warn');
    } catch { toast('No pude leer la imagen', 'err'); }
    finally { setPhotoScan(false); if (fileRef.current) fileRef.current.value = ''; }
  }

  const totalGastoAnual = Object.values(statsMap).reduce((s, st) => s + st.totalGasto, 0);
  const inactivos = suppliers.filter(s => statsMap[s.id]?.diasSinPedido > 30 && statsMap[s.id]?.numPedidos > 0).length;
  const conFacturasPend = Object.values(statsMap).filter(s => s.facturasPendientes > 0).length;
  const selectedNotes = selected ? allNotes.filter(n => n.proveedor_id === selected.id || n.supplier_name?.toLowerCase() === selected.nombre.toLowerCase()) : [];
  const emptyStats: SupplierStats = { totalGasto: 0, numPedidos: 0, ultimoPedido: null, diasSinPedido: 999, ticketMedio: 0, facturasPendientes: 0 };

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-4 md:p-8 space-y-6">
      <ToastContainer />
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoScan} />

      {/* Header */}
      <header className="sticky top-4 z-[100] bg-white/80 backdrop-blur-xl border border-white/20 shadow-xl rounded-[2.5rem] p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-2xl shadow-lg">
            <Truck className="w-5 h-5 text-indigo-400" />
            <span className="font-black text-sm tracking-tighter uppercase">Proveedores</span>
          </div>
          <span className="text-sm font-bold text-slate-400 hidden sm:block">{suppliers.length} activos</span>
          {inactivos > 0 && (
            <span className="flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl">
              <AlertTriangle size={12} /> {inactivos} inactivo{inactivos > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => fileRef.current?.click()} disabled={photoScan}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-2xl text-xs font-bold hover:bg-slate-50 transition-all shadow-sm disabled:opacity-50">
            {photoScan ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />} Escanear tarjeta
          </button>
          <button onClick={() => { setForm(emptyForm()); setEditMode(false); setShowForm(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-2xl text-xs font-bold hover:bg-indigo-700 transition-all shadow-sm shadow-indigo-200">
            <Plus size={14} /> Nuevo
          </button>
        </div>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Gasto anual total', value: fmtEur(totalGastoAnual), icon: TrendingUp, color: 'text-indigo-600', alert: false },
          { label: 'Proveedores activos', value: suppliers.length, icon: Users, color: 'text-slate-700', alert: false },
          { label: 'Inactivos >30 dias', value: inactivos, icon: Clock, color: inactivos > 0 ? 'text-amber-600' : 'text-slate-400', alert: inactivos > 0 },
          { label: 'Con facturas pend.', value: conFacturasPend, icon: AlertTriangle, color: conFacturasPend > 0 ? 'text-rose-600' : 'text-slate-400', alert: conFacturasPend > 0 },
        ].map(s => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            className={cn('bg-white rounded-3xl p-5 border shadow-sm relative overflow-hidden', s.alert ? 'border-rose-200' : 'border-slate-200')}>
            {s.alert && <span className="absolute top-3 right-3 w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />}
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{s.label}</span>
              <s.icon size={14} className={s.color} />
            </div>
            <p className={cn('text-2xl font-black', s.color)}>{s.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Layout lista + detalle */}
      <div className={cn('grid gap-6', selected ? 'grid-cols-1 lg:grid-cols-5' : 'grid-cols-1')}>
        <div className={cn('space-y-4', selected ? 'lg:col-span-3' : '')}>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-[200px] bg-white border border-slate-200 rounded-2xl px-4 py-2.5 shadow-sm">
              <Search size={16} className="text-slate-400 shrink-0" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar proveedor..."
                className="flex-1 text-sm bg-transparent outline-none placeholder:text-slate-400" />
              <VoiceButton onResult={setSearch} small />
            </div>
            <div className="flex bg-white border border-slate-200 rounded-2xl p-1 gap-1 shadow-sm overflow-x-auto">
              {(['Todas', ...CATEGORIAS]).map(c => (
                <button key={c} onClick={() => setCatFilter(c)}
                  className={cn('px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap',
                    catFilter === c ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-800'
                  )}>
                  {c === 'Todas' ? 'Todas' : `${CAT_EMOJI[c] || ''} ${c}`}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20"><Loader2 size={32} className="animate-spin text-indigo-400" /></div>
          ) : sorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-20 h-20 bg-slate-100 rounded-[2rem] flex items-center justify-center mb-4 text-slate-300"><Truck size={40} /></div>
              <p className="text-slate-400 font-bold">Sin proveedores{search ? ` con "${search}"` : ''}</p>
              <button onClick={() => { setForm(emptyForm()); setEditMode(false); setShowForm(true); }}
                className="mt-4 flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-2xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200">
                <Plus size={15} /> Añadir proveedor
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {sorted.map(s => (
                <SupplierCard key={s.id} supplier={s} stats={statsMap[s.id] || emptyStats}
                  onClick={() => setSelected(selected?.id === s.id ? null : s)}
                  selected={selected?.id === s.id}
                  onWhatsApp={() => setWaSupplier(s)} />
              ))}
            </div>
          )}
        </div>

        <AnimatePresence>
          {selected && (
            <div className="lg:col-span-2 lg:sticky lg:top-28 lg:h-[calc(100vh-8rem)]">
              <DetailPanel
                supplier={selected} notes={selectedNotes} stats={statsMap[selected.id] || emptyStats}
                onEdit={() => {
                  setForm({ nombre: selected.nombre, categoria: selected.categoria, contacto: selected.contacto || '', telefono: selected.telefono || '', email: selected.email || '', direccion: selected.direccion || '', cif: selected.cif || '', iban: selected.iban || '', logo_url: selected.logo_url || '', notas: selected.notas || '', valoracion: selected.valoracion || 0 });
                  setEditMode(true); setShowForm(true);
                }}
                onDelete={handleDelete}
                onClose={() => setSelected(null)}
                onRate={val => handleRate(selected.id, val)}
                onWhatsApp={() => setWaSupplier(selected)}
              />
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Form Modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div initial={{ y: 40, opacity: 0, scale: 0.97 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 40, opacity: 0, scale: 0.97 }}
              className="bg-white w-full max-w-lg rounded-[2.5rem] flex flex-col max-h-[92vh] overflow-hidden shadow-2xl">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between shrink-0">
                <h2 className="text-xl font-black text-slate-900">{editMode ? 'Editar proveedor' : 'Nuevo proveedor'}</h2>
                <button onClick={() => { setShowForm(false); setEditMode(false); }} className="p-2 rounded-xl hover:bg-slate-100 transition-all"><X size={20} /></button>
              </div>
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400">Nombre *</label>
                  <VoiceField value={form.nombre} onChange={v => setForm(f => ({ ...f, nombre: v }))} placeholder="Nombre del proveedor" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Categoria</label>
                    <select value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
                      {CATEGORIAS.map(c => <option key={c} value={c}>{CAT_EMOJI[c]} {c}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Valoracion</label>
                    <div className="flex items-center h-[42px]">
                      <StarRating value={form.valoracion || 0} onChange={v => setForm(f => ({ ...f, valoracion: v }))} />
                    </div>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400">Persona de contacto</label>
                  <VoiceField value={form.contacto || ''} onChange={v => setForm(f => ({ ...f, contacto: v }))} placeholder="Nombre del comercial" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Telefono</label>
                    <VoiceField value={form.telefono || ''} onChange={v => setForm(f => ({ ...f, telefono: v }))} placeholder="+34 600 000 000" type="tel" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Email</label>
                    <VoiceField value={form.email || ''} onChange={v => setForm(f => ({ ...f, email: v }))} placeholder="pedidos@proveedor.es" type="email" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400">Direccion</label>
                  <VoiceField value={form.direccion || ''} onChange={v => setForm(f => ({ ...f, direccion: v }))} placeholder="Calle, ciudad..." />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">CIF / NIF</label>
                    <VoiceField value={form.cif || ''} onChange={v => setForm(f => ({ ...f, cif: v }))} placeholder="B12345678" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">IBAN</label>
                    <VoiceField value={form.iban || ''} onChange={v => setForm(f => ({ ...f, iban: v }))} placeholder="ES00 0000..." />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400">Notas internas</label>
                  <div className="flex items-start gap-2">
                    <textarea value={form.notas || ''} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
                      placeholder="Condiciones de pago, dias de entrega, observaciones..." rows={3}
                      className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                    <VoiceButton onResult={v => setForm(f => ({ ...f, notas: v }))} small className="mt-1" />
                  </div>
                </div>
              </div>
              <div className="p-6 border-t border-slate-100 flex gap-3 shrink-0">
                <button onClick={() => { setShowForm(false); setEditMode(false); }}
                  className="flex-1 py-3 border border-slate-200 rounded-2xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all">Cancelar</button>
                <button onClick={handleSave} disabled={saving}
                  className="flex-1 py-3 bg-indigo-600 text-white rounded-2xl text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-200">
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                  {editMode ? 'Actualizar' : 'Guardar proveedor'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* WhatsApp IA Modal */}
      <AnimatePresence>
        {waSupplier && (
          <WhatsAppOrderModal
            supplier={waSupplier}
            onClose={() => setWaSupplier(null)}
            toast={toast}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
