// src/components/AjustesDrawer.tsx
import React, { useState, useEffect } from 'react';
import {
  X, Users, Download, Bell, Calculator, Landmark,
  Receipt, Clock, Plug, Settings, Plus, Trash2,
  KeyRound, Save, ChevronDown, ChevronUp, CheckCircle, Circle
} from 'lucide-react';
import { supabase } from '../supabase';

// ── Tipos ────────────────────────────────────────────────────────────────────
interface StaffProfile { id: string; nombre: string; rol: string; activo: boolean; }
interface BankAccount { id: string; nombre: string; iban: string; banco: string; saldo_inicial: number; }
interface FixedExpense { id: string; nombre: string; importe: number; frecuencia: string; categoria: string; }
interface HorarioDia { abierto: boolean; apertura: string; cierre: string; }
type Horario = Record<string, HorarioDia>;

const DIAS = ['lunes','martes','miercoles','jueves','viernes','sabado','domingo'];
const DIAS_LABEL: Record<string,string> = {
  lunes:'Lunes', martes:'Martes', miercoles:'Miércoles',
  jueves:'Jueves', viernes:'Viernes', sabado:'Sábado', domingo:'Domingo'
};

// ── Helpers Supabase settings ────────────────────────────────────────────────
async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const { data } = await supabase.from('app_settings').select('value').eq('key', key).maybeSingle();
  return data ? (data.value as T) : fallback;
}
async function setSetting(key: string, value: unknown) {
  await supabase.from('app_settings').upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
}

// ── Componente principal ─────────────────────────────────────────────────────
interface Props { open: boolean; onClose: () => void; }

export default function AjustesDrawer({ open, onClose }: Props) {
  const [tab, setTab] = useState(0);
  const TABS = [
    { label: 'Equipo',       icon: Users },
    { label: 'Backup',       icon: Download },
    { label: 'Notif.',       icon: Bell },
    { label: 'Contab.',      icon: Calculator },
    { label: 'Bancos',       icon: Landmark },
    { label: 'Gastos fijos', icon: Receipt },
    { label: 'Horarios',     icon: Clock },
    { label: 'Integrac.',    icon: Plug },
  ];

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[300] flex justify-end">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      {/* Drawer */}
      <div className="relative w-full max-w-md bg-white shadow-2xl flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2">
            <Settings size={16} className="text-indigo-600" />
            <span className="text-xs font-black text-slate-900 uppercase tracking-widest">Ajustes</span>
          </div>
          <button onClick={onClose} className="p-1 rounded-xl hover:bg-slate-100 text-slate-400 transition-all">
            <X size={16} />
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex overflow-x-auto border-b border-slate-100 shrink-0 px-2 pt-1 gap-0.5">
          {TABS.map((t, i) => {
            const Icon = t.icon;
            return (
              <button key={i} onClick={() => setTab(i)}
                className={`flex items-center gap-1 px-2 py-1.5 text-[10px] font-bold whitespace-nowrap rounded-t-xl transition-all ${
                  tab === i ? 'bg-indigo-50 text-indigo-700 border-b-2 border-indigo-600' : 'text-slate-500 hover:bg-slate-50'
                }`}>
                <Icon size={11} />{t.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3">
          {tab === 0 && <TabEquipo />}
          {tab === 1 && <TabBackup />}
          {tab === 2 && <TabNotificaciones />}
          {tab === 3 && <TabContabilidad />}
          {tab === 4 && <TabBancos />}
          {tab === 5 && <TabGastosFijos />}
          {tab === 6 && <TabHorarios />}
          {tab === 7 && <TabIntegraciones />}
        </div>
      </div>
    </div>

// ══════════════════════════════════════════════════════════════════
// TAB 1 — EQUIPO
// ══════════════════════════════════════════════════════════════════
function TabEquipo() {
  const [staff, setStaff] = useState<StaffProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [newNombre, setNewNombre] = useState('');
  const [newRol, setNewRol] = useState('camarero');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => { loadStaff(); }, []);

  async function loadStaff() {
    setLoading(true);
    const { data } = await supabase.from('staff_profiles').select('*').order('nombre');
    setStaff(data || []);
    setLoading(false);
  }

  async function toggleActivo(id: string, activo: boolean) {
    await supabase.from('staff_profiles').update({ activo: !activo }).eq('id', id);
    loadStaff();
  }

  async function addEmpleado() {
    if (!newNombre.trim()) return;
    setSaving(true);
    await supabase.from('staff_profiles').insert({ nombre: newNombre.trim(), rol: newRol, activo: true });
    setNewNombre(''); setSaving(false);
    loadStaff();
  }

  async function deleteEmpleado(id: string) {
    await supabase.from('staff_profiles').delete().eq('id', id);
    loadStaff();
  }

  async function cambiarPin(id: string, nombre: string) {
    const pin = window.prompt(`Nuevo PIN (4 dígitos) para ${nombre}:`);
    if (!pin || !/^d{4}$/.test(pin)) { setMsg('PIN debe tener 4 dígitos'); return; }
    const { error } = await supabase.from('staff_profiles').update({ pin_hash: pin }).eq('id', id);
    setMsg(error ? 'Error al guardar PIN' : 'PIN actualizado');
    setTimeout(() => setMsg(''), 3000);
  }

  return (
    <div className="space-y-3">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Empleados</p>
      {msg && <div className="text-[10px] text-indigo-600 font-bold bg-indigo-50 rounded-xl px-2 py-1">{msg}</div>}
      {loading ? (
        <div className="text-xs text-slate-400 py-4 text-center">Cargando...</div>
      ) : (
        <div className="space-y-1.5">
          {staff.map(s => (
            <div key={s.id} className="flex items-center gap-2 p-2 bg-slate-50 rounded-xl">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-900 truncate">{s.nombre}</p>
                <p className="text-[10px] text-slate-400 capitalize">{s.rol}</p>
              </div>
              <button onClick={() => toggleActivo(s.id, s.activo)}
                className={`text-[10px] font-bold px-2 py-0.5 rounded-xl transition-all ${s.activo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>
                {s.activo ? 'Activo' : 'Inactivo'}
              </button>
              <button onClick={() => cambiarPin(s.id, s.nombre)}
                className="p-1 rounded-xl hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 transition-all" title="Cambiar PIN">
                <KeyRound size={13} />
              </button>
              <button onClick={() => deleteEmpleado(s.id)}
                className="p-1 rounded-xl hover:bg-rose-50 text-slate-400 hover:text-rose-500 transition-all">
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
      {/* Añadir empleado */}
      <div className="border-t border-slate-100 pt-2 space-y-2">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Añadir empleado</p>
        <input value={newNombre} onChange={e => setNewNombre(e.target.value)}
          placeholder="Nombre completo" className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300" />
        <select value={newRol} onChange={e => setNewRol(e.target.value)}
          className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white">
          <option value="admin">Admin</option>
          <option value="cocinero">Cocinero</option>
          <option value="camarero">Camarero</option>
        </select>
        <button onClick={addEmpleado} disabled={saving}
          className="w-full flex items-center justify-center gap-1 text-xs font-bold py-1.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all disabled:opacity-50">
          <Plus size={13} /> Añadir
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// TAB 2 — BACKUP
// ══════════════════════════════════════════════════════════════════
function TabBackup() {
  const [loading, setLoading] = useState(false);

  async function exportExcel() {
    setLoading(true);
    try {
      const tables = ['staff_profiles','bank_accounts','fixed_expenses','app_settings'];
      const sheets: Record<string, unknown[]> = {};
      for (const t of tables) {
        const { data } = await supabase.from(t).select('*');
        sheets[t] = data || [];
      }
      const XLSX = await import('https://cdn.sheetjs.com/xlsx-0.20.0/package/xlsx.mjs' as any);
      const wb = XLSX.utils.book_new();
      for (const [name, rows] of Object.entries(sheets)) {
        const ws = XLSX.utils.json_to_sheet(rows as object[]);
        XLSX.utils.book_append_sheet(wb, ws, name.substring(0,31));
      }
      XLSX.writeFile(wb, 'raco-backup-' + new Date().toISOString().split('T')[0] + '.xlsx');
    } catch {
      alert('Error al exportar. Verifica que tienes conexión.');
    }
    setLoading(false);
  }

  async function exportJSON() {
    setLoading(true);
    try {
      const tables = ['staff_profiles','bank_accounts','fixed_expenses','app_settings'];
      const result: Record<string, unknown[]> = {};
      for (const t of tables) {
        const { data } = await supabase.from(t).select('*');
        result[t] = data || [];
      }
      const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'raco-backup-' + new Date().toISOString().split('T')[0] + '.json';
      a.click();
    } catch { alert('Error al exportar.'); }
    setLoading(false);
  }

  return (
    <div className="space-y-3">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Exportar datos</p>
      <div className="p-2 bg-slate-50 rounded-xl text-[10px] text-slate-500">
        Exporta todos los datos del restaurante para hacer una copia de seguridad.
      </div>
      <button onClick={exportExcel} disabled={loading}
        className="w-full flex items-center justify-center gap-2 text-xs font-bold py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all disabled:opacity-50">
        <Download size={13} /> Exportar Excel (una hoja por tabla)
      </button>
      <button onClick={exportJSON} disabled={loading}
        className="w-full flex items-center justify-center gap-2 text-xs font-bold py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all disabled:opacity-50">
        <Download size={13} /> Exportar JSON completo
      </button>
      {loading && <p className="text-[10px] text-slate-400 text-center animate-pulse">Exportando...</p>}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// TAB 3 — NOTIFICACIONES
// ══════════════════════════════════════════════════════════════════
function TabNotificaciones() {
  const [data, setData] = useState({ alertaCierreCaja: true, stockCritico: true, facturasVencidas: true, email: '', whatsapp: '' });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getSetting('notificaciones', data).then(v => setData(v as typeof data));
  }, []);

  async function save() {
    setSaving(true);
    await setSetting('notificaciones', data);
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const Toggle = ({ label, field }: { label: string; field: keyof typeof data }) => (
    <div className="flex items-center justify-between p-2 bg-slate-50 rounded-xl">
      <span className="text-xs text-slate-700">{label}</span>
      <button onClick={() => setData(d => ({ ...d, [field]: !d[field] }))}
        className={`w-8 h-4 rounded-full transition-all ${data[field] ? 'bg-indigo-600' : 'bg-slate-300'}`}>
        <div className={`w-3 h-3 rounded-full bg-white shadow transition-all mx-0.5 ${data[field] ? 'translate-x-4' : 'translate-x-0'}`} />
      </button>
    </div>
  );

  return (
    <div className="space-y-3">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Alertas</p>
      <Toggle label="Alerta cierre de caja" field="alertaCierreCaja" />
      <Toggle label="Stock crítico" field="stockCritico" />
      <Toggle label="Facturas vencidas" field="facturasVencidas" />
      <div className="border-t border-slate-100 pt-2 space-y-2">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Destino</p>
        <input value={data.email} onChange={e => setData(d => ({ ...d, email: e.target.value }))}
          placeholder="Email destino" type="email"
          className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300" />
        <input value={data.whatsapp} onChange={e => setData(d => ({ ...d, whatsapp: e.target.value }))}
          placeholder="WhatsApp (ej: +34600000000)" type="tel"
          className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300" />
      </div>
      <button onClick={save} disabled={saving}
        className="w-full flex items-center justify-center gap-1 text-xs font-bold py-1.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all disabled:opacity-50">
        <Save size={13} /> {saved ? '¡Guardado!' : 'Guardar'}
      </button>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// TAB 4 — CONTABILIDAD
// ══════════════════════════════════════════════════════════════════
function TabContabilidad() {
  const [data, setData] = useState({ iva: 10, fondoMinimo: 200, margenObjetivo: 30, nombre: '', cif: '', direccion: '', telefono: '' });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { getSetting('contabilidad', data).then(v => setData(v as typeof data)); }, []);

  async function save() {
    setSaving(true);
    await setSetting('contabilidad', data);
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const Field = ({ label, field, type = 'text', unit = '' }: { label: string; field: keyof typeof data; type?: string; unit?: string }) => (
    <div>
      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-0.5">{label}</label>
      <div className="flex items-center gap-1">
        <input type={type} value={data[field] as string | number} onChange={e => setData(d => ({ ...d, [field]: type === 'number' ? Number(e.target.value) : e.target.value }))}
          className="flex-1 text-xs px-2 py-1.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300" />
        {unit && <span className="text-xs text-slate-400">{unit}</span>}
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Parámetros fiscales</p>
      <Field label="IVA por defecto" field="iva" type="number" unit="%" />
      <Field label="Fondo caja mínimo" field="fondoMinimo" type="number" unit="€" />
      <Field label="Margen objetivo" field="margenObjetivo" type="number" unit="%" />
      <div className="border-t border-slate-100 pt-2 space-y-2">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Datos fiscales</p>
        <Field label="Nombre / Razón social" field="nombre" />
        <Field label="CIF / NIF" field="cif" />
        <Field label="Dirección" field="direccion" />
        <Field label="Teléfono" field="telefono" />
      </div>
      <button onClick={save} disabled={saving}
        className="w-full flex items-center justify-center gap-1 text-xs font-bold py-1.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all disabled:opacity-50">
        <Save size={13} /> {saved ? '¡Guardado!' : 'Guardar'}
      </button>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// TAB 5 — BANCOS
// ══════════════════════════════════════════════════════════════════
function TabBancos() {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ nombre: '', iban: '', banco: '', saldo_inicial: 0 });
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string|null>(null);

  useEffect(() => { loadAccounts(); }, []);

  async function loadAccounts() {
    setLoading(true);
    const { data } = await supabase.from('bank_accounts').select('*').order('nombre');
    setAccounts(data || []);
    setLoading(false);
  }

  async function saveAccount() {
    setSaving(true);
    if (editId) {
      await supabase.from('bank_accounts').update(form).eq('id', editId);
      setEditId(null);
    } else {
      await supabase.from('bank_accounts').insert(form);
    }
    setForm({ nombre: '', iban: '', banco: '', saldo_inicial: 0 });
    setSaving(false);
    loadAccounts();
  }

  async function deleteAccount(id: string) {
    if (!window.confirm('¿Eliminar cuenta bancaria?')) return;
    await supabase.from('bank_accounts').delete().eq('id', id);
    loadAccounts();
  }

  function startEdit(a: BankAccount) {
    setEditId(a.id);
    setForm({ nombre: a.nombre, iban: a.iban, banco: a.banco, saldo_inicial: a.saldo_inicial });
  }

  return (
    <div className="space-y-3">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cuentas bancarias</p>
      {loading ? <div className="text-xs text-slate-400 text-center py-4">Cargando...</div> : (
        <div className="space-y-1.5">
          {accounts.map(a => (
            <div key={a.id} className="p-2 bg-slate-50 rounded-xl">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-900">{a.nombre}</p>
                  <p className="text-[10px] text-slate-400">{a.banco} · {a.iban}</p>
                  <p className="text-[10px] text-emerald-600 font-bold">{a.saldo_inicial.toFixed(2)} €</p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => startEdit(a)} className="p-1 rounded-xl hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 transition-all">
                    <Save size={13} />
                  </button>
                  <button onClick={() => deleteAccount(a.id)} className="p-1 rounded-xl hover:bg-rose-50 text-slate-400 hover:text-rose-500 transition-all">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="border-t border-slate-100 pt-2 space-y-2">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{editId ? 'Editar cuenta' : 'Nueva cuenta'}</p>
        {(['nombre','iban','banco'] as const).map(f => (
          <input key={f} value={form[f]} onChange={e => setForm(d => ({ ...d, [f]: e.target.value }))}
            placeholder={{ nombre: 'Nombre cuenta', iban: 'IBAN', banco: 'Banco' }[f]}
            className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300" />
        ))}
        <input type="number" value={form.saldo_inicial} onChange={e => setForm(d => ({ ...d, saldo_inicial: Number(e.target.value) }))}
          placeholder="Saldo inicial (€)"
          className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300" />
        <div className="flex gap-2">
          <button onClick={saveAccount} disabled={saving}
            className="flex-1 flex items-center justify-center gap-1 text-xs font-bold py-1.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all disabled:opacity-50">
            <Plus size={13} /> {editId ? 'Actualizar' : 'Añadir'}
          </button>
          {editId && <button onClick={() => { setEditId(null); setForm({ nombre: '', iban: '', banco: '', saldo_inicial: 0 }); }}
            className="px-3 text-xs font-bold py-1.5 bg-slate-200 text-slate-700 rounded-xl hover:bg-slate-300 transition-all">
            Cancelar
          </button>}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// TAB 6 — GASTOS FIJOS
// ══════════════════════════════════════════════════════════════════
function TabGastosFijos() {
  const [gastos, setGastos] = useState<FixedExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ nombre: '', importe: 0, frecuencia: 'mensual', categoria: 'suministros' });
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string|null>(null);

  useEffect(() => { loadGastos(); }, []);

  async function loadGastos() {
    setLoading(true);
    const { data } = await supabase.from('fixed_expenses').select('*').order('nombre');
    setGastos(data || []);
    setLoading(false);
  }

  async function saveGasto() {
    setSaving(true);
    if (editId) { await supabase.from('fixed_expenses').update(form).eq('id', editId); setEditId(null); }
    else { await supabase.from('fixed_expenses').insert(form); }
    setForm({ nombre: '', importe: 0, frecuencia: 'mensual', categoria: 'suministros' });
    setSaving(false); loadGastos();
  }

  async function deleteGasto(id: string) {
    if (!window.confirm('¿Eliminar gasto fijo?')) return;
    await supabase.from('fixed_expenses').delete().eq('id', id);
    loadGastos();
  }

  return (
    <div className="space-y-3">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Gastos fijos</p>
      {loading ? <div className="text-xs text-slate-400 text-center py-4">Cargando...</div> : (
        <div className="space-y-1.5">
          {gastos.map(g => (
            <div key={g.id} className="flex items-center gap-2 p-2 bg-slate-50 rounded-xl">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-900 truncate">{g.nombre}</p>
                <p className="text-[10px] text-slate-400 capitalize">{g.categoria} · {g.frecuencia}</p>
                <p className="text-[10px] text-rose-600 font-bold">{g.importe.toFixed(2)} €</p>
              </div>
              <button onClick={() => { setEditId(g.id); setForm({ nombre: g.nombre, importe: g.importe, frecuencia: g.frecuencia, categoria: g.categoria }); }}
                className="p-1 rounded-xl hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 transition-all">
                <Save size={13} />
              </button>
              <button onClick={() => deleteGasto(g.id)} className="p-1 rounded-xl hover:bg-rose-50 text-slate-400 hover:text-rose-500 transition-all">
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="border-t border-slate-100 pt-2 space-y-2">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{editId ? 'Editar' : 'Nuevo gasto fijo'}</p>
        <input value={form.nombre} onChange={e => setForm(d => ({ ...d, nombre: e.target.value }))}
          placeholder="Nombre del gasto"
          className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300" />
        <input type="number" value={form.importe} onChange={e => setForm(d => ({ ...d, importe: Number(e.target.value) }))}
          placeholder="Importe (€)"
          className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300" />
        <div className="grid grid-cols-2 gap-2">
          <select value={form.frecuencia} onChange={e => setForm(d => ({ ...d, frecuencia: e.target.value }))}
            className="text-xs px-2 py-1.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white">
            {['mensual','trimestral','anual','semanal'].map(f => <option key={f} value={f} className="capitalize">{f}</option>)}
          </select>
          <select value={form.categoria} onChange={e => setForm(d => ({ ...d, categoria: e.target.value }))}
            className="text-xs px-2 py-1.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white">
            {['suministros','alquiler','seguros','personal','mantenimiento','otros'].map(c => <option key={c} value={c} className="capitalize">{c}</option>)}
          </select>
        </div>
        <div className="flex gap-2">
          <button onClick={saveGasto} disabled={saving}
            className="flex-1 flex items-center justify-center gap-1 text-xs font-bold py-1.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all disabled:opacity-50">
            <Plus size={13} /> {editId ? 'Actualizar' : 'Añadir'}
          </button>
          {editId && <button onClick={() => { setEditId(null); setForm({ nombre: '', importe: 0, frecuencia: 'mensual', categoria: 'suministros' }); }}
            className="px-3 text-xs font-bold py-1.5 bg-slate-200 text-slate-700 rounded-xl hover:bg-slate-300 transition-all">Cancelar</button>}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// TAB 7 — HORARIOS
// ══════════════════════════════════════════════════════════════════
function TabHorarios() {
  const defaultHorario: Horario = Object.fromEntries(
    DIAS.map(d => [d, { abierto: d !== 'domingo', apertura: '09:00', cierre: '23:00' }])
  );
  const [horario, setHorario] = useState<Horario>(defaultHorario);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { getSetting('horarios', defaultHorario).then(v => setHorario(v as Horario)); }, []);

  async function save() {
    setSaving(true);
    await setSetting('horarios', horario);
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function update(dia: string, field: keyof HorarioDia, val: boolean | string) {
    setHorario(h => ({ ...h, [dia]: { ...h[dia], [field]: val } }));
  }

  return (
    <div className="space-y-3">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Horario semanal</p>
      <div className="space-y-1.5">
        {DIAS.map(dia => {
          const h = horario[dia] || { abierto: false, apertura: '09:00', cierre: '23:00' };
          return (
            <div key={dia} className="p-2 bg-slate-50 rounded-xl space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900">{DIAS_LABEL[dia]}</span>
                <button onClick={() => update(dia, 'abierto', !h.abierto)}
                  className={`w-8 h-4 rounded-full transition-all ${h.abierto ? 'bg-indigo-600' : 'bg-slate-300'}`}>
                  <div className={`w-3 h-3 rounded-full bg-white shadow transition-all mx-0.5 ${h.abierto ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
              </div>
              {h.abierto && (
                <div className="flex gap-2 items-center">
                  <div className="flex-1">
                    <label className="text-[10px] text-slate-400">Apertura</label>
                    <input type="time" value={h.apertura} onChange={e => update(dia, 'apertura', e.target.value)}
                      className="w-full text-xs px-2 py-1 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] text-slate-400">Cierre</label>
                    <input type="time" value={h.cierre} onChange={e => update(dia, 'cierre', e.target.value)}
                      className="w-full text-xs px-2 py-1 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <button onClick={save} disabled={saving}
        className="w-full flex items-center justify-center gap-1 text-xs font-bold py-1.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all disabled:opacity-50">
        <Save size={13} /> {saved ? '¡Guardado!' : 'Guardar horarios'}
      </button>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// TAB 8 — INTEGRACIONES
// ══════════════════════════════════════════════════════════════════
function TabIntegraciones() {
  const [fields, setFields] = useState({
    geminiApiKey: '', whatsappBusiness: '', googleCalendarClientId: '',
    tpvMarca: '', tpvModelo: '', impresoraIp: '', impresoraPuerto: '9100'
  });
  const [saved, setSaved] = useState<Record<string,boolean>>({});

  useEffect(() => { getSetting('integraciones', fields).then(v => setFields(v as typeof fields)); }, []);

  async function saveField(key: keyof typeof fields) {
    await setSetting('integraciones', fields);
    setSaved(s => ({ ...s, [key]: true }));
    setTimeout(() => setSaved(s => ({ ...s, [key]: false })), 2000);
  }

  const Row = ({ label, field, type = 'text', placeholder = '' }: { label: string; field: keyof typeof fields; type?: string; placeholder?: string }) => (
    <div className="p-2 bg-slate-50 rounded-xl space-y-1">
      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</label>
      <div className="flex gap-1">
        <input type={type} value={fields[field]} onChange={e => setFields(f => ({ ...f, [field]: e.target.value }))}
          placeholder={placeholder}
          className="flex-1 text-xs px-2 py-1.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300" />
        <button onClick={() => saveField(field)}
          className={`flex items-center gap-1 px-2 py-1 text-[10px] font-bold rounded-xl transition-all ${saved[field] ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'}`}>
          {saved[field] ? <CheckCircle size={11} /> : <Save size={11} />}
          {saved[field] ? 'OK' : 'Guardar'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">APIs y servicios</p>
      <Row label="Gemini API Key" field="geminiApiKey" type="password" placeholder="AIza..." />
      <Row label="WhatsApp Business Token" field="whatsappBusiness" type="password" placeholder="Token de acceso" />
      <Row label="Google Calendar Client ID" field="googleCalendarClientId" placeholder="xxx.apps.googleusercontent.com" />
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest pt-1">Hardware</p>
      <Row label="TPV — Marca" field="tpvMarca" placeholder="Ingenico, Verifone..." />
      <Row label="TPV — Modelo" field="tpvModelo" placeholder="iCT220, VX520..." />
      <Row label="Impresora — IP" field="impresoraIp" placeholder="192.168.1.100" />
      <Row label="Impresora — Puerto" field="impresoraPuerto" placeholder="9100" />
    </div>
  );
}
  );
}
