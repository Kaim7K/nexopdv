import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { toast } from 'react-hot-toast';
import { Search, Eye, Ban, Trash2, X, History } from 'lucide-react';
import { formatCurrency, formatDateTime, PAYMENT_METHODS } from '@/lib/helpers';

export default function Vendas() {
  const { user } = useOutletContext();
  const isGerente = user.role === 'gerente' || user.role === 'admin';
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterPayment, setFilterPayment] = useState('');
  const [filterSeller, setFilterSeller] = useState('');
  const [detailSale, setDetailSale] = useState(null);

  useEffect(() => { loadSales(); }, []);

  const loadSales = async () => {
    setLoading(true);
    try {
      let data = await base44.entities.Sale.list('-created_date', 200);
      data = data.filter(s => s.status === 'concluida' || s.status === 'cancelada');
      if (!isGerente) data = data.filter(s => s.seller_id === user.id);
      setSales(data);
    } catch { toast.error('Erro ao carregar vendas'); }
    setLoading(false);
  };

  const sellers = [...new Set(sales.map(s => s.seller_name).filter(Boolean))];

  const filtered = sales.filter(s => {
    const matchSearch = !search || String(s.sale_number).includes(search);
    const matchPayment = !filterPayment || (s.payments || []).some(p => p.method === filterPayment);
    const matchSeller = !filterSeller || s.seller_name === filterSeller;
    return matchSearch && matchPayment && matchSeller;
  });

  const canCancel = (sale) => isGerente || sale.seller_id === user.id;

  const handleCancel = async (sale) => {
    const reason = prompt('Motivo do cancelamento (opcional):') || '';
    if (!confirm(`Confirmar cancelamento da venda #${sale.sale_number}?`)) return;
    try {
      await base44.entities.Sale.update(sale.id, { status: 'cancelada', cancellation_reason: reason, cancelled_by_id: user.id, cancelled_by_name: user.full_name || user.email });
      await base44.entities.GeneralAudit.create({ action_type: 'venda_cancelada', entity_type: 'sale', entity_id: sale.id, user_id: user.id, user_name: user.full_name || user.email, description: `Venda #${sale.sale_number} cancelada`, details: JSON.stringify({ reason, total: sale.total }) });
      toast.success('Venda cancelada');
      loadSales();
    } catch { toast.error('Erro ao cancelar venda'); }
  };

  const handleDelete = async (sale) => {
    if (!confirm(`Excluir definitivamente a venda #${sale.sale_number}?`)) return;
    try {
      await base44.entities.Sale.delete(sale.id);
      await base44.entities.GeneralAudit.create({ action_type: 'venda_excluida', entity_type: 'sale', entity_id: sale.id, user_id: user.id, user_name: user.full_name || user.email, description: `Venda #${sale.sale_number} excluída`, details: JSON.stringify({ total: sale.total, items: sale.items?.length }) });
      toast.success('Venda excluída');
      loadSales();
    } catch { toast.error('Erro ao excluir venda'); }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Histórico de Vendas</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{isGerente ? 'Todas as vendas' : 'Suas vendas'} • {filtered.length} registros</p>
      </div>

      {/* Filters */}
      <div className="flex gap-2.5 mb-4 flex-wrap">
        <div className="flex-1 relative min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por número da venda..."
            className="w-full pl-10 pr-4 py-2.5 bg-card border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent transition-all" />
        </div>
        {isGerente && (
          <>
            <select value={filterSeller} onChange={(e) => setFilterSeller(e.target.value)} className="px-3 py-2.5 bg-card border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent transition-all">
              <option value="">Todos vendedores</option>
              {sellers.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={filterPayment} onChange={(e) => setFilterPayment(e.target.value)} className="px-3 py-2.5 bg-card border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent transition-all">
              <option value="">Todos pagamentos</option>
              {PAYMENT_METHODS.map(p => <option key={p.method} value={p.method}>{p.label}</option>)}
            </select>
          </>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <div className="w-8 h-8 border-4 border-secondary border-t-accent rounded-full animate-spin mb-3"></div>
          Carregando vendas...
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <History className="w-12 h-12 mb-3 text-muted-foreground/20" />
          <p className="text-sm font-medium">Nenhuma venda encontrada</p>
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Venda</th>
                  <th className="px-4 py-3 text-left font-medium">Data/Hora</th>
                  {isGerente && <th className="px-4 py-3 text-left font-medium">Vendedor</th>}
                  <th className="px-4 py-3 text-left font-medium">Pagamento</th>
                  <th className="px-4 py-3 text-left font-medium">Tipo</th>
                  <th className="px-4 py-3 text-right font-medium">Total</th>
                  <th className="px-4 py-3 text-center font-medium">Status</th>
                  <th className="px-4 py-3 text-center font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => (
                  <tr key={s.id} className="border-t border-border hover:bg-secondary/20 transition-colors">
                    <td className="px-4 py-2.5 font-medium">#{s.sale_number}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{formatDateTime(s.created_date)}</td>
                    {isGerente && <td className="px-4 py-2.5">{s.seller_name}</td>}
                    <td className="px-4 py-2.5 text-muted-foreground">{(s.payments || []).map(p => PAYMENT_METHODS.find(m => m.method === p.method)?.label || p.method).join(', ')}</td>
                    <td className="px-4 py-2.5">
                      {s.sale_type === 'fiado' ? <span className="px-2 py-0.5 rounded-full text-xs bg-orange-100 text-orange-700 font-medium">Fiado</span> : <span className="text-muted-foreground text-xs">Normal</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{formatCurrency(s.total)}</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.status === 'concluida' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{s.status}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => setDetailSale(s)} className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors" title="Ver detalhes"><Eye className="w-4 h-4" /></button>
                        {s.status === 'concluida' && canCancel(s) && (
                          <>
                            <button onClick={() => handleCancel(s)} className="w-8 h-8 flex items-center justify-center rounded-lg text-amber-600 hover:bg-amber-50 transition-colors" title="Cancelar"><Ban className="w-4 h-4" /></button>
                            <button onClick={() => handleDelete(s)} className="w-8 h-8 flex items-center justify-center rounded-lg text-destructive hover:bg-destructive/10 transition-colors" title="Excluir"><Trash2 className="w-4 h-4" /></button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail modal */}
      {detailSale && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setDetailSale(null)}>
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] overflow-y-auto border border-border" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card z-10">
              <h2 className="text-lg font-bold">Venda #{detailSale.sale_number}</h2>
              <button onClick={() => setDetailSale(null)} className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Data</span><span>{formatDateTime(detailSale.created_date)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Vendedor</span><span>{detailSale.seller_name}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Tipo</span><span className="capitalize">{detailSale.sale_type}</span></div>
              {detailSale.observation && <div className="flex justify-between gap-4"><span className="text-muted-foreground flex-shrink-0">Obs.</span><span className="text-right">{detailSale.observation}</span></div>}
              {detailSale.cancellation_reason && <div className="flex justify-between gap-4"><span className="text-muted-foreground flex-shrink-0">Motivo cancel.</span><span className="text-right text-destructive">{detailSale.cancellation_reason}</span></div>}
              <hr className="border-dashed border-border" />
              {(detailSale.items || []).map((item, i) => (
                <div key={i} className="flex justify-between"><span className="truncate pr-2">{item.quantity || item.weight}x {item.product_name}</span><span className="tabular-nums font-medium">{formatCurrency(item.subtotal)}</span></div>
              ))}
              <hr className="border-dashed border-border" />
              <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span className="tabular-nums">{formatCurrency(detailSale.subtotal)}</span></div>
              <div className="flex justify-between text-muted-foreground"><span>Desconto</span><span className="tabular-nums">{formatCurrency(detailSale.discount_value)}</span></div>
              <div className="flex justify-between font-bold text-base pt-1"><span>Total</span><span className="text-accent tabular-nums">{formatCurrency(detailSale.total)}</span></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}