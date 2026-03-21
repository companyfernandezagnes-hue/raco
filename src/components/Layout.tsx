import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { 
  LayoutDashboard, 
  FileText, 
  Receipt, 
  Wallet,
  ChefHat, 
  Users, 
  Package, 
  Settings,
  Scale,
  Menu,
  X,
  Sparkles,
  ClipboardList,
  FileSpreadsheet,
  LogOut,
  Megaphone,
  Calculator,
  Landmark,
  Search,
  Bell,
  Layout as LayoutIcon,
  ChefHat as UtensilsCrossed,
  Moon,
  Sun
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useSupabase } from '../context/SupabaseContext';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Compras & Gastos', href: '/compras', icon: Package },
  { name: 'Facturación Clientes', href: '/facturacion-clientes', icon: Receipt },
  { name: 'Cierre de Caja', href: '/cierre-caja', icon: Calculator },
  { name: 'Contabilidad & Tesorería', href: '/tesoreria', icon: Wallet },
  { name: 'Banco', href: '/banco', icon: Landmark },
  { name: 'Marketing', href: '/marketing', icon: Megaphone },
  { name: 'Escandallos', href: '/escandallos', icon: ChefHat },
  { name: 'Personal', href: '/personal', icon: Users },
  { name: 'Inventario', href: '/inventario', icon: ClipboardList },
  { name: 'Proveedores', href: '/proveedores', icon: Users },
  { name: 'Auditoría IA', href: '/auditoria', icon: Sparkles },
  { name: 'Evaluación Cartas', href: '/evaluacion-cartas', icon: FileSpreadsheet },
  { name: 'Análisis de Menú', href: '/menu', icon: UtensilsCrossed },
  { name: 'Trámites', href: '/tramites', icon: Scale },
];

import AIAdvisor from './AIAdvisor';
import { TelegramWidget } from './TelegramWidget';
import { useLocation } from 'react-router-dom';
import { usePin } from '../context/PinContext';

export default function Layout() {
  const { rol } = usePin();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const { employee, logout } = useSupabase();
  const location = useLocation();
  const [isDarkMode, setIsDarkMode] = React.useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark' || 
        (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });

  React.useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  const filteredNavigation = React.useMemo(() => {
    if (rol === 'admin') return navigation;
    if (rol === 'camarero') {
      return navigation.filter(n => ['Compras & Gastos', 'Inventario'].includes(n.name));
    }
    if (rol === 'cocinero') {
      return navigation.filter(n => ['Escandallos', 'Inventario', 'Análisis de Menú'].includes(n.name));
    }
    return [];
  }, [rol]);

  const currentModuleName = React.useMemo(() => {
    const path = location.pathname;
    const item = navigation.find(n => n.href === path);
    return item ? item.name : 'Dashboard';
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100 transition-colors duration-300">
      <AIAdvisor />
      <TelegramWidget currentModule={currentModuleName} />
      {/* Mobile menu backdrop */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transform transition-transform duration-300 ease-in-out lg:translate-x-0",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col h-full">
          <div className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-200 dark:shadow-emerald-900/20">
                <ChefHat size={24} />
              </div>
              <span className="text-xl font-bold tracking-tight text-slate-800 dark:text-slate-100">Raco Blanquerna SL</span>
            </div>
          </div>

          <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
            {filteredNavigation.map((item) => (
              <NavLink
                key={item.name}
                to={item.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className={({ isActive }) => cn(
                  "flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 group",
                  isActive 
                    ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 shadow-sm" 
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
                )}
              >
                <item.icon className={cn(
                  "w-5 h-5 transition-colors",
                  "group-hover:text-emerald-600 dark:group-hover:text-emerald-400"
                )} />
                {item.name}
              </NavLink>
            ))}
          </nav>

          <div className="p-4 border-t border-slate-100 dark:border-slate-800 space-y-1">
            <button className="flex items-center gap-3 w-full px-3 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-400 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">
              <Settings size={20} />
              Configuración
            </button>
            <button 
              onClick={logout}
              className="flex items-center gap-3 w-full px-3 py-2.5 text-sm font-medium text-rose-600 dark:text-rose-400 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all"
            >
              <LogOut size={20} />
              Cerrar Sesión
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64 flex flex-col min-h-screen">
        {/* Header */}
        <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 lg:px-8">
          <button 
            className="p-2 -ml-2 text-slate-600 dark:text-slate-400 lg:hidden"
            onClick={() => setIsMobileMenuOpen(true)}
          >
            <Menu size={24} />
          </button>

          <div className="flex-1 max-w-md mx-4 hidden md:block">
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 group-focus-within:text-emerald-500 transition-colors" size={18} />
              <input 
                type="text" 
                placeholder="Buscar en Raco Blanquerna..."
                className="w-full pl-10 pr-4 py-2 bg-slate-100 dark:bg-slate-800 border-transparent focus:bg-white dark:focus:bg-slate-900 focus:border-emerald-500/20 focus:ring-4 focus:ring-emerald-500/5 rounded-2xl transition-all text-sm outline-none dark:text-white"
              />
            </div>
          </div>

          <div className="flex items-center gap-4 ml-auto">
            <button 
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"
              title={isDarkMode ? "Modo Claro" : "Modo Oscuro"}
            >
              {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
              <button className="px-3 py-1 text-[10px] font-black uppercase tracking-widest bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-lg shadow-sm">ES</button>
              <button className="px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">CA</button>
            </div>
            <button className="relative p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all">
              <Bell size={20} />
              <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border-2 border-white dark:border-slate-900" />
            </button>
            <div className="text-right hidden sm:block">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">{employee?.nombre || 'Usuario'}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{employee?.email}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-slate-200 border-2 border-white shadow-sm overflow-hidden">
              <img 
                src={undefined || "https://picsum.photos/seed/admin/100/100"} 
                alt="Avatar" 
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
