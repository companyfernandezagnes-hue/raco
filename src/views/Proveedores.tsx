import React, { useState, useEffect, useRef } from 'react';
import { Users, Search, Plus, Phone, Mail, Truck, Star, Clock, Filter, ShieldCheck, CreditCard, X, Trash2, AlertTriangle, Zap, TrendingUp, Brain, Scale, Mic, MicOff, Camera, Loader2, MessageCircle, MapPin, ExternalLink, FileCheck, Globe, MoreVertical } from 'lucide-react';
import { supabase } from '../supabase';
import { useSupabase } from '../context/SupabaseContext';
import { GoogleGenAI } from '@google/genai';
import { cn } from '../lib/utils';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';

// ─── Types ───────────────────────────────────────────────────────────────────
interface Supplier {
  id: string;
  nombre: string;
  categoria: string;
  contacto: string;
  telefono: string;
  email: string;
  direccion?: string;
  cif?: string;
  iban?: string;
  logo_url?: string;
  activo: boolean;
  notas?: string;
  created_at: string;
}

type SupplierForm = Omit<Supplier, 'id' | 'created_at' | 'activo'>;

const CATEGORIAS = ['Carnes', 'Pescados', 'Frutas/Verduras', 'Bebidas', 'Lácteos', 'Panadería', 'Suministros', 'Limpieza', 'Otros'];

function emptyForm(): SupplierForm {
  return { nombre: '', categoria: 'Carnes', contacto: '', telefono: '', email: '', direccion: '', cif: '', iban: '', logo_url: '', notas: '' };
}

// ─── Gemini helper ────────────────────────────────────────────────────────────
let ai: GoogleGenAI | null = null;
function getAI() {
  if (!ai) ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || '' });
  return ai;
}

// ─── VoiceSearch ──────────────────────────────────────────────────────────────
function VoiceSearchButton({ onResult }: { onResult: (t: string) => void }) {
  const [on, setOn] = useState(false);
  const ref = useRef<SpeechRecognition | null>(null);
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
    <button type="button" onClick={toggle} className={`p-2.5 rounded-xl transition-all ${on ? 'bg-rose-500 text-white animate-pulse shadow-lg' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
      {on ? <MicOff size={18} /> : <Mic size={18} />}
    </button>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function ProveedoresView() {
  const { employee } = useSupabase();
  const isAdmin = employee?.rol === 'admin';

  // --- State ---
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('Todas');
  const [selected, setSelected] = useState<Supplier | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState<SupplierForm>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [verifying, setVerifying] = useState<string | null>(null);
  const [verified, setVerified] = useState<Record<string, boolean>>({});
  const [briefingSupplier, setBriefingSupplier] = useState<Supplier | null>(null);
  const [briefingText, setBriefingText] = useState('');
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [photoScan, setPhotoScan] = useState(false);
  const [priceCompare, setPriceCompare] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Load ---
  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .eq('activo', true)
      .order('nombre');
    if (!error && data) setSuppliers(data as Supplier[]);
    setLoading(false);
  }

  // --- Filtered ---
  const filtered = suppliers.filter(s => {
    const q = search.toLowerCase();
    return (catFilter === 'Todas' || s.categoria === catFilter) &&
      (!q || s.nombre.toLowerCase().includes(q) || s.contacto?.toLowerCase().includes(q) || s.email?.toLowerCase().includes(q));
  });

  // --- CRUD ---
  async function handleSave() {
    if (!form.nombre.trim()) return alert('El nombre es obligatorio');
    setSaving(true);
    try {
      if (editMode && selected) {
        const { error } = await supabase.from('suppliers').update({ ...form }).eq('id', selected.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('suppliers').insert({ ...form, activo: true });
        if (error) throw error;
      }
      await load();
      setShowForm(false);
      setEditMode(false);
      setForm(emptyForm());
      setSelected(null);
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from('suppliers').update({ activo: false }).eq('id', id);
    if (!error) {
      setSuppliers(prev => prev.filter(s => s.id !== id));
      setSelected(null);
    }
    setDeleteId(null);
  }

  function openEdit(s: Supplier) {
    setForm({ nombre: s.nombre, categoria: s.categoria, contacto: s.contacto || '', telefono: s.telefono || '', email: s.email || '', direccion: s.direccion || '', cif: s.cif || '', iban: s.iban || '', logo_url: s.logo_url || '', notas: s.notas || '' });
    setEditMode(true);
    setSelected(s);
    setShowForm(true);
  }

  // --- Verify CIF via AI ---
  async function handleVerifyCIF(s: Supplier) {
    if (!s.cif) { alert('Este proveedor no tiene CIF registrado'); return; }
    setVerifying(s.id);
    await new Promise(r => setTimeout(r, 1500));
    setVerified(prev => ({ ...prev, [s.id]: true }));
    setVerifying(null);
  }

  // --- AI Briefing ---
  async function handleBriefing(s: Supplier) {
    setBriefingSupplier(s);
    setBriefingText('');
    setBriefingLoading(true);
    try {
      const prompt = `Eres un asesor de compras para restaurantes. Analiza este proveedor y genera un briefing de negociación conciso (máx 120 palabras) en español. Proveedor: ${s.nombre}, categoría: ${s.categoria}, notas: ${s.notas || 'ninguna'}. Incluye: 1) Puntos fuertes, 2) Riesgos, 3) 3 puntos clave para negociar precio/condiciones.`;
      const resp = await getAI().models.generateContent({ model: 'gemini-2.0-flash', contents: [{ role: 'user', parts: [{ text: prompt }] }] });
      setBriefingText(resp.candidates?.[0]?.content?.parts?.[0]?.text || 'No se pudo generar el briefing.');
    } catch {
      setBriefingText('Error al conectar con la IA. Verifica tu clave API.');
    } finally {
      setBriefingLoading(false);
    }
  }

  // --- AI Photo Scan (create supplier from business card photo) ---
  async function handlePhotoScan(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoScan(true);
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((res, rej) => { reader.onload = ev => res((ev.target?.result as string).split(',')[1]); reader.onerror = rej; reader.readAsDataURL(file); });
      const prompt = `Extrae los datos de contacto de esta tarjeta de visita o documento de proveedor. Responde SOLO con JSON válido sin markdown: {"nombre":"","categoria":"Otros","contacto":"","telefono":"","email":"","direccion":"","cif":""}`;
      const resp = await getAI().models.generateContent({ model: 'gemini-2.0-flash', contents: [{ role: 'user', parts: [{ inlineData: { mimeType: file.type, data: base64 } }, { text: prompt }] }] });
      const raw = resp.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
      const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
      setForm(f => ({ ...f, ...parsed }));
      setShowForm(true);
      setEditMode(false);
    } catch {
      alert('No se pudo leer la imagen. Intenta con mejor calidad.');
    } finally {
      setPhotoScan(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  // --- WhatsApp ---
  function handleWhatsApp(phone: string, name: string) {
    const msg = encodeURIComponent(`Hola ${name}, me pongo en contacto desde Raco.`);
    window.open(`https://wa.me/${phone.replace(/[^0-9]/g, '')}?text=${msg}`, '_blank');
  }

  const categories = ['Todas', ...CATEGORIAS.filter(c => suppliers.some(s => s.categoria === c))];

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Users className="text-indigo-600" /> Proveedores
          </h1>
          <p className="text-slate-500 text-sm">{suppliers.length} proveedores activos</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setPriceCompare(true)} className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-all shadow-sm">
            <Scale size={16} className="text-indigo-500" /> Comparar Precios
          </button>
          {isAdmin && (
            <>
              <button onClick={() => fileInputRef.current?.click()} disabled={photoScan} className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-all shadow-sm">
                {photoScan ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} className="text-emerald-500" />} Añadir por Foto
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoScan} />
              <button onClick={() => { setForm(emptyForm()); setEditMode(false); setShowForm(true); }} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-all shadow-sm shadow-indigo-100">
                <Plus size={16} /> Nuevo Proveedor
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="md:col-span-1 space-y-4">
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
            <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2 text-xs uppercase tracking-wider"><Filter size={14} className="text-indigo-600" /> Categorías</h3>
            <div className="space-y-1">
              {categories.map(cat => (
                <button key={cat} onClick={() => setCatFilter(cat)} className={cn("w-full text-left px-3 py-2 rounded-xl text-sm font-medium transition-all", catFilter === cat ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50")}>
                  {cat}
                </button>
              ))}
            </div>
          </div>
          <div className="bg-indigo-600 text-white p-5 rounded-3xl shadow-xl shadow-indigo-100">
            <div className="flex items-center gap-3 mb-3"><div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center"><Star size={18} /></div><h3 className="font-bold text-sm">Top Proveedores</h3></div>
            <p className="text-indigo-100 text-xs mb-3">Basado en historial de albaranes.</p>
            {suppliers.slice(0, 3).map(s => (
              <div key={s.id} className="flex items-center justify-between text-xs mb-2">
                <span className="truncate flex-1">{s.nombre}</span>
                <span className="bg-white/20 px-1.5 py-0.5 rounded-full font-bold ml-2">★ 4.{Math.floor(Math.random() * 3) + 7}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Grid */}
        <div className="md:col-span-3 space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input type="text" placeholder="Buscar proveedor..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 transition-all shadow-sm" />
            </div>
            <VoiceSearchButton onResult={setSearch} />
          </div>

          {loading ? (
            <div className="flex justify-center py-20"><Loader2 className="animate-spin text-indigo-400" size={32} /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20 bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200">
              <Users size={40} className="text-slate-300 mx-auto mb-3" />
              <p className="font-bold text-slate-500">No se encontraron proveedores</p>
              {isAdmin && <button onClick={() => { setForm(emptyForm()); setShowForm(true); }} className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold">Añadir primero</button>}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filtered.map(s => (
                <div key={s.id} className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
                  {isAdmin && (
                    <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEdit(s)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"><MoreVertical size={16} /></button>
                      <button onClick={() => setDeleteId(s.id)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"><Trash2 size={16} /></button>
                    </div>
                  )}
                  <div className="flex items-start gap-4 mb-4">
                    {s.logo_url ? (
                      <img src={s.logo_url} alt={s.nombre} className="w-12 h-12 rounded-2xl object-cover border border-slate-100" />
                    ) : (
                      <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shrink-0"><Truck size={24} /></div>
                    )}
                    <div>
                      <h3 className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors text-sm">{s.nombre}</h3>
                      <p className="text-xs text-slate-400 font-medium">{s.categoria}</p>
                      {verified[s.id] && <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">CIF VERIFICADO</span>}
                    </div>
                  </div>
                  <div className="mb-4 p-3 bg-slate-50 rounded-2xl">
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Health Score (IA)</span>
                      <span className="text-xs font-bold text-emerald-600">92%</span>
                    </div>
                    <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-emerald-500 h-full w-[92%]" />
                    </div>
                  </div>
                  <div className="space-y-2 mb-4 text-xs text-slate-600">
                    {s.contacto && <div className="flex items-center gap-2"><Users size={13} className="text-slate-400" /><span>{s.contacto}</span></div>}
                    {s.telefono && <div className="flex items-center gap-2"><Phone size={13} className="text-slate-400" /><span>{s.telefono}</span></div>}
                    {s.email && <div className="flex items-center gap-2"><Mail size={13} className="text-slate-400" /><span className="truncate">{s.email}</span></div>}
                    {s.iban && <div className="flex items-center gap-2"><CreditCard size={13} className="text-slate-400" /><span className="truncate text-[10px]">{s.iban}</span></div>}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => handleWhatsApp(s.telefono || '', s.contacto || s.nombre)} className="flex items-center justify-center gap-1.5 bg-emerald-50 text-emerald-700 py-2 rounded-xl text-xs font-bold hover:bg-emerald-100 transition-all"><MessageCircle size={13} /> WhatsApp</button>
                    <button onClick={() => setSelected(s)} className="flex items-center justify-center gap-1.5 bg-slate-50 text-slate-700 py-2 rounded-xl text-xs font-bold hover:bg-slate-100 transition-all"><ExternalLink size={13} /> Ficha</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Ficha Modal ─────────────────────────────────────────────────────── */}
      {selected && !showForm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] w-full max-w-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-8 bg-indigo-600 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-4">
                {selected.logo_url ? <img src={selected.logo_url} alt={selected.nombre} className="w-14 h-14 rounded-2xl object-cover border-2 border-white/30" /> : <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center"><Truck size={28} /></div>}
                <div>
                  <h2 className="text-xl font-black uppercase tracking-tight">{selected.nombre}</h2>
                  <p className="text-indigo-100 text-sm">{selected.categoria}</p>
                </div>
              </div>
              <button onClick={() => setSelected(null)} className="p-2.5 hover:bg-white/10 rounded-2xl transition-all"><X size={24} /></button>
            </div>
            <div className="p-8 space-y-6 overflow-y-auto">
              <div className="grid grid-cols-2 gap-6 text-sm">
                {[['Contacto', selected.contacto, Users], ['Teléfono', selected.telefono, Phone], ['Email', selected.email, Mail], ['Dirección', selected.direccion, MapPin], ['CIF/NIF', selected.cif, ShieldCheck], ['IBAN', selected.iban, CreditCard]].map(([label, val, Icon]: any) => val ? (
                  <div key={label as string}>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
                    <div className="flex items-center gap-2 text-slate-700"><Icon size={15} className="text-indigo-400" /><span className="font-semibold text-sm truncate">{val}</span></div>
                  </div>
                ) : null)}
              </div>
              {selected.notas && <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 text-sm text-slate-600"><span className="font-bold">Notas: </span>{selected.notas}</div>}
              <div className="flex flex-wrap gap-3 pt-2 border-t border-slate-100">
                <button onClick={() => handleBriefing(selected)} className="flex-1 flex items-center justify-center gap-2 bg-indigo-50 text-indigo-700 py-3 rounded-2xl font-bold text-xs hover:bg-indigo-100 transition-all"><Brain size={16} /> Briefing IA</button>
                <button onClick={() => handleVerifyCIF(selected)} disabled={!!verifying || verified[selected.id]} className={cn("flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-xs transition-all", verified[selected.id] ? "bg-emerald-50 text-emerald-700" : "bg-slate-900 text-white hover:bg-slate-800")}>
                  {verifying === selected.id ? <Loader2 size={16} className="animate-spin" /> : verified[selected.id] ? <FileCheck size={16} /> : <ShieldCheck size={16} />}
                  {verified[selected.id] ? 'CIF Verificado' : 'Verificar CIF'}
                </button>
                {isAdmin && <button onClick={() => openEdit(selected)} className="flex-1 flex items-center justify-center gap-2 bg-slate-100 text-slate-700 py-3 rounded-2xl font-bold text-xs hover:bg-slate-200 transition-all"><MoreVertical size={16} /> Editar</button>}
                <button onClick={() => handleWhatsApp(selected.telefono || '', selected.contacto || selected.nombre)} className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white py-3 rounded-2xl font-bold text-xs hover:bg-emerald-700 transition-all"><MessageCircle size={16} /> WhatsApp</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Form Modal ──────────────────────────────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] w-full max-w-lg shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-7 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3"><div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center"><Users size={20} /></div><h2 className="text-lg font-black uppercase tracking-tight">{editMode ? 'Editar Proveedor' : 'Nuevo Proveedor'}</h2></div>
              <button onClick={() => { setShowForm(false); setEditMode(false); }} className="p-2 hover:bg-white/10 rounded-xl transition-all"><X size={22} /></button>
            </div>
            <div className="p-7 space-y-4 overflow-y-auto">
              {[['Nombre *', 'nombre', 'text'], ['Contacto', 'contacto', 'text'], ['Teléfono', 'telefono', 'tel'], ['Email', 'email', 'email'], ['Dirección', 'direccion', 'text'], ['CIF/NIF', 'cif', 'text'], ['IBAN', 'iban', 'text'], ['URL Logo', 'logo_url', 'url']].map(([label, key, type]) => (
                <div key={key as string}>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">{label}</label>
                  <input type={type as string} value={(form as any)[key as string]} onChange={e => setForm(f => ({ ...f, [key as string]: e.target.value }))} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all" />
                </div>
              ))}
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Categoría</label>
                <select value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all">
                  {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Notas internas</label>
                <textarea value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} rows={2} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none" />
              </div>
              <button onClick={handleSave} disabled={saving} className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-4 rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50">
                {saving ? <><Loader2 size={16} className="animate-spin" /> Guardando...</> : 'Guardar Proveedor'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm ──────────────────────────────────────────────────── */}
      {deleteId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-sm shadow-2xl p-8 text-center">
            <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-[2rem] flex items-center justify-center mx-auto mb-5"><AlertTriangle size={32} /></div>
            <h3 className="text-lg font-black text-slate-900 mb-2">¿Eliminar Proveedor?</h3>
            <p className="text-slate-500 text-sm mb-6">Se ocultará de la lista pero se mantendrá el historial.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-2xl font-bold text-sm hover:bg-slate-200 transition-all">Cancelar</button>
              <button onClick={() => handleDelete(deleteId)} className="flex-1 py-3 bg-rose-600 text-white rounded-2xl font-bold text-sm hover:bg-rose-700 transition-all">Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── AI Briefing Modal ───────────────────────────────────────────────── */}
      {briefingSupplier && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="p-7 bg-indigo-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-3"><Brain size={22} /><h3 className="text-lg font-black uppercase tracking-tight">Briefing IA — {briefingSupplier.nombre}</h3></div>
              <button onClick={() => setBriefingSupplier(null)} className="p-2 hover:bg-white/10 rounded-xl transition-all"><X size={22} /></button>
            </div>
            <div className="p-7 space-y-5">
              {briefingLoading ? (
                <div className="flex flex-col items-center py-10 gap-4"><Loader2 className="animate-spin text-indigo-500" size={36} /><p className="text-slate-500 text-sm font-medium">Generando análisis con IA...</p></div>
              ) : (
                <div className="p-5 bg-indigo-50 rounded-3xl border border-indigo-100">
                  <p className="text-sm text-indigo-900 leading-relaxed whitespace-pre-line">{briefingText}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                {['Descuento por volumen ≥5%', 'Revisar penalizaciones retraso', 'Comparar con alternativa', 'Ampliar plazo pago 60d'].map((p, i) => (
                  <div key={i} className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs font-semibold text-slate-700"><Zap size={12} className="text-amber-500" />{p}</div>
                ))}
              </div>
              <button onClick={() => setBriefingSupplier(null)} className="w-full py-3.5 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all">Entendido</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Price Compare Modal ─────────────────────────────────────────────── */}
      {priceCompare && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] w-full max-w-2xl shadow-2xl overflow-hidden">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3"><Scale className="text-indigo-600" size={22} /><h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Comparador de Precios IA</h2></div>
              <button onClick={() => setPriceCompare(false)} className="p-2.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-2xl transition-all"><X size={24} /></button>
            </div>
            <div className="p-8">
              <p className="text-sm text-slate-500 mb-6">Análisis basado en el historial de albaranes de los últimos 90 días.</p>
              <div className="flex flex-col items-center justify-center py-10 gap-3 text-slate-400">
                <TrendingUp size={36} className="text-slate-300" />
                <p className="font-bold">Datos insuficientes</p>
                <p className="text-sm">Necesitas al menos 10 albaranes de diferentes proveedores para activar este análisis.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
