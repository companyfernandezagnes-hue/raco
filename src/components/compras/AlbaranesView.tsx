import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Search, Camera, Mic, MicOff, Zap, X, Check,
  ChevronDown, ChevronUp, Trash2, FileText, Package,
  CheckCircle, Clock, XCircle, Loader2, Sparkles,
  Building2, Hash,
} from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import { supabase } from '../../supabase';
import { useSupabase } from '../../context/SupabaseContext';

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
  referencia: string;
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

interface Supplier {
  id: string;
  nombre: string;
  activo: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const aiRef = { current: null as GoogleGenAI | null };
function getAI(): GoogleGenAI {
  if (!aiRef.current) aiRef.current = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
  return aiRef.current;
}

function uid() { return Math.random().toString(36).slice(2, 10); }
function today() { return new Date().toISOString().split('T')[0]; }

function calcItem(item: Omit<AlbaranItem, 'base' | 'iva_amount' | 'total'>): AlbaranItem {
  const base = item.cantidad * item.precio_unitario;
  const iva_amount = base * (item.iva / 100);
  return { ...item, base, iva_amount, total: base + iva_amount };
}

function calcTotals(items: AlbaranItem[]) {
  const base = items.reduce((s, i) => s + i.base, 0);
  const iva_total = items.reduce((s, i) => s + i.iva_amount, 0);
  return { base, iva_total, total: base + iva_total };
}

function ivaClass(rate: IVARate) {
  if (rate === 4) return 'text-emerald-700 bg-emerald-50';
  if (rate === 10) return 'text-amber-700 bg-amber-50';
  return 'text-rose-700 bg-rose-50';
}

const ESTADO_CFG: Record<Estado, { label: string; cls: string }> = {
  pendiente:  { label: 'Pendiente',  cls: 'text-amber-700 bg-amber-50 border-amber-200' },
  recibido:   { label: 'Recibido',   cls: 'text-blue-700 bg-blue-50 border-blue-200' },
  facturado:  { label: 'Facturado',  cls: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  rechazado:  { label: 'Rechazado',  cls: 'text-rose-700 bg-rose-50 border-rose-200' },
};

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
  return suppliers.find(s =>
    s.nombre.toLowerCase().includes(n) || n.includes(s.nombre.toLowerCase())
  );
}

// ─── VoiceButton ──────────────────────────────────────────────────────────────

function VoiceButton({ onResult, small }: { onResult: (t: string) => void; small?: boolean }) {
  const [on, setOn] = useState(false);
  const ref = useRef<SpeechRecognition | null>(null);

  const toggle = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert('Necesitas Chrome para usar el micrófono'); return; }
    if (on) { ref.current?.stop(); setOn(false); return; }
    const r = new SR();
    ref.current = r;
    r.lang = 'es-ES'; r.continuous = false; r.interimResults = false;
    r.onstart = () => setOn(true);
    r.onresult = (e: SpeechRecognitionEvent) => onResult(e.results[0][0].transcript);
    r.onerror = r.onend = () => setOn(false);
    r.start();
  };

  const sz = small ? 14 : 16;
  return (
    <button type="button" onClick={toggle}
      className={`${small ? 'p-1.5' : 'p-2'} rounded-xl shrink-0 transition-all ${
        on ? 'bg-rose-500 text-white animate-pulse shadow-lg shadow-rose-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
      }`}>
      {on ? <MicOff size={sz} /> : <Mic size={sz} />}
    </button>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function AlbaranesView() {
  const { user } = useSupabase();
  const isAdmin = (user as any)?.rol === 'admin';

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

  const emptyForm = () => ({
    referencia: '', fecha: today(), supplier_name: '', proveedor_id: undefined as string | undefined,
    estado: 'pendiente' as Estado, notas: '', items: [] as AlbaranItem[], imagen_url: undefined as string | undefined,
  });
  const [form, setForm] = useState(emptyForm());

  // Quick entry
  const [quickText, setQuickText] = useState('');
  const [quickOn, setQuickOn] = useState(false);
  const [quickBusy, setQuickBusy] = useState(false);
  const quickRef = useRef<SpeechRecognition | null>(null);

  // Photo
  const [preview, setPreview] = useState<string | null>(null);
  const [scanFile, setScanFile] = useState<File | null>(null);
  const [scanning, setScanning] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Confirm
  const [pending, setPending] = useState<ReturnType<typeof emptyForm> | null>(null);

  // ── Load ──────────────────────────────────────────────────────────────────
  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    const [a, s] = await Promise.all([
      supabase.from('delivery_notes').select('*').order('created_at', { ascending: false }),
      supabase.from('suppliers').select('id,nombre,activo').eq('activo', true).order('nombre'),
    ]);
    if (a.data) setAlbaranes(a.data);
    if (s.data) setSuppliers(s.data);
    setLoading(false);
  }

  const filtered = albaranes.filter(a => {
    const q = search.toLowerCase();
    return (!q || a.referencia?.toLowerCase().includes(q) || a.supplier_name?.toLowerCase().includes(q))
      && (filterEstado === 'todos' || a.estado === filterEstado);
  });

  // ── Quick voice ───────────────────────────────────────────────────────────
  function toggleQuickVoice() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert('Necesitas Chrome para usar el micrófono'); return; }
    if (quickOn) { quickRef.current?.stop(); setQuickOn(false); return; }
    const r = new SR();
    quickRef.current = r;
    r.lang = 'es-ES'; r.continuous = true; r.interimResults = true;
    let final = '';
    const t = setTimeout(() => r.stop(), 15000);
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
      const prompt = `Eres un asistente de restaurante. Extrae datos del siguiente texto para crear un albarán de proveedor.

Texto: "${text}"
Proveedores conocidos: ${suppliers.map(s => s.nombre).join(', ') || 'ninguno'}
Fecha de hoy: ${today()}

Responde SOLO con JSON válido, sin markdown ni explicaciones:
{"referencia":"","fecha":"YYYY-MM-DD","supplier_name":"","notas":"","items":[{"descripcion":"","cantidad":0,"unidad":"","precio_unitario":0,"iva":4|10|21}]}

Reglas IVA: 4=alimentos básicos crudos, 10=alimentos procesados/restaurante, 21=otros`;

      const resp = await getAI().models.generateContent({
        model: 'gemini-2.0-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      });
      const raw = resp.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
      const items = parseAIItems(parsed.items || []);
      const sup = matchSupplier(parsed.supplier_name, suppliers);
      setPending({
        ...emptyForm(),
        referencia: parsed.referencia || '',
        fecha: parsed.fecha || today(),
        supplier_name: parsed.supplier_name || '',
        proveedor_id: sup?.id,
        notas: parsed.notas || '',
        items,
      });
    } catch {
      alert('No pude entender el texto. Inténtalo más claro o usa el modo Manual.');
    } finally {
      setQuickBusy(false);
    }
  }

  // ── Photo ─────────────────────────────────────────────────────────────────
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
      const prompt = `Analiza esta imagen de un albarán. Puede ser impreso, escrito a mano, ticket o nota en papel.
Proveedores conocidos: ${suppliers.map(s => s.nombre).join(', ') || 'ninguno'}
Fecha de hoy: ${today()}

Responde SOLO con JSON válido, sin markdown:
{"referencia":"","fecha":"YYYY-MM-DD","supplier_name":"","notas":"","items":[{"descripcion":"","cantidad":0,"unidad":"","precio_unitario":0,"iva":4|10|21}]}`;

      const resp = await getAI().models.generateContent({
        model: 'gemini-2.0-flash',
        contents: [{
          role: 'user',
          parts: [
            { inlineData: { mimeType: scanFile.type || 'image/jpeg', data: base64 } },
            { text: prompt },
          ],
        }],
      });
      const raw = resp.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
      const items = parseAIItems(parsed.items || []);
      const sup = matchSupplier(parsed.supplier_name, suppliers);
      setPending({
        ...emptyForm(),
        referencia: parsed.referencia || '',
        fecha: parsed.fecha || today(),
        supplier_name: parsed.supplier_name || '',
        proveedor_id: sup?.id,
        notas: parsed.notas || '',
        items,
        imagen_url: preview,
      });
      setScanFile(null); setPreview(null);
    } catch {
      alert('No pude leer la imagen. Intenta con mejor iluminación o usa el modo Manual.');
    } finally {
      setScanning(false);
    }
  }

  // ── Confirm ───────────────────────────────────────────────────────────────
  function confirmPending() {
    if (!pending) return;
    setForm(pending);
    setPending(null);
    setInputMode('manual');
    setShowForm(true);
    setQuickText('');
  }

  // ── Form ──────────────────────────────────────────────────────────────────
  function addItem() {
    setForm(f => ({ ...f, items: [...f.items, calcItem({ id: uid(), descripcion: '', cantidad: 1, unidad: 'ud', precio_unitario: 0, iva: 10 })] }));
  }

  function updItem(id: string, ch: Partial<AlbaranItem>) {
    setForm(f => ({ ...f, items: f.items.map(i => i.id === id ? calcItem({ ...i, ...ch }) : i) }));
  }

  function delItem(id: string) {
    setForm(f => ({ ...f, items: f.items.filter(i => i.id !== id) }));
  }

  async function save() {
    if (!form.supplier_name?.trim()) return alert('Añade el nombre del proveedor');
    if (!form.fecha) return alert('Añade la fecha');
    if (!form.items.length) return alert('Añade al menos un producto');
    setSaving(true);
    try {
      const t = calcTotals(form.items);
      const { error } = await supabase.from('delivery_notes').insert({
        referencia: form.referencia, fecha: form.fecha,
        supplier_name: form.supplier_name, proveedor_id: form.proveedor_id || null,
        estado: form.estado, base: t.base, iva_total: t.iva_total, total: t.total,
        items: form.items, notas: form.notas, empleado_id: user?.id || null,
        imagen_url: form.imagen_url || null,
      });
      if (error) throw error;
      setShowForm(false); setForm(emptyForm()); setInputMode('quick');
      await loadAll();
    } catch (err: any) {
      alert('Error al guardar: ' + err.message);
    } finally { setSaving(false); }
  }

  async function changeEstado(id: string, e: Estado) {
    await supabase.from('delivery_notes').update({ estado: e }).eq('id', id);
    setAlbaranes(prev => prev.map(a => a.id === id ? { ...a, estado: e } : a));
  }

  async function del(id: string) {
    if (!confirm('¿Eliminar este albarán?')) return;
    await supabase.from('delivery_notes').delete().eq('id', id);
    setAlbaranes(prev => prev.filter(a => a.id !== id));
  }

  const totales = calcTotals(form.items);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50">

      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-20 px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <div className="flex-1">
            <h1 className="text-lg font-bold text-slate-900">Albaranes</h1>
            <p className="text-xs text-slate-400">{albaranes.length} registros</p>
          </div>
          <button
            onClick={() => { setShowForm(true); setInputMode('quick'); setForm(emptyForm()); }}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-all shadow-sm"
          >
            <Plus size={16} /> Nuevo
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-4 space-y-3">
        {/* Filters */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar proveedor o referencia…"
              className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>
          <select value={filterEstado} onChange={e => setFilterEstado(e.target.value as any)}
            className="px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
            <option value="todos">Todos</option>
            <option value="pendiente">Pendiente</option>
            <option value="recibido">Recibido</option>
            <option value="facturado">Facturado</option>
            <option value="rechazado">Rechazado</option>
          </select>
        </div>

        {/* List */}
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin text-indigo-400" size={32} /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
            <Package size={48} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium text-slate-500">Sin albaranes</p>
            <p className="text-sm mt-1">Pulsa <strong>Nuevo</strong> y habla, saca una foto o escribe</p>
          </div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence>
              {filtered.map(alb => {
                const cfg = ESTADO_CFG[alb.estado];
                const exp = expandedId === alb.id;
                return (
                  <motion.div key={alb.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                    <div onClick={() => setExpandedId(exp ? null : alb.id)}
                      className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-semibold text-slate-800 text-sm truncate">{alb.supplier_name || '—'}</span>
                          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${cfg.cls}`}>
                            {cfg.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-400">
                          {alb.referencia && <span>#{alb.referencia}</span>}
                          <span>{alb.fecha ? new Date(alb.fecha).toLocaleDateString('es-ES') : '—'}</span>
                          <span>{alb.items?.length || 0} líneas</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold text-slate-900 text-sm">{alb.total?.toFixed(2)} €</p>
                        <p className="text-xs text-slate-400">IVA {alb.iva_total?.toFixed(2)} €</p>
                      </div>
                      {exp ? <ChevronUp size={16} className="text-slate-300 shrink-0" /> : <ChevronDown size={16} className="text-slate-300 shrink-0" />}
                    </div>

                    <AnimatePresence>
                      {exp && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }}
                          className="border-t border-slate-100">
                          <div className="px-4 py-3 space-y-3">
                            <div className="space-y-1">
                              {(alb.items || []).map((item, i) => (
                                <div key={i} className="flex items-center justify-between text-sm bg-slate-50 rounded-lg px-3 py-2">
                                  <span className="flex-1 text-slate-700">{item.descripcion}</span>
                                  <span className="text-slate-400 text-xs mx-2">{item.cantidad} {item.unidad}</span>
                                  <span className={`text-xs font-semibold px-1.5 py-0.5 rounded mr-2 ${ivaClass(item.iva)}`}>IVA {item.iva}%</span>
                                  <span className="font-semibold text-slate-800">{item.total?.toFixed(2)} €</span>
                                </div>
                              ))}
                            </div>
                            {alb.notas && (
                              <p className="text-xs text-slate-500 bg-amber-50 rounded-lg px-3 py-2 border border-amber-100">📝 {alb.notas}</p>
                            )}
                            <div className="flex items-center gap-2 flex-wrap">
                              {alb.estado === 'pendiente' && (
                                <button onClick={() => changeEstado(alb.id, 'recibido')}
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg">
                                  <CheckCircle size={12} /> Marcar recibido
                                </button>
                              )}
                              {alb.estado === 'recibido' && isAdmin && (
                                <button onClick={() => changeEstado(alb.id, 'facturado')}
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded-lg">
                                  <FileText size={12} /> Marcar facturado
                                </button>
                              )}
                              {alb.estado === 'pendiente' && (
                                <button onClick={() => changeEstado(alb.id, 'rechazado')}
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-100 text-rose-700 text-xs font-semibold rounded-lg">
                                  <XCircle size={12} /> Rechazar
                                </button>
                              )}
                              {isAdmin && (
                                <button onClick={() => del(alb.id)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-500 text-xs font-semibold rounded-lg ml-auto">
                                  <Trash2 size={12} /> Eliminar
                                </button>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* ─── New albaran modal ────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4"
            onClick={e => { if (e.target === e.currentTarget) { setShowForm(false); setForm(emptyForm()); }}}>
            <motion.div
              initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 350 }}
              className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">

              {/* Modal header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
                <h2 className="font-bold text-slate-900">Nuevo albarán</h2>
                <button onClick={() => { setShowForm(false); setForm(emptyForm()); }} className="p-2 rounded-xl hover:bg-slate-100">
                  <X size={18} />
                </button>
              </div>

              {/* Mode tabs */}
              <div className="flex gap-1.5 px-5 pt-4 shrink-0">
                {([
                  { id: 'quick' as const, icon: <Zap size={13} />, label: 'Rápido', desc: 'Habla o escribe' },
                  { id: 'photo' as const, icon: <Camera size={13} />, label: 'Foto', desc: 'Saca foto al papel' },
                  { id: 'manual' as const, icon: <FileText size={13} />, label: 'Manual', desc: 'Rellenar a mano' },
                ]).map(m => (
                  <button key={m.id} onClick={() => setInputMode(m.id)}
                    className={`flex-1 flex flex-col items-center py-2.5 px-2 rounded-2xl transition-all text-center ${
                      inputMode === m.id ? 'bg-indigo-600 text-white shadow' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}>
                    <div className="flex items-center gap-1 font-semibold text-xs">{m.icon} {m.label}</div>
                    <span className={`text-[10px] mt-0.5 ${inputMode === m.id ? 'text-indigo-200' : 'text-slate-400'}`}>{m.desc}</span>
                  </button>
                ))}
              </div>

              {/* Scrollable body */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

                {/* QUICK */}
                {inputMode === 'quick' && (
                  <div className="space-y-3">
                    <div className="bg-indigo-50 rounded-2xl p-4 border border-indigo-100">
                      <p className="text-xs font-semibold text-indigo-700 mb-1">💡 Habla o escribe con naturalidad</p>
                      <p className="text-xs text-indigo-500 leading-relaxed">
                        Ej: <em>"Carnes Selectas, 20 kg de solomillo a 25 euros, ref 1234"</em>
                      </p>
                    </div>
                    <div className="relative">
                      <textarea value={quickText} onChange={e => setQuickText(e.target.value)}
                        placeholder="Escribe aquí o pulsa el micrófono…"
                        rows={4}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300 pr-14" />
                      <button type="button" onClick={toggleQuickVoice}
                        className={`absolute right-3 bottom-3 p-2.5 rounded-xl transition-all ${
                          quickOn ? 'bg-rose-500 text-white animate-pulse shadow-lg shadow-rose-200' : 'bg-indigo-100 text-indigo-600 hover:bg-indigo-200'
                        }`}>
                        {quickOn ? <MicOff size={18} /> : <Mic size={18} />}
                      </button>
                    </div>
                    {quickOn && (
                      <p className="flex items-center gap-2 text-sm text-rose-500 animate-pulse">
                        <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
                        Escuchando… (máx. 15 seg)
                      </p>
                    )}
                    <button onClick={() => processQuick(quickText)} disabled={!quickText.trim() || quickBusy}
                      className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-2xl transition-all">
                      {quickBusy ? <><Loader2 size={16} className="animate-spin" /> Procesando con IA…</> : <><Sparkles size={16} /> Extraer con IA</>}
                    </button>
                  </div>
                )}

                {/* PHOTO */}
                {inputMode === 'photo' && (
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
                      </button>
                    ) : (
                      <div className="space-y-3">
                        <div className="relative rounded-2xl overflow-hidden bg-slate-100 max-h-56 flex items-center justify-center">
                          <img src={preview} alt="preview" className="w-full max-h-56 object-contain" />
                          <button onClick={() => { setScanFile(null); setPreview(null); }}
                            className="absolute top-2 right-2 p-1.5 bg-white rounded-lg shadow">
                            <X size={14} />
                          </button>
                        </div>
                        <button onClick={scanPhoto} disabled={scanning}
                          className="w-full flex items-center justify-center gap-2 py-3 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold rounded-2xl transition-all">
                          {scanning ? <><Loader2 size={16} className="animate-spin" /> Leyendo con IA…</> : <><Sparkles size={16} /> Leer albarán con IA</>}
                        </button>
                      </div>
                    )}
                    <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFile} />
                  </div>
                )}

                {/* MANUAL */}
                {inputMode === 'manual' && (
                  <div className="space-y-4">
                    {/* Proveedor */}
                    <div>
                      <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Proveedor *</label>
                      <div className="flex gap-2">
                        <div className="flex-1 relative">
                          <Building2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input value={form.supplier_name}
                            onChange={e => {
                              const v = e.target.value;
                              const s = suppliers.find(x => x.nombre.toLowerCase() === v.toLowerCase());
                              setForm(f => ({ ...f, supplier_name: v, proveedor_id: s?.id }));
                            }}
                            list="sup-list" placeholder="Nombre del proveedor"
                            className="w-full pl-8 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                          <datalist id="sup-list">{suppliers.map(s => <option key={s.id} value={s.nombre} />)}</datalist>
                        </div>
                        <VoiceButton onResult={t => setForm(f => ({ ...f, supplier_name: t }))} />
                      </div>
                    </div>

                    {/* Ref + Fecha */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Referencia</label>
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <Hash size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input value={form.referencia} onChange={e => setForm(f => ({ ...f, referencia: e.target.value }))}
                              placeholder="Nº albarán"
                              className="w-full pl-7 pr-2 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                          </div>
                          <VoiceButton small onResult={t => setForm(f => ({ ...f, referencia: t.replace(/\s/g,'') }))} />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Fecha *</label>
                        <input type="date" value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))}
                          className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                      </div>
                    </div>

                    {/* Items */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-semibold text-slate-600">Productos *</label>
                        <button type="button" onClick={addItem}
                          className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-semibold">
                          <Plus size={13} /> Añadir línea
                        </button>
                      </div>
                      {form.items.length === 0 ? (
                        <button type="button" onClick={addItem}
                          className="w-full border-2 border-dashed border-slate-200 hover:border-indigo-300 rounded-xl py-5 text-sm text-slate-400 hover:text-indigo-500 transition-all">
                          + Añadir primer producto
                        </button>
                      ) : (
                        <div className="space-y-2">
                          {form.items.map((item, idx) => (
                            <div key={item.id} className="bg-slate-50 rounded-xl p-3 space-y-2 border border-slate-100">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-400 w-5 shrink-0">{idx+1}</span>
                                <input value={item.descripcion} onChange={e => updItem(item.id, { descripcion: e.target.value })}
                                  placeholder="Descripción del producto"
                                  className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-300" />
                                <VoiceButton small onResult={t => updItem(item.id, { descripcion: t })} />
                                <button type="button" onClick={() => delItem(item.id)} className="p-1.5 text-slate-300 hover:text-rose-500">
                                  <X size={14} />
                                </button>
                              </div>
                              <div className="flex gap-1.5 pl-7">
                                <input type="number" value={item.cantidad} onChange={e => updItem(item.id, { cantidad: parseFloat(e.target.value)||0 })}
                                  placeholder="Cant." className="w-20 px-2 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-300" />
                                <input value={item.unidad} onChange={e => updItem(item.id, { unidad: e.target.value })}
                                  placeholder="ud" className="w-16 px-2 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-300" />
                                <input type="number" value={item.precio_unitario} onChange={e => updItem(item.id, { precio_unitario: parseFloat(e.target.value)||0 })}
                                  placeholder="€/ud" className="flex-1 px-2 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-300" />
                                <select value={item.iva} onChange={e => updItem(item.id, { iva: parseInt(e.target.value) as IVARate })}
                                  className={`px-2 py-2 rounded-lg text-xs font-semibold border-0 focus:outline-none cursor-pointer ${ivaClass(item.iva)}`}>
                                  <option value={4}>4%</option>
                                  <option value={10}>10%</option>
                                  <option value={21}>21%</option>
                                </select>
                              </div>
                              <div className="pl-7 text-right text-xs text-slate-500">
                                Base: <b>{item.base.toFixed(2)} €</b> · IVA: {item.iva_amount.toFixed(2)} € · Total: <b className="text-slate-800">{item.total.toFixed(2)} €</b>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Notas */}
                    <div>
                      <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Notas</label>
                      <div className="flex gap-2">
                        <textarea value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
                          rows={2} placeholder="Incidencias, condiciones…"
                          className="flex-1 px-3 py-2.5 border border-slate-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                        <VoiceButton onResult={t => setForm(f => ({ ...f, notas: t }))} />
                      </div>
                    </div>

                    {/* Totales */}
                    {form.items.length > 0 && (
                      <div className="bg-slate-900 rounded-2xl p-4 text-white space-y-1.5">
                        <div className="flex justify-between text-sm"><span className="text-slate-400">Base imponible</span><span>{totales.base.toFixed(2)} €</span></div>
                        <div className="flex justify-between text-sm"><span className="text-slate-400">IVA total</span><span>{totales.iva_total.toFixed(2)} €</span></div>
                        <div className="flex justify-between font-bold text-lg border-t border-slate-700 pt-2">
                          <span>TOTAL</span><span className="text-indigo-300">{totales.total.toFixed(2)} €</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Footer - only in manual mode */}
              {inputMode === 'manual' && (
                <div className="px-5 py-4 border-t border-slate-100 flex gap-3 shrink-0">
                  <button onClick={() => { setShowForm(false); setForm(emptyForm()); }}
                    className="flex-1 py-3 bg-slate-100 text-slate-700 font-semibold rounded-2xl text-sm">
                    Cancelar
                  </button>
                  <button onClick={save} disabled={saving}
                    className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold rounded-2xl text-sm flex items-center justify-center gap-2">
                    {saving ? <><Loader2 size={15} className="animate-spin" /> Guardando…</> : <><Check size={15} /> Guardar albarán</>}
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── IA confirm modal ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {pending && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <motion.div
              initial={{ y: 40, scale: 0.97 }} animate={{ y: 0, scale: 1 }} exit={{ y: 40, scale: 0.97 }}
              className="bg-white rounded-3xl w-full max-w-md max-h-[85vh] overflow-hidden shadow-2xl flex flex-col">
              <div className="px-5 pt-5 pb-3 border-b border-slate-100 shrink-0">
                <div className="flex items-center gap-2.5 mb-1">
                  <div className="w-8 h-8 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
                    <Sparkles size={15} className="text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">La IA ha extraído esto</h3>
                    <p className="text-xs text-slate-400">Revisa antes de confirmar</p>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-slate-50 rounded-xl p-3">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Proveedor</p>
                    <p className="font-semibold text-slate-800 text-sm">{pending.supplier_name || '—'}</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Fecha</p>
                    <p className="font-semibold text-slate-800 text-sm">
                      {pending.fecha ? new Date(pending.fecha + 'T12:00').toLocaleDateString('es-ES') : '—'}
                    </p>
                  </div>
                  {pending.referencia && (
                    <div className="bg-slate-50 rounded-xl p-3 col-span-2">
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Referencia</p>
                      <p className="font-semibold text-slate-800 text-sm">#{pending.referencia}</p>
                    </div>
                  )}
                </div>

                {pending.items.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 mb-2">{pending.items.length} producto(s) detectado(s)</p>
                    <div className="space-y-1.5">
                      {pending.items.map((item, i) => (
                        <div key={i} className="flex items-center justify-between bg-slate-50 rounded-xl px-3 py-2.5">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-slate-800 text-sm truncate">{item.descripcion}</p>
                            <p className="text-xs text-slate-400">{item.cantidad} {item.unidad} × {item.precio_unitario.toFixed(2)} €</p>
                          </div>
                          <div className="text-right ml-2 shrink-0">
                            <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${ivaClass(item.iva)}`}>IVA {item.iva}%</span>
                            <p className="font-bold text-slate-900 text-sm mt-0.5">{item.total.toFixed(2)} €</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    {(() => {
                      const t = calcTotals(pending.items);
                      return (
                        <div className="mt-2 bg-indigo-600 rounded-xl px-4 py-2.5 text-white flex justify-between items-center">
                          <span className="text-indigo-200 text-sm">Total</span>
                          <span className="font-bold text-lg">{t.total.toFixed(2)} €</span>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {pending.notas && (
                  <p className="text-xs text-slate-500 bg-amber-50 rounded-xl px-3 py-2 border border-amber-100">📝 {pending.notas}</p>
                )}
              </div>

              <div className="px-5 py-4 border-t border-slate-100 flex gap-3 shrink-0">
                <button onClick={() => setPending(null)}
                  className="flex-1 py-3 bg-slate-100 text-slate-700 font-semibold rounded-2xl text-sm">
                  Descartar
                </button>
                <button onClick={confirmPending}
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-2xl text-sm flex items-center justify-center gap-2">
                  <Check size={15} /> Confirmar y editar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}

export { AlbaranesView };
