// src/views/FacturacionClientes.tsx
// ✅ 100% Supabase — sin Firebase, sin datos hardcoded
// ✅ Dictado por voz de facturas completas con IA
// ✅ Clientes recurrentes guardados en Supabase
// ✅ Generar PDF / imprimir factura
// ✅ Enviar por WhatsApp con un tap
// ✅ Estadísticas de cobro en tiempo real
// ✅ Toast notifications, Gen Z UX
import React, {
  useState, useEffect, useRef, useCallback, useMemo
} from 'react';
import {
  Receipt, Plus, Mic, MicOff, Loader2, X, Check,
  AlertTriangle, CheckCircle2, Trash2, Search,
  FileText, Printer, MessageCircle, TrendingUp,
  Clock, ChevronDown, ChevronUp, Edit2, Brain,
  Sparkles, Users, Hash, RefreshCw, Send
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../supabase';
import { useSupabase } from '../context/SupabaseContext';
import { GoogleGenAI } from '@google/genai';
import { cn } from '../lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────
interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  total: number;
}

interface CustomerInvoice {
  id: string;
  number: string;
  date: string;
  due_date?: string;
  client_name: string;
  client_cif?: string;
  client_email?: string;
  client_address?: string;
  client_phone?: string;
  items: InvoiceItem[];
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  status: 'Pendiente' | 'Pagada' | 'Vencida' | 'Cancelada';
  notes?: string;
  created_at: string;
}

interface SavedClient {
  id: string;
  name: string;
  cif?: string;
  email?: string;
  address?: string;
  phone?: string;
  invoice_count: number;
  total_spent: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const STATUS_CFG = {
  Pendiente: { cls: 'bg-amber-50 text-amber-700 border-amber-200',    icon: <Clock size={12} /> },
  Pagada:    { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: <CheckCircle2 size={12} /> },
  Vencida:   { cls: 'bg-rose-50 text-rose-700 border-rose-200',        icon: <AlertTriangle size={12} /> },
  Cancelada: { cls: 'bg-slate-100 text-slate-500 border-slate-200',    icon: <X size={12} /> },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const aiRef = { current: null as GoogleGenAI | null };
function getAI() {
  if (!aiRef.current) aiRef.current = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || '' });
  return aiRef.current;
}
function uid() { return Math.random().toString(36).slice(2, 10); }
function fmtEur(n: number) {
  return n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
}
function fmtDate(d: string) {
  if (!d) return '—';
  return new Date(d + (d.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('es-ES', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}
function today() { return new Date().toISOString().split('T')[0]; }

function genInvoiceNumber(existing: CustomerInvoice[]): string {
  const year = new Date().getFullYear();
  const count = existing.filter(i => i.number.startsWith(String(year))).length + 1;
  return `${year}/${String(count).padStart(4, '0')}`;
}

function calcItem(item: Omit<InvoiceItem, 'total'>): InvoiceItem {
  const total = item.quantity * item.unit_price * (1 + item.tax_rate / 100);
  return { ...item, total };
}

function calcTotals(its: InvoiceItem[], taxRate: number) {
  const subtotal = its.reduce((s, i) => s + i.quantity * i.unit_price, 0);
  const tax_amount = subtotal * (taxRate / 100);
  return { subtotal, tax_amount, total: subtotal + tax_amount };
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function useToast() {
  const [toasts, setToasts] = useState<{ id: string; msg: string; type: 'ok' | 'err' | 'warn' }[]>([]);
  const show = useCallback((msg: string, type: 'ok' | 'err' | 'warn' = 'ok') => {
    const id = uid();
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000);
  }, []);
  const ToastContainer = () => (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[500] flex flex-col gap-2 items-center pointer-events-none">
      <AnimatePresence>
        {toasts.map(t => (
          <motion.div key={t.id}
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.9 }}
            className={cn('px-5 py-3 rounded-2xl text-sm font-bold shadow-2xl flex items-center gap-2',
              t.type === 'ok' ? 'bg-slate-900 text-white'
              : t.type === 'warn' ? 'bg-amber-500 text-white'
              : 'bg-rose-500 text-white'
            )}>
            {t.type === 'ok' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
            {t.msg}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
  return { show, ToastContainer };
}

// ─── VoiceButton ──────────────────────────────────────────────────────────────
function VoiceButton({ onResult, small, className = '' }: {
  onResult: (t: string) => void; small?: boolean; className?: string;
}) {
  const [on, setOn] = useState(false);
  const ref = useRef<SpeechRecognition | null>(null);
  const sz = small ? 14 : 16;
  const toggle = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert('Necesitas Chrome para el microfono'); return; }
    if (on) { ref.current?.stop(); setOn(false); return; }
    const r = new SR(); ref.current = r;
    r.lang = 'es-ES'; r.continuous = false; r.interimResults = false;
    r.onstart = () => setOn(true);
    r.onresult = (e: SpeechRecognitionEvent) => onResult(e.results[0][0].transcript);
    r.onerror = r.onend = () => setOn(false);
    r.start();
  };
  return (
    <button type="button" onClick={toggle}
      className={cn(`${small ? 'p-1.5' : 'p-2.5'} rounded-xl transition-all shrink-0`,
        on ? 'bg-rose-500 text-white animate-pulse shadow-lg shadow-rose-200'
           : 'bg-slate-100 text-slate-500 hover:bg-slate-200',
        className
      )} title={on ? 'Parar' : 'Dictar'}>
      {on ? <MicOff size={sz} /> : <Mic size={sz} />}
    </button>
  );
}

function VoiceField({ value, onChange, placeholder, type = 'text' }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm
                   focus:outline-none focus:ring-2 focus:ring-indigo-300" />
      <VoiceButton onResult={onChange} small />
    </div>
  );
}

// ─── PDF Print ────────────────────────────────────────────────────────────────
function printInvoice(invoice: CustomerInvoice) {
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(`<!DOCTYPE html><html lang="es"><head>
<meta charset="UTF-8">
<title>Factura ${invoice.number}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 13px; color: #1e293b; padding: 40px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; }
  .logo { font-size: 24px; font-weight: 900; color: #1e293b; }
  .logo span { color: #4f46e5; }
  .invoice-meta { text-align: right; }
  .invoice-meta h2 { font-size: 20px; font-weight: 900; color: #4f46e5; }
  .invoice-meta p { color: #64748b; margin-top: 2px; }
  .divider { border: none; border-top: 2px solid #e2e8f0; margin: 24px 0; }
  .client { margin-bottom: 32px; }
  .client h3 { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #94a3b8; margin-bottom: 6px; }
  .client p { color: #334155; line-height: 1.6; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
  thead { background: #f8fafc; }
  th { padding: 10px 12px; text-align: left; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #94a3b8; border-bottom: 1px solid #e2e8f0; }
  th:last-child { text-align: right; }
  td { padding: 10px 12px; border-bottom: 1px solid #f1f5f9; }
  td:last-child { text-align: right; font-weight: 700; }
  .totals { margin-left: auto; width: 280px; }
  .totals-row { display: flex; justify-content: space-between; padding: 6px 0; color: #64748b; }
  .totals-row.total { font-size: 18px; font-weight: 900; color: #1e293b; border-top: 2px solid #e2e8f0; padding-top: 12px; margin-top: 6px; }
  .status { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; margin-top: 4px; background: ${invoice.status === 'Pagada' ? '#d1fae5' : '#fef3c7'}; color: ${invoice.status === 'Pagada' ? '#065f46' : '#92400e'}; }
  .footer { margin-top: 48px; text-align: center; color: #94a3b8; font-size: 12px; }
  @media print { body { padding: 20px; } button { display: none; } }
</style>
</head><body>
<div class="header">
  <div>
    <div class="logo">Raco<span>Blanquerna</span></div>
    <p style="color:#64748b;margin-top:4px">Raco Blanquerna SL</p>
  </div>
  <div class="invoice-meta">
    <h2>FACTURA ${invoice.number}</h2>
    <p>Fecha: ${fmtDate(invoice.date)}</p>
    ${invoice.due_date ? `<p>Vencimiento: ${fmtDate(invoice.due_date)}</p>` : ''}
    <span class="status">${invoice.status}</span>
  </div>
</div>
<hr class="divider">
<div class="client">
  <h3>Cliente</h3>
  <p><strong>${invoice.client_name}</strong></p>
  ${invoice.client_cif ? `<p>CIF/NIF: ${invoice.client_cif}</p>` : ''}
  ${invoice.client_address ? `<p>${invoice.client_address}</p>` : ''}
  ${invoice.client_email ? `<p>${invoice.client_email}</p>` : ''}
</div>
<table>
  <thead>
    <tr>
      <th>Concepto</th>
      <th style="text-align:right">Cant.</th>
      <th style="text-align:right">Precio</th>
      <th style="text-align:right">IVA</th>
      <th style="text-align:right">Total</th>
    </tr>
  </thead>
  <tbody>
    ${invoice.items.map(item => `
    <tr>
      <td>${item.description}</td>
      <td style="text-align:right">${item.quantity}</td>
      <td style="text-align:right">${fmtEur(item.unit_price)}</td>
      <td style="text-align:right">${item.tax_rate}%</td>
      <td style="text-align:right">${fmtEur(item.total)}</td>
    </tr>`).join('')}
  </tbody>
</table>
<div class="totals">
  <div class="totals-row"><span>Base imponible</span><span>${fmtEur(invoice.subtotal)}</span></div>
  <div class="totals-row"><span>IVA (${invoice.tax_rate}%)</span><span>${fmtEur(invoice.tax_amount)}</span></div>
  <div class="totals-row total"><span>TOTAL</span><span>${fmtEur(invoice.total)}</span></div>
</div>
${invoice.notes ? `<p style="margin-top:24px;color:#64748b;font-style:italic">${invoice.notes}</p>` : ''}
<div class="footer">
  <p>Raco Blanquerna SL · Gracias por su confianza</p>
</div>
<script>window.onload=()=>{window.print();}</script>
</body></html>`);
  w.document.close();
}

// ─── Invoice Card ─────────────────────────────────────────────────────────────
function InvoiceCard({
  invoice, expanded, onToggle, onStatusChange, onDelete, onPrint, onWhatsApp,
}: {
  invoice: CustomerInvoice;
  expanded: boolean;
  onToggle: () => void;
  onStatusChange: (status: CustomerInvoice['status']) => void;
  onDelete: () => void;
  onPrint: () => void;
  onWhatsApp: () => void;
}) {
  const cfg = STATUS_CFG[invoice.status];
  const isOverdue = invoice.status === 'Pendiente' && invoice.due_date && invoice.due_date < today();

  return (
    <motion.div layout
      className={cn(
        'bg-white rounded-3xl border shadow-sm hover:shadow-md transition-all overflow-hidden',
        isOverdue ? 'border-rose-200' : 'border-slate-200'
      )}>
      {/* Row */}
      <div className="flex items-center gap-4 p-5 cursor-pointer" onClick={onToggle}>
        <div className={cn(
          'w-11 h-11 rounded-2xl flex items-center justify-center shrink-0',
          isOverdue ? 'bg-rose-50' : 'bg-slate-50'
        )}>
          <Receipt size={18} className={isOverdue ? 'text-rose-400' : 'text-slate-400'} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-black text-slate-900 truncate">{invoice.client_name}</span>
            <span className="text-xs text-slate-400 font-mono">#{invoice.number}</span>
            {isOverdue && (
              <span className="text-[10px] font-black text-rose-600 bg-rose-50 px-2 py-0.5 rounded-lg border border-rose-200">
                VENCIDA
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">{fmtDate(invoice.date)}</p>
        </div>
        <span className={cn('px-2.5 py-1 rounded-xl border text-[11px] font-black flex items-center gap-1 shrink-0', cfg.cls)}>
          {cfg.icon} {invoice.status}
        </span>
        <span className="font-black text-slate-900 text-lg shrink-0 hidden sm:block">
          {fmtEur(invoice.total)}
        </span>
        <div className="text-slate-300 shrink-0">
          {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </div>
      </div>

      {/* Expanded */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden">
            <div className="px-5 pb-5 border-t border-slate-100 pt-4 space-y-4">
              {/* Items */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                      <th className="text-left pb-2">Concepto</th>
                      <th className="text-right pb-2">Cant.</th>
                      <th className="text-right pb-2">Precio</th>
                      <th className="text-right pb-2">IVA</th>
                      <th className="text-right pb-2">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {(invoice.items || []).map(item => (
                      <tr key={item.id}>
                        <td className="py-1.5 font-medium text-slate-700">{item.description}</td>
                        <td className="py-1.5 text-right text-slate-500">{item.quantity}</td>
                        <td className="py-1.5 text-right text-slate-500">{fmtEur(item.unit_price)}</td>
                        <td className="py-1.5 text-right">
                          <span className="text-[10px] font-black px-1.5 py-0.5 rounded-lg bg-slate-100 text-slate-600">
                            {item.tax_rate}%
                          </span>
                        </td>
                        <td className="py-1.5 text-right font-bold text-slate-900">{fmtEur(item.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-slate-200">
                      <td colSpan={3} />
                      <td className="pt-2 text-xs font-black text-slate-400 text-right">Base / IVA</td>
                      <td className="pt-2 text-right">
                        <p className="text-xs text-slate-500">{fmtEur(invoice.subtotal)}</p>
                        <p className="text-xs text-slate-500">{fmtEur(invoice.tax_amount)}</p>
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={3} />
                      <td className="pt-1 text-xs font-black text-slate-700 text-right">TOTAL</td>
                      <td className="pt-1 text-right font-black text-slate-900 text-base">{fmtEur(invoice.total)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {invoice.notes && (
                <p className="text-xs text-slate-500 bg-slate-50 rounded-xl px-4 py-2 italic">{invoice.notes}</p>
              )}

              {/* Actions */}
              <div className="flex flex-wrap items-center gap-2 pt-2">
                {/* Cambiar estado */}
                {(['Pendiente', 'Pagada', 'Vencida', 'Cancelada'] as CustomerInvoice['status'][])
                  .filter(s => s !== invoice.status)
                  .map(s => (
                    <button key={s} onClick={() => onStatusChange(s)}
                      className={cn('px-3 py-1.5 rounded-xl text-[11px] font-bold border transition-all hover:opacity-80',
                        STATUS_CFG[s].cls)}>
                      → {s}
                    </button>
                  ))}
                <div className="ml-auto flex items-center gap-2">
                  <button onClick={onPrint}
                    className="p-2 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all" title="Imprimir">
                    <Printer size={14} />
                  </button>
                  <button onClick={onWhatsApp}
                    className="p-2 rounded-xl bg-green-50 text-green-600 hover:bg-green-100 transition-all" title="WhatsApp">
                    <MessageCircle size={14} />
                  </button>
                  <button onClick={onDelete}
                    className="p-2 rounded-xl bg-rose-50 text-rose-500 hover:bg-rose-100 transition-all" title="Eliminar">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN VIEW
// ════════════════════════════════════════════════════════════════════════════
export default function FacturacionClientesView() {
  const { employee } = useSupabase();
  const { show: toast, ToastContainer } = useToast();

  const [invoices,      setInvoices]      = useState<CustomerInvoice[]>([]);
  const [savedClients,  setSavedClients]  = useState<SavedClient[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [search,        setSearch]        = useState('');
  const [filterStatus,  setFilterStatus]  = useState('Todos');
  const [expandedId,    setExpandedId]    = useState<string | null>(null);
  const [showForm,      setShowForm]      = useState(false);
  const [saving,        setSaving]        = useState(false);
  const [showClients,   setShowClients]   = useState(false);

  // IA voz rápida
  const [quickText,  setQuickText]  = useState('');
  const [quickBusy,  setQuickBusy]  = useState(false);
  const [quickOn,    setQuickOn]    = useState(false);
  const quickRef = useRef<SpeechRecognition | null>(null);

  // Formulario factura
  const emptyForm = () => ({
    client_name: '', client_cif: '', client_email: '',
    client_address: '', client_phone: '', due_date: '', notes: '',
    tax_rate: 21,
  });
  const [form,  setForm]  = useState(emptyForm());
  const [items, setItems] = useState<InvoiceItem[]>([
    { id: uid(), description: '', quantity: 1, unit_price: 0, tax_rate: 21, total: 0 },
  ]);

  // ── Load ──────────────────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('customer_invoices')
      .select('*')
      .order('date', { ascending: false });
    if (data) setInvoices(data as CustomerInvoice[]);
    setLoading(false);
  }, []);

  const loadClients = useCallback(async () => {
    const { data } = await supabase.from('customer_invoices')
      .select('client_name,client_cif,client_email,client_address,client_phone,total')
      .not('client_name', 'is', null);
    if (!data) return;
    // Agrupar por nombre de cliente
    const map: Record<string, SavedClient> = {};
    for (const inv of data as any[]) {
      const key = inv.client_name.toLowerCase().trim();
      if (!map[key]) {
        map[key] = {
          id: key, name: inv.client_name, cif: inv.client_cif,
          email: inv.client_email, address: inv.client_address,
          phone: inv.client_phone, invoice_count: 0, total_spent: 0,
        };
      }
      map[key].invoice_count++;
      map[key].total_spent += inv.total || 0;
    }
    setSavedClients(Object.values(map).sort((a, b) => b.total_spent - a.total_spent));
  }, []);

  useEffect(() => { loadAll(); loadClients(); }, [loadAll, loadClients]);

  // Marcar vencidas automáticamente
  useEffect(() => {
    const expired = invoices.filter(
      i => i.status === 'Pendiente' && i.due_date && i.due_date < today()
    );
    if (expired.length === 0) return;
    Promise.all(
      expired.map(i => supabase.from('customer_invoices').update({ status: 'Vencida' }).eq('id', i.id))
    ).then(() => loadAll());
  }, [invoices]);

  // ── Filtered ──────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return invoices.filter(i =>
      (filterStatus === 'Todos' || i.status === filterStatus) &&
      (!q || i.client_name.toLowerCase().includes(q) || i.number.includes(q))
    );
  }, [invoices, search, filterStatus]);

  // ── Stats ─────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const pendiente = invoices.filter(i => i.status === 'Pendiente').reduce((s, i) => s + i.total, 0);
    const cobrada   = invoices.filter(i => i.status === 'Pagada').reduce((s, i) => s + i.total, 0);
    const vencida   = invoices.filter(i => i.status === 'Vencida').reduce((s, i) => s + i.total, 0);
    const mesActual = new Date().toISOString().slice(0, 7);
    const esteMes  = invoices.filter(i => i.date.startsWith(mesActual)).reduce((s, i) => s + i.total, 0);
    return { pendiente, cobrada, vencida, esteMes };
  }, [invoices]);

  // ── Form helpers ──────────────────────────────────────────────────────────
  function addItem() {
    setItems(prev => [...prev, { id: uid(), description: '', quantity: 1, unit_price: 0, tax_rate: 21, total: 0 }]);
  }
  function updItem(id: string, ch: Partial<InvoiceItem>) {
    setItems(prev => prev.map(i => i.id === id ? calcItem({ ...i, ...ch }) : i));
  }
  function delItem(id: string) {
    setItems(prev => prev.filter(i => i.id !== id));
  }

  const totals = useMemo(() => calcTotals(items, form.tax_rate), [items, form.tax_rate]);

  // ── Cargar cliente guardado ───────────────────────────────────────────────
  function loadClient(c: SavedClient) {
    setForm(f => ({
      ...f,
      client_name: c.name, client_cif: c.cif || '',
      client_email: c.email || '', client_address: c.address || '',
      client_phone: c.phone || '',
    }));
    setShowClients(false);
    toast(`Cliente "${c.name}" cargado ✓`);
  }

  // ── Guardar factura ───────────────────────────────────────────────────────
  async function saveInvoice() {
    if (!form.client_name.trim()) { toast('El nombre del cliente es obligatorio', 'err'); return; }
    const validItems = items.filter(i => i.description.trim() && i.quantity > 0 && i.unit_price > 0);
    if (validItems.length === 0) { toast('Añade al menos un concepto', 'err'); return; }

    setSaving(true);
    try {
      const updatedItems = validItems.map(calcItem);
      const { subtotal, tax_amount, total } = calcTotals(updatedItems, form.tax_rate);
      const { error } = await supabase.from('customer_invoices').insert({
        number:          genInvoiceNumber(invoices),
        date:            today(),
        due_date:        form.due_date || null,
        client_name:     form.client_name.trim(),
        client_cif:      form.client_cif || null,
        client_email:    form.client_email || null,
        client_address:  form.client_address || null,
        client_phone:    form.client_phone || null,
        items:           updatedItems,
        subtotal, tax_rate: form.tax_rate, tax_amount, total,
        status:          'Pendiente',
        notes:           form.notes || null,
      });
      if (error) throw error;
      toast('Factura creada ✓');
      setShowForm(false);
      setForm(emptyForm());
      setItems([{ id: uid(), description: '', quantity: 1, unit_price: 0, tax_rate: 21, total: 0 }]);
      await loadAll(); await loadClients();
    } catch (err: any) {
      toast('Error: ' + err.message, 'err');
    } finally { setSaving(false); }
  }

  async function changeStatus(id: string, status: CustomerInvoice['status']) {
    const { error } = await supabase.from('customer_invoices').update({ status }).eq('id', id);
    if (error) { toast('Error', 'err'); return; }
    setInvoices(prev => prev.map(i => i.id === id ? { ...i, status } : i));
    toast(`Estado → ${status}`);
  }

  async function deleteInvoice(id: string) {
    if (!confirm('¿Eliminar esta factura? No se puede deshacer.')) return;
    const { error } = await supabase.from('customer_invoices').delete().eq('id', id);
    if (error) { toast('Error al eliminar', 'err'); return; }
    setInvoices(prev => prev.filter(i => i.id !== id));
    toast('Factura eliminada');
  }

  function sendWhatsApp(invoice: CustomerInvoice) {
    if (!invoice.client_phone) {
      toast('Este cliente no tiene teléfono registrado', 'warn');
      return;
    }
    const msg = `Hola ${invoice.client_name},\n\nAdjuntamos el resumen de su factura:\n\n📄 Nº ${invoice.number}\n📅 Fecha: ${fmtDate(invoice.date)}\n💶 Total: ${fmtEur(invoice.total)}\n\nGracias por su visita.\nRaco Blanquerna`;
    const phone = invoice.client_phone.replace(/[^0-9]/g, '');
    window.open(`https://wa.me/34${phone}?text=${encodeURIComponent(msg)}`, '_blank');
  }

  // ── Dictado rápido por voz con IA ─────────────────────────────────────────
  function toggleQuickVoice() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert('Necesitas Chrome para el microfono'); return; }
    if (quickOn) { quickRef.current?.stop(); setQuickOn(false); return; }
    const r = new SR(); quickRef.current = r;
    r.lang = 'es-ES'; r.continuous = true; r.interimResults = true;
    let final = '';
    const t = setTimeout(() => r.stop(), 20000);
    r.onstart = () => setQuickOn(true);
    r.onresult = (e: SpeechRecognitionEvent) => {
      final = Array.from(e.results).map(x => x[0].transcript).join(' ');
      setQuickText(final);
    };
    r.onend = () => { clearTimeout(t); setQuickOn(false); if (final.trim()) processQuick(final); };
    r.onerror = () => { clearTimeout(t); setQuickOn(false); };
    r.start();
  }

  async function processQuick(text: string) {
    if (!text.trim()) return;
    setQuickBusy(true);
    try {
      const res = await getAI().models.generateContent({
        model: 'gemini-2.0-flash',
        contents: [{
          role: 'user', parts: [{
            text: `Eres el sistema de facturación de un restaurante. Extrae los datos del siguiente texto para crear una factura a cliente.
Devuelve SOLO JSON válido sin markdown:
{
  "client_name": "string",
  "client_phone": "string o null",
  "client_email": "string o null",
  "notes": "string o null",
  "items": [
    {"description": "string", "quantity": number, "unit_price": number, "tax_rate": 10}
  ]
}
IVA por defecto: 10% para comida/restaurante, 21% para otros.
Texto: "${text}"
Fecha: ${today()}`
          }]
        }]
      });
      const raw = res.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
      const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());

      setForm(f => ({
        ...f,
        client_name:  parsed.client_name || '',
        client_phone: parsed.client_phone || '',
        client_email: parsed.client_email || '',
        notes:        parsed.notes || '',
        tax_rate:     10,
      }));

      if (parsed.items?.length > 0) {
        setItems(parsed.items.map((it: any) => calcItem({
          id: uid(),
          description: it.description || '',
          quantity:    Number(it.quantity) || 1,
          unit_price:  Number(it.unit_price) || 0,
          tax_rate:    Number(it.tax_rate) || 10,
        })));
      }

      setShowForm(true);
      setQuickText('');
      toast('✓ Factura pre-rellenada — revisa y guarda');
    } catch {
      toast('No pude procesar el texto', 'err');
    } finally { setQuickBusy(false); }
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#F8FAFC] p-4 md:p-8 space-y-6">
      <ToastContainer />

      {/* ── Header ── */}
      <header className="sticky top-4 z-[100] bg-white/80 backdrop-blur-xl border border-white/20
                         shadow-xl rounded-[2.5rem] p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-2xl shadow-lg">
            <Receipt className="w-5 h-5 text-indigo-400" />
            <span className="font-black text-sm tracking-tighter uppercase">Facturación</span>
          </div>
          {stats.vencida > 0 && (
            <span className="flex items-center gap-1 text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-xl">
              <AlertTriangle size={12} /> {fmtEur(stats.vencida)} vencido
            </span>
          )}
        </div>
        <button onClick={() => { setForm(emptyForm()); setItems([{ id: uid(), description: '', quantity: 1, unit_price: 0, tax_rate: 21, total: 0 }]); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-2xl text-xs font-bold hover:bg-indigo-700 transition-all shadow-sm shadow-indigo-200">
          <Plus size={14} /> Nueva factura
        </button>
      </header>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Este mes',  value: fmtEur(stats.esteMes),  color: 'text-slate-900', alert: false },
          { label: 'Cobrado',   value: fmtEur(stats.cobrada),  color: 'text-emerald-600', alert: false },
          { label: 'Pendiente', value: fmtEur(stats.pendiente), color: stats.pendiente > 0 ? 'text-amber-600' : 'text-slate-900', alert: false },
          { label: 'Vencido',   value: fmtEur(stats.vencida),  color: stats.vencida > 0 ? 'text-rose-600' : 'text-slate-900', alert: stats.vencida > 0 },
        ].map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            className={cn('bg-white rounded-3xl p-5 border shadow-sm relative', s.alert ? 'border-rose-200' : 'border-slate-200')}>
            {s.alert && <span className="absolute top-3 right-3 w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />}
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">{s.label}</p>
            <p className={cn('text-2xl font-black', s.color)}>{s.value}</p>
          </motion.div>
        ))}
      </div>

      {/* ── Dictado rápido por voz ── */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-indigo-500" />
          <p className="font-black text-slate-900 text-sm">Dictado rápido con IA</p>
          <span className="text-[10px] text-slate-400 font-medium">Di la factura en voz alta o escríbela</span>
        </div>
        <div className="relative">
          <textarea
            value={quickText}
            onChange={e => setQuickText(e.target.value)}
            placeholder={`Ej: "Mesa 5, menú degustación para 3 personas a 45 euros cada uno, IVA 10, cliente Juan García, teléfono 600123456"`}
            rows={2}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm resize-none
                       focus:outline-none focus:ring-2 focus:ring-indigo-300 pr-14"
          />
          <button onClick={toggleQuickVoice}
            className={cn(
              'absolute right-3 bottom-3 p-2.5 rounded-xl transition-all',
              quickOn ? 'bg-rose-500 text-white animate-pulse shadow-lg shadow-rose-200'
                      : 'bg-indigo-100 text-indigo-600 hover:bg-indigo-200'
            )}>
            {quickOn ? <MicOff size={18} /> : <Mic size={18} />}
          </button>
        </div>
        {quickOn && (
          <p className="text-xs text-rose-500 animate-pulse flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-rose-500 rounded-full" /> Escuchando… hasta 20 segundos
          </p>
        )}
        <button onClick={() => processQuick(quickText)} disabled={!quickText.trim() || quickBusy}
          className="flex items-center justify-center gap-2 w-full py-2.5 bg-indigo-600 text-white rounded-2xl
                     text-sm font-bold hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
          {quickBusy ? <><Loader2 size={15} className="animate-spin" /> Procesando con IA…</> : <><Brain size={15} /> Crear factura con IA</>}
        </button>
      </div>

      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-[200px] bg-white border border-slate-200 rounded-2xl px-4 py-2.5 shadow-sm">
          <Search size={16} className="text-slate-400 shrink-0" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar cliente o factura…"
            className="flex-1 text-sm bg-transparent outline-none placeholder:text-slate-400" />
          <VoiceButton onResult={setSearch} small />
        </div>
        <div className="flex bg-white border border-slate-200 rounded-2xl p-1 gap-1 shadow-sm">
          {(['Todos', 'Pendiente', 'Pagada', 'Vencida', 'Cancelada']).map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={cn('px-3 py-1.5 rounded-xl text-xs font-bold transition-all',
                filterStatus === s ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-800'
              )}>
              {s}
            </button>
          ))}
        </div>
        <button onClick={() => { setShowClients(!showClients); loadClients(); }}
          className={cn('flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold border transition-all',
            showClients ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
          )}>
          <Users size={13} /> Clientes ({savedClients.length})
        </button>
      </div>

      {/* ── Clientes guardados ── */}
      <AnimatePresence>
        {showClients && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 space-y-3">
              <p className="text-xs font-black uppercase tracking-widest text-slate-400">Clientes recurrentes</p>
              {savedClients.length === 0
                ? <p className="text-slate-400 text-sm text-center py-4">Sin clientes guardados aún</p>
                : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {savedClients.slice(0, 9).map(c => (
                      <button key={c.id} onClick={() => { loadClient(c); setShowForm(true); }}
                        className="text-left p-4 bg-slate-50 rounded-2xl hover:bg-indigo-50 hover:border-indigo-200 border border-transparent transition-all">
                        <p className="font-black text-slate-900 text-sm">{c.name}</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {c.invoice_count} factura{c.invoice_count !== 1 ? 's' : ''} · {fmtEur(c.total_spent)}
                        </p>
                        {c.email && <p className="text-xs text-indigo-400 truncate mt-0.5">{c.email}</p>}
                      </button>
                    ))}
                  </div>
                )
              }
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Lista de facturas ── */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={32} className="animate-spin text-indigo-400" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 bg-slate-100 rounded-[2rem] flex items-center justify-center mb-4 text-slate-300">
            <Receipt size={40} />
          </div>
          <p className="text-slate-400 font-bold">Sin facturas{search ? ` con "${search}"` : ''}</p>
          <button onClick={() => setShowForm(true)}
            className="mt-4 flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-2xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200">
            <Plus size={15} /> Crear primera factura
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(inv => (
            <InvoiceCard
              key={inv.id}
              invoice={inv}
              expanded={expandedId === inv.id}
              onToggle={() => setExpandedId(expandedId === inv.id ? null : inv.id)}
              onStatusChange={s => changeStatus(inv.id, s)}
              onDelete={() => deleteInvoice(inv.id)}
              onPrint={() => printInvoice(inv)}
              onWhatsApp={() => sendWhatsApp(inv)}
            />
          ))}
        </div>
      )}

      {/* ════ MODAL NUEVA FACTURA ════ */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ y: 40, opacity: 0, scale: 0.97 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 40, opacity: 0, scale: 0.97 }}
              className="bg-white w-full max-w-2xl rounded-[2.5rem] flex flex-col max-h-[92vh] overflow-hidden shadow-2xl">

              <div className="p-6 border-b border-slate-100 flex items-center justify-between shrink-0">
                <div>
                  <h2 className="text-xl font-black text-slate-900">Nueva factura</h2>
                  <p className="text-xs text-slate-400 mt-0.5">Los campos marcados * son obligatorios</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => { setShowClients(!showClients); loadClients(); }}
                    className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-200 transition-all">
                    <Users size={12} /> Clientes
                  </button>
                  <button onClick={() => setShowForm(false)} className="p-2 rounded-xl hover:bg-slate-100 transition-all">
                    <X size={20} />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

                {/* Cliente */}
                <div className="space-y-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Datos del cliente</p>
                  <div className="space-y-1.5">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Nombre *</label>
                    <VoiceField value={form.client_name} onChange={v => setForm(f => ({ ...f, client_name: v }))} placeholder="Nombre del cliente o empresa" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-black uppercase tracking-widest text-slate-400">CIF / NIF</label>
                      <VoiceField value={form.client_cif} onChange={v => setForm(f => ({ ...f, client_cif: v }))} placeholder="B12345678" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-black uppercase tracking-widest text-slate-400">Teléfono</label>
                      <VoiceField value={form.client_phone} onChange={v => setForm(f => ({ ...f, client_phone: v }))} placeholder="+34 600 000 000" type="tel" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Email</label>
                    <VoiceField value={form.client_email} onChange={v => setForm(f => ({ ...f, client_email: v }))} placeholder="cliente@email.com" type="email" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Dirección</label>
                    <VoiceField value={form.client_address} onChange={v => setForm(f => ({ ...f, client_address: v }))} placeholder="Calle, ciudad…" />
                  </div>
                </div>

                {/* Fechas e IVA */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Vencimiento</label>
                    <input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">IVA general %</label>
                    <select value={form.tax_rate} onChange={e => setForm(f => ({ ...f, tax_rate: Number(e.target.value) }))}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
                      <option value={4}>4% — Básico</option>
                      <option value={10}>10% — Restauración</option>
                      <option value={21}>21% — General</option>
                    </select>
                  </div>
                </div>

                {/* Conceptos */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Conceptos *</p>
                    <button onClick={addItem}
                      className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-200 transition-all">
                      <Plus size={12} /> Añadir línea
                    </button>
                  </div>
                  {items.map((item, idx) => (
                    <div key={item.id} className="bg-slate-50 rounded-2xl p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-slate-400 w-5 shrink-0">{idx + 1}</span>
                        <div className="flex-1 flex items-center gap-2">
                          <input value={item.description} onChange={e => updItem(item.id, { description: e.target.value })}
                            placeholder="Descripción del concepto"
                            className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200" />
                          <VoiceButton onResult={v => updItem(item.id, { description: v })} small />
                        </div>
                        <button onClick={() => delItem(item.id)}
                          className="p-1.5 rounded-xl text-rose-400 hover:bg-rose-50 transition-all shrink-0">
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <div className="grid grid-cols-3 gap-2 pl-7">
                        <input type="number" min="0.01" step="0.01" value={item.quantity || ''}
                          onChange={e => updItem(item.id, { quantity: parseFloat(e.target.value) || 0 })}
                          placeholder="Cant."
                          className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 text-right" />
                        <input type="number" min="0" step="0.01" value={item.unit_price || ''}
                          onChange={e => updItem(item.id, { unit_price: parseFloat(e.target.value) || 0 })}
                          placeholder="Precio"
                          className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 text-right" />
                        <select value={item.tax_rate} onChange={e => updItem(item.id, { tax_rate: Number(e.target.value) })}
                          className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200">
                          <option value={4}>4%</option>
                          <option value={10}>10%</option>
                          <option value={21}>21%</option>
                        </select>
                      </div>
                      <div className="flex justify-end pl-7">
                        <span className="text-xs text-slate-400">
                          = <strong className="text-slate-700">{fmtEur(item.total)}</strong>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Totales */}
                {items.some(i => i.total > 0) && (
                  <div className="bg-indigo-50 border border-indigo-100 rounded-2xl px-5 py-4 space-y-1.5">
                    <div className="flex justify-between text-sm text-indigo-600">
                      <span>Base imponible</span><span className="font-bold">{fmtEur(totals.subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-indigo-600">
                      <span>IVA ({form.tax_rate}%)</span><span className="font-bold">{fmtEur(totals.tax_amount)}</span>
                    </div>
                    <div className="flex justify-between text-lg font-black text-indigo-800 border-t border-indigo-200 pt-1.5">
                      <span>TOTAL</span><span>{fmtEur(totals.total)}</span>
                    </div>
                  </div>
                )}

                {/* Notas */}
                <div className="space-y-1.5">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400">Notas</label>
                  <div className="flex items-start gap-2">
                    <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                      placeholder="Observaciones, condiciones de pago…" rows={2}
                      className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                    <VoiceButton onResult={v => setForm(f => ({ ...f, notes: v }))} small className="mt-1" />
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-slate-100 flex gap-3 shrink-0">
                <button onClick={() => setShowForm(false)}
                  className="flex-1 py-3 border border-slate-200 rounded-2xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all">
                  Cancelar
                </button>
                <button onClick={saveInvoice} disabled={saving}
                  className="flex-1 py-3 bg-indigo-600 text-white rounded-2xl text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-200">
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                  Guardar factura
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
