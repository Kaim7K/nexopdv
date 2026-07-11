import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { nexoApi } from '@/api/nexoApi';
import { toast } from 'react-hot-toast';
import { Banknote, Edit3, LayoutGrid, LockKeyhole } from 'lucide-react';
import ProductSearch from '@/components/pdv/ProductSearch';
import SearchResults from '@/components/pdv/SearchResults';
import SaleSummary from '@/components/pdv/SaleSummary';
import ProductGrid from '@/components/pdv/ProductGrid';
import PaymentModal from '@/components/pdv/PaymentModal';
import QuickProductModal from '@/components/pdv/QuickProductModal';
import ReceiptModal from '@/components/pdv/ReceiptModal';
import PriceCorrectionModal from '@/components/pdv/PriceCorrectionModal';
import MinimizedSalesBar from '@/components/pdv/MinimizedSalesBar';
import CashRegisterModal from '@/components/pdv/CashRegisterModal';
import { formatCurrency } from '@/lib/helpers';
import { downloadDailySalesReportPdf } from '@/lib/sales-pdf';
import {
  addProductToSaleItems,
  createEmptySale,
  findProductByCapture,
  readSavedPdvDraft,
  removeSaleItem,
  updateSaleItemQuantity,
  updateSaleItemWeight,
} from '@/lib/pdv';

const Kbd = ({ children }) => (
  <kbd className="rounded-md border border-border bg-muted px-2 py-1 font-mono text-xs font-bold leading-none">{children}</kbd>
);

export default function PDV() {
  const { user, config } = /** @type {any} */ (useOutletContext());
  const draftStorageKey = `nexo:pdv:draft:${user.market_id || user.id}`;
  const [initialDraft] = useState(() => readSavedPdvDraft(draftStorageKey));
  const [products, setProducts] = useState([]);
  const [activeSale, setActiveSale] = useState(() => initialDraft?.activeSale || createEmptySale());
  const [minimizedSales, setMinimizedSales] = useState(() => Array.isArray(initialDraft?.minimizedSales) ? initialDraft.minimizedSales : []);
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
  const [cashState, setCashState] = useState(() => ({
    required: user.role === 'vendedor' && Boolean(user.require_cash_register),
    market_requires_cash: Boolean(user.require_cash_register),
    session: null,
    summary: null,
  }));
  const [cashLoading, setCashLoading] = useState(true);
  const [cashModal, setCashModal] = useState(null);
  const [cashProcessing, setCashProcessing] = useState(false);
  const [cashReporting, setCashReporting] = useState(false);
  const [closedCashReport, setClosedCashReport] = useState(null);
  const inputRef = useRef(null);
  const searchContainerRef = useRef(null);
  const modalsOpen = showPayment || showQuickProduct || showReceipt || showPriceCorrection || cashModal;

  useEffect(() => {
    loadCash();
    loadMaxMinimized();
    getNextSaleNumber();
  }, []);

  const canUsePdv = user.role !== 'vendedor' || !cashState.required || Boolean(cashState.session);
  const receiptConfig = useMemo(() => ({
    ...config,
    logo_url: config.logo_url || user.logo_url,
    nome_mercado: config.nome_mercado || user.market_name,
    market_name: user.market_name,
  }), [config, user.logo_url, user.market_name]);

  const requestPayment = async () => {
    if (!activeSale.items.length) return;
    if (user.role === 'vendedor' && cashState.required) {
      try {
        const latestCash = await nexoApi.cash.current();
        setCashState(latestCash);
        if (!latestCash.session) {
          setShowPayment(false);
          setCashModal('open');
          toast.error('Abra o caixa antes de ir para o pagamento.');
          return;
        }
      } catch (error) {
        toast.error(error.message || 'Não foi possível confirmar se o caixa está aberto.');
        return;
      }
    }
    setShowPayment(true);
  };


  useEffect(() => {
    if (cashLoading || !canUsePdv || products.length) return;
    loadProducts();
  }, [cashLoading, canUsePdv]);

  useEffect(() => {
    if (!cashLoading && cashState.required && !cashState.session && !closedCashReport && cashModal !== 'closed') setCashModal('open');
  }, [cashLoading, cashState.required, cashState.session, closedCashReport, cashModal]);

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

  const loadCash = async () => {
    setCashLoading(true);
    try {
      const data = await nexoApi.cash.current();
      setCashState(data);
    } catch (error) {
      toast.error(error.message || 'Não foi possível verificar o caixa.');
    } finally {
      setCashLoading(false);
    }
  };

  const handleOpenCash = async openingAmount => {
    setCashProcessing(true);
    try {
      const result = await nexoApi.cash.open(openingAmount);
      setCashState(previous => ({ ...previous, session: result.session, summary: result.summary }));
      setClosedCashReport(null);
      setCashModal(null);
      toast.success('Caixa aberto. Você já pode começar a vender.');
    } catch (error) {
      toast.error(error.message || 'Não foi possível abrir o caixa.');
    } finally {
      setCashProcessing(false);
    }
  };

  const openCashDialog = () => {
    if (cashState.session && (activeSale.items.length > 0 || minimizedSales.length > 0)) {
      toast.error('Finalize ou descarte as vendas abertas antes de fechar o caixa.');
      return;
    }
    setCashModal(cashState.session ? 'close' : 'open');
  };

  const handleCloseCash = async closingAmount => {
    setCashProcessing(true);
    try {
      const result = await nexoApi.cash.close(closingAmount);
      setCashState(previous => ({ ...previous, session: null, summary: null }));
      setClosedCashReport({ session: result.session, summary: result.summary });
      setCashModal('closed');
      setActiveSale(createEmptySale());
      setMinimizedSales([]);
      toast.success('Caixa fechado. Baixe o relatório do período quando desejar.');
    } catch (error) {
      toast.error(error.message || 'Não foi possível fechar o caixa.');
    } finally {
      setCashProcessing(false);
    }
  };

  const downloadCashReport = async () => {
    const source = cashModal === 'closed' ? closedCashReport : cashState;
    const summary = source?.summary || {};
    const session = source?.session;
    if (!session || !Array.isArray(summary.sales)) {
      toast.error('O resumo do caixa ainda não está disponível.');
      return;
    }
    setCashReporting(true);
    try {
      await downloadDailySalesReportPdf({
        sales: summary.sales,
        summary,
        filters: summary.filters || {
          from: session.opened_at || session.created_date,
          to: session.closed_at || new Date().toISOString(),
        },
        config: receiptConfig,
        sellerName: session.seller_name || user.full_name || user.email,
        title: 'Relatório do período do caixa',
      });
      toast.success('Relatório do caixa baixado.');
    } catch (error) {
      toast.error(error.message || 'Não foi possível gerar o relatório do caixa.');
    } finally {
      setCashReporting(false);
    }
  };

  const loadProducts = async () => {
    setProductsLoading(true);
    try {
      const data = await nexoApi.products.catalog(1200);
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
        if (activeSale.items.length > 0) requestPayment();
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
    const product = findProductByCapture(products, code);
    if (product) {
      addProductToSale(product);
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
    setActiveSale(previous => ({ ...previous, items: addProductToSaleItems(previous.items, product) }));
    if (Number(product.quantity || 0) <= 0) toast(`⚠️ Estoque baixo: ${product.name}`);
  };

  const updateQuantity = (index, quantity) => setActiveSale(previous => ({ ...previous, items: updateSaleItemQuantity(previous.items, index, quantity) }));

  const updateWeight = (index, weight) => setActiveSale(previous => ({ ...previous, items: updateSaleItemWeight(previous.items, index, weight) }));

  const removeItem = index => setActiveSale(previous => ({ ...previous, items: removeSaleItem(previous.items, index) }));

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

  const handleDiscardMinimized = index => {
    const sale = minimizedSales[index];
    if (!sale) return;
    if (!window.confirm(`Descartar a venda aberta #${sale.temporary_number || index + 1}?`)) return;
    setMinimizedSales(previous => previous.filter((_, currentIndex) => currentIndex !== index));
    toast.success('Venda aberta descartada.');
  };

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
      loadCash();
    } catch (error) {
      toast.error(error.message || 'Erro ao concluir venda.');
    }
  };

  return (
    <div className="flex h-full flex-col bg-muted/20">
      <div className="flex flex-shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-3 py-3 sm:px-5">
        <div>
          <h1 className="text-base font-black">
            Venda #{saleNumber}
            {activeSale.temporary_number && <span className="ml-2 text-xs font-semibold text-accent">aberta #{activeSale.temporary_number}</span>}
          </h1>
          <p className="max-w-[150px] truncate text-xs text-muted-foreground sm:max-w-none">{user.full_name || user.email}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-3 text-xs text-muted-foreground xl:flex">
            <span className="flex items-center gap-1.5"><Kbd>F1</Kbd> Pagamento</span>
            <span className="flex items-center gap-1.5"><Kbd>F2</Kbd> Remover</span>
            <span className="flex items-center gap-1.5"><Kbd>F4</Kbd> Buscar</span>
            <span className="flex items-center gap-1.5"><Kbd>F6</Kbd> Descartar</span>
            <span className="flex items-center gap-1.5"><Kbd>F7</Kbd> Minimizar</span>
          </div>
          <button type="button" onClick={openCashDialog} disabled={cashLoading} className={`flex min-h-10 items-center gap-2 rounded-xl border px-3 text-sm font-bold transition disabled:opacity-50 ${cashState.session ? 'border-emerald-300 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-300' : 'border-border bg-card text-foreground hover:bg-muted'}`}>
            {cashState.session ? <Banknote className="h-4 w-4" /> : <LockKeyhole className="h-4 w-4" />} <span className="hidden sm:inline">{cashState.session ? 'Caixa aberto' : 'Abrir caixa'}</span>
          </button>
          <button onClick={() => setShowPriceCorrection(true)} disabled={!activeSale.items.length || !canUsePdv} aria-label="Corrigir valor de um produto da venda" className="flex min-h-10 items-center gap-2 rounded-xl border border-amber-300 px-3 text-sm font-semibold text-amber-700 transition-colors hover:bg-amber-50 disabled:opacity-40 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-950/30">
            <Edit3 className="h-5 w-5" /> <span className="hidden sm:inline">Valor errado</span>
          </button>
        </div>
      </div>

      {!canUsePdv && !cashLoading ? (
        <div className="grid flex-1 place-items-center p-6">
          <div className="max-w-md rounded-3xl border border-border bg-card p-7 text-center shadow-lg">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-accent/10 text-accent"><LockKeyhole className="h-7 w-7" /></div>
            <h2 className="mt-5 text-2xl font-black">Abra o caixa para começar</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Informe o valor inicial disponível para troco. Depois disso, o PDV será liberado para suas vendas.</p>
            <button type="button" onClick={() => setCashModal('open')} className="mt-5 min-h-11 rounded-xl bg-accent px-5 text-sm font-bold text-accent-foreground hover:bg-accent/90">Abrir caixa</button>
          </div>
        </div>
      ) : (
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
            onPaymentClick={requestPayment}
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
      )}

      {showPayment && canUsePdv && (
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
      {showReceipt && <ReceiptModal sale={showReceipt} config={receiptConfig} onClose={() => setShowReceipt(null)} onNewSale={() => setShowReceipt(null)} />}
      {showPriceCorrection && <PriceCorrectionModal items={activeSale.items} onSave={handlePriceCorrection} onClose={() => setShowPriceCorrection(false)} />}
      {cashModal && <CashRegisterModal
        mode={cashModal}
        cashState={cashModal === 'closed' ? closedCashReport : cashState}
        processing={cashProcessing}
        reporting={cashReporting}
        onClose={cashState.required && !cashState.session && cashModal === 'open' ? undefined : () => { setCashModal(null); if (cashModal === 'closed') setClosedCashReport(null); }}
        onOpen={handleOpenCash}
        onCloseCash={handleCloseCash}
        onDownloadReport={cashModal === 'close' || cashModal === 'closed' ? downloadCashReport : undefined}
      />}
      {canUsePdv && <MinimizedSalesBar sales={minimizedSales} onRestore={handleRestore} onDiscard={handleDiscardMinimized} onReorder={handleReorderMinimized} />}
    </div>
  );
}
