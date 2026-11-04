import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { nexoApi } from '@/api/nexoApi';
import { ArrowRight, RefreshCw } from 'lucide-react';
import { DaySummary, PendingLists, ProductInsights } from './ManagementCards';
import { ErrorState, LoadingState } from '@/components/common/PageState';
import GettingStarted from './GettingStarted';
import { validateOverviewResponse } from './overview-response';

export default function ManagementPanel({ onboarding = false }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const load = useCallback(async (isActive = () => Boolean(true)) => {
    setLoading(true);
    setError('');
    try { const result = validateOverviewResponse(await nexoApi.management.overview()); if (isActive()) setData(result); }
    catch (cause) { if (isActive()) setError(cause.message || 'Não foi possível atualizar o resumo.'); }
    finally { if (isActive()) setLoading(false); }
  }, []);
  useEffect(() => { let active = true; load(() => active); return () => { active = false; }; }, [load]);
  if (loading && !data) return <LoadingState label="Preparando resumo da loja..." />;
  if (error) return <ErrorState description={error} onRetry={() => load()} />;
  if (!data) return null;
  return (
    <section className="space-y-6" aria-label="Resumo e ações da loja" aria-busy={loading}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div><h2 className="text-base font-bold">Seu dia em números</h2><p className="mt-1 text-xs text-muted-foreground" role="status">Atualizado às {new Date(data.generated_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Bahia' })} · horário da Bahia</p></div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm font-semibold transition hover:bg-muted disabled:opacity-50" disabled={loading} onClick={() => load()}><RefreshCw aria-hidden="true" className={`h-4 w-4 ${loading ? 'animate-spin motion-reduce:animate-none' : ''}`} />{loading ? 'Atualizando...' : 'Atualizar resumo'}</button>
          {data.modules.includes('pdv') && <Link to="/pdv" className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-accent px-4 text-sm font-bold text-accent-foreground transition hover:opacity-90">Ir para o PDV<ArrowRight aria-hidden="true" className="h-4 w-4" /></Link>}
        </div>
      </div>
      <DaySummary data={data} />
      <ProductInsights data={data} />
      <PendingLists data={data} />
      {onboarding && <GettingStarted data={data} />}
    </section>
  );
}
