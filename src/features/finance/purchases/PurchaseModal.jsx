import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { nexoApi } from '@/api/nexoApi';
import ImageUploadField from '@/components/ImageUploadField';
import { Field, FinanceModal, ModalActions } from '@/components/finance/FinanceUi';
import { LoadingState } from '@/components/common/PageState';
import { formatCurrency, getPaymentLabel } from '@/lib/helpers';
import { PAYMENT_OPTIONS } from '../payment-options';
import { buildPurchasePayload, createPurchaseForm, getPurchaseTotals } from './purchase-model';

export default function PurchaseModal({
  open,
  onClose,
  bootstrap,
  products,
  productsLoading,
  onSaved,
}) {
  const defaultForm = () => createPurchaseForm(bootstrap);
  const [form, setForm] = useState(defaultForm),
    [saving, setSaving] = useState(false);
  useEffect(() => {
    if (open) setForm(defaultForm());
  }, [open]);
  if (!open) return null;
  if (productsLoading)
    return (
      <FinanceModal
        title="Registrar compra"
        description="Carregando os produtos disponíveis para montar a compra."
        onClose={onClose}
        wide
      >
        <LoadingState
          className="min-h-48"
          label="Carregando produtos para a compra..."
        />
      </FinanceModal>
    );
  const { total } = getPurchaseTotals(form);
  const updateItem = (index, key, value) =>
    setForm((v) => ({
      ...v,
      items: v.items.map((item, i) =>
        i === index ? { ...item, [key]: value } : item,
      ),
    }));
  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await nexoApi.finance.purchases.create(buildPurchasePayload(form, total));
      toast.success(
        'Compra salva como rascunho. Confirme para atualizar o estoque.',
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
      title="Registrar compra"
      description="Salve os produtos e valores como rascunho. O estoque e as contas só mudam após confirmar a compra."
      onClose={onClose}
      disabled={saving}
      formLayout
      wide
    >
      <form onSubmit={submit} className="modal-form">
        <div className="modal-body space-y-4">
          <div className="adaptive-form-fields modal-field-group grid gap-4 sm:grid-cols-3">
            <Field label="Fornecedor">
              <select
                required
                className="field"
                value={form.supplier_id}
                onChange={(e) =>
                  setForm((v) => ({ ...v, supplier_id: e.target.value }))
                }
              >
                <option value="">Selecione</option>
                {bootstrap.suppliers
                  .filter((s) => s.active)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Data da compra">
              <input
                type="date"
                className="field"
                value={form.issue_date}
                onChange={(e) =>
                  setForm((v) => ({ ...v, issue_date: e.target.value }))
                }
              />
            </Field>
            <Field label="Forma de pagamento">
              <select
                className="field"
                value={form.payment_method}
                onChange={(e) =>
                  setForm((v) => ({ ...v, payment_method: e.target.value }))
                }
              >
                {PAYMENT_OPTIONS.map((v) => (
                  <option key={v} value={v}>
                    {getPaymentLabel(v)}
                  </option>
                ))}
              </select>
            </Field>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold">Produtos</h4>
            <button
              type="button"
              onClick={() =>
                setForm((v) => ({
                  ...v,
                  items: [
                    ...v.items,
                    { product_id: '', quantity: 1, unit_cost: '' },
                  ],
                }))
              }
              className="text-xs font-bold text-accent"
            >
              + Adicionar produto
            </button>
          </div>
          {form.items.map((item, index) => (
            <div
              key={index}
              className="purchase-item grid gap-3 rounded-xl border border-border p-3 sm:grid-cols-[minmax(0,1fr)_100px_130px_44px]"
            >
              <label>
                Produto
                <select
                  required
                  className="field mt-0"
                  value={item.product_id}
                  onChange={(e) =>
                    updateItem(index, 'product_id', e.target.value)
                  }
                >
                  <option value="">Produto</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.internal_code || p.barcode || 'sem código'})
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Quantidade
                <input
                  required
                  aria-label="Quantidade"
                  type="number"
                  min="0.001"
                  step="0.001"
                  className="field mt-0"
                  value={item.quantity}
                  onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                />
              </label>
              <label>
                Custo unitário
                <input
                  required
                  aria-label="Custo unitário"
                  type="number"
                  min="0"
                  step="0.0001"
                  className="field mt-0"
                  value={item.unit_cost}
                  onChange={(e) => updateItem(index, 'unit_cost', e.target.value)}
                  placeholder="Custo unit."
                />
              </label>
              <button
                type="button"
                aria-label="Remover produto"
                disabled={form.items.length === 1}
                onClick={() =>
                  setForm((v) => ({
                    ...v,
                    items: v.items.filter((_, i) => i !== index),
                  }))
                }
                className="purchase-remove grid h-11 place-items-center rounded-xl border border-destructive/20 text-destructive disabled:opacity-30"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        <div className="adaptive-form-fields modal-field-group grid gap-4 sm:grid-cols-3">
          <Field label="Desconto">
            <input
              type="number"
              min="0"
              step="0.01"
              className="field"
              value={form.discount}
              onChange={(e) =>
                setForm((v) => ({ ...v, discount: e.target.value }))
              }
            />
          </Field>
          <Field label="Frete">
            <input
              type="number"
              min="0"
              step="0.01"
              className="field"
              value={form.freight}
              onChange={(e) =>
                setForm((v) => ({ ...v, freight: e.target.value }))
              }
            />
          </Field>
          <div className="rounded-xl bg-muted/30 p-3">
            <span className="text-xs text-muted-foreground">Total</span>
            <strong className="mt-1 block text-xl">
              {formatCurrency(total)}
            </strong>
          </div>
        </div>
        <ImageUploadField
          capture="environment"
          kind="receipt"
          value={form.attachment_url}
          onChange={(value) =>
            setForm((v) => ({ ...v, attachment_url: value }))
          }
          label="Nota fiscal ou comprovante"
        />
        </div>
        <ModalActions
          saving={saving}
          onClose={onClose}
          label="Salvar rascunho"
        />
      </form>
    </FinanceModal>
  );
}
