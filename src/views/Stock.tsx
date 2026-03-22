import React, { useState, useEffect, useRef } from 'react';
import {
  Package, Search, Filter, Plus, ArrowUp, ArrowDown, AlertTriangle,
  CheckCircle2, History, BarChart3, TrendingDown, TrendingUp, Wine, Utensils,
  MessageCircle, RefreshCw, Eye, Truck, FileText, Zap, ArrowUpRight,
  ArrowDownLeft, X, Brain, Lightbulb, Camera, Loader2, Mic, MicOff, Trash2
} from 'lucide-react';
import { supabase } from '../supabase';
import { useSupabase } from '../context/SupabaseContext';

interface StockItem {
  id: string; name: string; category: string; unit: string;
  current_stock: number; min_stock: number; price_per_unit: number;
  supplier_id?: string; location?: string; last_updated?: string;
  notes?: string; active: boolean;
}
interface StockMovement {
  id: string; stock_item_id: string; type: string; quantity: number;
  unit_cost?: number; reason?: string; reference?: string; created_at?: string;
}
interface Supplier { id: string; name: string; }

const GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY;
async function callGemini(prompt: string): Promise<string> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
    { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({contents:[{parts:[{text:prompt}]}]}) }
  );
  const json = await res.json();
  return json.candidates?.[0]?.content?.parts?.[0]?.text ?? 'Sin respuesta';
}
async function callGeminiVision(base64: string, mimeType: string, prompt: string): Promise<string> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
    { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({contents:[{parts:[{inlineData:{mimeType,data:base64}},{text:prompt}]}]}) }
  );
  const json = await res.json();
  return json.candidates?.[0]?.content?.parts?.[0]?.text ?? 'Sin respuesta';
}
function VoiceButton({ onResult, className='' }: { onResult:(t:string)=>void; className?:string }) {
  const [listening, setListening] = useState(false);
  const recRef = useRef<any>(null);
  const toggle = () => {
    if (listening) { recRef.current?.stop(); setListening(false); return; }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert('Tu navegador no soporta voz'); return; }
    const rec = new SR(); rec.lang='es-ES'; rec.interimResults=false;
    rec.onresult = (e:any) => { onResult(e.results[0][0].transcript); setListening(false); };
    rec.onerror = () => setListening(false); rec.onend = () => setListening(false);
    recRef.current = rec; rec.start(); setListening(true);
  };
  return <button type="button" onClick={toggle} className={`p-2 rounded-full transition-all ${listening?'bg-red-500 text-white animate-pulse':'bg-indigo-100 text-indigo-600 hover:bg-indigo-200'} ${className}`} title={listening?'Parar':'Voz'}>{listening?<MicOff size={16}/>:<Mic size={16}/>}</button>;
}
export default function StockView() {
  const { employee } = useSupabase();
  const isAdmin = employee?.rol === 'admin';
  const [activeTab, setActiveTab] = useState<'inventario'|'movimientos'|'analytics'>('inventario');
  const [items, setItems] = useState<StockItem[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string|null>(null);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('Todos');
  const [showLowStock, setShowLowStock] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showMovModal, setShowMovModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<StockItem|null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<string|null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [newItem, setNewItem] = useState({
    name:'', category:'Comida', unit:'kg', current_stock:0, min_stock:0, price_per_unit:0, location:'', notes:''
  });
  const [newMov, setNewMov] = useState({
    stock_item_id:'', type:'entrada', quantity:0, unit_cost:0, reason:'', reference:''
  });

  useEffect(() => { loadAll(); }, []);
  async function loadAll() {
    setLoading(true); setError(null);
    try {
      const [it, mv, sp] = await Promise.all([
        supabase.from('stock_items').select('*').eq('active',true).order('name'),
        supabase.from('stock_movements').select('*').order('created_at',{ascending:false}).limit(100),
        supabase.from('suppliers').select('id,name').order('name'),
      ]);
      if (it.error) throw it.error; if (mv.error) throw mv.error; if (sp.error) throw sp.error;
      setItems(it.data||[]); setMovements(mv.data||[]); setSuppliers(sp.data||[]);
    } catch(err:any) { setError(err.message||'Error cargando stock'); }
    finally { setLoading(false); }
  }
  async function handleAddItem() {
    if (!newItem.name.trim()||!newItem.unit) { alert('Nombre y unidad son obligatorios'); return; }
    const {error} = await supabase.from('stock_items').insert([{
      name:newItem.name.trim(), category:newItem.category, unit:newItem.unit,
      current_stock:newItem.current_stock, min_stock:newItem.min_stock,
      price_per_unit:newItem.price_per_unit, location:newItem.location||null, notes:newItem.notes||null, active:true
    }]);
    if (error) { alert('Error: '+error.message); return; }
    setShowModal(false); setNewItem({name:'',category:'Comida',unit:'kg',current_stock:0,min_stock:0,price_per_unit:0,location:'',notes:''}); loadAll();
  }
  async function handleDeleteItem(id:string) {
    if (!confirm('¿Eliminar este producto del inventario?')) return;
    const {error} = await supabase.from('stock_items').update({active:false}).eq('id',id);
    if (error) { alert('Error: '+error.message); return; }
    loadAll();
  }
  async function handleAddMovement() {
    if (!newMov.stock_item_id||newMov.quantity<=0) { alert('Selecciona producto y cantidad > 0'); return; }
    const {error} = await supabase.from('stock_movements').insert([{
      stock_item_id:newMov.stock_item_id, type:newMov.type, quantity:newMov.quantity,
      unit_cost:newMov.unit_cost||null, reason:newMov.reason||null, reference:newMov.reference||null,
      created_by:employee?.nombre||'Sistema',
    }]);
    if (error) { alert('Error: '+error.message); return; }
    setShowMovModal(false); setNewMov({stock_item_id:'',type:'entrada',quantity:0,unit_cost:0,reason:'',reference:''}); loadAll();
  }
  async function handleAIAnalysis() {
    setAiLoading(true); setAiResult(null);
    try {
      const lowStock = items.filter(i=>i.current_stock<=i.min_stock).map(i=>`${i.name} (${i.current_stock}${i.unit}, mín:${i.min_stock})`).join(', ');
      const topItems = items.slice(0,10).map(i=>`${i.name}: ${i.current_stock}${i.unit}`).join(', ');
      const result = await callGemini(`Eres el jefe de almacén de un restaurante. Analiza este inventario y da recomendaciones concretas:\nStock bajo: ${lowStock||'ninguno'}.\nInventario: ${topItems}.\nDa 3-5 sugerencias de compra o gestión en español con bullet points.`);
      setAiResult(result);
    } catch(err:any) { setAiResult('Error IA: '+err.message); }
    finally { setAiLoading(false); }
  }
  async function handlePhotoScan(e:React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setAiLoading(true);
    try {
      const base64 = await new Promise<string>((resolve,reject)=>{
        const r=new FileReader(); r.onload=()=>resolve((r.result as string).split(',')[1]); r.onerror=reject; r.readAsDataURL(file);
      });
      const result = await callGeminiVision(base64, file.type, 'Analiza esta imagen de almacén o ticket de compra. Extrae productos en JSON array: [{"name":"","unit":"","quantity":0,"price":0}]. Solo JSON.');
      const m=result.match(/\[[\s\S]*\]/);
      if(m){
        const items=JSON.parse(m[0]);
        if(items.length>0){
          const first=items[0];
          setNewItem(prev=>({...prev,name:first.name||prev.name,unit:first.unit||prev.unit,current_stock:first.quantity||prev.current_stock,price_per_unit:first.price||prev.price_per_unit}));
          setShowModal(true);
          alert(`Se detectaron ${items.length} productos. Primer producto cargado para revisión.`);
        }
      } else { alert('No se pudieron extraer datos.'); }
    } catch(err:any) { alert('Error imagen: '+err.message); }
    finally { setAiLoading(false); if(e.target) e.target.value=''; }
  }
  const CATS=['Todos','Comida','Bebida','Suministros','Limpieza','Otro'];
  const UNITS=['kg','g','l','ml','ud','caja','bolsa','botella'];
  const MOV_TYPES=['entrada','salida','ajuste','merma'];
  const lowStockCount = items.filter(i=>i.current_stock<=i.min_stock).length;
  const totalValue = items.reduce((s,i)=>s+(i.current_stock*i.price_per_unit),0);
  const filtered = items.filter(i=>{
    const matchSearch = i.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCat==='Todos'||i.category===filterCat;
    const matchLow = !showLowStock||(i.current_stock<=i.min_stock);
    return matchSearch&&matchCat&&matchLow;
  });
  const catColor:Record<string,string>={Comida:'bg-amber-100 text-amber-700',Bebida:'bg-blue-100 text-blue-700',Suministros:'bg-slate-100 text-slate-600',Limpieza:'bg-green-100 text-green-700',Otro:'bg-purple-100 text-purple-700'};
  const movColor:Record<string,string>={entrada:'text-emerald-600',salida:'text-red-500',ajuste:'text-blue-600',merma:'text-amber-600'};
  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-indigo-500" size={40}/><span className="ml-3 text-slate-500">Cargando inventario...</span></div>;
  if (error) return <div className="flex flex-col items-center justify-center h-64 gap-4"><AlertTriangle className="text-red-500" size={40}/><p className="text-red-600">{error}</p><button onClick={loadAll} className="px-4 py-2 bg-indigo-600 text-white rounded-xl">Reintentar</button></div>;
  return (
    <div className="min-h-screen bg-slate-50 p-6 space-y-6">
      <input ref={photoInputRef} type="file" accept="image/*" onChange={handlePhotoScan} className="hidden"/>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Stock & Almacén</h1>
          <p className="text-slate-500 text-sm mt-1">Control de inventario, movimientos y análisis IA</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={()=>photoInputRef.current?.click()} disabled={aiLoading}
            className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-xl hover:bg-purple-700 text-sm font-medium disabled:opacity-50">
            {aiLoading?<Loader2 size={16} className="animate-spin"/>:<Camera size={16}/>} Escanear Ticket
          </button>
          <button onClick={handleAIAnalysis} disabled={aiLoading}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl hover:bg-indigo-700 text-sm font-medium disabled:opacity-50">
            {aiLoading?<Loader2 size={16} className="animate-spin"/>:<Brain size={16}/>} IA: Analizar Stock
          </button>
          <button onClick={()=>setShowMovModal(true)} className="flex items-center gap-2 bg-amber-500 text-white px-4 py-2 rounded-xl hover:bg-amber-600 text-sm font-medium">
            <ArrowUp size={16}/> Movimiento
          </button>
          <button onClick={()=>setShowModal(true)} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl hover:bg-emerald-700 text-sm font-medium">
            <Plus size={16}/> Nuevo Producto
          </button>
        </div>
      </div>

      {aiResult&&(
        <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-5 relative">
          <button onClick={()=>setAiResult(null)} className="absolute top-3 right-3 text-slate-400 hover:text-slate-600"><X size={16}/></button>
          <div className="flex items-start gap-3"><Brain size={20} className="text-indigo-600 mt-0.5 flex-shrink-0"/>
            <div><p className="font-bold text-indigo-800 mb-2">Análisis IA del Inventario</p><pre className="text-slate-700 text-sm whitespace-pre-wrap font-sans">{aiResult}</pre></div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {label:'Total productos',value:items.length,icon:Package,color:'text-indigo-600',bg:'bg-indigo-50'},
          {label:'Stock bajo',value:lowStockCount,icon:AlertTriangle,color:'text-rose-600',bg:'bg-rose-50'},
          {label:'Valor inventario',value:totalValue.toLocaleString('es-ES',{style:'currency',currency:'EUR'}),icon:TrendingUp,color:'text-emerald-600',bg:'bg-emerald-50'},
          {label:'Movimientos hoy',value:movements.filter(m=>m.created_at?.startsWith(new Date().toISOString().split('T')[0])).length,icon:History,color:'text-amber-600',bg:'bg-amber-50'},
        ].map(st=>(
          <div key={st.label} className={`${st.bg} rounded-2xl p-4 border border-white shadow-sm`}>
            <div className="flex items-center gap-3"><st.icon size={20} className={st.color}/>
              <div><p className="text-xs text-slate-500 font-medium">{st.label}</p><p className={`text-xl font-black ${st.color}`}>{st.value}</p></div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-2xl w-fit">
        {([{id:'inventario',label:'Inventario',icon:Package},{id:'movimientos',label:'Movimientos',icon:History},{id:'analytics',label:'Analítica',icon:BarChart3}] as const).map(t=>(
          <button key={t.id} onClick={()=>setActiveTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all ${activeTab===t.id?'bg-white text-indigo-700 shadow-sm':'text-slate-500 hover:text-slate-700'}`}>
            <t.icon size={14}/>{t.label}
          </button>
        ))}
      </div>
      {/* TAB Inventario */}
      {activeTab==='inventario'&&(
        <div>
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
              <input type="text" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar producto..."
                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"/>
            </div>
            <VoiceButton onResult={t=>setSearch(t)}/>
            <div className="flex gap-1">
              {CATS.map(c=>(
                <button key={c} onClick={()=>setFilterCat(c)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${filterCat===c?'bg-indigo-600 text-white':'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>{c}</button>
              ))}
            </div>
            <button onClick={()=>setShowLowStock(!showLowStock)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${showLowStock?'bg-rose-600 text-white border-rose-600':'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
              <AlertTriangle size={12}/> Stock bajo
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(item=>{
              const isLow = item.current_stock<=item.min_stock;
              const pct = item.min_stock>0?Math.min(100,(item.current_stock/item.min_stock)*100):100;
              return (
                <div key={item.id} className={`bg-white p-5 rounded-2xl border ${isLow?'border-rose-200':'border-slate-200'} shadow-sm hover:shadow-xl transition-all relative overflow-hidden`}>
                  {isLow&&<div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-rose-500 animate-pulse"/>}
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-black text-slate-900">{item.name}</h3>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-lg mt-1 inline-block ${catColor[item.category]??'bg-slate-100 text-slate-600'}`}>{item.category}</span>
                    </div>
                    <button onClick={()=>handleDeleteItem(item.id)} className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50"><Trash2 size={14}/></button>
                  </div>
                  <div className="text-3xl font-black ${isLow?'text-rose-600':'text-slate-900'} mb-1">
                    {item.current_stock}<span className="text-sm font-medium text-slate-400 ml-1">{item.unit}</span>
                  </div>
                  <div className="text-xs text-slate-400 mb-3">Mínimo: {item.min_stock}{item.unit} · {item.price_per_unit.toLocaleString('es-ES',{style:'currency',currency:'EUR'})}/{item.unit}</div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${pct<30?'bg-rose-500':pct<70?'bg-amber-400':'bg-emerald-500'}`} style={{width:Math.min(100,pct)+'%'}}/>
                  </div>
                  {item.location&&<p className="text-xs text-slate-400 mt-2">📍 {item.location}</p>}
                </div>
              );
            })}
            {filtered.length===0&&(
              <div className="col-span-3 text-center py-16 text-slate-400">
                <Package size={48} className="mx-auto mb-3 opacity-30"/>
                <p className="font-medium">No hay productos en el inventario</p>
                <p className="text-sm mt-1">Añade productos o escanea un ticket con IA</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB Movimientos */}
      {activeTab==='movimientos'&&(
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-slate-800">Historial de Movimientos</h2>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead><tr className="bg-slate-50/50 border-b border-slate-100">
                {['Producto','Tipo','Cantidad','Coste unit.','Razón','Referencia','Fecha'].map(h=>(
                  <th key={h} className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{h}</th>
                ))}
              </tr></thead>
              <tbody className="divide-y divide-slate-50">
                {movements.map(mv=>{
                  const it=items.find(i=>i.id===mv.stock_item_id);
                  return <tr key={mv.id} className="hover:bg-slate-50/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-800 text-sm">{it?.name??'—'}</td>
                    <td className="px-4 py-3"><span className={`text-xs font-bold capitalize ${movColor[mv.type]??'text-slate-600'}`}>{mv.type}</span></td>
                    <td className="px-4 py-3 text-sm font-bold text-slate-700">{mv.quantity} {it?.unit}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{mv.unit_cost?mv.unit_cost.toLocaleString('es-ES',{style:'currency',currency:'EUR'}):'—'}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{mv.reason??'—'}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{mv.reference??'—'}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">{mv.created_at?.split('T')[0]??'—'}</td>
                  </tr>;
                })}
                {movements.length===0&&<tr><td colSpan={7} className="px-4 py-12 text-center text-slate-400"><History size={40} className="mx-auto mb-3 opacity-30"/><p>No hay movimientos registrados</p></td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB Analítica */}
      {activeTab==='analytics'&&(
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h3 className="font-black text-slate-800 mb-4">Por Categoría</h3>
            {CATS.filter(c=>c!=='Todos').map(cat=>{
              const catItems=items.filter(i=>i.category===cat);
              const val=catItems.reduce((s,i)=>s+i.current_stock*i.price_per_unit,0);
              return <div key={cat} className="flex justify-between items-center py-2 border-b border-slate-50 last:border-0">
                <span className={`text-xs font-bold px-2 py-1 rounded-lg ${catColor[cat]??''}`}>{cat}</span>
                <div className="text-right"><p className="text-sm font-bold text-slate-800">{catItems.length} productos</p><p className="text-xs text-slate-500">{val.toLocaleString('es-ES',{style:'currency',currency:'EUR'})}</p></div>
              </div>;
            })}
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h3 className="font-black text-slate-800 mb-4">Productos con Stock Bajo</h3>
            {items.filter(i=>i.current_stock<=i.min_stock).map(i=>(
              <div key={i.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                <span className="text-sm font-medium text-slate-700">{i.name}</span>
                <span className="text-xs font-bold text-rose-600">{i.current_stock}/{i.min_stock} {i.unit}</span>
              </div>
            ))}
            {items.filter(i=>i.current_stock<=i.min_stock).length===0&&<p className="text-center text-slate-400 py-4 text-sm">✅ Todo el stock está OK</p>}
          </div>
        </div>
      )}
      {/* MODAL Nuevo Producto */}
      {showModal&&(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6"><h2 className="text-xl font-black text-slate-900">Nuevo Producto</h2><button onClick={()=>setShowModal(false)} className="p-2 rounded-full hover:bg-slate-100"><X size={20}/></button></div>
            <div className="space-y-4">
              <div className="flex gap-2">
                <div className="flex-1"><label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Nombre *</label><input type="text" value={newItem.name} onChange={e=>setNewItem({...newItem,name:e.target.value})} className="w-full mt-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" placeholder="Ej: Aceite de oliva"/></div>
                <div className="mt-6"><VoiceButton onResult={t=>setNewItem({...newItem,name:t})}/></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Categoría</label><select value={newItem.category} onChange={e=>setNewItem({...newItem,category:e.target.value})} className="w-full mt-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white">{CATS.filter(c=>c!=='Todos').map(c=><option key={c}>{c}</option>)}</select></div>
                <div><label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Unidad</label><select value={newItem.unit} onChange={e=>setNewItem({...newItem,unit:e.target.value})} className="w-full mt-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white">{UNITS.map(u=><option key={u}>{u}</option>)}</select></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[{label:'Stock actual',key:'current_stock'},{label:'Stock mínimo',key:'min_stock'},{label:'Precio/unidad (€)',key:'price_per_unit'}].map(f=>(
                  <div key={f.key}><label className="text-xs font-bold text-slate-500 uppercase tracking-wide">{f.label}</label><input type="number" step="0.001" value={(newItem as any)[f.key]} onChange={e=>setNewItem({...newItem,[f.key]:parseFloat(e.target.value)||0})} className="w-full mt-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" placeholder="0"/></div>
                ))}
              </div>
              <div><label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Ubicación</label><input type="text" value={newItem.location} onChange={e=>setNewItem({...newItem,location:e.target.value})} className="w-full mt-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" placeholder="Ej: Almacén frío, Estante 3"/></div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={()=>setShowModal(false)} className="flex-1 py-3 border border-slate-200 rounded-xl text-sm font-medium hover:bg-slate-50">Cancelar</button>
              <button onClick={handleAddItem} className="flex-1 py-3 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700">Añadir Producto</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL Movimiento */}
      {showMovModal&&(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-md">
            <div className="flex items-center justify-between mb-6"><h2 className="text-xl font-black text-slate-900">Registrar Movimiento</h2><button onClick={()=>setShowMovModal(false)} className="p-2 rounded-full hover:bg-slate-100"><X size={20}/></button></div>
            <div className="space-y-4">
              <div><label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Producto *</label><select value={newMov.stock_item_id} onChange={e=>setNewMov({...newMov,stock_item_id:e.target.value})} className="w-full mt-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"><option value="">Seleccionar...</option>{items.map(i=><option key={i.id} value={i.id}>{i.name} ({i.current_stock} {i.unit})</option>)}</select></div>
              <div><label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Tipo</label><select value={newMov.type} onChange={e=>setNewMov({...newMov,type:e.target.value})} className="w-full mt-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white">{MOV_TYPES.map(t=><option key={t} className="capitalize">{t}</option>)}</select></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Cantidad *</label><input type="number" step="0.001" value={newMov.quantity} onChange={e=>setNewMov({...newMov,quantity:parseFloat(e.target.value)||0})} className="w-full mt-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" placeholder="0"/></div>
                <div><label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Coste unit. (€)</label><input type="number" step="0.01" value={newMov.unit_cost} onChange={e=>setNewMov({...newMov,unit_cost:parseFloat(e.target.value)||0})} className="w-full mt-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" placeholder="0.00"/></div>
              </div>
              <div><label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Razón</label><input type="text" value={newMov.reason} onChange={e=>setNewMov({...newMov,reason:e.target.value})} className="w-full mt-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" placeholder="Ej: Compra semanal, Merma por caducidad..."/></div>
              <div><label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Referencia (albarán...)</label><input type="text" value={newMov.reference} onChange={e=>setNewMov({...newMov,reference:e.target.value})} className="w-full mt-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" placeholder="Nº albarán, factura..."/></div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={()=>setShowMovModal(false)} className="flex-1 py-3 border border-slate-200 rounded-xl text-sm font-medium hover:bg-slate-50">Cancelar</button>
              <button onClick={handleAddMovement} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700">Registrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
