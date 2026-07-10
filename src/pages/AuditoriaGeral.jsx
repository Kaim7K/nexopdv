import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { toast } from 'react-hot-toast';
import { Search, ScrollText } from 'lucide-react';
import { formatDateTime, getPaymentLabel } from '@/lib/helpers';

export default function AuditoriaGeral() {
  const [audits, setAudits] = useState([]);
  const [productAudits, setProductAudits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterUser, setFilterUser] = useState('');

  useEffect(() => { loadAudits(); }, []);

  const loadAudits = async () => {
    try {
      const [general, product] = await Promise.all([
        base44.entities.GeneralAudit.list('-created_date', 300),
        base44.entities.ProductAudit.list('-created_date', 300),
      ]);
      setAudits(general);
      setProductAudits(product);
    } catch { toast.error('Erro ao carregar auditoria'); }
    setLoading(false);
  };

  const actionTypes = [...new Set([
    ...audits.map(a => a.action_type),
    ...productAudits.map(a => a.change_origin),
  ])];
  const users = [...new Set([
    ...audits.map(a => a.user_name).filter(Boolean),
    ...productAudits.map(a => a.user_name).filter(Boolean),
  ])];

  const allEntries = [
    ...audits.map(a => ({
      id: a.id, date: a.created_date, type: a.action_type, user: a.user_name,
      description: a.description, details: a.details, category: 'Geral',
    })),
    ...productAudits.map(a => ({
      id: a.id, date: a.created_date, type: a.change_origin, user: a.user_name,
      description: `${a.product_name}: ${a.field_changed} alterado de "${a.previous_value}" para "${a.new_value}"${a.sale_number ? ` (Venda #${a.sale_number})` : ''}`,
      details: a.observation || '', category: 'Produto',
    })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date));

  const filtered = allEntries.filter(e => {
    const matchSearch = !search || e.description.toLowerCase().includes(search.toLowerCase());
    const matchType = !filterType || e.type === filterType;
    const matchUser = !filterUser || e.user === filterUser;
    return matchSearch && matchType && matchUser;
  });

  const typeColor = (type) => {
    if (type?.includes('preco')) return 'bg-amber-100 text-amber-700';
    if (type?.includes('concluida') || type?.includes('quitado')) return 'bg-green-100 text-green-700';
    if (type?.includes('cancel') || type?.includes('exclui')) return 'bg-red-100 text-red-700';
    if (type?.includes('cadastr')) return 'bg-blue-100 text-blue-700';
    return 'bg-gray-100 text-gray-700';
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2"><ScrollText className="w-6 h-6 text-accent" /> Auditoria Geral</h1>
        <p className="text-sm text-muted-foreground">{filtered.length} registros de auditoria</p>
      </div>

      <div className="flex gap-3 mb-4 flex-wrap">
        <div className="flex-1 relative min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar na auditoria..."
            className="w-full pl-10 pr-4 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
        </div>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
          className="px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent">
          <option value="">Todos tipos</option>
          {actionTypes.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={filterUser} onChange={(e) => setFilterUser(e.target.value)}
          className="px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent">
          <option value="">Todos usuários</option>
          {users.map(u => <option key={u} value={u}>{u}</option>)}
        </select>
      </div>

      {loading ? <div className="text-center py-12 text-muted-foreground">Carregando...</div> : (
        <div className="bg-white border rounded-lg overflow-hidden">
          <div className="max-h-[calc(100vh-200px)] overflow-y-auto">
            {filtered.map(e => (
              <div key={e.id} className="px-4 py-3 border-b hover:bg-secondary/30 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${typeColor(e.type)}`}>{e.type}</span>
                    <span className="text-xs text-muted-foreground">{e.category}</span>
                  </div>
                  <p className="text-sm mt-1">{e.description}</p>
                  {e.details && <p className="text-xs text-muted-foreground mt-0.5">{e.details}</p>}
                </div>
                <div className="text-right text-xs text-muted-foreground flex-shrink-0">
                  <div>{e.user}</div>
                  <div>{formatDateTime(e.date)}</div>
                </div>
              </div>
            ))}
            {filtered.length === 0 && <div className="text-center py-12 text-muted-foreground">Nenhum registro encontrado.</div>}
          </div>
        </div>
      )}
    </div>
  );
}