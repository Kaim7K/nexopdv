import { useState } from 'react';
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
  return <div className="rounded-xl border bg-card p-5">
    <h2 className="font-bold">Primeiros passos</h2>
    <p className="mt-1 text-sm text-muted-foreground">Prepare a operação seguindo este roteiro. Marque a conferência depois de revisar os produtos.</p>
    <ol className="mt-4 space-y-3">{steps.map(step => <li key={step.label}>
      <Link className="text-accent underline underline-offset-4" to={step.path}>{step.done ? '✓ ' : '→ '}{step.label}</Link>
      {step.review && <label className="mt-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={reviewed} onChange={event => markReviewed(event.target.checked)} />Conferi os preços e as quantidades</label>}
    </li>)}</ol>
  </div>;
}
