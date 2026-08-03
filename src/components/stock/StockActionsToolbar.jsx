import React, { forwardRef } from 'react';
import { ChevronDown, Download, Plus, Save, Trash2, Upload } from 'lucide-react';

/**
 * @typedef {Object} StockActionsProps
 * @property {boolean} loading
 * @property {boolean} exporting
 * @property {boolean} importing
 * @property {boolean} saving
 * @property {number} dirtyCount
 * @property {boolean} canDeleteInactive
 * @property {boolean} deletingInactive
 * @property {number} inactiveCount
 * @property {() => void} onExport
 * @property {(event: any) => void} onImport
 * @property {() => void} onSave
 * @property {() => void} onDeleteInactive
 * @property {() => void} onCreate
 */

/** @type {React.ForwardRefExoticComponent<StockActionsProps & React.RefAttributes<HTMLInputElement>>} */
const StockActionsToolbar = forwardRef(function StockActionsToolbar(
  props,
  fileRef,
) {
  const {
    loading,
    exporting,
    importing,
    saving,
    dirtyCount,
    canDeleteInactive,
    deletingInactive,
    inactiveCount,
    onExport,
    onImport,
    onSave,
    onDeleteInactive,
    onCreate,
  } = props;
  const openFilePicker = () => {
    if (fileRef && typeof fileRef === 'object') fileRef.current?.click();
  };
  const exportLabel = exporting ? 'Gerando...' : 'Baixar Excel';
  const importLabel = importing ? 'Importando...' : 'Importar';
  const saveLabel = saving
    ? 'Salvando...'
    : dirtyCount
      ? `Salvar ${dirtyCount}`
      : 'Tudo salvo';
  const inactiveLabel = deletingInactive
    ? 'Apagando...'
    : `Apagar inativos${inactiveCount ? ` (${inactiveCount})` : ''}`;

  return (
    <div className="grid gap-1.5 sm:flex sm:flex-wrap sm:items-center sm:gap-2">
      <input
        ref={fileRef}
        hidden
        type="file"
        accept=".xlsx,.xls,.csv"
        onChange={onImport}
      />

      <div className="mobile-primary-row">
        <button
          type="button"
          disabled={!dirtyCount || saving}
          onClick={onSave}
          className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg bg-accent px-3 text-xs font-bold text-accent-foreground transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground sm:min-h-10 sm:gap-2 sm:px-4 sm:text-sm"
        >
          <Save className="h-4 w-4" /> {saveLabel}
        </button>
        <button
          type="button"
          onClick={onCreate}
          className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-bold text-primary-foreground transition hover:bg-primary/90 sm:min-h-10 sm:gap-2 sm:px-4 sm:text-sm"
        >
          <Plus className="h-4 w-4" /> Novo produto
        </button>
      </div>

      <details className="group mobile-secondary-panel sm:hidden">
        <summary className="mobile-secondary-summary">
          <span>Mais ações</span>
          <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
        </summary>
        <div className="grid gap-1.5 border-t border-border p-1.5">
          <SecondaryButton
            icon={Download}
            onClick={onExport}
            disabled={exporting || loading}
          >
            {exportLabel}
          </SecondaryButton>
          <SecondaryButton
            icon={Upload}
            onClick={openFilePicker}
            disabled={importing || loading}
          >
            {importLabel}
          </SecondaryButton>
          {canDeleteInactive && (
            <SecondaryButton
              destructive
              icon={Trash2}
              onClick={onDeleteInactive}
              disabled={deletingInactive || !inactiveCount || loading}
            >
              {inactiveLabel}
            </SecondaryButton>
          )}
        </div>
      </details>

      <div className="hidden flex-wrap items-center gap-2 sm:flex">
        <SecondaryButton
          icon={Download}
          onClick={onExport}
          disabled={exporting || loading}
        >
          {exportLabel}
        </SecondaryButton>
        <SecondaryButton
          icon={Upload}
          onClick={openFilePicker}
          disabled={importing || loading}
        >
          {importLabel}
        </SecondaryButton>
        {canDeleteInactive && (
          <SecondaryButton
            destructive
            icon={Trash2}
            onClick={onDeleteInactive}
            disabled={deletingInactive || !inactiveCount || loading}
            title="Apaga produtos que não possuem venda há pelo menos 2 meses"
          >
            {inactiveLabel}
          </SecondaryButton>
        )}
      </div>
    </div>
  );
});

function SecondaryButton({
  children,
  icon: Icon,
  onClick,
  disabled = false,
  destructive = false,
  title = undefined,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border bg-card px-3 text-xs font-bold transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-10 sm:gap-2 sm:px-4 sm:text-sm ${
        destructive
          ? 'border-destructive/30 text-destructive hover:bg-destructive/10'
          : 'border-border'
      }`}
    >
      {Icon && <Icon className="h-4 w-4" />}
      {children}
    </button>
  );
}

export default StockActionsToolbar;
