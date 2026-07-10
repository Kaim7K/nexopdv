import React, { useState, useEffect } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { toast } from 'react-hot-toast';
import { Plus, Search, Package, Edit, AlertTriangle, ExternalLink } from 'lucide-react';
import { formatCurrency } from '@/lib/helpers';
import ProductForm from '@/components/stock/ProductForm';

export default function Estoque() {
  const { user } = useOutletContext();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editProduct, setEditProduct] = useState(null);

  useEffect(() => { loadProducts(); }, []);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const data = await base44.entities.Product.list('-updated_date', 500);
      setProducts(data);
    } catch { toast.error('Erro ao carregar produtos'); }
    setLoading(false);
  };

  const categories = [...new Set(products.map(p => p.category).filter(Boolean))];

  const filtered = products.filter(p => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || (p.barcode && p.barcode.includes(search)) || (p.internal_code && p.internal_code.toLowerCase().includes(search.toLowerCase()));
    const matchCat = !filterCat || p.category === filterCat;
    return matchSearch && matchCat;
  });

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Gerenciamento de Estoque</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} produtos</p>
        </div>
        <button onClick={() => { setEditProduct(null); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-accent text-accent-foreground rounded-lg hover:bg-accent/90 text-sm font-bold">
          <Plus className="w-4 h-4" /> Novo Produto
        </button>
      </div>

      <div className="flex gap-3 mb-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar produto..."
            className="w-full pl-10 pr-4 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
        </div>
        <select value={filterCat} onChange={(e) => setFilterCat(e.target.value)}
          className="px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent">
          <option value="">Todas categorias</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : (
        <div className="bg-white rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Produto</th>
                <th className="px-4 py-2 text-left font-medium">Categoria</th>
                <th className="px-4 py-2 text-left font-medium">Cód. Barras</th>
                <th className="px-4 py-2 text-left font-medium">Cód. Interno</th>
                <th className="px-4 py-2 text-right font-medium">Preço</th>
                <th className="px-4 py-2 text-right font-medium">Estoque</th>
                <th className="px-4 py-2 text-center font-medium">Status</th>
                <th className="px-4 py-2 text-center font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id} className="border-t hover:bg-secondary/30">
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded bg-secondary flex items-center justify-center overflow-hidden flex-shrink-0">
                        {p.image_url ? <img src={p.image_url} alt="" className="w-full h-full object-cover" /> : <Package className="w-4 h-4 text-muted-foreground" />}
                      </div>
                      <span className="font-medium">{p.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{p.category || '-'}</td>
                  <td className="px-4 py-2 font-mono text-xs">{p.barcode || '-'}</td>
                  <td className="px-4 py-2 font-mono text-xs">{p.internal_code || '-'}</td>
                  <td className="px-4 py-2 text-right font-medium">{formatCurrency(p.sale_price)}</td>
                  <td className={`px-4 py-2 text-right font-medium ${(p.quantity || 0) <= 0 ? 'text-destructive' : ''}`}>
                    <div className="flex items-center justify-end gap-1">
                      {(p.quantity || 0) <= 0 && <AlertTriangle className="w-3.5 h-3.5" />}
                      {p.quantity || 0}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${p.status === 'ativo' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{p.status}</span>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => { setEditProduct(p); setShowForm(true); }} className="p-1.5 hover:bg-secondary rounded text-muted-foreground hover:text-foreground"><Edit className="w-4 h-4" /></button>
                      <Link to={`/produto/${p.id}`} className="p-1.5 hover:bg-secondary rounded text-muted-foreground hover:text-foreground"><ExternalLink className="w-4 h-4" /></Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {showForm && <ProductForm product={editProduct} categories={categories} user={user} onSave={() => { setShowForm(false); loadProducts(); }} onClose={() => setShowForm(false)} />}
    </div>
  );
}