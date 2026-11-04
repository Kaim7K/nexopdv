import { useState } from 'react';
import { Landmark } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { nexoApi } from '@/api/nexoApi';
import { Field } from '@/components/finance/FinanceUi';
import { formatCurrency } from '@/lib/helpers';

export default function Accounts({ bootstrap, dashboard, refreshAll }) {
  const [form, setForm] = useState({
      name: '',
      type: 'bank',
      opening_balance: '0',
      is_default: false,
    }),
    [saving, setSaving] = useState(false);
  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await nexoApi.finance.accounts.create({
        ...form,
        opening_balance: Number(form.opening_balance),
      });
      toast.success('Conta financeira criada.');
      setForm({
        name: '',
        type: 'bank',
        opening_balance: '0',
        is_default: false,
      });
      refreshAll();
    } catch (cause) {
      toast.error(cause.message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="grid content-start gap-3 xl:grid-cols-[22rem_minmax(0,1fr)]">
      <form onSubmit={save} className="surface-card h-fit space-y-3 p-3">
        <h3 className="font-bold">Nova conta financeira</h3>
        <Field label="Nome">
          <input
            required
            className="field"
            value={form.name}
            onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))}
          />
        </Field>
        <Field label="Tipo">
          <select
            className="field"
            value={form.type}
            onChange={(e) => setForm((v) => ({ ...v, type: e.target.value }))}
          >
            <option value="cash">Caixa físico</option>
            <option value="bank">Conta bancária</option>
            <option value="digital">Conta digital</option>
            <option value="wallet">Carteira</option>
            <option value="safe">Cofre</option>
            <option value="pix">Conta Pix</option>
            <option value="card_receivable">Cartão a receber</option>
          </select>
        </Field>
        <Field label="Saldo inicial">
          <input
            type="number"
            min="0"
            step="0.01"
            className="field"
            value={form.opening_balance}
            onChange={(e) =>
              setForm((v) => ({ ...v, opening_balance: e.target.value }))
            }
          />
        </Field>
        {(bootstrap.enabled_features || []).includes(
          'financial_email_alerts',
        ) &&
          (bootstrap.enabled_features || []).includes('email_sending') && (
            <label className="flex min-h-10 items-center gap-3 rounded-lg border border-border px-3 text-sm">
              <input
                type="checkbox"
                checked={form.is_default}
                onChange={(e) =>
                  setForm((v) => ({ ...v, is_default: e.target.checked }))
                }
              />{' '}
              Usar como conta padrão
            </label>
          )}
        <button
          type="submit"
          disabled={saving}
          className="min-h-10 w-full rounded-lg bg-accent font-bold text-accent-foreground"
        >
          Criar conta
        </button>
      </form>
      <div className="grid max-w-3xl content-start gap-2 sm:grid-cols-2">
        {(dashboard?.accounts || bootstrap.accounts || []).map((item) => (
          <article key={item.id} className="surface-card p-3">
            <div className="flex items-start justify-between">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent/10 text-accent">
                <Landmark className="h-5 w-5" />
              </div>
              {item.is_default && (
                <span className="rounded-full bg-accent/10 px-2 py-1 text-[10px] font-bold text-accent">
                  Padrão
                </span>
              )}
            </div>
            <strong className="mt-3 block text-sm">{item.name}</strong>
            <p className="mt-1 text-xs text-muted-foreground">{item.type}</p>
            <strong className="mt-2 block text-lg tabular-nums">
              {formatCurrency(item.balance ?? item.opening_balance)}
            </strong>
          </article>
        ))}
      </div>
    </div>
  );
}
