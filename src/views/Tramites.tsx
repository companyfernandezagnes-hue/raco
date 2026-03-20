import React from 'react';
import { 
  FileText, 
  Search, 
  Plus, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight,
  Download,
  Eye,
  Filter,
  Calendar,
  Building2,
  Scale,
  ShieldCheck,
  Sparkles,
  MessageSquare,
  Info,
  Lightbulb
} from 'lucide-react';
import { cn, formatDate } from '../lib/utils';

interface Tramite {
  id: string;
  title: string;
  category: 'Administrativo' | 'Legal' | 'Sanitario' | 'Laboral';
  status: 'Pendiente' | 'En Proceso' | 'Completado' | 'Vencido';
  dueDate: string;
  description: string;
  assignedTo: string;
}

const mockTramites: Tramite[] = [
  {
    id: '1',
    title: 'Renovación Licencia de Terraza',
    category: 'Administrativo',
    status: 'En Proceso',
    dueDate: '2026-04-15',
    description: 'Trámite anual con el ayuntamiento para la ocupación de vía pública.',
    assignedTo: 'Gestoría Arcos'
  },
  {
    id: '2',
    title: 'Inspección Sanitaria Periódica',
    category: 'Sanitario',
    status: 'Pendiente',
    dueDate: '2026-03-25',
    description: 'Revisión de protocolos APPCC y estado de cocina.',
    assignedTo: 'Encargado de Cocina'
  },
  {
    id: '3',
    title: 'Actualización Contratos Temporales',
    category: 'Laboral',
    status: 'Completado',
    dueDate: '2026-03-01',
    description: 'Prórroga de contratos para la campaña de primavera.',
    assignedTo: 'RRHH'
  },
  {
    id: '4',
    title: 'Certificado de Manipulador de Alimentos',
    category: 'Sanitario',
    status: 'Vencido',
    dueDate: '2026-02-15',
    description: 'Renovación del carnet para 2 nuevos empleados.',
    assignedTo: 'Encargado'
  }
];

export default function TramitesView() {
  const [search, setSearch] = React.useState('');
  const [filter, setFilter] = React.useState('Todos');

  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [newTramite, setNewTramite] = React.useState<Partial<Tramite>>({
    title: '',
    category: 'Administrativo',
    status: 'Pendiente',
    dueDate: new Date().toISOString().split('T')[0],
    description: '',
    assignedTo: ''
  });

  const handleCreateTramite = () => {
    // In a real app, this would save to Firestore
    console.log('Creating tramite:', newTramite);
    setIsModalOpen(false);
    setNewTramite({
      title: '',
      category: 'Administrativo',
      status: 'Pendiente',
      dueDate: new Date().toISOString().split('T')[0],
      description: '',
      assignedTo: ''
    });
  };

  const filteredTramites = mockTramites.filter(t => 
    (filter === 'Todos' ? true : t.category === filter) &&
    (t.title.toLowerCase().includes(search.toLowerCase()) || t.description.toLowerCase().includes(search.toLowerCase()))
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Completado': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      case 'En Proceso': return 'bg-indigo-50 text-indigo-600 border-indigo-100';
      case 'Pendiente': return 'bg-amber-50 text-amber-600 border-amber-100';
      case 'Vencido': return 'bg-rose-50 text-rose-600 border-rose-100';
      default: return 'bg-slate-50 text-slate-600 border-slate-100';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Administrativo': return <Building2 size={20} />;
      case 'Legal': return <Scale size={20} />;
      case 'Sanitario': return <ShieldCheck size={20} />;
      case 'Laboral': return <FileText size={20} />;
      default: return <FileText size={20} />;
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 flex items-center gap-3">
            <div className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100">
              <Scale size={24} />
            </div>
            Gestión de Trámites
          </h1>
          <p className="text-slate-500 text-sm mt-1 font-medium">Control de licencias, inspecciones y gestiones administrativas.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-4 rounded-[2rem] text-sm font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100"
        >
          <Plus size={18} />
          Nuevo Trámite
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Total Trámites', value: mockTramites.length, icon: FileText, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { label: 'Pendientes', value: mockTramites.filter(t => t.status === 'Pendiente').length, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'En Proceso', value: mockTramites.filter(t => t.status === 'En Proceso').length, icon: ArrowRight, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Vencidos', value: mockTramites.filter(t => t.status === 'Vencido').length, icon: AlertCircle, color: 'text-rose-600', bg: 'bg-rose-50' },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
            <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center mb-4", stat.bg, stat.color)}>
              <stat.icon size={24} />
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</p>
            <p className="text-3xl font-black text-slate-900 mt-1">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* AI Legal Assistant & Regulatory Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-slate-900 rounded-[3rem] p-8 text-white relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-12 opacity-10 group-hover:opacity-20 transition-opacity">
            <Scale size={120} />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center">
                <Sparkles size={20} className="text-white" />
              </div>
              <h3 className="text-xl font-black uppercase tracking-tight">Asistente Legal IA</h3>
            </div>
            <p className="text-slate-400 text-sm font-medium mb-8 max-w-xl">
              Consulta cualquier duda sobre normativas locales, requisitos de licencias o cambios en la legislación hostelera. Nuestra IA analiza el BOE y normativas municipales en tiempo real.
            </p>
            <div className="flex gap-4">
              <div className="flex-1 relative">
                <MessageSquare className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input 
                  type="text" 
                  placeholder="¿Qué requisitos necesito para la nueva ley de desperdicio alimentario?" 
                  className="w-full pl-12 pr-6 py-4 bg-white/10 border border-white/10 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                />
              </div>
              <button className="bg-indigo-600 text-white px-8 py-4 rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20">
                Consultar
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[3rem] p-8 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">Alertas Regulatorias</h3>
            <div className="w-8 h-8 bg-amber-50 text-amber-600 rounded-lg flex items-center justify-center">
              <Info size={16} />
            </div>
          </div>
          <div className="space-y-4">
            {[
              { title: 'Nueva Ley Desperdicio', date: 'Vigor: 01/05/2026', impact: 'Alto', color: 'text-rose-600', bg: 'bg-rose-50' },
              { title: 'Normativa Terrazas 2026', date: 'Revisión: 15/04/2026', impact: 'Medio', color: 'text-amber-600', bg: 'bg-amber-50' },
              { title: 'Actualización Convenio', date: 'Publicado: BOE 12/03', impact: 'Bajo', color: 'text-emerald-600', bg: 'bg-emerald-50' },
            ].map((alert, i) => (
              <div key={i} className="flex items-start gap-4 p-4 rounded-2xl hover:bg-slate-50 transition-all cursor-pointer group">
                <div className={cn("w-2 h-12 rounded-full", alert.bg.replace('bg-', 'bg-opacity-50 bg-'))} />
                <div>
                  <p className="text-xs font-black text-slate-900 group-hover:text-indigo-600 transition-colors">{alert.title}</p>
                  <p className="text-[10px] text-slate-500 font-bold mt-0.5">{alert.date}</p>
                  <div className="flex items-center gap-1 mt-2">
                    <span className={cn("text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md", alert.bg, alert.color)}>
                      Impacto {alert.impact}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button className="w-full mt-6 py-3 text-xs font-black uppercase tracking-widest text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all flex items-center justify-center gap-2">
            <Lightbulb size={14} />
            Ver Análisis de Impacto IA
          </button>
        </div>
      </div>

      <div className="bg-white rounded-[3rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-slate-100 bg-slate-50/30 flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Buscar trámites..." 
              className="w-full pl-12 pr-6 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 transition-all"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0">
            {['Todos', 'Administrativo', 'Legal', 'Sanitario', 'Laboral'].map(cat => (
              <button
                key={cat}
                onClick={() => setFilter(cat)}
                className={cn(
                  "px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap",
                  filter === cat 
                    ? "bg-slate-900 text-white shadow-lg" 
                    : "bg-white text-slate-500 border border-slate-200 hover:bg-slate-50"
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Trámite</th>
                <th className="px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Categoría</th>
                <th className="px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Vencimiento</th>
                <th className="px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Estado</th>
                <th className="px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Asignado</th>
                <th className="px-8 py-5 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTramites.map((tramite) => (
                <tr key={tramite.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-4">
                      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", getStatusColor(tramite.status))}>
                        {getCategoryIcon(tramite.category)}
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-900">{tramite.title}</p>
                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{tramite.description}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <span className="text-xs font-bold text-slate-600">{tramite.category}</span>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                      <Calendar size={14} className="text-slate-400" />
                      {formatDate(tramite.dueDate)}
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <span className={cn("px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border", getStatusColor(tramite.status))}>
                      {tramite.status}
                    </span>
                  </td>
                  <td className="px-8 py-6">
                    <span className="text-xs font-bold text-slate-600">{tramite.assignedTo}</span>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all">
                        <Eye size={18} />
                      </button>
                      <button className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all">
                        <Download size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[3rem] w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-indigo-600 text-white">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
                  <Plus size={24} />
                </div>
                <h2 className="text-xl font-black uppercase tracking-tight">Nuevo Trámite</h2>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-xl transition-all">
                <Plus size={24} className="rotate-45" />
              </button>
            </div>
            <div className="p-8 space-y-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Título del Trámite</label>
                <input 
                  type="text" 
                  value={newTramite.title}
                  onChange={e => setNewTramite({...newTramite, title: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                  placeholder="Ej: Renovación Licencia Terraza"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Categoría</label>
                  <select 
                    value={newTramite.category}
                    onChange={e => setNewTramite({...newTramite, category: e.target.value as any})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                  >
                    <option value="Administrativo">Administrativo</option>
                    <option value="Legal">Legal</option>
                    <option value="Sanitario">Sanitario</option>
                    <option value="Laboral">Laboral</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Vencimiento</label>
                  <input 
                    type="date" 
                    value={newTramite.dueDate}
                    onChange={e => setNewTramite({...newTramite, dueDate: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Asignado a</label>
                <input 
                  type="text" 
                  value={newTramite.assignedTo}
                  onChange={e => setNewTramite({...newTramite, assignedTo: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                  placeholder="Ej: Gestoría Arcos"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Descripción</label>
                <textarea 
                  value={newTramite.description}
                  onChange={e => setNewTramite({...newTramite, description: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 transition-all outline-none h-24 resize-none"
                  placeholder="Detalles del trámite..."
                />
              </div>
              <button 
                onClick={handleCreateTramite}
                className="w-full bg-indigo-600 text-white py-4 rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 mt-4"
              >
                Crear Trámite
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
