import { Suspense } from 'react';
import {
  BrowserRouter as Router,
  Navigate,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';
import { Toaster as HotToaster } from 'react-hot-toast';
import AppErrorBoundary from '@/components/AppErrorBoundary';
import { ConfirmProvider } from '@/components/common/ConfirmProvider';
import { LoadingState } from '@/components/common/PageState';
import Layout from '@/components/Layout';
import NetworkStatus from '@/components/NetworkStatus';
import ProtectedRoute from '@/components/ProtectedRoute';
import ScrollToTop from '@/components/ScrollToTop';
import { PRIVATE_ROUTES, PUBLIC_ROUTES } from '@/config/navigation';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import PageNotFound from '@/lib/PageNotFound';

const renderSuspendedRoute = ({ Component, fallbackLabel }) => (
  <Suspense fallback={<LoadingState fullScreen label={fallbackLabel} />}>
    <Component />
  </Suspense>
);

const AuthenticatedApp = () => {
  const { isLoadingAuth } = useAuth();
  const location = useLocation();
  const isPublicRoute =
    location.pathname === '/' || location.pathname === '/login';

  // A landing e o login aparecem imediatamente; apenas rotas privadas aguardam a sessão.
  if (isLoadingAuth && !isPublicRoute) {
    return <LoadingState fullScreen label="Preparando sua sessão..." />;
  }

  return (
    <Routes>
      {PUBLIC_ROUTES.map((route) => (
        <Route
          key={route.path}
          path={route.path}
          element={renderSuspendedRoute(route)}
        />
      ))}
      <Route
        element={
          <ProtectedRoute
            unauthenticatedElement={<Navigate to="/login" replace />}
          />
        }
      >
        <Route element={<Layout />}>
          {PRIVATE_ROUTES.map(({ path, Component }) => (
            <Route key={path} path={path} element={<Component />} />
          ))}
        </Route>
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <Router
      future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
    >
      <AuthProvider>
        <ConfirmProvider>
          <NetworkStatus />
          <ScrollToTop />
          <AppErrorBoundary>
            <AuthenticatedApp />
          </AppErrorBoundary>
          <HotToaster
            position="top-right"
            toastOptions={{ duration: 4000, className: 'nexo-toast' }}
          />
        </ConfirmProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
