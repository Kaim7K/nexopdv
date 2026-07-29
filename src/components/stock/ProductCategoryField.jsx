import React from 'react';
import { Check, ChevronDown, Pencil, Save, Trash2 } from 'lucide-react';

export default function ProductCategoryField({
  category,
  open,
  onOpenChange,
  search,
  onSearchChange,
  filteredCategories,
  draft,
  onDraftChange,
  editingCategory,
  onEditCategory,
  onDeleteCategory,
  onCommitCategory,
  onCancelEdit,
  onChange,
}) {
  return (
    <div className="relative">
      <label
        htmlFor="product-category"
        className="text-xs font-medium text-muted-foreground"
      >
        Categoria
      </label>
      <button
        type="button"
        onClick={() => onOpenChange((current) => !current)}
        className="mt-1 flex h-10 w-full items-center justify-between rounded-lg border border-border bg-background px-3 text-left text-sm focus:outline-none focus:ring-2 focus:ring-accent"
      >
        <span className={category ? 'text-foreground' : 'text-muted-foreground'}>
          {category || 'Selecione uma categoria'}
        </span>
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
          <div className="sticky top-0 border-b border-border bg-card p-2">
            <input
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Buscar categoria..."
              className="h-8 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </div>
          <div className="max-h-[260px] overflow-y-auto p-1">
            <button
              type="button"
              onClick={() => {
                onChange('');
                onOpenChange(false);
              }}
              className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.25 text-left text-sm hover:bg-muted"
            >
              <span className="text-muted-foreground">
                Selecione uma categoria
              </span>
              {!category && <Check className="h-4 w-4 text-accent" />}
            </button>
            {filteredCategories.map((option) => (
              <div
                key={option}
                className="group flex items-center gap-0.5 rounded-lg px-1 hover:bg-muted/70"
              >
                <button
                  type="button"
                  onClick={() => {
                    onChange(option);
                    onOpenChange(false);
                  }}
                  className="min-w-0 flex-1 rounded-md px-2 py-1.25 text-left text-sm"
                >
                  <span className="block truncate">{option}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onEditCategory(option)}
                  className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-background hover:text-foreground"
                  aria-label={`Editar ${option}`}
                  title="Editar categoria"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteCategory(option)}
                  className="grid h-7 w-7 place-items-center rounded-md text-destructive hover:bg-destructive/10"
                  aria-label={`Excluir ${option}`}
                  title="Excluir categoria"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
          <div className="border-t border-border bg-muted/20 p-2">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {editingCategory ? 'Editar categoria' : 'Nova categoria'}
            </label>
            <div className="mt-1.5 flex gap-2">
              <input
                value={draft}
                onChange={(event) => onDraftChange(event.target.value)}
                placeholder={editingCategory || 'Digite a categoria'}
                className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-1.75 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
              />
              <button
                type="button"
                onClick={onCommitCategory}
                className="inline-flex h-8 items-center gap-2 rounded-lg bg-emerald-600 px-3 text-sm font-bold text-white hover:bg-emerald-700"
              >
                <Save className="h-4 w-4" />{' '}
                {editingCategory ? 'Salvar' : 'Adicionar'}
              </button>
            </div>
            <div className="mt-1.5 flex items-center justify-between gap-2">
              {editingCategory && (
                <button
                  type="button"
                  onClick={onCancelEdit}
                  className="text-xs font-semibold text-muted-foreground hover:text-foreground"
                >
                  Cancelar edição
                </button>
              )}
              {search && (
                <button
                  type="button"
                  onClick={() => onSearchChange('')}
                  className="ml-auto text-xs font-semibold text-muted-foreground hover:text-foreground"
                >
                  Limpar busca
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
