import { ArrowDownRight, ArrowRight, CheckCircle2, Package, Receipt, ShoppingBag, TrendingDown, WalletCards } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatCurrency } from '@/lib/helpers';

export function DaySummary({ data }) {
  return (
    <div className="grid gap-3 lg:grid-cols-3" aria-label="Indicadores do dia">
      {data.sales && (
        <article className="relative overflow-hidden rounded-2xl border border-emerald-700 bg-emerald-950 p-5 text-white sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-medium text-emerald-100">Vendas concluídas hoje</h2>
            <ShoppingBag aria-hidden="true" className="h-5 w-5 text-emerald-300" />
          </div>
          <p className="mt-4 break-words text-3xl font-bold tracking-tight tabular-nums sm:text-4xl">{formatCurrency(data.sales.total)}</p>
          <p className="mt-2 text-sm text-emerald-100">{data.sales.count} {data.sales.count === 1 ? 'venda concluída' : 'vendas concluídas'}</p>
        </article>
      )}
      {data.fiados && <SummaryCard icon={WalletCards} label="Fiados pendentes" count={data.fiados.count} help="Registros aguardando recebimento" to="/fiados?status=pendente" />}
      {data.payables && <SummaryCard icon={Receipt} label="Contas em atenção" count={data.payables.count} help="Vencidas ou a vencer em 7 dias" to="/financeiro?tab=payables" />}
    </div>
  );
}

function SummaryCard({ icon: Icon, label, count, help, to }) {
  return (
    <Link to={to} className="surface-card group flex flex-col p-5 transition hover:border-accent/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent sm:p-6">
      <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-medium text-muted-foreground">{label}</h2><Icon aria-hidden="true" className="h-5 w-5 text-muted-foreground" /></div>
      <p className="mt-4 text-3xl font-bold tracking-tight tabular-nums sm:text-4xl">{count}</p>
      <div className="mt-2 flex items-center justify-between gap-2 text-sm text-muted-foreground"><span>{help}</span><ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0 transition group-hover:translate-x-1" /></div>
    </Link>
  );
}

export function ProductInsights({ data }) {
  if (!data.products) return null;
  const insights = [
    { label: 'Reposição', insight: data.products.low, description: 'Produtos no limite de estoque ou abaixo dele.', icon: Package },
    { label: 'Sem venda há 30 dias', insight: data.products.idle, description: 'Produtos com saldo e sem venda registrada nos últimos 30 dias.', icon: ShoppingBag },
    { label: 'Margem abaixo de 10%', insight: data.products.margin, description: 'Margem bruta atual sobre o preço de venda, sem taxas e despesas. Não indica queda histórica.', icon: ArrowDownRight },
    { label: 'Queda de margem', insight: data.margin_declines, description: 'Últimos 30 dias versus os 30 anteriores. Quedas de pelo menos 1 ponto percentual, com custos registrados na venda e descontos rateados.', icon: TrendingDown },
  ].filter(item => item.insight);
  return (
    <section aria-labelledby="product-insights-title" className="space-y-3">
      <div><h2 id="product-insights-title" className="text-base font-bold">Atenção aos produtos</h2><p className="mt-1 text-sm text-muted-foreground">Estoque e margem para acompanhar de perto.</p></div>
      <div className="grid items-start gap-3 md:grid-cols-2 xl:grid-cols-4">
        {insights.map(({ label, insight, description, icon: Icon }) => (
          <article key={label} className="surface-card min-w-0 overflow-hidden">
            <div className="p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3"><Icon aria-hidden="true" className={`h-5 w-5 ${insight.count ? 'text-amber-700 dark:text-amber-300' : 'text-muted-foreground'}`} /><span className={`rounded-md px-2 py-1 text-xs font-semibold ${insight.count ? 'bg-amber-500/10 text-amber-800 dark:text-amber-300' : 'bg-muted text-muted-foreground'}`}>{insight.count} {insight.count === 1 ? 'produto' : 'produtos'}</span></div>
              <h3 className="mt-4 font-bold">{label}</h3>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">{description}</p>
            </div>
            {insight.products.length > 0 ? (
              <ul className="divide-y divide-border border-t border-border">
                {insight.products.map(product => (
                  <li key={product.id}><Link to={`/produto/${product.id}`} className="group flex min-h-12 items-center justify-between gap-2 px-4 py-3 text-sm transition hover:bg-muted/50 sm:px-5"><span className="min-w-0 break-words">{product.name || 'Produto sem nome'}{product.drop !== undefined && <span className="mt-1 block text-xs font-semibold text-destructive">−{product.drop.toLocaleString('pt-BR')} p.p.</span>}</span><ArrowRight aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-accent" /></Link></li>
                ))}
              </ul>
            ) : <div className="flex items-center gap-2 border-t border-border px-4 py-4 text-xs text-muted-foreground sm:px-5"><CheckCircle2 aria-hidden="true" className="h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-300" />Nenhum produto nesta condição.</div>}
            {insight.count > 5 && <p className="border-t border-border px-4 py-3 text-xs text-muted-foreground sm:px-5">Exibindo 5 de {insight.count} produtos.</p>}
          </article>
        ))}
      </div>
    </section>
  );
}

export function PendingLists({ data }) {
  if (!data.fiados && !data.payables) return null;
  return (
    <section aria-label="Pendências financeiras" className="grid items-start gap-3 lg:grid-cols-2">
      {data.fiados && <PendingCard title="Fiados pendentes" count={data.fiados.count} help="Pendência não significa atraso: os fiados podem não ter vencimento cadastrado." to="/fiados?status=pendente" action="Conferir pendências" items={data.fiados.items.map(item => ({ id: item.id, label: item.name, amount: item.amount }))} />}
      {data.payables && <PendingCard title="Contas a pagar" count={data.payables.count} help="Contas vencidas ou a vencer nos próximos 7 dias." to="/financeiro?tab=payables" action="Conferir contas a pagar" items={data.payables.items.map(item => ({ id: item.id, label: item.description, amount: item.amount, detail: String(item.due_date).slice(0, 10).split('-').reverse().join('/') }))} />}
    </section>
  );
}

function PendingCard({ title, count, help, to, action, items }) {
  return (
    <article className="surface-card min-w-0 overflow-hidden">
      <div className="p-4 sm:p-5"><div className="flex items-center justify-between gap-3"><h2 className="font-bold">{title}</h2><span className="rounded-md bg-muted px-2 py-1 text-xs font-semibold tabular-nums">{count}</span></div><p className="mt-2 text-xs leading-5 text-muted-foreground">{help}</p></div>
      {items.length > 0 ? <ul className="divide-y divide-border border-y border-border">{items.map(item => <li key={item.id} className="flex items-start justify-between gap-4 px-4 py-3 sm:px-5"><div className="min-w-0"><p className="break-words text-sm font-medium">{item.label}</p>{item.detail && <p className="mt-1 text-xs text-muted-foreground">Vencimento: {item.detail}</p>}</div><strong className="shrink-0 text-sm tabular-nums">{formatCurrency(item.amount)}</strong></li>)}</ul> : <p className="border-y border-border px-4 py-4 text-sm text-muted-foreground sm:px-5">Nenhuma pendência neste resumo.</p>}
      <Link className="flex min-h-12 items-center justify-between gap-2 px-4 py-3 text-sm font-semibold text-accent transition hover:bg-accent/5 sm:px-5" to={to}>{action}<ArrowRight aria-hidden="true" className="h-4 w-4" /></Link>
    </article>
  );
}
