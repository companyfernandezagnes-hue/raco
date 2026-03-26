// src/views/Stock.tsx
// ✅ 100% Supabase — sin Firebase, sin datos hardcoded
// ✅ Voz en todos los campos, foto/cámara IA, Gen Z UX
// ✅ Toast notifications, movimientos rápidos por voz, análisis IA
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Package, Plus, Mic, MicOff, Camera, Loader2, X, Check,
  AlertTriangle, CheckCircle2, TrendingUp, TrendingDown,
  ArrowUpCircle, ArrowDownCircle, RotateCcw, Trash2,
  Search, Filter, Sparkles, Brain, History, BarChart3,
  Edit2, ChevronRight, Zap, ShoppingCart
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../supabase';
import { useSupabase } from '../context/SupabaseContext';
import { GoogleGenAI } from '@google/genai';
import { cn } from '../lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────
type Category = 'Comida' | 'Bebida' | 'Suministros' | 'Limpieza' | 'Otro';
type MovType = 'entrada' | 'salida' | 'ajuste' | 'merma';
type TabId = 'inventario' | 'movimientos' | 'analitica';

interface StockItem {
  id: string;
  name: string;
  category: Category;
  unit: string;
  current_stock: number;
  min_stock: number;
  price_per_unit: number;
  supplier_id?: string;
  location?: string;
  notes?: string;
  active: boolean;
  last_updated: string;
  created_at: string;
}

interface StockMovement {
  id: string;
  stock_item_id: string;
  type: MovType;
  quantity: number;
  unit_cost?: number;
  total_cost?: number;
  reason?: string;
  reference?: string;
  created_by?: string;
  created_at: string;
}

interface Supplier { id: string; nombre: string; }

// ─── Constants ────────────────────────────────────────────────────────────────
const CATS: Category[] = ['Comida', 'Bebida', 'Suministros', 'Limpieza', 'Otro'];
const UNITS = ['kg', 'g', 'l', 'ml', 'ud', 'caja', 'bolsa', 'botella', 'doc', 'palet'];

const CAT_CFG: Record<Category, { cls: string; emoji: string }> = {
  Comida:      { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', emoji: '🥩' },
  Bebida:      { cls: 'bg-blue-50 text-blue-700 border-blue-200',           emoji: '🍷' },
  Suministros: { cls: 'bg-amber-50 text-amber-700 border-amber-200',        emoji: '📦' },
  Limpieza:    { cls: 'bg-purple-50 text-purple-700 border-purple-200',     emoji: '🧹' },
  Otro:        { cls: 'bg-slate-50 text-slate-600 border-slate-200',        emoji: '🔧' },
};

const MOV_CFG: Record<MovType, { label: string; cls: string; icon: React.ReactNode; sign: '+' | '-' }> = {
  entrada: { label: 'Entrada',  cls: 'text-emerald-700 bg-emerald-50 border-emerald-200', icon: <ArrowUpCircle size={13} />,   sign: '+' },
  salida:  { label: 'Salida',   cls: 'text-rose-700 bg-rose-50 border-rose-200',           icon: <ArrowDownCircle size={13} />, sign: '-' },
  ajuste:  { label: 'Ajuste',   cls: 'text-indigo-700 bg-indigo-50 border-indigo-200',    icon: <RotateCcw size={13} />,       sign: '+' },
  merma:   { label: 'Merma',    cls: 'text-amber-700 bg-amber-50 border-amber-200',       icon: <Trash2 size={13} />,          sign: '-' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const aiRef = { current: null as GoogleGenAI | null };
function getAI() {
  if (!aiRef.current) aiRef.current = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || '' });
  return aiRef.current;
}

function uid() { return Math.random().toString(36).slice(2, 10); }
function fmtEur(n: number) { return n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' }); }
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
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
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[500] flex flex-col gap-2 items-center pointer-events-none">
      <AnimatePresence>
        {toasts.map(t => (
          <motion.div key={t.id}
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.9 }}
            className={cn('px-5 py-3 rounded-2xl text-sm font-bold shadow-2xl flex items-center gap-2',
              t.type === 'ok' ? 'bg-slate-900 text-white' :
              t.type === 'warn' ? 'bg-amber-500 text-white' : 'bg-rose-500 text-white'
            )}
          >
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
    if (!SR) { alert('Necesitas Chrome para el micrófono'); return; }
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

function VoiceField({ value, onChange, placeholder, type = 'text', className = '' }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string; className?: string;
}) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
      <VoiceButton onResult={onChange} small />
    </div>
  );
}

// ─── Stock Level Bar ──────────────────────────────────────────────────────────
function StockBar({ current, min }: { current: number; min: number }) {
  const pct = min > 0 ? Math.min((current / (min * 2)) * 100, 100) : current > 0 ? 100 : 0;
  const critical = current <= min;
  const low = current <= min * 1.5;
  return (
    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden w-full mt-1">
      <div
        className={cn('h-full rounded-full transition-all', critical ? 'bg-rose-400' : low ? 'bg-amber-400' : 'bg-emerald-400')}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon, alert = false }: {
  label: string; value: string | number; sub: string; icon: React.ReactNode; alert?: boolean;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      className={cn('bg-white rounded-3xl p-5 border shadow-sm relative overflow-hidden',
        alert ? 'border-rose-200 shadow-rose-50' : 'border-slate-200'
      )}>
      {alert && <span className="absolute top-3 right-3 w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse shadow-lg shadow-rose-300" />}
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</span>
        <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center">{icon}</div>
      </div>
      <p className={cn('text-2xl font-black', alert ? 'text-rose-600' : 'text-slate-900')}>{value}</p>
      <p className="text-xs text-slate-400 mt-1">{sub}</p>
    </motion.div>
  );
}

// ─── Quick Movement Modal ─────────────────────────────────────────────────────
function QuickMovModal({
  item, onClose, onSave, employeeName
}: {
  item: StockItem; onClose: () => void; onSave: () => void; employeeName: string;
}) {
  const [type, setType] = useState<MovType>('entrada');
  const [qty, setQty] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [reason, setReason] = useState('');
  const [ref, setRef] = useState('');
  const [saving, setSaving] = useState(false);
  const { show: toast } = useToast();

  // Voz rápida para cantidad
  const [qtyOn, setQtyOn] = useState(false);
  const qtyRef = useRef<SpeechRecognition | null>(null);
  function toggleQtyVoice() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    if (qtyOn) { qtyRef.current?.stop(); setQtyOn(false); return; }
    const r = new SR(); qtyRef.current = r;
    r.lang = 'es-ES'; r.continuous = false; r.interimResults = false;
    r.onstart = () => setQtyOn(true);
    r.onresult = (e: SpeechRecognitionEvent) => {
      const text = e.results[0][0].transcript;
      // Extraer número del texto hablado
      const num = text.match(/[\d.,]+/)?.[0]?.replace(',', '.');
      if (num) setQty(num);
    };
    r.onerror = r.onend = () => setQtyOn(false);
    r.start();
  }

  async function save() {
    const q = parseFloat(qty);
    if (!q || q <= 0) { alert('Cantidad debe ser mayor que 0'); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from('stock_movements').insert({
        stock_item_id: item.id, type, quantity: q,
        unit_cost: parseFloat(unitCost) || null,
        reason: reason || null, reference: ref || null,
        created_by: employeeName || 'Sistema',
      });
      if (error) throw error;
      onSave();
      onClose();
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally { setSaving(false); }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
    >
      <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
        className="bg-white w-full max-w-md rounded-[2.5rem] p-6 space-y-5 shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Movimiento rápido</p>
            <h3 className="text-xl font-black text-slate-900">{item.name}</h3>
            <p className="text-sm text-slate-400">Stock actual: <strong>{item.current_stock} {item.unit}</strong></p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 transition-all"><X size={18} /></button>
        </div>

        {/* Tipo */}
        <div className="grid grid-cols-4 gap-2">
          {(Object.entries(MOV_CFG) as [MovType, typeof MOV_CFG[MovType]][]).map(([k, v]) => (
            <button key={k} onClick={() => setType(k)}
              className={cn('flex flex-col items-center py-2.5 px-1 rounded-2xl border text-[11px] font-bold transition-all gap-1',
                type === k ? v.cls : 'border-slate-200 text-slate-400 hover:border-slate-300'
              )}>
              {v.icon}{v.label}
            </button>
          ))}
        </div>

        {/* Cantidad con voz */}
        <div className="space-y-1.5">
          <label className="text-xs font-black uppercase tracking-widest text-slate-400">Cantidad ({item.unit}) *</label>
          <div className="flex items-center gap-2">
            <input type="number" min="0" step="0.01" value={qty} onChange={e => setQty(e.target.value)}
              placeholder="0"
              className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-right font-bold focus:outline-none focus:ring-2 focus:ring-indigo-300 text-lg"
              autoFocus
            />
            <button onClick={toggleQtyVoice}
              className={cn('p-3 rounded-xl transition-all shrink-0',
                qtyOn ? 'bg-rose-500 text-white animate-pulse shadow-lg' : 'bg-indigo-100 text-indigo-600 hover:bg-indigo-200'
              )}>
              {qtyOn ? <MicOff size={18} /> : <Mic size={18} />}
            </button>
          </div>
          {qtyOn && (
            <p className="text-xs text-rose-500 animate-pulse flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-rose-500 rounded-full" /> Di el número en voz alta…
            </p>
          )}
        </div>

        {/* Coste unitario */}
        <div className="space-y-1.5">
          <label className="text-xs font-black uppercase tracking-widest text-slate-400">Coste unitario (€)</label>
          <input type="number" min="0" step="0.01" value={unitCost} onChange={e => setUnitCost(e.target.value)}
            placeholder="0.00"
            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 text-right"
          />
        </div>

        {/* Razón */}
        <div className="space-y-1.5">
          <label className="text-xs font-black uppercase tracking-widest text-slate-400">Razón</label>
          <VoiceField value={reason} onChange={setReason} placeholder="Compra semanal, merma caducidad…" />
        </div>

        {/* Referencia */}
        <div className="space-y-1.5">
          <label className="text-xs font-black uppercase tracking-widest text-slate-400">Referencia (albarán…)</label>
          <VoiceField value={ref} onChange={setRef} placeholder="Nº albarán, factura…" />
        </div>

        <div className="flex gap-3 pt-2">
          <button onClick={onClose}
            className="flex-1 py-3 border border-slate-200 rounded-2xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all">
            Cancelar
          </button>
          <button onClick={save} disabled={saving}
            className={cn(
              'flex-1 py-3 text-white rounded-2xl text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-lg',
              type === 'entrada' ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200' :
              type === 'salida' ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-200' :
              type === 'merma' ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-200' :
              'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'
            )}>
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            {MOV_CFG[type].label}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function StockView() {
  const { employee } = useSupabase();
  const isAdmin = (employee as any)?.rol === 'admin';
  const { show: toast, ToastContainer } = useToast();

  const [items, setItems] = useState<StockItem[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>('inventario');
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState<Category | 'Todos'>('Todos');
  const [showLowOnly, setShowLowOnly] = useState(false);

  // AI
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const photoRef = useRef<HTMLInputElement>(null);

  // Item form
  const [showItemForm, setShowItemForm] = useState(false);
  const [editItem, setEditItem] = useState<StockItem | null>(null);
  const [itemSaving, setItemSaving] = useState(false);
  const emptyItemForm = () => ({
    name: '', category: 'Comida' as Category, unit: 'kg', current_stock: 0,
    min_stock: 0, price_per_unit: 0, supplier_id: '', location: '', notes: '',
  });
  const [itemForm, setItemForm] = useState(emptyItemForm());

  // Quick movement
  const [movItem, setMovItem] = useState<StockItem | null>(null);

  // ── Load ──────────────────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    setLoading(true);
    const [it, mv, sp] = await Promise.all([
      supabase.from('stock_items').select('*').eq('active', true).order('name'),
      supabase.from('stock_movements').select('*').order('created_at', { ascending: false }).limit(200),
      supabase.from('suppliers').select('id,nombre').order('nombre'),
    ]);
    if (it.data) setItems(it.data as StockItem[]);
    if (mv.data) setMovements(mv.data as StockMovement[]);
    if (sp.data) setSuppliers(sp.data as Supplier[]);
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Filtered ──────────────────────────────────────────────────────────────
  const filtered = items.filter(item => {
    const q = search.toLowerCase();
    const matchQ = !q || item.name.toLowerCase().includes(q) || item.location?.toLowerCase().includes(q);
    const matchCat = filterCat === 'Todos' || item.category === filterCat;
    const matchLow = !showLowOnly || item.current_stock <= item.min_stock;
    return matchQ && matchCat && matchLow;
  });

  // ── Stats ─────────────────────────────────────────────────────────────────
  const lowStockCount = items.filter(i => i.current_stock <= i.min_stock).length;
  const totalValue = items.reduce((s, i) => s + i.current_stock * i.price_per_unit, 0);
  const todayMov = movements.filter(m => m.created_at?.startsWith(new Date().toISOString().split('T')[0])).length;

  // ── Save item ─────────────────────────────────────────────────────────────
  async function saveItem() {
    if (!itemForm.name.trim()) { toast('El nombre es obligatorio', 'err'); return; }
    setItemSaving(true);
    try {
      const payload = {
        name: itemForm.name.trim(),
        category: itemForm.category,
        unit: itemForm.unit,
        current_stock: Number(itemForm.current_stock),
        min_stock: Number(itemForm.min_stock),
        price_per_unit: Number(itemForm.price_per_unit),
        supplier_id: itemForm.supplier_id || null,
        location: itemForm.location || null,
        notes: itemForm.notes || null,
        active: true,
        last_updated: new Date().toISOString(),
      };
      if (editItem) {
        const { error } = await supabase.from('stock_items').update(payload).eq('id', editItem.id);
        if (error) throw error;
        toast('Producto actualizado ✓');
      } else {
        const { error } = await supabase.from('stock_items').insert(payload);
        if (error) throw error;
        toast('Producto añadido ✓');
      }
      setShowItemForm(false);
      setEditItem(null);
      setItemForm(emptyItemForm());
      await loadAll();
    } catch (err: any) {
      toast('Error: ' + err.message, 'err');
    } finally { setItemSaving(false); }
  }

  async function deleteItem(id: string) {
    if (!confirm('¿Eliminar este producto? Se ocultará del inventario.')) return;
    const { error } = await supabase.from('stock_items').update({ active: false }).eq('id', id);
    if (error) { toast('Error al eliminar', 'err'); return; }
    setItems(prev => prev.filter(i => i.id !== id));
    toast('Producto eliminado');
  }

  // ── Photo scan — escanea ticket/albarán para añadir producto ─────────────
  async function handlePhotoScan(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAiLoading(true);
    try {
      const base64 = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res((r.result as string).split(',')[1]);
        r.onerror = rej;
        r.readAsDataURL(file);
      });
      const result = await getAI().models.generateContent({
        model: 'gemini-2.0-flash',
        contents: [{
          role: 'user', parts: [
            { inlineData: { mimeType: file.type, data: base64 } },
            {
              text: `Eres el jefe de almacén de un restaurante. Analiza esta imagen (ticket, albarán, etiqueta de producto o foto del almacén).
Extrae los productos y devuelve SOLO un JSON array válido:
[{"name":"string","unit":"kg|g|l|ml|ud|caja","quantity":number,"price":number,"category":"Comida|Bebida|Suministros|Limpieza|Otro"}]
Si no puedes leer el precio, pon 0. Solo JSON, sin markdown.`
            }
          ]
        }]
      });
      const raw = result.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
      const match = raw.match(/\[[\s\S]*\]/);
      if (match) {
        const products = JSON.parse(match[0]);
        if (products.length > 0) {
          const first = products[0];
          setItemForm({
            name: first.name || '',
            category: (CATS.includes(first.category) ? first.category : 'Comida') as Category,
            unit: first.unit || 'kg',
            current_stock: first.quantity || 0,
            min_stock: 0,
            price_per_unit: first.price || 0,
            supplier_id: '',
            location: '',
            notes: products.length > 1 ? `También detectado: ${products.slice(1).map((p: any) => p.name).join(', ')}` : '',
          });
          setEditItem(null);
          setShowItemForm(true);
          toast(`📸 ${products.length} producto(s) detectado(s) — revisa y guarda`, 'warn');
        } else {
          toast('No se detectaron productos en la imagen', 'err');
        }
      }
    } catch (err: any) {
      toast('Error al leer la imagen', 'err');
    } finally {
      setAiLoading(false);
      if (photoRef.current) photoRef.current.value = '';
    }
  }

  // ── AI Analysis ───────────────────────────────────────────────────────────
  async function handleAIAnalysis() {
    setAiLoading(true); setAiResult(null);
    try {
      const lowStock = items
        .filter(i => i.current_stock <= i.min_stock)
        .map(i => `${i.name} (${i.current_stock}/${i.min_stock} ${i.unit})`)
        .join(', ') || 'ninguno';
      const topItems = items.slice(0, 15).map(i => `${i.name}: ${i.current_stock} ${i.unit}`).join(', ');
      const res = await getAI().models.generateContent({
        model: 'gemini-2.0-flash',
        contents: [{
          role: 'user', parts: [{
            text: `Eres el jefe de almacén de un restaurante. Analiza este inventario y da recomendaciones concretas y accionables en español.
Stock bajo o crítico: ${lowStock}
Inventario general: ${topItems}
Total productos: ${items.length}, Valor total: ${fmtEur(totalValue)}

Da exactamente 4-5 recomendaciones con este formato:
• [URGENTE/ACCIÓN/INFO] Recomendación concreta y específica

Sé directo y práctico, máximo 2 líneas por punto.`
          }]
        }]
      });
      setAiResult(res.candidates?.[0]?.content?.parts?.[0]?.text || 'Sin respuesta');
    } catch (err: any) {
      setAiResult('Error al conectar con la IA: ' + err.message);
    } finally { setAiLoading(false); }
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#F8FAFC] p-4 md:p-8 space-y-6">
      <ToastContainer />
      <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoScan} />

      {/* ── Header ── */}
      <header className="sticky top-4 z-[100] bg-white/80 backdrop-blur-xl border border-white/20 shadow-xl rounded-[2.5rem] p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-2xl shadow-lg">
            <Package className="w-5 h-5 text-emerald-400" />
            <span className="font-black text-sm tracking-tighter uppercase">Inventario</span>
          </div>
          {lowStockCount > 0 && (
            <motion.button
              initial={{ scale: 0 }} animate={{ scale: 1 }}
              onClick={() => setShowLowOnly(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-rose-50 border border-rose-200 text-rose-600 rounded-2xl text-xs font-bold hover:bg-rose-100 transition-all"
            >
              <AlertTriangle size={13} />
              {lowStockCount} stock bajo
            </motion.button>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => photoRef.current?.click()} disabled={aiLoading}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-2xl text-xs font-bold hover:bg-purple-700 transition-all shadow-sm disabled:opacity-50">
            {aiLoading ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
            Escanear
          </button>
          <button onClick={handleAIAnalysis} disabled={aiLoading}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-2xl text-xs font-bold hover:bg-indigo-700 transition-all shadow-sm disabled:opacity-50">
            {aiLoading ? <Loader2 size={14} className="animate-spin" /> : <Brain size={14} />}
            Analizar IA
          </button>
          <button onClick={() => { setItemForm(emptyItemForm()); setEditItem(null); setShowItemForm(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-2xl text-xs font-bold hover:bg-emerald-700 transition-all shadow-sm shadow-emerald-200">
            <Plus size={14} /> Nuevo producto
          </button>
        </div>
      </header>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total productos" value={items.length} sub="En inventario activo"
          icon={<Package size={16} className="text-indigo-400" />} />
        <StatCard label="Stock bajo" value={lowStockCount} sub="Por debajo del mínimo"
          icon={<AlertTriangle size={16} className="text-rose-400" />} alert={lowStockCount > 0} />
        <StatCard label="Valor inventario" value={fmtEur(totalValue)} sub="Coste total en almacén"
          icon={<TrendingUp size={16} className="text-emerald-400" />} />
        <StatCard label="Movimientos hoy" value={todayMov} sub="Entradas y salidas"
          icon={<History size={16} className="text-amber-400" />} />
      </div>

      {/* ── AI Result Banner ── */}
      <AnimatePresence>
        {aiResult && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="bg-indigo-50 border border-indigo-200 rounded-3xl p-5 relative">
            <button onClick={() => setAiResult(null)} className="absolute top-3 right-3 p-1.5 rounded-xl hover:bg-indigo-100 text-slate-400 transition-all">
              <X size={16} />
            </button>
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 bg-indigo-100 rounded-2xl flex items-center justify-center shrink-0">
                <Brain size={18} className="text-indigo-600" />
              </div>
              <div>
                <p className="font-black text-indigo-800 mb-2 text-sm">Análisis IA del inventario</p>
                <pre className="text-slate-700 text-sm whitespace-pre-wrap font-sans leading-relaxed">{aiResult}</pre>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Tabs ── */}
      <div className="flex bg-white border border-slate-200 rounded-2xl p-1 w-fit shadow-sm gap-1">
        {([
          { id: 'inventario', label: 'Inventario', icon: Package },
          { id: 'movimientos', label: 'Movimientos', icon: History },
          { id: 'analitica', label: 'Analítica', icon: BarChart3 },
        ] as const).map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={cn('flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all',
              activeTab === t.id ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-700'
            )}>
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* TAB: INVENTARIO */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'inventario' && (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-[200px] bg-white border border-slate-200 rounded-2xl px-4 py-2.5 shadow-sm">
              <Search size={16} className="text-slate-400 shrink-0" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar producto…"
                className="flex-1 text-sm bg-transparent outline-none placeholder:text-slate-400" />
              <VoiceButton onResult={setSearch} small />
            </div>

            <div className="flex bg-white border border-slate-200 rounded-2xl p-1 gap-1 shadow-sm flex-wrap">
              {(['Todos', ...CATS] as const).map(c => (
                <button key={c} onClick={() => setFilterCat(c as any)}
                  className={cn('px-3 py-1.5 rounded-xl text-xs font-bold transition-all',
                    filterCat === c ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-800'
                  )}>
                  {c === 'Todos' ? 'Todos' : `${CAT_CFG[c as Category].emoji} ${c}`}
                </button>
              ))}
            </div>

            <button onClick={() => setShowLowOnly(!showLowOnly)}
              className={cn('flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold border transition-all',
                showLowOnly ? 'bg-rose-600 text-white border-rose-600' : 'bg-white border-slate-200 text-slate-600 hover:border-rose-300'
              )}>
              <AlertTriangle size={13} /> Stock bajo
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={32} className="animate-spin text-indigo-400" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-20 h-20 bg-slate-100 rounded-[2rem] flex items-center justify-center mb-4 text-slate-300">
                <Package size={40} />
              </div>
              <p className="text-slate-400 font-bold">Sin productos{search ? ` con "${search}"` : ''}</p>
              <button onClick={() => { setItemForm(emptyItemForm()); setEditItem(null); setShowItemForm(true); }}
                className="mt-4 flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-2xl text-sm font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200">
                <Plus size={15} /> Añadir producto
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filtered.map(item => {
                const critical = item.current_stock <= item.min_stock;
                const low = item.current_stock <= item.min_stock * 1.5;
                const catCfg = CAT_CFG[item.category];
                return (
                  <motion.div key={item.id} layout
                    className={cn(
                      'bg-white rounded-3xl border p-5 shadow-sm hover:shadow-md transition-all group',
                      critical ? 'border-rose-200 shadow-rose-50' : 'border-slate-200'
                    )}
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-black text-slate-900 text-sm leading-tight truncate">{item.name}</h3>
                        {item.location && (
                          <p className="text-[11px] text-slate-400 mt-0.5">📍 {item.location}</p>
                        )}
                      </div>
                      <span className={cn('text-[10px] font-black px-2 py-0.5 rounded-lg border ml-2 shrink-0', catCfg.cls)}>
                        {catCfg.emoji}
                      </span>
                    </div>

                    {/* Stock */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className={cn('text-2xl font-black', critical ? 'text-rose-600' : low ? 'text-amber-600' : 'text-slate-900')}>
                          {item.current_stock}
                        </span>
                        <span className="text-sm text-slate-400 font-medium">{item.unit}</span>
                      </div>
                      <StockBar current={item.current_stock} min={item.min_stock} />
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span>mín. {item.min_stock} {item.unit}</span>
                        <span>{fmtEur(item.price_per_unit)}/{item.unit}</span>
                      </div>
                    </div>

                    {critical && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className="flex items-center gap-1.5 mt-3 px-3 py-1.5 bg-rose-50 border border-rose-200 rounded-xl">
                        <AlertTriangle size={11} className="text-rose-500 shrink-0" />
                        <span className="text-[11px] font-bold text-rose-600">Stock crítico — reponer urgente</span>
                      </motion.div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-2 mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => setMovItem(item)}
                        className="flex-1 flex items-center justify-center gap-1 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all shadow-sm shadow-indigo-200">
                        <Zap size={12} /> Movimiento
                      </button>
                      <button onClick={() => {
                        setItemForm({
                          name: item.name, category: item.category, unit: item.unit,
                          current_stock: item.current_stock, min_stock: item.min_stock,
                          price_per_unit: item.price_per_unit,
                          supplier_id: item.supplier_id || '',
                          location: item.location || '',
                          notes: item.notes || '',
                        });
                        setEditItem(item);
                        setShowItemForm(true);
                      }} className="p-2 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all">
                        <Edit2 size={14} />
                      </button>
                      {isAdmin && (
                        <button onClick={() => deleteItem(item.id)}
                          className="p-2 rounded-xl bg-rose-50 text-rose-500 hover:bg-rose-100 transition-all">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* TAB: MOVIMIENTOS */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'movimientos' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <p className="text-sm text-slate-500 font-medium">
              Últimos <strong>{movements.length}</strong> movimientos
            </p>
            <button onClick={() => {
              const topItem = items[0];
              if (topItem) setMovItem(topItem);
            }} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-2xl text-xs font-bold hover:bg-indigo-700 transition-all shadow-sm">
              <Plus size={13} /> Nuevo movimiento
            </button>
          </div>

          {movements.length === 0 ? (
            <div className="text-center py-20">
              <History size={40} className="mx-auto text-slate-200 mb-4" />
              <p className="text-slate-400 font-medium">Sin movimientos registrados</p>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                      <th className="px-5 py-3 text-left">Producto</th>
                      <th className="px-4 py-3 text-left">Tipo</th>
                      <th className="px-4 py-3 text-right">Cant.</th>
                      <th className="px-4 py-3 text-right">Coste</th>
                      <th className="px-4 py-3 text-left">Razón</th>
                      <th className="px-4 py-3 text-left">Referencia</th>
                      <th className="px-4 py-3 text-left">Fecha</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {movements.map(mv => {
                      const item = items.find(i => i.id === mv.stock_item_id);
                      const cfg = MOV_CFG[mv.type];
                      return (
                        <tr key={mv.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-5 py-3 font-medium text-slate-700">{item?.name || '—'}</td>
                          <td className="px-4 py-3">
                            <span className={cn('px-2.5 py-1 rounded-xl border text-[11px] font-black flex items-center gap-1 w-fit', cfg.cls)}>
                              {cfg.icon} {cfg.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-slate-900">
                            <span className={mv.type === 'entrada' ? 'text-emerald-600' : 'text-rose-500'}>
                              {cfg.sign}{mv.quantity}
                            </span>
                            {' '}{item?.unit}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-500">
                            {mv.unit_cost ? fmtEur(mv.unit_cost) : '—'}
                          </td>
                          <td className="px-4 py-3 text-slate-500 text-xs">{mv.reason || '—'}</td>
                          <td className="px-4 py-3 text-slate-500 text-xs">{mv.reference || '—'}</td>
                          <td className="px-4 py-3 text-slate-400 text-xs">{fmtDate(mv.created_at)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* TAB: ANALÍTICA */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'analitica' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Por categoría */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
            <h3 className="font-black text-slate-900">Valor por categoría</h3>
            {CATS.map(cat => {
              const catItems = items.filter(i => i.category === cat);
              const val = catItems.reduce((s, i) => s + i.current_stock * i.price_per_unit, 0);
              const pct = totalValue > 0 ? (val / totalValue) * 100 : 0;
              const cfg = CAT_CFG[cat];
              return (
                <div key={cat} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-bold text-slate-700">{cfg.emoji} {cat}</span>
                    <span className="font-black text-slate-900">{fmtEur(val)}</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                      transition={{ delay: 0.1, duration: 0.6, ease: 'easeOut' }}
                      className="h-full rounded-full bg-indigo-400"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400">{catItems.length} productos · {pct.toFixed(1)}%</p>
                </div>
              );
            })}
          </div>

          {/* Stock crítico */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-slate-900">Stock crítico</h3>
              <span className="text-xs font-bold text-rose-600 bg-rose-50 px-3 py-1 rounded-xl border border-rose-200">
                {lowStockCount} productos
              </span>
            </div>
            {items.filter(i => i.current_stock <= i.min_stock).length === 0 ? (
              <div className="flex flex-col items-center py-8 text-center">
                <CheckCircle2 size={32} className="text-emerald-400 mb-3" />
                <p className="font-bold text-emerald-600">¡Todo el stock está bien!</p>
                <p className="text-xs text-slate-400 mt-1">Ningún producto por debajo del mínimo</p>
              </div>
            ) : (
              <div className="space-y-2">
                {items
                  .filter(i => i.current_stock <= i.min_stock)
                  .sort((a, b) => (a.current_stock / Math.max(a.min_stock, 0.01)) - (b.current_stock / Math.max(b.min_stock, 0.01)))
                  .map(item => (
                    <div key={item.id}
                      className="flex items-center justify-between px-4 py-3 bg-rose-50 border border-rose-200 rounded-2xl cursor-pointer hover:bg-rose-100 transition-all"
                      onClick={() => setMovItem(item)}
                    >
                      <div>
                        <p className="font-bold text-rose-800 text-sm">{item.name}</p>
                        <p className="text-xs text-rose-500">{item.current_stock}/{item.min_stock} {item.unit}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <ShoppingCart size={14} className="text-rose-400" />
                        <span className="text-xs font-bold text-rose-500">Reponer →</span>
                      </div>
                    </div>
                  ))
                }
              </div>
            )}
          </div>

          {/* Movimientos recientes por tipo */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4 md:col-span-2">
            <h3 className="font-black text-slate-900">Movimientos últimos 7 días</h3>
            <div className="grid grid-cols-4 gap-3">
              {(Object.entries(MOV_CFG) as [MovType, typeof MOV_CFG[MovType]][]).map(([type, cfg]) => {
                const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
                const count = movements.filter(m => m.type === type && m.created_at >= cutoff).length;
                const total = movements.filter(m => m.type === type && m.created_at >= cutoff).reduce((s, m) => s + m.quantity, 0);
                return (
                  <div key={type} className={cn('rounded-2xl border p-4 text-center', cfg.cls)}>
                    <div className="flex justify-center mb-2">{cfg.icon}</div>
                    <p className="text-2xl font-black">{count}</p>
                    <p className="text-[11px] font-bold mt-0.5 opacity-70">{cfg.label}</p>
                    <p className="text-[10px] opacity-60">{total.toFixed(1)} uds.</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Quick Movement Modal ── */}
      <AnimatePresence>
        {movItem && (
          <QuickMovModal
            item={movItem}
            onClose={() => setMovItem(null)}
            onSave={loadAll}
            employeeName={(employee as any)?.nombre || 'Sistema'}
          />
        )}
      </AnimatePresence>

      {/* ── Item Form Modal ── */}
      <AnimatePresence>
        {showItemForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ y: 40, opacity: 0, scale: 0.97 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 40, opacity: 0, scale: 0.97 }}
              className="bg-white w-full max-w-lg rounded-[2.5rem] flex flex-col max-h-[90vh] overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between shrink-0">
                <h2 className="text-xl font-black text-slate-900">
                  {editItem ? 'Editar producto' : 'Nuevo producto'}
                </h2>
                <button onClick={() => { setShowItemForm(false); setEditItem(null); }} className="p-2 rounded-xl hover:bg-slate-100 transition-all">
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400">Nombre *</label>
                  <VoiceField value={itemForm.name} onChange={v => setItemForm(f => ({ ...f, name: v }))} placeholder="Ej: Solomillo de ternera" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Categoría</label>
                    <select value={itemForm.category} onChange={e => setItemForm(f => ({ ...f, category: e.target.value as Category }))}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
                      {CATS.map(c => <option key={c} value={c}>{CAT_CFG[c].emoji} {c}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Unidad</label>
                    <select value={itemForm.unit} onChange={e => setItemForm(f => ({ ...f, unit: e.target.value }))}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
                      {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Stock actual</label>
                    <input type="number" min="0" step="0.01" value={itemForm.current_stock}
                      onChange={e => setItemForm(f => ({ ...f, current_stock: parseFloat(e.target.value) || 0 }))}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 text-right" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Mínimo</label>
                    <input type="number" min="0" step="0.01" value={itemForm.min_stock}
                      onChange={e => setItemForm(f => ({ ...f, min_stock: parseFloat(e.target.value) || 0 }))}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 text-right" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Precio/ud (€)</label>
                    <input type="number" min="0" step="0.01" value={itemForm.price_per_unit}
                      onChange={e => setItemForm(f => ({ ...f, price_per_unit: parseFloat(e.target.value) || 0 }))}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 text-right" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400">Proveedor</label>
                  <select value={itemForm.supplier_id} onChange={e => setItemForm(f => ({ ...f, supplier_id: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
                    <option value="">— Sin proveedor asignado —</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400">Ubicación</label>
                  <VoiceField value={itemForm.location} onChange={v => setItemForm(f => ({ ...f, location: v }))} placeholder="Ej: Cámara frigorífica A, Almacén 2…" />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400">Notas</label>
                  <div className="flex items-start gap-2">
                    <textarea value={itemForm.notes} onChange={e => setItemForm(f => ({ ...f, notes: e.target.value }))}
                      placeholder="Observaciones, instrucciones de almacenaje…" rows={2}
                      className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                    <VoiceButton onResult={v => setItemForm(f => ({ ...f, notes: v }))} small className="mt-1" />
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-slate-100 flex gap-3 shrink-0">
                <button onClick={() => { setShowItemForm(false); setEditItem(null); }}
                  className="flex-1 py-3 border border-slate-200 rounded-2xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all">
                  Cancelar
                </button>
                <button onClick={saveItem} disabled={itemSaving}
                  className="flex-1 py-3 bg-emerald-600 text-white rounded-2xl text-sm font-bold hover:bg-emerald-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-200">
                  {itemSaving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                  {editItem ? 'Actualizar' : 'Guardar producto'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
