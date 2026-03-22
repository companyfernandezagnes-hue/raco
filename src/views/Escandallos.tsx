import React, { useState, useEffect, useRef } from 'react';
import {
  Plus, Search, ChevronRight, TrendingUp, TrendingDown, Scale, Clock,
  MoreVertical, ArrowRight, PieChart, Target, Zap, Sparkles, Info,
  AlertCircle, CheckCircle2, History, Layers, ShieldAlert, Flame,
  BarChart, Brain, FileText, Trash2, X, Camera, Loader2, Mic, MicOff, Eye
} from 'lucide-react';
import { supabase } from '../supabase';
import { useSupabase } from '../context/SupabaseContext';

interface RecipeIngredient {
  id?: string; name: string; quantity: number; unit: string;
  waste_percentage: number; price_per_unit: number;
}
interface Recipe {
  id: string; name: string; category: string; servings: number;
  labor_cost: number; margin: number; instructions?: string;
  photo_url?: string; active: boolean;
  ingredients?: RecipeIngredient[];
}
interface RecipeCost {
  id: string; name: string; category: string; servings: number; margin: number;
  labor_cost: number; ingredient_cost: number; total_cost: number; suggested_price: number;
}

const GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY;
async function callGemini(prompt: string): Promise<string> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
    { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({contents:[{parts:[{text:prompt}]}]}) }
  );
  const json = await res.json();
  return json.candidates?.[0]?.content?.parts?.[0]?.text ?? 'Sin respuesta';
}
async function callGeminiVision(base64: string, mimeType: string, prompt: string): Promise<string> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
    { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({contents:[{parts:[{inlineData:{mimeType,data:base64}},{text:prompt}]}]}) }
  );
  const json = await res.json();
  return json.candidates?.[0]?.content?.parts?.[0]?.text ?? 'Sin respuesta';
}
function VoiceButton({ onResult, className='' }: { onResult:(t:string)=>void; className?:string }) {
  const [listening, setListening] = useState(false);
  const recRef = useRef<any>(null);
  const toggle = () => {
    if (listening) { recRef.current?.stop(); setListening(false); return; }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert('Voz no soportada'); return; }
    const rec = new SR(); rec.lang='es-ES'; rec.interimResults=false;
    rec.onresult=(e:any)=>{onResult(e.results[0][0].transcript);setListening(false);};
    rec.onerror=()=>setListening(false); rec.onend=()=>setListening(false);
    recRef.current=rec; rec.start(); setListening(true);
  };
  return <button type="button" onClick={toggle} className={`p-2 rounded-full transition-all ${listening?'bg-red-500 text-white animate-pulse':'bg-indigo-100 text-indigo-600 hover:bg-indigo-200'} ${className}`}>{listening?<MicOff size={16}/>:<Mic size={16}/>}</button>;
}
export default function EscandallosView() {
  const { employee } = useSupabase();
  const isAdmin = employee?.rol === 'admin';
  const [activeTab, setActiveTab] = useState<'recipes'|'analytics'>('recipes');
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [costs, setCosts] = useState<RecipeCost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string|null>(null);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('Todos');
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe|null>(null);
  const [showModal, setShowModal] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<string|null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [newRecipe, setNewRecipe] = useState({
    name:'', category:'Plato principal', servings:1, labor_cost:0, margin:30, instructions:''
  });
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([
    {name:'',quantity:0,unit:'kg',waste_percentage:0,price_per_unit:0}
  ]);

  useEffect(()=>{loadAll();},[]);
  async function loadAll() {
    setLoading(true); setError(null);
    try {
      const [r,c] = await Promise.all([
        supabase.from('recipes').select('*, recipe_ingredients(*)').eq('active',true).order('name'),
        supabase.from('recipe_cost_summary').select('*'),
      ]);
      if(r.error) throw r.error; if(c.error) throw c.error;
      setRecipes((r.data||[]).map((rec:any)=>({...rec,ingredients:rec.recipe_ingredients||[]})));
      setCosts(c.data||[]);
    } catch(err:any) { setError(err.message||'Error'); }
    finally { setLoading(false); }
  }
  async function handleAddRecipe() {
    if(!newRecipe.name.trim()){ alert('El nombre es obligatorio'); return; }
    const {data:rec,error:rerr} = await supabase.from('recipes').insert([{
      name:newRecipe.name.trim(), category:newRecipe.category, servings:newRecipe.servings,
      labor_cost:newRecipe.labor_cost, margin:newRecipe.margin, instructions:newRecipe.instructions||null, active:true,
    }]).select().single();
    if(rerr){ alert('Error: '+rerr.message); return; }
    const validIngredients = ingredients.filter(i=>i.name.trim());
    if(validIngredients.length>0){
      const {error:ierr} = await supabase.from('recipe_ingredients').insert(
        validIngredients.map(i=>({recipe_id:rec.id,...i}))
      );
      if(ierr){ alert('Error ingredientes: '+ierr.message); }
    }
    setShowModal(false);
    setNewRecipe({name:'',category:'Plato principal',servings:1,labor_cost:0,margin:30,instructions:''});
    setIngredients([{name:'',quantity:0,unit:'kg',waste_percentage:0,price_per_unit:0}]);
    loadAll();
  }
  async function handleDeleteRecipe(id:string) {
    if(!confirm('¿Eliminar esta receta?')) return;
    const {error} = await supabase.from('recipes').update({active:false}).eq('id',id);
    if(error){ alert('Error: '+error.message); return; }
    setSelectedRecipe(null); loadAll();
  }
  async function handleAIRecipe() {
    setAiLoading(true); setAiResult(null);
    try {
      const recipeList = recipes.map(r=>`${r.name} (${r.category})`).join(', ');
      const result = await callGemini(`Eres un chef experto en restaurantes. Analiza esta carta y sugiere 3 platos nuevos con ingredientes y precios estimados. Carta actual: ${recipeList||'vacía'}. Responde en español con formato claro.`);
      setAiResult(result);
    } catch(err:any){ setAiResult('Error IA: '+err.message); }
    finally { setAiLoading(false); }
  }
  async function handlePhotoScan(e:React.ChangeEvent<HTMLInputElement>) {
    const file=e.target.files?.[0]; if(!file) return;
    setAiLoading(true);
    try {
      const base64=await new Promise<string>((res,rej)=>{const r=new FileReader();r.onload=()=>res((r.result as string).split(',')[1]);r.onerror=rej;r.readAsDataURL(file);});
      const result=await callGeminiVision(base64,file.type,'Analiza esta receta o plato. Extrae en JSON: {"name":"","category":"","servings":1,"ingredients":[{"name":"","quantity":0,"unit":"","waste_percentage":0,"price_per_unit":0}],"instructions":""}. Solo JSON.');
      const m=result.match(/\{[\s\S]*\}/);
      if(m){
        const d=JSON.parse(m[0]);
        setNewRecipe(prev=>({...prev,name:d.name||prev.name,category:d.category||prev.category,servings:d.servings||prev.servings,instructions:d.instructions||prev.instructions}));
        if(d.ingredients?.length>0) setIngredients(d.ingredients);
        setShowModal(true); alert('Receta extraída. Revisa y confirma.');
      } else { alert('No se pudieron extraer datos.'); }
    } catch(err:any){ alert('Error imagen: '+err.message); }
    finally { setAiLoading(false); if(e.target) e.target.value=''; }
  }
  const CATS=['Todos','Entrante','Plato principal','Postre','Bebida','Cocktail','Otro'];
  const UNITS=['kg','g','l','ml','ud','caja'];
  const catColor:Record<string,string>={'Entrante':'bg-amber-100 text-amber-700','Plato principal':'bg-indigo-100 text-indigo-700','Postre':'bg-pink-100 text-pink-700','Bebida':'bg-blue-100 text-blue-700','Cocktail':'bg-purple-100 text-purple-700','Otro':'bg-slate-100 text-slate-600'};
  const filtered = recipes.filter(r=>{
    const ms=r.name.toLowerCase().includes(search.toLowerCase());
    const mc=filterCat==='Todos'||r.category===filterCat;
    return ms&&mc;
  });
  const avgMargin = costs.length>0?costs.reduce((s,c)=>s+c.margin,0)/costs.length:0;
  const totalCost = costs.reduce((s,c)=>s+c.total_cost,0);
  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-indigo-500" size={40}/><span className="ml-3 text-slate-500">Cargando escandallos...</span></div>;
  if (error) return <div className="flex flex-col items-center justify-center h-64 gap-4"><AlertCircle className="text-red-500" size={40}/><p className="text-red-600">{error}</p><button onClick={loadAll} className="px-4 py-2 bg-indigo-600 text-white rounded-xl">Reintentar</button></div>;
  return (
    <div className="min-h-screen bg-slate-50 p-6 space-y-6">
      <input ref={photoInputRef} type="file" accept="image/*" onChange={handlePhotoScan} className="hidden"/>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div><h1 className="text-3xl font-black text-slate-900 tracking-tight">Escandallos & Carta</h1><p className="text-slate-500 text-sm mt-1">Recetas, costes y análisis de rentabilidad</p></div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={()=>photoInputRef.current?.click()} disabled={aiLoading}
            className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-xl hover:bg-purple-700 text-sm font-medium disabled:opacity-50">
            {aiLoading?<Loader2 size={16} className="animate-spin"/>:<Camera size={16}/>} Escanear Receta
          </button>
          <button onClick={handleAIRecipe} disabled={aiLoading}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl hover:bg-indigo-700 text-sm font-medium disabled:opacity-50">
            {aiLoading?<Loader2 size={16} className="animate-spin"/>:<Brain size={16}/>} IA: Sugerir Platos
          </button>
          <button onClick={()=>setShowModal(true)} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl hover:bg-emerald-700 text-sm font-medium">
            <Plus size={16}/> Nueva Receta
          </button>
        </div>
      </div>

      {aiResult&&(
        <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-5 relative">
          <button onClick={()=>setAiResult(null)} className="absolute top-3 right-3 text-slate-400 hover:text-slate-600"><X size={16}/></button>
          <div className="flex items-start gap-3"><Brain size={20} className="text-indigo-600 mt-0.5 flex-shrink-0"/>
            <div><p className="font-bold text-indigo-800 mb-2">Sugerencias IA de Chef</p><pre className="text-slate-700 text-sm whitespace-pre-wrap font-sans">{aiResult}</pre></div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {label:'Total recetas',value:recipes.length,icon:FileText,color:'text-indigo-600',bg:'bg-indigo-50'},
          {label:'Margen medio',value:avgMargin.toFixed(1)+'%',icon:Target,color:'text-emerald-600',bg:'bg-emerald-50'},
          {label:'Coste total carta',value:totalCost.toLocaleString('es-ES',{style:'currency',currency:'EUR'}),icon:Scale,color:'text-amber-600',bg:'bg-amber-50'},
          {label:'Categorías',value:new Set(recipes.map(r=>r.category)).size,icon:Layers,color:'text-blue-600',bg:'bg-blue-50'},
        ].map(st=>(
          <div key={st.label} className={`${st.bg} rounded-2xl p-4 border border-white shadow-sm`}>
            <div className="flex items-center gap-3"><st.icon size={20} className={st.color}/>
              <div><p className="text-xs text-slate-500 font-medium">{st.label}</p><p className={`text-xl font-black ${st.color}`}>{st.value}</p></div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-2xl w-fit">
        {([{id:'recipes',label:'Recetas',icon:FileText},{id:'analytics',label:'Analítica',icon:BarChart}] as const).map(t=>(
          <button key={t.id} onClick={()=>setActiveTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all ${activeTab===t.id?'bg-white text-indigo-700 shadow-sm':'text-slate-500 hover:text-slate-700'}`}>
            <t.icon size={14}/>{t.label}
          </button>
        ))}
      </div>

      {/* TAB Recetas */}
      {activeTab==='recipes'&&(
        <div>
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
              <input type="text" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar receta..."
                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"/>
            </div>
            <VoiceButton onResult={t=>setSearch(t)}/>
            <div className="flex gap-1 flex-wrap">
              {CATS.map(c=>(
                <button key={c} onClick={()=>setFilterCat(c)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${filterCat===c?'bg-indigo-600 text-white':'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>{c}</button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(recipe=>{
              const cost=costs.find(c=>c.id===recipe.id);
              const isSelected=selectedRecipe?.id===recipe.id;
              return (
                <div key={recipe.id} onClick={()=>setSelectedRecipe(isSelected?null:recipe)}
                  className={`bg-white p-5 rounded-2xl border ${isSelected?'border-indigo-300 shadow-xl':'border-slate-200 shadow-sm'} hover:shadow-xl transition-all cursor-pointer relative overflow-hidden`}>
                  <div className="absolute top-0 right-0 w-20 h-20 bg-indigo-50/50 rounded-full -mr-6 -mt-6 blur-xl"/>
                  <div className="flex items-start justify-between mb-3">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${catColor[recipe.category]??'bg-slate-100 text-slate-600'}`}>{recipe.category}</span>
                    <button onClick={e=>{e.stopPropagation();handleDeleteRecipe(recipe.id);}} className="p-1 rounded-lg text-slate-200 hover:text-red-500 hover:bg-red-50"><Trash2 size={14}/></button>
                  </div>
                  <h3 className="font-black text-slate-900 text-lg mb-1">{recipe.name}</h3>
                  <p className="text-sm text-slate-500 mb-3">{recipe.servings} {recipe.servings===1?'ración':'raciones'}</p>
                  {cost&&(
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-slate-50 rounded-xl p-2.5">
                        <p className="text-[10px] text-slate-400 uppercase font-bold">Coste total</p>
                        <p className="font-black text-slate-800">{cost.total_cost.toLocaleString('es-ES',{style:'currency',currency:'EUR'})}</p>
                      </div>
                      <div className="bg-emerald-50 rounded-xl p-2.5">
                        <p className="text-[10px] text-slate-400 uppercase font-bold">Precio sugerido</p>
                        <p className="font-black text-emerald-700">{cost.suggested_price.toLocaleString('es-ES',{style:'currency',currency:'EUR'})}</p>
                      </div>
                    </div>
                  )}
                  {isSelected&&recipe.ingredients&&recipe.ingredients.length>0&&(
                    <div className="mt-4 pt-4 border-t border-slate-100">
                      <p className="text-xs font-bold text-slate-500 uppercase mb-2">Ingredientes</p>
                      <div className="space-y-1">
                        {recipe.ingredients.map((ing,i)=>(
                          <div key={i} className="flex justify-between text-xs text-slate-600">
                            <span>{ing.name}</span>
                            <span>{ing.quantity}{ing.unit} {ing.waste_percentage>0?<span className="text-amber-500">+{ing.waste_percentage}% merma</span>:''}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {filtered.length===0&&(
              <div className="col-span-3 text-center py-16 text-slate-400"><FileText size={48} className="mx-auto mb-3 opacity-30"/><p className="font-medium">No hay recetas registradas</p><p className="text-sm mt-1">Añade recetas o escanea una imagen con IA</p></div>
            )}
          </div>
        </div>
      )}

      {/* TAB Analítica */}
      {activeTab==='analytics'&&(
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h3 className="font-black text-slate-800 mb-4">Rentabilidad por Receta</h3>
            <div className="space-y-3">
              {costs.sort((a,b)=>b.margin-a.margin).map(c=>(
                <div key={c.id} className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex justify-between mb-1"><span className="text-sm font-medium text-slate-700">{c.name}</span><span className="text-xs font-bold text-emerald-600">{c.margin.toFixed(0)}%</span></div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-emerald-400 rounded-full" style={{width:c.margin+'%'}}/></div>
                  </div>
                  <span className="text-xs font-bold text-indigo-600 w-20 text-right">{c.suggested_price.toLocaleString('es-ES',{style:'currency',currency:'EUR'})}</span>
                </div>
              ))}
              {costs.length===0&&<p className="text-center text-slate-400 py-4 text-sm">Sin datos todavía</p>}
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h3 className="font-black text-slate-800 mb-4">Por Categoría</h3>
            {CATS.filter(c=>c!=='Todos').map(cat=>{
              const catRecipes=recipes.filter(r=>r.category===cat);
              const catCosts=costs.filter(c=>recipes.find(r=>r.id===c.id&&r.category===cat));
              const avgP=catCosts.length>0?catCosts.reduce((s,c)=>s+c.suggested_price,0)/catCosts.length:0;
              return <div key={cat} className="flex justify-between items-center py-2 border-b border-slate-50 last:border-0">
                <span className={`text-xs font-bold px-2 py-1 rounded-lg ${catColor[cat]??''}`}>{cat}</span>
                <div className="text-right"><p className="text-sm font-bold text-slate-800">{catRecipes.length} platos</p>{avgP>0&&<p className="text-xs text-slate-500">~{avgP.toLocaleString('es-ES',{style:'currency',currency:'EUR'})}</p>}</div>
              </div>;
            })}
          </div>
        </div>
      )}
      {/* MODAL Nueva Receta */}
      {showModal&&(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-2xl my-4">
            <div className="flex items-center justify-between mb-6"><h2 className="text-xl font-black text-slate-900">Nueva Receta / Escandallo</h2><button onClick={()=>setShowModal(false)} className="p-2 rounded-full hover:bg-slate-100"><X size={20}/></button></div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="col-span-2">
                <div className="flex gap-2"><div className="flex-1"><label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Nombre *</label><input type="text" value={newRecipe.name} onChange={e=>setNewRecipe({...newRecipe,name:e.target.value})} className="w-full mt-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" placeholder="Ej: Paella valenciana"/></div><div className="mt-6"><VoiceButton onResult={t=>setNewRecipe({...newRecipe,name:t})}/></div></div>
              </div>
              <div><label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Categoría</label><select value={newRecipe.category} onChange={e=>setNewRecipe({...newRecipe,category:e.target.value})} className="w-full mt-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white">{CATS.filter(c=>c!=='Todos').map(c=><option key={c}>{c}</option>)}</select></div>
              <div><label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Raciones</label><input type="number" value={newRecipe.servings} onChange={e=>setNewRecipe({...newRecipe,servings:parseInt(e.target.value)||1})} className="w-full mt-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" placeholder="1"/></div>
              <div><label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Coste mano de obra (€)</label><input type="number" step="0.01" value={newRecipe.labor_cost} onChange={e=>setNewRecipe({...newRecipe,labor_cost:parseFloat(e.target.value)||0})} className="w-full mt-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" placeholder="0.00"/></div>
              <div><label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Margen objetivo (%)</label><input type="number" value={newRecipe.margin} onChange={e=>setNewRecipe({...newRecipe,margin:parseFloat(e.target.value)||0})} className="w-full mt-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" placeholder="30"/></div>
              <div className="col-span-2"><label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Instrucciones</label><textarea value={newRecipe.instructions} onChange={e=>setNewRecipe({...newRecipe,instructions:e.target.value})} className="w-full mt-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none h-20" placeholder="Pasos de elaboración..."/></div>
            </div>
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2"><p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Ingredientes</p><button type="button" onClick={()=>setIngredients([...ingredients,{name:'',quantity:0,unit:'kg',waste_percentage:0,price_per_unit:0}])} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">+ Añadir</button></div>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {ingredients.map((ing,i)=>(
                  <div key={i} className="flex gap-2 items-center">
                    <input type="text" value={ing.name} onChange={e=>{const arr=[...ingredients];arr[i]={...arr[i],name:e.target.value};setIngredients(arr);}} placeholder="Nombre" className="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-300"/>
                    <input type="number" step="0.001" value={ing.quantity} onChange={e=>{const arr=[...ingredients];arr[i]={...arr[i],quantity:parseFloat(e.target.value)||0};setIngredients(arr);}} placeholder="Cant." className="w-16 px-2 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-300"/>
                    <select value={ing.unit} onChange={e=>{const arr=[...ingredients];arr[i]={...arr[i],unit:e.target.value};setIngredients(arr);}} className="w-14 px-2 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none">{UNITS.map(u=><option key={u}>{u}</option>)}</select>
                    <input type="number" step="0.1" value={ing.waste_percentage} onChange={e=>{const arr=[...ingredients];arr[i]={...arr[i],waste_percentage:parseFloat(e.target.value)||0};setIngredients(arr);}} placeholder="Merma%" className="w-16 px-2 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-300"/>
                    <input type="number" step="0.01" value={ing.price_per_unit} onChange={e=>{const arr=[...ingredients];arr[i]={...arr[i],price_per_unit:parseFloat(e.target.value)||0};setIngredients(arr);}} placeholder="€/u" className="w-16 px-2 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-300"/>
                    <button onClick={()=>setIngredients(ingredients.filter((_,j)=>j!==i))} className="text-red-400 hover:text-red-600"><X size={14}/></button>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={()=>setShowModal(false)} className="flex-1 py-3 border border-slate-200 rounded-xl text-sm font-medium hover:bg-slate-50">Cancelar</button>
              <button onClick={handleAddRecipe} className="flex-1 py-3 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700">Guardar Receta</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
