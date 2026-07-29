import React, { useState } from 'react';
import { X } from 'lucide-react';

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
  modalListClassName,
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
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${title} completo`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-3"
      onClick={onClose}
    >
      <section
        className={`max-h-[88vh] w-full ${maxWidth} overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-2xl`}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
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
            className="grid h-9 w-9 flex-none place-items-center rounded-lg border border-border text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="max-h-[calc(88vh-4.5rem)] overflow-y-auto p-4">
          <div className={listClassName}>{items.map(renderItem)}</div>
        </div>
      </section>
    </div>
  );
}
