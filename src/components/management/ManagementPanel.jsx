import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { nexoApi } from '@/api/nexoApi';
import { formatCurrency } from '@/lib/helpers';
import { ErrorState, LoadingState } from '@/components/common/PageState';
import GettingStarted from './GettingStarted';

export default function ManagementPanel({ onboarding = false }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const load = useCallback(async (isActive = () => Boolean(true)) => {
    setLoading(true);
    setError('');
    try { const result = await nexoApi.management.overview(); if (isActive()) setData(result); }
    catch (cause) { if (isActive()) setError(cause.message || 'Não foi possível atualizar o resumo.'); }
    finally { if (isActive()) setLoading(false); }
  }, []);
  useEffect(() => { let active = true; load(() => active); return () => { active = false; }; }, [load]);
  if (loading && !data) return <LoadingState label="Preparando resumo da loja..." />;
  if (error) return <ErrorState description={error} onRetry={() => load()} />;
  if (!data) return null;
  return <section className="space-y-5" aria-label="Resumo e ações da loja">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground">Atualizado às {new Date(data.generated_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Bahia' })} · horário da Bahia</p>
      <button type="button" className="rounded-lg border px-3 py-2 text-sm" disabled={loading} onClick={() => load()}>{loading ? 'Atualizando...' : 'Atualizar resumo'}</button>
    </div>
    {data.sales && <div className="rounded-xl border bg-card p-5"><p className="text-sm text-muted-foreground">Vendas concluídas hoje</p><p className="text-3xl font-bold">{formatCurrency(data.sales.total)}</p><p className="text-sm">{data.sales.count} venda(s)</p></div>}
    {onboarding && <GettingStarted data={data} />}
    {data.products && <div className="grid gap-4 md:grid-cols-3">{[
      ['Reposição', data.products.low, 'Produtos no limite de estoque ou abaixo dele.'],
      ['Sem venda há 30 dias', data.products.idle, 'Produtos com saldo e sem venda registrada nos últimos 30 dias.'],
      ['Margem abaixo de 10%', data.products.margin, 'Margem bruta atual sobre o preço de venda, sem taxas e despesas. Não indica queda histórica.'],
      ['Queda de margem', data.margin_declines, 'Últimos 30 dias versus os 30 anteriores. Quedas de pelo menos 1 ponto percentual, com custos registrados na venda e descontos rateados.'],
    ].filter(([, insight]) => insight).map(([label, insight, description]) => <article key={String(label)} className="rounded-xl border bg-card p-5"><h2 className="font-bold">{String(label)}</h2><p className="my-2 text-2xl font-bold">{insight.count}</p><p className="text-sm text-muted-foreground">{String(description)}</p><ul className="mt-3 space-y-2">{insight.products.map(product => <li key={product.id}><Link className="text-sm text-accent underline" to={`/produto/${product.id}`}>{product.name || 'Produto sem nome'}{product.drop !== undefined ? ` ? ?${product.drop.toLocaleString('pt-BR')} p.p.` : ''}</Link></li>)}</ul>{insight.count > 5 && <p className="mt-2 text-xs text-muted-foreground">Exibindo 5 de {insight.count} produtos.</p>}</article>)}</div>}
    <div className="grid gap-4 md:grid-cols-2">
      {data.fiados && <article className="rounded-xl border bg-card p-5"><h2 className="font-bold">Fiados pendentes · {data.fiados.count}</h2><p className="text-sm text-muted-foreground">Pendência não significa atraso: os fiados podem não ter vencimento cadastrado.</p><ul className="my-3 space-y-2">{data.fiados.items.map(item => <li key={item.id}>{item.name} · {formatCurrency(item.amount)}</li>)}</ul><Link className="text-accent underline" to="/fiados?status=pendente">Conferir pendências</Link></article>}
      {data.payables && <article className="rounded-xl border bg-card p-5"><h2 className="font-bold">Contas vencidas ou a vencer em 7 dias · {data.payables.count}</h2><ul className="my-3 space-y-2">{data.payables.items.map(item => <li key={item.id}>{item.description} · {formatCurrency(item.amount)} · {String(item.due_date).slice(0, 10).split('-').reverse().join('/')}</li>)}</ul><Link className="text-accent underline" to="/financeiro?tab=payables">Conferir contas a pagar</Link></article>}
    </div>
  </section>;
}
