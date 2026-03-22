import React, { useState, useEffect, useRef } from 'react';
import { FileText, CheckCircle2, Clock, AlertTriangle, ChevronDown, ChevronUp, Plus, X, Loader2, Camera, Mic, MicOff, Sparkles, Search, Trash2, Link as LinkIcon, Mail, Zap, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../supabase';
import { useSupabase } from '../../context/SupabaseContext';
import { GoogleGenAI } from '@google/genai';
import { Num } from '../../services/engine';
import { cn } from '../../lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────
type Estado = 'draft' | 'approved' | 'paid' | 'mismatch';
type Origen = 'gmail-sync' | 'dropzone' | 'manual-group' | 'auto-from-albaran';
type BusinessUnit = 'REST' | 'DLV' | 'SHOP' | 'CORP';

interface Factura {
  id: string;
  tipo: 'compra' | 'venta' | 'caja';
  num: string;
  fecha: string;
  fecha_venc?: string;
  proveedor: string;
  cliente?: string;
  total: number;
  base: number;
  impuesto: number;
  albaran_ids: string[];
  pagada: boolean;
  conciliada: boolean;
  bank_tx_id?: string;
  categoria?: string;
  origen: Origen;
  estado: Estado;
  unidad_negocio: BusinessUnit;
  archivo_b64?: string;
  email_de?: string;
  email_asunto?: string;
  created_at: string;
}

interface DeliveryNote {
  id: string;
  referencia: string;
  fecha: string;
  supplier_name: string;
  total: number;
  estado: string;
}

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS: Record<Estado, { label: string; color: string; icon: any }> = {
  draft:    { label: 'Borrador',  color: 'text-slate-500 bg-slate-100 border-slate-200', icon: Clock },
  approved: { label: 'Aprobada', color: 'text-indigo-600 bg-indigo-50 border-indigo-200', icon: CheckCircle2 },
  paid:     { label: 'Pagada',   color: 'text-emerald-600 bg-emerald-50 border-emerald-200', icon: CheckCircle2 },
  mismatch: { label: 'Descuadre', color: 'text-rose-600 bg-rose-50 border-rose-200', icon: AlertTriangle },
};

// ─── Gemini AI helper ─────────────────────────────────────────────────────────
let ai: GoogleGenAI | null = null;
function getAI() {
  if (!ai) ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || '' });
  return ai;
}

// ─── VoiceButton ──────────────────────────────────────────────────────────────
function VoiceButton({ onResult, small }: { onResult: (t: string) => void; small?: boolean }) {
  const [on, setOn] = useState(false);
  const ref = useRef<SpeechRecognition | null>(null);
  const toggle = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert('Necesitas Chrome para voz'); return; }
    if (on) { ref.current?.stop(); setOn(false); return; }
    const r = new SR(); ref.current = r;
    r.lang = 'es-ES'; r.continuous = false; r.interimResults = false;
    r.onstart = () => setOn(true);
    r.onresult = (e: SpeechRecognitionEvent) => onResult(e.results[0][0].transcript);
    r.onerror = r.onend = () => setOn(false);
    r.start();
  };
  const sz = small ? 14 : 16;
  return (
    <button type="button" onClick={toggle} className={`${small ? 'p-1.5' : 'p-2'} rounded-xl transition-all ${on ? 'bg-rose-500 text-white animate-pulse shadow-lg' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
      {on ? <MicOff size={sz} /> : <Mic size={sz} />}
    </button>
  );
}

function today() { return new Date().toISOString().split('T')[0]; }
function uid() { return Math.random().toString(36).slice(2, 10); }

// ─── Main Component ───────────────────────────────────────────────────────────
export const InvoicesView = () => {
  const { employee } = useSupabase();
  const isAdmin = employee?.rol === 'admin';

  // State
  const [facturas, setFacturas] = useState<Factura[]>([]);
  const [albaranes, setAlbaranes] = useState<DeliveryNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [scanFile, setScanFile] = useState<File | null>(null);

  const emptyForm = () => ({
    tipo: 'compra' as const, num: '', fecha: today(), fecha_venc: '',
    proveedor: '', cliente: '', total: 0, base: 0, impuesto: 0,
    albaran_ids: [] as string[], pagada: false, conciliada: false,
    categoria: '', origen: 'manual-group' as Origen,
    estado: 'draft' as Estado, unidad_negocio: 'REST' as BusinessUnit,
    archivo_b64: '', email_de: '', email_asunto: '',
  });
  const [form, setForm] = useState(emptyForm());

  // Load
  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    const [fRes, aRes] = await Promise.all([
      supabase.from('facturas').select('*').order('fecha', { ascending: false }),
      supabase.from('delivery_notes').select('id, referencia, fecha, supplier_name, total, estado').order('fecha', { ascending: false }),
    ]);
    if (fRes.data) setFacturas(fRes.data as Factura[]);
    if (aRes.data) setAlbaranes(aRes.data as DeliveryNote[]);
    setLoading(false);
  }

  // Filtered
  const filtered = facturas.filter(f => {
    const q = search.toLowerCase();
    return !q || f.proveedor?.toLowerCase().includes(q) || f.num?.toLowerCase().includes(q);
  });

  // Save
  async function handleSave() {
    if (!form.proveedor.trim() && !form.cliente?.trim()) return alert('Añade proveedor o cliente');
    if (!form.num.trim()) return alert('Añade el número de factura');
    setSaving(true);
    try {
      const { error } = await supabase.from('facturas').insert({
        tipo: form.tipo, num: form.num, fecha: form.fecha,
        fecha_venc: form.fecha_venc || null, proveedor: form.proveedor,
        cliente: form.cliente || null, total: form.total, base: form.base,
        impuesto: form.impuesto, albaran_ids: form.albaran_ids,
        pagada: form.pagada, conciliada: false, categoria: form.categoria || null,
        origen: form.origen, estado: form.estado, unidad_negocio: form.unidad_negocio,
        archivo_b64: form.archivo_b64 || null,
      });
      if (error) throw error;
      await loadAll();
      setShowForm(false);
      setForm(emptyForm());
      setPreview(null);
      setScanFile(null);
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar factura? Esta acción no se puede deshacer.')) return;
    const { error } = await supabase.from('facturas').delete().eq('id', id);
    if (!error) setFacturas(prev => prev.filter(f => f.id !== id));
  }

  async function handleChangeEstado(id: string, estado: Estado) {
    const { error } = await supabase.from('facturas').update({ estado, pagada: estado === 'paid' }).eq('id', id);
    if (!error) setFacturas(prev => prev.map(f => f.id === id ? { ...f, estado, pagada: estado === 'paid' } : f));
  }

  // ── AI Photo Scan ──────────────────────────────────────────────────────────
  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
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
      const prompt = `Analiza esta factura o albarán. Extrae los datos fiscales. Responde SOLO con JSON válido sin markdown: {"num":"","fecha":"YYYY-MM-DD","fecha_venc":"YYYY-MM-DD","proveedor":"","total":0,"base":0,"impuesto":0}`;
      const resp = await getAI().models.generateContent({
        model: 'gemini-2.0-flash',
        contents: [{ role: 'user', parts: [{ inlineData: { mimeType: scanFile.type, data: base64 } }, { text: prompt }] }],
      });
      const raw = resp.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
      const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
      setForm(f => ({ ...f, ...parsed, archivo_b64: preview }));
      setShowForm(true);
    } catch {
      alert('No se pudo leer la imagen.');
    } finally {
      setScanning(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex gap-2 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar factura o proveedor..." className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-300 focus:outline-none" />
        </div>
        <VoiceButton onResult={setSearch} />
        {isAdmin && (
          <>
            <button onClick={() => fileRef.current?.click()} className="flex items-center gap-1.5 px-3 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-all">
              <Camera size={15} className="text-amber-500" /> Escanear
            </button>
            <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFile} />
            <button onClick={() => { setForm(emptyForm()); setShowForm(true); }} className="flex items-center gap-1.5 px-3 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-all">
              <Plus size={15} /> Nueva
            </button>
          </>
        )}
      </div>

      {/* Photo preview */}
      {preview && !showForm && (
        <div className="bg-white border border-amber-200 rounded-2xl p-4 flex gap-4 items-start">
          <img src={preview} alt="preview" className="w-24 h-24 object-cover rounded-xl border" />
          <div className="flex-1 space-y-2">
            <p className="text-sm font-bold text-slate-800">Imagen lista para análisis IA</p>
            <p className="text-xs text-slate-500">La IA extraerá automáticamente los datos fiscales de la factura.</p>
            <div className="flex gap-2">
              <button onClick={scanPhoto} disabled={scanning} className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 text-white rounded-xl text-sm font-semibold hover:bg-amber-600 transition-all disabled:opacity-50">
                {scanning ? <><Loader2 size={14} className="animate-spin" /> Analizando...</> : <><Sparkles size={14} /> Extraer con IA</>}
              </button>
              <button onClick={() => { setPreview(null); setScanFile(null); }} className="px-3 py-2 bg-slate-100 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-200 transition-all"><X size={14} /></button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-indigo-400" size={32} /></div>
      ) : filtered.length === 0 ? (
        <div className="py-20 text-center bg-white rounded-3xl border-2 border-dashed border-slate-200">
          <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-bold">No se encontraron facturas</p>
          {isAdmin && <button onClick={() => setShowForm(true)} className="mt-3 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-all">Añadir primera factura</button>}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <th className="p-3 w-8"></th>
                  <th className="p-3">Fecha</th>
                  <th className="p-3">Nº Factura</th>
                  <th className="p-3">Proveedor</th>
                  <th className="p-3 text-right">Base</th>
                  <th className="p-3 text-right">IVA</th>
                  <th className="p-3 text-right">Total</th>
                  <th className="p-3 text-center">Banco</th>
                  <th className="p-3 text-center">Estado</th>
                  <th className="p-3 text-center">Origen</th>
                  {isAdmin && <th className="p-3"></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-[11px] font-medium">
                {filtered.map(f => {
                  const exp = expandedId === f.id;
                  const st = STATUS[f.estado] || STATUS.draft;
                  const linked = albaranes.filter(a => f.albaran_ids?.includes(a.id));
                  return (
                    <React.Fragment key={f.id}>
                      <tr className={cn('hover:bg-slate-50 cursor-pointer transition-colors', exp ? 'bg-indigo-50/30' : '')}>
                        <td className="p-3 text-center" onClick={() => setExpandedId(exp ? null : f.id)}>
                          <button className="p-1 rounded hover:bg-slate-200 text-slate-400">{exp ? <ChevronUp size={13} /> : <ChevronDown size={13} />}</button>
                        </td>
                        <td className="p-3 text-slate-500 font-bold">{f.fecha}</td>
                        <td className="p-3 font-mono text-indigo-600 font-bold">{f.num}</td>
                        <td className="p-3 font-black text-slate-900">{f.proveedor || f.cliente}</td>
                        <td className="p-3 text-right text-slate-500">{Num.fmt(f.base)}</td>
                        <td className="p-3 text-right text-slate-500">{Num.fmt(f.impuesto)}</td>
                        <td className="p-3 text-right font-black text-slate-900 text-sm">{Num.fmt(f.total)}</td>
                        <td className="p-3 text-center">
                          {f.conciliada ? <div className="flex flex-col items-center"><CheckCircle2 size={13} className="text-emerald-500" /><span className="text-[8px] font-black text-emerald-600 uppercase">Conc.</span></div>
                            : <div className="flex flex-col items-center opacity-30"><Clock size={13} className="text-slate-400" /><span className="text-[8px] font-black text-slate-500 uppercase">Pend.</span></div>}
                        </td>
                        <td className="p-3 text-center">
                          <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase border', st.color)}>
                            <st.icon size={9} /> {st.label}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          {f.origen === 'gmail-sync' ? <Mail size={13} className="text-indigo-500 mx-auto" title="Gmail" />
                            : f.origen === 'auto-from-albaran' ? <Zap size={13} className="text-amber-500 mx-auto" title="Auto" />
                            : <FileText size={13} className="text-slate-400 mx-auto" title="Manual" />}
                        </td>
                        {isAdmin && (
                          <td className="p-3 text-center" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center gap-1">
                              {f.estado !== 'paid' && <button onClick={() => handleChangeEstado(f.id, 'paid')} className="p-1 rounded hover:bg-emerald-50 text-emerald-600 transition-all" title="Marcar pagada"><Check size={13} /></button>}
                              <button onClick={() => handleDelete(f.id)} className="p-1 rounded hover:bg-rose-50 text-rose-500 transition-all" title="Eliminar"><Trash2 size={13} /></button>
                            </div>
                          </td>
                        )}
                      </tr>
                      <AnimatePresence>
                        {exp && (
                          <tr>
                            <td colSpan={isAdmin ? 11 : 10} className="p-0 bg-slate-50/50">
                              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                                <div className="p-5 flex gap-6">
                                  <div className="flex-1 space-y-3">
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Zap className="w-3 h-3 text-amber-500" />Albaranes Vinculados ({linked.length})</h4>
                                    {linked.length > 0 ? (
                                      <div className="grid grid-cols-2 gap-2">
                                        {linked.map(a => (
                                          <div key={a.id} className="bg-white border border-slate-200 rounded-lg p-3 flex justify-between items-center shadow-sm">
                                            <div><p className="text-[10px] font-black text-slate-800">{a.referencia || 'S/N'}</p><p className="text-[9px] text-slate-400">{a.fecha}</p></div>
                                            <div className="text-right"><p className="text-xs font-black text-slate-900">{Num.fmt(a.total)}</p><p className="text-[8px] text-emerald-500 font-black uppercase"><LinkIcon size={8} className="inline" /> Vinculado</p></div>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <div className="bg-white border border-dashed border-slate-300 rounded-xl p-4 text-center">
                                        <p className="text-[10px] text-slate-400 font-bold">Sin albaranes vinculados</p>
                                      </div>
                                    )}
                                    {f.archivo_b64 && <img src={f.archivo_b64} alt="Factura" className="mt-2 max-h-48 rounded-xl border border-slate-200 object-contain" />}
                                  </div>
                                  <div className="w-56 bg-white border border-slate-200 rounded-xl p-4 shadow-sm h-fit">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Resumen Fiscal</p>
                                    <div className="space-y-2 text-[11px]">
                                      <div className="flex justify-between"><span className="text-slate-500">Base</span><span className="font-bold">{Num.fmt(f.base)}</span></div>
                                      <div className="flex justify-between"><span className="text-slate-500">IVA</span><span className="font-bold">{Num.fmt(f.impuesto)}</span></div>
                                      <div className="h-px bg-slate-100 my-1"></div>
                                      <div className="flex justify-between text-sm"><span className="font-black text-slate-900">TOTAL</span><span className="font-black text-indigo-600">{Num.fmt(f.total)}</span></div>
                                    </div>
                                    {f.fecha_venc && <div className="mt-3 pt-3 border-t border-slate-100"><p className="text-[9px] font-black text-slate-400 uppercase">Vencimiento</p><p className="text-xs font-bold text-slate-700 mt-1">{f.fecha_venc}</p></div>}
                                  </div>
                                </div>
                              </motion.div>
                            </td>
                          </tr>
                        )}
                      </AnimatePresence>
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── New Factura Modal ────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <motion.div initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }} transition={{ type: 'spring', damping: 28, stiffness: 350 }} className="bg-white rounded-3xl w-full max-w-lg max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
                <h2 className="font-bold text-slate-900 flex items-center gap-2"><FileText size={18} /> Nueva Factura</h2>
                <button onClick={() => { setShowForm(false); setPreview(null); setScanFile(null); }} className="p-2 rounded-xl hover:bg-slate-100"><X size={18} /></button>
              </div>
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                {preview && <img src={preview} alt="factura" className="w-full rounded-2xl object-cover max-h-40 border" />}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-500 mb-1 block">Tipo</label>
                    <select value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value as any }))} className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
                      <option value="compra">Compra</option><option value="venta">Venta</option><option value="caja">Caja</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 mb-1 block">Nº Factura *</label>
                    <input value={form.num} onChange={e => setForm(f => ({ ...f, num: e.target.value }))} placeholder="FAC-2026-001" className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-500 mb-1 block">Fecha *</label>
                    <input type="date" value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 mb-1 block">Vencimiento</label>
                    <input type="date" value={form.fecha_venc} onChange={e => setForm(f => ({ ...f, fecha_venc: e.target.value }))} className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 mb-1 block">Proveedor</label>
                  <div className="flex gap-2">
                    <input value={form.proveedor} onChange={e => setForm(f => ({ ...f, proveedor: e.target.value }))} placeholder="Nombre del proveedor" className="flex-1 px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                    <VoiceButton small onResult={t => setForm(f => ({ ...f, proveedor: t }))} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[['Base', 'base'], ['IVA', 'impuesto'], ['Total', 'total']].map(([label, key]) => (
                    <div key={key as string}>
                      <label className="text-xs font-bold text-slate-500 mb-1 block">{label} €</label>
                      <input type="number" value={(form as any)[key as string]} onChange={e => setForm(f => ({ ...f, [key as string]: parseFloat(e.target.value) || 0 }))} className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                    </div>
                  ))}
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 mb-1 block">Vincular Albaranes</label>
                  <div className="max-h-32 overflow-y-auto space-y-1 border border-slate-200 rounded-xl p-2 bg-slate-50">
                    {albaranes.filter(a => a.estado !== 'facturado').map(a => (
                      <label key={a.id} className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-white cursor-pointer text-xs">
                        <input type="checkbox" checked={form.albaran_ids.includes(a.id)} onChange={e => setForm(f => ({ ...f, albaran_ids: e.target.checked ? [...f.albaran_ids, a.id] : f.albaran_ids.filter(id => id !== a.id) }))} className="rounded" />
                        <span className="font-semibold text-slate-700">{a.supplier_name}</span>
                        <span className="text-slate-400">{a.referencia || a.fecha}</span>
                        <span className="ml-auto font-bold text-slate-900">{Num.fmt(a.total)}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <div className="px-5 py-4 border-t border-slate-100 flex gap-3 shrink-0">
                <button onClick={() => { setShowForm(false); setPreview(null); setScanFile(null); }} className="flex-1 py-3 bg-slate-100 text-slate-700 font-semibold rounded-2xl text-sm">Cancelar</button>
                <button onClick={handleSave} disabled={saving} className="flex-1 py-3 bg-indigo-600 text-white font-semibold rounded-2xl text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                  {saving ? <><Loader2 size={14} className="animate-spin" /> Guardando...</> : <><Check size={14} /> Guardar Factura</>}
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
