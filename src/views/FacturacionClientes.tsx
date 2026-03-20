import React from 'react';
import { Plus, Search, FileText, Download, MoreVertical, CheckCircle2, Clock, Users, Layers, ShieldCheck, Send, TrendingUp, BarChart3, PieChart, Calendar, Calculator, ArrowUpRight, ArrowDownRight, Sparkles, Brain } from 'lucide-react';
import { CustomerInvoice, Ticket } from '../types';
import { cn, formatCurrency, formatDate } from '../lib/utils';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, PieChart as RePieChart, Pie, AreaChart, Area, CartesianGrid } from 'recharts';

const revenueData = [
  { name: 'Lun', revenue: 1200 },
  { name: 'Mar', revenue: 1900 },
  { name: 'Mie', revenue: 1500 },
  { name: 'Jue', revenue: 2100 },
  { name: 'Vie', revenue: 3200 },
  { name: 'Sab', revenue: 4500 },
  { name: 'Dom', revenue: 3800 },
];

const mockCustomerInvoices: CustomerInvoice[] = [
  {
    id: '1',
    number: '2026/0001',
    date: '2026-03-10',
    issuer: { name: 'GastroGestión Pro S.L.', taxId: 'B12345678', address: 'Calle Principal 1, Madrid' },
    receiver: { name: 'Empresa Cliente A', taxId: 'A87654321', address: 'Avenida de los Negocios 10, Madrid' },
    items: [
      { id: '1', description: 'Servicio de Catering Evento Corporativo', quantity: 1, unitPrice: 1200, taxRate: 10, total: 1320 }
    ],
    subtotal: 1200,
    taxBreakdown: [{ rate: 10, amount: 120 }],
    total: 1320,
    status: 'Cobrada',
    paymentMethod: 'Transferencia',
    type: 'Individual',
    verifactuStatus: 'Enviado'
  },
  {
    id: '2',
    number: '2026/0002',
    date: '2026-03-10',
    issuer: { name: 'GastroGestión Pro S.L.', taxId: 'B12345678', address: 'Calle Principal 1, Madrid' },
    receiver: { name: 'Cliente Habitual B', taxId: '12345678Z', address: 'Calle Falsa 123' },
    items: [
      { id: '2', description: 'Consumo semana 02/03 - 08/03', quantity: 1, unitPrice: 450, taxRate: 10, total: 495 }
    ],
    subtotal: 450,
    taxBreakdown: [{ rate: 10, amount: 45 }],
    total: 495,
    status: 'Pendiente',
    type: 'Agrupada',
    verifactuStatus: 'Pendiente'
  }
];

const mockTickets: Ticket[] = [
  { id: 't1', number: 'T-001', date: '2026-03-10', total: 45.50, status: 'Cerrado', items: [] },
  { id: 't2', number: 'T-002', date: '2026-03-10', total: 120.00, status: 'Cerrado', items: [] },
  { id: 't3', number: 'T-003', date: '2026-03-10', total: 85.20, status: 'Cerrado', items: [] },
];

export default function FacturacionClientesView() {
  const [view, setView] = React.useState<'list' | 'create' | 'forecast'>('list');
  const [selectedTickets, setSelectedTickets] = React.useState<string[]>([]);
  const [isSendingVerifactu, setIsSendingVerifactu] = React.useState<string | null>(null);

  const forecastData = [
    { name: 'Semana 1', revenue: 15200, predicted: 15800, events: ['Fallas'] },
    { name: 'Semana 2', revenue: 14800, predicted: 16200, events: ['Campaña Primavera'] },
    { name: 'Semana 3', revenue: 0, predicted: 17500, events: ['Semana Santa'] },
    { name: 'Semana 4', revenue: 0, predicted: 18200, events: ['Festivo Local'] },
  ];

  const categoryData = [
    { name: 'Catering', value: 4500, color: '#4f46e5' },
    { name: 'Menú Diario', value: 3200, color: '#10b981' },
    { name: 'Eventos', value: 2800, color: '#f59e0b' },
    { name: 'Otros', value: 1200, color: '#64748b' },
  ];

  const totalInvoiced = mockCustomerInvoices.reduce((acc, i) => acc + i.total, 0);
  const pendingVerifactu = mockCustomerInvoices.filter(i => i.verifactuStatus === 'Pendiente').length;

  const handleSendVerifactu = (id: string) => {
    setIsSendingVerifactu(id);
    setTimeout(() => {
      setIsSendingVerifactu(null);
      alert("Factura enviada correctamente a Verifactu (AEAT).");
    }, 1500);
  };

  const toggleTicket = (id: string) => {
    setSelectedTickets(prev => 
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-100">
            <ShieldCheck size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Facturación Verifactu</h1>
            <p className="text-slate-500 text-sm flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Conexión activa con AEAT
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setView('list')}
            className={cn(
              "px-4 py-2.5 rounded-xl text-sm font-semibold transition-all",
              view === 'list' ? "bg-slate-900 text-white" : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
            )}
          >
            Ver Facturas
          </button>
          <button 
            onClick={() => setView('create')}
            className={cn(
              "px-4 py-2.5 rounded-xl text-sm font-semibold transition-all",
              view === 'create' ? "bg-slate-900 text-white" : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
            )}
          >
            Nueva Factura
          </button>
          <button 
            onClick={() => setView('forecast')}
            className={cn(
              "px-4 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2",
              view === 'forecast' ? "bg-indigo-600 text-white" : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
            )}
          >
            <Sparkles size={16} />
            Previsión IA
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Facturado (Mes)</p>
          <p className="text-2xl font-bold text-slate-900">{formatCurrency(totalInvoiced + 15420)}</p>
          <div className="mt-2 flex items-center gap-1 text-xs text-emerald-600 font-bold">
            <ArrowUpRight size={14} /> +12.5% vs mes ant.
          </div>
        </div>
        <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Pendiente AEAT</p>
          <p className="text-2xl font-bold text-amber-600">{pendingVerifactu} Facturas</p>
          <div className="mt-2 flex items-center gap-1 text-xs text-amber-600 font-bold">
            <Clock size={14} /> Requiere envío manual
          </div>
        </div>
        <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">IVA Devengado (Q1)</p>
          <p className="text-2xl font-bold text-slate-900">{formatCurrency(1842.50)}</p>
          <div className="mt-2 flex items-center gap-1 text-xs text-slate-400 font-bold uppercase tracking-widest">
            <Calculator size={14} /> Modelo 303
          </div>
        </div>
        <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Ticket Medio</p>
          <p className="text-2xl font-bold text-slate-900">{formatCurrency(42.80)}</p>
          <div className="mt-2 flex items-center gap-1 text-xs text-rose-600 font-bold">
            <ArrowDownRight size={14} /> -2.1% vs ayer
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Evolución de Ingresos</h3>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Ventas brutas semanales</p>
            </div>
            <select className="bg-slate-50 border-none rounded-xl text-xs font-black uppercase tracking-widest px-4 py-2 outline-none focus:ring-2 focus:ring-indigo-500/20">
              <option>Últimos 7 días</option>
              <option>Últimos 30 días</option>
            </select>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%" minHeight={300}>
              <AreaChart data={revenueData}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
                  tickFormatter={(value) => `${value}€`}
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  itemStyle={{ fontSize: '12px', fontWeight: 700 }}
                />
                <Area 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="#4f46e5" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorRevenue)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-6 flex items-center gap-2">
              <Calendar size={16} className="text-indigo-600" />
              Calendario de Cobros
            </h3>
            <div className="space-y-4">
              {[
                { client: 'Empresa Cliente A', amount: 1320, date: '15 Mar', status: 'Próximo' },
                { client: 'Restaurante El Lago', amount: 850, date: '18 Mar', status: 'Pendiente' },
                { client: 'Hotel Central', amount: 2400, date: '22 Mar', status: 'Pendiente' },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div>
                    <p className="text-xs font-black text-slate-900 uppercase">{item.client}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{item.date}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-slate-900">{formatCurrency(item.amount)}</p>
                    <span className="text-[8px] font-black uppercase tracking-widest text-amber-600">{item.status}</span>
                  </div>
                </div>
              ))}
            </div>
            <button className="w-full mt-6 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all">
              Ver Calendario Completo
            </button>
          </div>

          <div className="bg-indigo-600 text-white p-8 rounded-3xl shadow-xl shadow-indigo-100">
            <h3 className="text-[10px] font-black text-indigo-200 uppercase tracking-widest mb-6">Resumen de Impuestos (IVA)</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-indigo-100">IVA Repercutido (21%)</span>
                <span className="text-sm font-black">1.240,50 €</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-indigo-100">IVA Repercutido (10%)</span>
                <span className="text-sm font-black">602,00 €</span>
              </div>
              <div className="h-px bg-white/10 my-4" />
              <div className="flex justify-between items-center">
                <span className="text-xs font-black uppercase tracking-widest">Total a Liquidar</span>
                <span className="text-xl font-black text-emerald-400">1.842,50 €</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {view === 'forecast' && (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Proyección de Ventas IA (4 Semanas)</h3>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Basado en histórico, festivos y marketing</p>
                </div>
                <div className="flex gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-indigo-500" />
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Real</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-indigo-200" />
                    <span className="text-[10px] font-bold text-slate-500 uppercase">IA Predicted</span>
                  </div>
                </div>
              </div>
              <div className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%" minHeight={350}>
                  <AreaChart data={forecastData}>
                    <defs>
                      <linearGradient id="colorForecast" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
                      tickFormatter={(value) => `${value}€`}
                    />
                    <Tooltip 
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      itemStyle={{ fontSize: '12px', fontWeight: 700 }}
                    />
                    <Area type="monotone" dataKey="revenue" stroke="#4f46e5" strokeWidth={3} fill="url(#colorForecast)" />
                    <Area type="monotone" dataKey="predicted" stroke="#c7d2fe" strokeWidth={2} strokeDasharray="5 5" fill="none" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-indigo-900 text-white p-8 rounded-3xl shadow-xl shadow-indigo-100">
                <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center mb-6">
                  <Brain size={24} className="text-indigo-300" />
                </div>
                <h3 className="text-xl font-black uppercase tracking-tight mb-4">Insights de IA</h3>
                <div className="space-y-4">
                  <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                    <p className="text-xs font-bold text-indigo-300 uppercase tracking-widest mb-1">Impacto Festivos</p>
                    <p className="text-sm text-indigo-100 leading-relaxed">Se prevé un incremento del 15% en la Semana 3 debido a la Semana Santa y festivos locales.</p>
                  </div>
                  <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                    <p className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-1">Marketing ROI</p>
                    <p className="text-sm text-indigo-100 leading-relaxed">La campaña "Primavera" está traccionando un 8% más de lo esperado en reservas anticipadas.</p>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2 uppercase tracking-tight text-xs">
                  <Calculator size={16} className="text-indigo-600" />
                  Simulador de Ventas IA
                </h4>
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Aumento de Tráfico (%)</label>
                    <input type="range" className="w-full accent-indigo-600" min="0" max="100" defaultValue="10" />
                  </div>
                  <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                    <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Impacto Estimado</p>
                    <p className="text-lg font-black text-emerald-900">+2.450 € / mes</p>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2 uppercase tracking-tight text-xs">
                  <Calendar size={16} className="text-indigo-600" />
                  Eventos Próximos
                </h4>
                <div className="space-y-3">
                  {forecastData.map((d, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                      <span className="text-xs font-bold text-slate-600">{d.name}</span>
                      <div className="flex gap-1">
                        {d.events.map((e, j) => (
                          <span key={j} className="px-2 py-0.5 bg-indigo-100 text-indigo-600 rounded text-[8px] font-black uppercase">{e}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {view === 'list' ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-200">
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Nº Factura</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Cliente</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Fecha</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Tipo</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Total</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Estado</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Verifactu</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {mockCustomerInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/30 transition-colors group">
                    <td className="px-6 py-4">
                      <span className="text-sm font-mono font-bold text-slate-700">{inv.number}</span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-semibold text-slate-900">{inv.receiver.name}</p>
                      <p className="text-xs text-slate-400">{inv.receiver.taxId}</p>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {formatDate(inv.date)}
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                        inv.type === 'Individual' ? "bg-blue-50 text-blue-600" : "bg-purple-50 text-purple-600"
                      )}>
                        {inv.type === 'Individual' ? <FileText size={10} /> : <Layers size={10} />}
                        {inv.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-slate-900">
                      {formatCurrency(inv.total)}
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold",
                        inv.status === 'Cobrada' ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                      )}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {inv.verifactuStatus === 'Enviado' ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 text-[10px] font-black uppercase tracking-widest">
                          <ShieldCheck size={12} />
                          Certificado
                        </span>
                      ) : (
                        <button 
                          onClick={() => handleSendVerifactu(inv.id)}
                          disabled={isSendingVerifactu === inv.id}
                          className="flex items-center gap-1 text-indigo-600 hover:text-indigo-700 text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
                        >
                          {isSendingVerifactu === inv.id ? (
                            <div className="w-3 h-3 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Send size={12} />
                          )}
                          Enviar AEAT
                        </button>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all">
                        <Download size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Users size={18} className="text-emerald-600" />
                Datos del Cliente
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nombre / Razón Social</label>
                  <input type="text" className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/20" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">CIF / NIF</label>
                  <input type="text" className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/20" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Dirección Fiscal</label>
                  <input type="text" className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/20" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <h3 className="font-bold text-slate-800">Tickets Pendientes de Facturar</h3>
                <span className="text-xs font-medium text-slate-500">{selectedTickets.length} seleccionados</span>
              </div>
              <div className="divide-y divide-slate-50">
                {mockTickets.map((ticket) => (
                  <div 
                    key={ticket.id} 
                    onClick={() => toggleTicket(ticket.id)}
                    className={cn(
                      "flex items-center justify-between p-4 cursor-pointer transition-colors",
                      selectedTickets.includes(ticket.id) ? "bg-emerald-50/50" : "hover:bg-slate-50"
                    )}
                  >
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "w-5 h-5 rounded border flex items-center justify-center transition-all",
                        selectedTickets.includes(ticket.id) ? "bg-emerald-500 border-emerald-500 text-white" : "border-slate-300 bg-white"
                      )}>
                        {selectedTickets.includes(ticket.id) && <CheckCircle2 size={12} />}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">{ticket.number}</p>
                        <p className="text-xs text-slate-500">{formatDate(ticket.date)}</p>
                      </div>
                    </div>
                    <p className="text-sm font-bold text-slate-900">{ticket.total.toFixed(2)} €</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-slate-900 text-white p-8 rounded-3xl shadow-xl shadow-slate-200 relative overflow-hidden">
              <h3 className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-6">Resumen de Factura</h3>
              <div className="space-y-4">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Subtotal</span>
                  <span className="font-mono">{(selectedTickets.length * 50).toFixed(2)} €</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">IVA (10%)</span>
                  <span className="font-mono">{(selectedTickets.length * 5).toFixed(2)} €</span>
                </div>
                <div className="h-px bg-white/10 my-4" />
                <div className="flex justify-between items-end">
                  <span className="text-slate-400 text-xs font-bold uppercase">Total Factura</span>
                  <span className="text-3xl font-bold text-emerald-400">{(selectedTickets.length * 55).toFixed(2)} €</span>
                </div>
                <div className="bg-white/5 rounded-xl p-4 border border-white/10 space-y-2">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Certificación Verifactu</p>
                  <div className="flex items-center gap-2 text-xs text-emerald-400 font-bold">
                    <ShieldCheck size={14} />
                    Hash Encadenado Activo
                  </div>
                </div>
                <button 
                  disabled={selectedTickets.length === 0}
                  onClick={() => {
                    alert("Factura generada correctamente y enviada a Verifactu (AEAT). Código de registro: VF-" + Math.random().toString(36).substr(2, 9).toUpperCase());
                    setView('list');
                  }}
                  className="w-full mt-6 bg-emerald-500 text-slate-900 py-3 rounded-xl font-bold hover:bg-emerald-400 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <FileText size={18} />
                  Generar Factura Certificada
                </button>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Clock size={18} className="text-amber-500" />
                Integración Tesorería
              </h4>
              <p className="text-xs text-slate-500 leading-relaxed mb-4">
                Al generar la factura, se creará automáticamente un asiento de "Ingreso Pendiente" en el módulo de tesorería.
              </p>
              <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
                <span className="text-sm font-medium text-slate-700">Marcar como cobrada ahora</span>
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
