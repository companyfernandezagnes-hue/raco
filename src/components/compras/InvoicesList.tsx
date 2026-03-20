import React, { useMemo, useState } from 'react';
import { FileText, CheckCircle2, Clock, AlertTriangle, ChevronDown, ChevronUp, ExternalLink, Mail, Zap, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { FacturaExtended, Albaran, BusinessUnit } from '../../types';
import { Num } from '../../services/engine';
import { cn } from '../../lib/utils';

interface InvoicesListProps {
  facturas: FacturaExtended[];
  albaranes: Albaran[];
  searchQ: string;
  selectedUnit: BusinessUnit | 'ALL';
  onOpenDetail: (factura: FacturaExtended) => void;
}

const statusConfig = {
  draft: { label: 'Borrador', color: 'text-slate-500 bg-slate-100 border-slate-200', icon: Clock },
  approved: { label: 'Aprobada', color: 'text-indigo-600 bg-indigo-50 border-indigo-200', icon: CheckCircle2 },
  paid: { label: 'Pagada', color: 'text-emerald-600 bg-emerald-50 border-emerald-200', icon: CheckCircle2 },
  mismatch: { label: 'Descuadre', color: 'text-rose-600 bg-rose-50 border-rose-200', icon: AlertTriangle }
};

export const InvoicesList = ({ 
  facturas, albaranes, searchQ, selectedUnit, onOpenDetail 
}: InvoicesListProps) => {
  
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = searchQ.toLowerCase();
    return facturas.filter(f => {
      if (selectedUnit !== 'ALL' && f.unidad_negocio !== selectedUnit) return false;
      if (!q) return true;
      return f.prov.toLowerCase().includes(q) || f.num.toLowerCase().includes(q);
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [facturas, searchQ, selectedUnit]);

  if (filtered.length === 0) {
    return (
      <div className="py-20 text-center bg-white rounded-3xl border-2 border-dashed border-slate-200">
        <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <p className="text-slate-500 font-bold">No se encontraron facturas</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden mb-20">
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-left border-collapse whitespace-nowrap">
          <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
            <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <th className="p-3 w-10"></th>
              <th className="p-3">Fecha</th>
              <th className="p-3">Factura</th>
              <th className="p-3">Proveedor</th>
              <th className="p-3 text-right">Base</th>
              <th className="p-3 text-right">IVA</th>
              <th className="p-3 text-right">Total</th>
              <th className="p-3 text-center">Banco</th>
              <th className="p-3 text-center">Estado</th>
              <th className="p-3 text-center">Origen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-[11px] font-medium">
            {filtered.map(f => {
              const isExpanded = expandedId === f.id;
              const status = statusConfig[f.status] || statusConfig.draft;
              const linkedAlbs = albaranes.filter(a => f.albaranIdsArr?.includes(a.id));

              return (
                <React.Fragment key={f.id}>
                  <tr 
                    onClick={() => onOpenDetail(f)}
                    className={cn("hover:bg-slate-50 cursor-pointer transition-colors group", isExpanded ? "bg-indigo-50/30" : "")}
                  >
                    <td className="p-3 text-center" onClick={(e) => { e.stopPropagation(); setExpandedId(isExpanded ? null : f.id); }}>
                      <button className="p-1 rounded hover:bg-slate-200 text-slate-400">
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                    </td>
                    <td className="p-3 text-slate-500 font-bold">{f.date}</td>
                    <td className="p-3 font-mono text-indigo-600 font-bold">{f.num}</td>
                    <td className="p-3 font-black text-slate-900">{f.prov}</td>
                    <td className="p-3 text-right text-slate-500">{Num.fmt(Num.parse(f.base))}</td>
                    <td className="p-3 text-right text-slate-500">{Num.fmt(Num.parse(f.tax))}</td>
                    <td className="p-3 text-right font-black text-slate-900 text-sm">{Num.fmt(Num.parse(f.total))}</td>
                    <td className="p-3 text-center">
                      {f.reconciled ? (
                        <div className="flex flex-col items-center">
                          <CheckCircle2 size={14} className="text-emerald-500" />
                          <span className="text-[8px] font-black text-emerald-600 uppercase">Conciliado</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center opacity-30">
                          <Clock size={14} className="text-slate-400" />
                          <span className="text-[8px] font-black text-slate-500 uppercase">Pendiente</span>
                        </div>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase border", status.color)}>
                        <status.icon size={10} /> {status.label}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      {f.source === 'gmail-sync' ? (
                        <span className="text-indigo-500 flex items-center justify-center gap-1" title="Sincronizado desde Gmail"><Mail size={14} /></span>
                      ) : f.source === 'auto-from-albaran' ? (
                        <span className="text-amber-500 flex items-center justify-center gap-1" title="Generado automáticamente"><Zap size={14} /></span>
                      ) : (
                        <span className="text-slate-400 flex items-center justify-center gap-1" title="Manual"><FileText size={14} /></span>
                      )}
                    </td>
                  </tr>

                  <AnimatePresence>
                    {isExpanded && (
                      <tr>
                        <td colSpan={9} className="p-0 bg-slate-50/50">
                          <motion.div 
                            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="p-6 flex gap-6">
                              <div className="flex-1 space-y-4">
                                <div className="flex items-center justify-between">
                                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                    <Zap className="w-3 h-3 text-amber-500" /> Albaranes Vinculados ({linkedAlbs.length})
                                  </h4>
                                  <button onClick={() => onOpenDetail(f)} className="text-[9px] font-black text-indigo-600 hover:underline flex items-center gap-1">VER DETALLE COMPLETO <ExternalLink size={10} /></button>
                                </div>
                                
                                {linkedAlbs.length > 0 ? (
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                    {linkedAlbs.map(a => (
                                      <div key={a.id} className="bg-white border border-slate-200 rounded-lg p-3 flex justify-between items-center shadow-sm">
                                        <div>
                                          <p className="text-[10px] font-black text-slate-800">{a.num || 'S/N'}</p>
                                          <p className="text-[9px] text-slate-400 font-bold">{a.date}</p>
                                        </div>
                                        <div className="text-right">
                                          <p className="text-xs font-black text-slate-900">{Num.fmt(a.total)}</p>
                                          <p className="text-[8px] text-emerald-500 font-black uppercase">Conciliado</p>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="bg-white border border-dashed border-slate-300 rounded-xl p-6 text-center">
                                    <p className="text-[10px] text-slate-400 font-bold">No hay albaranes vinculados a esta factura.</p>
                                    <button onClick={() => onOpenDetail(f)} className="mt-2 px-3 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-black hover:bg-indigo-100 transition">VINCULAR AHORA</button>
                                  </div>
                                )}
                              </div>

                              <div className="w-64 bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Resumen Fiscal</p>
                                <div className="space-y-2">
                                  <div className="flex justify-between text-[11px]">
                                    <span className="text-slate-500">Base Imponible</span>
                                    <span className="font-bold text-slate-800">{Num.fmt(Num.parse(f.base))}</span>
                                  </div>
                                  <div className="flex justify-between text-[11px]">
                                    <span className="text-slate-500">Impuestos</span>
                                    <span className="font-bold text-slate-800">{Num.fmt(Num.parse(f.tax))}</span>
                                  </div>
                                  <div className="h-px bg-slate-100 my-2"></div>
                                  <div className="flex justify-between text-sm">
                                    <span className="font-black text-slate-900">TOTAL</span>
                                    <span className="font-black text-indigo-600">{Num.fmt(Num.parse(f.total))}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        </td>
                      </tr>
                    )}
                  </AnimatePresence>
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
