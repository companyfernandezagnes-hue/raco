import React, { useMemo, useState, useEffect } from 'react';
import { Truck, CheckCircle2, Clock, Link as LinkIcon, Package, ChevronDown, ChevronUp, Edit2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Albaran, BusinessUnit } from '../../types';
import { Num } from '../../services/engine';
import { cn } from '../../lib/utils';

interface AlbaranesListProps {
  albaranes: Albaran[];
  searchQ: string;
  selectedUnit: BusinessUnit | 'ALL';
  businessUnits: any[];
  onOpenEdit: (albaran: Albaran) => void;
}

const norm = (s?: string) => (s || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const highlight = (text: string, q: string) => {
  if (!q) return text;
  const n = norm(text);
  const nq = norm(q);
  const i = n.indexOf(nq);
  if (i < 0) return text;
  return (
    <>
      {text.slice(0, i)}
      <mark className="bg-amber-200 px-0.5 rounded text-slate-800">{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  );
};

const groupByDateKey = (list: Albaran[]) => {
  const m = new Map<string, Albaran[]>();
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  for (const a of list) {
    const d = (a.date || '').slice(0, 10);
    const key = d === today ? "HOY" : d === yesterday ? "AYER" : d;
    if (!m.has(key)) m.set(key, []);
    m.get(key)!.push(a);
  }
  return m;
};

export const AlbaranesList = React.memo(({ 
  albaranes, searchQ, selectedUnit, businessUnits, onOpenEdit 
}: AlbaranesListProps) => {
  
  const filtered = useMemo(() => {
    const q = norm(searchQ);
    const out = albaranes.filter(a => {
      if (selectedUnit !== 'ALL' && (a.unitId || 'REST') !== selectedUnit) return false;
      if (!q) return true;
      return norm(a.prov).includes(q) || norm(a.num).includes(q) || (a.notes && norm(a.notes).includes(q));
    });
    return out.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
  }, [albaranes, searchQ, selectedUnit]);

  const groups = useMemo(() => groupByDateKey(filtered), [filtered]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (filtered.length === 0) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="py-24 text-center opacity-60 bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center"
      >
        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
          <Truck className="w-8 h-8 text-slate-300" />
        </div>
        <p className="text-slate-500 font-black text-sm uppercase tracking-widest">Sin Registros</p>
        <p className="text-slate-400 text-xs mt-1">No hay albaranes que coincidan con tu búsqueda.</p>
      </motion.div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col max-h-[75vh] mb-20">
      <div className="overflow-x-auto custom-scrollbar flex-1">
        <table className="w-full text-left border-collapse whitespace-nowrap min-w-[900px]">
          <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-20 shadow-sm">
            <tr className="text-[10px] font-bold text-slate-500 uppercase tracking-widest select-none">
              <th className="p-3 w-8 text-center"></th>
              <th className="p-3">Fecha</th>
              <th className="p-3">Ref</th>
              <th className="p-3">Proveedor</th>
              <th className="p-3 text-center">Unidad</th>
              <th className="p-3 text-right">Total</th>
              <th className="p-3 text-center">Estado</th>
              <th className="p-3 text-center">Acciones</th>
            </tr>
          </thead>
          
          <tbody className="divide-y divide-slate-100 text-[11px] font-medium text-slate-700 relative">
            {[...groups.entries()].map(([key, list]) => (
              <React.Fragment key={key}>
                <tr>
                  <td colSpan={8} className="bg-slate-50/80 px-4 py-2 text-[10px] font-black text-indigo-500 uppercase tracking-widest border-y border-slate-200">
                    {key}
                  </td>
                </tr>

                {list.map(a => {
                  const unitConfig = businessUnits.find(u => u.id === (a.unitId || 'REST'));
                  const isExpanded = expandedId === a.id;
                  const hasItems = a.items && a.items.length > 0;

                  return (
                    <React.Fragment key={a.id}>
                      <motion.tr 
                        layout 
                        onClick={() => onOpenEdit(a)} 
                        className={cn("hover:bg-indigo-50/40 cursor-pointer transition-colors group z-10 relative", isExpanded ? "bg-indigo-50/30" : "")}
                      >
                        <td className="p-3 text-center" onClick={(e) => { e.stopPropagation(); if(hasItems) setExpandedId(isExpanded ? null : a.id); }}>
                          {hasItems ? (
                            <button className={cn("p-1 rounded-md transition-colors", isExpanded ? "bg-indigo-100 text-indigo-600" : "text-slate-400 hover:bg-slate-100 hover:text-slate-600")}>
                              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>
                          ) : <span className="w-3.5 h-3.5 inline-block"></span>}
                        </td>
                        <td className="p-3 font-semibold text-slate-800">{a.date}</td>
                        <td className="p-3 font-mono text-[10px] text-slate-500">{highlight(a.num || 'S/N', searchQ)}</td>
                        <td className="p-3 font-bold text-slate-900 truncate max-w-[200px]">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate">{highlight(a.prov || 'Desconocido', searchQ)}</span>
                            {hasItems && <span className="ml-1 px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[8px] font-bold border border-slate-200">{a.items.length} lin</span>}
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          {unitConfig && <span className={cn("text-[9px] px-1.5 py-0.5 rounded font-bold uppercase", unitConfig.bg, unitConfig.color)}>{unitConfig.name.split(' ')[0]}</span>}
                        </td>
                        <td className="p-3 text-right font-black text-slate-900 text-sm">{Num.fmt(a.total)}</td>
                        
                        <td className="p-3 text-center">
                          {a.reconciled ? (
                            <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200"><LinkIcon className="w-3 h-3" /> CONCILIADO</span>
                          ) : a.paid ? (
                            <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200"><CheckCircle2 className="w-3 h-3" /> PAGADO</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[9px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200"><Clock className="w-3 h-3" /> PENDIENTE</span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button type="button" onClick={(e) => { e.stopPropagation(); onOpenEdit(a); }} className="p-1.5 rounded text-indigo-500 hover:bg-indigo-100 transition">
                              <Edit2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </motion.tr>

                      {isExpanded && hasItems && (
                        <tr className="bg-slate-50/50">
                          <td colSpan={8} className="p-0 border-b border-slate-200">
                            <div className="py-4 px-12 relative">
                              <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-indigo-100"></div>
                              <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden ml-6">
                                <table className="w-full text-left text-[10px]">
                                  <thead className="bg-slate-100 text-slate-500 font-bold uppercase">
                                    <tr>
                                      <th className="px-3 py-2 w-16 text-center">Cant</th>
                                      <th className="px-3 py-2 w-12 text-center">Ud</th>
                                      <th className="px-3 py-2">Producto</th>
                                      <th className="px-3 py-2 w-16 text-center">% IVA</th>
                                      <th className="px-3 py-2 w-24 text-right">Precio Ud.</th>
                                      <th className="px-3 py-2 w-24 text-right">Total</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {a.items.map((it, idx) => (
                                      <tr key={idx} className="hover:bg-slate-50">
                                        <td className="px-3 py-2 text-center font-bold text-slate-700">{it.q}</td>
                                        <td className="px-3 py-2 text-center text-slate-500">{it.u}</td>
                                        <td className="px-3 py-2 font-medium text-slate-800">{it.n}</td>
                                        <td className="px-3 py-2 text-center text-slate-500">{it.rate}%</td>
                                        <td className="px-3 py-2 text-right text-slate-500">{Num.fmt(it.unitPrice)}</td>
                                        <td className="px-3 py-2 text-right font-bold text-indigo-600">{Num.fmt(it.t)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
});
