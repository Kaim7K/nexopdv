import React, { useEffect, useState } from 'react';
import { Check, ExternalLink, Loader2, Trash2, X } from 'lucide-react';
import { nexoApi } from '@/api/nexoApi';
import { generateInternalCode } from '@/lib/helpers';
import { toast } from 'react-hot-toast';
import { openGoogleImages } from '@/lib/google-images';
import { readClipboardImageUrl, watchClipboardForImageUrl } from '@/lib/clipboard-image-url';
import { standardizeProductName } from '@/lib/product-name';

export default function QuickProductModal({ barcode, onSave, onClose }) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [identifying, setIdentifying] = useState(false);
  const clipboardCleanupRef = React.useRef(null);

  useEffect(() => {
    if (!/^\d{6,14}$/.test(String(barcode || ''))) return;
    let active = true;
    setIdentifying(true);
    nexoApi.products.lookupBarcode(barcode).then(result => {
      if (!active || !result.found) return;
      setName(standardizeProductName(result.product.name, result.product));
      setImageUrl(result.product.image_url || '');
      toast.success('Produto identificado pelo código de barras.');
    }).catch(() => {}).finally(() => active && setIdentifying(false));
    return () => { active = false; };
  }, [barcode]);

  useEffect(() => () => {
    clipboardCleanupRef.current?.();
    clipboardCleanupRef.current = null;
  }, []);

  const armClipboardPaste = () => {
    clipboardCleanupRef.current?.();
    clipboardCleanupRef.current = watchClipboardForImageUrl(url => {
      setImageUrl(url);
      toast.success('URL da imagem colada automaticamente.');
    });
  };

  const pasteImageUrl = async () => {
    try {
      const url = await readClipboardImageUrl();
      setImageUrl(url);
      toast.success('URL da imagem colada.');
    } catch (error) {
      toast.error(error.message || 'Nao foi possivel colar a URL da imagem.');
    }
  };



  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Nome do produto é obrigatório.');
      return;
    }
    setSaving(true);
    try {
      const product = await nexoApi.entities.Product.create({
        name: name.trim(),
        barcode: barcode || '',
        internal_code: generateInternalCode(),
        image_url: imageUrl || '',
        sale_price: Number.parseFloat(price) || 0,
        cost_price: null,
        quantity: 0,
        unit: 'unidade',
        status: 'ativo',
        category: '',
      });
      onSave(product);
    } catch (error) {
      toast.error(error.message || 'Erro ao cadastrar produto.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="text-lg font-bold">Cadastro rápido</h2>
            <p className="text-xs text-muted-foreground">Pesquise no Google, copie o endereço da imagem e cole no cadastro.</p>
          </div>
          <button aria-label="Fechar" onClick={onClose} className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>

        <div className="space-y-4 p-5">
          {barcode && (
            <div>
              <label className="text-xs font-medium text-muted-foreground">Código de barras</label>
              <input type="text" value={barcode} readOnly className="mt-1 w-full rounded-lg border border-border bg-muted px-3 py-2.5 font-mono text-sm" />
            </div>
          )}
          <div>
            <label className="text-xs font-medium text-muted-foreground">Nome do produto *</label>
            <input
              type="text"
              value={name}
              onChange={event => setName(event.target.value)}
              autoFocus
              placeholder={identifying ? 'Identificando produto...' : 'Digite o nome do produto'}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              onKeyDown={event => event.key === 'Enter' && handleSave()}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Preço de venda</label>
            <input type="number" min="0" step="0.01" value={price} onChange={event => setPrice(event.target.value)} placeholder="0,00" className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
          </div>

          <section className="space-y-2 rounded-xl border border-border bg-muted/20 p-3">
            <div className="flex items-center gap-3">
              <div className="grid h-16 w-16 flex-none place-items-center overflow-hidden rounded-lg border border-border bg-white">
                {imageUrl ? <img src={imageUrl} alt={name || 'Produto'} className="h-full w-full object-contain p-1" referrerPolicy="no-referrer" /> : <span className="text-[10px] text-muted-foreground">Sem imagem</span>}
              </div>
              <div className="min-w-0 flex-1">
                <div className="grid gap-2 sm:grid-cols-2">
                  <button type="button" onClick={() => { try { openGoogleImages({ barcode, productName: name }); armClipboardPaste(); } catch (error) { toast.error(error.message); } }} disabled={!barcode && !name.trim()} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 text-sm font-semibold hover:bg-muted disabled:opacity-40">
                    <ExternalLink className="h-4 w-4" /> Pesquisar no Google Imagens
                  </button>
                  <button type="button" onClick={pasteImageUrl} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 text-sm font-semibold hover:bg-muted">
                    <Check className="h-4 w-4" /> Colar URL
                  </button>
                </div>
                <p className="mt-1 text-[10px] leading-4 text-muted-foreground">A pesquisa abre em outra aba sem filtro de cor de fundo. Se você copiar a URL da imagem e voltar para cá, o campo tenta preencher sozinho.</p>
              </div>
              {imageUrl && <button type="button" aria-label="Remover imagem" onClick={() => setImageUrl('')} className="rounded-lg p-2 text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></button>}
            </div>
            <label className="block text-xs font-medium text-muted-foreground">URL da imagem</label>
            <input type="url" value={imageUrl} onChange={event => setImageUrl(event.target.value)} placeholder="Cole aqui o endereço https:// da imagem" className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
          </section>
        </div>

        <div className="flex gap-2 border-t border-border px-5 py-4">
          <button onClick={onClose} className="min-h-11 rounded-xl border border-border px-4 text-sm font-semibold hover:bg-muted">Cancelar</button>
          <button onClick={handleSave} disabled={saving || !name.trim()} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-bold text-accent-foreground hover:bg-accent/90 disabled:bg-muted disabled:text-muted-foreground">
            {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />} Salvar e adicionar
          </button>
        </div>
      </div>

    </div>
  );
}
