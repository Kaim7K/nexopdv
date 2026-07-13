import React, { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { nexoApi } from '@/api/nexoApi';
import { toast } from 'react-hot-toast';
import { FilterX, Search, ScrollText } from 'lucide-react';
import { formatAuditDetails, formatDateTime } from '@/lib/helpers';
import { usePagination } from '@/hooks/use-pagination';
import PaginationControls from '@/components/common/PaginationControls';
import { ErrorState } from '@/components/common/PageState';

export default function AuditoriaGeral() {
  const [audits, setAudits] = useState([]);
  const [productAudits, setProductAudits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [filterType, setFilterType] = useState('');
  const [filterUser, setFilterUser] = useState('');
  const [filterCategory, setFilterCategory] = useState('');

  const loadAudits = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [general, product] = await Promise.all([
        nexoApi.entities.GeneralAudit.list('-created_date', 400),
        nexoApi.entities.ProductAudit.list('-created_date', 400),
      ]);
      setAudits(general);
      setProductAudits(product);
    } catch (error) {
      setLoadError(error.message || 'Não foi possível carregar a auditoria.');
      toast.error(error.message || 'Erro ao carregar auditoria.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAudits(); }, []);

  const allEntries = useMemo(() => [
    ...audits.map(audit => ({
      id: `general-${audit.id}`,
      date: audit.created_date,
      type: audit.action_type,
      user: audit.user_name,
      description: audit.description,
      details: audit.details,
      category: 'Geral',
    })),
    ...productAudits.map(audit => ({
      id: `product-${audit.id}`,
      date: audit.created_date,
      type: audit.change_origin,
      user: audit.user_name,
      description: `${audit.product_name}: ${audit.field_changed} alterado de “${audit.previous_value}” para “${audit.new_value}”${audit.sale_number ? ` · Venda #${audit.sale_number}` : ''}`,
      details: audit.observation || '',
      category: 'Produto',
    })),
  ].sort((first, second) => new Date(second.date).getTime() - new Date(first.date).getTime()), [audits, productAudits]);

  const actionTypes = useMemo(() => [...new Set(allEntries.map(entry => entry.type).filter(Boolean))].sort(), [allEntries]);
  const users = useMemo(() => [...new Set(allEntries.map(entry => entry.user).filter(Boolean))].sort(), [allEntries]);

  const filtered = useMemo(() => allEntries.filter(entry => {
    const query = deferredSearch.trim().toLowerCase();
    const details = formatAuditDetails(entry.details).toLowerCase();
    const matchSearch = !query
      || String(entry.description || '').toLowerCase().includes(query)
      || String(entry.user || '').toLowerCase().includes(query)
      || details.includes(query);
    return matchSearch
      && (!filterType || entry.type === filterType)
      && (!filterUser || entry.user === filterUser)
      && (!filterCategory || entry.category === filterCategory);
  }), [allEntries, deferredSearch, filterType, filterUser, filterCategory]);

  const clearFilters = () => {
    setSearch('');
    setFilterType('');
    setFilterUser('');
    setFilterCategory('');
  };
  const { page, setPage, pageCount, visibleItems: visibleEntries, pageSize } = usePagination(filtered, 25);

  const hasFilters = Boolean(search || filterType || filterUser || filterCategory);

  const typeColor = type => {
    if (type?.includes('preco')) return 'bg-amber-500/10 text-amber-700 dark:text-amber-300';
    if (type?.includes('concluida') || type?.includes('quitado')) return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
    if (type?.includes('cancel') || type?.includes('exclui')) return 'bg-red-500/10 text-red-700 dark:text-red-300';
    if (type?.includes('cadastr') || type?.includes('import')) return 'bg-blue-500/10 text-blue-700 dark:text-blue-300';
    return 'bg-muted text-muted-foreground';
  };

  return (
    <div className="page-shell !max-w-6xl">
      <div className="mb-6">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-accent/10 px-3 py-1 text-xs font-bold text-accent">
          <ScrollText className="h-3.5 w-3.5" /> Rastreabilidade
        </div>
        <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Auditoria geral</h1>
        <p className="mt-1 text-sm text-muted-foreground">Consulte alterações, vendas, cancelamentos e ações da equipe.</p>
      </div>

      <section className="mb-4 rounded-2xl border border-border bg-card p-3 shadow-sm" aria-label="Filtros da auditoria">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(250px,1fr)_190px_190px_150px_auto]">
          <label className="relative sm:col-span-2 lg:col-span-1">
            <span className="sr-only">Buscar na auditoria</span>
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Descrição, usuário ou detalhe" className="h-11 w-full rounded-xl border border-border bg-background pl-10 pr-4 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20" />
          </label>
          <select aria-label="Filtrar por tipo" value={filterType} onChange={event => setFilterType(event.target.value)} className="h-11 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20">
            <option value="">Todos os tipos</option>
            {actionTypes.map(type => <option key={type} value={type}>{humanize(type)}</option>)}
          </select>
          <select aria-label="Filtrar por usuário" value={filterUser} onChange={event => setFilterUser(event.target.value)} className="h-11 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20">
            <option value="">Todos os usuários</option>
            {users.map(name => <option key={name} value={name}>{name}</option>)}
          </select>
          <select aria-label="Filtrar por categoria" value={filterCategory} onChange={event => setFilterCategory(event.target.value)} className="h-11 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20">
            <option value="">Todas categorias</option>
            <option value="Geral">Geral</option>
            <option value="Produto">Produto</option>
          </select>
          {hasFilters && <button type="button" onClick={clearFilters} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border px-3 text-sm font-bold hover:bg-muted"><FilterX className="h-4 w-4" /> Limpar</button>}
        </div>
      </section>

      <div className="mb-3 flex items-center justify-between text-sm text-muted-foreground">
        <span>{filtered.length} de {allEntries.length} registros</span>
        <span>Mais recentes primeiro</span>
      </div>

      {loading ? (
        <div role="status" aria-live="polite" aria-busy="true" className="rounded-2xl border border-border bg-card py-16 text-center text-muted-foreground"><div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-accent" /><p className="text-sm">Carregando auditoria...</p></div>
      ) : loadError && !allEntries.length ? (
        <ErrorState description={loadError} onRetry={loadAudits} />
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card py-16 text-center"><ScrollText className="mx-auto h-11 w-11 text-muted-foreground/25" /><h2 className="mt-3 font-bold">Nenhum registro encontrado</h2><p className="mt-1 text-sm text-muted-foreground">Altere os filtros para ampliar a busca.</p>{hasFilters && <button type="button" onClick={clearFilters} className="mt-4 rounded-xl bg-accent px-4 py-2 text-sm font-bold text-accent-foreground">Limpar filtros</button>}</div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="max-h-[calc(100vh-270px)] divide-y divide-border overflow-y-auto">
            {visibleEntries.map(entry => {
              const details = formatAuditDetails(entry.details);
              return (
                <article key={entry.id} className="grid gap-3 p-4 transition hover:bg-muted/25 sm:grid-cols-[1fr_auto] sm:items-start">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${typeColor(entry.type)}`}>{humanize(entry.type)}</span>
                      <span className="rounded-full bg-muted px-2 py-1 text-[11px] font-semibold text-muted-foreground">{entry.category}</span>
                    </div>
                    <p className="mt-2 text-sm font-semibold leading-6">{entry.description}</p>
                    {details && <p className="mt-1 break-words text-xs leading-5 text-muted-foreground">{details}</p>}
                  </div>
                  <div className="text-left text-xs text-muted-foreground sm:min-w-[155px] sm:text-right">
                    <div className="font-semibold text-foreground">{entry.user || 'Sistema'}</div>
                    <div className="mt-1">{formatDateTime(entry.date)}</div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <PaginationControls page={page} pageCount={pageCount} total={filtered.length} pageSize={pageSize} onPageChange={setPage} />
      )}
    </div>
  );
}

function humanize(value) {
  return String(value || 'sem tipo')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, letter => letter.toUpperCase());
}
