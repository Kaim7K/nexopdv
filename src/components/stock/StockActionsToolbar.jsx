import React, { forwardRef } from 'react';
import { Download, Plus, Save, Trash2, Upload } from 'lucide-react';

const StockActionsToolbar = forwardRef(function StockActionsToolbar(
  {
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
  },
  fileRef,
) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
      <button
        type="button"
        onClick={onExport}
        disabled={exporting || loading}
        className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 text-xs font-bold transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-11 sm:gap-2 sm:rounded-xl sm:px-4 sm:text-sm"
      >
        <Download className="h-4 w-4" />{' '}
        {exporting ? 'Gerando...' : 'Baixar Excel'}
      </button>
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={importing || loading}
        className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 text-xs font-bold transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-11 sm:gap-2 sm:rounded-xl sm:px-4 sm:text-sm"
      >
        <Upload className="h-4 w-4" />{' '}
        {importing ? 'Importando...' : 'Importar'}
      </button>
      <input
        ref={fileRef}
        hidden
        type="file"
        accept=".xlsx,.xls,.csv"
        onChange={onImport}
      />
      <button
        type="button"
        disabled={!dirtyCount || saving}
        onClick={onSave}
        className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg bg-accent px-3 text-xs font-bold text-accent-foreground transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground sm:min-h-11 sm:gap-2 sm:rounded-xl sm:px-4 sm:text-sm"
      >
        <Save className="h-4 w-4" />{' '}
        {saving
          ? 'Salvando...'
          : dirtyCount
            ? `Salvar ${dirtyCount}`
            : 'Tudo salvo'}
      </button>
      {canDeleteInactive && (
        <button
          type="button"
          onClick={onDeleteInactive}
          disabled={deletingInactive || !inactiveCount || loading}
          title="Apaga produtos que não possuem venda há pelo menos 2 meses"
          className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-destructive/30 bg-card px-3 text-xs font-bold text-destructive transition hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-40 sm:min-h-11 sm:gap-2 sm:rounded-xl sm:px-4 sm:text-sm"
        >
          <Trash2 className="h-4 w-4" />{' '}
          {deletingInactive
            ? 'Apagando...'
            : `Apagar inativos${inactiveCount ? ` (${inactiveCount})` : ''}`}
        </button>
      )}
      <button
        type="button"
        onClick={onCreate}
        className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-bold text-primary-foreground transition hover:bg-primary/90 sm:min-h-11 sm:gap-2 sm:rounded-xl sm:px-4 sm:text-sm"
      >
        <Plus className="h-4 w-4" /> Novo produto
      </button>
    </div>
  );
});

export default StockActionsToolbar;
