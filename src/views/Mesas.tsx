import React, { useState, useEffect } from 'react';
import { Users, Clock, CheckCircle2, AlertCircle, Plus, X, Coffee, Utensils, Wine, Maximize2, Loader2, Trash2 } from 'lucide-react';
import { supabase } from '../supabase';

interface Table {
  id: string; number: number; capacity: number;
  status: 'available'|'occupied'|'reserved'|'cleaning';
  x: number; y: number; type: 'square'|'round'|'long';
}

export default function MesasView() {
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string|null>(null);
  const [selectedTable, setSelectedTable] = useState<Table|null>(null);
  const [showModal, setShowModal] = useState(false);
  const [newTable, setNewTable] = useState({ number:1, capacity:4, type:'square' as const });

  useEffect(()=>{loadTables();},[]);
  async function loadTables() {
    setLoading(true); setError(null);
    const {data,error} = await supabase.from('tables_config').select('*').order('number');
    if(error) setError(error.message); else setTables(data||[]);
    setLoading(false);
  }
  async function handleAddTable() {
    const {error} = await supabase.from('tables_config').insert([{
      number:newTable.number, capacity:newTable.capacity, type:newTable.type,
      status:'available', x:Math.floor(Math.random()*400)+50, y:Math.floor(Math.random()*300)+50,
    }]);
    if(error){alert('Error: '+error.message);return;}
    setShowModal(false); loadTables();
  }
  async function handleStatusChange(id:string, status:string) {
    const {error} = await supabase.from('tables_config').update({status}).eq('id',id);
    if(error){alert('Error: '+error.message);return;}
    loadTables();
  }
  async function handleDeleteTable(id:string) {
    if(!confirm('¿Eliminar esta mesa?')) return;
    const {error} = await supabase.from('tables_config').delete().eq('id',id);
    if(error){alert('Error: '+error.message);return;}
    setSelectedTable(null); loadTables();
  }

  const statusInfo:Record<string,{label:string;color:string;bg:string;icon:any}> = {
    available:{label:'Libre',color:'text-emerald-600',bg:'bg-emerald-50 border-emerald-200',icon:CheckCircle2},
    occupied:{label:'Ocupada',color:'text-rose-600',bg:'bg-rose-50 border-rose-200',icon:Users},
    reserved:{label:'Reservada',color:'text-amber-600',bg:'bg-amber-50 border-amber-200',icon:Clock},
    cleaning:{label:'Limpieza',color:'text-blue-600',bg:'bg-blue-50 border-blue-200',icon:AlertCircle},
  };
  const STATUSES=['available','occupied','reserved','cleaning'] as const;
  const counts = STATUSES.reduce((acc,s)=>({...acc,[s]:tables.filter(t=>t.status===s).length}),{} as Record<string,number>);

  if(loading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-indigo-500" size={40}/><span className="ml-3 text-slate-500">Cargando mesas...</span></div>;
  if(error) return <div className="flex flex-col items-center justify-center h-64 gap-4"><AlertCircle className="text-red-500" size={40}/><p className="text-red-600">{error}</p><button onClick={loadTables} className="px-4 py-2 bg-indigo-600 text-white rounded-xl">Reintentar</button></div>;

  return (
    <div className="min-h-screen bg-slate-50 p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div><h1 className="text-3xl font-black text-slate-900 tracking-tight">Mesas & Sala</h1><p className="text-slate-500 text-sm mt-1">Estado del salón en tiempo real</p></div>
        <button onClick={()=>setShowModal(true)} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl hover:bg-indigo-700 text-sm font-medium w-fit"><Plus size={16}/> Nueva Mesa</button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {STATUSES.map(s=>{const si=statusInfo[s]; return (
          <div key={s} className={`${si.bg} rounded-2xl p-4 border shadow-sm`}>
            <div className="flex items-center gap-3"><si.icon size={20} className={si.color}/>
              <div><p className="text-xs text-slate-500 font-medium">{si.label}</p><p className={`text-2xl font-black ${si.color}`}>{counts[s]||0}</p></div>
            </div>
          </div>
        );})}
      </div>

      {/* Plano de sala */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h2 className="font-bold text-slate-800 mb-4">Plano del Salón</h2>
        <div className="relative w-full h-96 bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
          {tables.map(t=>{
            const si=statusInfo[t.status];
            const isSelected=selectedTable?.id===t.id;
            const w=t.type==='long'?100:60; const h=t.type==='long'?40:60;
            return (
              <div key={t.id} onClick={()=>setSelectedTable(isSelected?null:t)}
                className={`absolute flex flex-col items-center justify-center rounded-xl border-2 cursor-pointer transition-all shadow-sm ${si.bg} ${isSelected?'ring-2 ring-indigo-500 scale-110 z-10':''}`}
                style={{left:Math.min(t.x,580)+'px',top:Math.min(t.y,300)+'px',width:w+'px',height:h+'px'}}>
                <span className={`text-xs font-black ${si.color}`}>{t.number}</span>
                <span className="text-[9px] text-slate-400">{t.capacity}p</span>
              </div>
            );
          })}
          {tables.length===0&&<div className="flex items-center justify-center h-full text-slate-400"><p>Sin mesas configuradas</p></div>}
        </div>

        {selectedTable&&(
          <div className="mt-4 p-4 bg-indigo-50 rounded-xl border border-indigo-200">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div><p className="font-bold text-indigo-800">Mesa {selectedTable.number} · {selectedTable.capacity} personas · {selectedTable.type}</p><p className="text-sm text-indigo-600">{statusInfo[selectedTable.status]?.label}</p></div>
              <div className="flex gap-2 flex-wrap">
                {STATUSES.map(s=>(
                  <button key={s} onClick={()=>handleStatusChange(selectedTable.id,s)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${selectedTable.status===s?statusInfo[s].bg+' '+statusInfo[s].color:'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                    {statusInfo[s].label}
                  </button>
                ))}
                <button onClick={()=>handleDeleteTable(selectedTable.id)} className="px-3 py-1.5 rounded-xl text-xs font-bold bg-red-50 text-red-600 hover:bg-red-100 border border-red-200">Eliminar</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Grid de mesas */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {tables.map(t=>{
          const si=statusInfo[t.status];
          return (
            <div key={t.id} onClick={()=>setSelectedTable(selectedTable?.id===t.id?null:t)}
              className={`${si.bg} border rounded-2xl p-4 cursor-pointer transition-all hover:shadow-md ${selectedTable?.id===t.id?'ring-2 ring-indigo-500':''}`}>
              <div className="flex items-center justify-between mb-2"><span className="font-black text-slate-800">Mesa {t.number}</span><si.icon size={16} className={si.color}/></div>
              <p className="text-xs text-slate-500">{t.capacity} personas</p>
              <p className={`text-xs font-bold ${si.color} mt-1`}>{si.label}</p>
            </div>
          );
        })}
        {tables.length===0&&<div className="col-span-6 text-center py-12 text-slate-400"><Users size={40} className="mx-auto mb-3 opacity-30"/><p>No hay mesas configuradas</p></div>}
      </div>

      {/* MODAL Nueva Mesa */}
      {showModal&&(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-sm">
            <div className="flex items-center justify-between mb-6"><h2 className="text-xl font-black text-slate-900">Nueva Mesa</h2><button onClick={()=>setShowModal(false)} className="p-2 rounded-full hover:bg-slate-100"><X size={20}/></button></div>
            <div className="space-y-4">
              <div><label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Número de mesa</label><input type="number" value={newTable.number} onChange={e=>setNewTable({...newTable,number:parseInt(e.target.value)||1})} className="w-full mt-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"/></div>
              <div><label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Capacidad (personas)</label><input type="number" value={newTable.capacity} onChange={e=>setNewTable({...newTable,capacity:parseInt(e.target.value)||2})} className="w-full mt-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"/></div>
              <div><label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Forma</label><select value={newTable.type} onChange={e=>setNewTable({...newTable,type:e.target.value as any})} className="w-full mt-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"><option value="square">Cuadrada</option><option value="round">Redonda</option><option value="long">Larga</option></select></div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={()=>setShowModal(false)} className="flex-1 py-3 border border-slate-200 rounded-xl text-sm font-medium hover:bg-slate-50">Cancelar</button>
              <button onClick={handleAddTable} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700">Añadir Mesa</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
