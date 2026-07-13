import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Banknote,
  Blocks,
  CreditCard,
  Gauge,
  HandCoins,
  History,
  LogOut,
  Menu,
  Package,
  ScrollText,
  Settings,
  ShoppingCart,
  Store,
  User as UserIcon,
  Users,
  WalletCards,
  X,
} from 'lucide-react';
import { nexoApi } from '@/api/nexoApi';
import { useAuth } from '@/lib/AuthContext';
import ThemeToggle from '@/components/ThemeToggle';
import { usePageMetadata } from '@/hooks/use-page-metadata';
import {
  applySidebarPalette,
  deriveSidebarPalette,
} from '@/lib/color-contrast';
import { hasMarketFeature } from '@/lib/market-modules';
import { PageSkeleton } from '@/components/common/PageState';

const MENU_ITEMS = [
  {
    path: '/pdv',
    label: 'PDV',
    icon: ShoppingCart,
    roles: ['gerente', 'vendedor', 'admin'],
  },
  {
    path: '/estoque',
    label: 'Estoque',
    icon: Package,
    roles: ['gerente', 'vendedor', 'admin'],
  },
  {
    path: '/vendas',
    label: 'Vendas',
    icon: History,
    roles: ['gerente', 'vendedor', 'admin'],
  },
  {
    path: '/caixas',
    label: 'Histórico de caixas',
    icon: Banknote,
    roles: ['gerente', 'vendedor', 'admin'],
    module: 'caixas',
  },
  {
    path: '/fiados',
    label: 'Fiados',
    icon: HandCoins,
    roles: ['gerente', 'vendedor', 'admin'],
  },
  {
    path: '/relatorios',
    label: 'Relatórios',
    icon: BarChart3,
    roles: ['gerente', 'admin'],
  },
  {
    path: '/financeiro',
    label: 'Financeiro',
    icon: WalletCards,
    roles: ['gerente', 'admin'],
    module: 'financeiro',
  },
  {
    path: '/auditoria',
    label: 'Auditoria',
    icon: ScrollText,
    roles: ['gerente', 'admin'],
  },
  {
    path: '/usuarios',
    label: 'Usuários',
    icon: Users,
    roles: ['gerente', 'admin'],
  },
  {
    path: '/configuracoes',
    label: 'Configurações',
    icon: Settings,
    roles: ['gerente', 'admin'],
  },
  {
    path: '/admin',
    label: 'Visão geral',
    icon: Gauge,
    roles: ['super_admin'],
    exact: true,
  },
  {
    path: '/admin/mercados',
    label: 'Mercadinhos',
    icon: Store,
    roles: ['super_admin'],
  },
  {
    path: '/admin/planos',
    label: 'Planos e assinaturas',
    icon: CreditCard,
    roles: ['super_admin'],
  },
  {
    path: '/admin/relatorios',
    label: 'Relatórios da plataforma',
    icon: BarChart3,
    roles: ['super_admin'],
  },
  {
    path: '/admin/configuracoes',
    label: 'Configurações gerais',
    icon: Blocks,
    roles: ['super_admin'],
  },
];

const ROUTE_ACCESS_ALIASES = { '/produto': '/estoque' };
const ROLE_LABELS = {
  vendedor: 'Vendedor',
  gerente: 'Gerente',
  admin: 'Administrador',
  super_admin: 'Superadministrador',
};

const ROUTE_PREFETCHERS = {
  '/pdv': () => import('@/pages/PDV'),
  '/estoque': () => import('@/pages/Estoque'),
  '/vendas': () => import('@/pages/Vendas'),
  '/caixas': () => import('@/pages/HistoricoCaixas'),
  '/fiados': () => import('@/pages/Fiados'),
  '/relatorios': () => import('@/pages/Relatorios'),
  '/financeiro': () => import('@/pages/Financeiro'),
  '/auditoria': () => import('@/pages/AuditoriaGeral'),
  '/usuarios': () => import('@/pages/Usuarios'),
  '/configuracoes': () => import('@/pages/Configuracoes'),
  '/admin': () => import('@/pages/AdminOverview'),
  '/admin/mercados': () => import('@/pages/AdminMercados'),
  '/admin/planos': () => import('@/pages/AdminPlanos'),
  '/admin/relatorios': () => import('@/pages/AdminRelatorios'),
  '/admin/configuracoes': () => import('@/pages/AdminConfiguracoes'),
};
const CONFIG_CACHE_KEY = 'nexo:system-config';

function readCachedConfig() {
  try {
    const cached = JSON.parse(
      sessionStorage.getItem(CONFIG_CACHE_KEY) || 'null',
    );
    return cached && cached.expiresAt > Date.now() && cached.values
      ? cached.values
      : {};
  } catch {
    return {};
  }
}

function cacheConfig(values) {
  try {
    sessionStorage.setItem(
      CONFIG_CACHE_KEY,
      JSON.stringify({ values, expiresAt: Date.now() + 120_000 }),
    );
  } catch {
    /* armazenamento opcional */
  }
}

function hexToHsl(hex, { minLightness = 0 } = {}) {
  const value = /^#[0-9a-f]{6}$/i.test(hex || '') ? hex.slice(1) : '16a06a';
  const [r, g, b] = [0, 2, 4].map(
    (index) => Number.parseInt(value.slice(index, index + 2), 16) / 255,
  );
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const light = (max + min) / 2;
  const diff = max - min;
  const lightness = Math.max(Math.round(light * 100), minLightness);
  if (!diff) return `0 0% ${lightness}%`;
  const saturation = diff / (1 - Math.abs(2 * light - 1));
  let hue =
    max === r
      ? ((g - b) / diff) % 6
      : max === g
        ? (b - r) / diff + 2
        : (r - g) / diff + 4;
  hue = Math.round(hue * 60);
  if (hue < 0) hue += 360;
  return `${hue} ${Math.round(saturation * 100)}% ${lightness}%`;
}

export default function Layout() {
  const { user, logout } = useAuth();
  const [config, setConfig] = useState(() => readCachedConfig());
  const [mobileMenu, setMobileMenu] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const mobileNavRef = useRef(null);
  const mobileMenuButtonRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    setMobileMenu(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!mobileMenu) return undefined;
    const nav = mobileNavRef.current;
    const focusable = () => [
      ...(nav?.querySelectorAll('button:not([disabled]), a[href]') || []),
    ];
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    focusable()[0]?.focus();
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setMobileMenu(false);
        return;
      }
      if (event.key !== 'Tab') return;
      const items = focusable();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      document.body.style.overflow = previousOverflow;
      mobileMenuButtonRef.current?.focus();
    };
  }, [mobileMenu]);

  useEffect(() => {
    if (!user) return undefined;
    const root = document.documentElement;
    if (user.primary_color) {
      const accent = hexToHsl(user.primary_color, { minLightness: 46 });
      root.style.setProperty('--accent', accent);
      root.style.setProperty('--ring', accent);
      root.style.setProperty('--market-primary', user.primary_color);
    }

    let cancelled = false;
    const applyConfig = (values) => {
      if (cancelled) return;
      setConfig(values);
      cacheConfig(values);
      applySidebarPalette(
        root,
        deriveSidebarPalette(
          hasMarketFeature(user, 'sidebar_customization')
            ? values.sidebar_background_color || '#0f1b17'
            : '#0f1b17',
          hasMarketFeature(user, 'sidebar_customization')
            ? values.sidebar_accent_color || user.primary_color || '#16a06a'
            : user.primary_color || '#16a06a',
        ),
      );
    };

    applyConfig(readCachedConfig());
    const onConfigUpdated = (event) => applyConfig(event.detail || {});
    window.addEventListener('nexo:config-updated', onConfigUpdated);

    if (user.market_id) {
      nexoApi.entities.SystemConfig.list()
        .then((configs) =>
          applyConfig(
            Object.fromEntries(configs.map((item) => [item.key, item.value])),
          ),
        )
        .catch(() => {
          /* mantém o cache visual enquanto a rede se recupera */
        });
    }
    return () => {
      cancelled = true;
      window.removeEventListener('nexo:config-updated', onConfigUpdated);
    };
  }, [user]);

  const filteredItems = useMemo(() => {
    if (!user) return [];
    const enabled = user.enabled_modules || [];
    return MENU_ITEMS.filter(
      (item) =>
        item.roles.includes(user.role) &&
        (user.role === 'super_admin' ||
          enabled.includes(item.module || item.path.split('/')[1])),
    );
  }, [user]);

  const accessPath =
    Object.entries(ROUTE_ACCESS_ALIASES).find(([path]) =>
      location.pathname.startsWith(path),
    )?.[1] || location.pathname;
  const currentItem = [...MENU_ITEMS]
    .sort((a, b) => b.path.length - a.path.length)
    .find((item) =>
      item.exact ? accessPath === item.path : accessPath.startsWith(item.path),
    );
  const hasAccess =
    currentItem && filteredItems.some((item) => item.path === currentItem.path);

  usePageMetadata({
    title: `${currentItem?.label || 'Painel'} | Nexo PDV`,
    description: 'Área restrita do Nexo PDV.',
    robots: 'noindex, nofollow, noarchive',
  });

  if (!user) return null;

  if (!hasAccess) {
    const fallback = filteredItems[0]?.path;
    return fallback ? (
      <NavigateTo path={fallback} />
    ) : (
      <div className="grid min-h-screen place-items-center bg-background p-6 text-center">
        <div>
          <h1 className="text-xl font-black">Nenhum módulo habilitado</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Peça ao administrador para liberar pelo menos um módulo para esta
            conta.
          </p>
        </div>
      </div>
    );
  }

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      setLoggingOut(false);
    }
  };

  const brandName = config.nome_mercado || user.market_name || 'Nexo PDV';

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <a
        href="#main-content"
        className="fixed left-3 top-3 z-[70] -translate-y-20 rounded-xl bg-accent px-4 py-2 text-sm font-bold text-accent-foreground shadow-lg transition focus:translate-y-0"
      >
        Pular para o conteúdo
      </a>

      {mobileMenu && (
        <button
          type="button"
          aria-label="Fechar menu"
          className="fixed inset-0 z-40 bg-black/55 backdrop-blur-sm md:hidden"
          onClick={() => setMobileMenu(false)}
        />
      )}

      <aside
        ref={mobileNavRef}
        id="main-navigation"
        aria-label="Menu principal"
        className={`fixed inset-y-0 left-0 z-50 flex w-[min(268px,calc(100vw-3rem))] flex-shrink-0 flex-col bg-sidebar text-sidebar-foreground shadow-2xl transition-transform duration-200 md:static md:w-60 md:translate-x-0 md:shadow-none ${mobileMenu ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="relative flex min-h-[78px] items-center border-b border-sidebar-border px-5">
          <button
            type="button"
            aria-label="Fechar menu"
            onClick={() => setMobileMenu(false)}
            className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-xl text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground md:hidden"
          >
            <X className="h-5 w-5" />
          </button>
          {hasMarketFeature(user, 'market_logo') &&
          (config.logo_url || user.logo_url) ? (
            <img
              src={config.logo_url || user.logo_url}
              alt={brandName}
              decoding="async"
              className="max-h-12 w-auto max-w-[188px] object-contain object-left"
            />
          ) : (
            <div className="text-xl font-bold text-sidebar-foreground">
              Nexo <span style={{ color: 'var(--market-primary)' }}>PDV</span>
            </div>
          )}
        </div>

        <div className="px-4 pb-2 pt-4">
          <p className="truncate text-xs font-semibold uppercase tracking-[0.12em] text-sidebar-foreground/40">
            {brandName}
          </p>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
          {filteredItems.map((item) => {
            const active = item.exact
              ? accessPath === item.path
              : accessPath.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                onMouseEnter={() => ROUTE_PREFETCHERS[item.path]?.()}
                onFocus={() => ROUTE_PREFETCHERS[item.path]?.()}
                aria-current={active ? 'page' : undefined}
                className={`group flex min-h-11 items-center gap-3 rounded-xl border px-3 text-sm transition ${active ? 'border-sidebar-primary/35 bg-sidebar-accent font-bold text-sidebar-accent-foreground shadow-inner' : 'border-transparent text-sidebar-foreground/68 hover:bg-sidebar-accent/65 hover:text-sidebar-foreground'}`}
              >
                <item.icon
                  className={`h-[18px] w-[18px] flex-none transition ${active ? 'text-sidebar-accent-foreground' : 'text-sidebar-foreground/55 group-hover:text-sidebar-foreground'}`}
                />
                <span>{item.label}</span>
                {active && (
                  <span className="ml-auto h-1.5 w-1.5 rounded-full bg-sidebar-primary" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-border p-3">
          <div className="flex items-center gap-3 rounded-xl bg-sidebar-accent/60 p-2.5">
            <div className="grid h-10 w-10 flex-none place-items-center overflow-hidden rounded-xl bg-sidebar-accent">
              {user.photo_url ? (
                <img
                  src={user.photo_url}
                  alt={`Foto de ${user.full_name || user.email}`}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover"
                />
              ) : (
                <UserIcon className="h-4 w-4 text-sidebar-foreground/55" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold">
                {user.full_name || user.email}
              </div>
              <div className="mt-0.5 truncate text-xs text-sidebar-foreground/45">
                {ROLE_LABELS[user.role] || user.role}
              </div>
            </div>
          </div>
          <div className="mt-2 flex gap-1">
            <ThemeToggle className="flex-none" />
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className="flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl text-xs font-semibold text-sidebar-foreground/65 transition hover:bg-sidebar-accent hover:text-sidebar-foreground disabled:opacity-50"
            >
              <LogOut className="h-4 w-4" /> {loggingOut ? 'Saindo...' : 'Sair'}
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="sticky top-0 z-30 flex min-h-14 flex-none items-center gap-3 border-b border-border bg-card/95 px-3 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur md:hidden">
          <button
            ref={mobileMenuButtonRef}
            type="button"
            aria-label="Abrir menu"
            aria-controls="main-navigation"
            aria-expanded={mobileMenu}
            onClick={() => setMobileMenu(true)}
            className="grid h-11 w-11 place-items-center rounded-xl hover:bg-muted"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-black">
              {currentItem?.label}
            </div>
            <div className="truncate text-[11px] text-muted-foreground">
              {brandName}
            </div>
          </div>
          <ThemeToggle className="!text-foreground hover:!bg-muted hover:!text-foreground" />
        </header>
        <main
          id="main-content"
          tabIndex={-1}
          className="min-w-0 flex-1 overscroll-contain overflow-auto bg-muted/25 outline-none"
        >
          {user.platform_notice && (
            <div
              role="status"
              className="border-b border-amber-300/50 bg-amber-50 px-4 py-2 text-center text-xs font-semibold text-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
            >
              {user.platform_notice}
            </div>
          )}
          <Suspense fallback={<PageSkeleton />}>
            <Outlet context={{ user, config }} />
          </Suspense>
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
