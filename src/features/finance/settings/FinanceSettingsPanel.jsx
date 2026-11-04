import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { nexoApi } from '@/api/nexoApi';
import { useAuth } from '@/lib/AuthContext';
import { hasPlanFeature } from '@/lib/plan-catalog';
import { Field } from '@/components/finance/FinanceUi';
import { StatusBadge } from '@/components/finance/TransactionList';
import { PAYMENT_OPTIONS } from '@/features/finance/payment-options';
import { formatCurrency, formatDate, getPaymentLabel } from '@/lib/helpers';
import { todayIsoDate } from '@/lib/date-helpers';

export default function FinanceSettings({ bootstrap, refreshAll }) {
  const [settings, setSettings] = useState({ ...bootstrap.settings }),
    [category, setCategory] = useState({ name: '', type: 'expense' }),
    [saving, setSaving] = useState(false);
  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await nexoApi.finance.settings.update(settings);
      toast.success('Configurações financeiras salvas.');
      refreshAll();
    } catch (cause) {
      toast.error(cause.message);
    } finally {
      setSaving(false);
    }
  };
  const addCategory = async (e) => {
    e.preventDefault();
    try {
      await nexoApi.finance.categories.create(category);
      toast.success('Categoria criada.');
      setCategory({ name: '', type: 'expense' });
      refreshAll();
    } catch (cause) {
      toast.error(cause.message);
    }
  };
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <form onSubmit={save} className="surface-card space-y-4 p-4">
        <h3 className="font-bold">Regras de cálculo e alertas</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Imposto estimado (%)">
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              className="field"
              value={settings.tax_rate ?? 0}
              onChange={(e) =>
                setSettings((v) => ({ ...v, tax_rate: e.target.value }))
              }
            />
          </Field>
          <Field label="Avisar antes do vencimento (dias)">
            <input
              type="number"
              min="0"
              max="90"
              className="field"
              value={settings.alert_days ?? 3}
              onChange={(e) =>
                setSettings((v) => ({ ...v, alert_days: e.target.value }))
              }
            />
          </Field>
          <Field label="Taxa cartão débito (%)">
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              className="field"
              value={settings.debit_card_fee ?? 0}
              onChange={(e) =>
                setSettings((v) => ({ ...v, debit_card_fee: e.target.value }))
              }
            />
          </Field>
          <Field label="Taxa cartão crédito (%)">
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              className="field"
              value={settings.credit_card_fee ?? 0}
              onChange={(e) =>
                setSettings((v) => ({ ...v, credit_card_fee: e.target.value }))
              }
            />
          </Field>
        </div>
        <label className="flex min-h-11 items-center gap-3 rounded-xl border border-border px-3 text-sm">
          <input
            type="checkbox"
            checked={Boolean(settings.email_alerts)}
            onChange={(e) =>
              setSettings((v) => ({ ...v, email_alerts: e.target.checked }))
            }
          />{' '}
          Enviar alertas financeiros por e-mail
        </label>
        <button
          type="submit"
          disabled={saving}
          className="min-h-11 rounded-xl bg-accent px-4 text-sm font-bold text-accent-foreground"
        >
          Salvar configurações
        </button>
      </form>
      <section className="surface-card p-4">
        <h3 className="font-bold">Categorias financeiras</h3>
        <form
          onSubmit={addCategory}
          className="mt-4 grid gap-2 sm:grid-cols-[1fr_140px_auto]"
        >
          <input
            required
            className="field mt-0"
            value={category.name}
            onChange={(e) =>
              setCategory((v) => ({ ...v, name: e.target.value }))
            }
            placeholder="Nome da categoria"
          />
          <select
            className="field mt-0"
            value={category.type}
            onChange={(e) =>
              setCategory((v) => ({ ...v, type: e.target.value }))
            }
          >
            <option value="expense">Despesa</option>
            <option value="revenue">Receita</option>
            <option value="both">Ambas</option>
          </select>
          <button
            type="submit"
            className="min-h-11 rounded-xl bg-accent px-3 text-sm font-bold text-accent-foreground"
          >
            Adicionar
          </button>
        </form>
        <div className="mt-4 flex max-h-80 flex-wrap content-start gap-2 overflow-y-auto">
          {bootstrap.categories
            .filter((c) => c.active)
            .map((c) => (
              <span
                key={c.id}
                className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold"
              >
                {c.name}{' '}
                <span className="text-muted-foreground">
                  ·{' '}
                  {c.type === 'expense'
                    ? 'despesa'
                    : c.type === 'revenue'
                      ? 'receita'
                      : 'ambas'}
                </span>
              </span>
            ))}
        </div>
      </section>
      {(bootstrap.enabled_features || []).includes('recurring_finance') && (
        <RecurringPanel bootstrap={bootstrap} refreshAll={refreshAll} />
      )}
      <PermissionsPanel bootstrap={bootstrap} refreshAll={refreshAll} />
    </div>
  );
}

function RecurringPanel({ bootstrap, refreshAll }) {
  const [form, setForm] = useState({
    description: '',
    amount: '',
    category_id: '',
    account_id:
      bootstrap.accounts?.find((item) => item.is_default)?.id ||
      bootstrap.accounts?.[0]?.id ||
      '',
    frequency: 'monthly',
    start_date: todayIsoDate(),
    due_day: String(new Date().getDate()),
    transaction_type: 'expense',
    payment_method: 'boleto',
  });
  const [saving, setSaving] = useState(false);
  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await nexoApi.finance.recurring.create({
        ...form,
        amount: Number(form.amount),
      });
      toast.success('Despesa recorrente criada e próximas contas geradas.');
      setForm((value) => ({ ...value, description: '', amount: '' }));
      refreshAll();
    } catch (cause) {
      toast.error(cause.message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <section className="surface-card p-4 xl:col-span-2">
      <h3 className="font-bold">Despesas recorrentes</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Aluguel, serviços e outras contas são gerados automaticamente com
        antecedência.
      </p>
      <form
        onSubmit={submit}
        className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        <Field label="Descrição">
          <input
            required
            className="field"
            value={form.description}
            onChange={(e) =>
              setForm((v) => ({ ...v, description: e.target.value }))
            }
          />
        </Field>
        <Field label="Valor">
          <input
            required
            type="number"
            min="0.01"
            step="0.01"
            className="field"
            value={form.amount}
            onChange={(e) => setForm((v) => ({ ...v, amount: e.target.value }))}
          />
        </Field>
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
              .filter(
                (item) =>
                  item.active &&
                  (item.type === 'expense' || item.type === 'both'),
              )
              .map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Frequência">
          <select
            className="field"
            value={form.frequency}
            onChange={(e) =>
              setForm((v) => ({ ...v, frequency: e.target.value }))
            }
          >
            <option value="weekly">Semanal</option>
            <option value="monthly">Mensal</option>
            <option value="quarterly">Trimestral</option>
            <option value="yearly">Anual</option>
          </select>
        </Field>
        <Field label="Data inicial">
          <input
            type="date"
            className="field"
            value={form.start_date}
            onChange={(e) =>
              setForm((v) => ({ ...v, start_date: e.target.value }))
            }
          />
        </Field>
        <Field label="Dia do vencimento">
          <input
            type="number"
            min="1"
            max="31"
            className="field"
            value={form.due_day}
            onChange={(e) =>
              setForm((v) => ({ ...v, due_day: e.target.value }))
            }
          />
        </Field>
        <Field label="Forma padrão">
          <select
            className="field"
            value={form.payment_method}
            onChange={(e) =>
              setForm((v) => ({ ...v, payment_method: e.target.value }))
            }
          >
            {PAYMENT_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {getPaymentLabel(value)}
              </option>
            ))}
          </select>
        </Field>
        <button
          type="submit"
          disabled={saving}
          className="mt-auto min-h-11 rounded-xl bg-accent px-4 text-sm font-bold text-accent-foreground disabled:opacity-50"
        >
          Criar recorrência
        </button>
      </form>
      {bootstrap.recurring?.length > 0 && (
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {bootstrap.recurring.map((item) => (
            <article
              key={item.id}
              className="rounded-xl border border-border p-3"
            >
              <div className="flex justify-between gap-2">
                <strong className="text-sm">{item.description}</strong>
                <StatusBadge status={item.active ? 'paid' : 'cancelled'} />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatCurrency(item.amount)} · próximo vencimento{' '}
                {formatDate(item.next_due_date)}
              </p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function PermissionsPanel({ bootstrap, refreshAll }) {
  const { user } = useAuth();
  if (!bootstrap.permissions.manage_permissions || !hasPlanFeature(user, 'advanced_permissions')) return null;
  const labels = {
    view: 'Visualizar financeiro',
    create: 'Registrar lançamentos',
    edit: 'Editar lançamentos',
    pay: 'Marcar contas como pagas',
    view_profit: 'Visualizar lucro',
    view_costs: 'Visualizar custos',
    export: 'Exportar relatórios',
    manage_suppliers: 'Gerenciar fornecedores',
    manage_accounts: 'Gerenciar contas',
    manage_purchases: 'Gerenciar compras',
    approve_payments: 'Aprovar pagamentos',
    cancel: 'Cancelar ou estornar',
    manage_settings: 'Alterar configurações',
    manage_permissions: 'Gerenciar permissões',
  };
  return (
    <section className="surface-card p-4 xl:col-span-2">
      <h3 className="font-bold">Permissões financeiras por usuário</h3>
      <div className="mt-4 grid gap-3">
        {bootstrap.users
          .filter((u) => u.role !== 'admin')
          .map((user) => (
            <details
              key={user.id}
              className="rounded-xl border border-border p-3"
            >
              <summary className="cursor-pointer text-sm font-bold">
                {user.name}{' '}
                <span className="font-normal text-muted-foreground">
                  · {user.role}
                </span>
              </summary>
              <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {bootstrap.permission_keys.map((key) => (
                  <label
                    key={key}
                    className="flex min-h-10 items-center gap-2 rounded-lg bg-muted/20 px-3 text-xs"
                  >
                    <input
                      type="checkbox"
                      defaultChecked={Boolean(user.permissions[key])}
                      onChange={async (e) => {
                        const next = {
                          ...user.permissions,
                          [key]: e.target.checked,
                        };
                        try {
                          await nexoApi.finance.permissions.update(
                            user.id,
                            next,
                          );
                          user.permissions = next;
                          toast.success('Permissão atualizada.');
                          refreshAll();
                        } catch (cause) {
                          e.target.checked = !e.target.checked;
                          toast.error(cause.message);
                        }
                      }}
                    />
                    {labels[key] || key}
                  </label>
                ))}
              </div>
            </details>
          ))}
      </div>
    </section>
  );
}
