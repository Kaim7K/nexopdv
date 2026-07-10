import React, { useState } from 'react';
import { X, Check, AlertTriangle } from 'lucide-react';
import { formatCurrency } from '@/lib/helpers';
import { toast } from 'react-hot-toast';

export default function PriceCorrectionModal({ items, onSave, onClose }) {
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [newPrice, setNewPrice] = useState('');

  const selectedItem = selectedIndex !== null ? items[selectedIndex] : null;

  const handleSave = () => {
    if (selectedIndex === null) { toast.error('Selecione um item'); return; }
    const price = parseFloat(newPrice);
    if (!price || price <= 0) { toast.error('Digite um valor válido'); return; }
    onSave(selectedIndex, price);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-bold">Produto com Valor Errado</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="text-sm text-muted-foreground">Selecione o item com valor incorreto:</div>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {items.map((item, i) => (
              <button key={i} onClick={() => { setSelectedIndex(i); setNewPrice(''); }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-left transition-colors ${selectedIndex === i ? 'border-accent bg-accent/5' : 'border-border hover:bg-secondary'}`}>
                <div>
                  <div className="text-sm font-medium">{item.product_name}</div>
                  <div className="text-xs text-muted-foreground">Valor atual: {formatCurrency(item.unit_price)}</div>
                </div>
                {selectedIndex === i && <Check className="w-4 h-4 text-accent" />}
              </button>
            ))}
          </div>

          {selectedItem && (
            <div className="border border-accent/30 bg-accent/5 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                A alteração será registrada na auditoria do produto.
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Novo valor</label>
                <input type="number" step="0.01" min="0" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} autoFocus
                  className="w-full mt-1 px-3 py-2 border border-border rounded text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-accent"
                  onKeyDown={(e) => e.key === 'Enter' && handleSave()} />
              </div>
            </div>
          )}
        </div>
        <div className="flex gap-2 px-6 py-4 border-t">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-secondary">Cancelar</button>
          <button onClick={handleSave} disabled={selectedIndex === null || !newPrice}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-accent text-accent-foreground hover:bg-accent/90 disabled:opacity-40 text-sm font-bold">
            <Check className="w-4 h-4" /> Salvar Alteração
          </button>
        </div>
      </div>
    </div>
  );
}