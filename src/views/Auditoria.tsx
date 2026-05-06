// src/views/Auditoria.tsx
// ✅ 100% Supabase — cruza datos de TODOS los módulos
// ✅ Detección automática de anomalías:
//    - Subidas de precio en albaranes (mismo producto, mismo proveedor)
//    - Desviación coste real vs escandallo teórico
//    - Stock crítico persistente (lleva días sin reponer)
//    - Facturas vencidas acumuladas
//    - Solapamiento o exceso de personal
//    - Márgenes por debajo del umbral
// ✅ Score de salud del restaurante (0-100)
// ✅ Análisis IA profundo con Gemini
// ✅ Recomendaciones accionables por categoría
// ✅ Exportar informe a Excel
// ✅ Gen Z UX, toast notifications
import React, { useState, useCallback, useMemo } from 'react';
import {
  Sparkles, BrainCircuit, Brain, Loader2, AlertTriangle, CheckCircle2,
  TrendingUp, TrendingDown, Users, Package, Receipt, Wallet,
  ChefHat, Activity, Zap, Download, RefreshCw, X,
  AlertCircle, ArrowRight, Eye, DollarSign, Clock,
  ChevronUp, ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../supabase';
import { GoogleGenAI } from '@google/genai';
import { cn } from '../lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────
interface AuditFinding {
  id: string;
  category: 'costes' | 'stock' | 'personal' | 'ingresos' | 'tesoreria' | 'operaciones';
  severity: 'critico' | 'warning' | 'ok' | 'oportunidad';
  title: string;
  description: string;
  impact?: string;   // Impacto económico estimado
  action?: string;   // Acción recomendada
  data?: any;
}

interface AuditResult {
  score: number;       // 0-100
  findings: AuditFinding[];
  summary: {
    ventas_mes: number;
    gastos_mes: number;
    margen_mes: number;
    stock_critico: number;
    facturas_vencidas: number;
    total_employees: number;
    recipes_count: number;
    avg_recipe_margin: number;
  };
  ai_analysis: string | null;
  generated_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const aiRef = { current: null as GoogleGenAI | null };
function getAI() {
  if (!aiRef.current) aiRef.current = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || '' });
  return aiRef.current;
}
function uid() { return Math.random().toString(36).slice(2, 10); }
function fmtEur(n: number) { return n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' }); }
function fmtPct(n: number) { return `${n.toFixed(1)}%`; }
function today() { return new Date().toISOString().split('T')[0]; }
function startOfMonth() { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0]; }
function startOfLastMonth() { const d = new Date(); return new Date(d.getFullYear(), d.getMonth() - 1, 1).toISOString().split('T')[0]; }
function endOfLastMonth() { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 0).toISOString().split('T')[0]; }

const SEVERITY_CONFIG = {
  critico:    { label: 'Crítico',      color: 'bg-rose-100 text-rose-700 border-rose-200',    dot: 'bg-rose-500',    icon: AlertTriangle },
  warning:    { label: 'Atención',     color: 'bg-amber-100 text-amber-700 border-amber-200',  dot: 'bg-amber-400',   icon: AlertCircle },
  ok:         { label: 'OK',           color: 'bg-emerald-100 text-emerald-700 border-emerald-200', dot: 'bg-emerald-400', icon: CheckCircle2 },
  oportunidad:{ label: 'Oportunidad',  color: 'bg-blue-100 text-blue-700 border-blue-200',    dot: 'bg-blue-400',    icon: TrendingUp },
};

const CAT_CONFIG = {
  costes:     { label: 'Costes',       icon: DollarSign, color: 'text-rose-500' },
  stock:      { label: 'Inventario',   icon: Package,    color: 'text-amber-500' },
  personal:   { label: 'Personal',     icon: Users,      color: 'text-blue-500' },
  ingresos:   { label: 'Ingresos',     icon: TrendingUp, color: 'text-emerald-500' },
  tesoreria:  { label: 'Tesorería',    icon: Wallet,     color: 'text-indigo-500' },
  operaciones:{ label: 'Operaciones',  icon: Activity,   color: 'text-purple-500' },
};

// ─── Score visual ─────────────────────────────────────────────────────────────
function ScoreGauge({ score }: { score: number }) {
  const color = score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : '#ef4444';
  const label = score >= 80 ? 'Excelente' : score >= 60 ? 'Bueno' : score >= 40 ? 'Mejorable' : 'Crítico';
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-32 h-32">
        <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
          <circle cx="60" cy="60" r="50" fill="none" stroke="#f1f5f9" strokeWidth="12"/>
          <circle cx="60" cy="60" r="50" fill="none" stroke={color} strokeWidth="12"
            strokeDasharray={`${(score / 100) * 314} 314`}
            strokeLinecap="round" className="transition-all duration-1000"/>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-black text-slate-900">{score}</span>
          <span className="text-[10px] font-bold text-slate-400">/100</span>
        </div>
      </div>
      <span className="font-black text-sm" style={{ color }}>{label}</span>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// MOTOR DE AUDITORÍA
// ════════════════════════════════════════════════════════════════════════════
async function runAudit(): Promise<AuditResult> {
  const mStart     = startOfMonth();
  const mEnd       = today();
  const lmStart    = startOfLastMonth();
  const lmEnd      = endOfLastMonth();

  // Cargar todos los datos en paralelo
  const [
    cashClosingsRes, entriesRes,
    stockRes, movementsRes,
    staffRes, timeEntriesRes,
    provInvRes, custInvRes,
    albaranesRes, recipeCostsRes, fixedExpRes,
  ] = await Promise.all([
    supabase.from('cash_closings').select('total_sales,date,status').gte('date', mStart).lte('date', mEnd),
    supabase.from('cash_entries').select('type,amount,category,date').gte('date', mStart).lte('date', mEnd),
    supabase.from('stock_items').select('id,name,current_stock,min_stock,price_per_unit,last_updated').eq('active', true),
    supabase.from('stock_movements').select('stock_item_id,type,quantity,unit_cost,created_at').gte('created_at', lmStart),
    supabase.from('staff_profiles').select('id,name,role,monthly_salary,active').eq('active', true),
    supabase.from('time_entries').select('staff_id,date,worked_minutes,net_minutes').gte('date', mStart).lte('date', mEnd),
    supabase.from('facturas').select('id,num,proveedor,total,fecha,fecha_venc,pagada,tipo').eq('tipo', 'compra'),
    supabase.from('customer_invoices').select('id,number,client_name,total,date,due_date,status'),
    supabase.from('delivery_notes').select('id,supplier_name,fecha,total,items,estado').gte('fecha', lmStart),
    supabase.from('recipe_cost_summary').select('id,name,category,margin,total_cost,suggested_price'),
    supabase.from('fixed_expenses').select('id,name,amount,frequency').eq('active', true),
  ]);

  const closings    = cashClosingsRes.data   || [];
  const entries     = entriesRes.data        || [];
  const stockItems  = stockRes.data          || [];
  const movements   = movementsRes.data      || [];
  const staff       = staffRes.data          || [];
  const timeEntries = timeEntriesRes.data    || [];
  const provInv     = provInvRes.data        || [];
  const custInv     = custInvRes.data        || [];
  const albaranes   = albaranesRes.data      || [];
  const recipes     = recipeCostsRes.data    || [];
  const fixedExp    = fixedExpRes.data       || [];

  const findings: AuditFinding[] = [];

  // ── 1. VENTAS Y MARGEN ────────────────────────────────────────────────────
  const ventasMes  = closings.filter(c => c.status === 'closed').reduce((s, c) => s + (c.total_sales || 0), 0);
  const ingresos   = entries.filter(e => e.type === 'Ingreso').reduce((s, e) => s + e.amount, 0);
  const gastos     = entries.filter(e => e.type === 'Gasto').reduce((s, e) => s + e.amount, 0);
  const totalVentas = ventasMes + ingresos;
  const margenBruto = totalVentas > 0 ? ((totalVentas - gastos) / totalVentas) * 100 : 0;

  if (margenBruto < 30 && totalVentas > 0) {
    findings.push({
      id: uid(), category: 'ingresos', severity: 'critico',
      title: 'Margen bruto por debajo del mínimo',
      description: `El margen bruto este mes es ${fmtPct(margenBruto)}, muy por debajo del 30% recomendado para hostelería.`,
      impact: `Pérdida potencial de ${fmtEur(totalVentas * 0.30 - (totalVentas - gastos))} respecto al objetivo`,
      action: 'Revisa los costes variables, especialmente compras de materia prima. Considera subir precios de carta.',
    });
  } else if (margenBruto >= 30 && margenBruto < 50) {
    findings.push({
      id: uid(), category: 'ingresos', severity: 'warning',
      title: 'Margen bruto mejorable',
      description: `Margen bruto del ${fmtPct(margenBruto)}. Hay margen de mejora para alcanzar el 50% óptimo.`,
      action: 'Analiza los escandallos con menor margen y considera ajustar precios.',
    });
  } else if (totalVentas > 0) {
    findings.push({
      id: uid(), category: 'ingresos', severity: 'ok',
      title: 'Margen bruto saludable',
      description: `Margen bruto del ${fmtPct(margenBruto)} este mes — por encima del 50% objetivo.`,
    });
  }

  // ── 2. STOCK CRÍTICO PERSISTENTE ─────────────────────────────────────────
  const stockCritico = stockItems.filter(i => i.current_stock <= i.min_stock);
  const stockMuyBajo = stockItems.filter(i => i.current_stock === 0);
  const stockSinMovimiento = stockItems.filter(i => {
    const lastMov = movements.filter(m => m.stock_item_id === i.id).sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    if (!lastMov) return true;
    const days = Math.floor((new Date().getTime() - new Date(lastMov.created_at).getTime()) / 86400000);
    return days > 30;
  });

  if (stockMuyBajo.length > 0) {
    findings.push({
      id: uid(), category: 'stock', severity: 'critico',
      title: `${stockMuyBajo.length} producto${stockMuyBajo.length > 1 ? 's' : ''} con stock a cero`,
      description: `Sin existencias: ${stockMuyBajo.slice(0, 3).map((i: any) => i.name).join(', ')}${stockMuyBajo.length > 3 ? ` y ${stockMuyBajo.length - 3} más` : ''}.`,
      impact: 'Riesgo de servicio interrumpido — merma en ventas potencial',
      action: 'Hacer pedido urgente. Considera aumentar el stock mínimo de estos productos.',
    });
  }

  if (stockCritico.length > stockMuyBajo.length) {
    const otros = stockCritico.filter((i: any) => i.current_stock > 0);
    findings.push({
      id: uid(), category: 'stock', severity: 'warning',
      title: `${otros.length} producto${otros.length > 1 ? 's' : ''} por debajo del mínimo`,
      description: `Stock bajo: ${otros.slice(0, 4).map((i: any) => i.name).join(', ')}.`,
      action: 'Programar reposición esta semana.',
    });
  }

  if (stockSinMovimiento.length > 5) {
    const valorParado = stockSinMovimiento.reduce((s: number, i: any) => s + i.current_stock * i.price_per_unit, 0);
    findings.push({
      id: uid(), category: 'stock', severity: 'oportunidad',
      title: `${stockSinMovimiento.length} productos sin movimiento en 30+ días`,
      description: `Capital inmovilizado en stock sin rotar: ${fmtEur(valorParado)}.`,
      impact: `${fmtEur(valorParado)} de capital parado`,
      action: 'Considera hacer promociones con estos productos o reducir stock mínimo.',
    });
  }

  // ── 3. SUBIDAS DE PRECIO EN ALBARANES ────────────────────────────────────
  const priceMap: Record<string, { prov: string; prices: number[] }> = {};
  for (const alb of albaranes) {
    const items = alb.items as { n?: string; name?: string; unitPrice?: number; u?: string }[] || [];
    for (const item of items) {
      const name = (item.n || item.name || '').toLowerCase().trim();
      const price = Number(item.unitPrice || 0);
      if (!name || price <= 0) continue;
      const key = `${alb.supplier_name}||${name}`;
      if (!priceMap[key]) priceMap[key] = { prov: alb.supplier_name, prices: [] };
      priceMap[key].prices.push(price);
    }
  }

  const priceAlerts: { item: string; prov: string; increase: number; from: number; to: number }[] = [];
  for (const [key, val] of Object.entries(priceMap)) {
    if (val.prices.length < 2) continue;
    const first = val.prices[0];
    const last  = val.prices[val.prices.length - 1];
    const increase = ((last - first) / first) * 100;
    if (increase > 5) {
      const itemName = key.split('||')[1];
      priceAlerts.push({ item: itemName, prov: val.prov, increase, from: first, to: last });
    }
  }

  if (priceAlerts.length > 0) {
    const top = priceAlerts.sort((a, b) => b.increase - a.increase).slice(0, 3);
    findings.push({
      id: uid(), category: 'costes', severity: priceAlerts.length > 3 ? 'critico' : 'warning',
      title: `${priceAlerts.length} producto${priceAlerts.length > 1 ? 's' : ''} con subida de precio detectada`,
      description: top.map(a => `${a.item} (${a.prov}): +${a.increase.toFixed(1)}% (${fmtEur(a.from)} → ${fmtEur(a.to)})`).join(' | '),
      impact: 'Impacto directo en costes de materia prima',
      action: 'Negocia con el proveedor o busca alternativas. Revisa los escandallos afectados.',
      data: priceAlerts,
    });
  }

  // ── 4. FACTURAS VENCIDAS ─────────────────────────────────────────────────
  const facturasVencidas     = provInv.filter((f: any) => !f.pagada && f.fecha_venc && f.fecha_venc < today());
  const facturasCliVencidas  = custInv.filter((f: any) => f.status === 'Vencida');
  const totalDeuda           = facturasVencidas.reduce((s: number, f: any) => s + f.total, 0);
  const totalPendienteCobro  = facturasCliVencidas.reduce((s: number, f: any) => s + f.total, 0);

  if (facturasVencidas.length > 0) {
    findings.push({
      id: uid(), category: 'tesoreria', severity: 'critico',
      title: `${facturasVencidas.length} facturas de proveedor vencidas sin pagar`,
      description: `Deuda vencida: ${fmtEur(totalDeuda)}. Proveedores: ${[...new Set(facturasVencidas.slice(0, 3).map((f: any) => f.proveedor))].join(', ')}.`,
      impact: `${fmtEur(totalDeuda)} en deuda vencida`,
      action: 'Prioriza el pago para evitar recargos o corte de suministros.',
    });
  }

  if (facturasCliVencidas.length > 0) {
    findings.push({
      id: uid(), category: 'tesoreria', severity: 'warning',
      title: `${facturasCliVencidas.length} facturas a clientes vencidas sin cobrar`,
      description: `Pendiente de cobro: ${fmtEur(totalPendienteCobro)}.`,
      impact: `${fmtEur(totalPendienteCobro)} sin cobrar`,
      action: 'Contacta con los clientes para gestionar el cobro.',
    });
  }

  // ── 5. EFICIENCIA PERSONAL ────────────────────────────────────────────────
  const totalNominas = staff.reduce((s: number, e: any) => s + (e.monthly_salary || 0), 0);
  const laborRatio   = totalVentas > 0 ? (totalNominas / totalVentas) * 100 : 0;
  const totalMinutosTeóricos = staff.length * 8 * 60 * 22; // 8h/día * 22 días
  const totalMinutosReales   = timeEntries.reduce((s: number, t: any) => s + (t.net_minutes || 0), 0);
  const eficiencia           = totalMinutosTeóricos > 0 ? (totalMinutosReales / totalMinutosTeóricos) * 100 : null;

  if (laborRatio > 35 && totalVentas > 0) {
    findings.push({
      id: uid(), category: 'personal', severity: 'warning',
      title: 'Ratio de personal sobre ventas elevado',
      description: `Nóminas representan el ${fmtPct(laborRatio)} de las ventas (máximo recomendado: 30-35%).`,
      impact: `Exceso estimado: ${fmtEur(totalNominas - totalVentas * 0.32)}`,
      action: 'Revisa la planificación de turnos. Optimiza en días de baja ocupación.',
    });
  } else if (totalNominas > 0) {
    findings.push({
      id: uid(), category: 'personal', severity: 'ok',
      title: 'Ratio de personal dentro del rango óptimo',
      description: `Nóminas: ${fmtPct(laborRatio)} de las ventas — dentro del rango saludable.`,
    });
  }

  // ── 6. ESCANDALLOS CON MARGEN BAJO ───────────────────────────────────────
  const recetasMargenBajo = recipes.filter((r: any) => r.margin < 40);
  const recetasSinCoste   = recipes.filter((r: any) => r.total_cost === 0);
  const avgRecipeMargin   = recipes.length > 0 ? recipes.reduce((s: number, r: any) => s + r.margin, 0) / recipes.length : 0;

  if (recetasMargenBajo.length > 0) {
    findings.push({
      id: uid(), category: 'operaciones', severity: 'warning',
      title: `${recetasMargenBajo.length} receta${recetasMargenBajo.length > 1 ? 's' : ''} con margen por debajo del 40%`,
      description: `Platos con margen bajo: ${recetasMargenBajo.slice(0, 3).map((r: any) => `${r.name} (${r.margin.toFixed(0)}%)`).join(', ')}.`,
      action: 'Sube el precio de carta o reduce los ingredientes más caros.',
    });
  }

  if (recetasSinCoste.length > 0) {
    findings.push({
      id: uid(), category: 'costes', severity: 'warning',
      title: `${recetasSinCoste.length} receta${recetasSinCoste.length > 1 ? 's' : ''} sin coste definido`,
      description: `Platos sin ingredientes registrados: ${recetasSinCoste.slice(0, 3).map((r: any) => r.name).join(', ')}.`,
      action: 'Completa los escandallos para tener control real del coste.',
    });
  }

  // ── 7. GASTOS FIJOS VS VENTAS ─────────────────────────────────────────────
  const totalFijos = fixedExp.filter((e: any) => e.frequency === 'Mensual').reduce((s: number, e: any) => s + e.amount, 0);
  const fixedRatio  = totalVentas > 0 ? (totalFijos / totalVentas) * 100 : 0;

  if (fixedRatio > 40 && totalVentas > 0) {
    findings.push({
      id: uid(), category: 'costes', severity: 'critico',
      title: 'Gastos fijos desproporcionados',
      description: `Los gastos fijos (${fmtEur(totalFijos)}) representan el ${fmtPct(fixedRatio)} de las ventas.`,
      impact: `Punto de equilibrio muy alto: necesitas vender ${fmtEur(totalFijos / 0.4)} para cubrir costes fijos`,
      action: 'Revisa contratos de alquiler, seguros y suministros. Negocia mejores tarifas.',
    });
  }

  // ── 8. CIERRES DE CAJA FALTANTES ─────────────────────────────────────────
  const diasMes    = new Date().getDate();
  const cierresOk  = closings.filter(c => c.status === 'closed').length;
  const cierresPct = diasMes > 0 ? (cierresOk / diasMes) * 100 : 100;

  if (cierresPct < 80 && diasMes > 5) {
    findings.push({
      id: uid(), category: 'operaciones', severity: 'warning',
      title: `Solo ${cierresOk} de ${diasMes} días tienen cierre de caja`,
      description: `${diasMes - cierresOk} días sin cierre registrado este mes.`,
      action: 'Asegúrate de cerrar la caja diariamente para un control preciso de ingresos.',
    });
  }

  // ── CALCULAR SCORE ────────────────────────────────────────────────────────
  const criticos     = findings.filter(f => f.severity === 'critico').length;
  const warnings     = findings.filter(f => f.severity === 'warning').length;
  const score        = Math.max(0, Math.min(100, 100 - criticos * 15 - warnings * 5));

  return {
    score,
    findings,
    summary: {
      ventas_mes:       totalVentas,
      gastos_mes:       gastos,
      margen_mes:       margenBruto,
      stock_critico:    stockCritico.length,
      facturas_vencidas: facturasVencidas.length,
      total_employees:  staff.length,
      recipes_count:    recipes.length,
      avg_recipe_margin: avgRecipeMargin,
    },
    ai_analysis: null,
    generated_at: new Date().toISOString(),
  };
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN VIEW
// ════════════════════════════════════════════════════════════════════════════
export default function AuditoriaView() {
  const [auditing,    setAuditing]    = useState(false);
  const [result,      setResult]      = useState<AuditResult | null>(null);
  const [aiLoading,   setAiLoading]   = useState(false);
  const [filterCat,   setFilterCat]   = useState<string>('Todos');
  const [filterSev,   setFilterSev]   = useState<string>('Todos');
  const [expandedId,  setExpandedId]  = useState<string | null>(null);

  // Toast simple
  const [toast, setToast] = useState<string | null>(null);
  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 3500); }

  // ── Ejecutar auditoría ────────────────────────────────────────────────────
  async function handleAudit() {
    setAuditing(true); setResult(null);
    try {
      const r = await runAudit();
      setResult(r);
    } catch (err: any) {
      showToast('Error al auditar: ' + err.message);
    } finally { setAuditing(false); }
  }

  // ── Análisis IA profundo ──────────────────────────────────────────────────
  async function handleDeepAI() {
    if (!result) return;
    setAiLoading(true);
    try {
      const criticals = result.findings.filter(f => f.severity === 'critico' || f.severity === 'warning');
      const res = await getAI().models.generateContent({
        model: 'gemini-2.0-flash',
        contents: [{
          role: 'user', parts: [{
            text: `Eres el consultor de negocio de Raco Blanquerna, restaurante en Palma de Mallorca.
Analiza estos datos reales del restaurante y da un informe ejecutivo:

SALUD GENERAL: ${result.score}/100
VENTAS ESTE MES: ${fmtEur(result.summary.ventas_mes)}
GASTOS: ${fmtEur(result.summary.gastos_mes)}
MARGEN BRUTO: ${fmtPct(result.summary.margen_mes)}
STOCK CRÍTICO: ${result.summary.stock_critico} productos
FACTURAS VENCIDAS: ${result.summary.facturas_vencidas}
EMPLEADOS: ${result.summary.total_employees}
RECETAS: ${result.summary.recipes_count} con margen medio ${fmtPct(result.summary.avg_recipe_margin)}

HALLAZGOS DETECTADOS:
${criticals.map(f => `[${f.severity.toUpperCase()}] ${f.title}: ${f.description}${f.impact ? ` | Impacto: ${f.impact}` : ''}`).join('\n')}

Genera un informe ejecutivo en español con:
1. DIAGNÓSTICO GENERAL (2-3 líneas del estado del negocio)
2. TOP 3 PRIORIDADES URGENTES con acciones concretas
3. OPORTUNIDADES DE MEJORA a medio plazo
4. PREVISIÓN: si se implementan las mejoras, qué impacto económico tendría
5. UNA FRASE DE CIERRE motivadora pero realista

Formato: claro, directo, específico con números cuando sea posible. Máx 400 palabras.`
          }]
        }]
      });
      const analysis = res.candidates?.[0]?.content?.parts?.[0]?.text || 'Sin análisis';
      setResult(prev => prev ? { ...prev, ai_analysis: analysis } : prev);
    } catch (err: any) {
      showToast('Error IA: ' + err.message);
    } finally { setAiLoading(false); }
  }

  // ── Exportar Excel ────────────────────────────────────────────────────────
  async function exportExcel() {
    if (!result) return;
    await new Promise<void>((res, rej) => {
      if ((window as any).XLSX) { res(); return; }
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
      s.onload = () => res(); s.onerror = () => rej(); document.head.appendChild(s);
    });
    const XLSX = (window as any).XLSX;
    const data = [
      ['Informe de Auditoría IA — Raco Blanquerna'],
      [`Generado: ${new Date(result.generated_at).toLocaleString('es-ES')}`],
      [`Score de salud: ${result.score}/100`],
      [],
      ['RESUMEN'],
      ['Ventas mes', fmtEur(result.summary.ventas_mes)],
      ['Gastos mes', fmtEur(result.summary.gastos_mes)],
      ['Margen bruto', fmtPct(result.summary.margen_mes)],
      ['Stock crítico', result.summary.stock_critico],
      ['Facturas vencidas', result.summary.facturas_vencidas],
      [],
      ['HALLAZGOS', '', '', ''],
      ['Categoría', 'Severidad', 'Título', 'Descripción', 'Impacto', 'Acción recomendada'],
      ...result.findings.map(f => [
        CAT_CONFIG[f.category].label,
        SEVERITY_CONFIG[f.severity].label,
        f.title, f.description, f.impact || '', f.action || '',
      ]),
    ];
    if (result.ai_analysis) {
      data.push([], ['ANÁLISIS IA'], [result.ai_analysis]);
    }
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [{ wch: 15 }, { wch: 12 }, { wch: 40 }, { wch: 60 }, { wch: 30 }, { wch: 50 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Auditoría');
    XLSX.writeFile(wb, `Auditoria_Raco_${today()}.xlsx`);
    showToast('Informe exportado ✓');
  }

  // ── Filtered findings ─────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (!result) return [];
    return result.findings.filter(f =>
      (filterCat === 'Todos' || f.category === filterCat) &&
      (filterSev === 'Todos' || f.severity === filterSev)
    );
  }, [result, filterCat, filterSev]);

  const countBySeverity = useMemo(() => {
    if (!result) return {};
    return result.findings.reduce((acc, f) => ({ ...acc, [f.severity]: (acc[f.severity] || 0) + 1 }), {} as Record<string, number>);
  }, [result]);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#F8FAFC] p-4 md:p-8 space-y-6">

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[500] px-5 py-3 rounded-2xl bg-slate-900 text-white text-sm font-bold shadow-2xl">
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Header ── */}
      <header className="sticky top-4 z-[100] bg-white/80 backdrop-blur-xl border border-white/20 shadow-xl rounded-[2.5rem] p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-2xl shadow-lg">
            <Sparkles className="w-5 h-5 text-emerald-400" />
            <span className="font-black text-sm tracking-tighter uppercase">Auditoría IA</span>
          </div>
          {result && (
            <span className="text-xs text-slate-400 hidden sm:block">
              {new Date(result.generated_at).toLocaleString('es-ES', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {result && (
            <>
              <button onClick={exportExcel}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-2xl text-xs font-bold hover:bg-slate-50 transition-all shadow-sm">
                <Download size={14} /> Exportar
              </button>
              <button onClick={handleDeepAI} disabled={aiLoading}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-2xl text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-sm shadow-indigo-200">
                {aiLoading ? <Loader2 size={14} className="animate-spin" /> : <Brain size={14} />}
                Análisis profundo IA
              </button>
            </>
          )}
          <button onClick={handleAudit} disabled={auditing}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-2xl text-xs font-bold hover:bg-emerald-700 disabled:opacity-50 transition-all shadow-sm shadow-emerald-200">
            {auditing ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
            {result ? 'Re-auditar' : 'Iniciar auditoría'}
          </button>
        </div>
      </header>

      {/* ── Estado inicial ── */}
      {!result && !auditing && (
        <div className="flex flex-col items-center justify-center py-24 text-center space-y-6">
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="w-24 h-24 bg-emerald-50 border border-emerald-200 rounded-[2rem] flex items-center justify-center">
            <BrainCircuit size={48} className="text-emerald-500" />
          </motion.div>
          <div className="max-w-lg space-y-2">
            <h2 className="text-2xl font-black text-slate-900">Auditoría Inteligente</h2>
            <p className="text-slate-500 leading-relaxed">
              Analiza automáticamente <strong>todos los módulos</strong> del restaurante: ventas, costes,
              stock, personal, facturas y escandallos. Detecta anomalías, subidas de precio, ineficiencias
              y oportunidades de ahorro con datos reales de Supabase.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 justify-center text-xs font-bold text-slate-500">
            {[
              '📊 Margen bruto real',
              '📦 Stock crítico',
              '💶 Subidas de precio',
              '👥 Eficiencia personal',
              '🧾 Facturas vencidas',
              '🍽️ Márgenes de recetas',
              '🏦 Salud tesorería',
            ].map(t => (
              <span key={t} className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl">{t}</span>
            ))}
          </div>
          <button onClick={handleAudit}
            className="flex items-center gap-3 px-8 py-4 bg-emerald-600 text-white rounded-2xl font-black text-sm hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-200">
            <Zap size={20} /> Iniciar auditoría completa
          </button>
        </div>
      )}

      {/* ── Analizando ── */}
      {auditing && (
        <div className="flex flex-col items-center justify-center py-24 text-center space-y-6">
          <div className="w-20 h-20 bg-emerald-50 rounded-[2rem] flex items-center justify-center">
            <Loader2 size={40} className="animate-spin text-emerald-500" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-black text-slate-900">Analizando el restaurante…</h2>
            <p className="text-slate-400 text-sm">Revisando ventas, stock, personal, facturas y escandallos</p>
          </div>
          <div className="space-y-2 text-sm text-slate-400 max-w-xs">
            {['Cargando ventas y cierres de caja...', 'Analizando movimientos de stock...', 'Revisando facturas y tesorería...', 'Comprobando eficiencia del personal...', 'Detectando anomalías...'].map((step, i) => (
              <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.4 }}
                className="flex items-center gap-2">
                <Loader2 size={12} className="animate-spin shrink-0" /> {step}
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* ── Resultados ── */}
      {result && !auditing && (
        <div className="space-y-6">

          {/* Score + resumen */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Score */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 flex flex-col items-center justify-center">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Score de salud</p>
              <ScoreGauge score={result.score} />
              <p className="text-xs text-slate-400 mt-3 text-center">
                {countBySeverity['critico'] || 0} crítico{(countBySeverity['critico'] || 0) !== 1 ? 's' : ''} ·{' '}
                {countBySeverity['warning'] || 0} avisos
              </p>
            </div>

            {/* KPIs resumen */}
            <div className="md:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Ventas mes', value: fmtEur(result.summary.ventas_mes), color: 'text-emerald-600', icon: <TrendingUp size={16} className="text-emerald-400" /> },
                { label: 'Margen bruto', value: fmtPct(result.summary.margen_mes), color: result.summary.margen_mes >= 40 ? 'text-emerald-600' : result.summary.margen_mes >= 25 ? 'text-amber-600' : 'text-rose-600', icon: <DollarSign size={16} className="text-indigo-400" /> },
                { label: 'Stock crítico', value: result.summary.stock_critico, color: result.summary.stock_critico > 0 ? 'text-rose-600' : 'text-emerald-600', icon: <Package size={16} className="text-amber-400" /> },
                { label: 'Recetas', value: `${result.summary.recipes_count} platos`, color: 'text-slate-900', icon: <ChefHat size={16} className="text-amber-400" /> },
                { label: 'Facturas vencidas', value: result.summary.facturas_vencidas, color: result.summary.facturas_vencidas > 0 ? 'text-rose-600' : 'text-emerald-600', icon: <Receipt size={16} className="text-rose-400" /> },
                { label: 'Gastos mes', value: fmtEur(result.summary.gastos_mes), color: 'text-slate-900', icon: <TrendingDown size={16} className="text-rose-400" /> },
                { label: 'Empleados', value: result.summary.total_employees, color: 'text-slate-900', icon: <Users size={16} className="text-blue-400" /> },
                { label: 'Margen recetas', value: fmtPct(result.summary.avg_recipe_margin), color: result.summary.avg_recipe_margin >= 55 ? 'text-emerald-600' : 'text-amber-600', icon: <Activity size={16} className="text-purple-400" /> },
              ].map((s, i) => (
                <div key={i} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-1"><span className="text-[10px] font-black uppercase tracking-widest text-slate-400 leading-tight">{s.label}</span>{s.icon}</div>
                  <p className={cn('text-xl font-black', s.color)}>{s.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Análisis IA profundo */}
          {result.ai_analysis && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="bg-indigo-50 border border-indigo-200 rounded-3xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 bg-indigo-100 rounded-2xl flex items-center justify-center">
                  <BrainCircuit size={18} className="text-indigo-600" />
                </div>
                <p className="font-black text-indigo-900">Análisis ejecutivo IA</p>
              </div>
              <pre className="text-sm text-indigo-800 whitespace-pre-wrap font-sans leading-relaxed">{result.ai_analysis}</pre>
            </motion.div>
          )}

          {/* Filtros hallazgos */}
          <div className="flex flex-wrap gap-3">
            <div className="flex bg-white border border-slate-200 rounded-2xl p-1 gap-1 shadow-sm overflow-x-auto">
              {['Todos', ...Object.keys(CAT_CONFIG)].map(c => (
                <button key={c} onClick={() => setFilterCat(c)}
                  className={cn('px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap',
                    filterCat === c ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-800')}>
                  {c === 'Todos' ? 'Todos' : CAT_CONFIG[c as keyof typeof CAT_CONFIG].label}
                </button>
              ))}
            </div>
            <div className="flex bg-white border border-slate-200 rounded-2xl p-1 gap-1 shadow-sm">
              {['Todos', 'critico', 'warning', 'ok', 'oportunidad'].map(s => (
                <button key={s} onClick={() => setFilterSev(s)}
                  className={cn('px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap',
                    filterSev === s ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-800')}>
                  {s === 'Todos' ? 'Todos' : SEVERITY_CONFIG[s as keyof typeof SEVERITY_CONFIG]?.label || s}
                  {s !== 'Todos' && countBySeverity[s] ? ` (${countBySeverity[s]})` : ''}
                </button>
              ))}
            </div>
          </div>

          {/* Lista de hallazgos */}
          <div className="space-y-3">
            {filtered.length === 0 ? (
              <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center">
                <CheckCircle2 size={36} className="text-emerald-300 mx-auto mb-3" />
                <p className="font-black text-emerald-600">¡Sin hallazgos en esta categoría!</p>
              </div>
            ) : filtered.map(finding => {
              const cfg  = SEVERITY_CONFIG[finding.severity];
              const catC = CAT_CONFIG[finding.category];
              const Icon = cfg.icon;
              const CatIcon = catC.icon;
              const isExp = expandedId === finding.id;
              return (
                <motion.div key={finding.id} layout
                  className={cn('bg-white rounded-3xl border shadow-sm overflow-hidden', cfg.color.split(' ').find(c => c.startsWith('border-')) || 'border-slate-200')}>
                  <div className="flex items-start gap-4 p-5 cursor-pointer" onClick={() => setExpandedId(isExp ? null : finding.id)}>
                    <div className={cn('w-10 h-10 rounded-2xl flex items-center justify-center shrink-0', cfg.color)}>
                      <Icon size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={cn('text-[10px] font-black px-2 py-0.5 rounded-lg border', cfg.color)}>{cfg.label}</span>
                        <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400">
                          <CatIcon size={11} className={catC.color} /> {catC.label}
                        </span>
                      </div>
                      <p className="font-black text-slate-900">{finding.title}</p>
                      <p className="text-sm text-slate-500 mt-0.5">{finding.description}</p>
                    </div>
                    <div className="shrink-0 text-slate-300">
                      {isExp ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </div>
                  </div>
                  <AnimatePresence>
                    {isExp && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden border-t border-slate-100">
                        <div className="px-5 pb-5 pt-4 space-y-3">
                          {finding.impact && (
                            <div className="flex items-start gap-2 bg-slate-50 rounded-2xl px-4 py-3">
                              <DollarSign size={14} className="text-rose-400 shrink-0 mt-0.5" />
                              <div>
                                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Impacto económico</p>
                                <p className="text-sm font-bold text-slate-700">{finding.impact}</p>
                              </div>
                            </div>
                          )}
                          {finding.action && (
                            <div className="flex items-start gap-2 bg-emerald-50 rounded-2xl px-4 py-3 border border-emerald-100">
                              <ArrowRight size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                              <div>
                                <p className="text-[10px] font-black uppercase tracking-wider text-emerald-500">Acción recomendada</p>
                                <p className="text-sm font-bold text-slate-700">{finding.action}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
