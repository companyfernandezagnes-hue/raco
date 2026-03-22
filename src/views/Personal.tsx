import React, { useState, useEffect, useRef } from 'react';
import {
  Plus, Calendar, Clock, UserPlus, MoreVertical, CheckCircle2,
  AlertCircle, Plane, TrendingUp, Mail, CreditCard, FileText,
  Shield, DollarSign, ExternalLink, Search, ChevronRight,
  User, Briefcase, MapPin, Phone, Filter, Zap, Brain, Calculator,
  Loader2, Mic, MicOff, Camera, X, Check, Edit2, Trash2
} from 'lucide-react';
import { supabase } from '../supabase';
import { useSupabase } from '../context/SupabaseContext';

interface StaffProfile {
  id: string; name: string; role: string; dni?: string; email?: string; phone?: string;
  contract_type?: string; monthly_salary: number; contract_hours: number; hourly_rate?: number;
  status: string; photo_url?: string; notes?: string; hire_date?: string; created_at?: string;
}
interface Schedule {
  id: string; staff_id: string; date: string; shift: string;
  start_time?: string; end_time?: string; notes?: string;
}
interface Vacation {
  id: string; staff_id: string; start_date: string; end_date: string;
  type: string; status: string; notes?: string;
}
interface FixedExpense {
  id: string; name: string; category: string; frequency: string;
  amount: number; notes?: string; active: boolean;
}

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
    if (!SR) { alert('Tu navegador no soporta reconocimiento de voz'); return; }
    const rec = new SR(); rec.lang='es-ES'; rec.interimResults=false;
    rec.onresult = (e: any) => { onResult(e.results[0][0].transcript); setListening(false); };
    rec.onerror = () => setListening(false); rec.onend = () => setListening(false);
    recRef.current = rec; rec.start(); setListening(true);
  };
  return (
    <button type="button" onClick={toggle}
      className={`p-2 rounded-full transition-all ${listening ? 'bg-red-500 text-white animate-pulse' : 'bg-indigo-100 text-indigo-600 hover:bg-indigo-200'} ${className}`}
      title={listening ? 'Parar' : 'Voz'}>
      {listening ? <MicOff size={16} /> : <Mic size={16} />}
    </button>
  );
}
export default function PersonalView() {
  const { employee: authEmployee } = useSupabase();
  const isAdmin = authEmployee?.rol === 'admin';
  const [activeTab, setActiveTab] = useState<'list'|'schedules'|'vacations'|'expenses'|'notes'|'analytics'>('list');
  const [staff, setStaff] = useState<StaffProfile[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [vacations, setVacations] = useState<Vacation[]>([]);
  const [expenses, setExpenses] = useState<FixedExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string|null>(null);
  const [search, setSearch] = useState('');
  const [selectedStaff, setSelectedStaff] = useState<StaffProfile|null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showVacModal, setShowVacModal] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<string|null>(null);
  const [notes, setNotes] = useState(localStorage.getItem('personal_notes') || '');
  const [newStaff, setNewStaff] = useState({ name:'', role:'Cocinero', dni:'', email:'', phone:'', contract_type:'Indefinido', monthly_salary:1800, contract_hours:40, status:'Activo', notes:'' });
  const [newExpense, setNewExpense] = useState({ name:'', category:'Personal', frequency:'Mensual', amount:0, notes:'', active:true });
  const [newVac, setNewVac] = useState({ staff_id:'', start_date:'', end_date:'', type:'Vacaciones', notes:'' });

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true); setError(null);
    try {
      const [s,sc,v,e] = await Promise.all([
        supabase.from('staff_profiles').select('*').order('name'),
        supabase.from('schedules').select('*').order('date',{ascending:false}).limit(200),
        supabase.from('vacations').select('*').order('created_at',{ascending:false}),
        supabase.from('fixed_expenses').select('*').order('category'),
      ]);
      if (s.error) throw s.error; if (sc.error) throw sc.error;
      if (v.error) throw v.error; if (e.error) throw e.error;
      setStaff(s.data||[]); setSchedules(sc.data||[]); setVacations(v.data||[]); setExpenses(e.data||[]);
    } catch(err:any) { setError(err.message||'Error cargando datos'); }
    finally { setLoading(false); }
  }

  async function handleAddStaff() {
    if (!newStaff.name.trim()) { alert('El nombre es obligatorio'); return; }
    const {error} = await supabase.from('staff_profiles').insert([{
      name:newStaff.name.trim(), role:newStaff.role, dni:newStaff.dni||null, email:newStaff.email||null,
      phone:newStaff.phone||null, contract_type:newStaff.contract_type, monthly_salary:newStaff.monthly_salary,
      contract_hours:newStaff.contract_hours, status:newStaff.status, notes:newStaff.notes||null,
    }]);
    if (error) { alert('Error: '+error.message); return; }
    setShowModal(false);
    setNewStaff({name:'',role:'Cocinero',dni:'',email:'',phone:'',contract_type:'Indefinido',monthly_salary:1800,contract_hours:40,status:'Activo',notes:''});
    loadAll();
  }
  async function handleDeleteStaff(id:string) {
    if (!confirm('¿Eliminar este empleado? Se borrarán sus turnos y vacaciones.')) return;
    const {error} = await supabase.from('staff_profiles').delete().eq('id',id);
    if (error) { alert('Error: '+error.message); return; }
    setSelectedStaff(null); loadAll();
  }
  async function handleUpdateStatus(id:string, status:string) {
    const {error} = await supabase.from('staff_profiles').update({status}).eq('id',id);
    if (error) { alert('Error: '+error.message); return; } loadAll();
  }
  async function handleAddExpense() {
    if (!newExpense.name.trim()) { alert('El nombre es obligatorio'); return; }
    const {error} = await supabase.from('fixed_expenses').insert([{ name:newExpense.name.trim(), category:newExpense.category, frequency:newExpense.frequency, amount:newExpense.amount, notes:newExpense.notes||null, active:newExpense.active }]);
    if (error) { alert('Error: '+error.message); return; }
    setShowExpenseModal(false); setNewExpense({name:'',category:'Personal',frequency:'Mensual',amount:0,notes:'',active:true}); loadAll();
  }
  async function handleDeleteExpense(id:string) {
    if (!confirm('¿Eliminar este gasto fijo?')) return;
    const {error} = await supabase.from('fixed_expenses').delete().eq('id',id);
    if (error) { alert('Error: '+error.message); return; } loadAll();
  }
  async function handleAddVacation() {
    if (!newVac.staff_id||!newVac.start_date||!newVac.end_date) { alert('Selecciona empleado, fecha inicio y fin'); return; }
    const {error} = await supabase.from('vacations').insert([{ staff_id:newVac.staff_id, start_date:newVac.start_date, end_date:newVac.end_date, type:newVac.type, status:'Solicitada', notes:newVac.notes||null }]);
    if (error) { alert('Error: '+error.message); return; }
    setShowVacModal(false); setNewVac({staff_id:'',start_date:'',end_date:'',type:'Vacaciones',notes:''}); loadAll();
  }
  async function handleVacationStatus(id:string, status:string) {
    const {error} = await supabase.from('vacations').update({status}).eq('id',id);
    if (error) { alert('Error: '+error.message); return; } loadAll();
  }
  async function handleOptimizeShifts() {
    setAiLoading(true); setAiResult(null);
    try {
      const staffSummary = staff.map(s => `${s.name} (${s.role}, ${s.status})`).join(', ');
      const vacSummary = vacations.filter(v=>v.status==='Aprobada').map(v=>{
        const emp=staff.find(s=>s.id===v.staff_id);
        return `${emp?.name??'Desc'}: ${v.start_date}→${v.end_date}`;
      }).join(', ');
      const result = await callGemini(`Eres responsable RRHH de un restaurante. Analiza y da 3-5 sugerencias para optimizar turnos esta semana.\nEquipo: ${staffSummary||'Sin datos'}.\nVacaciones aprobadas: ${vacSummary||'Ninguna'}.\nResponde en español con bullet points.`);
      setAiResult(result);
    } catch(err:any) { setAiResult('Error IA: '+err.message); }
    finally { setAiLoading(false); }
  }

  const photoInputRef = useRef<HTMLInputElement>(null);
  async function handlePhotoScan(e:React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setAiLoading(true);
    try {
      const base64 = await new Promise<string>((resolve,reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject; reader.readAsDataURL(file);
      });
      const result = await callGeminiVision(base64, file.type, 'Extrae de este documento los campos en JSON: {"name":"","dni":"","role":"","email":"","phone":""}. Solo JSON.');
      const m = result.match(/\{[\s\S]*\}/);
      if (m) {
        const d = JSON.parse(m[0]);
        setNewStaff(prev=>({...prev, name:d.name||prev.name, dni:d.dni||prev.dni, role:d.role||prev.role, email:d.email||prev.email, phone:d.phone||prev.phone}));
        setShowModal(true); alert('Datos extraídos. Revisa y confirma.');
      } else { alert('No se pudieron extraer datos.'); }
    } catch(err:any) { alert('Error imagen: '+err.message); }
    finally { setAiLoading(false); if(e.target) e.target.value=''; }
  }

  const totalSalaries = staff.reduce((s,p)=>s+(p.monthly_salary||0),0);
  const totalExpenses = expenses.filter(e=>e.active).reduce((s,e)=>{
    const m = e.frequency==='Mensual'?e.amount:e.frequency==='Trimestral'?e.amount/3:e.amount/12;
    return s+m;
  },0);
  const onDuty = staff.filter(s=>s.status==='En turno').length;
  const onVacation = staff.filter(s=>s.status==='Vacaciones').length;
  const pendingVacs = vacations.filter(v=>v.status==='Solicitada').length;
  const filteredStaff = staff.filter(s=>
    s.name.toLowerCase().includes(search.toLowerCase())||
    s.role.toLowerCase().includes(search.toLowerCase())
  );
  const ROLES=['Cocinero','Camarero','Maitre','Encargado','Limpieza','Otro'];
  const CONTRACT_TYPES=['Indefinido','Temporal','Prácticas','Parcial'];
  const EXPENSE_CATS=['Personal','Alquiler','Suministros','Seguros','Otros'];
  const ABSENCE_TYPES=['Vacaciones','Enfermedad','Asunto propio','Maternidad/Paternidad','Otro'];
  const statusColor:Record<string,string>={'En turno':'bg-emerald-500','Descanso':'bg-slate-300','Vacaciones':'bg-blue-400','Baja':'bg-red-400','Activo':'bg-indigo-400'};

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-indigo-500" size={40}/><span className="ml-3 text-slate-500 text-lg">Cargando personal...</span></div>;
  if (error) return <div className="flex flex-col items-center justify-center h-64 gap-4"><AlertCircle className="text-red-500" size={40}/><p className="text-red-600 font-medium">{error}</p><button onClick={loadAll} className="px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700">Reintentar</button></div>;
  return (
    <div className="min-h-screen bg-slate-50 p-6 space-y-6">
      <input ref={photoInputRef} type="file" accept="image/*" onChange={handlePhotoScan} className="hidden" />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Personal & RRHH</h1>
          <p className="text-slate-500 text-sm mt-1">Gestión de equipo, turnos, vacaciones y costes fijos</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={()=>photoInputRef.current?.click()} disabled={aiLoading}
            className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-xl hover:bg-purple-700 text-sm font-medium disabled:opacity-50">
            {aiLoading?<Loader2 size={16} className="animate-spin"/>:<Camera size={16}/>} Escanear DNI/Contrato
          </button>
          <button onClick={handleOptimizeShifts} disabled={aiLoading}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl hover:bg-indigo-700 text-sm font-medium disabled:opacity-50">
            {aiLoading?<Loader2 size={16} className="animate-spin"/>:<Brain size={16}/>} IA: Optimizar Turnos
          </button>
          <button onClick={()=>setShowModal(true)}
            className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl hover:bg-emerald-700 text-sm font-medium">
            <UserPlus size={16}/> Añadir Empleado
          </button>
        </div>
      </div>

      {aiResult && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-5 relative">
          <button onClick={()=>setAiResult(null)} className="absolute top-3 right-3 text-slate-400 hover:text-slate-600"><X size={16}/></button>
          <div className="flex items-start gap-3">
            <Brain size={20} className="text-indigo-600 mt-0.5 flex-shrink-0"/>
            <div><p className="font-bold text-indigo-800 mb-2">Análisis IA de Turnos</p><pre className="text-slate-700 text-sm whitespace-pre-wrap font-sans">{aiResult}</pre></div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {label:'Total empleados',value:staff.length,icon:User,color:'text-indigo-600',bg:'bg-indigo-50'},
          {label:'En turno ahora',value:onDuty,icon:CheckCircle2,color:'text-emerald-600',bg:'bg-emerald-50'},
          {label:'Vacaciones activas',value:onVacation,icon:Plane,color:'text-blue-600',bg:'bg-blue-50'},
          {label:'Solicitudes pendientes',value:pendingVacs,icon:AlertCircle,color:'text-amber-600',bg:'bg-amber-50'},
        ].map(stat=>(
          <div key={stat.label} className={`${stat.bg} rounded-2xl p-4 border border-white shadow-sm`}>
            <div className="flex items-center gap-3">
              <stat.icon size={20} className={stat.color}/>
              <div><p className="text-xs text-slate-500 font-medium">{stat.label}</p><p className={`text-2xl font-black ${stat.color}`}>{stat.value}</p></div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-2xl w-fit flex-wrap">
        {([
          {id:'list',label:'Equipo',icon:User},
          {id:'schedules',label:'Turnos',icon:Clock},
          {id:'vacations',label:'Ausencias',icon:Plane},
          {id:'expenses',label:'Gastos Fijos',icon:DollarSign},
          {id:'notes',label:'Notas',icon:FileText},
          {id:'analytics',label:'Analítica',icon:TrendingUp},
        ] as const).map(tab=>(
          <button key={tab.id} onClick={()=>setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all ${activeTab===tab.id?'bg-white text-indigo-700 shadow-sm':'text-slate-500 hover:text-slate-700'}`}>
            <tab.icon size={14}/>{tab.label}
          </button>
        ))}
      </div>
      {/* TAB Equipo */}
      {activeTab==='list'&&(
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
              <input type="text" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar empleado..."
                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"/>
            </div>
            <VoiceButton onResult={t=>setSearch(t)}/>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredStaff.map(p=>(
              <div key={p.id} onClick={()=>setSelectedStaff(selectedStaff?.id===p.id?null:p)}
                className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm group hover:shadow-xl hover:border-indigo-200 transition-all cursor-pointer relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50/50 rounded-full -mr-8 -mt-8 blur-2xl"/>
                <div className="flex items-start justify-between mb-4 relative z-10">
                  <div className="relative">
                    {p.photo_url?(
                      <img src={p.photo_url} alt={p.name} className="w-12 h-12 rounded-2xl object-cover border-2 border-white shadow-md" referrerPolicy="no-referrer"/>
                    ):(
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold text-lg shadow-md">
                        {p.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm ${statusColor[p.status]??'bg-slate-300'}`}/>
                  </div>
                  <select value={p.status} onChange={e=>{e.stopPropagation();handleUpdateStatus(p.id,e.target.value);}} onClick={e=>e.stopPropagation()}
                    className="text-[10px] font-bold uppercase px-2 py-1 rounded-lg border border-slate-200 bg-slate-50 text-slate-600 focus:outline-none">
                    {['En turno','Descanso','Vacaciones','Baja','Activo'].map(s=><option key={s}>{s}</option>)}
                  </select>
                </div>
                <div className="relative z-10">
                  <h3 className="font-black text-slate-900 text-lg tracking-tight">{p.name}</h3>
                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">{p.role}</p>
                  <div className="mt-3 space-y-1.5">
                    {p.email&&<div className="flex items-center gap-2 text-sm text-slate-500"><Mail size={13} className="text-indigo-400"/>{p.email}</div>}
                    {p.dni&&<div className="flex items-center gap-2 text-sm text-slate-500"><Shield size={13} className="text-indigo-400"/>{p.dni}</div>}
                    <div className="flex items-center gap-2 text-sm text-slate-500"><DollarSign size={13} className="text-emerald-500"/>{p.monthly_salary.toLocaleString('es-ES',{style:'currency',currency:'EUR'})}/mes</div>
                    <div className="flex items-center gap-2 text-sm text-slate-500"><Clock size={13} className="text-blue-500"/>{p.contract_hours}h/sem · {p.contract_type}</div>
                  </div>
                </div>
                {selectedStaff?.id===p.id&&(
                  <div className="mt-4 pt-4 border-t border-slate-100 flex gap-2">
                    <button onClick={e=>{e.stopPropagation();handleDeleteStaff(p.id);}} className="flex items-center gap-1 text-red-500 hover:text-red-700 text-xs font-medium">
                      <Trash2 size={12}/> Eliminar
                    </button>
                  </div>
                )}
              </div>
            ))}
            {filteredStaff.length===0&&(
              <div className="col-span-3 text-center py-16 text-slate-400">
                <User size={48} className="mx-auto mb-3 opacity-30"/>
                <p className="font-medium">No hay empleados registrados</p>
                <p className="text-sm mt-1">Añade el primer empleado o escanea su DNI con IA</p>
              </div>
            )}
          </div>
        </div>
      )}
      {/* TAB Turnos */}
      {activeTab==='schedules'&&(
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-slate-800">Turnos registrados</h2>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <table className="w-full text-left border-collapse">
              <thead><tr className="bg-slate-50/50 border-b border-slate-100">
                {['Empleado','Fecha','Turno','Entrada','Salida','Notas'].map(h=>(
                  <th key={h} className="px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{h}</th>
                ))}
              </tr></thead>
              <tbody className="divide-y divide-slate-50">
                {schedules.slice(0,50).map(sc=>{
                  const emp=staff.find(s=>s.id===sc.staff_id);
                  return <tr key={sc.id} className="hover:bg-slate-50/30 transition-colors">
                    <td className="px-5 py-3 font-medium text-slate-800 text-sm">{emp?.name??'—'}</td>
                    <td className="px-5 py-3 text-sm text-slate-600">{sc.date}</td>
                    <td className="px-5 py-3"><span className={`text-xs font-bold px-2 py-1 rounded-lg ${sc.shift==='Mañana'?'bg-amber-100 text-amber-700':sc.shift==='Tarde'?'bg-orange-100 text-orange-700':sc.shift==='Noche'?'bg-indigo-100 text-indigo-700':sc.shift==='Libre'?'bg-slate-100 text-slate-600':'bg-purple-100 text-purple-700'}`}>{sc.shift}</span></td>
                    <td className="px-5 py-3 text-sm text-slate-600">{sc.start_time??'—'}</td>
                    <td className="px-5 py-3 text-sm text-slate-600">{sc.end_time??'—'}</td>
                    <td className="px-5 py-3 text-xs text-slate-400">{sc.notes??''}</td>
                  </tr>;
                })}
                {schedules.length===0&&<tr><td colSpan={6} className="px-5 py-12 text-center text-slate-400"><Clock size={40} className="mx-auto mb-3 opacity-30"/><p>No hay turnos registrados</p></td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB Ausencias */}
      {activeTab==='vacations'&&(
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-slate-800">Ausencias y Vacaciones</h2>
            <button onClick={()=>setShowVacModal(true)} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 text-sm font-medium"><Plus size={16}/> Nueva solicitud</button>
          </div>
          <div className="space-y-3">
            {vacations.map(v=>{
              const emp=staff.find(s=>s.id===v.staff_id);
              return <div key={v.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center"><Plane size={18} className="text-blue-500"/></div>
                  <div><p className="font-bold text-slate-800 text-sm">{emp?.name??'Empleado'}</p><p className="text-xs text-slate-500">{v.type} · {v.start_date} → {v.end_date}</p></div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold px-3 py-1 rounded-xl ${v.status==='Aprobada'?'bg-emerald-100 text-emerald-700':v.status==='Rechazada'?'bg-red-100 text-red-700':'bg-amber-100 text-amber-700'}`}>{v.status}</span>
                  {isAdmin&&v.status==='Solicitada'&&(
                    <><button onClick={()=>handleVacationStatus(v.id,'Aprobada')} className="p-2 rounded-xl bg-emerald-50 text-emerald-600 hover:bg-emerald-100"><Check size={14}/></button>
                    <button onClick={()=>handleVacationStatus(v.id,'Rechazada')} className="p-2 rounded-xl bg-red-50 text-red-600 hover:bg-red-100"><X size={14}/></button></>
                  )}
                </div>
              </div>;
            })}
            {vacations.length===0&&<div className="text-center py-16 text-slate-400"><Plane size={48} className="mx-auto mb-3 opacity-30"/><p>No hay solicitudes registradas</p></div>}
          </div>
        </div>
      )}
      {/* TAB Gastos Fijos */}
      {activeTab==='expenses'&&(
        <div>
          <div className="flex items-center justify-between mb-4">
            <div><h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Gastos Fijos y Estructurales</h2><p className="text-slate-500 text-sm mt-1">Incluye costes de personal y mantenimiento.</p></div>
            <button onClick={()=>setShowExpenseModal(true)} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-3 rounded-2xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"><Plus size={18}/> Añadir Gasto</button>
          </div>
          <div className="overflow-x-auto bg-white rounded-2xl border border-slate-200 shadow-sm">
            <table className="w-full text-left border-collapse">
              <thead><tr className="bg-slate-50/50 border-b border-slate-100">
                {['Concepto','Categoría','Frecuencia','Importe'].map(h=><th key={h} className="px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{h}</th>)}
                <th className="px-5 py-3 text-right text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Acc.</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-50">
                {expenses.map(exp=>(
                  <tr key={exp.id} className="hover:bg-slate-50/30 transition-colors group">
                    <td className="px-5 py-4"><div className="flex items-center gap-3"><div className="w-8 h-8 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-500 transition-colors">{exp.category==='Personal'?<User size={16}/>:<CreditCard size={16}/>}</div><span className="text-sm font-black text-slate-700">{exp.name}</span></div></td>
                    <td className="px-5 py-4"><span className="text-xs font-bold uppercase tracking-wide text-slate-500 bg-slate-100 px-2 py-1 rounded-lg">{exp.category}</span></td>
                    <td className="px-5 py-4 text-sm text-slate-600">{exp.frequency}</td>
                    <td className="px-5 py-4 font-bold text-slate-800 text-sm">{exp.amount.toLocaleString('es-ES',{style:'currency',currency:'EUR'})}</td>
                    <td className="px-5 py-4 text-right"><button onClick={()=>handleDeleteExpense(exp.id)} className="p-2 rounded-xl text-red-400 hover:bg-red-50 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={14}/></button></td>
                  </tr>
                ))}
                {expenses.length===0&&<tr><td colSpan={5} className="px-5 py-12 text-center text-slate-400"><DollarSign size={40} className="mx-auto mb-3 opacity-30"/><p>No hay gastos fijos registrados</p></td></tr>}
              </tbody>
              {expenses.length>0&&<tfoot><tr className="border-t-2 border-slate-200"><td colSpan={3} className="px-5 py-4 font-black text-slate-700 text-sm uppercase tracking-wide">Total mensual estimado</td><td className="px-5 py-4 font-black text-indigo-700 text-lg">{(totalSalaries+totalExpenses).toLocaleString('es-ES',{style:'currency',currency:'EUR'})}</td><td/></tr></tfoot>}
            </table>
          </div>
        </div>
      )}

      {/* TAB Notas */}
      {activeTab==='notes'&&(
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-slate-800">Notas del Equipo</h2>
            <VoiceButton onResult={t=>{const n=notes+' '+t; setNotes(n); localStorage.setItem('personal_notes',n);}}/>
          </div>
          <textarea value={notes} onChange={e=>{setNotes(e.target.value);localStorage.setItem('personal_notes',e.target.value);}}
            className="w-full h-64 p-4 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
            placeholder="Notas sobre el equipo, avisos de turnos..."/>
          <div className="flex justify-end mt-3">
            <button onClick={()=>{const b=new Blob([notes],{type:'text/plain'});const u=URL.createObjectURL(b);const a=document.createElement('a');a.href=u;a.download='notas_personal.txt';a.click();}}
              className="flex items-center gap-2 text-indigo-600 hover:text-indigo-800 text-sm font-medium"><ExternalLink size={14}/> Exportar</button>
          </div>
        </div>
      )}

      {/* TAB Analítica */}
      {activeTab==='analytics'&&(
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h3 className="font-black text-slate-800 mb-4 flex items-center gap-2"><Calculator size={18} className="text-indigo-500"/> Coste de Personal</h3>
            <div className="space-y-3">
              {staff.map(p=>(
                <div key={p.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2"><div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-xs">{p.name.charAt(0)}</div><span className="text-sm font-medium text-slate-700">{p.name}</span></div>
                  <span className="text-sm font-bold text-indigo-700">{p.monthly_salary.toLocaleString('es-ES',{style:'currency',currency:'EUR'})}</span>
                </div>
              ))}
              <div className="border-t border-slate-200 pt-3 flex justify-between"><span className="font-black text-slate-700">Total salarios</span><span className="font-black text-emerald-700 text-lg">{totalSalaries.toLocaleString('es-ES',{style:'currency',currency:'EUR'})}</span></div>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h3 className="font-black text-slate-800 mb-4 flex items-center gap-2"><TrendingUp size={18} className="text-emerald-500"/> Resumen Costes</h3>
            <div className="space-y-3">
              {[{label:'Salarios mensuales',amount:totalSalaries,color:'text-indigo-600'},{label:'Otros gastos fijos',amount:totalExpenses,color:'text-amber-600'},{label:'Coste total estimado',amount:totalSalaries+totalExpenses,color:'text-emerald-700',bold:true}].map(item=>(
                <div key={item.label} className="flex justify-between items-center">
                  <span className={`text-sm ${item.bold?'font-black':'font-medium'} text-slate-700`}>{item.label}</span>
                  <span className={`text-sm ${item.bold?'font-black text-lg':'font-bold'} ${item.color}`}>{item.amount.toLocaleString('es-ES',{style:'currency',currency:'EUR'})}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {/* MODAL Añadir Empleado */}
      {showModal&&(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6"><h2 className="text-xl font-black text-slate-900">Nuevo Empleado</h2><button onClick={()=>setShowModal(false)} className="p-2 rounded-full hover:bg-slate-100"><X size={20}/></button></div>
            <div className="space-y-4">
              <div className="flex gap-2">
                <div className="flex-1"><label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Nombre *</label><input type="text" value={newStaff.name} onChange={e=>setNewStaff({...newStaff,name:e.target.value})} className="w-full mt-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" placeholder="Nombre completo"/></div>
                <div className="mt-6"><VoiceButton onResult={t=>setNewStaff({...newStaff,name:t})}/></div>
              </div>
              {([{label:'DNI/NIE',key:'dni',type:'text',ph:'12345678A'},{label:'Email',key:'email',type:'email',ph:'empleado@email.com'},{label:'Teléfono',key:'phone',type:'tel',ph:'+34 600 000 000'},{label:'Salario mensual (€)',key:'monthly_salary',type:'number',ph:'1800'},{label:'Horas contrato/sem',key:'contract_hours',type:'number',ph:'40'}] as const).map(f=>(
                <div key={f.key}><label className="text-xs font-bold text-slate-500 uppercase tracking-wide">{f.label}</label><input type={f.type} value={(newStaff as any)[f.key]} onChange={e=>setNewStaff({...newStaff,[f.key]:f.type==='number'?parseFloat(e.target.value)||0:e.target.value})} className="w-full mt-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" placeholder={f.ph}/></div>
              ))}
              <div><label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Rol</label><select value={newStaff.role} onChange={e=>setNewStaff({...newStaff,role:e.target.value})} className="w-full mt-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white">{ROLES.map(r=><option key={r}>{r}</option>)}</select></div>
              <div><label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Tipo contrato</label><select value={newStaff.contract_type} onChange={e=>setNewStaff({...newStaff,contract_type:e.target.value})} className="w-full mt-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white">{CONTRACT_TYPES.map(c=><option key={c}>{c}</option>)}</select></div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={()=>setShowModal(false)} className="flex-1 py-3 border border-slate-200 rounded-xl text-sm font-medium hover:bg-slate-50">Cancelar</button>
              <button onClick={handleAddStaff} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700">Añadir Empleado</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL Gasto Fijo */}
      {showExpenseModal&&(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-md">
            <div className="flex items-center justify-between mb-6"><h2 className="text-xl font-black text-slate-900">Nuevo Gasto Fijo</h2><button onClick={()=>setShowExpenseModal(false)} className="p-2 rounded-full hover:bg-slate-100"><X size={20}/></button></div>
            <div className="space-y-4">
              <div><label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Concepto *</label><input type="text" value={newExpense.name} onChange={e=>setNewExpense({...newExpense,name:e.target.value})} className="w-full mt-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" placeholder="Ej: Alquiler local"/></div>
              <div><label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Categoría</label><select value={newExpense.category} onChange={e=>setNewExpense({...newExpense,category:e.target.value})} className="w-full mt-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white">{EXPENSE_CATS.map(c=><option key={c}>{c}</option>)}</select></div>
              <div><label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Frecuencia</label><select value={newExpense.frequency} onChange={e=>setNewExpense({...newExpense,frequency:e.target.value})} className="w-full mt-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white">{['Mensual','Trimestral','Anual'].map(f=><option key={f}>{f}</option>)}</select></div>
              <div><label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Importe (€)</label><input type="number" value={newExpense.amount} onChange={e=>setNewExpense({...newExpense,amount:parseFloat(e.target.value)||0})} className="w-full mt-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" placeholder="0.00"/></div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={()=>setShowExpenseModal(false)} className="flex-1 py-3 border border-slate-200 rounded-xl text-sm font-medium hover:bg-slate-50">Cancelar</button>
              <button onClick={handleAddExpense} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700">Añadir Gasto</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL Vacaciones */}
      {showVacModal&&(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-md">
            <div className="flex items-center justify-between mb-6"><h2 className="text-xl font-black text-slate-900">Solicitud de Ausencia</h2><button onClick={()=>setShowVacModal(false)} className="p-2 rounded-full hover:bg-slate-100"><X size={20}/></button></div>
            <div className="space-y-4">
              <div><label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Empleado *</label><select value={newVac.staff_id} onChange={e=>setNewVac({...newVac,staff_id:e.target.value})} className="w-full mt-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"><option value="">Seleccionar...</option>{staff.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
              <div><label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Tipo</label><select value={newVac.type} onChange={e=>setNewVac({...newVac,type:e.target.value})} className="w-full mt-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white">{ABSENCE_TYPES.map(t=><option key={t}>{t}</option>)}</select></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Desde *</label><input type="date" value={newVac.start_date} onChange={e=>setNewVac({...newVac,start_date:e.target.value})} className="w-full mt-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"/></div>
                <div><label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Hasta *</label><input type="date" value={newVac.end_date} onChange={e=>setNewVac({...newVac,end_date:e.target.value})} className="w-full mt-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"/></div>
              </div>
              <div><label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Notas</label><input type="text" value={newVac.notes} onChange={e=>setNewVac({...newVac,notes:e.target.value})} className="w-full mt-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" placeholder="Opcional..."/></div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={()=>setShowVacModal(false)} className="flex-1 py-3 border border-slate-200 rounded-xl text-sm font-medium hover:bg-slate-50">Cancelar</button>
              <button onClick={handleAddVacation} className="flex-1 py-3 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700">Registrar Solicitud</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
