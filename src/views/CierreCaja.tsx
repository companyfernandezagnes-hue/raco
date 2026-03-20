import React from 'react';
import { 
  Calculator, 
  Wallet, 
  CreditCard, 
  Banknote, 
  AlertCircle, 
  CheckCircle2, 
  ArrowRight,
  RefreshCw,
  Printer,
  History,
  TrendingDown,
  TrendingUp,
  Coins,
  Sparkles
} from 'lucide-react';
import { cn, formatCurrency } from '../lib/utils';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

const CierreCajaView = () => {
  const [step, setStep] = React.useState<'count' | 'reconcile' | 'summary'>('count');
  const [cashCount, setCashCount] = React.useState({
    '500': 0, '200': 0, '100': 0, '50': 0, '20': 0, '10': 0, '5': 0,
    '2': 0, '1': 0, '0.5': 0, '0.2': 0, '0.1': 0, '0.05': 0, '0.02': 0, '0.01': 0
  });

  const [isFetching, setIsFetching] = React.useState(false);
  const [softwareData, setSoftwareData] = React.useState({
    cashSales: 1240.50,
    cardSales: 2850.20,
    deliverySales: 450.00,
    totalSales: 4540.70,
    expectedCash: 1240.50 + 200.00,
  });

  const [tips, setTips] = React.useState(0);
  const [finalFloat, setFinalFloat] = React.useState(200);
  const [isReconciling, setIsReconciling] = React.useState(false);
  const [reconciliationStatus, setReconciliationStatus] = React.useState<'pending' | 'success' | 'warning' | 'error'>('pending');

  const historyData = [
    { date: '08/03', discrepancy: 0.50 },
    { date: '09/03', discrepancy: -1.20 },
    { date: '10/03', discrepancy: 0.00 },
    { date: '11/03', discrepancy: 2.10 },
    { date: '12/03', discrepancy: -0.40 },
    { date: '13/03', discrepancy: 0.00 },
  ];

  const handleFetchData = () => {
    setIsFetching(true);
    setTimeout(() => {
      setSoftwareData({
        cashSales: 1240.50,
        cardSales: 2850.20,
        deliverySales: 450.00,
        totalSales: 4540.70,
        expectedCash: 1240.50 + 200.00,
      });
      setIsFetching(false);
    }, 1500);
  };

  const totalCounted = Object.entries(cashCount).reduce((acc, [val, count]) => acc + (parseFloat(val) * (count as number)), 0);
  const discrepancy = totalCounted - softwareData.expectedCash;

  const handleFinalizeCierre = () => {
    setIsReconciling(true);
    setTimeout(() => {
      if (Math.abs(discrepancy) < 0.01) {
        setReconciliationStatus('success');
      } else if (Math.abs(discrepancy) < 5) {
        setReconciliationStatus('warning');
      } else {
        setReconciliationStatus('error');
      }
      setIsReconciling(false);
      setStep('summary');
    }, 2000);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-amber-100">
            <Calculator size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Cierre de Caja</h1>
            <p className="text-slate-500 text-sm">Conciliación diaria de ventas y efectivo.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={handleFetchData}
            disabled={isFetching}
            className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-5 py-3 rounded-2xl text-sm font-bold hover:bg-slate-50 transition-all disabled:opacity-50"
          >
            <RefreshCw size={18} className={cn(isFetching && "animate-spin")} />
            {isFetching ? "Sincronizando..." : "Sincronizar Software"}
          </button>
          <button className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-5 py-3 rounded-2xl text-sm font-bold hover:bg-slate-50 transition-all">
            <History size={18} /> Historial
          </button>
          <button className="flex items-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-2xl text-sm font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-200">
            <Printer size={18} /> Imprimir Último
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-3 flex gap-2 p-1.5 bg-slate-100 rounded-2xl w-fit">
          {[
            { id: 'count', label: '1. Recuento Físico', icon: Banknote },
            { id: 'reconcile', label: '2. Conciliación', icon: RefreshCw },
            { id: 'summary', label: '3. Resumen Final', icon: CheckCircle2 },
          ].map((s) => (
            <button
              key={s.id}
              onClick={() => setStep(s.id as any)}
              className={cn(
                "flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                step === s.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              <s.icon size={14} />
              {s.label}
            </button>
          ))}
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-2 flex items-center justify-between px-4">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tendencia Desfase</span>
          <div className="h-8 w-24">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={historyData}>
                <Line type="monotone" dataKey="discrepancy" stroke="#f59e0b" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {step === 'count' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bg-white rounded-[3rem] border border-slate-200 shadow-sm p-10">
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-8">Desglose de Efectivo</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
              {Object.keys(cashCount).reverse().map((val) => (
                <div key={val} className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                    {parseFloat(val) >= 5 ? `${val} € (Billete)` : `${val} € (Moneda)`}
                  </label>
                  <div className="relative">
                    <input 
                      type="number" 
                      min="0"
                      className="w-full pl-4 pr-12 py-4 bg-slate-50 border-none rounded-2xl text-lg font-black text-slate-900 focus:ring-2 focus:ring-amber-500 transition-all"
                      value={cashCount[val as keyof typeof cashCount] || ''}
                      onChange={(e) => setCashCount({...cashCount, [val]: parseInt(e.target.value) || 0})}
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">uds</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-slate-900 text-white p-8 rounded-[3rem] shadow-xl shadow-slate-200 sticky top-8">
              <h3 className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-8">Total Recuento</h3>
              <div className="space-y-6">
                <div className="flex justify-between items-end">
                  <span className="text-slate-400 text-xs font-bold uppercase">Efectivo Contado</span>
                  <span className="text-4xl font-black text-amber-400">{totalCounted.toFixed(2)} €</span>
                </div>
                <div className="h-px bg-white/10" />
                <div className="space-y-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Esperado (Software)</span>
                    <span className="font-mono">{softwareData.expectedCash.toFixed(2)} €</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Diferencia</span>
                    <span className={cn("font-black", discrepancy >= 0 ? "text-emerald-400" : "text-rose-400")}>
                      {discrepancy >= 0 ? '+' : ''}{discrepancy.toFixed(2)} €
                    </span>
                  </div>
                </div>
                <button 
                  onClick={() => setStep('reconcile')}
                  className="w-full mt-8 bg-amber-500 text-slate-900 py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-amber-400 transition-all flex items-center justify-center gap-2"
                >
                  Continuar Conciliación
                  <ArrowRight size={18} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {step === 'reconcile' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white rounded-[3rem] border border-slate-200 shadow-sm p-10 space-y-8">
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Ventas por Método de Pago</h3>
            <div className="space-y-4">
              {[
                { label: 'Efectivo', value: softwareData.cashSales, icon: Banknote, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                { label: 'Tarjeta / Datáfono', value: softwareData.cardSales, icon: CreditCard, color: 'text-blue-600', bg: 'bg-blue-50' },
                { label: 'Delivery (Glovo/Uber)', value: softwareData.deliverySales, icon: RefreshCw, color: 'text-fuchsia-600', bg: 'bg-fuchsia-50' },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
                  <div className="flex items-center gap-4">
                    <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center", item.bg, item.color)}>
                      <item.icon size={24} />
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-900">{item.label}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Confirmado por Software</p>
                    </div>
                  </div>
                  <p className="text-xl font-black text-slate-900">{formatCurrency(item.value)}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-[3rem] border border-slate-200 shadow-sm p-10 space-y-8">
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Ajustes y Observaciones</h3>
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Propinas Recibidas</label>
                  <div className="relative">
                    <input 
                      type="number" 
                      className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-lg font-black text-slate-900 focus:ring-2 focus:ring-amber-500 transition-all"
                      value={tips}
                      onChange={(e) => setTips(parseFloat(e.target.value) || 0)}
                    />
                    <Coins className="absolute right-4 top-1/2 -translate-y-1/2 text-amber-500" size={20} />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Fondo Mañana</label>
                  <input 
                    type="number" 
                    className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-lg font-black text-slate-900 focus:ring-2 focus:ring-amber-500 transition-all"
                    value={finalFloat}
                    onChange={(e) => setFinalFloat(parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Notas del Cierre</label>
                <textarea 
                  className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-sm font-medium text-slate-700 focus:ring-2 focus:ring-amber-500 transition-all h-32 resize-none"
                  placeholder="Ej: Diferencia de 2€ por error en cambio, propinas no registradas..."
                />
              </div>
              <button 
                onClick={handleFinalizeCierre}
                disabled={isReconciling}
                className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 flex items-center justify-center gap-2"
              >
                {isReconciling ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <CheckCircle2 size={18} />
                )}
                {isReconciling ? "Procesando..." : "Finalizar Cierre de Caja"}
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 'summary' && (
        <div className="max-w-3xl mx-auto bg-white rounded-[3rem] border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-500">
          <div className="p-12 bg-slate-900 text-white text-center space-y-4">
            <div className={cn(
              "w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl",
              reconciliationStatus === 'success' ? "bg-emerald-500 shadow-emerald-500/20" : 
              reconciliationStatus === 'warning' ? "bg-amber-500 shadow-amber-500/20" : "bg-rose-500 shadow-rose-500/20"
            )}>
              {reconciliationStatus === 'success' ? <CheckCircle2 size={40} /> : 
               reconciliationStatus === 'warning' ? <AlertCircle size={40} /> : <AlertCircle size={40} />}
            </div>
            <h2 className="text-3xl font-black uppercase tracking-tight">
              {reconciliationStatus === 'success' ? 'Cierre Cuadrado' : 
               reconciliationStatus === 'warning' ? 'Cierre con Desfase' : 'Cierre Incorrecto'}
            </h2>
            <p className="text-slate-400 font-medium">Viernes, 13 de Marzo de 2026 - Turno de Noche</p>
          </div>
            <div className="p-12 space-y-8">
            {/* AI Discrepancy Analysis Novelty */}
            <div className="p-8 bg-indigo-50 rounded-[2rem] border border-indigo-100 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                  <Sparkles size={20} />
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">Análisis de Desfase IA</h4>
                  <p className="text-[10px] text-indigo-600 font-bold uppercase tracking-widest">Detección de Patrones</p>
                </div>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">
                {discrepancy === 0 
                  ? "La IA no detecta anomalías. El patrón de cierre es consistente con el histórico de los últimos 30 días."
                  : discrepancy < 0 
                    ? `Se detecta un desfase negativo recurrente los viernes. La IA sugiere revisar el cambio entregado en el turno de tarde o posibles errores en el registro de propinas.`
                    : `Desfase positivo inusual. La IA detecta que podría haber cobros en efectivo no registrados en el software de TPV.`
                }
              </p>
              <div className="flex gap-2">
                <span className="px-3 py-1 bg-white rounded-full text-[9px] font-black text-indigo-600 border border-indigo-100 uppercase tracking-widest">Probabilidad Error Humano: 85%</span>
                <span className="px-3 py-1 bg-white rounded-full text-[9px] font-black text-indigo-600 border border-indigo-100 uppercase tracking-widest">Confianza IA: Alta</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-1">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ventas Totales</p>
                <p className="text-2xl font-black text-slate-900">{formatCurrency(softwareData.totalSales)}</p>
              </div>
              <div className="space-y-1 text-right">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Efectivo a Banco</p>
                <p className="text-2xl font-black text-emerald-600">{formatCurrency(totalCounted - 200)}</p>
              </div>
            </div>
            <div className="p-8 bg-slate-50 rounded-[2rem] border border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center",
                  discrepancy === 0 ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600"
                )}>
                  {discrepancy === 0 ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
                </div>
                <div>
                  <p className="text-sm font-black text-slate-900">Resultado de Conciliación</p>
                  <p className="text-xs text-slate-500 font-medium">
                    {discrepancy === 0 ? 'Caja cuadrada perfectamente' : `Desfase de ${discrepancy.toFixed(2)} €`}
                  </p>
                </div>
              </div>
              <span className={cn(
                "px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest",
                discrepancy === 0 ? "bg-emerald-500 text-white" : "bg-rose-500 text-white"
              )}>
                {discrepancy === 0 ? 'OK' : 'REVISAR'}
              </span>
            </div>
            <div className="flex gap-4">
              <button className="flex-1 bg-slate-100 text-slate-700 py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-slate-200 transition-all flex items-center justify-center gap-2">
                <Printer size={18} />
                Imprimir
              </button>
              <button 
                onClick={() => alert('Informe de cierre enviado al contable y gerente por email.')}
                className="flex-1 bg-emerald-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 flex items-center justify-center gap-2"
              >
                <RefreshCw size={18} />
                Enviar a Contable
              </button>
            </div>
            <button 
              onClick={() => setStep('count')}
              className="w-full mt-4 bg-slate-900 text-white py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-slate-800 transition-all"
            >
              Nuevo Cierre
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CierreCajaView;
