import React from 'react';
import { Sparkles, ShieldCheck, AlertTriangle, CheckCircle2, TrendingUp, BarChart3, Loader2, Search } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function GeminiAuditView() {
  const [isAuditing, setIsAuditing] = React.useState(false);
  const [auditComplete, setAuditComplete] = React.useState(false);

  const startAudit = () => {
    setIsAuditing(true);
    setTimeout(() => {
      setIsAuditing(false);
      setAuditComplete(true);
    }, 3000);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Auditoría Gemini</h1>
          <p className="text-slate-500 text-sm">Análisis inteligente de rentabilidad, mermas y eficiencia operativa.</p>
        </div>
        <button 
          onClick={startAudit}
          disabled={isAuditing}
          className="flex items-center justify-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-xl text-sm font-bold hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 disabled:opacity-50"
        >
          {isAuditing ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} className="text-emerald-400" />}
          {isAuditing ? 'Auditoría en curso...' : 'Iniciar Auditoría IA'}
        </button>
      </div>

      {!auditComplete ? (
        <div className="bg-white p-12 rounded-3xl border border-slate-200 shadow-sm text-center space-y-4">
          <div className="w-20 h-20 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto">
            <ShieldCheck size={40} className="text-slate-300" />
          </div>
          <div className="max-w-sm mx-auto">
            <h3 className="text-lg font-bold text-slate-800">Tu Gestor Inteligente</h3>
            <p className="text-sm text-slate-500 leading-relaxed">
              Gemini analizará tus albaranes, facturas, escandallos y ventas para detectar fugas de dinero y oportunidades de mejora.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in zoom-in-95 duration-500">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
                  <TrendingUp size={24} className="text-emerald-600" />
                </div>
                <h3 className="text-lg font-bold text-slate-800">Hallazgos Principales</h3>
              </div>
              
              <div className="space-y-4">
                {[
                  { title: 'Desviación en Escandallo: Spider Tartar', desc: 'El precio del atún ha subido un 15% en los últimos 3 albaranes. El margen actual ha bajado al 62%.', type: 'warning' },
                  { title: 'Oportunidad de Negociación: Carnes Selectas', desc: 'Estás comprando un 20% más de solomillo que el mes pasado. Podrías solicitar un descuento por volumen del 5%.', type: 'info' },
                  { title: 'Alerta de Mermas: Vegetales', desc: 'Se detecta una inconsistencia entre el stock teórico y el real en la familia de verduras (8% de pérdida no justificada).', type: 'error' },
                ].map((item, i) => (
                  <div key={i} className="flex gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                    <div className={cn(
                      "mt-1 w-2 h-2 rounded-full shrink-0",
                      item.type === 'error' ? "bg-rose-500" : item.type === 'warning' ? "bg-amber-500" : "bg-blue-500"
                    )} />
                    <div>
                      <p className="text-sm font-bold text-slate-900">{item.title}</p>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                  <BarChart3 size={24} className="text-blue-600" />
                </div>
                <h3 className="text-lg font-bold text-slate-800">Eficiencia de Personal</h3>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">
                Gemini ha detectado que el turno de cena de los viernes tiene un ratio de <span className="font-bold text-slate-900">120€/hora por camarero</span>, lo cual es óptimo. Sin embargo, los martes por la mañana el ratio baja a <span className="font-bold text-slate-900">45€/hora</span>. Se sugiere reducir 1 puesto en ese tramo.
              </p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-emerald-900 text-white p-8 rounded-3xl shadow-xl shadow-emerald-100 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-6 opacity-10">
                <Sparkles size={120} />
              </div>
              <h3 className="text-emerald-300 text-xs font-bold uppercase tracking-widest mb-6">Score de Salud</h3>
              <div className="flex items-end gap-2">
                <span className="text-6xl font-black">8.4</span>
                <span className="text-emerald-400 font-bold mb-2">/ 10</span>
              </div>
              <p className="mt-4 text-emerald-100/80 text-sm leading-relaxed">
                Tu restaurante está un <span className="text-white font-bold">12% por encima</span> de la media del sector en eficiencia operativa.
              </p>
              <div className="mt-8 pt-8 border-t border-white/10">
                <button className="w-full py-3 bg-white text-emerald-900 rounded-xl font-bold text-sm hover:bg-emerald-50 transition-all">
                  Descargar Informe PDF
                </button>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <CheckCircle2 size={18} className="text-emerald-500" />
                Próximos Pasos
              </h4>
              <ul className="space-y-3">
                <li className="text-xs text-slate-500 flex gap-2">
                  <div className="w-1 h-1 bg-slate-300 rounded-full mt-1.5 shrink-0" />
                  Actualizar escandallo "Spider Tartar".
                </li>
                <li className="text-xs text-slate-500 flex gap-2">
                  <div className="w-1 h-1 bg-slate-300 rounded-full mt-1.5 shrink-0" />
                  Revisar hoja de mermas con el jefe de cocina.
                </li>
                <li className="text-xs text-slate-500 flex gap-2">
                  <div className="w-1 h-1 bg-slate-300 rounded-full mt-1.5 shrink-0" />
                  Ajustar horario de los martes (turno mañana).
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
