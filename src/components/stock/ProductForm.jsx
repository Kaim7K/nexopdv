import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, CopyPlus, ExternalLink, ImageIcon, Loader2, Pencil, Save, ScanSearch, Sparkles, Trash2, X } from 'lucide-react';
import { nexoApi } from '@/api/nexoApi';
import { generateInternalCode } from '@/lib/helpers';
import { toast } from 'react-hot-toast';
import ImageUploadField from '@/components/ImageUploadField';
import { openGoogleImages } from '@/lib/google-images';
import { readClipboardImageUrl, watchClipboardForImageUrl } from '@/lib/clipboard-image-url';
import { categoriesToStorageValue, formatProductCategories, mergeProductCategories, parseProductCategories, removeProductCategory, upsertProductCategory } from '@/lib/product-categories';
import { standardizeProductName } from '@/lib/product-name';

const EMPTY_FORM = {
  name: '',
  category: '',
  barcode: '',
  internal_code: '',
  image_url: '',
  sale_price: '',
  cost_price: '',
  quantity: '',
  unit: 'unidade',
  status: 'ativo',
};

export default function ProductForm({ product = null, duplicateSource = null, categories = [], user, onSave, onClose }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [imageChanged, setImageChanged] = useState(false);
  const [identifying, setIdentifying] = useState(false);
  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false);
  const [categorySearch, setCategorySearch] = useState('');
  const [categoryDraft, setCategoryDraft] = useState('');
  const [editingCategory, setEditingCategory] = useState('');
  const [savedCategoryOptions, setSavedCategoryOptions] = useState(() => mergeProductCategories(categories));
  const clipboardCleanupRef = React.useRef(null);
  const categoryOptions = useMemo(() => mergeProductCategories(categories, savedCategoryOptions), [categories, savedCategoryOptions]);
  const filteredCategories = useMemo(() => {
    const query = String(categorySearch || '').trim().toLowerCase();
    return query ? categoryOptions.filter(category => category.toLowerCase().includes(query)) : categoryOptions;
  }, [categoryOptions, categorySearch]);

  const isEditing = Boolean(product);
  const isDuplicating = !isEditing && Boolean(duplicateSource);
  const titleId = 'product-form-title';

  const closeForm = useCallback(() => {
    if (!saving) onClose();
  }, [onClose, saving]);

  useEffect(() => {
    const onKeyDown = event => {
      if (event.key === 'Escape' && !saving) closeForm();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [closeForm, saving]);

  useEffect(() => {
    if (product) {
      setImageChanged(false);
      setForm({
        name: product.name || '',
        category: product.category || '',
        barcode: product.barcode || '',
        internal_code: product.internal_code || generateInternalCode(),
        image_url: product.image_url || '',
        sale_price: product.sale_price ?? '',
        cost_price: product.cost_price ?? '',
        quantity: product.quantity ?? '',
        unit: product.unit || 'unidade',
        status: product.status || 'ativo',
      });
      return;
    }
    if (duplicateSource) {
      setImageChanged(true);
      setForm({
        name: `${duplicateSource.name || 'Produto'} - Cópia`,
        category: duplicateSource.category || '',
        barcode: '',
        internal_code: generateInternalCode(),
        image_url: duplicateSource.image_url || '',
        sale_price: duplicateSource.sale_price ?? '',
        cost_price: duplicateSource.cost_price ?? '',
        quantity: '0',
        unit: duplicateSource.unit || 'unidade',
        status: duplicateSource.status || 'ativo',
      });
      return;
    }
    setImageChanged(false);
    setForm({ ...EMPTY_FORM, internal_code: generateInternalCode() });
  }, [product, duplicateSource]);

  useEffect(() => {
    setSavedCategoryOptions(mergeProductCategories(categories));
  }, [categories]);

  useEffect(() => () => {
    clipboardCleanupRef.current?.();
    clipboardCleanupRef.current = null;
  }, []);

  const handleChange = (field, value) => {
    if (field === 'image_url') setImageChanged(true);
    setForm(previous => ({ ...previous, [field]: value }));
  };

  const syncCategories = async nextCategories => {
    const normalized = formatProductCategories(nextCategories);
    setSavedCategoryOptions(normalized);
    try {
      const existing = await nexoApi.entities.SystemConfig.list();
      const current = existing.find(item => item.key === 'product_categories');
      const value = categoriesToStorageValue(normalized);
      if (current?.id) await nexoApi.entities.SystemConfig.update(current.id, { value });
      else await nexoApi.entities.SystemConfig.create({ key: 'product_categories', value, label: 'Categorias de produtos' });
      window.dispatchEvent(new CustomEvent('nexo:config-updated', { detail: { product_categories: value } }));
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
    setForm(previous => ({ ...previous, category: next }));
    setCategoryDraft('');
    setEditingCategory('');
  };

  const deleteCategory = async category => {
    const nextOptions = removeProductCategory(categoryOptions, category);
    if (nextOptions.length === categoryOptions.length) {
      toast.error('Não foi possível remover esta categoria.');
      return;
    }
    await syncCategories(nextOptions);
    if (form.category === category) setForm(previous => ({ ...previous, category: '' }));
    if (editingCategory === category) {
      setEditingCategory('');
      setCategoryDraft('');
    }
  };

  const editCategory = category => {
    setEditingCategory(category);
    setCategoryDraft(category);
    setCategoryMenuOpen(true);
    setCategorySearch('');
  };

  const armClipboardPaste = () => {
    clipboardCleanupRef.current?.();
    clipboardCleanupRef.current = watchClipboardForImageUrl(url => {
      setForm(previous => ({ ...previous, image_url: url }));
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
    const standardized = standardizeProductName(catalog.name || form.name, catalog);
    if (!standardized) return toast.error('Digite um nome para padronizar.');
    setForm(previous => ({
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
      if (!result.found) return toast('Produto não encontrado no catálogo. Você pode preencher manualmente.');
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



  const validate = () => {
    if (!form.name.trim()) return 'Nome é obrigatório.';
    if (form.sale_price === '' || Number(form.sale_price) < 0) return 'Informe um preço de venda válido.';
    if (form.quantity !== '' && Number(form.quantity) < 0) return 'A quantidade não pode ser negativa.';
    return '';
  };

  const payload = () => {
    const data = {
      name: form.name.trim(),
      category: form.category.trim(),
      barcode: form.barcode.trim(),
      internal_code: form.internal_code,
      sale_price: Number.parseFloat(form.sale_price) || 0,
      cost_price: form.cost_price === '' ? null : Number.parseFloat(form.cost_price),
      quantity: form.quantity === '' ? 0 : Number.parseFloat(form.quantity),
      unit: form.unit,
      status: form.status,
    };
    if (!isEditing || imageChanged || !product?.image_is_inline) data.image_url = form.image_url || '';
    return data;
  };

  const saveProduct = async ({ duplicateAfter = false } = {}) => {
    const invalid = validate();
    if (invalid) {
      toast.error(invalid);
      return;
    }
    setSaving(true);
    try {
      const data = payload();
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
          action_type: isDuplicating ? 'produto_duplicado' : 'produto_cadastrado',
          entity_type: 'product',
          entity_id: saved.id,
          user_id: user.id,
          user_name: user.full_name || user.email,
          description: isDuplicating ? `Produto "${data.name}" criado como cópia` : `Produto "${data.name}" cadastrado`,
          details: JSON.stringify(data),
        });
        toast.success(isDuplicating ? 'Produto duplicado.' : 'Produto criado.');
      }

      onSave(saved, { keepOpen: duplicateAfter });
      if (duplicateAfter) {
        setForm({
          ...data,
          name: `${data.name} - Cópia`,
          barcode: '',
          internal_code: generateInternalCode(),
          sale_price: String(data.sale_price ?? ''),
          cost_price: String(data.cost_price ?? ''),
          quantity: '0',
        });
        toast.success('Primeiro produto criado. Ajuste a cópia e clique em Criar.');
      }
    } catch (error) {
      toast.error(error.message || 'Erro ao salvar produto.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-3 sm:p-4" role="presentation">
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="flex max-h-[94dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4 sm:px-6">
          <div>
            <h2 id={titleId} className="text-lg font-bold">{isEditing ? 'Editar produto' : isDuplicating ? 'Duplicar produto' : 'Criar produto'}</h2>
            <p className="text-xs text-muted-foreground">
              {isDuplicating ? 'Código de barras e quantidade foram zerados para evitar duplicidade.' : 'Use o código de barras ou o nome para pesquisar a imagem no Google.'}
            </p>
          </div>
          <button type="button" aria-label="Fechar cadastro de produto" onClick={closeForm} disabled={saving} className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"><X className="h-5 w-5" /></button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5 sm:p-6">
          <section className="flex flex-col gap-4 rounded-xl border border-border bg-muted/20 p-4 sm:flex-row">
            <div className="grid h-32 w-32 flex-shrink-0 place-items-center overflow-hidden rounded-xl border border-border bg-white">
              {form.image_url ? <img src={form.image_url} alt={form.name || 'Produto'} className="h-full w-full object-contain p-2" referrerPolicy="no-referrer" /> : <ImageIcon className="h-10 w-10 text-muted-foreground/40" />}
            </div>
            <div className="flex flex-1 flex-col justify-center gap-2">
              <ImageUploadField value={form.image_url} onChange={value => handleChange('image_url', value)} kind="product" scopeId={user?.market_id} label="Imagem do produto" name={form.name || form.barcode || 'produto'} previewClassName="hidden" />
              <div className="grid gap-2 sm:grid-cols-2">
                <button type="button" onClick={openImageSearch} disabled={!form.barcode.trim() && !form.name.trim()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40">
                  <ExternalLink className="h-5 w-5" />
                  Buscar no Google Imagens
                </button>
                <button type="button" onClick={pasteImageUrl} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold hover:bg-muted">
                  <CopyPlus className="h-5 w-5" />
                  Colar URL
                </button>
              </div>
              <p className="text-[11px] leading-4 text-muted-foreground">A pesquisa abre em outra aba já em Imagens, sem filtro de cor de fundo. Se você copiar a URL da imagem e voltar para cá, o campo tenta preencher sozinho.</p>
              {form.image_url && (
                <button type="button" onClick={() => handleChange('image_url', '')} className="inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-destructive hover:bg-destructive/10">
                  <Trash2 className="h-4 w-4" /> Remover imagem
                </button>
              )}
            </div>
          </section>

          <div>
            <label htmlFor="product-name" className="text-xs font-medium text-muted-foreground">Nome do produto *</label>
            <div className="mt-1 flex gap-2">
              <input id="product-name" type="text" required value={form.name} onChange={event => handleChange('name', event.target.value)} autoFocus placeholder="Ex.: Leite líquido - Marca - 3L" className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
              <button type="button" onClick={() => standardizeName()} title="Padronizar nome" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-accent px-3 text-sm font-bold text-accent hover:bg-accent/10"><Sparkles className="h-4 w-4" /><span className="hidden sm:inline">Padronizar</span></button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="relative">
              <label htmlFor="product-category" className="text-xs font-medium text-muted-foreground">Categoria</label>
              <button
                type="button"
                onClick={() => setCategoryMenuOpen(open => !open)}
                className="mt-1 flex h-11 w-full items-center justify-between rounded-lg border border-border bg-background px-3 text-sm text-left focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <span className={form.category ? 'text-foreground' : 'text-muted-foreground'}>{form.category || 'Selecione uma categoria'}</span>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </button>
              {categoryMenuOpen && (
                <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
                  <div className="sticky top-0 border-b border-border bg-card p-2">
                    <input
                      value={categorySearch}
                      onChange={event => setCategorySearch(event.target.value)}
                      placeholder="Buscar categoria..."
                      className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                    />
                  </div>
                  <div className="max-h-[420px] overflow-y-auto p-2">
                    <button type="button" onClick={() => { handleChange('category', ''); setCategoryMenuOpen(false); }} className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm hover:bg-muted">
                      <span className="text-muted-foreground">Selecione uma categoria</span>
                      {!form.category && <Check className="h-4 w-4 text-accent" />}
                    </button>
                    {filteredCategories.map(category => (
                      <div key={category} className="group flex items-center gap-1 rounded-xl px-2 py-1.5 hover:bg-muted/70">
                        <button type="button" onClick={() => { handleChange('category', category); setCategoryMenuOpen(false); }} className="min-w-0 flex-1 rounded-lg px-2 py-2 text-left text-sm">
                          <span className="block truncate">{category}</span>
                        </button>
                        <button type="button" onClick={() => editCategory(category)} className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground hover:bg-background hover:text-foreground" aria-label={`Editar ${category}`} title="Editar categoria">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button type="button" onClick={() => deleteCategory(category)} className="grid h-9 w-9 place-items-center rounded-lg text-destructive hover:bg-destructive/10" aria-label={`Excluir ${category}`} title="Excluir categoria">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-border bg-muted/20 p-3">
                    <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{editingCategory ? 'Editar categoria' : 'Nova categoria'}</label>
                    <div className="mt-2 flex gap-2">
                      <input value={categoryDraft} onChange={event => setCategoryDraft(event.target.value)} placeholder={editingCategory || 'Digite a categoria'} className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20" />
                      <button type="button" onClick={commitCategory} className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-600 px-3 text-sm font-bold text-white hover:bg-emerald-700">
                        <Save className="h-4 w-4" /> {editingCategory ? 'Salvar' : 'Adicionar'}
                      </button>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      {editingCategory && <button type="button" onClick={() => { setEditingCategory(''); setCategoryDraft(''); }} className="text-xs font-semibold text-muted-foreground hover:text-foreground">Cancelar edição</button>}
                      {categorySearch && <button type="button" onClick={() => setCategorySearch('')} className="ml-auto text-xs font-semibold text-muted-foreground hover:text-foreground">Limpar busca</button>}
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div>
              <label htmlFor="product-unit" className="text-xs font-medium text-muted-foreground">Unidade de venda</label>
              <select id="product-unit" value={form.unit} onChange={event => handleChange('unit', event.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent">
                <option value="unidade">Unidade</option>
                <option value="peso">Peso (kg)</option>
                <option value="pacote">Pacote</option>
              </select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="product-barcode" className="text-xs font-medium text-muted-foreground">Código de barras</label>
              <div className="mt-1 flex gap-2">
                <input id="product-barcode" type="text" value={form.barcode} onChange={event => handleChange('barcode', event.target.value.replace(/\D/g, ''))} onBlur={identifyBarcode} inputMode="numeric" autoComplete="off" placeholder="Escaneie ou digite o código" className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2.5 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
                <button type="button" onClick={identifyBarcode} disabled={identifying || !/^\d{6,14}$/.test(form.barcode)} aria-label="Identificar produto pelo código de barras" title="Identificar produto" className="grid min-h-11 w-11 place-items-center rounded-lg border border-border hover:bg-muted disabled:opacity-40">{identifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanSearch className="h-4 w-4" />}</button>
              </div>
            </div>
            <div>
              <label htmlFor="product-internal-code" className="text-xs font-medium text-muted-foreground">Código interno</label>
              <input id="product-internal-code" type="text" value={form.internal_code} readOnly className="mt-1 w-full rounded-lg border border-border bg-muted px-3 py-2.5 font-mono text-sm text-muted-foreground" />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label htmlFor="product-sale-price" className="text-xs font-medium text-muted-foreground">Preço de venda *</label>
              <input id="product-sale-price" type="number" required min="0" step="0.01" value={form.sale_price} onChange={event => handleChange('sale_price', event.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
            </div>
            <div>
              <label htmlFor="product-cost-price" className="text-xs font-medium text-muted-foreground">Preço de custo</label>
              <input id="product-cost-price" type="number" min="0" step="0.01" value={form.cost_price} onChange={event => handleChange('cost_price', event.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
            </div>
            <div>
              <label htmlFor="product-quantity" className="text-xs font-medium text-muted-foreground">Quantidade</label>
              <input id="product-quantity" type="number" min="0" step="0.001" value={form.quantity} onChange={event => handleChange('quantity', event.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
            </div>
          </div>

          <div>
            <label htmlFor="product-status" className="text-xs font-medium text-muted-foreground">Status</label>
            <select id="product-status" value={form.status} onChange={event => handleChange('status', event.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent">
              <option value="ativo">Ativo</option>
              <option value="inativo">Inativo</option>
            </select>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-border px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
          <button type="button" onClick={closeForm} disabled={saving} className="min-h-11 rounded-xl border border-border px-4 text-sm font-semibold hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40">Cancelar</button>
          {!isEditing && (
            <button type="button" onClick={() => saveProduct({ duplicateAfter: true })} disabled={saving} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-accent px-4 text-sm font-bold text-accent hover:bg-accent/10 disabled:opacity-40">
              <CopyPlus className="h-5 w-5" /> Criar e duplicar
            </button>
          )}
          <button type="button" onClick={() => saveProduct()} disabled={saving} className="inline-flex min-h-11 min-w-36 items-center justify-center gap-2 rounded-xl bg-accent px-5 text-sm font-bold text-accent-foreground hover:bg-accent/90 disabled:bg-muted disabled:text-muted-foreground">
            {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
            {saving ? 'Salvando...' : isEditing ? 'Salvar alterações' : 'Criar'}
          </button>
        </div>
      </div>

    </div>
  );
}
