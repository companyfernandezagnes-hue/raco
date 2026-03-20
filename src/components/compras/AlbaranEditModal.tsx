import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Save, Trash2, X, Plus, Mic, Package, AlertCircle, Bot } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Albaran, BusinessUnit } from '../../types';
import { Num } from '../../services/engine';
import { cn } from '../../lib/utils';

interface AlbaranEditModalProps {
  editForm: Albaran;
  sociosReales: any[];
  setEditForm: React.Dispatch<React.SetStateAction<Albaran | null>>;
  onClose: () => void;
  onSave: (e?: React.MouseEvent) => void;
  onDelete: (id: string) => void;
}

const GLOBAL_VAT_CATALOG = {
  alcohol: [/CERVEZA/i, /VINO/i, /CAVA/i, /CHAMP/i, /WHISKY/i, /RON/i, /GINEBRA/i, /LICOR/i, /VERMUT/i],
  softSugared: [/REFRESC/i, /COLA/i, /TONICA/i, /NARANJA/i, /LIMON/i, /ENERG/i],
  packaging: [/ENVASE/i, /ENVAS/i, /EMBALA/i, /PACK/i, /BANDEJA/i, /CAJA/i, /BOLSA/i]
};

const predictVat = (name: string, learnedMemory: Record<string, number>, defaultVat = 10) => {
  const normName = (name || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
  if (learnedMemory[normName] !== undefined) return { expected: learnedMemory[normName], reason: 'Memoria (Aprendido)' };

  const hit = (arr: RegExp[]) => arr.some(rx => rx.test(name));
  if (hit(GLOBAL_VAT_CATALOG.alcohol)) return { expected: 21, reason: 'Catálogo (Alcohol -> 21%)' };
  if (hit(GLOBAL_VAT_CATALOG.softSugared)) return { expected: 21, reason: 'Catálogo (Refrescos -> 21%)' };
  if (hit(GLOBAL_VAT_CATALOG.packaging)) return { expected: 21, reason: 'Catálogo (Envases -> 21%)' };

  return { expected: defaultVat, reason: 'IVA General' };
};

export const AlbaranEditModal = ({ 
  editForm, sociosReales, setEditForm, onClose, onSave, onDelete 
}: AlbaranEditModalProps) => {
  
  const [saving, setSaving] = useState(false);
  const [learnedVatRules, setLearnedVatRules] = useState<Record<string, number>>(() => {
    try { return JSON.parse(localStorage.getItem('arume_vat_rules') || '{}'); } catch { return {}; }
  });

  const recalcLine = (raw: any) => {
    const rate = Number(raw.rate) || 10;
    const q = Number(raw.q) || 1;
    const t = Number(raw.t) || 0;
    const base = Num.round2(t / (1 + rate / 100));
    const tax = Num.round2(t - base);
    const unitPrice = Num.round2(t / q);
    return { ...raw, rate, q, t, base, tax, unitPrice };
  };

  const recalcTotals = (items: any[]) => {
    const total = items.reduce((acc, it) => acc + it.t, 0);
    const base = items.reduce((acc, it) => acc + it.base, 0);
    const taxes = items.reduce((acc, it) => acc + it.tax, 0);
    return { total: Num.round2(total), base: Num.round2(base), taxes: Num.round2(taxes) };
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    setEditForm(prev => {
      if (!prev) return null;
      const items = [...prev.items];
      items[index] = recalcLine({ ...items[index], [field]: value });
      const totals = recalcTotals(items);
      return { ...prev, items, ...totals };
    });
  };

  const handleLearnVat = (index: number, name: string, rate: number) => {
    const normName = (name || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
    if (!normName) return;
    const newRules = { ...learnedVatRules, [normName]: rate };
    setLearnedVatRules(newRules);
    localStorage.setItem('arume_vat_rules', JSON.stringify(newRules)); 
    handleItemChange(index, 'rate', rate);
  };

  return (
    <div className="fixed inset-0 z-[200] flex justify-center items-center p-4 bg-slate-900/80 backdrop-blur-sm">
      <motion.div 
        initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }}
        className="bg-[#F8FAFC] w-full max-w-4xl rounded-[2.5rem] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
      >
        <div className="p-6 border-b border-slate-200 bg-white flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center"><Package className="w-5 h-5" /></div>
            <div>
              <h3 className="text-xl font-black text-slate-800">Editar Albarán</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Ref: <span className="text-indigo-500">{editForm.num}</span></p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 bg-slate-50 text-slate-600 rounded-xl font-bold text-xs hover:bg-slate-100 transition">Cancelar</button>
            <button onClick={() => onSave()} disabled={saving} className="px-5 py-2 bg-indigo-600 text-white rounded-xl font-black text-xs hover:bg-indigo-700 transition flex items-center gap-2 shadow-lg">
              <Save className="w-4 h-4" /> {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-[9px] font-black text-slate-400 uppercase mb-1.5">Proveedor</p>
              <input value={editForm.prov} onChange={e => setEditForm({...editForm, prov: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-xl p-2 text-sm font-bold outline-none focus:border-indigo-400" />
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-[9px] font-black text-slate-400 uppercase mb-1.5">Fecha</p>
              <input type="date" value={editForm.date} onChange={e => setEditForm({...editForm, date: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-xl p-2 text-sm font-bold outline-none focus:border-indigo-400" />
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-[9px] font-black text-slate-400 uppercase mb-1.5">Responsable</p>
              <select value={editForm.socio} onChange={e => setEditForm({...editForm, socio: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-xl p-2 text-sm font-bold outline-none">
                <option value="Arume">Arume</option>
                {sociosReales.map(s => <option key={s.id} value={s.n}>{s.n}</option>)}
              </select>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-[9px] font-black text-slate-400 uppercase mb-1.5">Unidad</p>
              <select value={editForm.unitId} onChange={e => setEditForm({...editForm, unitId: e.target.value as BusinessUnit})} className="w-full bg-slate-50 border border-slate-100 rounded-xl p-2 text-sm font-bold outline-none">
                <option value="REST">Restaurante</option>
                <option value="DLV">Catering</option>
                <option value="SHOP">Tienda</option>
                <option value="CORP">Corp</option>
              </select>
            </div>
          </div>

          <div className="bg-white rounded-[2rem] p-6 border border-slate-200 shadow-sm space-y-3">
            <div className="grid grid-cols-12 gap-2 text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">
              <div className="col-span-2 text-center">Cant.</div>
              <div className="col-span-1 text-center">Ud</div>
              <div className="col-span-4">Producto</div>
              <div className="col-span-2 text-center">IVA %</div>
              <div className="col-span-2 text-right">Total</div>
              <div className="col-span-1"></div>
            </div>

            {editForm.items.map((it, i) => {
              const predicted = predictVat(it.n, learnedVatRules);
              const hasMismatch = it.rate !== predicted.expected && it.n.length > 2;

              return (
                <div key={i} className="space-y-2">
                  <div className="grid grid-cols-12 gap-2 items-center bg-slate-50 p-1.5 rounded-xl border border-slate-100">
                    <input type="number" value={it.q} onChange={e => handleItemChange(i, 'q', e.target.value)} className="col-span-2 bg-white border border-slate-200 rounded-lg p-2 font-bold text-center text-xs" />
                    <select value={it.u} onChange={e => handleItemChange(i, 'u', e.target.value)} className="col-span-1 bg-white border border-slate-200 rounded-lg p-2 text-[10px] font-bold">
                      <option value="uds">uds</option><option value="kg">kg</option><option value="l">l</option>
                    </select>
                    <input type="text" value={it.n} onChange={e => handleItemChange(i, 'n', e.target.value)} className="col-span-4 bg-white border border-slate-200 rounded-lg p-2 font-bold text-xs" />
                    <select value={it.rate} onChange={e => handleItemChange(i, 'rate', e.target.value)} className={cn("col-span-2 bg-white rounded-lg p-2 font-bold text-center text-xs", hasMismatch ? "border-2 border-amber-400" : "border border-slate-200")}>
                      <option value={4}>4%</option><option value={10}>10%</option><option value={21}>21%</option>
                    </select>
                    <input type="number" value={it.t} onChange={e => handleItemChange(i, 't', e.target.value)} className="col-span-2 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-lg p-2 font-black text-right text-xs" />
                    <button onClick={() => setEditForm({...editForm, items: editForm.items.filter((_, idx) => idx !== i)})} className="col-span-1 text-slate-400 hover:text-rose-500 transition flex justify-center"><Trash2 size={16} /></button>
                  </div>
                  {hasMismatch && (
                    <div className="ml-4 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-[10px] text-amber-700 font-bold"><AlertCircle size={14} /> IA sugiere {predicted.expected}% ({predicted.reason})</div>
                      <button onClick={() => handleLearnVat(i, it.n, predicted.expected)} className="text-[9px] font-black uppercase bg-white border border-amber-300 px-2 py-1 rounded hover:bg-amber-100">Aplicar</button>
                    </div>
                  )}
                </div>
              );
            })}
            <button onClick={() => setEditForm({...editForm, items: [...editForm.items, {q:1, n:'', u:'uds', rate:10, unitPrice:0, base:0, tax:0, t:0}]})} className="w-full py-3 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 font-bold text-xs hover:border-indigo-300 hover:text-indigo-500 transition flex items-center justify-center gap-2"><Plus size={16}/> Añadir Línea</button>
          </div>
        </div>

        <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Albarán</p>
            <p className="text-3xl font-black text-emerald-400 tracking-tighter">{Num.fmt(editForm.total)}</p>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={editForm.paid} onChange={e => setEditForm({...editForm, paid: e.target.checked})} className="w-5 h-5 accent-emerald-500 rounded" />
              <span className="text-xs font-black uppercase">Pagado</span>
            </label>
            <button onClick={() => onDelete(editForm.id)} className="p-3 bg-rose-500/20 text-rose-400 rounded-xl hover:bg-rose-500 hover:text-white transition"><Trash2 size={20} /></button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
