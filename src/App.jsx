import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import ScrollToTop from './components/ScrollToTop';
import { lazy, Suspense } from 'react';
import { Toaster as HotToaster } from 'react-hot-toast';
// Add page imports here
import Layout from '@/components/Layout';
import ProtectedRoute from '@/components/ProtectedRoute';
import Login from '@/pages/Login';
import Landing from '@/pages/Landing';
const PDV=lazy(()=>import('@/pages/PDV')),Estoque=lazy(()=>import('@/pages/Estoque')),Vendas=lazy(()=>import('@/pages/Vendas')),Fiados=lazy(()=>import('@/pages/Fiados')),Relatorios=lazy(()=>import('@/pages/Relatorios')),Usuarios=lazy(()=>import('@/pages/Usuarios')),Configuracoes=lazy(()=>import('@/pages/Configuracoes')),AuditoriaGeral=lazy(()=>import('@/pages/AuditoriaGeral')),ProdutoDetalhe=lazy(()=>import('@/pages/ProdutoDetalhe')),AdminMercados=lazy(()=>import('@/pages/AdminMercados'));

const AuthenticatedApp = () => {
  const { isLoadingAuth } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Render the main app
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route element={<Layout />}>
          <Route path="/pdv" element={<PDV />} />
          <Route path="/estoque" element={<Estoque />} />
          <Route path="/produto/:id" element={<ProdutoDetalhe />} />
          <Route path="/vendas" element={<Vendas />} />
          <Route path="/fiados" element={<Fiados />} />
          <Route path="/relatorios" element={<Relatorios />} />
          <Route path="/usuarios" element={<Usuarios />} />
          <Route path="/configuracoes" element={<Configuracoes />} />
          <Route path="/auditoria" element={<AuditoriaGeral />} />
          <Route path="/admin/mercados" element={<AdminMercados />} />
        </Route>
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <Suspense fallback={<div className="fixed inset-0 grid place-items-center bg-background"><div className="w-8 h-8 border-4 border-secondary border-t-accent rounded-full animate-spin"/></div>}><AuthenticatedApp /></Suspense>
        </Router>
        <Toaster />
        <HotToaster position="top-right" />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App
