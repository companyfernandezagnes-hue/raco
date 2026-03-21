import React, { Component, ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import AlbaranesView from './views/Albaranes';
import FacturasView from './views/Facturas';
import TesoreriaView from './views/Tesoreria';
import EscandallosView from './views/Escandallos';
import TramitesView from './views/Tramites';
import FacturacionClientesView from './views/FacturacionClientes';
import AuditoriaView from './views/Auditoria';
import EvaluacionCartasView from './views/EvaluacionCartas';
import StockView from './views/Stock';
import PersonalView from './views/Personal';
import MarketingView from './views/Marketing';
import CierreCajaView from './views/CierreCaja';
import DocumentosView from './views/Documentos';
import BancoView from './views/Banco';
import DashboardView from './views/Dashboard';
import ProveedoresView from './views/Proveedores';
import ComprasView from './views/Compras';
import MenuView from './views/MenuView';
import { useAppData } from './hooks/useAppData';
import { SupabaseProvider, useSupabase } from './context/SupabaseContext';
import { PinProvider, usePin } from './context/PinContext';
import { EmployeeRol } from './supabase';
import { LogIn, AlertTriangle, Key, ShieldCheck, ChefHat, ClipboardList } from 'lucide-react';

// Tabla de permisos por rol
const ROLE_PERMISSIONS: Record<EmployeeRol, string[]> = {
  admin: ['*'],
  cocinero: ['/', '/escandallos', '/menu', '/inventario', '/albaranes', '/proveedores', '/evaluacion-cartas'],
  camarero: ['/', '/inventario', '/proveedores'],
};

const hasAccess = (rol: EmployeeRol, path: string): boolean => {
  const perms = ROLE_PERMISSIONS[rol];
  if (perms.includes('*')) return true;
  return perms.includes(path);
};

// ---- Error Boundary ----
class ErrorBoundary extends Component<any, any> {
  state = { hasError: false, error: null };
  static getDerivedStateFromError(error: any) { return { hasError: true, error }; }
  componentDidCatch(error: any, errorInfo: any) { console.error('ErrorBoundary', error, errorInfo); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-center">
          <div className="max-w-md space-y-4">
            <div className="w-20 h-20 bg-rose-100 text-rose-600 rounded-3xl flex items-center justify-center mx-auto">
              <AlertTriangle size={40} />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Algo ha salido mal</h1>
            <p className="text-slate-500">Ha ocurrido un error inesperado. Por favor, recarga la pagina.</p>
            <button onClick={() => window.location.reload()} className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold hover:bg-slate-800 transition-all">
              Recargar Aplicacion
            </button>
          </div>
        </div>
      );
    }
    return (this as any).props.children;
  }
}

// ---- Pantalla de Login ----
function LoginScreen() {
  const { loginWithGoogle, loginWithEmail, loading, error } = useSupabase();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showEmail, setShowEmail] = React.useState(false);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-8 animate-in fade-in zoom-in-95 duration-500">
        <div className="text-center space-y-2">
          <div className="w-20 h-20 bg-emerald-600 text-white rounded-[2.5rem] flex items-center justify-center mx-auto shadow-2xl shadow-emerald-200 mb-6">
            <LogIn size={40} />
          </div>
          <h1 className="text-4xl font-black tracking-tight text-slate-900">Raco Blanquerna SL</h1>
          <p className="text-slate-500 font-medium">Gestion integral de restauracion</p>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-2xl text-sm font-medium text-center">
            {error}
          </div>
        )}

        <div className="space-y-3">
          <button
            onClick={loginWithGoogle}
            disabled={loading}
            className="w-full bg-white border border-slate-200 text-slate-700 py-4 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-slate-50 transition-all shadow-sm disabled:opacity-50"
          >
            <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
            Continuar con Google
          </button>

          <button
            onClick={() => setShowEmail(!showEmail)}
            className="w-full text-slate-400 text-sm font-medium hover:text-slate-600 transition-colors"
          >
            {showEmail ? 'Ocultar acceso con email' : 'Acceder con email y contrasena'}
          </button>

          {showEmail && (
            <div className="space-y-3">
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-slate-900 focus:border-emerald-500 outline-none"
              />
              <input
                type="password"
                placeholder="Contrasena"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-slate-900 focus:border-emerald-500 outline-none"
              />
              <button
                onClick={() => loginWithEmail(email, password)}
                disabled={loading || !email || !password}
                className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-bold hover:bg-emerald-700 transition-all disabled:opacity-50"
              >
                Iniciar sesion
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-slate-400 font-medium">
          Al continuar, aceptas nuestros terminos y condiciones.
        </p>
      </div>
    </div>
  );
}

// ---- Pantalla de PIN ----
function PinScreen() {
  const { employee, logout } = useSupabase();
  const { verificarPin, pinError, intentosRestantes } = usePin();
  const [pin, setPin] = React.useState('');
  const [checking, setChecking] = React.useState(false);

  const handleVerify = async () => {
    if (pin.length !== 4) return;
    setChecking(true);
    await verificarPin(pin);
    setPin('');
    setChecking(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleVerify();
  };

  const rolIcon = employee?.rol === 'admin'
    ? <ShieldCheck size={24} />
    : employee?.rol === 'cocinero'
    ? <ChefHat size={24} />
    : <ClipboardList size={24} />;

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-8 animate-in fade-in zoom-in-95 duration-500">
        <div className="text-center space-y-2">
          <div className="w-20 h-20 bg-slate-900 text-white rounded-[2.5rem] flex items-center justify-center mx-auto shadow-2xl mb-6">
            <Key size={40} />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">Introduce tu PIN</h1>
          <p className="text-slate-500 font-medium">
            Hola, <span className="font-bold text-slate-700">{employee?.nombre}</span>
          </p>
          <div className="inline-flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-full text-xs font-bold text-slate-600 uppercase tracking-widest">
            {rolIcon}
            {employee?.rol}
          </div>
        </div>

        {pinError && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-2xl text-sm font-medium text-center">
            {pinError}
          </div>
        )}

        <div className="space-y-4">
          <input
            type="password"
            value={pin}
            onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
            onKeyDown={handleKeyDown}
            placeholder="••••"
            className="w-full text-center text-4xl font-black tracking-[0.75em] py-5 bg-white border-2 border-slate-200 rounded-2xl focus:border-emerald-500 outline-none transition-all"
            maxLength={4}
            autoFocus
            inputMode="numeric"
          />
          <button
            onClick={handleVerify}
            disabled={checking || pin.length !== 4}
            className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-slate-800 transition-all shadow-lg disabled:opacity-40"
          >
            {checking ? 'Verificando...' : 'Confirmar'}
          </button>
          <button
            onClick={logout}
            className="w-full text-slate-400 text-sm font-medium hover:text-slate-600 transition-colors"
          >
            Cambiar de cuenta
          </button>
        </div>

        <p className="text-center text-xs text-slate-400">
          Intentos restantes: {intentosRestantes}
        </p>
      </div>
    </div>
  );
}

// ---- Guard de ruta por rol ----
function RoleGuard({ path, children }: { path: string; children: React.ReactNode }) {
  const { rol } = usePin();
  if (!rol) return <Navigate to="/" replace />;
  if (!hasAccess(rol, path)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

// ---- Contenido principal de la app ----
function AppContent() {
  const { session, employee, loading } = useSupabase();
  const { pinVerificado } = usePin();
  const { data, onSave } = useAppData();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 font-bold animate-pulse">Cargando Raco Blanquerna SL...</p>
        </div>
      </div>
    );
  }

  // Paso 1: Sin sesion -> Login
  if (!session || !employee) return <LoginScreen />;

  // Paso 2: Sesion ok pero PIN no verificado -> PIN
  if (!pinVerificado) return <PinScreen />;

  // Paso 3: Todo ok -> App
  const rol = employee.rol;

  return (
    <BrowserRouter basename="/raco">
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<DashboardView />} />

          {/* Admin: acceso total */}
          <Route path="albaranes" element={
            <RoleGuard path="/albaranes"><ComprasView data={data} onSave={onSave} /></RoleGuard>
          } />
          <Route path="facturas" element={
            <RoleGuard path="/facturas"><ComprasView data={data} onSave={onSave} /></RoleGuard>
          } />
          <Route path="compras" element={
            <RoleGuard path="/compras"><ComprasView data={data} onSave={onSave} /></RoleGuard>
          } />
          <Route path="facturacion-clientes" element={
            <RoleGuard path="/facturacion-clientes"><FacturacionClientesView /></RoleGuard>
          } />
          <Route path="cierre-caja" element={
            <RoleGuard path="/cierre-caja"><CierreCajaView /></RoleGuard>
          } />
          <Route path="tesoreria" element={
            <RoleGuard path="/tesoreria"><TesoreriaView data={data} onSave={onSave} /></RoleGuard>
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
          <Route path="documentos" element={
            <RoleGuard path="/documentos"><DocumentosView /></RoleGuard>
          } />
          <Route path="banco" element={
            <RoleGuard path="/banco"><BancoView /></RoleGuard>
          } />

          {/* Cocinero + Admin */}
          <Route path="escandallos" element={
            <RoleGuard path="/escandallos"><EscandallosView /></RoleGuard>
          } />
          <Route path="menu" element={
            <RoleGuard path="/menu"><MenuView data={data} onSave={onSave} /></RoleGuard>
          } />
          <Route path="evaluacion-cartas" element={
            <RoleGuard path="/evaluacion-cartas"><EvaluacionCartasView /></RoleGuard>
          } />

          {/* Cocinero + Camarero + Admin */}
          <Route path="inventario" element={
            <RoleGuard path="/inventario"><StockView /></RoleGuard>
          } />
          <Route path="proveedores" element={
            <RoleGuard path="/proveedores"><ProveedoresView /></RoleGuard>
          } />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

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
