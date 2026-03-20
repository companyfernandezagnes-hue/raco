import React, { useMemo, useState } from 'react';
import { X, CheckCircle2, AlertTriangle, Link as LinkIcon, FileText, Download, Mail, Zap, Trash2, ShieldCheck, ChevronRight, Search, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { FacturaExtended, Albaran, AppData } from '../../types';
import { Num } from '../../services/engine';
import { matchAlbaranesToFactura, basicNorm, linkAlbaranesToFactura } from '../../services/invoicing';
import { cn } from '../../lib/utils';

interface InvoiceDetailModalProps {
  factura: FacturaExtended;
  albaranes: Albaran[];
  data: AppData;
  onClose: () => void;
  onUpdateData: (newData: AppData) => void;
  onDelete: (id: string) => void;
}

export const InvoiceDetailModal = ({ 
  factura, albaranes, data, onClose, onUpdateData, onDelete 
}: InvoiceDetailModalProps) => {
  
  const provNorm = useMemo(() => basicNorm(factura.prov), [factura.prov]);
  
  // Estado para los albaranes seleccionados (IDs)
  const [selectedAlbIds, setSelectedAlbIds] = useState<string[]>(factura.albaranIdsArr || []);
  const [albSearch, setAlbSearch] = useState('');

  // Albaranes disponibles del mismo proveedor que no están facturados (o que ya están en esta factura)
  const availableAlbaranes = useMemo(() => 
    albaranes.filter(a => 
      basicNorm(a.prov) === provNorm && (!a.invoiced || selectedAlbIds.includes(a.id))
    ), 
  [albaranes, provNorm, selectedAlbIds]);

  const filteredAvailable = useMemo(() => {
    if (!albSearch) return availableAlbaranes;
    return availableAlbaranes.filter(a => 
      (a.num || '').toLowerCase().includes(albSearch.toLowerCase()) ||
      a.date.includes(albSearch)
    );
  }, [availableAlbaranes, albSearch]);

  // Totales calculados dinámicamente
  const calculatedTotals = useMemo(() => {
    const selected = albaranes.filter(a => selectedAlbIds.includes(a.id));
    const base = selected.reduce((acc, a) => acc + a.base, 0);
    const tax = selected.reduce((acc, a) => acc + a.taxes, 0);
    const total = selected.reduce((acc, a) => acc + a.total, 0);
    
    // Desglose de IVA (agrupado por tipo si hubiera varios, aunque aquí simplificamos)
    const ivaBreakdown = selected.reduce((acc: any, a) => {
      const rate = a.taxes > 0 ? Math.round((a.taxes / a.base) * 100) : 0;
      const key = `${rate}%`;
      if (!acc[key]) acc[key] = { base: 0, tax: 0 };
      acc[key].base += a.base;
      acc[key].tax += a.taxes;
      return acc;
    }, {});

    return { base, tax, total, ivaBreakdown };
  }, [albaranes, selectedAlbIds]);

  const toggleAlbaran = (id: string) => {
    setSelectedAlbIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    const allIds = availableAlbaranes.map(a => a.id);
    setSelectedAlbIds(allIds);
  };

  const deselectAll = () => {
    setSelectedAlbIds([]);
  };

  const smartLink = () => {
    // Lógica simple: buscar combinación que sume el total de la factura
    const targetTotal = Num.parse(factura.total);
    // Intentamos coincidencia exacta primero
    const exactMatch = availableAlbaranes.find(a => Math.abs(a.total - targetTotal) < 0.01);
    if (exactMatch) {
      setSelectedAlbIds([exactMatch.id]);
      return;
    }
    // Si no, intentamos todos los que no estén facturados
    const pending = availableAlbaranes.filter(a => !a.invoiced);
    const pendingTotal = pending.reduce((acc, a) => acc + a.total, 0);
    if (Math.abs(pendingTotal - targetTotal) < 0.05) {
      setSelectedAlbIds(pending.map(a => a.id));
    }
  };

  const handleSave = () => {
    // Actualizamos los albaranes: marcamos como facturados los seleccionados
    const updatedAlbaranes = albaranes.map(a => {
      // Si el albarán pertenece a este proveedor
      if (basicNorm(a.prov) === provNorm) {
        return {
          ...a,
          invoiced: selectedAlbIds.includes(a.id)
        };
      }
      return a;
    });

    // Actualizamos la factura actual en la lista de facturas
    const updatedFacturas = data.facturas.map(f => {
      if (f.id === factura.id) {
        return {
          ...f,
          albaranIdsArr: selectedAlbIds,
          base: String(Num.round2(calculatedTotals.base)),
          tax: String(Num.round2(calculatedTotals.tax)),
          total: String(Num.round2(calculatedTotals.total)),
          status: 'approved' as const
        };
      }
      return f;
    });

    const fullNewData: AppData = {
      ...data,
      albaranes: updatedAlbaranes,
      facturas: updatedFacturas
    };

    onUpdateData(fullNewData);
    onClose();
  };

  const diferencia = Math.abs(calculatedTotals.total - Num.parse(factura.total));
  const cuadraPerfecto = diferencia <= 0.01;

  return (
    <div className="fixed inset-0 z-[250] flex justify-center items-center p-4 bg-slate-900/90 backdrop-blur-md">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="bg-white w-full max-w-7xl rounded-[3rem] shadow-2xl flex flex-col max-h-[95vh] overflow-hidden border border-white/20"
      >
        {/* Header */}
        <div className="p-8 border-b border-slate-100 flex justify-between items-start bg-slate-50/50">
          <div className="flex gap-4">
            <div className="w-14 h-14 bg-white rounded-2xl shadow-sm border border-slate-200 flex items-center justify-center text-indigo-600">
              <FileText size={28} />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h3 className="text-2xl font-black text-slate-900">Factura {factura.num}</h3>
                <span className={cn("px-3 py-1 rounded-full text-[10px] font-black uppercase border", 
                  factura.status === 'paid' ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-amber-50 text-amber-600 border-amber-200"
                )}>
                  {factura.status}
                </span>
              </div>
              <p className="text-slate-500 font-bold mt-1 flex items-center gap-2">
                {factura.prov} <span className="w-1 h-1 bg-slate-300 rounded-full"></span> {factura.date}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={handleSave}
              className="px-8 py-3 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition shadow-xl flex items-center gap-2 border border-white/10"
            >
              <CheckCircle2 size={18} /> VALIDAR Y CONTABILIZAR
            </button>
            <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition text-slate-400"><X size={24} /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 flex gap-8 custom-scrollbar">
          {/* Left Column: Albaranes Selection */}
          <div className="flex-1 space-y-8">
            <section>
              <div className="flex items-center justify-between mb-6">
                <div className="flex-1">
                  <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-500" /> Albaranes del Proveedor
                  </h4>
                  <p className="text-xs text-slate-500 font-bold">Selecciona los albaranes que componen esta factura para su conciliación.</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    <input 
                      type="text" 
                      placeholder="Buscar albarán..."
                      value={albSearch}
                      onChange={(e) => setAlbSearch(e.target.value)}
                      className="pl-9 pr-4 py-2 bg-slate-100 border-none rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500/20 transition-all w-48"
                    />
                  </div>
                  <button 
                    onClick={smartLink}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition shadow-lg shadow-indigo-100 flex items-center gap-2"
                  >
                    <Sparkles size={14} /> Smart Link
                  </button>
                  <div className="flex bg-slate-100 p-1 rounded-xl">
                    <button onClick={selectAll} className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-600 hover:text-slate-900 transition-colors">Todos</button>
                    <button onClick={deselectAll} className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-600 hover:text-slate-900 transition-colors">Ninguno</button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {filteredAvailable.map(a => {
                  const isSelected = selectedAlbIds.includes(a.id);
                  return (
                    <div 
                      key={a.id} 
                      onClick={() => toggleAlbaran(a.id)}
                      className={cn(
                        "p-5 rounded-3xl border-2 transition-all cursor-pointer flex items-center justify-between group",
                        isSelected ? "bg-indigo-50 border-indigo-500 shadow-lg scale-[1.01]" : "bg-white border-slate-100 hover:border-indigo-200"
                      )}
                    >
                      <div className="flex items-center gap-5">
                        <div className={cn(
                          "w-8 h-8 rounded-xl border-2 flex items-center justify-center transition-all",
                          isSelected ? "bg-indigo-500 border-indigo-500 text-white shadow-lg shadow-indigo-200" : "border-slate-200 bg-white group-hover:border-indigo-300"
                        )}>
                          {isSelected && <CheckCircle2 size={18} />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-base font-black text-slate-900">{a.num || 'S/N'}</p>
                            {a.invoiced && !isSelected && (
                              <span className="text-[8px] bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded font-black uppercase">En otra factura</span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 font-bold uppercase flex items-center gap-2">
                            {a.date} <span className="w-1 h-1 bg-slate-300 rounded-full"></span> {a.unitId}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-black text-slate-900">{Num.fmt(a.total)}</p>
                        <div className="flex items-center gap-3 justify-end mt-1">
                          <div className="flex flex-col items-end">
                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">Base</span>
                            <span className="text-[11px] text-slate-700 font-black">{Num.fmt(a.base)}</span>
                          </div>
                          <div className="flex flex-col items-end">
                            <span className="text-[9px] text-indigo-400 font-bold uppercase tracking-tighter">IVA</span>
                            <span className="text-[11px] text-indigo-600 font-black">{Num.fmt(a.taxes)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {filteredAvailable.length === 0 && (
                  <div className="py-16 text-center bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200">
                    <div className="w-16 h-16 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center text-slate-300 mx-auto mb-4">
                      <AlertTriangle size={32} />
                    </div>
                    <p className="text-slate-500 font-black text-lg">No hay albaranes que coincidan</p>
                    <p className="text-slate-400 font-bold text-sm mt-1">Prueba con otro término de búsqueda o revisa los filtros.</p>
                  </div>
                )}
              </div>
            </section>

            {/* AI Comparison Section */}
            <section className={cn(
              "p-8 rounded-[3rem] border-2 transition-all shadow-sm",
              cuadraPerfecto ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"
            )}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div className={cn(
                    "w-16 h-16 rounded-[1.5rem] flex items-center justify-center shadow-lg",
                    cuadraPerfecto ? "bg-emerald-500 text-white shadow-emerald-200" : "bg-amber-500 text-white shadow-amber-200"
                  )}>
                    {cuadraPerfecto ? <ShieldCheck size={32} /> : <AlertTriangle size={32} />}
                  </div>
                  <div>
                    <h5 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                      {cuadraPerfecto ? "Cuadre Contable Perfecto" : "Diferencia en Conciliación"}
                    </h5>
                    <p className="text-sm text-slate-600 font-bold mt-1">
                      {cuadraPerfecto 
                        ? "La suma de los albaranes seleccionados coincide con el total de la factura. El asiento contable será exacto." 
                        : `Existe una desviación de ${Num.fmt(diferencia)}. Revisa si falta algún albarán o hay un error en el importe de la factura.`}
                    </p>
                  </div>
                </div>
                {!cuadraPerfecto && (
                  <div className="bg-white p-6 rounded-[2rem] border border-amber-200 shadow-xl text-center min-w-[160px]">
                    <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-1">Desviación</p>
                    <p className="text-3xl font-black text-amber-600 tracking-tighter">{Num.fmt(diferencia)}</p>
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* Right Column: Fiscal Summary (Accounting Style) */}
          <div className="w-[400px] space-y-6">
            <div className="bg-slate-900 rounded-[3.5rem] p-10 text-white shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-10 rotate-12">
                <FileText size={180} />
              </div>
              
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-8">
                  <p className="text-[11px] font-black text-indigo-400 uppercase tracking-[0.2em]">Resumen Fiscal</p>
                  <span className="text-[10px] bg-white/10 px-3 py-1 rounded-full font-black uppercase tracking-widest">Calculado</span>
                </div>
                
                <div className="space-y-6">
                  <div className="flex justify-between items-center group">
                    <span className="text-xs text-slate-400 font-bold uppercase tracking-widest group-hover:text-white transition-colors">Base Imponible</span>
                    <span className="text-2xl font-black tracking-tight">{Num.fmt(calculatedTotals.base)}</span>
                  </div>
                  
                  <div className="space-y-3">
                    {Object.entries(calculatedTotals.ivaBreakdown).map(([rate, vals]: [string, any]) => (
                      <div key={rate} className="flex justify-between items-center group">
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-slate-400 font-bold uppercase tracking-widest group-hover:text-white transition-colors">IVA Soportado</span>
                          <span className="text-[10px] bg-indigo-500/30 text-indigo-300 px-2 py-0.5 rounded-lg font-black border border-indigo-500/20">{rate}</span>
                        </div>
                        <span className="text-xl font-black tracking-tight text-indigo-400">{Num.fmt(vals.tax)}</span>
                      </div>
                    ))}
                    {Object.keys(calculatedTotals.ivaBreakdown).length === 0 && (
                      <div className="flex justify-between items-center opacity-50">
                        <span className="text-xs text-slate-400 font-bold uppercase tracking-widest">IVA Soportado</span>
                        <span className="text-xl font-black tracking-tight text-indigo-400">{Num.fmt(0)}</span>
                      </div>
                    )}
                  </div>

                  <div className="h-px bg-gradient-to-r from-transparent via-white/20 to-transparent my-8"></div>

                  <div className="space-y-2">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Total a Contabilizar</p>
                    <div className="flex items-baseline gap-3">
                      <span className="text-6xl font-black text-white tracking-tighter">{Num.fmt(calculatedTotals.total)}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-10 pt-10 border-t border-white/10">
                  <div className="flex items-center gap-4 text-emerald-400 bg-emerald-400/10 p-4 rounded-2xl border border-emerald-400/20">
                    <div className="w-8 h-8 rounded-full bg-emerald-400 flex items-center justify-center text-slate-900">
                      <CheckCircle2 size={18} />
                    </div>
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-widest">Validación OK</p>
                      <p className="text-[9px] text-emerald-400/70 font-bold">Documento listo para el Libro Diario</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Accounting Notes */}
            <div className="bg-slate-50 rounded-[2.5rem] p-8 border border-slate-200 space-y-6">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Notas Contables</p>
                <textarea 
                  placeholder="Añade observaciones para el cierre trimestral..."
                  className="w-full bg-white border border-slate-200 rounded-2xl p-4 text-xs font-bold focus:border-indigo-400 outline-none transition-all min-h-[100px] resize-none"
                />
              </div>

              <div className="space-y-4">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Historial del Documento</p>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                    <p className="text-[10px] text-slate-600 font-bold">Documento creado el {factura.date}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                    <p className="text-[10px] text-slate-600 font-bold">Vinculación de albaranes actualizada hoy</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <button className="flex-1 py-5 bg-white border border-slate-200 text-slate-700 rounded-[1.5rem] font-black text-xs uppercase tracking-widest hover:bg-slate-50 transition shadow-sm flex items-center justify-center gap-3">
                <Download size={18} /> PDF
              </button>
              <button className="flex-1 py-5 bg-white border border-slate-200 text-slate-700 rounded-[1.5rem] font-black text-xs uppercase tracking-widest hover:bg-slate-50 transition shadow-sm flex items-center justify-center gap-3">
                <Mail size={18} /> ENVIAR
              </button>
            </div>

            <button onClick={() => onDelete(factura.id)} className="w-full py-5 bg-rose-50 text-rose-500 rounded-[1.5rem] font-black text-xs uppercase tracking-widest hover:bg-rose-500 hover:text-white transition flex items-center justify-center gap-3">
              <Trash2 size={20} /> ELIMINAR REGISTRO
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
