import React, { useEffect, useRef, useState } from 'react';
import { CopyPlus, ImageIcon, Loader2, Save, Search, Trash2, Upload, X } from 'lucide-react';
import { upload } from '@vercel/blob/client';
import { nexoApi } from '@/api/nexoApi';
import { generateInternalCode } from '@/lib/helpers';
import { toast } from 'react-hot-toast';
import ProductImageSearch from './ProductImageSearch';

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

const safeFileName = value => String(value || 'produto')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '')
  .slice(0, 60) || 'produto';

export default function ProductForm({ product = null, duplicateSource = null, categories = [], user, onSave, onClose }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [showImageSearch, setShowImageSearch] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileRef = useRef(null);

  const isEditing = Boolean(product);
  const isDuplicating = !isEditing && Boolean(duplicateSource);

  useEffect(() => {
    if (product) {
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
    setForm({ ...EMPTY_FORM, internal_code: generateInternalCode() });
  }, [product, duplicateSource]);

  const handleChange = (field, value) => setForm(previous => ({ ...previous, [field]: value }));

  const uploadImage = async event => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(file.type)) {
      toast.error('Use uma imagem JPG, PNG, WEBP ou AVIF.');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 8 MB.');
      return;
    }
    if (!user?.market_id) {
      toast.error('Não foi possível identificar o mercado para o upload.');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    try {
      const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const pathname = `products/${user.market_id}/${safeFileName(form.name || file.name)}.${extension}`;
      const blob = await upload(pathname, file, {
        access: 'public',
        handleUploadUrl: '/api/media/upload',
        clientPayload: JSON.stringify({ kind: 'product' }),
        contentType: file.type,
        onUploadProgress: progress => setUploadProgress(Math.round(progress.percentage || 0)),
      });
      handleChange('image_url', blob.url);
      toast.success('Imagem enviada.');
    } catch (error) {
      toast.error(error.message || 'Não foi possível enviar a imagem.');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const validate = () => {
    if (!form.name.trim()) return 'Nome é obrigatório.';
    if (form.sale_price === '' || Number(form.sale_price) < 0) return 'Informe um preço de venda válido.';
    if (form.quantity !== '' && Number(form.quantity) < 0) return 'A quantidade não pode ser negativa.';
    return '';
  };

  const payload = () => ({
    name: form.name.trim(),
    category: form.category.trim(),
    barcode: form.barcode.trim(),
    internal_code: form.internal_code,
    image_url: form.image_url || '',
    sale_price: Number.parseFloat(form.sale_price) || 0,
    cost_price: form.cost_price === '' ? null : Number.parseFloat(form.cost_price),
    quantity: form.quantity === '' ? 0 : Number.parseFloat(form.quantity),
    unit: form.unit,
    status: form.status,
  });

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-3 sm:p-4">
      <div className="flex max-h-[94vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4 sm:px-6">
          <div>
            <h2 className="text-lg font-bold">{isEditing ? 'Editar produto' : isDuplicating ? 'Duplicar produto' : 'Criar produto'}</h2>
            <p className="text-xs text-muted-foreground">
              {isDuplicating ? 'Código de barras e quantidade foram zerados para evitar duplicidade.' : 'Cadastre os dados e escolha uma imagem do produto.'}
            </p>
          </div>
          <button aria-label="Fechar" onClick={onClose} className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5 sm:p-6">
          <section className="flex flex-col gap-4 rounded-xl border border-border bg-muted/20 p-4 sm:flex-row">
            <div className="grid h-32 w-32 flex-shrink-0 place-items-center overflow-hidden rounded-xl border border-border bg-white">
              {form.image_url ? <img src={form.image_url} alt={form.name || 'Produto'} className="h-full w-full object-contain p-2" /> : <ImageIcon className="h-10 w-10 text-muted-foreground/40" />}
            </div>
            <div className="flex flex-1 flex-col justify-center gap-2">
              <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-bold text-accent-foreground hover:bg-accent/90 disabled:opacity-50">
                {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
                {uploading ? `Enviando ${uploadProgress}%` : 'Enviar imagem'}
              </button>
              <input ref={fileRef} hidden type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={uploadImage} />
              <button type="button" onClick={() => setShowImageSearch(true)} disabled={!form.barcode.trim() && !form.name.trim()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40">
                <Search className="h-5 w-5" /> Buscar imagem automaticamente
              </button>
              {form.image_url && (
                <button type="button" onClick={() => handleChange('image_url', '')} className="inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-destructive hover:bg-destructive/10">
                  <Trash2 className="h-4 w-4" /> Remover imagem
                </button>
              )}
              <p className="text-[11px] text-muted-foreground">JPG, PNG, WEBP ou AVIF · máximo de 8 MB.</p>
            </div>
          </section>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Nome do produto *</label>
            <input type="text" value={form.name} onChange={event => handleChange('name', event.target.value)} autoFocus className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Categoria</label>
              <input list="product-categories" type="text" value={form.category} onChange={event => handleChange('category', event.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
              <datalist id="product-categories">{categories.map(category => <option key={category} value={category} />)}</datalist>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Unidade de venda</label>
              <select value={form.unit} onChange={event => handleChange('unit', event.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent">
                <option value="unidade">Unidade</option>
                <option value="peso">Peso (kg)</option>
                <option value="pacote">Pacote</option>
              </select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Código de barras</label>
              <input type="text" value={form.barcode} onChange={event => handleChange('barcode', event.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Código interno</label>
              <input type="text" value={form.internal_code} readOnly className="mt-1 w-full rounded-lg border border-border bg-muted px-3 py-2.5 font-mono text-sm text-muted-foreground" />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Preço de venda *</label>
              <input type="number" min="0" step="0.01" value={form.sale_price} onChange={event => handleChange('sale_price', event.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Preço de custo</label>
              <input type="number" min="0" step="0.01" value={form.cost_price} onChange={event => handleChange('cost_price', event.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Quantidade</label>
              <input type="number" min="0" step="0.001" value={form.quantity} onChange={event => handleChange('quantity', event.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Status</label>
            <select value={form.status} onChange={event => handleChange('status', event.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent">
              <option value="ativo">Ativo</option>
              <option value="inativo">Inativo</option>
            </select>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-border px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
          <button type="button" onClick={onClose} className="min-h-11 rounded-xl border border-border px-4 text-sm font-semibold hover:bg-muted">Cancelar</button>
          {!isEditing && (
            <button type="button" onClick={() => saveProduct({ duplicateAfter: true })} disabled={saving || uploading} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-accent px-4 text-sm font-bold text-accent hover:bg-accent/10 disabled:opacity-40">
              <CopyPlus className="h-5 w-5" /> Criar e duplicar
            </button>
          )}
          <button type="button" onClick={() => saveProduct()} disabled={saving || uploading} className="inline-flex min-h-11 min-w-36 items-center justify-center gap-2 rounded-xl bg-accent px-5 text-sm font-bold text-accent-foreground hover:bg-accent/90 disabled:bg-muted disabled:text-muted-foreground">
            {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
            {saving ? 'Salvando...' : isEditing ? 'Salvar alterações' : 'Criar'}
          </button>
        </div>
      </div>

      {showImageSearch && (
        <ProductImageSearch
          barcode={form.barcode}
          productName={form.name}
          category={form.category}
          onSelect={url => handleChange('image_url', url)}
          onClose={() => setShowImageSearch(false)}
        />
      )}
    </div>
  );
}
