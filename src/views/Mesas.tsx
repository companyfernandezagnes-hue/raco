import React from 'react';
import { 
  Users, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Plus, 
  X,
  Layout as LayoutIcon,
  Coffee,
  Utensils,
  Wine,
  Maximize2
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Table {
  id: string;
  number: number;
  capacity: number;
  status: 'available' | 'occupied' | 'reserved' | 'cleaning';
  x: number;
  y: number;
  type: 'square' | 'round' | 'long';
}

const mockTables: Table[] = [
  { id: '1', number: 1, capacity: 2, status: 'occupied', x: 100, y: 100, type: 'square' },
  { id: '2', number: 2, capacity: 2, status: 'available', x: 250, y: 100, type: 'square' },
  { id: '3', number: 3, capacity: 4, status: 'reserved', x: 400, y: 100, type: 'square' },
  { id: '4', number: 4, capacity: 6, status: 'available', x: 100, y: 250, type: 'long' },
  { id: '5', number: 5, capacity: 4, status: 'cleaning', x: 300, y: 250, type: 'round' },
  { id: '6', number: 6, capacity: 2, status: 'available', x: 500, y: 250, type: 'square' },
  { id: '7', number: 7, capacity: 4, status: 'occupied', x: 100, y: 400, type: 'square' },
  { id: '8', number: 8, capacity: 8, status: 'available', x: 300, y: 400, type: 'long' },
];

export default function MesasView() {
  const [tables, setTables] = React.useState<Table[]>(mockTables);
  const [selectedTable, setSelectedTable] = React.useState<Table | null>(null);
  const [activeZone, setActiveZone] = React.useState<'interior' | 'terraza'>('interior');

  const getStatusColor = (status: Table['status']) => {
    switch (status) {
      case 'available': return 'bg-emerald-500';
      case 'occupied': return 'bg-rose-500';
      case 'reserved': return 'bg-amber-500';
      case 'cleaning': return 'bg-blue-500';
      default: return 'bg-slate-500';
    }
  };

  const getStatusText = (status: Table['status']) => {
    switch (status) {
      case 'available': return 'Disponible';
      case 'occupied': return 'Ocupada';
      case 'reserved': return 'Reservada';
      case 'cleaning': return 'Limpieza';
      default: return status;
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 flex items-center gap-3">
            <div className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100">
              <LayoutIcon size={24} />
            </div>
            Gestión de Mesas
          </h1>
          <p className="text-slate-500 text-sm mt-1 font-medium">Mapa interactivo y estado del salón en tiempo real.</p>
        </div>
        <div className="flex gap-3">
          <div className="flex bg-slate-100 p-1 rounded-2xl">
            <button 
              onClick={() => setActiveZone('interior')}
              className={cn(
                "px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                activeZone === 'interior' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              Interior
            </button>
            <button 
              onClick={() => setActiveZone('terraza')}
              className={cn(
                "px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                activeZone === 'terraza' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              Terraza
            </button>
          </div>
          <button className="flex items-center gap-2 bg-slate-900 text-white px-5 py-3 rounded-2xl text-sm font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-200">
            <Plus size={18} />
            Añadir Mesa
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-3">
          <div className="bg-white rounded-[3rem] border border-slate-200 shadow-sm p-12 min-h-[600px] relative overflow-hidden bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:32px_32px]">
            {/* Legend */}
            <div className="absolute top-8 left-8 flex gap-6 bg-white/80 backdrop-blur-md p-4 rounded-2xl border border-slate-100 shadow-sm z-10">
              {(['available', 'occupied', 'reserved', 'cleaning'] as const).map(status => (
                <div key={status} className="flex items-center gap-2">
                  <div className={cn("w-3 h-3 rounded-full", getStatusColor(status))} />
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{getStatusText(status)}</span>
                </div>
              ))}
            </div>

            {/* Table Map */}
            <div className="relative w-full h-full mt-16">
              {tables.map(table => (
                <div
                  key={table.id}
                  onClick={() => setSelectedTable(table)}
                  style={{ left: `${table.x}px`, top: `${table.y}px` }}
                  className={cn(
                    "absolute cursor-pointer transition-all hover:scale-110 active:scale-95 group",
                    table.type === 'square' ? "w-24 h-24 rounded-2xl" : 
                    table.type === 'round' ? "w-24 h-24 rounded-full" : "w-40 h-24 rounded-2xl",
                    getStatusColor(table.status),
                    "flex flex-col items-center justify-center text-white shadow-xl border-4 border-white/20"
                  )}
                >
                  <span className="text-2xl font-black">{table.number}</span>
                  <div className="flex items-center gap-1 mt-1 opacity-60">
                    <Users size={12} />
                    <span className="text-[10px] font-bold">{table.capacity}</span>
                  </div>
                  
                  {/* Hover Info */}
                  <div className="absolute bottom-full mb-4 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20 pointer-events-none shadow-2xl">
                    Mesa {table.number} • {getStatusText(table.status)}
                  </div>
                </div>
              ))}
            </div>

            {/* Zone Label */}
            <div className="absolute bottom-8 right-8 text-4xl font-black text-slate-100 uppercase tracking-[0.5em] pointer-events-none">
              {activeZone}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm p-8">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-6">Resumen de Estado</h3>
            <div className="space-y-4">
              {[
                { label: 'Ocupación', value: '45%', icon: Utensils, color: 'text-indigo-600', bg: 'bg-indigo-50' },
                { label: 'Mesas Libres', value: '12', icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                { label: 'Reservas Hoy', value: '8', icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", item.bg, item.color)}>
                      <item.icon size={20} />
                    </div>
                    <span className="text-xs font-black text-slate-500 uppercase tracking-widest">{item.label}</span>
                  </div>
                  <span className="text-lg font-black text-slate-900">{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          {selectedTable ? (
            <div className="bg-slate-900 text-white rounded-[2.5rem] p-8 shadow-xl animate-in slide-in-from-right-4 duration-300">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-black uppercase tracking-tight">Mesa {selectedTable.number}</h3>
                <button onClick={() => setSelectedTable(null)} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                  <X size={20} />
                </button>
              </div>
              
              <div className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/10">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Estado</span>
                  <span className={cn(
                    "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest",
                    getStatusColor(selectedTable.status)
                  )}>
                    {getStatusText(selectedTable.status)}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <button className="flex flex-col items-center gap-2 p-4 bg-white/5 rounded-2xl border border-white/10 hover:bg-white/10 transition-all">
                    <Coffee size={20} className="text-indigo-400" />
                    <span className="text-[9px] font-black uppercase tracking-widest">Abrir Cuenta</span>
                  </button>
                  <button className="flex flex-col items-center gap-2 p-4 bg-white/5 rounded-2xl border border-white/10 hover:bg-white/10 transition-all">
                    <Maximize2 size={20} className="text-emerald-400" />
                    <span className="text-[9px] font-black uppercase tracking-widest">Cambiar Mesa</span>
                  </button>
                </div>

                <div className="pt-6 border-t border-white/10">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Acciones Rápidas</p>
                  <div className="space-y-2">
                    <button className="w-full py-3 bg-white text-slate-900 rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-slate-100 transition-all">
                      Marcar como Limpia
                    </button>
                    <button className="w-full py-3 border border-white/10 text-white rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-white/5 transition-all">
                      Ver Comanda Actual
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-indigo-50 border border-indigo-100 rounded-[2.5rem] p-8 text-center">
              <div className="w-16 h-16 bg-white rounded-3xl flex items-center justify-center mx-auto mb-4 text-indigo-500 shadow-sm">
                <LayoutIcon size={32} />
              </div>
              <p className="text-sm font-black text-indigo-900 uppercase tracking-tight">Selecciona una mesa</p>
              <p className="text-xs text-indigo-600 mt-2 font-medium">Haz clic en cualquier mesa del mapa para gestionar su estado y comandas.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
