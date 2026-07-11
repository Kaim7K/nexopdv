import React, { useEffect, useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { nexoApi } from '@/api/nexoApi';
import { ShoppingCart, Package, History, HandCoins, BarChart3, Users, Settings, ScrollText, LogOut, User as UserIcon, Menu, X } from 'lucide-react';
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
  { path: '/admin/mercados', label: 'Mercados', icon: Users, roles: ['super_admin'] },
];

function hexToHsl(hex) {
  const value = /^#[0-9a-f]{6}$/i.test(hex || '') ? hex.slice(1) : '16a06a';
  const [r,g,b] = [0,2,4].map(index => parseInt(value.slice(index,index+2),16)/255);
  const max=Math.max(r,g,b),min=Math.min(r,g,b),light=(max+min)/2,diff=max-min;
  if (!diff) return `0 0% ${Math.round(light*100)}%`;
  const saturation=diff/(1-Math.abs(2*light-1));
  let hue=max===r?((g-b)/diff)%6:max===g?(b-r)/diff+2:(r-g)/diff+4;
  hue=Math.round(hue*60);if(hue<0)hue+=360;
  return `${hue} ${Math.round(saturation*100)}% ${Math.round(light*100)}%`;
}

export default function Layout() {
  const [user, setUser] = useState(null);
  const [config, setConfig] = useState({});
  const [loading, setLoading] = useState(true);
  const [mobileMenu, setMobileMenu] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const loadData = async () => {
      try {
        const u = await nexoApi.auth.me();
        setUser(u);
        if (u.primary_color) {
          const root=document.documentElement,accent=hexToHsl(u.primary_color);
          root.style.setProperty('--accent',accent);root.style.setProperty('--ring',accent);root.style.setProperty('--sidebar-primary',accent);root.style.setProperty('--market-primary',u.primary_color);
        }
      } catch {
        navigate('/login');
        return;
      }
      try {
        const configs = await nexoApi.entities.SystemConfig.list();
        const map = {};
        configs.forEach(c => { map[c.key] = c.value; });
        setConfig(map);
      } catch { /* config optional */ }
      setLoading(false);
    };
    loadData();
  }, [navigate]);

  if (loading || !user) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-secondary border-t-accent rounded-full animate-spin"></div>
      </div>
    );
  }

  const enabled = user.enabled_modules || [];
  const filteredItems = MENU_ITEMS.filter(item => item.roles.includes(user.role) && (user.role === 'super_admin' || enabled.includes(item.path.split('/')[1])));
  const currentItem = MENU_ITEMS.find(item => location.pathname.startsWith(item.path));
  const hasAccess = currentItem && filteredItems.some(item => item.path === currentItem.path);

  if (!hasAccess) {
    const fallback = filteredItems[0]?.path;
    return fallback ? <NavigateTo path={fallback} /> : <div className="h-screen grid place-items-center">Nenhum módulo está habilitado para esta conta.</div>;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {mobileMenu && <button aria-label="Fechar menu" className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={()=>setMobileMenu(false)} />}
      <aside className={`fixed md:static inset-y-0 left-0 z-50 w-60 bg-sidebar text-sidebar-foreground flex flex-col flex-shrink-0 transition-transform ${mobileMenu?'translate-x-0':'-translate-x-full md:translate-x-0'}`}>
        {/* Logo */}
        <div className="px-5 py-5 border-b border-sidebar-border">
          <button aria-label="Fechar menu" onClick={()=>setMobileMenu(false)} className="absolute right-3 top-3 md:hidden"><X className="w-5"/></button>
          {user.logo_url || config.logo_url ? <img src={user.logo_url || config.logo_url} alt={user.market_name || 'Nexo PDV'} className="h-11 w-full object-contain" /> : <div className="text-xl font-black text-center">Nexo <span style={{color:'var(--market-primary)'}}>PDV</span></div>}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3 px-2.5 space-y-0.5">
          {filteredItems.map(item => {
            const active = location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={()=>setMobileMenu(false)}
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
              onClick={() => nexoApi.auth.logout('/login')}
              className="flex items-center gap-1.5 px-3 py-2 text-xs text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent rounded-lg transition-colors flex-1"
            >
              <LogOut className="w-3.5 h-3.5" /> Sair
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 min-w-0 overflow-auto bg-muted/30">
        <div className="md:hidden sticky top-0 z-30 h-14 bg-card border-b flex items-center px-3 gap-3"><button aria-label="Abrir menu" onClick={()=>setMobileMenu(true)} className="p-2"><Menu className="w-5"/></button><b>{user.market_name || 'Nexo PDV'}</b></div>
        <Outlet context={{ user, config }} />
      </main>
    </div>
  );
}

function NavigateTo({path}) { const navigate=useNavigate(); useEffect(()=>navigate(path,{replace:true}),[navigate,path]); return null; }
