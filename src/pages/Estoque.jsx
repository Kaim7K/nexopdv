import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { nexoApi } from '@/api/nexoApi';
import { toast } from 'react-hot-toast';
import {
  ArrowDownAZ,
  ArrowDownZA,
  ArrowUpDown,
  Copy,
  Download,
  Package,
  Pencil,
  Plus,
  Save,
  Search,
  Upload,
} from 'lucide-react';
import ProductForm from '@/components/stock/ProductForm';

const COLUMNS = [
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

const normalize = (value, type) => type === 'number'
  ? (value === '' ? '' : Number(value))
  : String(value ?? '');

const collator = new Intl.Collator('pt-BR', { numeric: true, sensitivity: 'base' });

export default function Estoque() {
  const { user } = /** @type {any} */ (useOutletContext());
  const fileRef = useRef(null);
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

  const load = async () => {
    setLoading(true);
    try {
      setProducts(await nexoApi.entities.Product.list('-updated_date', 1000));
      setDirty(new Set());
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const categories = useMemo(() => (
    [...new Set(products.map(product => product.category).filter(Boolean))].sort((a, b) => collator.compare(a, b))
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
      && (stock === 'todos' || (stock === 'disponivel' ? Number(product.quantity || 0) > 0 : Number(product.quantity || 0) <= 0))
    ));

    const column = COLUMNS.find(([key]) => key === sort.key);
    const type = column?.[2] || 'text';
    return [...visible].sort((a, b) => {
      const first = a[sort.key];
      const second = b[sort.key];
      let result;
      if (type === 'number') result = Number(first || 0) - Number(second || 0);
      else result = collator.compare(String(first || ''), String(second || ''));
      return sort.direction === 'asc' ? result : -result;
    });
  }, [products, search, category, minPrice, maxPrice, stock, sort]);

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
      await nexoApi.stock.bulkUpdate(changed);
      toast.success('Estoque atualizado.');
      await load();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const download = async () => {
    const XLSX = await import('@e965/xlsx');
    const rows = products.map(product => Object.fromEntries([
      ['ID', product.id],
      ...COLUMNS.map(([key, label]) => [label, product[key] ?? '']),
    ]));
    const sheet = XLSX.utils.json_to_sheet(rows);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, 'Estoque');
    XLSX.writeFile(book, 'estoque-nexo-pdv.xlsx');
  };

  const uploadSpreadsheet = async event => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const XLSX = await import('@e965/xlsx');
      const book = XLSX.read(await file.arrayBuffer());
      const sheet = book.Sheets[book.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      if (!rows.length) throw new Error('A planilha está vazia.');
      const mapped = rows.map(row => ({
        id: row.ID || undefined,
        ...Object.fromEntries(COLUMNS.map(([key, label, type]) => [key, normalize(row[label], type)])),
      }));
      if (mapped.some(product => !product.name.trim() || Number(product.sale_price) < 0 || Number(product.quantity) < 0)) {
        throw new Error('Há produtos com nome, preço ou quantidade inválidos.');
      }
      await nexoApi.stock.bulkUpdate(mapped);
      toast.success(`${mapped.length} produtos importados.`);
      await load();
    } catch (error) {
      toast.error(error.message || 'Não foi possível importar a planilha.');
    }
  };

  const closeModal = () => setProductModal(null);
  const handleModalSave = async (_saved, options = {}) => {
    await load();
    if (!options.keepOpen) closeModal();
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-5 flex flex-wrap justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Estoque</h1>
          <p className="text-sm text-muted-foreground">
            {filtered.length} produtos · edite na planilha ou abra o modal completo
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={download} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-semibold hover:bg-muted">
            <Download className="h-5 w-5" /> Baixar
          </button>
          <button onClick={() => fileRef.current?.click()} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-semibold hover:bg-muted">
            <Upload className="h-5 w-5" /> Importar
          </button>
          <input ref={fileRef} hidden type="file" accept=".xlsx,.xls,.csv" onChange={uploadSpreadsheet} />
          <button
            disabled={!dirty.size || saving}
            onClick={saveInline}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-accent px-4 text-sm font-bold text-accent-foreground hover:bg-accent/90 disabled:bg-muted disabled:text-muted-foreground"
          >
            <Save className="h-5 w-5" /> {saving ? 'Salvando...' : dirty.size ? `Salvar ${dirty.size}` : 'Salvar'}
          </button>
          <button onClick={() => setProductModal({ mode: 'create' })} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground hover:bg-primary/90">
            <Plus className="h-5 w-5" /> <span className="hidden sm:inline">Novo produto</span>
          </button>
        </div>
      </div>

      <div className="mb-4 grid gap-2 md:grid-cols-5">
        <label className="relative md:col-span-2">
          <Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
          <input className="h-11 w-full rounded-xl border border-border bg-card py-2 pl-10 pr-3 text-sm" placeholder="Pesquisar produto, categoria ou código" value={search} onChange={event => setSearch(event.target.value)} />
        </label>
        <select className="h-11 rounded-xl border border-border bg-card px-3 text-sm" value={category} onChange={event => setCategory(event.target.value)}>
          <option value="">Todas as categorias</option>
          {categories.map(value => <option key={value}>{value}</option>)}
        </select>
        <div className="flex gap-2">
          <input className="h-11 w-1/2 rounded-xl border border-border bg-card p-2 text-sm" type="number" min="0" placeholder="Preço mín." value={minPrice} onChange={event => setMinPrice(event.target.value)} />
          <input className="h-11 w-1/2 rounded-xl border border-border bg-card p-2 text-sm" type="number" min="0" placeholder="Preço máx." value={maxPrice} onChange={event => setMaxPrice(event.target.value)} />
        </div>
        <select className="h-11 rounded-xl border border-border bg-card px-3 text-sm" value={stock} onChange={event => setStock(event.target.value)}>
          <option value="todos">Qualquer estoque</option>
          <option value="disponivel">Disponível</option>
          <option value="zerado">Sem estoque</option>
        </select>
      </div>

      <div className="max-h-[calc(100vh-245px)] overflow-auto rounded-xl border border-border bg-card">
        {loading ? (
          <p className="p-12 text-center text-muted-foreground">Carregando...</p>
        ) : (
          <table className="w-full whitespace-nowrap text-sm">
            <thead className="sticky top-0 z-10 bg-secondary text-secondary-foreground shadow-sm">
              <tr>
                <th className="p-3"><Package className="h-5 w-5" /></th>
                {COLUMNS.map(([key, label]) => (
                  <th key={key} className="p-0 text-left">
                    <button type="button" onClick={() => toggleSort(key)} className="flex w-full items-center gap-2 px-3 py-3 font-semibold hover:bg-muted" title={`Ordenar por ${label}`}>
                      {label} <SortIcon column={key} />
                    </button>
                  </th>
                ))}
                <th className="sticky right-0 bg-secondary px-3 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(product => (
                <tr key={product.id} className={`border-t border-border hover:bg-muted/30 ${dirty.has(product.id) ? 'bg-amber-50 dark:bg-amber-950/20' : ''}`}>
                  <td className="p-2">
                    <button type="button" onClick={() => setProductModal({ mode: 'edit', product })} className="grid h-10 w-10 place-items-center overflow-hidden rounded-lg border border-border bg-white" title="Editar produto">
                      {product.image_url ? <img src={product.image_url} alt={product.name} className="h-full w-full object-contain p-1" /> : <Package className="h-5 w-5 text-muted-foreground" />}
                    </button>
                  </td>
                  {COLUMNS.map(([key, , type]) => (
                    <td key={key} className="p-1">
                      <input
                        aria-label={`${key} de ${product.name}`}
                        className="w-full min-w-[110px] rounded-lg border border-transparent bg-transparent p-2 hover:border-border focus:border-accent focus:bg-background focus:outline-none"
                        type={type}
                        min={type === 'number' ? '0' : undefined}
                        step="any"
                        value={product[key] ?? ''}
                        onChange={event => editInline(product.id, key, event.target.value, type)}
                      />
                    </td>
                  ))}
                  <td className="sticky right-0 bg-card p-2">
                    <div className="flex justify-end gap-1">
                      <button type="button" onClick={() => setProductModal({ mode: 'edit', product })} className="grid h-9 w-9 place-items-center rounded-lg border border-border text-muted-foreground hover:bg-muted hover:text-foreground" title="Editar no modal">
                        <Pencil className="h-[18px] w-[18px]" />
                      </button>
                      <button type="button" onClick={() => setProductModal({ mode: 'duplicate', product })} className="grid h-9 w-9 place-items-center rounded-lg border border-border text-muted-foreground hover:bg-muted hover:text-foreground" title="Duplicar produto">
                        <Copy className="h-[18px] w-[18px]" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!filtered.length && (
                <tr><td colSpan={COLUMNS.length + 2} className="p-12 text-center text-muted-foreground">Nenhum produto encontrado.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {productModal && (
        <ProductForm
          product={productModal.mode === 'edit' ? productModal.product : null}
          duplicateSource={productModal.mode === 'duplicate' ? productModal.product : null}
          categories={categories}
          user={user}
          onClose={closeModal}
          onSave={handleModalSave}
        />
      )}
    </div>
  );
}
