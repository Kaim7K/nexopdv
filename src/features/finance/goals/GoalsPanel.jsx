import { useState } from 'react';
import { Target } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { nexoApi } from '@/api/nexoApi';
import { EmptyState } from '@/components/common/PageState';
import { Field } from '@/components/finance/FinanceUi';
import { formatCurrency } from '@/lib/helpers';
import { todayIsoDate } from '@/lib/date-helpers';

export default function Goals({ bootstrap, data, refreshAll }) {
  const [form, setForm] = useState({
      period: todayIsoDate().slice(0, 7),
      type: 'revenue',
      target_value: '',
      category_id: '',
    }),
    [saving, setSaving] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await nexoApi.finance.goals.create({
        ...form,
        target_value: Number(form.target_value),
      });
      toast.success('Meta criada.');
      setForm((v) => ({ ...v, target_value: '' }));
      refreshAll();
    } catch (cause) {
      toast.error(cause.message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="grid content-start gap-3 xl:grid-cols-[22rem_minmax(0,1fr)]">
      <form onSubmit={submit} className="surface-card h-fit space-y-3 p-3">
        <h3 className="font-bold">Nova meta mensal</h3>
        <Field label="Mês">
          <input
            type="month"
            required
            className="field"
            value={form.period}
            onChange={(e) => setForm((v) => ({ ...v, period: e.target.value }))}
          />
        </Field>
        <Field label="Meta">
          <select
            className="field"
            value={form.type}
            onChange={(e) => setForm((v) => ({ ...v, type: e.target.value }))}
          >
            <option value="revenue">Faturamento</option>
            <option value="profit">Lucro</option>
            <option value="expense_limit">Limite de despesas</option>
            <option value="category_limit">Limite por categoria</option>
            <option value="loss_reduction">Redução de perdas</option>
            <option value="margin">Margem (%)</option>
          </select>
        </Field>
        {form.type === 'category_limit' && (
          <Field label="Categoria">
            <select
              required
              className="field"
              value={form.category_id}
              onChange={(e) =>
                setForm((v) => ({ ...v, category_id: e.target.value }))
              }
            >
              <option value="">Selecione</option>
              {bootstrap.categories
                .filter((c) => c.type === 'expense' || c.type === 'both')
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </Field>
        )}
        <Field label={form.type === 'margin' ? 'Percentual' : 'Valor'}>
          <input
            type="number"
            min="0"
            step="0.01"
            required
            className="field"
            value={form.target_value}
            onChange={(e) =>
              setForm((v) => ({ ...v, target_value: e.target.value }))
            }
          />
        </Field>
        <button
          type="submit"
          disabled={saving}
          className="min-h-10 w-full rounded-lg bg-accent font-bold text-accent-foreground"
        >
          Criar meta
        </button>
      </form>
      <div className="grid max-w-3xl content-start gap-2 sm:grid-cols-2">
        {(data?.goals || []).length ? (
          data.goals.map((goal) => (
            <article key={goal.id} className="surface-card p-3">
              <div className="flex justify-between gap-3">
                <strong className="text-sm">
                  {goal.type.replaceAll('_', ' ')}
                </strong>
                <span className="text-xs font-bold">{goal.progress}%</span>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-accent"
                  style={{
                    width: `${Math.min(100, Math.max(0, goal.progress))}%`,
                  }}
                />
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                {formatCurrency(goal.current_value)} de{' '}
                {formatCurrency(goal.target_value)}
              </p>
            </article>
          ))
        ) : (
          <EmptyState
            icon={Target}
            title="Nenhuma meta para o período"
            description="Defina uma meta para acompanhar o progresso mensal."
            className="sm:col-span-2"
          />
        )}
      </div>
    </div>
  );
}

