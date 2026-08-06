import React from 'react';
import {
  Archive,
  Banknote,
  CalendarClock,
  CheckCircle2,
  CircleDashed,
  Clock3,
  CreditCard,
  HelpCircle,
  PauseCircle,
  QrCode,
  RotateCcw,
  Wallet,
  XCircle,
} from 'lucide-react';

export const PAYMENT_VISUALS = {
  dinheiro: {
    label: 'Dinheiro',
    icon: Banknote,
    chart: '#16a34a',
    badge:
      'border-emerald-200 bg-emerald-500/10 text-emerald-700 dark:border-emerald-900/70 dark:text-emerald-300',
    soft: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  },
  pix: {
    label: 'Pix',
    icon: QrCode,
    chart: '#0d9488',
    badge:
      'border-teal-200 bg-teal-500/10 text-teal-700 dark:border-teal-900/70 dark:text-teal-300',
    soft: 'bg-teal-500/10 text-teal-700 dark:text-teal-300',
  },
  debito: {
    label: 'Cartão de débito',
    icon: CreditCard,
    chart: '#2563eb',
    badge:
      'border-blue-200 bg-blue-500/10 text-blue-700 dark:border-blue-900/70 dark:text-blue-300',
    soft: 'bg-blue-500/10 text-blue-700 dark:text-blue-300',
  },
  credito: {
    label: 'Cartão de crédito',
    icon: CreditCard,
    chart: '#7c3aed',
    badge:
      'border-violet-200 bg-violet-500/10 text-violet-700 dark:border-violet-900/70 dark:text-violet-300',
    soft: 'bg-violet-500/10 text-violet-700 dark:text-violet-300',
  },
  fiado: {
    label: 'Fiado',
    icon: CalendarClock,
    chart: '#ea580c',
    badge:
      'border-orange-200 bg-orange-500/10 text-orange-700 dark:border-orange-900/70 dark:text-orange-300',
    soft: 'bg-orange-500/10 text-orange-700 dark:text-orange-300',
  },
  boleto: {
    label: 'Boleto',
    icon: Wallet,
    chart: '#64748b',
    badge:
      'border-slate-200 bg-slate-500/10 text-slate-700 dark:border-slate-800 dark:text-slate-300',
    soft: 'bg-slate-500/10 text-slate-700 dark:text-slate-300',
  },
  transferencia: {
    label: 'Transferência',
    icon: Wallet,
    chart: '#0891b2',
    badge:
      'border-cyan-200 bg-cyan-500/10 text-cyan-700 dark:border-cyan-900/70 dark:text-cyan-300',
    soft: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300',
  },
  outros: {
    label: 'Outros',
    icon: Wallet,
    chart: '#64748b',
    badge:
      'border-slate-200 bg-slate-500/10 text-slate-700 dark:border-slate-800 dark:text-slate-300',
    soft: 'bg-slate-500/10 text-slate-700 dark:text-slate-300',
  },
};

export const STATUS_VISUALS = {
  concluida: {
    label: 'Concluída',
    icon: CheckCircle2,
    badge:
      'border-emerald-200 bg-emerald-500/10 text-emerald-700 dark:border-emerald-900/70 dark:text-emerald-300',
  },
  pago: {
    label: 'Pago',
    icon: CheckCircle2,
    badge:
      'border-emerald-200 bg-emerald-500/10 text-emerald-700 dark:border-emerald-900/70 dark:text-emerald-300',
  },
  paid: {
    label: 'Pago',
    icon: CheckCircle2,
    badge:
      'border-emerald-200 bg-emerald-500/10 text-emerald-700 dark:border-emerald-900/70 dark:text-emerald-300',
  },
  aberto: {
    label: 'Em andamento',
    icon: Clock3,
    badge:
      'border-blue-200 bg-blue-500/10 text-blue-700 dark:border-blue-900/70 dark:text-blue-300',
  },
  pendente: {
    label: 'Pendente',
    icon: Clock3,
    badge:
      'border-amber-200 bg-amber-500/10 text-amber-700 dark:border-amber-900/70 dark:text-amber-300',
  },
  pending: {
    label: 'Pendente',
    icon: Clock3,
    badge:
      'border-amber-200 bg-amber-500/10 text-amber-700 dark:border-amber-900/70 dark:text-amber-300',
  },
  partial: {
    label: 'Parcial',
    icon: PauseCircle,
    badge:
      'border-orange-200 bg-orange-500/10 text-orange-700 dark:border-orange-900/70 dark:text-orange-300',
  },
  fechado: {
    label: 'Fechado',
    icon: CheckCircle2,
    badge:
      'border-emerald-200 bg-emerald-500/10 text-emerald-700 dark:border-emerald-900/70 dark:text-emerald-300',
  },
  cancelada: {
    label: 'Cancelada',
    icon: XCircle,
    badge:
      'border-red-200 bg-red-500/10 text-red-700 dark:border-red-900/70 dark:text-red-300',
  },
  cancelled: {
    label: 'Cancelado',
    icon: XCircle,
    badge:
      'border-red-200 bg-red-500/10 text-red-700 dark:border-red-900/70 dark:text-red-300',
  },
  overdue: {
    label: 'Vencido',
    icon: XCircle,
    badge:
      'border-red-200 bg-red-500/10 text-red-700 dark:border-red-900/70 dark:text-red-300',
  },
  reversed: {
    label: 'Estornado',
    icon: RotateCcw,
    badge:
      'border-slate-200 bg-slate-500/10 text-slate-700 dark:border-slate-800 dark:text-slate-300',
  },
  archived: {
    label: 'Arquivado',
    icon: Archive,
    badge:
      'border-slate-200 bg-slate-500/10 text-slate-700 dark:border-slate-800 dark:text-slate-300',
  },
};

export function getPaymentVisual(method) {
  return PAYMENT_VISUALS[method] || PAYMENT_VISUALS.outros;
}

export function getStatusVisual(status) {
  return STATUS_VISUALS[status] || {
    label: status || 'Não informado',
    icon: CircleDashed,
    badge:
      'border-border bg-muted text-muted-foreground dark:border-border dark:text-muted-foreground',
  };
}

export function PaymentIcon({ method, className = 'h-4 w-4' }) {
  const Icon = getPaymentVisual(method).icon || HelpCircle;
  return <Icon className={className} aria-hidden="true" />;
}

export function PaymentBadge({
  method,
  amount = undefined,
  compact = false,
  className = '',
}) {
  const visual = getPaymentVisual(method);
  const Icon = visual.icon;
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-bold leading-none ${visual.badge} ${className}`}
      title={visual.label}
    >
      <Icon className="h-3.5 w-3.5 flex-none" />
      <span className="truncate">{compact ? visual.label.split(' ')[0] : visual.label}</span>
      {amount !== undefined && (
        <span className="ml-0.5 tabular-nums">{amount}</span>
      )}
    </span>
  );
}

export function StatusBadge({ status, className = '' }) {
  const visual = getStatusVisual(status);
  const Icon = visual.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-black leading-none ${visual.badge} ${className}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {visual.label}
    </span>
  );
}
