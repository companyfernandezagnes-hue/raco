import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageCircle, Send, X, Bot, Sparkles, Loader2, 
  BarChart3, Mail, Building2, WifiOff, Zap, Mic, 
  Square, TerminalSquare, ChevronRight, Paperclip,
  Clock, CheckCheck, AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';

interface TelegramWidgetProps {
  currentModule: string;
  telegramToken?: string;
  chatId?: string;
}

type ChatMessage = {
  id: string;
  text: string;
  sender: 'user' | 'system' | 'ai';
  time: string;
  isQueue?: boolean;
  status?: 'sending' | 'sent' | 'error';
};

// 🛡️ FIX CRÍTICO: Formateador a prueba de balas
const formatMarkdown = (text?: string) => {
  if (!text) return null;
  try {
    const parts = text.split(/(\*\*.*?\*\*|\*.*?\*)/g);
    return (
      <>
        {parts.map((part, i) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={i} className="font-black text-indigo-900">{part.slice(2, -2)}</strong>;
          }
          if (part.startsWith('*') && part.endsWith('*')) {
            return <em key={i} className="italic text-slate-700">{part.slice(1, -1)}</em>;
          }
          return <span key={i}>{part}</span>;
        })}
      </>
    );
  } catch (e) {
    return text;
  }
};

export const TelegramWidget: React.FC<TelegramWidgetProps> = ({ 
  currentModule, 
  telegramToken = "7832649234:AAH_EXAMPLE", 
  chatId = "123456789" 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      text: `Hola! Soy tu asistente de **${currentModule}**. ¿En qué puedo ayudarte hoy?`,
      sender: 'ai',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [queue, setQueue] = useState<ChatMessage[]>([]);
  
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Procesar cola cuando vuelve la conexión
  useEffect(() => {
    if (isOnline && queue.length > 0) {
      const processQueue = async () => {
        for (const msg of queue) {
          await handleSendMessage(msg.text, true);
        }
        setQueue([]);
      };
      processQueue();
    }
  }, [isOnline, queue]);

  const handleSendMessage = async (text: string, fromQueue = false) => {
    if (!text.trim()) return;

    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      text,
      sender: 'user',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: isOnline ? 'sent' : 'sending'
    };

    if (!fromQueue) {
      setMessages(prev => [...prev, newMessage]);
      setInputValue('');
    }

    if (!isOnline) {
      setQueue(prev => [...prev, { ...newMessage, isQueue: true }]);
      return;
    }

    setIsTyping(true);
    
    // Simular procesamiento de IA / Comando
    setTimeout(() => {
      const response: ChatMessage = {
        id: (Date.now() + 1).toString(),
        text: getAIResponse(text, currentModule),
        sender: 'ai',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, response]);
      setIsTyping(false);
    }, 1500);
  };

  const getAIResponse = (text: string, module: string): string => {
    const t = text.toLowerCase();
    if (t.includes('hola')) return "¡Hola! Estoy listo para ayudarte con la gestión de tu restaurante.";
    if (t.includes('resumen')) return `Aquí tienes el resumen de **${module}**: Todo parece estar bajo control.`;
    if (t.includes('alerta')) return "He detectado 3 facturas próximas a vencer. ¿Quieres que las revise?";
    if (t.includes('comando')) return "Comandos disponibles: `/resumen`, `/alertas`, `/conciliar`, `/menu`.";
    return `Entendido. Estoy procesando tu solicitud sobre **${text}** en el módulo de **${module}**.`;
  };

  const toggleRecording = () => {
    setIsRecording(!isRecording);
    if (isRecording) {
      // Simular transcripción
      setTimeout(() => {
        setInputValue("Analiza las ventas de hoy");
      }, 500);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95, transformOrigin: 'bottom right' }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="mb-4 w-[380px] h-[550px] bg-white rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="bg-indigo-600 p-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md">
                    <Bot size={22} />
                  </div>
                  <div className={cn(
                    "absolute -bottom-0.5 -right-0.5 w-3 h-3 border-2 border-indigo-600 rounded-full",
                    isOnline ? "bg-emerald-400" : "bg-amber-400"
                  )} />
                </div>
                <div>
                  <h3 className="font-bold text-sm">Asistente Smart</h3>
                  <p className="text-[10px] text-indigo-100 flex items-center gap-1">
                    {isOnline ? (
                      <><Zap size={10} className="fill-current" /> En línea • {currentModule}</>
                    ) : (
                      <><WifiOff size={10} /> Modo Offline (Cola activa)</>
                    )}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-white/10 rounded-xl transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Messages Area */}
            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50 scroll-smooth"
            >
              {messages.map((msg) => (
                <div 
                  key={msg.id}
                  className={cn(
                    "flex flex-col max-w-[85%]",
                    msg.sender === 'user' ? "ml-auto items-end" : "items-start"
                  )}
                >
                  <div className={cn(
                    "px-4 py-2.5 rounded-2xl text-sm shadow-sm",
                    msg.sender === 'user' 
                      ? "bg-indigo-600 text-white rounded-tr-none" 
                      : "bg-white text-slate-700 border border-slate-100 rounded-tl-none"
                  )}>
                    {formatMarkdown(msg.text)}
                  </div>
                  <div className="flex items-center gap-1 mt-1 px-1">
                    <span className="text-[9px] text-slate-400 font-medium">{msg.time}</span>
                    {msg.sender === 'user' && (
                      <CheckCheck size={12} className={cn(
                        msg.status === 'sent' ? "text-indigo-500" : "text-slate-300"
                      )} />
                    )}
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="flex items-center gap-2 bg-white border border-slate-100 px-4 py-2 rounded-2xl w-fit shadow-sm">
                  <Loader2 size={14} className="animate-spin text-indigo-500" />
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">IA pensando...</span>
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="px-4 py-2 flex gap-2 overflow-x-auto no-scrollbar border-t border-slate-100 bg-white">
              <button className="flex-shrink-0 flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-xl text-[10px] font-bold text-slate-600 transition-colors">
                <BarChart3 size={12} /> Resumen
              </button>
              <button className="flex-shrink-0 flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-xl text-[10px] font-bold text-slate-600 transition-colors">
                <AlertCircle size={12} /> Alertas
              </button>
              <button className="flex-shrink-0 flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-xl text-[10px] font-bold text-slate-600 transition-colors">
                <TerminalSquare size={12} /> Comandos
              </button>
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white border-t border-slate-100">
              <div className="relative flex items-end gap-2">
                <div className="flex-1 bg-slate-100 rounded-2xl p-2 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all">
                  <textarea
                    rows={1}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage(inputValue);
                      }
                    }}
                    placeholder="Escribe un mensaje o comando..."
                    className="w-full bg-transparent border-none focus:ring-0 text-sm p-1 resize-none max-h-32"
                  />
                  <div className="flex items-center justify-between mt-1 px-1">
                    <div className="flex gap-2">
                      <button className="p-1 text-slate-400 hover:text-indigo-500 transition-colors">
                        <Paperclip size={18} />
                      </button>
                      <button 
                        onClick={toggleRecording}
                        className={cn(
                          "p-1 transition-colors",
                          isRecording ? "text-red-500 animate-pulse" : "text-slate-400 hover:text-indigo-500"
                        )}
                      >
                        {isRecording ? <Square size={18} /> : <Mic size={18} />}
                      </button>
                    </div>
                    <span className="text-[9px] text-slate-400 font-medium">
                      {inputValue.length} / 500
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => handleSendMessage(inputValue)}
                  disabled={!inputValue.trim()}
                  className="p-3 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 transition-all shadow-lg shadow-indigo-100"
                >
                  <Send size={20} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-14 h-14 rounded-2xl flex items-center justify-center shadow-2xl transition-all hover:scale-105 active:scale-95 relative",
          isOpen ? "bg-slate-800 text-white" : "bg-indigo-600 text-white"
        )}
      >
        {isOpen ? <X size={24} /> : <MessageCircle size={24} />}
        {!isOpen && queue.length > 0 && (
          <div className="absolute -top-2 -right-2 bg-amber-500 text-white text-[10px] font-black w-6 h-6 rounded-full flex items-center justify-center border-4 border-white">
            {queue.length}
          </div>
        )}
        {!isOpen && (
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white" />
        )}
      </button>
    </div>
  );
};
