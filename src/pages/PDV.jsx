import React, { useState, useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { toast } from 'react-hot-toast';
import { Edit3, Package, ShoppingCart, LayoutGrid } from 'lucide-react';
import ProductSearch from '@/components/pdv/ProductSearch';
import SearchResults from '@/components/pdv/SearchResults';
import SaleItemsList from '@/components/pdv/SaleItemsList';
import SaleSummary from '@/components/pdv/SaleSummary';
import ProductGrid from '@/components/pdv/ProductGrid';
import PaymentModal from '@/components/pdv/PaymentModal';
import QuickProductModal from '@/components/pdv/QuickProductModal';
import ReceiptModal from '@/components/pdv/ReceiptModal';
import PriceCorrectionModal from '@/components/pdv/PriceCorrectionModal';
import MinimizedSalesBar from '@/components/pdv/MinimizedSalesBar';
import { calculateSaleTotals, formatCurrency } from '@/lib/helpers';

const EMPTY_SALE = { items: [], payments: [], discount_value: 0, discount_type: 'valor', observation: '', sale_type: 'normal' };

export default function PDV() {
  const { user, config } = useOutletContext();
  const [products, setProducts] = useState([]);
  const [activeSale, setActiveSale] = useState(EMPTY_SALE);
  const [minimizedSales, setMinimizedSales] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showQuickProduct, setShowQuickProduct] = useState(null);
  const [showReceipt, setShowReceipt] = useState(null);
  const [showPriceCorrection, setShowPriceCorrection] = useState(false);
  const [maxMinimized, setMaxMinimized] = useState(3);
  const [saleNumber, setSaleNumber] = useState(1);
  const [activeTab, setActiveTab] = useState('cart');
  const [productsLoading, setProductsLoading] = useState(true);
  const inputRef = useRef(null);
  const searchContainerRef = useRef(null);
  const modalsOpen = showPayment || showQuickProduct || showReceipt || showPriceCorrection;

  useEffect(() => { loadProducts(); loadMaxMinimized(); getNextSaleNumber(); }, []);

  useEffect(() => {
    const handler = (e) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) setShowResults(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (!searchQuery) { setSearchResults([]); return; }
    const q = searchQuery.toLowerCase();
    setSearchResults(products.filter(p =>
      p.name.toLowerCase().includes(q) || (p.category && p.category.toLowerCase().includes(q)) ||
      (p.barcode && p.barcode.includes(q)) || (p.internal_code && p.internal_code.toLowerCase().includes(q))
    ).slice(0, 10));
    setShowResults(true);
  }, [searchQuery, products]);

  const loadProducts = async () => {
    setProductsLoading(true);
    try {
      const data = await base44.entities.Product.list('-updated_date', 500);
      setProducts(data.filter(p => p.status === 'ativo'));
    } catch { toast.error('Erro ao carregar produtos'); }
    setProductsLoading(false);
  };

  const loadMaxMinimized = async () => {
    try {
      const configs = await base44.entities.SystemConfig.filter({ key: 'limite_vendas_minimizadas' });
      if (configs.length > 0) setMaxMinimized(parseInt(configs[0].value) || 3);
    } catch {}
  };

  const getNextSaleNumber = async () => {
    try {
      const sales = await base44.entities.Sale.list('-sale_number', 1);
      setSaleNumber((sales[0]?.sale_number || 0) + 1);
    } catch {}
  };

  // Barcode scanner handler
  useEffect(() => {
    let buffer = ''; let timeout;
    const handler = (e) => {
      const active = document.activeElement;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) return;
      if (modalsOpen) return;
      if (e.key === 'Enter') { if (buffer.length > 0) { handleCapture(buffer); buffer = ''; } return; }
      if (e.key.length === 1) {
        buffer += e.key;
        clearTimeout(timeout);
        timeout = setTimeout(() => { if (buffer.length >= 2) handleCapture(buffer); buffer = ''; }, 400);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [products, activeSale, modalsOpen]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') {
        if (showPayment) setShowPayment(false);
        else if (showQuickProduct) setShowQuickProduct(null);
        else if (showReceipt) setShowReceipt(null);
        else if (showPriceCorrection) setShowPriceCorrection(false);
        return;
      }
      if (modalsOpen) return;

      if (e.key === 'F1' || e.key === 'F3') {
        e.preventDefault();
        if (activeSale.items.length > 0) setShowPayment(true);
      } else if (e.key === 'F2') {
        e.preventDefault();
        if (activeSale.items.length > 0) removeItem(activeSale.items.length - 1);
      } else if (e.key === 'F4') {
        e.preventDefault();
        inputRef.current?.focus();
      } else if (e.key === 'F6') {
        e.preventDefault();
        handleDiscard();
      } else if (e.key === 'F7') {
        e.preventDefault();
        handleMinimize();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [activeSale, modalsOpen, showPayment, showQuickProduct, showReceipt, showPriceCorrection]);

  const handleCapture = (code) => {
    const exact = products.find(p => p.barcode === code || p.internal_code === code);
    if (exact) { addProductToSale(exact); return; }
    const nameMatch = products.find(p => p.name.toLowerCase() === code.toLowerCase());
    if (nameMatch) { addProductToSale(nameMatch); return; }
    if (/^\d{6,}$/.test(code)) { setShowQuickProduct({ barcode: code }); }
    else { setSearchQuery(code); setShowResults(true); inputRef.current?.focus(); }
  };

  const addProductToSale = (product) => {
    if (product.status === 'inativo') { toast.error('Produto inativo'); return; }
    setActiveSale(prev => {
      const existing = prev.items.find(i => i.product_id === product.id);
      let newItems;
      if (product.unit === 'peso') {
        if (existing) {
          newItems = prev.items.map(i => i.product_id === product.id
            ? { ...i, weight: (i.weight || 0) + 0.1, subtotal: ((i.weight || 0) + 0.1) * i.unit_price } : i);
        } else {
          newItems = [...prev.items, { product_id: product.id, product_name: product.name, barcode: product.barcode || '', internal_code: product.internal_code || '', quantity: 1, weight: 0.1, unit_price: product.sale_price, subtotal: 0.1 * product.sale_price, unit: product.unit }];
        }
      } else {
        if (existing) {
          newItems = prev.items.map(i => i.product_id === product.id
            ? { ...i, quantity: i.quantity + 1, subtotal: (i.quantity + 1) * i.unit_price } : i);
        } else {
          newItems = [...prev.items, { product_id: product.id, product_name: product.name, barcode: product.barcode || '', internal_code: product.internal_code || '', quantity: 1, weight: null, unit_price: product.sale_price, subtotal: product.sale_price, unit: product.unit }];
        }
      }
      return { ...prev, items: newItems };
    });
    setActiveTab('cart');
    if ((product.quantity || 0) <= 0) toast(`⚠️ Estoque baixo: ${product.name}`);
  };

  const updateQuantity = (idx, qty) => {
    setActiveSale(prev => ({ ...prev, items: prev.items.map((item, i) => i === idx ? { ...item, quantity: Math.max(1, qty), subtotal: Math.max(1, qty) * item.unit_price } : item) }));
  };
  const updateWeight = (idx, weight) => {
    setActiveSale(prev => ({ ...prev, items: prev.items.map((item, i) => i === idx ? { ...item, weight: parseFloat(weight) || 0, subtotal: (parseFloat(weight) || 0) * item.unit_price } : item) }));
  };
  const removeItem = (idx) => setActiveSale(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }));

  const handlePriceCorrection = async (idx, newPrice) => {
    const item = activeSale.items[idx];
    const product = products.find(p => p.id === item.product_id);
    if (!product) return;
    const oldPrice = product.sale_price;
    await base44.entities.Product.update(product.id, { sale_price: newPrice });
    setActiveSale(prev => ({ ...prev, items: prev.items.map((it, i) => i === idx ? { ...it, unit_price: newPrice, subtotal: (it.weight || it.quantity) * newPrice } : it) }));
    await base44.entities.ProductAudit.create({ product_id: product.id, product_name: product.name, field_changed: 'sale_price', previous_value: String(oldPrice), new_value: String(newPrice), user_id: user.id, user_name: user.full_name || user.email, change_origin: 'valor_errado', sale_number: saleNumber, observation: 'Correção de valor na tela de vendas' });
    await base44.entities.GeneralAudit.create({ action_type: 'alteracao_preco', entity_type: 'product', entity_id: product.id, user_id: user.id, user_name: user.full_name || user.email, description: `Preço de ${product.name} alterado de ${formatCurrency(oldPrice)} para ${formatCurrency(newPrice)}`, details: JSON.stringify({ old: oldPrice, new: newPrice, sale_number: saleNumber }) });
    toast.success('Valor atualizado e auditoria registrada');
    setShowPriceCorrection(false);
    loadProducts();
  };

  const handleMinimize = () => {
    if (activeSale.items.length === 0) return;
    if (minimizedSales.length >= maxMinimized) { toast.error(`Limite de ${maxMinimized} vendas minimizadas`); return; }
    setMinimizedSales([...minimizedSales, { ...activeSale, sale_number: saleNumber, _localId: Date.now() }]);
    setActiveSale(EMPTY_SALE); setSearchQuery(''); getNextSaleNumber();
    toast.success(`Venda #${saleNumber} minimizada`);
  };
  const handleRestore = (idx) => {
    setActiveSale(minimizedSales[idx]);
    setMinimizedSales(minimizedSales.filter((_, i) => i !== idx));
    setSearchQuery('');
  };
  const handleDiscardMinimized = (idx) => setMinimizedSales(minimizedSales.filter((_, i) => i !== idx));
  const handleDiscard = () => {
    if (activeSale.items.length === 0) return;
    if (!confirm('Descartar a venda atual?')) return;
    setActiveSale(EMPTY_SALE); setSearchQuery('');
    toast.success('Venda descartada');
  };

  const completeSale = async (paymentData) => {
    try {
      const { subtotal, discount, total } = calculateSaleTotals({ ...activeSale, ...paymentData });
      const paidAmount = paymentData.payments.filter(p => p.method !== 'fiado').reduce((s, p) => s + (p.amount || 0), 0);
      const change = paidAmount > total ? paidAmount - total : 0;
      const sale = await base44.entities.Sale.create({
        sale_number: saleNumber, seller_id: user.id, seller_name: user.full_name || user.email, status: 'concluida',
        items: activeSale.items, payments: paymentData.payments, subtotal, discount_value: activeSale.discount_value,
        discount_type: activeSale.discount_type, total, paid_amount: paidAmount, change_amount: change,
        observation: paymentData.observation, sale_type: paymentData.sale_type,
      });
      for (const item of activeSale.items) {
        const product = products.find(p => p.id === item.product_id);
        if (product) {
          const qtyChange = item.unit === 'peso' ? item.weight : item.quantity;
          await base44.entities.Product.update(product.id, { quantity: (product.quantity || 0) - qtyChange });
        }
      }
      if (paymentData.sale_type === 'fiado' && paymentData.fiado) {
        await base44.entities.FiadoRecord.create({
          sale_id: sale.id, sale_number: sale.sale_number, responsible_name: paymentData.fiado.responsible_name,
          phone: paymentData.fiado.phone || '', observation: paymentData.fiado.observation || '',
          total_amount: total, seller_id: user.id, seller_name: user.full_name || user.email, status: 'pendente',
        });
      }
      await base44.entities.GeneralAudit.create({ action_type: 'venda_concluida', entity_type: 'sale', entity_id: sale.id, user_id: user.id, user_name: user.full_name || user.email, description: `Venda #${sale.sale_number} concluída - ${formatCurrency(total)}`, details: JSON.stringify({ total, items: activeSale.items.length, sale_type: paymentData.sale_type }) });
      setShowPayment(false); setShowReceipt(sale); setActiveSale(EMPTY_SALE); setSearchQuery('');
      loadProducts(); getNextSaleNumber();
    } catch { toast.error('Erro ao concluir venda'); }
  };

  return (
    <div className="flex flex-col h-full bg-muted/20">
      {/* Header */}
      <div className="px-5 py-3 bg-card border-b border-border flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-base font-bold">Venda #{saleNumber}</h1>
          <p className="text-xs text-muted-foreground">{user.full_name || user.email}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden lg:flex items-center gap-2.5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 text-[10px] font-mono font-medium bg-muted border border-border rounded">F1</kbd> Pagamento</span>
            <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 text-[10px] font-mono font-medium bg-muted border border-border rounded">F2</kbd> Remover</span>
            <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 text-[10px] font-mono font-medium bg-muted border border-border rounded">F4</kbd> Buscar</span>
            <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 text-[10px] font-mono font-medium bg-muted border border-border rounded">F6</kbd> Nova venda</span>
            <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 text-[10px] font-mono font-medium bg-muted border border-border rounded">F7</kbd> Minimizar</span>
          </div>
          <button onClick={() => setShowPriceCorrection(true)} disabled={activeSale.items.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-amber-200 text-amber-700 rounded-lg hover:bg-amber-50 disabled:opacity-40 transition-colors">
            <Edit3 className="w-4 h-4" /> Valor errado
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Search + Tabs + Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Search */}
          <div className="p-4 pb-2 flex-shrink-0">
            <div className="relative" ref={searchContainerRef}>
              <ProductSearch query={searchQuery} onQueryChange={setSearchQuery} inputRef={inputRef} onFocus={() => setShowResults(true)} />
              {showResults && searchQuery && <SearchResults results={searchResults} onSelect={(p) => { addProductToSale(p); setSearchQuery(''); setShowResults(false); }} />}
            </div>
          </div>

          {/* Tabs */}
          <div className="px-4 flex gap-1 flex-shrink-0">
            <button
              onClick={() => setActiveTab('cart')}
              className={`flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
                activeTab === 'cart' ? 'border-accent text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <ShoppingCart className="w-4 h-4" />
              Carrinho
              {activeSale.items.length > 0 && (
                <span className="ml-0.5 px-1.5 py-0.5 text-[10px] font-bold bg-accent text-accent-foreground rounded-full">{activeSale.items.length}</span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('products')}
              className={`flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
                activeTab === 'products' ? 'border-accent text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
              Produtos
            </button>
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-hidden px-4 pb-4">
            <div className="h-full flex flex-col bg-card border border-border rounded-xl overflow-hidden shadow-sm">
              {activeTab === 'cart' ? (
                <>
                  <div className="px-4 py-2.5 border-b border-border bg-muted/30 text-xs font-medium text-muted-foreground flex items-center gap-2 flex-shrink-0">
                    <Package className="w-4 h-4" /> Itens da Venda
                  </div>
                  <SaleItemsList items={activeSale.items} onUpdateQuantity={updateQuantity} onUpdateWeight={updateWeight} onRemoveItem={removeItem} />
                </>
              ) : (
                <ProductGrid products={products} onSelect={addProductToSale} loading={productsLoading} />
              )}
            </div>
          </div>
        </div>

        {/* Right: Summary */}
        <div className="w-80 flex flex-col bg-card border-l border-border flex-shrink-0">
          <SaleSummary sale={activeSale} onPaymentClick={() => setShowPayment(true)} onMinimizeClick={handleMinimize} onDiscardClick={handleDiscard} onDiscountChange={setActiveSale} canDiscount={true} minimizedCount={minimizedSales.length} maxMinimized={maxMinimized} />
        </div>
      </div>

      {showPayment && <PaymentModal sale={activeSale} config={config} onClose={() => setShowPayment(false)} onComplete={completeSale} onMinimize={() => { setShowPayment(false); handleMinimize(); }} onDiscard={() => { setShowPayment(false); handleDiscard(); }} />}
      {showQuickProduct && <QuickProductModal barcode={showQuickProduct.barcode} onSave={(product) => { setProducts(prev => [...prev, product]); addProductToSale(product); setShowQuickProduct(null); }} onClose={() => setShowQuickProduct(null)} />}
      {showReceipt && <ReceiptModal sale={showReceipt} config={config} onClose={() => setShowReceipt(null)} onNewSale={() => setShowReceipt(null)} />}
      {showPriceCorrection && <PriceCorrectionModal items={activeSale.items} onSave={handlePriceCorrection} onClose={() => setShowPriceCorrection(false)} />}
      <MinimizedSalesBar sales={minimizedSales} onRestore={handleRestore} onDiscard={handleDiscardMinimized} />
    </div>
  );
}