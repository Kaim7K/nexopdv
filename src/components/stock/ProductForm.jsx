import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CopyPlus,
  ExternalLink,
  ImageIcon,
  Loader2,
  Save,
  ScanSearch,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { nexoApi } from '@/api/nexoApi';
import { formatCurrencyInput } from '@/lib/helpers';
import { toast } from 'react-hot-toast';
import ImageUploadField from '@/components/ImageUploadField';
import ProductCategoryField from '@/components/stock/ProductCategoryField';
import { openGoogleImages } from '@/lib/google-images';
import {
  readClipboardImageUrl,
  watchClipboardForImageUrl,
} from '@/lib/clipboard-image-url';
import {
  categoriesToStorageValue,
  formatProductCategories,
  mergeProductCategories,
  removeProductCategory,
  upsertProductCategory,
} from '@/lib/product-categories';
import { standardizeProductName } from '@/lib/product-name';
import { useModalBehavior } from '@/hooks/use-modal-behavior';
import { hasMarketFeature } from '@/lib/market-modules';
import {
  EMPTY_PRODUCT_FORM,
  createEmptyProductForm,
  duplicateProductToForm,
  productFormPayload,
  productToForm,
  validateProductForm,
} from '@/lib/product-form-helpers';

export default function ProductForm({
  product = null,
  duplicateSource = null,
  categories = [],
  user,
  onSave,
  onClose,
}) {
  const [form, setForm] = useState(EMPTY_PRODUCT_FORM);
  const [saving, setSaving] = useState(false);
  const [imageChanged, setImageChanged] = useState(false);
  const [identifying, setIdentifying] = useState(false);
  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false);
  const [categorySearch, setCategorySearch] = useState('');
  const [categoryDraft, setCategoryDraft] = useState('');
  const [editingCategory, setEditingCategory] = useState('');
  const [savedCategoryOptions, setSavedCategoryOptions] = useState(() =>
    mergeProductCategories(categories),
  );
  const clipboardCleanupRef = React.useRef(null);
  const categoryOptions = useMemo(
    () => mergeProductCategories(categories, savedCategoryOptions),
    [categories, savedCategoryOptions],
  );
  const filteredCategories = useMemo(() => {
    const query = String(categorySearch || '')
      .trim()
      .toLowerCase();
    return query
      ? categoryOptions.filter((category) =>
          category.toLowerCase().includes(query),
        )
      : categoryOptions;
  }, [categoryOptions, categorySearch]);

  const isEditing = Boolean(product);
  const isDuplicating = !isEditing && Boolean(duplicateSource);
  const titleId = 'product-form-title';
  const canUploadProductImage = hasMarketFeature(user, 'product_image_upload');
  const canSearchProductImage =
    canUploadProductImage && hasMarketFeature(user, 'automatic_image_search');

  const closeForm = useCallback(() => {
    if (!saving) onClose();
  }, [onClose, saving]);

  const modalRef = useModalBehavior({ onClose: closeForm, disabled: saving });

  useEffect(() => {
    if (product) {
      setImageChanged(false);
      setForm(productToForm(product));
      return;
    }
    if (duplicateSource) {
      setImageChanged(true);
      setForm(duplicateProductToForm(duplicateSource));
      return;
    }
    setImageChanged(false);
    setForm(createEmptyProductForm());
  }, [product, duplicateSource]);

  useEffect(() => {
    setSavedCategoryOptions(mergeProductCategories(categories));
  }, [categories]);

  useEffect(
    () => () => {
      clipboardCleanupRef.current?.();
      clipboardCleanupRef.current = null;
    },
    [],
  );

  const handleChange = (field, value) => {
    if (field === 'image_url') setImageChanged(true);
    setForm((previous) => ({ ...previous, [field]: value }));
  };

  const syncCategories = async (nextCategories) => {
    const normalized = formatProductCategories(nextCategories);
    setSavedCategoryOptions(normalized);
    try {
      const existing = await nexoApi.entities.SystemConfig.list();
      const current = existing.find(
        (item) => item.key === 'product_categories',
      );
      const value = categoriesToStorageValue(normalized);
      if (current?.id)
        await nexoApi.entities.SystemConfig.update(current.id, { value });
      else
        await nexoApi.entities.SystemConfig.create({
          key: 'product_categories',
          value,
          label: 'Categorias de produtos',
        });
      window.dispatchEvent(
        new CustomEvent('nexo:config-updated', {
          detail: { product_categories: value },
        }),
      );
    } catch (error) {
      toast.error(error.message || 'Nao foi possivel atualizar as categorias.');
    }
  };

  const commitCategory = async () => {
    const next = String(categoryDraft || '').trim();
    if (!next) return toast.error('Digite o nome da categoria.');
    const current = categoryOptions;
    const nextOptions = upsertProductCategory(current, editingCategory, next);
    await syncCategories(nextOptions);
    setForm((previous) => ({ ...previous, category: next }));
    setCategoryDraft('');
    setEditingCategory('');
  };

  const deleteCategory = async (category) => {
    const nextOptions = removeProductCategory(categoryOptions, category);
    if (nextOptions.length === categoryOptions.length) {
      toast.error('Não foi possível remover esta categoria.');
      return;
    }
    await syncCategories(nextOptions);
    if (form.category === category)
      setForm((previous) => ({ ...previous, category: '' }));
    if (editingCategory === category) {
      setEditingCategory('');
      setCategoryDraft('');
    }
  };

  const editCategory = (category) => {
    setEditingCategory(category);
    setCategoryDraft(category);
    setCategoryMenuOpen(true);
    setCategorySearch('');
  };

  const armClipboardPaste = () => {
    clipboardCleanupRef.current?.();
    clipboardCleanupRef.current = watchClipboardForImageUrl((url) => {
      setForm((previous) => ({ ...previous, image_url: url }));
      setImageChanged(true);
      toast.success('URL da imagem colada automaticamente.');
    });
  };

  const openImageSearch = () => {
    try {
      openGoogleImages({ barcode: form.barcode, productName: form.name });
      armClipboardPaste();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const pasteImageUrl = async () => {
    try {
      const url = await readClipboardImageUrl();
      handleChange('image_url', url);
      toast.success('URL da imagem colada.');
    } catch (error) {
      toast.error(error.message || 'Nao foi possivel colar a URL da imagem.');
    }
  };

  const standardizeName = (catalog = {}) => {
    const standardized = standardizeProductName(
      catalog.name || form.name,
      catalog,
    );
    if (!standardized) return toast.error('Digite um nome para padronizar.');
    setForm((previous) => ({
      ...previous,
      name: standardized,
      image_url: previous.image_url || catalog.image_url || '',
    }));
    if (catalog.image_url) setImageChanged(true);
  };

  const identifyBarcode = async () => {
    const barcode = form.barcode.replace(/\D/g, '');
    if (!/^\d{6,14}$/.test(barcode) || identifying) return;
    setIdentifying(true);
    try {
      const result = await nexoApi.products.lookupBarcode(barcode);
      if (!result.found)
        return toast(
          'Produto não encontrado no catálogo. Você pode preencher manualmente.',
        );
      if (form.name.trim()) {
        standardizeName({ ...result.product, name: form.name });
      } else {
        standardizeName(result.product);
      }
      toast.success('Produto identificado e nome padronizado.');
    } catch (error) {
      toast.error(error.message || 'Não foi possível identificar o produto.');
    } finally {
      setIdentifying(false);
    }
  };

  const saveProduct = async ({ duplicateAfter = false } = {}) => {
    const invalid = validateProductForm(form);
    if (invalid) {
      toast.error(invalid);
      return;
    }
    setSaving(true);
    try {
      const data = productFormPayload({
        form,
        canUploadProductImage,
        isEditing,
        imageChanged,
        product,
      });
      let saved;
      if (isEditing) {
        if (Number(product.sale_price) !== Number(data.sale_price)) {
          await nexoApi.entities.ProductAudit.create({
            product_id: product.id,
            product_name: data.name,
            field_changed: 'sale_price',
            previous_value: String(product.sale_price),
            new_value: String(data.sale_price),
            user_id: user.id,
            user_name: user.full_name || user.email,
            change_origin: 'gerenciamento_estoque',
            observation: 'Alteração no modal de produto',
          });
        }
        saved = await nexoApi.entities.Product.update(product.id, data);
        toast.success('Produto atualizado.');
      } else {
        saved = await nexoApi.entities.Product.create(data);
        await nexoApi.entities.GeneralAudit.create({
          action_type: isDuplicating
            ? 'produto_duplicado'
            : 'produto_cadastrado',
          entity_type: 'product',
          entity_id: saved.id,
          user_id: user.id,
          user_name: user.full_name || user.email,
          description: isDuplicating
            ? `Produto "${data.name}" criado como cópia`
            : `Produto "${data.name}" cadastrado`,
          details: JSON.stringify(data),
        });
        toast.success(isDuplicating ? 'Produto duplicado.' : 'Produto criado.');
      }

      onSave(saved, { keepOpen: duplicateAfter });
      if (duplicateAfter) {
        setForm(duplicateProductToForm(data));
        toast.success(
          'Primeiro produto criado. Ajuste a cópia e clique em Criar.',
        );
      }
    } catch (error) {
      toast.error(error.message || 'Erro ao salvar produto.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="modal-overlay"
      role="presentation"
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="modal-panel sm:max-w-3xl lg:max-h-[min(42rem,calc(100dvh-2rem))]"
      >
        <div className="modal-header">
          <div>
            <h2 id={titleId} className="modal-title">
              {isEditing
                ? 'Editar produto'
                : isDuplicating
                  ? 'Duplicar produto'
                  : 'Criar produto'}
            </h2>
            <p className="hidden">
              {isDuplicating
                ? 'Código de barras e quantidade foram zerados para evitar duplicidade.'
                : 'Use o código de barras ou o nome para pesquisar a imagem no Google.'}
            </p>
          </div>
          <button
            type="button"
            aria-label="Fechar cadastro de produto"
            onClick={closeForm}
            disabled={saving}
            className="modal-icon-button disabled:cursor-not-allowed disabled:opacity-40"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="modal-body space-y-2">
          <details className="hidden rounded-lg border border-border bg-muted/10 sm:block">
            <summary className="flex min-h-9 cursor-pointer list-none items-center justify-between gap-3 px-3 text-xs font-bold text-muted-foreground marker:hidden">
              <span>Imagem do produto</span>
              <span className="text-[11px] font-semibold text-accent">editar</span>
            </summary>
          <section className="grid grid-cols-[3rem_minmax(0,1fr)] gap-2 border-t border-border p-2 sm:grid-cols-[3.25rem_minmax(0,1fr)]">
            <div className="grid h-12 w-12 flex-shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-white">
              {form.image_url ? (
                <img
                  src={form.image_url}
                  alt={form.name || 'Produto'}
                  decoding="async"
                  className="h-full w-full object-contain p-2"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <ImageIcon className="h-6 w-6 text-muted-foreground/40" />
              )}
            </div>
            <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5">
              {canUploadProductImage && (
                <ImageUploadField
                  value={form.image_url}
                  onChange={(value) => handleChange('image_url', value)}
                  kind="product"
                  scopeId={user?.market_id}
                  label="Imagem do produto"
                  name={form.name || form.barcode || 'produto'}
                  previewClassName="hidden"
                />
              )}
              <div className="grid gap-1.5 sm:grid-cols-3">
                {canSearchProductImage && (
                  <button
                    type="button"
                    onClick={openImageSearch}
                    aria-label="Buscar no Google Imagens"
                    disabled={!form.barcode.trim() && !form.name.trim()}
                    className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-border px-3 text-sm font-semibold hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Buscar
                  </button>
                )}
                {canUploadProductImage && (
                  <button
                    type="button"
                    onClick={pasteImageUrl}
                    className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-border px-3 text-sm font-semibold hover:bg-muted"
                  >
                    <CopyPlus className="h-4 w-4" />
                    URL
                  </button>
                )}
              </div>
              {canSearchProductImage || canUploadProductImage ? (
                <p className="hidden text-[11px] leading-4 text-muted-foreground">
                  Use a pesquisa ou envie uma imagem conforme os recursos do
                  plano.
                </p>
              ) : (
                <p className="text-[11px] leading-4 text-muted-foreground">
                  Imagens de produtos não estão incluídas neste plano.
                </p>
              )}
              {canUploadProductImage && form.image_url && (
                <button
                  type="button"
                  onClick={() => handleChange('image_url', '')}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4" /> Remover
                </button>
              )}
            </div>
          </section>
          </details>

          <div>
            <label
              htmlFor="product-name"
              className="text-xs font-medium text-muted-foreground"
            >
              Nome do produto *
            </label>
            <div className="mt-1 flex gap-2">
              <input
                id="product-name"
                type="text"
                required
                value={form.name}
                onChange={(event) => handleChange('name', event.target.value)}
                autoFocus
                placeholder="Ex.: Leite líquido - Marca - 3L"
                className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              />
              <button
                type="button"
                onClick={() => standardizeName()}
                title="Padronizar nome"
                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-accent px-3 text-sm font-bold text-accent hover:bg-accent/10"
              >
                <Sparkles className="h-4 w-4" />
                <span className="hidden sm:inline">Padronizar</span>
              </button>
            </div>
          </div>

          <div className="grid gap-2.5 sm:grid-cols-2">
            <ProductCategoryField
              category={form.category}
              open={categoryMenuOpen}
              onOpenChange={setCategoryMenuOpen}
              search={categorySearch}
              onSearchChange={setCategorySearch}
              filteredCategories={filteredCategories}
              draft={categoryDraft}
              onDraftChange={setCategoryDraft}
              editingCategory={editingCategory}
              onEditCategory={editCategory}
              onDeleteCategory={deleteCategory}
              onCommitCategory={commitCategory}
              onCancelEdit={() => {
                setEditingCategory('');
                setCategoryDraft('');
              }}
              onChange={(value) => handleChange('category', value)}
            />
            <div>
              <label
                htmlFor="product-unit"
                className="text-xs font-medium text-muted-foreground"
              >
                Unidade de venda
              </label>
              <select
                id="product-unit"
                value={form.unit}
                onChange={(event) => handleChange('unit', event.target.value)}
                className="mt-1 h-9 w-full rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <option value="unidade">Unidade</option>
                <option value="peso">Peso (kg)</option>
                <option value="pacote">Pacote</option>
              </select>
            </div>
          </div>

          <div className="grid gap-2.5 sm:grid-cols-2">
            <div>
              <label
                htmlFor="product-barcode"
                className="text-xs font-medium text-muted-foreground"
              >
                Código de barras
              </label>
              <div className="mt-1 flex gap-2">
                <input
                  id="product-barcode"
                  type="text"
                  value={form.barcode}
                  onChange={(event) =>
                    handleChange(
                      'barcode',
                      event.target.value.replace(/\D/g, ''),
                    )
                  }
                  onBlur={identifyBarcode}
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="Escaneie ou digite o código"
                  className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                />
                <button
                  type="button"
                  onClick={identifyBarcode}
                  disabled={identifying || !/^\d{6,14}$/.test(form.barcode)}
                  aria-label="Identificar produto pelo código de barras"
                  title="Identificar produto"
                  className="grid h-9 w-9 place-items-center rounded-lg border border-border hover:bg-muted disabled:opacity-40"
                >
                  {identifying ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ScanSearch className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
            <div>
              <label
                htmlFor="product-internal-code"
                className="text-xs font-medium text-muted-foreground"
              >
                Código interno
              </label>
              <input
                id="product-internal-code"
                type="text"
                value={form.internal_code}
                readOnly
                className="mt-1 h-9 w-full rounded-lg border border-border bg-muted px-3 font-mono text-sm text-muted-foreground"
              />
            </div>
          </div>

          <div className="grid gap-2.5 sm:grid-cols-3">
            <div>
              <label
                htmlFor="product-sale-price"
                className="text-xs font-medium text-muted-foreground"
              >
                Preço de venda *
              </label>
              <input
                id="product-sale-price"
                type="text"
                required
                inputMode="numeric"
                value={formatCurrencyInput(form.sale_price)}
                onChange={(event) =>
                  handleChange(
                    'sale_price',
                    event.target.value.replace(/\D/g, ''),
                  )
                }
                className="mt-1 h-9 w-full rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            <div>
              <label
                htmlFor="product-cost-price"
                className="text-xs font-medium text-muted-foreground"
              >
                Preço de custo
              </label>
              <input
                id="product-cost-price"
                type="text"
                inputMode="numeric"
                value={formatCurrencyInput(form.cost_price)}
                onChange={(event) =>
                  handleChange(
                    'cost_price',
                    event.target.value.replace(/\D/g, ''),
                  )
                }
                className="mt-1 h-9 w-full rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            <div>
              <label
                htmlFor="product-quantity"
                className="text-xs font-medium text-muted-foreground"
              >
                Quantidade
              </label>
              <input
                id="product-quantity"
                type="number"
                min="0"
                step="0.001"
                value={form.quantity}
                onChange={(event) =>
                  handleChange('quantity', event.target.value)
                }
                className="mt-1 h-9 w-full rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="product-status"
              className="text-xs font-medium text-muted-foreground"
            >
              Status
            </label>
            <select
              id="product-status"
              value={form.status}
              onChange={(event) => handleChange('status', event.target.value)}
              className="mt-1 h-9 w-full rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="ativo">Ativo</option>
              <option value="inativo">Inativo</option>
            </select>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
          <label className="flex min-h-9 items-center gap-2 rounded-lg border border-border bg-muted/15 px-3 py-1.5">
            <input
              type="checkbox"
              checked={Boolean(form.allow_pdv_price_edit)}
              onChange={(event) =>
                handleChange('allow_pdv_price_edit', event.target.checked)
              }
              className="h-4 w-4 rounded border-border text-accent focus:ring-accent"
            />
            <span>
              <strong className="block text-sm">
                Permitir edição de valor no PDV
              </strong>
              <span className="hidden">
                Use para produtos com preço variável. Por padrão esta opção fica
                desativada.
              </span>
            </span>
          </label>
          <label className="flex min-h-9 items-center gap-2 rounded-lg border border-border bg-muted/15 px-3 py-1.5">
            <input
              type="checkbox"
              checked={Boolean(form.track_stock)}
              onChange={(event) =>
                handleChange('track_stock', event.target.checked)
              }
              className="h-4 w-4 rounded border-border text-accent focus:ring-accent"
            />
            <span>
              <strong className="block text-sm">
                Controlar estoque deste produto
              </strong>
              <span className="hidden">
                Quando desativado, o produto não entra nos alertas nem no
                relatório de reposição.
              </span>
            </span>
          </label>
          </div>
        </div>

        <div className="modal-footer">
          <div className="modal-actions">
          <button
            type="button"
            onClick={closeForm}
            disabled={saving}
            className="modal-button border border-border hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
          >
            Cancelar
          </button>
          {!isEditing && (
            <button
              type="button"
              onClick={() => saveProduct({ duplicateAfter: true })}
              disabled={saving}
              className="modal-button border border-accent text-accent hover:bg-accent/10 disabled:opacity-40"
            >
              <CopyPlus className="h-5 w-5" /> Criar e duplicar
            </button>
          )}
          <button
            type="button"
            onClick={() => saveProduct()}
            disabled={saving}
            className="modal-button modal-actions-primary min-w-36 bg-accent px-5 text-accent-foreground hover:bg-accent/90 disabled:bg-muted disabled:text-muted-foreground"
          >
            {saving ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Save className="h-5 w-5" />
            )}
            {saving ? 'Salvando...' : isEditing ? 'Salvar alterações' : 'Criar'}
          </button>
          </div>
        </div>
      </div>
    </div>
  );
}
