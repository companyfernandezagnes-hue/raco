// src/components/compras/AlbaranesView.tsx
// ✅ 100% Supabase — sin Firebase, sin datos hardcoded
// ✅ Voz en todos los campos, foto/cámara IA, interfaz simplificada Gen Z
// ✅ Notificaciones toast nativas, confirmaciones visuales
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Package, Plus, Mic, MicOff, Camera, Loader2, X, Check,
  ChevronDown, ChevronUp, Trash2, Sparkles, Search, Filter,
  AlertTriangle, CheckCircle2, Clock, Truck, FileText, Edit2,
  MoreVertical, Image as ImageIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../supabase';
import { useSupabase } from '../../context/SupabaseContext';
import { GoogleGenAI } from '@google/genai';
import { cn } from '../../lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────
type IVARate = 4 | 10 | 21;
type Estado = 'pendiente' | 'recibido' | 'facturado' | 'rechazado';

interface AlbaranItem {
  id: string;
  descripcion: string;
  cantidad: number;
  unidad: string;
  precio_unitario: number;
  iva: IVARate;
  base: number;
  iva_amount: number;
  total: number;
}

interface Albaran {
  id: string;
  referencia?: string;
  fecha: string;
  supplier_name: string;
  proveedor_id?: string;
  estado: Estado;
  base: number;
  iva_total: number;
  total: number;
  items: AlbaranItem[];
  notas?: string;
  empleado_id?: string;
  imagen_url?: string;
  created_at: string;
}

interface Supplier { id: string; nombre: string; activo: boolean; }

// ─── Helpers ──────────────────────────────────────────────────────────────────
const aiRef = { current: null as GoogleGenAI | null };
function getAI(): GoogleGenAI {
  if (!aiRef.current) aiRef.current = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || '' });
  return aiRef.current;
}

function uid() { return Math.random().toString(36).slice(2, 10); }
function today() { return new Date().toISOString().split('T')[0]; }
function fmtEur(n: number) { return n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' }); }
function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

function calcItem(item: Omit<AlbaranItem, 'base' | 'iva_amount' | 'total'>): AlbaranItem {
  const base = item.cantidad * item.precio_unitario;
  const iva_amount = base * (item.iva / 100);
  return { ...item, base, iva_amount, total: base + iva_amount };
}

function calcTotals(items: AlbaranItem[]) {
  return {
    base: items.reduce((s, i) => s + i.base, 0),
    iva_total: items.reduce((s, i) => s + i.iva_amount, 0),
    total: items.reduce((s, i) => s + i.total, 0),
  };
}

function parseAIItems(rawItems: any[]): AlbaranItem[] {
  return rawItems.map(it => calcItem({
    id: uid(),
    descripcion: it.descripcion || '',
    cantidad: parseFloat(it.cantidad) || 1,
    unidad: it.unidad || 'ud',
    precio_unitario: parseFloat(it.precio_unitario) || 0,
    iva: ([4, 10, 21].includes(Number(it.iva)) ? Number(it.iva) : 10) as IVARate,
  }));
}

function matchSupplier(name: string, suppliers: Supplier[]): Supplier | undefined {
  const n = (name || '').toLowerCase();
  return suppliers.find(s => s.nombre.toLowerCase().includes(n) || n.includes(s.nombre.toLowerCase()));
}

const ESTADO_CFG: Record<Estado, { label: string; cls: string; icon: React.ReactNode }> = {
  pendiente:  { label: 'Pendiente',  cls: 'text-amber-700 bg-amber-50 border-amber-200',   icon: <Clock size={12} /> },
  recibido:   { label: 'Recibido',   cls: 'text-blue-700 bg-blue-50 border-blue-200',       icon: <Truck size={12} /> },
  facturado:  { label: 'Facturado',  cls: 'text-emerald-700 bg-emerald-50 border-emerald-200', icon: <CheckCircle2 size={12} /> },
  rechazado:  { label: 'Rechazado',  cls: 'text-rose-700 bg-rose-50 border-rose-200',       icon: <AlertTriangle size={12} /> },
};

// ─── Toast ────────────────────────────────────────────────────────────────────
function useToast() {
  const [toasts, setToasts] = useState<{ id: string; msg: string; type: 'ok' | 'err' }[]>([]);
  const show = useCallback((msg: string, type: 'ok' | 'err' = 'ok') => {
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
            className={cn(
              'px-5 py-3 rounded-2xl text-sm font-bold shadow-2xl flex items-center gap-2',
              t.type === 'ok' ? 'bg-slate-900 text-white' : 'bg-rose-500 text-white'
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
    if (!SR) { alert('Necesitas Chrome para usar el micrófono'); return; }
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
      className={cn(
        `${small ? 'p-1.5' : 'p-2.5'} rounded-xl transition-all shrink-0`,
        on ? 'bg-rose-500 text-white animate-pulse shadow-lg shadow-rose-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200',
        className
      )}
      title={on ? 'Parar grabación' : 'Dictar por voz'}
    >
      {on ? <MicOff size={sz} /> : <Mic size={sz} />}
    </button>
  );
}

// ─── VoiceField: input + botón de voz integrado ────────────────────────────
function VoiceField({
  value, onChange, placeholder, type = 'text', className = ''
}: {
  value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; className?: string;
}) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-all"
      />
      <VoiceButton onResult={onChange} small />
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────
function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-20 h-20 bg-slate-100 rounded-[2rem] flex items-center justify-center mb-6 text-slate-300">
        <Package size={40} />
      </div>
      <h3 className="text-xl font-black text-slate-300 uppercase tracking-tight">Sin albaranes</h3>
      <p className="text-slate-400 text-sm font-medium mt-2 mb-6 max-w-xs">
        Añade tu primer albarán por voz, foto o manual
      </p>
      <button onClick={onNew}
        className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold text-sm hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200">
        <Plus size={16} /> Nuevo albarán
      </button>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function AlbaranesView({ onStatsChange }: { onStatsChange?: () => void }) {
  const { user } = useSupabase() as any;
  const { show: toast, ToastContainer } = useToast();

  const [albaranes, setAlbaranes] = useState<Albaran[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterEstado, setFilterEstado] = useState<Estado | 'todos'>('todos');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Modal
  const [showForm, setShowForm] = useState(false);
  const [inputMode, setInputMode] = useState<'quick' | 'photo' | 'manual'>('quick');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Quick / voice
  const [quickText, setQuickText] = useState('');
  const [quickOn, setQuickOn] = useState(false);
  const [quickBusy, setQuickBusy] = useState(false);
  const quickRef = useRef<SpeechRecognition | null>(null);

  // Photo
  const [preview, setPreview] = useState<string | null>(null);
  const [scanFile, setScanFile] = useState<File | null>(null);
  const [scanning, setScanning] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Pending confirm
  const [pending, setPending] = useState<ReturnType<typeof emptyForm> | null>(null);

  // Form
  const emptyForm = () => ({
    referencia: '', fecha: today(), supplier_name: '', proveedor_id: undefined as string | undefined,
    estado: 'pendiente' as Estado, notas: '', items: [] as AlbaranItem[], imagen_url: undefined as string | undefined,
  });
  const [form, setForm] = useState(emptyForm());

  // ── Load ──────────────────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    setLoading(true);
    const [a, s] = await Promise.all([
      supabase.from('delivery_notes').select('*').order('created_at', { ascending: false }),
      supabase.from('suppliers').select('id,nombre,activo').eq('activo', true).order('nombre'),
    ]);
    if (a.data) setAlbaranes(a.data as Albaran[]);
    if (s.data) setSuppliers(s.data as Supplier[]);
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Filtered list ─────────────────────────────────────────────────────────
  const filtered = albaranes.filter(a => {
    const q = search.toLowerCase();
    return (!q || a.referencia?.toLowerCase().includes(q) || a.supplier_name?.toLowerCase().includes(q))
      && (filterEstado === 'todos' || a.estado === filterEstado);
  });

  // ── Quick voice (dictado rápido) ──────────────────────────────────────────
  function toggleQuickVoice() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert('Necesitas Chrome para usar el micrófono'); return; }
    if (quickOn) { quickRef.current?.stop(); setQuickOn(false); return; }
    const r = new SR(); quickRef.current = r;
    r.lang = 'es-ES'; r.continuous = true; r.interimResults = true;
    let final = '';
    const t = setTimeout(() => r.stop(), 20000);
    r.onstart = () => setQuickOn(true);
    r.onresult = (e: SpeechRecognitionEvent) => {
      final = Array.from(e.results).map(x => x[0].transcript).join(' ');
      setQuickText(final);
    };
    r.onend = () => { clearTimeout(t); setQuickOn(false); if (final.trim()) processQuick(final.trim()); };
    r.onerror = () => { clearTimeout(t); setQuickOn(false); };
    r.start();
  }

  async function processQuick(text: string) {
    if (!text.trim()) return;
    setQuickBusy(true);
    try {
      const res = await getAI().models.generateContent({
        model: 'gemini-2.0-flash',
        contents: [{
          role: 'user',
          parts: [{
            text: `Extrae datos del siguiente texto para crear un albarán de proveedor de restaurante.
Devuelve SOLO JSON válido con este formato exacto:
{
  "referencia": "string o null",
  "fecha": "YYYY-MM-DD o null",
  "supplier_name": "string",
  "notas": "string o null",
  "items": [
    { "descripcion": "string", "cantidad": number, "unidad": "kg|ud|l|caja|doc", "precio_unitario": number, "iva": 4|10|21 }
  ]
}
Texto: "${text}"
Fecha actual: ${today()}
Si no menciona IVA, usa 10 para alimentos y 21 para otros.`
          }]
        }]
      });
      const raw = res.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
      const items = parseAIItems(parsed.items || []);
      const sup = matchSupplier(parsed.supplier_name, suppliers);
      setPending({
        referencia: parsed.referencia || '',
        fecha: parsed.fecha || today(),
        supplier_name: parsed.supplier_name || '',
        proveedor_id: sup?.id,
        notas: parsed.notas || '',
        estado: 'pendiente',
        items,
        imagen_url: undefined,
      });
      setQuickText('');
    } catch {
      toast('No pude procesar el texto. Usa modo Manual.', 'err');
    } finally {
      setQuickBusy(false);
    }
  }

  // ── Photo scan ────────────────────────────────────────────────────────────
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setScanFile(f);
    const reader = new FileReader();
    reader.onload = ev => setPreview(ev.target?.result as string);
    reader.readAsDataURL(f);
  }

  async function scanPhoto() {
    if (!scanFile || !preview) return;
    setScanning(true);
    try {
      const base64 = preview.split(',')[1];
      const mimeType = scanFile.type || 'image/jpeg';
      const res = await getAI().models.generateContent({
        model: 'gemini-2.0-flash',
        contents: [{
          role: 'user',
          parts: [
            { inlineData: { mimeType, data: base64 } },
            {
              text: `Eres un asistente de restaurante. Lee este albarán/ticket y devuelve SOLO JSON válido:
{
  "referencia": "string o null",
  "fecha": "YYYY-MM-DD o null",
  "supplier_name": "string",
  "notas": "string o null",
  "items": [
    { "descripcion": "string", "cantidad": number, "unidad": "kg|ud|l|caja|doc", "precio_unitario": number, "iva": 4|10|21 }
  ]
}
Si no ves precio, pon 0. Fecha actual: ${today()}.`
            }
          ]
        }]
      });
      const raw = res.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
      const items = parseAIItems(parsed.items || []);
      const sup = matchSupplier(parsed.supplier_name, suppliers);
      setPending({
        referencia: parsed.referencia || '',
        fecha: parsed.fecha || today(),
        supplier_name: parsed.supplier_name || '',
        proveedor_id: sup?.id,
        notas: parsed.notas || '',
        estado: 'pendiente',
        items,
        imagen_url: preview,
      });
      setScanFile(null); setPreview(null);
    } catch {
      toast('No pude leer la imagen. Intenta con mejor luz.', 'err');
    } finally {
      setScanning(false);
    }
  }

  // ── Confirm pending ───────────────────────────────────────────────────────
  function confirmPending() {
    if (!pending) return;
    setForm(pending);
    setPending(null);
    setInputMode('manual');
    setShowForm(true);
  }

  // ── Form helpers ──────────────────────────────────────────────────────────
  function addItem() {
    setForm(f => ({
      ...f,
      items: [...f.items, calcItem({ id: uid(), descripcion: '', cantidad: 1, unidad: 'ud', precio_unitario: 0, iva: 10 })]
    }));
  }

  function updItem(id: string, ch: Partial<AlbaranItem>) {
    setForm(f => ({ ...f, items: f.items.map(i => i.id === id ? calcItem({ ...i, ...ch }) : i) }));
  }

  function delItem(id: string) {
    setForm(f => ({ ...f, items: f.items.filter(i => i.id !== id) }));
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  async function save() {
    if (!form.supplier_name?.trim()) { toast('Añade el nombre del proveedor', 'err'); return; }
    if (!form.fecha) { toast('Añade la fecha', 'err'); return; }
    if (!form.items.length) { toast('Añade al menos un producto', 'err'); return; }
    setSaving(true);
    try {
      const t = calcTotals(form.items);
      const payload = {
        referencia: form.referencia || null,
        fecha: form.fecha,
        supplier_name: form.supplier_name,
        proveedor_id: form.proveedor_id || null,
        estado: form.estado,
        base: t.base,
        iva_total: t.iva_total,
        total: t.total,
        items: form.items,
        notas: form.notas || null,
        empleado_id: (user as any)?.id || null,
        imagen_url: form.imagen_url || null,
      };

      if (editingId) {
        const { error } = await supabase.from('delivery_notes').update(payload).eq('id', editingId);
        if (error) throw error;
        toast('Albarán actualizado ✓');
      } else {
        const { error } = await supabase.from('delivery_notes').insert(payload);
        if (error) throw error;
        toast('Albarán guardado ✓');
      }

      setShowForm(false);
      setForm(emptyForm());
      setEditingId(null);
      setInputMode('quick');
      await loadAll();
      onStatsChange?.();
    } catch (err: any) {
      toast('Error al guardar: ' + err.message, 'err');
    } finally {
      setSaving(false);
    }
  }

  // ── Change estado ─────────────────────────────────────────────────────────
  async function changeEstado(id: string, estado: Estado) {
    const { error } = await supabase.from('delivery_notes').update({ estado }).eq('id', id);
    if (error) { toast('Error al actualizar', 'err'); return; }
    setAlbaranes(prev => prev.map(a => a.id === id ? { ...a, estado } : a));
    toast(`Estado → ${ESTADO_CFG[estado].label}`);
    onStatsChange?.();
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  async function del(id: string) {
    if (!confirm('¿Eliminar este albarán? No se puede deshacer.')) return;
    const { error } = await supabase.from('delivery_notes').delete().eq('id', id);
    if (error) { toast('Error al eliminar', 'err'); return; }
    setAlbaranes(prev => prev.filter(a => a.id !== id));
    if (expandedId === id) setExpandedId(null);
    toast('Albarán eliminado');
    onStatsChange?.();
  }

  // ── Edit ──────────────────────────────────────────────────────────────────
  function startEdit(a: Albaran) {
    setForm({
      referencia: a.referencia || '',
      fecha: a.fecha,
      supplier_name: a.supplier_name,
      proveedor_id: a.proveedor_id,
      estado: a.estado,
      notas: a.notas || '',
      items: a.items,
      imagen_url: a.imagen_url,
    });
    setEditingId(a.id);
    setInputMode('manual');
    setShowForm(true);
  }

  const totales = calcTotals(form.items);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      <ToastContainer />

      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search + voz */}
        <div className="flex items-center gap-2 flex-1 min-w-[200px] bg-white border border-slate-200 rounded-2xl px-4 py-2.5 shadow-sm">
          <Search size={16} className="text-slate-400 shrink-0" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar albarán o proveedor…"
            className="flex-1 text-sm bg-transparent outline-none placeholder:text-slate-400"
          />
          <VoiceButton onResult={setSearch} small />
        </div>

        {/* Filter estado */}
        <div className="flex bg-white border border-slate-200 rounded-2xl p-1 gap-1 shadow-sm">
          {(['todos', 'pendiente', 'recibido', 'facturado', 'rechazado'] as const).map(e => (
            <button
              key={e}
              onClick={() => setFilterEstado(e)}
              className={cn(
                'px-3 py-1.5 rounded-xl text-xs font-bold transition-all capitalize',
                filterEstado === e ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-800'
              )}
            >
              {e === 'todos' ? 'Todos' : ESTADO_CFG[e].label}
            </button>
          ))}
        </div>

        {/* New button */}
        <button
          onClick={() => { setForm(emptyForm()); setEditingId(null); setInputMode('quick'); setShowForm(true); }}
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-2xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
        >
          <Plus size={16} /> Nuevo albarán
        </button>
      </div>

      {/* ── List ── */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={32} className="animate-spin text-indigo-400" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState onNew={() => { setForm(emptyForm()); setEditingId(null); setInputMode('quick'); setShowForm(true); }} />
      ) : (
        <div className="space-y-3">
          {filtered.map(a => {
            const cfg = ESTADO_CFG[a.estado];
            const expanded = expandedId === a.id;
            return (
              <motion.div key={a.id} layout
                className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-all"
              >
                {/* Row */}
                <div
                  className="flex items-center gap-4 p-5 cursor-pointer"
                  onClick={() => setExpandedId(expanded ? null : a.id)}
                >
                  {/* Icon */}
                  <div className="w-11 h-11 bg-indigo-50 rounded-2xl flex items-center justify-center shrink-0">
                    {a.imagen_url ? <ImageIcon size={18} className="text-indigo-400" /> : <Truck size={18} className="text-indigo-400" />}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-black text-slate-900 truncate">{a.supplier_name}</span>
                      {a.referencia && <span className="text-xs text-slate-400 font-medium">#{a.referencia}</span>}
                    </div>
                    <p className="text-xs text-slate-400 font-medium mt-0.5">{fmtDate(a.fecha)}</p>
                  </div>

                  {/* Status badge */}
                  <span className={cn('px-2.5 py-1 rounded-xl border text-[11px] font-black flex items-center gap-1 shrink-0', cfg.cls)}>
                    {cfg.icon} {cfg.label}
                  </span>

                  {/* Total */}
                  <span className="font-black text-slate-900 text-lg shrink-0 hidden sm:block">{fmtEur(a.total)}</span>

                  {/* Expand */}
                  <div className="text-slate-300 shrink-0">
                    {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </div>
                </div>

                {/* Expanded */}
                <AnimatePresence>
                  {expanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-5 pb-5 border-t border-slate-100 pt-4 space-y-4">
                        {/* Items table */}
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                                <th className="text-left pb-2">Producto</th>
                                <th className="text-right pb-2">Cant.</th>
                                <th className="text-right pb-2">Precio</th>
                                <th className="text-right pb-2">IVA</th>
                                <th className="text-right pb-2">Total</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                              {(a.items || []).map(item => (
                                <tr key={item.id}>
                                  <td className="py-1.5 font-medium text-slate-700">{item.descripcion}</td>
                                  <td className="py-1.5 text-right text-slate-500">{item.cantidad} {item.unidad}</td>
                                  <td className="py-1.5 text-right text-slate-500">{fmtEur(item.precio_unitario)}</td>
                                  <td className="py-1.5 text-right">
                                    <span className="text-[10px] font-black px-1.5 py-0.5 rounded-lg bg-slate-100 text-slate-600">{item.iva}%</span>
                                  </td>
                                  <td className="py-1.5 text-right font-bold text-slate-900">{fmtEur(item.total)}</td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr className="border-t border-slate-200">
                                <td colSpan={4} className="pt-2 text-xs font-black text-slate-400 uppercase">Total</td>
                                <td className="pt-2 text-right font-black text-slate-900 text-base">{fmtEur(a.total)}</td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>

                        {a.notas && (
                          <p className="text-xs text-slate-500 bg-slate-50 rounded-xl px-4 py-2 italic">
                            {a.notas}
                          </p>
                        )}

                        {/* Actions */}
                        <div className="flex flex-wrap items-center gap-2 pt-2">
                          {/* Estado change */}
                          {(['pendiente', 'recibido', 'facturado', 'rechazado'] as Estado[])
                            .filter(e => e !== a.estado)
                            .map(e => (
                              <button key={e} onClick={() => changeEstado(a.id, e)}
                                className={cn('px-3 py-1.5 rounded-xl text-[11px] font-bold border transition-all', ESTADO_CFG[e].cls, 'hover:opacity-80')}>
                                → {ESTADO_CFG[e].label}
                              </button>
                            ))
                          }
                          <div className="ml-auto flex items-center gap-2">
                            <button onClick={() => startEdit(a)}
                              className="p-2 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all" title="Editar">
                              <Edit2 size={14} />
                            </button>
                            <button onClick={() => del(a.id)}
                              className="p-2 rounded-xl bg-rose-50 text-rose-500 hover:bg-rose-100 transition-all" title="Eliminar">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ── Pending Confirm Modal ── */}
      <AnimatePresence>
        {pending && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              className="bg-white w-full max-w-lg rounded-[2.5rem] p-6 space-y-4 shadow-2xl"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400">IA detectó</p>
                  <h3 className="text-xl font-black text-slate-900">{pending.supplier_name || 'Proveedor'}</h3>
                </div>
                <button onClick={() => setPending(null)} className="p-2 rounded-xl hover:bg-slate-100 transition-all">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-1.5">
                {(pending.items || []).slice(0, 5).map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-sm px-4 py-2.5 bg-slate-50 rounded-2xl">
                    <span className="font-medium text-slate-700">{item.descripcion}</span>
                    <span className="font-black text-slate-900">{fmtEur(item.total)}</span>
                  </div>
                ))}
                {pending.items.length > 5 && (
                  <p className="text-xs text-center text-slate-400">+{pending.items.length - 5} más…</p>
                )}
              </div>

              <div className="flex items-center justify-between px-4 py-3 bg-indigo-50 rounded-2xl">
                <span className="text-sm font-bold text-indigo-600">Total detectado</span>
                <span className="text-xl font-black text-indigo-700">{fmtEur(calcTotals(pending.items).total)}</span>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setPending(null)}
                  className="flex-1 py-3 border border-slate-200 rounded-2xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all">
                  Cancelar
                </button>
                <button onClick={confirmPending}
                  className="flex-1 py-3 bg-indigo-600 text-white rounded-2xl text-sm font-bold hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-200">
                  <Check size={16} /> Confirmar y editar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Form Modal ── */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ y: 40, opacity: 0, scale: 0.97 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 40, opacity: 0, scale: 0.97 }}
              className="bg-white w-full max-w-2xl rounded-[2.5rem] flex flex-col max-h-[92vh] overflow-hidden shadow-2xl"
            >
              {/* Header */}
              <div className="p-6 border-b border-slate-100 flex items-center justify-between shrink-0">
                <h2 className="text-xl font-black text-slate-900">
                  {editingId ? 'Editar albarán' : 'Nuevo albarán'}
                </h2>
                <button onClick={() => { setShowForm(false); setEditingId(null); }} className="p-2 rounded-xl hover:bg-slate-100 transition-all">
                  <X size={20} />
                </button>
              </div>

              {/* Mode tabs (solo en nuevo) */}
              {!editingId && (
                <div className="px-6 pt-4 shrink-0">
                  <div className="grid grid-cols-3 gap-2 bg-slate-100 p-1 rounded-2xl">
                    {[
                      { id: 'quick', icon: '⚡', label: 'Rápido', desc: 'Habla o escribe' },
                      { id: 'photo', icon: '📸', label: 'Foto',   desc: 'Escanea el papel' },
                      { id: 'manual', icon: '✏️', label: 'Manual', desc: 'Campo a campo' },
                    ].map(m => (
                      <button key={m.id} onClick={() => setInputMode(m.id as any)}
                        className={cn(
                          'flex flex-col items-center py-2.5 px-2 rounded-xl transition-all text-center',
                          inputMode === m.id ? 'bg-indigo-600 text-white shadow' : 'bg-transparent text-slate-500 hover:bg-white'
                        )}>
                        <span className="text-lg leading-none">{m.icon}</span>
                        <span className="text-xs font-black mt-1">{m.label}</span>
                        <span className={cn('text-[10px] mt-0.5', inputMode === m.id ? 'text-indigo-200' : 'text-slate-400')}>
                          {m.desc}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Scrollable body */}
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">

                {/* ── QUICK mode ── */}
                {inputMode === 'quick' && !editingId && (
                  <div className="space-y-3">
                    <div className="bg-indigo-50 rounded-2xl p-4 border border-indigo-100">
                      <p className="text-xs font-semibold text-indigo-700 mb-1">💡 Habla o escribe con naturalidad</p>
                      <p className="text-xs text-indigo-500 leading-relaxed">
                        Ej: <em>"Carnes Selectas, 20 kg de solomillo a 25 euros con referencia 1234"</em>
                      </p>
                    </div>
                    <div className="relative">
                      <textarea
                        value={quickText}
                        onChange={e => setQuickText(e.target.value)}
                        placeholder="Escribe aquí o pulsa el micrófono…"
                        rows={4}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300 pr-14"
                      />
                      <button type="button" onClick={toggleQuickVoice}
                        className={cn(
                          'absolute right-3 bottom-3 p-2.5 rounded-xl transition-all',
                          quickOn ? 'bg-rose-500 text-white animate-pulse shadow-lg shadow-rose-200' : 'bg-indigo-100 text-indigo-600 hover:bg-indigo-200'
                        )}>
                        {quickOn ? <MicOff size={18} /> : <Mic size={18} />}
                      </button>
                    </div>
                    {quickOn && (
                      <p className="flex items-center gap-2 text-sm text-rose-500 animate-pulse">
                        <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
                        Escuchando… (máx. 20 seg)
                      </p>
                    )}
                    <button
                      onClick={() => processQuick(quickText)}
                      disabled={!quickText.trim() || quickBusy}
                      className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-2xl transition-all"
                    >
                      {quickBusy ? <><Loader2 size={16} className="animate-spin" /> Procesando con IA…</> : <><Sparkles size={16} /> Extraer con IA</>}
                    </button>
                  </div>
                )}

                {/* ── PHOTO mode ── */}
                {inputMode === 'photo' && !editingId && (
                  <div className="space-y-3">
                    <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100">
                      <p className="text-xs font-semibold text-amber-700 mb-1">📸 Cualquier papel sirve</p>
                      <p className="text-xs text-amber-600">Albarán impreso, nota a mano, ticket… la IA lo lee todo.</p>
                    </div>
                    {!preview ? (
                      <button onClick={() => fileRef.current?.click()}
                        className="w-full border-2 border-dashed border-slate-300 hover:border-indigo-400 rounded-2xl py-14 flex flex-col items-center gap-3 text-slate-400 hover:text-indigo-500 transition-all">
                        <Camera size={36} />
                        <span className="text-sm font-medium">Toca para elegir foto o PDF</span>
                        <span className="text-xs text-slate-300">O arrastra el archivo aquí</span>
                      </button>
                    ) : (
                      <div className="space-y-3">
                        <div className="relative rounded-2xl overflow-hidden bg-slate-100 max-h-56 flex items-center justify-center">
                          <img src={preview} alt="preview" className="w-full max-h-56 object-contain" />
                          <button onClick={() => { setScanFile(null); setPreview(null); }}
                            className="absolute top-2 right-2 p-1.5 bg-white/90 rounded-xl shadow hover:bg-white transition-all">
                            <X size={14} />
                          </button>
                        </div>
                        <button onClick={scanPhoto} disabled={scanning}
                          className="w-full flex items-center justify-center gap-2 py-3 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white font-bold rounded-2xl transition-all">
                          {scanning ? <><Loader2 size={16} className="animate-spin" /> Leyendo con IA…</> : <><Sparkles size={16} /> Escanear albarán</>}
                        </button>
                      </div>
                    )}
                    <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFileChange} />
                  </div>
                )}

                {/* ── MANUAL mode ── */}
                {(inputMode === 'manual' || editingId) && (
                  <div className="space-y-5">
                    {/* Basic fields */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-black uppercase tracking-widest text-slate-400">Proveedor *</label>
                        <div className="flex items-center gap-2">
                          <select
                            value={form.proveedor_id || ''}
                            onChange={e => {
                              const sup = suppliers.find(s => s.id === e.target.value);
                              setForm(f => ({ ...f, proveedor_id: e.target.value || undefined, supplier_name: sup?.nombre || f.supplier_name }));
                            }}
                            className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                          >
                            <option value="">— Escribe nombre —</option>
                            {suppliers.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                          </select>
                        </div>
                        {!form.proveedor_id && (
                          <VoiceField
                            value={form.supplier_name}
                            onChange={v => setForm(f => ({ ...f, supplier_name: v }))}
                            placeholder="O escribe el nombre del proveedor"
                          />
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-black uppercase tracking-widest text-slate-400">Referencia</label>
                        <VoiceField
                          value={form.referencia}
                          onChange={v => setForm(f => ({ ...f, referencia: v }))}
                          placeholder="Nº de referencia"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-black uppercase tracking-widest text-slate-400">Fecha *</label>
                        <input
                          type="date"
                          value={form.fecha}
                          onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-black uppercase tracking-widest text-slate-400">Estado</label>
                        <select
                          value={form.estado}
                          onChange={e => setForm(f => ({ ...f, estado: e.target.value as Estado }))}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                        >
                          <option value="pendiente">Pendiente</option>
                          <option value="recibido">Recibido</option>
                          <option value="facturado">Facturado</option>
                          <option value="rechazado">Rechazado</option>
                        </select>
                      </div>
                    </div>

                    {/* Items */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-black uppercase tracking-widest text-slate-400">Productos *</label>
                        <button onClick={addItem}
                          className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-200 transition-all">
                          <Plus size={12} /> Añadir línea
                        </button>
                      </div>

                      {form.items.length === 0 && (
                        <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded-2xl">
                          <p className="text-sm text-slate-400 font-medium">Sin productos. Pulsa "+ Añadir línea"</p>
                        </div>
                      )}

                      {form.items.map((item, idx) => (
                        <div key={item.id} className="bg-slate-50 rounded-2xl p-3 space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-slate-400 w-5 shrink-0">{idx + 1}</span>
                            <div className="flex-1 flex items-center gap-2">
                              <input
                                value={item.descripcion}
                                onChange={e => updItem(item.id, { descripcion: e.target.value })}
                                placeholder="Descripción del producto"
                                className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                              />
                              <VoiceButton onResult={v => updItem(item.id, { descripcion: v })} small />
                            </div>
                            <button onClick={() => delItem(item.id)} className="p-1.5 rounded-xl text-rose-400 hover:bg-rose-50 transition-all shrink-0">
                              <Trash2 size={14} />
                            </button>
                          </div>
                          <div className="grid grid-cols-4 gap-2 pl-7">
                            <input
                              type="number" min="0" step="0.01"
                              value={item.cantidad}
                              onChange={e => updItem(item.id, { cantidad: parseFloat(e.target.value) || 0 })}
                              placeholder="Cant."
                              className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 text-right"
                            />
                            <select
                              value={item.unidad}
                              onChange={e => updItem(item.id, { unidad: e.target.value })}
                              className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                            >
                              {['ud', 'kg', 'g', 'l', 'ml', 'caja', 'doc', 'bolsa', 'palet'].map(u => (
                                <option key={u} value={u}>{u}</option>
                              ))}
                            </select>
                            <input
                              type="number" min="0" step="0.01"
                              value={item.precio_unitario}
                              onChange={e => updItem(item.id, { precio_unitario: parseFloat(e.target.value) || 0 })}
                              placeholder="Precio"
                              className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 text-right"
                            />
                            <select
                              value={item.iva}
                              onChange={e => updItem(item.id, { iva: parseInt(e.target.value) as IVARate })}
                              className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                            >
                              <option value={4}>4% IVA</option>
                              <option value={10}>10% IVA</option>
                              <option value={21}>21% IVA</option>
                            </select>
                          </div>
                          <div className="flex justify-end pl-7">
                            <span className="text-xs text-slate-400">= <strong className="text-slate-700">{fmtEur(item.total)}</strong></span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Notas */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-black uppercase tracking-widest text-slate-400">Notas</label>
                      <div className="flex items-start gap-2">
                        <textarea
                          value={form.notas}
                          onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
                          placeholder="Notas adicionales…"
                          rows={2}
                          className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300"
                        />
                        <VoiceButton onResult={v => setForm(f => ({ ...f, notas: v }))} small className="mt-1" />
                      </div>
                    </div>

                    {/* Totals summary */}
                    {form.items.length > 0 && (
                      <div className="bg-indigo-50 rounded-2xl px-5 py-4 space-y-1.5 border border-indigo-100">
                        <div className="flex justify-between text-sm text-indigo-600">
                          <span>Base imponible</span><span className="font-bold">{fmtEur(totales.base)}</span>
                        </div>
                        <div className="flex justify-between text-sm text-indigo-600">
                          <span>IVA</span><span className="font-bold">{fmtEur(totales.iva_total)}</span>
                        </div>
                        <div className="flex justify-between text-base text-indigo-700 font-black border-t border-indigo-200 pt-1.5">
                          <span>TOTAL</span><span>{fmtEur(totales.total)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Footer */}
              {(inputMode === 'manual' || editingId) && (
                <div className="p-6 border-t border-slate-100 flex gap-3 shrink-0">
                  <button
                    onClick={() => { setShowForm(false); setEditingId(null); }}
                    className="flex-1 py-3 border border-slate-200 rounded-2xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={save}
                    disabled={saving}
                    className="flex-1 py-3 bg-indigo-600 text-white rounded-2xl text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-200"
                  >
                    {saving ? <><Loader2 size={16} className="animate-spin" /> Guardando…</> : <><Check size={16} /> {editingId ? 'Actualizar' : 'Guardar albarán'}</>}
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
