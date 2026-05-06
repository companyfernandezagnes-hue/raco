// src/views/Marketing.tsx
// ✅ 100% Supabase — tablas marketing_campaigns + marketing_calendar
// ✅ Google Calendar sync via OAuth2 (leer eventos del calendario de empresa)
// ✅ Calendario visual con festivos Mallorca + dias propios + campañas
// ✅ Gestor de campañas: San Valentín, San Patricio, San Juan...
// ✅ Brief IA por campaña: ideas de contenido, copy para cada red social
// ✅ Presupuesto y métricas por campaña (ROI calculado)
// ✅ Alertas de festivos próximos sin campaña asignada
// ✅ Toast notifications, Gen Z UX
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Megaphone, Plus, Brain, Calendar, Loader2, X, Check,
  AlertTriangle, CheckCircle2, Instagram, Facebook,
  TrendingUp, Edit2, Trash2, Zap, Link, RefreshCw,
  ChevronLeft, ChevronRight, Bell, Tag, Target,
  BarChart3, DollarSign, Eye, MousePointer, Star
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../supabase';
import { GoogleGenAI } from '@google/genai';
import { cn } from '../lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Campaign {
  id: string;
  name: string;
  description?: string;
  type: string;
  status: 'borrador'|'activa'|'pausada'|'finalizada'|'cancelada';
  platforms: string[];
  start_date: string;
  end_date?: string;
  budget: number;
  spent: number;
  reach: number;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue_attr: number;
  ai_brief?: string;
  ai_copy?: Record<string, string>;
  linked_event?: string;
  color: string;
}

interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  end_date?: string;
  type: 'festivo'|'cierre'|'vacaciones'|'evento_propio'|'campaña'|'otro';
  all_day: boolean;
  description?: string;
  campaign_id?: string;
  color: string;
  google_event_id?: string;
}

type TabId = 'calendario'|'campanas'|'metricas';

// ─── Constants ────────────────────────────────────────────────────────────────
const PLATFORMS = [
  { id: 'instagram',        label: 'Instagram',          color: 'bg-pink-500',   icon: '📸' },
  { id: 'facebook',         label: 'Facebook',            color: 'bg-blue-600',   icon: '👥' },
  { id: 'tiktok',           label: 'TikTok',              color: 'bg-slate-900',  icon: '🎵' },
  { id: 'google_my_business',label: 'Google My Business', color: 'bg-amber-500',  icon: '📍' },
];

const CAMPAIGN_TYPES = [
  { id: 'festivo',     label: 'Festivo',      emoji: '🎉' },
  { id: 'promocion',   label: 'Promoción',    emoji: '🏷️' },
  { id: 'evento',      label: 'Evento propio', emoji: '🎪' },
  { id: 'temporada',   label: 'Temporada',    emoji: '🌸' },
  { id: 'lanzamiento', label: 'Lanzamiento',  emoji: '🚀' },
  { id: 'otro',        label: 'Otro',         emoji: '📌' },
];

const STATUS_CONFIG = {
  borrador:    { label: 'Borrador',    color: 'bg-slate-100 text-slate-600 border-slate-200' },
  activa:      { label: 'Activa',      color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  pausada:     { label: 'Pausada',     color: 'bg-amber-100 text-amber-700 border-amber-200' },
  finalizada:  { label: 'Finalizada',  color: 'bg-blue-100 text-blue-700 border-blue-200' },
  cancelada:   { label: 'Cancelada',   color: 'bg-rose-100 text-rose-700 border-rose-200' },
};

const EVENT_TYPE_COLOR = {
  festivo:       '#ef4444',
  cierre:        '#64748b',
  vacaciones:    '#06b6d4',
  evento_propio: '#8b5cf6',
  campaña:       '#6366f1',
  otro:          '#94a3b8',
};

const MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const DAYS_ES   = ['L','M','X','J','V','S','D'];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const aiRef = { current: null as GoogleGenAI|null };
function getAI() { if (!aiRef.current) aiRef.current = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY||'' }); return aiRef.current; }
function uid() { return Math.random().toString(36).slice(2,10); }
function fmtEur(n: number) { return n.toLocaleString('es-ES',{style:'currency',currency:'EUR'}); }
function fmtDate(d: string) { if(!d) return '—'; return new Date(d+'T00:00:00').toLocaleDateString('es-ES',{day:'2-digit',month:'short',year:'numeric'}); }
function today() { return new Date().toISOString().split('T')[0]; }
function daysUntil(d: string) { return Math.ceil((new Date(d+'T00:00:00').getTime()-new Date(today()+'T00:00:00').getTime())/86400000); }

// ─── Toast ────────────────────────────────────────────────────────────────────
function useToast() {
  const [toasts, setToasts] = useState<{id:string;msg:string;type:'ok'|'err'|'warn'}[]>([]);
  const show = useCallback((msg: string, type: 'ok'|'err'|'warn'='ok') => {
    const id=uid(); setToasts(t=>[...t,{id,msg,type}]);
    setTimeout(()=>setToasts(t=>t.filter(x=>x.id!==id)),4500);
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

// ─── Mini Calendar ────────────────────────────────────────────────────────────
function MiniCalendar({
  year, month, events, campaigns,
  onDayClick, onPrev, onNext,
}: {
  year: number; month: number;
  events: CalendarEvent[]; campaigns: Campaign[];
  onDayClick: (d: string) => void;
  onPrev: () => void; onNext: () => void;
}) {
  const firstDay = new Date(year, month, 1);
  const lastDay  = new Date(year, month+1, 0);
  const startDow = (firstDay.getDay()+6)%7; // lunes=0
  const days     = lastDay.getDate();

  const eventsThisMonth = events.filter(e => {
    const d = new Date(e.date+'T00:00:00');
    return d.getFullYear()===year && d.getMonth()===month;
  });

  function getEventsForDay(d: number) {
    const str = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    return eventsThisMonth.filter(e => e.date===str);
  }

  function getCampaignsForDay(d: number) {
    const str = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    return campaigns.filter(c => c.start_date<=str && (c.end_date||c.start_date)>=str && c.status!=='cancelada');
  }

  const todayStr = today();

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header mes */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <button onClick={onPrev} className="p-2 rounded-xl hover:bg-slate-100 transition-all text-slate-400"><ChevronLeft size={18}/></button>
        <p className="font-black text-slate-900">{MONTHS_ES[month]} {year}</p>
        <button onClick={onNext} className="p-2 rounded-xl hover:bg-slate-100 transition-all text-slate-400"><ChevronRight size={18}/></button>
      </div>
      {/* Cabecera días */}
      <div className="grid grid-cols-7 px-2 pt-2">
        {DAYS_ES.map(d=>(
          <div key={d} className="text-center text-[10px] font-black text-slate-400 uppercase pb-2">{d}</div>
        ))}
      </div>
      {/* Grid días */}
      <div className="grid grid-cols-7 px-2 pb-3">
        {Array.from({length: startDow}).map((_,i)=><div key={`e${i}`}/>)}
        {Array.from({length: days}).map((_,i)=>{
          const d = i+1;
          const str = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
          const dayEvents = getEventsForDay(d);
          const dayCamps  = getCampaignsForDay(d);
          const isToday   = str===todayStr;
          const isFestivo = dayEvents.some(e=>e.type==='festivo');
          return (
            <button key={d} onClick={()=>onDayClick(str)}
              className={cn(
                'relative flex flex-col items-center py-1.5 px-1 rounded-2xl transition-all hover:bg-slate-50 min-h-[44px]',
                isToday ? 'bg-indigo-600 text-white hover:bg-indigo-700' : '',
                isFestivo && !isToday ? 'text-rose-600' : isToday ? '' : 'text-slate-700'
              )}>
              <span className={cn('text-xs font-bold', isToday?'text-white':'')}>
                {d}
              </span>
              {/* Dots de eventos */}
              <div className="flex gap-0.5 mt-0.5 flex-wrap justify-center max-w-[28px]">
                {dayEvents.slice(0,3).map(e=>(
                  <span key={e.id} className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{backgroundColor: isToday ? 'white' : e.color}} />
                ))}
                {dayCamps.slice(0,2).map(c=>(
                  <span key={c.id} className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{backgroundColor: isToday ? 'rgba(255,255,255,0.7)' : c.color}} />
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN VIEW
// ════════════════════════════════════════════════════════════════════════════
export default function MarketingView() {
  const { show: toast, ToastContainer } = useToast();

  const [activeTab, setActiveTab] = useState<TabId>('calendario');
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [calEvents, setCalEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading]     = useState(true);

  // Calendario
  const now = new Date();
  const [calYear,  setCalYear]  = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());
  const [selectedDay, setSelectedDay] = useState<string|null>(null);

  // Google Calendar
  const [gcalToken, setGcalToken]   = useState<string|null>(localStorage.getItem('gcal_token'));
  const [gcalLoading, setGcalLoading] = useState(false);

  // Modales
  const [showCampaignForm, setShowCampaignForm] = useState(false);
  const [showEventForm,    setShowEventForm]    = useState(false);
  const [editCampaign, setEditCampaign]         = useState<Campaign|null>(null);
  const [saving, setSaving]                     = useState(false);

  // AI
  const [aiLoading, setAiLoading]   = useState<string|null>(null); // campaignId
  const [expandedBrief, setExpandedBrief] = useState<string|null>(null);

  // Forms
  type CampaignForm = Omit<Campaign,'id'|'ai_brief'|'ai_copy'|'description'|'end_date'|'linked_event'> & { description: string; end_date: string; linked_event: string };
  type CalendarEventForm = Omit<CalendarEvent,'id'|'all_day'|'campaign_id'|'google_event_id'> & { end_date: string; description: string };

  const emptyCampaign = (): CampaignForm => ({
    name:'', description:'', type:'festivo', status:'borrador',
    platforms:[], start_date:today(), end_date:'',
    budget:0, spent:0, reach:0, impressions:0, clicks:0, conversions:0,
    revenue_attr:0, linked_event:'', color:'#6366f1',
  });
  const [campForm, setCampForm] = useState<CampaignForm>(emptyCampaign());

  const emptyEvent = (): CalendarEventForm => ({
    title:'', date:selectedDay||today(), end_date:'', type:'evento_propio',
    description:'', color:'#8b5cf6',
  });
  const [eventForm, setEventForm] = useState<CalendarEventForm>(emptyEvent());

  // ── Load ──────────────────────────────────────────────────────────────────
  const loadAll = useCallback(async()=>{
    setLoading(true);
    const [cR,eR] = await Promise.all([
      supabase.from('marketing_campaigns').select('*').order('start_date',{ascending:false}),
      supabase.from('marketing_calendar').select('*').order('date'),
    ]);
    if(cR.data) setCampaigns(cR.data as Campaign[]);
    if(eR.data) setCalEvents(eR.data as CalendarEvent[]);
    setLoading(false);
  },[]);

  useEffect(()=>{loadAll();},[loadAll]);

  // ── Alertas festivos sin campaña (próximos 30 días) ───────────────────────
  const upcomingAlerts = useMemo(()=>{
    const todayStr = today();
    const in30     = new Date(); in30.setDate(in30.getDate()+30);
    const in30Str  = in30.toISOString().split('T')[0];
    return calEvents.filter(e=>{
      if(e.type!=='festivo') return false;
      if(e.date<todayStr||e.date>in30Str) return false;
      // ¿tiene campaña activa ese día?
      const hasCamp = campaigns.some(c=>
        c.start_date<=e.date && (c.end_date||c.start_date)>=e.date && c.status!=='cancelada'
      );
      return !hasCamp;
    });
  },[calEvents,campaigns]);

  // ── Stats campañas ────────────────────────────────────────────────────────
  const stats = useMemo(()=>{
    const active   = campaigns.filter(c=>c.status==='activa').length;
    const totalBudget = campaigns.filter(c=>c.status!=='cancelada').reduce((s,c)=>s+c.budget,0);
    const totalSpent  = campaigns.filter(c=>c.status!=='cancelada').reduce((s,c)=>s+c.spent,0);
    const totalRevenue= campaigns.reduce((s,c)=>s+c.revenue_attr,0);
    const roi = totalSpent>0 ? ((totalRevenue-totalSpent)/totalSpent)*100 : 0;
    return {active,totalBudget,totalSpent,totalRevenue,roi};
  },[campaigns]);

  // ── Google Calendar OAuth ─────────────────────────────────────────────────
  function connectGoogleCalendar() {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if(!clientId) {
      toast('Añade VITE_GOOGLE_CLIENT_ID en tu .env para conectar Google Calendar','err');
      return;
    }
    const scope = encodeURIComponent('https://www.googleapis.com/auth/calendar.readonly');
    const redirect = encodeURIComponent(window.location.origin+'/marketing');
    const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirect}&response_type=token&scope=${scope}&prompt=consent`;
    window.location.href = url;
  }

  // Capturar token de la URL tras OAuth redirect
  useEffect(()=>{
    const hash = window.location.hash;
    if(hash.includes('access_token')) {
      const params = new URLSearchParams(hash.replace('#','?'));
      const token  = params.get('access_token');
      if(token) {
        localStorage.setItem('gcal_token',token);
        setGcalToken(token);
        window.history.replaceState(null,'',window.location.pathname);
        toast('Google Calendar conectado ✓');
        fetchGoogleCalendar(token);
      }
    }
  },[]);

  async function fetchGoogleCalendar(token: string) {
    setGcalLoading(true);
    try {
      const now   = new Date().toISOString();
      const future= new Date(Date.now()+90*86400000).toISOString();
      const res   = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${now}&timeMax=${future}&maxResults=100&singleEvents=true&orderBy=startTime`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if(!res.ok) throw new Error('Token caducado');
      const data = await res.json();

      const newEvents: Omit<CalendarEvent,'id'>[] = (data.items||[])
        .filter((e:any)=>e.start?.date||e.start?.dateTime)
        .map((e:any)=>({
          title:           e.summary||'Evento Google',
          date:            (e.start?.date||e.start?.dateTime||'').slice(0,10),
          end_date:        e.end?.date||e.end?.dateTime?.slice(0,10)||undefined,
          type:            'otro' as const,
          all_day:         !!e.start?.date,
          description:     e.description||undefined,
          color:           '#6366f1',
          google_event_id: e.id,
        }));

      // Insertar solo los que no existen aún (por google_event_id)
      const existingIds = new Set(calEvents.filter(e=>e.google_event_id).map(e=>e.google_event_id));
      const toInsert    = newEvents.filter(e=>e.google_event_id&&!existingIds.has(e.google_event_id!));
      if(toInsert.length>0) {
        await supabase.from('marketing_calendar').insert(toInsert);
        await loadAll();
        toast(`✓ ${toInsert.length} eventos importados de Google Calendar`);
      } else {
        toast('Google Calendar al día — sin eventos nuevos','warn');
      }
    } catch(err:any) {
      localStorage.removeItem('gcal_token');
      setGcalToken(null);
      toast('Sesión Google expirada — vuelve a conectar','warn');
    } finally { setGcalLoading(false); }
  }

  // ── Save campaign ─────────────────────────────────────────────────────────
  async function saveCampaign() {
    if(!campForm.name.trim()||!campForm.start_date) { toast('Nombre y fecha de inicio son obligatorios','err'); return; }
    setSaving(true);
    try {
      const payload = {
        ...campForm,
        budget:    Number(campForm.budget)||0,
        spent:     Number(campForm.spent)||0,
        reach:     Number(campForm.reach)||0,
        impressions: Number(campForm.impressions)||0,
        clicks:    Number(campForm.clicks)||0,
        conversions: Number(campForm.conversions)||0,
        revenue_attr: Number(campForm.revenue_attr)||0,
        end_date:  campForm.end_date||null,
        linked_event: campForm.linked_event||null,
      };
      if(editCampaign) {
        const {error}=await supabase.from('marketing_campaigns').update(payload).eq('id',editCampaign.id);
        if(error) throw error;
        toast('Campaña actualizada ✓');
      } else {
        const {error}=await supabase.from('marketing_campaigns').insert(payload);
        if(error) throw error;
        toast('Campaña creada ✓');
      }
      setShowCampaignForm(false); setEditCampaign(null); setCampForm(emptyCampaign()); await loadAll();
    } catch(err:any) { toast('Error: '+err.message,'err'); }
    finally { setSaving(false); }
  }

  async function deleteCampaign(id: string) {
    if(!confirm('¿Eliminar esta campaña?')) return;
    await supabase.from('marketing_campaigns').delete().eq('id',id);
    setCampaigns(prev=>prev.filter(c=>c.id!==id)); toast('Campaña eliminada');
  }

  async function updateCampaignStatus(id: string, status: Campaign['status']) {
    await supabase.from('marketing_campaigns').update({status}).eq('id',id);
    setCampaigns(prev=>prev.map(c=>c.id===id?{...c,status}:c));
    toast(`Estado → ${STATUS_CONFIG[status].label}`);
  }

  // ── Save calendar event ───────────────────────────────────────────────────
  async function saveEvent() {
    if(!eventForm.title.trim()||!eventForm.date) { toast('Título y fecha son obligatorios','err'); return; }
    setSaving(true);
    try {
      const {error}=await supabase.from('marketing_calendar').insert({
        ...eventForm, all_day:true, end_date:eventForm.end_date||null,
      });
      if(error) throw error;
      toast('Evento añadido al calendario ✓');
      setShowEventForm(false); setEventForm(emptyEvent()); await loadAll();
    } catch(err:any) { toast('Error: '+err.message,'err'); }
    finally { setSaving(false); }
  }

  async function deleteEvent(id: string) {
    await supabase.from('marketing_calendar').delete().eq('id',id);
    setCalEvents(prev=>prev.filter(e=>e.id!==id)); toast('Evento eliminado');
  }

  // ── Generate AI Brief ─────────────────────────────────────────────────────
  async function generateBrief(campaign: Campaign) {
    setAiLoading(campaign.id);
    try {
      const platforms = campaign.platforms.join(', ') || 'redes sociales';
      const daysLeft  = daysUntil(campaign.start_date);

      const res = await getAI().models.generateContent({
        model:'gemini-2.0-flash',
        contents:[{role:'user',parts:[{text:`Eres el director creativo de marketing de Raco Blanquerna, un restaurante moderno en Palma de Mallorca.
Genera un brief completo para esta campaña:

CAMPAÑA: ${campaign.name}
TIPO: ${campaign.type}
PLATAFORMAS: ${platforms}
FECHA: ${fmtDate(campaign.start_date)}${campaign.end_date?' → '+fmtDate(campaign.end_date):''}
PRESUPUESTO: ${fmtEur(campaign.budget)}
DESCRIPCIÓN: ${campaign.description||'—'}
DÍAS HASTA LA CAMPAÑA: ${daysLeft}

Genera en español:

1. CONCEPTO CREATIVO (2-3 líneas)
2. COPY INSTAGRAM (máx 150 caracteres + 5 hashtags relevantes Mallorca restaurante)
3. COPY FACEBOOK (máx 200 caracteres, más formal)
4. COPY TIKTOK (hook inicial de 3 segundos + descripción corta)
5. COPY GOOGLE MY BUSINESS (descripción del evento/promoción, máx 100 palabras)
6. IDEAS DE CONTENIDO VISUAL (3 ideas concretas de foto/vídeo)
7. OFERTA RECOMENDADA (precio/menú especial sugerido para este evento)
8. TIMING DE PUBLICACIÓN (cuándo publicar cada red para máximo impacto)

Sé específico, creativo y orientado a restaurante de Palma de Mallorca. Tono moderno, joven pero sofisticado.`}]}]
      });

      const brief = res.candidates?.[0]?.content?.parts?.[0]?.text||'Sin contenido';

      // Guardar en Supabase
      await supabase.from('marketing_campaigns').update({ai_brief: brief}).eq('id',campaign.id);
      setCampaigns(prev=>prev.map(c=>c.id===campaign.id?{...c,ai_brief:brief}:c));
      setExpandedBrief(campaign.id);
      toast('Brief generado ✓');
    } catch(err:any) { toast('Error IA: '+err.message,'err'); }
    finally { setAiLoading(null); }
  }

  // ── Events del día seleccionado ───────────────────────────────────────────
  const dayEvents = useMemo(()=>{
    if(!selectedDay) return [];
    return calEvents.filter(e=>e.date===selectedDay);
  },[calEvents,selectedDay]);

  const dayCampaigns = useMemo(()=>{
    if(!selectedDay) return [];
    return campaigns.filter(c=>c.start_date<=selectedDay&&(c.end_date||c.start_date)>=selectedDay&&c.status!=='cancelada');
  },[campaigns,selectedDay]);

  const TABS = [
    {id:'calendario' as TabId, label:'Calendario', icon:<Calendar size={14}/>},
    {id:'campanas'   as TabId, label:'Campañas',   icon:<Megaphone size={14}/>, badge:campaigns.filter(c=>c.status==='activa').length},
    {id:'metricas'   as TabId, label:'Métricas',   icon:<BarChart3 size={14}/>},
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-4 md:p-8 space-y-6">
      <ToastContainer/>

      {/* ── Header ── */}
      <header className="sticky top-4 z-[100] bg-white/80 backdrop-blur-xl border border-white/20 shadow-xl rounded-[2.5rem] p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-2xl shadow-lg">
            <Megaphone className="w-5 h-5 text-pink-400"/>
            <span className="font-black text-sm tracking-tighter uppercase">Marketing</span>
          </div>
          {upcomingAlerts.length>0&&(
            <span className="flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl">
              <Bell size={12}/> {upcomingAlerts.length} festivo{upcomingAlerts.length>1?'s':''} sin campaña
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Google Calendar connect */}
          <button
            onClick={gcalToken ? ()=>fetchGoogleCalendar(gcalToken) : connectGoogleCalendar}
            disabled={gcalLoading}
            className={cn('flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold transition-all shadow-sm disabled:opacity-50',
              gcalToken ? 'bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            )}>
            {gcalLoading ? <Loader2 size={14} className="animate-spin"/> : <Link size={14}/>}
            {gcalToken ? 'Sincronizar Google Cal' : 'Conectar Google Calendar'}
          </button>
          {activeTab==='calendario'&&(
            <button onClick={()=>{setEventForm({...emptyEvent(),date:selectedDay||today()});setShowEventForm(true);}}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-2xl text-xs font-bold hover:bg-indigo-700 transition-all shadow-sm shadow-indigo-200">
              <Plus size={14}/> Evento
            </button>
          )}
          {activeTab==='campanas'&&(
            <button onClick={()=>{setCampForm(emptyCampaign());setEditCampaign(null);setShowCampaignForm(true);}}
              className="flex items-center gap-2 px-4 py-2 bg-pink-600 text-white rounded-2xl text-xs font-bold hover:bg-pink-700 transition-all shadow-sm shadow-pink-200">
              <Plus size={14}/> Campaña
            </button>
          )}
        </div>
      </header>

      {/* Alertas festivos sin campaña */}
      {upcomingAlerts.length>0&&(
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {upcomingAlerts.slice(0,3).map(e=>{
            const d=daysUntil(e.date);
            return (
              <div key={e.id} className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-2xl">
                <Bell size={15} className="text-amber-500 shrink-0"/>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-amber-900 truncate">{e.title}</p>
                  <p className="text-xs text-amber-600">{fmtDate(e.date)} · {d===0?'HOY':d<0?`hace ${Math.abs(d)}d`:`en ${d} días`}</p>
                </div>
                <button onClick={()=>{setCampForm({...emptyCampaign(),name:`Campaña ${e.title}`,type:'festivo',start_date:e.date,linked_event:e.title,color:e.color});setShowCampaignForm(true);}}
                  className="px-3 py-1.5 bg-amber-500 text-white rounded-xl text-[10px] font-black hover:bg-amber-600 transition-all shrink-0">
                  Crear campaña
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {label:'Campañas activas',value:stats.active,color:'text-pink-600',icon:<Megaphone size={16} className="text-pink-400"/>},
          {label:'Presupuesto total',value:fmtEur(stats.totalBudget),color:'text-indigo-600',icon:<DollarSign size={16} className="text-indigo-400"/>},
          {label:'Gastado',value:fmtEur(stats.totalSpent),color:'text-slate-900',icon:<Target size={16} className="text-slate-400"/>},
          {label:'ROI estimado',value:stats.roi>0?`+${stats.roi.toFixed(0)}%`:'—',color:stats.roi>=100?'text-emerald-600':'text-amber-600',icon:<TrendingUp size={16} className="text-emerald-400"/>},
        ].map((s,i)=>(
          <motion.div key={i} initial={{opacity:0,y:12}} animate={{opacity:1,y:0}}
            className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-2"><span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{s.label}</span>{s.icon}</div>
            <p className={cn('text-2xl font-black',s.color)}>{s.value}</p>
          </motion.div>
        ))}
      </div>

      {/* ── Tabs ── */}
      <div className="flex bg-white border border-slate-200 rounded-2xl p-1 gap-1 shadow-sm w-fit">
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setActiveTab(t.id)}
            className={cn('flex items-center gap-1.5 px-5 py-2 rounded-xl text-sm font-bold transition-all relative whitespace-nowrap',
              activeTab===t.id?'bg-slate-900 text-white':'text-slate-500 hover:text-slate-800')}>
            {t.icon} {t.label}
            {t.badge!=null&&t.badge>0&&<span className="absolute -top-1 -right-1 w-4 h-4 bg-pink-500 text-white text-[9px] font-black rounded-full flex items-center justify-center">{t.badge}</span>}
          </button>
        ))}
      </div>

      {/* ══ CALENDARIO ══ */}
      {activeTab==='calendario'&&(
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <MiniCalendar
              year={calYear} month={calMonth}
              events={calEvents} campaigns={campaigns}
              onDayClick={(d)=>setSelectedDay(selectedDay===d?null:d)}
              onPrev={()=>{if(calMonth===0){setCalYear(y=>y-1);setCalMonth(11);}else setCalMonth(m=>m-1);}}
              onNext={()=>{if(calMonth===11){setCalYear(y=>y+1);setCalMonth(0);}else setCalMonth(m=>m+1);}}
            />
            {/* Leyenda */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap gap-3">
              {Object.entries(EVENT_TYPE_COLOR).map(([type,color])=>(
                <div key={type} className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{backgroundColor:color}}/>
                  <span className="text-xs text-slate-500 font-medium capitalize">{type==='evento_propio'?'Evento propio':type}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Panel día seleccionado */}
          <div className="space-y-4">
            {selectedDay ? (
              <>
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Día seleccionado</p>
                  <p className="text-xl font-black text-slate-900">{fmtDate(selectedDay)}</p>
                </div>
                {/* Eventos del día */}
                {dayEvents.length>0&&(
                  <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                    <p className="px-5 py-3 border-b border-slate-100 text-xs font-black uppercase tracking-wider text-slate-400">Eventos</p>
                    <div className="divide-y divide-slate-50">
                      {dayEvents.map(e=>(
                        <div key={e.id} className="flex items-center gap-3 px-5 py-3 group">
                          <span className="w-3 h-3 rounded-full shrink-0" style={{backgroundColor:e.color}}/>
                          <div className="flex-1">
                            <p className="text-sm font-bold text-slate-800">{e.title}</p>
                            {e.description&&<p className="text-xs text-slate-400">{e.description}</p>}
                          </div>
                          {!e.google_event_id&&(
                            <button onClick={()=>deleteEvent(e.id)} className="p-1.5 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-all opacity-0 group-hover:opacity-100"><Trash2 size={13}/></button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {/* Campañas activas ese día */}
                {dayCampaigns.length>0&&(
                  <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                    <p className="px-5 py-3 border-b border-slate-100 text-xs font-black uppercase tracking-wider text-slate-400">Campañas activas</p>
                    <div className="divide-y divide-slate-50">
                      {dayCampaigns.map(c=>(
                        <div key={c.id} className="flex items-center gap-3 px-5 py-3">
                          <span className="w-3 h-3 rounded-full shrink-0" style={{backgroundColor:c.color}}/>
                          <div className="flex-1">
                            <p className="text-sm font-bold text-slate-800">{c.name}</p>
                            <p className="text-xs text-slate-400">{c.platforms.join(' · ')}</p>
                          </div>
                          <span className={cn('text-[10px] font-black px-2 py-0.5 rounded-lg border',STATUS_CONFIG[c.status].color)}>{STATUS_CONFIG[c.status].label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {dayEvents.length===0&&dayCampaigns.length===0&&(
                  <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8 text-center">
                    <p className="text-slate-400 text-sm font-medium">Sin eventos este día</p>
                    <button onClick={()=>{setEventForm({...emptyEvent(),date:selectedDay});setShowEventForm(true);}}
                      className="mt-3 flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-2xl text-xs font-bold hover:bg-indigo-700 transition-all mx-auto">
                      <Plus size={13}/> Añadir evento
                    </button>
                  </div>
                )}
              </>
            ) : (
              /* Próximos festivos */
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <p className="px-5 py-4 border-b border-slate-100 font-black text-slate-900 text-sm">Próximos festivos</p>
                <div className="divide-y divide-slate-50">
                  {calEvents
                    .filter(e=>e.type==='festivo'&&e.date>=today())
                    .slice(0,8)
                    .map(e=>{
                      const d=daysUntil(e.date);
                      const hasCamp=campaigns.some(c=>c.start_date<=e.date&&(c.end_date||c.start_date)>=e.date&&c.status!=='cancelada');
                      return (
                        <div key={e.id} className="flex items-center gap-3 px-5 py-3">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{backgroundColor:e.color}}/>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-slate-800 truncate">{e.title}</p>
                            <p className="text-xs text-slate-400">{fmtDate(e.date)} · {d===0?'HOY':`en ${d}d`}</p>
                          </div>
                          {hasCamp
                            ? <CheckCircle2 size={14} className="text-emerald-400 shrink-0"/>
                            : <span className="text-[10px] font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded-lg shrink-0">Sin campaña</span>
                          }
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ CAMPAÑAS ══ */}
      {activeTab==='campanas'&&(
        <div className="space-y-4">
          {loading?<div className="flex justify-center py-20"><Loader2 size={32} className="animate-spin text-indigo-400"/></div>
          :campaigns.length===0?
            <div className="flex flex-col items-center py-20 text-center">
              <Megaphone size={48} className="text-slate-200 mb-4"/>
              <p className="text-slate-400 font-bold">Sin campañas todavía</p>
              <button onClick={()=>{setCampForm(emptyCampaign());setShowCampaignForm(true);}}
                className="mt-4 flex items-center gap-2 px-5 py-2.5 bg-pink-600 text-white rounded-2xl text-sm font-bold hover:bg-pink-700 transition-all shadow-lg shadow-pink-200">
                <Plus size={15}/> Nueva campaña
              </button>
            </div>
          :<div className="space-y-4">
            {campaigns.map(camp=>(
              <div key={camp.id} className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-5">
                  {/* Header campaña */}
                  <div className="flex items-start gap-4 flex-wrap">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 text-2xl"
                      style={{backgroundColor:camp.color+'20'}}>
                      {CAMPAIGN_TYPES.find(t=>t.id===camp.type)?.emoji||'📌'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-black text-slate-900">{camp.name}</p>
                        <span className={cn('text-[10px] font-black px-2 py-0.5 rounded-lg border',STATUS_CONFIG[camp.status].color)}>
                          {STATUS_CONFIG[camp.status].label}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {fmtDate(camp.start_date)}{camp.end_date?` → ${fmtDate(camp.end_date)}`:''} ·{' '}
                        {camp.platforms.map(p=>PLATFORMS.find(pl=>pl.id===p)?.icon||p).join(' ')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {/* Cambiar estado rápido */}
                      <select value={camp.status} onChange={e=>updateCampaignStatus(camp.id,e.target.value as Campaign['status'])}
                        onClick={e=>e.stopPropagation()}
                        className="text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none">
                        {Object.entries(STATUS_CONFIG).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
                      </select>
                      <button onClick={()=>{setCampForm({...camp,description:camp.description||'',end_date:camp.end_date||'',linked_event:camp.linked_event||''});setEditCampaign(camp);setShowCampaignForm(true);}}
                        className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-all">
                        <Edit2 size={14}/>
                      </button>
                      <button onClick={()=>deleteCampaign(camp.id)}
                        className="p-2 rounded-xl hover:bg-rose-50 text-slate-300 hover:text-rose-500 transition-all">
                        <Trash2 size={14}/>
                      </button>
                    </div>
                  </div>

                  {/* Budget bar */}
                  <div className="mt-4 space-y-1.5">
                    <div className="flex justify-between text-xs font-bold text-slate-500">
                      <span>Presupuesto gastado</span>
                      <span>{fmtEur(camp.spent)} / {fmtEur(camp.budget)}</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{width:`${Math.min(100,(camp.budget>0?camp.spent/camp.budget*100:0))}%`, backgroundColor:camp.color}}/>
                    </div>
                  </div>

                  {/* Métricas rápidas */}
                  <div className="grid grid-cols-4 gap-3 mt-4">
                    {[
                      {label:'Alcance',value:camp.reach.toLocaleString('es-ES'),icon:<Eye size={12}/>},
                      {label:'Impresiones',value:camp.impressions.toLocaleString('es-ES'),icon:<Star size={12}/>},
                      {label:'Clics',value:camp.clicks.toLocaleString('es-ES'),icon:<MousePointer size={12}/>},
                      {label:'Revenue',value:fmtEur(camp.revenue_attr),icon:<TrendingUp size={12}/>},
                    ].map(m=>(
                      <div key={m.label} className="bg-slate-50 rounded-2xl px-3 py-2.5 text-center">
                        <div className="flex items-center justify-center gap-1 text-slate-400 mb-1">{m.icon}<span className="text-[9px] font-black uppercase tracking-wider">{m.label}</span></div>
                        <p className="font-black text-slate-900 text-sm">{m.value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Brief IA */}
                  <div className="mt-4">
                    {camp.ai_brief ? (
                      <div>
                        <button onClick={()=>setExpandedBrief(expandedBrief===camp.id?null:camp.id)}
                          className="flex items-center gap-2 text-xs font-bold text-indigo-600 hover:text-indigo-700 transition-colors">
                          <Brain size={13}/>
                          {expandedBrief===camp.id?'Ocultar brief':'Ver brief IA'}
                          {expandedBrief===camp.id?<ChevronLeft size={12}/>:<ChevronRight size={12}/>}
                        </button>
                        <AnimatePresence>
                          {expandedBrief===camp.id&&(
                            <motion.div initial={{height:0,opacity:0}} animate={{height:'auto',opacity:1}} exit={{height:0,opacity:0}}
                              className="overflow-hidden">
                              <div className="mt-3 bg-indigo-50 border border-indigo-100 rounded-2xl p-4">
                                <pre className="text-xs text-indigo-800 whitespace-pre-wrap font-sans leading-relaxed">{camp.ai_brief}</pre>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    ) : (
                      <button onClick={()=>generateBrief(camp)} disabled={aiLoading===camp.id}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-xl text-xs font-bold hover:bg-indigo-100 disabled:opacity-50 transition-all">
                        {aiLoading===camp.id?<Loader2 size={13} className="animate-spin"/>:<Zap size={13}/>}
                        Generar brief con IA
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>}
        </div>
      )}

      {/* ══ MÉTRICAS ══ */}
      {activeTab==='metricas'&&(
        <div className="space-y-5">
          {/* Top campañas por ROI */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 space-y-4">
            <p className="font-black text-slate-900">Ranking por ROI</p>
            {campaigns.filter(c=>c.spent>0).sort((a,b)=>((b.revenue_attr-b.spent)/b.spent)-((a.revenue_attr-a.spent)/a.spent)).map(c=>{
              const roi=(c.revenue_attr-c.spent)/c.spent*100;
              return (
                <div key={c.id} className="space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="font-bold text-slate-800 truncate">{c.name}</span>
                    <span className={cn('font-black shrink-0 ml-2',roi>=0?'text-emerald-600':'text-rose-600')}>
                      {roi>=0?'+':''}{roi.toFixed(0)}% ROI
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    <span>Gastado: {fmtEur(c.spent)}</span>
                    <span>Revenue: {fmtEur(c.revenue_attr)}</span>
                    <span>Alcance: {c.reach.toLocaleString()}</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className={cn('h-full rounded-full',roi>=0?'bg-emerald-400':'bg-rose-400')}
                      style={{width:`${Math.min(100,Math.abs(roi)/3)}%`}}/>
                  </div>
                </div>
              );
            })}
            {campaigns.filter(c=>c.spent>0).length===0&&<p className="text-slate-400 text-sm text-center py-4">Registra métricas en tus campañas para ver el ROI</p>}
          </div>

          {/* Presupuesto por plataforma */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 space-y-4">
            <p className="font-black text-slate-900">Presupuesto por plataforma</p>
            <div className="space-y-3">
              {PLATFORMS.map(pl=>{
                const total=campaigns.filter(c=>c.platforms.includes(pl.id)).reduce((s,c)=>s+c.budget,0);
                if(total===0) return null;
                return (
                  <div key={pl.id} className="flex items-center gap-4">
                    <span className="text-lg shrink-0">{pl.icon}</span>
                    <span className="text-sm font-bold text-slate-700 w-32 shrink-0">{pl.label}</span>
                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className={cn('h-full rounded-full',pl.color)} style={{width:`${(total/stats.totalBudget)*100}%`}}/>
                    </div>
                    <span className="font-black text-slate-900 shrink-0 text-sm">{fmtEur(total)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ════ MODALES ════ */}

      {/* Modal campaña */}
      <AnimatePresence>
        {showCampaignForm&&(
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div initial={{y:40,opacity:0}} animate={{y:0,opacity:1}} exit={{y:40,opacity:0}}
              className="bg-white w-full max-w-lg rounded-[2.5rem] flex flex-col max-h-[92vh] overflow-hidden shadow-2xl">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between shrink-0">
                <h2 className="text-xl font-black">{editCampaign?'Editar campaña':'Nueva campaña'}</h2>
                <button onClick={()=>{setShowCampaignForm(false);setEditCampaign(null);}} className="p-2 rounded-xl hover:bg-slate-100 transition-all"><X size={20}/></button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                <div className="space-y-1.5"><label className="text-xs font-black uppercase tracking-widest text-slate-400">Nombre *</label>
                  <input value={campForm.name} onChange={e=>setCampForm(f=>({...f,name:e.target.value}))} placeholder="Ej: Campaña San Valentín 2026" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"/></div>
                <div className="space-y-1.5"><label className="text-xs font-black uppercase tracking-widest text-slate-400">Descripción</label>
                  <textarea value={campForm.description} onChange={e=>setCampForm(f=>({...f,description:e.target.value}))} rows={2} placeholder="Objetivo de la campaña..." className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-pink-300"/></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><label className="text-xs font-black uppercase tracking-widest text-slate-400">Tipo</label>
                    <select value={campForm.type} onChange={e=>setCampForm(f=>({...f,type:e.target.value}))} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-pink-300">
                      {CAMPAIGN_TYPES.map(t=><option key={t.id} value={t.id}>{t.emoji} {t.label}</option>)}
                    </select></div>
                  <div className="space-y-1.5"><label className="text-xs font-black uppercase tracking-widest text-slate-400">Estado</label>
                    <select value={campForm.status} onChange={e=>setCampForm(f=>({...f,status:e.target.value as Campaign['status']}))} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-pink-300">
                      {Object.entries(STATUS_CONFIG).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
                    </select></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><label className="text-xs font-black uppercase tracking-widest text-slate-400">Inicio *</label>
                    <input type="date" value={campForm.start_date} onChange={e=>setCampForm(f=>({...f,start_date:e.target.value}))} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"/></div>
                  <div className="space-y-1.5"><label className="text-xs font-black uppercase tracking-widest text-slate-400">Fin</label>
                    <input type="date" value={campForm.end_date} onChange={e=>setCampForm(f=>({...f,end_date:e.target.value}))} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"/></div>
                </div>
                {/* Plataformas */}
                <div className="space-y-2"><label className="text-xs font-black uppercase tracking-widest text-slate-400">Plataformas</label>
                  <div className="flex flex-wrap gap-2">
                    {PLATFORMS.map(pl=>(
                      <button key={pl.id} type="button"
                        onClick={()=>setCampForm(f=>({...f,platforms:f.platforms.includes(pl.id)?f.platforms.filter(p=>p!==pl.id):[...f.platforms,pl.id]}))}
                        className={cn('flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border-2 transition-all',
                          campForm.platforms.includes(pl.id)?`${pl.color} text-white border-transparent`:'bg-white border-slate-200 text-slate-600 hover:border-slate-300')}>
                        {pl.icon} {pl.label}
                      </button>
                    ))}
                  </div></div>
                {/* Presupuesto */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><label className="text-xs font-black uppercase tracking-widest text-slate-400">Presupuesto (€)</label>
                    <input type="number" min="0" step="10" value={campForm.budget||''} onChange={e=>setCampForm(f=>({...f,budget:parseFloat(e.target.value)||0}))} placeholder="0" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-pink-300 text-right"/></div>
                  <div className="space-y-1.5"><label className="text-xs font-black uppercase tracking-widest text-slate-400">Gastado (€)</label>
                    <input type="number" min="0" step="10" value={campForm.spent||''} onChange={e=>setCampForm(f=>({...f,spent:parseFloat(e.target.value)||0}))} placeholder="0" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-pink-300 text-right"/></div>
                </div>
                {/* Métricas */}
                <div className="space-y-2"><label className="text-xs font-black uppercase tracking-widest text-slate-400">Métricas (opcional)</label>
                  <div className="grid grid-cols-2 gap-3">
                    {[{f:'reach',l:'Alcance'},{f:'impressions',l:'Impresiones'},{f:'clicks',l:'Clics'},{f:'revenue_attr',l:'Revenue atribuido (€)'}].map(m=>(
                      <div key={m.f}><label className="text-[10px] text-slate-400 font-bold">{m.l}</label>
                        <input type="number" min="0" value={(campForm as any)[m.f]||''} onChange={e=>setCampForm(f=>({...f,[m.f]:parseFloat(e.target.value)||0}))} placeholder="0" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-pink-300 text-right"/></div>
                    ))}</div></div>
                {/* Color */}
                <div className="flex items-center gap-3"><label className="text-xs font-black uppercase tracking-widest text-slate-400">Color</label>
                  <input type="color" value={campForm.color} onChange={e=>setCampForm(f=>({...f,color:e.target.value}))} className="w-10 h-10 rounded-xl border-2 border-slate-200 cursor-pointer"/></div>
              </div>
              <div className="p-6 border-t border-slate-100 flex gap-3 shrink-0">
                <button onClick={()=>{setShowCampaignForm(false);setEditCampaign(null);}} className="flex-1 py-3 border border-slate-200 rounded-2xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all">Cancelar</button>
                <button onClick={saveCampaign} disabled={saving} className="flex-1 py-3 bg-pink-600 text-white rounded-2xl text-sm font-bold hover:bg-pink-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-lg shadow-pink-200">
                  {saving?<Loader2 size={16} className="animate-spin"/>:<Check size={16}/>} {editCampaign?'Actualizar':'Crear campaña'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal evento calendario */}
      <AnimatePresence>
        {showEventForm&&(
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div initial={{y:40,opacity:0}} animate={{y:0,opacity:1}} exit={{y:40,opacity:0}}
              className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-xl font-black">Nuevo evento</h2>
                <button onClick={()=>setShowEventForm(false)} className="p-2 rounded-xl hover:bg-slate-100 transition-all"><X size={20}/></button>
              </div>
              <div className="p-6 space-y-4">
                <div className="space-y-1.5"><label className="text-xs font-black uppercase tracking-widest text-slate-400">Título *</label>
                  <input value={eventForm.title} onChange={e=>setEventForm(f=>({...f,title:e.target.value}))} placeholder="Ej: Día cerrado, Vacaciones..." className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"/></div>
                <div className="space-y-1.5"><label className="text-xs font-black uppercase tracking-widest text-slate-400">Tipo</label>
                  <select value={eventForm.type} onChange={e=>setEventForm(f=>({...f,type:e.target.value as CalendarEvent['type'],color:EVENT_TYPE_COLOR[e.target.value as keyof typeof EVENT_TYPE_COLOR]||'#6366f1'}))} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
                    <option value="festivo">🎉 Festivo</option>
                    <option value="cierre">🔒 Día cerrado</option>
                    <option value="vacaciones">🌴 Vacaciones</option>
                    <option value="evento_propio">🎪 Evento propio</option>
                    <option value="otro">📌 Otro</option>
                  </select></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><label className="text-xs font-black uppercase tracking-widest text-slate-400">Fecha *</label>
                    <input type="date" value={eventForm.date} onChange={e=>setEventForm(f=>({...f,date:e.target.value}))} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"/></div>
                  <div className="space-y-1.5"><label className="text-xs font-black uppercase tracking-widest text-slate-400">Hasta</label>
                    <input type="date" value={eventForm.end_date} onChange={e=>setEventForm(f=>({...f,end_date:e.target.value}))} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"/></div>
                </div>
                <div className="space-y-1.5"><label className="text-xs font-black uppercase tracking-widest text-slate-400">Descripción</label>
                  <input value={eventForm.description} onChange={e=>setEventForm(f=>({...f,description:e.target.value}))} placeholder="Notas..." className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"/></div>
              </div>
              <div className="p-6 border-t border-slate-100 flex gap-3">
                <button onClick={()=>setShowEventForm(false)} className="flex-1 py-3 border border-slate-200 rounded-2xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all">Cancelar</button>
                <button onClick={saveEvent} disabled={saving} className="flex-1 py-3 bg-indigo-600 text-white rounded-2xl text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-200">
                  {saving?<Loader2 size={16} className="animate-spin"/>:<Check size={16}/>} Guardar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
