import React from 'react';
import { Sparkles, X, Send, Bot, Loader2, Mic, MicOff } from 'lucide-react';
import { getAIAdvice } from '../services/geminiService';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function AIAdvisor() {
  const [isOpen, setIsOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [messages, setMessages] = React.useState<{ role: 'user' | 'ai', text: string }[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isRecording, setIsRecording] = React.useState(false);

  const startRecording = () => {
    setIsRecording(true);
    // Simulate transcription
    setTimeout(() => {
      setQuery("¿Cómo puedo mejorar el margen de beneficio de mis platos?");
      setIsRecording(false);
    }, 3000);
  };

  const handleSend = async () => {
    if (!query.trim()) return;
    
    const userMsg = query;
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setQuery('');
    setIsLoading(true);

    const context = "El restaurante está en fase de apertura. Tenemos módulos de albaranes, facturas, tesorería y escandallos. El objetivo es maximizar la rentabilidad y el orden.";
    const advice = await getAIAdvice(context, userMsg);
    
    setMessages(prev => [...prev, { role: 'ai', text: advice || 'Error' }]);
    setIsLoading(false);
  };

  return (
    <>
      {/* Floating Button */}
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-slate-900 text-white rounded-full flex items-center justify-center shadow-2xl hover:scale-110 transition-all z-50 group"
      >
        <Sparkles size={24} className="group-hover:rotate-12 transition-transform" />
        <span className="absolute right-full mr-4 px-3 py-1.5 bg-slate-900 text-white text-xs font-bold rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
          Asesor IA
        </span>
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed inset-y-0 right-0 w-full sm:w-96 bg-white shadow-2xl z-[60] flex flex-col animate-in slide-in-from-right duration-300">
          <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center">
                <Bot size={24} />
              </div>
              <div>
                <h3 className="font-bold">Asesor Gastro IA</h3>
                <p className="text-[10px] text-slate-400 uppercase tracking-widest">Expert Advisor</p>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50">
            {messages.length === 0 && (
              <div className="text-center py-10 space-y-4">
                <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto shadow-sm">
                  <Sparkles size={32} className="text-emerald-500" />
                </div>
                <p className="text-sm text-slate-500 max-w-[200px] mx-auto">
                  Hola, soy tu asesor experto. ¿En qué puedo ayudarte con la gestión de tu restaurante hoy?
                </p>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={cn(
                "flex flex-col max-w-[85%]",
                m.role === 'user' ? "ml-auto items-end" : "mr-auto items-start"
              )}>
                <div className={cn(
                  "p-4 rounded-2xl text-sm shadow-sm",
                  m.role === 'user' ? "bg-emerald-600 text-white rounded-tr-none" : "bg-white text-slate-700 rounded-tl-none border border-slate-200"
                )}>
                  {m.text}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex items-center gap-2 text-slate-400 text-xs font-medium animate-pulse">
                <Loader2 size={14} className="animate-spin" />
                Pensando...
              </div>
            )}
          </div>

          <div className="p-4 border-t border-slate-100 bg-white">
            <div className="flex gap-2">
              <button 
                onClick={startRecording}
                disabled={isRecording || isLoading}
                className={cn(
                  "p-2.5 rounded-xl transition-all",
                  isRecording ? "bg-rose-100 text-rose-600 animate-pulse" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                )}
              >
                {isRecording ? <MicOff size={20} /> : <Mic size={20} />}
              </button>
              <input 
                type="text" 
                placeholder={isRecording ? "Escuchando..." : "Escribe tu consulta..."}
                className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              />
              <button 
                onClick={handleSend}
                disabled={isLoading || !query.trim()}
                className="p-2.5 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send size={20} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
