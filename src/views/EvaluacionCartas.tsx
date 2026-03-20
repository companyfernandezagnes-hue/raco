import React from 'react';
import { 
  Table as TableIcon, 
  TrendingUp, 
  TrendingDown, 
  Zap, 
  Sparkles, 
  ChevronRight, 
  Download, 
  FileSpreadsheet,
  PieChart,
  Target,
  AlertCircle,
  CheckCircle2,
  Info
} from 'lucide-react';
import { MenuEvaluation } from '../types';
import { cn, formatDate } from '../lib/utils';

const mockEvaluations: MenuEvaluation[] = [
  {
    id: 'e1',
    menuName: 'Carta de Apertura - Almuerzos',
    items: [
      { id: 'm1', name: 'Spider Tartar', cost: 4.50, price: 18.00, popularity: 85, margin: 75, classification: 'Estrella' },
      { id: 'm2', name: 'Arroz Senyoret', cost: 6.20, price: 22.00, popularity: 45, margin: 72, classification: 'Puzzle' },
      { id: 'm3', name: 'Croquetas Jamón', cost: 0.80, price: 3.50, popularity: 95, margin: 77, classification: 'Estrella' },
      { id: 'm4', name: 'Sopa Cebolla', cost: 2.10, price: 8.50, popularity: 20, margin: 75, classification: 'Perro' },
      { id: 'm5', name: 'Burger Gourmet', cost: 5.50, price: 16.00, popularity: 70, margin: 65, classification: 'Vaca' },
    ],
    totalItems: 5,
    averageMargin: 72.8,
    aiRecommendations: [
      'El Spider Tartar es tu mejor activo. Considera una versión "Premium" con un ligero incremento de precio.',
      'El Arroz Senyoret necesita más visibilidad. Muévelo a la parte superior derecha de la carta física.',
      'La Sopa de Cebolla tiene un coste de oportunidad alto. Sustitúyela por una crema de temporada.'
    ],
    lastUpdated: '2026-03-10'
  }
];

export default function EvaluacionCartasView() {
  const [selectedEvalId, setSelectedEvalId] = React.useState<string>(mockEvaluations[0].id);
  const selectedEval = mockEvaluations.find(e => e.id === selectedEvalId) || mockEvaluations[0];

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <FileSpreadsheet className="text-indigo-600" />
            Evaluación de Cartas
          </h1>
          <p className="text-slate-500 text-sm">Análisis detallado de rentabilidad y popularidad estilo Excel.</p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-all">
            <Download size={18} />
            Exportar Excel
          </button>
          <button 
            onClick={() => alert('Simulación de cambios completada. Rentabilidad proyectada: +4.5%')}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-all shadow-sm shadow-indigo-100"
          >
            <Zap size={18} />
            Simular Cambios
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Stats Summary */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Métricas Globales</h3>
            <div className="space-y-6">
              <div>
                <p className="text-xs text-slate-500 font-bold uppercase">Margen Bruto Medio</p>
                <div className="flex items-end gap-2 mt-1">
                  <p className="text-3xl font-black text-slate-900">{selectedEval.averageMargin}%</p>
                  <span className="text-emerald-500 text-xs font-bold flex items-center mb-1">
                    <TrendingUp size={14} /> +2.4%
                  </span>
                </div>
              </div>
              <div className="h-px bg-slate-100" />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Platos Analizados</p>
                  <p className="text-xl font-black text-slate-900">{selectedEval.totalItems}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Rentabilidad</p>
                  <p className="text-xl font-black text-emerald-600">Alta</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 text-white p-6 rounded-[2.5rem] shadow-xl shadow-slate-200">
            <div className="flex items-center gap-2 mb-6">
              <Sparkles className="text-indigo-400" size={20} />
              <h4 className="text-xs font-black uppercase tracking-widest">Sugerencias IA</h4>
            </div>
            <div className="space-y-4">
              {selectedEval.aiRecommendations.map((rec, i) => (
                <div key={i} className="flex gap-3 text-xs leading-relaxed text-slate-300 bg-white/5 p-3 rounded-2xl border border-white/10">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0 mt-1" />
                  {rec}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Excel-like Table */}
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center">
                  <TableIcon size={20} />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 uppercase tracking-tight">{selectedEval.menuName}</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Última revisión: {formatDate(selectedEval.lastUpdated)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-slate-400 uppercase bg-slate-100 px-3 py-1 rounded-full">Borrador v2.1</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Nombre del Ítem</th>
                    <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Coste (€)</th>
                    <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Precio (€)</th>
                    <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Margen %</th>
                    <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Popularidad</th>
                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Clasificación</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {selectedEval.items.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-8 py-4">
                        <p className="text-sm font-bold text-slate-900">{item.name}</p>
                      </td>
                      <td className="px-4 py-4 text-center font-mono text-sm text-slate-500">
                        {item.cost.toFixed(2)}
                      </td>
                      <td className="px-4 py-4 text-center font-mono text-sm font-bold text-slate-900">
                        {item.price.toFixed(2)}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className={cn(
                          "text-xs font-black",
                          item.margin >= 70 ? "text-emerald-600" : "text-amber-600"
                        )}>
                          {item.margin}%
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-col items-center gap-1">
                          <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className={cn(
                                "h-full rounded-full",
                                item.popularity >= 70 ? "bg-emerald-500" : 
                                item.popularity >= 40 ? "bg-blue-500" : "bg-rose-500"
                              )}
                              style={{ width: `${item.popularity}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-bold text-slate-400">{item.popularity}%</span>
                        </div>
                      </td>
                      <td className="px-8 py-4 text-right">
                        <span className={cn(
                          "text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest",
                          item.classification === 'Estrella' ? "bg-emerald-100 text-emerald-700" :
                          item.classification === 'Puzzle' ? "bg-blue-100 text-blue-700" :
                          item.classification === 'Vaca' ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700"
                        )}>
                          {item.classification}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
              <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <PieChart size={16} className="text-indigo-600" />
                Mix de Ventas Proyectado
              </h4>
              <div className="space-y-4">
                {[
                  { label: 'Entrantes', value: 35, color: 'bg-indigo-500' },
                  { label: 'Principales', value: 45, color: 'bg-emerald-500' },
                  { label: 'Postres', value: 12, color: 'bg-amber-500' },
                  { label: 'Bebidas', value: 8, color: 'bg-rose-500' },
                ].map((cat) => (
                  <div key={cat.label} className="space-y-1">
                    <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-slate-500">
                      <span>{cat.label}</span>
                      <span>{cat.value}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className={cn("h-full", cat.color)} style={{ width: `${cat.value}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
              <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Target size={16} className="text-indigo-600" />
                Objetivos de Rentabilidad
              </h4>
              <div className="space-y-4">
                <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-center gap-4">
                  <CheckCircle2 className="text-emerald-600" size={20} />
                  <div>
                    <p className="text-xs font-bold text-emerald-900 uppercase">Coste Materia Prima</p>
                    <p className="text-sm text-emerald-700">Objetivo: 28% | Actual: 27.2%</p>
                  </div>
                </div>
                <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex items-center gap-4">
                  <AlertCircle className="text-amber-600" size={20} />
                  <div>
                    <p className="text-xs font-bold text-amber-900 uppercase">Ticket Medio Proyectado</p>
                    <p className="text-sm text-amber-700">Objetivo: 45€ | Actual: 42.50€</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
