// src/views/Escandallos.tsx
// ✅ 100% Supabase — sin Firebase, sin datos hardcoded
// ✅ Coste real por ingrediente con merma incluida (recipe_cost_summary view)
// ✅ Vinculación con stock_items para precio en tiempo real
// ✅ Foto/cámara → IA extrae ingredientes automáticamente
// ✅ Dictado de receta por voz
// ✅ Análisis IA: rentabilidad, platos estrella, recomendaciones carta
// ✅ Panel detalle con desglose ingrediente por ingrediente
// ✅ Toast notifications, Gen Z UX
import React, {
  useState, useEffect, useRef, useCallback, useMemo
} from 'react';
import {
  ChefHat, Plus, Mic, MicOff, Camera, Loader2, X, Check,
  AlertTriangle, CheckCircle2, Trash2, Search, Brain,
  TrendingUp, TrendingDown, Edit2, Package, Star,
  ChevronDown, ChevronUp, Flame, Zap, BarChart3, RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../supabase';
import { useSupabase } from '../context/SupabaseContext';
import { GoogleGenAI } from '@google/genai';
import { cn } from '../lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Recipe {
  id: string;
  name: string;
  category: string;
  servings: number;
  labor_cost: number;
  margin: number;
  instructions?: string;
  photo_url?: string;
  active: boolean;
}

interface RecipeIngredient {
  id: string;
  recipe_id: string;
  name: string;
  quantity: number;
  unit: string;
  waste_percentage: number;
  price_per_unit: number;
  stock_item_id?: string;
}

interface RecipeCost {
  id: string;
  name: string;
  category: string;
  servings: number;
  margin: number;
  labor_cost: number;
  ingredient_cost: number;
  total_cost: number;
  suggested_price: number;
}

interface StockItem {
  id: string;
  name: string;
  unit: string;
  price_per_unit: number;
  category: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const CATEGORIES = ['Entrante', 'Plato principal', 'Postre', 'Bebida', 'Cocktail', 'Otro'];
const UNITS = ['kg', 'g', 'l', 'ml', 'ud', 'caja', 'bot', 'lata', 'dosis'];

const CAT_COLOR: Record<string, string> = {
  'Entrante':        'bg-amber-50 text-amber-700 border-amber-200',
  'Plato principal': 'bg-indigo-50 text-indigo-700 border-indigo-200',
  'Postre':          'bg-pink-50 text-pink-700 border-pink-200',
  'Bebida':          'bg-blue-50 text-blue-700 border-blue-200',
  'Cocktail':        'bg-purple-50 text-purple-700 border-purple-200',
  'Otro':            'bg-slate-50 text-slate-600 border-slate-200',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const aiRef = { current: null as GoogleGenAI | null };
function getAI() {
  if (!aiRef.current)
    aiRef.current = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || '' });
  return aiRef.current;
}
function uid() { return Math.random().toString(36).slice(2, 10); }
function fmtEur(n: number) {
  return n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
}
function fmtPct(n: number) { return `${n.toFixed(1)}%`; }

// Clasificación ingeniería de menú
function classify(margin: number, avgMargin: number): { label: string; color: string; icon: React.ReactNode } {
  const highMargin  = margin >= avgMargin;
  // Sin popularidad real usamos el margen como proxy único
  if (highMargin && margin >= 60) return { label: 'Estrella ⭐', color: 'text-emerald-600 bg-emerald-50', icon: <Star size={12} /> };
  if (highMargin)                  return { label: 'Vaca 🐄',    color: 'text-blue-600 bg-blue-50',      icon: <TrendingUp size={12} /> };
  if (!highMargin && margin >= 40) return { label: 'Puzzle 🧩',  color: 'text-amber-600 bg-amber-50',    icon: <Zap size={12} /> };
  return                                  { label: 'Perro 🐕',   color: 'text-rose-600 bg-rose-50',      icon: <TrendingDown size={12} /> };
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
            className={cn(
              'px-5 py-3 rounded-2xl text-sm font-bold shadow-2xl flex items-center gap-2',
              t.type === 'ok' ? 'bg-slate-900 text-white'
              : t.type === 'warn' ? 'bg-amber-500 text-white' : 'bg-rose-500 text-white'
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
function VoiceButton({
  onResult, small, className = '',
}: { onResult: (t: string) => void; small?: boolean; className?: string }) {
  const [on, setOn] = useState(false);
  const ref = useRef<SpeechRecognition | null>(null);
  const sz = small ? 14 : 16;
  const toggle = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert('Necesitas Chrome para el microfono'); return; }
    if (on) { ref.current?.stop(); setOn(false); return; }
    const r = new SR(); ref.current = r;
    r.lang = 'es-ES'; r.continuous = false; r.interimResults = false;
    r.onstart  = () => setOn(true);
    r.onresult = (e: SpeechRecognitionEvent) => onResult(e.results[0][0].transcript);
    r.onerror  = r.onend = () => setOn(false);
    r.start();
  };
  return (
    <button type="button" onClick={toggle}
      className={cn(
        `${small ? 'p-1.5' : 'p-2.5'} rounded-xl transition-all shrink-0`,
        on ? 'bg-rose-500 text-white animate-pulse shadow-lg shadow-rose-200'
           : 'bg-slate-100 text-slate-500 hover:bg-slate-200',
        className
      )} title={on ? 'Parar' : 'Dictar'}>
      {on ? <MicOff size={sz} /> : <Mic size={sz} />}
    </button>
  );
}

function VoiceField({
  value, onChange, placeholder, type = 'text',
}: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
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

// ─── Recipe Card ──────────────────────────────────────────────────────────────
function RecipeCard({
  recipe, cost, avgMargin, ingredients, expanded,
  onToggle, onEdit, onDelete,
}: {
  recipe: Recipe;
  cost?: RecipeCost;
  avgMargin: number;
  ingredients: RecipeIngredient[];
  expanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const cls = cost ? classify(cost.margin, avgMargin) : null;
  const totalIngCost = ingredients.reduce(
    (s, i) => s + i.quantity * i.price_per_unit * (1 + i.waste_percentage / 100), 0
  );

  return (
    <motion.div layout
      className="bg-white rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all overflow-hidden">

      {/* Header row */}
      <div className="flex items-center gap-4 p-5 cursor-pointer" onClick={onToggle}>
        <div className="w-12 h-12 bg-gradient-to-br from-indigo-50 to-slate-100 rounded-2xl
                        flex items-center justify-center text-2xl shrink-0">
          {recipe.category === 'Entrante' ? '🥗'
           : recipe.category === 'Plato principal' ? '🍽️'
           : recipe.category === 'Postre' ? '🍮'
           : recipe.category === 'Bebida' ? '🥤'
           : recipe.category === 'Cocktail' ? '🍹' : '🔧'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-black text-slate-900 truncate">{recipe.name}</h3>
            <span className={cn('text-[10px] font-black px-2 py-0.5 rounded-lg border',
              CAT_COLOR[recipe.category] || CAT_COLOR['Otro'])}>
              {recipe.category}
            </span>
            {cls && (
              <span className={cn('text-[10px] font-black px-2 py-0.5 rounded-lg', cls.color)}>
                {cls.label}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            {recipe.servings} ración{recipe.servings > 1 ? 'es' : ''} · {ingredients.length} ingrediente{ingredients.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="text-right shrink-0 hidden sm:block">
          {cost ? (
            <>
              <p className="font-black text-slate-900">{fmtEur(cost.total_cost)}</p>
              <p className="text-xs text-emerald-600 font-bold">→ {fmtEur(cost.suggested_price)}</p>
            </>
          ) : (
            <p className="text-xs text-slate-400">Sin coste</p>
          )}
        </div>
        <div className="text-slate-300 shrink-0">
          {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </div>
      </div>

      {/* Expanded detail */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden">
            <div className="border-t border-slate-100 px-5 pb-5 pt-4 space-y-4">

              {/* KPIs del plato */}
              {cost && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'Coste ingredientes', value: fmtEur(cost.ingredient_cost), color: 'text-slate-900' },
                    { label: 'Coste mano de obra', value: fmtEur(cost.labor_cost),      color: 'text-slate-900' },
                    { label: 'Coste total',         value: fmtEur(cost.total_cost),     color: 'text-rose-600'  },
                    { label: `Precio sugerido (${cost.margin}% margen)`, value: fmtEur(cost.suggested_price), color: 'text-emerald-600' },
                  ].map(s => (
                    <div key={s.label} className="bg-slate-50 rounded-2xl px-4 py-3">
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{s.label}</p>
                      <p className={cn('text-lg font-black mt-0.5', s.color)}>{s.value}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Barra de margen */}
              {cost && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-bold text-slate-500">
                    <span>Margen objetivo: {fmtPct(cost.margin)}</span>
                    <span className={cost.margin >= avgMargin ? 'text-emerald-600' : 'text-amber-600'}>
                      {cost.margin >= avgMargin ? 'Por encima de la media' : 'Por debajo de la media'}
                    </span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all duration-700',
                        cost.margin >= 60 ? 'bg-emerald-400' : cost.margin >= 40 ? 'bg-amber-400' : 'bg-rose-400'
                      )}
                      style={{ width: `${Math.min(cost.margin, 100)}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Ingredientes detallados */}
              {ingredients.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Ingredientes y coste unitario</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                          <th className="text-left pb-2">Ingrediente</th>
                          <th className="text-right pb-2">Cant.</th>
                          <th className="text-right pb-2">Precio/u</th>
                          <th className="text-right pb-2">Merma</th>
                          <th className="text-right pb-2">Coste</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {ingredients.map(ing => {
                          const costeLinea = ing.quantity * ing.price_per_unit * (1 + ing.waste_percentage / 100);
                          const pct = totalIngCost > 0 ? (costeLinea / totalIngCost) * 100 : 0;
                          return (
                            <tr key={ing.id}>
                              <td className="py-2 font-medium text-slate-700">
                                {ing.name}
                                {ing.stock_item_id && (
                                  <span className="ml-1 text-[10px] text-indigo-400 font-bold">↗ stock</span>
                                )}
                              </td>
                              <td className="py-2 text-right text-slate-500">{ing.quantity} {ing.unit}</td>
                              <td className="py-2 text-right text-slate-500">{fmtEur(ing.price_per_unit)}</td>
                              <td className="py-2 text-right">
                                {ing.waste_percentage > 0
                                  ? <span className="text-amber-600 font-bold text-xs">{ing.waste_percentage}%</span>
                                  : <span className="text-slate-300 text-xs">—</span>
                                }
                              </td>
                              <td className="py-2 text-right font-bold text-slate-800">
                                <div>{fmtEur(costeLinea)}</div>
                                <div className="text-[10px] text-slate-400 font-medium">{fmtPct(pct)}</div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-slate-200">
                          <td colSpan={4} className="pt-2 text-xs font-black text-slate-500">Total ingredientes</td>
                          <td className="pt-2 text-right font-black text-slate-900">{fmtEur(totalIngCost)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              {/* Instrucciones */}
              {recipe.instructions && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Elaboración</p>
                  <p className="text-sm text-slate-600 bg-slate-50 rounded-2xl px-4 py-3 leading-relaxed">
                    {recipe.instructions}
                  </p>
                </div>
              )}

              {/* Acciones */}
              <div className="flex gap-2 pt-1">
                <button onClick={onEdit}
                  className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-200 transition-all">
                  <Edit2 size={12} /> Editar
                </button>
                <button onClick={onDelete}
                  className="flex items-center gap-1.5 px-4 py-2 bg-rose-50 text-rose-500 rounded-xl text-xs font-bold hover:bg-rose-100 transition-all">
                  <Trash2 size={12} /> Eliminar
                </button>
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
export default function EscandallosView() {
  const { employee } = useSupabase();
  const isAdmin = (employee as any)?.rol === 'admin';
  const { show: toast, ToastContainer } = useToast();

  const [recipes,     setRecipes]     = useState<Recipe[]>([]);
  const [costs,       setCosts]       = useState<RecipeCost[]>([]);
  const [ingMap,      setIngMap]      = useState<Record<string, RecipeIngredient[]>>({});
  const [stockItems,  setStockItems]  = useState<StockItem[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState('');
  const [catFilter,   setCatFilter]   = useState('Todos');
  const [activeTab,   setActiveTab]   = useState<'recetas' | 'analitica'>('recetas');
  const [expandedId,  setExpandedId]  = useState<string | null>(null);

  // IA
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult,  setAiResult]  = useState<string | null>(null);

  // Photo scan
  const [photoScan, setPhotoScan] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Formulario
  const [showForm, setShowForm]   = useState(false);
  const [editRecipe, setEditRecipe] = useState<Recipe | null>(null);
  const [saving, setSaving]       = useState(false);
  const [form, setForm]           = useState({
    name: '', category: 'Plato principal', servings: 1,
    labor_cost: 0, margin: 65, instructions: '',
  });
  const [ingredients, setIngredients] = useState<{
    id: string; name: string; quantity: number; unit: string;
    waste_percentage: number; price_per_unit: number; stock_item_id: string;
  }[]>([
    { id: uid(), name: '', quantity: 0, unit: 'kg', waste_percentage: 0, price_per_unit: 0, stock_item_id: '' },
  ]);

  // ── Load ──────────────────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    setLoading(true);
    const [rRes, cRes, iRes, sRes] = await Promise.all([
      supabase.from('recipes').select('*').eq('active', true).order('category').order('name'),
      supabase.from('recipe_cost_summary').select('*'),
      supabase.from('recipe_ingredients').select('*'),
      supabase.from('stock_items').select('id,name,unit,price_per_unit,category').eq('active', true).order('name'),
    ]);
    if (rRes.data) setRecipes(rRes.data as Recipe[]);
    if (cRes.data) setCosts(cRes.data as RecipeCost[]);
    if (iRes.data) {
      const map: Record<string, RecipeIngredient[]> = {};
      for (const ing of iRes.data as RecipeIngredient[]) {
        if (!map[ing.recipe_id]) map[ing.recipe_id] = [];
        map[ing.recipe_id].push(ing);
      }
      setIngMap(map);
    }
    if (sRes.data) setStockItems(sRes.data as StockItem[]);
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Stats ─────────────────────────────────────────────────────────────────
  const avgMargin  = costs.length > 0 ? costs.reduce((s, c) => s + c.margin, 0) / costs.length : 65;
  const avgCost    = costs.length > 0 ? costs.reduce((s, c) => s + c.total_cost, 0) / costs.length : 0;
  const bestMargin = costs.length > 0 ? [...costs].sort((a, b) => b.margin - a.margin)[0] : null;
  const worstMargin= costs.length > 0 ? [...costs].sort((a, b) => a.margin - b.margin)[0] : null;

  // ── Filtered ──────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return recipes.filter(r =>
      (catFilter === 'Todos' || r.category === catFilter) &&
      (!q || r.name.toLowerCase().includes(q))
    );
  }, [recipes, search, catFilter]);

  // ── Guardar receta ────────────────────────────────────────────────────────
  async function saveRecipe() {
    if (!form.name.trim()) { toast('El nombre es obligatorio', 'err'); return; }
    setSaving(true);
    try {
      let recipeId: string;

      if (editRecipe) {
        const { error } = await supabase.from('recipes').update({
          name: form.name.trim(), category: form.category,
          servings: form.servings, labor_cost: form.labor_cost,
          margin: form.margin, instructions: form.instructions || null,
        }).eq('id', editRecipe.id);
        if (error) throw error;
        recipeId = editRecipe.id;
        // Borrar ingredientes viejos y reemplazar
        await supabase.from('recipe_ingredients').delete().eq('recipe_id', recipeId);
        toast('Receta actualizada ✓');
      } else {
        const { data, error } = await supabase.from('recipes').insert({
          name: form.name.trim(), category: form.category,
          servings: form.servings, labor_cost: form.labor_cost,
          margin: form.margin, instructions: form.instructions || null, active: true,
        }).select().single();
        if (error) throw error;
        recipeId = (data as Recipe).id;
        toast('Receta creada ✓');
      }

      const validIngs = ingredients.filter(i => i.name.trim() && i.quantity > 0);
      if (validIngs.length > 0) {
        const { error: iErr } = await supabase.from('recipe_ingredients').insert(
          validIngs.map(i => ({
            recipe_id:       recipeId,
            name:            i.name.trim(),
            quantity:        i.quantity,
            unit:            i.unit,
            waste_percentage: i.waste_percentage,
            price_per_unit:  i.price_per_unit,
            stock_item_id:   i.stock_item_id || null,
          }))
        );
        if (iErr) throw iErr;
      }

      setShowForm(false); setEditRecipe(null);
      resetForm();
      await loadAll();
    } catch (err: any) {
      toast('Error: ' + err.message, 'err');
    } finally { setSaving(false); }
  }

  function resetForm() {
    setForm({ name: '', category: 'Plato principal', servings: 1, labor_cost: 0, margin: 65, instructions: '' });
    setIngredients([{ id: uid(), name: '', quantity: 0, unit: 'kg', waste_percentage: 0, price_per_unit: 0, stock_item_id: '' }]);
  }

  async function deleteRecipe(id: string) {
    if (!confirm('¿Eliminar esta receta? No se puede deshacer.')) return;
    const { error } = await supabase.from('recipes').update({ active: false }).eq('id', id);
    if (error) { toast('Error al eliminar', 'err'); return; }
    setRecipes(prev => prev.filter(r => r.id !== id));
    setExpandedId(null);
    toast('Receta eliminada');
  }

  // ── Ingrediente helpers ───────────────────────────────────────────────────
  function addIngredient() {
    setIngredients(prev => [...prev, { id: uid(), name: '', quantity: 0, unit: 'kg', waste_percentage: 0, price_per_unit: 0, stock_item_id: '' }]);
  }
  function updIngredient(id: string, ch: Partial<typeof ingredients[0]>) {
    setIngredients(prev => prev.map(i => i.id === id ? { ...i, ...ch } : i));
  }
  function delIngredient(id: string) {
    setIngredients(prev => prev.filter(i => i.id !== id));
  }

  // Al seleccionar un stock_item → llenar precio automáticamente
  function selectStockItem(ingId: string, stockId: string) {
    const item = stockItems.find(s => s.id === stockId);
    if (item) {
      updIngredient(ingId, {
        stock_item_id: stockId,
        name:          item.name,
        unit:          item.unit,
        price_per_unit: item.price_per_unit,
      });
    }
  }

  // Coste en tiempo real del formulario (preview)
  const previewCost = useMemo(() => {
    const ingCost = ingredients.reduce(
      (s, i) => s + i.quantity * i.price_per_unit * (1 + i.waste_percentage / 100), 0
    );
    const totalCost = ingCost + form.labor_cost;
    const price = form.margin > 0 ? totalCost / (1 - form.margin / 100) : 0;
    return { ingCost, totalCost, price };
  }, [ingredients, form.labor_cost, form.margin]);

  // ── Photo scan ─────────────────────────────────────────────────────────────
  async function handlePhotoScan(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setPhotoScan(true);
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((res, rej) => {
        reader.onload = ev => res((ev.target?.result as string).split(',')[1]);
        reader.onerror = rej; reader.readAsDataURL(file);
      });
      const resp = await getAI().models.generateContent({
        model: 'gemini-2.0-flash',
        contents: [{
          role: 'user', parts: [
            { inlineData: { mimeType: file.type, data: base64 } },
            { text: `Analiza esta imagen de una receta o plato de restaurante. Extrae los datos y devuelve SOLO JSON válido sin markdown:
{
  "name": "nombre del plato",
  "category": "Entrante|Plato principal|Postre|Bebida|Cocktail|Otro",
  "servings": número,
  "instructions": "pasos breves",
  "ingredients": [
    {"name": "ingrediente", "quantity": número, "unit": "kg|g|l|ml|ud", "waste_percentage": número, "price_per_unit": número}
  ]
}
Estima precios de mercado español actuales si no se ven. Waste percentage = % de merma habitual del ingrediente.` }
          ]
        }]
      });
      const raw = resp.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
      const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());

      setForm(f => ({
        ...f,
        name:         parsed.name || '',
        category:     parsed.category || 'Plato principal',
        servings:     parsed.servings || 1,
        instructions: parsed.instructions || '',
      }));
      if (parsed.ingredients?.length > 0) {
        setIngredients(parsed.ingredients.map((i: any) => ({
          id:              uid(),
          name:            i.name || '',
          quantity:        Number(i.quantity) || 0,
          unit:            i.unit || 'kg',
          waste_percentage: Number(i.waste_percentage) || 0,
          price_per_unit:  Number(i.price_per_unit) || 0,
          stock_item_id:   '',
        })));
      }
      setShowForm(true);
      toast('📸 Receta extraída — revisa y guarda', 'warn');
    } catch {
      toast('No pude leer la imagen. Intenta con mejor calidad.', 'err');
    } finally {
      setPhotoScan(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  // ── Análisis IA de la carta ───────────────────────────────────────────────
  async function handleAIAnalysis() {
    setAiLoading(true); setAiResult(null);
    try {
      const recipesSummary = costs.map(c =>
        `${c.name} (${c.category}): coste ${fmtEur(c.total_cost)}, precio sugerido ${fmtEur(c.suggested_price)}, margen ${fmtPct(c.margin)}`
      ).join('\n');

      const res = await getAI().models.generateContent({
        model: 'gemini-2.0-flash',
        contents: [{
          role: 'user', parts: [{
            text: `Eres un chef consultor experto en ingeniería de menú para restaurantes. Analiza esta carta y da recomendaciones concretas.

CARTA ACTUAL (${recipes.length} platos):
${recipesSummary || 'Sin recetas registradas'}

ESTADÍSTICAS:
- Margen medio de la carta: ${fmtPct(avgMargin)}
- Coste medio por plato: ${fmtEur(avgCost)}
- Plato con mejor margen: ${bestMargin?.name || '—'} (${bestMargin ? fmtPct(bestMargin.margin) : '—'})
- Plato con peor margen: ${worstMargin?.name || '—'} (${worstMargin ? fmtPct(worstMargin.margin) : '—'})

Da 5 recomendaciones concretas en español:
1. Platos a promocionar (estrellas con margen alto)
2. Platos a revisar precio o retirar (bajo margen)
3. Oportunidades de mejora de costes
4. Equilibrio de la carta por categorías
5. Una sugerencia de plato nuevo que encajaría bien

Formato: bullet points directos, máx 2 líneas cada uno. Sé específico con los nombres de los platos.`
          }]
        }]
      });
      setAiResult(res.candidates?.[0]?.content?.parts?.[0]?.text || 'Sin análisis');
    } catch (err: any) {
      setAiResult('Error al conectar con IA: ' + err.message);
    } finally { setAiLoading(false); }
  }

  // ── Abrir edición ─────────────────────────────────────────────────────────
  function openEdit(recipe: Recipe) {
    setForm({
      name: recipe.name, category: recipe.category,
      servings: recipe.servings, labor_cost: recipe.labor_cost,
      margin: recipe.margin, instructions: recipe.instructions || '',
    });
    const ings = ingMap[recipe.id] || [];
    setIngredients(ings.length > 0
      ? ings.map(i => ({ ...i, id: i.id, stock_item_id: i.stock_item_id || '' }))
      : [{ id: uid(), name: '', quantity: 0, unit: 'kg', waste_percentage: 0, price_per_unit: 0, stock_item_id: '' }]
    );
    setEditRecipe(recipe);
    setShowForm(true);
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#F8FAFC] p-4 md:p-8 space-y-6">
      <ToastContainer />
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoScan} />

      {/* ── Header ── */}
      <header className="sticky top-4 z-[100] bg-white/80 backdrop-blur-xl border border-white/20
                         shadow-xl rounded-[2.5rem] p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-2xl shadow-lg">
            <ChefHat className="w-5 h-5 text-amber-400" />
            <span className="font-black text-sm tracking-tighter uppercase">Escandallos</span>
          </div>
          <span className="text-sm font-bold text-slate-400 hidden sm:block">{recipes.length} recetas</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => fileRef.current?.click()} disabled={photoScan}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-2xl text-xs font-bold hover:bg-slate-50 transition-all shadow-sm disabled:opacity-50">
            {photoScan ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
            Escanear receta
          </button>
          <button onClick={() => { resetForm(); setEditRecipe(null); setShowForm(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-2xl text-xs font-bold hover:bg-indigo-700 transition-all shadow-sm shadow-indigo-200">
            <Plus size={14} /> Nueva receta
          </button>
        </div>
      </header>

      {/* ── Stats globales ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Recetas activas',    value: recipes.length,       color: 'text-slate-900', icon: <ChefHat size={16} className="text-amber-400" /> },
          { label: 'Margen medio carta', value: fmtPct(avgMargin),    color: avgMargin >= 60 ? 'text-emerald-600' : 'text-amber-600', icon: <BarChart3 size={16} className="text-indigo-400" /> },
          { label: 'Mejor margen',       value: bestMargin ? bestMargin.name : '—', color: 'text-emerald-600', icon: <Star size={16} className="text-amber-400" /> },
          { label: 'Coste medio plato',  value: fmtEur(avgCost),      color: 'text-slate-900', icon: <Flame size={16} className="text-rose-400" /> },
        ].map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{s.label}</span>
              {s.icon}
            </div>
            <p className={cn('text-xl font-black truncate', s.color)}>{s.value}</p>
          </motion.div>
        ))}
      </div>

      {/* ── Tabs ── */}
      <div className="flex bg-white border border-slate-200 rounded-2xl p-1 gap-1 shadow-sm w-fit">
        {[
          { id: 'recetas',   label: 'Recetas',   icon: <ChefHat size={14} /> },
          { id: 'analitica', label: 'Analítica IA', icon: <Brain size={14} /> },
        ].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id as typeof activeTab)}
            className={cn('flex items-center gap-1.5 px-5 py-2 rounded-xl text-sm font-bold transition-all',
              activeTab === t.id ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-800'
            )}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ══════════ RECETAS ══════════ */}
      {activeTab === 'recetas' && (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-[200px] bg-white border border-slate-200 rounded-2xl px-4 py-2.5 shadow-sm">
              <Search size={16} className="text-slate-400 shrink-0" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Buscar receta…"
                className="flex-1 text-sm bg-transparent outline-none placeholder:text-slate-400" />
              <VoiceButton onResult={setSearch} small />
            </div>
            <div className="flex bg-white border border-slate-200 rounded-2xl p-1 gap-1 shadow-sm overflow-x-auto">
              {(['Todos', ...CATEGORIES]).map(c => (
                <button key={c} onClick={() => setCatFilter(c)}
                  className={cn('px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap',
                    catFilter === c ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-800'
                  )}>
                  {c}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 size={32} className="animate-spin text-indigo-400" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-20 h-20 bg-slate-100 rounded-[2rem] flex items-center justify-center mb-4 text-slate-300">
                <ChefHat size={40} />
              </div>
              <p className="text-slate-400 font-bold">Sin recetas{search ? ` con "${search}"` : ''}</p>
              <div className="flex gap-3 mt-4">
                <button onClick={() => { resetForm(); setEditRecipe(null); setShowForm(true); }}
                  className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-2xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200">
                  <Plus size={15} /> Nueva receta
                </button>
                <button onClick={() => fileRef.current?.click()}
                  className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-2xl text-sm font-bold hover:bg-slate-50 transition-all">
                  <Camera size={15} /> Escanear con cámara
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(recipe => (
                <RecipeCard
                  key={recipe.id}
                  recipe={recipe}
                  cost={costs.find(c => c.id === recipe.id)}
                  avgMargin={avgMargin}
                  ingredients={ingMap[recipe.id] || []}
                  expanded={expandedId === recipe.id}
                  onToggle={() => setExpandedId(expandedId === recipe.id ? null : recipe.id)}
                  onEdit={() => openEdit(recipe)}
                  onDelete={() => deleteRecipe(recipe.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════ ANALÍTICA ══════════ */}
      {activeTab === 'analitica' && (
        <div className="space-y-5">
          <button onClick={handleAIAnalysis} disabled={aiLoading}
            className="w-full flex items-center justify-center gap-3 py-4 bg-indigo-600 text-white rounded-2xl font-black hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-lg shadow-indigo-200">
            {aiLoading
              ? <><Loader2 size={20} className="animate-spin" /> Analizando la carta…</>
              : <><Brain size={20} /> Analizar carta con IA</>
            }
          </button>

          {aiResult && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="bg-indigo-50 border border-indigo-100 rounded-3xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 bg-indigo-100 rounded-2xl flex items-center justify-center">
                  <Brain size={18} className="text-indigo-600" />
                </div>
                <p className="font-black text-indigo-900">Análisis de la carta</p>
              </div>
              <pre className="text-sm text-indigo-800 whitespace-pre-wrap font-sans leading-relaxed">
                {aiResult}
              </pre>
            </motion.div>
          )}

          {/* Ranking de margen */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4">
            <h3 className="font-black text-slate-900">Ranking por margen</h3>
            <div className="space-y-3">
              {[...costs].sort((a, b) => b.margin - a.margin).map((c, i) => {
                const cls = classify(c.margin, avgMargin);
                return (
                  <div key={c.id} className="flex items-center gap-4">
                    <span className="text-xs font-black text-slate-400 w-5 shrink-0">{i + 1}</span>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-slate-800">{c.name}</span>
                        <div className="flex items-center gap-2">
                          <span className={cn('text-[10px] font-black px-2 py-0.5 rounded-lg', cls.color)}>
                            {cls.label}
                          </span>
                          <span className={cn('font-black text-sm',
                            c.margin >= 60 ? 'text-emerald-600' : c.margin >= 40 ? 'text-amber-600' : 'text-rose-600'
                          )}>
                            {fmtPct(c.margin)}
                          </span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={cn('h-full rounded-full transition-all duration-700',
                            c.margin >= 60 ? 'bg-emerald-400' : c.margin >= 40 ? 'bg-amber-400' : 'bg-rose-400'
                          )}
                          style={{ width: `${Math.min(c.margin, 100)}%` }}
                        />
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-slate-400">{fmtEur(c.total_cost)}</p>
                      <p className="text-sm font-black text-emerald-700">{fmtEur(c.suggested_price)}</p>
                    </div>
                  </div>
                );
              })}
              {costs.length === 0 && (
                <p className="text-center text-slate-400 text-sm py-6">
                  Añade recetas con ingredientes para ver el análisis
                </p>
              )}
            </div>
          </div>

          {/* Por categoría */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4">
            <h3 className="font-black text-slate-900">Por categoría</h3>
            <div className="space-y-3">
              {CATEGORIES.map(cat => {
                const catCosts = costs.filter(c => recipes.find(r => r.id === c.id && r.category === cat));
                if (catCosts.length === 0) return null;
                const avg = catCosts.reduce((s, c) => s + c.margin, 0) / catCosts.length;
                return (
                  <div key={cat} className="flex items-center gap-4 p-3 bg-slate-50 rounded-2xl">
                    <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center text-lg">
                      {cat === 'Entrante' ? '🥗' : cat === 'Plato principal' ? '🍽️' : cat === 'Postre' ? '🍮' : cat === 'Bebida' ? '🥤' : cat === 'Cocktail' ? '🍹' : '🔧'}
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between">
                        <span className="text-sm font-black text-slate-800">{cat}</span>
                        <span className={cn('font-black text-sm', avg >= 60 ? 'text-emerald-600' : avg >= 40 ? 'text-amber-600' : 'text-rose-600')}>
                          {fmtPct(avg)} media
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">{catCosts.length} plato{catCosts.length !== 1 ? 's' : ''}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ════ MODAL NUEVA / EDITAR RECETA ════ */}
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
                <h2 className="text-xl font-black text-slate-900">
                  {editRecipe ? 'Editar receta' : 'Nueva receta'}
                </h2>
                <button onClick={() => { setShowForm(false); setEditRecipe(null); }}
                  className="p-2 rounded-xl hover:bg-slate-100 transition-all"><X size={20} /></button>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

                {/* Datos básicos */}
                <div className="space-y-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Información del plato</p>
                  <div className="space-y-1.5">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Nombre *</label>
                    <VoiceField value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} placeholder="Nombre del plato" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-black uppercase tracking-widest text-slate-400">Categoría</label>
                      <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-black uppercase tracking-widest text-slate-400">Raciones</label>
                      <input type="number" min="1" value={form.servings}
                        onChange={e => setForm(f => ({ ...f, servings: parseInt(e.target.value) || 1 }))}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 text-right" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-black uppercase tracking-widest text-slate-400">Mano de obra (€)</label>
                      <input type="number" min="0" step="0.01" value={form.labor_cost || ''}
                        onChange={e => setForm(f => ({ ...f, labor_cost: parseFloat(e.target.value) || 0 }))}
                        placeholder="0.00"
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 text-right" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-black uppercase tracking-widest text-slate-400">Margen objetivo (%)</label>
                      <input type="number" min="0" max="99" value={form.margin}
                        onChange={e => setForm(f => ({ ...f, margin: parseFloat(e.target.value) || 0 }))}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 text-right" />
                    </div>
                  </div>
                </div>

                {/* Ingredientes */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Ingredientes</p>
                    <button onClick={addIngredient}
                      className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-200 transition-all">
                      <Plus size={12} /> Añadir
                    </button>
                  </div>

                  {ingredients.map((ing, idx) => (
                    <div key={ing.id} className="bg-slate-50 rounded-2xl p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-slate-400 w-5 shrink-0">{idx + 1}</span>

                        {/* Selector de stock o nombre manual */}
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <select
                              value={ing.stock_item_id}
                              onChange={e => selectStockItem(ing.id, e.target.value)}
                              className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-200">
                              <option value="">— Del stock o manual —</option>
                              {stockItems.map(s => (
                                <option key={s.id} value={s.id}>{s.name} ({s.unit}) — {fmtEur(s.price_per_unit)}</option>
                              ))}
                            </select>
                          </div>
                          {!ing.stock_item_id && (
                            <div className="flex items-center gap-2">
                              <input value={ing.name} onChange={e => updIngredient(ing.id, { name: e.target.value })}
                                placeholder="Nombre del ingrediente"
                                className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200" />
                              <VoiceButton onResult={v => updIngredient(ing.id, { name: v })} small />
                            </div>
                          )}
                          {ing.stock_item_id && (
                            <p className="text-xs text-indigo-600 font-bold pl-1">📦 {ing.name}</p>
                          )}
                        </div>

                        <button onClick={() => delIngredient(ing.id)}
                          className="p-1.5 rounded-xl text-rose-400 hover:bg-rose-50 transition-all shrink-0">
                          <Trash2 size={14} />
                        </button>
                      </div>

                      <div className="grid grid-cols-4 gap-2 pl-7">
                        <input type="number" min="0" step="0.001" value={ing.quantity || ''}
                          onChange={e => updIngredient(ing.id, { quantity: parseFloat(e.target.value) || 0 })}
                          placeholder="Cant."
                          className="px-2 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-200 text-right" />
                        <select value={ing.unit} onChange={e => updIngredient(ing.id, { unit: e.target.value })}
                          className="px-2 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-200">
                          {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                        <input type="number" min="0" step="0.0001" value={ing.price_per_unit || ''}
                          onChange={e => updIngredient(ing.id, { price_per_unit: parseFloat(e.target.value) || 0 })}
                          placeholder="€/u"
                          className="px-2 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-200 text-right" />
                        <input type="number" min="0" max="100" step="1" value={ing.waste_percentage || ''}
                          onChange={e => updIngredient(ing.id, { waste_percentage: parseFloat(e.target.value) || 0 })}
                          placeholder="% merma"
                          className="px-2 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-200 text-right" />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Preview de costes en tiempo real */}
                {previewCost.totalCost > 0 && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="bg-indigo-50 border border-indigo-100 rounded-2xl px-5 py-4 space-y-2">
                    <p className="text-xs font-black text-indigo-600 uppercase tracking-wider">Preview de costes</p>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <p className="text-[10px] text-indigo-400 font-bold">Ingredientes</p>
                        <p className="font-black text-indigo-900">{fmtEur(previewCost.ingCost)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-indigo-400 font-bold">Coste total</p>
                        <p className="font-black text-rose-600">{fmtEur(previewCost.totalCost)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-indigo-400 font-bold">Precio sugerido ({form.margin}%)</p>
                        <p className="font-black text-emerald-600">{fmtEur(previewCost.price)}</p>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Instrucciones */}
                <div className="space-y-1.5">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400">Elaboración / Instrucciones</label>
                  <div className="flex items-start gap-2">
                    <textarea value={form.instructions} onChange={e => setForm(f => ({ ...f, instructions: e.target.value }))}
                      placeholder="Pasos de elaboración, notas de emplatado, alérgenos…" rows={3}
                      className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                    <VoiceButton onResult={v => setForm(f => ({ ...f, instructions: v }))} small className="mt-1" />
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-slate-100 flex gap-3 shrink-0">
                <button onClick={() => { setShowForm(false); setEditRecipe(null); }}
                  className="flex-1 py-3 border border-slate-200 rounded-2xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all">
                  Cancelar
                </button>
                <button onClick={saveRecipe} disabled={saving}
                  className="flex-1 py-3 bg-indigo-600 text-white rounded-2xl text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-200">
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                  {editRecipe ? 'Actualizar receta' : 'Guardar receta'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
