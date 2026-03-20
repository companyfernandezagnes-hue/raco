import React from 'react';
import { 
  Plus, Calendar, Clock, UserPlus, MoreVertical, CheckCircle2, 
  AlertCircle, Plane, TrendingUp, Mail, CreditCard, FileText, 
  Shield, DollarSign, ExternalLink, Search, ChevronRight,
  User, Briefcase, MapPin, Phone, Filter, Zap, Brain, Calculator
} from 'lucide-react';
import { Employee, Schedule, Vacation, FixedExpense } from '../types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { mockEmployees, mockFixedExpenses } from '../data/mockData';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function PersonalView() {
  const [activeTab, setActiveTab] = React.useState<'list' | 'schedules' | 'vacations' | 'expenses' | 'notes' | 'checklists' | 'analytics'>('list');
  const [showOptimizer, setShowOptimizer] = React.useState(false);
  const [isOptimizing, setIsOptimizing] = React.useState(false);
  const [optimizationResult, setOptimizationResult] = React.useState<null | { message: string, suggestions: string[] }>(null);
  const [selectedEmployee, setSelectedEmployee] = React.useState<Employee | null>(null);
  const [notes, setNotes] = React.useState<string>(localStorage.getItem('personal_notes') || '');
  const [checklists, setChecklists] = React.useState<{id: string, task: string, completed: boolean, shift: string}[]>([
    { id: '1', task: 'Revisar cámaras de frío', completed: false, shift: 'Mañana' },
    { id: '2', task: 'Limpieza de plancha', completed: true, shift: 'Tarde' },
    { id: '3', task: 'Cierre de caja', completed: false, shift: 'Noche' },
  ]);

  const handleExportNotes = () => {
    const blob = new Blob([notes], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `notas_personal_${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleChecklist = (id: string) => {
    setChecklists(prev => prev.map(item => 
      item.id === id ? { ...item, completed: !item.completed } : item
    ));
  };

  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [isConnectingGoogle, setIsConnectingGoogle] = React.useState(false);

  const [newEmployee, setNewEmployee] = React.useState({
    name: '',
    dni: '',
    email: '',
    role: 'Cocinero',
    contractType: 'Indefinido',
    monthlySalary: 2200,
    contractHours: 40
  });

  const handleAddEmployee = () => {
    if (!newEmployee.name || !newEmployee.email) {
      alert('Por favor, rellena los campos obligatorios.');
      return;
    }

    const employee: Employee = {
      id: Math.random().toString(36).substr(2, 9),
      ...newEmployee,
      status: 'Descanso',
      img: `https://i.pravatar.cc/150?u=${Math.random()}`,
      hourlyRate: newEmployee.monthlySalary / (newEmployee.contractHours * 4),
      schedules: [],
      vacations: []
    };

    mockEmployees.unshift(employee);
    setIsModalOpen(false);
    setNewEmployee({
      name: '',
      dni: '',
      email: '',
      role: 'Cocinero',
      contractType: 'Indefinido',
      monthlySalary: 2200,
      contractHours: 40
    });
  };

  const handleOptimizeShifts = () => {
    setIsOptimizing(true);
    setOptimizationResult(null);
    setTimeout(() => {
      setIsOptimizing(false);
      setOptimizationResult({
        message: "Optimización completada basándose en la previsión de ventas de la próxima semana.",
        suggestions: [
          "Reforzar turno de Viernes Noche (+1 camarero)",
          "Reducir personal Lunes Mañana (-1 cocina)",
          "Ajustar horario de Maître el Sábado (entrada 30min antes)"
        ]
      });
    }, 2500);
  };
  const handleConnectGoogle = async () => {
    setIsConnectingGoogle(true);
    try {
      const { googleProvider, signInWithPopup, auth } = await import('../firebase');
      googleProvider.addScope('https://www.googleapis.com/auth/calendar.readonly');
      googleProvider.addScope('https://www.googleapis.com/auth/calendar.events');
      
      const result = await signInWithPopup(auth, googleProvider);
      const credential = (await import('firebase/auth')).GoogleAuthProvider.credentialFromResult(result);
      const token = credential?.accessToken;

      if (token) {
        // Fetch events to verify connection
        const response = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (response.ok) {
          alert('Sincronizado con Google Calendar correctamente. Ahora puedes importar tus eventos.');
        } else {
          throw new Error('Error al acceder a Google Calendar');
        }
      }
    } catch (error) {
      console.error('Error connecting to Google Calendar:', error);
      alert('Error al conectar con Google Calendar. Asegúrate de dar los permisos necesarios.');
    } finally {
      setIsConnectingGoogle(false);
    }
  };

  const calculateExtraHoursCost = (employee: Employee) => {
    const totalExtras = employee.schedules.reduce((acc, s) => acc + s.extraHours, 0);
    return totalExtras * employee.hourlyRate * 1.5;
  };

  const totalExtraHours = mockEmployees.reduce((acc, emp) => 
    acc + emp.schedules.reduce((sAcc, s) => sAcc + s.extraHours, 0), 0
  );

  const totalPersonalCost = mockEmployees.reduce((acc, emp) => acc + (emp.monthlySalary || 0), 0);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 flex items-center gap-3">
            <div className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100">
              <User size={24} />
            </div>
            Gestión de Personal
          </h1>
          <p className="text-slate-500 text-sm mt-1 font-medium">Control de horarios, nóminas, vacaciones y gastos fijos.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setShowOptimizer(true)}
            className="flex items-center gap-2 bg-amber-500 text-white px-5 py-3 rounded-2xl text-sm font-bold hover:bg-amber-600 transition-all shadow-lg shadow-amber-100"
          >
            <Zap size={18} />
            AI Shift Optimizer
          </button>
          <button 
            onClick={handleConnectGoogle}
            disabled={isConnectingGoogle}
            className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-5 py-3 rounded-2xl text-sm font-bold hover:bg-slate-50 transition-all shadow-sm disabled:opacity-50"
          >
            <Calendar size={18} className={cn(isConnectingGoogle && "animate-spin text-blue-500")} />
            {isConnectingGoogle ? "Sincronizando..." : "Google Calendar"}
          </button>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-3 rounded-2xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
          >
            <UserPlus size={18} />
            Añadir Empleado
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-8 bg-white rounded-[2.5rem] border border-slate-200 shadow-sm group hover:border-indigo-200 transition-all">
          <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
            <DollarSign size={28} />
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Coste Personal Mes</p>
          <p className="text-3xl font-black text-slate-900 mt-2">{totalPersonalCost.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</p>
          <div className="mt-4 flex items-center gap-2 text-xs text-emerald-600 font-black uppercase tracking-widest">
            <TrendingUp size={14} />
            -2.4% vs mes anterior
          </div>
        </div>
        <div className="p-8 bg-white rounded-[2.5rem] border border-slate-200 shadow-sm group hover:border-amber-200 transition-all">
          <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
            <Clock size={28} />
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Horas Extras Acum.</p>
          <p className="text-3xl font-black text-amber-600 mt-2">{totalExtraHours}h</p>
          <div className="mt-4 flex items-center gap-2 text-xs text-amber-600 font-black uppercase tracking-widest">
            <AlertCircle size={14} />
            8h sobre objetivo
          </div>
        </div>
        <div className="p-8 bg-white rounded-[2.5rem] border border-slate-200 shadow-sm group hover:border-emerald-200 transition-all">
          <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
            <CheckCircle2 size={28} />
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Personal en Turno</p>
          <p className="text-3xl font-black text-emerald-600 mt-2">8 / 12</p>
          <div className="mt-4 flex items-center gap-2 text-xs text-emerald-600 font-black uppercase tracking-widest">
            <CheckCircle2 size={14} />
            Cobertura completa
          </div>
        </div>
      </div>

      <div className="flex gap-1.5 p-1.5 bg-slate-100 rounded-2xl w-fit overflow-x-auto">
        {(['list', 'schedules', 'vacations', 'expenses', 'notes', 'checklists', 'analytics'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "px-6 py-2.5 rounded-xl text-[10px] font-black transition-all uppercase tracking-widest whitespace-nowrap",
              activeTab === tab ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}
          >
            {tab === 'list' ? 'Plantilla' : 
             tab === 'schedules' ? 'Horarios' : 
             tab === 'vacations' ? 'Vacaciones' : 
             tab === 'expenses' ? 'Gastos Fijos' :
             tab === 'notes' ? 'Notas' : 
             tab === 'checklists' ? 'Checklists' : 'Analítica IA'}
          </button>
        ))}
      </div>

      {activeTab === 'list' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {mockEmployees.map((p) => (
            <div 
              key={p.id} 
              onClick={() => setSelectedEmployee(p)}
              className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm group hover:shadow-xl hover:border-indigo-200 transition-all cursor-pointer relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50/50 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-indigo-100/50 transition-colors" />
              <div className="flex items-start justify-between mb-8 relative z-10">
                <div className="relative">
                  <img src={p.img} alt={p.name} className="w-20 h-20 rounded-3xl object-cover border-4 border-white shadow-md group-hover:scale-105 transition-transform" referrerPolicy="no-referrer" />
                  <div className={cn(
                    "absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-4 border-white shadow-sm",
                    p.status === 'En turno' ? "bg-emerald-500" : "bg-slate-300"
                  )} />
                </div>
                <button className="p-3 text-slate-300 hover:text-slate-600 hover:bg-slate-50 rounded-2xl transition-all">
                  <MoreVertical size={20} />
                </button>
              </div>
              <div className="relative z-10">
                <h3 className="font-black text-slate-900 text-xl tracking-tight">{p.name}</h3>
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mt-1">{p.role}</p>
                
                <div className="mt-8 space-y-4">
                  <div className="flex items-center gap-3 text-sm text-slate-500 font-medium">
                    <Mail size={16} className="text-indigo-500" />
                    {p.email}
                  </div>
                  <div className="flex items-center gap-3 text-sm text-slate-500 font-medium">
                    <Shield size={16} className="text-indigo-500" />
                    {p.dni}
                  </div>
                </div>

                <div className="mt-8 pt-8 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{p.contractType}</span>
                  <span className="text-sm font-black text-slate-900">{p.monthlySalary?.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'schedules' && (
        <div className="space-y-6">
          <div className="bg-indigo-50 border border-indigo-100 p-6 rounded-[2rem] flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100">
                <Brain size={24} />
              </div>
              <div>
                <h4 className="text-sm font-black text-indigo-900 uppercase tracking-widest">Sugerencia IA: Optimización de Turnos</h4>
                <p className="text-xs text-indigo-600 font-medium">Se han detectado 12h extras evitables ajustando el solapamiento de turnos los Jueves.</p>
              </div>
            </div>
            <button 
              onClick={() => setShowOptimizer(true)}
              className="px-6 py-3 bg-white text-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-50 transition-all shadow-sm"
            >
              Ver Propuesta
            </button>
          </div>
          <div className="bg-white rounded-[3rem] border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-10 py-8 border-b border-slate-100 bg-slate-50/30 flex items-center justify-between">
            <div>
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Control de Horarios y Extras</h3>
              <p className="text-slate-500 text-sm mt-1 font-medium">Marzo 2026</p>
            </div>
            <button className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-2xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100">
              <Plus size={18} /> Registrar Jornada
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Empleado</th>
                  <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Contrato</th>
                  <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Horas Reales</th>
                  <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Extras</th>
                  <th className="px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Coste Extra</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {mockEmployees.map((p) => {
                  const totalExtras = p.schedules.reduce((acc, s) => acc + s.extraHours, 0);
                  const extraCost = calculateExtraHoursCost(p);
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/30 transition-colors group">
                      <td className="px-10 py-6">
                        <div className="flex items-center gap-4">
                          <img src={p.img} className="w-12 h-12 rounded-2xl object-cover shadow-sm" referrerPolicy="no-referrer" />
                          <div>
                            <p className="text-sm font-black text-slate-700">{p.name}</p>
                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{p.role}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-6 text-sm text-center font-mono font-bold text-slate-500">{p.contractHours}h</td>
                      <td className="px-6 py-6 text-sm text-center font-mono font-bold text-slate-900">{p.contractHours + totalExtras}h</td>
                      <td className="px-6 py-6 text-center">
                        <span className={cn(
                          "text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest",
                          totalExtras > 0 ? "bg-amber-50 text-amber-600" : "bg-slate-100 text-slate-300"
                        )}>+{totalExtras}h</span>
                      </td>
                      <td className="px-10 py-6 text-sm text-right font-black text-slate-900">
                        {extraCost.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      )}

      {activeTab === 'vacations' && (
        <div className="space-y-6">
          <div className="bg-white rounded-[3rem] border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-10 py-8 border-b border-slate-100 bg-slate-50/30 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Calendario de Vacaciones</h3>
                <p className="text-slate-500 text-sm mt-1 font-medium">Planificación visual 2026</p>
              </div>
              <div className="flex gap-3">
                <button className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-5 py-3 rounded-2xl text-sm font-bold hover:bg-slate-50 transition-all shadow-sm">
                  <Filter size={18} /> Filtrar
                </button>
                <button className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-2xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100">
                  <Plus size={18} /> Nueva Solicitud
                </button>
              </div>
            </div>
            
            <div className="p-10">
              {/* Visual Calendar Grid */}
              <div className="grid grid-cols-7 gap-px bg-slate-200 border border-slate-200 rounded-3xl overflow-hidden shadow-inner">
                {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(day => (
                  <div key={day} className="bg-slate-50 py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    {day}
                  </div>
                ))}
                {Array.from({ length: 31 }).map((_, i) => {
                  const day = i + 1;
                  const hasVacation = mockEmployees.some(emp => 
                    emp.vacations.some(v => {
                      const start = new Date(v.startDate).getDate();
                      const end = new Date(v.endDate).getDate();
                      return day >= start && day <= end;
                    })
                  );
                  const vacationingEmployees = mockEmployees.filter(emp => 
                    emp.vacations.some(v => {
                      const start = new Date(v.startDate).getDate();
                      const end = new Date(v.endDate).getDate();
                      return day >= start && day <= end;
                    })
                  );

                  return (
                    <div key={i} className="bg-white min-h-[120px] p-4 group hover:bg-slate-50 transition-colors relative">
                      <span className={cn(
                        "text-sm font-black",
                        hasVacation ? "text-indigo-600" : "text-slate-300"
                      )}>{day}</span>
                      
                      <div className="mt-2 space-y-1">
                        {vacationingEmployees.map((emp, idx) => (
                          <div key={idx} className="flex items-center gap-1.5 bg-indigo-50 text-indigo-700 px-2 py-1 rounded-lg text-[9px] font-black uppercase truncate">
                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
                            {emp.name.split(' ')[0]}
                          </div>
                        ))}
                      </div>

                      {day === 11 && (
                        <div className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full shadow-sm shadow-rose-200" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {mockEmployees.flatMap(p => p.vacations.map(v => ({ ...v, employee: p }))).map((v, i) => (
              <div key={i} className="flex items-center justify-between p-8 bg-white rounded-[2.5rem] border border-slate-200 group hover:shadow-md transition-all">
                <div className="flex items-center gap-6">
                  <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-500 shadow-sm group-hover:scale-110 transition-transform">
                    <Plane size={28} />
                  </div>
                  <div>
                    <p className="text-base font-black text-slate-900">{v.employee.name}</p>
                    <p className="text-xs text-slate-500 font-medium mt-1">
                      {new Date(v.startDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })} - {new Date(v.endDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}
                    </p>
                  </div>
                </div>
                <span className={cn(
                  "px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest",
                  v.status === 'Aprobada' ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                )}>
                  {v.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'notes' && (
        <div className="bg-white rounded-[3rem] border border-slate-200 shadow-sm overflow-hidden p-10 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Bloc de Notas del Personal</h3>
            <button 
              onClick={handleExportNotes}
              className="flex items-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-2xl text-sm font-bold hover:bg-slate-800 transition-all"
            >
              <FileText size={18} /> Exportar para Imprimir
            </button>
          </div>
          <textarea 
            className="w-full h-96 p-8 bg-slate-50 border-none rounded-[2rem] text-slate-700 font-medium focus:ring-2 focus:ring-indigo-500 transition-all resize-none"
            placeholder="Escribe aquí recordatorios, tareas pendientes o gestiones para el personal..."
            value={notes}
            onChange={(e) => {
              setNotes(e.target.value);
              localStorage.setItem('personal_notes', e.target.value);
            }}
          />
        </div>
      )}

      {activeTab === 'checklists' && (
        <div className="bg-white rounded-[3rem] border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-10 py-8 border-b border-slate-100 bg-slate-50/30 flex items-center justify-between">
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Listas de Trabajo por Turno</h3>
            <button className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-2xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100">
              <Plus size={18} /> Nueva Tarea
            </button>
          </div>
          <div className="p-10 space-y-8">
            {['Mañana', 'Tarde', 'Noche'].map(shift => (
              <div key={shift} className="space-y-4">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-indigo-500" />
                  Turno de {shift}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {checklists.filter(c => c.shift === shift).map(item => (
                    <div 
                      key={item.id}
                      onClick={() => toggleChecklist(item.id)}
                      className={cn(
                        "flex items-center gap-4 p-6 rounded-[2rem] border transition-all cursor-pointer",
                        item.completed ? "bg-emerald-50 border-emerald-100 opacity-60" : "bg-white border-slate-100 hover:border-indigo-200"
                      )}
                    >
                      <div className={cn(
                        "w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all",
                        item.completed ? "bg-emerald-500 border-emerald-500 text-white" : "border-slate-200"
                      )}>
                        {item.completed && <CheckCircle2 size={14} />}
                      </div>
                      <span className={cn(
                        "text-sm font-bold",
                        item.completed ? "text-emerald-700 line-through" : "text-slate-700"
                      )}>{item.task}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {activeTab === 'expenses' && (
        <div className="bg-white rounded-[3rem] border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-10 py-8 border-b border-slate-100 bg-slate-50/30 flex items-center justify-between">
            <div>
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Gastos Fijos y Estructurales</h3>
              <p className="text-slate-500 text-sm mt-1 font-medium">Incluye costes de personal y mantenimiento.</p>
            </div>
            <button className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-2xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100">
              <Plus size={18} /> Añadir Gasto
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Concepto</th>
                  <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Categoría</th>
                  <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Frecuencia</th>
                  <th className="px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Importe</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {mockFixedExpenses.map((expense) => (
                  <tr key={expense.id} className="hover:bg-slate-50/30 transition-colors group">
                    <td className="px-10 py-6">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-500 transition-colors">
                          {expense.category === 'Personal' ? <User size={20} /> : <CreditCard size={20} />}
                        </div>
                        <span className="text-sm font-black text-slate-700">{expense.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-6">
                      <span className="text-[10px] font-black px-3 py-1 bg-slate-100 text-slate-500 rounded-full uppercase tracking-widest">
                        {expense.category}
                      </span>
                    </td>
                    <td className="px-6 py-6 text-sm text-center font-bold text-slate-500">{expense.frequency}</td>
                    <td className="px-10 py-6 text-sm text-right font-black text-slate-900">
                      {expense.amount.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-900 text-white">
                  <td colSpan={3} className="px-10 py-6 text-sm font-black uppercase tracking-widest">Total Gastos Fijos Mensuales</td>
                  <td className="px-10 py-6 text-xl font-black text-right">
                    {mockFixedExpenses.reduce((acc, curr) => 
                      acc + (curr.frequency === 'Mensual' ? curr.amount : curr.amount / 12), 0
                    ).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'analytics' && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-white p-10 rounded-[3rem] border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Evolución de Costes de Personal</h3>
                <div className="flex gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-indigo-500" />
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Coste Real</span>
                  </div>
                </div>
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%" minHeight={250}>
                  <AreaChart data={[
                    { month: 'Ene', cost: 12500 },
                    { month: 'Feb', cost: 12800 },
                    { month: 'Mar', cost: 13200 },
                    { month: 'Abr', cost: 13100 },
                    { month: 'May', cost: 13500 },
                    { month: 'Jun', cost: 14200 },
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#94a3b8' }} />
                    <YAxis hide />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '16px', color: '#fff', fontSize: '10px', fontWeight: 'bold' }}
                    />
                    <Area type="monotone" dataKey="cost" stroke="#6366f1" strokeWidth={3} fill="#6366f1" fillOpacity={0.1} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-sm">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2 mb-6">
                <Calculator size={18} className="text-indigo-600" />
                Simulador de Costes IA
              </h3>
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between mb-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nuevas Contrataciones</label>
                    <span className="text-xs font-black text-indigo-600">+2 Pers.</span>
                  </div>
                  <input type="range" className="w-full accent-indigo-600" min="0" max="10" defaultValue="2" />
                </div>
                <div>
                  <div className="flex justify-between mb-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Subida Salarial (%)</label>
                    <span className="text-xs font-black text-indigo-600">3%</span>
                  </div>
                  <input type="range" className="w-full accent-indigo-600" min="0" max="20" defaultValue="3" />
                </div>
                <div className="p-6 bg-indigo-50 rounded-3xl border border-indigo-100">
                  <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-1">Impacto en EBITDA</p>
                  <p className="text-2xl font-black text-indigo-900">-4.200 € / mes</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-sm">
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-8">Rendimiento por Empleado</h3>
              <div className="space-y-6">
                {mockEmployees.map(emp => (
                  <div key={emp.id} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-black text-slate-700">{emp.name}</span>
                      <span className="text-xs font-black text-indigo-600">92% Eficiencia</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500 rounded-full" style={{ width: '92%' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-slate-900 text-white p-10 rounded-[3rem] shadow-xl">
              <div className="flex items-center gap-3 mb-8">
                <Brain className="text-indigo-400" />
                <h3 className="text-xl font-black uppercase tracking-tight">Insights de Equipo IA</h3>
              </div>
              <div className="space-y-6">
                <div className="p-6 bg-white/5 rounded-3xl border border-white/10">
                  <p className="text-sm font-bold text-indigo-300 mb-2">Moraleja del Equipo</p>
                  <p className="text-2xl font-black">Alta (8.4/10)</p>
                  <p className="text-xs text-slate-500 mt-2 font-medium">Basado en puntualidad y feedback de cierre.</p>
                </div>
                <div className="p-6 bg-white/5 rounded-3xl border border-white/10">
                  <p className="text-sm font-bold text-emerald-300 mb-2">Retención Proyectada</p>
                  <p className="text-2xl font-black">95%</p>
                  <p className="text-xs text-slate-500 mt-2 font-medium">Bajo riesgo de rotación en los próximos 3 meses.</p>
                </div>
                <div className="p-6 bg-indigo-500/20 rounded-3xl border border-indigo-400/30">
                  <div className="flex items-center gap-2 mb-2">
                    <Zap size={16} className="text-amber-400" />
                    <p className="text-sm font-bold text-indigo-200">Optimización de Turnos</p>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    La IA sugiere adelantar el turno de cena 15 min para cubrir el pico de reservas detectado por el motor de marketing.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showOptimizer && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[3rem] w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-10 border-b border-slate-100 flex items-center justify-between bg-amber-50/50">
              <div className="flex items-center gap-3">
                <Zap className="text-amber-500" size={24} />
                <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">AI Shift Optimizer</h2>
              </div>
              <button onClick={() => setShowOptimizer(false)} className="p-3 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-2xl transition-all">
                <Plus size={28} className="rotate-45" />
              </button>
            </div>
            <div className="p-10 space-y-8">
              <div className="p-8 bg-slate-50 rounded-[2.5rem] border border-slate-200 text-center">
                <p className="text-slate-500 font-medium mb-6">
                  Analiza el histórico de ventas, reservas confirmadas y eventos locales para sugerir el cuadrante más eficiente.
                </p>
                <button 
                  onClick={handleOptimizeShifts}
                  disabled={isOptimizing}
                  className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-slate-800 transition-all disabled:opacity-50 flex items-center gap-3 mx-auto"
                >
                  {isOptimizing ? (
                    <>
                      <Clock className="animate-spin" size={18} />
                      Analizando Datos...
                    </>
                  ) : (
                    <>
                      <Zap size={18} />
                      Ejecutar Optimización
                    </>
                  )}
                </button>
              </div>

              {optimizationResult && (
                <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
                  <div className="flex items-center gap-3 text-emerald-600 font-black uppercase tracking-widest text-xs">
                    <CheckCircle2 size={16} />
                    {optimizationResult.message}
                  </div>
                  <div className="space-y-3">
                    {optimizationResult.suggestions.map((s, i) => (
                      <div key={i} className="flex items-center gap-4 p-4 bg-amber-50 border border-amber-100 rounded-2xl">
                        <div className="w-8 h-8 bg-amber-200 text-amber-700 rounded-xl flex items-center justify-center shrink-0">
                          <TrendingUp size={16} />
                        </div>
                        <p className="text-sm font-bold text-amber-900">{s}</p>
                      </div>
                    ))}
                  </div>
                  <button className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-indigo-700 transition-all">
                    Aplicar Cambios al Cuadrante
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[3rem] w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-10 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Añadir Nuevo Empleado</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-3 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-2xl transition-all">
                <Plus size={28} className="rotate-45" />
              </button>
            </div>
            <div className="p-10 space-y-8">
              <div className="grid grid-cols-2 gap-6">
                <div className="col-span-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Nombre Completo</label>
                  <input 
                    type="text" 
                    className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 transition-all" 
                    placeholder="Ej: Juan Pérez"
                    value={newEmployee.name}
                    onChange={e => setNewEmployee({...newEmployee, name: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">DNI / NIE</label>
                  <input 
                    type="text" 
                    className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 transition-all" 
                    placeholder="12345678A"
                    value={newEmployee.dni}
                    onChange={e => setNewEmployee({...newEmployee, dni: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Correo Electrónico</label>
                  <input 
                    type="email" 
                    className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 transition-all" 
                    placeholder="juan@ejemplo.com"
                    value={newEmployee.email}
                    onChange={e => setNewEmployee({...newEmployee, email: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Rol / Puesto</label>
                  <select 
                    className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 transition-all"
                    value={newEmployee.role}
                    onChange={e => setNewEmployee({...newEmployee, role: e.target.value})}
                  >
                    <option value="Cocinero">Cocinero</option>
                    <option value="Camarero">Camarero</option>
                    <option value="Maître">Maître</option>
                    <option value="Limpieza">Limpieza</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Tipo de Contrato</label>
                  <select 
                    className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 transition-all"
                    value={newEmployee.contractType}
                    onChange={e => setNewEmployee({...newEmployee, contractType: e.target.value})}
                  >
                    <option value="Indefinido">Indefinido</option>
                    <option value="Temporal">Temporal</option>
                    <option value="Formación">Formación</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Salario Mensual Bruto</label>
                  <input 
                    type="number" 
                    className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 transition-all" 
                    placeholder="2200"
                    value={newEmployee.monthlySalary}
                    onChange={e => setNewEmployee({...newEmployee, monthlySalary: parseFloat(e.target.value) || 0})}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Horas Semanales</label>
                  <input 
                    type="number" 
                    className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 transition-all" 
                    placeholder="40"
                    value={newEmployee.contractHours}
                    onChange={e => setNewEmployee({...newEmployee, contractHours: parseFloat(e.target.value) || 0})}
                  />
                </div>
              </div>
              <button 
                onClick={handleAddEmployee}
                className="w-full bg-indigo-600 text-white py-5 rounded-[2rem] font-black uppercase tracking-[0.2em] hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 mt-6"
              >
                Dar de Alta
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedEmployee && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[3rem] w-full max-w-4xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col md:flex-row">
            <div className="w-full md:w-1/3 bg-indigo-600 p-12 text-white flex flex-col items-center text-center">
              <img src={selectedEmployee.img} className="w-32 h-32 rounded-[2.5rem] object-cover border-4 border-white/20 shadow-2xl mb-6" referrerPolicy="no-referrer" />
              <h2 className="text-2xl font-black tracking-tight">{selectedEmployee.name}</h2>
              <p className="text-indigo-200 text-xs font-black uppercase tracking-widest mt-2">{selectedEmployee.role}</p>
              
              <div className="mt-12 w-full space-y-6">
                <div className="flex items-center gap-4 text-left">
                  <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center shrink-0">
                    <Mail size={18} />
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-[10px] font-black text-indigo-300 uppercase tracking-widest">Email</p>
                    <p className="text-sm font-bold truncate">{selectedEmployee.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-left">
                  <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center shrink-0">
                    <Shield size={18} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-indigo-300 uppercase tracking-widest">DNI</p>
                    <p className="text-sm font-bold">{selectedEmployee.dni}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-left">
                  <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center shrink-0">
                    <Briefcase size={18} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-indigo-300 uppercase tracking-widest">Contrato</p>
                    <p className="text-sm font-bold">{selectedEmployee.contractType}</p>
                  </div>
                </div>
              </div>

              <button className="mt-auto w-full bg-white text-indigo-600 py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-indigo-50 transition-all">
                Editar Perfil
              </button>
            </div>
            <div className="flex-1 p-12 overflow-y-auto max-h-[80vh]">
              <div className="flex items-center justify-between mb-10">
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Detalles Laborales</h3>
                <button onClick={() => setSelectedEmployee(null)} className="p-3 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-2xl transition-all">
                  <Plus size={28} className="rotate-45" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-8 mb-12">
                <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Salario Base</p>
                  <p className="text-2xl font-black text-slate-900">{selectedEmployee.monthlySalary?.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</p>
                </div>
                <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Precio Hora</p>
                  <p className="text-2xl font-black text-slate-900">{selectedEmployee.hourlyRate.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}/h</p>
                </div>
              </div>

              <div className="space-y-8">
                <div>
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6">Últimas Jornadas</h4>
                  <div className="space-y-3">
                    {selectedEmployee.schedules.map((s) => (
                      <div key={s.id} className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl shadow-sm">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                            <Clock size={18} />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-700">{new Date(s.day).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric' })}</p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase">{s.startTime} - {s.endTime}</p>
                          </div>
                        </div>
                        {s.extraHours > 0 && (
                          <span className="bg-amber-50 text-amber-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                            +{s.extraHours}h Extra
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6">Documentación y Formación</h4>
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <button className="flex items-center gap-3 p-4 border border-slate-200 rounded-2xl hover:bg-slate-50 transition-all text-left group">
                      <FileText size={20} className="text-slate-400 group-hover:text-indigo-500" />
                      <span className="text-xs font-bold text-slate-600">Última Nómina</span>
                    </button>
                    <button className="flex items-center gap-3 p-4 border border-slate-200 rounded-2xl hover:bg-slate-50 transition-all text-left group">
                      <FileText size={20} className="text-slate-400 group-hover:text-indigo-500" />
                      <span className="text-xs font-bold text-slate-600">Contrato PDF</span>
                    </button>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Shield size={16} className="text-emerald-600" />
                        <span className="text-xs font-bold text-emerald-900">Carnet Manipulador</span>
                      </div>
                      <span className="text-[9px] font-black text-emerald-600 uppercase">Válido hasta 2028</span>
                    </div>
                    <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <AlertCircle size={16} className="text-amber-600" />
                        <span className="text-xs font-bold text-amber-900">Prevención Riesgos</span>
                      </div>
                      <span className="text-[9px] font-black text-amber-600 uppercase">Expira en 30 días</span>
                    </div>
                  </div>
                </div>

                <div className="pt-8 border-t border-slate-100">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6">Firma Digital de Documentos</h4>
                  <div className="p-8 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200 text-center">
                    <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 text-slate-300">
                      <FileText size={24} />
                    </div>
                    <p className="text-xs font-bold text-slate-500 mb-4">No hay documentos pendientes de firma</p>
                    <button className="text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:underline">
                      Solicitar firma de nueva política
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
