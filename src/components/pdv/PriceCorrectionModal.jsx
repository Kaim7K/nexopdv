import React, { useState } from 'react';
import { X, Check, AlertTriangle } from 'lucide-react';
import { formatCurrency } from '@/lib/helpers';
import { toast } from 'react-hot-toast';
import { useModalBehavior } from '@/hooks/use-modal-behavior';

export default function PriceCorrectionModal({ items, onSave, onClose }) {
  const modalRef = useModalBehavior({ onClose });
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" role="presentation">
      <div ref={modalRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="price-correction-title" className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4 sm:px-6">
          <div><h2 id="price-correction-title" className="text-lg font-bold">Corrigir valor do produto</h2><p className="mt-0.5 text-xs text-muted-foreground">A alteração ficará registrada na auditoria.</p></div>
          <button type="button" aria-label="Fechar" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="text-sm text-muted-foreground">Selecione o item com valor incorreto:</div>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {items.map((item, i) => (
              <button type="button" key={i} onClick={() => { setSelectedIndex(i); setNewPrice(''); }}
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
                  className="w-full mt-1 px-3 py-2 border border-border bg-background rounded text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-accent"
                  onKeyDown={(e) => e.key === 'Enter' && handleSave()} />
              </div>
            </div>
          )}
        </div>
        <div className="flex gap-2 px-6 py-4 border-t">
          <button type="button" onClick={onClose} className="min-h-11 rounded-xl border border-border px-4 text-sm font-semibold hover:bg-muted">Cancelar</button>
          <button type="button" onClick={handleSave} disabled={selectedIndex === null || !newPrice}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-accent text-accent-foreground hover:bg-accent/90 disabled:opacity-40 text-sm font-bold">
            <Check className="w-4 h-4" /> Salvar Alteração
          </button>
        </div>
      </div>
    </div>
  );
}
