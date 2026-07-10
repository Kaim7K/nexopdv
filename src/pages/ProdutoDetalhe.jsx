import React, { useState, useEffect } from 'react';
import { useParams, Link, useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { toast } from 'react-hot-toast';
import { ArrowLeft, Package, Edit, Save, History, X } from 'lucide-react';
import { formatCurrency, formatDateTime } from '@/lib/helpers';
import ProductForm from '@/components/stock/ProductForm';

export default function ProdutoDetalhe() {
  const { id } = useParams();
  const { user } = useOutletContext();
  const [product, setProduct] = useState(null);
  const [audits, setAudits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);

  useEffect(() => { load(); }, [id]);

  const load = async () => {
    try {
      const p = await base44.entities.Product.get(id);
      setProduct(p);
      const a = await base44.entities.ProductAudit.filter({ product_id: id }, '-created_date', 50);
      setAudits(a);
    } catch { toast.error('Erro ao carregar produto'); }
    setLoading(false);
  };

  if (loading) return <div className="text-center py-12 text-muted-foreground">Carregando...</div>;
  if (!product) return <div className="text-center py-12 text-muted-foreground">Produto não encontrado</div>;

  return (
    <div className="p-6 max-w-3xl">
      <Link to="/estoque" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="w-4 h-4" /> Voltar ao estoque
      </Link>

      <div className="bg-white border rounded-lg p-6 mb-4">
        <div className="flex items-start gap-4">
          <div className="w-24 h-24 rounded-lg bg-secondary flex items-center justify-center overflow-hidden flex-shrink-0 border border-border">
            {product.image_url ? <img src={product.image_url} alt="" className="w-full h-full object-cover" /> : <Package className="w-10 h-10 text-muted-foreground" />}
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold">{product.name}</h1>
            <div className="grid grid-cols-2 gap-2 mt-3 text-sm">
              <div><span className="text-muted-foreground">Categoria: </span>{product.category || '-'}</div>
              <div><span className="text-muted-foreground">Unidade: </span>{product.unit}</div>
              <div><span className="text-muted-foreground">Cód. Barras: </span><span className="font-mono text-xs">{product.barcode || '-'}</span></div>
              <div><span className="text-muted-foreground">Cód. Interno: </span><span className="font-mono text-xs">{product.internal_code || '-'}</span></div>
              <div><span className="text-muted-foreground">Preço de Venda: </span><span className="font-bold text-accent">{formatCurrency(product.sale_price)}</span></div>
              <div><span className="text-muted-foreground">Preço de Custo: </span>{product.cost_price ? formatCurrency(product.cost_price) : '-'}</div>
              <div><span className="text-muted-foreground">Estoque: </span><span className={product.quantity <= 0 ? 'text-destructive font-medium' : ''}>{product.quantity || 0}</span></div>
              <div><span className="text-muted-foreground">Status: </span><span className={`px-2 py-0.5 rounded-full text-xs ${product.status === 'ativo' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{product.status}</span></div>
            </div>
          </div>
          <button onClick={() => setShowEdit(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-secondary">
            <Edit className="w-4 h-4" /> Editar
          </button>
        </div>
      </div>

      {/* Audit history */}
      <div className="bg-white border rounded-lg p-6">
        <h2 className="text-sm font-bold flex items-center gap-2 mb-4"><History className="w-4 h-4 text-accent" /> Auditoria do Produto</h2>
        {audits.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhuma alteração registrada.</p>
        ) : (
          <div className="space-y-3">
            {audits.map(a => (
              <div key={a.id} className="border-l-2 border-accent/30 pl-3 py-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{a.field_changed}</span>
                  <span className="text-xs text-muted-foreground">{formatDateTime(a.created_date)}</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  De <span className="font-medium text-muted-foreground">"{a.previous_value}"</span> para <span className="font-medium text-foreground">"{a.new_value}"</span>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Por {a.user_name} • {a.change_origin}{a.sale_number ? ` • Venda #${a.sale_number}` : ''}
                </div>
                {a.observation && <div className="text-xs text-muted-foreground italic mt-0.5">{a.observation}</div>}
              </div>
            ))}
          </div>
        )}
      </div>

      {showEdit && (
        <ProductForm product={product} categories={[]} user={user}
          onSave={() => { setShowEdit(false); load(); }}
          onClose={() => setShowEdit(false)} />
      )}
    </div>
  );
}