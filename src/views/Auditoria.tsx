import React from 'react';
import { Sparkles, TrendingUp, Users, AlertCircle, CheckCircle2, ArrowRight, BrainCircuit, Activity, Zap } from 'lucide-react';
import { cn } from '../lib/utils';

export default function AuditoriaView() {
  const [isAuditing, setIsAuditing] = React.useState(false);
  const [auditComplete, setAuditComplete] = React.useState(false);

  const startAudit = () => {
    setIsAuditing(true);
    setTimeout(() => {
      setIsAuditing(false);
      setAuditComplete(true);
      alert('Auditoría completada. Se han detectado 3 oportunidades de ahorro.');
    }, 3000);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Sparkles className="text-emerald-600" />
            Auditoría Inteligente Gemini
          </h1>
          <p className="text-slate-500 text-sm">Análisis profundo de rentabilidad, personal y operaciones mediante IA.</p>
        </div>
        {!auditComplete && (
          <button 
            onClick={startAudit}
            disabled={isAuditing}
            className={cn(
              "flex items-center justify-center gap-2 px-6 py-3 rounded-2xl text-sm font-black uppercase tracking-widest transition-all shadow-lg shadow-emerald-100",
              isAuditing ? "bg-slate-100 text-slate-400 cursor-not-allowed" : "bg-emerald-600 text-white hover:bg-emerald-700"
            )}
          >
            {isAuditing ? (
              <>
                <Zap size={18} className="animate-pulse" />
                Analizando Datos...
              </>
            ) : (
              <>
                <BrainCircuit size={18} />
                Iniciar Auditoría
              </>
            )}
          </button>
        )}
      </div>

      {!auditComplete && !isAuditing && (
        <div className="bg-white p-12 rounded-[2.5rem] border border-slate-200 shadow-sm text-center space-y-6">
          <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto">
            <BrainCircuit size={40} />
          </div>
          <div className="max-w-md mx-auto">
            <h2 className="text-xl font-black text-slate-900">¿Listo para optimizar tu restaurante?</h2>
            <p className="text-slate-500 mt-2">Gemini analizará tus facturas, albaranes, horarios y escandallos para encontrar fugas de dinero y oportunidades de crecimiento.</p>
          </div>
        </div>
      )}

      {isAuditing && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-slate-100 rounded-3xl animate-pulse" />
            ))}
          </div>
          <div className="h-64 bg-slate-100 rounded-3xl animate-pulse" />
        </div>
      )}

      {auditComplete && (
        <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-700">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
              { label: 'Salud Financiera', value: '8.4/10', icon: Activity, color: 'text-emerald-600', bg: 'bg-emerald-50' },
              { label: 'Fugas Detectadas', value: '420 €/mes', icon: AlertCircle, color: 'text-rose-600', bg: 'bg-rose-50' },
              { label: 'Eficiencia Personal', value: '92%', icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
              { label: 'Margen Potencial', value: '+5.2%', icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
            ].map((stat) => (
              <div key={stat.label} className="p-6 bg-white rounded-3xl border border-slate-200 shadow-sm">
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mb-4", stat.bg, stat.color)}>
                  <stat.icon size={20} />
                </div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</p>
                <p className="text-2xl font-black text-slate-900 mt-1">{stat.value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-8 border-b border-slate-100">
                <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Hallazgos Críticos</h3>
              </div>
              <div className="p-4 space-y-2">
                {[
                  { title: 'Desviación en Escandallo: "Arroz del Senyoret"', desc: 'El coste real es un 18% superior al teórico por merma excesiva en el marisco.', type: 'error', risk: 92 },
                  { title: 'Solapamiento de turnos innecesario', desc: 'Entre las 17:00 y 18:30 hay 3 camareros activos con ocupación inferior al 10%.', type: 'warning', risk: 65 },
                  { title: 'Oportunidad de compra por volumen', desc: 'Agrupar pedidos de aceite con el proveedor "Aceites del Sur" ahorraría un 8% anual.', type: 'success', risk: 24 },
                ].map((item, i) => (
                  <div key={i} className="flex items-start justify-between p-4 hover:bg-slate-50 rounded-2xl transition-colors">
                    <div className="flex gap-4">
                      <div className={cn(
                        "mt-1.5 w-2 h-2 rounded-full shrink-0",
                        item.type === 'error' ? "bg-rose-500" : item.type === 'warning' ? "bg-amber-500" : "bg-emerald-500"
                      )} />
                      <div>
                        <p className="text-sm font-bold text-slate-900">{item.title}</p>
                        <p className="text-xs text-slate-500 mt-1 leading-relaxed">{item.desc}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Riesgo IA</p>
                      <div className={cn(
                        "px-2 py-1 rounded-lg text-xs font-black",
                        item.risk > 80 ? "bg-rose-50 text-rose-600" : item.risk > 50 ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600"
                      )}>
                        {item.risk}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-900 text-white rounded-[2.5rem] p-8 shadow-xl shadow-slate-200 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-6">
                  <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
                    <Zap size={18} />
                  </div>
                  <h3 className="text-xs font-black uppercase tracking-widest">Plan de Acción IA</h3>
                </div>
                <div className="space-y-6">
                  {[
                    'Actualizar precios de carta en 3 platos clave.',
                    'Ajustar horario de personal de sala (Tarde).',
                    'Negociar rappel con proveedor de bebidas.',
                  ].map((step, i) => (
                    <div key={i} className="flex items-center gap-4 group cursor-pointer">
                      <div className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center text-xs font-bold group-hover:bg-emerald-500 group-hover:border-emerald-500 transition-all">
                        {i + 1}
                      </div>
                      <p className="text-sm font-medium text-slate-300 group-hover:text-white transition-colors">{step}</p>
                      <ArrowRight size={16} className="ml-auto text-slate-600 group-hover:text-emerald-500 transition-all" />
                    </div>
                  ))}
                </div>
              </div>
              <button className="mt-12 w-full bg-white text-slate-900 py-4 rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-emerald-500 hover:text-white transition-all">
                Aplicar Recomendaciones
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
