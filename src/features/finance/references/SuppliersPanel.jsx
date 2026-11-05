import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { nexoApi } from '@/api/nexoApi';
import { Field, ReferenceCards } from '@/components/finance/FinanceUi';

export default function Suppliers({ bootstrap, refreshAll }) {
  const [form, setForm] = useState({
      name: '',
      document: '',
      email: '',
      phone: '',
    }),
    [saving, setSaving] = useState(false);
  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await nexoApi.finance.suppliers.create(form);
      toast.success('Fornecedor cadastrado.');
      setForm({ name: '', document: '', email: '', phone: '' });
      refreshAll();
    } catch (cause) {
      toast.error(cause.message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="finance-reference-layout grid content-start gap-4 xl:grid-cols-[22rem_minmax(0,1fr)]">
      <form onSubmit={save} className="surface-card h-fit space-y-3 p-3">
        <h3 className="font-bold">Novo fornecedor</h3>
        <Field label="Nome">
          <input
            required
            className="field"
            value={form.name}
            onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))}
          />
        </Field>
        <Field label="CPF ou CNPJ">
          <input
            className="field"
            value={form.document}
            onChange={(e) =>
              setForm((v) => ({ ...v, document: e.target.value }))
            }
          />
        </Field>
        <Field label="E-mail">
          <input
            type="email"
            className="field"
            value={form.email}
            onChange={(e) => setForm((v) => ({ ...v, email: e.target.value }))}
          />
        </Field>
        <Field label="Telefone">
          <input
            className="field"
            value={form.phone}
            onChange={(e) => setForm((v) => ({ ...v, phone: e.target.value }))}
          />
        </Field>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-accent font-bold text-accent-foreground"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />} Cadastrar
        </button>
      </form>
      <ReferenceCards
        items={bootstrap.suppliers}
        empty="Nenhum fornecedor cadastrado"
        render={(item) => (
          <>
            <strong className="text-sm">{item.name}</strong>
            <p className="mt-1 text-xs text-muted-foreground">
              {item.document || 'Documento não informado'}
              {item.phone ? ` · ${item.phone}` : ''}
            </p>
          </>
        )}
      />
    </div>
  );
}
