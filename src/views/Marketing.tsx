import React from 'react';
import { 
  Megaphone, 
  Users, 
  Target, 
  TrendingUp, 
  Plus, 
  Mail, 
  Instagram, 
  Facebook, 
  Calendar,
  BarChart3,
  Sparkles,
  ArrowUpRight
} from 'lucide-react';
import { cn, formatCurrency } from '../lib/utils';

const MarketingView = () => {
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [isPredicting, setIsPredicting] = React.useState(false);
  const [isSegmenting, setIsSegmenting] = React.useState(false);

  const campaigns = [
    { id: '1', name: 'Menú Degustación Primavera', platform: 'Instagram', budget: 500, spent: 320, roi: '+240%', status: 'Activa', reach: '12.4k' },
    { id: '2', name: 'Afterwork Jueves', platform: 'Facebook', budget: 200, spent: 200, roi: '+115%', status: 'Finalizada', reach: '5.2k' },
    { id: '3', name: 'Campaña Fidelización Email', platform: 'Email', budget: 50, spent: 10, roi: '+450%', status: 'Activa', reach: '1.1k' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-fuchsia-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-fuchsia-100">
            <Megaphone size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Marketing & Publicidad</h1>
            <p className="text-slate-500 text-sm">Gestiona tus campañas y fideliza a tus clientes.</p>
          </div>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-2xl text-sm font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
        >
          <Plus size={18} /> Nueva Campaña
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 bg-white rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
              <Users size={20} />
            </div>
            <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">Base de Datos</p>
          </div>
          <p className="text-3xl font-black text-slate-900">2.450</p>
          <p className="text-xs text-emerald-600 font-bold mt-1 flex items-center gap-1">
            <TrendingUp size={14} /> +12 este mes
          </p>
        </div>
        <div className="p-6 bg-white rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-fuchsia-50 text-fuchsia-600 rounded-xl flex items-center justify-center">
              <Target size={20} />
            </div>
            <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">ROI Promedio</p>
          </div>
          <p className="text-3xl font-black text-slate-900">285%</p>
          <p className="text-xs text-fuchsia-600 font-bold mt-1">Rentabilidad excelente</p>
        </div>
        <div className="p-6 bg-white rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
              <Sparkles size={20} />
            </div>
            <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">Puntos Fidelidad</p>
          </div>
          <p className="text-3xl font-black text-slate-900">145k</p>
          <p className="text-xs text-blue-600 font-bold mt-1">Emitidos este año</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800">Campañas Activas</h3>
              <BarChart3 size={20} className="text-slate-400" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-100">
                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Campaña</th>
                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Plataforma</th>
                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">ROI</th>
                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Alcance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {campaigns.map((camp) => (
                    <tr key={camp.id} className="hover:bg-slate-50/30 transition-colors group">
                      <td className="px-8 py-4">
                        <p className="text-sm font-black text-slate-900">{camp.name}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">{camp.status}</p>
                      </td>
                      <td className="px-8 py-4">
                        <div className="flex items-center gap-2">
                          {camp.platform === 'Instagram' && <Instagram size={14} className="text-pink-600" />}
                          {camp.platform === 'Facebook' && <Facebook size={14} className="text-blue-600" />}
                          {camp.platform === 'Email' && <Mail size={14} className="text-amber-600" />}
                          <span className="text-xs font-bold text-slate-600">{camp.platform}</span>
                        </div>
                      </td>
                      <td className="px-8 py-4 text-center">
                        <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">{camp.roi}</span>
                      </td>
                      <td className="px-8 py-4 text-right text-sm font-black text-slate-700">{camp.reach}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-slate-900 text-white p-8 rounded-3xl shadow-xl shadow-slate-200">
            <h3 className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-6">Próximos Eventos</h3>
            <div className="space-y-6">
              {[
                { date: '15 Mar', title: 'Cata de Vinos Priorat', icon: Calendar },
                { date: '22 Mar', title: 'Música en Vivo: Jazz Night', icon: Calendar },
                { date: '01 Abr', title: 'Lanzamiento Carta Verano', icon: Sparkles },
              ].map((event, i) => (
                <div key={i} className="flex items-center gap-4 group cursor-pointer">
                  <div className="w-12 h-12 bg-white/10 rounded-2xl flex flex-col items-center justify-center group-hover:bg-fuchsia-600 transition-all">
                    <span className="text-[10px] font-black uppercase">{event.date.split(' ')[1]}</span>
                    <span className="text-sm font-black">{event.date.split(' ')[0]}</span>
                  </div>
                  <div>
                    <p className="text-sm font-bold group-hover:text-fuchsia-400 transition-colors">{event.title}</p>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">Planificado</p>
                  </div>
                </div>
              ))}
            </div>
            <button className="w-full mt-8 bg-white/10 hover:bg-white/20 text-white py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all">
              Ver Calendario
            </button>
          </div>

          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
            <h3 className="text-slate-900 text-sm font-black uppercase tracking-widest mb-6">Fidelización</h3>
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <p className="text-xs font-bold text-slate-400 uppercase mb-1">Clientes VIP</p>
                <div className="flex items-center justify-between">
                  <span className="text-xl font-black text-slate-900">124</span>
                  <ArrowUpRight size={20} className="text-emerald-500" />
                </div>
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <p className="text-xs font-bold text-slate-400 uppercase mb-1">Cupones Canjeados</p>
                <div className="flex items-center justify-between">
                  <span className="text-xl font-black text-slate-900">45</span>
                  <span className="text-[10px] font-black text-slate-400">ESTE MES</span>
                </div>
              </div>
              <button 
                onClick={() => {
                  setIsSegmenting(true);
                  setTimeout(() => {
                    setIsSegmenting(false);
                    alert('Base de datos segmentada por IA: 3 nuevos grupos de interés identificados (Foodies, Familias, Afterwork).');
                  }, 2000);
                }}
                disabled={isSegmenting}
                className="w-full py-3 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Sparkles size={14} className={cn(isSegmenting && "animate-pulse")} />
                {isSegmenting ? "Segmentando..." : "Segmentar con IA"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] w-full max-w-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-10 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Nueva Campaña</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-3 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-2xl transition-all">
                <Plus size={28} className="rotate-45" />
              </button>
            </div>
            <div className="p-10 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nombre de la Campaña</label>
                <input type="text" className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-sm font-medium focus:ring-2 focus:ring-fuchsia-500 transition-all" placeholder="Ej: Especial San Valentín" />
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Plataforma</label>
                  <select className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-sm font-medium focus:ring-2 focus:ring-fuchsia-500 transition-all">
                    <option>Instagram</option>
                    <option>Facebook</option>
                    <option>Google Ads</option>
                    <option>Email Marketing</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Presupuesto (€)</label>
                  <input type="number" className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-sm font-medium focus:ring-2 focus:ring-fuchsia-500 transition-all" placeholder="0.00" />
                </div>
              </div>
              
              <div className="p-6 bg-indigo-50 rounded-[2rem] border border-indigo-100 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles size={18} className="text-indigo-600" />
                    <span className="text-xs font-black text-indigo-900 uppercase tracking-tight">Predicción de ROI IA</span>
                  </div>
                  <button 
                    onClick={() => {
                      setIsPredicting(true);
                      setTimeout(() => setIsPredicting(false), 2000);
                    }}
                    disabled={isPredicting}
                    className="text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:underline disabled:opacity-50"
                  >
                    {isPredicting ? "Calculando..." : "Calcular"}
                  </button>
                </div>
                {!isPredicting && (
                  <p className="text-xs text-indigo-700 font-medium leading-relaxed">
                    Basado en campañas anteriores similares, estimamos un ROI de <span className="font-black">2.8x - 3.5x</span> y un alcance de <span className="font-black">8k - 12k</span> personas.
                  </p>
                )}
              </div>

              <button 
                onClick={() => setIsModalOpen(false)}
                className="w-full bg-slate-900 text-white py-5 rounded-[2rem] font-black uppercase tracking-[0.2em] hover:bg-slate-800 transition-all shadow-xl mt-4"
              >
                Lanzar Campaña
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MarketingView;
