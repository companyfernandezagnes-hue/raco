// src/components/AjustesDrawer.tsx
import React, { useState, useEffect } from 'react';
import { X, Users, Download, Bell, Calculator, Landmark, Receipt, Clock, Plug, Settings, Plus, Trash2, KeyRound, Save, CheckCircle, Lock, Mail, Send } from 'lucide-react';
import { supabase } from '../supabase';

interface StaffProfile { id: string; nombre: string; rol: string; activo: boolean; email?: string; pin_hash?: string; }
interface BankAccount { id: string; nombre: string; iban: string; banco: string; saldo_inicial: number; }
interface FixedExpense { id: string; nombre: string; importe: number; frecuencia: string; categoria: string; }
interface HorarioDia { abierto: boolean; apertura: string; cierre: string; }
type Horario = Record<string, HorarioDia>;
const DIAS = ['lunes','martes','miercoles','jueves','viernes','sabado','domingo'];
const DIAS_LABEL: Record<string,string> = { lunes:'Lunes', martes:'Martes', miercoles:'Miercoles', jueves:'Jueves', viernes:'Viernes', sabado:'Sabado', domingo:'Domingo' };

async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const { data } = await supabase.from('app_settings').select('value').eq('key', key).maybeSingle();
  return data ? (data.value as T) : fallback;
}
async function setSetting(key: string, value: unknown) {
  await supabase.from('app_settings').upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
}

interface Props { open: boolean; onClose: () => void; }

export default function AjustesDrawer({ open, onClose }: Props) {
  const [tab, setTab] = useState(0);
  const TABS = [
    { label: 'Equipo', icon: Users },
    { label: 'Accesos', icon: Lock },
    { label: 'Backup', icon: Download },
    { label: 'Notif.', icon: Bell },
    { label: 'Contab.', icon: Calculator },
    { label: 'Bancos', icon: Landmark },
    { label: 'Gastos', icon: Receipt },
    { label: 'Horarios', icon: Clock },
    { label: 'Integrac.', icon: Plug },
  ];
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[300] flex justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white shadow-2xl flex flex-col h-full">
        <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2"><Settings size={16} className="text-indigo-600" /><span className="text-xs font-black text-slate-900 uppercase tracking-widest">Ajustes</span></div>
          <button onClick={onClose} className="p-1 rounded-xl hover:bg-slate-100 text-slate-400 transition-all"><X size={16} /></button>
        </div>
        <div className="flex overflow-x-auto border-b border-slate-100 shrink-0 px-2 pt-1 gap-0.5">
          {TABS.map((t, i) => { const Icon = t.icon; return (
            <button key={i} onClick={() => setTab(i)} className={`flex items-center gap-1 px-2 py-1.5 text-[10px] font-bold whitespace-nowrap rounded-t-xl transition-all ${tab === i ? 'bg-indigo-50 text-indigo-700 border-b-2 border-indigo-600' : 'text-slate-500 hover:bg-slate-50'}`}>
              <Icon size={11} />{t.label}
            </button>
          ); })}
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          {tab === 0 && <TabEquipo />}
          {tab === 1 && <TabAccesos />}
          {tab === 2 && <TabBackup />}
          {tab === 3 && <TabNotificaciones />}
          {tab === 4 && <TabContabilidad />}
          {tab === 5 && <TabBancos />}
          {tab === 6 && <TabGastosFijos />}
          {tab === 7 && <TabHorarios />}
          {tab === 8 && <TabIntegraciones />}
        </div>
      </div>
    </div>
  );
}

function TabEquipo() {
  const [staff, setStaff] = useState<StaffProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [newNombre, setNewNombre] = useState('');
  const [newRol, setNewRol] = useState('camarero');
  const [newEmail, setNewEmail] = useState('');
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
    const insertData: Record<string, unknown> = { nombre: newNombre.trim(), rol: newRol, activo: true };
    if (newEmail.trim()) insertData.email = newEmail.trim().toLowerCase();
    await supabase.from('staff_profiles').insert(insertData);
    if (newEmail.trim()) {
      const { error } = await supabase.auth.admin.inviteUserByEmail(newEmail.trim());
      if (error) setMsg('Empleado creado. Error al enviar invitacion: ' + error.message);
      else setMsg('Empleado creado e invitacion enviada a ' + newEmail.trim());
    } else {
      setMsg('Empleado creado sin acceso por email');
    }
    setNewNombre(''); setNewEmail('');
    setSaving(false);
    loadStaff();
    setTimeout(() => setMsg(''), 4000);
  }
  async function deleteEmpleado(id: string) {
    if (!window.confirm('Eliminar empleado?')) return;
    await supabase.from('staff_profiles').delete().eq('id', id);
    loadStaff();
  }
  async function invitarAcceso(email: string) {
    if (!email) { setMsg('Este empleado no tiene email'); setTimeout(() => setMsg(''), 3000); return; }
    const { error } = await supabase.auth.admin.inviteUserByEmail(email);
    setMsg(error ? 'Error: ' + error.message : 'Invitacion enviada a ' + email);
    setTimeout(() => setMsg(''), 4000);
  }
  return (
    <div className="space-y-3">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Empleados</p>
      {msg && <div className="text-[10px] text-indigo-600 font-bold bg-indigo-50 rounded-xl px-2 py-1">{msg}</div>}
      {loading ? <div className="text-xs text-slate-400 py-4 text-center">Cargando...</div> : (
        <div className="space-y-1.5">
          {staff.map(s => (
            <div key={s.id} className="flex items-center gap-2 p-2 bg-slate-50 rounded-xl">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-900 truncate">{s.nombre}</p>
                <p className="text-[10px] text-slate-400 capitalize">{s.rol}{s.email ? ' · ' + s.email : ''}</p>
              </div>
              <button onClick={() => toggleActivo(s.id, s.activo)} className={`text-[10px] font-bold px-2 py-0.5 rounded-xl transition-all ${s.activo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>{s.activo ? 'Activo' : 'Inactivo'}</button>
              {s.email && <button onClick={() => invitarAcceso(s.email!)} title="Reenviar invitacion" className="p-1 rounded-xl hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 transition-all"><Mail size={13} /></button>}
              <button onClick={() => deleteEmpleado(s.id)} className="p-1 rounded-xl hover:bg-rose-50 text-slate-400 hover:text-rose-500 transition-all"><Trash2 size={13} /></button>
            </div>
          ))}
        </div>
      )}
      <div className="border-t border-slate-100 pt-2 space-y-2">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Anadir empleado</p>
        <input value={newNombre} onChange={e => setNewNombre(e.target.value)} placeholder="Nombre completo" className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300" />
        <input value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="Email (para acceso a la app)" type="email" className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300" />
        <select value={newRol} onChange={e => setNewRol(e.target.value)} className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white">
          <option value="admin">Admin</option>
          <option value="cocinero">Cocinero</option>
          <option value="camarero">Camarero</option>
        </select>
        <button onClick={addEmpleado} disabled={saving} className="w-full flex items-center justify-center gap-1 text-xs font-bold py-1.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all disabled:opacity-50">
          <Plus size={13} /> Anadir{newEmail ? ' y enviar invitacion' : ''}
        </button>
      </div>
    </div>
  );
}

function TabAccesos() {
  const [staff, setStaff] = useState<StaffProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [editPin, setEditPin] = useState<{id:string;nombre:string}|null>(null);
  const [pinVal, setPinVal] = useState('');
  useEffect(() => { loadStaff(); }, []);
  async function loadStaff() {
    setLoading(true);
    const { data } = await supabase.from('staff_profiles').select('id,nombre,rol,activo,email,pin_hash').order('nombre');
    setStaff(data || []);
    setLoading(false);
  }
  async function guardarPin() {
    if (!editPin) return;
    if (!/^d{4}$/.test(pinVal)) { setMsg('El PIN debe tener exactamente 4 digitos'); setTimeout(() => setMsg(''), 3000); return; }
    const { error } = await supabase.from('staff_profiles').update({ pin_hash: pinVal }).eq('id', editPin.id);
    setMsg(error ? 'Error al guardar PIN' : 'PIN de ' + editPin.nombre + ' actualizado');
    setEditPin(null); setPinVal('');
    setTimeout(() => setMsg(''), 3000);
    loadStaff();
  }
  async function resetPassword(email: string, nombre: string) {
    if (!email) { setMsg('Este empleado no tiene email asignado'); setTimeout(() => setMsg(''), 3000); return; }
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/raco' });
    setMsg(error ? 'Error: ' + error.message : 'Email de reseteo enviado a ' + nombre);
    setTimeout(() => setMsg(''), 4000);
  }
  return (
    <div className="space-y-3">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Accesos y contrasenas</p>
      <div className="p-2 bg-amber-50 rounded-xl text-[10px] text-amber-700 font-medium">Solo visible para administradores. Gestiona PINs de caja y accesos web.</div>
      {msg && <div className="text-[10px] text-indigo-600 font-bold bg-indigo-50 rounded-xl px-2 py-1">{msg}</div>}
      {editPin && (
        <div className="p-2 bg-indigo-50 rounded-xl space-y-2">
          <p className="text-xs font-bold text-indigo-900">Cambiar PIN de {editPin.nombre}</p>
          <input value={pinVal} onChange={e => setPinVal(e.target.value)} placeholder="4 digitos" maxLength={4} inputMode="numeric" className="w-full text-xs px-2 py-1.5 border border-indigo-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300 text-center tracking-widest font-bold" />
          <div className="flex gap-2">
            <button onClick={guardarPin} className="flex-1 text-xs font-bold py-1.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all"><Save size={11} className="inline mr-1" />Guardar PIN</button>
            <button onClick={() => { setEditPin(null); setPinVal(''); }} className="px-3 text-xs font-bold py-1.5 bg-slate-200 text-slate-700 rounded-xl">Cancelar</button>
          </div>
        </div>
      )}
      {loading ? <div className="text-xs text-slate-400 text-center py-4">Cargando...</div> : (
        <div className="space-y-1.5">
          {staff.map(s => (
            <div key={s.id} className="p-2 bg-slate-50 rounded-xl">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-900">{s.nombre}</p>
                  <p className="text-[10px] text-slate-400 capitalize">{s.rol}{s.email ? ' · ' + s.email : ' · sin email'}</p>
                </div>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-lg ${s.pin_hash ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>{s.pin_hash ? 'PIN ok' : 'Sin PIN'}</span>
              </div>
              <div className="flex gap-1.5">
                <button onClick={() => { setEditPin({id:s.id,nombre:s.nombre}); setPinVal(''); }} className="flex-1 flex items-center justify-center gap-1 text-[10px] font-bold py-1 bg-indigo-100 text-indigo-700 rounded-xl hover:bg-indigo-200 transition-all"><KeyRound size={11} />Cambiar PIN</button>
                <button onClick={() => resetPassword(s.email || '', s.nombre)} className="flex-1 flex items-center justify-center gap-1 text-[10px] font-bold py-1 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-all"><Mail size={11} />Reset pass</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TabBackup() {
  const [loading, setLoading] = useState(false);
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
      <div className="p-2 bg-slate-50 rounded-xl text-[10px] text-slate-500">Exporta todos los datos para copia de seguridad.</div>
      <button onClick={exportJSON} disabled={loading} className="w-full flex items-center justify-center gap-2 text-xs font-bold py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all disabled:opacity-50">
        <Download size={13} /> Exportar JSON completo
      </button>
      {loading && <p className="text-[10px] text-slate-400 text-center animate-pulse">Exportando...</p>}
    </div>
  );
}

function TabNotificaciones() {
  const defVal = { alertaCierreCaja: true, stockCritico: true, facturasVencidas: true, email: '', whatsapp: '', telegramToken: '', telegramChatId: '' };
  const [data, setData] = useState(defVal);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  useEffect(() => { getSetting('notificaciones', defVal).then(v => setData(v as typeof defVal)); }, []);
  async function save() {
    setSaving(true);
    await setSetting('notificaciones', data);
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }
  const Toggle = ({ label, field }: { label: string; field: keyof typeof data }) => (
    <div className="flex items-center justify-between p-2 bg-slate-50 rounded-xl">
      <span className="text-xs text-slate-700">{label}</span>
      <button onClick={() => setData(d => ({ ...d, [field]: !d[field] }))} className={`w-8 h-4 rounded-full transition-all ${data[field] ? 'bg-indigo-600' : 'bg-slate-300'}`}>
        <div className={`w-3 h-3 rounded-full bg-white shadow transition-all mx-0.5 ${data[field] ? 'translate-x-4' : 'translate-x-0'}`} />
      </button>
    </div>
  );
  return (
    <div className="space-y-3">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Alertas</p>
      <Toggle label="Alerta cierre de caja" field="alertaCierreCaja" />
      <Toggle label="Stock critico" field="stockCritico" />
      <Toggle label="Facturas vencidas" field="facturasVencidas" />
      <div className="border-t border-slate-100 pt-2 space-y-2">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Destino</p>
        <input value={data.email} onChange={e => setData(d => ({ ...d, email: e.target.value }))} placeholder="Email destino" type="email" className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300" />
        <input value={data.whatsapp} onChange={e => setData(d => ({ ...d, whatsapp: e.target.value }))} placeholder="WhatsApp (+34...)" type="tel" className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300" />
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest pt-1">Telegram Bot</p>
        <input value={data.telegramToken} onChange={e => setData(d => ({ ...d, telegramToken: e.target.value }))} placeholder="Bot Token (ej: 123456:ABC...)" className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300 font-mono" />
        <input value={data.telegramChatId} onChange={e => setData(d => ({ ...d, telegramChatId: e.target.value }))} placeholder="Chat ID (ej: -100123456789)" className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300 font-mono" />
        <div className="p-2 bg-slate-50 rounded-xl text-[10px] text-slate-500">Crea tu bot con @BotFather en Telegram y obtén el token. El Chat ID es el del grupo o canal donde recibirás las alertas.</div>
      </div>
      <button onClick={save} disabled={saving} className="w-full flex items-center justify-center gap-1 text-xs font-bold py-1.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all disabled:opacity-50">
        <Save size={13} /> {saved ? 'Guardado!' : 'Guardar'}
      </button>
    </div>
  );
}

function TabContabilidad() {
  const defVal = { iva: 10, fondoMinimo: 200, margenObjetivo: 30, nombre: '', cif: '', direccion: '', telefono: '' };
  const [data, setData] = useState(defVal);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  useEffect(() => { getSetting('contabilidad', defVal).then(v => setData(v as typeof defVal)); }, []);
  async function save() { setSaving(true); await setSetting('contabilidad', data); setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000); }
  const Field = ({ label, field, type = 'text', unit = '' }: { label: string; field: keyof typeof data; type?: string; unit?: string }) => (
    <div>
      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-0.5">{label}</label>
      <div className="flex items-center gap-1">
        <input type={type} value={data[field] as string | number} onChange={e => setData(d => ({ ...d, [field]: type === 'number' ? Number(e.target.value) : e.target.value }))} className="flex-1 text-xs px-2 py-1.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300" />
        {unit && <span className="text-xs text-slate-400">{unit}</span>}
      </div>
    </div>
  );
  return (
    <div className="space-y-3">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Parametros</p>
      <Field label="IVA por defecto" field="iva" type="number" unit="%" />
      <Field label="Fondo caja minimo" field="fondoMinimo" type="number" unit="euros" />
      <Field label="Margen objetivo" field="margenObjetivo" type="number" unit="%" />
      <div className="border-t border-slate-100 pt-2 space-y-2">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Datos fiscales</p>
        <Field label="Nombre / Razon social" field="nombre" />
        <Field label="CIF / NIF" field="cif" />
        <Field label="Direccion" field="direccion" />
        <Field label="Telefono" field="telefono" />
      </div>
      <button onClick={save} disabled={saving} className="w-full flex items-center justify-center gap-1 text-xs font-bold py-1.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all disabled:opacity-50">
        <Save size={13} /> {saved ? 'Guardado!' : 'Guardar'}
      </button>
    </div>
  );
}

function TabBancos() {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const emptyForm = { nombre: '', iban: '', banco: '', saldo_inicial: 0 };
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string|null>(null);
  useEffect(() => { loadAccounts(); }, []);
  async function loadAccounts() { setLoading(true); const { data } = await supabase.from('bank_accounts').select('*').order('nombre'); setAccounts(data || []); setLoading(false); }
  async function saveAccount() {
    setSaving(true);
    if (editId) { await supabase.from('bank_accounts').update(form).eq('id', editId); setEditId(null); }
    else { await supabase.from('bank_accounts').insert(form); }
    setForm(emptyForm); setSaving(false); loadAccounts();
  }
  async function deleteAccount(id: string) { if (!window.confirm('Eliminar cuenta?')) return; await supabase.from('bank_accounts').delete().eq('id', id); loadAccounts(); }
  return (
    <div className="space-y-3">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cuentas bancarias</p>
      {loading ? <div className="text-xs text-slate-400 text-center py-4">Cargando...</div> : (
        <div className="space-y-1.5">
          {accounts.map(a => (
            <div key={a.id} className="flex items-center gap-2 p-2 bg-slate-50 rounded-xl">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-900">{a.nombre}</p>
                <p className="text-[10px] text-slate-400">{a.banco} - {a.iban}</p>
                <p className="text-[10px] text-emerald-600 font-bold">{a.saldo_inicial.toFixed(2)} euros</p>
              </div>
              <button onClick={() => { setEditId(a.id); setForm({ nombre: a.nombre, iban: a.iban, banco: a.banco, saldo_inicial: a.saldo_inicial }); }} className="p-1 rounded-xl hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 transition-all"><Save size={13} /></button>
              <button onClick={() => deleteAccount(a.id)} className="p-1 rounded-xl hover:bg-rose-50 text-slate-400 hover:text-rose-500 transition-all"><Trash2 size={13} /></button>
            </div>
          ))}
        </div>
      )}
      <div className="border-t border-slate-100 pt-2 space-y-2">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{editId ? 'Editar cuenta' : 'Nueva cuenta'}</p>
        {(['nombre','iban','banco'] as const).map(f => <input key={f} value={form[f]} onChange={e => setForm(d => ({ ...d, [f]: e.target.value }))} placeholder={{ nombre:'Nombre', iban:'IBAN', banco:'Banco' }[f]} className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300" />)}
        <input type="number" value={form.saldo_inicial} onChange={e => setForm(d => ({ ...d, saldo_inicial: Number(e.target.value) }))} placeholder="Saldo inicial (euros)" className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300" />
        <div className="flex gap-2">
          <button onClick={saveAccount} disabled={saving} className="flex-1 flex items-center justify-center gap-1 text-xs font-bold py-1.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all disabled:opacity-50"><Plus size={13} /> {editId ? 'Actualizar' : 'Anadir'}</button>
          {editId && <button onClick={() => { setEditId(null); setForm(emptyForm); }} className="px-3 text-xs font-bold py-1.5 bg-slate-200 text-slate-700 rounded-xl hover:bg-slate-300 transition-all">Cancelar</button>}
        </div>
      </div>
    </div>
  );
}

function TabGastosFijos() {
  const [gastos, setGastos] = useState<FixedExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const emptyForm = { nombre: '', importe: 0, frecuencia: 'mensual', categoria: 'suministros' };
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string|null>(null);
  useEffect(() => { loadGastos(); }, []);
  async function loadGastos() { setLoading(true); const { data } = await supabase.from('fixed_expenses').select('*').order('nombre'); setGastos(data || []); setLoading(false); }
  async function saveGasto() {
    setSaving(true);
    if (editId) { await supabase.from('fixed_expenses').update(form).eq('id', editId); setEditId(null); }
    else { await supabase.from('fixed_expenses').insert(form); }
    setForm(emptyForm); setSaving(false); loadGastos();
  }
  async function deleteGasto(id: string) { if (!window.confirm('Eliminar gasto?')) return; await supabase.from('fixed_expenses').delete().eq('id', id); loadGastos(); }
  return (
    <div className="space-y-3">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Gastos fijos</p>
      {loading ? <div className="text-xs text-slate-400 text-center py-4">Cargando...</div> : (
        <div className="space-y-1.5">
          {gastos.map(g => (
            <div key={g.id} className="flex items-center gap-2 p-2 bg-slate-50 rounded-xl">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-900 truncate">{g.nombre}</p>
                <p className="text-[10px] text-slate-400 capitalize">{g.categoria} - {g.frecuencia}</p>
                <p className="text-[10px] text-rose-600 font-bold">{g.importe.toFixed(2)} euros</p>
              </div>
              <button onClick={() => { setEditId(g.id); setForm({ nombre: g.nombre, importe: g.importe, frecuencia: g.frecuencia, categoria: g.categoria }); }} className="p-1 rounded-xl hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 transition-all"><Save size={13} /></button>
              <button onClick={() => deleteGasto(g.id)} className="p-1 rounded-xl hover:bg-rose-50 text-slate-400 hover:text-rose-500 transition-all"><Trash2 size={13} /></button>
            </div>
          ))}
        </div>
      )}
      <div className="border-t border-slate-100 pt-2 space-y-2">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{editId ? 'Editar' : 'Nuevo gasto fijo'}</p>
        <input value={form.nombre} onChange={e => setForm(d => ({ ...d, nombre: e.target.value }))} placeholder="Nombre del gasto" className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300" />
        <input type="number" value={form.importe} onChange={e => setForm(d => ({ ...d, importe: Number(e.target.value) }))} placeholder="Importe (euros)" className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300" />
        <div className="grid grid-cols-2 gap-2">
          <select value={form.frecuencia} onChange={e => setForm(d => ({ ...d, frecuencia: e.target.value }))} className="text-xs px-2 py-1.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white">
            {['mensual','trimestral','anual','semanal'].map(f => <option key={f} value={f}>{f}</option>)}
          </select>
          <select value={form.categoria} onChange={e => setForm(d => ({ ...d, categoria: e.target.value }))} className="text-xs px-2 py-1.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white">
            {['suministros','alquiler','seguros','personal','mantenimiento','otros'].map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="flex gap-2">
          <button onClick={saveGasto} disabled={saving} className="flex-1 flex items-center justify-center gap-1 text-xs font-bold py-1.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all disabled:opacity-50"><Plus size={13} /> {editId ? 'Actualizar' : 'Anadir'}</button>
          {editId && <button onClick={() => { setEditId(null); setForm(emptyForm); }} className="px-3 text-xs font-bold py-1.5 bg-slate-200 text-slate-700 rounded-xl hover:bg-slate-300 transition-all">Cancelar</button>}
        </div>
      </div>
    </div>
  );
}

function TabHorarios() {
  const defHorario: Horario = Object.fromEntries(DIAS.map(d => [d, { abierto: d !== 'domingo', apertura: '09:00', cierre: '23:00' }]));
  const [horario, setHorario] = useState<Horario>(defHorario);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  useEffect(() => { getSetting('horarios', defHorario).then(v => setHorario(v as Horario)); }, []);
  async function save() { setSaving(true); await setSetting('horarios', horario); setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000); }
  function update(dia: string, field: keyof HorarioDia, val: boolean | string) { setHorario(h => ({ ...h, [dia]: { ...h[dia], [field]: val } })); }
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
                <button onClick={() => update(dia, 'abierto', !h.abierto)} className={`w-8 h-4 rounded-full transition-all ${h.abierto ? 'bg-indigo-600' : 'bg-slate-300'}`}>
                  <div className={`w-3 h-3 rounded-full bg-white shadow transition-all mx-0.5 ${h.abierto ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
              </div>
              {h.abierto && (
                <div className="flex gap-2 items-center">
                  <div className="flex-1"><label className="text-[10px] text-slate-400">Apertura</label><input type="time" value={h.apertura} onChange={e => update(dia, 'apertura', e.target.value)} className="w-full text-xs px-2 py-1 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300" /></div>
                  <div className="flex-1"><label className="text-[10px] text-slate-400">Cierre</label><input type="time" value={h.cierre} onChange={e => update(dia, 'cierre', e.target.value)} className="w-full text-xs px-2 py-1 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300" /></div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <button onClick={save} disabled={saving} className="w-full flex items-center justify-center gap-1 text-xs font-bold py-1.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all disabled:opacity-50">
        <Save size={13} /> {saved ? 'Guardado!' : 'Guardar horarios'}
      </button>
    </div>
  );
}

function TabIntegraciones() {
  const defVal = { geminiApiKey: '', whatsappBusiness: '', googleCalendarClientId: '', tpvMarca: '', tpvModelo: '', impresoraIp: '', impresoraPuerto: '9100' };
  const [fields, setFields] = useState(defVal);
  const [saved, setSaved] = useState<Record<string,boolean>>({});
  useEffect(() => { getSetting('integraciones', defVal).then(v => setFields(v as typeof defVal)); }, []);
  async function saveField(key: keyof typeof fields) {
    await setSetting('integraciones', fields);
    setSaved(s => ({ ...s, [key]: true }));
    setTimeout(() => setSaved(s => ({ ...s, [key]: false })), 2000);
  }
  const Row = ({ label, field, type = 'text', placeholder = '' }: { label: string; field: keyof typeof fields; type?: string; placeholder?: string }) => (
    <div className="p-2 bg-slate-50 rounded-xl space-y-1">
      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</label>
      <div className="flex gap-1">
        <input type={type} value={fields[field]} onChange={e => setFields(f => ({ ...f, [field]: e.target.value }))} placeholder={placeholder} className="flex-1 text-xs px-2 py-1.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300" />
        <button onClick={() => saveField(field)} className={`flex items-center gap-1 px-2 py-1 text-[10px] font-bold rounded-xl transition-all ${saved[field] ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'}`}>
          {saved[field] ? <CheckCircle size={11} /> : <Save size={11} />}{saved[field] ? 'OK' : 'Guardar'}
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
      <Row label="TPV Marca" field="tpvMarca" placeholder="Ingenico, Verifone..." />
      <Row label="TPV Modelo" field="tpvModelo" placeholder="iCT220, VX520..." />
      <Row label="Impresora IP" field="impresoraIp" placeholder="192.168.1.100" />
      <Row label="Impresora Puerto" field="impresoraPuerto" placeholder="9100" />
    </div>
  );
}
