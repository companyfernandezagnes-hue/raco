// src/App.tsx
// ✅ Rutas limpias — sin mockData, sin useAppData
// ✅ /banco → redirige a /tesoreria (mismo módulo)
// ✅ /facturas → redirige a /compras
// ✅ /menu → redirige a /evaluacion-cartas
// ✅ Permisos por rol actualizados con todos los módulos
import React, { Component, ReactNode, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';

// ── Vistas actualizadas (100% Supabase) ──────────────────────────────────────
import DashboardView         from './views/Dashboard';
import ComprasView           from './views/Compras';
import FacturacionClientesView from './views/FacturacionClientes';
import CierreCajaView        from './views/CierreCaja';
import TesoreriaView         from './views/Tesoreria';
import MarketingView         from './views/Marketing';
import EscandallosView       from './views/Escandallos';
import PersonalView          from './views/Personal';
import StockView             from './views/Stock';
import ProveedoresView       from './views/Proveedores';
import AuditoriaView         from './views/Auditoria';
import EvaluacionCartasView  from './views/EvaluacionCartas';
import TramitesView          from './views/Tramites';

// ── Proveedores / Contextos ──────────────────────────────────────────────────
import { SupabaseProvider, useSupabase } from './context/SupabaseContext';
import { PinProvider, usePin }           from './context/PinContext';
import { EmployeeRol }                   from './supabase';
import {
  LogIn, AlertTriangle, Key, ShieldCheck, ChefHat, Loader2
} from 'lucide-react';

// ── Permisos por rol ──────────────────────────────────────────────────────────
const ROLE_PERMISSIONS: Record<EmployeeRol, string[]> = {
  admin: ['*'],
  cocinero: [
    '/', '/escandallos', '/evaluacion-cartas',
    '/inventario', '/compras', '/proveedores',
  ],
  camarero: ['/', '/inventario', '/proveedores', '/cierre-caja'],  encargado_cocina: ['/', '/escandallos', '/evaluacion-cartas', '/inventario', '/compras', '/proveedores', '/personal'],
};

function hasAccess(rol: EmployeeRol, path: string): boolean {
  const perms = ROLE_PERMISSIONS[rol];
  if (perms.includes('*')) return true;
  return perms.some(p => path.startsWith(p) && p !== '/') || path === '/';
}

// ── Error Boundary ────────────────────────────────────────────────────────────
class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: any }> {
  state = { hasError: false, error: null };
  static getDerivedStateFromError(error: any) { return { hasError: true, error }; }
  componentDidCatch(error: any, info: any) { console.error('ErrorBoundary:', error, info); }
  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-center">
        <div className="max-w-md space-y-4">
          <div className="w-20 h-20 bg-rose-100 text-rose-600 rounded-3xl flex items-center justify-center mx-auto">
            <AlertTriangle size={40} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Algo ha salido mal</h1>
          <p className="text-slate-500 text-sm">
            {this.state.error?.message || 'Error inesperado. Recarga la página.'}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-slate-900 text-white rounded-2xl font-bold text-sm hover:bg-slate-700 transition-all">
            Recargar
          </button>
        </div>
      </div>
    );
  }
}

// ── Login Screen ──────────────────────────────────────────────────────────────
function LoginScreen() {
  const { loginWithEmail, loginWithGoogle, loading, error: ctxError } = useSupabase();
  const [email, setEmail]   = useState('');
  const [pass,  setPass]    = useState('');
  const [error, setError]   = useState('');
  const [busy,  setBusy]    = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      await loginWithEmail(email, pass);
    } catch (err: any) {
      setError(err.message || 'Credenciales incorrectas');
    } finally { setBusy(false); }
  }

  async function handleGoogle() {
    setBusy(true); setError('');
    try {
      await loginWithGoogle();
    } catch (err: any) {
      setError(err.message || 'No se pudo iniciar sesión con Google');
    } finally { setBusy(false); }
  }

  const shownError = error || ctxError;

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-indigo-600 rounded-[1.5rem] flex items-center justify-center mx-auto shadow-xl shadow-indigo-200">
            <ChefHat size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-black text-slate-900">Raco Blanquerna</h1>
          <p className="text-slate-400 text-sm">Accede con tu cuenta del equipo</p>
        </div>

        <button
          type="button"
          onClick={handleGoogle}
          disabled={busy || loading}
          className="w-full py-3.5 bg-white border border-slate-200 text-slate-900 rounded-2xl font-bold hover:bg-slate-50 disabled:opacity-50 transition-all flex items-center justify-center gap-3 shadow-sm">
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
            <path fill="#FF3D00" d="m6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C16.318 4 9.656 8.337 6.306 14.691z"/>
            <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
            <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
          </svg>
          Entrar con Google
        </button>

        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-slate-200" />
          <span className="text-xs font-bold uppercase tracking-widest text-slate-400">o</span>
          <div className="flex-1 h-px bg-slate-200" />
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-black uppercase tracking-widest text-slate-400">Email</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)} required
              placeholder="tu@email.com"
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-black uppercase tracking-widest text-slate-400">Contraseña</label>
            <input
              type="password" value={pass} onChange={e => setPass(e.target.value)} required
              placeholder="••••••••"
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>
          {shownError && (
            <div className="flex items-center gap-2 px-4 py-3 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-sm font-medium">
              <AlertTriangle size={14} className="shrink-0" /> {shownError}
            </div>
          )}
          <button type="submit" disabled={busy || loading}
            className="w-full py-3.5 bg-indigo-600 text-white rounded-2xl font-black hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-200">
            {busy ? <Loader2 size={18} className="animate-spin" /> : <LogIn size={18} />}
            {busy ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── PIN Screen ─────────────────────────────────────────────────────────────────
function PinScreen() {
  const { employee, logout } = useSupabase();
  const { verificarPin }    = usePin();
  const [pin, setPin]       = useState('');
  const [error, setError]   = useState('');
  const [intentos, setIntentos] = useState(3);

  async function handlePin(e: React.FormEvent) {
    e.preventDefault();
    const ok = await verificarPin(pin);
    if (!ok) {
      setIntentos(i => i - 1);
      setError(intentos <= 1 ? 'PIN bloqueado. Cierra sesión.' : 'PIN incorrecto');
      setPin('');
    }
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-8 text-center">
        <div className="space-y-2">
          <div className="w-16 h-16 bg-slate-900 rounded-[1.5rem] flex items-center justify-center mx-auto shadow-xl">
            <Key size={28} className="text-white" />
          </div>
          <h2 className="text-2xl font-black text-slate-900">Bienvenido, {(employee as any)?.nombre?.split(' ')[0]}</h2>
          <p className="text-slate-400 text-sm">Introduce tu PIN de 4 dígitos</p>
        </div>
        <form onSubmit={handlePin} className="space-y-4">
          <input
            type="password" inputMode="numeric" maxLength={4}
            value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
            placeholder="••••"
            className="w-full text-center text-3xl font-black tracking-[1rem] px-4 py-4 bg-white border-2 border-slate-200 rounded-2xl focus:outline-none focus:border-indigo-400"
          />
          {error && <p className="text-rose-600 text-sm font-bold">{error}</p>}
          <button type="submit" disabled={pin.length !== 4}
            className="w-full py-3.5 bg-slate-900 text-white rounded-2xl font-black disabled:opacity-40 transition-all flex items-center justify-center gap-2 shadow-lg">
            <ShieldCheck size={18} /> Verificar
          </button>
          <button type="button" onClick={logout}
            className="w-full text-slate-400 text-sm font-medium hover:text-slate-600 transition-colors">
            Cambiar de cuenta
          </button>
        </form>
        <p className="text-xs text-slate-400">Intentos restantes: {intentos}</p>
      </div>
    </div>
  );
}

// ── Role Guard ────────────────────────────────────────────────────────────────
function RoleGuard({ path, children }: { path: string; children: ReactNode }) {
  const { rol } = usePin();
  if (!rol) return <Navigate to="/" replace />;
  if (!hasAccess(rol, path)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

// ── App Content ───────────────────────────────────────────────────────────────
function AppContent() {
  const { session, employee, loading } = useSupabase();
  const { pinVerificado } = usePin();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 font-bold animate-pulse">Cargando Raco Blanquerna…</p>
        </div>
      </div>
    );
  }

  if (!session || !employee) return <LoginScreen />;
  if (!pinVerificado)        return <PinScreen />;

  return (
    <BrowserRouter basename="/raco">
      <Routes>
        <Route path="/" element={<Layout />}>

          {/* Dashboard — todos los roles */}
          <Route index element={<DashboardView />} />

          {/* ── ADMIN ONLY ── */}
          <Route path="compras" element={
            <RoleGuard path="/compras"><ComprasView /></RoleGuard>
          } />
          <Route path="albaranes" element={
            <RoleGuard path="/compras"><ComprasView /></RoleGuard>
          } />
          {/* /facturas redirige a compras (facturas de proveedor están en compras) */}
          <Route path="facturas" element={
            <RoleGuard path="/compras"><ComprasView /></RoleGuard>
          } />

          <Route path="facturacion-clientes" element={
            <RoleGuard path="/facturacion-clientes"><FacturacionClientesView /></RoleGuard>
          } />
          <Route path="cierre-caja" element={
            <RoleGuard path="/cierre-caja"><CierreCajaView /></RoleGuard>
          } />
          <Route path="tesoreria" element={
            <RoleGuard path="/tesoreria"><TesoreriaView /></RoleGuard>
          } />
          {/* /banco redirige a tesoreria — el módulo banco está integrado ahí */}
          <Route path="banco" element={
            <RoleGuard path="/tesoreria"><TesoreriaView /></RoleGuard>
          } />
          <Route path="marketing" element={
            <RoleGuard path="/marketing"><MarketingView /></RoleGuard>
          } />
          <Route path="personal" element={
            <RoleGuard path="/personal"><PersonalView /></RoleGuard>
          } />
          <Route path="auditoria" element={
            <RoleGuard path="/auditoria"><AuditoriaView /></RoleGuard>
          } />
          <Route path="tramites" element={
            <RoleGuard path="/tramites"><TramitesView /></RoleGuard>
          } />

          {/* ── ADMIN + COCINERO ── */}
          <Route path="escandallos" element={
            <RoleGuard path="/escandallos"><EscandallosView /></RoleGuard>
          } />
          <Route path="evaluacion-cartas" element={
            <RoleGuard path="/evaluacion-cartas"><EvaluacionCartasView /></RoleGuard>
          } />
          {/* /menu redirige a evaluacion-cartas — es el mismo concepto */}
          <Route path="menu" element={
            <RoleGuard path="/evaluacion-cartas"><EvaluacionCartasView /></RoleGuard>
          } />

          {/* ── TODOS LOS ROLES ── */}
          <Route path="inventario" element={
            <RoleGuard path="/inventario"><StockView /></RoleGuard>
          } />
          <Route path="proveedores" element={
            <RoleGuard path="/proveedores"><ProveedoresView /></RoleGuard>
          } />

          {/* Catch-all → Dashboard */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

// ── Export ────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <ErrorBoundary>
      <SupabaseProvider>
        <PinProvider>
          <AppContent />
        </PinProvider>
      </SupabaseProvider>
    </ErrorBoundary>
  );
}
