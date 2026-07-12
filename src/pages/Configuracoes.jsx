import React, { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { nexoApi } from '@/api/nexoApi';
import { toast } from 'react-hot-toast';
import {
  AlertTriangle,
  CheckCircle2,
  Hash,
  Layers,
  LockKeyhole,
  MapPin,
  PackageSearch,
  Paintbrush,
  RotateCcw,
  Save,
  Store,
} from 'lucide-react';
import ImageUploadField from '@/components/ImageUploadField';
import { deriveSidebarPalette, normalizeHex } from '@/lib/color-contrast';

const RESET_OPTIONS = [
  { value: 'products', label: 'Estoque e produtos', description: 'Exclui todos os produtos e o histórico de alterações de produtos.' },
  { value: 'fiados', label: 'Vendas fiadas', description: 'Exclui todos os registros da tela de fiados.' },
  { value: 'sales', label: 'Histórico de vendas', description: 'Exclui os registros da tela de vendas. Os fiados e a sequência de numeração são mantidos.' },
  { value: 'audits', label: 'Auditoria', description: 'Exclui o histórico geral e o histórico de alterações dos produtos.' },
  { value: 'cash', label: 'Histórico de caixas', description: 'Exclui as aberturas e fechamentos de caixa já registrados. Feche os caixas ativos antes de continuar.' },
  { value: 'operational', label: 'Todos os dados operacionais', description: 'Exclui estoque, vendas, fiados, caixas e auditorias. Usuários e configurações são mantidos.' },
];

const DEFAULT_SIDEBAR_BACKGROUND = '#0f1b17';
const DEFAULT_SIDEBAR_ACCENT = '#16a06a';

export default function Configuracoes() {
  const { user, config: layoutConfig = {} } = /** @type {any} */ (useOutletContext());
  const [configs, setConfigs] = useState({});
  const [initialValues, setInitialValues] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetTarget, setResetTarget] = useState('');
  const [resetConfirmation, setResetConfirmation] = useState('');
  const [resetting, setResetting] = useState(false);
  const [requireCashRegister, setRequireCashRegister] = useState(Boolean(user?.require_cash_register));
  const [initialRequireCashRegister, setInitialRequireCashRegister] = useState(Boolean(user?.require_cash_register));

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

  const getValue = (key, fallback = '') => configs[key]?.value ?? layoutConfig[key] ?? fallback;

  const handleChange = (key, value) => {
    setConfigs(previous => ({
      ...previous,
      [key]: { ...(previous[key] || {}), key, value, label: previous[key]?.label || key },
    }));
  };

  const sidebarPalette = useMemo(() => deriveSidebarPalette(
    getValue('sidebar_background_color', DEFAULT_SIDEBAR_BACKGROUND),
    getValue('sidebar_accent_color', user?.primary_color || DEFAULT_SIDEBAR_ACCENT),
  ), [configs, layoutConfig, user?.primary_color]);

  const changedKeys = useMemo(() => Object.keys(configs).filter(key => String(configs[key]?.value ?? '') !== String(initialValues[key] ?? '')), [configs, initialValues]);
  const cashSettingChanged = user?.role === 'admin' && requireCashRegister !== initialRequireCashRegister;
  const hasChanges = changedKeys.length > 0 || cashSettingChanged;
  const changeCount = changedKeys.length + (cashSettingChanged ? 1 : 0);

  const handleSave = async event => {
    event.preventDefault();
    const marketName = String(getValue('nome_mercado', '')).trim();
    const limit = Number(getValue('limite_vendas_minimizadas', '3'));
    const lowStockLimit = Number(getValue('limite_estoque_baixo', '5'));
    if (!marketName) return toast.error('Informe o nome do mercado.');
    if (!Number.isInteger(limit) || limit < 1 || limit > 10) return toast.error('O limite de vendas abertas deve estar entre 1 e 10.');
    if (!Number.isInteger(lowStockLimit) || lowStockLimit < 1 || lowStockLimit > 9999) return toast.error('O limite de estoque baixo deve ser um número entre 1 e 9.999.');
    if (!sidebarPalette.isAccentDistinct) return toast.error('A cor de destaque da barra lateral está muito parecida com o fundo. Escolha uma cor com mais contraste.');
    if (!hasChanges) return;

    setSaving(true);
    try {
      const updatedEntries = await Promise.all(changedKeys.map(async key => {
        const config = configs[key];
        const saved = config.id
          ? await nexoApi.entities.SystemConfig.update(config.id, { value: config.value })
          : await nexoApi.entities.SystemConfig.create({ key: config.key, value: config.value, label: config.label || config.key });
        return [key, saved];
      }));
      if (cashSettingChanged) await nexoApi.cash.updateSettings(requireCashRegister);

      const savedMap = Object.fromEntries(updatedEntries);
      const nextConfigs = { ...configs, ...savedMap };
      const nextValues = Object.fromEntries(Object.entries(nextConfigs).map(([key, value]) => [key, value.value ?? '']));
      setConfigs(nextConfigs);
      setInitialValues(Object.fromEntries(Object.entries(nextValues).map(([key, value]) => [key, String(value)])));
      setInitialRequireCashRegister(requireCashRegister);
      window.dispatchEvent(new CustomEvent('nexo:config-updated', { detail: nextValues }));
      toast.success('Configurações salvas.');
    } catch (error) {
      toast.error(error.message || 'Erro ao salvar configurações.');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    const option = RESET_OPTIONS.find(item => item.value === resetTarget);
    if (!option) return toast.error('Selecione a área que deseja zerar.');
    if (resetConfirmation.trim().toUpperCase() !== 'ZERAR') return toast.error('Digite ZERAR para confirmar.');
    const confirmed = window.confirm(`Zerar ${option.label.toLowerCase()}? Esta ação não pode ser desfeita.`);
    if (!confirmed) return;

    setResetting(true);
    try {
      const response = await nexoApi.maintenance.reset(resetTarget, resetConfirmation);
      const values = Object.values(response.deleted || {}).filter(value => Number.isFinite(Number(value))).map(Number);
      const removed = Number(response.deleted?.total ?? values.reduce((sum, value) => sum + value, 0));
      toast.success(`${option.label} zerado${removed ? `: ${removed} registro${removed === 1 ? '' : 's'} removido${removed === 1 ? '' : 's'}` : ''}.`);
      setResetTarget('');
      setResetConfirmation('');
    } catch (error) {
      toast.error(error.message || 'Não foi possível zerar os dados.');
    } finally {
      setResetting(false);
    }
  };

  if (loading) return <div className="grid min-h-[50vh] place-items-center text-sm text-muted-foreground"><div className="text-center"><div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-accent" />Carregando configurações...</div></div>;

  const brandName = getValue('nome_mercado', user?.market_name || 'Mercado');
  const logoUrl = getValue('logo_url', user?.logo_url || '');

  return (
    <form onSubmit={handleSave} className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-accent/10 px-3 py-1 text-xs font-bold text-accent"><Store className="h-3.5 w-3.5" /> Identidade e operação</div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Configurações</h1>
          <p className="mt-1 text-sm text-muted-foreground">Personalize o mercado e ajuste o funcionamento do sistema.</p>
        </div>
        <button type="submit" disabled={!hasChanges || saving} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-accent px-5 text-sm font-bold text-accent-foreground shadow-sm transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground">
          <Save className="h-4 w-4" /> {saving ? 'Salvando...' : hasChanges ? `Salvar ${changeCount} alteração${changeCount > 1 ? 'ões' : ''}` : 'Tudo salvo'}
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6 lg:col-span-7">
          <div className="mb-5">
            <h2 className="flex items-center gap-2 font-bold"><Store className="h-5 w-5 text-accent" /> Dados do mercado</h2>
            <p className="mt-1 text-sm text-muted-foreground">Informações exibidas na identificação, recibos e relatórios.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-semibold sm:col-span-2">
              Nome do mercado <span className="text-destructive">*</span>
              <input required value={brandName} onChange={event => handleChange('nome_mercado', event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20" placeholder="Nome do estabelecimento" />
            </label>
            <label className="block text-sm font-semibold">
              <span className="inline-flex items-center gap-1.5"><Hash className="h-3.5 w-3.5 text-muted-foreground" /> CNPJ</span>
              <input inputMode="numeric" value={getValue('cnpj')} onChange={event => handleChange('cnpj', formatCnpj(event.target.value))} maxLength={18} className="mt-1.5 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20" placeholder="00.000.000/0000-00" />
            </label>
            <label className="block text-sm font-semibold sm:col-span-2">
              <span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-muted-foreground" /> Endereço</span>
              <textarea value={getValue('endereco')} onChange={event => handleChange('endereco', event.target.value)} rows={3} maxLength={240} className="mt-1.5 w-full resize-none rounded-xl border border-border bg-background p-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20" placeholder="Rua, número, bairro e cidade" />
            </label>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6 lg:col-span-5">
          <h2 className="font-bold">Logo do mercado</h2>
          <p className="mt-1 text-sm text-muted-foreground">Use uma imagem nítida com fundo transparente quando possível.</p>
          <div className="mt-4 rounded-xl border border-border bg-muted/25 p-3">
            <ImageUploadField value={logoUrl} onChange={value => handleChange('logo_url', value)} kind="market" scopeId={user?.market_id || user?.id} label="Arquivo da logo" name={brandName} previewClassName="h-20 w-36 rounded-xl" />
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6 lg:col-span-12">
          <div className="grid gap-5 lg:grid-cols-[1fr_420px] lg:items-center">
            <div>
              <h2 className="flex items-center gap-2 font-bold"><Paintbrush className="h-5 w-5 text-accent" /> Cores da barra lateral</h2>
              <p className="mt-1 text-sm text-muted-foreground">Escolha o fundo e o destaque. A cor dos textos é calculada automaticamente para manter a leitura.</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <ColorField label="Cor de fundo" value={sidebarPalette.background} onChange={value => handleChange('sidebar_background_color', value)} />
                <ColorField label="Cor de destaque" value={sidebarPalette.accent} onChange={value => handleChange('sidebar_accent_color', value)} />
              </div>
              <div className={`mt-3 flex items-start gap-2 rounded-xl px-3 py-2 text-xs font-semibold ${sidebarPalette.isAccentDistinct ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-red-500/10 text-red-700 dark:text-red-300'}`}>
                {sidebarPalette.isAccentDistinct ? <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none" /> : <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />}
                <span>{sidebarPalette.isAccentDistinct ? `Contraste aprovado. Texto automático: ${sidebarPalette.foreground === '#ffffff' ? 'branco' : 'escuro'}.` : 'Fundo e destaque estão muito parecidos. O salvamento ficará bloqueado até aumentar o contraste.'}</span>
              </div>
            </div>
            <div className="overflow-hidden rounded-2xl border border-border shadow-sm" style={{ backgroundColor: sidebarPalette.background, color: sidebarPalette.foreground }}>
              <div className="flex min-h-16 items-center gap-3 border-b px-4" style={{ borderColor: sidebarPalette.border }}>
                {logoUrl ? <img src={logoUrl} alt="Prévia da logo" className="max-h-10 max-w-40 object-contain object-left" /> : <strong>{brandName}</strong>}
              </div>
              <div className="space-y-2 p-3">
                <div className="flex h-11 items-center gap-3 rounded-xl px-3 font-bold" style={{ backgroundColor: sidebarPalette.accentSurface, color: sidebarPalette.foreground }}><span className="h-4 w-4 rounded" style={{ backgroundColor: sidebarPalette.accent }} /> Estoque <span className="ml-auto h-2 w-2 rounded-full" style={{ backgroundColor: sidebarPalette.accent }} /></div>
                <div className="flex h-11 items-center gap-3 rounded-xl px-3 opacity-70"><span className="h-4 w-4 rounded border" style={{ borderColor: sidebarPalette.border }} /> Vendas</div>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm lg:col-span-4">
          <h2 className="flex items-center gap-2 font-bold"><Layers className="h-5 w-5 text-accent" /> Vendas abertas</h2>
          <p className="mt-1 text-sm text-muted-foreground">Quantidade máxima de vendas minimizadas.</p>
          <label className="mt-4 block text-sm font-semibold">
            Limite simultâneo
            <input type="number" min="1" max="10" step="1" value={getValue('limite_vendas_minimizadas', '3')} onChange={event => handleChange('limite_vendas_minimizadas', event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20" />
          </label>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm lg:col-span-4">
          <h2 className="flex items-center gap-2 font-bold"><PackageSearch className="h-5 w-5 text-accent" /> Estoque baixo</h2>
          <p className="mt-1 text-sm text-muted-foreground">Quantidade usada nos alertas da tela de produtos.</p>
          <label className="mt-4 block text-sm font-semibold">
            Quantidade de alerta
            <input type="number" min="1" max="9999" step="1" value={getValue('limite_estoque_baixo', '5')} onChange={event => handleChange('limite_estoque_baixo', event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20" />
          </label>
        </section>

        {user?.role === 'admin' && (
          <section className="rounded-2xl border border-border bg-card p-5 shadow-sm lg:col-span-4">
            <h2 className="flex items-center gap-2 font-bold"><LockKeyhole className="h-5 w-5 text-accent" /> Abertura de caixa</h2>
            <p className="mt-1 text-sm text-muted-foreground">Controle o acesso dos vendedores ao PDV.</p>
            <label className="mt-4 flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-border bg-muted/25 p-3">
              <span><strong className="block text-sm">Exigir abertura para vendedores</strong><span className="mt-0.5 block text-xs text-muted-foreground">Administradores não são bloqueados.</span></span>
              <input type="checkbox" checked={requireCashRegister} onChange={event => setRequireCashRegister(event.target.checked)} className="h-5 w-5 accent-[var(--market-primary)]" />
            </label>
          </section>
        )}
      </div>

      {user?.role === 'admin' && (
        <section className="mt-6 rounded-2xl border border-destructive/30 bg-card p-5 shadow-sm sm:p-6" aria-labelledby="reset-data-title">
          <div className="flex items-start gap-3">
            <div className="grid h-11 w-11 flex-none place-items-center rounded-xl bg-destructive/10 text-destructive"><AlertTriangle className="h-5 w-5" /></div>
            <div><h2 id="reset-data-title" className="font-bold">Zerar dados de uma tela</h2><p className="mt-1 text-sm text-muted-foreground">Escolha uma área específica. Usuários e configurações são preservados.</p></div>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-[1fr_240px_auto] md:items-end">
            <label className="text-sm font-semibold">Área para limpar<select value={resetTarget} onChange={event => { setResetTarget(event.target.value); setResetConfirmation(''); }} className="mt-1.5 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-destructive focus:ring-2 focus:ring-destructive/20"><option value="">Selecione uma área</option>{RESET_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
            <label className="text-sm font-semibold">Confirmação<input value={resetConfirmation} onChange={event => setResetConfirmation(event.target.value)} autoComplete="off" placeholder="Digite ZERAR" className="mt-1.5 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm uppercase outline-none focus:border-destructive focus:ring-2 focus:ring-destructive/20" /></label>
            <button type="button" onClick={handleReset} disabled={!resetTarget || resetConfirmation.trim().toUpperCase() !== 'ZERAR' || resetting} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-destructive px-5 text-sm font-bold text-destructive-foreground transition hover:bg-destructive/90 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"><RotateCcw className={`h-4 w-4 ${resetting ? 'animate-spin' : ''}`} /> {resetting ? 'Zerando...' : 'Zerar dados'}</button>
          </div>
          {resetTarget && <p className="mt-3 rounded-xl bg-destructive/5 px-3 py-2 text-xs font-medium text-destructive">{RESET_OPTIONS.find(option => option.value === resetTarget)?.description}</p>}
        </section>
      )}

      {hasChanges && <div className="mt-4 rounded-xl border border-amber-300/60 bg-amber-500/10 px-4 py-3 text-sm font-medium text-amber-800 dark:text-amber-200">Há alterações ainda não salvas.</div>}
    </form>
  );
}

function ColorField({ label, value, onChange }) {
  const normalized = normalizeHex(value, '#000000');
  const [draft, setDraft] = useState(normalized.toUpperCase());

  useEffect(() => { setDraft(normalized.toUpperCase()); }, [normalized]);

  const commit = candidate => {
    const text = String(candidate || '').trim();
    if (/^#[0-9a-f]{6}$/i.test(text) || /^#[0-9a-f]{3}$/i.test(text)) {
      const next = normalizeHex(text, normalized);
      setDraft(next.toUpperCase());
      onChange(next);
      return;
    }
    setDraft(normalized.toUpperCase());
  };

  return (
    <label className="text-sm font-semibold">
      {label}
      <span className="mt-1.5 flex h-11 overflow-hidden rounded-xl border border-border bg-background focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20">
        <input type="color" value={normalized} onChange={event => { const next = event.target.value; setDraft(next.toUpperCase()); onChange(next); }} className="h-full w-14 cursor-pointer border-0 bg-transparent p-1" aria-label={label} />
        <input value={draft} onChange={event => setDraft(event.target.value.toUpperCase())} onBlur={event => commit(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); commit(event.currentTarget.value); } }} maxLength={7} className="min-w-0 flex-1 bg-transparent px-3 font-mono text-sm uppercase outline-none" aria-label={`${label} em hexadecimal`} />
      </span>
    </label>
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
