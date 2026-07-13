import React, { useRef, useState } from 'react';
import { Barcode, Check, Loader2, X } from 'lucide-react';
import { nexoApi } from '@/api/nexoApi';
import { toast } from 'react-hot-toast';
import { useModalBehavior } from '@/hooks/use-modal-behavior';

export default function QuickProductModal({ barcode, onSave, onClose }) {
  const [name,setName] = useState('');
  const [saving,setSaving] = useState(false);
  const submittingRef = useRef(false);
  const modalRef = useModalBehavior({ onClose,disabled:saving });

  const handleSave = async event => {
    event?.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      toast.error('Informe o nome do produto.');
      return;
    }
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSaving(true);
    try {
      const result = await nexoApi.products.quickCreate(barcode,cleanName);
      toast.success(result.created ? 'Produto cadastrado e adicionado à venda.' : 'Produto já cadastrado. Item existente adicionado à venda.');
      onSave(result.product,{ created:Boolean(result.created) });
    } catch (error) {
      toast.error(error.message || 'Não foi possível cadastrar o produto. A venda foi preservada.');
    } finally {
      submittingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-0 backdrop-blur-sm sm:p-4" role="presentation">
      <form ref={modalRef} onSubmit={handleSave} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="quick-product-title" aria-describedby="quick-product-description" className="flex h-dvh w-full max-w-md flex-col overflow-hidden bg-card text-card-foreground sm:h-auto sm:rounded-2xl sm:border sm:border-border sm:shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <h2 id="quick-product-title" className="text-lg font-black">Produto não encontrado</h2>
            <p id="quick-product-description" className="mt-1 text-sm leading-5 text-muted-foreground">Cadastre somente o essencial e continue a venda sem sair do PDV.</p>
          </div>
          <button type="button" aria-label="Fechar cadastro rápido" onClick={onClose} disabled={saving} className="grid h-10 w-10 flex-none place-items-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"><X className="h-5 w-5" /></button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          <label className="block text-sm font-semibold">Código de barras
            <span className="relative mt-1.5 block">
              <Barcode className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input value={barcode || ''} readOnly aria-readonly="true" className="h-11 w-full rounded-xl border border-border bg-muted pl-10 pr-3 font-mono text-sm text-muted-foreground" />
            </span>
          </label>
          <label className="block text-sm font-semibold">Nome do produto <span className="text-destructive">*</span>
            <input value={name} onChange={event => setName(event.target.value)} autoFocus required maxLength={180} autoComplete="off" placeholder="Ex.: Leite integral 1 L" disabled={saving} className="mt-1.5 h-12 w-full rounded-xl border border-border bg-background px-3 text-base outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:opacity-60" />
          </label>
          <div className="rounded-xl border border-accent/20 bg-accent/5 p-3 text-xs leading-5 text-muted-foreground">Preço, custo, categoria, estoque e imagem poderão ser preenchidos depois na tela completa do produto. Os padrões do mercadinho serão aplicados agora.</div>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-border px-5 py-4 sm:flex-row">
          <button type="button" onClick={onClose} disabled={saving} className="min-h-11 rounded-xl border border-border px-4 text-sm font-bold hover:bg-muted disabled:opacity-50">Cancelar</button>
          <button type="submit" disabled={saving || !name.trim()} className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-black text-accent-foreground hover:bg-accent/90 disabled:bg-muted disabled:text-muted-foreground">
            {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}{saving ? 'Salvando no estoque...' : 'Salvar e adicionar à venda'}
          </button>
        </div>
      </form>
    </div>
  );
}
