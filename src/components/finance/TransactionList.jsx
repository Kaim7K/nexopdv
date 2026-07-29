import React from 'react';
import { Receipt } from 'lucide-react';
import { EmptyState } from '@/components/common/PageState';
import { formatCurrency, formatDate } from '@/lib/helpers';

const STATUS_LABEL = {
  pending: 'Pendente',
  partial: 'Parcial',
  paid: 'Pago',
  overdue: 'Atrasado',
  cancelled: 'Cancelado',
  reversed: 'Estornado',
};
const TYPE_LABEL = {
  expense: 'Despesa',
  revenue: 'Receita',
  transfer: 'Transferência',
  loss: 'Perda',
  adjustment: 'Ajuste',
};

export default function TransactionList({
  items,
  selectable = false,
  selected = [],
  setSelected,
  onPay,
  onEdit,
  onCancel,
  onDuplicate,
}) {
  if (!items.length)
    return (
      <EmptyState
        icon={Receipt}
        title="Nenhum lançamento encontrado"
        description="Ajuste o período ou registre o primeiro lançamento."
      />
    );
  return (
    <>
      <div className="grid gap-3 lg:hidden">
        {items.map((item) => (
          <article key={item.id} className="surface-card p-4">
            <div className="flex items-start gap-3">
              {selectable && (
                <input
                  type="checkbox"
                  className="mt-1 h-5 w-5"
                  checked={selected.includes(item.id)}
                  onChange={() =>
                    setSelected((value) =>
                      value.includes(item.id)
                        ? value.filter((id) => id !== item.id)
                        : [...value, item.id],
                    )
                  }
                />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <strong className="break-words text-sm">
                    {item.description}
                  </strong>
                  <StatusBadge status={item.status} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {item.category_name || TYPE_LABEL[item.type]} ·{' '}
                  {formatDate(item.due_date || item.issue_date)}
                </p>
                <strong
                  className={`mt-3 block text-lg tabular-nums ${item.type === 'revenue' ? 'text-emerald-600' : 'text-foreground'}`}
                >
                  {formatCurrency(item.amount)}
                </strong>
                <div className="mt-3 flex flex-wrap gap-2">
                  <RowActions
                    item={item}
                    onPay={onPay}
                    onEdit={onEdit}
                    onCancel={onCancel}
                    onDuplicate={onDuplicate}
                  />
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
      <div className="surface-card hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[920px] text-sm">
          <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
            <tr>
              {selectable && <th className="w-12 px-4 py-3">Sel.</th>}
              <th className="px-4 py-3">Descrição</th>
              <th className="px-4 py-3">Categoria</th>
              <th className="px-4 py-3">Vencimento</th>
              <th className="px-4 py-3">Valor</th>
              <th className="px-4 py-3">Pago</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.map((item) => (
              <tr key={item.id} className="hover:bg-muted/20">
                {selectable && (
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={selected.includes(item.id)}
                      onChange={() =>
                        setSelected((value) =>
                          value.includes(item.id)
                            ? value.filter((id) => id !== item.id)
                            : [...value, item.id],
                        )
                      }
                    />
                  </td>
                )}
                <td className="max-w-64 px-4 py-3 font-semibold">
                  {item.description}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {item.category_name || '—'}
                </td>
                <td className="px-4 py-3">
                  {formatDate(item.due_date || item.issue_date)}
                </td>
                <td className="px-4 py-3 font-bold tabular-nums">
                  {formatCurrency(item.amount)}
                </td>
                <td className="px-4 py-3 tabular-nums">
                  {formatCurrency(item.paid_amount)}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={item.status} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <RowActions
                      item={item}
                      onPay={onPay}
                      onEdit={onEdit}
                      onCancel={onCancel}
                      onDuplicate={onDuplicate}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
function RowActions({ item, onPay, onEdit, onCancel, onDuplicate }) {
  return (
    <>
      {onPay && ['pending', 'partial', 'overdue'].includes(item.status) && (
        <button
          type="button"
          onClick={() => onPay(item)}
          className="rounded-lg border border-border px-2.5 py-2 text-xs font-bold hover:bg-muted"
        >
          Pagar
        </button>
      )}
      {onDuplicate && (
        <button
          type="button"
          onClick={() => onDuplicate(item)}
          className="rounded-lg border border-border px-2.5 py-2 text-xs font-bold hover:bg-muted"
        >
          Duplicar
        </button>
      )}
      {onEdit && ['pending', 'partial', 'overdue'].includes(item.status) && (
        <button
          type="button"
          onClick={() => onEdit(item)}
          className="rounded-lg border border-border px-2.5 py-2 text-xs font-bold hover:bg-muted"
        >
          Editar
        </button>
      )}
      {onCancel && !['cancelled', 'reversed'].includes(item.status) && (
        <button
          type="button"
          onClick={() => onCancel(item)}
          className="rounded-lg border border-destructive/30 px-2.5 py-2 text-xs font-bold text-destructive hover:bg-destructive/5"
        >
          Cancelar
        </button>
      )}
    </>
  );
}
function StatusBadge({ status }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-1 text-[10px] font-bold ${status === 'paid' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : status === 'overdue' ? 'bg-destructive/10 text-destructive' : status === 'cancelled' || status === 'reversed' ? 'bg-muted text-muted-foreground' : 'bg-amber-500/10 text-amber-700 dark:text-amber-300'}`}
    >
      {STATUS_LABEL[status] || status}
    </span>
  );
}
