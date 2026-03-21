import React from 'react';
import { 
  TrendingUp, 
  Package, 
  Users, 
  Receipt, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  ArrowRight, 
  DollarSign, 
  PieChart, 
  FileText, 
  Mail, 
  Calculator, 
  Megaphone, 
  Landmark,
  Wallet,
  Sparkles,
  Zap,
  Brain,
  Plus,
  ShieldCheck
} from 'lucide-react';
import { useSupabase } from '../context/SupabaseContext';
import { cn, formatCurrency } from '../lib/utils';
import { useNavigate } from 'react-router-dom';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

const DashboardView = () => {
  const { employee } = useSupabase();
  const navigate = useNavigate();
  const role = employee?.rol || 'Encargado';

  const isAccountant = role === 'Contable' || role === 'Gestor' || role === 'admin';

  const salesForecast = [
    { name: 'Lun', actual: 850, predicted: 850 },
    { name: 'Mar', actual: 920, predicted: 920 },
    { name: 'Mie', actual: 780, predicted: 780 },
    { name: 'Jue', actual: 1100, predicted: 1100 },
    { name: 'Vie', actual: 1450, predicted: 1450 },
    { name: 'Sab', predicted: 2100 },
    { name: 'Dom', predicted: 1950 },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">GastroGestión ERP</h1>
          <p className="text-slate-500 text-sm font-medium mt-1">
            Panel de Control Centralizado • <span className="text-indigo-600 font-bold">{role}</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-black text-slate-500 bg-white px-4 py-2.5 rounded-2xl border border-slate-200 shadow-sm uppercase tracking-widest">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            Turno Abierto
          </div>
          <button 
            onClick={() => navigate('/cierre-caja')}
            className="bg-slate-900 text-white px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 flex items-center gap-2"
          >
            <Calculator size={16} />
            Cierre de Caja
          </button>
        </div>
      </div>
      
      {/* AI Insights Ticker */}
      <div className="bg-indigo-600 text-white px-6 py-3 rounded-2xl flex items-center gap-4 overflow-hidden shadow-lg shadow-indigo-100 relative group">
        <div className="flex items-center gap-2 shrink-0">
          <Sparkles size={18} className="text-indigo-200 animate-pulse" />
          <span className="text-[10px] font-black uppercase tracking-widest">AI Insights</span>
        </div>
        <div className="h-4 w-px bg-white/20 shrink-0" />
        <div className="flex-1 overflow-hidden">
          <div className="flex gap-12 animate-marquee whitespace-nowrap">
            <span className="text-xs font-bold">Tendencia: Las reservas para el fin de semana han subido un 15%. Sugerimos reforzar el turno de noche.</span>
            <span className="text-xs font-bold">Alerta: El precio del aceite ha subido un 8% en el mercado. Revisar proveedores alternativos.</span>
            <span className="text-xs font-bold">Optimización: El plato "Lubina a la Sal" tiene un margen del 72%. Promocionar en redes sociales.</span>
          </div>
        </div>
        <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-indigo-600 to-transparent z-10" />
      </div>

      {/* Quick Actions Bar */}
      <div className="flex flex-wrap gap-4">
        {[
          { label: 'Escanear Albarán', icon: Zap, path: '/albaranes', color: 'bg-amber-500' },
          { label: 'Nueva Factura', icon: Plus, path: '/facturas', color: 'bg-emerald-500' },
          { label: 'Reposición Stock', icon: Package, path: '/inventario', color: 'bg-blue-500' },
          { label: 'Verifactu AEAT', icon: ShieldCheck, path: '/facturacion-clientes', color: 'bg-indigo-500' },
        ].map((action) => (
          <button
            key={action.label}
            onClick={() => navigate(action.path)}
            className="flex items-center gap-3 px-6 py-3 bg-white border border-slate-200 rounded-2xl hover:border-indigo-200 hover:shadow-md transition-all group"
          >
            <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center text-white", action.color)}>
              <action.icon size={16} />
            </div>
            <span className="text-xs font-black text-slate-700 uppercase tracking-widest">{action.label}</span>
          </button>
        ))}
      </div>

      {/* Main KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Ventas Hoy', value: '1.240,50 €', change: '+12.5%', icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50', path: '/facturacion-clientes' },
          { label: 'Caja Física', value: '850,40 €', change: 'Conciliado', icon: Calculator, color: 'text-blue-600', bg: 'bg-blue-50', path: '/cierre-caja' },
          { label: 'ROI Marketing', value: '3.4x', change: '+0.5', icon: Megaphone, color: 'text-indigo-600', bg: 'bg-indigo-50', path: '/marketing' },
          { label: 'Stock Crítico', value: '12 ítems', change: 'Urgente', icon: Package, color: 'text-rose-600', bg: 'bg-rose-50', path: '/inventario' },
        ].map((stat) => (
          <div 
            key={stat.label} 
            onClick={() => navigate(stat.path)}
            className="p-8 bg-white rounded-[2.5rem] border border-slate-200 shadow-sm hover:shadow-xl hover:border-indigo-100 transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between mb-6">
              <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform", stat.bg, stat.color)}>
                <stat.icon size={28} />
              </div>
              <span className={cn("text-[10px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest", stat.bg, stat.color)}>
                {stat.change}
              </span>
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{stat.label}</p>
            <p className="text-3xl font-black text-slate-900 mt-2">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Sales Forecast Chart */}
          <div className="bg-white rounded-[3rem] border border-slate-200 shadow-sm p-10">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Ventas Semanales vs Previsión IA</h3>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Predicción basada en histórico y festivos</p>
              </div>
              <div className="flex gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-indigo-500" />
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Real</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-indigo-200" />
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">IA Forecast</span>
                </div>
              </div>
            </div>
            <div className="h-64 w-full min-h-[256px]">
              <ResponsiveContainer width="100%" height="100%" minHeight={256}>
                <AreaChart data={salesForecast}>
                  <defs>
                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#94a3b8' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#94a3b8' }} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                  />
                  <Area type="monotone" dataKey="actual" stroke="#6366f1" strokeWidth={4} fillOpacity={1} fill="url(#colorSales)" />
                  <Area type="monotone" dataKey="predicted" stroke="#c7d2fe" strokeWidth={2} strokeDasharray="5 5" fill="none" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* AI Business Health Score */}
          <div className="bg-slate-900 rounded-[3rem] p-12 text-white relative overflow-hidden group">
            <div className="absolute -right-20 -top-20 w-80 h-80 bg-indigo-500/10 rounded-full blur-[100px] group-hover:scale-110 transition-transform duration-1000" />
            <div className="absolute -left-20 -bottom-20 w-60 h-60 bg-emerald-500/10 rounded-full blur-[80px] group-hover:scale-110 transition-transform duration-1000" />
            
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-12">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-[2rem] flex items-center justify-center border border-white/20">
                    <Brain size={32} className="text-indigo-400" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black uppercase tracking-tight">AI Business Health Score</h3>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Análisis holístico de rentabilidad y eficiencia</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-6xl font-black text-emerald-400">88<span className="text-2xl text-slate-500">/100</span></div>
                  <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mt-2">Estado: Excelente</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {[
                  { label: 'Eficiencia Operativa', value: 92, color: 'bg-emerald-500' },
                  { label: 'Margen de Contribución', value: 78, color: 'bg-indigo-500' },
                  { label: 'Satisfacción Cliente', value: 94, color: 'bg-amber-500' },
                ].map((metric) => (
                  <div key={metric.label} className="space-y-4">
                    <div className="flex justify-between items-end">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{metric.label}</span>
                      <span className="text-lg font-black">{metric.value}%</span>
                    </div>
                    <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                      <div className={cn("h-full rounded-full transition-all duration-1000", metric.color)} style={{ width: `${metric.value}%` }} />
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-12 p-6 bg-white/5 rounded-3xl border border-white/10 flex items-start gap-4">
                <div className="w-10 h-10 bg-amber-500/20 text-amber-400 rounded-2xl flex items-center justify-center shrink-0">
                  <AlertCircle size={20} />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-200">Insight Crítico de IA</p>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Se detecta una desviación del 4% en el coste de materia prima en la última semana. 
                    Recomendamos revisar los precios del proveedor de pescado y optimizar el escandallo de la "Lubina a la Sal".
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Critical Tasks & Alerts */}
          <div className="bg-white rounded-[3rem] border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-10 py-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
              <div>
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Alertas y Tareas ERP</h3>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Acciones requeridas hoy</p>
              </div>
              <span className="px-4 py-2 bg-rose-100 text-rose-700 text-[10px] font-black uppercase rounded-full tracking-widest">3 Urgentes</span>
            </div>
            <div className="p-4">
              {[
                { title: 'Factura Bodegas Rioja vencida', desc: 'Venció hace 2 días. Importe: 890,20 €', type: 'error', icon: AlertCircle, path: '/facturas' },
                { title: 'Sincronizar stock con albaranes', desc: '2 albaranes pendientes de procesar', type: 'info', icon: CheckCircle2, path: '/albaranes' },
                { title: 'Cierre de caja pendiente', desc: 'El turno de ayer no se cerró correctamente', type: 'warning', icon: Calculator, path: '/cierre-caja' },
                { title: 'Campaña "Semana Santa" activa', desc: 'Presupuesto consumido al 85%', type: 'marketing', icon: Megaphone, path: '/marketing' },
              ].map((task, i) => (
                <div 
                  key={i} 
                  onClick={() => navigate(task.path)}
                  className="flex items-center gap-6 p-6 hover:bg-slate-50 rounded-[2rem] transition-all cursor-pointer group"
                >
                  <div className={cn(
                    "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform",
                    task.type === 'error' ? "bg-rose-50 text-rose-600" : 
                    task.type === 'warning' ? "bg-amber-50 text-amber-600" : 
                    task.type === 'marketing' ? "bg-indigo-50 text-indigo-600" : "bg-blue-50 text-blue-600"
                  )}>
                    <task.icon size={24} />
                  </div>
                  <div className="flex-1">
                    <p className="text-base font-black text-slate-900 group-hover:text-indigo-600 transition-colors">{task.title}</p>
                    <p className="text-sm text-slate-500 mt-1 font-medium">{task.desc}</p>
                  </div>
                  <ArrowRight size={20} className="text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
                </div>
              ))}
            </div>
          </div>

          {/* Menu Engineering & Marketing ROI */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white rounded-[3rem] border border-slate-200 shadow-sm p-10">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Menu Engineering</h3>
                <PieChart size={20} className="text-emerald-500" />
              </div>
              <div className="space-y-6">
                {[
                  { label: 'Estrellas', value: 8, total: 28, color: 'bg-emerald-500' },
                  { label: 'Puzzles', value: 5, total: 28, color: 'bg-amber-500' },
                  { label: 'Vacas', value: 12, total: 28, color: 'bg-blue-500' },
                  { label: 'Perros', value: 3, total: 28, color: 'bg-rose-500' },
                ].map((item) => (
                  <div key={item.label} className="space-y-2">
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                      <span className="text-slate-400">{item.label}</span>
                      <span className="text-slate-900">{item.value} platos</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div 
                        className={cn("h-full transition-all duration-1000", item.color)} 
                        style={{ width: `${(item.value / item.total) * 100}%` }} 
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-900 text-white rounded-[3rem] p-10 shadow-xl shadow-slate-200 relative overflow-hidden group">
              <div className="absolute -right-10 -top-10 w-40 h-40 bg-indigo-500/10 rounded-full blur-3xl group-hover:scale-110 transition-transform" />
              <div className="flex items-center justify-between mb-8 relative z-10">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Marketing Performance</h3>
                <Megaphone size={20} className="text-indigo-400" />
              </div>
              <div className="space-y-8 relative z-10">
                <div>
                  <p className="text-4xl font-black">3.4x</p>
                  <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-2">ROI Global Campañas</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                    <p className="text-xl font-black">1.2k</p>
                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Nuevos Leads</p>
                  </div>
                  <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                    <p className="text-xl font-black">450€</p>
                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Inversión Mes</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-8">
          {/* Treasury & Bank Sidebar */}
          <div className="bg-indigo-600 text-white p-10 rounded-[3rem] shadow-xl shadow-indigo-100 relative overflow-hidden group">
            <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-white/10 rounded-full blur-3xl group-hover:scale-110 transition-transform" />
            <h3 className="text-indigo-200 text-[10px] font-black uppercase tracking-widest mb-8 relative z-10">Tesorería Consolidada</h3>
            <div className="space-y-2 relative z-10">
              <p className="text-4xl font-black">12.450,30 €</p>
              <p className="text-indigo-200 text-xs font-bold flex items-center gap-1">
                <TrendingUp size={16} /> +4.2% vs mes anterior
              </p>
            </div>
            <div className="mt-10 pt-10 border-t border-white/10 space-y-6 relative z-10">
              <div 
                onClick={() => navigate('/banco')}
                className="flex items-center gap-4 bg-white/10 p-4 rounded-2xl hover:bg-white/20 transition-all cursor-pointer"
              >
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                  <Landmark size={20} />
                </div>
                <div>
                  <p className="text-sm font-black">La Caixa</p>
                  <p className="text-[10px] text-indigo-200 font-bold uppercase tracking-widest">10.240,50 €</p>
                </div>
              </div>
              <div 
                onClick={() => navigate('/tesoreria')}
                className="flex items-center gap-4 bg-white/10 p-4 rounded-2xl hover:bg-white/20 transition-all cursor-pointer"
              >
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                  <Wallet size={20} />
                </div>
                <div>
                  <p className="text-sm font-black">Caja Efectivo</p>
                  <p className="text-[10px] text-indigo-200 font-bold uppercase tracking-widest">2.209,80 €</p>
                </div>
              </div>
            </div>
          </div>

          {/* Corporate Mail */}
          <div className="bg-white rounded-[3rem] border border-slate-200 shadow-sm p-10">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-8">Correo Corporativo</h3>
            <div className="space-y-4">
              {[
                { from: 'Bodegas Rioja', subject: 'Factura Rectificativa', time: '10:30' },
                { from: 'AEAT', subject: 'Notificación Electrónica', time: 'Ayer' },
                { from: 'Pedidos Ya', subject: 'Liquidación Semanal', time: 'Ayer' },
              ].map((mail, i) => (
                <div key={i} className="flex items-center gap-4 p-4 hover:bg-slate-50 rounded-2xl transition-all cursor-pointer group">
                  <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-all">
                    <Mail size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-slate-900 truncate">{mail.from}</p>
                    <p className="text-[10px] text-slate-500 font-bold uppercase truncate">{mail.subject}</p>
                  </div>
                  <span className="text-[10px] font-black text-slate-300 uppercase">{mail.time}</span>
                </div>
              ))}
            </div>
            <button className="w-full mt-8 py-4 bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-slate-100 transition-all">
              Ver Bandeja de Entrada
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardView;
