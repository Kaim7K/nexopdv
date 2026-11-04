import { useState } from 'react';
import { ArrowRight, Check, ChevronDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';

export default function GettingStarted({ data }) {
  const { user } = useAuth();
  const storageKey = `nexo:onboarding:review:v1:${user.market_id}:${user.id}`;
  const [reviewed, setReviewed] = useState(() => {
    try { return window.localStorage.getItem(storageKey) === '1'; } catch { return false; }
  });
  const steps = [
    { module: 'configuracoes', label: 'Configurar a loja', path: '/configuracoes', done: data.configured },
    { module: 'estoque', label: 'Cadastrar ou importar produtos', path: '/estoque', done: data.products?.total > 0 },
    { module: 'estoque', label: 'Conferir preços e quantidades', path: '/estoque', done: reviewed, review: true },
    { module: 'pdv', label: 'Realizar a primeira venda', path: '/pdv', done: Boolean(data.sales?.has_sales) },
  ].filter(step => data.modules.includes(step.module));
  if (!steps.length) return null;
  function markReviewed(checked) {
    setReviewed(checked);
    try { window.localStorage.setItem(storageKey, checked ? '1' : '0'); } catch { /* The checklist remains usable without optional storage. */ }
  }
  const completed = steps.filter(step => step.done).length;
  return (
    <details className="surface-card group overflow-hidden" open={!data.sales?.has_sales}>
      <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 p-4 marker:hidden hover:bg-muted/30 sm:px-5">
        <div><h2 className="font-bold">Primeiros passos</h2><p className="mt-1 text-xs text-muted-foreground">{completed} de {steps.length} etapas concluídas · preparação da loja</p></div>
        <ChevronDown aria-hidden="true" className="h-5 w-5 shrink-0 text-muted-foreground transition group-open:rotate-180" />
      </summary>
      <div className="border-t border-border p-4 sm:p-5">
        <p className="text-sm text-muted-foreground">Prepare a operação seguindo este roteiro. Marque a conferência depois de revisar os produtos.</p>
        <ol className="mt-4 grid gap-3 sm:grid-cols-2">{steps.map((step, index) => <li key={step.label} className="min-w-0 rounded-xl border border-border p-3">
          <Link className="flex min-h-10 items-center gap-3 text-sm font-semibold hover:text-accent" to={step.path}><span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs ${step.done ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-muted text-muted-foreground'}`}>{step.done ? <Check aria-label="Concluído" className="h-4 w-4" /> : index + 1}</span><span className="min-w-0 flex-1">{step.label}</span><ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" /></Link>
          {step.review && <label className="mt-2 flex min-h-10 cursor-pointer items-center gap-2 text-xs text-muted-foreground"><input type="checkbox" checked={reviewed} onChange={event => markReviewed(event.target.checked)} />Conferi os preços e as quantidades</label>}
        </li>)}</ol>
      </div>
    </details>
  );
}
