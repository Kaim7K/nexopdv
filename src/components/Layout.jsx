import React, { useEffect, useMemo, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { BarChart3, HandCoins, History, LogOut, Menu, Package, ScrollText, Settings, ShoppingCart, User as UserIcon, Users, X } from 'lucide-react';
import { nexoApi } from '@/api/nexoApi';
import { useAuth } from '@/lib/AuthContext';
import ThemeToggle from '@/components/ThemeToggle';
import { usePageMetadata } from '@/hooks/use-page-metadata';

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

const ROUTE_ACCESS_ALIASES = { '/produto': '/estoque' };
const ROLE_LABELS = { vendedor: 'Vendedor', gerente: 'Gerente', admin: 'Administrador', super_admin: 'Superadministrador' };

function hexToHsl(hex, { minLightness = 0 } = {}) {
  const value = /^#[0-9a-f]{6}$/i.test(hex || '') ? hex.slice(1) : '16a06a';
  const [r, g, b] = [0, 2, 4].map(index => Number.parseInt(value.slice(index, index + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const light = (max + min) / 2;
  const diff = max - min;
  const lightness = Math.max(Math.round(light * 100), minLightness);
  if (!diff) return `0 0% ${lightness}%`;
  const saturation = diff / (1 - Math.abs(2 * light - 1));
  let hue = max === r ? ((g - b) / diff) % 6 : max === g ? (b - r) / diff + 2 : (r - g) / diff + 4;
  hue = Math.round(hue * 60);
  if (hue < 0) hue += 360;
  return `${hue} ${Math.round(saturation * 100)}% ${lightness}%`;
}

export default function Layout() {
  const { user, logout } = useAuth();
  const [config, setConfig] = useState({});
  const [mobileMenu, setMobileMenu] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    setMobileMenu(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!user) return undefined;
    if (user.primary_color) {
      const root = document.documentElement;
      const accent = hexToHsl(user.primary_color, { minLightness: 46 });
      root.style.setProperty('--accent', accent);
      root.style.setProperty('--ring', accent);
      root.style.setProperty('--sidebar-primary', accent);
      root.style.setProperty('--market-primary', user.primary_color);
    }

    let cancelled = false;
    if (user.market_id) {
      nexoApi.entities.SystemConfig.list()
        .then(configs => {
          if (cancelled) return;
          setConfig(Object.fromEntries(configs.map(item => [item.key, item.value])));
        })
        .catch(() => { if (!cancelled) setConfig({}); });
    }
    return () => { cancelled = true; };
  }, [user]);

  const filteredItems = useMemo(() => {
    if (!user) return [];
    const enabled = user.enabled_modules || [];
    return MENU_ITEMS.filter(item => item.roles.includes(user.role) && (user.role === 'super_admin' || enabled.includes(item.path.split('/')[1])));
  }, [user]);

  const accessPath = Object.entries(ROUTE_ACCESS_ALIASES).find(([path]) => location.pathname.startsWith(path))?.[1] || location.pathname;
  const currentItem = MENU_ITEMS.find(item => accessPath.startsWith(item.path));
  const hasAccess = currentItem && filteredItems.some(item => item.path === currentItem.path);

  usePageMetadata({
    title: `${currentItem?.label || 'Painel'} | Nexo PDV`,
    description: 'Área restrita do Nexo PDV.',
    robots: 'noindex, nofollow, noarchive',
  });

  if (!user) return null;

  if (!hasAccess) {
    const fallback = filteredItems[0]?.path;
    return fallback ? <NavigateTo path={fallback} /> : (
      <div className="grid min-h-screen place-items-center bg-background p-6 text-center">
        <div><h1 className="text-xl font-black">Nenhum módulo habilitado</h1><p className="mt-2 text-sm text-muted-foreground">Peça ao administrador para liberar pelo menos um módulo para esta conta.</p></div>
      </div>
    );
  }

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try { await logout(); } finally { setLoggingOut(false); }
  };

  const brandName = config.nome_mercado || user.market_name || 'Nexo PDV';
  const logoUrl = user.logo_url || config.logo_url;

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <a href="#main-content" className="fixed left-3 top-3 z-[70] -translate-y-20 rounded-xl bg-accent px-4 py-2 text-sm font-bold text-accent-foreground shadow-lg transition focus:translate-y-0">Pular para o conteúdo</a>

      {mobileMenu && <button type="button" aria-label="Fechar menu" className="fixed inset-0 z-40 bg-black/55 backdrop-blur-sm md:hidden" onClick={() => setMobileMenu(false)} />}

      <aside aria-label="Menu principal" className={`fixed inset-y-0 left-0 z-50 flex w-[268px] flex-shrink-0 flex-col bg-sidebar text-sidebar-foreground shadow-2xl transition-transform duration-300 md:static md:w-60 md:translate-x-0 md:shadow-none ${mobileMenu ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="relative flex min-h-[78px] items-center border-b border-sidebar-border px-5">
          <button type="button" aria-label="Fechar menu" onClick={() => setMobileMenu(false)} className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-xl text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground md:hidden"><X className="h-5 w-5" /></button>
          {logoUrl ? (
            <img src={logoUrl} alt={brandName} className="max-h-12 max-w-[180px] object-contain object-left" />
          ) : (
            <div className="flex items-center gap-2.5"><div className="grid h-10 w-10 place-items-center rounded-xl bg-sidebar-primary text-lg font-black text-sidebar-primary-foreground">N</div><div className="text-xl font-black">Nexo <span style={{ color: 'var(--market-primary)' }}>PDV</span></div></div>
          )}
        </div>

        <div className="px-4 pb-2 pt-4"><p className="truncate text-xs font-semibold uppercase tracking-[0.12em] text-sidebar-foreground/40">{brandName}</p></div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
          {filteredItems.map(item => {
            const active = accessPath.startsWith(item.path);
            return (
              <Link key={item.path} to={item.path} aria-current={active ? 'page' : undefined} className={`group flex min-h-11 items-center gap-3 rounded-xl border px-3 text-sm transition ${active ? 'border-sidebar-primary/35 bg-sidebar-accent font-bold text-sidebar-accent-foreground shadow-inner' : 'border-transparent text-sidebar-foreground/68 hover:bg-sidebar-accent/65 hover:text-sidebar-foreground'}`}>
                <item.icon className={`h-[18px] w-[18px] flex-none transition ${active ? 'text-sidebar-accent-foreground' : 'text-sidebar-foreground/55 group-hover:text-sidebar-foreground'}`} />
                <span>{item.label}</span>
                {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-sidebar-primary" />}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-border p-3">
          <div className="flex items-center gap-3 rounded-xl bg-sidebar-accent/60 p-2.5">
            <div className="grid h-10 w-10 flex-none place-items-center overflow-hidden rounded-xl bg-sidebar-accent">
              {user.photo_url ? <img src={user.photo_url} alt={`Foto de ${user.full_name || user.email}`} className="h-full w-full object-cover" /> : <UserIcon className="h-4 w-4 text-sidebar-foreground/55" />}
            </div>
            <div className="min-w-0 flex-1"><div className="truncate text-sm font-bold">{user.full_name || user.email}</div><div className="mt-0.5 truncate text-xs text-sidebar-foreground/45">{ROLE_LABELS[user.role] || user.role}</div></div>
          </div>
          <div className="mt-2 flex gap-1">
            <ThemeToggle className="flex-none" />
            <button type="button" onClick={handleLogout} disabled={loggingOut} className="flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl text-xs font-semibold text-sidebar-foreground/65 transition hover:bg-sidebar-accent hover:text-sidebar-foreground disabled:opacity-50"><LogOut className="h-4 w-4" /> {loggingOut ? 'Saindo...' : 'Sair'}</button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="sticky top-0 z-30 flex h-14 flex-none items-center gap-3 border-b border-border bg-card/95 px-3 backdrop-blur md:hidden">
          <button type="button" aria-label="Abrir menu" onClick={() => setMobileMenu(true)} className="grid h-10 w-10 place-items-center rounded-xl hover:bg-muted"><Menu className="h-5 w-5" /></button>
          <div className="min-w-0 flex-1"><div className="truncate text-sm font-black">{currentItem?.label}</div><div className="truncate text-[11px] text-muted-foreground">{brandName}</div></div>
          <ThemeToggle className="!text-foreground hover:!bg-muted hover:!text-foreground" />
        </header>
        <main id="main-content" tabIndex={-1} className="min-w-0 flex-1 overflow-auto bg-muted/25 outline-none">
          <Outlet context={{ user, config }} />
        </main>
      </div>
    </div>
  );
}

function NavigateTo({ path }) {
  const navigate = useNavigate();
  useEffect(() => navigate(path, { replace: true }), [navigate, path]);
  return null;
}
