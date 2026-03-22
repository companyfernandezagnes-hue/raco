import React from 'react';
import { 
  Plus, 
  Search, 
  ChevronRight, 
  TrendingUp, 
  TrendingDown, 
  ChefHat, 
  Scale, 
  Clock, 
  MoreVertical,
  ArrowRight,
  PieChart,
  Target,
  Zap,
  Sparkles,
  Info,
  Users,
  Mic,
  MicOff,
  AlertCircle,
  CheckCircle2,
  History,
  FileDown,
  Layers,
  ShieldAlert,
  Flame,
  BarChart,
  Settings2,
  ArrowUpRight,
  ArrowDownRight,
  Brain,
  Lightbulb,
  Maximize2,
  FileText,
  Save,
  Trash2,
  Copy,
  Download,
  Filter,
  RefreshCw,
  HelpCircle,
  Package,
  User,
  MessageSquare,
  ShieldCheck,
  Eye
} from 'lucide-react';
import { Recipe, RecipeIngredient } from '../types';
import { cn, formatCurrency, formatDate } from '../lib/utils';
import { mockRecipes } from '../data/mockData';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";
import { usePin } from '../context/PinContext';
import { 
  ResponsiveContainer, 
  RadarChart, 
  PolarGrid, 
  PolarAngleAxis, 
  PolarRadiusAxis, 
  Radar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';

export default function EscandallosView() {
  const { rol } = usePin();
  const [recipes, setRecipes] = React.useState<Recipe[]>(mockRecipes);
  const [selectedRecipeId, setSelectedRecipeId] = React.useState<string | null>(mockRecipes[0]?.id ?? null);
  const [activeTab, setActiveTab] = React.useState<'escandallo' | 'analisis' | 'optimizacion' | 'mermas' | 'innovaciones'>('escandallo');
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [isOptimizing, setIsOptimizing] = React.useState(false);
  const [isRecording, setIsRecording] = React.useState(false);
  const [showAdjustWasteModal, setShowAdjustWasteModal] = React.useState(false);
  const [showMermasModal, setShowMermasModal] = React.useState(false);
  const [isUpdatingPrices, setIsUpdatingPrices] = React.useState(false);
  const [isEditingIngredients, setIsEditingIngredients] = React.useState(false);
  const [toast, setToast] = React.useState<{ message: string, type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };
  const [simulatedMargin, setSimulatedMargin] = React.useState<number>(75);
  const [wasteRecords, setWasteRecords] = React.useState([
    { id: '1', dishId: mockRecipes[0].id, date: '2024-03-15', reason: 'Caducidad', ingredient: 'Tomate Cherry', amount: 2.5, unit: 'kg', cost: 12.50 },
    { id: '2', dishId: mockRecipes[1].id, date: '2024-03-16', reason: 'Error de preparación', ingredient: 'Salmón Noruego', amount: 0.8, unit: 'kg', cost: 24.00 },
    { id: '3', dishId: mockRecipes[0].id, date: '2024-03-17', reason: 'Deterioro', ingredient: 'Albahaca Fresca', amount: 0.2, unit: 'kg', cost: 4.50 },
  ]);
  const [newWaste, setNewWaste] = React.useState({
    dishId: mockRecipes[0].id,
    date: new Date().toISOString().split('T')[0],
    reason: 'Caducidad',
    ingredient: '',
    amount: 0,
    unit: 'kg',
    cost: 0
  });
  
  const selectedRecipe = recipes.find(r => r.id === selectedRecipeId);

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

  React.useEffect(() => {
    if (selectedRecipe) {
      setSimulatedMargin(selectedRecipe.margin);
    }
  }, [selectedRecipeId]);

  const handleUpdatePrices = () => {
    setIsUpdatingPrices(true);
    setTimeout(() => {
      setIsUpdatingPrices(false);
      showToast('Precios actualizados según los últimos albaranes recibidos.');
    }, 2000);
  };

  const [newRecipe, setNewRecipe] = React.useState<{
    name: string;
    category: string;
    servings: number;
    margin: number;
    laborCost: number;
    ingredients: RecipeIngredient[];
  }>({
    name: '',
    category: 'Entrantes',
    servings: 1,
    margin: 75,
    laborCost: 2.50,
    ingredients: []
  });

  const handleCreateRecipe = () => {
    if (!newRecipe.name) {
      showToast('Por favor, introduce un nombre para la receta.', 'error');
      return;
    }

    const recipe: Recipe = {
      id: Math.random().toString(36).substr(2, 9),
      ...newRecipe,
      instructions: ''
    };

    setRecipes(prev => [recipe, ...prev]);
    showToast('Receta creada con éxito');
    setIsModalOpen(false);
    setNewRecipe({
      name: '',
      category: 'Entrantes',
      servings: 1,
      margin: 75,
      laborCost: 2.50,
      ingredients: []
    });
    setSelectedRecipeId(recipe.id);
  };

  const addIngredientToNewRecipe = () => {
    const newIng: RecipeIngredient = {
      id: Math.random().toString(36).substr(2, 9),
      name: '',
      quantity: 0,
      unit: 'kg',
      pricePerUnit: 0,
      wastePercentage: 0
    };
    setNewRecipe(prev => ({
      ...prev,
      ingredients: [...prev.ingredients, newIng]
    }));
  };

  const updateNewRecipeIngredient = (index: number, field: keyof RecipeIngredient, value: any) => {
    const updatedIngredients = [...newRecipe.ingredients];
    updatedIngredients[index] = { ...updatedIngredients[index], [field]: value };
    setNewRecipe(prev => ({ ...prev, ingredients: updatedIngredients }));
  };

  const removeIngredientFromNewRecipe = (index: number) => {
    setNewRecipe(prev => ({
      ...prev,
      ingredients: prev.ingredients.filter((_, i) => i !== index)
    }));
  };

  const handleUpdateRecipeIngredients = (updatedIngredients: RecipeIngredient[]) => {
    setRecipes(prev => prev.map(r => 
      r.id === selectedRecipeId ? { ...r, ingredients: updatedIngredients } : r
    ));
    showToast('Ingredientes actualizados correctamente');
  };

  const calculateIngredientCost = (ing: RecipeIngredient) => {
    const grossWeight = ing.quantity / (1 - ing.wastePercentage / 100);
    return grossWeight * ing.pricePerUnit;
  };

  const calculateTotalCost = (recipe: Recipe) => {
    const ingredientsCost = recipe.ingredients.reduce((acc, ing) => acc + calculateIngredientCost(ing), 0);
    return (ingredientsCost + recipe.laborCost) / recipe.servings;
  };

  const calculateRecommendedPrice = (recipe: Recipe) => {
    const cost = calculateTotalCost(recipe);
    return cost / (1 - recipe.margin / 100);
  };

  const [aiOptimizationResult, setAiOptimizationResult] = React.useState<{
    recommendations: string[];
    potentialSavings: number;
    marketTrend?: string;
    isGlobal?: boolean;
  } | null>(null);

  const handleOptimize = async (isGlobal: boolean = false) => {
    if (!isGlobal && !selectedRecipe) return;
    
    setIsOptimizing(true);
    setAiOptimizationResult(null);

    try {
      let prompt = "";
      if (isGlobal) {
        prompt = `Analiza el conjunto de escandallos de este restaurante y sugiere optimizaciones globales para reducir costes y aumentar márgenes.
        Datos del menú: ${JSON.stringify(recipes.map(r => ({ name: r.name, category: r.category, margin: r.margin, cost: calculateTotalCost(r) })))}
        
        Responde en formato JSON con:
        - recommendations: string[] (4 sugerencias estratégicas para todo el negocio)
        - potentialSavings: number (ahorro total estimado mensual en €)
        - marketTrend: string (tendencia macro del sector restauración)`;
      } else if (selectedRecipe?.name === 'Spider Tartar de Atún') {
        prompt = `Realiza un análisis profundo y crítico del plato 'Spider Tartar de Atún'.
        Ingredientes actuales: ${JSON.stringify(selectedRecipe?.ingredients)}
        Coste Laboral: ${selectedRecipe.laborCost}€
        Margen: ${selectedRecipe.margin}%
        
        Sugerencias específicas para:
        1. Reducción de coste de materia prima (Atún Rojo Balfegó es caro).
        2. Optimización de mermas de aguacate (35% es alto).
        3. Mejora de margen mediante presentación o upselling.
        4. Eficiencia en el tiempo de preparación.
        
        Responde en formato JSON con:
        - recommendations: string[] (4 sugerencias de alto impacto)
        - potentialSavings: number (ahorro por ración)
        - marketTrend: string (tendencia en crudos/tartares)`;
      } else {
        prompt = `Analiza este escandallo de cocina y sugiere mejoras para reducir costes, optimizar mermas y maximizar el margen de beneficio.
        Receta: ${selectedRecipe.name}
        Ingredientes: ${JSON.stringify(selectedRecipe?.ingredients)}
        Margen actual: ${selectedRecipe.margin}%
        Coste actual: ${calculateTotalCost(selectedRecipe)}€
        
        Responde en formato JSON con:
        - recommendations: string[] (máximo 4 sugerencias concretas)
        - potentialSavings: number (ahorro estimado por ración en €)
        - marketTrend: string (una breve tendencia de mercado relevante)`;
      }

      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        }
      });

      const result = JSON.parse(response.text || '{}');
      setAiOptimizationResult({
        recommendations: result.recommendations || [
          "Reducir la merma mediante un corte más preciso",
          "Ajustar el gramaje de la guarnición",
          "Negociar volumen con el proveedor principal",
          "Optimizar el tiempo de preparación para reducir coste laboral"
        ],
        potentialSavings: result.potentialSavings || (isGlobal ? 1250 : 0.50),
        marketTrend: result.marketTrend || "Aumento en la demanda de platos con ingredientes locales y sostenibles.",
        isGlobal
      });
    } catch (error) {
      console.error("Error optimizing with AI:", error);
      setAiOptimizationResult({
        recommendations: [
          "Error al conectar con la IA. Usando sugerencias predefinidas.",
          "Reducir la merma mediante un corte más preciso",
          "Ajustar el gramaje de la guarnición",
          "Optimizar el tiempo de preparación"
        ],
        potentialSavings: isGlobal ? 850 : 0.45,
        isGlobal
      });
    } finally {
      setIsOptimizing(false);
    }
  };

  const applyAiOptimization = () => {
    setIsOptimizing(true);
    setTimeout(() => {
      if (aiOptimizationResult) {
        if (aiOptimizationResult.isGlobal) {
          // Apply a small margin improvement across all recipes
          setRecipes(prev => prev.map(r => ({
            ...r,
            margin: Math.min(90, r.margin + 2)
          })));
        } else {
          // Apply optimization to selected recipe
          setRecipes(prev => prev.map(r => {
            if (r.id === selectedRecipeId) {
              return {
                ...r,
                margin: Math.min(90, r.margin + 5),
                laborCost: Math.max(0.5, r.laborCost * 0.9) // 10% reduction in labor cost
              };
            }
            return r;
          }));
        }
      }
      setIsOptimizing(false);
      showToast('Optimizaciones aplicadas correctamente. Los costes de la receta han sido actualizados.', 'success');
    }, 1500);
  };

  const startVoiceInput = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Tu navegador no soporta reconocimiento de voz.');
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'es-ES';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsRecording(true);
    recognition.onend = () => setIsRecording(false);
    recognition.onerror = () => setIsRecording(false);

    recognition.onresult = (event: any) => {
      const text = event.results[0][0].transcript;
      setNewRecipe(prev => ({ ...prev, name: text }));
    };

    recognition.start();
  };

  if (rol === 'camarero') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
        <div className="w-20 h-20 bg-rose-100 text-rose-600 rounded-3xl flex items-center justify-center mb-6">
          <ShieldCheck size={40} />
        </div>
        <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight mb-2">Acceso Restringido</h2>
        <p className="text-slate-500 max-w-md">Lo sentimos, esta sección solo está disponible para Administradores y Cocineros.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 flex items-center gap-3">
            <div className="w-12 h-12 bg-emerald-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-100">
              <ChefHat size={24} />
            </div>
            Escandallos y Recetas
          </h1>
          <p className="text-slate-500 text-sm mt-1 font-medium">Cálculo preciso de costes, mermas y márgenes de beneficio.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={handleUpdatePrices}
            disabled={isUpdatingPrices}
            className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-5 py-3 rounded-2xl text-sm font-bold hover:bg-slate-50 transition-all shadow-sm disabled:opacity-50"
          >
            <TrendingUp size={18} className={cn("text-emerald-500", isUpdatingPrices && "animate-bounce")} />
            {isUpdatingPrices ? "Actualizando..." : "Actualizar Precios"}
          </button>
          <button 
            onClick={() => setShowAdjustWasteModal(true)}
            className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-5 py-3 rounded-2xl text-sm font-bold hover:bg-slate-50 transition-all shadow-sm"
          >
            <Scale size={18} className="text-amber-500" />
            Gestión de Mermas
          </button>
          {rol === 'admin' && (
            <button 
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-3 rounded-2xl text-sm font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
            >
              <Plus size={18} />
              Nueva Receta
            </button>
          )}
        </div>
      </div>
          <div className="flex gap-1.5 p-1.5 bg-slate-100 rounded-2xl w-fit">
            {[
              { id: 'escandallo', label: 'Escandallos', icon: FileText },
              { id: 'analisis', label: 'Ingeniería de Menú', icon: PieChart },
              { id: 'optimizacion', label: 'Optimización IA', icon: Brain },
              { id: 'mermas', label: 'Gestión de Mermas', icon: Trash2 },
              { id: 'innovaciones', label: 'Innovaciones', icon: Lightbulb },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  "flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black transition-all uppercase tracking-widest",
                  activeTab === tab.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                )}
              >
                <tab.icon size={14} />
                {tab.label}
              </button>
            ))}
          </div>

      <AnimatePresence mode="wait">
        {activeTab === 'escandallo' && (
          <motion.div 
            key="escandallo"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-8"
          >
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100">
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                      type="text" 
                      placeholder="Buscar receta..." 
                      className="w-full pl-12 pr-6 py-3 bg-slate-50 border-none rounded-2xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 transition-all"
                    />
                  </div>
                </div>
                <div className="divide-y divide-slate-50 max-h-[600px] overflow-y-auto">
                  {recipes.map((recipe) => (
                    <button
                      key={recipe.id}
                      onClick={() => setSelectedRecipeId(recipe.id)}
                      className={cn(
                        "w-full flex items-center justify-between p-6 text-left transition-all group",
                        selectedRecipeId === recipe.id ? "bg-emerald-50" : "hover:bg-slate-50"
                      )}
                    >
                      <div>
                        <p className={cn("font-black text-sm", selectedRecipeId === recipe.id ? "text-emerald-700" : "text-slate-700")}>
                          {recipe.name}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{recipe.category}</p>
                          <span className="w-1 h-1 bg-slate-200 rounded-full" />
                          <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{calculateTotalCost(recipe).toFixed(2)}€</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            const duplicated = {
                              ...recipe,
                              id: Math.random().toString(36).substr(2, 9),
                              name: `${recipe.name} (Copia)`
                            };
                            setRecipes(prev => [duplicated, ...prev]);
                            showToast('Receta duplicada');
                          }}
                          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-xl transition-all"
                        >
                          <Copy size={16} />
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`¿Estás seguro de eliminar ${recipe.name}?`)) {
                              setRecipes(prev => prev.filter(r => r.id !== recipe.id));
                              if (selectedRecipeId === recipe.id) {
                                setSelectedRecipeId(recipes.find(r => r.id !== recipe.id)?.id || '');
                              }
                              showToast('Receta eliminada');
                            }
                          }}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-white rounded-xl transition-all"
                        >
                          <Trash2 size={16} />
                        </button>
                        <ChevronRight size={18} className={cn("transition-transform", selectedRecipeId === recipe.id ? "text-emerald-600 translate-x-1" : "text-slate-300")} />
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {selectedRecipe && (
                <div className="space-y-6">
                  <div className="bg-slate-900 text-white p-8 rounded-[2.5rem] shadow-2xl shadow-slate-200 relative overflow-hidden group">
                    <div className="absolute -right-4 -top-4 w-32 h-32 bg-white/5 rounded-full blur-3xl group-hover:scale-110 transition-transform" />
                    <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 mb-8 relative z-10">Resumen Financiero</h4>
                    <div className="space-y-8 relative z-10">
                      <div className="flex justify-between items-end">
                        <span className="text-xs text-slate-400 font-black uppercase tracking-widest">Coste x Ración</span>
                        <span className="text-3xl font-black">{calculateTotalCost(selectedRecipe).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
                      </div>
                      <div className="flex justify-between items-end">
                        <span className="text-xs text-slate-400 font-black uppercase tracking-widest">PVP Recomendado</span>
                        <span className="text-3xl font-black text-emerald-400">{calculateRecommendedPrice(selectedRecipe).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
                      </div>
                      <div className="pt-8 border-t border-white/10">
                        <div className="flex justify-between text-xs mb-3">
                          <span className="text-slate-400 font-black uppercase tracking-widest">Margen de Beneficio</span>
                          <span className="font-black text-emerald-400">{selectedRecipe.margin}%</span>
                        </div>
                        <div className="w-full bg-white/10 h-3 rounded-full overflow-hidden">
                          <div className="bg-emerald-500 h-full transition-all duration-1000" style={{ width: `${selectedRecipe.margin}%` }} />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* What-if Simulator */}
                  <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Simulador de Margen</h4>
                      <Settings2 size={16} className="text-slate-400" />
                    </div>
                    <div className="space-y-6">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-bold text-slate-700">Margen Objetivo</span>
                        <span className="text-lg font-black text-indigo-600">{simulatedMargin}%</span>
                      </div>
                      <input 
                        type="range" 
                        min="10" 
                        max="90" 
                        value={simulatedMargin}
                        onChange={(e) => setSimulatedMargin(parseInt(e.target.value))}
                        className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                      />
                      <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-[10px] font-black text-indigo-700 uppercase tracking-widest">Nuevo PVP</span>
                          <span className="text-xl font-black text-indigo-900">
                            {(calculateTotalCost(selectedRecipe) / (1 - simulatedMargin / 100)).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-[10px] text-indigo-500 font-bold">
                          <span>Diferencia vs Actual</span>
                          <span className={cn(
                            (calculateTotalCost(selectedRecipe) / (1 - simulatedMargin / 100)) > calculateRecommendedPrice(selectedRecipe) ? "text-emerald-600" : "text-rose-600"
                          )}>
                            {((calculateTotalCost(selectedRecipe) / (1 - simulatedMargin / 100)) - calculateRecommendedPrice(selectedRecipe)).toLocaleString('es-ES', { style: 'currency', currency: 'EUR', signDisplay: 'always' })}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="lg:col-span-2">
              {selectedRecipe ? (
                <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-10 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
                    <div>
                      <h2 className="text-3xl font-black text-slate-900 tracking-tight">{selectedRecipe.name}</h2>
                      <div className="flex items-center gap-6 mt-3">
                        <span className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-white px-3 py-1.5 rounded-full shadow-sm">
                          <Users size={14} className="text-emerald-600" /> {selectedRecipe.servings} Pax
                        </span>
                        <span className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-white px-3 py-1.5 rounded-full shadow-sm">
                          <Clock size={14} className="text-emerald-600" /> 15 min
                        </span>
                        <div className="flex items-center gap-1">
                          {['GL', 'LC', 'HS'].map(allergen => (
                            <span key={allergen} className="w-6 h-6 rounded-full bg-rose-50 text-rose-600 text-[8px] font-black flex items-center justify-center border border-rose-100" title="Alérgeno">
                              {allergen}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setIsEditingIngredients(!isEditingIngredients)}
                        className={cn(
                          "p-3 rounded-2xl transition-all shadow-sm bg-white flex items-center gap-2 px-4",
                          isEditingIngredients ? "text-emerald-600 bg-emerald-50 border-emerald-200" : "text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                        )} 
                        title={isEditingIngredients ? "Guardar Cambios" : "Editar Ingredientes"}
                      >
                        {isEditingIngredients ? <Save size={20} /> : <Settings2 size={20} />}
                        <span className="text-[10px] font-black uppercase tracking-widest">{isEditingIngredients ? "Guardar" : "Editar"}</span>
                      </button>
                      <button className="p-3 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-2xl transition-all shadow-sm bg-white" title="Exportar PDF">
                        <FileDown size={20} />
                      </button>
                      <button className="p-3 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-2xl transition-all shadow-sm bg-white" title="Historial de Precios">
                        <History size={20} />
                      </button>
                      <button className="p-3 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-2xl transition-all shadow-sm bg-white">
                        <MoreVertical size={20} />
                      </button>
                    </div>
                  </div>

                  <div className="p-0">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50/50 border-b border-slate-100">
                          <th className="px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Ingrediente</th>
                          <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Cant. Neta</th>
                          <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Merma %</th>
                          <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Cant. Bruta</th>
                          <th className="px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Coste</th>
                          {isEditingIngredients && <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Acciones</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        <AnimatePresence>
                          {(selectedRecipe?.ingredients ?? []).map((ing, index) => {
                            const gross = ing.quantity / (1 - ing.wastePercentage / 100);
                            const cost = gross * ing.pricePerUnit;
                            return (
                              <motion.tr 
                                key={ing.id}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.05 }}
                                className="hover:bg-slate-50/30 even:bg-slate-50/10 transition-colors group"
                              >
                                <td className="px-10 py-6">
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 group-hover:bg-emerald-100 group-hover:text-emerald-600 transition-colors">
                                      <Layers size={14} />
                                    </div>
                                    <div>
                                      {isEditingIngredients ? (
                                        <input 
                                          type="text" 
                                          className="text-sm font-black text-slate-700 bg-transparent border-b border-slate-200 focus:border-emerald-500 outline-none"
                                          value={ing.name}
                                          onChange={(e) => {
                                            const updated = [...(selectedRecipe?.ingredients ?? [])];
                                            updated[index] = { ...updated[index], name: e.target.value };
                                            handleUpdateRecipeIngredients(updated);
                                          }}
                                        />
                                      ) : (
                                        <p className="text-sm font-black text-slate-700">{ing.name}</p>
                                      )}
                                      <p className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">Ref: INV-{ing.id.slice(0,4)}</p>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-6 py-6 text-sm font-mono text-slate-500 text-center">
                                  {isEditingIngredients ? (
                                    <div className="flex items-center justify-center gap-1">
                                      <input 
                                        type="number" 
                                        className="w-16 text-center bg-transparent border-b border-slate-200 focus:border-emerald-500 outline-none"
                                        value={ing.quantity}
                                        onChange={(e) => {
                                          const updated = [...(selectedRecipe?.ingredients ?? [])];
                                          updated[index] = { ...updated[index], quantity: parseFloat(e.target.value) || 0 };
                                          handleUpdateRecipeIngredients(updated);
                                        }}
                                      />
                                      <span>{ing.unit}</span>
                                    </div>
                                  ) : (
                                    <>{ing.quantity} {ing.unit}</>
                                  )}
                                </td>
                                <td className="px-6 py-6 text-center">
                                  {isEditingIngredients ? (
                                    <input 
                                      type="number" 
                                      className="w-12 text-center bg-transparent border-b border-slate-200 focus:border-emerald-500 outline-none"
                                      value={ing.wastePercentage}
                                      onChange={(e) => {
                                        const updated = [...(selectedRecipe?.ingredients ?? [])];
                                        updated[index] = { ...updated[index], wastePercentage: parseFloat(e.target.value) || 0 };
                                        handleUpdateRecipeIngredients(updated);
                                      }}
                                    />
                                  ) : (
                                    <span className={cn(
                                      "text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest",
                                      ing.wastePercentage > 20 ? "bg-rose-50 text-rose-600" : "bg-slate-100 text-slate-500"
                                    )}>
                                      {ing.wastePercentage}%
                                    </span>
                                  )}
                                </td>
                                <td className="px-6 py-6 text-sm font-mono text-slate-400 text-center">{gross.toFixed(2)} {ing.unit}</td>
                                <td className="px-10 py-6 text-sm font-black text-slate-900 text-right">
                                  <div className="flex flex-col items-end">
                                    <span>{cost.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
                                    <span className="text-[9px] text-slate-400 font-bold uppercase">{(cost / selectedRecipe.servings).toFixed(2)}€ / pax</span>
                                  </div>
                                </td>
                                {isEditingIngredients && (
                                  <td className="px-6 py-6 text-center">
                                    <button 
                                      onClick={() => {
                                        const updated = selectedRecipe?.ingredients.filter((_, i) => i !== index);
                                        handleUpdateRecipeIngredients(updated);
                                      }}
                                      className="p-2 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  </td>
                                )}
                              </motion.tr>
                            );
                          })}
                        </AnimatePresence>
                        {isEditingIngredients && (
                          <tr>
                            <td colSpan={6} className="px-10 py-4">
                              <button 
                                onClick={() => {
                                  const newIng: RecipeIngredient = {
                                    id: Math.random().toString(36).substr(2, 9),
                                    name: 'Nuevo Ingrediente',
                                    quantity: 0,
                                    unit: 'kg',
                                    pricePerUnit: 1,
                                    wastePercentage: 0
                                  };
                                  handleUpdateRecipeIngredients([...selectedRecipe?.ingredients, newIng]);
                                }}
                                className="w-full py-3 border-2 border-dashed border-slate-200 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:border-emerald-500 hover:text-emerald-600 transition-all flex items-center justify-center gap-2"
                              >
                                <Plus size={14} />
                                Añadir Ingrediente
                              </button>
                            </td>
                          </tr>
                        )}
                        <tr className="bg-slate-50/30">
                          <td colSpan={4} className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Mano de Obra (Estimada)</td>
                          <td className="px-10 py-6 text-sm font-black text-slate-900 text-right">
                            {isEditingIngredients ? (
                              <input 
                                type="number" 
                                step="0.01"
                                className="w-24 text-right bg-transparent border-b border-slate-200 focus:border-emerald-500 outline-none"
                                value={selectedRecipe.laborCost}
                                onChange={(e) => {
                                  setRecipes(prev => prev.map(r => 
                                    r.id === selectedRecipeId ? { ...r, laborCost: parseFloat(e.target.value) || 0 } : r
                                  ));
                                }}
                              />
                            ) : (
                              selectedRecipe.laborCost.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })
                            )}
                          </td>
                          {isEditingIngredients && <td />}
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="p-10 bg-slate-50/50 border-t border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-10">
                    <div>
                      <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-6">Instrucciones</h4>
                      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm text-sm text-slate-600 leading-relaxed h-48 overflow-y-auto">
                        {selectedRecipe.instructions || "No hay instrucciones detalladas para esta receta."}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-6">Información Nutricional (IA)</h4>
                      <div className="grid grid-cols-2 gap-4">
                        {[
                          { label: 'Calorías', value: '450 kcal', color: 'text-blue-600', bg: 'bg-blue-50' },
                          { label: 'Proteínas', value: '32g', color: 'text-emerald-600', bg: 'bg-emerald-50' },
                          { label: 'Grasas', value: '18g', color: 'text-amber-600', bg: 'bg-amber-50' },
                          { label: 'Carbohidratos', value: '42g', color: 'text-indigo-600', bg: 'bg-indigo-50' },
                        ].map(nutri => (
                          <div key={nutri.label} className={cn("p-4 rounded-2xl border border-transparent flex flex-col items-center justify-center", nutri.bg)}>
                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">{nutri.label}</span>
                            <span className={cn("text-sm font-black", nutri.color)}>{nutri.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="bg-rose-50 p-6 rounded-[2rem] border border-rose-100 shadow-sm">
                      <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-400 mb-4 flex items-center gap-2">
                        <TrendingDown size={14} />
                        Impacto de Mermas
                      </h4>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-rose-600">Coste Acumulado</span>
                          <span className="text-sm font-black text-rose-700">
                            {formatCurrency(wasteRecords.filter(r => r.dishId === selectedRecipe.id).reduce((acc, r) => acc + r.cost, 0))}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-rose-600">Registros</span>
                          <span className="text-[10px] font-black text-rose-400 uppercase tracking-widest">
                            {wasteRecords.filter(r => r.dishId === selectedRecipe.id).length} incidencias
                          </span>
                        </div>
                        <div className="pt-4 border-t border-rose-100">
                          <button 
                            onClick={() => setActiveTab('mermas')}
                            className="w-full py-3 bg-rose-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-700 transition-all"
                          >
                            Ver Detalle Mermas
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-12 bg-white rounded-[3rem] border-2 border-dashed border-slate-200">
                  <div className="w-24 h-24 bg-slate-50 rounded-[2rem] flex items-center justify-center text-slate-200 mb-6">
                    <ChefHat size={48} />
                  </div>
                  <h3 className="text-xl font-black text-slate-400 uppercase tracking-[0.2em]">Selecciona una receta para ver su escandallo</h3>
                  <p className="text-sm text-slate-400 mt-2 font-medium">Elige una receta de la lista para ver sus ingredientes, costes y análisis de rentabilidad</p>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {activeTab === 'analisis' && (
          <motion.div 
            key="analisis"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-10"
          >
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {[
                { label: 'Platos Estrella', value: '8', color: 'text-emerald-600', bg: 'bg-emerald-50', icon: Sparkles },
                { label: 'Platos Perro', value: '3', color: 'text-rose-600', bg: 'bg-rose-50', icon: TrendingDown },
                { label: 'Margen Medio', value: '72%', color: 'text-blue-600', bg: 'bg-blue-50', icon: PieChart },
                { label: 'Coste Medio MP', value: '28%', color: 'text-amber-600', bg: 'bg-amber-50', icon: Target },
              ].map((stat) => (
                <div key={stat.label} className="p-8 bg-white rounded-[2.5rem] border border-slate-200 shadow-sm group hover:border-blue-200 transition-all">
                  <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform", stat.bg, stat.color)}>
                    <stat.icon size={28} />
                  </div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{stat.label}</p>
                  <p className="text-3xl font-black text-slate-900 mt-2">{stat.value}</p>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-[3rem] border border-slate-200 shadow-sm p-12">
              <div className="flex items-center justify-between mb-12">
                <div>
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Matriz de Ingeniería de Menú</h3>
                  <p className="text-slate-500 text-sm mt-1 font-medium">Visualización estratégica de rentabilidad vs popularidad.</p>
                </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
                <div className="aspect-square bg-slate-50 rounded-[3rem] relative border border-slate-200 p-12 shadow-inner">
                  <div className="absolute inset-0 grid grid-cols-2 grid-rows-2">
                    <div className="border-r border-b border-slate-200 flex flex-col items-center justify-center p-8 bg-emerald-50/30">
                      <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-4">Estrellas</span>
                      <div className="flex flex-wrap gap-2 justify-center">
                        <div className="w-4 h-4 bg-emerald-500 rounded-full shadow-sm shadow-emerald-200" />
                        <div className="w-4 h-4 bg-emerald-500 rounded-full shadow-sm shadow-emerald-200" />
                        <div className="w-4 h-4 bg-emerald-500 rounded-full shadow-sm shadow-emerald-200" />
                      </div>
                    </div>
                    <div className="border-b border-slate-200 flex flex-col items-center justify-center p-8 bg-blue-50/30">
                      <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-4">Puzzles</span>
                      <div className="flex flex-wrap gap-2 justify-center">
                        <div className="w-4 h-4 bg-blue-500 rounded-full shadow-sm shadow-blue-200" />
                      </div>
                    </div>
                    <div className="border-r border-slate-200 flex flex-col items-center justify-center p-8 bg-amber-50/30">
                      <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-4">Vacas</span>
                      <div className="flex flex-wrap gap-2 justify-center">
                        <div className="w-4 h-4 bg-amber-500 rounded-full shadow-sm shadow-amber-200" />
                        <div className="w-4 h-4 bg-amber-500 rounded-full shadow-sm shadow-amber-200" />
                      </div>
                    </div>
                    <div className="flex flex-col items-center justify-center p-8 bg-rose-50/30">
                      <span className="text-[10px] font-black text-rose-600 uppercase tracking-widest mb-4">Perros</span>
                      <div className="flex flex-wrap gap-2 justify-center">
                        <div className="w-4 h-4 bg-rose-500 rounded-full shadow-sm shadow-rose-200" />
                      </div>
                    </div>
                  </div>
                  <div className="absolute -left-8 top-1/2 -translate-y-1/2 -rotate-90 text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Rentabilidad</div>
                  <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Popularidad</div>
                </div>
                <div className="space-y-8">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Análisis de Tendencias</h4>
                  <div className="h-64 w-full min-h-[256px]">
                    <ResponsiveContainer width="100%" height="100%" minHeight={256}>
                      <LineChart data={[
                        { name: 'Ene', cost: 2.4 },
                        { name: 'Feb', cost: 2.6 },
                        { name: 'Mar', cost: 2.5 },
                        { name: 'Abr', cost: 2.8 },
                        { name: 'May', cost: 3.1 },
                        { name: 'Jun', cost: 2.9 },
                      ]}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                        <Tooltip 
                          contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        />
                        <Line type="monotone" dataKey="cost" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: '#10b981' }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                    <p className="text-xs font-medium text-slate-600 leading-relaxed">
                      Se observa un incremento del <span className="text-rose-600 font-black">12%</span> en el coste medio de materia prima en los últimos 3 meses, principalmente debido al aumento en proteínas. Se recomienda revisar precios de carta.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'optimizacion' && (
          <motion.div 
            key="optimizacion"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="space-y-8"
          >
            <div className="bg-slate-900 rounded-[3rem] p-12 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 p-12 opacity-10">
                <Brain size={160} />
              </div>
              <div className="relative z-10 max-w-2xl">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-14 h-14 bg-indigo-500 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
                    <Brain size={32} />
                  </div>
                  <div>
                    <h3 className="text-3xl font-black uppercase tracking-tight">Optimización IA</h3>
                    <p className="text-indigo-400 text-sm font-bold uppercase tracking-widest mt-1">Análisis Proactivo de Recetas y Márgenes</p>
                  </div>
                </div>
                <p className="text-slate-400 text-lg font-medium leading-relaxed mb-10">
                  Nuestra inteligencia artificial analiza tus escandallos comparándolos con el histórico de ventas, mermas registradas y tendencias de mercado para sugerir cambios que maximicen tu beneficio.
                </p>
                <div className="flex flex-col sm:flex-row sm:items-center gap-6">
                  <button 
                    onClick={() => handleOptimize(false)}
                    disabled={isOptimizing}
                    className="bg-white text-slate-900 px-10 py-5 rounded-[2rem] text-xs font-black uppercase tracking-widest hover:bg-indigo-50 transition-all shadow-xl shadow-white/5 flex items-center gap-3"
                  >
                    {isOptimizing && !aiOptimizationResult?.isGlobal ? (
                      <>
                        <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                        Analizando Plato...
                      </>
                    ) : (
                      <>
                        <Zap size={18} className="text-amber-500" />
                        Analizar Plato Actual
                      </>
                    )}
                  </button>
                  <button 
                    onClick={() => handleOptimize(true)}
                    disabled={isOptimizing}
                    className="bg-indigo-600 text-white px-10 py-5 rounded-[2rem] text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 flex items-center gap-3"
                  >
                    {isOptimizing && aiOptimizationResult?.isGlobal ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Análisis Global...
                      </>
                    ) : (
                      <>
                        <Sparkles size={18} className="text-amber-300" />
                        Análisis Estratégico Global
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-8">
                <div className="bg-white rounded-[3rem] border border-slate-200 shadow-sm p-10">
                  <h4 className="text-sm font-black uppercase tracking-widest text-slate-900 mb-8 flex items-center gap-2">
                    <Lightbulb size={18} className="text-amber-500" />
                    {aiOptimizationResult?.isGlobal ? 'Estrategia de Optimización Global' : 'Recomendaciones Estratégicas'} 
                    {aiOptimizationResult && <span className="text-xs font-bold text-emerald-600 ml-auto">Análisis Completado</span>}
                  </h4>
                  <div className="space-y-6">
                    {aiOptimizationResult ? (
                      aiOptimizationResult.recommendations.map((rec, i) => (
                        <div key={i} className="flex items-start gap-6 p-6 bg-slate-50 rounded-[2.5rem] border border-slate-100 hover:bg-white hover:shadow-md transition-all group">
                          <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                            {aiOptimizationResult.isGlobal ? <Target size={24} className="text-indigo-600" /> : <Zap size={24} className="text-indigo-600" />}
                          </div>
                          <div className="flex-1">
                            <div className="flex justify-between items-start mb-2">
                              <h5 className="text-base font-black text-slate-900">{rec}</h5>
                            </div>
                            <p className="text-sm text-slate-500 font-medium leading-relaxed">
                              {aiOptimizationResult.isGlobal 
                                ? "Sugerencia estratégica para mejorar la rentabilidad operativa de todo el restaurante."
                                : `Sugerencia generada por IA para optimizar el rendimiento de ${selectedRecipe?.name}.`}
                            </p>
                            <div className="mt-4 flex gap-2">
                              <button onClick={applyAiOptimization} className="text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:underline">Aplicar ahora</button>
                              <span className="text-slate-300">|</span>
                              <button className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:underline">Ver detalles</button>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-12">
                        <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                          <Brain size={32} className="text-slate-300" />
                        </div>
                        <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Inicia el análisis para recibir recomendaciones</p>
                      </div>
                    )}
                  </div>
                  
                  {aiOptimizationResult?.marketTrend && (
                    <div className="mt-8 p-6 bg-amber-50 rounded-[2rem] border border-amber-100">
                      <h5 className="text-[10px] font-black uppercase tracking-widest text-amber-700 mb-2 flex items-center gap-2">
                        <TrendingUp size={14} />
                        Tendencia de Mercado
                      </h5>
                      <p className="text-sm text-amber-900 font-medium leading-relaxed italic">
                        "{aiOptimizationResult.marketTrend}"
                      </p>
                    </div>
                  )}

                  {selectedRecipe?.name === 'Spider Tartar de Atún' && (
                    <div className="mt-8 p-8 bg-slate-900 rounded-[2.5rem] text-white overflow-hidden relative group">
                      <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform">
                        <Target size={120} />
                      </div>
                      <h5 className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-4 flex items-center gap-2">
                        <Sparkles size={14} />
                        Análisis de Plato Estrella
                      </h5>
                      <h6 className="text-xl font-black mb-6">Spider Tartar de Atún</h6>
                      <div className="grid grid-cols-2 gap-6 relative z-10">
                        <div className="space-y-2">
                          <p className="text-[10px] font-bold text-slate-400 uppercase">Punto Crítico</p>
                          <p className="text-sm font-medium">Merma de Aguacate (35%)</p>
                          <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                            <div className="w-[35%] h-full bg-rose-500" />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <p className="text-[10px] font-bold text-slate-400 uppercase">Oportunidad</p>
                          <p className="text-sm font-medium">Margen Bruto (+12%)</p>
                          <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                            <div className="w-[78%] h-full bg-emerald-500" />
                          </div>
                        </div>
                      </div>
                      <div className="mt-8 pt-6 border-t border-white/10">
                        <p className="text-xs text-slate-300 leading-relaxed italic">
                          "Optimizar el corte del atún y el aprovechamiento del aguacate podría aumentar el beneficio neto por plato en 2.45€."
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-8">
                <div className="bg-white rounded-[3rem] border border-slate-200 shadow-sm p-10">
                  <h4 className="text-sm font-black uppercase tracking-widest text-slate-900 mb-8 flex items-center gap-2">
                    <BarChart size={18} className="text-indigo-600" />
                    Perfil de Optimización
                  </h4>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%" style={{ minHeight: 300 }}>
                      <RadarChart cx="50%" cy="50%" outerRadius="80%" data={[
                        { subject: 'Coste MP', A: 120, fullMark: 150 },
                        { subject: 'Mermas', A: 98, fullMark: 150 },
                        { subject: 'Margen', A: 86, fullMark: 150 },
                        { subject: 'Popularidad', A: 99, fullMark: 150 },
                        { subject: 'Eficiencia', A: 85, fullMark: 150 },
                      ]}>
                        <PolarGrid stroke="#f1f5f9" />
                        <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} />
                        <Radar name="Actual" dataKey="A" stroke="#6366f1" fill="#6366f1" fillOpacity={0.5} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                    <div className="mt-8 space-y-4">
                      {aiOptimizationResult && (
                        <div className="p-6 bg-indigo-50 rounded-2xl border border-indigo-100">
                          <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-1">Ahorro Estimado</p>
                          <p className="text-2xl font-black text-indigo-600">
                            {aiOptimizationResult.isGlobal ? formatCurrency(aiOptimizationResult.potentialSavings) : `${aiOptimizationResult.potentialSavings.toFixed(2)}€ / pax`}
                          </p>
                        </div>
                      )}
                      <div className="flex justify-between items-center p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                        <span className="text-xs font-black text-emerald-700 uppercase tracking-widest">Salud de Carta</span>
                        <span className="text-lg font-black text-emerald-900">8.4 / 10</span>
                      </div>
                    <p className="text-[10px] text-slate-400 font-medium text-center italic">
                      "Tu carta está bien balanceada, pero hay margen de mejora en la gestión de mermas de vegetales."
                    </p>
                  </div>
                </div>

                <div className="bg-indigo-600 rounded-[3rem] p-10 text-white shadow-xl shadow-indigo-200">
                  <h4 className="text-sm font-black uppercase tracking-widest mb-6 flex items-center gap-2">
                    <Maximize2 size={18} />
                    Roadmap de Funciones
                  </h4>
                  <div className="space-y-4">
                    {[
                      { label: 'Neuro-Pricing (Menu Engineering)', status: 'I+D' },
                      { label: 'Hyper-Local Sourcing AI', status: 'Beta' },
                      { label: 'Biometric Personalization', status: 'Planificado' },
                      { label: 'Blockchain Supply Chain', status: 'Planificado' },
                      { label: 'Autonomous Delivery API', status: 'I+D' },
                      { label: 'Virtual Kitchen Digital Twin', status: 'Planificado' },
                      { label: 'Molecular Inventory Analysis', status: 'I+D' },
                      { label: 'Voice-Controlled Kitchen OS', status: 'Beta' },
                      { label: 'Predictive Maintenance IoT', status: 'Planificado' },
                      { label: 'Holographic Training AR', status: 'I+D' },
                    ].map((item, i) => (
                      <div key={i} className="flex justify-between items-center py-2 border-b border-white/10">
                        <span className="text-[10px] font-bold text-white/80">{item.label}</span>
                        <span className="text-[7px] font-black uppercase tracking-widest px-2 py-1 bg-white/10 rounded-md">
                          {item.status}
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-white/60 mt-6 leading-relaxed">
                    Estamos trabajando para integrar funciones avanzadas similares a Odoo y Holded para una gestión 360°.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'mermas' && (
          <motion.div 
            key="mermas"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-8"
          >
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {[
                { label: 'Total Mermas Mes', value: '1.240,50€', icon: TrendingDown, color: 'text-rose-600', bg: 'bg-rose-50', tooltip: 'Valor total acumulado de ingredientes desperdiciados este mes.' },
                { label: 'Impacto en Margen', value: '-4.2%', icon: AlertCircle, color: 'text-amber-600', bg: 'bg-amber-50', tooltip: 'Reducción porcentual del margen de beneficio debido a las mermas.' },
                { label: 'Plato más Afectado', value: 'Lubina a la Sal', icon: ChefHat, color: 'text-indigo-600', bg: 'bg-indigo-50', tooltip: 'Plato con mayor coste acumulado por desperdicio.' },
                { label: 'Eficiencia de Stock', value: '92.8%', icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50', tooltip: 'Porcentaje de ingredientes utilizados correctamente vs comprados.' },
              ].map((stat, i) => (
                <div key={i} className={cn("p-8 rounded-[2.5rem] border border-transparent shadow-sm flex flex-col items-center text-center relative group", stat.bg)}>
                  <div className="absolute top-4 right-4 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity cursor-help" title={stat.tooltip}>
                    <HelpCircle size={14} />
                  </div>
                  <div className={cn("p-4 rounded-2xl mb-4 bg-white shadow-sm", stat.color)}>
                    <stat.icon size={24} />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">{stat.label}</span>
                  <span className={cn("text-2xl font-black", stat.color)}>{stat.value}</span>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 bg-white rounded-[3rem] border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-10 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Registro de Mermas</h3>
                  <button 
                    onClick={() => setShowMermasModal(true)}
                    className="flex items-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg"
                  >
                    <Plus size={16} />
                    Registrar Merma
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/50 border-b border-slate-100">
                        <th className="px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Fecha</th>
                        <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Plato / Ingrediente</th>
                        <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Motivo</th>
                        <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Cantidad</th>
                        <th className="px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Impacto</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {wasteRecords.map((record, i) => (
                        <tr key={record.id} className="hover:bg-slate-50/30 even:bg-slate-50/10 transition-colors group">
                          <td className="px-10 py-6 text-sm font-bold text-slate-500">{formatDate(record.date)}</td>
                          <td className="px-6 py-6">
                            <p className="text-sm font-black text-slate-700">{record.ingredient}</p>
                            <p className="text-[9px] text-slate-400 font-bold uppercase">{mockRecipes.find(r => r.id === record.dishId)?.name}</p>
                          </td>
                          <td className="px-6 py-6">
                            <span className={cn(
                              "text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest",
                              record.reason === 'Caducidad' ? "bg-rose-50 text-rose-600" : 
                              record.reason === 'Deterioro' ? "bg-amber-50 text-amber-600" : "bg-indigo-50 text-indigo-600"
                            )}>
                              {record.reason}
                            </span>
                          </td>
                          <td className="px-6 py-6 text-sm font-mono text-slate-500 text-center">{record.amount} {record.unit}</td>
                          <td className="px-10 py-6 text-sm font-black text-rose-600 text-right">-{formatCurrency(record.cost)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="space-y-8">
                <div className="bg-white rounded-[3rem] border border-slate-200 shadow-sm p-10">
                  <h4 className="text-sm font-black uppercase tracking-widest text-slate-900 mb-8 flex items-center gap-2">
                    <PieChart size={18} className="text-rose-600" />
                    Motivos de Merma
                  </h4>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%" style={{ minHeight: 300 }}>
                      <RadarChart cx="50%" cy="50%" outerRadius="80%" data={[
                        { subject: 'Caducidad', A: 45, fullMark: 100 },
                        { subject: 'Deterioro', A: 30, fullMark: 100 },
                        { subject: 'Prep. Error', A: 15, fullMark: 100 },
                        { subject: 'Sobras', A: 10, fullMark: 100 },
                      ]}>
                        <PolarGrid stroke="#f1f5f9" />
                        <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} />
                        <Radar name="Motivos" dataKey="A" stroke="#f43f5e" fill="#f43f5e" fillOpacity={0.5} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-slate-900 rounded-[3rem] p-10 text-white shadow-xl shadow-slate-200">
                  <h4 className="text-sm font-black uppercase tracking-widest mb-6 flex items-center gap-2">
                    <Sparkles size={18} className="text-amber-400" />
                    Insights de IA
                  </h4>
                  <div className="space-y-6">
                    <div className="p-6 bg-white/5 rounded-2xl border border-white/10">
                      <p className="text-xs text-white/80 leading-relaxed italic">
                        "Hemos detectado que el 40% de tus mermas de 'Tomate Cherry' ocurren los martes. Considera reducir el pedido de los lunes en un 15%."
                      </p>
                    </div>
                    <div className="flex items-center gap-4 p-4 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
                      <TrendingUp size={20} className="text-emerald-400" />
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Ahorro Estimado</p>
                        <p className="text-lg font-black text-white">145,00€ / mes</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'innovaciones' && (
          <motion.div 
            key="innovaciones"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-10"
          >
            <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-[3rem] p-16 text-white relative overflow-hidden shadow-2xl shadow-indigo-200">
              <div className="absolute top-0 right-0 p-16 opacity-10">
                <Zap size={200} />
              </div>
              <div className="relative z-10 max-w-3xl">
                <h3 className="text-4xl font-black uppercase tracking-tight mb-6">Próxima Generación: Gestión 360°</h3>
                <p className="text-indigo-100 text-lg font-medium leading-relaxed mb-10 opacity-90">
                  Explora las innovaciones tecnológicas que transformarán la rentabilidad y eficiencia de tu restaurante en los próximos meses.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[
                {
                  title: "Predicción de Demanda por IA",
                  desc: "Algoritmos que analizan el clima, eventos locales y festivos para predecir cuántos clientes vendrán y qué pedirán, optimizando las compras.",
                  icon: TrendingUp,
                  color: "text-emerald-600",
                  bg: "bg-emerald-50"
                },
                {
                  title: "Escaneo de Mermas con Visión Artificial",
                  desc: "Cámaras sobre los cubos de basura que identifican qué ingredientes se tiran más y sugieren ajustes en las raciones o técnicas de corte.",
                  icon: Eye,
                  color: "text-rose-600",
                  bg: "bg-rose-50"
                },
                {
                  title: "Gestión de Precios Dinámicos",
                  desc: "Ajuste automático de precios en cartas digitales según la demanda, hora del día o stock disponible (Happy Hour inteligente).",
                  icon: Zap,
                  color: "text-amber-600",
                  bg: "bg-amber-50"
                },
                {
                  title: "Integración IoT en Cámaras",
                  desc: "Sensores de temperatura y humedad conectados que alertan antes de que un producto se eche a perder, reduciendo el desperdicio.",
                  icon: Package,
                  color: "text-blue-600",
                  bg: "bg-blue-50"
                },
                {
                  title: "Fidelización por Reconocimiento Facial",
                  desc: "Identificación de clientes habituales al entrar para ofrecerles su mesa favorita o sugerir platos basados en sus gustos previos.",
                  icon: User,
                  color: "text-indigo-600",
                  bg: "bg-indigo-50"
                },
                {
                  title: "Robotización de Inventario",
                  desc: "Drones o robots pequeños que realizan el inventario nocturno escaneando estanterías y actualizando el stock en tiempo real.",
                  icon: RefreshCw,
                  color: "text-violet-600",
                  bg: "bg-violet-50"
                },
                {
                  title: "Blockchain en Trazabilidad",
                  desc: "Seguimiento inmutable de cada ingrediente desde la granja hasta el plato, garantizando frescura y calidad al cliente final.",
                  icon: ShieldCheck,
                  color: "text-emerald-600",
                  bg: "bg-emerald-50"
                },
                {
                  title: "Cartas en Realidad Aumentada",
                  desc: "Permite a los clientes ver el plato en 3D sobre su mesa antes de pedir, mejorando la experiencia y aumentando el ticket medio.",
                  icon: Sparkles,
                  color: "text-amber-600",
                  bg: "bg-amber-50"
                },
                {
                  title: "Optimización de Turnos por IA",
                  desc: "Asignación automática de personal basada en la carga de trabajo prevista, reduciendo costes de mano de obra innecesarios.",
                  icon: Clock,
                  color: "text-blue-600",
                  bg: "bg-blue-50"
                },
                {
                  title: "Análisis de Sentimiento en Reseñas",
                  desc: "Monitorización automática de Google y TripAdvisor para detectar problemas recurrentes en platos específicos y sugerir mejoras.",
                  icon: MessageSquare,
                  color: "text-rose-600",
                  bg: "bg-rose-50"
                }
              ].map((item, i) => (
                <div key={i} className="p-10 bg-white rounded-[3rem] border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-2 transition-all group">
                  <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform", item.bg, item.color)}>
                    <item.icon size={32} />
                  </div>
                  <h4 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-4">{item.title}</h4>
                  <p className="text-slate-500 text-sm font-medium leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[3rem] w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-10 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Nueva Receta / Escandallo</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-3 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-2xl transition-all">
                <Plus size={28} className="rotate-45" />
              </button>
            </div>
            <div className="p-10 space-y-8">
              <div className="grid grid-cols-2 gap-6">
                <div className="col-span-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Nombre del Plato</label>
                  <div className="relative">
                    <input 
                      type="text" 
                      className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 transition-all pr-14" 
                      placeholder="Ej: Lubina a la Sal"
                      value={newRecipe.name}
                      onChange={e => setNewRecipe({...newRecipe, name: e.target.value})}
                    />
                    <button 
                      onClick={startVoiceInput}
                      className={cn(
                        "absolute right-2 top-1/2 -translate-y-1/2 p-3 rounded-xl transition-all",
                        isRecording ? "bg-rose-100 text-rose-600 animate-pulse" : "bg-white text-slate-400 hover:text-indigo-600 shadow-sm"
                      )}
                    >
                      {isRecording ? <MicOff size={20} /> : <Mic size={20} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Categoría</label>
                  <select 
                    className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 transition-all"
                    value={newRecipe.category}
                    onChange={e => setNewRecipe({...newRecipe, category: e.target.value})}
                  >
                    <option value="Entrantes">Entrantes</option>
                    <option value="Carnes">Carnes</option>
                    <option value="Pescados">Pescados</option>
                    <option value="Postres">Postres</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Raciones (Pax)</label>
                  <input 
                    type="number" 
                    className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 transition-all" 
                    value={newRecipe.servings}
                    onChange={e => setNewRecipe({...newRecipe, servings: parseInt(e.target.value) || 1})}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Margen Objetivo (%)</label>
                  <input 
                    type="number" 
                    className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 transition-all" 
                    value={newRecipe.margin}
                    onChange={e => setNewRecipe({...newRecipe, margin: parseInt(e.target.value) || 0})}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Coste Mano de Obra (€)</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 transition-all" 
                    value={newRecipe.laborCost}
                    onChange={e => setNewRecipe({...newRecipe, laborCost: parseFloat(e.target.value) || 0})}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ingredientes</h4>
                  <button 
                    onClick={addIngredientToNewRecipe}
                    className="text-[10px] font-black text-emerald-600 uppercase tracking-widest hover:underline flex items-center gap-1"
                  >
                    <Plus size={14} /> Añadir
                  </button>
                </div>
                <div className="space-y-3 max-h-48 overflow-y-auto pr-2">
                  {newRecipe.ingredients.map((ing, idx) => (
                    <div key={ing.id} className="grid grid-cols-12 gap-3 items-center bg-slate-50 p-3 rounded-xl">
                      <div className="col-span-6">
                        <input 
                          type="text" 
                          placeholder="Ingrediente"
                          className="w-full bg-transparent border-none text-xs font-bold focus:ring-0"
                          value={ing.name}
                          onChange={e => updateNewRecipeIngredient(idx, 'name', e.target.value)}
                        />
                      </div>
                      <div className="col-span-3">
                        <input 
                          type="number" 
                          placeholder="Cant"
                          className="w-full bg-transparent border-none text-xs font-bold focus:ring-0 text-center"
                          value={ing.quantity}
                          onChange={e => updateNewRecipeIngredient(idx, 'quantity', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div className="col-span-2">
                        <select 
                          className="w-full bg-transparent border-none text-[10px] font-bold focus:ring-0"
                          value={ing.unit}
                          onChange={e => updateNewRecipeIngredient(idx, 'unit', e.target.value)}
                        >
                          <option value="kg">kg</option>
                          <option value="g">g</option>
                          <option value="l">l</option>
                          <option value="unid">unid</option>
                        </select>
                      </div>
                      <div className="col-span-1 flex justify-end">
                        <button onClick={() => removeIngredientFromNewRecipe(idx)} className="text-rose-400 hover:text-rose-600">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                  {newRecipe.ingredients.length === 0 && (
                    <p className="text-center py-4 text-[10px] text-slate-400 font-bold uppercase italic">No hay ingredientes añadidos</p>
                  )}
                </div>
              </div>

              <button 
                onClick={handleCreateRecipe}
                className="w-full bg-emerald-600 text-white py-5 rounded-[2rem] font-black uppercase tracking-[0.2em] hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-100 mt-6"
              >
                Crear Receta
              </button>
            </div>
          </div>
        </div>
      )}
      {showAdjustWasteModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[3rem] w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-10 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Ajustar Mermas de Ingredientes</h2>
              <button onClick={() => setShowAdjustWasteModal(false)} className="p-3 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-2xl transition-all">
                <Plus size={28} className="rotate-45" />
              </button>
            </div>
            <div className="p-10 space-y-6">
              <div className="bg-amber-50 border border-amber-100 p-6 rounded-2xl flex items-start gap-4">
                <AlertCircle className="text-amber-600 shrink-0" size={24} />
                <div>
                  <h4 className="text-sm font-black text-amber-900 uppercase tracking-tight">Control de Desperdicio</h4>
                  <p className="text-xs text-amber-700 mt-1">Ajusta el porcentaje de merma técnica de cada ingrediente para este plato.</p>
                </div>
              </div>
              
              <div className="space-y-4">
                {(selectedRecipe?.ingredients ?? []).map((ing, i) => (
                  <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div>
                      <p className="text-sm font-black text-slate-700">{ing.name}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">Merma actual: {ing.wastePercentage}%</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <input 
                        type="number" 
                        className="w-20 px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-center"
                        value={ing.wastePercentage}
                        onChange={(e) => {
                          const updated = [...(selectedRecipe?.ingredients ?? [])];
                          updated[i] = { ...updated[i], wastePercentage: parseFloat(e.target.value) || 0 };
                          handleUpdateRecipeIngredients(updated);
                        }}
                      />
                      <span className="text-sm font-bold text-slate-500">%</span>
                    </div>
                  </div>
                ))}
              </div>

              <button 
                onClick={() => {
                  setShowAdjustWasteModal(false);
                  showToast('Mermas técnicas actualizadas correctamente');
                }}
                className="w-full bg-slate-900 text-white py-5 rounded-[2rem] font-black uppercase tracking-[0.2em] hover:bg-slate-800 transition-all shadow-xl mt-6"
              >
                Guardar Ajustes
              </button>
            </div>
          </div>
        </div>
      )}
      {showMermasModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[3rem] w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-10 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Registrar Nueva Merma</h2>
              <button onClick={() => setShowMermasModal(false)} className="p-3 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-2xl transition-all">
                <Plus size={28} className="rotate-45" />
              </button>
            </div>
            <div className="p-10 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="col-span-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Plato Afectado</label>
                  <select 
                    className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-sm font-medium focus:ring-2 focus:ring-rose-500 transition-all"
                    value={newWaste.dishId}
                    onChange={e => setNewWaste({...newWaste, dishId: e.target.value})}
                  >
                    {mockRecipes.map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Fecha</label>
                  <input 
                    type="date" 
                    className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-sm font-medium focus:ring-2 focus:ring-rose-500 transition-all"
                    value={newWaste.date}
                    onChange={e => setNewWaste({...newWaste, date: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Motivo</label>
                  <select 
                    className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-sm font-medium focus:ring-2 focus:ring-rose-500 transition-all"
                    value={newWaste.reason}
                    onChange={e => setNewWaste({...newWaste, reason: e.target.value})}
                  >
                    <option value="Caducidad">Caducidad</option>
                    <option value="Deterioro">Deterioro</option>
                    <option value="Error de preparación">Error de preparación</option>
                    <option value="Sobras">Sobras</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Ingrediente / Producto</label>
                  <input 
                    type="text" 
                    className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-sm font-medium focus:ring-2 focus:ring-rose-500 transition-all"
                    placeholder="Ej: Tomate Cherry"
                    value={newWaste.ingredient}
                    onChange={e => setNewWaste({...newWaste, ingredient: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Cantidad</label>
                  <div className="flex gap-2">
                    <input 
                      type="number" 
                      className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-sm font-medium focus:ring-2 focus:ring-rose-500 transition-all"
                      value={newWaste.amount}
                      onChange={e => setNewWaste({...newWaste, amount: parseFloat(e.target.value) || 0})}
                    />
                    <select 
                      className="w-24 px-4 py-4 bg-slate-50 border-none rounded-2xl text-sm font-medium focus:ring-2 focus:ring-rose-500 transition-all"
                      value={newWaste.unit}
                      onChange={e => setNewWaste({...newWaste, unit: e.target.value})}
                    >
                      <option value="kg">kg</option>
                      <option value="g">g</option>
                      <option value="l">l</option>
                      <option value="unid">unid</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Coste Estimado (€)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-sm font-medium focus:ring-2 focus:ring-rose-500 transition-all"
                    value={newWaste.cost}
                    onChange={e => setNewWaste({...newWaste, cost: parseFloat(e.target.value) || 0})}
                  />
                </div>
              </div>

              <button 
                onClick={() => {
                  const record = {
                    id: Math.random().toString(36).substr(2, 9),
                    ...newWaste
                  };
                  setWasteRecords([record, ...wasteRecords]);
                  showToast('Merma registrada con éxito');
                  setShowMermasModal(false);
                  setNewWaste({
                    dishId: mockRecipes[0].id,
                    date: new Date().toISOString().split('T')[0],
                    reason: 'Caducidad',
                    ingredient: '',
                    amount: 0,
                    unit: 'kg',
                    cost: 0
                  });
                }}
                className="w-full bg-rose-600 text-white py-5 rounded-[2rem] font-black uppercase tracking-[0.2em] hover:bg-rose-700 transition-all shadow-xl shadow-rose-100 mt-6"
              >
                Guardar Registro
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
