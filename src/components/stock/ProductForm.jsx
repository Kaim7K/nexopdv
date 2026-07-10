import React, { useState, useEffect } from 'react';
import { X, Save, ImageIcon } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { generateInternalCode } from '@/lib/helpers';
import { toast } from 'react-hot-toast';
import ProductImageSearch from './ProductImageSearch';

export default function ProductForm({ product, categories, user, onSave, onClose }) {
  const [form, setForm] = useState({
    name: '', category: '', barcode: '', internal_code: '',
    image_url: '', sale_price: '', cost_price: '', quantity: '', unit: 'unidade', status: 'ativo',
  });
  const [showImageSearch, setShowImageSearch] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (product) {
      setForm({
        name: product.name || '', category: product.category || '',
        barcode: product.barcode || '', internal_code: product.internal_code || '',
        image_url: product.image_url || '', sale_price: product.sale_price || '',
        cost_price: product.cost_price || '', quantity: product.quantity ?? '',
        unit: product.unit || 'unidade', status: product.status || 'ativo',
      });
    } else {
      setForm(f => ({ ...f, internal_code: generateInternalCode() }));
    }
  }, [product]);

  const handleChange = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Nome é obrigatório'); return; }
    if (!form.sale_price && form.sale_price !== 0) { toast.error('Preço de venda é obrigatório'); return; }
    setSaving(true);
    try {
      const data = {
        name: form.name.trim(), category: form.category || '',
        barcode: form.barcode || '', internal_code: form.internal_code,
        image_url: form.image_url || '', sale_price: parseFloat(form.sale_price) || 0,
        cost_price: form.cost_price ? parseFloat(form.cost_price) : null,
        quantity: form.quantity === '' ? 0 : parseFloat(form.quantity),
        unit: form.unit, status: form.status,
      };
      let saved;
      if (product) {
        if (product.sale_price !== data.sale_price) {
          await base44.entities.ProductAudit.create({
            product_id: product.id, product_name: data.name, field_changed: 'sale_price',
            previous_value: String(product.sale_price), new_value: String(data.sale_price),
            user_id: user.id, user_name: user.full_name || user.email,
            change_origin: 'gerenciamento_estoque', observation: 'Alteração no cadastro de produto',
          });
        }
        saved = await base44.entities.Product.update(product.id, data);
      } else {
        saved = await base44.entities.Product.create(data);
        await base44.entities.GeneralAudit.create({
          action_type: 'produto_cadastrado', entity_type: 'product', entity_id: saved.id,
          user_id: user.id, user_name: user.full_name || user.email,
          description: `Produto "${data.name}" cadastrado`, details: JSON.stringify(data),
        });
      }
      onSave(saved);
    } catch { toast.error('Erro ao salvar produto'); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-bold">{product ? 'Editar Produto' : 'Novo Produto'}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          <div className="flex gap-4">
            <div className="w-24 h-24 rounded-lg bg-secondary flex items-center justify-center overflow-hidden flex-shrink-0 border border-border">
              {form.image_url ? (
                <img src={form.image_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <ImageIcon className="w-8 h-8 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 flex items-start">
              <button onClick={() => setShowImageSearch(true)}
                className="flex items-center gap-2 text-sm text-accent hover:underline">
                <ImageIcon className="w-4 h-4" /> Buscar imagem do produto
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Nome do Produto *</label>
            <input type="text" value={form.name} onChange={(e) => handleChange('name', e.target.value)} autoFocus
              className="w-full mt-1 px-3 py-2 border border-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Categoria</label>
              <input list="categories" type="text" value={form.category} onChange={(e) => handleChange('category', e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
              <datalist id="categories">{categories.map((c, i) => <option key={i} value={c} />)}</datalist>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Unidade de Venda</label>
              <select value={form.unit} onChange={(e) => handleChange('unit', e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-accent">
                <option value="unidade">Unidade</option>
                <option value="peso">Peso (kg)</option>
                <option value="pacote">Pacote</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Código de Barras (opcional)</label>
              <input type="text" value={form.barcode} onChange={(e) => handleChange('barcode', e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-border rounded text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Código Interno</label>
              <input type="text" value={form.internal_code} readOnly
                className="w-full mt-1 px-3 py-2 bg-secondary border border-border rounded text-sm font-mono" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Preço de Venda *</label>
              <input type="number" step="0.01" value={form.sale_price} onChange={(e) => handleChange('sale_price', e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Preço de Custo</label>
              <input type="number" step="0.01" value={form.cost_price} onChange={(e) => handleChange('cost_price', e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Qtd. Estoque</label>
              <input type="number" step="0.001" value={form.quantity} onChange={(e) => handleChange('quantity', e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Status</label>
            <select value={form.status} onChange={(e) => handleChange('status', e.target.value)}
              className="w-full mt-1 px-3 py-2 border border-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-accent">
              <option value="ativo">Ativo</option>
              <option value="inativo">Inativo</option>
            </select>
          </div>
        </div>
        <div className="flex gap-2 px-6 py-4 border-t">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-secondary">Cancelar</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-accent text-accent-foreground hover:bg-accent/90 disabled:opacity-40 text-sm font-bold">
            <Save className="w-4 h-4" /> {product ? 'Atualizar' : 'Cadastrar'}
          </button>
        </div>
      </div>
      {showImageSearch && (
        <ProductImageSearch barcode={form.barcode} productName={form.name} category={form.category}
          onSelect={(url) => handleChange('image_url', url)} onClose={() => setShowImageSearch(false)} />
      )}
    </div>
  );
}