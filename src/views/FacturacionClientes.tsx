import React, { useState, useEffect, useRef } from 'react';
import { Plus, Search, FileText, Download, MoreVertical, CheckCircle2, Clock, Users, TrendingUp, BarChart3, Calculator, AlertCircle, Brain, Loader2, X, Mic, MicOff, Trash2, Camera } from 'lucide-react';
import { supabase } from '../supabase';
import { useSupabase } from '../context/SupabaseContext';

interface InvoiceItem { description:string; quantity:number; unit_price:number; tax_rate:number; total:number; }
interface CustomerInvoice {
  id:string; number:string; date:string; due_date?:string; client_name:string; client_cif?:string;
  client_email?:string; client_address?:string; items:InvoiceItem[];
  subtotal:number; tax_rate:number; tax_amount:number; total:number;
  status:string; notes?:string;
}

const GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY;
async function callGemini(p:string):Promise<string>{
  const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contents:[{parts:[{text:p}]}]})});
  const j=await r.json();return j.candidates?.[0]?.content?.parts?.[0]?.text??'Sin respuesta';
}
async function callGeminiVision(base64:string,mimeType:string,prompt:string):Promise<string>{
  const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contents:[{parts:[{inlineData:{mimeType,data:base64}},{text:prompt}]}]})});
  const j=await r.json();return j.candidates?.[0]?.content?.parts?.[0]?.text??'Sin respuesta';
}
function VoiceButton({onResult,className=''}:{onResult:(t:string)=>void;className?:string}){
  const [listening,setListening]=useState(false);const recRef=useRef<any>(null);
  const toggle=()=>{if(listening){recRef.current?.stop();setListening(false);return;}const SR=(window as any).SpeechRecognition||(window as any).webkitSpeechRecognition;if(!SR){alert('Voz no soportada');return;}const rec=new SR();rec.lang='es-ES';rec.interimResults=false;rec.onresult=(e:any)=>{onResult(e.results[0][0].transcript);setListening(false);};rec.onerror=()=>setListening(false);rec.onend=()=>setListening(false);recRef.current=rec;rec.start();setListening(true);};
  return <button type="button" onClick={toggle} className={`p-2 rounded-full transition-all ${listening?'bg-red-500 text-white animate-pulse':'bg-indigo-100 text-indigo-600 hover:bg-indigo-200'} ${className}`}>{listening?<MicOff size={16}/>:<Mic size={16}/>}</button>;
}

function generateInvoiceNumber(existing:CustomerInvoice[]):string {
  const year=new Date().getFullYear();
  const max=existing.filter(i=>i.number.includes(year.toString())).length;
  return `${year}/${String(max+1).padStart(4,'0')}`;
}

export default function FacturacionClientesView() {
  const { employee } = useSupabase();
  const [invoices, setInvoices] = useState<CustomerInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string|null>(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('Todos');
  const [showModal, setShowModal] = useState(false);
  const [selected, setSelected] = useState<CustomerInvoice|null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<string|null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [newInvoice, setNewInvoice] = useState({
    client_name:'', client_cif:'', client_email:'', client_address:'', tax_rate:21, due_date:'', notes:''
  });
  const [items, setItems] = useState<InvoiceItem[]>([{description:'',quantity:1,unit_price:0,tax_rate:21,total:0}]);

  useEffect(()=>{loadInvoices();},[]);
  async function loadInvoices(){
    setLoading(true);setError(null);
    const {data,error}=await supabase.from('customer_invoices').select('*').order('date',{ascending:false});
    if(error)setError(error.message);else setInvoices(data||[]);
    setLoading(false);
  }
  function calcItem(item:InvoiceItem):InvoiceItem{
    const total=item.quantity*item.unit_price*(1+item.tax_rate/100);
    return {...item,total};
  }
  function calcTotals(its:InvoiceItem[],taxRate:number):{subtotal:number;tax_amount:number;total:number}{
    const subtotal=its.reduce((s,i)=>s+i.quantity*i.unit_price,0);
    const tax_amount=subtotal*(taxRate/100);
    return {subtotal,tax_amount,total:subtotal+tax_amount};
  }
  async function handleAddInvoice(){
    if(!newInvoice.client_name.trim()){alert('El nombre del cliente es obligatorio');return;}
    const validItems=items.filter(i=>i.description.trim()&&i.quantity>0&&i.unit_price>0);
    if(validItems.length===0){alert('Añade al menos un concepto');return;}
    const updatedItems=validItems.map(calcItem);
    const {subtotal,tax_amount,total}=calcTotals(updatedItems,newInvoice.tax_rate);
    const number=generateInvoiceNumber(invoices);
    const {error}=await supabase.from('customer_invoices').insert([{
      number, date:new Date().toISOString().split('T')[0],
      due_date:newInvoice.due_date||null,
      client_name:newInvoice.client_name.trim(),
      client_cif:newInvoice.client_cif||null,
      client_email:newInvoice.client_email||null,
      client_address:newInvoice.client_address||null,
      items:updatedItems, subtotal, tax_rate:newInvoice.tax_rate, tax_amount, total,
      status:'Pendiente', notes:newInvoice.notes||null,
    }]);
    if(error){alert('Error: '+error.message);return;}
    setShowModal(false);
    setNewInvoice({client_name:'',client_cif:'',client_email:'',client_address:'',tax_rate:21,due_date:'',notes:''});
    setItems([{description:'',quantity:1,unit_price:0,tax_rate:21,total:0}]);
    loadInvoices();
  }
  async function handleStatusChange(id:string,status:string){
    const {error}=await supabase.from('customer_invoices').update({status}).eq('id',id);
    if(error){alert('Error: '+error.message);return;}loadInvoices();
  }
  async function handleDelete(id:string){
    if(!confirm('¿Eliminar esta factura?'))return;
    const {error}=await supabase.from('customer_invoices').delete().eq('id',id);
    if(error){alert('Error: '+error.message);return;}setSelected(null);loadInvoices();
  }
  async function handleAI(){
    setAiLoading(true);setAiResult(null);
    try {
      const pending=invoices.filter(i=>i.status==='Pendiente').reduce((s,i)=>s+i.total,0);
      const paid=invoices.filter(i=>i.status==='Pagada').reduce((s,i)=>s+i.total,0);
      const result=await callGemini(`Analiza la facturación a clientes de este restaurante:\nFacturas pendientes: ${pending.toFixed(2)}€\nCobrado: ${paid.toFixed(2)}€\nTotal facturas: ${invoices.length}\nDa 3-5 recomendaciones de gestión de cobros en español.`);
      setAiResult(result);
    }catch(err:any){setAiResult('Error IA: '+err.message);}
    finally{setAiLoading(false);}
  }
  async function handlePhotoScan(e:React.ChangeEvent<HTMLInputElement>){
    const file=e.target.files?.[0];if(!file)return;
    setAiLoading(true);
    try{
      const base64=await new Promise<string>((res,rej)=>{const r=new FileReader();r.onload=()=>res((r.result as string).split(',')[1]);r.onerror=rej;r.readAsDataURL(file);});
      const result=await callGeminiVision(base64,file.type,'Extrae de este documento los datos de facturación en JSON: {"client_name":"","client_cif":"","client_address":"","items":[{"description":"","quantity":1,"unit_price":0}]}. Solo JSON.');
      const m=result.match(/\{[\s\S]*\}/);
      if(m){
        const d=JSON.parse(m[0]);
        setNewInvoice(prev=>({...prev,client_name:d.client_name||prev.client_name,client_cif:d.client_cif||prev.client_cif,client_address:d.client_address||prev.client_address}));
        if(d.items?.length>0)setItems(d.items.map((i:any)=>({...i,tax_rate:21,total:i.quantity*i.unit_price*1.21})));
        setShowModal(true);alert('Datos extraídos. Revisa y confirma.');
      }else{alert('No se pudieron extraer datos.');}
    }catch(err:any){alert('Error imagen: '+err.message);}
    finally{setAiLoading(false);if(e.target)e.target.value='';}
  }
  const STATUSES=['Todos','Pendiente','Pagada','Vencida','Cancelada'];
  const statusColor:Record<string,string>={'Pendiente':'bg-amber-100 text-amber-700','Pagada':'bg-emerald-100 text-emerald-700','Vencida':'bg-red-100 text-red-700','Cancelada':'bg-slate-100 text-slate-600'};
  const filtered=invoices.filter(i=>{
    const ms=i.client_name.toLowerCase().includes(search.toLowerCase())||i.number.toLowerCase().includes(search.toLowerCase());
    const mst=filterStatus==='Todos'||i.status===filterStatus;
    return ms&&mst;
  });
  const totalPending=invoices.filter(i=>i.status==='Pendiente').reduce((s,i)=>s+i.total,0);
  const totalPaid=invoices.filter(i=>i.status==='Pagada').reduce((s,i)=>s+i.total,0);
  const totalOverdue=invoices.filter(i=>i.status==='Vencida').reduce((s,i)=>s+i.total,0);
  if(loading)return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-indigo-500" size={40}/><span className="ml-3 text-slate-500">Cargando facturas...</span></div>;
  if(error)return <div className="flex flex-col items-center justify-center h-64 gap-4"><AlertCircle className="text-red-500" size={40}/><p className="text-red-600">{error}</p><button onClick={loadInvoices} className="px-4 py-2 bg-indigo-600 text-white rounded-xl">Reintentar</button></div>;
  return (
    <div className="min-h-screen bg-slate-50 p-6 space-y-6">
      <input ref={photoInputRef} type="file" accept="image/*" onChange={handlePhotoScan} className="hidden"/>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div><h1 className="text-3xl font-black text-slate-900 tracking-tight">Facturación a Clientes</h1><p className="text-slate-500 text-sm mt-1">Gestión de facturas emitidas y cobros</p></div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={()=>photoInputRef.current?.click()} disabled={aiLoading} className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-xl hover:bg-purple-700 text-sm font-medium disabled:opacity-50">{aiLoading?<Loader2 size={16} className="animate-spin"/>:<Camera size={16}/>} Escanear Doc</button>
          <button onClick={handleAI} disabled={aiLoading} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl hover:bg-indigo-700 text-sm font-medium disabled:opacity-50">{aiLoading?<Loader2 size={16} className="animate-spin"/>:<Brain size={16}/>} Análisis IA</button>
          <button onClick={()=>setShowModal(true)} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl hover:bg-emerald-700 text-sm font-medium"><Plus size={16}/> Nueva Factura</button>
        </div>
      </div>

      {aiResult&&(<div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-5 relative"><button onClick={()=>setAiResult(null)} className="absolute top-3 right-3 text-slate-400 hover:text-slate-600"><X size={16}/></button><div className="flex items-start gap-3"><Brain size={20} className="text-indigo-600 mt-0.5"/><div><p className="font-bold text-indigo-800 mb-2">Análisis IA</p><pre className="text-slate-700 text-sm whitespace-pre-wrap font-sans">{aiResult}</pre></div></div></div>)}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[{label:'Total facturas',value:invoices.length,icon:FileText,color:'text-indigo-600',bg:'bg-indigo-50'},{label:'Pendiente cobro',value:totalPending.toLocaleString('es-ES',{style:'currency',currency:'EUR'}),icon:Clock,color:'text-amber-600',bg:'bg-amber-50'},{label:'Cobrado',value:totalPaid.toLocaleString('es-ES',{style:'currency',currency:'EUR'}),icon:CheckCircle2,color:'text-emerald-600',bg:'bg-emerald-50'},{label:'Vencido',value:totalOverdue.toLocaleString('es-ES',{style:'currency',currency:'EUR'}),icon:AlertCircle,color:'text-red-600',bg:'bg-red-50'}].map(st=>(
          <div key={st.label} className={`${st.bg} rounded-2xl p-4 border border-white shadow-sm`}><div className="flex items-center gap-3"><st.icon size={20} className={st.color}/><div><p className="text-xs text-slate-500 font-medium">{st.label}</p><p className={`text-lg font-black ${st.color}`}>{st.value}</p></div></div></div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/><input type="text" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar factura o cliente..." className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"/></div>
        <VoiceButton onResult={t=>setSearch(t)}/>
        {STATUSES.map(s=><button key={s} onClick={()=>setFilterStatus(s)} className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${filterStatus===s?'bg-indigo-600 text-white':'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>{s}</button>)}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead><tr className="bg-slate-50/50 border-b border-slate-100">{['Nº Factura','Cliente','Fecha','Vencimiento','Total','Estado','Acciones'].map(h=><th key={h} className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-50">
            {filtered.map(inv=>(
              <tr key={inv.id} className="hover:bg-slate-50/30 transition-colors group">
                <td className="px-4 py-3 font-bold text-indigo-600 text-sm">{inv.number}</td>
                <td className="px-4 py-3"><p className="font-medium text-slate-800 text-sm">{inv.client_name}</p>{inv.client_cif&&<p className="text-xs text-slate-400">{inv.client_cif}</p>}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{inv.date}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{inv.due_date||'—'}</td>
                <td className="px-4 py-3 font-black text-slate-800">{inv.total.toLocaleString('es-ES',{style:'currency',currency:'EUR'})}</td>
                <td className="px-4 py-3"><span className={`text-xs font-bold px-2 py-1 rounded-xl ${statusColor[inv.status]??'bg-slate-100 text-slate-600'}`}>{inv.status}</span></td>
                <td className="px-4 py-3">
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                    {inv.status==='Pendiente'&&<button onClick={()=>handleStatusChange(inv.id,'Pagada')} className="px-2 py-1 text-xs bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 font-medium">Marcar cobrada</button>}
                    <button onClick={()=>handleDelete(inv.id)} className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={12}/></button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length===0&&<tr><td colSpan={7} className="px-4 py-12 text-center text-slate-400"><FileText size={40} className="mx-auto mb-3 opacity-30"/><p>No hay facturas registradas</p></td></tr>}
          </tbody>
        </table>
      </div>

      {showModal&&(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-2xl my-4">
            <div className="flex items-center justify-between mb-6"><h2 className="text-xl font-black text-slate-900">Nueva Factura a Cliente</h2><button onClick={()=>setShowModal(false)} className="p-2 rounded-full hover:bg-slate-100"><X size={20}/></button></div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="col-span-2 flex gap-2"><div className="flex-1"><label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Cliente *</label><input type="text" value={newInvoice.client_name} onChange={e=>setNewInvoice({...newInvoice,client_name:e.target.value})} className="w-full mt-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" placeholder="Nombre del cliente o empresa"/></div><div className="mt-6"><VoiceButton onResult={t=>setNewInvoice({...newInvoice,client_name:t})}/></div></div>
              {[{label:'CIF/NIF',key:'client_cif',ph:'B12345678'},{label:'Email',key:'client_email',ph:'cliente@empresa.com'}].map(f=><div key={f.key}><label className="text-xs font-bold text-slate-500 uppercase tracking-wide">{f.label}</label><input type="text" value={(newInvoice as any)[f.key]} onChange={e=>setNewInvoice({...newInvoice,[f.key]:e.target.value})} className="w-full mt-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" placeholder={f.ph}/></div>)}
              <div><label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Vencimiento</label><input type="date" value={newInvoice.due_date} onChange={e=>setNewInvoice({...newInvoice,due_date:e.target.value})} className="w-full mt-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"/></div>
              <div><label className="text-xs font-bold text-slate-500 uppercase tracking-wide">IVA (%)</label><input type="number" value={newInvoice.tax_rate} onChange={e=>setNewInvoice({...newInvoice,tax_rate:parseFloat(e.target.value)||21})} className="w-full mt-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"/></div>
              <div className="col-span-2"><label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Dirección</label><input type="text" value={newInvoice.client_address} onChange={e=>setNewInvoice({...newInvoice,client_address:e.target.value})} className="w-full mt-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" placeholder="Dirección completa"/></div>
            </div>
            <div className="mb-4">
              <div className="flex justify-between mb-2"><p className="text-xs font-bold text-slate-500 uppercase">Conceptos</p><button type="button" onClick={()=>setItems([...items,{description:'',quantity:1,unit_price:0,tax_rate:21,total:0}])} className="text-xs text-indigo-600 font-medium">+ Añadir</button></div>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {items.map((item,i)=>(
                  <div key={i} className="flex gap-2 items-center">
                    <input type="text" value={item.description} onChange={e=>{const a=[...items];a[i]={...a[i],description:e.target.value};setItems(a);}} placeholder="Descripción" className="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-300"/>
                    <input type="number" step="0.01" value={item.quantity} onChange={e=>{const a=[...items];a[i]={...a[i],quantity:parseFloat(e.target.value)||1};setItems(a);}} placeholder="Cant." className="w-16 px-2 py-1.5 border border-slate-200 rounded-lg text-xs"/>
                    <input type="number" step="0.01" value={item.unit_price} onChange={e=>{const a=[...items];a[i]={...a[i],unit_price:parseFloat(e.target.value)||0};setItems(a);}} placeholder="Precio" className="w-20 px-2 py-1.5 border border-slate-200 rounded-lg text-xs"/>
                    <span className="text-xs text-slate-500 w-16 text-right">{((item.quantity||0)*(item.unit_price||0)).toFixed(2)}€</span>
                    <button onClick={()=>setItems(items.filter((_,j)=>j!==i))} className="text-red-400 hover:text-red-600"><X size={14}/></button>
                  </div>
                ))}
              </div>
              <div className="mt-3 text-right">
                <p className="text-sm text-slate-600">Subtotal: <strong>{items.reduce((s,i)=>s+i.quantity*i.unit_price,0).toFixed(2)}€</strong></p>
                <p className="text-sm text-slate-600">IVA ({newInvoice.tax_rate}%): <strong>{(items.reduce((s,i)=>s+i.quantity*i.unit_price,0)*newInvoice.tax_rate/100).toFixed(2)}€</strong></p>
                <p className="font-black text-indigo-700">TOTAL: {(items.reduce((s,i)=>s+i.quantity*i.unit_price,0)*(1+newInvoice.tax_rate/100)).toFixed(2)}€</p>
              </div>
            </div>
            <div className="flex gap-3"><button onClick={()=>setShowModal(false)} className="flex-1 py-3 border border-slate-200 rounded-xl text-sm font-medium hover:bg-slate-50">Cancelar</button><button onClick={handleAddInvoice} className="flex-1 py-3 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700">Emitir Factura</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
