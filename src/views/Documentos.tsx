import React from 'react';
import { 
  FileText, 
  Search, 
  Filter, 
  Download, 
  Eye, 
  Trash2, 
  Plus, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  Folder,
  ChevronRight,
  MoreVertical,
  Share2,
  Upload,
  X
} from 'lucide-react';
import { Document } from '../types';
import { cn, formatDate } from '../lib/utils';

const mockDocuments: Document[] = [
  { id: 'd1', name: 'Factura_Carnes_Selectas_Marzo.pdf', type: 'Factura', module: 'Compras', date: '2026-03-10', url: '#', status: 'Procesado', relatedId: 'inv-123' },
  { id: 'd2', name: 'Albaran_Pescados_Frescos_0903.pdf', type: 'Albarán', module: 'Compras', date: '2026-03-09', url: '#', status: 'Procesado', relatedId: 'alb-456' },
  { id: 'd3', name: 'Contrato_Juan_Perez_2026.pdf', type: 'Contrato', module: 'Personal', date: '2026-03-01', url: '#', status: 'Procesado', relatedId: 'emp-789' },
  { id: 'd4', name: 'Modelo_303_IVA_Q1.pdf', type: 'Impuesto', module: 'Tesorería', date: '2026-03-01', url: '#', status: 'Pendiente' },
  { id: 'd5', name: 'Factura_Agua_Febrero.pdf', type: 'Factura', module: 'Compras', date: '2026-02-28', url: '#', status: 'Procesado' },
  { id: 'd6', name: 'Albaran_Bebidas_CocaCola.pdf', type: 'Albarán', module: 'Compras', date: '2026-03-10', url: '#', status: 'Error' },
];

export default function DocumentosView() {
  const [filter, setFilter] = React.useState<'Todos' | 'Compras' | 'Ventas' | 'Personal' | 'Tesorería'>('Todos');
  const [search, setSearch] = React.useState('');

  const [isUploadModalOpen, setIsUploadModalOpen] = React.useState(false);
  const [newDocument, setNewDocument] = React.useState({
    name: '',
    category: 'Legal',
    date: new Date().toISOString().split('T')[0]
  });

  const handleUploadDocument = () => {
    // In a real app, this would upload to Storage and save to Firestore
    console.log('Uploading document:', newDocument);
    setIsUploadModalOpen(false);
    alert('Documento subido correctamente.');
  };

  const filteredDocs = mockDocuments.filter(doc => 
    (filter === 'Todos' ? true : doc.module === filter) &&
    doc.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Folder className="text-emerald-600" />
            Gestor Documental
          </h1>
          <p className="text-slate-500 text-sm">Repositorio centralizado de facturas, albaranes y contratos.</p>
        </div>
        <button 
          onClick={() => setIsUploadModalOpen(true)}
          className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-emerald-700 transition-all shadow-sm shadow-emerald-100"
        >
          <Plus size={18} />
          Subir Documento
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2 uppercase text-xs tracking-widest">
              Módulos
            </h3>
            <div className="space-y-1">
              {(['Todos', 'Compras', 'Ventas', 'Personal', 'Tesorería'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setFilter(m)}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm font-medium transition-all",
                    filter === m ? "bg-emerald-50 text-emerald-700 shadow-sm" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Folder size={18} className={filter === m ? "text-emerald-600" : "text-slate-400"} />
                    {m}
                  </div>
                  <ChevronRight size={14} className={filter === m ? "opacity-100" : "opacity-0"} />
                </button>
              ))}
            </div>
          </div>

          <div className="bg-emerald-900 text-white p-6 rounded-3xl shadow-xl shadow-emerald-100">
            <h3 className="text-xs font-black uppercase tracking-widest mb-4 opacity-70">Almacenamiento</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span>Uso de Disco</span>
                <span className="font-black">1.2 GB / 5 GB</span>
              </div>
              <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                <div className="bg-emerald-400 h-full w-[24%]" />
              </div>
              <p className="text-[10px] opacity-50 font-bold uppercase tracking-tighter pt-2">24% del límite gratuito</p>
            </div>
          </div>
        </div>

        <div className="lg:col-span-3 space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input 
                  type="text" 
                  placeholder="Buscar documentos..." 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 pr-4 py-2 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 transition-all w-full"
                />
              </div>
              <button className="flex items-center gap-2 text-slate-500 hover:text-slate-700 text-xs font-bold uppercase tracking-widest">
                <Filter size={16} />
                Filtros Avanzados
              </button>
            </div>

            <div className="divide-y divide-slate-50">
              {filteredDocs.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between p-6 hover:bg-slate-50/50 transition-colors group">
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-12 h-12 rounded-2xl flex items-center justify-center",
                      doc.type === 'Factura' ? "bg-blue-50 text-blue-600" : 
                      doc.type === 'Albarán' ? "bg-amber-50 text-amber-600" :
                      doc.type === 'Contrato' ? "bg-purple-50 text-purple-600" :
                      "bg-slate-50 text-slate-600"
                    )}>
                      <FileText size={24} />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 group-hover:text-emerald-600 transition-colors">{doc.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs font-medium text-slate-400">{formatDate(doc.date)}</span>
                        <span className="text-slate-200">•</span>
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-tight">{doc.type}</span>
                        <span className="text-slate-200">•</span>
                        <span className="text-xs font-medium text-slate-400 uppercase tracking-tighter">{doc.module}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right hidden sm:block">
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-[10px] font-black uppercase",
                        doc.status === 'Procesado' ? "bg-emerald-50 text-emerald-600" : 
                        doc.status === 'Pendiente' ? "bg-amber-50 text-amber-600" :
                        "bg-rose-50 text-rose-600"
                      )}>
                        {doc.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all" title="Ver">
                        <Eye size={18} />
                      </button>
                      <button className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all" title="Descargar">
                        <Download size={18} />
                      </button>
                      <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all" title="Compartir">
                        <Share2 size={18} />
                      </button>
                      <button className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all" title="Eliminar">
                        <Trash2 size={18} />
                      </button>
                    </div>
                    <button className="text-slate-300 hover:text-slate-500 sm:hidden">
                      <MoreVertical size={20} />
                    </button>
                  </div>
                </div>
              ))}
              {filteredDocs.length === 0 && (
                <div className="p-12 text-center space-y-4">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-300">
                    <FileText size={32} />
                  </div>
                  <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No se encontraron documentos</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {isUploadModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[3rem] w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-indigo-600 text-white">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
                  <Upload size={24} />
                </div>
                <h2 className="text-xl font-black uppercase tracking-tight">Subir Documento</h2>
              </div>
              <button onClick={() => setIsUploadModalOpen(false)} className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-xl transition-all">
                <X size={24} />
              </button>
            </div>
            <div className="p-8 space-y-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Nombre del Documento</label>
                <input 
                  type="text" 
                  value={newDocument.name}
                  onChange={e => setNewDocument({...newDocument, name: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                  placeholder="Ej: Factura Luz Enero"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Categoría</label>
                  <select 
                    value={newDocument.category}
                    onChange={e => setNewDocument({...newDocument, category: e.target.value as any})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                  >
                    <option value="Legal">Legal</option>
                    <option value="Fiscal">Fiscal</option>
                    <option value="Laboral">Laboral</option>
                    <option value="Operativo">Operativo</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Fecha</label>
                  <input 
                    type="date" 
                    value={newDocument.date}
                    onChange={e => setNewDocument({...newDocument, date: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                  />
                </div>
              </div>
              <div className="border-2 border-dashed border-slate-200 rounded-[2rem] p-8 text-center hover:border-indigo-400 transition-all cursor-pointer bg-slate-50 group">
                <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm group-hover:scale-110 transition-all">
                  <FileText className="text-indigo-600" size={32} />
                </div>
                <p className="text-sm font-bold text-slate-700">Arrastra archivos aquí o haz clic para buscar</p>
                <p className="text-xs text-slate-400 mt-1">PDF, JPG, PNG hasta 10MB</p>
              </div>
              <button 
                onClick={handleUploadDocument}
                className="w-full bg-indigo-600 text-white py-4 rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 mt-4"
              >
                Subir Archivo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
