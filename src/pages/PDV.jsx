import React, { useEffect, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { nexoApi } from '@/api/nexoApi';
import { toast } from 'react-hot-toast';
import { Edit3, LayoutGrid } from 'lucide-react';
import ProductSearch from '@/components/pdv/ProductSearch';
import SearchResults from '@/components/pdv/SearchResults';
import SaleSummary from '@/components/pdv/SaleSummary';
import ProductGrid from '@/components/pdv/ProductGrid';
import PaymentModal from '@/components/pdv/PaymentModal';
import QuickProductModal from '@/components/pdv/QuickProductModal';
import ReceiptModal from '@/components/pdv/ReceiptModal';
import PriceCorrectionModal from '@/components/pdv/PriceCorrectionModal';
import MinimizedSalesBar from '@/components/pdv/MinimizedSalesBar';
import { formatCurrency } from '@/lib/helpers';

const createEmptySale = () => ({
  items: [],
  payments: [],
  discount_value: 0,
  discount_type: 'valor',
  observation: '',
  sale_type: 'normal',
});

const readSavedPdv = key => {
  if (typeof window === 'undefined') return null;
  try {
    const saved = JSON.parse(window.localStorage.getItem(key) || 'null');
    return saved && typeof saved === 'object' ? saved : null;
  } catch {
    return null;
  }
};

const Kbd = ({ children }) => (
  <kbd className="rounded-md border border-border bg-muted px-2 py-1 font-mono text-xs font-bold leading-none">{children}</kbd>
);

export default function PDV() {
  const { user, config } = /** @type {any} */ (useOutletContext());
  const draftStorageKey = `nexo:pdv:draft:${user.market_id || user.id}`;
  const savedDraft = readSavedPdv(draftStorageKey);
  const [products, setProducts] = useState([]);
  const [activeSale, setActiveSale] = useState(() => savedDraft?.activeSale || createEmptySale());
  const [minimizedSales, setMinimizedSales] = useState(() => Array.isArray(savedDraft?.minimizedSales) ? savedDraft.minimizedSales : []);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showQuickProduct, setShowQuickProduct] = useState(null);
  const [showReceipt, setShowReceipt] = useState(null);
  const [showPriceCorrection, setShowPriceCorrection] = useState(false);
  const [maxMinimized, setMaxMinimized] = useState(3);
  const [saleNumber, setSaleNumber] = useState(1);
  const nextMinimizedId = useRef(1);
  const [productsLoading, setProductsLoading] = useState(true);
  const inputRef = useRef(null);
  const searchContainerRef = useRef(null);
  const modalsOpen = showPayment || showQuickProduct || showReceipt || showPriceCorrection;

  useEffect(() => {
    loadProducts();
    loadMaxMinimized();
    getNextSaleNumber();
  }, []);

  useEffect(() => {
    const highestTemporary = Math.max(0, ...minimizedSales.map(sale => Number(sale.temporary_number || 0)), Number(activeSale.temporary_number || 0));
    nextMinimizedId.current = Math.max(nextMinimizedId.current, highestTemporary + 1);
  }, []);

  useEffect(() => {
    const hasDraft = activeSale.items.length || minimizedSales.length;
    if (!hasDraft) {
      window.localStorage.removeItem(draftStorageKey);
      return;
    }
    window.localStorage.setItem(draftStorageKey, JSON.stringify({
      activeSale,
      minimizedSales,
      savedAt: new Date().toISOString(),
    }));
  }, [activeSale, minimizedSales, draftStorageKey]);

  useEffect(() => {
    const handler = event => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target)) setShowResults(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (!searchQuery) {
      setSearchResults([]);
      return;
    }
    const query = searchQuery.toLowerCase();
    setSearchResults(products.filter(product => (
      String(product.name || '').toLowerCase().includes(query)
      || String(product.category || '').toLowerCase().includes(query)
      || String(product.barcode || '').includes(query)
      || String(product.internal_code || '').toLowerCase().includes(query)
    )).slice(0, 10));
    setShowResults(true);
  }, [searchQuery, products]);

  const loadProducts = async () => {
    setProductsLoading(true);
    try {
      const data = await nexoApi.entities.Product.list('-updated_date', 500);
      setProducts(data.filter(product => product.status === 'ativo'));
    } catch {
      toast.error('Erro ao carregar produtos.');
    } finally {
      setProductsLoading(false);
    }
  };

  const loadMaxMinimized = async () => {
    try {
      const configs = await nexoApi.entities.SystemConfig.filter({ key: 'limite_vendas_minimizadas' });
      if (configs.length > 0) setMaxMinimized(Number.parseInt(configs[0].value, 10) || 3);
    } catch {
      // Optional configuration.
    }
  };

  const getNextSaleNumber = async () => {
    try {
      const data = await nexoApi.sales.nextNumber();
      setSaleNumber(data.sale_number);
    } catch {
      // The number is refreshed after the connection is restored.
    }
  };

  useEffect(() => {
    let buffer = '';
    let timeout;
    const handler = event => {
      const active = document.activeElement;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.getAttribute('contenteditable') === 'true')) return;
      if (modalsOpen) return;
      if (event.key === 'Enter') {
        if (buffer.length > 0) handleCapture(buffer);
        buffer = '';
        return;
      }
      if (event.key.length === 1) {
        buffer += event.key;
        clearTimeout(timeout);
        timeout = setTimeout(() => {
          if (buffer.length >= 2) handleCapture(buffer);
          buffer = '';
        }, 400);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [products, activeSale, modalsOpen]);

  useEffect(() => {
    const handler = event => {
      if (event.key === 'Escape') {
        if (showPayment) setShowPayment(false);
        else if (showQuickProduct) setShowQuickProduct(null);
        else if (showReceipt) setShowReceipt(null);
        else if (showPriceCorrection) setShowPriceCorrection(false);
        return;
      }
      if (modalsOpen) return;
      if (event.key === 'F1' || event.key === 'F3') {
        event.preventDefault();
        if (activeSale.items.length > 0) setShowPayment(true);
      } else if (event.key === 'F2') {
        event.preventDefault();
        if (activeSale.items.length > 0) removeItem(activeSale.items.length - 1);
      } else if (event.key === 'F4') {
        event.preventDefault();
        inputRef.current?.focus();
      } else if (event.key === 'F6') {
        event.preventDefault();
        handleDiscard();
      } else if (event.key === 'F7') {
        event.preventDefault();
        handleMinimize();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [activeSale, modalsOpen, showPayment, showQuickProduct, showReceipt, showPriceCorrection, minimizedSales]);

  const handleCapture = code => {
    const exact = products.find(product => product.barcode === code || product.internal_code === code);
    if (exact) {
      addProductToSale(exact);
      return;
    }
    const nameMatch = products.find(product => String(product.name || '').toLowerCase() === code.toLowerCase());
    if (nameMatch) {
      addProductToSale(nameMatch);
      return;
    }
    if (/^\d{6,}$/.test(code)) setShowQuickProduct({ barcode: code });
    else {
      setSearchQuery(code);
      setShowResults(true);
      inputRef.current?.focus();
    }
  };

  const addProductToSale = product => {
    if (product.status === 'inativo') {
      toast.error('Produto inativo.');
      return;
    }
    setActiveSale(previous => {
      const existing = previous.items.find(item => item.product_id === product.id);
      let newItems;
      if (product.unit === 'peso') {
        if (existing) {
          newItems = previous.items.map(item => item.product_id === product.id
            ? { ...item, weight: Number(item.weight || 0) + 0.1, subtotal: (Number(item.weight || 0) + 0.1) * item.unit_price }
            : item);
        } else {
          newItems = [...previous.items, {
            product_id: product.id,
            product_name: product.name,
            barcode: product.barcode || '',
            internal_code: product.internal_code || '',
            quantity: 1,
            weight: 0.1,
            unit_price: Number(product.sale_price),
            subtotal: 0.1 * Number(product.sale_price),
            unit: product.unit,
          }];
        }
      } else if (existing) {
        newItems = previous.items.map(item => item.product_id === product.id
          ? { ...item, quantity: Number(item.quantity || 0) + 1, subtotal: (Number(item.quantity || 0) + 1) * item.unit_price }
          : item);
      } else {
        newItems = [...previous.items, {
          product_id: product.id,
          product_name: product.name,
          barcode: product.barcode || '',
          internal_code: product.internal_code || '',
          quantity: 1,
          weight: null,
          unit_price: Number(product.sale_price),
          subtotal: Number(product.sale_price),
          unit: product.unit,
        }];
      }
      return { ...previous, items: newItems };
    });
    if (Number(product.quantity || 0) <= 0) toast(`⚠️ Estoque baixo: ${product.name}`);
  };

  const updateQuantity = (index, quantity) => {
    const safeQuantity = Math.max(1, Number(quantity) || 1);
    setActiveSale(previous => ({
      ...previous,
      items: previous.items.map((item, currentIndex) => currentIndex === index
        ? { ...item, quantity: safeQuantity, subtotal: safeQuantity * item.unit_price }
        : item),
    }));
  };

  const updateWeight = (index, weight) => {
    const safeWeight = Math.max(0, Number.parseFloat(weight) || 0);
    setActiveSale(previous => ({
      ...previous,
      items: previous.items.map((item, currentIndex) => currentIndex === index
        ? { ...item, weight: safeWeight, subtotal: safeWeight * item.unit_price }
        : item),
    }));
  };

  const removeItem = index => setActiveSale(previous => ({ ...previous, items: previous.items.filter((_, currentIndex) => currentIndex !== index) }));

  const handlePriceCorrection = async (index, newPrice) => {
    const item = activeSale.items[index];
    const product = products.find(candidate => candidate.id === item.product_id);
    if (!product) return;
    const oldPrice = product.sale_price;
    await nexoApi.entities.Product.update(product.id, { sale_price: newPrice });
    setActiveSale(previous => ({
      ...previous,
      items: previous.items.map((currentItem, currentIndex) => currentIndex === index
        ? { ...currentItem, unit_price: newPrice, subtotal: Number(currentItem.weight || currentItem.quantity) * newPrice }
        : currentItem),
    }));
    await nexoApi.entities.ProductAudit.create({
      product_id: product.id,
      product_name: product.name,
      field_changed: 'sale_price',
      previous_value: String(oldPrice),
      new_value: String(newPrice),
      user_id: user.id,
      user_name: user.full_name || user.email,
      change_origin: 'valor_errado',
      sale_number: saleNumber,
      observation: 'Correção de valor na tela de vendas',
    });
    await nexoApi.entities.GeneralAudit.create({
      action_type: 'alteracao_preco',
      entity_type: 'product',
      entity_id: product.id,
      user_id: user.id,
      user_name: user.full_name || user.email,
      description: `Preço de ${product.name} alterado de ${formatCurrency(oldPrice)} para ${formatCurrency(newPrice)}`,
      details: JSON.stringify({ old: oldPrice, new: newPrice, sale_number: saleNumber }),
    });
    toast.success('Valor atualizado e auditoria registrada.');
    setShowPriceCorrection(false);
    loadProducts();
  };

  const withLocalIdentity = sale => sale._localId ? sale : {
    ...sale,
    temporary_number: nextMinimizedId.current++,
    _localId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  };

  const handleMinimize = (draft = {}) => {
    const saleToMinimize = { ...activeSale, ...draft };
    if (!saleToMinimize.items.length) return;
    if (minimizedSales.length >= maxMinimized) {
      toast.error(`Limite de ${maxMinimized} vendas minimizadas.`);
      return;
    }
    const identified = withLocalIdentity(saleToMinimize);
    setMinimizedSales(previous => [...previous, identified]);
    setActiveSale(createEmptySale());
    setSearchQuery('');
    toast.success(`Venda aberta #${identified.temporary_number} minimizada.`);
  };

  const handleRestore = index => {
    const selected = minimizedSales[index];
    if (!selected) return;
    let nextMinimized;
    if (activeSale.items.length > 0) {
      const current = withLocalIdentity(activeSale);
      nextMinimized = minimizedSales.map((sale, currentIndex) => currentIndex === index ? current : sale);
    } else {
      nextMinimized = minimizedSales.filter((_, currentIndex) => currentIndex !== index);
    }
    setActiveSale(selected);
    setMinimizedSales(nextMinimized);
    setSearchQuery('');
  };

  const handleReorderMinimized = (sourceIndex, destinationIndex) => {
    setMinimizedSales(previous => {
      const next = [...previous];
      const [moved] = next.splice(sourceIndex, 1);
      next.splice(destinationIndex, 0, moved);
      return next;
    });
  };

  const handleDiscardMinimized = index => setMinimizedSales(previous => previous.filter((_, currentIndex) => currentIndex !== index));

  const handleDiscard = () => {
    if (!activeSale.items.length) return;
    if (!window.confirm('Descartar a venda atual?')) return;
    setActiveSale(createEmptySale());
    setSearchQuery('');
    toast.success('Venda descartada.');
  };

  const completeSale = async paymentData => {
    try {
      const sale = await nexoApi.sales.complete({ ...activeSale, ...paymentData });
      setShowPayment(false);
      setShowReceipt(sale);
      setActiveSale(createEmptySale());
      setSearchQuery('');
      loadProducts();
      getNextSaleNumber();
    } catch (error) {
      toast.error(error.message || 'Erro ao concluir venda.');
    }
  };

  return (
    <div className="flex h-full flex-col bg-muted/20">
      <div className="flex flex-shrink-0 items-center justify-between border-b border-border bg-card px-5 py-3">
        <div>
          <h1 className="text-base font-black">
            Venda #{saleNumber}
            {activeSale.temporary_number && <span className="ml-2 text-xs font-semibold text-accent">aberta #{activeSale.temporary_number}</span>}
          </h1>
          <p className="text-xs text-muted-foreground">{user.full_name || user.email}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-3 text-xs text-muted-foreground xl:flex">
            <span className="flex items-center gap-1.5"><Kbd>F1</Kbd> Pagamento</span>
            <span className="flex items-center gap-1.5"><Kbd>F2</Kbd> Remover</span>
            <span className="flex items-center gap-1.5"><Kbd>F4</Kbd> Buscar</span>
            <span className="flex items-center gap-1.5"><Kbd>F6</Kbd> Descartar</span>
            <span className="flex items-center gap-1.5"><Kbd>F7</Kbd> Minimizar</span>
          </div>
          <button onClick={() => setShowPriceCorrection(true)} disabled={!activeSale.items.length} className="flex min-h-10 items-center gap-2 rounded-xl border border-amber-300 px-3 text-sm font-semibold text-amber-700 transition-colors hover:bg-amber-50 disabled:opacity-40 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-950/30">
            <Edit3 className="h-5 w-5" /> Valor errado
          </button>
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden md:flex-row">
        <div className="flex h-[42%] w-full flex-col overflow-hidden border-r border-border md:h-auto md:w-[36%] md:min-w-[300px]">
          <div className="flex-shrink-0 p-4 pb-2">
            <div className="relative" ref={searchContainerRef}>
              <ProductSearch query={searchQuery} onQueryChange={setSearchQuery} inputRef={inputRef} onFocus={() => setShowResults(true)} />
              {showResults && searchQuery && (
                <SearchResults results={searchResults} loading={false} onSelect={product => {
                  addProductToSale(product);
                  setSearchQuery('');
                  setShowResults(false);
                }} />
              )}
            </div>
          </div>

          <div className="flex-1 overflow-hidden px-4 pb-4">
            <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              <div className="flex gap-2 border-b border-border bg-muted/30 px-4 py-2.5 text-xs font-semibold"><LayoutGrid className="h-5 w-5" /> Produtos</div>
              <ProductGrid products={products} onSelect={addProductToSale} loading={productsLoading} />
            </div>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col bg-card">
          <SaleSummary
            sale={activeSale}
            onPaymentClick={() => setShowPayment(true)}
            onMinimizeClick={() => handleMinimize()}
            onDiscardClick={handleDiscard}
            onDiscountChange={setActiveSale}
            onUpdateQuantity={updateQuantity}
            onUpdateWeight={updateWeight}
            onRemoveItem={removeItem}
            canDiscount
            minimizedCount={minimizedSales.length}
            maxMinimized={maxMinimized}
          />
        </div>
      </div>

      {showPayment && (
        <PaymentModal
          sale={activeSale}
          onClose={() => setShowPayment(false)}
          onComplete={completeSale}
          onMinimize={draft => {
            setShowPayment(false);
            handleMinimize(draft);
          }}
          onDiscard={() => {
            setShowPayment(false);
            handleDiscard();
          }}
        />
      )}
      {showQuickProduct && (
        <QuickProductModal
          barcode={showQuickProduct.barcode}
          onSave={product => {
            setProducts(previous => [...previous, product]);
            addProductToSale(product);
            setShowQuickProduct(null);
          }}
          onClose={() => setShowQuickProduct(null)}
        />
      )}
      {showReceipt && <ReceiptModal sale={showReceipt} config={config} onClose={() => setShowReceipt(null)} onNewSale={() => setShowReceipt(null)} />}
      {showPriceCorrection && <PriceCorrectionModal items={activeSale.items} onSave={handlePriceCorrection} onClose={() => setShowPriceCorrection(false)} />}
      <MinimizedSalesBar sales={minimizedSales} onRestore={handleRestore} onDiscard={handleDiscardMinimized} onReorder={handleReorderMinimized} />
    </div>
  );
}
