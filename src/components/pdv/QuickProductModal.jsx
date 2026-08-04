import React, { useRef, useState } from 'react';
import { Barcode, Check, Loader2, Sparkles, X } from 'lucide-react';
import { nexoApi } from '@/api/nexoApi';
import { toast } from 'react-hot-toast';
import { useModalBehavior } from '@/hooks/use-modal-behavior';
import {
  formatCurrencyInput,
  parseCurrencyDigits,
} from '@/lib/helpers';
import { standardizeProductName } from '@/lib/product-name';

export default function QuickProductModal({ barcode, onSave, onClose }) {
  const [name, setName] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [saving, setSaving] = useState(false);
  const submittingRef = useRef(false);
  const modalRef = useModalBehavior({ onClose, disabled: saving });

  const handleStandardizeName = () => {
    const standardized = standardizeProductName(name);
    if (!standardized) {
      toast.error('Digite um nome para padronizar.');
      return;
    }
    setName(standardized);
    toast.success('Nome padronizado.');
  };

  const handleSave = async (event) => {
    event?.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      toast.error('Informe o nome do produto.');
      return;
    }

    const cleanPrice = String(salePrice).trim();
    const parsedPrice =
      cleanPrice === '' ? undefined : parseCurrencyDigits(cleanPrice);
    if (cleanPrice !== '' && (!Number.isFinite(parsedPrice) || parsedPrice < 0)) {
      toast.error('Informe um preço de venda válido.');
      return;
    }

    if (submittingRef.current) return;
    submittingRef.current = true;
    setSaving(true);
    try {
      const result = await nexoApi.products.quickCreate(
        barcode,
        cleanName,
        parsedPrice,
      );
      toast.success(
        result.created
          ? 'Produto cadastrado e adicionado à venda.'
          : 'Produto já cadastrado. Item existente adicionado à venda.',
      );
      onSave(result.product, { created: Boolean(result.created) });
    } catch (error) {
      toast.error(
        error.message || 'Não foi possível cadastrar o produto. A venda foi preservada.',
      );
    } finally {
      submittingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/70 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
      role="presentation"
    >
      <form
        ref={modalRef}
        onSubmit={handleSave}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-product-title"
        aria-describedby="quick-product-description"
        className="flex max-h-[96dvh] w-full flex-col overflow-hidden rounded-t-[20px] border border-border/80 bg-card text-card-foreground shadow-[0_-20px_70px_rgba(0,0,0,0.28)] sm:max-w-md sm:rounded-[20px] sm:shadow-[0_28px_90px_rgba(0,0,0,0.35)]"
      >
        <div className="flex items-start justify-between gap-3 border-b border-border/80 bg-muted/15 px-4 py-3">
          <div>
            <h2 id="quick-product-title" className="text-base font-black sm:text-lg">
              Produto não encontrado
            </h2>
            <p
              id="quick-product-description"
              className="mt-1 text-xs leading-4 text-muted-foreground sm:text-sm sm:leading-5"
            >
              Cadastre somente o essencial e continue a venda sem sair do PDV.
            </p>
          </div>
          <button
            type="button"
            aria-label="Fechar cadastro rápido"
            onClick={onClose}
            disabled={saving}
            className="grid h-10 w-10 flex-none place-items-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-3 sm:space-y-4 sm:p-5">
          <label className="block text-sm font-semibold">
            Código de barras
            <span className="relative mt-1.5 block">
              <Barcode className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={barcode || ''}
                readOnly
                aria-readonly="true"
                className="h-10 w-full rounded-xl border border-border bg-muted pl-10 pr-3 font-mono text-sm text-muted-foreground sm:h-11"
              />
            </span>
          </label>

          <label className="block text-sm font-semibold">
            Nome do produto <span className="text-destructive">*</span>
            <div className="mt-1.5 flex gap-2">
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoFocus
                required
                maxLength={180}
                autoComplete="off"
                placeholder="Ex.: Leite integral 1 L"
                disabled={saving}
                className="h-10 min-w-0 flex-1 rounded-xl border border-border bg-background px-3 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:opacity-60 sm:h-12 sm:text-base"
              />
              <button
                type="button"
                onClick={handleStandardizeName}
                disabled={saving}
                title="Padronizar nome"
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-accent/30 bg-accent/5 px-3 text-sm font-bold text-accent hover:bg-accent/10 disabled:opacity-50 sm:h-12"
              >
                <Sparkles className="h-4 w-4" />
                <span className="hidden sm:inline">Padronizar</span>
              </button>
            </div>
          </label>

          <label className="block text-sm font-semibold">
            Preço de venda
            <input
              type="text"
              inputMode="numeric"
              value={formatCurrencyInput(salePrice)}
              onChange={(event) => setSalePrice(event.target.value.replace(/\D/g, ''))}
              disabled={saving}
              placeholder="0,00"
              className="mt-1.5 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:opacity-60 sm:h-12 sm:text-base"
            />
          </label>

          <div className="rounded-xl border border-accent/20 bg-accent/5 p-2.5 text-xs leading-5 text-muted-foreground sm:p-3">
            Custo, categoria, estoque e imagem poderão ser preenchidos depois na
            tela completa do produto. Os padrões do mercadinho serão aplicados
            agora.
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-border px-3 py-3 sm:flex-row sm:px-5 sm:py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="min-h-11 rounded-xl border border-border px-4 text-sm font-bold hover:bg-muted disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-black text-accent-foreground hover:bg-accent/90 disabled:bg-muted disabled:text-muted-foreground sm:min-h-12"
          >
            {saving ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Check className="h-5 w-5" />
            )}
            {saving ? 'Salvando no estoque...' : 'Salvar e adicionar à venda'}
          </button>
        </div>
      </form>
    </div>
  );
}
