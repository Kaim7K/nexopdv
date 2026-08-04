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
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/70 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
      role="presentation"
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="price-correction-title"
        className="w-full overflow-hidden rounded-t-[20px] border border-border/80 bg-card text-card-foreground shadow-[0_-20px_70px_rgba(0,0,0,0.28)] sm:max-w-lg sm:rounded-[20px] sm:shadow-[0_28px_90px_rgba(0,0,0,0.35)]"
      >
        <div className="flex items-center justify-between border-b border-border/80 bg-muted/15 px-4 py-3 sm:px-5">
          <div>
            <h2 id="price-correction-title" className="text-lg font-bold">
              Corrigir valor do produto
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              A alteração ficará registrada na auditoria.
            </p>
          </div>
          <button
            type="button"
            aria-label="Fechar"
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-4 p-4 sm:p-6">
          <div className="text-sm text-muted-foreground">
            Selecione o item com valor incorreto:
          </div>
          <div className="max-h-44 space-y-1 overflow-y-auto sm:max-h-48">
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
        <div className="flex flex-col-reverse gap-2 border-t px-4 py-4 sm:flex-row sm:px-6">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-xl border border-border px-4 text-sm font-semibold hover:bg-muted"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={selectedIndex === null || !newPrice}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-bold text-accent-foreground hover:bg-accent/90 disabled:opacity-40"
          >
            <Check className="h-4 w-4" /> Salvar Alteração
          </button>
        </div>
      </div>
    </div>
  );
}
