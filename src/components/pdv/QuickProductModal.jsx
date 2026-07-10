import React, { useState } from 'react';
import { X, Search, Check, Loader2, ImageIcon } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { generateInternalCode } from '@/lib/helpers';
import { toast } from 'react-hot-toast';

export default function QuickProductModal({ barcode, onSave, onClose }) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [images, setImages] = useState([]);
  const [selectedImage, setSelectedImage] = useState('');
  const [searching, setSearching] = useState(false);
  const [showImages, setShowImages] = useState(false);
  const [saving, setSaving] = useState(false);

  const searchImages = async () => {
    if (!name.trim() && !barcode) {
      toast.error('Digite o nome do produto primeiro');
      return;
    }
    setSearching(true);
    setShowImages(true);
    try {
      const query = barcode || name;
      const res = await fetch(`https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=5`);
      const data = await res.json();
      const found = [];
      if (data.products) {
        data.products.forEach(p => {
          if (p.image_url) found.push({ url: p.image_url, source: 'Open Food Facts' });
          if (p.image_front_url && p.image_front_url !== p.image_url) found.push({ url: p.image_front_url, source: 'Open Food Facts' });
        });
      }
      setImages(found.slice(0, 5));
      if (found.length === 0) {
        toast('Nenhuma imagem adequada encontrada.', { icon: 'ℹ️' });
      }
    } catch {
      toast.error('Erro ao buscar imagens');
    }
    setSearching(false);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Nome do produto é obrigatório');
      return;
    }
    setSaving(true);
    try {
      const product = await base44.entities.Product.create({
        name: name.trim(),
        barcode: barcode || '',
        internal_code: generateInternalCode(),
        image_url: selectedImage || '',
        sale_price: parseFloat(price) || 0,
        cost_price: null,
        quantity: 0,
        unit: 'unidade',
        status: 'ativo',
        category: '',
      });
      onSave(product);
    } catch {
      toast.error('Erro ao cadastrar produto');
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-bold">Cadastro Rápido</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          {barcode && (
            <div>
              <label className="text-xs text-muted-foreground">Código de Barras</label>
              <input type="text" value={barcode} readOnly
                className="w-full mt-1 px-3 py-2 bg-secondary rounded text-sm font-mono" />
            </div>
          )}
          <div>
            <label className="text-xs text-muted-foreground">Nome do Produto *</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} autoFocus
              placeholder="Digite o nome do produto"
              className="w-full mt-1 px-3 py-2 border border-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              onKeyDown={(e) => e.key === 'Enter' && handleSave()} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Preço de Venda (opcional)</label>
            <input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)}
              placeholder="0,00"
              className="w-full mt-1 px-3 py-2 border border-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
          </div>

          {/* Image search */}
          {!showImages ? (
            <button onClick={searchImages}
              className="flex items-center gap-2 text-sm text-accent hover:underline">
              <ImageIcon className="w-4 h-4" /> Buscar imagem do produto
            </button>
          ) : (
            <div>
              {searching ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                  <Loader2 className="w-4 h-4 animate-spin" /> Buscando imagens...
                </div>
              ) : images.length > 0 ? (
                <div className="grid grid-cols-3 gap-2">
                  {images.map((img, i) => (
                    <button key={i} onClick={() => setSelectedImage(img.url)}
                      className={`relative aspect-square rounded-lg overflow-hidden border-2 ${selectedImage === img.url ? 'border-accent' : 'border-transparent'}`}>
                      <img src={img.url} alt="" className="w-full h-full object-cover" />
                      {selectedImage === img.url && (
                        <div className="absolute inset-0 bg-accent/20 flex items-center justify-center">
                          <Check className="w-6 h-6 text-white" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Nenhuma imagem encontrada.</p>
              )}
            </div>
          )}
        </div>
        <div className="flex gap-2 px-6 py-4 border-t">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-secondary">Cancelar</button>
          <button onClick={handleSave} disabled={saving || !name.trim()}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-accent text-accent-foreground hover:bg-accent/90 disabled:opacity-40 text-sm font-bold">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Salvar e Adicionar
          </button>
        </div>
      </div>
    </div>
  );
}