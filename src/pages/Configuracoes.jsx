import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { toast } from 'react-hot-toast';
import { Save, Store, Hash, MapPin, Image, Layers } from 'lucide-react';
import { LOGO_URL } from '@/lib/helpers';

export default function Configuracoes() {
  const [configs, setConfigs] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadConfigs(); }, []);

  const loadConfigs = async () => {
    try {
      const data = await base44.entities.SystemConfig.list();
      const map = {};
      data.forEach(c => { map[c.key] = c; });
      setConfigs(map);
    } catch { toast.error('Erro ao carregar configurações'); }
    setLoading(false);
  };

  const getValue = (key, fallback = '') => configs[key]?.value || fallback;

  const handleChange = (key, value) => {
    setConfigs(prev => ({
      ...prev,
      [key]: { ...(prev[key] || {}), key, value, label: prev[key]?.label || key }
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const key of Object.keys(configs)) {
        const cfg = configs[key];
        if (cfg.id) {
          await base44.entities.SystemConfig.update(cfg.id, { value: cfg.value });
        } else {
          await base44.entities.SystemConfig.create({ key: cfg.key, value: cfg.value, label: cfg.label || cfg.key });
        }
      }
      toast.success('Configurações salvas');
    } catch { toast.error('Erro ao salvar configurações'); }
    setSaving(false);
  };

  if (loading) return <div className="text-center py-12 text-muted-foreground">Carregando...</div>;

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Configurações do Sistema</h1>
        <p className="text-sm text-muted-foreground">Dados do mercado e parâmetros operacionais</p>
      </div>

      <div className="space-y-4">
        {/* Market info */}
        <div className="bg-white border rounded-lg p-5 space-y-3">
          <h3 className="text-sm font-bold flex items-center gap-2"><Store className="w-4 h-4 text-accent" /> Dados do Mercado</h3>
          <div>
            <label className="text-xs text-muted-foreground">Nome do Mercado</label>
            <input type="text" value={getValue('nome_mercado', 'Mercadinho Alameda das Árvores')}
              onChange={(e) => handleChange('nome_mercado', e.target.value)}
              className="w-full mt-1 px-3 py-2 border border-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground flex items-center gap-1"><Hash className="w-3 h-3" /> CNPJ</label>
            <input type="text" value={getValue('cnpj')} onChange={(e) => handleChange('cnpj', e.target.value)}
              className="w-full mt-1 px-3 py-2 border border-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="w-3 h-3" /> Endereço</label>
            <input type="text" value={getValue('endereco')} onChange={(e) => handleChange('endereco', e.target.value)}
              className="w-full mt-1 px-3 py-2 border border-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground flex items-center gap-1"><Image className="w-3 h-3" /> URL do Logo</label>
            <input type="text" value={getValue('logo_url', LOGO_URL)} onChange={(e) => handleChange('logo_url', e.target.value)}
              className="w-full mt-1 px-3 py-2 border border-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
            <img src={getValue('logo_url', LOGO_URL)} alt="Logo" className="h-16 mt-2 object-contain" />
          </div>
        </div>

        {/* Operational */}
        <div className="bg-white border rounded-lg p-5 space-y-3">
          <h3 className="text-sm font-bold flex items-center gap-2"><Layers className="w-4 h-4 text-accent" /> Parâmetros Operacionais</h3>
          <div>
            <label className="text-xs text-muted-foreground">Limite Máximo de Vendas Minimizadas</label>
            <input type="number" min="1" max="10" value={getValue('limite_vendas_minimizadas', '3')}
              onChange={(e) => handleChange('limite_vendas_minimizadas', e.target.value)}
              className="w-full mt-1 px-3 py-2 border border-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
            <p className="text-xs text-muted-foreground mt-1">Quantas vendas podem ficar abertas simultaneamente no caixa.</p>
          </div>
        </div>

        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 bg-accent text-accent-foreground rounded-lg hover:bg-accent/90 disabled:opacity-40 text-sm font-bold">
          <Save className="w-4 h-4" /> Salvar Configurações
        </button>
      </div>
    </div>
  );
}