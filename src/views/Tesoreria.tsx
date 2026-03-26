// src/views/Tesoreria.tsx — SUPER MÓDULO CONTABLE
// ✅ Importación extracto CaixaBank (Excel/CSV/pegar)
// ✅ Motor conciliación automática: banco ↔ facturas + gastos fijos + cierres caja
// ✅ Al conciliar → factura se marca pagada/cobrada automáticamente
// ✅ Alertas vencimientos próximos (7 días)
// ✅ Previsión tesorería 30 días (gastos fijos + facturas pendientes)
// ✅ Libro diario contable (debe/haber) exportable
// ✅ Auto-categorización IA al importar extracto
// ✅ Exportar mes a Excel
// ✅ Flujo cierre caja → depósito banco automático
// ✅ 100% Supabase
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Wallet, Plus, Mic, MicOff, Loader2, X, Check, AlertTriangle,
  CheckCircle2, Trash2, Search, TrendingUp, TrendingDown, Brain,
  Landmark, ArrowUpRight, ArrowDownLeft, RefreshCw, Link, Link2Off,
  Upload, Calendar, Zap, Eye, ChevronDown, ChevronUp, BookOpen,
  Download, Clock, BarChart3, Bell, Tag
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../supabase';
import { useSupabase } from '../context/SupabaseContext';
import { GoogleGenAI } from '@google/genai';
import { cn } from '../lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────
interface CashEntry { id: string; date: string; type: 'Ingreso'|'Gasto'; category: string; description: string; amount: number; payment_method: string; reference?: string; reconciled: boolean; }
interface BankAccount { id: string; name: string; bank_name: string; account_number?: string; balance: number; last_sync?: string; }
interface BankTransaction { id: string; bank_account_id: string; date: string; description: string; amount: number; balance?: number; category?: string; status: 'Conciliado'|'Pendiente'|'Revision'; matched_type?: string|null; matched_id?: string|null; }
interface ProviderInvoice { id: string; num: string; fecha: string; fecha_venc?: string; proveedor: string; total: number; pagada: boolean; }
interface CustomerInvoice { id: string; number: string; date: string; due_date?: string; client_name: string; total: number; status: string; }
interface CashClosing { id: string; date: string; total_sales: number; counted_cash: number; final_float: number; card_sales: number; }
interface FixedExpense { id: string; name: string; amount: number; frequency: string; category: string; }
interface MatchSuggestion { bankTxId: string; confidence: number; type: string; matchedId: string; matchedLabel: string; matchedAmount: number; diff: number; }

// Libro diario entry
interface JournalEntry { id: string; date: string; description: string; account_debit: string; account_credit: string; amount: number; ref?: string; source: string; }

// Previsión
interface ForecastItem { date: string; label: string; amount: number; type: 'gasto'|'ingreso'; source: string; }

type TabId = 'movimientos'|'banco'|'conciliacion'|'prevision'|'diario'|'analitica';

// ─── Constants ────────────────────────────────────────────────────────────────
const CATS_INGRESO = ['Ventas TPV','Ventas efectivo','Delivery','Cobro factura cliente','Otros ingresos'];
const CATS_GASTO   = ['Pago proveedor','Personal/Nominas','Alquiler','Suministros','Seguros','Impuestos','Mantenimiento','Otros gastos'];
const PAY_METHODS  = ['Efectivo','Tarjeta','Transferencia','Banco','Cheque'];

// Plan contable simplificado
const ACCOUNTS: Record<string, string> = {
  'Ventas TPV':           '700.0 Ventas restaurante',
  'Ventas efectivo':      '700.0 Ventas restaurante',
  'Delivery':             '705.0 Ventas delivery',
  'Cobro factura cliente':'430.0 Clientes',
  'Pago proveedor':       '400.0 Proveedores',
  'Personal/Nominas':     '640.0 Sueldos y salarios',
  'Alquiler':             '621.0 Arrendamientos',
  'Suministros':          '628.0 Suministros',
  'Seguros':              '625.0 Primas de seguros',
  'Impuestos':            '630.0 Impuesto sobre beneficios',
  'Mantenimiento':        '622.0 Reparaciones y conservacion',
  'Otros gastos':         '629.0 Otros gastos',
  'Otros ingresos':       '759.0 Otros ingresos',
  'default_banco':        '572.0 Bancos',
  'default_caja':         '570.0 Caja',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const aiRef = { current: null as GoogleGenAI|null };
function getAI() { if (!aiRef.current) aiRef.current = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY||'' }); return aiRef.current; }
function uid() { return Math.random().toString(36).slice(2,10); }
function fmtEur(n: number) { return n.toLocaleString('es-ES',{style:'currency',currency:'EUR'}); }
function fmtDate(d: string) { if(!d) return '—'; return new Date(d+(d.length===10?'T00:00:00':'')).toLocaleDateString('es-ES',{day:'2-digit',month:'short',year:'numeric'}); }
function today() { return new Date().toISOString().split('T')[0]; }
function addDays(d: string, n: number) { const dt = new Date(d+'T00:00:00'); dt.setDate(dt.getDate()+n); return dt.toISOString().split('T')[0]; }
function monthStart(m: string) { return m+'-01'; }
function monthEnd(m: string) { const [y,mo]=m.split('-').map(Number); return new Date(y,mo,0).toISOString().split('T')[0]; }
function daysUntil(d: string) { return Math.ceil((new Date(d+'T00:00:00').getTime()-new Date(today()+'T00:00:00').getTime())/86400000); }

// ─── Motor de conciliación ────────────────────────────────────────────────────
function findMatches(tx: BankTransaction, provInv: ProviderInvoice[], custInv: CustomerInvoice[], fixedExp: FixedExpense[], closings: CashClosing[]): MatchSuggestion[] {
  const suggs: MatchSuggestion[] = [];
  const amt = Math.abs(tx.amount);
  const txDate = new Date(tx.date+'T00:00:00');
  const descLow = tx.description.toLowerCase();
  const tol = 0.02;

  if (tx.amount < 0) {
    for (const inv of provInv.filter(i=>!i.pagada)) {
      const diff = Math.abs(amt-inv.total)/inv.total;
      const days = Math.abs((txDate.getTime()-new Date(inv.fecha+'T00:00:00').getTime())/86400000);
      if (diff<=tol && days<=60) {
        let conf = Math.round(100-diff*100);
        const words = inv.proveedor.toLowerCase().split(' ').filter(w=>w.length>3);
        if (words.some(w=>descLow.includes(w))) conf=Math.min(100,conf+20);
        suggs.push({bankTxId:tx.id,confidence:conf,type:'factura_proveedor',matchedId:inv.id,matchedLabel:`Factura ${inv.num} — ${inv.proveedor}`,matchedAmount:inv.total,diff:amt-inv.total});
      }
    }
    for (const exp of fixedExp.filter(e=>e.frequency==='Mensual')) {
      const diff = Math.abs(amt-exp.amount)/exp.amount;
      if (diff<=tol) {
        let conf = Math.round(80-diff*100);
        if (descLow.includes(exp.name.toLowerCase().split(' ')[0])) conf=Math.min(100,conf+15);
        suggs.push({bankTxId:tx.id,confidence:conf,type:'gasto_fijo',matchedId:exp.id,matchedLabel:`Gasto fijo: ${exp.name}`,matchedAmount:exp.amount,diff:amt-exp.amount});
      }
    }
  }
  if (tx.amount > 0) {
    for (const inv of custInv.filter(i=>i.status==='Pendiente'||i.status==='Vencida')) {
      const diff = Math.abs(amt-inv.total)/inv.total;
      const days = Math.abs((txDate.getTime()-new Date(inv.date+'T00:00:00').getTime())/86400000);
      if (diff<=tol && days<=90) {
        let conf = Math.round(90-diff*100);
        const words = inv.client_name.toLowerCase().split(' ').filter(w=>w.length>3);
        if (words.some(w=>descLow.includes(w))) conf=Math.min(100,conf+20);
        suggs.push({bankTxId:tx.id,confidence:conf,type:'factura_cliente',matchedId:inv.id,matchedLabel:`Factura ${inv.number} — ${inv.client_name}`,matchedAmount:inv.total,diff:amt-inv.total});
      }
    }
    for (const cc of closings) {
      const deposit = cc.counted_cash-(cc.final_float||200);
      if (deposit<=0) continue;
      const diff = Math.abs(amt-deposit)/deposit;
      const days = Math.abs((txDate.getTime()-new Date(cc.date+'T00:00:00').getTime())/86400000);
      if (diff<=0.05 && days<=3) {
        suggs.push({bankTxId:tx.id,confidence:Math.round(80-diff*100),type:'cierre_caja',matchedId:cc.id,matchedLabel:`Deposito caja — ${fmtDate(cc.date)}`,matchedAmount:deposit,diff:amt-deposit});
      }
    }
  }
  return suggs.sort((a,b)=>b.confidence-a.confidence);
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function useToast() {
  const [toasts, setToasts] = useState<{id:string;msg:string;type:'ok'|'err'|'warn'}[]>([]);
  const show = useCallback((msg: string, type: 'ok'|'err'|'warn'='ok') => {
    const id=uid(); setToasts(t=>[...t,{id,msg,type}]);
    setTimeout(()=>setToasts(t=>t.filter(x=>x.id!==id)),4000);
  },[]);
  const ToastContainer = () => (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[500] flex flex-col gap-2 items-center pointer-events-none">
      <AnimatePresence>
        {toasts.map(t=>(
          <motion.div key={t.id} initial={{opacity:0,y:20,scale:0.9}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:-10,scale:0.9}}
            className={cn('px-5 py-3 rounded-2xl text-sm font-bold shadow-2xl flex items-center gap-2 max-w-sm',
              t.type==='ok'?'bg-slate-900 text-white':t.type==='warn'?'bg-amber-500 text-white':'bg-rose-500 text-white')}>
            {t.type==='ok'?<CheckCircle2 size={16}/>:<AlertTriangle size={16}/>} {t.msg}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
  return {show,ToastContainer};
}

function VoiceButton({onResult,small,className=''}:{onResult:(t:string)=>void;small?:boolean;className?:string}) {
  const [on,setOn]=useState(false); const ref=useRef<SpeechRecognition|null>(null); const sz=small?14:16;
  const toggle=()=>{
    const SR=(window as any).SpeechRecognition||(window as any).webkitSpeechRecognition;
    if(!SR){alert('Necesitas Chrome');return;}
    if(on){ref.current?.stop();setOn(false);return;}
    const r=new SR();ref.current=r;r.lang='es-ES';r.continuous=false;r.interimResults=false;
    r.onstart=()=>setOn(true);r.onresult=(e:SpeechRecognitionEvent)=>onResult(e.results[0][0].transcript);r.onerror=r.onend=()=>setOn(false);r.start();
  };
  return <button type="button" onClick={toggle} className={cn(`${small?'p-1.5':'p-2.5'} rounded-xl transition-all shrink-0`,on?'bg-rose-500 text-white animate-pulse shadow-lg shadow-rose-200':'bg-slate-100 text-slate-500 hover:bg-slate-200',className)}>{on?<MicOff size={sz}/>:<Mic size={sz}/>}</button>;
}

function VoiceField({value,onChange,placeholder,type='text'}:{value:string;onChange:(v:string)=>void;placeholder?:string;type?:string}) {
  return <div className="flex items-center gap-2"><input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"/><VoiceButton onResult={onChange} small/></div>;
}

function ConfidenceBadge({value}:{value:number}) {
  return <span className={cn('text-[10px] font-black px-2 py-0.5 rounded-lg',value>=90?'bg-emerald-100 text-emerald-700':value>=70?'bg-amber-100 text-amber-700':'bg-slate-100 text-slate-500')}>{value}%</span>;
}

// ─── CaixaBank Parser ─────────────────────────────────────────────────────────
function parseCaixaBank(raw: string, accountId: string): Omit<BankTransaction,'id'>[] {
  const lines=raw.split('\n').map(l=>l.trim()).filter(Boolean);
  if(lines.length<2) return [];
  const sample=lines[1];
  const sep=sample.includes('\t')?'\t':sample.includes(';')?';':',';
  const headers=lines[0].split(sep).map(h=>h.replace(/["']/g,'').trim().toLowerCase());
  const fc=(cands:string[])=>{for(const c of cands){const i=headers.findIndex(h=>h.includes(c));if(i>=0)return i;}return -1;};
  const CD=fc(['fecha','date','f.valor','f. valor','f.oper','fecha valor','fecha operac']);
  const CC=fc(['concepto','descripcion','descripci','movimiento','concept','description','observa']);
  const CA=fc(['importe','amount','cargo/abono','cuantia']);
  const CDB=fc(['cargo','debito','debit','salida']);
  const CCR=fc(['abono','credito','credit','entrada','haber']);
  const CB=fc(['saldo','balance']);
  const parseDate=(raw:string):string|null=>{
    if(!raw) return null;
    const m1=raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if(m1){const[,d,mo,y]=m1;const yr=y.length===2?'20'+y:y;return `${yr}-${mo.padStart(2,'0')}-${d.padStart(2,'0')}`;}
    if(/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    return null;
  };
  const parseAmt=(raw:string):number=>{if(!raw) return 0;return parseFloat(raw.replace(/[€\s]/g,'').replace(/\./g,'').replace(',','.'))||0;};
  const rows:Omit<BankTransaction,'id'>[]=[];
  for(const line of lines.slice(1)){
    const cells=line.split(sep).map(c=>c.replace(/["']/g,'').trim());
    if(cells.length<2) continue;
    const date=parseDate(CD>=0?cells[CD]:'');if(!date)continue;
    const desc=CC>=0?cells[CC]:cells[1]||'';
    let amount=0;
    if(CA>=0) amount=parseAmt(cells[CA]);
    else if(CDB>=0||CCR>=0){const d=CDB>=0?parseAmt(cells[CDB]):0;const c=CCR>=0?parseAmt(cells[CCR]):0;amount=c-d;}
    if(amount===0&&!desc) continue;
    const balance=CB>=0?parseAmt(cells[CB]):undefined;
    rows.push({bank_account_id:accountId,date,description:desc,amount,balance:balance||undefined,status:'Pendiente',category:undefined,matched_type:null,matched_id:null});
  }
  return rows;
}

// ─── CaixaBank Importer Modal ─────────────────────────────────────────────────
function ImporterModal({accountId,onImport,onClose,toast}:{accountId:string;onImport:(rows:Omit<BankTransaction,'id'>[],categorized:boolean)=>void;onClose:()=>void;toast:(m:string,t?:'ok'|'err'|'warn')=>void}) {
  const [mode,setMode]=useState<'upload'|'paste'>('upload');
  const [text,setText]=useState('');
  const [preview,setPreview]=useState<Omit<BankTransaction,'id'>[]>([]);
  const [parsing,setParsing]=useState(false);
  const [step,setStep]=useState<'input'|'confirm'>('input');
  const [aiCat,setAiCat]=useState(true);
  const fileRef=useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file=e.target.files?.[0];if(!file)return;
    setParsing(true);
    try {
      let csv='';
      if(file.name.endsWith('.xlsx')||file.name.endsWith('.xls')) {
        await new Promise<void>((res,rej)=>{if((window as any).XLSX){res();return;}const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';s.onload=()=>res();s.onerror=()=>rej(new Error('No se pudo cargar SheetJS'));document.head.appendChild(s);});
        const XLSX=(window as any).XLSX;
        const wb=XLSX.read(await file.arrayBuffer(),{type:'array',cellDates:true});
        csv=XLSX.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]],{FS:'\t'});
      } else { csv=await file.text(); }
      const rows=parseCaixaBank(csv,accountId);
      if(rows.length===0) throw new Error('No se detectaron movimientos. Comprueba el formato.');
      setPreview(rows); setStep('confirm');
    } catch(err:any){toast('Error: '+err.message,'err');}
    finally{setParsing(false);if(fileRef.current)fileRef.current.value='';}
  }

  function handlePaste() {
    if(!text.trim()){toast('Pega el texto primero','warn');return;}
    const rows=parseCaixaBank(text,accountId);
    if(rows.length===0){toast('No se detectaron movimientos. Copia tambien la fila de cabeceras.','err');return;}
    setPreview(rows); setStep('confirm');
  }

  const stats=useMemo(()=>{
    const ing=preview.filter(r=>r.amount>0).reduce((s,r)=>s+r.amount,0);
    const gas=preview.filter(r=>r.amount<0).reduce((s,r)=>s+r.amount,0);
    const dates=preview.map(r=>r.date).sort();
    return {ing,gas,min:dates[0]||'',max:dates[dates.length-1]||''};
  },[preview]);

  return (
    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-[400] flex items-end sm:items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm">
      <motion.div initial={{y:60,opacity:0}} animate={{y:0,opacity:1}} exit={{y:60,opacity:0}} className="bg-white w-full max-w-2xl rounded-[2.5rem] flex flex-col max-h-[92vh] overflow-hidden shadow-2xl">
        <div className="p-6 border-b border-slate-100 flex items-center gap-4 shrink-0">
          <div className="w-12 h-12 bg-blue-50 border border-blue-200 rounded-2xl flex items-center justify-center shrink-0"><Landmark size={22} className="text-blue-600"/></div>
          <div className="flex-1"><p className="text-[10px] font-black uppercase tracking-widest text-blue-500">Importar extracto</p><h2 className="text-xl font-black text-slate-900">CaixaBank</h2></div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 transition-all text-slate-400"><X size={20}/></button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {step==='input'&&(
            <div className="p-6 space-y-5">
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 space-y-2">
                <p className="font-black text-blue-900 text-sm">Como descargar el extracto de CaixaBank Now:</p>
                <ol className="text-xs text-blue-700 space-y-1 list-decimal list-inside leading-relaxed">
                  <li>Entra en CaixaBank Now → <strong>Cuentas → Movimientos</strong></li>
                  <li>Filtra el periodo que necesites</li>
                  <li>Haz clic en <strong>"Exportar"</strong> → elige <strong>Excel (.xlsx)</strong> o <strong>CSV</strong></li>
                  <li>Sube el archivo abajo — el sistema detecta las columnas automaticamente</li>
                </ol>
                <p className="text-[10px] text-blue-500 italic">Tambien puedes seleccionar toda la tabla en CaixaBank, copiar (Ctrl+A, Ctrl+C) y pegar aqui.</p>
              </div>
              <div className="flex gap-2">
                {[{id:'upload',label:'Subir archivo',sub:'Excel o CSV'},{id:'paste',label:'Copiar/Pegar',sub:'Desde CaixaBank Now'}].map(m=>(
                  <button key={m.id} onClick={()=>setMode(m.id as typeof mode)} className={cn('flex-1 p-4 rounded-2xl border-2 text-left transition-all',mode===m.id?'border-indigo-400 bg-indigo-50':'border-slate-200 hover:border-slate-300')}>
                    <p className="font-black text-slate-900 text-sm">{m.label}</p><p className="text-xs text-slate-400 mt-0.5">{m.sub}</p>
                  </button>
                ))}
              </div>
              {mode==='upload'?(
                <div>
                  <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv,.txt" className="hidden" onChange={handleFile}/>
                  <button onClick={()=>fileRef.current?.click()} disabled={parsing} className="w-full flex flex-col items-center justify-center gap-3 py-12 border-2 border-dashed border-slate-300 rounded-2xl hover:border-indigo-400 hover:bg-indigo-50/50 transition-all">
                    {parsing?<><Loader2 size={32} className="animate-spin text-indigo-400"/><p className="text-sm font-bold text-slate-500">Procesando...</p></>:<><Upload size={32} className="text-slate-400"/><p className="text-sm font-bold text-slate-600">Haz clic o arrastra el archivo</p><p className="text-xs text-slate-400">.xlsx, .xls o .csv</p></>}
                  </button>
                </div>
              ):(
                <div className="space-y-3">
                  <textarea value={text} onChange={e=>setText(e.target.value)} placeholder={`Pega aqui el contenido copiado de CaixaBank.\nFormato esperado:\nFecha\tConcepto\tImporte\tSaldo\n15/01/2025\tPAGO FACTURA...\t-450,00\t12.340,50`} rows={7} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-mono resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300"/>
                  <button onClick={handlePaste} disabled={!text.trim()} className="w-full py-3 bg-indigo-600 text-white rounded-2xl text-sm font-bold hover:bg-indigo-700 disabled:opacity-40 transition-all flex items-center justify-center gap-2"><Zap size={16}/> Procesar texto</button>
                </div>
              )}
              {/* Opcion AI categorization */}
              <label className="flex items-center gap-3 p-4 bg-indigo-50 border border-indigo-200 rounded-2xl cursor-pointer hover:bg-indigo-100 transition-all">
                <input type="checkbox" checked={aiCat} onChange={e=>setAiCat(e.target.checked)} className="w-4 h-4 rounded accent-indigo-600"/>
                <div>
                  <p className="font-black text-indigo-900 text-sm flex items-center gap-1.5"><Tag size={13}/> Auto-categorizar con IA</p>
                  <p className="text-xs text-indigo-600 mt-0.5">La IA asigna categorias a cada movimiento segun el concepto del banco</p>
                </div>
              </label>
            </div>
          )}
          {step==='confirm'&&(
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[{label:'Movimientos',value:String(preview.length),color:'text-slate-900'},{label:'Ingresos',value:fmtEur(stats.ing),color:'text-emerald-600'},{label:'Gastos',value:fmtEur(Math.abs(stats.gas)),color:'text-rose-600'},{label:'Periodo',value:`${fmtDate(stats.min)} → ${fmtDate(stats.max)}`,color:'text-slate-600'}].map(s=>(
                  <div key={s.label} className="bg-slate-50 rounded-2xl px-4 py-3"><p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{s.label}</p><p className={cn('font-black text-sm mt-0.5',s.color)}>{s.value}</p></div>
                ))}
              </div>
              {aiCat&&<div className="bg-indigo-50 border border-indigo-200 rounded-2xl px-4 py-3 flex items-center gap-2"><Tag size={14} className="text-indigo-500"/><p className="text-xs text-indigo-700 font-medium">La IA categorizara cada movimiento al importar — puede tardar unos segundos extra</p></div>}
              <div className="max-h-56 overflow-y-auto border border-slate-200 rounded-2xl">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 sticky top-0"><tr className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{['Fecha','Concepto','Importe','Saldo'].map(h=><th key={h} className="px-4 py-2 text-left">{h}</th>)}</tr></thead>
                  <tbody className="divide-y divide-slate-50">
                    {preview.slice(0,25).map((row,i)=>(
                      <tr key={i} className="hover:bg-slate-50/50">
                        <td className="px-4 py-2 text-slate-500 whitespace-nowrap">{fmtDate(row.date)}</td>
                        <td className="px-4 py-2 text-slate-700 max-w-[200px] truncate">{row.description}</td>
                        <td className={cn('px-4 py-2 font-bold',row.amount>=0?'text-emerald-600':'text-rose-600')}>{row.amount>=0?'+':''}{fmtEur(row.amount)}</td>
                        <td className="px-4 py-2 text-slate-400">{row.balance!=null?fmtEur(row.balance):'—'}</td>
                      </tr>
                    ))}
                    {preview.length>25&&<tr><td colSpan={4} className="px-4 py-2 text-center text-slate-400 text-xs">... y {preview.length-25} mas</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
        {step==='input'&&<div className="p-5 border-t border-slate-100 shrink-0"><button onClick={onClose} className="w-full py-3 border border-slate-200 rounded-2xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all">Cancelar</button></div>}
        {step==='confirm'&&(
          <div className="p-5 border-t border-slate-100 flex gap-3 shrink-0">
            <button onClick={()=>setStep('input')} className="flex-1 py-3 border border-slate-200 rounded-2xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all">← Atras</button>
            <button onClick={()=>onImport(preview,aiCat)} className="flex-[2] py-3 bg-blue-600 text-white rounded-2xl text-sm font-black hover:bg-blue-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-200">
              <Upload size={18}/> Importar {preview.length} movimientos{aiCat?' + IA':''}
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN VIEW
// ════════════════════════════════════════════════════════════════════════════
export default function TesoreriaView() {
  const { employee } = useSupabase();
  const { show: toast, ToastContainer } = useToast();

  const [activeTab,setActiveTab]=useState<TabId>('movimientos');
  const [entries,setEntries]=useState<CashEntry[]>([]);
  const [bankAccounts,setBankAccounts]=useState<BankAccount[]>([]);
  const [bankTx,setBankTx]=useState<BankTransaction[]>([]);
  const [provInvoices,setProvInvoices]=useState<ProviderInvoice[]>([]);
  const [custInvoices,setCustInvoices]=useState<CustomerInvoice[]>([]);
  const [cashClosings,setCashClosings]=useState<CashClosing[]>([]);
  const [fixedExpenses,setFixedExpenses]=useState<FixedExpense[]>([]);
  const [loading,setLoading]=useState(true);
  const [search,setSearch]=useState('');
  const [filterType,setFilterType]=useState<'Todos'|'Ingreso'|'Gasto'>('Todos');
  const [filterMonth,setFilterMonth]=useState(today().slice(0,7));
  const [aiLoading,setAiLoading]=useState(false);
  const [aiResult,setAiResult]=useState<string|null>(null);
  const [importing,setImporting]=useState(false);
  const [showImporter,setShowImporter]=useState(false);
  const [expandedTx,setExpandedTx]=useState<string|null>(null);

  // Modales
  const [showEntryForm,setShowEntryForm]=useState(false);
  const [showBankForm,setShowBankForm]=useState(false);
  const [showEditBalance,setShowEditBalance]=useState<BankAccount|null>(null);
  const [entrySaving,setEntrySaving]=useState(false);
  const [bankSaving,setBankSaving]=useState(false);
  const [newBalance,setNewBalance]=useState(0);

  const emptyEntry=()=>({type:'Ingreso' as const,category:'',description:'',amount:0,payment_method:'Efectivo',reference:'',date:today(),reconciled:false});
  const [entryForm,setEntryForm]=useState(emptyEntry());
  const [bankForm,setBankForm]=useState({name:'',bank_name:'CaixaBank',account_number:'',balance:0});

  // Load
  const loadAll=useCallback(async()=>{
    setLoading(true);
    const mS=monthStart(filterMonth),mE=monthEnd(filterMonth);
    const [eR,baR,btR,piR,ciR,ccR,feR]=await Promise.all([
      supabase.from('cash_entries').select('*').gte('date',mS).lte('date',mE).order('date',{ascending:false}).limit(500),
      supabase.from('bank_accounts').select('*').order('name'),
      supabase.from('bank_transactions').select('*').gte('date',mS).lte('date',mE).order('date',{ascending:false}).limit(500),
      supabase.from('facturas').select('id,num,fecha,fecha_venc,proveedor,total,pagada').eq('tipo','compra').eq('pagada',false),
      supabase.from('customer_invoices').select('id,number,date,due_date,client_name,total,status').in('status',['Pendiente','Vencida']),
      supabase.from('cash_closings').select('id,date,total_sales,counted_cash,final_float,card_sales').eq('status','closed').gte('date',mS).lte('date',mE),
      supabase.from('fixed_expenses').select('id,name,amount,frequency,category').eq('active',true),
    ]);
    if(eR.data)  setEntries(eR.data as CashEntry[]);
    if(baR.data) setBankAccounts(baR.data as BankAccount[]);
    if(btR.data) setBankTx(btR.data as BankTransaction[]);
    if(piR.data) setProvInvoices(piR.data as ProviderInvoice[]);
    if(ciR.data) setCustInvoices(ciR.data as CustomerInvoice[]);
    if(ccR.data) setCashClosings(ccR.data as CashClosing[]);
    if(feR.data) setFixedExpenses(feR.data as FixedExpense[]);
    setLoading(false);
  },[filterMonth]);

  useEffect(()=>{loadAll();},[loadAll]);

  // Stats
  const stats=useMemo(()=>{
    const ing=entries.filter(e=>e.type==='Ingreso').reduce((s,e)=>s+e.amount,0);
    const gas=entries.filter(e=>e.type==='Gasto').reduce((s,e)=>s+e.amount,0);
    const bankTotal=bankAccounts.reduce((s,a)=>s+a.balance,0);
    return {ingresos:ing,gastos:gas,saldo:ing-gas,bankTotal};
  },[entries,bankAccounts]);

  // Matches
  const allMatches=useMemo(()=>{
    const result:Record<string,MatchSuggestion[]>={};
    for(const tx of bankTx.filter(t=>t.status==='Pendiente')){
      const s=findMatches(tx,provInvoices,custInvoices,fixedExpenses,cashClosings);
      if(s.length>0) result[tx.id]=s;
    }
    return result;
  },[bankTx,provInvoices,custInvoices,fixedExpenses,cashClosings]);

  const txWithSuggs=Object.keys(allMatches).length;
  const txSinCuadrar=bankTx.filter(t=>t.status==='Pendiente'&&!allMatches[t.id]?.length).length;

  // ── Alertas vencimientos ─────────────────────────────────────────────────
  const expiryAlerts = useMemo(()=>{
    const alerts: {label:string;days:number;amount:number;type:'proveedor'|'cliente'}[]=[];
    for(const inv of provInvoices){
      if(!inv.fecha_venc) continue;
      const d=daysUntil(inv.fecha_venc);
      if(d<=7) alerts.push({label:`${inv.proveedor} — Fac. ${inv.num}`,days:d,amount:inv.total,type:'proveedor'});
    }
    for(const inv of custInvoices){
      if(!inv.due_date) continue;
      const d=daysUntil(inv.due_date);
      if(d<=7) alerts.push({label:`${inv.client_name} — Fac. ${inv.number}`,days:d,amount:inv.total,type:'cliente'});
    }
    return alerts.sort((a,b)=>a.days-b.days);
  },[provInvoices,custInvoices]);

  // ── Previsión 30 días ────────────────────────────────────────────────────
  const forecast = useMemo(()=>{
    const items: ForecastItem[]=[];
    const now=today();
    // Facturas proveedor pendientes
    for(const inv of provInvoices){
      const d=inv.fecha_venc||addDays(inv.fecha,30);
      if(d>=now && d<=addDays(now,30))
        items.push({date:d,label:`Pago: ${inv.proveedor} — Fac. ${inv.num}`,amount:inv.total,type:'gasto',source:'factura_proveedor'});
    }
    // Facturas cliente pendientes
    for(const inv of custInvoices){
      const d=inv.due_date||addDays(inv.date,30);
      if(d>=now && d<=addDays(now,30))
        items.push({date:d,label:`Cobro: ${inv.client_name} — Fac. ${inv.number}`,amount:inv.total,type:'ingreso',source:'factura_cliente'});
    }
    // Gastos fijos mensuales — proyectar al siguiente mes
    const nextMonth=addDays(monthEnd(filterMonth),1).slice(0,7);
    for(const exp of fixedExpenses.filter(e=>e.frequency==='Mensual')){
      items.push({date:nextMonth+'-05',label:`Gasto fijo: ${exp.name}`,amount:exp.amount,type:'gasto',source:'gasto_fijo'});
    }
    return items.sort((a,b)=>a.date.localeCompare(b.date));
  },[provInvoices,custInvoices,fixedExpenses,filterMonth]);

  const forecastBalance=useMemo(()=>{
    const base=stats.bankTotal;
    let running=base;
    return forecast.map(item=>{
      running+=(item.type==='ingreso'?item.amount:-item.amount);
      return {date:item.date,balance:running};
    });
  },[forecast,stats.bankTotal]);

  const minForecast=forecastBalance.length>0?Math.min(...forecastBalance.map(f=>f.balance)):0;

  // ── Libro diario ──────────────────────────────────────────────────────────
  const journal = useMemo(():JournalEntry[]=>{
    const j:JournalEntry[]=[];
    for(const e of entries){
      const bankAcc=e.payment_method==='Efectivo'?'570.0 Caja':'572.0 Bancos';
      const oppAcc=ACCOUNTS[e.category]||'(sin cuenta)';
      j.push({
        id:e.id, date:e.date, description:e.description,
        account_debit: e.type==='Gasto'?oppAcc:bankAcc,
        account_credit: e.type==='Gasto'?bankAcc:oppAcc,
        amount:e.amount, ref:e.reference, source:'caja',
      });
    }
    for(const tx of bankTx.filter(t=>t.status==='Conciliado')){
      const bankAcc='572.0 Bancos';
      const oppAcc=tx.category?ACCOUNTS[tx.category]||'429.0 Otros deudores':'429.0 Otros deudores';
      j.push({
        id:tx.id, date:tx.date, description:tx.description,
        account_debit: tx.amount>0?bankAcc:oppAcc,
        account_credit: tx.amount>0?oppAcc:bankAcc,
        amount:Math.abs(tx.amount), source:'banco',
      });
    }
    return j.sort((a,b)=>b.date.localeCompare(a.date));
  },[entries,bankTx]);

  // ── Conciliar ─────────────────────────────────────────────────────────────
  async function applyConciliation(tx: BankTransaction, match: MatchSuggestion) {
    try {
      const {error:txE}=await supabase.from('bank_transactions').update({status:'Conciliado',category:match.type,matched_type:match.type,matched_id:match.matchedId}).eq('id',tx.id);
      if(txE) throw txE;
      if(match.type==='factura_proveedor'){await supabase.from('facturas').update({pagada:true,conciliada:true}).eq('id',match.matchedId);toast('✓ Factura marcada como pagada');}
      else if(match.type==='factura_cliente'){await supabase.from('customer_invoices').update({status:'Pagada'}).eq('id',match.matchedId);toast('✓ Factura cliente cobrada');}
      else if(match.type==='gasto_fijo') toast('✓ Gasto fijo conciliado');
      else toast('✓ Deposito conciliado');
      await loadAll();
    } catch(err:any){toast('Error: '+err.message,'err');}
  }

  async function markReview(txId: string) {
    const {error}=await supabase.from('bank_transactions').update({status:'Revision'}).eq('id',txId);
    if(error){toast('Error','err');return;}
    setBankTx(prev=>prev.map(t=>t.id===txId?{...t,status:'Revision' as const}:t));
    toast('Marcado para revision');
  }

  // ── Importar con IA categorización ───────────────────────────────────────
  async function handleImport(rows: Omit<BankTransaction,'id'>[], withAI: boolean) {
    setImporting(true); setShowImporter(false);
    try {
      let finalRows=rows;
      if(withAI && rows.length>0) {
        toast('IA categorizando movimientos...','warn');
        try {
          const sample=rows.slice(0,60).map(r=>`${r.date}|${r.description}|${r.amount}`).join('\n');
          const res=await getAI().models.generateContent({
            model:'gemini-2.0-flash',
            contents:[{role:'user',parts:[{text:`Categoriza cada movimiento bancario de un restaurante. Devuelve SOLO JSON array sin markdown:
[{"index":0,"category":"categoria","type":"Ingreso o Gasto"}]

Categorias posibles: ${[...CATS_INGRESO,...CATS_GASTO].join(', ')}

Movimientos (index|fecha|concepto|importe):
${rows.map((r,i)=>`${i}|${r.date}|${r.description}|${r.amount}`).join('\n')}`}]}]
          });
          const raw=res.candidates?.[0]?.content?.parts?.[0]?.text||'[]';
          const cats=JSON.parse(raw.replace(/```json|```/g,'').trim()) as {index:number;category:string}[];
          finalRows=rows.map((r,i)=>{
            const cat=cats.find(c=>c.index===i);
            return cat?{...r,category:cat.category}:r;
          });
        } catch { /* si falla la IA, importar sin categorias */ }
      }
      let inserted=0;
      for(let i=0;i<finalRows.length;i+=50){
        const {error}=await supabase.from('bank_transactions').insert(finalRows.slice(i,i+50));
        if(error) throw error;
        inserted+=Math.min(50,finalRows.length-i);
      }
      toast(`✓ ${inserted} movimientos importados. Conciliando automaticamente...`);
      await loadAll();
    } catch(err:any){toast('Error al importar: '+err.message,'err');}
    finally{setImporting(false);}
  }

  // ── Entry CRUD ────────────────────────────────────────────────────────────
  async function saveEntry() {
    if(!entryForm.category||!entryForm.description||entryForm.amount<=0){toast('Rellena todos los campos','err');return;}
    setEntrySaving(true);
    try {
      const {error}=await supabase.from('cash_entries').insert({...entryForm,amount:Number(entryForm.amount),reference:entryForm.reference||null});
      if(error) throw error;
      toast(`${entryForm.type} registrado ✓`);
      setShowEntryForm(false);setEntryForm(emptyEntry());await loadAll();
    } catch(err:any){toast('Error: '+err.message,'err');}
    finally{setEntrySaving(false);}
  }

  async function deleteEntry(id: string) {
    if(!confirm('Eliminar movimiento?')) return;
    const {error}=await supabase.from('cash_entries').delete().eq('id',id);
    if(error){toast('Error','err');return;}
    setEntries(prev=>prev.filter(e=>e.id!==id));toast('Movimiento eliminado');
  }

  async function saveBankAccount() {
    if(!bankForm.name||!bankForm.bank_name){toast('Nombre y banco son obligatorios','err');return;}
    setBankSaving(true);
    try {
      const {error}=await supabase.from('bank_accounts').insert({...bankForm,balance:Number(bankForm.balance)});
      if(error) throw error;
      toast('Cuenta añadida ✓');
      setShowBankForm(false);setBankForm({name:'',bank_name:'CaixaBank',account_number:'',balance:0});await loadAll();
    } catch(err:any){toast('Error: '+err.message,'err');}
    finally{setBankSaving(false);}
  }

  async function updateBalance(account: BankAccount) {
    const {error}=await supabase.from('bank_accounts').update({balance:newBalance,last_sync:new Date().toISOString()}).eq('id',account.id);
    if(error){toast('Error','err');return;}
    setBankAccounts(prev=>prev.map(a=>a.id===account.id?{...a,balance:newBalance}:a));
    setShowEditBalance(null);toast('Saldo actualizado ✓');
  }

  async function deleteBankTx(id: string) {
    const {error}=await supabase.from('bank_transactions').delete().eq('id',id);
    if(error){toast('Error','err');return;}
    setBankTx(prev=>prev.filter(t=>t.id!==id));toast('Movimiento eliminado');
  }

  // ── Exportar mes a Excel ──────────────────────────────────────────────────
  async function exportToExcel() {
    await new Promise<void>((res,rej)=>{if((window as any).XLSX){res();return;}const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';s.onload=()=>res();s.onerror=()=>rej();document.head.appendChild(s);});
    const XLSX=(window as any).XLSX;
    const data=[
      ['Fecha','Tipo','Categoria','Descripcion','Metodo de pago','Importe (€)','Conciliado'],
      ...entries.map(e=>[e.date,e.type,e.category,e.description,e.payment_method,e.amount,e.reconciled?'Si':'No']),
    ];
    const ws=XLSX.utils.aoa_to_sheet(data);
    ws['!cols']=[{wch:12},{wch:10},{wch:25},{wch:40},{wch:18},{wch:14},{wch:12}];
    const wb=XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb,ws,`Movimientos ${filterMonth}`);
    // Hoja banco
    if(bankTx.length>0){
      const bdata=[
        ['Fecha','Descripcion','Importe (€)','Saldo','Categoria','Estado'],
        ...bankTx.map(t=>[t.date,t.description,t.amount,t.balance||'',t.category||'',t.status]),
      ];
      XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(bdata),'Banco');
    }
    // Hoja libro diario
    if(journal.length>0){
      const jdata=[
        ['Fecha','Descripcion','Cuenta Debe','Cuenta Haber','Importe (€)','Referencia'],
        ...journal.map(j=>[j.date,j.description,j.account_debit,j.account_credit,j.amount,j.ref||'']),
      ];
      XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(jdata),'Libro Diario');
    }
    XLSX.writeFile(wb,`Tesoreria_Raco_${filterMonth}.xlsx`);
    toast('Excel exportado ✓');
  }

  // ── IA análisis ───────────────────────────────────────────────────────────
  async function handleAIAnalysis() {
    setAiLoading(true);setAiResult(null);
    try {
      const catBreak=Object.entries(entries.reduce((a:Record<string,{ing:number;gas:number}>,e)=>{if(!a[e.category])a[e.category]={ing:0,gas:0};if(e.type==='Ingreso')a[e.category].ing+=e.amount;else a[e.category].gas+=e.amount;return a;},{})).map(([c,v])=>`${c}: ${v.ing>0?'+'+fmtEur(v.ing):''} ${v.gas>0?'-'+fmtEur(v.gas):''}`).join('\n');
      const mes=new Date(filterMonth+'-01').toLocaleDateString('es-ES',{month:'long',year:'numeric'});
      const res=await getAI().models.generateContent({
        model:'gemini-2.0-flash',
        contents:[{role:'user',parts:[{text:`Eres el asesor financiero de Raco Blanquerna. Analiza tesoreria de ${mes}.

RESUMEN:
- Ingresos: ${fmtEur(stats.ingresos)} | Gastos: ${fmtEur(stats.gastos)} | Saldo neto: ${fmtEur(stats.saldo)}
- Saldo bancario: ${fmtEur(stats.bankTotal)}
- Sin conciliar: ${bankTx.filter(t=>t.status==='Pendiente').length} | Sin identificar: ${txSinCuadrar}
- Facturas proveedor por pagar: ${provInvoices.length} (${fmtEur(provInvoices.reduce((s,f)=>s+f.total,0))})
- Facturas cliente por cobrar: ${custInvoices.length} (${fmtEur(custInvoices.reduce((s,f)=>s+f.total,0))})
- Vencimientos proximos 7 dias: ${expiryAlerts.length}
- Tension prevista tesoreria 30d: ${minForecast<0?'DEFICIT PREVISTO de '+fmtEur(Math.abs(minForecast)):'OK, minimo '+fmtEur(minForecast)}

CATEGORIAS:
${catBreak||'Sin datos'}

Da 5 observaciones concretas en espanol: liquidez, cobros/pagos, mayor gasto, riesgo tension, accion. Bullet points, max 2 lineas.`}]}]
      });
      setAiResult(res.candidates?.[0]?.content?.parts?.[0]?.text||'Sin analisis');
    } catch(err:any){setAiResult('Error IA: '+err.message);}
    finally{setAiLoading(false);}
  }

  // Filtered
  const filteredEntries=useMemo(()=>{
    const q=search.toLowerCase();
    return entries.filter(e=>(filterType==='Todos'||e.type===filterType)&&(!q||e.description.toLowerCase().includes(q)||e.category.toLowerCase().includes(q)));
  },[entries,search,filterType]);

  const catBreak=useMemo(()=>{
    const map:Record<string,{ing:number;gas:number}>={};
    for(const e of entries){if(!map[e.category])map[e.category]={ing:0,gas:0};if(e.type==='Ingreso')map[e.category].ing+=e.amount;else map[e.category].gas+=e.amount;}
    return Object.entries(map).map(([cat,v])=>({cat,ing:v.ing,gas:v.gas})).sort((a,b)=>(b.ing+b.gas)-(a.ing+a.gas));
  },[entries]);

  const defaultAccount=bankAccounts[0];
  const totalAlerts=expiryAlerts.length+(txSinCuadrar>0?1:0);

  const TABS=[
    {id:'movimientos' as TabId,label:'Movimientos',icon:<Wallet size={14}/>},
    {id:'banco' as TabId,label:'Banco',icon:<Landmark size={14}/>},
    {id:'conciliacion' as TabId,label:'Conciliacion',icon:<Link size={14}/>,badge:txSinCuadrar+txWithSuggs},
    {id:'prevision' as TabId,label:'Prevision',icon:<BarChart3 size={14}/>,badge:minForecast<0?1:0},
    {id:'diario' as TabId,label:'Libro Diario',icon:<BookOpen size={14}/>},
    {id:'analitica' as TabId,label:'Analitica IA',icon:<Brain size={14}/>},
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-4 md:p-8 space-y-6">
      <ToastContainer/>

      <AnimatePresence>
        {showImporter&&(defaultAccount||bankAccounts[0])&&(
          <ImporterModal accountId={bankAccounts[0]?.id||''} onImport={handleImport} onClose={()=>setShowImporter(false)} toast={toast}/>
        )}
      </AnimatePresence>

      {/* ── Header ── */}
      <header className="sticky top-4 z-[100] bg-white/80 backdrop-blur-xl border border-white/20 shadow-xl rounded-[2.5rem] p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-2xl shadow-lg">
            <Wallet className="w-5 h-5 text-blue-400"/><span className="font-black text-sm tracking-tighter uppercase">Tesoreria</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-2xl shadow-sm">
            <Calendar size={14} className="text-slate-400"/>
            <input type="month" value={filterMonth} onChange={e=>setFilterMonth(e.target.value)} className="text-sm font-bold text-slate-700 bg-transparent outline-none"/>
          </div>
          {totalAlerts>0&&<span className="flex items-center gap-1 text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-xl"><Bell size={12}/> {totalAlerts} alerta{totalAlerts>1?'s':''}</span>}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportToExcel} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-2xl text-xs font-bold hover:bg-slate-50 transition-all shadow-sm">
            <Download size={14}/> Exportar Excel
          </button>
          {activeTab==='movimientos'&&<button onClick={()=>{setEntryForm(emptyEntry());setShowEntryForm(true);}} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-2xl text-xs font-bold hover:bg-indigo-700 transition-all shadow-sm shadow-indigo-200"><Plus size={14}/> Movimiento</button>}
          {activeTab==='banco'&&<>
            <button onClick={()=>{if(bankAccounts.length===0){toast('Añade una cuenta primero','warn');return;}setShowImporter(true);}} disabled={importing} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-2xl text-xs font-bold hover:bg-blue-700 disabled:opacity-50 transition-all shadow-sm shadow-blue-200">{importing?<Loader2 size={14} className="animate-spin"/>:<Upload size={14}/>} Importar extracto</button>
            <button onClick={()=>setShowBankForm(true)} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-2xl text-xs font-bold hover:bg-slate-50 transition-all shadow-sm"><Plus size={14}/> Cuenta</button>
          </>}
        </div>
      </header>

      {/* Alertas vencimientos */}
      {expiryAlerts.length>0&&(
        <div className="space-y-2">
          {expiryAlerts.slice(0,3).map((a,i)=>(
            <div key={i} className={cn('flex items-center gap-3 px-4 py-3 rounded-2xl border text-sm font-bold',a.days<0?'bg-rose-50 border-rose-200 text-rose-700':a.days<=3?'bg-amber-50 border-amber-200 text-amber-700':'bg-yellow-50 border-yellow-200 text-yellow-700')}>
              <Bell size={15} className="shrink-0"/>
              <span className="flex-1">{a.type==='proveedor'?'⚠️ Pago':'💶 Cobro'} vence {a.days<0?`hace ${Math.abs(a.days)} dias`:a.days===0?'HOY':`en ${a.days} dias`}: {a.label}</span>
              <span className="font-black">{fmtEur(a.amount)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {label:'Ingresos mes',value:fmtEur(stats.ingresos),color:'text-emerald-600',icon:<TrendingUp size={16} className="text-emerald-400"/>,alert:false},
          {label:'Gastos mes',value:fmtEur(stats.gastos),color:'text-rose-600',icon:<TrendingDown size={16} className="text-rose-400"/>,alert:false},
          {label:'Saldo neto',value:fmtEur(stats.saldo),color:stats.saldo>=0?'text-indigo-600':'text-rose-600',icon:<Wallet size={16} className="text-indigo-400"/>,alert:stats.saldo<0},
          {label:'Saldo bancario',value:fmtEur(stats.bankTotal),color:stats.bankTotal>=0?'text-blue-600':'text-rose-600',icon:<Landmark size={16} className="text-blue-400"/>,alert:minForecast<0},
        ].map((s,i)=>(
          <motion.div key={i} initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} className={cn('bg-white rounded-3xl p-5 border shadow-sm relative',s.alert?'border-rose-200':'border-slate-200')}>
            {s.alert&&<span className="absolute top-3 right-3 w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse"/>}
            <div className="flex items-center justify-between mb-2"><span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{s.label}</span>{s.icon}</div>
            <p className={cn('text-2xl font-black',s.color)}>{s.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex bg-white border border-slate-200 rounded-2xl p-1 gap-1 shadow-sm overflow-x-auto">
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setActiveTab(t.id)} className={cn('flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap relative',activeTab===t.id?'bg-slate-900 text-white':'text-slate-500 hover:text-slate-800')}>
            {t.icon} {t.label}
            {t.badge!=null&&t.badge>0&&<span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white text-[9px] font-black rounded-full flex items-center justify-center">{t.badge>9?'9+':t.badge}</span>}
          </button>
        ))}
      </div>

      {/* ══ MOVIMIENTOS ══ */}
      {activeTab==='movimientos'&&(
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-[200px] bg-white border border-slate-200 rounded-2xl px-4 py-2.5 shadow-sm">
              <Search size={16} className="text-slate-400 shrink-0"/>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar movimiento..." className="flex-1 text-sm bg-transparent outline-none placeholder:text-slate-400"/>
              <VoiceButton onResult={setSearch} small/>
            </div>
            <div className="flex bg-white border border-slate-200 rounded-2xl p-1 gap-1 shadow-sm">
              {(['Todos','Ingreso','Gasto'] as const).map(t=><button key={t} onClick={()=>setFilterType(t)} className={cn('px-4 py-1.5 rounded-xl text-xs font-bold transition-all',filterType===t?'bg-slate-900 text-white':'text-slate-500 hover:text-slate-800')}>{t}</button>)}
            </div>
          </div>
          {loading?<div className="flex justify-center py-20"><Loader2 size={32} className="animate-spin text-indigo-400"/></div>
          :<div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
            {filteredEntries.length===0
              ?<div className="flex flex-col items-center py-16 px-8 text-center"><Wallet size={40} className="text-slate-200 mb-4"/><p className="text-slate-400 font-bold">Sin movimientos en {filterMonth}</p><button onClick={()=>setShowEntryForm(true)} className="mt-4 flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-2xl text-sm font-bold hover:bg-indigo-700 transition-all"><Plus size={15}/> Añadir movimiento</button></div>
              :<div className="overflow-x-auto"><table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200"><tr className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{['Fecha','Tipo','Categoria','Descripcion','Metodo','Importe',''].map(h=><th key={h} className="px-5 py-3 text-left">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredEntries.map(e=>(
                    <tr key={e.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-5 py-3 text-slate-500 whitespace-nowrap">{fmtDate(e.date)}</td>
                      <td className="px-5 py-3"><span className={cn('text-[11px] font-black px-2.5 py-1 rounded-xl flex items-center gap-1 w-fit',e.type==='Ingreso'?'bg-emerald-50 text-emerald-700':'bg-rose-50 text-rose-700')}>{e.type==='Ingreso'?<ArrowDownLeft size={11}/>:<ArrowUpRight size={11}/>} {e.type}</span></td>
                      <td className="px-5 py-3 text-slate-500 text-xs">{e.category}</td>
                      <td className="px-5 py-3 font-medium text-slate-800 max-w-[180px] truncate">{e.description}</td>
                      <td className="px-5 py-3 text-slate-400 text-xs">{e.payment_method}</td>
                      <td className="px-5 py-3"><span className={cn('font-black',e.type==='Ingreso'?'text-emerald-600':'text-rose-600')}>{e.type==='Ingreso'?'+':'−'}{fmtEur(e.amount)}</span></td>
                      <td className="px-5 py-3"><div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">{e.reconciled&&<CheckCircle2 size={13} className="text-emerald-400"/>}<button onClick={()=>deleteEntry(e.id)} className="p-1.5 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-all"><Trash2 size={13}/></button></div></td>
                    </tr>
                  ))}
                </tbody>
              </table></div>}
          </div>}
          {catBreak.length>0&&<div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 space-y-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Desglose por categoria</p>
            <div className="space-y-2">{catBreak.slice(0,8).map(c=>(
              <div key={c.cat} className="flex items-center gap-4">
                <span className="text-sm font-medium text-slate-700 w-40 truncate">{c.cat}</span>
                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden flex">
                  {c.ing>0&&<div className="h-full bg-emerald-400 rounded-l-full" style={{width:`${(c.ing/Math.max(stats.ingresos,1))*100}%`}}/>}
                  {c.gas>0&&<div className="h-full bg-rose-400 rounded-r-full" style={{width:`${(c.gas/Math.max(stats.gastos,1))*100}%`}}/>}
                </div>
                <div className="text-right w-28">
                  {c.ing>0&&<p className="text-xs font-bold text-emerald-600">+{fmtEur(c.ing)}</p>}
                  {c.gas>0&&<p className="text-xs font-bold text-rose-600">−{fmtEur(c.gas)}</p>}
                </div>
              </div>
            ))}</div>
          </div>}
        </div>
      )}

      {/* ══ BANCO ══ */}
      {activeTab==='banco'&&(
        <div className="space-y-5">
          {bankAccounts.length===0
            ?<div className="flex flex-col items-center py-16 text-center"><Landmark size={40} className="text-slate-200 mb-4"/><p className="text-slate-400 font-bold">Sin cuentas bancarias</p><button onClick={()=>setShowBankForm(true)} className="mt-4 flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-2xl text-sm font-bold hover:bg-indigo-700 transition-all"><Plus size={15}/> Añadir cuenta</button></div>
            :<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{bankAccounts.map(acc=>(
              <div key={acc.id} className="bg-gradient-to-br from-slate-800 to-slate-900 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-10 -mt-10"/>
                <div className="relative z-10">
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">{acc.bank_name}</p>
                  <h3 className="font-black text-lg mt-0.5">{acc.name}</h3>
                  {acc.account_number&&<p className="text-slate-400 text-xs font-mono mt-1">.... {acc.account_number.slice(-4)}</p>}
                  <p className="text-3xl font-black mt-4">{fmtEur(acc.balance)}</p>
                  {acc.last_sync&&<p className="text-slate-500 text-xs mt-1">Actualizado: {fmtDate(acc.last_sync.split('T')[0])}</p>}
                  <div className="flex gap-2 mt-4">
                    <button onClick={()=>setShowImporter(true)} className="flex items-center gap-1.5 px-4 py-2 bg-blue-500/80 hover:bg-blue-500 rounded-xl text-xs font-black transition-all"><Upload size={12}/> Importar</button>
                    <button onClick={()=>{setShowEditBalance(acc);setNewBalance(acc.balance);}} className="flex items-center gap-1.5 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold transition-all"><RefreshCw size={12}/> Actualizar</button>
                  </div>
                </div>
              </div>
            ))}</div>}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between"><p className="font-black text-slate-900 text-sm">Movimientos bancarios — {filterMonth}</p><span className="text-xs font-bold bg-slate-100 text-slate-500 px-2 py-1 rounded-lg">{bankTx.length}</span></div>
            {loading?<div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-indigo-400"/></div>
            :bankTx.length===0?<div className="text-center py-12 space-y-3"><p className="text-slate-400 text-sm">Sin movimientos bancarios</p><button onClick={()=>setShowImporter(true)} disabled={bankAccounts.length===0} className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-2xl text-sm font-bold hover:bg-blue-700 transition-all mx-auto disabled:opacity-40"><Upload size={14}/> Importar extracto CaixaBank</button></div>
            :<div className="divide-y divide-slate-50 max-h-96 overflow-y-auto">
              {bankTx.map(tx=>{
                const acc=bankAccounts.find(a=>a.id===tx.bank_account_id);
                const hasSugg=allMatches[tx.id]?.length>0;
                return <div key={tx.id} className="flex items-center gap-4 px-5 py-3 hover:bg-slate-50/50 transition-all group">
                  <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0',tx.amount>0?'bg-emerald-50':'bg-rose-50')}>{tx.amount>0?<ArrowDownLeft size={16} className="text-emerald-500"/>:<ArrowUpRight size={16} className="text-rose-500"/>}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-800 truncate">{tx.description}</p>
                    <p className="text-xs text-slate-400">{fmtDate(tx.date)} · {acc?.name||'—'}{tx.category&&<span className="ml-1 text-indigo-400 font-bold">· {tx.category}</span>}{tx.matched_type&&<span className="ml-1 text-emerald-500 font-bold">✓</span>}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {hasSugg&&tx.status==='Pendiente'&&<span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-200 animate-pulse">{allMatches[tx.id][0].confidence}%</span>}
                    <span className={cn('text-[10px] font-black px-2 py-0.5 rounded-lg',tx.status==='Conciliado'?'bg-emerald-50 text-emerald-600':tx.status==='Revision'?'bg-rose-50 text-rose-600':'bg-amber-50 text-amber-600')}>{tx.status}</span>
                    <span className={cn('font-black text-sm',tx.amount>0?'text-emerald-600':'text-rose-600')}>{tx.amount>0?'+':''}{fmtEur(tx.amount)}</span>
                    <button onClick={()=>deleteBankTx(tx.id)} className="p-1.5 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-all opacity-0 group-hover:opacity-100"><Trash2 size={13}/></button>
                  </div>
                </div>;
              })}
            </div>}
          </div>
        </div>
      )}

      {/* ══ CONCILIACION ══ */}
      {activeTab==='conciliacion'&&(
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[{label:'Conciliados',value:bankTx.filter(t=>t.status==='Conciliado').length,color:'text-emerald-700',bg:'bg-emerald-50 border-emerald-200',sub:'verificados'},{label:'Con sugerencia IA',value:txWithSuggs,color:'text-blue-700',bg:'bg-blue-50 border-blue-200',sub:'listos para confirmar'},{label:'Sin identificar',value:txSinCuadrar,color:'text-rose-700',bg:txSinCuadrar>0?'bg-rose-50 border-rose-200':'bg-slate-50 border-slate-200',sub:'revision manual'}].map((s,i)=>(
              <div key={i} className={cn('border rounded-3xl p-5',s.bg)}><p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{s.label}</p><p className={cn('text-2xl font-black',s.color)}>{s.value}</p><p className="text-xs text-slate-400 mt-0.5">{s.sub}</p></div>
            ))}
          </div>
          {txWithSuggs>0&&<div className="bg-white rounded-3xl border border-blue-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 bg-blue-50 border-b border-blue-100 flex items-center gap-2"><Zap size={16} className="text-blue-500"/><p className="font-black text-blue-900 text-sm">Conciliacion automatica sugerida</p></div>
            <div className="divide-y divide-slate-100">
              {bankTx.filter(t=>t.status==='Pendiente'&&allMatches[t.id]?.length>0).map(tx=>{
                const top=allMatches[tx.id][0];
                const isExp=expandedTx===tx.id;
                return <div key={tx.id} className="p-5">
                  <div className="flex items-start gap-4">
                    <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5',tx.amount>0?'bg-emerald-50':'bg-rose-50')}>{tx.amount>0?<ArrowDownLeft size={16} className="text-emerald-500"/>:<ArrowUpRight size={16} className="text-rose-500"/>}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div><p className="font-black text-slate-900 text-sm">{tx.description}</p><p className="text-xs text-slate-400">{fmtDate(tx.date)} · {tx.amount>0?'+':''}{fmtEur(tx.amount)}</p></div>
                        <ConfidenceBadge value={top.confidence}/>
                      </div>
                      <div className="mt-3 bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3 flex items-center gap-3 flex-wrap">
                        <div className="flex-1"><p className="text-xs font-black text-blue-800">{top.type==='factura_proveedor'?'🧾 Factura proveedor':top.type==='factura_cliente'?'📄 Cobro cliente':top.type==='gasto_fijo'?'📅 Gasto fijo':'💰 Deposito caja'}</p><p className="text-xs text-blue-600 mt-0.5">{top.matchedLabel}</p>{Math.abs(top.diff)>0.01&&<p className="text-[10px] text-amber-600 font-bold mt-0.5">Diferencia: {top.diff>0?'+':''}{fmtEur(top.diff)}</p>}</div>
                        <div className="flex gap-2 shrink-0">
                          <button onClick={()=>applyConciliation(tx,top)} className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-black hover:bg-emerald-700 transition-all shadow-sm shadow-emerald-200"><Check size={13}/> Confirmar</button>
                          <button onClick={()=>markReview(tx.id)} className="flex items-center gap-1.5 px-3 py-2 bg-white border border-rose-200 text-rose-600 rounded-xl text-xs font-bold hover:bg-rose-50 transition-all"><Link2Off size={13}/> No es</button>
                        </div>
                      </div>
                      {allMatches[tx.id].length>1&&<button onClick={()=>setExpandedTx(isExp?null:tx.id)} className="mt-2 text-xs font-bold text-slate-400 hover:text-indigo-600 transition-colors flex items-center gap-1">{isExp?<ChevronUp size={12}/>:<ChevronDown size={12}/>} {allMatches[tx.id].length-1} alternativa{allMatches[tx.id].length-1>1?'s':''}</button>}
                      <AnimatePresence>
                        {isExp&&<motion.div initial={{height:0}} animate={{height:'auto'}} exit={{height:0}} className="overflow-hidden">
                          <div className="mt-2 space-y-2">{allMatches[tx.id].slice(1).map((m,i)=>(
                            <div key={i} className="flex items-center gap-3 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                              <div className="flex-1"><p className="text-xs font-bold text-slate-700">{m.matchedLabel}</p></div>
                              <ConfidenceBadge value={m.confidence}/>
                              <button onClick={()=>applyConciliation(tx,m)} className="px-3 py-1.5 bg-slate-200 text-slate-700 rounded-lg text-xs font-bold hover:bg-emerald-100 hover:text-emerald-700 transition-all">Usar esta</button>
                            </div>
                          ))}</div>
                        </motion.div>}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>;
              })}
            </div>
          </div>}
          {txSinCuadrar>0&&<div className="bg-white rounded-3xl border border-rose-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 bg-rose-50 border-b border-rose-100 flex items-center gap-2"><AlertTriangle size={16} className="text-rose-500"/><p className="font-black text-rose-900 text-sm">Sin identificar — revision manual</p></div>
            <div className="divide-y divide-slate-50">
              {bankTx.filter(t=>t.status==='Pendiente'&&!allMatches[t.id]?.length).map(tx=>(
                <div key={tx.id} className="flex items-center gap-4 px-5 py-3">
                  <div className="flex-1 min-w-0"><p className="text-sm font-bold text-slate-800 truncate">{tx.description}</p><p className="text-xs text-slate-400">{fmtDate(tx.date)}</p></div>
                  <span className={cn('font-black shrink-0',tx.amount>0?'text-emerald-600':'text-rose-600')}>{tx.amount>0?'+':''}{fmtEur(tx.amount)}</span>
                  <button onClick={()=>markReview(tx.id)} className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-700 rounded-xl text-xs font-bold hover:bg-amber-100 transition-all shrink-0"><Eye size={12}/> Revision</button>
                </div>
              ))}
            </div>
          </div>}
          {bankTx.filter(t=>t.status==='Revision').length>0&&<div className="bg-white rounded-3xl border border-amber-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 bg-amber-50 border-b border-amber-100"><p className="font-black text-amber-900 text-sm">En revision manual</p></div>
            <div className="divide-y divide-slate-50">
              {bankTx.filter(t=>t.status==='Revision').map(tx=>(
                <div key={tx.id} className="flex items-center gap-4 px-5 py-3">
                  <div className="flex-1 min-w-0"><p className="text-sm font-bold text-slate-800 truncate">{tx.description}</p><p className="text-xs text-slate-400">{fmtDate(tx.date)}</p></div>
                  <span className={cn('font-black shrink-0',tx.amount>0?'text-emerald-600':'text-rose-600')}>{tx.amount>0?'+':''}{fmtEur(tx.amount)}</span>
                </div>
              ))}
            </div>
          </div>}
          {bankTx.filter(t=>t.status!=='Conciliado').length===0&&!loading&&<div className="flex flex-col items-center py-16 text-center"><CheckCircle2 size={40} className="text-emerald-300 mb-4"/><p className="font-black text-emerald-600 text-lg">Todo conciliado!</p><p className="text-slate-400 text-sm mt-1">Sin movimientos pendientes en {filterMonth}</p></div>}
        </div>
      )}

      {/* ══ PREVISIÓN ══ */}
      {activeTab==='prevision'&&(
        <div className="space-y-5">
          {minForecast<0&&<div className="bg-rose-50 border border-rose-200 rounded-3xl p-5 flex items-start gap-3"><AlertTriangle size={20} className="text-rose-500 shrink-0 mt-0.5"/><div><p className="font-black text-rose-900">Alerta de tension de tesoreria</p><p className="text-sm text-rose-700 mt-0.5">Con los pagos previstos, el saldo bancario podria llegar a <strong>{fmtEur(minForecast)}</strong>. Considera adelantar cobros o negociar plazos.</p></div></div>}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 space-y-3">
            <div className="flex items-center justify-between"><p className="font-black text-slate-900">Previsión próximos 30 días</p><span className="text-xs text-slate-400 font-medium">Saldo actual: <strong className="text-blue-600">{fmtEur(stats.bankTotal)}</strong></span></div>
            {forecast.length===0?<p className="text-slate-400 text-sm text-center py-8">Sin previsiones — registra facturas con fechas de vencimiento</p>
            :<div className="space-y-2">
              {forecast.map((item,i)=>{
                const bal=forecastBalance[i];
                return <div key={i} className={cn('flex items-center gap-4 p-3 rounded-2xl border',item.type==='ingreso'?'bg-emerald-50 border-emerald-100':'bg-rose-50 border-rose-100')}>
                  <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0',item.type==='ingreso'?'bg-emerald-100':'bg-rose-100')}>{item.type==='ingreso'?<ArrowDownLeft size={15} className="text-emerald-600"/>:<ArrowUpRight size={15} className="text-rose-600"/>}</div>
                  <div className="flex-1 min-w-0"><p className="text-sm font-bold text-slate-800 truncate">{item.label}</p><p className="text-xs text-slate-400">{fmtDate(item.date)}</p></div>
                  <div className="text-right shrink-0">
                    <p className={cn('font-black',item.type==='ingreso'?'text-emerald-700':'text-rose-700')}>{item.type==='ingreso'?'+':'−'}{fmtEur(item.amount)}</p>
                    <p className={cn('text-xs font-bold',bal.balance>=0?'text-slate-500':'text-rose-600')}>Saldo: {fmtEur(bal.balance)}</p>
                  </div>
                </div>;
              })}
            </div>}
          </div>
          {/* Gastos fijos proyectados */}
          {fixedExpenses.length>0&&<div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 space-y-3">
            <p className="font-black text-slate-900">Gastos fijos mensuales recurrentes</p>
            <div className="space-y-2">{fixedExpenses.filter(e=>e.frequency==='Mensual').map(exp=>(
              <div key={exp.id} className="flex items-center justify-between px-4 py-2.5 bg-slate-50 rounded-2xl">
                <div><p className="text-sm font-bold text-slate-800">{exp.name}</p><p className="text-xs text-slate-400">{exp.category} · Mensual</p></div>
                <span className="font-black text-rose-600">−{fmtEur(exp.amount)}</span>
              </div>
            ))}</div>
            <div className="border-t border-slate-100 pt-3 flex justify-between"><span className="font-black text-slate-700">Total fijos/mes</span><span className="font-black text-rose-700">{fmtEur(fixedExpenses.filter(e=>e.frequency==='Mensual').reduce((s,e)=>s+e.amount,0))}</span></div>
          </div>}
        </div>
      )}

      {/* ══ LIBRO DIARIO ══ */}
      {activeTab==='diario'&&(
        <div className="space-y-4">
          <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 flex items-start gap-3">
            <BookOpen size={16} className="text-indigo-500 shrink-0 mt-0.5"/>
            <div>
              <p className="font-black text-indigo-900 text-sm">Libro diario contable simplificado</p>
              <p className="text-xs text-indigo-700 mt-0.5">Generado automaticamente a partir de los movimientos de caja y movimientos bancarios conciliados. Exporta a Excel para tu gestor.</p>
            </div>
          </div>
          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 border-b border-slate-200"><tr className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{['Fecha','Descripcion','Cuenta DEBE','Cuenta HABER','Importe','Ref','Origen'].map(h=><th key={h} className="px-5 py-3 text-left">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-slate-50">
                  {journal.slice(0,100).map(j=>(
                    <tr key={j.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-2.5 text-slate-500 whitespace-nowrap">{fmtDate(j.date)}</td>
                      <td className="px-5 py-2.5 font-medium text-slate-800 max-w-[200px] truncate">{j.description}</td>
                      <td className="px-5 py-2.5 text-indigo-600 font-mono text-[10px]">{j.account_debit}</td>
                      <td className="px-5 py-2.5 text-emerald-600 font-mono text-[10px]">{j.account_credit}</td>
                      <td className="px-5 py-2.5 font-black text-slate-900">{fmtEur(j.amount)}</td>
                      <td className="px-5 py-2.5 text-slate-400">{j.ref||'—'}</td>
                      <td className="px-5 py-2.5"><span className={cn('text-[10px] font-black px-2 py-0.5 rounded-lg',j.source==='banco'?'bg-blue-50 text-blue-600':'bg-slate-100 text-slate-500')}>{j.source}</span></td>
                    </tr>
                  ))}
                  {journal.length===0&&<tr><td colSpan={7} className="px-5 py-12 text-center text-slate-400"><BookOpen size={36} className="mx-auto mb-3 opacity-30"/><p>Sin asientos — registra movimientos o concilia el banco</p></td></tr>}
                  {journal.length>100&&<tr><td colSpan={7} className="px-5 py-3 text-center text-slate-400 text-xs">... y {journal.length-100} asientos mas. Exporta a Excel para verlos todos.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
          <button onClick={exportToExcel} className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 text-white rounded-2xl text-sm font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200"><Download size={16}/> Exportar libro diario a Excel</button>
        </div>
      )}

      {/* ══ ANALITICA IA ══ */}
      {activeTab==='analitica'&&(
        <div className="space-y-5">
          <button onClick={handleAIAnalysis} disabled={aiLoading} className="w-full flex items-center justify-center gap-3 py-4 bg-indigo-600 text-white rounded-2xl font-black hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-lg shadow-indigo-200">
            {aiLoading?<><Loader2 size={20} className="animate-spin"/> Analizando...</>:<><Brain size={20}/> Analizar tesoreria con IA</>}
          </button>
          {aiResult&&<motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} className="bg-indigo-50 border border-indigo-100 rounded-3xl p-6">
            <div className="flex items-center gap-3 mb-4"><div className="w-9 h-9 bg-indigo-100 rounded-2xl flex items-center justify-center"><Brain size={18} className="text-indigo-600"/></div><p className="font-black text-indigo-900">Analisis — {new Date(filterMonth+'-01').toLocaleDateString('es-ES',{month:'long',year:'numeric'})}</p></div>
            <pre className="text-sm text-indigo-800 whitespace-pre-wrap font-sans leading-relaxed">{aiResult}</pre>
          </motion.div>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm space-y-3">
              <p className="font-black text-slate-900 flex items-center gap-2"><ArrowUpRight size={16} className="text-rose-400"/> Por pagar</p>
              {provInvoices.slice(0,5).map(f=><div key={f.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0"><div><p className="text-sm font-bold text-slate-800">{f.proveedor}</p><p className="text-xs text-slate-400">N {f.num}{f.fecha_venc?` · vence ${fmtDate(f.fecha_venc)}`:''}</p></div><span className="font-black text-rose-600">−{fmtEur(f.total)}</span></div>)}
              {provInvoices.length===0&&<p className="text-slate-400 text-sm text-center py-3">Sin facturas pendientes</p>}
              <div className="border-t border-slate-100 pt-3 flex justify-between"><span className="font-black text-slate-500">Total</span><span className="font-black text-rose-700">{fmtEur(provInvoices.reduce((s,f)=>s+f.total,0))}</span></div>
            </div>
            <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm space-y-3">
              <p className="font-black text-slate-900 flex items-center gap-2"><ArrowDownLeft size={16} className="text-emerald-400"/> Por cobrar</p>
              {custInvoices.slice(0,5).map(f=><div key={f.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0"><div><p className="text-sm font-bold text-slate-800">{f.client_name}</p><p className="text-xs text-slate-400">N {f.number}{f.due_date?` · vence ${fmtDate(f.due_date)}`:''}</p></div><span className="font-black text-emerald-600">+{fmtEur(f.total)}</span></div>)}
              {custInvoices.length===0&&<p className="text-slate-400 text-sm text-center py-3">Sin cobros pendientes</p>}
              <div className="border-t border-slate-100 pt-3 flex justify-between"><span className="font-black text-slate-500">Total</span><span className="font-black text-emerald-700">{fmtEur(custInvoices.reduce((s,f)=>s+f.total,0))}</span></div>
            </div>
          </div>
        </div>
      )}

      {/* ════ MODALES ════ */}
      <AnimatePresence>
        {showEntryForm&&<motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <motion.div initial={{y:40,opacity:0}} animate={{y:0,opacity:1}} exit={{y:40,opacity:0}} className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between"><h2 className="text-xl font-black">Nuevo movimiento</h2><button onClick={()=>setShowEntryForm(false)} className="p-2 rounded-xl hover:bg-slate-100 transition-all"><X size={20}/></button></div>
            <div className="p-6 space-y-4">
              <div className="flex gap-2">{(['Ingreso','Gasto'] as const).map(t=><button key={t} onClick={()=>setEntryForm(f=>({...f,type:t,category:''}))} className={cn('flex-1 py-3 rounded-2xl text-sm font-black transition-all flex items-center justify-center gap-2',entryForm.type===t?(t==='Ingreso'?'bg-emerald-600 text-white shadow-lg shadow-emerald-200':'bg-rose-600 text-white shadow-lg shadow-rose-200'):'bg-slate-100 text-slate-600 hover:bg-slate-200')}>{t==='Ingreso'?<ArrowDownLeft size={15}/>:<ArrowUpRight size={15}/>} {t}</button>)}</div>
              <div className="space-y-1.5"><label className="text-xs font-black uppercase tracking-widest text-slate-400">Categoria *</label><select value={entryForm.category} onChange={e=>setEntryForm(f=>({...f,category:e.target.value}))} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"><option value="">— Selecciona —</option>{(entryForm.type==='Ingreso'?CATS_INGRESO:CATS_GASTO).map(c=><option key={c} value={c}>{c}</option>)}</select></div>
              <div className="space-y-1.5"><label className="text-xs font-black uppercase tracking-widest text-slate-400">Descripcion *</label><VoiceField value={entryForm.description} onChange={v=>setEntryForm(f=>({...f,description:v}))} placeholder="Descripcion del movimiento"/></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><label className="text-xs font-black uppercase tracking-widest text-slate-400">Importe (€) *</label><input type="number" min="0.01" step="0.01" value={entryForm.amount||''} onChange={e=>setEntryForm(f=>({...f,amount:parseFloat(e.target.value)||0}))} placeholder="0.00" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 text-right"/></div>
                <div className="space-y-1.5"><label className="text-xs font-black uppercase tracking-widest text-slate-400">Fecha</label><input type="date" value={entryForm.date} onChange={e=>setEntryForm(f=>({...f,date:e.target.value}))} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"/></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><label className="text-xs font-black uppercase tracking-widest text-slate-400">Metodo</label><select value={entryForm.payment_method} onChange={e=>setEntryForm(f=>({...f,payment_method:e.target.value}))} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">{PAY_METHODS.map(m=><option key={m} value={m}>{m}</option>)}</select></div>
                <div className="space-y-1.5"><label className="text-xs font-black uppercase tracking-widest text-slate-400">Referencia</label><VoiceField value={entryForm.reference||''} onChange={v=>setEntryForm(f=>({...f,reference:v}))} placeholder="N factura"/></div>
              </div>
            </div>
            <div className="p-6 border-t border-slate-100 flex gap-3">
              <button onClick={()=>setShowEntryForm(false)} className="flex-1 py-3 border border-slate-200 rounded-2xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all">Cancelar</button>
              <button onClick={saveEntry} disabled={entrySaving} className={cn('flex-1 py-3 rounded-2xl text-sm font-bold disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-lg',entryForm.type==='Ingreso'?'bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-200':'bg-rose-600 text-white hover:bg-rose-700 shadow-rose-200')}>{entrySaving?<Loader2 size={16} className="animate-spin"/>:<Check size={16}/>} Guardar {entryForm.type.toLowerCase()}</button>
            </div>
          </motion.div>
        </motion.div>}
      </AnimatePresence>

      <AnimatePresence>
        {showBankForm&&<motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <motion.div initial={{y:40,opacity:0}} animate={{y:0,opacity:1}} exit={{y:40,opacity:0}} className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between"><h2 className="text-xl font-black">Nueva cuenta bancaria</h2><button onClick={()=>setShowBankForm(false)} className="p-2 rounded-xl hover:bg-slate-100 transition-all"><X size={20}/></button></div>
            <div className="p-6 space-y-4">
              <div className="space-y-1.5"><label className="text-xs font-black uppercase tracking-widest text-slate-400">Nombre *</label><VoiceField value={bankForm.name} onChange={v=>setBankForm(f=>({...f,name:v}))} placeholder="Cuenta Corriente Principal"/></div>
              <div className="space-y-1.5"><label className="text-xs font-black uppercase tracking-widest text-slate-400">Banco *</label><VoiceField value={bankForm.bank_name} onChange={v=>setBankForm(f=>({...f,bank_name:v}))} placeholder="CaixaBank"/></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><label className="text-xs font-black uppercase tracking-widest text-slate-400">Ultimos 4 digitos</label><input type="text" maxLength={4} value={bankForm.account_number} onChange={e=>setBankForm(f=>({...f,account_number:e.target.value}))} placeholder="1234" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 text-center font-mono"/></div>
                <div className="space-y-1.5"><label className="text-xs font-black uppercase tracking-widest text-slate-400">Saldo inicial (€)</label><input type="number" min="0" step="0.01" value={bankForm.balance||''} onChange={e=>setBankForm(f=>({...f,balance:parseFloat(e.target.value)||0}))} placeholder="0.00" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 text-right"/></div>
              </div>
            </div>
            <div className="p-6 border-t border-slate-100 flex gap-3">
              <button onClick={()=>setShowBankForm(false)} className="flex-1 py-3 border border-slate-200 rounded-2xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all">Cancelar</button>
              <button onClick={saveBankAccount} disabled={bankSaving} className="flex-1 py-3 bg-indigo-600 text-white rounded-2xl text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-200">{bankSaving?<Loader2 size={16} className="animate-spin"/>:<Check size={16}/>} Guardar</button>
            </div>
          </motion.div>
        </motion.div>}
      </AnimatePresence>

      <AnimatePresence>
        {showEditBalance&&<motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <motion.div initial={{scale:0.95,opacity:0}} animate={{scale:1,opacity:1}} exit={{scale:0.95,opacity:0}} className="bg-white w-full max-w-sm rounded-[2rem] shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between"><h2 className="text-lg font-black">Actualizar saldo</h2><button onClick={()=>setShowEditBalance(null)} className="p-2 rounded-xl hover:bg-slate-100 transition-all"><X size={18}/></button></div>
            <div className="p-6 space-y-3"><p className="text-sm text-slate-600">Saldo actual de <strong>{showEditBalance.name}</strong> segun extracto:</p><input type="number" step="0.01" value={newBalance||''} onChange={e=>setNewBalance(parseFloat(e.target.value)||0)} placeholder="0.00" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-2xl font-black text-right focus:outline-none focus:ring-2 focus:ring-indigo-300"/></div>
            <div className="p-6 border-t border-slate-100 flex gap-3">
              <button onClick={()=>setShowEditBalance(null)} className="flex-1 py-3 border border-slate-200 rounded-2xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all">Cancelar</button>
              <button onClick={()=>updateBalance(showEditBalance)} className="flex-1 py-3 bg-indigo-600 text-white rounded-2xl text-sm font-bold hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-200"><Check size={16}/> Guardar</button>
            </div>
          </motion.div>
        </motion.div>}
      </AnimatePresence>
    </div>
  );
}
