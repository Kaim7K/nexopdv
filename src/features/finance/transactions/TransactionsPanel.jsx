import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Loader2,
  Plus,
  Search,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { nexoApi } from '@/api/nexoApi';
import { LoadingState } from '@/components/common/PageState';
import PaginationControls from '@/components/common/PaginationControls';
import ImageUploadField from '@/components/ImageUploadField';
import {
  CancellationModal,
  Field,
  FinanceModal,
  ModalActions,
} from '@/components/finance/FinanceUi';
import TransactionList from '@/components/finance/TransactionList';
import { useConfirm } from '@/components/common/ConfirmProvider';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import {
  formatCurrency,
  getPaymentLabel,
} from '@/lib/helpers';
import { todayIsoDate, toInputDate } from '@/lib/date-helpers';

const PAYMENT_OPTIONS = [
  'dinheiro',
  'pix',
  'debito',
  'credito',
  'boleto',
  'transferencia',
  'outros',
];

export function TransactionsPanel({ mode, bootstrap, range, refreshAll }) {
  const confirm = useConfirm();
  const requestSequence = useRef(0);
  const [data, setData] = useState(null),
    [loading, setLoading] = useState(true),
    [search, setSearch] = useState(''),
    [page, setPage] = useState(1),
    [modal, setModal] = useState(false),
    [editing, setEditing] = useState(null),
    [paying, setPaying] = useState(null),
    [canceling, setCanceling] = useState(null),
    [cancelling, setCancelling] = useState(false),
    [selected, setSelected] = useState([]);
  const debouncedSearch = useDebouncedValue(search, 280);
  const filters = useMemo(
    () => ({
      from: range.from,
      to: range.to,
      page,
      page_size: 25,
      search: debouncedSearch,
      type: mode === 'revenue' ? 'revenue' : 'expense',
      status: mode === 'payables' ? 'open' : '',
    }),
    [range, page, debouncedSearch, mode],
  );
  const load = useCallback(async () => {
    const sequence = ++requestSequence.current;
    setLoading(true);
    try {
      const result = await nexoApi.finance.transactions.list(filters);
      if (sequence === requestSequence.current) setData(result);
    } catch (cause) {
      if (
        sequence === requestSequence.current &&
        cause.code !== 'REQUEST_REPLACED'
      )
        toast.error(cause.message);
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  }, [filters]);
  useEffect(() => {
    load();
  }, [load]);
  const cancel = (item) => setCanceling(item);
  const confirmCancellation = async (reason) => {
    if (!canceling || cancelling) return;
    setCancelling(true);
    try {
      await nexoApi.finance.transactions.cancel(canceling.id, reason);
      toast.success('Lançamento cancelado e pagamentos relacionados estornados.');
      setCanceling(null);
      load();
      refreshAll();
    } catch (cause) {
      toast.error(cause.message);
    } finally {
      setCancelling(false);
    }
  };
  const batchPay = async () => {
    if (!selected.length) return;
    const accepted = await confirm({
      title: 'Marcar contas selecionadas como pagas?',
      description: `Serão processados ${selected.length} lançamentos pendentes, preservando o histórico de pagamentos.`,
      confirmLabel: 'Registrar pagamentos',
    });
    if (!accepted) return;
    try {
      await nexoApi.finance.transactions.batch({
        ids: selected,
        action: 'pay',
      });
      toast.success('Pagamentos registrados.');
      setSelected([]);
      load();
      refreshAll();
    } catch (cause) {
      toast.error(cause.message);
    }
  };
  return (
    <div className="space-y-4">
      <div className="surface-card grid gap-3 p-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <label className="relative">
          <Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
          <input
            className="field mt-0 pl-9"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Pesquisar descrição ou fornecedor"
          />
        </label>
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setModal(true);
          }}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-accent px-3 text-sm sm:min-h-11 sm:px-4 font-bold text-accent-foreground"
        >
          <Plus className="h-4 w-4" /> Novo lançamento
        </button>
      </div>
      {selected.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-accent/30 bg-accent/5 p-3">
          <span className="text-sm font-bold">
            {selected.length} selecionado(s)
          </span>
          <button
            type="button"
            onClick={batchPay}
            className="rounded-lg bg-accent px-3 py-2 text-xs font-bold text-accent-foreground"
          >
            Marcar como pagos
          </button>
        </div>
      )}
      {loading && data && (
        <div
          className="flex items-center gap-2 text-xs font-semibold text-muted-foreground"
          role="status"
        >
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Atualizando
          lançamentos...
        </div>
      )}
      {loading && !data ? (
        <LoadingState label="Carregando lançamentos..." />
      ) : (
        <div aria-busy={loading} className={loading ? 'opacity-70' : ''}>
          <TransactionList
            items={data?.items || []}
            selectable={mode === 'payables'}
            selected={selected}
            setSelected={setSelected}
            onPay={bootstrap.permissions.pay ? setPaying : null}
            onEdit={
              bootstrap.permissions.edit
                ? (item) => {
                    setEditing(item);
                    setModal(true);
                  }
                : null
            }
            onCancel={bootstrap.permissions.cancel ? cancel : null}
            onDuplicate={
              bootstrap.permissions.create
                ? async (item) => {
                    try {
                      await nexoApi.finance.transactions.duplicate(item.id);
                      toast.success('Lançamento duplicado.');
                      load();
                    } catch (cause) {
                      toast.error(cause.message);
                    }
                  }
                : null
            }
          />
        </div>
      )}
      <PaginationControls
        page={data?.page || 1}
        pageCount={data?.page_count || 1}
        total={data?.total || 0}
        pageSize={data?.page_size || 25}
        onPageChange={setPage}
      />
      <TransactionModal
        open={modal}
        onClose={() => {
          setModal(false);
          setEditing(null);
        }}
        bootstrap={bootstrap}
        item={editing}
        initialType={mode === 'revenue' ? 'revenue' : 'expense'}
        onSaved={() => {
          setModal(false);
          setEditing(null);
          load();
          refreshAll();
        }}
      />
      <PaymentModal
        item={paying}
        accounts={bootstrap.accounts}
        onClose={() => setPaying(null)}
        onSaved={() => {
          setPaying(null);
          load();
          refreshAll();
        }}
      />
      <CancellationModal
        open={Boolean(canceling)}
        title="Cancelar lançamento?"
        description="O lançamento continuará no histórico. Pagamentos e movimentações de caixa vinculados serão estornados."
        subject={canceling ? `${canceling.description} · ${formatCurrency(canceling.amount)}` : ''}
        saving={cancelling}
        onClose={() => setCanceling(null)}
        onConfirm={confirmCancellation}
      />
    </div>
  );
}

export function TransactionModal({
  open,
  onClose,
  bootstrap,
  initialType,
  onSaved,
  item = null,
}) {
  const initial = {
    type: initialType,
    description: '',
    amount: '',
    category_id: '',
    supplier_id: '',
    account_id:
      bootstrap?.accounts?.find((item) => item.is_default)?.id ||
      bootstrap?.accounts?.[0]?.id ||
      '',
    issue_date: todayIsoDate(),
    due_date: todayIsoDate(),
    payment_method: '',
    status: 'pending',
    notes: '',
    attachment_url: '',
  };
  const [form, setForm] = useState(initial),
    [saving, setSaving] = useState(false),
    [advanced, setAdvanced] = useState(false);
  useEffect(() => {
    if (open)
      setForm(
        item
          ? {
              ...initial,
              ...item,
              amount: String(item.amount),
              issue_date: toInputDate(item.issue_date),
              due_date: toInputDate(item.due_date || item.issue_date),
              category_id: item.category_id || '',
              supplier_id: item.supplier_id || '',
              account_id: item.account_id || initial.account_id,
              payment_method: item.payment_method || '',
              notes: item.notes || '',
              attachment_url: item.attachment_url || '',
            }
          : { ...initial, type: initialType },
      );
  }, [open, initialType, bootstrap, item]);
  if (!open) return null;
  const categories = (bootstrap?.categories || []).filter(
    (item) =>
      item.active &&
      (item.type === form.type ||
        item.type === 'both' ||
        (form.type === 'loss' && item.type === 'expense')),
  );
  const submit = async (event) => {
    event.preventDefault();
    if (!form.description.trim()) return toast.error('Informe a descrição.');
    setSaving(true);
    try {
      const payload = {
        ...form,
        amount: Number(form.amount),
      };
      if (item) await nexoApi.finance.transactions.update(item.id, payload);
      else await nexoApi.finance.transactions.create(payload);
      toast.success(
        form.type === 'expense'
          ? item
            ? 'Despesa atualizada.'
            : 'Despesa registrada.'
          : item
            ? 'Lançamento atualizado.'
            : 'Lançamento registrado.',
      );
      onSaved();
    } catch (cause) {
      toast.error(cause.message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <FinanceModal
      title={
        item
          ? 'Editar lançamento'
          : initialType === 'expense'
            ? 'Adicionar despesa'
            : 'Novo lançamento'
      }
      onClose={onClose}
      disabled={saving}
      description={item ? 'Atualize valor, datas e status.' : initialType === 'expense' ? 'Registre a saída do caixa ou conta.' : 'Informe valor, origem e status.'}
    >
      <form onSubmit={submit} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Tipo">
            <select
              className="field"
              value={form.type}
              onChange={(e) =>
                setForm((v) => ({
                  ...v,
                  type: e.target.value,
                  category_id: '',
                }))
              }
            >
              <option value="expense">Despesa</option>
              <option value="revenue">Receita externa</option>
              <option value="loss">Perda ou avaria</option>
              <option value="transfer">Transferência entre contas</option>
            </select>
          </Field>
          <Field label="Valor">
            <input
              required
              min="0.01"
              step="0.01"
              inputMode="decimal"
              className="field"
              value={form.amount}
              onChange={(e) =>
                setForm((v) => ({ ...v, amount: e.target.value }))
              }
            />
          </Field>
        </div>
        <Field label="Descrição">
          <input
            required
            autoFocus
            maxLength={180}
            className="field"
            value={form.description}
            onChange={(e) =>
              setForm((v) => ({ ...v, description: e.target.value }))
            }
            placeholder="Ex.: Conta de energia de julho"
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Categoria">
            <select
              required={form.type !== 'transfer'}
              className="field"
              value={form.category_id}
              onChange={(e) =>
                setForm((v) => ({ ...v, category_id: e.target.value }))
              }
            >
              <option value="">Selecione</option>
              {categories.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Vencimento">
            <input
              required
              type="date"
              className="field"
              min={form.issue_date}
              value={form.due_date}
              onChange={(e) =>
                setForm((v) => ({ ...v, due_date: e.target.value }))
              }
            />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Conta financeira">
            <select
              required
              className="field"
              value={form.account_id}
              onChange={(e) =>
                setForm((v) => ({ ...v, account_id: e.target.value }))
              }
            >
              {(bootstrap?.accounts || [])
                .filter((item) => item.active)
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
            </select>
          </Field>
          {form.type === 'transfer' ? (
            <Field label="Conta de destino">
              <select
                required
                className="field"
                value={form.transfer_account_id || ''}
                onChange={(e) =>
                  setForm((v) => ({
                    ...v,
                    transfer_account_id: e.target.value,
                  }))
                }
              >
                <option value="">Selecione</option>
                {(bootstrap?.accounts || [])
                  .filter((item) => item.active && item.id !== form.account_id)
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
              </select>
            </Field>
          ) : (
            <Field label="Status do pagamento">
              <select
                className="field"
                value={form.status}
                onChange={(e) =>
                  setForm((v) => ({ ...v, status: e.target.value }))
                }
              >
                <option value="pending">Pendente</option>
                <option value="paid">Pago</option>
              </select>
            </Field>
          )}
        </div>
        <button
          type="button"
          onClick={() => setAdvanced((v) => !v)}
          className="text-xs font-bold text-accent"
        >
          {advanced
            ? 'Ocultar dados complementares'
            : 'Adicionar fornecedor, forma, observações e comprovante'}
        </button>
        {advanced && (
          <div className="space-y-4 rounded-xl border border-border bg-muted/15 p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Fornecedor">
                <select
                  className="field"
                  value={form.supplier_id}
                  onChange={(e) =>
                    setForm((v) => ({ ...v, supplier_id: e.target.value }))
                  }
                >
                  <option value="">Não informado</option>
                  {(bootstrap?.suppliers || [])
                    .filter((item) => item.active)
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                </select>
              </Field>
              <Field label="Forma de pagamento">
                <select
                  className="field"
                  value={form.payment_method}
                  onChange={(e) =>
                    setForm((v) => ({ ...v, payment_method: e.target.value }))
                  }
                >
                  <option value="">Não informada</option>
                  {PAYMENT_OPTIONS.map((item) => (
                    <option key={item} value={item}>
                      {getPaymentLabel(item)}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Observações">
              <textarea
                className="field h-24 py-3"
                value={form.notes}
                onChange={(e) =>
                  setForm((v) => ({ ...v, notes: e.target.value }))
                }
              />
            </Field>
            <ImageUploadField
              capture="environment"
              kind="receipt"
              value={form.attachment_url}
              onChange={(value) =>
                setForm((v) => ({ ...v, attachment_url: value }))
              }
              label="Comprovante"
              name="Comprovante"
            />
          </div>
        )}
        <ModalActions saving={saving} onClose={onClose} />
      </form>
    </FinanceModal>
  );
}

export function PaymentModal({ item, accounts, onClose, onSaved }) {
  const [form, setForm] = useState({
      amount: '',
      account_id: '',
      payment_method: 'pix',
      paid_at: new Date().toISOString().slice(0, 16),
      attachment_url: '',
    }),
    [saving, setSaving] = useState(false);
  useEffect(() => {
    if (item)
      setForm((v) => ({
        ...v,
        amount: (Number(item.amount) - Number(item.paid_amount)).toFixed(2),
        account_id:
          item.account_id ||
          accounts?.find((a) => a.is_default)?.id ||
          accounts?.[0]?.id ||
          '',
      }));
  }, [item, accounts]);
  if (!item) return null;
  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await nexoApi.finance.transactions.pay(item.id, {
        ...form,
        amount: Number(form.amount),
      });
      toast.success('Pagamento registrado.');
      onSaved();
    } catch (cause) {
      toast.error(cause.message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <FinanceModal
      title="Registrar pagamento"
      description="Confirme quanto foi pago, a data, a forma e a conta de onde o dinheiro saiu."
      onClose={onClose}
      disabled={saving}
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="rounded-xl bg-muted/30 p-4">
          <p className="text-sm font-bold">{item.description}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Saldo:{' '}
            {formatCurrency(Number(item.amount) - Number(item.paid_amount))}
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Valor">
            <input
              required
              type="number"
              min="0.01"
              step="0.01"
              className="field"
              value={form.amount}
              onChange={(e) =>
                setForm((v) => ({ ...v, amount: e.target.value }))
              }
            />
          </Field>
          <Field label="Data e horário">
            <input
              required
              type="datetime-local"
              className="field"
              value={form.paid_at}
              onChange={(e) =>
                setForm((v) => ({ ...v, paid_at: e.target.value }))
              }
            />
          </Field>
          <Field label="Conta">
            <select
              required
              className="field"
              value={form.account_id}
              onChange={(e) =>
                setForm((v) => ({ ...v, account_id: e.target.value }))
              }
            >
              {(accounts || [])
                .filter((a) => a.active)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Forma">
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
        </div>
        <ImageUploadField
          capture="environment"
          kind="receipt"
          value={form.attachment_url}
          onChange={(value) =>
            setForm((v) => ({ ...v, attachment_url: value }))
          }
          label="Comprovante"
        />
        <ModalActions saving={saving} onClose={onClose} />
      </form>
    </FinanceModal>
  );
}
