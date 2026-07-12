import React, { useEffect, useState } from 'react';
import { Clock3, Mail, Pencil, Plus, Send, Trash2, X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { nexoApi } from '@/api/nexoApi';

export default function StockAlertSettings() {
  const [data, setData] = useState({ enabled:true, time:'20:00', recipients:[], deliveries:[] });
  const [email, setEmail] = useState('');
  const [editingId, setEditingId] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');

  const load = async () => {
    try { setData(await nexoApi.stockAlerts.settings()); }
    catch (error) { toast.error(error.message || 'Não foi possível carregar os alertas.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const saveSettings = async next => {
    const previous = data;
    const settings = { enabled:next.enabled, time:next.time };
    setData(current => ({ ...current, ...settings }));
    setBusy('settings');
    try { await nexoApi.stockAlerts.updateSettings(settings); toast.success(next.enabled === previous.enabled ? 'Horário do relatório atualizado.' : next.enabled ? 'Envio automático ativado.' : 'Envio automático desativado.'); }
    catch (error) { toast.error(error.message); await load(); }
    finally { setBusy(''); }
  };

  const saveRecipient = async event => {
    event.preventDefault();
    setBusy('recipient');
    try {
      if (editingId) await nexoApi.stockAlerts.updateRecipient(editingId, { email, active:true });
      else await nexoApi.stockAlerts.addRecipient({ email, active:true });
      toast.success(editingId ? 'Destinatário atualizado.' : 'Destinatário adicionado.');
      setEmail(''); setEditingId(''); await load();
    } catch (error) { toast.error(error.message); }
    finally { setBusy(''); }
  };

  const updateRecipient = async recipient => {
    setBusy(recipient.id);
    try { await nexoApi.stockAlerts.updateRecipient(recipient.id, { email:recipient.email, active:!recipient.active }); await load(); }
    catch (error) { toast.error(error.message); }
    finally { setBusy(''); }
  };

  const removeRecipient = async recipient => {
    if (!window.confirm(`Remover ${recipient.email} dos alertas?`)) return;
    setBusy(recipient.id);
    try { await nexoApi.stockAlerts.removeRecipient(recipient.id); toast.success('Destinatário removido.'); await load(); }
    catch (error) { toast.error(error.message); }
    finally { setBusy(''); }
  };

  const sendTest = async recipient => {
    setBusy(`test:${recipient.id}`);
    try { const result = await nexoApi.stockAlerts.test(recipient.email); toast.success(`E-mail de teste enviado com ${result.product_count} produto(s).`); }
    catch (error) { toast.error(error.message); }
    finally { setBusy(''); }
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-5 sm:p-6 lg:col-span-12" aria-labelledby="stock-alert-title">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div><h2 id="stock-alert-title" className="flex items-center gap-2 font-bold"><Mail className="h-5 w-5 text-accent" /> Relatório diário de reposição</h2><p className="mt-1 text-sm text-muted-foreground">Envia somente quando houver produtos que precisam de reposição. Horário de Salvador/Bahia.</p></div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-xl border border-border bg-muted/20 px-3 text-sm font-semibold"><span>Ativar envio automático</span><input type="checkbox" checked={data.enabled !== false} disabled={busy === 'settings'} onChange={event => saveSettings({ ...data, enabled:event.target.checked })} className="h-5 w-5 accent-[var(--market-primary)]" /></label>
          <label className="flex items-center gap-2 text-sm font-semibold"><Clock3 className="h-4 w-4 text-muted-foreground" /> Horário<input type="time" value="20:00" disabled className="h-11 rounded-xl border border-border bg-muted px-3 opacity-70" title="No plano Hobby da Vercel, o agendamento gratuito pode executar apenas uma vez por dia." /></label>
        </div>
      </div>

      <form onSubmit={saveRecipient} className="mt-5 flex flex-col gap-2 sm:flex-row">
        <label className="min-w-0 flex-1"><span className="sr-only">E-mail destinatário</span><input required type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="responsavel@mercado.com" className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20" /></label>
        <button disabled={busy === 'recipient'} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-bold text-accent-foreground disabled:opacity-50">{editingId ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />} {editingId ? 'Salvar edição' : 'Adicionar e-mail'}</button>
        {editingId && <button type="button" onClick={() => { setEditingId(''); setEmail(''); }} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border px-4 text-sm font-bold"><X className="h-4 w-4" /> Cancelar</button>}
      </form>

      <div className="mt-4 divide-y divide-border overflow-hidden rounded-xl border border-border">
        {loading ? <p className="p-5 text-sm text-muted-foreground">Carregando destinatários...</p> : !data.recipients.length ? <p className="p-5 text-sm text-muted-foreground">Nenhum destinatário cadastrado.</p> : data.recipients.map(recipient => (
          <div key={recipient.id} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
            <label className="flex min-w-0 flex-1 items-center gap-3"><input type="checkbox" checked={recipient.active !== false} disabled={busy === recipient.id} onChange={() => updateRecipient(recipient)} className="h-5 w-5 accent-[var(--market-primary)]" /><span className="truncate text-sm font-semibold">{recipient.email}</span></label>
            <div className="grid grid-cols-3 gap-1.5">
              <button type="button" onClick={() => sendTest(recipient)} disabled={Boolean(busy)} className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-border px-3 text-xs font-bold hover:bg-muted disabled:opacity-50"><Send className="h-4 w-4" /> Testar</button>
              <button type="button" onClick={() => { setEditingId(recipient.id); setEmail(recipient.email); }} className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-border px-3 text-xs font-bold hover:bg-muted"><Pencil className="h-4 w-4" /> Editar</button>
              <button type="button" onClick={() => removeRecipient(recipient)} disabled={busy === recipient.id} className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-destructive/25 px-3 text-xs font-bold text-destructive hover:bg-destructive/10 disabled:opacity-50"><Trash2 className="h-4 w-4" /> Excluir</button>
            </div>
          </div>
        ))}
      </div>

      {data.deliveries?.length > 0 && <div className="mt-5"><h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Envios recentes</h3><div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{data.deliveries.slice(0,6).map(delivery => <div key={delivery.id} className="rounded-xl border border-border bg-muted/20 p-3 text-xs"><strong className="block capitalize">{delivery.status}</strong><span className="mt-1 block text-muted-foreground">{delivery.report_date} · {delivery.product_count ?? 0} produto(s) · {delivery.attempts || 1} tentativa(s)</span></div>)}</div></div>}
    </section>
  );
}
