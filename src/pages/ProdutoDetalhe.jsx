import React, { useEffect, useState } from 'react';
import { useParams, Link, useOutletContext } from 'react-router-dom';
import { nexoApi } from '@/api/nexoApi';
import { ArrowLeft, Edit, History, Package } from 'lucide-react';
import { formatCurrency, formatDateTime } from '@/lib/helpers';
import ProductForm from '@/components/stock/ProductForm';
import { DEFAULT_PRODUCT_CATEGORIES } from '@/lib/product-categories';
import { EmptyState, ErrorState, LoadingState } from '@/components/common/PageState';

export default function ProdutoDetalhe() {
  const { id } = useParams();
  const { user } = /** @type {any} */ (useOutletContext());
  const [product, setProduct] = useState(null);
  const [audits, setAudits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showEdit, setShowEdit] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [productData, auditData] = await Promise.all([
        nexoApi.entities.Product.get(id),
        nexoApi.entities.ProductAudit.filter({ product_id: id }, '-created_date', 50),
      ]);
      setProduct(productData);
      setAudits(auditData);
    } catch (loadError) {
      setError(loadError.message || 'Não foi possível carregar os dados deste produto.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  if (loading) return <LoadingState className="min-h-[60vh]" label="Carregando produto..." />;

  return (
    <div className="page-shell max-w-4xl">
      <Link to="/estoque" className="mb-5 inline-flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Voltar ao estoque
      </Link>

      {error ? (
        <ErrorState description={error} onRetry={load} />
      ) : !product ? (
        <EmptyState icon={Package} title="Produto não encontrado" description="O item pode ter sido removido ou o endereço está incorreto." />
      ) : (
        <>
          <section className="surface-card mb-5 p-4 sm:p-6" aria-labelledby="product-title">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
              <div className="grid aspect-square w-28 flex-none place-items-center overflow-hidden rounded-2xl border border-border bg-white sm:w-32">
                {product.image_url ? (
                  <img src={product.image_url} alt={`Imagem de ${product.name}`} className="h-full w-full object-contain p-2" decoding="async" referrerPolicy="no-referrer" />
                ) : (
                  <Package className="h-10 w-10 text-muted-foreground/40" aria-hidden="true" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${product.status === 'ativo' ? 'bg-accent/10 text-accent' : 'bg-muted text-muted-foreground'}`}>
                      {product.status === 'ativo' ? 'Ativo' : 'Inativo'}
                    </span>
                    <h1 id="product-title" className="mt-2 break-words text-2xl font-bold tracking-tight sm:text-3xl">{product.name}</h1>
                    <p className="mt-1 text-sm text-muted-foreground">{product.category || 'Sem categoria'}</p>
                  </div>
                  <button type="button" onClick={() => setShowEdit(true)} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-bold text-accent-foreground hover:bg-accent/90 sm:w-auto">
                    <Edit className="h-4 w-4" aria-hidden="true" /> Editar produto
                  </button>
                </div>

                <dl className="mt-5 grid gap-x-6 gap-y-4 border-t border-border pt-5 text-sm sm:grid-cols-2">
                  <Detail label="Unidade" value={product.unit || 'Não informada'} />
                  <Detail label="Estoque" value={`${Number(product.quantity || 0).toLocaleString('pt-BR')} ${product.unit === 'peso' ? 'kg' : 'un.'}`} alert={Number(product.quantity || 0) <= 0} />
                  <Detail label="Preço de venda" value={formatCurrency(product.sale_price)} emphasis />
                  <Detail label="Preço de custo" value={product.cost_price !== null && product.cost_price !== '' ? formatCurrency(product.cost_price) : 'Não informado'} />
                  <Detail label="Código de barras" value={product.barcode || 'Não informado'} mono />
                  <Detail label="Código interno" value={product.internal_code || 'Não informado'} mono />
                </dl>
              </div>
            </div>
          </section>

          <section className="surface-card p-4 sm:p-6" aria-labelledby="audit-title">
            <div className="mb-5 flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent/10 text-accent"><History className="h-5 w-5" aria-hidden="true" /></div>
              <div><h2 id="audit-title" className="font-bold">Histórico de alterações</h2><p className="text-xs text-muted-foreground">Até 50 registros mais recentes</p></div>
            </div>
            {!audits.length ? (
              <EmptyState className="min-h-40 border-0 bg-muted/20" icon={History} title="Nenhuma alteração registrada" description="As próximas mudanças neste produto aparecerão aqui." />
            ) : (
              <ol className="space-y-3">
                {audits.map(audit => (
                  <li key={audit.id} className="relative rounded-xl border border-border bg-muted/15 p-4 pl-5 before:absolute before:bottom-4 before:left-0 before:top-4 before:w-1 before:rounded-r before:bg-accent/60">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                      <strong className="text-sm">{audit.field_changed}</strong>
                      <time className="text-xs text-muted-foreground" dateTime={audit.created_date}>{formatDateTime(audit.created_date)}</time>
                    </div>
                    <p className="mt-2 break-words text-sm text-muted-foreground">De <span className="font-semibold">“{audit.previous_value || 'vazio'}”</span> para <span className="font-semibold text-foreground">“{audit.new_value || 'vazio'}”</span></p>
                    <p className="mt-1 text-xs text-muted-foreground">Por {audit.user_name || 'Usuário não identificado'} · {audit.change_origin || 'Alteração manual'}{audit.sale_number ? ` · Venda #${audit.sale_number}` : ''}</p>
                    {audit.observation && <p className="mt-2 text-xs italic text-muted-foreground">{audit.observation}</p>}
                  </li>
                ))}
              </ol>
            )}
          </section>
        </>
      )}

      {showEdit && product && (
        <ProductForm
          product={product}
          categories={DEFAULT_PRODUCT_CATEGORIES}
          user={user}
          onSave={() => { setShowEdit(false); load(); }}
          onClose={() => setShowEdit(false)}
        />
      )}
    </div>
  );
}

function Detail({ label, value, emphasis = false, alert = false, mono = false }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold text-muted-foreground">{label}</dt>
      <dd className={`mt-1 break-words font-semibold ${emphasis ? 'text-base text-accent' : ''} ${alert ? 'text-destructive' : ''} ${mono ? 'font-mono text-xs' : ''}`}>{value}</dd>
    </div>
  );
}
