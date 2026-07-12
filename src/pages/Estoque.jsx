import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { nexoApi } from '@/api/nexoApi';
import { toast } from 'react-hot-toast';
import { formatCurrency, formatDateTime } from '@/lib/helpers';
import {
  ArrowDownAZ,
  ArrowDownZA,
  ArrowRight,
  ArrowUpDown,
  Copy,
  Download,
  FilterX,
  Package,
  Pencil,
  Plus,
  Save,
  Search,
  Upload,
  Trash2,
} from 'lucide-react';
import ProductForm from '@/components/stock/ProductForm';
import { mergeProductCategories } from '@/lib/product-categories';
import { usePagination } from '@/hooks/use-pagination';
import PaginationControls from '@/components/common/PaginationControls';

const EDITABLE_COLUMNS = [
  ['name', 'Produto', 'text'],
  ['category', 'Categoria', 'text'],
  ['barcode', 'Código de barras', 'text'],
  ['internal_code', 'Código interno', 'text'],
  ['sale_price', 'Preço venda', 'number'],
  ['cost_price', 'Preço custo', 'number'],
  ['quantity', 'Estoque', 'number'],
  ['unit', 'Unidade', 'text'],
  ['status', 'Status', 'text'],
];

const TABLE_COLUMNS = [
  ...EDITABLE_COLUMNS.slice(0, 8),
  ['last_sale_at', 'Última venda', 'date'],
  EDITABLE_COLUMNS[8],
];

const normalize = (value, type) => type === 'number'
  ? (value === '' ? '' : Number(value))
  : String(value ?? '');

const collator = new Intl.Collator('pt-BR', { numeric: true, sensitivity: 'base' });
const productNameKey = value => String(value || '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').replace(/\s+/g, ' ');

const discardDuplicateProducts = items => {
  const seenNames = new Set();
  const seenBarcodes = new Set();
  const products = items.filter(product => {
    const name = productNameKey(product.name);
    const barcode = String(product.barcode || '').trim();
    if (seenNames.has(name) || (barcode && seenBarcodes.has(barcode))) return false;
    seenNames.add(name);
    if (barcode) seenBarcodes.add(barcode);
    return true;
  });
  return { products, discarded: items.length - products.length };
};

export default function Estoque() {
  const { user, config } = /** @type {any} */ (useOutletContext());
  const fileRef = useRef(null);
  const tableRef = useRef(null);
  const lowStockThreshold = Math.max(1, Number.parseInt(config?.limite_estoque_baixo, 10) || 5);
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [stock, setStock] = useState('todos');
  const [dirty, setDirty] = useState(new Set());
  const [productModal, setProductModal] = useState(null);
  const [sort, setSort] = useState({ key: 'name', direction: 'asc' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [deletingInactive, setDeletingInactive] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setProducts(await nexoApi.products.catalog(2000));
      setDirty(new Set());
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!dirty.size) return undefined;
    const warnBeforeLeave = event => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnBeforeLeave);
    return () => window.removeEventListener('beforeunload', warnBeforeLeave);
  }, [dirty]);

  const categories = useMemo(() => (
    mergeProductCategories(products.map(product => product.category))
  ), [products]);

  const filtered = useMemo(() => {
    const searchText = search.toLowerCase();
    const min = minPrice === '' ? null : Number(minPrice);
    const max = maxPrice === '' ? null : Number(maxPrice);
    const visible = products.filter(product => (
      (!searchText || [product.name, product.category, product.barcode, product.internal_code].some(value => String(value || '').toLowerCase().includes(searchText)))
      && (!category || product.category === category)
      && (min === null || Number(product.sale_price || 0) >= min)
      && (max === null || Number(product.sale_price || 0) <= max)
      && (stock === 'todos'
        || (stock === 'disponivel' && Number(product.quantity || 0) > lowStockThreshold)
        || (stock === 'baixo' && Number(product.quantity || 0) > 0 && Number(product.quantity || 0) <= lowStockThreshold)
        || (stock === 'zerado' && Number(product.quantity || 0) <= 0))
    ));

    const column = TABLE_COLUMNS.find(([key]) => key === sort.key);
    const type = column?.[2] || 'text';
    return [...visible].sort((a, b) => {
      const first = a[sort.key];
      const second = b[sort.key];
      let result;
      if (type === 'number') result = Number(first || 0) - Number(second || 0);
      else if (type === 'date') result = (first ? new Date(first).getTime() : 0) - (second ? new Date(second).getTime() : 0);
      else result = collator.compare(String(first || ''), String(second || ''));
      return sort.direction === 'asc' ? result : -result;
    });
  }, [products, search, category, minPrice, maxPrice, stock, sort, lowStockThreshold]);

  const { page, setPage, pageCount, visibleItems: visibleProducts, pageSize } = usePagination(filtered, 50);

  const toggleSort = key => {
    setSort(current => current.key === key
      ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
      : { key, direction: 'asc' });
  };

  const SortIcon = ({ column }) => {
    if (sort.key !== column) return <ArrowUpDown className="h-4 w-4 opacity-40" />;
    return sort.direction === 'asc'
      ? <ArrowDownAZ className="h-4 w-4 text-accent" />
      : <ArrowDownZA className="h-4 w-4 text-accent" />;
  };

  const editInline = (id, key, value, type) => {
    setProducts(current => current.map(product => product.id === id ? { ...product, [key]: normalize(value, type) } : product));
    setDirty(current => new Set(current).add(id));
  };

  const saveInline = async () => {
    const changed = products.filter(product => dirty.has(product.id));
    if (!changed.length) return;
    if (changed.some(product => !product.name?.trim() || Number(product.sale_price) < 0 || Number(product.quantity) < 0)) {
      toast.error('Revise nome, preço e quantidade dos produtos alterados.');
      return;
    }
    setSaving(true);
    try {
      await nexoApi.stock.bulkUpdate(changed.map(product => ({ id: product.id, ...Object.fromEntries(EDITABLE_COLUMNS.map(([key]) => [key, product[key]])) })));
      setDirty(new Set());
      setProducts(current => current.map(product => dirty.has(product.id) ? { ...product, updated_date: new Date().toISOString() } : product));
      nexoApi.cache.clear();
      toast.success('Estoque atualizado.');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const download = async () => {
    setExporting(true);
    try {
      const XLSX = await import('@e965/xlsx');
      const rows = products.map(product => Object.fromEntries([
        ['ID', product.id],
        ...EDITABLE_COLUMNS.map(([key, label]) => [label, product[key] ?? '']),
        ['Última venda', product.last_sale_at ? formatDateTime(product.last_sale_at) : 'Nunca vendido'],
      ]));
      const sheet = XLSX.utils.json_to_sheet(rows);
      const book = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(book, sheet, 'Estoque');
      XLSX.writeFile(book, 'estoque-nexo-pdv.xlsx');
      toast.success('Planilha gerada.');
    } catch (error) {
      toast.error(error.message || 'Não foi possível gerar a planilha.');
    } finally {
      setExporting(false);
    }
  };

  const uploadSpreadsheet = async event => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setImporting(true);
    try {
      if (file.size > 8 * 1024 * 1024) throw new Error('A planilha deve ter no máximo 8 MB.');
      const XLSX = await import('@e965/xlsx');
      const book = XLSX.read(await file.arrayBuffer());
      const sheet = book.Sheets[book.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      if (!rows.length) throw new Error('A planilha está vazia.');
      if (rows.length > 5000) throw new Error('A planilha pode ter no máximo 5.000 produtos por importação.');
      const mapped = rows.map(row => ({
        id: row.ID || undefined,
        ...Object.fromEntries(EDITABLE_COLUMNS.map(([key, label, type]) => [key, normalize(row[label], type)])),
      }));
      if (mapped.some(product => !product.name.trim() || Number(product.sale_price) < 0 || Number(product.quantity) < 0)) {
        throw new Error('Há produtos com nome, preço ou quantidade inválidos.');
      }
      const unique = discardDuplicateProducts(mapped);
      const preview = await nexoApi.stock.bulkUpdate(unique.products, 'preview');
      let existingMode = 'update';
      if (Number(preview.existing || 0) > 0) {
        const updateExisting = window.confirm(
          `${preview.existing} produto(s) da planilha já existem no estoque.\n\n` +
          'OK: atualizar os produtos existentes com os valores da planilha.\n' +
          'Cancelar: manter os valores atuais e importar somente produtos novos.'
        );
        existingMode = updateExisting ? 'update' : 'keep';
      }
      const result = await nexoApi.stock.bulkUpdate(unique.products, existingMode);
      const discarded = Math.max(unique.discarded, Number(result.discarded || 0));
      const action = existingMode === 'update' ? 'atualizado(s)/importado(s)' : 'novo(s) importado(s)';
      toast.success(`${Number(result.updated || 0)} produto(s) ${action}.${discarded ? ` ${discarded} repetido(s) descartado(s).` : ''}`);
      await load();
    } catch (error) {
      toast.error(error.message || 'Não foi possível importar a planilha.');
    } finally {
      setImporting(false);
    }
  };

  const openProductModal = async (mode, product = null) => {
    if (!product || mode === 'create') {
      setProductModal({ mode: 'create' });
      return;
    }
    if (mode === 'edit' || !product.image_is_inline) {
      setProductModal({ mode, product });
      return;
    }
    setProductModal({ mode: 'loading', product });
    try {
      const fullProduct = await nexoApi.entities.Product.get(product.id);
      setProductModal({ mode, product: fullProduct });
    } catch (error) {
      setProductModal(null);
      toast.error(error.message || 'Não foi possível abrir o produto.');
    }
  };

  const closeModal = () => setProductModal(null);
  const handleModalSave = (saved, options = {}) => {
    const rawImage = String(saved?.image_url || '');
    const normalized = {
      ...saved,
      image_is_inline: rawImage.startsWith('data:image/'),
      image_url: rawImage.startsWith('data:image/') ? `/api/product-media/${saved.id}?v=${Date.now()}` : rawImage,
    };
    setProducts(current => {
      const exists = current.some(product => product.id === normalized.id);
      return exists
        ? current.map(product => product.id === normalized.id ? { ...product, ...normalized } : product)
        : [normalized, ...current];
    });
    nexoApi.cache.clear();
    if (!options.keepOpen) closeModal();
  };

  const handleDeleteProduct = async product => {
    if (!['admin', 'gerente'].includes(user.role) || deletingId) return;
    const confirmed = window.confirm(`Excluir "${product.name}" do estoque? O produto será removido do cadastro, mas vendas antigas continuarão no histórico.`);
    if (!confirmed) return;

    setDeletingId(product.id);
    try {
      await nexoApi.entities.Product.delete(product.id);
      setProducts(current => current.filter(item => item.id !== product.id));
      setDirty(current => {
        const next = new Set(current);
        next.delete(product.id);
        return next;
      });
      toast.success('Produto excluído do estoque.');
    } catch (error) {
      if (error.status === 404) {
        setProducts(current => current.filter(item => item.id !== product.id));
        nexoApi.cache.clear();
        toast.success('O produto já havia sido excluído. A lista foi atualizada.');
      } else {
        toast.error(error.message || 'Não foi possível excluir o produto.');
      }
    } finally {
      setDeletingId(null);
    }
  };

  const inactivityCutoff = useMemo(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 2);
    return date;
  }, [products.length]);
  const inactiveCandidates = useMemo(() => products.filter(product => {
    const reference = product.last_sale_at || product.created_date;
    const timestamp = reference ? new Date(reference).getTime() : 0;
    return Number.isFinite(timestamp) && timestamp < inactivityCutoff.getTime();
  }), [products, inactivityCutoff]);

  const handleDeleteInactive = async () => {
    if (!['admin', 'gerente'].includes(user.role) || deletingInactive || !inactiveCandidates.length) return;
    const confirmed = window.confirm(`Apagar ${inactiveCandidates.length} produto(s) sem venda há pelo menos 2 meses? Vendas antigas continuarão no histórico.`);
    if (!confirmed) return;
    setDeletingInactive(true);
    try {
      const result = await nexoApi.products.deleteInactive();
      toast.success(`${Number(result.deleted || 0)} produto(s) inativo(s) apagado(s).`);
      await load();
    } catch (error) {
      toast.error(error.message || 'Não foi possível apagar os produtos inativos.');
    } finally {
      setDeletingInactive(false);
    }
  };

  const hasFilters = Boolean(search || category || minPrice || maxPrice || stock !== 'todos');
  const clearFilters = () => {
    setSearch('');
    setCategory('');
    setMinPrice('');
    setMaxPrice('');
    setStock('todos');
  };
  const zeroStockCount = products.filter(product => Number(product.quantity || 0) <= 0).length;
  const lowStockCount = products.filter(product => Number(product.quantity || 0) > 0 && Number(product.quantity || 0) <= lowStockThreshold).length;
  const focusStock = filter => {
    setStock(filter);
    setPage(1);
    window.setTimeout(() => tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  return (
    <div className="mx-auto max-w-[1700px] p-4 sm:p-6 lg:p-8">
      <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-accent/10 px-3 py-1 text-xs font-bold text-accent">
            <Package className="h-3.5 w-3.5" /> Produtos e quantidades
          </div>
          <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Estoque</h1>
          <p className="mt-1 text-sm text-muted-foreground">Edite direto na tabela ou use o cadastro completo.</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
          <button type="button" onClick={download} disabled={exporting || loading} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-bold transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50">
            <Download className="h-4 w-4" /> {exporting ? 'Gerando...' : 'Baixar Excel'}
          </button>
          <button type="button" onClick={() => fileRef.current?.click()} disabled={importing || loading} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-bold transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50">
            <Upload className="h-4 w-4" /> {importing ? 'Importando...' : 'Importar'}
          </button>
          <input ref={fileRef} hidden type="file" accept=".xlsx,.xls,.csv" onChange={uploadSpreadsheet} />
          <button type="button" disabled={!dirty.size || saving} onClick={saveInline} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-bold text-accent-foreground transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground">
            <Save className="h-4 w-4" /> {saving ? 'Salvando...' : dirty.size ? `Salvar ${dirty.size}` : 'Tudo salvo'}
          </button>
          {['admin', 'gerente'].includes(user.role) && (
            <button type="button" onClick={handleDeleteInactive} disabled={deletingInactive || !inactiveCandidates.length || loading} title="Apaga produtos que não possuem venda há pelo menos 2 meses" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-destructive/30 bg-card px-4 text-sm font-bold text-destructive transition hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-40">
              <Trash2 className="h-4 w-4" /> {deletingInactive ? 'Apagando...' : `Apagar inativos${inactiveCandidates.length ? ` (${inactiveCandidates.length})` : ''}`}
            </button>
          )}
          <button type="button" onClick={() => openProductModal('create')} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground transition hover:bg-primary/90">
            <Plus className="h-4 w-4" /> Novo produto
          </button>
        </div>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StockMetric label="Produtos cadastrados" value={products.length} hint="Todos os itens" />
        <StockMetric label="Estoque baixo" value={lowStockCount} low={lowStockCount > 0} active={stock === 'baixo'} hint={lowStockCount ? `Até ${lowStockThreshold} unidades · clique para ver` : 'Nenhum alerta'} onClick={() => focusStock('baixo')} />
        <StockMetric label="Sem estoque" value={zeroStockCount} alert={zeroStockCount > 0} active={stock === 'zerado'} hint={zeroStockCount ? 'Clique para atualizar os produtos' : 'Nenhum produto zerado'} onClick={() => focusStock('zerado')} />
        <StockMetric label="Alterações pendentes" value={dirty.size} pending={dirty.size > 0} hint={dirty.size ? 'Salve para aplicar' : 'Tudo atualizado'} />
      </div>

      <section className="mb-4 rounded-2xl border border-border bg-card p-3 shadow-sm" aria-label="Filtros do estoque">
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-[minmax(260px,1.5fr)_220px_180px_180px_190px_auto]">
          <label className="relative md:col-span-2 xl:col-span-1">
            <span className="sr-only">Pesquisar produtos</span>
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input className="h-11 w-full rounded-xl border border-border bg-background pl-10 pr-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20" placeholder="Produto, categoria ou código" value={search} onChange={event => setSearch(event.target.value)} />
          </label>
          <select aria-label="Filtrar por categoria" className="h-11 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20" value={category} onChange={event => setCategory(event.target.value)}>
            <option value="">Todas as categorias</option>
            {categories.map(value => <option key={value}>{value}</option>)}
          </select>
          <label className="sr-only" htmlFor="min-price">Preço mínimo</label>
          <input id="min-price" className="h-11 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20" type="number" min="0" step="0.01" placeholder="Preço mínimo" value={minPrice} onChange={event => setMinPrice(event.target.value)} />
          <label className="sr-only" htmlFor="max-price">Preço máximo</label>
          <input id="max-price" className="h-11 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20" type="number" min="0" step="0.01" placeholder="Preço máximo" value={maxPrice} onChange={event => setMaxPrice(event.target.value)} />
          <select aria-label="Filtrar por disponibilidade" className="h-11 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20" value={stock} onChange={event => setStock(event.target.value)}>
            <option value="todos">Qualquer estoque</option>
            <option value="disponivel">Estoque normal</option>
            <option value="baixo">Estoque baixo</option>
            <option value="zerado">Sem estoque</option>
          </select>
          {hasFilters && <button type="button" onClick={clearFilters} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border px-3 text-sm font-bold hover:bg-muted"><FilterX className="h-4 w-4" /> Limpar</button>}
        </div>
      </section>

      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{filtered.length} de {products.length} produtos</span>
        <span className="md:hidden">Deslize a tabela para editar todas as colunas.</span>
      </div>

      <div ref={tableRef} className="max-h-[calc(100vh-300px)] min-h-[360px] scroll-mt-4 overflow-auto rounded-2xl border border-border bg-card shadow-sm">
        {loading ? (
          <div className="grid min-h-[360px] place-items-center text-sm text-muted-foreground"><div className="text-center"><div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-accent" />Carregando estoque...</div></div>
        ) : (
          <table className="w-full min-w-[1480px] whitespace-nowrap text-sm">
            <thead className="sticky top-0 z-20 bg-secondary text-secondary-foreground shadow-sm">
              <tr>
                <th className="sticky left-0 z-30 bg-secondary p-3 text-left"><span className="sr-only">Imagem</span><Package className="h-5 w-5" /></th>
                {TABLE_COLUMNS.map(([key, label]) => (
                  <th key={key} className={`p-0 text-left ${key === 'name' ? 'sticky left-14 z-30 bg-secondary' : ''}`}>
                    <button type="button" onClick={() => toggleSort(key)} className="flex w-full min-w-[135px] items-center gap-2 px-3 py-3 font-semibold hover:bg-muted" aria-label={`Ordenar por ${label}`}>
                      {label} <SortIcon column={key} />
                    </button>
                  </th>
                ))}
                <th className="sticky right-0 z-30 bg-secondary px-3 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {visibleProducts.map(product => {
                const quantity = Number(product.quantity || 0);
                const isZero = quantity <= 0;
                const isLow = !isZero && quantity <= lowStockThreshold;
                const rowBackground = dirty.has(product.id) ? 'bg-amber-500/10' : isZero ? 'bg-red-500/10' : isLow ? 'bg-amber-500/5' : '';
                const stickyBackground = dirty.has(product.id) ? 'bg-amber-50 dark:bg-amber-950/30' : isZero ? 'bg-red-50 dark:bg-red-950/30' : isLow ? 'bg-amber-50 dark:bg-amber-950/20' : 'bg-card';
                const hasCostPrice = product.cost_price !== null && product.cost_price !== '' && Number.isFinite(Number(product.cost_price));
                const unitProfit = Number(product.sale_price || 0) - Number(product.cost_price || 0);
                return (
                <tr key={product.id} className={`border-t border-border transition hover:bg-muted/25 ${rowBackground}`}>
                  <td className={`sticky left-0 z-10 p-2 ${stickyBackground}`}>
                    <button type="button" onClick={() => openProductModal('edit', product)} className="grid h-10 w-10 place-items-center overflow-hidden rounded-xl border border-border bg-white" aria-label={`Editar ${product.name}`}>
                      {product.image_url ? <img src={product.image_url} alt="" className="h-full w-full object-contain p-1" loading="lazy" referrerPolicy="no-referrer" /> : <Package className="h-5 w-5 text-muted-foreground" />}
                    </button>
                  </td>
                  {TABLE_COLUMNS.map(([key, label, type]) => (
                    <td key={key} className={`p-1 ${key === 'name' ? `sticky left-14 z-10 ${stickyBackground}` : ''}`}>
                      {key === 'last_sale_at' ? (
                        <div className="min-w-[150px] px-2"><span className="block text-sm font-bold">{product.last_sale_at ? formatDateTime(product.last_sale_at) : 'Nunca vendido'}</span><span className="mt-0.5 block text-[10px] text-muted-foreground">{product.last_sale_at ? 'Última saída registrada' : 'Sem vendas registradas'}</span></div>
                      ) : key === 'sale_price' || key === 'cost_price' ? (
                        <div className="min-w-[145px] px-1">
                          <label className="relative block"><span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">R$</span><input aria-label={`${label} de ${product.name}`} className="h-10 w-full rounded-lg border border-transparent bg-transparent pl-8 pr-2 text-sm font-bold hover:border-border focus:border-accent focus:bg-background focus:outline-none" type="number" min="0" step="0.01" value={product[key] ?? ''} onChange={event => editInline(product.id, key, event.target.value, type)} /></label>
                          {key === 'sale_price' && hasCostPrice && <span className={`mt-0.5 block px-2 text-[10px] font-bold ${unitProfit >= 0 ? 'text-emerald-600 dark:text-emerald-300' : 'text-red-600 dark:text-red-300'}`}>{unitProfit >= 0 ? '+ ' : '− '}{formatCurrency(Math.abs(unitProfit))}</span>}
                        </div>
                      ) : key === 'status' ? (
                        <select aria-label={`${label} de ${product.name}`} className="h-10 w-full min-w-[120px] rounded-lg border border-transparent bg-transparent px-2 hover:border-border focus:border-accent focus:bg-background focus:outline-none" value={product.status || 'ativo'} onChange={event => editInline(product.id, key, event.target.value, type)}>
                          <option value="ativo">Ativo</option>
                          <option value="inativo">Inativo</option>
                        </select>
                      ) : key === 'unit' ? (
                        <select aria-label={`${label} de ${product.name}`} className="h-10 w-full min-w-[110px] rounded-lg border border-transparent bg-transparent px-2 hover:border-border focus:border-accent focus:bg-background focus:outline-none" value={product.unit || 'unidade'} onChange={event => editInline(product.id, key, event.target.value, type)}>
                          <option value="unidade">Unidade</option>
                          <option value="peso">Peso</option>
                        </select>
                      ) : (
                        <input
                          aria-label={`${label} de ${product.name}`}
                          className="h-10 w-full min-w-[135px] rounded-lg border border-transparent bg-transparent px-2 hover:border-border focus:border-accent focus:bg-background focus:outline-none"
                          type={type}
                          min={type === 'number' ? '0' : undefined}
                          step={key === 'sale_price' || key === 'cost_price' ? '0.01' : 'any'}
                          value={product[key] ?? ''}
                          onChange={event => editInline(product.id, key, event.target.value, type)}
                        />
                      )}
                    </td>
                  ))}
                  <td className={`sticky right-0 z-10 p-2 ${stickyBackground}`}>
                    <div className="flex justify-end gap-1">
                      {isZero && <button type="button" onClick={() => openProductModal('edit', product)} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-red-500/35 bg-red-500/10 px-3 text-xs font-bold text-red-700 hover:bg-red-500/15 dark:text-red-300">Atualizar estoque <ArrowRight className="h-3.5 w-3.5" /></button>}
                      <button type="button" onClick={() => openProductModal('edit', product)} className="grid h-9 w-9 place-items-center rounded-lg border border-border text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={`Editar ${product.name} no formulário`} title="Editar no formulário"><Pencil className="h-[18px] w-[18px]" /></button>
                      <button type="button" onClick={() => openProductModal('duplicate', product)} className="grid h-9 w-9 place-items-center rounded-lg border border-border text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={`Duplicar ${product.name}`} title="Duplicar produto"><Copy className="h-[18px] w-[18px]" /></button>
                      {['admin', 'gerente'].includes(user.role) && (
                        <button type="button" disabled={deletingId === product.id} onClick={() => handleDeleteProduct(product)} className="grid h-9 w-9 place-items-center rounded-lg border border-destructive/25 text-destructive transition hover:bg-destructive/10 disabled:cursor-wait disabled:opacity-50" aria-label={`Excluir ${product.name}`} title="Excluir produto"><Trash2 className="h-[18px] w-[18px]" /></button>
                      )}
                    </div>
                  </td>
                </tr>
                );
              })}
              {!filtered.length && <tr><td colSpan={TABLE_COLUMNS.length + 2} className="p-16 text-center"><Package className="mx-auto h-10 w-10 text-muted-foreground/25" /><p className="mt-3 font-bold">Nenhum produto encontrado</p><p className="mt-1 text-sm text-muted-foreground">Altere os filtros ou cadastre um novo produto.</p>{hasFilters && <button type="button" onClick={clearFilters} className="mt-4 rounded-xl bg-accent px-4 py-2 text-sm font-bold text-accent-foreground">Limpar filtros</button>}</td></tr>}
            </tbody>
          </table>
        )}
      </div>

      {!loading && filtered.length > 0 && (
        <PaginationControls page={page} pageCount={pageCount} total={filtered.length} pageSize={pageSize} onPageChange={setPage} />
      )}

      {productModal?.mode === 'loading' && <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm"><div className="rounded-2xl border border-border bg-card px-8 py-7 text-center shadow-2xl"><div className="mx-auto h-7 w-7 animate-spin rounded-full border-4 border-muted border-t-accent" /><p className="mt-3 text-sm font-bold">Carregando produto...</p></div></div>}
      {productModal && productModal.mode !== 'loading' && <ProductForm product={productModal.mode === 'edit' ? productModal.product : null} duplicateSource={productModal.mode === 'duplicate' ? productModal.product : null} categories={categories} user={user} onClose={closeModal} onSave={handleModalSave} />}
    </div>
  );
}

function StockMetric({ label, value, alert = false, low = false, pending = false, active = false, hint = '', onClick }) {
  const valueClass = alert ? 'text-red-600 dark:text-red-300' : low || pending ? 'text-amber-600 dark:text-amber-300' : 'text-foreground';
  const borderClass = alert ? 'border-red-500/35' : low ? 'border-amber-400/45' : 'border-border';
  const Component = onClick ? 'button' : 'div';
  return (
    <Component type={onClick ? 'button' : undefined} onClick={onClick} className={`rounded-2xl border bg-card p-4 text-left shadow-sm transition ${borderClass} ${onClick ? 'hover:-translate-y-0.5 hover:shadow-md' : ''} ${active ? 'ring-2 ring-accent/25' : ''}`}>
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      <strong className={`mt-1 block text-2xl font-bold tabular-nums ${valueClass}`}>{value}</strong>
      {hint && <span className="mt-1 block text-[11px] text-muted-foreground">{hint}</span>}
    </Component>
  );
}
