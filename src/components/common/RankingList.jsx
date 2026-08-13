import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useModalBehavior } from '@/hooks/use-modal-behavior';

export default function RankingList({
  title,
  items = [],
  renderItem,
  headerActions = null,
  emptyText = 'Sem dados no período.',
  visibleCount = 5,
  containerClassName = 'rounded-xl border border-border bg-card p-4 text-card-foreground',
  headerClassName = 'mb-3 flex flex-wrap items-center justify-between gap-2',
  listClassName = 'space-y-2',
  modalListClassName = '',
  modalMaxWidth = 'max-w-2xl',
}) {
  const [open, setOpen] = useState(false);
  const visibleItems = items.slice(0, visibleCount);
  const hasMore = items.length > visibleItems.length;

  return (
    <section className={containerClassName}>
      <div className={headerClassName}>
        <h3 className="text-sm font-bold">{title}</h3>
        {headerActions}
      </div>

      {items.length ? (
        <div className={listClassName}>{visibleItems.map(renderItem)}</div>
      ) : (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {emptyText}
        </p>
      )}

      {hasMore && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-3 inline-flex min-h-9 w-full items-center justify-center rounded-lg border border-border bg-muted/30 px-3 text-xs font-bold text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          Ver ranking completo ({items.length})
        </button>
      )}

      {open && (
        <RankingModal
          title={title}
          items={items}
          onClose={() => setOpen(false)}
          renderItem={renderItem}
          listClassName={modalListClassName || listClassName}
          maxWidth={modalMaxWidth}
        />
      )}
    </section>
  );
}

function RankingModal({
  title,
  items,
  onClose,
  renderItem,
  listClassName,
  maxWidth,
}) {
  const modalRef = useModalBehavior({ onClose });

  return (
    <div
      role="presentation"
      className="modal-overlay"
      onClick={onClose}
    >
      <section
        ref={modalRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={`${title} completo`}
        className={`modal-panel ${maxWidth} sm:max-h-[min(36rem,calc(100dvh-3rem))]`}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="modal-header">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-bold">{title}</h3>
            <p className="text-xs text-muted-foreground">
              {items.length} item(ns)
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar ranking completo"
            className="modal-icon-button border border-border"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="modal-body">
          <div className={`${listClassName} max-h-[calc(100dvh-10rem)] overflow-y-auto pr-1`}>
            {items.map(renderItem)}
          </div>
        </div>
      </section>
    </div>
  );
}
