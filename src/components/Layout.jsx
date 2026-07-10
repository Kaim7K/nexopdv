import React, { useEffect, useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { ShoppingCart, Package, History, HandCoins, BarChart3, Users, Settings, ScrollText, LogOut, User as UserIcon } from 'lucide-react';
import { LOGO_URL } from '@/lib/helpers';
import ThemeToggle from '@/components/ThemeToggle';

const MENU_ITEMS = [
  { path: '/pdv', label: 'PDV', icon: ShoppingCart, roles: ['gerente', 'vendedor', 'admin'] },
  { path: '/estoque', label: 'Estoque', icon: Package, roles: ['gerente', 'vendedor', 'admin'] },
  { path: '/vendas', label: 'Vendas', icon: History, roles: ['gerente', 'vendedor', 'admin'] },
  { path: '/fiados', label: 'Fiados', icon: HandCoins, roles: ['gerente', 'vendedor', 'admin'] },
  { path: '/relatorios', label: 'Relatórios', icon: BarChart3, roles: ['gerente', 'admin'] },
  { path: '/auditoria', label: 'Auditoria', icon: ScrollText, roles: ['gerente', 'admin'] },
  { path: '/usuarios', label: 'Usuários', icon: Users, roles: ['gerente', 'admin'] },
  { path: '/configuracoes', label: 'Configurações', icon: Settings, roles: ['gerente', 'admin'] },
];

export default function Layout() {
  const [user, setUser] = useState(null);
  const [config, setConfig] = useState({});
  const [loading, setLoading] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const loadData = async () => {
      try {
        const u = await base44.auth.me();
        setUser(u);
      } catch {
        navigate('/login');
        return;
      }
      try {
        const configs = await base44.entities.SystemConfig.list();
        const map = {};
        configs.forEach(c => { map[c.key] = c.value; });
        setConfig(map);
      } catch { /* config optional */ }
      setLoading(false);
    };
    loadData();
  }, []);

  if (loading || !user) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-secondary border-t-accent rounded-full animate-spin"></div>
      </div>
    );
  }

  const filteredItems = MENU_ITEMS.filter(item => item.roles.includes(user.role));

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="w-60 bg-sidebar text-sidebar-foreground flex flex-col flex-shrink-0">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-sidebar-border">
          <img src={config.logo_url || LOGO_URL} alt="Logo" className="h-11 w-full object-contain" />
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3 px-2.5 space-y-0.5">
          {filteredItems.map(item => {
            const active = location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                  active
                    ? 'bg-sidebar-accent text-sidebar-foreground font-medium'
                    : 'text-sidebar-foreground/65 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground'
                }`}
              >
                <item.icon className={`w-[18px] h-[18px] flex-shrink-0 ${active ? 'text-sidebar-primary' : ''}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User + Actions */}
        <div className="px-2.5 py-3 border-t border-sidebar-border space-y-1.5">
          <div className="flex items-center gap-2.5 px-2 py-1.5">
            <div className="w-9 h-9 rounded-full overflow-hidden bg-sidebar-accent flex items-center justify-center flex-shrink-0">
              {user.photo_url ? (
                <img src={user.photo_url} alt={user.full_name || user.email} className="w-full h-full object-cover" />
              ) : (
                <UserIcon className="w-4 h-4 text-sidebar-foreground/50" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{user.full_name || user.email}</div>
              <div className="text-xs text-sidebar-foreground/50 capitalize">{user.role}</div>
            </div>
          </div>
          <div className="flex items-center gap-1 px-1">
            <ThemeToggle />
            <button
              onClick={() => base44.auth.logout('/login')}
              className="flex items-center gap-1.5 px-3 py-2 text-xs text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent rounded-lg transition-colors flex-1"
            >
              <LogOut className="w-3.5 h-3.5" /> Sair
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-auto bg-muted/30">
        <Outlet context={{ user, config }} />
      </main>
    </div>
  );
}