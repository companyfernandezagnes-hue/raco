// src/components/compras/InvoicesView.tsx
// ✅ 100% Supabase — sin Firebase, sin datos hardcoded
// ✅ Voz, foto IA, interfaz Gen Z, alertas visuales toast
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  FileText, Plus, Mic, MicOff, Camera, Loader2, X, Check,
  ChevronDown, ChevronUp, Trash2, Sparkles, Search, Link as LinkIcon,
  AlertTriangle, CheckCircle2, Clock, Package, Edit2, Eye
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../supabase';
import { useSupabase } from '../../context/SupabaseContext';
import { GoogleGenAI } from '@google/genai';
import { cn } from '../../lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────
type EstadoFactura = 'draft' | 'approved' | 'paid' | 'mismatch';
type Origen = 'gmail-sync' | 'dropzone' | 'manual-group' | 'auto-from-albaran';
type BusinessUnit = 'REST' | 'DLV' | 'SHOP' | 'CORP';

interface Factura {
  id: string;
  tipo: 'compra' | 'venta' | 'caja';
  num: string;
  fecha: string;
  fecha_venc?: string;
  proveedor?: string;
  cliente?: string;
  total: number;
  base: number;
  impuesto: number;
  albaran_ids: string[];
  pagada: boolean;
  conciliada: boolean;
  categoria?: string;
  origen: Origen;
  estado: EstadoFactura;
  unidad_negocio: BusinessUnit;
  archivo_b64?: string;
  email_de?: string;
  email_asunto?: string;
  created_at: string;
}

interface DeliveryNote {
  id: string;
  referencia?: string;
  fecha: string;
  supplier_name: string;
  total: number;
  estado: string;
}

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

const ESTADO_CFG: Record<EstadoFactura, { label: string; cls: string; icon: React.ReactNode }> = {
  draft:     { label: 'Borrador',  cls: 'text-slate-600 bg-slate-100 border-slate-200',    icon: <Clock size={12} /> },
  approved:  { label: 'Aprobada',  cls: 'text-indigo-600 bg-indigo-50 border-indigo-200',  icon: <CheckCircle2 size={12} /> },
  paid:      { label: 'Pagada',    cls: 'text-emerald-600 bg-emerald-50 border-emerald-200', icon: <CheckCircle2 size={12} /> },
  mismatch:  { label: 'Descuadre', cls: 'text-rose-600 bg-rose-50 border-rose-200',        icon: <AlertTriangle size={12} /> },
};

const BU_CFG: Record<BusinessUnit, string> = {
  REST: 'Restaurante', DLV: 'Catering', SHOP: 'Tienda', CORP: 'Oficina'
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
            className={cn('px-5 py-3 rounded-2xl text-sm font-bold shadow-2xl flex items-center gap-2',
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
      className={cn(`${small ? 'p-1.5' : 'p-2.5'} rounded-xl transition-all shrink-0`,
        on ? 'bg-rose-500 text-white animate-pulse shadow-lg shadow-rose-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200',
        className
      )}
      title={on ? 'Parar' : 'Dictar por voz'}
    >
      {on ? <MicOff size={sz} /> : <Mic size={sz} />}
    </button>
  );
}

function VoiceField({ value, onChange, placeholder, type = 'text', className = '' }: {
  value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; className?: string;
}) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
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
        <FileText size={40} />
      </div>
      <h3 className="text-xl font-black text-slate-300 uppercase tracking-tight">Sin facturas</h3>
      <p className="text-slate-400 text-sm font-medium mt-2 mb-6 max-w-xs">
        Añade facturas manualmente o escanea con la cámara
      </p>
      <button onClick={onNew}
        className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold text-sm hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200">
        <Plus size={16} /> Nueva factura
      </button>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export const InvoicesView = ({ onStatsChange }: { onStatsChange?: () => void }) => {
  const { employee } = useSupabase();
  const isAdmin = (employee as any)?.rol === 'admin';
  const { show: toast, ToastContainer } = useToast();

  const [facturas, setFacturas] = useState<Factura[]>([]);
  const [albaranes, setAlbaranes] = useState<DeliveryNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterEstado, setFilterEstado] = useState<EstadoFactura | 'todos'>('todos');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [scanFile, setScanFile] = useState<File | null>(null);
  // Albaran linker
  const [showLinker, setShowLinker] = useState(false);
  const [linkerFacturaId, setLinkerFacturaId] = useState<string | null>(null);
  const [selectedAlbIds, setSelectedAlbIds] = useState<string[]>([]);

  type FacturaForm = {
    tipo: 'compra' | 'venta' | 'caja';
    num: string; fecha: string; fecha_venc: string;
    proveedor: string; cliente: string;
    total: number; base: number; impuesto: number;
    albaran_ids: string[]; pagada: boolean;
    categoria: string; origen: Origen; estado: EstadoFactura;
    unidad_negocio: BusinessUnit; archivo_b64: string;
  };
  const emptyForm = (): FacturaForm => ({
    tipo: 'compra', num: '', fecha: today(), fecha_venc: '',
    proveedor: '', cliente: '', total: 0, base: 0, impuesto: 0,
    albaran_ids: [], pagada: false,
    categoria: '', origen: 'manual-group',
    estado: 'draft', unidad_negocio: 'REST',
    archivo_b64: '',
  });
  const [form, setForm] = useState<FacturaForm>(emptyForm());

  // ── Load ──────────────────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    setLoading(true);
    const [fRes, aRes] = await Promise.all([
      supabase.from('facturas').select('*').order('fecha', { ascending: false }),
      supabase.from('delivery_notes')
        .select('id, referencia, fecha, supplier_name, total, estado')
        .order('fecha', { ascending: false }),
    ]);
    if (fRes.data) setFacturas(fRes.data as Factura[]);
    if (aRes.data) setAlbaranes(aRes.data as DeliveryNote[]);
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Filtered ──────────────────────────────────────────────────────────────
  const filtered = facturas.filter(f => {
    const q = search.toLowerCase();
    return (filterEstado === 'todos' || f.estado === filterEstado)
      && (!q || f.proveedor?.toLowerCase().includes(q) || f.num?.toLowerCase().includes(q));
  });

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
              text: `Lee esta factura y devuelve SOLO JSON válido:
{
  "num": "string",
  "fecha": "YYYY-MM-DD",
  "fecha_venc": "YYYY-MM-DD o null",
  "proveedor": "string",
  "base": number,
  "impuesto": number,
  "total": number,
  "categoria": "string o null"
}
Fecha actual: ${today()}.`
            }
          ]
        }]
      });
      const raw = res.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
      setForm(f => ({
        ...f,
        num: parsed.num || '',
        fecha: parsed.fecha || today(),
        fecha_venc: parsed.fecha_venc || '',
        proveedor: parsed.proveedor || '',
        base: parsed.base || 0,
        impuesto: parsed.impuesto || 0,
        total: parsed.total || 0,
        categoria: parsed.categoria || '',
        archivo_b64: base64,
      }));
      setScanFile(null); setPreview(null);
      toast('Factura leída ✓ Revisa los datos');
    } catch {
      toast('No pude leer la factura. Completa manualmente.', 'err');
    } finally {
      setScanning(false);
    }
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!form.proveedor.trim() && !form.cliente?.trim()) { toast('Añade proveedor o cliente', 'err'); return; }
    if (!form.num.trim()) { toast('Añade el número de factura', 'err'); return; }
    setSaving(true);
    try {
      const payload = {
        tipo: form.tipo, num: form.num, fecha: form.fecha,
        fecha_venc: form.fecha_venc || null, proveedor: form.proveedor || null,
        cliente: form.cliente || null, total: Number(form.total),
        base: Number(form.base), impuesto: Number(form.impuesto),
        albaran_ids: form.albaran_ids, pagada: form.pagada,
        categoria: form.categoria || null, origen: form.origen,
        estado: form.estado, unidad_negocio: form.unidad_negocio,
        archivo_b64: form.archivo_b64 || null,
      };
      if (editingId) {
        const { error } = await supabase.from('facturas').update(payload).eq('id', editingId);
        if (error) throw error;
        toast('Factura actualizada ✓');
      } else {
        const { error } = await supabase.from('facturas').insert(payload);
        if (error) throw error;
        toast('Factura guardada ✓');
      }
      await loadAll();
      setShowForm(false);
      setForm(emptyForm());
      setEditingId(null);
      setPreview(null);
      setScanFile(null);
      onStatsChange?.();
    } catch (err: any) {
      toast('Error: ' + err.message, 'err');
    } finally {
      setSaving(false);
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar esta factura? No se puede deshacer.')) return;
    const { error } = await supabase.from('facturas').delete().eq('id', id);
    if (error) { toast('Error al eliminar', 'err'); return; }
    setFacturas(prev => prev.filter(f => f.id !== id));
    toast('Factura eliminada');
    onStatsChange?.();
  }

  // ── Change estado ─────────────────────────────────────────────────────────
  async function changeEstado(id: string, estado: EstadoFactura) {
    const { error } = await supabase.from('facturas').update({ estado, pagada: estado === 'paid' }).eq('id', id);
    if (error) { toast('Error al actualizar', 'err'); return; }
    setFacturas(prev => prev.map(f => f.id === id ? { ...f, estado, pagada: estado === 'paid' } : f));
    toast(`Estado → ${ESTADO_CFG[estado].label}`);
    onStatsChange?.();
  }

  // ── Albaran Linker ────────────────────────────────────────────────────────
  function openLinker(factura: Factura) {
    setLinkerFacturaId(factura.id);
    setSelectedAlbIds(factura.albaran_ids || []);
    setShowLinker(true);
  }

  async function saveLinker() {
    if (!linkerFacturaId) return;
    const { error } = await supabase.from('facturas').update({ albaran_ids: selectedAlbIds }).eq('id', linkerFacturaId);
    if (error) { toast('Error al vincular', 'err'); return; }
    setFacturas(prev => prev.map(f => f.id === linkerFacturaId ? { ...f, albaran_ids: selectedAlbIds } : f));
    setShowLinker(false);
    toast(`${selectedAlbIds.length} albarán(es) vinculado(s) ✓`);
  }

  // ── Edit ──────────────────────────────────────────────────────────────────
  function startEdit(f: Factura) {
    setForm({
      tipo: f.tipo, num: f.num, fecha: f.fecha,
      fecha_venc: f.fecha_venc || '', proveedor: f.proveedor || '',
      cliente: f.cliente || '', total: f.total, base: f.base,
      impuesto: f.impuesto, albaran_ids: f.albaran_ids || [],
      pagada: f.pagada, categoria: f.categoria || '',
      origen: f.origen, estado: f.estado,
      unidad_negocio: f.unidad_negocio, archivo_b64: f.archivo_b64 || '',
    });
    setEditingId(f.id);
    setShowForm(true);
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      <ToastContainer />

      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-[200px] bg-white border border-slate-200 rounded-2xl px-4 py-2.5 shadow-sm">
          <Search size={16} className="text-slate-400 shrink-0" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar factura o proveedor…"
            className="flex-1 text-sm bg-transparent outline-none placeholder:text-slate-400"
          />
          <VoiceButton onResult={setSearch} small />
        </div>

        <div className="flex bg-white border border-slate-200 rounded-2xl p-1 gap-1 shadow-sm">
          {(['todos', 'draft', 'approved', 'paid', 'mismatch'] as const).map(e => (
            <button
              key={e}
              onClick={() => setFilterEstado(e)}
              className={cn(
                'px-3 py-1.5 rounded-xl text-xs font-bold transition-all',
                filterEstado === e ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-800'
              )}
            >
              {e === 'todos' ? 'Todos' : ESTADO_CFG[e].label}
            </button>
          ))}
        </div>

        <button
          onClick={() => { setForm(emptyForm()); setEditingId(null); setPreview(null); setScanFile(null); setShowForm(true); }}
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-2xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
        >
          <Plus size={16} /> Nueva factura
        </button>
      </div>

      {/* ── List ── */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={32} className="animate-spin text-indigo-400" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState onNew={() => { setForm(emptyForm()); setEditingId(null); setShowForm(true); }} />
      ) : (
        <div className="space-y-3">
          {filtered.map(f => {
            const cfg = ESTADO_CFG[f.estado];
            const expanded = expandedId === f.id;
            const linkedAlbs = albaranes.filter(a => (f.albaran_ids || []).includes(a.id));

            return (
              <motion.div key={f.id} layout
                className={cn(
                  'bg-white border rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-all',
                  f.estado === 'mismatch' ? 'border-rose-200' : 'border-slate-200'
                )}
              >
                <div className="flex items-center gap-4 p-5 cursor-pointer" onClick={() => setExpandedId(expanded ? null : f.id)}>
                  <div className={cn(
                    'w-11 h-11 rounded-2xl flex items-center justify-center shrink-0',
                    f.estado === 'mismatch' ? 'bg-rose-50' : 'bg-slate-50'
                  )}>
                    <FileText size={18} className={f.estado === 'mismatch' ? 'text-rose-400' : 'text-slate-400'} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-black text-slate-900 truncate">{f.proveedor || f.cliente || '—'}</span>
                      <span className="text-xs text-slate-400 font-medium">#{f.num}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-500 rounded-lg">
                        {BU_CFG[f.unidad_negocio]}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 font-medium mt-0.5">{fmtDate(f.fecha)}</p>
                  </div>

                  <span className={cn('px-2.5 py-1 rounded-xl border text-[11px] font-black flex items-center gap-1 shrink-0', cfg.cls)}>
                    {cfg.icon} {cfg.label}
                  </span>

                  <span className="font-black text-slate-900 text-lg shrink-0 hidden sm:block">{fmtEur(f.total)}</span>

                  <div className="text-slate-300 shrink-0">
                    {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </div>
                </div>

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
                        {/* Desglose */}
                        <div className="grid grid-cols-3 gap-3">
                          {[
                            { label: 'Base', value: fmtEur(f.base) },
                            { label: 'IVA', value: fmtEur(f.impuesto) },
                            { label: 'Total', value: fmtEur(f.total) },
                          ].map(row => (
                            <div key={row.label} className="bg-slate-50 rounded-2xl px-4 py-3 text-center">
                              <p className="text-[10px] font-black uppercase text-slate-400">{row.label}</p>
                              <p className="font-black text-slate-900 mt-1">{row.value}</p>
                            </div>
                          ))}
                        </div>

                        {/* Albaranes vinculados */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                              Albaranes vinculados ({linkedAlbs.length})
                            </p>
                            <button onClick={() => openLinker(f)}
                              className="flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-700 transition-all">
                              <LinkIcon size={12} /> Gestionar
                            </button>
                          </div>
                          {linkedAlbs.length === 0 ? (
                            <p className="text-xs text-slate-400 italic text-center py-3 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                              Sin albaranes vinculados
                            </p>
                          ) : (
                            <div className="space-y-1.5">
                              {linkedAlbs.map(a => (
                                <div key={a.id} className="flex items-center justify-between px-4 py-2.5 bg-slate-50 rounded-xl text-sm">
                                  <div className="flex items-center gap-2">
                                    <Package size={14} className="text-slate-400" />
                                    <span className="font-medium text-slate-700">{a.supplier_name}</span>
                                    {a.referencia && <span className="text-slate-400">#{a.referencia}</span>}
                                  </div>
                                  <span className="font-bold text-slate-900">{fmtEur(a.total)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex flex-wrap items-center gap-2 pt-2">
                          {(['draft', 'approved', 'paid', 'mismatch'] as EstadoFactura[])
                            .filter(e => e !== f.estado)
                            .map(e => (
                              <button key={e} onClick={() => changeEstado(f.id, e)}
                                className={cn('px-3 py-1.5 rounded-xl text-[11px] font-bold border transition-all', ESTADO_CFG[e].cls, 'hover:opacity-80')}>
                                → {ESTADO_CFG[e].label}
                              </button>
                            ))
                          }
                          {isAdmin && (
                            <div className="ml-auto flex items-center gap-2">
                              <button onClick={() => startEdit(f)}
                                className="p-2 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all" title="Editar">
                                <Edit2 size={14} />
                              </button>
                              <button onClick={() => handleDelete(f.id)}
                                className="p-2 rounded-xl bg-rose-50 text-rose-500 hover:bg-rose-100 transition-all" title="Eliminar">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          )}
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

      {/* ── Albaran Linker Modal ── */}
      <AnimatePresence>
        {showLinker && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }}
              className="bg-white w-full max-w-lg rounded-[2.5rem] p-6 space-y-4 shadow-2xl max-h-[80vh] overflow-hidden flex flex-col"
            >
              <div className="flex items-center justify-between shrink-0">
                <h3 className="text-xl font-black">Vincular albaranes</h3>
                <button onClick={() => setShowLinker(false)} className="p-2 rounded-xl hover:bg-slate-100 transition-all">
                  <X size={18} />
                </button>
              </div>
              <p className="text-sm text-slate-500 shrink-0">Selecciona los albaranes que corresponden a esta factura.</p>
              <div className="flex-1 overflow-y-auto space-y-2">
                {albaranes.filter(a => a.estado !== 'rechazado').map(a => (
                  <label key={a.id}
                    className={cn(
                      'flex items-center gap-3 px-4 py-3 rounded-2xl border cursor-pointer transition-all',
                      selectedAlbIds.includes(a.id)
                        ? 'border-indigo-300 bg-indigo-50'
                        : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={selectedAlbIds.includes(a.id)}
                      onChange={e => setSelectedAlbIds(prev =>
                        e.target.checked ? [...prev, a.id] : prev.filter(x => x !== a.id)
                      )}
                      className="rounded w-4 h-4 accent-indigo-600"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-800 text-sm">{a.supplier_name}</p>
                      <p className="text-xs text-slate-400">{fmtDate(a.fecha)} {a.referencia ? `· #${a.referencia}` : ''}</p>
                    </div>
                    <span className="font-black text-slate-900 text-sm shrink-0">{fmtEur(a.total)}</span>
                  </label>
                ))}
                {albaranes.length === 0 && (
                  <p className="text-center text-slate-400 text-sm py-8">No hay albaranes disponibles</p>
                )}
              </div>
              <div className="flex gap-3 shrink-0 pt-2">
                <button onClick={() => setShowLinker(false)}
                  className="flex-1 py-3 border border-slate-200 rounded-2xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all">
                  Cancelar
                </button>
                <button onClick={saveLinker}
                  className="flex-1 py-3 bg-indigo-600 text-white rounded-2xl text-sm font-bold hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-200">
                  <Check size={16} /> Guardar ({selectedAlbIds.length})
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
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ y: 40, opacity: 0, scale: 0.97 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 40, opacity: 0, scale: 0.97 }}
              className="bg-white w-full max-w-2xl rounded-[2.5rem] flex flex-col max-h-[92vh] overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between shrink-0">
                <div>
                  <h2 className="text-xl font-black text-slate-900">
                    {editingId ? 'Editar factura' : 'Nueva factura'}
                  </h2>
                  {!editingId && (
                    <p className="text-xs text-slate-400 mt-0.5">O escanea con la cámara para rellenar automáticamente</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {!editingId && (
                    <button onClick={() => fileRef.current?.click()}
                      className="flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 text-amber-700 rounded-2xl text-xs font-bold hover:bg-amber-100 transition-all">
                      {scanning ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
                      Escanear
                    </button>
                  )}
                  <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFileChange} />
                  <button onClick={() => { setShowForm(false); setEditingId(null); }}
                    className="p-2 rounded-xl hover:bg-slate-100 transition-all">
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* Preview + scan button */}
              <AnimatePresence>
                {preview && !scanning && (
                  <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
                    className="overflow-hidden border-b border-amber-100 bg-amber-50 px-6 py-3 flex items-center gap-4 shrink-0">
                    <img src={preview} alt="preview" className="h-16 w-16 object-cover rounded-xl border border-amber-200" />
                    <div className="flex-1">
                      <p className="text-sm font-bold text-amber-700">Imagen lista para escanear</p>
                      <p className="text-xs text-amber-500">La IA rellenará los campos automáticamente</p>
                    </div>
                    <button onClick={scanPhoto}
                      className="px-4 py-2 bg-amber-500 text-white rounded-xl text-xs font-bold hover:bg-amber-600 transition-all flex items-center gap-1.5 shadow">
                      <Sparkles size={12} /> Leer factura
                    </button>
                    <button onClick={() => { setPreview(null); setScanFile(null); }} className="p-1.5 rounded-lg hover:bg-amber-100 text-amber-400">
                      <X size={14} />
                    </button>
                  </motion.div>
                )}
                {scanning && (
                  <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
                    className="overflow-hidden border-b border-amber-100 bg-amber-50 px-6 py-4 flex items-center gap-3 shrink-0">
                    <Loader2 size={20} className="animate-spin text-amber-500" />
                    <p className="text-sm font-bold text-amber-700">Leyendo factura con IA…</p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Body */}
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Tipo</label>
                    <select value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value as any }))}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
                      <option value="compra">Compra</option>
                      <option value="venta">Venta</option>
                      <option value="caja">Caja</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Unidad de negocio</label>
                    <select value={form.unidad_negocio} onChange={e => setForm(f => ({ ...f, unidad_negocio: e.target.value as BusinessUnit }))}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
                      {(Object.entries(BU_CFG) as [BusinessUnit, string][]).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Nº Factura *</label>
                    <VoiceField value={form.num} onChange={v => setForm(f => ({ ...f, num: v }))} placeholder="FAC-2026-001" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Proveedor</label>
                    <VoiceField value={form.proveedor} onChange={v => setForm(f => ({ ...f, proveedor: v }))} placeholder="Nombre del proveedor" />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Fecha *</label>
                    <input type="date" value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Vencimiento</label>
                    <input type="date" value={form.fecha_venc} onChange={e => setForm(f => ({ ...f, fecha_venc: e.target.value }))}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Base imponible (€)</label>
                    <input type="number" min="0" step="0.01" value={form.base || ''}
                      onChange={e => {
                        const base = parseFloat(e.target.value) || 0;
                        setForm(f => ({ ...f, base, total: base + f.impuesto }));
                      }}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 text-right"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">IVA (€)</label>
                    <input type="number" min="0" step="0.01" value={form.impuesto || ''}
                      onChange={e => {
                        const impuesto = parseFloat(e.target.value) || 0;
                        setForm(f => ({ ...f, impuesto, total: f.base + impuesto }));
                      }}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 text-right"
                    />
                  </div>
                </div>

                {/* Total highlight */}
                <div className="bg-indigo-50 border border-indigo-100 rounded-2xl px-5 py-4 flex items-center justify-between">
                  <span className="text-sm font-bold text-indigo-600">Total</span>
                  <span className="text-2xl font-black text-indigo-700">{fmtEur(Number(form.base) + Number(form.impuesto))}</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Estado</label>
                    <select value={form.estado} onChange={e => setForm(f => ({ ...f, estado: e.target.value as EstadoFactura }))}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
                      <option value="draft">Borrador</option>
                      <option value="approved">Aprobada</option>
                      <option value="paid">Pagada</option>
                      <option value="mismatch">Descuadre</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Categoría</label>
                    <VoiceField value={form.categoria} onChange={v => setForm(f => ({ ...f, categoria: v }))} placeholder="Ej: Carnes, Bebidas…" />
                  </div>
                </div>

                <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                  <input type="checkbox" id="pagada" checked={form.pagada}
                    onChange={e => setForm(f => ({ ...f, pagada: e.target.checked }))}
                    className="w-4 h-4 rounded accent-emerald-600"
                  />
                  <label htmlFor="pagada" className="text-sm font-bold text-slate-700 cursor-pointer">
                    Marcar como pagada
                  </label>
                </div>
              </div>

              {/* Footer */}
              <div className="p-6 border-t border-slate-100 flex gap-3 shrink-0">
                <button onClick={() => { setShowForm(false); setEditingId(null); }}
                  className="flex-1 py-3 border border-slate-200 rounded-2xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all">
                  Cancelar
                </button>
                <button onClick={handleSave} disabled={saving}
                  className="flex-1 py-3 bg-indigo-600 text-white rounded-2xl text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-200">
                  {saving ? <><Loader2 size={16} className="animate-spin" /> Guardando…</> : <><Check size={16} /> {editingId ? 'Actualizar' : 'Guardar factura'}</>}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default InvoicesView;
