import React, { useState, useEffect, useRef } from 'react';
import { Plus, TrendingUp, TrendingDown, Wallet, ArrowUpRight, ArrowDownLeft, MoreVertical, Calendar, FileText, Download, CheckCircle2, X, Brain, AlertTriangle, BarChart3, Database, History, Settings2, Share2, Loader2, Mic, MicOff, Camera, Trash2 } from 'lucide-react';
import { supabase } from '../supabase';
import { useSupabase } from '../context/SupabaseContext';

interface CashEntry { id:string; date:string; type:'Ingreso'|'Gasto'; category:string; description:string; amount:number; payment_method:string; reference?:string; reconciled:boolean; }
interface BankAccount { id:string; name:string; bank_name:string; account_number?:string; balance:number; last_sync?:string; }
interface BankTransaction { id:string; bank_account_id:string; date:string; description:string; amount:number; balance?:number; category?:string; status:string; source?:string; }

const GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY;
async function callGemini(p:string):Promise<string>{
  const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contents:[{parts:[{text:p}]}]})});
  const j=await r.json(); return j.candidates?.[0]?.content?.parts?.[0]?.text??'Sin respuesta';
}
function VoiceButton({onResult,className=''}:{onResult:(t:string)=>void;className?:string}){
  const [listening,setListening]=useState(false);const recRef=useRef<any>(null);
  const toggle=()=>{
    if(listening){recRef.current?.stop();setListening(false);return;}
    const SR=(window as any).SpeechRecognition||(window as any).webkitSpeechRecognition;
    if(!SR){alert('Voz no soportada');return;}
    const rec=new SR();rec.lang='es-ES';rec.interimResults=false;
    rec.onresult=(e:any)=>{onResult(e.results[0][0].transcript);setListening(false);};
    rec.onerror=()=>setListening(false);rec.onend=()=>setListening(false);
    recRef.current=rec;rec.start();setListening(true);
  };
  return <button type="button" onClick={toggle} className={`p-2 rounded-full transition-all ${listening?'bg-red-500 text-white animate-pulse':'bg-indigo-100 text-indigo-600 hover:bg-indigo-200'} ${className}`}>{listening?<MicOff size={16}/>:<Mic size={16}/>}</button>;
}
export default function TesoreriaView() {
  const { employee } = useSupabase();
  const isAdmin = employee?.rol==='admin';
  const [activeTab, setActiveTab] = useState<'cash'|'bank'|'analytics'>('cash');
  const [entries, setEntries] = useState<CashEntry[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [bankTx, setBankTx] = useState<BankTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string|null>(null);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'Todos'|'Ingreso'|'Gasto'>('Todos');
  const [showModal, setShowModal] = useState(false);
  const [showBankModal, setShowBankModal] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<string|null>(null);
  const [newEntry, setNewEntry] = useState({type:'Ingreso' as const,category:'',description:'',amount:0,payment_method:'Efectivo',reference:'',date:new Date().toISOString().split('T')[0]});
  const [newAccount, setNewAccount] = useState({name:'',bank_name:'',account_number:'',balance:0});

  const CATS_INGRESO=['Ventas TPV','Ventas efectivo','Delivery','Otros ingresos'];
  const CATS_GASTO=['Compras','Personal','Alquiler','Suministros','Seguros','Mantenimiento','Otros gastos'];
  const PAY_METHODS=['Efectivo','Tarjeta','Transferencia','Banco'];

  useEffect(()=>{loadAll();},[]);
  async function loadAll() {
    setLoading(true);setError(null);
    try {
      const [en,ba,bt]=await Promise.all([
        supabase.from('cash_entries').select('*').order('date',{ascending:false}).limit(200),
        supabase.from('bank_accounts').select('*').order('name'),
        supabase.from('bank_transactions').select('*').order('date',{ascending:false}).limit(200),
      ]);
      if(en.error)throw en.error;if(ba.error)throw ba.error;if(bt.error)throw bt.error;
      setEntries(en.data||[]);setBankAccounts(ba.data||[]);setBankTx(bt.data||[]);
    } catch(err:any){setError(err.message||'Error');}
    finally{setLoading(false);}
  }
  async function handleAddEntry() {
    if(!newEntry.category||!newEntry.description||newEntry.amount<=0){alert('Rellena todos los campos');return;}
    const {error}=await supabase.from('cash_entries').insert([{...newEntry,reconciled:false}]);
    if(error){alert('Error: '+error.message);return;}
    setShowModal(false);setNewEntry({type:'Ingreso',category:'',description:'',amount:0,payment_method:'Efectivo',reference:'',date:new Date().toISOString().split('T')[0]});
    loadAll();
  }
  async function handleDeleteEntry(id:string) {
    if(!confirm('¿Eliminar este movimiento?'))return;
    const {error}=await supabase.from('cash_entries').delete().eq('id',id);
    if(error){alert('Error: '+error.message);return;}loadAll();
  }
  async function handleAddBankAccount() {
    if(!newAccount.name||!newAccount.bank_name){alert('Nombre y banco son obligatorios');return;}
    const {error}=await supabase.from('bank_accounts').insert([newAccount]);
    if(error){alert('Error: '+error.message);return;}
    setShowBankModal(false);setNewAccount({name:'',bank_name:'',account_number:'',balance:0});loadAll();
  }
  async function handleAIAnalysis() {
    setAiLoading(true);setAiResult(null);
    try {
      const ingresos=entries.filter(e=>e.type==='Ingreso').reduce((s,e)=>s+e.amount,0);
      const gastos=entries.filter(e=>e.type==='Gasto').reduce((s,e)=>s+e.amount,0);
      const saldo=ingresos-gastos;
      const topCats=Object.entries(entries.reduce((a:Record<string,number>,e)=>({...a,[e.category]:(a[e.category]||0)+e.amount}),{})).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([k,v])=>`${k}: ${v.toFixed(2)}€`).join(', ');
      const result=await callGemini(`Analiza la tesorería de este restaurante y da recomendaciones:\nIngresos: ${ingresos.toFixed(2)}€\nGastos: ${gastos.toFixed(2)}€\nSaldo: ${saldo.toFixed(2)}€\nTop categorías: ${topCats}.\nDa 3-5 sugerencias en español con bullet points.`);
      setAiResult(result);
    } catch(err:any){setAiResult('Error IA: '+err.message);}
    finally{setAiLoading(false);}
  }
  const totalIngresos=entries.filter(e=>e.type==='Ingreso').reduce((s,e)=>s+e.amount,0);
  const totalGastos=entries.filter(e=>e.type==='Gasto').reduce((s,e)=>s+e.amount,0);
  const saldo=totalIngresos-totalGastos;
  const totalBankBalance=bankAccounts.reduce((s,a)=>s+a.balance,0);
  const filtered=entries.filter(e=>{
    const ms=e.description.toLowerCase().includes(search.toLowerCase())||e.category.toLowerCase().includes(search.toLowerCase());
    const mt=filterType==='Todos'||e.type===filterType;
    return ms&&mt;
  });
  if(loading)return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-indigo-500" size={40}/><span className="ml-3 text-slate-500">Cargando tesorería...</span></div>;
  if(error)return <div className="flex flex-col items-center justify-center h-64 gap-4"><AlertTriangle className="text-red-500" size={40}/><p className="text-red-600">{error}</p><button onClick={loadAll} className="px-4 py-2 bg-indigo-600 text-white rounded-xl">Reintentar</button></div>;
  return (
    <div className="min-h-screen bg-slate-50 p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div><h1 className="text-3xl font-black text-slate-900 tracking-tight">Tesorería</h1><p className="text-slate-500 text-sm mt-1">Control de flujo de caja y cuentas bancarias</p></div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={handleAIAnalysis} disabled={aiLoading} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl hover:bg-indigo-700 text-sm font-medium disabled:opacity-50">{aiLoading?<Loader2 size={16} className="animate-spin"/>:<Brain size={16}/>} Análisis IA</button>
          <button onClick={()=>setShowModal(true)} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl hover:bg-emerald-700 text-sm font-medium"><Plus size={16}/> Movimiento</button>
        </div>
      </div>

      {aiResult&&(<div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-5 relative"><button onClick={()=>setAiResult(null)} className="absolute top-3 right-3 text-slate-400 hover:text-slate-600"><X size={16}/></button><div className="flex items-start gap-3"><Brain size={20} className="text-indigo-600 mt-0.5 flex-shrink-0"/><div><p className="font-bold text-indigo-800 mb-2">Análisis IA de Tesorería</p><pre className="text-slate-700 text-sm whitespace-pre-wrap font-sans">{aiResult}</pre></div></div></div>)}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[{label:'Total ingresos',value:totalIngresos,icon:TrendingUp,color:'text-emerald-600',bg:'bg-emerald-50'},{label:'Total gastos',value:totalGastos,icon:TrendingDown,color:'text-rose-600',bg:'bg-rose-50'},{label:'Saldo efectivo',value:saldo,icon:Wallet,color:saldo>=0?'text-indigo-600':'text-rose-600',bg:'bg-indigo-50'},{label:'Saldo bancario',value:totalBankBalance,icon:Database,color:'text-blue-600',bg:'bg-blue-50'}].map(st=>(
          <div key={st.label} className={`${st.bg} rounded-2xl p-4 border border-white shadow-sm`}><div className="flex items-center gap-3"><st.icon size={20} className={st.color}/><div><p className="text-xs text-slate-500 font-medium">{st.label}</p><p className={`text-xl font-black ${st.color}`}>{st.value.toLocaleString('es-ES',{style:'currency',currency:'EUR'})}</p></div></div></div>
        ))}
      </div>

      <div className="flex gap-1 bg-slate-100 p-1 rounded-2xl w-fit">
        {([{id:'cash',label:'Movimientos',icon:History},{id:'bank',label:'Banco',icon:Database},{id:'analytics',label:'Analítica',icon:BarChart3}] as const).map(t=>(
          <button key={t.id} onClick={()=>setActiveTab(t.id)} className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all ${activeTab===t.id?'bg-white text-indigo-700 shadow-sm':'text-slate-500 hover:text-slate-700'}`}><t.icon size={14}/>{t.label}</button>
        ))}
      </div>

      {activeTab==='cash'&&(
        <div>
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="relative flex-1 min-w-[200px]"><div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</div><input type="text" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar..." className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"/></div>
            <VoiceButton onResult={t=>setSearch(t)}/>
            {(['Todos','Ingreso','Gasto'] as const).map(f=>(
              <button key={f} onClick={()=>setFilterType(f)} className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${filterType===f?f==='Ingreso'?'bg-emerald-600 text-white':f==='Gasto'?'bg-rose-600 text-white':'bg-indigo-600 text-white':'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>{f}</button>
            ))}
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead><tr className="bg-slate-50/50 border-b border-slate-100">{['Fecha','Tipo','Categoría','Descripción','Método','Importe',''].map(h=><th key={h} className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.slice(0,100).map(e=>(
                  <tr key={e.id} className="hover:bg-slate-50/30 transition-colors group">
                    <td className="px-4 py-3 text-xs text-slate-500">{e.date}</td>
                    <td className="px-4 py-3"><span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${e.type==='Ingreso'?'bg-emerald-100 text-emerald-700':'bg-rose-100 text-rose-700'}`}>{e.type}</span></td>
                    <td className="px-4 py-3 text-xs text-slate-500">{e.category}</td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-700">{e.description}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{e.payment_method}</td>
                    <td className="px-4 py-3 font-bold text-sm ${e.type==='Ingreso'?'text-emerald-600':'text-rose-600'}">{e.type==='Ingreso'?'+':'-'}{e.amount.toLocaleString('es-ES',{style:'currency',currency:'EUR'})}</td>
                    <td className="px-4 py-3"><button onClick={()=>handleDeleteEntry(e.id)} className="p-1.5 rounded-lg text-slate-200 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100"><Trash2 size={12}/></button></td>
                  </tr>
                ))}
                {filtered.length===0&&<tr><td colSpan={7} className="px-4 py-12 text-center text-slate-400"><Wallet size={40} className="mx-auto mb-3 opacity-30"/><p>No hay movimientos registrados</p></td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab==='bank'&&(
        <div>
          <div className="flex justify-between items-center mb-4"><h2 className="text-lg font-bold text-slate-800">Cuentas Bancarias</h2><button onClick={()=>setShowBankModal(true)} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 text-sm font-medium"><Plus size={16}/> Nueva Cuenta</button></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {bankAccounts.map(acc=>(
              <div key={acc.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-start justify-between mb-3"><div><h3 className="font-black text-slate-900">{acc.name}</h3><p className="text-sm text-slate-500">{acc.bank_name}{acc.account_number?' · '+acc.account_number:''}</p></div><Database size={20} className="text-blue-500"/></div>
                <p className="text-3xl font-black text-blue-700">{acc.balance.toLocaleString('es-ES',{style:'currency',currency:'EUR'})}</p>
                {acc.last_sync&&<p className="text-xs text-slate-400 mt-1">Último sync: {acc.last_sync.split('T')[0]}</p>}
              </div>
            ))}
            {bankAccounts.length===0&&<div className="col-span-2 text-center py-12 text-slate-400"><Database size={40} className="mx-auto mb-3 opacity-30"/><p>No hay cuentas bancarias</p></div>}
          </div>
          <h3 className="font-bold text-slate-800 mb-3">Últimas Transacciones</h3>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead><tr className="bg-slate-50/50 border-b border-slate-100">{['Fecha','Descripción','Categoría','Importe','Saldo','Estado'].map(h=><th key={h} className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-slate-50">
                {bankTx.slice(0,50).map(tx=>(
                  <tr key={tx.id} className="hover:bg-slate-50/30 transition-colors">
                    <td className="px-4 py-3 text-xs text-slate-500">{tx.date}</td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-700">{tx.description}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{tx.category||'—'}</td>
                    <td className={`px-4 py-3 font-bold text-sm ${tx.amount>=0?'text-emerald-600':'text-rose-600'}`}>{tx.amount>=0?'+':''}{tx.amount.toLocaleString('es-ES',{style:'currency',currency:'EUR'})}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{tx.balance!=null?tx.balance.toLocaleString('es-ES',{style:'currency',currency:'EUR'}):'—'}</td>
                    <td className="px-4 py-3"><span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${tx.status==='Conciliado'?'bg-emerald-100 text-emerald-700':'bg-amber-100 text-amber-700'}`}>{tx.status}</span></td>
                  </tr>
                ))}
                {bankTx.length===0&&<tr><td colSpan={6} className="px-4 py-12 text-center text-slate-400"><History size={40} className="mx-auto mb-3 opacity-30"/><p>No hay transacciones bancarias</p></td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab==='analytics'&&(
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h3 className="font-black text-slate-800 mb-4">Top Categorías Gastos</h3>
            {Object.entries(entries.filter(e=>e.type==='Gasto').reduce((a:Record<string,number>,e)=>({...a,[e.category]:(a[e.category]||0)+e.amount}),{})).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([cat,amt])=>(
              <div key={cat} className="flex justify-between items-center py-2 border-b border-slate-50 last:border-0"><span className="text-sm font-medium text-slate-700">{cat}</span><span className="text-sm font-bold text-rose-600">{amt.toLocaleString('es-ES',{style:'currency',currency:'EUR'})}</span></div>
            ))}
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h3 className="font-black text-slate-800 mb-4">Resumen Financiero</h3>
            <div className="space-y-3">
              {[{label:'Total Ingresos',v:totalIngresos,c:'text-emerald-600'},{label:'Total Gastos',v:totalGastos,c:'text-rose-600'},{label:'Saldo Neto',v:saldo,c:saldo>=0?'text-indigo-700':'text-rose-700',bold:true},{label:'Saldo bancario total',v:totalBankBalance,c:'text-blue-700'}].map(item=>(
                <div key={item.label} className="flex justify-between items-center py-2 border-b border-slate-50 last:border-0"><span className={`text-sm ${item.bold?'font-black':'font-medium'} text-slate-700`}>{item.label}</span><span className={`text-sm ${item.bold?'font-black text-lg':'font-bold'} ${item.c}`}>{item.v.toLocaleString('es-ES',{style:'currency',currency:'EUR'})}</span></div>
              ))}
            </div>
          </div>
        </div>
      )}
      {showModal&&(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-lg">
            <div className="flex items-center justify-between mb-6"><h2 className="text-xl font-black text-slate-900">Nuevo Movimiento</h2><button onClick={()=>setShowModal(false)} className="p-2 rounded-full hover:bg-slate-100"><X size={20}/></button></div>
            <div className="space-y-4">
              <div><label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Tipo</label><div className="flex gap-2 mt-1">{(['Ingreso','Gasto'] as const).map(t=><button key={t} onClick={()=>setNewEntry({...newEntry,type:t,category:''})} className={`flex-1 py-2.5 rounded-xl text-sm font-bold border-2 transition-all ${newEntry.type===t?t==='Ingreso'?'bg-emerald-600 text-white border-emerald-600':'bg-rose-600 text-white border-rose-600':'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>{t}</button>)}</div></div>
              <div><label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Fecha</label><input type="date" value={newEntry.date} onChange={e=>setNewEntry({...newEntry,date:e.target.value})} className="w-full mt-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"/></div>
              <div><label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Categoría</label><select value={newEntry.category} onChange={e=>setNewEntry({...newEntry,category:e.target.value})} className="w-full mt-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"><option value="">Seleccionar...</option>{(newEntry.type==='Ingreso'?CATS_INGRESO:CATS_GASTO).map(c=><option key={c}>{c}</option>)}</select></div>
              <div className="flex gap-2"><div className="flex-1"><label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Descripción *</label><input type="text" value={newEntry.description} onChange={e=>setNewEntry({...newEntry,description:e.target.value})} className="w-full mt-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" placeholder="Detalle del movimiento"/></div><div className="mt-6"><VoiceButton onResult={t=>setNewEntry({...newEntry,description:t})}/></div></div>
              <div><label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Importe (€) *</label><input type="number" step="0.01" value={newEntry.amount} onChange={e=>setNewEntry({...newEntry,amount:parseFloat(e.target.value)||0})} className="w-full mt-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" placeholder="0.00"/></div>
              <div><label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Método de pago</label><select value={newEntry.payment_method} onChange={e=>setNewEntry({...newEntry,payment_method:e.target.value})} className="w-full mt-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white">{PAY_METHODS.map(m=><option key={m}>{m}</option>)}</select></div>
              <div><label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Referencia</label><input type="text" value={newEntry.reference} onChange={e=>setNewEntry({...newEntry,reference:e.target.value})} className="w-full mt-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" placeholder="Nº factura, albarán..."/></div>
            </div>
            <div className="flex gap-3 mt-6"><button onClick={()=>setShowModal(false)} className="flex-1 py-3 border border-slate-200 rounded-xl text-sm font-medium hover:bg-slate-50">Cancelar</button><button onClick={handleAddEntry} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700">Guardar</button></div>
          </div>
        </div>
      )}

      {showBankModal&&(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-md">
            <div className="flex items-center justify-between mb-6"><h2 className="text-xl font-black text-slate-900">Nueva Cuenta Bancaria</h2><button onClick={()=>setShowBankModal(false)} className="p-2 rounded-full hover:bg-slate-100"><X size={20}/></button></div>
            <div className="space-y-4">
              <div><label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Nombre *</label><input type="text" value={newAccount.name} onChange={e=>setNewAccount({...newAccount,name:e.target.value})} className="w-full mt-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" placeholder="Ej: Cuenta principal"/></div>
              <div><label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Banco *</label><input type="text" value={newAccount.bank_name} onChange={e=>setNewAccount({...newAccount,bank_name:e.target.value})} className="w-full mt-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" placeholder="Ej: CaixaBank"/></div>
              <div><label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Número de cuenta</label><input type="text" value={newAccount.account_number} onChange={e=>setNewAccount({...newAccount,account_number:e.target.value})} className="w-full mt-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" placeholder="ES12 1234..."/></div>
              <div><label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Saldo inicial (€)</label><input type="number" step="0.01" value={newAccount.balance} onChange={e=>setNewAccount({...newAccount,balance:parseFloat(e.target.value)||0})} className="w-full mt-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" placeholder="0.00"/></div>
            </div>
            <div className="flex gap-3 mt-6"><button onClick={()=>setShowBankModal(false)} className="flex-1 py-3 border border-slate-200 rounded-xl text-sm font-medium hover:bg-slate-50">Cancelar</button><button onClick={handleAddBankAccount} className="flex-1 py-3 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700">Añadir Cuenta</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
