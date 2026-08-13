import React, { useState } from 'react';
import { X, Check, AlertTriangle } from 'lucide-react';
import {
  formatCurrency,
  formatCurrencyInput,
  parseCurrencyDigits,
} from '@/lib/helpers';
import { toast } from 'react-hot-toast';
import { useModalBehavior } from '@/hooks/use-modal-behavior';

export default function PriceCorrectionModal({ items, onSave, onClose }) {
  const modalRef = useModalBehavior({ onClose });
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [newPrice, setNewPrice] = useState('');

  const selectedItem = selectedIndex !== null ? items[selectedIndex] : null;

  const handleSave = () => {
    if (selectedIndex === null) {
      toast.error('Selecione um item');
      return;
    }
    const price = parseCurrencyDigits(newPrice);
    if (!price || price <= 0) {
      toast.error('Digite um valor válido');
      return;
    }
    onSave(selectedIndex, price);
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
        aria-labelledby="price-correction-title"
        className="modal-panel sm:max-w-lg"
      >
        <div className="modal-header">
          <div>
            <h2 id="price-correction-title" className="modal-title">
              Corrigir valor do produto
            </h2>
            <p className="modal-subtitle">
              A alteração ficará registrada na auditoria.
            </p>
          </div>
          <button
            type="button"
            aria-label="Fechar"
            onClick={onClose}
            className="modal-icon-button"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="modal-body space-y-3">
          <div className="text-sm text-muted-foreground">
            Selecione o item com valor incorreto:
          </div>
          <div className="max-h-40 space-y-1 overflow-y-auto sm:max-h-48">
            {items.map((item, i) => (
              <button
                type="button"
                key={i}
                onClick={() => {
                  setSelectedIndex(i);
                  setNewPrice('');
                }}
                className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left transition-colors ${selectedIndex === i ? 'border-accent bg-accent/5' : 'border-border hover:bg-secondary'}`}
              >
                <div>
                  <div className="text-sm font-medium">{item.product_name}</div>
                  <div className="text-xs text-muted-foreground">
                    Valor atual: {formatCurrency(item.unit_price)}
                  </div>
                </div>
                {selectedIndex === i && (
                  <Check className="h-4 w-4 text-accent" />
                )}
              </button>
            ))}
          </div>

          {selectedItem && (
            <div className="rounded-lg border border-accent/30 bg-accent/5 p-3 space-y-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                A alteração será registrada na auditoria do produto.
              </div>
              <div>
                <label className="text-xs text-muted-foreground">
                  Novo valor
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formatCurrencyInput(newPrice)}
                  onChange={(e) =>
                    setNewPrice(e.target.value.replace(/\D/g, ''))
                  }
                  autoFocus
                  className="mt-1 h-12 w-full rounded-xl border border-border bg-background px-3 text-base font-semibold focus:outline-none focus:ring-2 focus:ring-accent"
                  onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                />
              </div>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <div className="modal-actions">
          <button
            type="button"
            onClick={onClose}
            className="modal-button border border-border hover:bg-muted"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={selectedIndex === null || !newPrice}
            className="modal-button modal-actions-primary bg-accent text-accent-foreground hover:bg-accent/90 disabled:opacity-40"
          >
            <Check className="h-4 w-4" /> Salvar Alteração
          </button>
          </div>
        </div>
      </div>
    </div>
  );
}
