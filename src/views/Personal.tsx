// src/views/Personal.tsx
// ✅ 100% Supabase — sin Firebase, sin datos hardcoded
// ✅ FICHAJE: cualquier empleado registra entrada/salida con un tap + reloj en tiempo real
// ✅ Horas reales calculadas automáticamente en Supabase (columnas GENERATED)
// ✅ Voz en todos los campos, toast notifications, modales Gen Z
// ✅ Vacaciones (solicitar + aprobar/rechazar), turnos, gastos fijos, analítica IA
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Users, Clock, Calendar, Plus, Mic, MicOff, Loader2,
  X, Check, AlertTriangle, CheckCircle2, Trash2, Search,
  TrendingUp, Brain, DollarSign, Plane, Edit2, LogIn, LogOut,
  Timer, ChevronDown, ChevronUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../supabase';
import { useSupabase } from '../context/SupabaseContext';
import { GoogleGenAI } from '@google/genai';
import { cn } from '../lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────
interface StaffProfile {
  id: string; name: string; role: string; dni?: string; email?: string;
  phone?: string; contract_type?: string; monthly_salary?: number;
  contract_hours?: number; hourly_rate?: number; status: string;
  photo_url?: string; notes?: string; hire_date?: string;
}
interface TimeEntry {
  id: string; staff_id: string; date: string; clock_in: string;
  clock_out?: string; worked_minutes?: number; net_minutes?: number;
  break_minutes: number; notes?: string;
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
type TabId = 'fichaje' | 'equipo' | 'turnos' | 'vacaciones' | 'gastos' | 'analitica';

// ─── Constants ────────────────────────────────────────────────────────────────
const ROLES = ['Cocinero', 'Camarero', 'Maitre', 'Encargado', 'Limpieza', 'Otro'];
const SHIFTS = ['Mañana', 'Tarde', 'Noche', 'Partido', 'Libre'];
const ROLE_COLOR: Record<string, string> = {
  'Cocinero':  'bg-orange-50 text-orange-700 border-orange-200',
  'Camarero':  'bg-blue-50 text-blue-700 border-blue-200',
  'Maitre':    'bg-purple-50 text-purple-700 border-purple-200',
  'Encargado': 'bg-indigo-50 text-indigo-700 border-indigo-200',
  'Limpieza':  'bg-green-50 text-green-700 border-green-200',
  'Otro':      'bg-slate-50 text-slate-600 border-slate-200',
};
const SHIFT_COLOR: Record<string, string> = {
  'Mañana': 'bg-amber-50 text-amber-700',
  'Tarde':  'bg-orange-50 text-orange-700',
  'Noche':  'bg-indigo-50 text-indigo-700',
  'Partido':'bg-purple-50 text-purple-700',
  'Libre':  'bg-slate-100 text-slate-500',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const aiRef = { current: null as GoogleGenAI | null };
function getAI() {
  if (!aiRef.current) aiRef.current = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || '' });
  return aiRef.current;
}
function uid() { return Math.random().toString(36).slice(2, 10); }
function fmtEur(n: number) { return n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' }); }
function fmtTime(ts: string) { return new Date(ts).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }); }
function fmtDate(d: string) {
  if (!d) return '—';
  return new Date(d + (d.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtMinutes(min?: number) {
  if (min == null) return '—';
  const h = Math.floor(min / 60); const m = min % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
function today() { return new Date().toISOString().split('T')[0]; }

// ─── Toast ────────────────────────────────────────────────────────────────────
function useToast() {
  const [toasts, setToasts] = useState<{ id: string; msg: string; type: 'ok' | 'err' | 'warn' }[]>([]);
  const show = useCallback((msg: string, type: 'ok' | 'err' | 'warn' = 'ok') => {
    const id = uid();
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000);
  }, []);
  const ToastContainer = () => (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[500] flex flex-col gap-2 items-center pointer-events-none">
      <AnimatePresence>
        {toasts.map(t => (
          <motion.div key={t.id}
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.9 }}
            className={cn(
              'px-5 py-3 rounded-2xl text-sm font-bold shadow-2xl flex items-center gap-2 max-w-sm',
              t.type === 'ok'   ? 'bg-slate-900 text-white' :
              t.type === 'warn' ? 'bg-amber-500 text-white' : 'bg-rose-500 text-white'
            )}>
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
function VoiceButton({ onResult, small, className = '' }: {
  onResult: (t: string) => void; small?: boolean; className?: string;
}) {
  const [on, setOn] = useState(false);
  const ref = useRef<SpeechRecognition | null>(null);
  const sz = small ? 14 : 16;
  const toggle = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert('Necesitas Chrome para el microfono'); return; }
    if (on) { ref.current?.stop(); setOn(false); return; }
    const r = new SR(); ref.current = r;
    r.lang = 'es-ES'; r.continuous = false; r.interimResults = false;
    r.onstart  = () => setOn(true);
    r.onresult = (e: SpeechRecognitionEvent) => onResult(e.results[0][0].transcript);
    r.onerror  = r.onend = () => setOn(false);
    r.start();
  };
  return (
    <button type="button" onClick={toggle}
      className={cn(
        `${small ? 'p-1.5' : 'p-2.5'} rounded-xl transition-all shrink-0`,
        on ? 'bg-rose-500 text-white animate-pulse shadow-lg shadow-rose-200'
           : 'bg-slate-100 text-slate-500 hover:bg-slate-200',
        className
      )} title={on ? 'Parar' : 'Dictar'}>
      {on ? <MicOff size={sz} /> : <Mic size={sz} />}
    </button>
  );
}

function VoiceField({ value, onChange, placeholder, type = 'text' }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm
                   focus:outline-none focus:ring-2 focus:ring-indigo-300" />
      <VoiceButton onResult={onChange} small />
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// FICHAJE TAB
// ════════════════════════════════════════════════════════════════════════════
function FichajeTab({ staff, toast }: {
  staff: StaffProfile[];
  toast: (m: string, t?: 'ok' | 'err' | 'warn') => void;
}) {
  const [entries, setEntries]         = useState<TimeEntry[]>([]);
  const [loading, setLoading]         = useState(true);
  const [ticking, setTicking]         = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [now, setNow]                 = useState(new Date());

  // Reloj en tiempo real
  useEffect(() => {
    const iv = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(iv);
  }, []);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('time_entries')
      .select('*')
      .gte('date', today())
      .order('clock_in', { ascending: false });
    setEntries((data || []) as TimeEntry[]);
    setLoading(false);
  }, []);

  useEffect(() => { loadEntries(); }, [loadEntries]);

  const activeEntries = useMemo(() => entries.filter(e => !e.clock_out), [entries]);
  const isActive  = (id: string) => activeEntries.some(e => e.staff_id === id);
  const getActive = (id: string) => activeEntries.find(e => e.staff_id === id);

  function elapsed(clockIn: string) {
    const mins = Math.floor((now.getTime() - new Date(clockIn).getTime()) / 60000);
    return fmtMinutes(mins);
  }
  function horasHoy(staffId: string) {
    const total = entries
      .filter(e => e.staff_id === staffId && e.net_minutes)
      .reduce((s, e) => s + (e.net_minutes || 0), 0);
    return total > 0 ? fmtMinutes(total) : null;
  }

  async function handleClockIn(staffId: string) {
    if (isActive(staffId)) return;
    setTicking(staffId);
    try {
      const { error } = await supabase.from('time_entries').insert({
        staff_id:  staffId,
        date:      today(),
        clock_in:  new Date().toISOString(),
        device:    navigator.userAgent.includes('Mobile') ? 'mobile' : 'desktop',
      });
      if (error) throw error;
      const emp = staff.find(s => s.id === staffId);
      toast(`✅ ${emp?.name} — Entrada a las ${fmtTime(new Date().toISOString())}`);
      await loadEntries();
    } catch (err: any) {
      toast('Error al registrar entrada: ' + err.message, 'err');
    } finally { setTicking(null); }
  }

  async function handleClockOut(staffId: string) {
    const entry = getActive(staffId);
    if (!entry) return;
    setTicking(staffId);
    try {
      const clockOut = new Date().toISOString();
      const { error } = await supabase.from('time_entries')
        .update({ clock_out: clockOut })
        .eq('id', entry.id);
      if (error) throw error;
      const emp  = staff.find(s => s.id === staffId);
      const mins = Math.floor((new Date(clockOut).getTime() - new Date(entry.clock_in).getTime()) / 60000);
      toast(`👋 ${emp?.name} — Salida ${fmtTime(clockOut)} · ${fmtMinutes(mins)} trabajados`);
      await loadEntries();
    } catch (err: any) {
      toast('Error al registrar salida: ' + err.message, 'err');
    } finally { setTicking(null); }
  }

  const enTurno = staff.filter(s => isActive(s.id));
  const fuera   = staff.filter(s => !isActive(s.id));

  return (
    <div className="space-y-6">

      {/* Reloj grande */}
      <div className="bg-slate-900 rounded-3xl p-8 text-white text-center space-y-2">
        <p className="text-slate-400 text-sm font-bold uppercase tracking-widest">
          {now.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
        <p className="text-6xl font-black tabular-nums tracking-tight">
          {now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </p>
        <p className="text-slate-400 text-sm">
          {enTurno.length} empleado{enTurno.length !== 1 ? 's' : ''} en turno ahora
        </p>
      </div>

      {/* EN TURNO */}
      {enTurno.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-black uppercase tracking-widest text-emerald-600 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            En turno ahora ({enTurno.length})
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {enTurno.map(emp => {
              const entry = getActive(emp.id)!;
              const busy  = ticking === emp.id;
              return (
                <motion.div key={emp.id} layout
                  className="bg-emerald-50 border-2 border-emerald-200 rounded-3xl p-5 relative overflow-hidden">
                  <span className="absolute top-3 right-3 w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center text-xl font-black text-emerald-600 shrink-0">
                      {emp.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-black text-slate-900">{emp.name}</p>
                      <p className="text-xs text-slate-500">{emp.role}</p>
                    </div>
                  </div>
                  <div className="space-y-1 mb-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Entrada:</span>
                      <span className="font-bold text-slate-800">{fmtTime(entry.clock_in)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Tiempo:</span>
                      <span className="font-black text-emerald-700 text-base">{elapsed(entry.clock_in)}</span>
                    </div>
                  </div>
                  <button onClick={() => handleClockOut(emp.id)} disabled={busy}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-rose-600 text-white rounded-2xl
                               text-sm font-black hover:bg-rose-700 disabled:opacity-50 transition-all shadow-lg shadow-rose-200">
                    {busy ? <Loader2 size={16} className="animate-spin" /> : <LogOut size={16} />}
                    Registrar salida
                  </button>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* FUERA */}
      {fuera.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-slate-300" />
            Fuera del turno ({fuera.length})
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {fuera.map(emp => {
              const busy = ticking === emp.id;
              const hoy  = horasHoy(emp.id);
              return (
                <motion.div key={emp.id} layout
                  className="bg-white border border-slate-200 rounded-3xl p-5 hover:border-indigo-200 hover:shadow-md transition-all">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-xl font-black text-slate-500 shrink-0">
                      {emp.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-slate-900 truncate">{emp.name}</p>
                      <p className="text-xs text-slate-400">{emp.role}</p>
                    </div>
                    {hoy && (
                      <div className="text-right shrink-0">
                        <p className="text-[10px] text-slate-400 font-bold">Hoy</p>
                        <p className="text-sm font-black text-indigo-600">{hoy}</p>
                      </div>
                    )}
                  </div>
                  <button onClick={() => handleClockIn(emp.id)} disabled={busy}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 text-white rounded-2xl
                               text-sm font-black hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-lg shadow-indigo-200">
                    {busy ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
                    Registrar entrada
                  </button>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {staff.length === 0 && (
        <div className="text-center py-16 text-slate-400">
          <Users size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-bold">No hay empleados</p>
          <p className="text-sm mt-1">Ve a la pestana Equipo para añadir empleados</p>
        </div>
      )}

      {/* HISTORIAL DEL DÍA */}
      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
        <button onClick={() => setShowHistory(!showHistory)}
          className="w-full flex items-center justify-between p-5 hover:bg-slate-50 transition-all">
          <div className="flex items-center gap-3">
            <Timer size={18} className="text-slate-400" />
            <span className="font-black text-slate-800">Registros de hoy</span>
            <span className="text-xs font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-lg">
              {entries.length}
            </span>
          </div>
          {showHistory
            ? <ChevronUp size={18} className="text-slate-400" />
            : <ChevronDown size={18} className="text-slate-400" />}
        </button>
        <AnimatePresence>
          {showHistory && (
            <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
              className="overflow-hidden">
              <div className="border-t border-slate-100">
                {entries.length === 0
                  ? <p className="text-center text-slate-400 text-sm py-8">Sin registros hoy</p>
                  : (
                    <div className="divide-y divide-slate-50">
                      {entries.map(e => {
                        const emp = staff.find(s => s.id === e.staff_id);
                        return (
                          <div key={e.id} className="flex items-center gap-4 px-5 py-3">
                            <div className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center font-black text-slate-600 text-sm shrink-0">
                              {emp?.name?.charAt(0) || '?'}
                            </div>
                            <div className="flex-1">
                              <p className="font-bold text-slate-800 text-sm">{emp?.name || '—'}</p>
                              <p className="text-xs text-slate-400">
                                {fmtTime(e.clock_in)} →{' '}
                                {e.clock_out
                                  ? fmtTime(e.clock_out)
                                  : <span className="text-emerald-500 font-bold">En turno</span>
                                }
                              </p>
                            </div>
                            {e.net_minutes != null && (
                              <div className="text-right shrink-0">
                                <p className="font-black text-indigo-600">{fmtMinutes(e.net_minutes)}</p>
                                <p className="text-[10px] text-slate-400">neto</p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )
                }
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN VIEW
// ════════════════════════════════════════════════════════════════════════════
export default function PersonalView() {
  const { employee: authEmployee } = useSupabase();
  const isAdmin = (authEmployee as any)?.rol === 'admin';
  const { show: toast, ToastContainer } = useToast();

  const [activeTab, setActiveTab] = useState<TabId>('fichaje');
  const [staff,     setStaff]     = useState<StaffProfile[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [vacations, setVacations] = useState<Vacation[]>([]);
  const [expenses,  setExpenses]  = useState<FixedExpense[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult,  setAiResult]  = useState<string | null>(null);

  // ── Form states ──────────────────────────────────────────────────────────
  const [showStaffForm,    setShowStaffForm]    = useState(false);
  const [showVacForm,      setShowVacForm]      = useState(false);
  const [showExpenseForm,  setShowExpenseForm]  = useState(false);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [editStaff,   setEditStaff]   = useState<StaffProfile | null>(null);
  const [staffSaving, setStaffSaving] = useState(false);
  const [vacSaving,   setVacSaving]   = useState(false);
  const [expSaving,   setExpSaving]   = useState(false);
  const [schSaving,   setSchSaving]   = useState(false);

  const emptyStaff = () => ({
    name: '', role: 'Camarero', dni: '', email: '', phone: '',
    contract_type: 'Indefinido', monthly_salary: 1800,
    contract_hours: 40, status: 'Activo', notes: '', hire_date: '',
  });
  const emptyVac = () => ({ staff_id: '', start_date: '', end_date: '', type: 'Vacaciones', notes: '' });
  const emptyExp = () => ({ name: '', category: 'Personal', frequency: 'Mensual', amount: 0, notes: '' });
  const emptySch = () => ({ staff_id: '', date: today(), shift: 'Mañana', start_time: '', end_time: '', notes: '' });

  const [staffForm, setStaffForm] = useState(emptyStaff());
  const [vacForm,   setVacForm]   = useState(emptyVac());
  const [expForm,   setExpForm]   = useState(emptyExp());
  const [schForm,   setSchForm]   = useState(emptySch());

  // ── Load ──────────────────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    setLoading(true);
    const [s, sc, v, e] = await Promise.all([
      supabase.from('staff_profiles').select('*').order('name'),
      supabase.from('schedules').select('*').order('date', { ascending: false }).limit(100),
      supabase.from('vacations').select('*').order('created_at', { ascending: false }),
      supabase.from('fixed_expenses').select('*').eq('active', true).order('category'),
    ]);
    if (s.data)  setStaff(s.data as StaffProfile[]);
    if (sc.data) setSchedules(sc.data as Schedule[]);
    if (v.data)  setVacations(v.data as Vacation[]);
    if (e.data)  setExpenses(e.data as FixedExpense[]);
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── CRUD Empleados ────────────────────────────────────────────────────────
  async function saveStaff() {
    if (!staffForm.name.trim()) { toast('El nombre es obligatorio', 'err'); return; }
    setStaffSaving(true);
    try {
      const payload = {
        name: staffForm.name.trim(), role: staffForm.role,
        dni: staffForm.dni || null, email: staffForm.email || null,
        phone: staffForm.phone || null, contract_type: staffForm.contract_type,
        monthly_salary: Number(staffForm.monthly_salary),
        contract_hours: Number(staffForm.contract_hours),
        status: staffForm.status, notes: staffForm.notes || null,
        hire_date: staffForm.hire_date || null,
      };
      if (editStaff) {
        const { error } = await supabase.from('staff_profiles').update(payload).eq('id', editStaff.id);
        if (error) throw error;
        toast('Empleado actualizado ✓');
      } else {
        const { error } = await supabase.from('staff_profiles').insert(payload);
        if (error) throw error;
        toast('Empleado añadido ✓');
      }
      setShowStaffForm(false); setEditStaff(null); setStaffForm(emptyStaff()); await loadAll();
    } catch (err: any) { toast('Error: ' + err.message, 'err'); }
    finally { setStaffSaving(false); }
  }

  async function deleteStaff(id: string) {
    if (!confirm('Eliminar este empleado y todos sus datos?')) return;
    const { error } = await supabase.from('staff_profiles').delete().eq('id', id);
    if (error) { toast('Error al eliminar', 'err'); return; }
    toast('Empleado eliminado'); await loadAll();
  }

  // ── Vacaciones ─────────────────────────────────────────────────────────────
  async function saveVacation() {
    if (!vacForm.staff_id || !vacForm.start_date || !vacForm.end_date) {
      toast('Selecciona empleado, inicio y fin', 'err'); return;
    }
    setVacSaving(true);
    try {
      const { error } = await supabase.from('vacations').insert({
        ...vacForm, status: 'Solicitada', notes: vacForm.notes || null,
      });
      if (error) throw error;
      toast('Solicitud enviada ✓');
      setShowVacForm(false); setVacForm(emptyVac()); await loadAll();
    } catch (err: any) { toast('Error: ' + err.message, 'err'); }
    finally { setVacSaving(false); }
  }

  async function updateVacStatus(id: string, status: string) {
    const { error } = await supabase.from('vacations').update({ status }).eq('id', id);
    if (error) { toast('Error', 'err'); return; }
    setVacations(prev => prev.map(v => v.id === id ? { ...v, status } : v));
    toast(status === 'Aprobada' ? 'Aprobadas ✓' : 'Rechazadas');
  }

  // ── Gastos fijos ──────────────────────────────────────────────────────────
  async function saveExpense() {
    if (!expForm.name.trim()) { toast('El nombre es obligatorio', 'err'); return; }
    setExpSaving(true);
    try {
      const { error } = await supabase.from('fixed_expenses').insert({
        ...expForm, active: true, amount: Number(expForm.amount),
      });
      if (error) throw error;
      toast('Gasto añadido ✓');
      setShowExpenseForm(false); setExpForm(emptyExp()); await loadAll();
    } catch (err: any) { toast('Error: ' + err.message, 'err'); }
    finally { setExpSaving(false); }
  }

  async function deleteExpense(id: string) {
    const { error } = await supabase.from('fixed_expenses').update({ active: false }).eq('id', id);
    if (error) { toast('Error', 'err'); return; }
    setExpenses(prev => prev.filter(e => e.id !== id)); toast('Gasto eliminado');
  }

  // ── Turnos ────────────────────────────────────────────────────────────────
  async function saveSchedule() {
    if (!schForm.staff_id || !schForm.date) { toast('Selecciona empleado y fecha', 'err'); return; }
    setSchSaving(true);
    try {
      const { error } = await supabase.from('schedules').insert({
        staff_id: schForm.staff_id, date: schForm.date, shift: schForm.shift,
        start_time: schForm.start_time || null, end_time: schForm.end_time || null,
        notes: schForm.notes || null,
      });
      if (error) throw error;
      toast('Turno añadido ✓');
      setShowScheduleForm(false); setSchForm(emptySch()); await loadAll();
    } catch (err: any) { toast('Error: ' + err.message, 'err'); }
    finally { setSchSaving(false); }
  }

  // ── IA ────────────────────────────────────────────────────────────────────
  async function handleAIAnalysis() {
    setAiLoading(true); setAiResult(null);
    try {
      const staffSummary = staff
        .map(s => `${s.name} (${s.role}, ${s.status}, ${s.contract_hours}h/sem, ${fmtEur(s.monthly_salary || 0)}/mes)`)
        .join('\n');
      const vacSummary = vacations
        .filter(v => v.status === 'Aprobada').slice(0, 10)
        .map(v => { const e = staff.find(s => s.id === v.staff_id); return `${e?.name}: ${v.start_date} → ${v.end_date}`; })
        .join('\n');
      const costeMensual = expenses
        .filter(e => e.frequency === 'Mensual').reduce((s, e) => s + e.amount, 0);

      const res = await getAI().models.generateContent({
        model: 'gemini-2.0-flash',
        contents: [{
          role: 'user', parts: [{
            text: `Eres responsable RRHH de un restaurante. Analiza y da 4-5 recomendaciones accionables.

EQUIPO (${staff.length} empleados):
${staffSummary}

VACACIONES APROBADAS:
${vacSummary || 'Ninguna'}

COSTES FIJOS MENSUALES: ${fmtEur(costeMensual)}

Bullet points directos en español, max 2 lineas cada uno.`
          }]
        }]
      });
      setAiResult(res.candidates?.[0]?.content?.parts?.[0]?.text || 'Sin respuesta');
    } catch (err: any) {
      setAiResult('Error IA: ' + err.message);
    } finally { setAiLoading(false); }
  }

  // ── Stats ─────────────────────────────────────────────────────────────────
  const vacPendientes   = vacations.filter(v => v.status === 'Solicitada').length;
  const vacActivasCount = vacations.filter(v =>
    v.status === 'Aprobada' && v.start_date <= today() && v.end_date >= today()
  ).length;
  const costePersonalMes = expenses
    .filter(e => e.category === 'Personal' && e.frequency === 'Mensual')
    .reduce((s, e) => s + e.amount, 0);
  const filteredStaff = staff.filter(s =>
    !search || s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.role.toLowerCase().includes(search.toLowerCase())
  );

  const TABS: { id: TabId; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'fichaje',    label: 'Fichaje',   icon: <Clock size={15} /> },
    { id: 'equipo',     label: 'Equipo',    icon: <Users size={15} /> },
    { id: 'turnos',     label: 'Turnos',    icon: <Calendar size={15} /> },
    { id: 'vacaciones', label: 'Ausencias', icon: <Plane size={15} />, badge: vacPendientes },
    { id: 'gastos',     label: 'Gastos',    icon: <DollarSign size={15} /> },
    { id: 'analitica',  label: 'IA',        icon: <Brain size={15} /> },
  ];

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#F8FAFC] p-4 md:p-8 space-y-6">
      <ToastContainer />

      {/* ── Header ── */}
      <header className="sticky top-4 z-[100] bg-white/80 backdrop-blur-xl border border-white/20
                         shadow-xl rounded-[2.5rem] p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-2xl shadow-lg">
            <Users className="w-5 h-5 text-indigo-400" />
            <span className="font-black text-sm tracking-tighter uppercase">Personal</span>
          </div>
          {vacPendientes > 0 && (
            <span className="flex items-center gap-1 text-xs font-bold text-amber-700
                             bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl">
              <AlertTriangle size={12} />
              {vacPendientes} solicitud{vacPendientes > 1 ? 'es' : ''} pendiente{vacPendientes > 1 ? 's' : ''}
            </span>
          )}
        </div>
        {isAdmin && activeTab === 'equipo' && (
          <button
            onClick={() => { setStaffForm(emptyStaff()); setEditStaff(null); setShowStaffForm(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-2xl
                       text-xs font-bold hover:bg-indigo-700 transition-all shadow-sm shadow-indigo-200">
            <Plus size={14} /> Nuevo empleado
          </button>
        )}
      </header>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total empleados',    value: staff.length,      icon: <Users size={16} className="text-indigo-400" />,  color: 'text-slate-900' },
          { label: 'Vacaciones activas', value: vacActivasCount,   icon: <Plane size={16} className="text-blue-400" />,    color: 'text-slate-900' },
          { label: 'Solicitudes pend.',  value: vacPendientes,     icon: <AlertTriangle size={16} className={vacPendientes > 0 ? 'text-amber-400' : 'text-slate-300'} />, color: vacPendientes > 0 ? 'text-amber-600' : 'text-slate-900' },
          { label: 'Coste personal/mes', value: fmtEur(costePersonalMes), icon: <DollarSign size={16} className="text-emerald-400" />, color: 'text-slate-900' },
        ].map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{s.label}</span>
              {s.icon}
            </div>
            <p className={cn('text-2xl font-black', s.color)}>{s.value}</p>
          </motion.div>
        ))}
      </div>

      {/* ── Tabs ── */}
      <div className="flex bg-white border border-slate-200 rounded-2xl p-1 gap-1 shadow-sm overflow-x-auto">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap relative',
              activeTab === t.id ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-800'
            )}>
            {t.icon} {t.label}
            {t.badge != null && t.badge > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white
                               text-[9px] font-black rounded-full flex items-center justify-center">
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ══════════════════ FICHAJE ══════════════════ */}
      {activeTab === 'fichaje' && (
        loading
          ? <div className="flex justify-center py-20"><Loader2 size={32} className="animate-spin text-indigo-400" /></div>
          : <FichajeTab staff={staff} toast={toast} />
      )}

      {/* ══════════════════ EQUIPO ══════════════════ */}
      {activeTab === 'equipo' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-2xl px-4 py-2.5 shadow-sm">
            <Search size={16} className="text-slate-400 shrink-0" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar empleado..."
              className="flex-1 text-sm bg-transparent outline-none placeholder:text-slate-400" />
            <VoiceButton onResult={setSearch} small />
          </div>

          {loading
            ? <div className="flex justify-center py-20"><Loader2 size={32} className="animate-spin text-indigo-400" /></div>
            : filteredStaff.length === 0
              ? <div className="text-center py-20">
                  <Users size={40} className="mx-auto text-slate-200 mb-4" />
                  <p className="text-slate-400 font-medium">Sin empleados{search ? ` con "${search}"` : ''}</p>
                </div>
              : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredStaff.map(emp => (
                    <motion.div key={emp.id} layout
                      className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-all group">
                      <div className="flex items-start gap-4 mb-4">
                        <div className="w-14 h-14 bg-gradient-to-br from-indigo-100 to-slate-100 rounded-2xl
                                        flex items-center justify-center text-2xl font-black text-indigo-600 shrink-0">
                          {emp.name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-black text-slate-900 truncate">{emp.name}</h3>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className={cn('text-[10px] font-black px-2 py-0.5 rounded-lg border',
                              ROLE_COLOR[emp.role] || ROLE_COLOR['Otro'])}>
                              {emp.role}
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-slate-100 text-slate-600">
                              {emp.status}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <div className="bg-slate-50 rounded-xl px-3 py-2">
                          <p className="text-[10px] text-slate-400 font-bold">Contrato</p>
                          <p className="text-xs font-bold text-slate-700">{emp.contract_type || '—'}</p>
                        </div>
                        <div className="bg-slate-50 rounded-xl px-3 py-2">
                          <p className="text-[10px] text-slate-400 font-bold">Salario</p>
                          <p className="text-xs font-bold text-slate-700">
                            {emp.monthly_salary ? fmtEur(emp.monthly_salary) : '—'}
                          </p>
                        </div>
                      </div>
                      {emp.phone && (
                        <p className="text-xs text-slate-400 mb-3">{emp.phone}</p>
                      )}
                      {isAdmin && (
                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                          <button
                            onClick={() => {
                              setStaffForm({
                                name: emp.name, role: emp.role, dni: emp.dni || '',
                                email: emp.email || '', phone: emp.phone || '',
                                contract_type: emp.contract_type || 'Indefinido',
                                monthly_salary: emp.monthly_salary || 0,
                                contract_hours: emp.contract_hours || 40,
                                status: emp.status, notes: emp.notes || '',
                                hire_date: emp.hire_date || '',
                              });
                              setEditStaff(emp); setShowStaffForm(true);
                            }}
                            className="flex-1 flex items-center justify-center gap-1 py-2 bg-slate-100
                                       text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-200 transition-all">
                            <Edit2 size={12} /> Editar
                          </button>
                          <button onClick={() => deleteStaff(emp.id)}
                            className="p-2 rounded-xl bg-rose-50 text-rose-500 hover:bg-rose-100 transition-all">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              )
          }
        </div>
      )}

      {/* ══════════════════ TURNOS ══════════════════ */}
      {activeTab === 'turnos' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <p className="text-sm text-slate-500 font-medium">{schedules.length} turnos registrados</p>
            {isAdmin && (
              <button onClick={() => { setSchForm(emptySch()); setShowScheduleForm(true); }}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-2xl
                           text-xs font-bold hover:bg-indigo-700 transition-all shadow-sm">
                <Plus size={13} /> Añadir turno
              </button>
            )}
          </div>
          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                    {['Empleado', 'Fecha', 'Turno', 'Entrada', 'Salida'].map(h => (
                      <th key={h} className="px-5 py-3 text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {schedules.slice(0, 60).map(sc => {
                    const emp = staff.find(s => s.id === sc.staff_id);
                    return (
                      <tr key={sc.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-5 py-3 font-medium text-slate-800">{emp?.name || '—'}</td>
                        <td className="px-5 py-3 text-slate-600">{fmtDate(sc.date)}</td>
                        <td className="px-5 py-3">
                          <span className={cn('text-xs font-bold px-2.5 py-1 rounded-xl',
                            SHIFT_COLOR[sc.shift] || 'bg-slate-100 text-slate-500')}>
                            {sc.shift}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-slate-500">{sc.start_time || '—'}</td>
                        <td className="px-5 py-3 text-slate-500">{sc.end_time || '—'}</td>
                      </tr>
                    );
                  })}
                  {schedules.length === 0 && (
                    <tr><td colSpan={5} className="px-5 py-16 text-center text-slate-400">
                      <Calendar size={40} className="mx-auto mb-3 opacity-30" />
                      <p>Sin turnos registrados</p>
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════ VACACIONES ══════════════════ */}
      {activeTab === 'vacaciones' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <p className="text-sm text-slate-500 font-medium">{vacations.length} solicitudes</p>
            <button onClick={() => { setVacForm(emptyVac()); setShowVacForm(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-2xl
                         text-xs font-bold hover:bg-blue-700 transition-all shadow-sm">
              <Plus size={13} /> Solicitar ausencia
            </button>
          </div>
          {vacations.length === 0
            ? <div className="text-center py-20">
                <Plane size={40} className="mx-auto text-slate-200 mb-4" />
                <p className="text-slate-400 font-medium">Sin solicitudes registradas</p>
              </div>
            : (
              <div className="space-y-3">
                {vacations.map(v => {
                  const emp  = staff.find(s => s.id === v.staff_id);
                  const days = Math.ceil(
                    (new Date(v.end_date + 'T00:00:00').getTime() -
                     new Date(v.start_date + 'T00:00:00').getTime()) / 86400000
                  ) + 1;
                  return (
                    <div key={v.id}
                      className={cn(
                        'bg-white border rounded-3xl p-5 shadow-sm flex items-center gap-4 flex-wrap',
                        v.status === 'Solicitada' ? 'border-amber-200' :
                        v.status === 'Aprobada'   ? 'border-emerald-200' : 'border-slate-200'
                      )}>
                      <div className="w-11 h-11 bg-blue-50 rounded-2xl flex items-center justify-center shrink-0">
                        <Plane size={18} className="text-blue-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-slate-900">{emp?.name || '—'}</p>
                        <p className="text-xs text-slate-500">
                          {v.type} · {fmtDate(v.start_date)} → {fmtDate(v.end_date)} ·{' '}
                          <strong>{days} día{days > 1 ? 's' : ''}</strong>
                        </p>
                        {v.notes && <p className="text-xs text-slate-400 italic mt-0.5">{v.notes}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={cn('text-xs font-black px-3 py-1 rounded-xl',
                          v.status === 'Aprobada'  ? 'bg-emerald-50 text-emerald-600' :
                          v.status === 'Rechazada' ? 'bg-rose-50 text-rose-600' :
                                                     'bg-amber-50 text-amber-600'
                        )}>{v.status}</span>
                        {isAdmin && v.status === 'Solicitada' && (
                          <>
                            <button onClick={() => updateVacStatus(v.id, 'Aprobada')}
                              className="p-2 rounded-xl bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-all"
                              title="Aprobar">
                              <Check size={14} />
                            </button>
                            <button onClick={() => updateVacStatus(v.id, 'Rechazada')}
                              className="p-2 rounded-xl bg-rose-50 text-rose-500 hover:bg-rose-100 transition-all"
                              title="Rechazar">
                              <X size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          }
        </div>
      )}

      {/* ══════════════════ GASTOS FIJOS ══════════════════ */}
      {activeTab === 'gastos' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-sm text-slate-500 font-medium">{expenses.length} gastos activos</p>
              <p className="text-xs text-slate-400">
                Total mensual:{' '}
                <strong className="text-slate-700">
                  {fmtEur(expenses.filter(e => e.frequency === 'Mensual').reduce((s, e) => s + e.amount, 0))}
                </strong>
              </p>
            </div>
            {isAdmin && (
              <button onClick={() => { setExpForm(emptyExp()); setShowExpenseForm(true); }}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-2xl
                           text-xs font-bold hover:bg-indigo-700 transition-all shadow-sm">
                <Plus size={13} /> Añadir gasto
              </button>
            )}
          </div>
          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                    {['Concepto', 'Categoría', 'Frecuencia', 'Importe', ''].map(h => (
                      <th key={h} className="px-5 py-3 text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {expenses.map(e => (
                    <tr key={e.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-3 font-medium text-slate-800">{e.name}</td>
                      <td className="px-5 py-3">
                        <span className="text-xs font-bold px-2.5 py-1 rounded-xl bg-slate-100 text-slate-600">
                          {e.category}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-slate-500">{e.frequency}</td>
                      <td className="px-5 py-3 font-black text-slate-900">{fmtEur(e.amount)}</td>
                      <td className="px-5 py-3">
                        {isAdmin && (
                          <button onClick={() => deleteExpense(e.id)}
                            className="p-1.5 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-all">
                            <Trash2 size={13} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {expenses.length === 0 && (
                    <tr><td colSpan={5} className="px-5 py-16 text-center text-slate-400">
                      Sin gastos registrados
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════ ANALÍTICA IA ══════════════════ */}
      {activeTab === 'analitica' && (
        <div className="space-y-5">
          <button onClick={handleAIAnalysis} disabled={aiLoading}
            className="w-full flex items-center justify-center gap-3 py-4 bg-indigo-600 text-white
                       rounded-2xl font-black hover:bg-indigo-700 disabled:opacity-50 transition-all
                       shadow-lg shadow-indigo-200">
            {aiLoading
              ? <><Loader2 size={20} className="animate-spin" /> Analizando equipo...</>
              : <><Brain size={20} /> Analizar equipo con IA</>
            }
          </button>

          {aiResult && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="bg-indigo-50 border border-indigo-100 rounded-3xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 bg-indigo-100 rounded-2xl flex items-center justify-center">
                  <Brain size={18} className="text-indigo-600" />
                </div>
                <p className="font-black text-indigo-900">Análisis del equipo</p>
              </div>
              <pre className="text-sm text-indigo-800 whitespace-pre-wrap font-sans leading-relaxed">
                {aiResult}
              </pre>
            </motion.div>
          )}

          {/* Resumen coste personal */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
            <h3 className="font-black text-slate-900">Desglose coste personal</h3>
            <div className="space-y-3">
              {staff.filter(s => s.monthly_salary && s.monthly_salary > 0).map(emp => (
                <div key={emp.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-slate-100 rounded-xl flex items-center justify-center
                                    text-sm font-black text-slate-600">
                      {emp.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800">{emp.name}</p>
                      <p className="text-xs text-slate-400">{emp.role} · {emp.contract_hours}h/sem</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-slate-900">{fmtEur(emp.monthly_salary || 0)}</p>
                    <p className="text-xs text-slate-400">/mes</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-slate-100 pt-3 flex items-center justify-between">
              <p className="font-black text-slate-900">Total personal/mes</p>
              <p className="text-xl font-black text-indigo-600">{fmtEur(costePersonalMes)}</p>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          MODALES
      ════════════════════════════════════════════════════════════════════ */}

      {/* Modal Empleado */}
      <AnimatePresence>
        {showStaffForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center p-4
                       bg-slate-900/60 backdrop-blur-sm">
            <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
              className="bg-white w-full max-w-lg rounded-[2.5rem] flex flex-col max-h-[92vh] overflow-hidden shadow-2xl">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between shrink-0">
                <h2 className="text-xl font-black">{editStaff ? 'Editar empleado' : 'Nuevo empleado'}</h2>
                <button onClick={() => { setShowStaffForm(false); setEditStaff(null); }}
                  className="p-2 rounded-xl hover:bg-slate-100 transition-all"><X size={20} /></button>
              </div>
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400">Nombre *</label>
                  <VoiceField value={staffForm.name} onChange={v => setStaffForm(f => ({ ...f, name: v }))} placeholder="Nombre completo" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Rol</label>
                    <select value={staffForm.role} onChange={e => setStaffForm(f => ({ ...f, role: e.target.value }))}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
                      {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Estado</label>
                    <select value={staffForm.status} onChange={e => setStaffForm(f => ({ ...f, status: e.target.value }))}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
                      {['Activo', 'En turno', 'Descanso', 'Vacaciones', 'Baja'].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">DNI / NIE</label>
                    <VoiceField value={staffForm.dni} onChange={v => setStaffForm(f => ({ ...f, dni: v }))} placeholder="12345678A" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Teléfono</label>
                    <VoiceField value={staffForm.phone} onChange={v => setStaffForm(f => ({ ...f, phone: v }))} placeholder="+34 600 000 000" type="tel" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400">Email</label>
                  <VoiceField value={staffForm.email} onChange={v => setStaffForm(f => ({ ...f, email: v }))} placeholder="empleado@raco.com" type="email" />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Contrato</label>
                    <select value={staffForm.contract_type} onChange={e => setStaffForm(f => ({ ...f, contract_type: e.target.value }))}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
                      {['Indefinido', 'Temporal', 'Prácticas', 'Parcial'].map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Salario/mes €</label>
                    <input type="number" min="0" value={staffForm.monthly_salary}
                      onChange={e => setStaffForm(f => ({ ...f, monthly_salary: Number(e.target.value) }))}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 text-right" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">H/semana</label>
                    <input type="number" min="1" max="60" value={staffForm.contract_hours}
                      onChange={e => setStaffForm(f => ({ ...f, contract_hours: Number(e.target.value) }))}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 text-right" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400">Fecha contratación</label>
                  <input type="date" value={staffForm.hire_date}
                    onChange={e => setStaffForm(f => ({ ...f, hire_date: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400">Notas</label>
                  <div className="flex items-start gap-2">
                    <textarea value={staffForm.notes} onChange={e => setStaffForm(f => ({ ...f, notes: e.target.value }))}
                      placeholder="Preferencias de turno, observaciones..." rows={2}
                      className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                    <VoiceButton onResult={v => setStaffForm(f => ({ ...f, notes: v }))} small className="mt-1" />
                  </div>
                </div>
              </div>
              <div className="p-6 border-t border-slate-100 flex gap-3 shrink-0">
                <button onClick={() => { setShowStaffForm(false); setEditStaff(null); }}
                  className="flex-1 py-3 border border-slate-200 rounded-2xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all">
                  Cancelar
                </button>
                <button onClick={saveStaff} disabled={staffSaving}
                  className="flex-1 py-3 bg-indigo-600 text-white rounded-2xl text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-200">
                  {staffSaving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                  {editStaff ? 'Actualizar' : 'Guardar'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal Vacaciones */}
      <AnimatePresence>
        {showVacForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
              className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-xl font-black">Solicitar ausencia</h2>
                <button onClick={() => setShowVacForm(false)} className="p-2 rounded-xl hover:bg-slate-100 transition-all"><X size={20} /></button>
              </div>
              <div className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400">Empleado *</label>
                  <select value={vacForm.staff_id} onChange={e => setVacForm(f => ({ ...f, staff_id: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                    <option value="">— Selecciona —</option>
                    {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400">Tipo</label>
                  <select value={vacForm.type} onChange={e => setVacForm(f => ({ ...f, type: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                    {['Vacaciones', 'Enfermedad', 'Asunto propio', 'Maternidad/Paternidad', 'Otro'].map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Desde *</label>
                    <input type="date" value={vacForm.start_date}
                      onChange={e => setVacForm(f => ({ ...f, start_date: e.target.value }))}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Hasta *</label>
                    <input type="date" value={vacForm.end_date}
                      onChange={e => setVacForm(f => ({ ...f, end_date: e.target.value }))}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400">Notas</label>
                  <VoiceField value={vacForm.notes} onChange={v => setVacForm(f => ({ ...f, notes: v }))} placeholder="Motivo, observaciones..." />
                </div>
              </div>
              <div className="p-6 border-t border-slate-100 flex gap-3">
                <button onClick={() => setShowVacForm(false)}
                  className="flex-1 py-3 border border-slate-200 rounded-2xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all">
                  Cancelar
                </button>
                <button onClick={saveVacation} disabled={vacSaving}
                  className="flex-1 py-3 bg-blue-600 text-white rounded-2xl text-sm font-bold hover:bg-blue-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-200">
                  {vacSaving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                  Enviar solicitud
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal Turno */}
      <AnimatePresence>
        {showScheduleForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
              className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-xl font-black">Añadir turno</h2>
                <button onClick={() => setShowScheduleForm(false)} className="p-2 rounded-xl hover:bg-slate-100 transition-all"><X size={20} /></button>
              </div>
              <div className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400">Empleado *</label>
                  <select value={schForm.staff_id} onChange={e => setSchForm(f => ({ ...f, staff_id: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
                    <option value="">— Selecciona —</option>
                    {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Fecha *</label>
                    <input type="date" value={schForm.date}
                      onChange={e => setSchForm(f => ({ ...f, date: e.target.value }))}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Turno</label>
                    <select value={schForm.shift} onChange={e => setSchForm(f => ({ ...f, shift: e.target.value }))}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
                      {SHIFTS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Hora entrada</label>
                    <input type="time" value={schForm.start_time}
                      onChange={e => setSchForm(f => ({ ...f, start_time: e.target.value }))}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Hora salida</label>
                    <input type="time" value={schForm.end_time}
                      onChange={e => setSchForm(f => ({ ...f, end_time: e.target.value }))}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                  </div>
                </div>
              </div>
              <div className="p-6 border-t border-slate-100 flex gap-3">
                <button onClick={() => setShowScheduleForm(false)}
                  className="flex-1 py-3 border border-slate-200 rounded-2xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all">
                  Cancelar
                </button>
                <button onClick={saveSchedule} disabled={schSaving}
                  className="flex-1 py-3 bg-indigo-600 text-white rounded-2xl text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-200">
                  {schSaving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                  Guardar turno
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal Gasto Fijo */}
      <AnimatePresence>
        {showExpenseForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
              className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-xl font-black">Nuevo gasto fijo</h2>
                <button onClick={() => setShowExpenseForm(false)} className="p-2 rounded-xl hover:bg-slate-100 transition-all"><X size={20} /></button>
              </div>
              <div className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400">Concepto *</label>
                  <VoiceField value={expForm.name} onChange={v => setExpForm(f => ({ ...f, name: v }))} placeholder="Ej: Alquiler local, Seguro..." />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Categoría</label>
                    <select value={expForm.category} onChange={e => setExpForm(f => ({ ...f, category: e.target.value }))}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
                      {['Personal', 'Alquiler', 'Suministros', 'Seguros', 'Otros'].map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Frecuencia</label>
                    <select value={expForm.frequency} onChange={e => setExpForm(f => ({ ...f, frequency: e.target.value }))}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
                      {['Mensual', 'Trimestral', 'Anual'].map(fr => (
                        <option key={fr} value={fr}>{fr}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400">Importe (€)</label>
                  <input type="number" min="0" step="0.01" value={expForm.amount}
                    onChange={e => setExpForm(f => ({ ...f, amount: Number(e.target.value) }))}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 text-right" />
                </div>
              </div>
              <div className="p-6 border-t border-slate-100 flex gap-3">
                <button onClick={() => setShowExpenseForm(false)}
                  className="flex-1 py-3 border border-slate-200 rounded-2xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all">
                  Cancelar
                </button>
                <button onClick={saveExpense} disabled={expSaving}
                  className="flex-1 py-3 bg-indigo-600 text-white rounded-2xl text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-200">
                  {expSaving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                  Guardar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
