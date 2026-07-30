import React, {
  lazy,
  Suspense,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useOutletContext } from 'react-router-dom';
import { nexoApi } from '@/api/nexoApi';
import { toast } from 'react-hot-toast';
import { formatDateTime } from '@/lib/helpers';
import {
  ArrowDownAZ,
  ArrowDownZA,
  ArrowUpDown,
  Package,
} from 'lucide-react';
import {
  mergeProductCategories,
  parseProductCategories,
} from '@/lib/product-categories';
import {
  EDITABLE_COLUMNS,
  TABLE_COLUMNS,
  discardDuplicateProducts,
  normalizeHeader,
  normalizeImportedImageUrl,
  normalizeStockValue,
  pickRowValue,
  safeFilePart,
} from '@/lib/stock-helpers';
import { usePagination } from '@/hooks/use-pagination';
import PaginationControls from '@/components/common/PaginationControls';
import { useConfirm } from '@/components/common/ConfirmProvider';
import { ErrorState } from '@/components/common/PageState';
import { PageHeader } from '@/components/common/AppShell';
import StockActionsToolbar from '@/components/stock/StockActionsToolbar';
import StockFilters from '@/components/stock/StockFilters';
import StockMetric from '@/components/stock/StockMetric';
import StockProductViews from '@/components/stock/StockProductViews';

const ProductForm = lazy(() => import('@/components/stock/ProductForm'));

const collator = new Intl.Collator('pt-BR', {
  numeric: true,
  sensitivity: 'base',
});

export default function Estoque() {
  const confirm = useConfirm();
  const { user, config } = /** @type {any} */ (useOutletContext());
  const fileRef = useRef(null);
  const tableRef = useRef(null);
  const pendingViewRef = useRef(null);
  const autosaveTimerRef = useRef(null);
  const lowStockThreshold = Math.max(
    1,
    Number.parseInt(config?.limite_estoque_baixo, 10) || 5,
  );
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [category, setCategory] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [stock, setStock] = useState('todos');
  const [imageFilter, setImageFilter] = useState('all');
  const [pageSize, setPageSize] = useState(() =>
    Math.max(10, Number(localStorage.getItem('nexo-estoque-page-size') || 50)),
  );
  const [viewMode, setViewMode] = useState(
    () => localStorage.getItem('nexo-estoque-view-mode') || 'table',
  );
  const [dirty, setDirty] = useState(new Set());
  const [productModal, setProductModal] = useState(null);
  const [sort, setSort] = useState({ key: 'name', direction: 'asc' });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [deletingInactive, setDeletingInactive] = useState(false);

  const load = async () => {
    setLoading(true);
    setLoadError('');
    try {
      setProducts(await nexoApi.products.catalog(2000));
      setDirty(new Set());
    } catch (error) {
      setLoadError(error.message || 'Não foi possível carregar o estoque.');
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    localStorage.setItem('nexo-estoque-page-size', String(pageSize));
  }, [pageSize]);

  useEffect(() => {
    localStorage.setItem('nexo-estoque-view-mode', viewMode);
  }, [viewMode]);

  useEffect(() => {
    if (!dirty.size) return undefined;
    const warnBeforeLeave = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnBeforeLeave);
    return () => window.removeEventListener('beforeunload', warnBeforeLeave);
  }, [dirty]);

  useEffect(() => {
    if (!dirty.size || loading || saving || importing) return undefined;
    window.clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = window.setTimeout(() => {
      if (dirty.size) void saveInline();
    }, 900);
    return () => window.clearTimeout(autosaveTimerRef.current);
  }, [dirty, loading, saving, importing, products]);

  const categories = useMemo(
    () =>
      mergeProductCategories(
        products.map((product) => product.category),
        parseProductCategories(config?.product_categories),
      ),
    [products, config?.product_categories],
  );

  const filtered = useMemo(() => {
    const searchText = deferredSearch.toLowerCase();
    const min = minPrice === '' ? null : Number(minPrice);
    const max = maxPrice === '' ? null : Number(maxPrice);
    const visible = products.filter(
      (product) =>
        (!searchText ||
          [
            product.name,
            product.category,
            product.barcode,
            product.internal_code,
          ].some((value) =>
            String(value || '')
              .toLowerCase()
              .includes(searchText),
          )) &&
        (!category ||
          (category === '__uncategorized__'
            ? !String(product.category || '').trim()
            : product.category === category)) &&
        (min === null || Number(product.sale_price || 0) >= min) &&
        (max === null || Number(product.sale_price || 0) <= max) &&
        (imageFilter === 'all' ||
          (imageFilter === 'with' &&
            Boolean(String(product.image_url || '').trim())) ||
          (imageFilter === 'without' &&
            !String(product.image_url || '').trim())) &&
        (stock === 'todos' ||
          (stock === 'disponivel' &&
            Number(product.quantity || 0) > lowStockThreshold) ||
          (stock === 'baixo' &&
            Number(product.quantity || 0) > 0 &&
            Number(product.quantity || 0) <= lowStockThreshold) ||
          (stock === 'zerado' && Number(product.quantity || 0) <= 0)),
    );

    const column = TABLE_COLUMNS.find(([key]) => key === sort.key);
    const type = column?.[2] || 'text';
    return [...visible].sort((a, b) => {
      const first = a[sort.key];
      const second = b[sort.key];
      let result;
      if (type === 'number') result = Number(first || 0) - Number(second || 0);
      else if (type === 'date')
        result =
          (first ? new Date(first).getTime() : 0) -
          (second ? new Date(second).getTime() : 0);
      else result = collator.compare(String(first || ''), String(second || ''));
      return sort.direction === 'asc' ? result : -result;
    });
  }, [
    products,
    deferredSearch,
    category,
    minPrice,
    maxPrice,
    stock,
    imageFilter,
    sort,
    lowStockThreshold,
  ]);

  const {
    page,
    setPage,
    pageCount,
    visibleItems: visibleProducts,
  } = usePagination(filtered, pageSize);

  const toggleSort = (key) => {
    setSort((current) =>
      current.key === key
        ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' },
    );
  };

  const SortIcon = ({ column }) => {
    if (sort.key !== column)
      return <ArrowUpDown className="h-4 w-4 opacity-40" />;
    return sort.direction === 'asc' ? (
      <ArrowDownAZ className="h-4 w-4 text-accent" />
    ) : (
      <ArrowDownZA className="h-4 w-4 text-accent" />
    );
  };

  const editInline = (id, key, value, type) => {
    setProducts((current) =>
      current.map((product) =>
        product.id === id
          ? { ...product, [key]: normalizeStockValue(value, type) }
          : product,
      ),
    );
    setDirty((current) => new Set(current).add(id));
  };

  const saveInline = async () => {
    const changed = products.filter((product) => dirty.has(product.id));
    if (!changed.length) return;
    if (
      changed.some(
        (product) =>
          !product.name?.trim() ||
          Number(product.sale_price) < 0 ||
          Number(product.quantity) < 0,
      )
    ) {
      toast.error('Revise nome, preço e quantidade dos produtos alterados.');
      return;
    }
    setSaving(true);
    try {
      captureView();
      await nexoApi.stock.bulkUpdate(
        changed.map((product) => ({
          id: product.id,
          ...Object.fromEntries(
            EDITABLE_COLUMNS.map(([key]) => [key, product[key]]),
          ),
        })),
      );
      setDirty(new Set());
      setProducts((current) =>
        current.map((product) =>
          dirty.has(product.id)
            ? { ...product, updated_date: new Date().toISOString() }
            : product,
        ),
      );
      nexoApi.cache.clear('/products');
      await load();
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
      const rows = products.map((product) =>
        Object.fromEntries([
          ['ID', product.id],
          ...EDITABLE_COLUMNS.map(([key, label]) => [
            label,
            product[key] ?? '',
          ]),
          ['URL da imagem', product.image_url ?? ''],
          [
            'Última venda',
            product.last_sale_at
              ? formatDateTime(product.last_sale_at)
              : 'Nunca vendido',
          ],
        ]),
      );
      const sheet = XLSX.utils.json_to_sheet(rows);
      const book = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(book, sheet, 'Estoque');
      const marketPart = safeFilePart(
        config?.nome_mercado || user?.market_name || 'nexo-pdv',
      );
      XLSX.writeFile(book, `estoque-${marketPart}.xlsx`);
      toast.success('Planilha gerada.');
    } catch (error) {
      toast.error(error.message || 'Não foi possível gerar a planilha.');
    } finally {
      setExporting(false);
    }
  };

  const uploadSpreadsheet = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setImporting(true);
    try {
      if (file.size > 8 * 1024 * 1024)
        throw new Error('A planilha deve ter no máximo 8 MB.');
      const XLSX = await import('@e965/xlsx');
      const book = XLSX.read(await file.arrayBuffer());
      const sheet = book.Sheets[book.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      if (!rows.length) throw new Error('A planilha está vazia.');
      if (rows.length > 5000)
        throw new Error(
          'A planilha pode ter no máximo 5.000 produtos por importação.',
        );
      const mapped = rows.map((row) => {
        const normalizedRow = Object.fromEntries(
          Object.entries(row || {}).map(([key, value]) => [
            normalizeHeader(key),
            value,
          ]),
        );
        const imageUrlValue = pickRowValue(row, normalizedRow, [
          'URL da imagem',
          'Url da imagem',
          'url da imagem',
          'URL imagem',
          'Url imagem',
          'url imagem',
          'Imagem URL',
          'image url',
          'image_url',
          'Imagem',
        ]);
        return {
          id: normalizedRow.id || undefined,
          ...Object.fromEntries(
            EDITABLE_COLUMNS.map(([key, label, type]) => [
              key,
              normalizeStockValue(
                row[label] ?? normalizedRow[normalizeHeader(label)],
                type,
              ),
            ]),
          ),
          image_url: normalizeImportedImageUrl(imageUrlValue),
        };
      });
      if (
        mapped.some(
          (product) =>
            !product.name.trim() ||
            Number(product.sale_price) < 0 ||
            Number(product.quantity) < 0,
        )
      ) {
        throw new Error('Há produtos com nome, preço ou quantidade inválidos.');
      }
      const unique = discardDuplicateProducts(mapped);
      const preview = await nexoApi.stock.bulkUpdate(
        unique.products,
        'preview',
      );
      let existingMode = 'update';
      if (Number(preview.existing || 0) > 0) {
        const updateExisting = await confirm({
          title: `${preview.existing} produto(s) já existem`,
          description:
            'Deseja atualizar esses produtos com os valores da planilha? Ao voltar, os dados atuais serão preservados e apenas produtos novos serão importados.',
          confirmLabel: 'Atualizar existentes',
          cancelLabel: 'Manter atuais',
        });
        existingMode = updateExisting ? 'update' : 'keep';
      }
      const result = await nexoApi.stock.bulkUpdate(
        unique.products,
        existingMode,
      );
      const discarded = Math.max(
        unique.discarded,
        Number(result.discarded || 0),
      );
      const action =
        existingMode === 'update'
          ? 'atualizado(s)/importado(s)'
          : 'novo(s) importado(s)';
      toast.success(
        `${Number(result.updated || 0)} produto(s) ${action}.${discarded ? ` ${discarded} repetido(s) descartado(s).` : ''}`,
      );
      captureView();
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
      image_url: rawImage.startsWith('data:image/')
        ? `/api/product-media/${saved.id}?v=${Date.now()}`
        : rawImage,
    };
    setProducts((current) => {
      const exists = current.some((product) => product.id === normalized.id);
      return exists
        ? current.map((product) =>
            product.id === normalized.id
              ? { ...product, ...normalized }
              : product,
          )
        : [normalized, ...current];
    });
    nexoApi.cache.clear('/products');
    if (!options.keepOpen) closeModal();
  };

  const handleDeleteProduct = async (product) => {
    if (!['admin', 'gerente'].includes(user.role) || deletingId) return;
    const confirmed = await confirm({
      title: `Excluir “${product.name}”?`,
      description:
        'O produto será removido do cadastro. As vendas anteriores e seus registros de auditoria continuarão preservados.',
      confirmLabel: 'Excluir produto',
      tone: 'destructive',
    });
    if (!confirmed) return;

    setDeletingId(product.id);
    try {
      await nexoApi.entities.Product.delete(product.id);
      setProducts((current) =>
        current.filter((item) => item.id !== product.id),
      );
      setDirty((current) => {
        const next = new Set(current);
        next.delete(product.id);
        return next;
      });
      toast.success('Produto excluído do estoque.');
    } catch (error) {
      if (error.status === 404) {
        setProducts((current) =>
          current.filter((item) => item.id !== product.id),
        );
        nexoApi.cache.clear('/products');
        toast.success(
          'O produto já havia sido excluído. A lista foi atualizada.',
        );
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
  const inactiveCandidates = useMemo(
    () =>
      products.filter((product) => {
        const reference = product.last_sale_at || product.created_date;
        const timestamp = reference ? new Date(reference).getTime() : 0;
        return (
          Number.isFinite(timestamp) && timestamp < inactivityCutoff.getTime()
        );
      }),
    [products, inactivityCutoff],
  );

  const handleDeleteInactive = async () => {
    if (
      !['admin', 'gerente'].includes(user.role) ||
      deletingInactive ||
      !inactiveCandidates.length
    )
      return;
    const confirmed = await confirm({
      title: `Apagar ${inactiveCandidates.length} produto(s) inativo(s)?`,
      description:
        'Serão removidos produtos sem venda há pelo menos dois meses. As vendas antigas continuarão no histórico.',
      confirmLabel: 'Apagar inativos',
      tone: 'destructive',
    });
    if (!confirmed) return;
    setDeletingInactive(true);
    try {
      const result = await nexoApi.products.deleteInactive();
      toast.success(
        `${Number(result.deleted || 0)} produto(s) inativo(s) apagado(s).`,
      );
      captureView();
      await load();
    } catch (error) {
      toast.error(
        error.message || 'Não foi possível apagar os produtos inativos.',
      );
    } finally {
      setDeletingInactive(false);
    }
  };

  const hasFilters = Boolean(
    search || category || minPrice || maxPrice || stock !== 'todos',
  );
  const clearFilters = () => {
    setSearch('');
    setCategory('');
    setMinPrice('');
    setMaxPrice('');
    setStock('todos');
    setImageFilter('all');
  };
  const zeroStockCount = products.filter(
    (product) =>
      product.track_stock !== false && Number(product.quantity || 0) <= 0,
  ).length;
  const lowStockCount = products.filter(
    (product) =>
      product.track_stock !== false &&
      Number(product.quantity || 0) > 0 &&
      Number(product.quantity || 0) <= lowStockThreshold,
  ).length;
  const focusStock = (filter) => {
    setStock(filter);
    setPage(1);
    window.setTimeout(
      () =>
        tableRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        }),
      50,
    );
  };

  const captureView = () => {
    pendingViewRef.current = {
      page,
      scrollTop: tableRef.current?.scrollTop || 0,
    };
  };

  useEffect(() => {
    if (loading || !pendingViewRef.current) return;
    const { page: pendingPage, scrollTop } = pendingViewRef.current;
    pendingViewRef.current = null;
    setPage(Math.min(pendingPage, pageCount));
    window.requestAnimationFrame(() =>
      tableRef.current?.scrollTo({ top: scrollTop, behavior: 'auto' }),
    );
  }, [loading, pageCount, setPage]);

  return (
    <div className="page-shell !max-w-[1700px]">
      <div className="mb-3 flex flex-col gap-2 sm:mb-5 sm:gap-4 xl:flex-row xl:items-end xl:justify-between">
        <PageHeader
          icon={Package}
          eyebrow="Produtos e quantidades"
          title="Estoque"
          description="Edite direto na tabela ou use o cadastro completo."
        />
        <StockActionsToolbar
          ref={fileRef}
          loading={loading}
          exporting={exporting}
          importing={importing}
          saving={saving}
          dirtyCount={dirty.size}
          canDeleteInactive={['admin', 'gerente'].includes(user.role)}
          deletingInactive={deletingInactive}
          inactiveCount={inactiveCandidates.length}
          onExport={download}
          onImport={uploadSpreadsheet}
          onSave={saveInline}
          onDeleteInactive={handleDeleteInactive}
          onCreate={() => openProductModal('create')}
        />
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2 sm:mb-4 sm:grid-cols-2 sm:gap-3 xl:grid-cols-4">
        <StockMetric
          label="Produtos cadastrados"
          value={products.length}
          hint="Todos os itens"
        />
        <StockMetric
          label="Estoque baixo"
          value={lowStockCount}
          low={lowStockCount > 0}
          active={stock === 'baixo'}
          hint={
            lowStockCount
              ? `Até ${lowStockThreshold} unidades · clique para ver`
              : 'Nenhum alerta'
          }
          onClick={() => focusStock('baixo')}
        />
        <StockMetric
          label="Sem estoque"
          value={zeroStockCount}
          alert={zeroStockCount > 0}
          active={stock === 'zerado'}
          hint={
            zeroStockCount
              ? 'Clique para atualizar os produtos'
              : 'Nenhum produto zerado'
          }
          onClick={() => focusStock('zerado')}
        />
        <StockMetric
          label="Alterações pendentes"
          value={dirty.size}
          pending={dirty.size > 0}
          hint={dirty.size ? 'Salve para aplicar' : 'Tudo atualizado'}
        />
      </div>

      <StockFilters
        search={search}
        onSearchChange={setSearch}
        category={category}
        onCategoryChange={setCategory}
        categories={categories}
        minPrice={minPrice}
        onMinPriceChange={setMinPrice}
        maxPrice={maxPrice}
        onMaxPriceChange={setMaxPrice}
        stock={stock}
        onStockChange={setStock}
        imageFilter={imageFilter}
        onImageFilterChange={setImageFilter}
        pageSize={pageSize}
        onPageSizeChange={setPageSize}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        hasFilters={hasFilters}
        onClearFilters={clearFilters}
      />

      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          {filtered.length} de {products.length} produtos
        </span>
        <span className="xl:hidden">
          Abra um produto para editar todos os dados.
        </span>
      </div>

      <div
        ref={tableRef}
        className="min-h-[260px] scroll-mt-4 overflow-auto rounded-xl border border-border bg-card sm:min-h-[360px] sm:rounded-2xl xl:max-h-[calc(100dvh-300px)]"
      >
        {loading ? (
          <div
            role="status"
            aria-live="polite"
            aria-busy="true"
            className="grid min-h-[360px] place-items-center text-sm text-muted-foreground"
          >
            <div className="text-center">
              <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-accent" />
              Carregando estoque...
            </div>
          </div>
        ) : loadError && !products.length ? (
          <ErrorState
            className="min-h-[360px] rounded-none border-0"
            description={loadError}
            onRetry={load}
          />
        ) : (
          <StockProductViews
            viewMode={viewMode}
            products={visibleProducts}
            lowStockThreshold={lowStockThreshold}
            dirty={dirty}
            categories={categories}
            userRole={user.role}
            deletingId={deletingId}
            SortIcon={SortIcon}
            onSort={toggleSort}
            onEdit={(product) => openProductModal('edit', product)}
            onDuplicate={(product) => openProductModal('duplicate', product)}
            onDelete={handleDeleteProduct}
            onInlineEdit={editInline}
            hasFilters={hasFilters}
            onClearFilters={clearFilters}
          />
        )}
      </div>

      {!loading && filtered.length > 0 && (
        <PaginationControls
          page={page}
          pageCount={pageCount}
          total={filtered.length}
          pageSize={pageSize}
          onPageChange={setPage}
        />
      )}

      {productModal?.mode === 'loading' && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
          <div
            role="status"
            aria-live="polite"
            aria-busy="true"
            className="rounded-2xl border border-border bg-card px-8 py-7 text-center shadow-2xl"
          >
            <div className="mx-auto h-7 w-7 animate-spin rounded-full border-4 border-muted border-t-accent" />
            <p className="mt-3 text-sm font-bold">Carregando produto...</p>
          </div>
        </div>
      )}
      {productModal && productModal.mode !== 'loading' && (
        <Suspense
          fallback={
            <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
              <div
                role="status"
                aria-live="polite"
                aria-busy="true"
                className="rounded-lg border border-border bg-card px-8 py-7 text-center shadow-2xl"
              >
                <div className="mx-auto h-7 w-7 animate-spin rounded-full border-4 border-muted border-t-accent" />
                <p className="mt-3 text-sm font-bold">
                  Abrindo formulário...
                </p>
              </div>
            </div>
          }
        >
          <ProductForm
            product={
              productModal.mode === 'edit' ? productModal.product : null
            }
            duplicateSource={
              productModal.mode === 'duplicate' ? productModal.product : null
            }
            categories={categories}
            user={user}
            onClose={closeModal}
            onSave={handleModalSave}
          />
        </Suspense>
      )}
    </div>
  );
}
