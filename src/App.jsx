import {
  BrowserRouter as Router,
  Route,
  Routes,
  Navigate,
  useLocation,
} from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import ScrollToTop from './components/ScrollToTop';
import { lazy, Suspense } from 'react';
import { Toaster as HotToaster } from 'react-hot-toast';
import { ConfirmProvider } from '@/components/common/ConfirmProvider';
import { LoadingState } from '@/components/common/PageState';
import AppErrorBoundary from '@/components/AppErrorBoundary';
// Add page imports here
import Layout from '@/components/Layout';
import ProtectedRoute from '@/components/ProtectedRoute';
const Login = lazy(() => import('@/pages/Login')),
  Landing = lazy(() => import('@/pages/Landing')),
  PDV = lazy(() => import('@/pages/PDV')),
  Estoque = lazy(() => import('@/pages/Estoque')),
  Vendas = lazy(() => import('@/pages/Vendas')),
  Fiados = lazy(() => import('@/pages/Fiados')),
  Relatorios = lazy(() => import('@/pages/Relatorios')),
  Financeiro = lazy(() => import('@/pages/Financeiro')),
  Usuarios = lazy(() => import('@/pages/Usuarios')),
  Configuracoes = lazy(() => import('@/pages/Configuracoes')),
  AuditoriaGeral = lazy(() => import('@/pages/AuditoriaGeral')),
  ProdutoDetalhe = lazy(() => import('@/pages/ProdutoDetalhe')),
  HistoricoCaixas = lazy(() => import('@/pages/HistoricoCaixas')),
  AdminOverview = lazy(() => import('@/pages/AdminOverview')),
  AdminMercados = lazy(() => import('@/pages/AdminMercados')),
  AdminPlanos = lazy(() => import('@/pages/AdminPlanos')),
  AdminRelatorios = lazy(() => import('@/pages/AdminRelatorios')),
  AdminConfiguracoes = lazy(() => import('@/pages/AdminConfiguracoes'));

const AuthenticatedApp = () => {
  const { isLoadingAuth } = useAuth();
  const location = useLocation();
  const isPublicRoute =
    location.pathname === '/' || location.pathname === '/login';

  // A landing e o login aparecem imediatamente; apenas rotas privadas aguardam a sessão.
  if (isLoadingAuth && !isPublicRoute) {
    return <LoadingState fullScreen label="Preparando sua sessão..." />;
  }

  // Render the main app
  return (
    <Routes>
      <Route
        path="/"
        element={
          <Suspense
            fallback={
              <LoadingState fullScreen label="Preparando conteúdo..." />
            }
          >
            <Landing />
          </Suspense>
        }
      />
      <Route
        path="/login"
        element={
          <Suspense
            fallback={<LoadingState fullScreen label="Preparando acesso..." />}
          >
            <Login />
          </Suspense>
        }
      />
      <Route
        element={
          <ProtectedRoute
            unauthenticatedElement={<Navigate to="/login" replace />}
          />
        }
      >
        <Route element={<Layout />}>
          <Route path="/pdv" element={<PDV />} />
          <Route path="/estoque" element={<Estoque />} />
          <Route path="/produto/:id" element={<ProdutoDetalhe />} />
          <Route path="/vendas" element={<Vendas />} />
          <Route path="/caixas" element={<HistoricoCaixas />} />
          <Route path="/fiados" element={<Fiados />} />
          <Route path="/relatorios" element={<Relatorios />} />
          <Route path="/financeiro" element={<Financeiro />} />
          <Route path="/usuarios" element={<Usuarios />} />
          <Route path="/configuracoes" element={<Configuracoes />} />
          <Route path="/auditoria" element={<AuditoriaGeral />} />
          <Route path="/admin" element={<AdminOverview />} />
          <Route path="/admin/mercados" element={<AdminMercados />} />
          <Route path="/admin/planos" element={<AdminPlanos />} />
          <Route path="/admin/relatorios" element={<AdminRelatorios />} />
          <Route path="/admin/configuracoes" element={<AdminConfiguracoes />} />
        </Route>
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <ConfirmProvider>
          <ScrollToTop />
          <AppErrorBoundary>
            <AuthenticatedApp />
          </AppErrorBoundary>
          <HotToaster
            position="top-right"
            toastOptions={{ duration: 4000, className: 'nexo-toast' }}
          />
        </ConfirmProvider>
      </Router>
    </AuthProvider>
  );
}

export default App;
