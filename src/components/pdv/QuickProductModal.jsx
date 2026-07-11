import React, { useState } from 'react';
import { Check, Loader2, Search, Trash2, X } from 'lucide-react';
import { nexoApi } from '@/api/nexoApi';
import { generateInternalCode } from '@/lib/helpers';
import { toast } from 'react-hot-toast';
import ProductImageSearch from '@/components/stock/ProductImageSearch';

export default function QuickProductModal({ barcode, onSave, onClose }) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [showImageSearch, setShowImageSearch] = useState(false);
  const [saving, setSaving] = useState(false);



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
            <p className="text-xs text-muted-foreground">Cadastre o produto e escolha uma imagem sem sair desta tela.</p>
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
              placeholder="Digite o nome do produto"
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              onKeyDown={event => event.key === 'Enter' && handleSave()}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Preço de venda</label>
            <input type="number" min="0" step="0.01" value={price} onChange={event => setPrice(event.target.value)} placeholder="0,00" className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
          </div>

          {imageUrl ? (
            <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/20 p-3">
              <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-lg border border-border bg-white">
                <img src={imageUrl} alt={name || 'Produto'} className="h-full w-full object-contain p-1" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold">Imagem selecionada</p>
                <button type="button" onClick={() => setShowImageSearch(true)} className="mt-1 text-xs font-semibold text-accent hover:underline">Trocar imagem</button>
              </div>
              <button type="button" aria-label="Remover imagem" onClick={() => setImageUrl('')} className="rounded-lg p-2 text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></button>
            </div>
          ) : (
            <button type="button" onClick={() => setShowImageSearch(true)} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold hover:bg-muted">
              <Search className="h-5 w-5" /> Buscar imagem do produto
            </button>
          )}
        </div>

        <div className="flex gap-2 border-t border-border px-5 py-4">
          <button onClick={onClose} className="min-h-11 rounded-xl border border-border px-4 text-sm font-semibold hover:bg-muted">Cancelar</button>
          <button onClick={handleSave} disabled={saving || !name.trim()} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-bold text-accent-foreground hover:bg-accent/90 disabled:bg-muted disabled:text-muted-foreground">
            {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />} Salvar e adicionar
          </button>
        </div>
      </div>

      {showImageSearch && (
        <ProductImageSearch
          productName={name}
          onSelect={setImageUrl}
          onClose={() => setShowImageSearch(false)}
        />
      )}
    </div>
  );
}
