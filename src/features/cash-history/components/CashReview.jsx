import React from 'react';
import { CheckCheck, ClipboardCheck, Loader2 } from 'lucide-react';

export default function CashReview({ item, pending, onReview, compact = false }) {
  if (item.status !== 'fechado') return null;
  const reviewedAt = item.reviewed_at ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(item.reviewed_at)) : '';
  return (
    <div className={`cash-review ${compact ? 'is-compact' : ''} ${item.review_valid ? 'is-verified' : ''}`} aria-live="polite">
      <button type="button" disabled={pending} onClick={() => onReview(item, Boolean(item.review_valid))} aria-pressed={Boolean(item.review_valid)} title={item.review_valid ? `Verificado por ${item.reviewed_by_name} · ${reviewedAt}. Clique para desmarcar.` : undefined} aria-label={item.review_valid ? `Desmarcar verificação do caixa de ${item.seller_name}` : `Marcar como verificado o caixa de ${item.seller_name}`}>
        {pending ? <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" /> : item.review_valid ? <CheckCheck aria-hidden="true" className="h-3.5 w-3.5" /> : <ClipboardCheck aria-hidden="true" className="h-3.5 w-3.5" />}
        {pending ? 'Salvando...' : item.review_valid ? 'Verificado' : item.reviewed_at ? 'Verificar novamente' : 'Marcar verificado'}
      </button>
      {!compact && item.review_valid && <span>{item.reviewed_by_name} · {reviewedAt}</span>}
      {!compact && !item.review_valid && item.reviewed_at && <span>Dados alterados após a conferência</span>}
    </div>
  );
}
