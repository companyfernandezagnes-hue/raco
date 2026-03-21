import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, Filter, MoreVertical, Eye, Trash2, CheckCircle2, Sparkles, Loader2, Upload, X, Send, ChevronDown, ChevronUp, AlertTriangle, TrendingUp, TrendingDown, RefreshCw, Package, FileText, Settings2 } from 'lucide-react';
import { DeliveryNote } from '../types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { GoogleGenAI } from "@google/genai";
import { mockAlbaranes, mockSuppliers } from '../data/mockData';
import { usePin } from '../context/PinContext';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const supplierNames: Record<string, string> = mockSuppliers.reduce((acc, s) => ({ ...acc, [s.id]: s.name }), {});

export default function AlbaranesView() {
  const { rol } = usePin();
  const [searchTerm, setSearchTerm] = React.useState('');
  const [isScanning, setIsScanning] = React.useState(false);
  const [scanProgress, setScanProgress] = React.useState(0);
  const [scanStep, setScanStep] = React.useState('');
  const [albaranes, setAlbaranes] = React.useState<DeliveryNote[]>(mockAlbaranes);
  const [showNewModal, setShowNewModal] = React.useState(false);
  const [newAlbForm, setNewAlbForm] = React.useState<{
    reference: string;
    date: string;
    supplierId: string;
    total: number;
    items: any[];
  }>({
    reference: '',
    date: new Date().toISOString().split('T')[0],
    supplierId: 's1',
    total: 0,
    items: []
  });
  const [isEditing, setIsEditing] = React.useState<string | null>(null);
  const [showQCModal, setShowQCModal] = React.useState<string | null>(null);
  const [selectedAlbaran, setSelectedAlbaran] = React.useState<DeliveryNote | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState<string | null>(null);
  const [showSyncSuccess, setShowSyncSuccess] = React.useState<{ reference: string, count: number } | null>(null);
  const [showInvoiceSuccess, setShowInvoiceSuccess] = React.useState<string | null>(null);
  const [showTelegramSuccess, setShowTelegramSuccess] = React.useState<boolean>(false);
  const [isSyncing, setIsSyncing] = React.useState<string | null>(null);
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [qcData, setQCData] = React.useState<any>(null);

  const handleSyncToStock = async (alb: DeliveryNote) => {
    setIsSyncing(alb.id);
    // Simulate sync
    await new Promise(resolve => setTimeout(resolve, 1500));
    setAlbaranes(prev => prev.map(a => a.id === alb.id ? { ...a, status: 'Recibido' } : a));
    setShowSyncSuccess({ reference: alb.reference, count: alb.items.length });
    setIsSyncing(null);
    
    // Auto send to Telegram when received
    sendToTelegram(alb);
  };

  const handleConvertToInvoice = (alb: DeliveryNote) => {
    setAlbaranes(prev => prev.map(a => a.id === alb.id ? { ...a, status: 'Facturado' } : a));
    setShowInvoiceSuccess(alb.reference);
  };

  const handleCreateAlbaran = () => {
    const newAlb: DeliveryNote = {
      id: Math.random().toString(36).substr(2, 9),
      ...newAlbForm,
      status: 'Recibido',
    };
    setAlbaranes([newAlb, ...albaranes]);
    setNewAlbForm({
      reference: '',
      date: new Date().toISOString().split('T')[0],
      supplierId: 's1',
      total: 0,
      items: []
    });
  };

  const handleEditAlbaran = (alb: DeliveryNote) => {
    setNewAlbForm({
      reference: alb.reference,
      date: alb.date,
      supplierId: alb.supplierId,
      total: alb.total,
      items: [...alb.items]
    });
    setIsEditing(alb.id);
    setShowNewModal(true);
  };

  const handleSaveAlbaran = () => {
    if (isEditing) {
      setAlbaranes(prev => prev.map(a => a.id === isEditing ? { ...a, ...newAlbForm } : a));
      setIsEditing(null);
      showToast('Albarán actualizado correctamente');
    } else {
      handleCreateAlbaran();
    }
    setShowNewModal(false);
  };

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    // Simple alert for now, could be a toast component
    alert(message);
  };

  const addLineToNewAlb = () => {
    setNewAlbForm({
      ...newAlbForm,
      items: [...newAlbForm.items, { id: Math.random().toString(36).substr(2, 5), description: '', quantity: 1, unit: 'kg', price: 0, total: 0 }]
    });
  };

  const updateNewAlbItem = (id: string, field: string, value: any) => {
    const updatedItems = newAlbForm.items.map(item => {
      if (item.id === id) {
        const newItem = { ...item, [field]: value };
        if (field === 'quantity' || field === 'price') {
          newItem.total = (newItem.quantity || 0) * (newItem.price || 0);
        }
        return newItem;
      }
      return item;
    });
    const newTotal = updatedItems.reduce((acc, item) => acc + item.total, 0);
    setNewAlbForm({ ...newAlbForm, items: updatedItems, total: newTotal });
  };
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const [showTelegramSettings, setShowTelegramSettings] = React.useState(false);
  const [telegramConfig, setTelegramConfig] = React.useState({
    botToken: localStorage.getItem('tg_bot_token') || '',
    chatId: localStorage.getItem('tg_chat_id') || ''
  });

  const saveTelegramConfig = () => {
    localStorage.setItem('tg_bot_token', telegramConfig.botToken);
    localStorage.setItem('tg_chat_id', telegramConfig.chatId);
    setShowTelegramSettings(false);
    alert('Configuración de Telegram guardada.');
  };

  const sendToTelegram = async (alb: DeliveryNote) => {
    const message = `📦 *NUEVO ALBARÁN RECIBIDO*\n\n` +
      `🔹 *Referencia:* ${alb.reference}\n` +
      `🔹 *Proveedor:* ${supplierNames[alb.supplierId]}\n` +
      `🔹 *Fecha:* ${new Date(alb.date).toLocaleDateString('es-ES')}\n` +
      `💰 *Total:* ${alb.total.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}\n\n` +
      `📋 *Productos:*\n` +
      alb.items.map(i => `• ${i.description}: ${i.quantity}${i.unit} x ${i.price}€`).join('\n');

    if (telegramConfig.botToken && telegramConfig.chatId) {
      try {
        const response = await fetch(`https://api.telegram.org/bot${telegramConfig.botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: telegramConfig.chatId,
            text: message,
            parse_mode: 'Markdown'
          })
        });
        if (response.ok) {
          setShowTelegramSuccess(true);
          setTimeout(() => setShowTelegramSuccess(false), 3000);
        } else {
          throw new Error('Error al enviar a Telegram');
        }
      } catch (error) {
        console.error(error);
        showToast('Error al enviar a Telegram. Revisa la configuración del bot.', 'error');
      }
    } else {
      // Fallback to share link
      const url = `https://t.me/share/url?url=${encodeURIComponent(window.location.origin)}&text=${encodeURIComponent(message)}`;
      window.open(url, '_blank');
    }
  };

  const handleAIScan = async (file: File) => {
    setIsScanning(true);
    setScanProgress(0);
    setScanStep('Subiendo archivo...');
    
    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.readAsDataURL(file);
      });
      const base64Data = await base64Promise;

      setScanProgress(30);
      setScanStep('Analizando estructura...');
      await new Promise(resolve => setTimeout(resolve, 800));

      setScanProgress(60);
      setScanStep('Extrayendo productos...');
      
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: [
          {
            parts: [
              { text: "Analiza este albarán de entrega de un restaurante. Extrae el nombre del proveedor, la fecha, la referencia del albarán, el importe total y el desglose de productos (descripción, cantidad, unidad, precio unitario). Devuélvelo en formato JSON: { \"supplier\": \"string\", \"date\": \"YYYY-MM-DD\", \"reference\": \"string\", \"total\": number, \"items\": [{ \"description\": \"string\", \"quantity\": number, \"unit\": \"string\", \"price\": number }] }" },
              { inlineData: { mimeType: file.type, data: base64Data } }
            ]
          }
        ],
        config: {
          responseMimeType: "application/json"
        }
      });

      setScanProgress(90);
      setScanStep('Validando datos...');
      await new Promise(resolve => setTimeout(resolve, 500));

      const result = JSON.parse(response.text || '{}');
      
      // Find supplier ID by name
      const supplier = mockSuppliers.find(s => 
        s.name.toLowerCase().includes(result.supplier?.toLowerCase()) ||
        result.supplier?.toLowerCase().includes(s.name.toLowerCase())
      );

      const newAlb: DeliveryNote = {
        id: Math.random().toString(36).substr(2, 9),
        date: result.date || new Date().toISOString().split('T')[0],
        supplierId: supplier?.id || 's1',
        reference: result.reference || 'ALB-SCAN-' + Date.now(),
        status: 'Recibido',
        total: result.total || 0,
        items: (result.items || []).map((item: any) => ({
          id: Math.random().toString(36).substr(2, 5),
          ...item,
          total: (item.quantity || 0) * (item.price || 0)
        }))
      };

      setAlbaranes([newAlb, ...albaranes]);
      showToast(`Albarán detectado: ${result.supplier || 'Desconocido'} - ${result.total || 0}€`);

    } catch (error) {
      console.error('Error scanning albarán:', error);
      showToast('Error al escanear el albarán. Por favor, inténtalo de nuevo.', 'error');
    } finally {
      setIsScanning(false);
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleAIScan(file);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {isScanning && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-[3rem] w-full max-w-md p-12 text-center shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="relative w-32 h-32 mx-auto mb-8">
              <div className="absolute inset-0 border-4 border-emerald-100 rounded-[2.5rem] animate-pulse" />
              <div className="absolute inset-0 flex items-center justify-center text-emerald-600">
                <Sparkles size={48} className="animate-bounce" />
              </div>
              <div 
                className="absolute inset-0 border-4 border-emerald-500 rounded-[2.5rem] transition-all duration-500"
                style={{ clipPath: `inset(${100 - scanProgress}% 0 0 0)` }}
              />
            </div>
            <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight mb-2">Escáner OCR Activo</h3>
            <p className="text-slate-500 text-sm font-medium mb-8">{scanStep}</p>
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mb-4">
              <div 
                className="bg-emerald-500 h-full transition-all duration-300"
                style={{ width: `${scanProgress}%` }}
              />
            </div>
            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">{scanProgress}% Procesado</p>
          </div>
        </div>
      )}

      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept="image/*,application/pdf"
        onChange={onFileChange}
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Albaranes</h1>
          <p className="text-slate-500 text-sm">Gestiona las recepciones de mercancía y suministros.</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setShowTelegramSettings(true)}
            className="flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-600 px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-all shadow-sm"
            title="Configurar Telegram"
          >
            <Send size={18} className="text-blue-500" />
          </button>
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={isScanning}
            className="flex items-center justify-center gap-2 bg-slate-900 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 disabled:opacity-50"
          >
            {isScanning ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} className="text-emerald-400" />}
            {isScanning ? 'Escaneando...' : 'Escanear con IA'}
          </button>
          <button 
            onClick={() => setShowNewModal(true)}
            className="flex items-center justify-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-emerald-700 transition-all shadow-sm shadow-emerald-100"
          >
            <Plus size={18} />
            Nuevo Albarán
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Recibido (Mes)</p>
          <p className="text-2xl font-bold text-slate-900">{albaranes.reduce((acc, a) => acc + a.total, 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</p>
        </div>
        <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Pendientes de Facturar</p>
          <p className="text-2xl font-bold text-amber-600">{albaranes.filter(a => a.status === 'Recibido').length}</p>
        </div>
        <div className="p-6 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-100 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
            <Sparkles size={64} />
          </div>
          <p className="text-[10px] font-black text-indigo-200 uppercase tracking-widest mb-1">Tendencia de Precios IA</p>
          <p className="text-2xl font-bold text-white">+3.2% <span className="text-xs font-normal text-indigo-200">vs mes ant.</span></p>
          <p className="text-[10px] text-indigo-100 mt-2 font-medium italic">"El aceite y lácteos muestran una subida sostenida. Se recomienda renegociar con s1."</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Buscar por referencia o proveedor..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-all">
          <Filter size={18} />
          Filtros
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-200">
                <th className="w-10 px-6 py-4"></th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Fecha</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Referencia</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Proveedor</th>
                {rol === 'admin' && <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Total</th>}
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Estado</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {albaranes.filter(alb => 
                alb.reference.toLowerCase().includes(searchTerm.toLowerCase()) || 
                supplierNames[alb.supplierId]?.toLowerCase().includes(searchTerm.toLowerCase())
              ).map((alb) => (
                <React.Fragment key={alb.id}>
                  <tr className={cn(
                    "hover:bg-slate-50/30 transition-colors group cursor-pointer",
                    expandedId === alb.id && "bg-slate-50/50"
                  )} onClick={() => toggleExpand(alb.id)}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {expandedId === alb.id ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                        <span className="text-xs font-bold text-slate-400">{alb.items.length}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 font-medium">
                      {new Date(alb.date).toLocaleDateString('es-ES')}
                    </td>
                    <td className="px-6 py-4 text-sm font-mono text-slate-500">
                      {alb.reference}
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-slate-900">
                      {supplierNames[alb.supplierId] || 'Proveedor Desconocido'}
                    </td>
                    {rol === 'admin' && (
                      <td className="px-6 py-4 text-sm font-bold text-slate-900">
                        {alb.total.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                      </td>
                    )}
                    <td className="px-6 py-4">
                      <span className={cn(
                        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold",
                        alb.status === 'Recibido' && "bg-emerald-50 text-emerald-700",
                        alb.status === 'Pendiente' && "bg-amber-50 text-amber-700",
                        alb.status === 'Facturado' && "bg-blue-50 text-blue-700",
                        alb.status === 'Rechazado' && "bg-rose-50 text-rose-700",
                      )}>
                        {alb.status === 'Recibido' && <CheckCircle2 size={12} />}
                        {alb.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                        {rol === 'admin' ? (
                          <>
                            <button 
                              onClick={() => handleConvertToInvoice(alb)}
                              className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all" 
                              title="Convertir a Factura"
                            >
                              <FileText size={18} />
                            </button>
                            <button 
                              onClick={() => setShowQCModal(alb.id)}
                              className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all" 
                              title="Control de Calidad"
                            >
                              <CheckCircle2 size={18} />
                            </button>
                            <button 
                              onClick={() => sendToTelegram(alb)}
                              className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all" 
                              title="Enviar a Telegram"
                            >
                              <Send size={18} />
                            </button>
                            <button 
                              onClick={() => handleSyncToStock(alb)}
                              className={cn(
                                "p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all",
                                isSyncing === alb.id && "animate-spin text-amber-600"
                              )} 
                              title="Sincronizar con Stock"
                            >
                              <RefreshCw size={18} />
                            </button>
                            <button 
                              onClick={() => setSelectedAlbaran(alb)}
                              className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all" 
                              title="Ver detalle"
                            >
                              <Eye size={18} />
                            </button>
                            <button 
                              onClick={() => handleEditAlbaran(alb)}
                              className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all" 
                              title="Editar"
                            >
                              <Settings2 size={18} />
                            </button>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowDeleteConfirm(alb.id);
                              }}
                              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all" 
                              title="Eliminar"
                            >
                              <Trash2 size={18} />
                            </button>
                            <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all">
                              <MoreVertical size={18} />
                            </button>
                          </>
                        ) : (
                          <button 
                            onClick={() => setShowQCModal(alb.id)}
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all" 
                            title="Control de Calidad"
                          >
                            <CheckCircle2 size={18} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {expandedId === alb.id && (
                    <tr className="bg-slate-50/30">
                      <td colSpan={7} className="px-12 py-6">
                        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="bg-slate-50/50 border-b border-slate-100">
                                <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase">Producto</th>
                                <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase text-center">Cantidad</th>
                                <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase text-right">Precio Un.</th>
                                <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase text-right">Subtotal</th>
                                <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase text-center">Alerta Precio</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                              {alb.items.map((item) => {
                                const priceChange = Math.random() > 0.7 ? (Math.random() > 0.5 ? 'up' : 'down') : 'none';
                                const isDiscrepancy = Math.random() > 0.8;
                                return (
                                  <tr key={item.id}>
                                    <td className="px-6 py-3 text-sm font-medium text-slate-700">
                                      {item.description}
                                      {isDiscrepancy && (
                                        <span className="ml-2 text-[10px] font-black text-rose-500 uppercase tracking-widest bg-rose-50 px-1.5 py-0.5 rounded">
                                          Discrepancia
                                        </span>
                                      )}
                                    </td>
                                    <td className="px-6 py-3 text-sm text-slate-600 text-center">
                                      {item.quantity} {item.unit}
                                      {isDiscrepancy && (
                                        <p className="text-[10px] text-rose-400 font-bold">Pedido: {item.quantity + 5}</p>
                                      )}
                                    </td>
                                    <td className="px-6 py-3 text-sm text-slate-600 text-right">{item.price.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</td>
                                    <td className="px-6 py-3 text-sm font-bold text-slate-900 text-right">{item.total.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</td>
                                    <td className="px-6 py-3 text-center">
                                      {priceChange === 'up' && (
                                        <div className="inline-flex items-center gap-1 text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full text-[10px] font-bold">
                                          <TrendingUp size={12} /> +5.2%
                                        </div>
                                      )}
                                      {priceChange === 'down' && (
                                        <div className="inline-flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full text-[10px] font-bold">
                                          <TrendingDown size={12} /> -2.1%
                                        </div>
                                      )}
                                      {priceChange === 'none' && <span className="text-slate-300 text-[10px]">-</span>}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                          {alb.items.length === 0 && (
                            <div className="p-8 text-center">
                              <AlertTriangle size={32} className="text-slate-300 mx-auto mb-2" />
                              <p className="text-sm text-slate-500">No hay productos registrados en este albarán.</p>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
        
        <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-200 flex items-center justify-between">
          <p className="text-xs text-slate-500 font-medium">Mostrando {albaranes.length} albaranes</p>
          <div className="flex gap-2">
            <button className="px-3 py-1 text-xs font-semibold text-slate-400 bg-white border border-slate-200 rounded-lg cursor-not-allowed">Anterior</button>
            <button className="px-3 py-1 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-all">Siguiente</button>
          </div>
        </div>
      </div>

      {/* New Albarán Modal */}
      {showNewModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">
                {isEditing ? 'Editar Albarán' : 'Nuevo Albarán'}
              </h2>
              <button onClick={() => { setShowNewModal(false); setIsEditing(null); }} className="p-2 hover:bg-slate-100 rounded-xl transition-all">
                <X size={20} className="text-slate-400" />
              </button>
            </div>
            <div className="p-8 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">Referencia</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 outline-none" 
                    placeholder="ALB-2026-XXX"
                    value={newAlbForm.reference}
                    onChange={e => setNewAlbForm({...newAlbForm, reference: e.target.value})}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">Fecha</label>
                  <input 
                    type="date" 
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 outline-none" 
                    value={newAlbForm.date}
                    onChange={e => setNewAlbForm({...newAlbForm, date: e.target.value})}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase">Proveedor</label>
                <select 
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 outline-none"
                  value={newAlbForm.supplierId}
                  onChange={e => setNewAlbForm({...newAlbForm, supplierId: e.target.value})}
                >
                  {Object.entries(supplierNames).map(([id, name]) => (
                    <option key={id} value={id}>{name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-4 pt-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-tight">Productos</h3>
                  <button 
                    onClick={addLineToNewAlb}
                    className="text-[10px] font-black text-emerald-600 uppercase tracking-widest bg-emerald-50 px-3 py-1.5 rounded-lg hover:bg-emerald-100 transition-all"
                  >
                    + Añadir Línea
                  </button>
                </div>
                
                <div className="space-y-2">
                  {newAlbForm.items.map((item) => (
                    <div key={item.id} className="grid grid-cols-12 gap-2 items-center bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <div className="col-span-5">
                        <input 
                          type="text" 
                          placeholder="Descripción"
                          className="w-full bg-transparent text-xs font-bold outline-none"
                          value={item.description}
                          onChange={e => updateNewAlbItem(item.id, 'description', e.target.value)}
                        />
                      </div>
                      <div className="col-span-2">
                        <input 
                          type="number" 
                          placeholder="Cant."
                          className="w-full bg-transparent text-xs text-center outline-none"
                          value={item.quantity}
                          onChange={e => updateNewAlbItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div className="col-span-2">
                        <input 
                          type="number" 
                          placeholder="Precio"
                          className="w-full bg-transparent text-xs text-right outline-none"
                          value={item.price}
                          onChange={e => updateNewAlbItem(item.id, 'price', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div className="col-span-2 text-right">
                        <span className="text-xs font-black text-slate-900">{item.total.toFixed(2)}€</span>
                      </div>
                      <div className="col-span-1 text-right">
                        <button 
                          onClick={() => setNewAlbForm({...newAlbForm, items: newAlbForm.items.filter(i => i.id !== item.id), total: newAlbForm.total - item.total})}
                          className="text-rose-400 hover:text-rose-600"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-sm font-bold text-slate-500 uppercase">Total Albarán</span>
                <span className="text-2xl font-black text-slate-900">{newAlbForm.total.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
              </div>
              
              <div className="pt-4 flex gap-3">
                <button 
                  onClick={() => setShowNewModal(false)}
                  className="flex-1 px-4 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleCreateAlbaran}
                  className="flex-1 px-4 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
                >
                  Guardar Albarán
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Quality Control Modal */}
      {showQCModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Control de Calidad</h2>
                <p className="text-xs text-slate-500 font-medium">Albarán: {albaranes.find(a => a.id === showQCModal)?.reference}</p>
              </div>
              <button onClick={() => setShowQCModal(null)} className="p-2 hover:bg-slate-100 rounded-xl transition-all">
                <X size={20} className="text-slate-400" />
              </button>
            </div>
            <div className="p-8 space-y-6">
              {[
                { id: 'temp', label: 'Temperatura Correcta', icon: TrendingDown },
                { id: 'state', label: 'Estado del Embalaje', icon: Package },
                { id: 'fresh', label: 'Frescura / Caducidad', icon: Sparkles },
                { id: 'qty', label: 'Cantidad Verificada', icon: CheckCircle2 },
              ].map((check) => (
                <div key={check.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm text-slate-400">
                      <check.icon size={20} />
                    </div>
                    <span className="text-sm font-bold text-slate-700">{check.label}</span>
                  </div>
                  <button 
                    onClick={() => setQCData({ ...qcData, [`${showQCModal}_${check.id}`]: !qcData[`${showQCModal}_${check.id}`] })}
                    className={cn(
                      "w-12 h-6 rounded-full transition-all relative",
                      qcData[`${showQCModal}_${check.id}`] ? "bg-emerald-500" : "bg-slate-200"
                    )}
                  >
                    <div className={cn(
                      "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                      qcData[`${showQCModal}_${check.id}`] ? "left-7" : "left-1"
                    )} />
                  </button>
                </div>
              ))}
              
              <div className="pt-4 flex gap-3">
                <button 
                  onClick={() => setShowQCModal(null)}
                  className="flex-1 px-4 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
                >
                  Confirmar Recepción
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Telegram Settings Modal */}
      {showTelegramSettings && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">Configurar Telegram</h2>
              <button onClick={() => setShowTelegramSettings(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-all">
                <X size={20} className="text-slate-400" />
              </button>
            </div>
            <div className="p-8 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase">Bot Token</label>
                <input 
                  type="password" 
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none" 
                  placeholder="123456789:ABC..."
                  value={telegramConfig.botToken}
                  onChange={e => setTelegramConfig({...telegramConfig, botToken: e.target.value})}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase">Chat ID</label>
                <input 
                  type="text" 
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none" 
                  placeholder="-100..."
                  value={telegramConfig.chatId}
                  onChange={e => setTelegramConfig({...telegramConfig, chatId: e.target.value})}
                />
              </div>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                Para obtener el Bot Token, crea un bot con @BotFather. Para el Chat ID, añade el bot a un grupo y usa @userinfobot o similar.
              </p>
              <div className="pt-4 flex gap-3">
                <button 
                  onClick={() => setShowTelegramSettings(false)}
                  className="flex-1 px-4 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  onClick={saveTelegramConfig}
                  className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
                >
                  Guardar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Albarán Detail Modal */}
      {/* Success Modals */}
      {showSyncSuccess && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-[2.5rem] p-10 max-w-sm w-full text-center shadow-2xl"
          >
            <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 size={40} />
            </div>
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-2">Stock Sincronizado</h3>
            <p className="text-slate-500 text-sm font-medium mb-8">
              El albarán <span className="font-bold text-slate-700">{showSyncSuccess.reference}</span> se ha procesado. Se han actualizado {showSyncSuccess.count} productos en el inventario.
            </p>
            <button 
              onClick={() => setShowSyncSuccess(null)}
              className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-800 transition-all"
            >
              Entendido
            </button>
          </motion.div>
        </div>
      )}

      {showInvoiceSuccess && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-[2.5rem] p-10 max-w-sm w-full text-center shadow-2xl"
          >
            <div className="w-20 h-20 bg-blue-100 text-blue-600 rounded-3xl flex items-center justify-center mx-auto mb-6">
              <FileText size={40} />
            </div>
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-2">Factura Generada</h3>
            <p className="text-slate-500 text-sm font-medium mb-8">
              El albarán <span className="font-bold text-slate-700">{showInvoiceSuccess}</span> se ha convertido a factura proforma y vinculado al módulo de Facturas.
            </p>
            <button 
              onClick={() => setShowInvoiceSuccess(null)}
              className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-800 transition-all"
            >
              Ver Facturas
            </button>
          </motion.div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-[2.5rem] p-10 max-w-sm w-full text-center shadow-2xl"
          >
            <div className="w-20 h-20 bg-rose-100 text-rose-600 rounded-3xl flex items-center justify-center mx-auto mb-6">
              <Trash2 size={40} />
            </div>
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-2">¿Eliminar Albarán?</h3>
            <p className="text-slate-500 text-sm font-medium mb-8">
              Esta acción no se puede deshacer. El albarán y su desglose de productos se eliminarán permanentemente.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={() => setShowDeleteConfirm(null)}
                className="bg-slate-100 text-slate-600 py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-200 transition-all"
              >
                Cancelar
              </button>
              <button 
                onClick={() => {
                  setAlbaranes(albaranes.filter(a => a.id !== showDeleteConfirm));
                  setShowDeleteConfirm(null);
                  showToast('Albarán eliminado correctamente');
                }}
                className="bg-rose-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-rose-700 transition-all shadow-lg shadow-rose-100"
              >
                Eliminar
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {showTelegramSuccess && (
        <motion.div 
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-8 py-4 rounded-2xl shadow-2xl z-[100] flex items-center gap-3 border border-white/10"
        >
          <Send size={20} className="text-blue-400" />
          <span className="text-sm font-black uppercase tracking-widest">Enviado a Telegram</span>
        </motion.div>
      )}
      {selectedAlbaran && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[70] p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] w-full max-w-4xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-emerald-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-100">
                  <FileText size={28} />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-slate-900">Detalle de Albarán</h2>
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Ref: {selectedAlbaran.reference} • {new Date(selectedAlbaran.date).toLocaleDateString('es-ES')}</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedAlbaran(null)} 
                className="p-3 text-slate-400 hover:text-slate-600 hover:bg-white rounded-2xl transition-all shadow-sm"
              >
                <X size={24} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-10">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                {/* Left Column: Info & Items */}
                <div className="lg:col-span-2 space-y-8">
                  {/* Supplier Info Card */}
                  <div className="p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-6 opacity-5">
                      <Package size={120} />
                    </div>
                    <div className="relative z-10 grid grid-cols-2 gap-8">
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Proveedor</p>
                        <p className="text-xl font-black text-slate-900">{supplierNames[selectedAlbaran.supplierId]}</p>
                        <p className="text-sm text-slate-500 font-medium mt-1">CIF: {mockSuppliers.find(s => s.id === selectedAlbaran.supplierId)?.cif || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Contacto</p>
                        <p className="text-sm font-bold text-slate-700">{mockSuppliers.find(s => s.id === selectedAlbaran.supplierId)?.contact || 'N/A'}</p>
                        <p className="text-sm text-slate-500 font-medium">{mockSuppliers.find(s => s.id === selectedAlbaran.supplierId)?.email || 'N/A'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Items Table */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                        <Package size={18} className="text-emerald-600" />
                        Desglose de Productos
                      </h3>
                      <button 
                        onClick={() => window.print()}
                        className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-slate-900 transition-colors"
                      >
                        <RefreshCw size={14} /> Imprimir Albarán
                      </button>
                    </div>
                    <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50/50 border-b border-slate-100">
                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Producto</th>
                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Cant.</th>
                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Precio Un.</th>
                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {selectedAlbaran.items.map((item) => (
                            <tr key={item.id} className="hover:bg-slate-50/30 transition-colors">
                              <td className="px-6 py-4 text-sm font-bold text-slate-700">{item.description}</td>
                              <td className="px-6 py-4 text-sm text-slate-600 text-center font-medium">{item.quantity} {item.unit}</td>
                              <td className="px-6 py-4 text-sm text-slate-600 text-right">{item.price.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</td>
                              <td className="px-6 py-4 text-sm font-black text-slate-900 text-right">{item.total.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-slate-50/50">
                            <td colSpan={3} className="px-6 py-4 text-sm font-black text-slate-900 text-right uppercase tracking-widest">Total Albarán</td>
                            <td className="px-6 py-4 text-lg font-black text-emerald-600 text-right">{selectedAlbaran.total.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Right Column: Actions & AI Insights */}
                <div className="space-y-8">
                  <div className="p-8 bg-slate-900 text-white rounded-[2.5rem] shadow-xl space-y-6">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Acciones Disponibles</h3>
                    <div className="space-y-3">
                      <button 
                        onClick={() => {
                          handleSyncToStock(selectedAlbaran);
                          setSelectedAlbaran(null);
                        }}
                        className="w-full flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 rounded-2xl transition-all group"
                      >
                        <div className="flex items-center gap-3">
                          <RefreshCw size={18} className="text-amber-400" />
                          <span className="text-sm font-bold">Sincronizar Stock</span>
                        </div>
                        <ChevronUp size={16} className="text-slate-500 group-hover:text-white transition-colors rotate-90" />
                      </button>
                      <button 
                        onClick={() => {
                          setShowQCModal(selectedAlbaran.id);
                          setSelectedAlbaran(null);
                        }}
                        className="w-full flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 rounded-2xl transition-all group"
                      >
                        <div className="flex items-center gap-3">
                          <CheckCircle2 size={18} className="text-emerald-400" />
                          <span className="text-sm font-bold">Control de Calidad</span>
                        </div>
                        <ChevronUp size={16} className="text-slate-500 group-hover:text-white transition-colors rotate-90" />
                      </button>
                      <button 
                        onClick={() => {
                          sendToTelegram(selectedAlbaran);
                        }}
                        className="w-full flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 rounded-2xl transition-all group"
                      >
                        <div className="flex items-center gap-3">
                          <Send size={18} className="text-blue-400" />
                          <span className="text-sm font-bold">Enviar a Telegram</span>
                        </div>
                        <ChevronUp size={16} className="text-slate-500 group-hover:text-white transition-colors rotate-90" />
                      </button>
                    </div>
                  </div>

                  {/* AI Insight for this Albarán */}
                  <div className="p-8 bg-indigo-50 rounded-[2.5rem] border border-indigo-100 space-y-4">
                    <div className="flex items-center gap-2 text-indigo-700">
                      <Sparkles size={18} />
                      <span className="text-xs font-black uppercase tracking-widest">Análisis IA</span>
                    </div>
                    <p className="text-xs text-indigo-800 font-medium leading-relaxed">
                      Este albarán contiene productos con una desviación de precio del <span className="font-black text-rose-600">+4.5%</span> respecto a la última compra. 
                      Se recomienda revisar el contrato con <span className="font-black">{supplierNames[selectedAlbaran.supplierId]}</span>.
                    </p>
                  </div>

                  <div className="p-8 bg-amber-50 rounded-[2.5rem] border border-amber-100 space-y-4">
                    <div className="flex items-center gap-2 text-amber-700">
                      <AlertTriangle size={18} />
                      <span className="text-xs font-black uppercase tracking-widest">Alerta de Discrepancia</span>
                    </div>
                    <p className="text-xs text-amber-800 font-medium leading-relaxed">
                      Se han detectado 2 productos con cantidades diferentes a las solicitadas originalmente en el pedido de compra.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-8 bg-slate-50 border-t border-slate-100 flex justify-end gap-4">
              <button 
                onClick={() => setSelectedAlbaran(null)}
                className="px-8 py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-slate-50 transition-all shadow-sm"
              >
                Cerrar
              </button>
              <button 
                onClick={() => {
                  alert('Generando factura proforma...');
                  setSelectedAlbaran(null);
                }}
                className="px-8 py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
              >
                Convertir a Factura
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
