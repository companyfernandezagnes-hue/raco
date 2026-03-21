import React from 'react';
import { 
  Package, 
  Search, 
  Filter, 
  Plus, 
  ArrowUp, 
  ArrowDown, 
  AlertTriangle, 
  CheckCircle2, 
  History,
  MoreVertical,
  BarChart3,
  TrendingDown,
  TrendingUp,
  Wine,
  Utensils,
  MessageCircle,
  ShoppingCart,
  RefreshCw,
  Eye,
  Truck,
  FileText,
  Zap,
  ArrowUpRight,
  ArrowDownLeft,
  X,
  Sparkles,
  Brain,
  Lightbulb,
  Camera
} from 'lucide-react';
import { StockItem, Supplier, StockMovement } from '../types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { mockStock, mockSuppliers } from '../data/mockData';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { usePin } from '../context/PinContext';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function StockView() {
  const { rol } = usePin();
  const [activeTab, setActiveTab] = React.useState<'inventario' | 'movimientos' | 'innovaciones'>('inventario');
  const [filter, setFilter] = React.useState<'Todos' | 'Comida' | 'Bebida' | 'Suministros'>('Todos');
  const [search, setSearch] = React.useState('');
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [stock, setStock] = React.useState<StockItem[]>(mockStock);
  const [selectedItem, setSelectedItem] = React.useState<StockItem | null>(null);
  const [isReplenishing, setIsReplenishing] = React.useState(false);
  const [showForecasting, setShowForecasting] = React.useState<StockItem | null>(null);

  const forecastData = [
    { day: 'Lun', stock: 45, predicted: 42 },
    { day: 'Mar', stock: 38, predicted: 35 },
    { day: 'Mie', stock: 30, predicted: 28 },
    { day: 'Jue', stock: 25, predicted: 22 },
    { day: 'Vie', stock: 18, predicted: 15 },
    { day: 'Sab', predicted: 10 },
    { day: 'Dom', predicted: 5 },
  ];

  const [newProduct, setNewProduct] = React.useState({
    name: '',
    category: 'Comida' as const,
    unit: '',
    minStock: 0,
    pricePerUnit: 0
  });

  const [showHistory, setShowHistory] = React.useState(false);
  const [showMissingItems, setShowMissingItems] = React.useState(false);

  // Function to sync inventory with delivery notes (simulated)
  const syncWithDeliveryNotes = () => {
    setIsSyncing(true);
    setTimeout(() => {
      setStock(prev => prev.map(item => {
        // Simulate finding 5 units in a new albarán for some items
        if (Math.random() > 0.6) {
          return { ...item, currentStock: item.currentStock + Math.floor(Math.random() * 10) + 1, lastUpdated: new Date().toISOString().split('T')[0] };
        }
        return item;
      }));
      setIsSyncing(false);
      alert("Inventario sincronizado con éxito.");
    }, 1500);
  };

  const [isSyncing, setIsSyncing] = React.useState(false);

  const handleCreateProduct = () => {
    if (!newProduct.name || !newProduct.unit) {
      alert('Por favor, rellena todos los campos obligatorios.');
      return;
    }

    const newItem: StockItem = {
      id: Math.random().toString(36).substr(2, 9),
      ...newProduct,
      currentStock: 0,
      lastUpdated: new Date().toISOString().split('T')[0]
    };

    setStock([newItem, ...stock]);
    setIsModalOpen(false);
    setNewProduct({
      name: '',
      category: 'Comida',
      unit: '',
      minStock: 0,
      pricePerUnit: 0
    });
  };

  const handleWhatsAppOrder = (item: StockItem) => {
    const supplier = mockSuppliers.find(s => s.id === item.supplierId);
    if (!supplier) {
      alert('No hay un proveedor asignado a este producto. Por favor, edita el producto para asignar uno.');
      return;
    }

    const quantityToOrder = Math.max(0, item.minStock * 2 - item.currentStock);
    const message = encodeURIComponent(`Hola ${supplier.contact}, me gustaría realizar un pedido de ${quantityToOrder} ${item.unit} de ${item.name}. Gracias.`);
    window.open(`https://wa.me/${supplier.phone.replace('+', '')}?text=${message}`, '_blank');
  };

  const updateStock = (id: string, delta: number) => {
    setStock(prev => prev.map(item => {
      if (item.id === id) {
        const newStock = Math.max(0, item.currentStock + delta);
        const movement: StockMovement = {
          id: Math.random().toString(36).substr(2, 9),
          date: new Date().toISOString().split('T')[0],
          type: delta > 0 ? 'Entrada' : 'Salida',
          quantity: Math.abs(delta),
          reason: delta > 0 ? 'Ajuste Manual (+)' : 'Ajuste Manual (-)',
          price: item.pricePerUnit
        };
        return { 
          ...item, 
          currentStock: newStock, 
          lastUpdated: new Date().toISOString().split('T')[0],
          history: [movement, ...(item.history || [])]
        };
      }
      return item;
    }));
  };

  const handleSmartReplenish = () => {
    setIsReplenishing(true);
    setTimeout(() => {
      const itemsToOrder = stock.filter(item => item.currentStock <= item.minStock);
      if (itemsToOrder.length === 0) {
        alert("Análisis IA: El stock actual es óptimo para la demanda prevista.");
      } else {
        setShowMissingItems(true);
        alert(`Análisis IA Completado: Se han identificado ${itemsToOrder.length} productos con riesgo de rotura. Revisa la lista de pedidos.`);
      }
      setIsReplenishing(false);
    }, 2000);
  };

  const filteredStock = stock.filter(item => 
    (filter === 'Todos' ? true : item.category === filter) &&
    item.name.toLowerCase().includes(search.toLowerCase())
  );

  const lowStockCount = stock.filter(item => item.currentStock <= item.minStock).length;
  const totalValue = stock.reduce((acc, item) => acc + (item.currentStock * item.pricePerUnit), 0);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 flex items-center gap-3">
            <div className="w-12 h-12 bg-amber-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-amber-100">
              <Package size={24} />
            </div>
            Control de Stock
          </h1>
          <p className="text-slate-500 text-sm mt-1 font-medium">Inventario inteligente con pedidos automáticos vía WhatsApp.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={handleSmartReplenish}
            disabled={isReplenishing}
            className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-3 rounded-2xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50"
          >
            <Zap size={18} className={cn(isReplenishing && "animate-pulse")} />
            {isReplenishing ? "Generando..." : "Reposición IA"}
          </button>
          <button 
            onClick={() => setShowMissingItems(true)}
            className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-5 py-3 rounded-2xl text-sm font-bold hover:bg-slate-50 transition-all shadow-sm"
          >
            <ShoppingCart size={18} className="text-amber-600" />
            Lista de Pedidos
          </button>
          <button 
            onClick={syncWithDeliveryNotes}
            disabled={isSyncing}
            className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-5 py-3 rounded-2xl text-sm font-bold hover:bg-slate-50 transition-all shadow-sm disabled:opacity-50"
          >
            <RefreshCw size={18} className={cn(isSyncing && "animate-spin text-amber-600")} />
            {isSyncing ? "Sincronizando..." : "Sincronizar Albaranes"}
          </button>
          <button 
            onClick={() => setShowHistory(true)}
            className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-5 py-3 rounded-2xl text-sm font-bold hover:bg-slate-50 transition-all shadow-sm"
          >
            <History size={18} />
            Historial
          </button>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-amber-600 text-white px-5 py-3 rounded-2xl text-sm font-bold hover:bg-amber-700 transition-all shadow-lg shadow-amber-100"
          >
            <Plus size={18} />
            Nuevo Producto
          </button>
        </div>
      </div>

      <div className="flex gap-1.5 p-1.5 bg-slate-100 rounded-2xl w-fit mb-8">
        <button 
          onClick={() => setActiveTab('inventario')}
          className={cn(
            "px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
            activeTab === 'inventario' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
          )}
        >
          Inventario
        </button>
        <button 
          onClick={() => setActiveTab('movimientos')}
          className={cn(
            "px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
            activeTab === 'movimientos' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
          )}
        >
          Movimientos
        </button>
        <button 
          onClick={() => setActiveTab('innovaciones')}
          className={cn(
            "px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2",
            activeTab === 'innovaciones' ? "bg-white text-emerald-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
          )}
        >
          <Lightbulb size={14} />
          Innovaciones IA
        </button>
      </div>

      {activeTab === 'inventario' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-8 bg-white rounded-[2.5rem] border border-slate-200 shadow-sm flex items-center gap-6 group hover:border-emerald-200 transition-all">
          <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-3xl flex items-center justify-center group-hover:scale-110 transition-transform">
            <CheckCircle2 size={32} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Productos OK</p>
            <p className="text-3xl font-black text-slate-900">{stock.length - lowStockCount}</p>
          </div>
        </div>
        <div className="p-8 bg-white rounded-[2.5rem] border border-slate-200 shadow-sm flex items-center gap-6 group hover:border-rose-200 transition-all">
          <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-3xl flex items-center justify-center group-hover:scale-110 transition-transform">
            <AlertTriangle size={32} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Stock Bajo</p>
            <p className="text-3xl font-black text-rose-600">{lowStockCount}</p>
          </div>
        </div>
        <div className="p-8 bg-slate-900 text-white rounded-[2.5rem] shadow-2xl shadow-slate-200 flex items-center gap-6 relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-32 h-32 bg-white/5 rounded-full blur-3xl group-hover:scale-110 transition-transform" />
          <div className="w-16 h-16 bg-white/10 rounded-3xl flex items-center justify-center relative z-10">
            <BarChart3 size={32} />
          </div>
          <div className="relative z-10">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Valor Inventario</p>
            <p className="text-3xl font-black">{totalValue.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-8 py-6 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex bg-slate-100 p-1.5 rounded-2xl w-fit">
            {(['Todos', 'Comida', 'Bebida', 'Suministros'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setFilter(t)}
                className={cn(
                  "px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                  filter === t ? "bg-white text-amber-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                )}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
              type="text" 
              placeholder="Buscar por nombre de producto..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-12 pr-6 py-3.5 bg-slate-50 border-none rounded-2xl text-sm font-medium focus:ring-2 focus:ring-amber-500 transition-all w-full"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Producto</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Categoría</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Stock Actual</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Mínimo</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Valor Unit.</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Estado</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredStock.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/30 transition-colors group">
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm",
                        item.category === 'Comida' ? "bg-emerald-50 text-emerald-600" : 
                        item.category === 'Bebida' ? "bg-blue-50 text-blue-600" : "bg-slate-50 text-slate-600"
                      )}>
                        {item.category === 'Comida' ? <Utensils size={20} /> : <Wine size={20} />}
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-900">{item.name}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Act: {new Date(item.lastUpdated).toLocaleDateString('es-ES')}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <span className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em] bg-slate-100 px-2 py-1 rounded-md">{item.category}</span>
                  </td>
                  <td className="px-8 py-6 text-center">
                    <div className="flex items-center justify-center gap-3">
                      <button 
                        onClick={() => updateStock(item.id, -1)}
                        disabled={rol !== 'admin'}
                        className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-rose-50 hover:text-rose-600 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <ArrowDown size={14} />
                      </button>
                      <span className={cn(
                        "text-base font-black min-w-[60px]",
                        item.currentStock <= item.minStock ? "text-rose-600" : "text-slate-900"
                      )}>
                        {item.currentStock} {item.unit}
                      </span>
                      <button 
                        onClick={() => updateStock(item.id, 1)}
                        disabled={rol !== 'admin'}
                        className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-emerald-50 hover:text-emerald-600 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <ArrowUp size={14} />
                      </button>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-center text-xs text-slate-400 font-black tracking-widest">
                    {item.minStock} {item.unit}
                  </td>
                  <td className="px-8 py-6 text-right">
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-sm font-black text-slate-700">
                        {item.pricePerUnit.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                      </span>
                      {item.lastPricePerUnit && (
                        <div className={cn(
                          "flex items-center gap-1 text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md",
                          item.pricePerUnit > item.lastPricePerUnit ? "bg-rose-50 text-rose-600" :
                          item.pricePerUnit < item.lastPricePerUnit ? "bg-emerald-50 text-emerald-600" :
                          "bg-slate-50 text-slate-400"
                        )}>
                          {item.pricePerUnit > item.lastPricePerUnit ? <TrendingUp size={10} /> : 
                           item.pricePerUnit < item.lastPricePerUnit ? <TrendingDown size={10} /> : null}
                          {((Math.abs(item.pricePerUnit - item.lastPricePerUnit) / item.lastPricePerUnit) * 100).toFixed(1)}%
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-8 py-6 text-center">
                    <div className="flex justify-center">
                      {item.currentStock <= item.minStock ? (
                        <div className="flex items-center gap-1.5 text-rose-600 bg-rose-50 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest">
                          <AlertTriangle size={12} />
                          Bajo
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest">
                          <CheckCircle2 size={12} />
                          OK
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-8 py-6 text-center">
                    <div className="flex items-center justify-center gap-3">
                      <button 
                        onClick={() => setSelectedItem(item)}
                        className="p-2.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-all"
                        title="Ver Detalles"
                      >
                        <Eye size={18} />
                      </button>
                      <button 
                        onClick={() => handleWhatsAppOrder(item)}
                        className="p-2.5 text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-xl transition-all shadow-sm" 
                        title="Hacer Pedido WhatsApp"
                      >
                        <MessageCircle size={18} />
                      </button>
                      <button className="p-2.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all">
                        <MoreVertical size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2 mb-6">
            <Sparkles size={18} className="text-indigo-600" />
            Simulador de Escenarios IA
          </h3>
          <div className="space-y-6">
            <div>
              <div className="flex justify-between mb-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Aumento de Demanda (Evento/Festivo)</label>
                <span className="text-xs font-black text-indigo-600">+25%</span>
              </div>
              <input type="range" className="w-full accent-indigo-600" min="0" max="100" defaultValue="25" />
            </div>
            <div className="p-6 bg-amber-50 rounded-3xl border border-amber-100 flex items-center gap-4">
              <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center">
                <AlertTriangle size={24} />
              </div>
              <div>
                <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Riesgo Detectado</p>
                <p className="text-sm font-bold text-amber-900">8 productos se agotarían en las primeras 4 horas.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-slate-900 p-8 rounded-[2.5rem] shadow-xl text-white">
          <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-6">
            <Brain size={18} className="text-indigo-400" />
            Optimización de Pedidos IA
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/10">
              <div className="flex items-center gap-3">
                <TrendingDown size={18} className="text-emerald-400" />
                <span className="text-xs font-bold">Reducción de Mermas Prevista</span>
              </div>
              <span className="text-xs font-black text-emerald-400">-12.5%</span>
            </div>
            <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/10">
              <div className="flex items-center gap-3">
                <TrendingUp size={18} className="text-blue-400" />
                <span className="text-xs font-bold">Ahorro en Logística</span>
              </div>
              <span className="text-xs font-black text-blue-400">450 €/mes</span>
            </div>
            <button className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all">
              Generar Plan de Pedidos Óptimo
            </button>
          </div>
        </div>
      </div>

        </>
      )}

      {activeTab === 'movimientos' && (
        <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-8 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
              <History size={18} className="text-amber-600" />
              Historial de Movimientos Global
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50">
                  <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Fecha</th>
                  <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Producto</th>
                  <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Tipo</th>
                  <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Cantidad</th>
                  <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Motivo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stock.flatMap(item => (item.history || []).map(h => ({ ...h, itemName: item.name, unit: item.unit }))).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((h, i) => (
                  <tr key={i} className="hover:bg-slate-50/30 transition-colors">
                    <td className="px-8 py-4 text-sm text-slate-500 font-medium">{h.date}</td>
                    <td className="px-8 py-4 text-sm text-slate-900 font-bold">{h.itemName}</td>
                    <td className="px-8 py-4">
                      <span className={cn(
                        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest",
                        h.type === 'Entrada' ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                      )}>
                        {h.type}
                      </span>
                    </td>
                    <td className="px-8 py-4 text-sm font-black text-slate-700">{h.quantity} {h.unit}</td>
                    <td className="px-8 py-4 text-xs text-slate-500 font-medium">{h.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'innovaciones' && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-bl-[5rem] -mr-8 -mt-8 transition-transform group-hover:scale-110" />
              <div className="relative z-10">
                <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-3xl flex items-center justify-center mb-6">
                  <Brain size={32} />
                </div>
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-4">Predicción de Stock IA</h3>
                <p className="text-slate-500 text-sm leading-relaxed mb-8">
                  Nuestro motor de IA analiza históricos de ventas, festivos y clima para predecir cuándo te quedarás sin stock antes de que ocurra.
                </p>
                <div className="space-y-4">
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-600">Precisión del Modelo</span>
                    <span className="text-xs font-black text-emerald-600">94.2%</span>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-600">Próxima Alerta Crítica</span>
                    <span className="text-xs font-black text-rose-600">En 48h (Cerveza)</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-slate-900 p-10 rounded-[3rem] shadow-2xl relative overflow-hidden group text-white">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-bl-[5rem] -mr-8 -mt-8 transition-transform group-hover:scale-110" />
              <div className="relative z-10">
                <div className="w-16 h-16 bg-white/10 text-white rounded-3xl flex items-center justify-center mb-6">
                  <TrendingUp size={32} />
                </div>
                <h3 className="text-xl font-black uppercase tracking-tight mb-4">Comparador Inteligente</h3>
                <p className="text-slate-400 text-sm leading-relaxed mb-8">
                  Analizamos automáticamente los precios de todos tus proveedores para sugerirte el cambio óptimo y ahorrar hasta un 15% mensual.
                </p>
                <button className="w-full py-4 bg-white text-slate-900 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-100 transition-all">
                  Ver Oportunidades de Ahorro
                </button>
              </div>
            </div>
          </div>

          <div className="bg-emerald-600 p-10 rounded-[3rem] shadow-xl text-white flex flex-col md:flex-row items-center gap-10">
            <div className="flex-1">
              <h3 className="text-2xl font-black uppercase tracking-tight mb-4">Inventario por Visión Artificial</h3>
              <p className="text-emerald-100 text-sm leading-relaxed mb-6">
                Próximamente: Haz una foto a tu estantería y nuestra IA contará automáticamente las botellas y paquetes, actualizando el stock en tiempo real.
              </p>
              <div className="flex gap-4">
                <div className="px-4 py-2 bg-white/20 rounded-full text-[10px] font-black uppercase tracking-widest">Beta Cerrada</div>
                <div className="px-4 py-2 bg-white/20 rounded-full text-[10px] font-black uppercase tracking-widest">Q3 2024</div>
              </div>
            </div>
            <div className="w-48 h-48 bg-white/10 rounded-[2.5rem] flex items-center justify-center backdrop-blur-md border border-white/20">
              <Camera size={64} className="text-white" />
            </div>
          </div>
        </div>
      )}

      {selectedItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[3rem] w-full max-w-4xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-amber-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-amber-100">
                  <Package size={28} />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-slate-900">{selectedItem.name}</h2>
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Detalle de Producto & Historial</p>
                </div>
              </div>
              <button onClick={() => setSelectedItem(null)} className="p-3 text-slate-400 hover:text-slate-600 hover:bg-white rounded-2xl transition-all shadow-sm">
                <Plus size={28} className="rotate-45" />
              </button>
            </div>
            
            <div className="p-10 grid grid-cols-1 lg:grid-cols-3 gap-10 overflow-y-auto max-h-[80vh]">
              <div className="lg:col-span-2 space-y-8">
                <div className="grid grid-cols-3 gap-6">
                  <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Stock Actual</p>
                    <p className="text-2xl font-black text-slate-900">{selectedItem.currentStock} {selectedItem.unit}</p>
                  </div>
                  <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Coste Medio</p>
                    <p className="text-2xl font-black text-emerald-600">{(selectedItem.averageCost || selectedItem.pricePerUnit).toFixed(2)} €</p>
                  </div>
                  <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Proveedor Principal</p>
                    <p className="text-sm font-black text-slate-700 truncate">
                      {mockSuppliers.find(s => s.id === selectedItem.supplierId)?.name || 'No asignado'}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                    <BarChart3 size={18} className="text-amber-600" />
                    Tendencia de Stock (Últimos Movimientos)
                  </h3>
                  <div className="h-64 w-full bg-slate-50 rounded-[2rem] p-6 border border-slate-100">
                    <ResponsiveContainer width="100%" height="100%" minHeight={200}>
                      <AreaChart data={selectedItem.history?.slice().reverse().map((h, i) => ({ name: h.date, stock: i * 5 + 10 })) || []}>
                        <defs>
                          <linearGradient id="colorStock" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#d97706" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#d97706" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="name" hide />
                        <YAxis hide />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#fff', borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        />
                        <Area type="monotone" dataKey="stock" stroke="#d97706" strokeWidth={3} fillOpacity={1} fill="url(#colorStock)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                    <History size={18} className="text-amber-600" />
                    Log de Movimientos
                  </h3>
                  <div className="space-y-3">
                    {selectedItem.history?.map((move) => (
                      <div key={move.id} className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100 hover:border-amber-200 transition-all group">
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center",
                            move.type === 'Entrada' ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                          )}>
                            {move.type === 'Entrada' ? <ArrowUp size={18} /> : <ArrowDown size={18} />}
                          </div>
                          <div>
                            <p className="text-sm font-black text-slate-900">{move.reason || move.type}</p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{new Date(move.date).toLocaleDateString('es-ES')}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={cn("text-sm font-black", move.type === 'Entrada' ? "text-emerald-600" : "text-rose-600")}>
                            {move.type === 'Entrada' ? '+' : '-'}{move.quantity} {selectedItem.unit}
                          </p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{move.price?.toFixed(2)} €/ud</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-8">
                <div className="p-8 bg-slate-900 text-white rounded-[2.5rem] shadow-xl space-y-6">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Acciones Rápidas</h3>
                  <div className="space-y-3">
                    <button className="w-full flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 rounded-2xl transition-all group">
                      <div className="flex items-center gap-3">
                        <Truck size={18} className="text-amber-400" />
                        <span className="text-sm font-bold">Pedir Reposición</span>
                      </div>
                      <ArrowUpRight size={16} className="text-slate-500 group-hover:text-white transition-colors" />
                    </button>
                    <button className="w-full flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 rounded-2xl transition-all group">
                      <div className="flex items-center gap-3">
                        <FileText size={18} className="text-blue-400" />
                        <span className="text-sm font-bold">Ver Albaranes</span>
                      </div>
                      <ArrowUpRight size={16} className="text-slate-500 group-hover:text-white transition-colors" />
                    </button>
                  </div>
                  <div className="pt-4">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Ajuste de Stock</p>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => updateStock(selectedItem.id, -1)}
                        className="flex-1 py-3 bg-white/10 hover:bg-rose-600 rounded-xl transition-all font-black text-xs"
                      >
                        -1
                      </button>
                      <button 
                        onClick={() => updateStock(selectedItem.id, 1)}
                        className="flex-1 py-3 bg-white/10 hover:bg-emerald-600 rounded-xl transition-all font-black text-xs"
                      >
                        +1
                      </button>
                    </div>
                  </div>
                </div>

                <div className="p-8 bg-amber-50 rounded-[2.5rem] border border-amber-100 space-y-4">
                  <div className="flex items-center gap-2 text-amber-700">
                    <Zap size={18} />
                    <span className="text-xs font-black uppercase tracking-widest">Alerta IA</span>
                  </div>
                  <p className="text-xs text-amber-800 font-medium leading-relaxed">
                    Este producto tiene una rotación alta los fines de semana. Recomendamos aumentar el stock mínimo a <span className="font-black">8 {selectedItem.unit}</span> para evitar roturas de stock.
                  </p>
                </div>

                <div className="p-8 bg-emerald-50 rounded-[2.5rem] border border-emerald-100 space-y-4">
                  <div className="flex items-center gap-2 text-emerald-700">
                    <TrendingDown size={18} />
                    <span className="text-xs font-black uppercase tracking-widest">Reducción de Merma IA</span>
                  </div>
                  <p className="text-xs text-emerald-800 font-medium leading-relaxed">
                    Se detecta un excedente recurrente de este producto los lunes. La IA sugiere reducir el pedido de los viernes en un <span className="font-black">15%</span> para optimizar la frescura y reducir mermas.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-2xl font-black text-slate-900">Nuevo Producto</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all">
                <Plus size={24} className="rotate-45" />
              </button>
            </div>
            <div className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Nombre del Producto</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-medium focus:ring-2 focus:ring-amber-500 transition-all" 
                    placeholder="Ej: Solomillo de Ternera"
                    value={newProduct.name}
                    onChange={e => setNewProduct({...newProduct, name: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Categoría</label>
                  <select 
                    className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-medium focus:ring-2 focus:ring-amber-500 transition-all"
                    value={newProduct.category}
                    onChange={e => setNewProduct({...newProduct, category: e.target.value as any})}
                  >
                    <option value="Comida">Comida</option>
                    <option value="Bebida">Bebida</option>
                    <option value="Suministros">Suministros</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Unidad</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-medium focus:ring-2 focus:ring-amber-500 transition-all" 
                    placeholder="kg, ud, bot..."
                    value={newProduct.unit}
                    onChange={e => setNewProduct({...newProduct, unit: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Stock Mínimo</label>
                  <input 
                    type="number" 
                    className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-medium focus:ring-2 focus:ring-amber-500 transition-all"
                    value={newProduct.minStock}
                    onChange={e => setNewProduct({...newProduct, minStock: parseFloat(e.target.value) || 0})}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Precio Unitario</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-medium focus:ring-2 focus:ring-amber-500 transition-all"
                    value={newProduct.pricePerUnit}
                    onChange={e => setNewProduct({...newProduct, pricePerUnit: parseFloat(e.target.value) || 0})}
                  />
                </div>
              </div>
              <button 
                onClick={handleCreateProduct}
                className="w-full bg-amber-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-amber-700 transition-all shadow-lg shadow-amber-100 mt-4"
              >
                Guardar Producto
              </button>
            </div>
          </div>
        </div>
      )}
      {showMissingItems && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-2xl font-black text-slate-900">Lista de Pedidos Faltantes</h2>
              <button onClick={() => setShowMissingItems(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all">
                <Plus size={24} className="rotate-45" />
              </button>
            </div>
            <div className="p-8 max-h-[60vh] overflow-y-auto space-y-4">
              {stock.filter(item => item.currentStock <= item.minStock).map(item => {
                const supplier = mockSuppliers.find(s => s.id === item.supplierId);
                return (
                  <div key={item.id} className="flex items-center justify-between p-6 bg-slate-50 rounded-3xl border border-slate-100">
                    <div>
                      <p className="text-sm font-black text-slate-900">{item.name}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Proveedor: {supplier?.name || 'No asignado'}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-xs font-black text-rose-600">Faltan: {item.minStock * 2 - item.currentStock} {item.unit}</p>
                      </div>
                      <button 
                        onClick={() => handleWhatsAppOrder(item)}
                        className="p-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all"
                      >
                        <MessageCircle size={18} />
                      </button>
                    </div>
                  </div>
                );
              })}
              {lowStockCount === 0 && (
                <div className="text-center py-10">
                  <CheckCircle2 size={48} className="text-emerald-500 mx-auto mb-4" />
                  <p className="text-slate-500 font-bold">¡Todo el stock está al día!</p>
                </div>
              )}
            </div>
            <div className="p-8 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">{lowStockCount} productos con stock bajo</p>
              <button 
                onClick={() => setShowMissingItems(false)}
                className="px-6 py-3 bg-slate-900 text-white rounded-xl font-black uppercase tracking-widest text-xs hover:bg-slate-800 transition-all"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
      {showHistory && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-2xl font-black text-slate-900">Historial de Movimientos</h2>
              <button onClick={() => setShowHistory(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all">
                <Plus size={24} className="rotate-45" />
              </button>
            </div>
            <div className="p-0 max-h-[60vh] overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-100">
                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Fecha</th>
                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Producto</th>
                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Tipo</th>
                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Cantidad</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {[
                    { date: '2026-03-11', product: 'Solomillo de Ternera', type: 'Salida', qty: '-2.5 kg' },
                    { date: '2026-03-11', product: 'Vino Tinto Rioja', type: 'Entrada', qty: '+12 bot' },
                    { date: '2026-03-10', product: 'Aceite de Oliva', type: 'Salida', qty: '-5 L' },
                    { date: '2026-03-10', product: 'Harina de Trigo', type: 'Entrada', qty: '+25 kg' },
                    { date: '2026-03-09', product: 'Salmón Fresco', type: 'Salida', qty: '-3.2 kg' },
                  ].map((log, i) => (
                    <tr key={i} className="hover:bg-slate-50/30 transition-colors">
                      <td className="px-8 py-4 text-xs font-bold text-slate-500">{new Date(log.date).toLocaleDateString('es-ES')}</td>
                      <td className="px-8 py-4 text-sm font-black text-slate-700">{log.product}</td>
                      <td className="px-8 py-4 text-center">
                        <span className={cn(
                          "text-[10px] font-black px-2 py-1 rounded-md uppercase tracking-widest",
                          log.type === 'Entrada' ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                        )}>{log.type}</span>
                      </td>
                      <td className={cn(
                        "px-8 py-4 text-sm font-black text-right",
                        log.type === 'Entrada' ? "text-emerald-600" : "text-rose-600"
                      )}>{log.qty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-8 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button 
                onClick={() => setShowHistory(false)}
                className="px-6 py-3 bg-slate-900 text-white rounded-xl font-black uppercase tracking-widest text-xs hover:bg-slate-800 transition-all"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
      {showForecasting && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[3rem] w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-10 bg-slate-900 text-white flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center border border-white/20">
                  <Brain size={28} className="text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-2xl font-black uppercase tracking-tight">Previsión de Stock IA</h3>
                  <p className="text-indigo-400 text-[10px] font-black uppercase tracking-widest">{showForecasting.name}</p>
                </div>
              </div>
              <button onClick={() => setShowForecasting(null)} className="p-3 hover:bg-white/10 rounded-2xl transition-all">
                <X size={24} />
              </button>
            </div>
            <div className="p-10 space-y-10">
              <div className="bg-slate-50 rounded-[2.5rem] p-8 border border-slate-200">
                <div className="flex items-center justify-between mb-8">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Consumo Previsto (7 días)</h4>
                  <div className="flex gap-4">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-indigo-500" />
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Real</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-indigo-200" />
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Predicción</span>
                    </div>
                  </div>
                </div>
                <div className="h-48 w-full">
                  <ResponsiveContainer width="100%" height="100%" minHeight={150}>
                    <AreaChart data={forecastData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#94a3b8' }} />
                      <YAxis hide />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '16px', color: '#fff', fontSize: '10px', fontWeight: 'bold' }}
                      />
                      <Area type="monotone" dataKey="stock" stroke="#6366f1" strokeWidth={3} fill="#6366f1" fillOpacity={0.1} />
                      <Area type="monotone" dataKey="predicted" stroke="#c7d2fe" strokeWidth={2} strokeDasharray="5 5" fill="none" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="p-6 bg-rose-50 rounded-3xl border border-rose-100">
                  <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest mb-2">Riesgo de Rotura</p>
                  <p className="text-2xl font-black text-rose-900">Sábado, 21:00h</p>
                  <p className="text-xs text-rose-600 mt-2 font-medium">Basado en reservas confirmadas.</p>
                </div>
                <div className="p-6 bg-emerald-50 rounded-3xl border border-emerald-100">
                  <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-2">Pedido Sugerido</p>
                  <p className="text-2xl font-black text-emerald-900">15 {showForecasting.unit}</p>
                  <p className="text-xs text-emerald-600 mt-2 font-medium">Para cubrir demanda hasta el Martes.</p>
                </div>
              </div>

              <button 
                onClick={() => {
                  handleWhatsAppOrder(showForecasting);
                  setShowForecasting(null);
                }}
                className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-800 transition-all shadow-xl shadow-slate-200"
              >
                Realizar Pedido Sugerido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
