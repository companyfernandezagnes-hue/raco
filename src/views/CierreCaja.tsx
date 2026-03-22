import React, { useState, useEffect } from 'react';
import { Calculator, Wallet, CreditCard, Banknote, AlertCircle, CheckCircle2, ArrowRight, RefreshCw, Printer, History, TrendingDown, TrendingUp, Coins, Sparkles, Loader2, X, Brain, Mic, MicOff } from 'lucide-react';
import { supabase } from '../supabase';
import { useSupabase } from '../context/SupabaseContext';

const BILLS = ['500','200','100','50','20','10','5'];
const COINS = ['2','1','0.5','0.2','0.1','0.05','0.02','0.01'];
const GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY;
async function callGemini(prompt:string):Promise<string>{
  const res=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
    {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contents:[{parts:[{text:prompt}]}]})});
  const json=await res.json();
  return json.candidates?.[0]?.content?.parts?.[0]?.text??'Sin respuesta';
}

export default function CierreCajaView() {
  const { employee } = useSupabase();
  const [step, setStep] = useState<'count'|'reconcile'|'summary'>('count');
  const [cashCount, setCashCount] = useState<Record<string,number>>(
    [...BILLS,...COINS].reduce((a,v)=>({...a,[v]:0}),{})
  );
  const [softwareData, setSoftwareData] = useState({cashSales:0,cardSales:0,deliverySales:0,totalSales:0,expectedCash:0});
  const [tips, setTips] = useState(0);
  const [finalFloat, setFinalFloat] = useState(200);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<string|null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(()=>{ loadData(); },[]);
  async function loadData() {
    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      // Cargar ventas del día desde tickets cerrados
      const {data:tickets} = await supabase.from('tickets').select('total,items').eq('date',today).eq('status','Cerrado');
      const totalSales = (tickets||[]).reduce((s:number,t:any)=>s+t.total,0);
      const cashSales = totalSales * 0.35; // Estimado efectivo (sin TPV real integrado)
      const cardSales = totalSales * 0.65;
      setSoftwareData({cashSales, cardSales, deliverySales:0, totalSales, expectedCash:cashSales+finalFloat});
      // Cargar historial de cierres
      const {data:hist} = await supabase.from('cash_closings').select('*').order('date',{ascending:false}).limit(10);
      setHistory(hist||[]);
    } catch(err) { console.error(err); }
    finally { setLoading(false); }
  }
  const countedCash = [...BILLS,...COINS].reduce((s,v)=>s+(parseFloat(v)*cashCount[v]),0);
  const discrepancy = countedCash - softwareData.expectedCash;
  async function handleCloseCash() {
    setSaving(true);
    try {
      const {error} = await supabase.from('cash_closings').insert([{
        date: new Date().toISOString().split('T')[0],
        cash_sales: softwareData.cashSales,
        card_sales: softwareData.cardSales,
        delivery_sales: softwareData.deliverySales,
        total_sales: softwareData.totalSales,
        expected_cash: softwareData.expectedCash,
        counted_cash: countedCash,
        final_float: finalFloat,
        tips: tips,
        notes: notes||null,
        status: 'closed',
        closed_by: employee?.nombre||'Sistema',
        closed_at: new Date().toISOString(),
      }]);
      if(error) throw error;
      setStep('summary');
      loadData();
    } catch(err:any) { alert('Error al cerrar caja: '+err.message); }
    finally { setSaving(false); }
  }
  async function handleAIAnalysis() {
    setAiLoading(true); setAiResult(null);
    try {
      const result = await callGemini(`Analiza este cierre de caja de restaurante y da recomendaciones:\nVentas totales: ${softwareData.totalSales.toFixed(2)}€\nEfectivo contado: ${countedCash.toFixed(2)}€\nDiferencia: ${discrepancy.toFixed(2)}€\nPropinas: ${tips}€\nDa 3 sugerencias en español.`);
      setAiResult(result);
    } catch(err:any) { setAiResult('Error IA: '+err.message); }
    finally { setAiLoading(false); }
  }

  if(loading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-indigo-500" size={40}/><span className="ml-3 text-slate-500">Cargando datos de caja...</span></div>;

  return (
    <div className="min-h-screen bg-slate-50 p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div><h1 className="text-3xl font-black text-slate-900 tracking-tight">Cierre de Caja</h1><p className="text-slate-500 text-sm mt-1">Recuento y cuadre del {new Date().toLocaleDateString('es-ES')}</p></div>
        <div className="flex gap-2">
          <button onClick={()=>setShowHistory(!showHistory)} className="flex items-center gap-2 bg-slate-200 text-slate-700 px-4 py-2 rounded-xl hover:bg-slate-300 text-sm font-medium"><History size={16}/> Historial</button>
          <button onClick={handleAIAnalysis} disabled={aiLoading} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl hover:bg-indigo-700 text-sm font-medium disabled:opacity-50">{aiLoading?<Loader2 size={16} className="animate-spin"/>:<Brain size={16}/>} Análisis IA</button>
        </div>
      </div>

      {aiResult&&(
        <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-5 relative"><button onClick={()=>setAiResult(null)} className="absolute top-3 right-3 text-slate-400 hover:text-slate-600"><X size={16}/></button><div className="flex items-start gap-3"><Brain size={20} className="text-indigo-600 mt-0.5 flex-shrink-0"/><div><p className="font-bold text-indigo-800 mb-2">Análisis IA</p><pre className="text-slate-700 text-sm whitespace-pre-wrap font-sans">{aiResult}</pre></div></div></div>
      )}

      {showHistory&&(
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h3 className="font-bold text-slate-800 mb-4">Últimos Cierres</h3>
          <div className="space-y-2">
            {history.map(h=>(
              <div key={h.id} className="flex justify-between items-center py-2 border-b border-slate-50 last:border-0 text-sm">
                <span className="font-medium text-slate-700">{h.date}</span>
                <span className="text-slate-600">{h.total_sales?.toLocaleString('es-ES',{style:'currency',currency:'EUR'})}</span>
                <span className={`font-bold ${h.discrepancy>=0?'text-emerald-600':'text-rose-600'}`}>{h.discrepancy>=0?'+':''}{h.discrepancy?.toFixed(2)}€</span>
                <span className={`text-xs px-2 py-1 rounded-lg ${h.status==='closed'?'bg-emerald-100 text-emerald-700':'bg-amber-100 text-amber-700'}`}>{h.status==='closed'?'Cerrado':'Abierto'}</span>
              </div>
            ))}
            {history.length===0&&<p className="text-center text-slate-400 py-4 text-sm">Sin cierres anteriores</p>}
          </div>
        </div>
      )}

      {/* Paso 1: Recuento */}
      {step==='count'&&(
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h2 className="font-black text-slate-800 mb-4 flex items-center gap-2"><Banknote size={18} className="text-green-600"/> Billetes</h2>
            <div className="space-y-3">
              {BILLS.map(v=>(
                <div key={v} className="flex items-center justify-between">
                  <span className="font-bold text-slate-700 w-16">{v}€</span>
                  <div className="flex items-center gap-3">
                    <button onClick={()=>setCashCount(prev=>({...prev,[v]:Math.max(0,prev[v]-1)}))} className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 font-bold text-lg flex items-center justify-center">-</button>
                    <input type="number" value={cashCount[v]} onChange={e=>setCashCount(prev=>({...prev,[v]:parseInt(e.target.value)||0}))} className="w-16 text-center font-bold text-slate-800 border border-slate-200 rounded-xl py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"/>
                    <button onClick={()=>setCashCount(prev=>({...prev,[v]:prev[v]+1}))} className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-600 hover:bg-indigo-200 font-bold text-lg flex items-center justify-center">+</button>
                    <span className="text-sm text-slate-500 w-20 text-right">{(parseFloat(v)*cashCount[v]).toFixed(2)}€</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h2 className="font-black text-slate-800 mb-4 flex items-center gap-2"><Coins size={18} className="text-yellow-600"/> Monedas</h2>
            <div className="space-y-3">
              {COINS.map(v=>(
                <div key={v} className="flex items-center justify-between">
                  <span className="font-bold text-slate-700 w-16">{v}€</span>
                  <div className="flex items-center gap-3">
                    <button onClick={()=>setCashCount(prev=>({...prev,[v]:Math.max(0,prev[v]-1)}))} className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 font-bold text-lg flex items-center justify-center">-</button>
                    <input type="number" value={cashCount[v]} onChange={e=>setCashCount(prev=>({...prev,[v]:parseInt(e.target.value)||0}))} className="w-16 text-center font-bold text-slate-800 border border-slate-200 rounded-xl py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"/>
                    <button onClick={()=>setCashCount(prev=>({...prev,[v]:prev[v]+1}))} className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-600 hover:bg-indigo-200 font-bold text-lg flex items-center justify-center">+</button>
                    <span className="text-sm text-slate-500 w-20 text-right">{(parseFloat(v)*cashCount[v]).toFixed(2)}€</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 pt-4 border-t border-slate-200">
              <div className="flex justify-between items-center"><span className="font-black text-slate-700">TOTAL CONTADO</span><span className="text-2xl font-black text-indigo-700">{countedCash.toFixed(2)}€</span></div>
            </div>
            <button onClick={()=>setStep('reconcile')} className="w-full mt-4 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 flex items-center justify-center gap-2"><ArrowRight size={16}/> Continuar al Cuadre</button>
          </div>
        </div>
      )}

      {/* Paso 2: Cuadre */}
      {step==='reconcile'&&(
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h2 className="font-black text-slate-800 mb-4">Datos del Sistema</h2>
            <div className="space-y-3">
              {[{label:'Ventas efectivo',value:softwareData.cashSales},{label:'Ventas tarjeta',value:softwareData.cardSales},{label:'Ventas delivery',value:softwareData.deliverySales},{label:'Total ventas',value:softwareData.totalSales,bold:true},{label:'Efectivo esperado',value:softwareData.expectedCash,highlight:true}].map(item=>(
                <div key={item.label} className={`flex justify-between items-center py-2 ${item.highlight?'bg-blue-50 px-3 rounded-xl':''}`}>
                  <span className={`text-sm ${item.bold?'font-black':'font-medium'} text-slate-700`}>{item.label}</span>
                  <span className={`font-bold ${item.highlight?'text-blue-700':item.bold?'text-slate-800':'text-slate-600'}`}>{item.value.toLocaleString('es-ES',{style:'currency',currency:'EUR'})}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h2 className="font-black text-slate-800 mb-4">Resultado del Cuadre</h2>
            <div className={`rounded-2xl p-6 mb-4 ${Math.abs(discrepancy)<0.01?'bg-emerald-50 border border-emerald-200':discrepancy>0?'bg-blue-50 border border-blue-200':'bg-rose-50 border border-rose-200'}`}>
              <p className="text-sm font-medium text-slate-600 mb-1">Diferencia</p>
              <p className={`text-3xl font-black ${Math.abs(discrepancy)<0.01?'text-emerald-600':discrepancy>0?'text-blue-600':'text-rose-600'}`}>{discrepancy>=0?'+':''}{discrepancy.toFixed(2)}€</p>
              <p className="text-xs text-slate-500 mt-1">{Math.abs(discrepancy)<0.01?'✅ Cuadre perfecto':discrepancy>0?'📈 Sobrante':'⚠️ Faltante'}</p>
            </div>
            <div className="space-y-3">
              <div><label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Propinas (€)</label><input type="number" step="0.01" value={tips} onChange={e=>setTips(parseFloat(e.target.value)||0)} className="w-full mt-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"/></div>
              <div><label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Fondo para mañana (€)</label><input type="number" step="0.01" value={finalFloat} onChange={e=>setFinalFloat(parseFloat(e.target.value)||200)} className="w-full mt-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"/></div>
              <div><label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Notas</label><textarea value={notes} onChange={e=>setNotes(e.target.value)} className="w-full mt-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none h-20" placeholder="Observaciones del cierre..."/></div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={()=>setStep('count')} className="flex-1 py-3 border border-slate-200 rounded-xl text-sm font-medium hover:bg-slate-50">Volver</button>
              <button onClick={handleCloseCash} disabled={saving} className="flex-1 py-3 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 disabled:opacity-50">{saving?<Loader2 size={16} className="animate-spin mx-auto"/>:'Cerrar Caja'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Resumen final */}
      {step==='summary'&&(
        <div className="bg-white rounded-2xl border border-emerald-200 shadow-sm p-8 text-center max-w-lg mx-auto">
          <CheckCircle2 size={48} className="text-emerald-500 mx-auto mb-4"/>
          <h2 className="text-2xl font-black text-slate-900 mb-2">¡Caja Cerrada!</h2>
          <p className="text-slate-500 mb-6">El cierre del día ha sido registrado correctamente en Supabase.</p>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-slate-50 rounded-xl p-3"><p className="text-xs text-slate-500">Ventas</p><p className="font-black text-slate-800">{softwareData.totalSales.toFixed(2)}€</p></div>
            <div className="bg-slate-50 rounded-xl p-3"><p className="text-xs text-slate-500">Diferencia</p><p className={`font-black ${discrepancy>=0?'text-emerald-600':'text-rose-600'}`}>{discrepancy>=0?'+':''}{discrepancy.toFixed(2)}€</p></div>
            <div className="bg-slate-50 rounded-xl p-3"><p className="text-xs text-slate-500">Fondo</p><p className="font-black text-slate-800">{finalFloat.toFixed(2)}€</p></div>
          </div>
          <button onClick={()=>{setStep('count');setCashCount([...BILLS,...COINS].reduce((a,v)=>({...a,[v]:0}),{}));}} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700">Nuevo Cierre</button>
        </div>
      )}
    </div>
  );
}
