import React from 'react';
import { 
  Landmark, 
  RefreshCw, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Search, 
  Filter, 
  CheckCircle2, 
  AlertCircle,
  Download,
  Plus,
  MoreVertical,
  PieChart,
  TrendingUp,
  FileText,
  Sparkles,
  ArrowRight,
  Activity
} from 'lucide-react';
import { BankAccount, BankTransaction } from '../types';
import { cn, formatCurrency } from '../lib/utils';
import { useAppData } from '../hooks/useAppData';
import { TreasuryService } from '../services/treasury';

export default function BancoView() {
  const { data, onSave } = useAppData();
  const [isSyncing, setIsSyncing] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<'Todos' | 'Conciliado' | 'Pendiente'>('Todos');
  const [categoryFilter, setCategoryFilter] = React.useState<string>('Todas');
  const [activeTab, setActiveTab] = React.useState<'Movimientos' | 'Libro Diario'>('Movimientos');

  const transactions = data.bankTransactions || [];
  const balance = transactions.reduce((acc, t) => acc + t.amount, 0);

  const categories = Array.from(new Set(transactions.map(t => t.category).filter(Boolean))) as string[];
  if (categories.length === 0) categories.push('Ventas', 'Suministros', 'Personal', 'Impuestos', 'Caja');

  const handleSync = () => {
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
    }, 2000);
  };

  const handleCategoryChange = (id: string, newCategory: string) => {
    const updatedTransactions = transactions.map(t => t.id === id ? { ...t, category: newCategory } : t);
    onSave({ ...data, bankTransactions: updatedTransactions });
  };

  const filteredTransactions = transactions.filter(t => {
    const matchesStatus = statusFilter === 'Todos' ? true : t.status === statusFilter;
    const matchesCategory = categoryFilter === 'Todas' ? true : t.category === categoryFilter;
    const matchesSearch = t.description.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         (t.category || '').toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesCategory && matchesSearch;
  });

  // AI Innovation: Smart Matching Suggestions
  const matches = React.useMemo(() => {
    return TreasuryService.findMatches(transactions, data.facturas);
  }, [transactions, data.facturas]);

  const handleAutoReconcile = (transactionId: string) => {
    const match = matches.find(m => m.transaction.id === transactionId);
    if (match && match.invoice) {
      const { updatedTransactions, updatedInvoices, updatedAlbaranes } = TreasuryService.reconcile(
        transactions,
        data.facturas,
        transactionId,
        match.invoice.id,
        data.albaranes
      );
      onSave({
        ...data,
        bankTransactions: updatedTransactions,
        facturas: updatedInvoices,
        albaranes: updatedAlbaranes || data.albaranes
      });
    }
  };

  const handleReconcileAll = () => {
    const { updatedTransactions, updatedInvoices, updatedAlbaranes } = TreasuryService.reconcileAll(data);
    onSave({
      ...data,
      bankTransactions: updatedTransactions,
      facturas: updatedInvoices,
      albaranes: updatedAlbaranes
    });
  };

  const accountingEntries = React.useMemo(() => {
    return transactions
      .filter(t => t.status === 'Conciliado' && t.reconciledId)
      .map(t => {
        const inv = data.facturas.find(f => f.id === t.reconciledId);
        if (!inv) return null;
        return TreasuryService.generateAccountingEntry(t, inv);
      })
      .filter(Boolean);
  }, [transactions, data.facturas]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Landmark className="text-blue-600" />
            Gestión Bancaria
          </h1>
          <p className="text-slate-500 text-sm">Integración con La Caixa y conciliación inteligente de movimientos.</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={handleReconcileAll}
            className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
          >
            <Sparkles size={18} />
            Conciliar Todo (IA)
          </button>
          <button 
            onClick={handleSync}
            disabled={isSyncing}
            className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-all disabled:opacity-50"
          >
            <RefreshCw size={18} className={cn(isSyncing && "animate-spin")} />
            {isSyncing ? "Sincronizando..." : "Sincronizar"}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-100 p-1 rounded-2xl w-fit">
        {(['Movimientos', 'Libro Diario'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
              activeTab === tab ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-blue-600 text-white p-8 rounded-[2.5rem] shadow-xl shadow-blue-100 relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 w-32 h-32 bg-white/10 rounded-full blur-3xl group-hover:scale-110 transition-transform" />
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-8">
                <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
                  <Landmark size={24} />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest bg-white/20 px-2 py-1 rounded-lg">La Caixa</span>
              </div>
              <p className="text-blue-100 text-xs font-bold uppercase tracking-widest mb-1">Cuenta Operativa</p>
              <p className="text-3xl font-black mb-1">{formatCurrency(balance)}</p>
              <p className="text-blue-200 text-[10px] font-medium">ES21 2100 **** **** 1234</p>
              <div className="mt-8 flex items-center gap-2 text-xs font-bold text-blue-100">
                <RefreshCw size={14} />
                Sincronizado: {new Date().toLocaleTimeString('es-ES')}
              </div>
            </div>
          </div>

          {/* AI Insights Card */}
          <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4">
              <Sparkles className="text-emerald-400 animate-pulse" size={20} />
            </div>
            <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-4">AI Accounting Assistant</h3>
            <div className="space-y-4">
              <p className="text-sm text-slate-300 leading-relaxed">
                He detectado <span className="text-emerald-400 font-bold">{matches.filter(m => m.invoice).length} conciliaciones</span> posibles. 
                Esto generará automáticamente los asientos en la cuenta <span className="text-blue-400">400.0 (Proveedores)</span> contra <span className="text-blue-400">572.0 (Bancos)</span>.
              </p>
              <div className="p-3 bg-white/5 rounded-xl border border-white/10">
                <div className="flex justify-between items-end mb-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Impacto Contable</span>
                  <span className="text-emerald-400 font-bold">Automatizado</span>
                </div>
                <div className="mt-2 space-y-1">
                  <div className="flex justify-between text-[10px]">
                    <span className="text-slate-500">Facturas a cerrar:</span>
                    <span className="text-slate-300">{matches.filter(m => m.invoice).length}</span>
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span className="text-slate-500">Albaranes vinculados:</span>
                    <span className="text-slate-300">
                      {matches.reduce((acc, m) => acc + (m.invoice?.albaranIdsArr?.length || 0), 0)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity size={18} className="text-indigo-600" />
                Mapa de Calor (Actividad)
              </div>
              <Sparkles size={14} className="text-indigo-400" />
            </h3>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: 28 }).map((_, i) => {
                const intensity = Math.floor(Math.random() * 4);
                return (
                  <div 
                    key={i} 
                    className={cn(
                      "aspect-square rounded-sm transition-all hover:scale-110 cursor-help",
                      intensity === 0 && "bg-slate-50",
                      intensity === 1 && "bg-indigo-100",
                      intensity === 2 && "bg-indigo-300",
                      intensity === 3 && "bg-indigo-500",
                      intensity === 4 && "bg-indigo-700"
                    )}
                    title={`Día ${i + 1}: Actividad ${intensity}/4`}
                  />
                );
              })}
            </div>
            <div className="mt-4 flex items-center justify-between text-[8px] font-black text-slate-400 uppercase tracking-widest">
              <span>Menos</span>
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-slate-50 rounded-sm" />
                <div className="w-2 h-2 bg-indigo-100 rounded-sm" />
                <div className="w-2 h-2 bg-indigo-300 rounded-sm" />
                <div className="w-2 h-2 bg-indigo-500 rounded-sm" />
              </div>
              <span>Más</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-4 leading-relaxed italic">
              "Picos de actividad detectados los martes y viernes. Optimiza el flujo de caja programando pagos los lunes."
            </p>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
              <PieChart size={18} className="text-blue-600" />
              Flujo de Caja (7 días)
            </h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-500 font-bold uppercase tracking-tighter">Ingresos</span>
                  <span className="text-emerald-600 font-black">+{formatCurrency(transactions.filter(t => t.amount > 0).reduce((acc, t) => acc + t.amount, 0))}</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div className="bg-emerald-500 h-full w-[80%]" />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-500 font-bold uppercase tracking-tighter">Gastos</span>
                  <span className="text-rose-600 font-black">{formatCurrency(transactions.filter(t => t.amount < 0).reduce((acc, t) => acc + t.amount, 0))}</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div className="bg-rose-500 h-full w-[60%]" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            {activeTab === 'Movimientos' ? (
              <>
                <div className="px-6 py-4 border-b border-slate-100 flex flex-col gap-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-slate-800">Movimientos</h3>
                      <span className="bg-slate-100 text-slate-500 text-[10px] font-black px-2 py-0.5 rounded-full uppercase">
                        {filteredTransactions.length} Transacciones
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input 
                          type="text" 
                          placeholder="Buscar..." 
                          className="pl-9 pr-4 py-2 bg-slate-50 border-none rounded-xl text-xs focus:ring-2 focus:ring-blue-500 transition-all w-40"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                        />
                      </div>
                      <div className="flex bg-slate-100 p-1 rounded-xl">
                        {(['Todos', 'Conciliado', 'Pendiente'] as const).map((t) => (
                          <button
                            key={t}
                            onClick={() => setStatusFilter(t)}
                            className={cn(
                              "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all",
                              statusFilter === t ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                            )}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase mr-2">Filtrar por categoría:</span>
                    <button 
                      onClick={() => setCategoryFilter('Todas')}
                      className={cn(
                        "px-3 py-1 rounded-full text-[10px] font-bold uppercase transition-all",
                        categoryFilter === 'Todas' ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                      )}
                    >
                      Todas
                    </button>
                    {categories.map(cat => (
                      <button 
                        key={cat}
                        onClick={() => setCategoryFilter(cat)}
                        className={cn(
                          "px-3 py-1 rounded-full text-[10px] font-bold uppercase transition-all",
                          categoryFilter === cat ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                        )}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/50">
                        <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase">Fecha</th>
                        <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase">Descripción</th>
                        <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase">Categoría</th>
                        <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase text-right">Importe</th>
                        <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase text-center">Estado</th>
                        <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase text-center">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {filteredTransactions.map((t) => {
                        const match = matches.find(m => m.transaction.id === t.id);
                        const hasMatch = match && match.invoice;

                        return (
                          <tr key={t.id} className={cn(
                            "hover:bg-slate-50/30 transition-colors group",
                            hasMatch && t.status === 'Pendiente' && "bg-emerald-50/30"
                          )}>
                            <td className="px-6 py-4 text-xs text-slate-500 font-medium">{new Intl.DateTimeFormat('es-ES').format(new Date(t.date))}</td>
                            <td className="px-6 py-4">
                              <div className="flex flex-col">
                                <p className="text-sm font-bold text-slate-700">{t.description}</p>
                                {t.documentId && (
                                  <span className="flex items-center gap-1 text-[10px] text-blue-500 font-bold mt-0.5">
                                    <FileText size={10} /> {t.documentId}
                                  </span>
                                )}
                                {hasMatch && t.status === 'Pendiente' && (
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className="flex items-center gap-1 text-[10px] text-emerald-600 font-black uppercase bg-emerald-100 px-1.5 py-0.5 rounded">
                                      <Sparkles size={10} /> Sugerencia IA
                                    </span>
                                    <span className="text-[10px] text-slate-400 font-medium">Coincide con factura {match.invoice?.num}</span>
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <select 
                                value={t.category || ''}
                                onChange={(e) => handleCategoryChange(t.id, e.target.value)}
                                className="bg-slate-100 text-slate-600 rounded-lg text-[10px] font-bold uppercase tracking-tighter border-none focus:ring-2 focus:ring-blue-500/20 outline-none px-2 py-1 cursor-pointer hover:bg-slate-200 transition-all"
                              >
                                <option value="">Sin categoría</option>
                                {categories.map(cat => (
                                  <option key={cat} value={cat}>{cat}</option>
                                ))}
                              </select>
                            </td>
                            <td className={cn(
                              "px-6 py-4 text-sm text-right font-black",
                              t.amount > 0 ? "text-emerald-600" : "text-slate-900"
                            )}>
                              {formatCurrency(t.amount)}
                            </td>
                            <td className="px-6 py-4 text-center">
                              <div className="flex justify-center">
                                {t.status === 'Conciliado' ? (
                                  <div className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full text-[10px] font-black uppercase">
                                    <CheckCircle2 size={12} />
                                    Conciliado
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1 text-amber-600 bg-amber-50 px-2 py-1 rounded-full text-[10px] font-black uppercase">
                                    <AlertCircle size={12} />
                                    Pendiente
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                {hasMatch && t.status === 'Pendiente' ? (
                                  <button 
                                    onClick={() => handleAutoReconcile(t.id)}
                                    className="flex items-center gap-1 bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-[10px] font-black uppercase hover:bg-emerald-700 transition-all shadow-sm"
                                  >
                                    <Sparkles size={12} />
                                    Conciliar IA
                                  </button>
                                ) : (
                                  <>
                                    <button className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all" title="Conciliar Manual">
                                      <CheckCircle2 size={16} />
                                    </button>
                                    <button className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all">
                                      <MoreVertical size={16} />
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="p-0">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="font-bold text-slate-800">Libro Diario (Generado por Conciliación)</h3>
                  <button className="flex items-center gap-2 text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors">
                    <Download size={14} /> Descargar Asientos
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/50">
                        <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase">Fecha</th>
                        <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase">Concepto</th>
                        <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase">Cuenta Debe</th>
                        <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase">Cuenta Haber</th>
                        <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase text-right">Importe</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {accountingEntries.map((entry: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50/30 transition-colors">
                          <td className="px-6 py-4 text-xs text-slate-500 font-medium">{new Intl.DateTimeFormat('es-ES').format(new Date(entry.date))}</td>
                          <td className="px-6 py-4">
                            <p className="text-sm font-bold text-slate-700">{entry.description}</p>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-slate-900">{entry.debit.account}</span>
                              <span className="text-[10px] text-slate-400">Debe</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-slate-900">{entry.credit.account}</span>
                              <span className="text-[10px] text-slate-400">Haber</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right font-black text-slate-900">
                            {formatCurrency(entry.debit.amount)}
                          </td>
                        </tr>
                      ))}
                      {accountingEntries.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-6 py-12 text-center">
                            <div className="w-12 h-12 bg-slate-100 text-slate-300 rounded-2xl flex items-center justify-center mx-auto mb-3">
                              <FileText size={24} />
                            </div>
                            <p className="text-sm text-slate-500 font-bold">No hay asientos contables generados todavía.</p>
                            <p className="text-xs text-slate-400 mt-1">Concilia movimientos bancarios con facturas para generar asientos automáticamente.</p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/30 flex items-center justify-between">
              <button className="text-xs font-bold text-slate-500 hover:text-slate-700 flex items-center gap-2">
                <Download size={14} />
                Descargar Extracto
              </button>
              <div className="flex items-center gap-4 text-xs font-bold">
                <span className="text-slate-400 uppercase tracking-tighter">Saldo Final</span>
                <span className="text-slate-900 text-lg font-black">{formatCurrency(balance)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
