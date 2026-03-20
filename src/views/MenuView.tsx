import React, { useState, useMemo } from 'react';
import { 
  ChefHat, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Plus, 
  Search, 
  Download, 
  Filter,
  MoreVertical,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  PieChart,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Utensils,
  ClipboardList
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { AppData, Plato, VentaMenu } from '../types';
import { Num } from '../services/engine';
import { cn } from '../lib/utils';
import * as XLSX from 'xlsx';

interface MenuViewProps {
  data: AppData;
  onSave: (newData: Partial<AppData>) => Promise<void>;
}

export default function MenuView({ data, onSave }: MenuViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'platos' | 'ventas' | 'analisis'>('platos');
  const [isAddingPlato, setIsAddingPlato] = useState(false);
  const [newPlato, setNewPlato] = useState<Partial<Plato>>({
    name: '',
    category: 'Principal',
    cost: 0,
    price: 0,
    iva: 10,
    popularidad: 0,
    rentabilidad: 0,
    estado: 'Activo'
  });

  // Cálculos de Platos
  const platos = useMemo(() => data.platos || [], [data.platos]);
  
  const filteredPlatos = useMemo(() => {
    return platos.filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.category.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [platos, searchTerm]);

  const stats = useMemo(() => {
    const total = platos.length;
    const avgMargin = total > 0 
      ? platos.reduce((acc, p) => acc + (p.price - p.cost), 0) / total 
      : 0;
    const highMargin = platos.filter(p => (p.price - p.cost) / p.price > 0.7).length;
    
    return { total, avgMargin, highMargin };
  }, [platos]);

  const handleSavePlato = async () => {
    if (!newPlato.name || !newPlato.price) return;
    
    const plato: Plato = {
      id: crypto.randomUUID(),
      name: newPlato.name!,
      category: newPlato.category || 'Principal',
      cost: newPlato.cost || 0,
      price: newPlato.price!,
      iva: newPlato.iva || 10,
      popularidad: 0,
      rentabilidad: (newPlato.price! - (newPlato.cost || 0)) / newPlato.price!,
      estado: 'Activo'
    };

    await onSave({
      platos: [...platos, plato]
    });
    setIsAddingPlato(false);
    setNewPlato({
      name: '',
      category: 'Principal',
      cost: 0,
      price: 0,
      iva: 10,
      popularidad: 0,
      rentabilidad: 0,
      estado: 'Activo'
    });
  };

  const ventas = useMemo(() => data.ventas_menu || [], [data.ventas_menu]);

  const matrixData = useMemo(() => {
    if (platos.length === 0) return [];
    
    // Calcular promedios para la matriz
    const totalVentas = ventas.reduce((acc, v) => acc + v.qty, 0);
    const avgPopularity = totalVentas / platos.length;
    const avgMargin = platos.reduce((acc, p) => acc + (p.price - p.cost), 0) / platos.length;

    return platos.map(p => {
      const pVentas = ventas.filter(v => v.id === p.id).reduce((acc, v) => acc + v.qty, 0);
      const pMargin = p.price - p.cost;
      
      let category: 'Estrella' | 'Caballo' | 'Puzzle' | 'Perro' = 'Perro';
      
      if (pVentas >= avgPopularity && pMargin >= avgMargin) category = 'Estrella';
      else if (pVentas >= avgPopularity && pMargin < avgMargin) category = 'Caballo';
      else if (pVentas < avgPopularity && pMargin >= avgMargin) category = 'Puzzle';
      
      return { ...p, totalVentas: pVentas, category };
    });
  }, [platos, ventas]);

  const exportToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(platos);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Platos");
    XLSX.writeFile(wb, "Analisis_Menu.xlsx");
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">Análisis de Menú</h1>
          <p className="text-slate-500 font-medium">Gestión de rentabilidad y rendimiento de platos</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={exportToExcel}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-50 transition-all shadow-sm"
          >
            <Download size={18} />
            Exportar
          </button>
          <button 
            onClick={() => setIsAddingPlato(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200"
          >
            <Plus size={18} />
            Nuevo Plato
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
              <Utensils size={24} />
            </div>
            <span className="text-xs font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-lg uppercase tracking-wider">Total</span>
          </div>
          <p className="text-slate-500 text-sm font-bold uppercase tracking-wider mb-1">Platos en Carta</p>
          <h3 className="text-3xl font-black text-slate-900">{stats.total}</h3>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
              <TrendingUp size={24} />
            </div>
            <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg uppercase tracking-wider">Margen</span>
          </div>
          <p className="text-slate-500 text-sm font-bold uppercase tracking-wider mb-1">Margen Medio</p>
          <h3 className="text-3xl font-black text-slate-900">{Num.fmt(stats.avgMargin)}</h3>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center">
              <SparklesIcon size={24} />
            </div>
            <span className="text-xs font-black text-amber-600 bg-amber-50 px-2 py-1 rounded-lg uppercase tracking-wider">Estrellas</span>
          </div>
          <p className="text-slate-500 text-sm font-bold uppercase tracking-wider mb-1">Alta Rentabilidad</p>
          <h3 className="text-3xl font-black text-slate-900">{stats.highMargin} Platos</h3>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-2xl w-fit">
        <button 
          onClick={() => setActiveTab('platos')}
          className={cn(
            "px-6 py-2.5 rounded-xl font-bold text-sm transition-all",
            activeTab === 'platos' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
          )}
        >
          Carta de Platos
        </button>
        <button 
          onClick={() => setActiveTab('ventas')}
          className={cn(
            "px-6 py-2.5 rounded-xl font-bold text-sm transition-all",
            activeTab === 'ventas' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
          )}
        >
          Registro de Ventas
        </button>
        <button 
          onClick={() => setActiveTab('analisis')}
          className={cn(
            "px-6 py-2.5 rounded-xl font-bold text-sm transition-all",
            activeTab === 'analisis' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
          )}
        >
          Matriz de Ingeniería
        </button>
      </div>

      {/* Main Content Area */}
      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
        {activeTab === 'platos' && (
          <div className="p-0">
            <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text" 
                  placeholder="Buscar plato o categoría..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-transparent focus:bg-white focus:border-emerald-500/20 focus:ring-4 focus:ring-emerald-500/5 rounded-xl transition-all text-sm outline-none"
                />
              </div>
              <div className="flex items-center gap-2">
                <button className="p-2.5 text-slate-500 hover:bg-slate-50 rounded-xl transition-all">
                  <Filter size={20} />
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50">
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Plato</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Categoría</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Coste</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Precio (PVP)</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Margen Bruto</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Estado</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredPlatos.map((plato) => {
                    const margin = plato.price - plato.cost;
                    const marginPercent = (margin / plato.price) * 100;
                    
                    return (
                      <tr key={plato.id} className="group hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-500 font-bold">
                              {plato.name.charAt(0)}
                            </div>
                            <span className="font-bold text-slate-900">{plato.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold">
                            {plato.category}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right font-medium text-slate-600">
                          {Num.fmt(plato.cost)}
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-slate-900">
                          {Num.fmt(plato.price)}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex flex-col items-end">
                            <span className="font-black text-emerald-600">{Num.fmt(margin)}</span>
                            <span className="text-[10px] font-bold text-slate-400">{marginPercent.toFixed(1)}%</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex justify-center">
                            <span className={cn(
                              "px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider",
                              plato.estado === 'Activo' ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400"
                            )}>
                              {plato.estado}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-white rounded-lg transition-all shadow-none hover:shadow-sm">
                            <MoreVertical size={18} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'ventas' && (
          <div className="p-0">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-800">Histórico de Ventas</h3>
              <div className="flex items-center gap-2">
                <button className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-200 transition-all">
                  <Calendar size={14} /> Últimos 30 días
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50">
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Fecha</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Plato</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Cantidad</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Total Venta</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Margen Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ventas.map((v) => {
                    const plato = platos.find(p => p.id === v.id);
                    if (!plato) return null;
                    const totalVenta = v.qty * plato.price;
                    const totalMargen = v.qty * (plato.price - plato.cost);
                    
                    return (
                      <tr key={v.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 text-xs text-slate-500 font-medium">{v.date}</td>
                        <td className="px-6 py-4 font-bold text-slate-700">{plato.name}</td>
                        <td className="px-6 py-4 text-right font-black text-slate-900">{v.qty}</td>
                        <td className="px-6 py-4 text-right font-bold text-slate-700">{Num.fmt(totalVenta)}</td>
                        <td className="px-6 py-4 text-right font-black text-emerald-600">{Num.fmt(totalMargen)}</td>
                      </tr>
                    );
                  })}
                  {ventas.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-slate-400 font-medium">
                        No hay registros de ventas todavía.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'analisis' && (
          <div className="p-0">
            <div className="p-6 border-b border-slate-100 bg-slate-50/30">
              <div className="flex items-center gap-3 mb-2">
                <SparklesIcon className="text-amber-500" size={20} />
                <h3 className="font-bold text-slate-800">Matriz de Ingeniería de Menú (BCG)</h3>
              </div>
              <p className="text-xs text-slate-500 font-medium">Clasificación basada en popularidad (volumen de ventas) y rentabilidad (margen bruto).</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-slate-100">
              {/* Estrellas */}
              <div className="bg-white p-6">
                <div className="flex items-center justify-between mb-4">
                  <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-black uppercase tracking-widest">Estrellas</span>
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Alta Popularidad • Alta Rentabilidad</span>
                </div>
                <div className="space-y-3">
                  {matrixData.filter(p => p.category === 'Estrella').map(p => (
                    <div key={p.id} className="flex items-center justify-between p-3 bg-emerald-50/50 rounded-2xl border border-emerald-100">
                      <span className="text-sm font-bold text-slate-700">{p.name}</span>
                      <div className="text-right">
                        <p className="text-xs font-black text-emerald-600">{p.totalVentas} ventas</p>
                        <p className="text-[10px] font-bold text-slate-400">Margen: {Num.fmt(p.price - p.cost)}</p>
                      </div>
                    </div>
                  ))}
                  {matrixData.filter(p => p.category === 'Estrella').length === 0 && (
                    <p className="text-xs text-slate-400 italic py-4 text-center">No hay platos estrella detectados.</p>
                  )}
                </div>
              </div>

              {/* Caballos de Batalla */}
              <div className="bg-white p-6">
                <div className="flex items-center justify-between mb-4">
                  <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-[10px] font-black uppercase tracking-widest">Caballos de Batalla</span>
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Alta Popularidad • Baja Rentabilidad</span>
                </div>
                <div className="space-y-3">
                  {matrixData.filter(p => p.category === 'Caballo').map(p => (
                    <div key={p.id} className="flex items-center justify-between p-3 bg-blue-50/50 rounded-2xl border border-blue-100">
                      <span className="text-sm font-bold text-slate-700">{p.name}</span>
                      <div className="text-right">
                        <p className="text-xs font-black text-blue-600">{p.totalVentas} ventas</p>
                        <p className="text-[10px] font-bold text-slate-400">Margen: {Num.fmt(p.price - p.cost)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Puzzles */}
              <div className="bg-white p-6">
                <div className="flex items-center justify-between mb-4">
                  <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-[10px] font-black uppercase tracking-widest">Puzzles</span>
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Baja Popularidad • Alta Rentabilidad</span>
                </div>
                <div className="space-y-3">
                  {matrixData.filter(p => p.category === 'Puzzle').map(p => (
                    <div key={p.id} className="flex items-center justify-between p-3 bg-amber-50/50 rounded-2xl border border-amber-100">
                      <span className="text-sm font-bold text-slate-700">{p.name}</span>
                      <div className="text-right">
                        <p className="text-xs font-black text-amber-600">{p.totalVentas} ventas</p>
                        <p className="text-[10px] font-bold text-slate-400">Margen: {Num.fmt(p.price - p.cost)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Perros */}
              <div className="bg-white p-6">
                <div className="flex items-center justify-between mb-4">
                  <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-[10px] font-black uppercase tracking-widest">Perros</span>
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Baja Popularidad • Baja Rentabilidad</span>
                </div>
                <div className="space-y-3">
                  {matrixData.filter(p => p.category === 'Perro').map(p => (
                    <div key={p.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100">
                      <span className="text-sm font-bold text-slate-700">{p.name}</span>
                      <div className="text-right">
                        <p className="text-xs font-black text-slate-500">{p.totalVentas} ventas</p>
                        <p className="text-[10px] font-bold text-slate-400">Margen: {Num.fmt(p.price - p.cost)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal Añadir Plato */}
      <AnimatePresence>
        {isAddingPlato && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div>
                  <h2 className="text-2xl font-black text-slate-900">Nuevo Plato</h2>
                  <p className="text-slate-500 text-sm font-medium">Define los costes y precios base</p>
                </div>
                <button 
                  onClick={() => setIsAddingPlato(false)}
                  className="p-2 hover:bg-white rounded-xl text-slate-400 hover:text-slate-600 transition-all shadow-sm"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nombre del Plato</label>
                  <input 
                    type="text" 
                    value={newPlato.name}
                    onChange={(e) => setNewPlato({...newPlato, name: e.target.value})}
                    placeholder="Ej: Solomillo al Pedro Ximénez"
                    className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:bg-white focus:border-emerald-500/20 focus:ring-4 focus:ring-emerald-500/5 rounded-2xl transition-all outline-none font-bold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Categoría</label>
                    <select 
                      value={newPlato.category}
                      onChange={(e) => setNewPlato({...newPlato, category: e.target.value})}
                      className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:bg-white focus:border-emerald-500/20 focus:ring-4 focus:ring-emerald-500/5 rounded-2xl transition-all outline-none font-bold appearance-none"
                    >
                      <option value="Entrante">Entrante</option>
                      <option value="Principal">Principal</option>
                      <option value="Postre">Postre</option>
                      <option value="Bebida">Bebida</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">IVA (%)</label>
                    <input 
                      type="number" 
                      value={newPlato.iva}
                      onChange={(e) => setNewPlato({...newPlato, iva: Number(e.target.value)})}
                      className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:bg-white focus:border-emerald-500/20 focus:ring-4 focus:ring-emerald-500/5 rounded-2xl transition-all outline-none font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Coste (Materia Prima)</label>
                    <div className="relative">
                      <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input 
                        type="number" 
                        value={newPlato.cost}
                        onChange={(e) => setNewPlato({...newPlato, cost: Number(e.target.value)})}
                        className="w-full pl-12 pr-5 py-4 bg-slate-50 border-2 border-transparent focus:bg-white focus:border-emerald-500/20 focus:ring-4 focus:ring-emerald-500/5 rounded-2xl transition-all outline-none font-bold"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Precio Venta (PVP)</label>
                    <div className="relative">
                      <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input 
                        type="number" 
                        value={newPlato.price}
                        onChange={(e) => setNewPlato({...newPlato, price: Number(e.target.value)})}
                        className="w-full pl-12 pr-5 py-4 bg-slate-50 border-2 border-transparent focus:bg-white focus:border-emerald-500/20 focus:ring-4 focus:ring-emerald-500/5 rounded-2xl transition-all outline-none font-bold"
                      />
                    </div>
                  </div>
                </div>

                <div className="p-6 bg-emerald-50 rounded-3xl space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-emerald-700">Margen Bruto Estimado</span>
                    <span className="text-xl font-black text-emerald-600">
                      {Num.fmt((newPlato.price || 0) - (newPlato.cost || 0))}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-medium text-emerald-600">Porcentaje de Margen</span>
                    <span className="text-sm font-bold text-emerald-600">
                      {newPlato.price ? (((newPlato.price - (newPlato.cost || 0)) / newPlato.price) * 100).toFixed(1) : 0}%
                    </span>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button 
                    onClick={() => setIsAddingPlato(false)}
                    className="flex-1 px-6 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={handleSavePlato}
                    className="flex-[2] px-6 py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200"
                  >
                    Guardar Plato
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function X({ size }: { size: number }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function SparklesIcon({ size, className }: { size: number; className?: string }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
      className={className}
    >
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
      <path d="M5 3v4" />
      <path d="M19 17v4" />
      <path d="M3 5h4" />
      <path d="M17 19h4" />
    </svg>
  );
}
