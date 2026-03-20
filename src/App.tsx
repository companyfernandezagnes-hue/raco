import React, { Component, ReactNode } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
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
import { FirebaseProvider, useFirebase } from './context/FirebaseContext';
import { RoleProvider, useRole, UserRole } from './context/RoleContext';
import { LogIn, AlertTriangle, User, Key, ShieldCheck, ChefHat, ClipboardList, X } from 'lucide-react';

class ErrorBoundary extends Component<any, any> {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-center">
          <div className="max-w-md space-y-4">
            <div className="w-20 h-20 bg-rose-100 text-rose-600 rounded-3xl flex items-center justify-center mx-auto">
              <AlertTriangle size={40} />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Algo ha salido mal</h1>
            <p className="text-slate-500">Ha ocurrido un error inesperado. Por favor, recarga la página o contacta con soporte.</p>
            <pre className="text-[10px] bg-slate-100 p-4 rounded-xl overflow-auto max-h-40 text-left">
              {JSON.stringify(this.state.error, null, 2)}
            </pre>
            <button 
              onClick={() => window.location.reload()}
              className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold hover:bg-slate-800 transition-all"
            >
              Recargar Aplicación
            </button>
          </div>
        </div>
      );
    }

    return (this as any).props.children;
  }
}

function LoginScreen() {
  const { login, loading } = useFirebase();

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-8 animate-in fade-in zoom-in-95 duration-500">
        <div className="text-center space-y-2">
          <div className="w-20 h-20 bg-emerald-600 text-white rounded-[2.5rem] flex items-center justify-center mx-auto shadow-2xl shadow-emerald-200 mb-6">
            <LogIn size={40} />
          </div>
          <h1 className="text-4xl font-black tracking-tight text-slate-900">Raco Blanquerna SL</h1>
          <p className="text-slate-500 font-medium">Gestión integral de restauración</p>
        </div>

        <button 
          onClick={login}
          disabled={loading}
          className="w-full bg-white border border-slate-200 text-slate-700 py-4 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-slate-50 transition-all shadow-sm disabled:opacity-50"
        >
          <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
          Continuar con Google
        </button>

        <p className="text-center text-xs text-slate-400 font-medium">
          Al continuar, aceptas nuestros términos y condiciones.
        </p>
      </div>
    </div>
  );
}

function RoleSwitcher() {
  const { role, setRole } = useRole();
  const [isOpen, setIsOpen] = React.useState(false);
  const [pin, setPin] = React.useState('');
  const [targetRole, setTargetRole] = React.useState<UserRole | null>(null);

  const handleSwitch = () => {
    if (targetRole && setRole(targetRole, pin)) {
      setIsOpen(false);
      setPin('');
      setTargetRole(null);
    } else {
      alert('PIN Incorrecto');
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-[100]">
      <button 
        onClick={() => setIsOpen(true)}
        className="w-14 h-14 bg-slate-900 text-white rounded-2xl flex items-center justify-center shadow-2xl hover:scale-105 transition-all"
      >
        {role === 'ADMIN' ? <ShieldCheck size={24} /> : role === 'COOK' ? <ChefHat size={24} /> : <ClipboardList size={24} />}
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Cambiar Rol</h3>
              <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-all">
                <X size={20} className="text-slate-400" />
              </button>
            </div>

            {!targetRole ? (
              <div className="grid grid-cols-1 gap-3">
                <button 
                  onClick={() => setTargetRole('ADMIN')}
                  className="flex items-center gap-4 p-4 rounded-2xl border border-slate-100 hover:bg-slate-50 transition-all text-left"
                >
                  <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center">
                    <ShieldCheck size={24} />
                  </div>
                  <div>
                    <p className="font-black text-slate-900 text-sm uppercase tracking-widest">Administrador</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Acceso Total</p>
                  </div>
                </button>
                <button 
                  onClick={() => setTargetRole('COOK')}
                  className="flex items-center gap-4 p-4 rounded-2xl border border-slate-100 hover:bg-slate-50 transition-all text-left"
                >
                  <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center">
                    <ChefHat size={24} />
                  </div>
                  <div>
                    <p className="font-black text-slate-900 text-sm uppercase tracking-widest">Cocinero</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Recetas y Escandallos</p>
                  </div>
                </button>
                <button 
                  onClick={() => setTargetRole('WAITER')}
                  className="flex items-center gap-4 p-4 rounded-2xl border border-slate-100 hover:bg-slate-50 transition-all text-left"
                >
                  <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center">
                    <ClipboardList size={24} />
                  </div>
                  <div>
                    <p className="font-black text-slate-900 text-sm uppercase tracking-widest">Camarero</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Fotos de Albaranes</p>
                  </div>
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="text-center">
                  <p className="text-sm font-bold text-slate-500 mb-4 uppercase tracking-widest">Introduce PIN para {targetRole}</p>
                  <input 
                    type="password" 
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    placeholder="••••"
                    className="w-full text-center text-3xl font-black tracking-[0.5em] py-4 bg-slate-50 rounded-2xl border-2 border-slate-100 focus:border-indigo-500 outline-none transition-all"
                    maxLength={4}
                    autoFocus
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => setTargetRole(null)}
                    className="py-4 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-slate-200 transition-all"
                  >
                    Volver
                  </button>
                  <button 
                    onClick={handleSwitch}
                    className="py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-slate-800 transition-all shadow-lg"
                  >
                    Confirmar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function AppContent() {
  const { user, loading } = useFirebase();
  const { data, onSave } = useAppData();
  const { role } = useRole();

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

  if (!user) {
    return <LoginScreen />;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<DashboardView />} />
          <Route path="albaranes" element={<ComprasView data={data} onSave={onSave} />} />
          <Route path="facturas" element={<ComprasView data={data} onSave={onSave} />} />
          <Route path="compras" element={<ComprasView data={data} onSave={onSave} />} />
          <Route path="facturacion-clientes" element={<FacturacionClientesView />} />
          <Route path="cierre-caja" element={<CierreCajaView />} />
          <Route path="tesoreria" element={<TesoreriaView data={data} onSave={onSave} />} />
          <Route path="marketing" element={<MarketingView />} />
          <Route path="escandallos" element={<EscandallosView />} />
          <Route path="personal" element={<PersonalView />} />
          <Route path="inventario" element={<StockView />} />
          <Route path="auditoria" element={<AuditoriaView />} />
          <Route path="evaluacion-cartas" element={<EvaluacionCartasView />} />
          <Route path="tramites" element={<TramitesView />} />
          <Route path="documentos" element={<DocumentosView />} />
          <Route path="banco" element={<BancoView />} />
          <Route path="proveedores" element={<ProveedoresView />} />
          <Route path="menu" element={<MenuView data={data} onSave={onSave} />} />
        </Route>
      </Routes>
      <RoleSwitcher />
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <FirebaseProvider>
        <RoleProvider>
          <AppContent />
        </RoleProvider>
      </FirebaseProvider>
    </ErrorBoundary>
  );
}
