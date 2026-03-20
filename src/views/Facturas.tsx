import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, FileText, Download, MoreVertical, AlertCircle, CheckCircle2, Clock, X, Calendar, PieChart, TrendingUp, Filter, Mail, Eye, Zap, ShieldCheck, Package } from 'lucide-react';
import { SupplierInvoice } from '../types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const mockInvoices: SupplierInvoice[] = [
  {
    id: '1',
    date: '2026-03-01',
    supplierId: 's1',
    number: 'FAC-2026-001',
    dueDate: '2026-03-31',
    status: 'Pendiente',
    total: 3450.60,
    tax: 600.10,
    deliveryNoteIds: ['1', '4']
  },
  {
    id: '2',
    date: '2026-02-15',
    supplierId: 's2',
    number: 'FAC-2026-042',
    dueDate: '2026-03-15',
    status: 'Pagado',
    total: 1200.00,
    tax: 208.26,
    deliveryNoteIds: ['2']
  },
  {
    id: '3',
    date: '2026-01-20',
    supplierId: 's3',
    number: 'FAC-2026-012',
    dueDate: '2026-02-20',
    status: 'Vencido',
    total: 890.20,
    tax: 154.50,
    deliveryNoteIds: ['3']
  }
];

const supplierNames: Record<string, string> = {
  s1: 'Carnes Selectas S.L.',
  s2: 'Frutas y Verduras Paco',
  s3: 'Bodegas del Sur',
};

export default function FacturasView() {
  const [showNewModal, setShowNewModal] = React.useState(false);
  const [invoices, setInvoices] = React.useState<SupplierInvoice[]>(mockInvoices);
  const [viewMode, setViewMode] = React.useState<'list' | 'calendar' | 'inbox'>('list');
  const [selectedEmail, setSelectedEmail] = React.useState<any>(null);
  const [selectedInvoice, setSelectedInvoice] = React.useState<SupplierInvoice | null>(null);
  const [newInvoiceData, setNewInvoiceData] = React.useState({
    number: '',
    date: new Date().toISOString().split('T')[0],
    supplierId: 's1',
    total: '',
    dueDate: '',
    tax: ''
  });

  const [toast, setToast] = React.useState<{ message: string, type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleCreateInvoice = () => {
    if (!newInvoiceData.number || !newInvoiceData.total) {
      showToast('Por favor, completa los campos obligatorios.', 'error');
      return;
    }

    const newInv: SupplierInvoice = {
      id: Math.random().toString(36).substr(2, 9),
      number: newInvoiceData.number,
      date: newInvoiceData.date,
      supplierId: newInvoiceData.supplierId,
      total: parseFloat(newInvoiceData.total),
      tax: parseFloat(newInvoiceData.tax) || 0,
      dueDate: newInvoiceData.dueDate || newInvoiceData.date,
      status: 'Pendiente',
      deliveryNoteIds: []
    };

    setInvoices([newInv, ...invoices]);
    setShowNewModal(false);
    setNewInvoiceData({
      number: '',
      date: new Date().toISOString().split('T')[0],
      supplierId: 's1',
      total: '',
      dueDate: '',
      tax: ''
    });
  };

  const mockEmails = [
    { id: 'e1', from: 'ventas@carnesselectas.com', subject: 'Factura FAC-2026-005', date: '2026-03-12', attachment: 'FAC-2026-005.pdf', total: 450.20, verified: true },
    { id: 'e2', from: 'contabilidad@frutaspaco.es', subject: 'Nueva Factura Marzo', date: '2026-03-11', attachment: 'INV_MARZO.pdf', total: 125.00, verified: false },
    { id: 'e3', from: 'info@bodegassur.com', subject: 'Factura Rectificativa', date: '2026-03-10', attachment: 'RECT_001.pdf', total: -50.00, verified: true },
  ];

  const monthlyData = [
    { name: 'Ene', total: 4500 },
    { name: 'Feb', total: 5200 },
    { name: 'Mar', total: invoices.reduce((acc, i) => acc + i.total, 0) },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Facturas de Proveedores</h1>
          <p className="text-slate-500 text-sm">Controla tus gastos y el estado de los pagos.</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setViewMode(viewMode === 'list' ? 'calendar' : 'list')}
            className="flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-all"
          >
            {viewMode === 'list' ? <Calendar size={18} /> : <FileText size={18} />}
            {viewMode === 'list' ? 'Ver Calendario' : 'Ver Lista'}
          </button>
          <button className="flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-all">
            <Download size={18} />
            Exportar
          </button>
          <button 
            onClick={() => setShowNewModal(true)}
            className="flex items-center justify-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-emerald-700 transition-all shadow-sm shadow-emerald-100"
          >
            <Plus size={18} />
            Registrar Factura
          </button>
        </div>
      </div>

        <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl w-fit mb-6">
          {[
            { id: 'list', label: 'Lista', icon: FileText },
            { id: 'calendar', label: 'Calendario', icon: Calendar },
            { id: 'inbox', label: 'Buzón (Email)', icon: Mail },
          ].map((mode) => (
            <button
              key={mode.id}
              onClick={() => setViewMode(mode.id as any)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                viewMode === mode.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              <mode.icon size={14} />
              {mode.label}
            </button>
          ))}
        </div>

        {viewMode === 'list' && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Pendiente de Pago</p>
            <p className="text-2xl font-bold text-slate-900">
              {invoices.filter(i => i.status === 'Pendiente').reduce((acc, i) => acc + i.total, 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
            </p>
            <div className="mt-2 flex items-center justify-between text-[10px] font-bold">
              <span className="text-slate-400">IVA: {invoices.filter(i => i.status === 'Pendiente').reduce((acc, i) => acc + i.tax, 0).toFixed(2)}€</span>
              <span className="text-amber-600 flex items-center gap-1"><Clock size={12} /> Vence pronto</span>
            </div>
          </div>
          <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Vencido</p>
            <p className="text-2xl font-bold text-rose-600">
              {invoices.filter(i => i.status === 'Vencido').reduce((acc, i) => acc + i.total, 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
            </p>
            <div className="mt-2 flex items-center justify-between text-[10px] font-bold">
              <span className="text-slate-400">IVA: {invoices.filter(i => i.status === 'Vencido').reduce((acc, i) => acc + i.tax, 0).toFixed(2)}€</span>
              <span className="text-rose-600 flex items-center gap-1"><AlertCircle size={12} /> Urgente</span>
            </div>
          </div>
          <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Pagado este mes</p>
            <p className="text-2xl font-bold text-emerald-600">
              {invoices.filter(i => i.status === 'Pagado').reduce((acc, i) => acc + i.total, 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
            </p>
            <div className="mt-2 flex items-center justify-between text-[10px] font-bold">
              <span className="text-slate-400">IVA: {invoices.filter(i => i.status === 'Pagado').reduce((acc, i) => acc + i.tax, 0).toFixed(2)}€</span>
              <span className="text-emerald-600 flex items-center gap-1"><CheckCircle2 size={12} /> Al día</span>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col justify-between">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Gasto Mensual</p>
          <div className="h-20 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData}>
                <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                  {monthlyData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === 2 ? '#10b981' : '#e2e8f0'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    )}

      {/* Mismatched Invoices Alert */}
      <div className="bg-rose-50 border border-rose-100 rounded-3xl p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center shrink-0">
          <AlertCircle size={24} />
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-rose-900">Alertas de Facturación</h3>
          <p className="text-sm text-rose-700">Se han detectado 2 facturas que no coinciden con los albaranes recibidos o que están retrasadas.</p>
        </div>
        <button className="px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 transition-all">
          Revisar Discrepancias
        </button>
      </div>

      {viewMode === 'inbox' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 bg-white rounded-[3rem] border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-8 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Buzón de Facturas</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">facturas@racoblanquerna.com</p>
            </div>
            <div className="divide-y divide-slate-50">
              {mockEmails.map((email) => (
                <div 
                  key={email.id}
                  onClick={() => setSelectedEmail(email)}
                  className={cn(
                    "p-6 cursor-pointer transition-all hover:bg-slate-50",
                    selectedEmail?.id === email.id ? "bg-indigo-50/50 border-l-4 border-indigo-500" : ""
                  )}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">{email.date}</span>
                    {email.verified && <ShieldCheck size={14} className="text-emerald-500" />}
                  </div>
                  <p className="text-sm font-black text-slate-900 truncate">{email.from}</p>
                  <p className="text-xs text-slate-500 truncate">{email.subject}</p>
                  <div className="mt-3 flex items-center gap-2 text-[10px] font-bold text-slate-400">
                    <FileText size={12} />
                    {email.attachment}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-2 space-y-6">
            {selectedEmail ? (
              <div className="bg-white rounded-[3rem] border border-slate-200 shadow-sm p-10 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center">
                      <Mail size={24} />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">{selectedEmail.subject}</h3>
                      <p className="text-sm text-slate-500 font-medium">De: {selectedEmail.from}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black text-slate-900">{selectedEmail.total.toFixed(2)} €</p>
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Importe Detectado</p>
                  </div>
                </div>

                <div className="aspect-[4/3] bg-slate-100 rounded-[2rem] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-4 group cursor-pointer hover:bg-slate-50 transition-all">
                  <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center text-slate-400 group-hover:scale-110 transition-transform">
                    <FileText size={32} />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-black text-slate-900 uppercase tracking-widest">Vista Previa PDF</p>
                    <p className="text-xs text-slate-400 font-bold uppercase mt-1">{selectedEmail.attachment}</p>
                  </div>
                </div>

                <div className="mt-8 grid grid-cols-2 gap-4">
                  <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                    <div className="flex items-center gap-2 mb-4">
                      <Zap size={16} className="text-amber-500" />
                      <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Comprobación IA</h4>
                    </div>
                    <ul className="space-y-3">
                      <li className="flex items-center gap-2 text-xs font-bold text-emerald-600">
                        <CheckCircle2 size={14} />
                        Proveedor reconocido
                      </li>
                      <li className={cn(
                        "flex items-center gap-2 text-xs font-bold",
                        selectedEmail.verified ? "text-emerald-600" : "text-amber-600"
                      )}>
                        {selectedEmail.verified ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                        Coincide con Albarán #123
                      </li>
                      <li className="flex items-center gap-2 text-xs font-bold text-emerald-600">
                        <CheckCircle2 size={14} />
                        Importe validado
                      </li>
                    </ul>
                  </div>
                  <div className="flex flex-col gap-3">
                    <button 
                      onClick={() => {
                        const newInv: SupplierInvoice = {
                          id: Math.random().toString(36).substr(2, 9),
                          number: selectedEmail.subject.split(' ').pop() || 'FAC-NEW',
                          date: new Date().toISOString().split('T')[0],
                          supplierId: 's1', // Defaulting to s1 for simplicity
                          total: selectedEmail.total,
                          tax: selectedEmail.total * 0.21,
                          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                          status: 'Pendiente',
                          deliveryNoteIds: ['1'] // Simulating link to albaran
                        };
                        setInvoices([newInv, ...invoices]);
                        alert('Factura procesada y añadida a la lista.');
                        setSelectedEmail(null);
                      }}
                      className="flex-1 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 size={16} />
                      Aprobar y Pagar
                    </button>
                    <button className="flex-1 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-50 transition-all">
                      Rechazar / Discrepancia
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full bg-white rounded-[3rem] border border-slate-200 border-dashed flex flex-col items-center justify-center p-10 text-center">
                <div className="w-20 h-20 bg-slate-50 text-slate-200 rounded-[2.5rem] flex items-center justify-center mb-6">
                  <Mail size={40} />
                </div>
                <h3 className="text-xl font-black text-slate-300 uppercase tracking-tight">Selecciona un correo</h3>
                <p className="text-slate-400 text-sm font-medium mt-2">Revisa las facturas recibidas por email para procesarlas.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {viewMode === 'list' ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-200">
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Nº Factura</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Proveedor</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Vencimiento</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Total (IVA inc.)</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Estado</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Conciliación</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map((inv) => (
                  <tr 
                    key={inv.id} 
                    className="hover:bg-slate-50/30 transition-colors group cursor-pointer"
                    onClick={() => setSelectedInvoice(inv)}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500">
                          <FileText size={16} />
                        </div>
                        <span className="text-sm font-mono font-medium text-slate-700">{inv.number}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-slate-900">
                      {supplierNames[inv.supplierId]}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {new Date(inv.dueDate).toLocaleDateString('es-ES')}
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-slate-900">
                      {inv.total.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold",
                        inv.status === 'Pagado' && "bg-emerald-50 text-emerald-700",
                        inv.status === 'Pendiente' && "bg-amber-50 text-amber-700",
                        inv.status === 'Vencido' && "bg-rose-50 text-rose-700",
                      )}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-emerald-500" />
                          <span className="text-[10px] font-bold text-slate-500 uppercase">Conciliado</span>
                        </div>
                        {inv.deliveryNoteIds && inv.deliveryNoteIds.length > 0 && (
                          <div className="flex items-center gap-1">
                            <Package size={10} className="text-blue-500" />
                            <span className="text-[9px] font-bold text-blue-500 uppercase tracking-widest">{inv.deliveryNoteIds.length} Albaranes</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                        <button 
                          onClick={() => setSelectedInvoice(inv)}
                          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                          title="Ver detalle"
                        >
                          <Eye size={18} />
                        </button>
                        <button className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all" title="Descargar PDF">
                          <Download size={18} />
                        </button>
                        <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all">
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
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-lg font-bold text-slate-900">Calendario de Pagos - Marzo 2026</h2>
            <div className="flex gap-2">
              <button className="p-2 hover:bg-slate-50 rounded-xl border border-slate-200"><Calendar size={18} /></button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-2">
            {['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'].map(d => (
              <div key={d} className="text-center text-[10px] font-bold text-slate-400 uppercase mb-2">{d}</div>
            ))}
            {Array.from({ length: 31 }).map((_, i) => {
              const day = i + 1;
              const dayInvoices = invoices.filter(inv => new Date(inv.dueDate).getDate() === day);
              const hasInvoice = dayInvoices.length > 0;
              return (
                <div 
                  key={i} 
                  onClick={() => hasInvoice && setSelectedInvoice(dayInvoices[0])}
                  className={cn(
                    "aspect-square rounded-2xl border border-slate-100 p-2 flex flex-col items-center justify-center gap-1 transition-all hover:border-emerald-200 hover:bg-emerald-50/30 cursor-pointer",
                    hasInvoice && "bg-slate-50 border-slate-200"
                  )}
                >
                  <span className="text-xs font-bold text-slate-400">{day}</span>
                  {hasInvoice && (
                    <div className="flex gap-1">
                      {dayInvoices.map((inv, idx) => (
                        <div key={idx} className={cn(
                          "w-2 h-2 rounded-full",
                          inv.status === 'Vencido' ? "bg-rose-500" : 
                          inv.status === 'Pagado' ? "bg-emerald-500" : "bg-amber-500"
                        )} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* New Invoice Modal */}
      {showNewModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">Registrar Factura</h2>
              <button onClick={() => setShowNewModal(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-all">
                <X size={20} className="text-slate-400" />
              </button>
            </div>
            <div className="p-8 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">Nº Factura</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 outline-none" 
                    placeholder="FAC-2026-XXX" 
                    value={newInvoiceData.number}
                    onChange={(e) => setNewInvoiceData({...newInvoiceData, number: e.target.value})}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">Fecha</label>
                  <input 
                    type="date" 
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 outline-none" 
                    value={newInvoiceData.date}
                    onChange={(e) => setNewInvoiceData({...newInvoiceData, date: e.target.value})}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase">Proveedor</label>
                <select 
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 outline-none"
                  value={newInvoiceData.supplierId}
                  onChange={(e) => setNewInvoiceData({...newInvoiceData, supplierId: e.target.value})}
                >
                  {Object.entries(supplierNames).map(([id, name]) => (
                    <option key={id} value={id}>{name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">Total</label>
                  <input 
                    type="number" 
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 outline-none" 
                    placeholder="0.00" 
                    value={newInvoiceData.total}
                    onChange={(e) => setNewInvoiceData({...newInvoiceData, total: e.target.value})}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">Vencimiento</label>
                  <input 
                    type="date" 
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 outline-none" 
                    value={newInvoiceData.dueDate}
                    onChange={(e) => setNewInvoiceData({...newInvoiceData, dueDate: e.target.value})}
                  />
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
                  onClick={handleCreateInvoice}
                  className="flex-1 px-4 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
                >
                  Guardar Factura
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Invoice Detail Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-2xl shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center">
                  <FileText size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">{selectedInvoice.number}</h2>
                  <p className="text-sm text-slate-500 font-medium">{supplierNames[selectedInvoice.supplierId]}</p>
                </div>
              </div>
              <button onClick={() => setSelectedInvoice(null)} className="p-2 hover:bg-white rounded-xl transition-all shadow-sm">
                <X size={20} className="text-slate-400" />
              </button>
            </div>
            
            <div className="p-8 space-y-8">
              <div className="grid grid-cols-3 gap-6">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Fecha Emisión</p>
                  <p className="text-sm font-bold text-slate-700">{new Date(selectedInvoice.date).toLocaleDateString('es-ES')}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Vencimiento</p>
                  <p className="text-sm font-bold text-slate-700">{new Date(selectedInvoice.dueDate).toLocaleDateString('es-ES')}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Estado</p>
                  <span className={cn(
                    "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                    selectedInvoice.status === 'Pagado' && "bg-emerald-100 text-emerald-700",
                    selectedInvoice.status === 'Pendiente' && "bg-amber-100 text-amber-700",
                    selectedInvoice.status === 'Vencido' && "bg-rose-100 text-rose-700",
                  )}>
                    {selectedInvoice.status}
                  </span>
                </div>
              </div>

              <div>
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Package size={14} className="text-blue-500" />
                  Albaranes Vinculados
                </h4>
                <div className="space-y-2">
                  {selectedInvoice.deliveryNoteIds?.map(id => (
                    <div key={id} className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl hover:border-blue-200 transition-all cursor-pointer group">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center">
                          <FileText size={14} />
                        </div>
                        <span className="text-sm font-bold text-slate-700">Albarán #ALB-2026-{id.padStart(3, '0')}</span>
                      </div>
                      <Eye size={16} className="text-slate-300 group-hover:text-blue-500 transition-colors" />
                    </div>
                  ))}
                  {(!selectedInvoice.deliveryNoteIds || selectedInvoice.deliveryNoteIds.length === 0) && (
                    <p className="text-sm text-slate-400 italic text-center py-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                      No hay albaranes vinculados a esta factura.
                    </p>
                  )}
                </div>
              </div>

              <div className="pt-6 border-t border-slate-100">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-bold text-slate-500">Base Imponible</span>
                  <span className="text-sm font-bold text-slate-700">{(selectedInvoice.total - selectedInvoice.tax).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
                </div>
                <div className="flex justify-between items-center mb-4">
                  <span className="text-sm font-bold text-slate-500">IVA (21%)</span>
                  <span className="text-sm font-bold text-slate-700">{selectedInvoice.tax.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
                </div>
                <div className="flex justify-between items-center p-6 bg-slate-900 rounded-3xl text-white">
                  <span className="text-lg font-black uppercase tracking-widest">Total Factura</span>
                  <span className="text-3xl font-black">{selectedInvoice.total.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
                </div>
              </div>

              <div className="flex gap-3">
                <button className="flex-1 py-4 bg-white border border-slate-200 text-slate-700 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-50 transition-all flex items-center justify-center gap-2">
                  <Download size={16} />
                  Descargar PDF
                </button>
                {selectedInvoice.status !== 'Pagado' && (
                  <button className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 flex items-center justify-center gap-2">
                    <CheckCircle2 size={16} />
                    Marcar como Pagado
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Invoice Detail Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100">
                  <FileText size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Detalle de Factura</h2>
                  <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">{selectedInvoice.number}</p>
                </div>
              </div>
              <button onClick={() => setSelectedInvoice(null)} className="p-2 hover:bg-white rounded-xl transition-all shadow-sm">
                <X size={20} className="text-slate-400" />
              </button>
            </div>
            
            <div className="p-10 space-y-8">
              <div className="grid grid-cols-2 gap-8">
                <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Proveedor</p>
                  <p className="text-lg font-black text-slate-900">{supplierNames[selectedInvoice.supplierId]}</p>
                  <p className="text-xs text-slate-500 font-medium mt-1">ID: {selectedInvoice.supplierId}</p>
                </div>
                <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Estado de Pago</p>
                  <span className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                    selectedInvoice.status === 'Pagado' && "bg-emerald-100 text-emerald-700",
                    selectedInvoice.status === 'Pendiente' && "bg-amber-100 text-amber-700",
                    selectedInvoice.status === 'Vencido' && "bg-rose-100 text-rose-700",
                  )}>
                    {selectedInvoice.status}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-6">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Fecha Emisión</p>
                  <p className="text-sm font-bold text-slate-700">{new Date(selectedInvoice.date).toLocaleDateString('es-ES')}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Fecha Vencimiento</p>
                  <p className="text-sm font-bold text-slate-700">{new Date(selectedInvoice.dueDate).toLocaleDateString('es-ES')}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Albaranes Vinculados</p>
                  <p className="text-sm font-bold text-slate-700">{selectedInvoice.deliveryNoteIds.length || 'Ninguno'}</p>
                </div>
              </div>

              <div className="pt-6 border-t border-slate-100">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-bold text-slate-500">Base Imponible</span>
                  <span className="text-sm font-bold text-slate-900">{(selectedInvoice.total - selectedInvoice.tax).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
                </div>
                <div className="flex justify-between items-center mb-4">
                  <span className="text-sm font-bold text-slate-500">IVA (21%)</span>
                  <span className="text-sm font-bold text-slate-900">{selectedInvoice.tax.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
                </div>
                <div className="flex justify-between items-center p-6 bg-indigo-600 rounded-3xl text-white shadow-xl shadow-indigo-100">
                  <span className="text-lg font-black uppercase tracking-widest">Total Factura</span>
                  <span className="text-2xl font-black">{selectedInvoice.total.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
                </div>
              </div>
            </div>

            <div className="p-8 bg-slate-50 border-t border-slate-100 flex justify-end gap-4">
              <button 
                onClick={() => setSelectedInvoice(null)}
                className="px-8 py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-slate-50 transition-all shadow-sm"
              >
                Cerrar
              </button>
              <button 
                onClick={() => {
                  showToast('Descargando factura...');
                  setSelectedInvoice(null);
                }}
                className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-slate-800 transition-all shadow-lg"
              >
                Descargar PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <motion.div 
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          className={cn(
            "fixed bottom-10 right-10 px-8 py-4 rounded-2xl shadow-2xl z-[100] flex items-center gap-3 border",
            toast.type === 'success' ? "bg-emerald-600 border-emerald-500 text-white" : "bg-rose-600 border-rose-500 text-white"
          )}
        >
          {toast.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
          <span className="text-sm font-black uppercase tracking-widest">{toast.message}</span>
        </motion.div>
      )}
    </div>
  );
}
