// src/components/Layout.tsx
// ✅ Navegación limpia — sin rutas muertas ni duplicados
// ✅ /banco eliminado del nav (está integrado en Tesorería)
// ✅ /menu eliminado del nav (está en Evaluación Cartas)
// ✅ /documentos eliminado del nav (mockData — sin módulo real)
// ✅ Permisos por rol aplicados en el nav lateral
import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Receipt, Wallet, ChefHat, Users,
  Package, Scale, X, Sparkles, ClipboardList,
  FileSpreadsheet, LogOut, Megaphone, Calculator,
  Menu, Moon, Sun, Bell, ChevronRight
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useSupabase } from '../context/SupabaseContext';
import { usePin }       from '../context/PinContext';

function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }

// ── Nav items ─────────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  // Todos los roles
  { name: 'Dashboard',            href: '/',                    icon: LayoutDashboard, roles: ['admin','cocinero','camarero'] },
  // Admin
  { name: 'Compras & Proveedores', href: '/compras',            icon: Package,         roles: ['admin'] },
  { name: 'Facturación Clientes',  href: '/facturacion-clientes', icon: Receipt,       roles: ['admin'] },
  { name: 'Cierre de Caja',        href: '/cierre-caja',        icon: Calculator,      roles: ['admin','camarero'] },
  { name: 'Tesorería & Banco',     href: '/tesoreria',          icon: Wallet,          roles: ['admin'] },
  { name: 'Marketing',             href: '/marketing',          icon: Megaphone,       roles: ['admin'] },
  { name: 'Personal',              href: '/personal',           icon: Users,           roles: ['admin'] },
  { name: 'Auditoría IA',          href: '/auditoria',          icon: Sparkles,        roles: ['admin'] },
  { name: 'Trámites',              href: '/tramites',           icon: Scale,           roles: ['admin'] },
  // Admin + Cocinero
  { name: 'Escandallos',           href: '/escandallos',        icon: ChefHat,         roles: ['admin','cocinero'] },
  { name: 'Evaluación Carta',      href: '/evaluacion-cartas',  icon: FileSpreadsheet, roles: ['admin','cocinero'] },
  // Todos
  { name: 'Inventario',            href: '/inventario',         icon: ClipboardList,   roles: ['admin','cocinero','camarero'] },
  { name: 'Proveedores',           href: '/proveedores',        icon: Users,           roles: ['admin','cocinero','camarero'] },
];

// ── Layout ────────────────────────────────────────────────────────────────────
export default function Layout() {
  const { employee, logout }    = useSupabase();
  const { rol }                 = usePin();
  const navigate                = useNavigate();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [isDark, setIsDark]     = React.useState(() => {
    try { return localStorage.getItem('theme') === 'dark'; } catch { return false; }
  });

  React.useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    try { localStorage.setItem('theme', isDark ? 'dark' : 'light'); } catch {}
  }, [isDark]);

  // Filtrar nav por rol
  const visibleNav = NAV_ITEMS.filter(item =>
    !rol || item.roles.includes(rol as string)
  );

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-5 py-6 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200">
            <ChefHat size={22} className="text-white" />
          </div>
          <div>
            <p className="font-black text-slate-900 dark:text-white text-sm leading-tight">Raco Blanquerna</p>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">ERP Restaurante</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {visibleNav.map(item => (
          <NavLink
            key={item.href}
            to={item.href}
            end={item.href === '/'}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) => cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm font-bold transition-all group',
              isActive
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200'
                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white'
            )}>
            {({ isActive }) => (
              <>
                <item.icon size={18} className={isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-600'} />
                <span className="flex-1">{item.name}</span>
                {!isActive && <ChevronRight size={14} className="opacity-0 group-hover:opacity-40 transition-opacity" />}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer usuario */}
      <div className="px-3 py-4 border-t border-slate-100 dark:border-slate-800 space-y-1">
        {/* Dark mode */}
        <button onClick={() => setIsDark(d => !d)}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-2xl text-sm font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all">
          {isDark ? <Sun size={18} className="text-amber-400" /> : <Moon size={18} className="text-slate-400" />}
          {isDark ? 'Modo claro' : 'Modo oscuro'}
        </button>
        {/* Info empleado */}
        {employee && (
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800">
            <div className="w-8 h-8 bg-indigo-100 rounded-xl flex items-center justify-center font-black text-indigo-600 text-sm">
              {(employee as any).nombre?.charAt(0) || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black text-slate-800 dark:text-white truncate">{(employee as any).nombre}</p>
              <p className="text-[10px] text-slate-400 uppercase font-bold">{(employee as any).rol}</p>
            </div>
            <button onClick={logout}
              className="p-1.5 rounded-xl hover:bg-rose-100 hover:text-rose-600 text-slate-300 transition-all"
              title="Cerrar sesión">
              <LogOut size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-[#F8FAFC] dark:bg-slate-950 overflow-hidden">

      {/* ── Sidebar desktop ── */}
      <aside className="hidden lg:flex w-64 flex-col bg-white dark:bg-slate-900 border-r border-slate-100 dark:border-slate-800 shadow-sm shrink-0">
        <SidebarContent />
      </aside>

      {/* ── Sidebar mobile overlay ── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[200] flex lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-72 bg-white dark:bg-slate-900 h-full shadow-2xl">
            <button onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-4 p-2 rounded-xl hover:bg-slate-100 text-slate-400 transition-all">
              <X size={18} />
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile top bar */}
        <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <button onClick={() => setMobileOpen(true)}
            className="p-2 rounded-xl hover:bg-slate-100 text-slate-600 dark:text-slate-300 transition-all">
            <Menu size={22} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-indigo-600 rounded-xl flex items-center justify-center">
              <ChefHat size={16} className="text-white" />
            </div>
            <span className="font-black text-slate-900 dark:text-white text-sm">Raco Blanquerna</span>
          </div>
          <div className="w-9" />
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
