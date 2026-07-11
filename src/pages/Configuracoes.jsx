import React, { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { nexoApi } from '@/api/nexoApi';
import { toast } from 'react-hot-toast';
import { Hash, Layers, MapPin, Save, Store } from 'lucide-react';
import ImageUploadField from '@/components/ImageUploadField';

export default function Configuracoes() {
  const { user } = /** @type {any} */ (useOutletContext());
  const [configs, setConfigs] = useState({});
  const [initialValues, setInitialValues] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadConfigs = async () => {
    setLoading(true);
    try {
      const data = await nexoApi.entities.SystemConfig.list();
      const map = {};
      data.forEach(config => { map[config.key] = config; });
      setConfigs(map);
      setInitialValues(Object.fromEntries(Object.entries(map).map(([key, value]) => [key, String(value.value ?? '')])));
    } catch (error) {
      toast.error(error.message || 'Erro ao carregar configurações.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadConfigs(); }, []);

  const getValue = (key, fallback = '') => configs[key]?.value ?? fallback;

  const handleChange = (key, value) => {
    setConfigs(previous => ({
      ...previous,
      [key]: { ...(previous[key] || {}), key, value, label: previous[key]?.label || key },
    }));
  };

  const changedKeys = useMemo(() => Object.keys(configs).filter(key => String(configs[key]?.value ?? '') !== String(initialValues[key] ?? '')), [configs, initialValues]);
  const hasChanges = changedKeys.length > 0;

  const handleSave = async event => {
    event.preventDefault();
    const marketName = String(getValue('nome_mercado', '')).trim();
    const limit = Number(getValue('limite_vendas_minimizadas', '3'));
    if (!marketName) return toast.error('Informe o nome do mercado.');
    if (!Number.isInteger(limit) || limit < 1 || limit > 10) return toast.error('O limite de vendas abertas deve estar entre 1 e 10.');
    if (!hasChanges) return;

    setSaving(true);
    try {
      await Promise.all(changedKeys.map(async key => {
        const config = configs[key];
        if (config.id) return nexoApi.entities.SystemConfig.update(config.id, { value: config.value });
        return nexoApi.entities.SystemConfig.create({ key: config.key, value: config.value, label: config.label || config.key });
      }));
      toast.success('Configurações salvas.');
      await loadConfigs();
    } catch (error) {
      toast.error(error.message || 'Erro ao salvar configurações.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="grid min-h-[50vh] place-items-center text-sm text-muted-foreground"><div className="text-center"><div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-accent" />Carregando configurações...</div></div>;

  return (
    <form onSubmit={handleSave} className="mx-auto max-w-4xl p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-accent/10 px-3 py-1 text-xs font-bold text-accent"><Store className="h-3.5 w-3.5" /> Identidade e operação</div>
          <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Configurações</h1>
          <p className="mt-1 text-sm text-muted-foreground">Atualize os dados exibidos no sistema e nos recibos.</p>
        </div>
        <button type="submit" disabled={!hasChanges || saving} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-accent px-5 text-sm font-bold text-accent-foreground shadow-sm transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground">
          <Save className="h-4 w-4" /> {saving ? 'Salvando...' : hasChanges ? `Salvar ${changedKeys.length} alteração${changedKeys.length > 1 ? 'ões' : ''}` : 'Tudo salvo'}
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
          <div className="mb-5">
            <h2 className="flex items-center gap-2 font-black"><Store className="h-5 w-5 text-accent" /> Dados do mercado</h2>
            <p className="mt-1 text-sm text-muted-foreground">Essas informações aparecem na identificação e no recibo.</p>
          </div>
          <div className="space-y-4">
            <label className="block text-sm font-semibold">
              Nome do mercado <span className="text-destructive">*</span>
              <input required value={getValue('nome_mercado', user?.market_name || '')} onChange={event => handleChange('nome_mercado', event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20" placeholder="Nome do estabelecimento" />
            </label>
            <label className="block text-sm font-semibold">
              <span className="inline-flex items-center gap-1.5"><Hash className="h-3.5 w-3.5 text-muted-foreground" /> CNPJ</span>
              <input inputMode="numeric" value={getValue('cnpj')} onChange={event => handleChange('cnpj', formatCnpj(event.target.value))} maxLength={18} className="mt-1.5 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20" placeholder="00.000.000/0000-00" />
            </label>
            <label className="block text-sm font-semibold">
              <span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-muted-foreground" /> Endereço</span>
              <textarea value={getValue('endereco')} onChange={event => handleChange('endereco', event.target.value)} rows={3} maxLength={240} className="mt-1.5 w-full resize-none rounded-xl border border-border bg-background p-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20" placeholder="Rua, número, bairro e cidade" />
            </label>
          </div>
        </section>

        <div className="space-y-4">
          <section className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
            <h2 className="font-black">Logo do mercado</h2>
            <p className="mt-1 text-sm text-muted-foreground">Use uma imagem nítida com fundo transparente quando possível.</p>
            <div className="mt-4 rounded-xl border border-border bg-muted/25 p-3">
              <ImageUploadField value={getValue('logo_url')} onChange={value => handleChange('logo_url', value)} kind="market" scopeId={user?.market_id || user?.id} label="Arquivo da logo" name={getValue('nome_mercado', user?.market_name || 'mercado')} previewClassName="h-20 w-36 rounded-xl" />
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
            <h2 className="flex items-center gap-2 font-black"><Layers className="h-5 w-5 text-accent" /> Vendas abertas</h2>
            <p className="mt-1 text-sm text-muted-foreground">Defina quantas vendas podem ficar minimizadas ao mesmo tempo.</p>
            <label className="mt-4 block text-sm font-semibold">
              Limite simultâneo
              <input type="number" min="1" max="10" step="1" value={getValue('limite_vendas_minimizadas', '3')} onChange={event => handleChange('limite_vendas_minimizadas', event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20" />
              <span className="mt-1 block text-xs font-normal text-muted-foreground">Permitido: de 1 a 10 vendas.</span>
            </label>
          </section>
        </div>
      </div>

      {hasChanges && <div className="mt-4 rounded-xl border border-amber-300/60 bg-amber-500/10 px-4 py-3 text-sm font-medium text-amber-800 dark:text-amber-200">Há alterações ainda não salvas.</div>}
    </form>
  );
}

function formatCnpj(value) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 14);
  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}
