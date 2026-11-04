import { lazy, Suspense } from 'react';
import { ChevronRight, ClipboardList, Download, FileBarChart } from 'lucide-react';
import { canUseFinanceSection, hasPlanFeature } from '@/lib/plan-catalog';
import { useAuth } from '@/lib/AuthContext';
import { formatCurrency } from '@/lib/helpers';
import { ChartCard, ChartSkeleton, MetricCard } from '@/components/finance/FinanceOverview';
import { buildFinanceReportRows, downloadFinanceCsv } from './finance-export.js';

const CashFlowChart = lazy(() =>
  import('@/components/finance/FinanceCharts').then(module => ({ default: module.CashFlowChart })),
);

export function CashFlow({ data }) {
  const series = data?.series || [];
  const incoming = series.reduce((s, i) => s + i.revenue, 0),
    outgoing = series.reduce((s, i) => s + i.expense, 0);
  return (
    <div className="space-y-4">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Saldo inicial estimado"
          value={formatCurrency(
            (data?.summary?.financial_balance || 0) - incoming + outgoing,
          )}
          help="Saldo atual descontando o fluxo realizado"
        />
        <MetricCard
          label="Entradas realizadas"
          value={formatCurrency(incoming)}
          help="Recebimentos do período"
        />
        <MetricCard
          label="Saídas realizadas"
          value={formatCurrency(outgoing)}
          help="Pagamentos do período"
        />
        <MetricCard
          label="Saldo final"
          value={formatCurrency(data?.summary?.financial_balance)}
          help="Saldo atual das contas"
        />
      </section>
      <ChartCard title="Evolução diária">
        <Suspense fallback={<ChartSkeleton height="h-[340px]" />}>
          <CashFlowChart data={series} />
        </Suspense>
      </ChartCard>
    </div>
  );
}
export function Results({ data }) {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="surface-card overflow-hidden">
        <div className="border-b border-border p-4">
          <h3 className="font-bold">DRE simplificada</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Clique nas áreas de lançamentos para investigar a origem dos
            valores.
          </p>
        </div>
        <div className="divide-y divide-border">
          {(data?.dre || []).map((row, index) => (
            <div
              key={row.key}
              className={`flex items-start justify-between gap-4 p-4 ${['gross_profit', 'result'].includes(row.key) ? 'bg-accent/5' : ''}`}
            >
              <div>
                <strong className="text-sm">
                  {index + 1}. {row.label}
                </strong>
                <p className="mt-1 text-xs text-muted-foreground">{row.help}</p>
              </div>
              <strong
                className={`shrink-0 tabular-nums ${row.value < 0 ? 'text-destructive' : row.key === 'result' ? 'text-accent' : ''}`}
              >
                {formatCurrency(row.value)}
              </strong>
            </div>
          ))}
        </div>
      </section>
      <div className="space-y-3">
        <MetricCard
          label="Lucro líquido estimado"
          value={formatCurrency(data?.summary?.estimated_profit)}
          help="Não é o mesmo que faturamento ou saldo disponível"
        />
        <MetricCard
          label="Margem líquida"
          value={`${Number(data?.summary?.margin || 0).toLocaleString('pt-BR')}%`}
          help="Parcela da receita que permaneceu como resultado"
        />
        <MetricCard
          label="Custo das mercadorias"
          value={formatCurrency(data?.summary?.cogs)}
          help="Calculado pelo custo registrado de cada item vendido"
        />
        {data?.summary?.missing_cost_items > 0 && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
            <strong>
              {data.summary.missing_cost_items} item(ns) sem custo confiável
            </strong>
            <p className="mt-1 text-xs text-muted-foreground">
              O lucro pode estar incompleto até que os custos sejam cadastrados.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export function Reports({ dashboard, range, canExport }) {
  const { user } = useAuth();
  const exportCsv = () => {
    const rows = buildFinanceReportRows(dashboard);
    downloadFinanceCsv(rows, `financeiro-${range.from}-${range.to}.csv`);
  };
  return (
    <div className="space-y-4">
      <section className="surface-card p-5">
        <h3 className="font-bold">Central de relatórios</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Os arquivos usam os mesmos cálculos rastreáveis exibidos no painel.
        </p>
        {canExport ? (
          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={exportCsv}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-accent px-4 text-sm font-bold text-accent-foreground"
            >
              <Download className="h-4 w-4" /> Exportar planilha (CSV)
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-4 text-sm font-bold hover:bg-muted"
            >
              <ClipboardList className="h-4 w-4" /> Imprimir / salvar PDF
            </button>
          </div>
        ) : (
          <p className="mt-4 rounded-xl border border-border bg-muted/20 p-3 text-sm text-muted-foreground">
            A exportação de relatórios não está incluída neste plano.
          </p>
        )}
      </section>
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[
          'Receitas',
          'Despesas',
          'Contas a pagar',
          'Contas a receber',
          'Fluxo de caixa',
          'Lucro e margem',
          'DRE',
          'Vendas por pagamento',
          'Compras por fornecedor',
          'Produtos mais lucrativos',
          'Perdas de estoque',
          'Resultado por unidade',
        ].filter((label) => (label !== 'DRE' || hasPlanFeature(user, 'advanced_permissions')) && (label !== 'Compras por fornecedor' || canUseFinanceSection(user, 'purchases'))).map((label) => (
          <article
            key={label}
            className="surface-card flex items-center gap-3 p-4"
          >
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent/10 text-accent">
              <FileBarChart className="h-5 w-5" />
            </div>
            <strong className="min-w-0 flex-1 text-sm">{label}</strong>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </article>
        ))}
      </section>
    </div>
  );
}
