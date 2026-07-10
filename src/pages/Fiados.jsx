import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { toast } from 'react-hot-toast';
import { Search, Check, Ban, Phone, X, Clock } from 'lucide-react';
import { formatCurrency, formatDateTime } from '@/lib/helpers';

export default function Fiados() {
  const { user } = useOutletContext();
  const isGerente = user.role === 'gerente';
  const [fiados, setFiados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [settleFiado, setSettleFiado] = useState(null);

  useEffect(() => { loadFiados(); }, []);

  const loadFiados = async () => {
    setLoading(true);
    try {
      let data = await base44.entities.FiadoRecord.list('-created_date', 200);
      if (!isGerente) data = data.filter(f => f.seller_id === user.id);
      setFiados(data);
    } catch { toast.error('Erro ao carregar fiados'); }
    setLoading(false);
  };

  const filtered = fiados.filter(f => {
    const matchSearch = !search || (f.responsible_name || '').toLowerCase().includes(search.toLowerCase()) || String(f.sale_number).includes(search);
    const matchStatus = !filterStatus || f.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const canManage = (fiado) => isGerente || fiado.seller_id === user.id;

  const handleSettle = async (fiado, method) => {
    try {
      await base44.entities.FiadoRecord.update(fiado.id, { status: 'quitado', settlement_date: new Date().toISOString(), settlement_method: method, settled_by_id: user.id, settled_by_name: user.full_name || user.email });
      await base44.entities.GeneralAudit.create({ action_type: 'fiado_quitado', entity_type: 'fiado', entity_id: fiado.id, user_id: user.id, user_name: user.full_name || user.email, description: `Fiado #${fiado.sale_number} (${fiado.responsible_name}) quitado - ${formatCurrency(fiado.total_amount)}`, details: JSON.stringify({ method }) });
      toast.success('Fiado quitado');
      setSettleFiado(null);
      loadFiados();
    } catch { toast.error('Erro ao quitar fiado'); }
  };

  const handleCancel = async (fiado) => {
    if (!confirm(`Cancelar fiado de ${fiado.responsible_name}?`)) return;
    try {
      await base44.entities.FiadoRecord.update(fiado.id, { status: 'cancelado', settled_by_id: user.id, settled_by_name: user.full_name || user.email });
      await base44.entities.GeneralAudit.create({ action_type: 'fiado_cancelado', entity_type: 'fiado', entity_id: fiado.id, user_id: user.id, user_name: user.full_name || user.email, description: `Fiado #${fiado.sale_number} (${fiado.responsible_name}) cancelado`, details: '' });
      toast.success('Fiado cancelado');
      loadFiados();
    } catch { toast.error('Erro ao cancelar fiado'); }
  };

  const totalPendente = filtered.filter(f => f.status === 'pendente').reduce((s, f) => s + (f.total_amount || 0), 0);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Vendas Fiado</h1>
        <p className="text-sm text-muted-foreground">{filtered.length} registros • Pendente: <span className="text-orange-600 font-medium">{formatCurrency(totalPendente)}</span></p>
      </div>

      <div className="flex gap-3 mb-4 flex-wrap">
        <div className="flex-1 relative min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por responsável ou número..."
            className="w-full pl-10 pr-4 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
        </div>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent">
          <option value="">Todos status</option>
          <option value="pendente">Pendente</option>
          <option value="quitado">Quitado</option>
          <option value="cancelado">Cancelado</option>
        </select>
      </div>

      {loading ? <div className="text-center py-12 text-muted-foreground">Carregando...</div> : (
        <div className="grid gap-3">
          {filtered.map(f => (
            <div key={f.id} className="bg-white border rounded-lg p-4 flex items-center gap-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${f.status === 'pendente' ? 'bg-orange-100 text-orange-600' : f.status === 'quitado' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                {f.status === 'pendente' ? <Clock className="w-5 h-5" /> : f.status === 'quitado' ? <Check className="w-5 h-5" /> : <Ban className="w-5 h-5" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium">{f.responsible_name}</div>
                <div className="text-xs text-muted-foreground flex items-center gap-2">
                  <span>Venda #{f.sale_number}</span>
                  <span>•</span>
                  <span>{formatDateTime(f.created_date)}</span>
                  {isGerente && <><span>•</span><span>{f.seller_name}</span></>}
                  {f.phone && <><span>•</span><span className="flex items-center gap-0.5"><Phone className="w-3 h-3" />{f.phone}</span></>}
                </div>
                {f.observation && <div className="text-xs text-muted-foreground mt-0.5">{f.observation}</div>}
              </div>
              <div className="text-right">
                <div className="font-bold text-lg">{formatCurrency(f.total_amount)}</div>
                <span className={`px-2 py-0.5 rounded-full text-xs ${f.status === 'pendente' ? 'bg-orange-100 text-orange-700' : f.status === 'quitado' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{f.status}</span>
              </div>
              {f.status === 'pendente' && canManage(f) && (
                <div className="flex gap-1">
                  <button onClick={() => setSettleFiado(f)} className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700">Quitar</button>
                  <button onClick={() => handleCancel(f)} className="p-1.5 text-destructive hover:bg-destructive/10 rounded"><Ban className="w-4 h-4" /></button>
                </div>
              )}
            </div>
          ))}
          {filtered.length === 0 && <div className="text-center py-12 text-muted-foreground">Nenhum fiado encontrado.</div>}
        </div>
      )}

      {settleFiado && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSettleFiado(null)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Quitar Fiado</h2>
              <button onClick={() => setSettleFiado(null)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-2 mb-4 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Responsável</span><span className="font-medium">{settleFiado.responsible_name}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Valor</span><span className="font-bold text-accent">{formatCurrency(settleFiado.total_amount)}</span></div>
            </div>
            <div className="text-sm font-medium mb-2">Forma de quitação:</div>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {['dinheiro', 'pix', 'debito', 'credito'].map(m => (
                <button key={m} onClick={() => handleSettle(settleFiado, m)} className="px-3 py-2 border border-border rounded-lg text-sm hover:border-accent hover:bg-accent/5 capitalize">{m}</button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}