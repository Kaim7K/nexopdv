import { lazy } from 'react';
import {
  BarChart3,
  Banknote,
  Blocks,
  CreditCard,
  Gauge,
  HandCoins,
  History,
  Package,
  ScrollText,
  Settings,
  ShoppingCart,
  Store,
  Users,
  WalletCards,
} from 'lucide-react';

const PAGE_LOADERS = {
  Login: () => import('@/pages/Login'),
  Landing: () => import('@/pages/Landing'),
  PDV: () => import('@/pages/PDV'),
  Estoque: () => import('@/pages/Estoque'),
  Vendas: () => import('@/pages/Vendas'),
  Fiados: () => import('@/pages/Fiados'),
  Relatorios: () => import('@/pages/Relatorios'),
  Financeiro: () => import('@/pages/Financeiro'),
  Usuarios: () => import('@/pages/Usuarios'),
  Configuracoes: () => import('@/pages/Configuracoes'),
  AuditoriaGeral: () => import('@/pages/AuditoriaGeral'),
  ProdutoDetalhe: () => import('@/pages/ProdutoDetalhe'),
  HistoricoCaixas: () => import('@/pages/HistoricoCaixas'),
  AdminOverview: () => import('@/pages/AdminOverview'),
  AdminMercados: () => import('@/pages/AdminMercados'),
  AdminPlanos: () => import('@/pages/AdminPlanos'),
  AdminRelatorios: () => import('@/pages/AdminRelatorios'),
  AdminConfiguracoes: () => import('@/pages/AdminConfiguracoes'),
};

const page = (name) => lazy(PAGE_LOADERS[name]);

export const PUBLIC_ROUTES = [
  {
    path: '/',
    Component: page('Landing'),
    fallbackLabel: 'Preparando conteúdo...',
  },
  {
    path: '/login',
    Component: page('Login'),
    fallbackLabel: 'Preparando acesso...',
  },
];

export const PRIVATE_ROUTES = [
  { path: '/pdv', Component: page('PDV') },
  { path: '/estoque', Component: page('Estoque') },
  { path: '/produto/:id', Component: page('ProdutoDetalhe') },
  { path: '/vendas', Component: page('Vendas') },
  { path: '/caixas', Component: page('HistoricoCaixas') },
  { path: '/fiados', Component: page('Fiados') },
  { path: '/relatorios', Component: page('Relatorios') },
  { path: '/financeiro', Component: page('Financeiro') },
  { path: '/usuarios', Component: page('Usuarios') },
  { path: '/configuracoes', Component: page('Configuracoes') },
  { path: '/auditoria', Component: page('AuditoriaGeral') },
  { path: '/admin', Component: page('AdminOverview') },
  { path: '/admin/mercados', Component: page('AdminMercados') },
  { path: '/admin/planos', Component: page('AdminPlanos') },
  { path: '/admin/relatorios', Component: page('AdminRelatorios') },
  { path: '/admin/configuracoes', Component: page('AdminConfiguracoes') },
];

export const MENU_ITEMS = [
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

export const ROUTE_ACCESS_ALIASES = { '/produto': '/estoque' };

export const ROLE_LABELS = {
  vendedor: 'Vendedor',
  gerente: 'Gerente',
  admin: 'Administrador',
  super_admin: 'Superadministrador',
};

export const ROUTE_PREFETCHERS = {
  '/pdv': PAGE_LOADERS.PDV,
  '/estoque': PAGE_LOADERS.Estoque,
  '/vendas': PAGE_LOADERS.Vendas,
  '/caixas': PAGE_LOADERS.HistoricoCaixas,
  '/fiados': PAGE_LOADERS.Fiados,
  '/relatorios': PAGE_LOADERS.Relatorios,
  '/financeiro': PAGE_LOADERS.Financeiro,
  '/auditoria': PAGE_LOADERS.AuditoriaGeral,
  '/usuarios': PAGE_LOADERS.Usuarios,
  '/configuracoes': PAGE_LOADERS.Configuracoes,
  '/admin': PAGE_LOADERS.AdminOverview,
  '/admin/mercados': PAGE_LOADERS.AdminMercados,
  '/admin/planos': PAGE_LOADERS.AdminPlanos,
  '/admin/relatorios': PAGE_LOADERS.AdminRelatorios,
  '/admin/configuracoes': PAGE_LOADERS.AdminConfiguracoes,
};
