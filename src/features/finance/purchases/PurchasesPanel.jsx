import { useEffect, useState } from 'react';
import { PackagePlus, Plus } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { nexoApi } from '@/api/nexoApi';
import { useConfirm } from '@/components/common/ConfirmProvider';
import { EmptyState, LoadingState } from '@/components/common/PageState';
import { CancellationModal } from '@/components/finance/FinanceUi';
import { formatCurrency, formatDate } from '@/lib/helpers';
import PurchaseModal from './PurchaseModal';

export default function Purchases({ bootstrap, refreshAll }) {
  const confirm = useConfirm();
  const [items, setItems] = useState([]),
    [loading, setLoading] = useState(true),
    [open, setOpen] = useState(false),
    [products, setProducts] = useState([]),
    [productsLoading, setProductsLoading] = useState(false),
    [canceling, setCanceling] = useState(null),
    [cancelling, setCancelling] = useState(false);
  const load = () => {
    setLoading(true);
    nexoApi.finance.purchases
      .list()
      .then(setItems)
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);
  const openPurchase = async () => {
    setOpen(true);
    if (products.length || productsLoading) return;
    setProductsLoading(true);
    try {
      setProducts(await nexoApi.finance.products());
    } catch (cause) {
      setOpen(false);
      toast.error(cause.message || 'Não foi possível carregar os produtos.');
    } finally {
      setProductsLoading(false);
    }
  };
  const confirmPurchase = async (item) => {
    if (
      !(await confirm({
        title: `Confirmar compra #${item.purchase_number}?`,
        description:
          'O estoque, o custo médio e as contas a pagar serão atualizados de forma atômica.',
        confirmLabel: 'Confirmar compra',
      }))
    )
      return;
    try {
      await nexoApi.finance.purchases.confirm(item.id);
      toast.success('Compra confirmada e integrada ao estoque.');
      load();
      refreshAll();
    } catch (cause) {
      toast.error(cause.message);
    }
  };
  const cancelPurchase = async (reason) => {
    if (!canceling || cancelling) return;
    setCancelling(true);
    try {
      await nexoApi.finance.purchases.cancel(canceling.id, reason);
      toast.success(
        canceling.status === 'confirmed'
          ? 'Compra estornada. Estoque, contas, pagamentos e caixa foram atualizados.'
          : 'Rascunho de compra cancelado.',
      );
      setCanceling(null);
      load();
      refreshAll();
    } catch (cause) {
      toast.error(cause.message);
    } finally {
      setCancelling(false);
    }
  };
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={openPurchase}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-bold text-accent-foreground"
        >
          <Plus className="h-4 w-4" /> Registrar compra
        </button>
      </div>
      {loading ? (
        <LoadingState />
      ) : !items.length ? (
        <EmptyState
          icon={PackagePlus}
          title="Nenhuma compra registrada"
          description="Registre uma compra para atualizar estoque, custos e contas a pagar em conjunto."
        />
      ) : (
        <div className="grid gap-2">
          {items.map((item) => (
            <article
              key={item.id}
              className="surface-card flex flex-col gap-3 p-3 sm:flex-row sm:items-center"
            >
              <div className="min-w-0 flex-1">
                <strong className="text-sm">
                  Compra #{item.purchase_number} · {item.supplier_name}
                </strong>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatDate(item.issue_date)} · {item.item_count} produto(s) ·{' '}
                  {item.status === 'draft'
                    ? 'Rascunho'
                    : item.status === 'confirmed'
                      ? 'Confirmada'
                      : 'Cancelada'}
                </p>
              </div>
              <strong className="tabular-nums">
                {formatCurrency(item.total)}
              </strong>
              {item.status !== 'cancelled' && (
                <div className="flex flex-wrap gap-2">
                  {item.status === 'draft' && (
                    <button
                      type="button"
                      onClick={() => confirmPurchase(item)}
                      className="rounded-lg bg-accent px-3 py-2 text-xs font-bold text-accent-foreground"
                    >
                      Confirmar compra
                    </button>
                  )}
                  {bootstrap.permissions.cancel && (
                    <button
                      type="button"
                      onClick={() => setCanceling(item)}
                      className="rounded-lg border border-destructive/30 px-3 py-2 text-xs font-bold text-destructive hover:bg-destructive/10"
                    >
                      {item.status === 'confirmed' ? 'Estornar compra' : 'Cancelar rascunho'}
                    </button>
                  )}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
      <PurchaseModal
        open={open}
        onClose={() => setOpen(false)}
        bootstrap={bootstrap}
        products={products}
        productsLoading={productsLoading}
        onSaved={() => {
          setOpen(false);
          load();
          refreshAll();
        }}
      />
      <CancellationModal
        open={Boolean(canceling)}
        title={canceling?.status === 'confirmed' ? 'Estornar compra confirmada?' : 'Cancelar rascunho de compra?'}
        description={canceling?.status === 'confirmed'
          ? 'O estoque recebido será retirado, as contas e pagamentos serão estornados e a retirada do caixa será compensada. O histórico será preservado.'
          : 'O rascunho será cancelado sem alterar estoque, contas ou caixa.'}
        subject={canceling ? `Compra #${canceling.purchase_number} · ${formatCurrency(canceling.total)}` : ''}
        saving={cancelling}
        onClose={() => setCanceling(null)}
        onConfirm={cancelPurchase}
      />
    </div>
  );
}
