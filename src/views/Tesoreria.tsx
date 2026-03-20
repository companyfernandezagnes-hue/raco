import React, { useMemo } from 'react';
import { Plus, TrendingUp, TrendingDown, Wallet, ArrowUpRight, ArrowDownLeft, MoreVertical, Calendar, Landmark, FileText, Download, CheckCircle2, X, Sparkles, Brain, ArrowRight, ShieldCheck, Receipt, FileSpreadsheet, AlertTriangle, Zap, Activity, BarChart3, Database, History, Settings2, Share2 } from 'lucide-react';
import { CashEntry, BankTransaction, AppData, BusinessUnit } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { TreasuryService } from '../services/treasury';
import { Num } from '../services/engine';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface TesoreriaViewProps {
  data: AppData;
  onSave: (newData: AppData) => Promise<void>;
}

export default function TesoreriaView({ data, onSave }: TesoreriaViewProps) {
  const [activeTab, setActiveTab] = React.useState<'cash' | 'bank' | 'forecast' | 'docs' | 'fiscal' | 'journal'>('cash');
  const [showNewModal, setShowNewModal] = React.useState(false);
  const [showReconcileWizard, setShowReconcileWizard] = React.useState(false);
  const [isReconcilingAll, setIsReconcilingAll] = React.useState(false);
  const [reconcileProgress, setReconcileProgress] = React.useState(0);
  const [filterUnit, setFilterUnit] = React.useState<BusinessUnit | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedTransactions, setSelectedTransactions] = React.useState<string[]>([]);

  // 🧠 Cálculos en tiempo real usando el servicio
  const summary = useMemo(() => TreasuryService.getSummary(data), [data]);
  const alerts = useMemo(() => {
    const standardAlerts = TreasuryService.getAlerts(data);
    const priceAlerts = TreasuryService.detectPriceIncreases(data);
    
    // 🚨 Nuevas Alertas Proactivas
    const upcomingVencimientos = data.facturas
      .filter(f => !f.paid && f.dueDate)
      .filter(f => {
        const diff = new Date(f.dueDate!).getTime() - new Date().getTime();
        return diff > 0 && diff < (7 * 24 * 60 * 60 * 1000); // 7 días
      })
      .map(f => ({
        id: `venc-${f.id}`,
        title: 'Próximo Vencimiento',
        desc: `Factura ${f.num} de ${f.prov} vence el ${new Date(f.dueDate!).toLocaleDateString()}`,
        type: 'warning' as const
      }));

    const reconciliationDiscrepancies = data.bankTransactions
      .filter(t => t.status === 'Pendiente')
      .map(t => ({
        id: `reconcile-${t.id}`,
        title: 'Discrepancia detectada',
        desc: `Movimiento de ${Num.fmt(t.amount)} sin conciliar desde el ${new Date(t.date).toLocaleDateString()}`,
        type: 'error' as const
      }));

    return [...standardAlerts, ...priceAlerts, ...upcomingVencimientos, ...reconciliationDiscrepancies];
  }, [data]);

  const projection = useMemo(() => TreasuryService.getCashFlowProjection(data), [data]);

  const fiscalSummary = useMemo(() => {
    const ivaSoportado = data.facturas
      .filter(f => f.tipo === 'compra')
      .reduce((acc, f) => acc + Num.parse(f.tax), 0);
    
    // Simulación de IVA Repercutido (Ventas)
    const ivaRepercutido = 4520.30; 

    return {
      soportado: ivaSoportado,
      repercutido: ivaRepercutido,
      balance: ivaRepercutido - ivaSoportado
    };
  }, [data]);

  const handleReconcile = async (transactionId: string, invoiceId: string) => {
    const { updatedTransactions, updatedInvoices, updatedAlbaranes } = TreasuryService.reconcile(
      data.bankTransactions,
      data.facturas,
      transactionId,
      invoiceId,
      data.albaranes
    );

    await onSave({
      ...data,
      bankTransactions: updatedTransactions,
      facturas: updatedInvoices,
      albaranes: updatedAlbaranes || data.albaranes
    });
  };

  const handleReconcileAll = async () => {
    setIsReconcilingAll(true);
    setReconcileProgress(0);
    
    const suggestions = TreasuryService.findMatches(data.bankTransactions, data.facturas);
    const matches = suggestions.filter(s => s.confidence >= 80 && s.invoice);

    let currentData = { ...data };

    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      if (match.invoice) {
        const result = TreasuryService.reconcile(
          currentData.bankTransactions,
          currentData.facturas,
          match.transaction.id,
          match.invoice.id,
          currentData.albaranes
        );
        currentData = {
          ...currentData,
          bankTransactions: result.updatedTransactions,
          facturas: result.updatedInvoices,
          albaranes: result.updatedAlbaranes || currentData.albaranes
        };
      }
      setReconcileProgress(Math.round(((i + 1) / matches.length) * 100));
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    await onSave(currentData);
    setIsReconcilingAll(false);
    setShowReconcileWizard(false);
  };

  const filteredTransactions = useMemo(() => {
    return data.bankTransactions.filter(t => {
      const matchesSearch = t.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesSearch;
    });
  }, [data.bankTransactions, searchQuery]);

  const filteredInvoices = useMemo(() => {
    return data.facturas.filter(f => {
      const matchesUnit = filterUnit === 'ALL' || f.unidad_negocio === filterUnit;
      const matchesSearch = f.prov.toLowerCase().includes(searchQuery.toLowerCase()) || f.num.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesUnit && matchesSearch;
    });
  }, [data.facturas, filterUnit, searchQuery]);

  const [newMovement, setNewMovement] = React.useState({
    description: '',
    amount: '',
    category: 'Ventas',
    type: 'ingreso' as 'ingreso' | 'gasto'
  });

  const handleSaveMovement = async () => {
    if (!newMovement.description || !newMovement.amount) return;

    const amount = parseFloat(newMovement.amount) * (newMovement.type === 'gasto' ? -1 : 1);
    const lastBalance = data.bankTransactions.length > 0 ? data.bankTransactions[0].balance : 12450.30;

    const newTransaction: BankTransaction = {
      id: Math.random().toString(36).substr(2, 9),
      date: new Date().toISOString().split('T')[0],
      description: newMovement.description,
      amount: amount,
      balance: lastBalance + amount,
      status: 'Pendiente'
    };

    await onSave({
      ...data,
      bankTransactions: [newTransaction, ...data.bankTransactions]
    });

    setShowNewModal(false);
    setNewMovement({ description: '', amount: '', category: 'Ventas', type: 'ingreso' });
  };

  const forecastData = [
    { name: 'Sem 1', actual: 12000, predicted: 12000 },
    { name: 'Sem 2', actual: 13500, predicted: 13500 },
    { name: 'Sem 3', actual: 12800, predicted: 12800 },
    { name: 'Sem 4', predicted: 14200 },
    { name: 'Sem 5', predicted: 15500 },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Tesorería y Banco</h1>
          <p className="text-slate-500 text-sm">Control de flujo de caja, conciliación bancaria y documentos.</p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-all">
            <Landmark size={18} className="text-blue-600" />
            La Caixa
          </button>
          <button 
            onClick={() => setShowNewModal(true)}
            className="flex items-center justify-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-emerald-700 transition-all shadow-sm shadow-emerald-100"
          >
            <Plus size={18} />
            Nuevo Movimiento
          </button>
        </div>
      </div>

      {/* 🚨 Centro de Alertas Inteligentes */}
      {alerts.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {alerts.slice(0, 4).map((alert) => (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              key={alert.id} 
              className={cn(
                "p-4 rounded-2xl border flex gap-3 items-start relative overflow-hidden",
                alert.type === 'error' ? "bg-rose-50 border-rose-100 text-rose-900" :
                alert.type === 'warning' ? "bg-amber-50 border-amber-100 text-amber-900" :
                "bg-blue-50 border-blue-100 text-blue-900"
              )}
            >
              <div className={cn(
                "mt-0.5 p-1.5 rounded-lg",
                alert.type === 'error' ? "bg-rose-100 text-rose-600" :
                alert.type === 'warning' ? "bg-amber-100 text-amber-600" :
                "bg-blue-100 text-blue-600"
              )}>
                {alert.type === 'error' ? <X size={16} /> : alert.type === 'warning' ? <AlertTriangle size={16} /> : <Brain size={16} />}
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-tight">{alert.title}</p>
                <p className="text-[11px] font-medium opacity-80 leading-tight mt-0.5">{alert.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <input 
              type="text" 
              placeholder="Buscar..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
            />
            <MoreVertical size={16} className="absolute left-3 top-2.5 text-slate-400 rotate-90" />
          </div>
          <select 
            value={filterUnit}
            onChange={(e) => setFilterUnit(e.target.value as any)}
            className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 outline-none"
          >
            <option value="ALL">Todas las Unidades</option>
            <option value="REST">Restaurante</option>
            <option value="DLV">Delivery</option>
            <option value="SHOP">Tienda</option>
            <option value="CORP">Corporativo</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all">
            <Settings2 size={20} />
          </button>
          <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all">
            <Download size={20} />
          </button>
        </div>
      </div>

      <div className="flex gap-1 p-1 bg-slate-100 rounded-2xl w-fit overflow-x-auto max-w-full">
        {(['cash', 'bank', 'payments', 'forecast', 'docs', 'fiscal', 'journal', 'automation', 'whatif'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "px-4 py-2 rounded-xl text-sm font-bold transition-all uppercase tracking-wider whitespace-nowrap",
              activeTab === tab ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}
          >
            {tab === 'cash' ? 'Caja' : 
             tab === 'bank' ? 'Banco' : 
             tab === 'payments' ? 'Pagos' : 
             tab === 'forecast' ? 'Previsión' : 
             tab === 'fiscal' ? 'Fiscal' : 
             tab === 'journal' ? 'Diario' : 
             tab === 'automation' ? 'n8n/IA' : 
             tab === 'whatif' ? 'Simulador' : 'Docs'}
          </button>
        ))}
      </div>

      {activeTab === 'cash' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Wallet size={80} />
              </div>
              <p className="text-sm font-medium text-slate-500 mb-1">Saldo Caja</p>
              <p className="text-3xl font-bold text-slate-900">2.450,30 €</p>
              <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-emerald-600">
                <TrendingUp size={14} />
                +4.2% vs mes anterior
              </div>
            </div>
            <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-sm font-medium text-slate-500 mb-1">Ingresos (Mes)</p>
              <p className="text-3xl font-bold text-emerald-600">24.120,00 €</p>
              <div className="mt-4 w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                <div className="bg-emerald-500 h-full w-[75%]" />
              </div>
              <p className="mt-2 text-[10px] text-slate-400 uppercase font-bold tracking-wider">75% del objetivo mensual</p>
            </div>
            <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-sm font-medium text-slate-500 mb-1">Gastos (Mes)</p>
              <p className="text-3xl font-bold text-rose-600">11.669,70 €</p>
              <div className="mt-4 w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                <div className="bg-rose-500 h-full w-[48%]" />
              </div>
              <p className="mt-2 text-[10px] text-slate-400 uppercase font-bold tracking-wider">48% del presupuesto</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-800">Movimientos Recientes</h3>
              <button className="text-xs font-bold text-emerald-600 hover:text-emerald-700 uppercase tracking-wider">Ver Todo</button>
            </div>
            <div className="divide-y divide-slate-50">
              {data.facturas.slice(0, 5).map((entry) => (
                <div key={entry.id} className="flex items-center justify-between p-6 hover:bg-slate-50/50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center",
                      entry.tipo === 'compra' ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"
                    )}>
                      {entry.tipo === 'compra' ? <ArrowDownLeft size={24} /> : <ArrowUpRight size={24} />}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900">{entry.prov}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs font-medium text-slate-400">{new Date(entry.date).toLocaleDateString('es-ES')}</span>
                        <span className="text-slate-200">•</span>
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-tight">{entry.category || 'Sin categoría'}</span>
                        <span className="text-slate-200">•</span>
                        <span className="text-xs font-medium text-slate-400">{entry.source}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={cn(
                      "text-lg font-bold",
                      entry.tipo === 'compra' ? "text-rose-600" : "text-emerald-600"
                    )}>
                      {entry.tipo === 'compra' ? '-' : '+'}{Num.fmt(Num.parse(entry.total))}
                    </p>
                    <button className="text-slate-300 hover:text-slate-500 mt-1">
                      <MoreVertical size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {activeTab === 'bank' && (
        <div className="space-y-6">
          <div className="bg-blue-600 text-white p-8 rounded-3xl shadow-xl shadow-blue-100 flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-xs font-bold uppercase tracking-widest mb-1">Saldo en La Caixa</p>
              <p className="text-4xl font-black">12.450,30 €</p>
              <div className="flex items-center gap-4 mt-4">
                <button 
                  onClick={() => setShowReconcileWizard(true)}
                  className="bg-white text-blue-600 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-50 transition-all flex items-center gap-2"
                >
                  <Sparkles size={14} />
                  Conciliación IA
                </button>
                <p className="text-blue-200 text-[10px] uppercase font-bold tracking-widest">Sincronizado hace 5m</p>
              </div>
            </div>
            <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center">
              <Landmark size={32} />
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-800">Extracto Bancario</h3>
              <button className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1">
                <Download size={14} /> Exportar Excel
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="px-6 py-3 w-10">
                      <input 
                        type="checkbox" 
                        className="rounded border-slate-300"
                        checked={selectedTransactions.length === filteredTransactions.length}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedTransactions(filteredTransactions.map(t => t.id));
                          else setSelectedTransactions([]);
                        }}
                      />
                    </th>
                    <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase">Fecha</th>
                    <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase">Concepto</th>
                    <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase text-right">Importe</th>
                    <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase text-right">Saldo</th>
                    <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredTransactions.map((t) => (
                    <tr key={t.id} className={cn(
                      "hover:bg-slate-50/30 transition-colors",
                      selectedTransactions.includes(t.id) && "bg-blue-50/50"
                    )}>
                      <td className="px-6 py-4">
                        <input 
                          type="checkbox" 
                          className="rounded border-slate-300"
                          checked={selectedTransactions.includes(t.id)}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedTransactions(prev => [...prev, t.id]);
                            else setSelectedTransactions(prev => prev.filter(id => id !== t.id));
                          }}
                        />
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-500">{new Date(t.date).toLocaleDateString('es-ES')}</td>
                      <td className="px-6 py-4 text-sm font-bold text-slate-700">{t.description}</td>
                      <td className={cn(
                        "px-6 py-4 text-sm text-right font-bold",
                        t.amount > 0 ? "text-emerald-600" : "text-slate-900"
                      )}>
                        {t.amount.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                      </td>
                      <td className="px-6 py-4 text-sm text-right font-mono text-slate-500">{t.balance.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</td>
                      <td className="px-6 py-4 text-center">
                        {t.status === 'Conciliado' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-50 text-emerald-600">
                            Conciliado
                          </span>
                        ) : (
                          <button 
                            onClick={() => setShowReconcileWizard(true)}
                            className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-50 text-amber-600 hover:bg-amber-100 transition-all"
                          >
                            Conciliar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'payments' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 uppercase tracking-tight">Programación de Pagos a Proveedores</h3>
              <div className="flex gap-2">
                <span className="px-3 py-1 bg-amber-50 text-amber-600 rounded-lg text-[10px] font-black uppercase">Vencidos: {data.facturas.filter(f => !f.paid && new Date(f.dueDate || '') < new Date()).length}</span>
                <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-black uppercase">Pendientes: {data.facturas.filter(f => !f.paid).length}</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase">Vencimiento</th>
                    <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase">Proveedor</th>
                    <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase">Factura</th>
                    <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase text-right">Importe</th>
                    <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase text-center">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredInvoices.filter(f => !f.paid).sort((a, b) => new Date(a.dueDate || '').getTime() - new Date(b.dueDate || '').getTime()).map((f) => (
                    <tr key={f.id} className="hover:bg-slate-50/30 transition-colors">
                      <td className={cn(
                        "px-6 py-4 text-sm font-bold",
                        new Date(f.dueDate || '') < new Date() ? "text-rose-600" : "text-slate-500"
                      )}>
                        {f.dueDate ? new Date(f.dueDate).toLocaleDateString('es-ES') : 'S/V'}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-slate-700">{f.prov}</span>
                          {f.albaranIdsArr && f.albaranIdsArr.length > 0 && (
                            <div className="flex items-center gap-1 mt-1">
                              <Database size={10} className="text-blue-500" />
                              <span className="text-[9px] font-bold text-blue-500 uppercase tracking-widest">{f.albaranIdsArr.length} Albaranes Vinculados</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-500">{f.num}</td>
                      <td className="px-6 py-4 text-sm text-right font-black text-slate-900">{Num.fmt(Num.parse(f.total))}</td>
                      <td className="px-6 py-4 text-center">
                        <button className="px-3 py-1.5 bg-slate-900 text-white rounded-lg text-[10px] font-black uppercase hover:bg-slate-800 transition-all">
                          Pagar Ahora
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'forecast' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Previsión de Flujo de Caja</h3>
                  <p className="text-xs text-slate-500 font-medium">Predicción basada en histórico de ventas y gastos fijos.</p>
                </div>
                <div className="flex gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-blue-500" />
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Real</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-blue-200" />
                    <span className="text-[10px] font-bold text-slate-500 uppercase">IA Predicted</span>
                  </div>
                </div>
              </div>
              <div className="h-80 w-full min-h-[320px]">
                <ResponsiveContainer width="100%" height="100%" minHeight={320}>
                  <AreaChart data={forecastData}>
                    <defs>
                      <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    />
                    <Area type="monotone" dataKey="actual" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorActual)" />
                    <Area type="monotone" dataKey="predicted" stroke="#93c5fd" strokeWidth={2} strokeDasharray="5 5" fill="none" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="bg-slate-900 text-white p-8 rounded-[3rem] shadow-xl shadow-slate-200 flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center mb-6">
                  <Brain size={24} className="text-blue-400" />
                </div>
                <h3 className="text-xl font-black uppercase tracking-tight mb-4">Insights de IA</h3>
                <div className="space-y-4">
                  <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                    <p className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-1">Alerta de Liquidez</p>
                    <p className="text-sm text-slate-300 leading-relaxed">Se prevé un pico de gastos en la Semana 4 (Seguros Sociales). Recomendamos retrasar compras no críticas.</p>
                  </div>
                  <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                    <p className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-1">Oportunidad</p>
                    <p className="text-sm text-slate-300 leading-relaxed">Excedente de tesorería previsto de 3.500€. Buen momento para negociar pronto pago con proveedores.</p>
                  </div>
                </div>
              </div>
              <button className="w-full mt-8 bg-blue-500 text-slate-900 py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-blue-400 transition-all flex items-center justify-center gap-2">
                Optimizar Flujo
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'docs' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            { name: 'Modelo 303 (IVA)', date: 'Q1 2026', status: 'Pendiente', icon: FileText },
            { name: 'Modelo 111 (Retenciones)', date: 'Marzo 2026', status: 'Listo', icon: FileText },
            { name: 'Seguros Sociales (TC1/TC2)', date: 'Febrero 2026', status: 'Pagado', icon: CheckCircle2 },
            { name: 'Impuesto Sociedades', date: 'Anual 2025', status: 'Archivado', icon: FileText },
            { name: 'Contratos de Alquiler', date: 'Vigente', status: 'Vigente', icon: FileText },
          ].map((doc, i) => (
            <div key={i} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-start gap-4 hover:shadow-md transition-all cursor-pointer group">
              <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-all">
                <doc.icon size={24} />
              </div>
              <div className="flex-1">
                <p className="font-bold text-slate-900">{doc.name}</p>
                <p className="text-xs text-slate-500 mt-0.5">{doc.date}</p>
                <div className="mt-3 flex items-center justify-between">
                  <span className={cn(
                    "px-2 py-0.5 rounded-full text-[10px] font-black uppercase",
                    doc.status === 'Listo' || doc.status === 'Pagado' ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                  )}>{doc.status}</span>
                  <Download size={16} className="text-slate-300 hover:text-slate-600" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'fiscal' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-8 bg-white rounded-[2.5rem] border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center">
                <ArrowDownLeft size={24} />
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">IVA Soportado</p>
                <p className="text-2xl font-black text-slate-900">{Num.fmt(fiscalSummary.soportado)}</p>
              </div>
            </div>
            <p className="text-xs text-slate-500">Total IVA deducible de tus facturas de compra recibidas este trimestre.</p>
          </div>

          <div className="p-8 bg-white rounded-[2.5rem] border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
                <ArrowUpRight size={24} />
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">IVA Repercutido</p>
                <p className="text-2xl font-black text-slate-900">{Num.fmt(fiscalSummary.repercutido)}</p>
              </div>
            </div>
            <p className="text-xs text-slate-500">Total IVA cobrado en tus ventas. Este importe se compensa con el soportado.</p>
          </div>

          <div className={cn(
            "p-8 rounded-[2.5rem] border shadow-xl flex flex-col justify-between",
            fiscalSummary.balance > 0 ? "bg-slate-900 text-white border-slate-800" : "bg-emerald-600 text-white border-emerald-500"
          )}>
            <div>
              <div className="flex items-center justify-between mb-4">
                <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Resultado Estimado</p>
                <Receipt size={20} />
              </div>
              <p className="text-4xl font-black tracking-tighter mb-2">{Num.fmt(Math.abs(fiscalSummary.balance))}</p>
              <p className="text-xs font-medium opacity-80">
                {fiscalSummary.balance > 0 ? "A pagar a la AEAT" : "A devolver / compensar"}
              </p>
            </div>
            <button className="mt-6 w-full py-3 bg-white/10 hover:bg-white/20 border border-white/20 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all">
              Generar Borrador Modelo 303
            </button>
          </div>
        </div>
      )}

      {activeTab === 'automation' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Innovación AI-4: Intelligent Budgeting */}
            <div className="p-6 bg-white rounded-3xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
                  <Brain size={20} />
                </div>
                <h3 className="font-bold text-slate-800 uppercase tracking-tight">Presupuesto Dinámico IA</h3>
              </div>
              <p className="text-xs text-slate-500 mb-4">Ajuste automático de límites basado en ingresos reales.</p>
              <div className="space-y-3">
                <div className="flex justify-between text-[10px] font-bold uppercase">
                  <span className="text-slate-400">Compras</span>
                  <span className="text-emerald-600">+12% vs Plan</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div className="bg-emerald-500 h-full w-[85%]" />
                </div>
              </div>
            </div>

            {/* Innovación AI-5: Predictive Tax Provisioning */}
            <div className="p-6 bg-white rounded-3xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                  <Activity size={20} />
                </div>
                <h3 className="font-bold text-slate-800 uppercase tracking-tight">Provisión Fiscal IA</h3>
              </div>
              <p className="text-xs text-slate-500 mb-4">Cálculo predictivo de IVA e IRPF para el próximo trimestre.</p>
              <div className="flex items-end gap-2">
                <p className="text-2xl font-black text-slate-900">4.120,50 €</p>
                <span className="text-[10px] font-bold text-blue-500 mb-1 uppercase">Estimado</span>
              </div>
            </div>

            {/* Innovación n8n: Webhook Integration */}
            <div className="p-6 bg-slate-900 text-white rounded-3xl shadow-xl shadow-slate-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-white/10 text-blue-400 rounded-xl">
                  <Zap size={20} />
                </div>
                <h3 className="font-bold uppercase tracking-tight">Automatización n8n</h3>
              </div>
              <p className="text-xs text-slate-400 mb-6">Dispara flujos de trabajo externos (Slack, Email, Google Sheets).</p>
              <button className="w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2">
                Ejecutar Workflow n8n
                <Share2 size={14} />
              </button>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 uppercase tracking-tight">Historial de Precios y Estabilidad</h3>
              <History size={18} className="text-slate-400" />
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Top Subidas de Precio (30d)</h4>
                  <div className="space-y-4">
                    {TreasuryService.detectPriceIncreases(data).map((alert, i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-rose-50 rounded-xl border border-rose-100">
                        <span className="text-xs font-bold text-rose-900">{alert.title}</span>
                        <span className="text-xs font-black text-rose-600">{alert.desc.split(': ')[1]}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Índice de Estabilidad</h4>
                  <p className="text-3xl font-black text-slate-900">84/100</p>
                  <p className="text-xs text-slate-500 mt-2">Tus proveedores mantienen precios estables. Solo 2 productos han subido &gt;5% este mes.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'whatif' && (
        <div className="space-y-6">
          <div className="bg-slate-900 rounded-[3rem] p-12 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 p-12 opacity-10">
              <TrendingUp size={160} />
            </div>
            <div className="relative z-10 max-w-2xl">
              <h3 className="text-3xl font-black uppercase tracking-tight mb-4">Simulador de Escenarios</h3>
              <p className="text-slate-400 text-lg font-medium leading-relaxed mb-8">
                ¿Qué pasaría si tus ventas suben un 10%? ¿O si el coste de personal aumenta? Simula el impacto en tu tesorería antes de tomar decisiones.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Ventas Estimadas (+/- %)</label>
                  <input type="range" className="w-full accent-blue-500" min="-50" max="50" defaultValue="0" />
                  <div className="flex justify-between text-xs font-bold">
                    <span>-50%</span>
                    <span className="text-blue-400">0%</span>
                    <span>+50%</span>
                  </div>
                </div>
                <div className="space-y-4">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Gastos Operativos (+/- %)</label>
                  <input type="range" className="w-full accent-rose-500" min="-50" max="50" defaultValue="0" />
                  <div className="flex justify-between text-xs font-bold">
                    <span>-50%</span>
                    <span className="text-rose-400">0%</span>
                    <span>+50%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-8 bg-white rounded-[2.5rem] border border-slate-200 shadow-sm">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Impacto en Saldo Final</p>
              <p className="text-3xl font-black text-slate-900">+4.520,00 €</p>
              <p className="text-xs text-emerald-600 font-bold mt-2">Escenario Optimista</p>
            </div>
            <div className="p-8 bg-white rounded-[2.5rem] border border-slate-200 shadow-sm">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Punto de Equilibrio</p>
              <p className="text-3xl font-black text-slate-900">Día 18</p>
              <p className="text-xs text-slate-500 font-bold mt-2">Basado en promedios</p>
            </div>
            <div className="p-8 bg-white rounded-[2.5rem] border border-slate-200 shadow-sm">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Riesgo de Impago</p>
              <p className="text-3xl font-black text-emerald-600">Bajo</p>
              <p className="text-xs text-slate-500 font-bold mt-2">IA Score: 92/100</p>
            </div>
          </div>
        </div>
      )}

      {/* Reconciliation Wizard Modal */}
      {showReconcileWizard && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-[3rem] w-full max-w-2xl shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white">
                  <Sparkles size={20} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Conciliación Inteligente</h2>
                  <p className="text-xs text-slate-500 font-medium">IA ha encontrado 3 coincidencias potenciales.</p>
                </div>
              </div>
              <button onClick={() => setShowReconcileWizard(false)} className="p-2 hover:bg-slate-200 rounded-xl transition-all">
                <X size={20} className="text-slate-400" />
              </button>
            </div>
            <div className="p-8 space-y-6 max-h-[60vh] overflow-y-auto">
              {isReconcilingAll ? (
                <div className="py-20 flex flex-col items-center justify-center text-center">
                  <div className="w-24 h-24 bg-blue-50 text-blue-600 rounded-[2rem] flex items-center justify-center mb-6 animate-pulse">
                    <Brain size={48} />
                  </div>
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-2">Procesando con IA</h3>
                  <p className="text-slate-500 text-sm mb-8">Analizando patrones de transacciones y facturas...</p>
                  <div className="w-full max-w-xs bg-slate-100 h-3 rounded-full overflow-hidden">
                    <div 
                      className="bg-blue-600 h-full transition-all duration-300 ease-out"
                      style={{ width: `${reconcileProgress}%` }}
                    />
                  </div>
                  <p className="mt-4 text-[10px] font-black text-blue-600 uppercase tracking-widest">{reconcileProgress}% Completado</p>
                </div>
              ) : (
                TreasuryService.findMatches(data.bankTransactions, data.facturas)
                  .filter(s => s.confidence >= 50 && s.invoice)
                  .map((match, i) => (
                    <div key={i} className="p-6 bg-slate-50 rounded-3xl border border-slate-100 flex items-center justify-between group hover:border-blue-200 hover:bg-blue-50/30 transition-all">
                      <div className="space-y-4 flex-1">
                        <div className="flex items-center gap-4">
                          <div className="flex-1">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Banco</p>
                            <p className="text-sm font-bold text-slate-900">{match.transaction.description}</p>
                            <p className="text-xs font-mono text-slate-500">{Num.fmt(match.transaction.amount)}</p>
                          </div>
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                            <ArrowRight size={14} />
                          </div>
                          <div className="flex-1">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">ERP Sugerencia</p>
                            <p className="text-sm font-bold text-emerald-600">{match.invoice?.prov}</p>
                            <div className="flex items-center gap-1 mt-1">
                              <ShieldCheck size={12} className={cn(
                                match.confidence >= 80 ? "text-blue-500" : "text-amber-500"
                              )} />
                              <span className={cn(
                                "text-[10px] font-black uppercase",
                                match.confidence >= 80 ? "text-blue-500" : "text-amber-500"
                              )}>{match.confidence}% Confianza</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleReconcile(match.transaction.id, match.invoice!.id)}
                        className="ml-6 bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-slate-800 transition-all"
                      >
                        Conciliar
                      </button>
                    </div>
                  ))
              )}
              {!isReconcilingAll && TreasuryService.findMatches(data.bankTransactions, data.facturas).filter(s => s.confidence >= 50 && s.invoice).length === 0 && (
                <div className="py-12 text-center">
                  <CheckCircle2 className="w-12 h-12 text-emerald-200 mx-auto mb-4" />
                  <p className="text-slate-500 font-bold">No hay sugerencias pendientes.</p>
                  <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-1">Todo parece estar al día</p>
                </div>
              )}
            </div>
            <div className="p-8 bg-slate-50 border-t border-slate-100 flex gap-3">
              <button 
                onClick={() => setShowReconcileWizard(false)}
                disabled={isReconcilingAll}
                className="flex-1 px-4 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl font-bold hover:bg-slate-50 transition-all disabled:opacity-50"
              >
                Omitir por ahora
              </button>
              <button 
                onClick={handleReconcileAll}
                disabled={isReconcilingAll}
                className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 disabled:opacity-50"
              >
                {isReconcilingAll ? 'Procesando...' : 'Conciliar Todo (IA)'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Movement Modal */}
      {showNewModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">Nuevo Movimiento</h2>
              <button onClick={() => setShowNewModal(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-all">
                <X size={20} className="text-slate-400" />
              </button>
            </div>
            <div className="p-8 space-y-4">
              <div className="flex gap-2 p-1 bg-slate-100 rounded-xl">
                <button 
                  onClick={() => setNewMovement(prev => ({ ...prev, type: 'ingreso' }))}
                  className={cn(
                    "flex-1 py-2 rounded-lg text-sm font-bold transition-all",
                    newMovement.type === 'ingreso' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                  )}
                >
                  Ingreso
                </button>
                <button 
                  onClick={() => setNewMovement(prev => ({ ...prev, type: 'gasto' }))}
                  className={cn(
                    "flex-1 py-2 rounded-lg text-sm font-bold transition-all",
                    newMovement.type === 'gasto' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                  )}
                >
                  Gasto
                </button>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase">Descripción</label>
                <input 
                  type="text" 
                  value={newMovement.description}
                  onChange={(e) => setNewMovement(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 outline-none" 
                  placeholder="Ej: Venta TPV" 
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">Importe</label>
                  <input 
                    type="number" 
                    value={newMovement.amount}
                    onChange={(e) => setNewMovement(prev => ({ ...prev, amount: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 outline-none" 
                    placeholder="0.00" 
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">Categoría</label>
                  <select 
                    value={newMovement.category}
                    onChange={(e) => setNewMovement(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 outline-none"
                  >
                    <option>Ventas</option>
                    <option>Suministros</option>
                    <option>Personal</option>
                    <option>Alquiler</option>
                  </select>
                </div>
              </div>
              
              <div className="pt-4 flex gap-3">
                <button 
                  onClick={() => setShowNewModal(false)}
                  className="flex-1 px-4 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleSaveMovement}
                  className="flex-1 px-4 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
                >
                  Guardar Movimiento
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
