import React, { useEffect, useState } from "react";
import { nexoApi } from "@/api/nexoApi";
import { Store, Plus, Save, X } from "lucide-react";
import { toast } from "react-hot-toast";
const MODULES = [
  ["pdv", "PDV"],
  ["estoque", "Estoque"],
  ["vendas", "Vendas"],
  ["fiados", "Fiados"],
  ["relatorios", "Relatórios"],
  ["auditoria", "Auditoria"],
  ["usuarios", "Usuários"],
  ["configuracoes", "Configurações"],
];
const EMPTY = {
  name: "",
  slug: "",
  logo_url: "",
  admin_name: "",
  admin_email: "",
  admin_password: "",
  primary_color: "#16a06a",
  secondary_color: "#0f5132",
};
export default function AdminMercados() {
  const [markets, setMarkets] = useState([]),
    [open, setOpen] = useState(false),
    [form, setForm] = useState(EMPTY),
    [saving, setSaving] = useState(false);
  const load = async () => {
    try {
      setMarkets(await nexoApi.markets.list());
    } catch (e) {
      toast.error(e.message);
    }
  };
  useEffect(() => {
    load();
  }, []);
  const create = async (e) => {
    e.preventDefault();
    const slug = form.slug
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-");
    if (
      !form.name.trim() ||
      !slug ||
      !form.admin_email ||
      form.admin_password.length < 8
    ) {
      toast.error(
        "Preencha nome, identificador, email e uma senha de 8 caracteres",
      );
      return;
    }
    setSaving(true);
    try {
      await nexoApi.markets.create({ ...form, slug });
      setForm(EMPTY);
      setOpen(false);
      await load();
      toast.success("Mercado e administrador criados");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };
  const update = async (m, data) => {
    try {
      await nexoApi.markets.update(m.id, data);
      await load();
    } catch (e) {
      toast.error(e.message);
    }
  };
  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="flex flex-wrap gap-3 justify-between">
        <div>
          <h1 className="text-2xl font-bold">Mercados</h1>
          <p className="text-sm text-muted-foreground">
            Clientes, identidade e funcionalidades
          </p>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="bg-accent text-white px-4 py-2 rounded-lg flex gap-2"
        >
          <Plus className="w-4" />
          Novo mercado
        </button>
      </div>
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-50 grid place-items-center p-4"
          onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <form
            onSubmit={create}
            className="bg-card rounded-xl p-5 w-full max-w-2xl grid sm:grid-cols-2 gap-3 max-h-[90vh] overflow-auto"
          >
            <div className="sm:col-span-2 flex justify-between">
              <h2 className="font-bold text-lg">Novo mercado</h2>
              <button type="button" onClick={() => setOpen(false)}>
                <X className="w-5" />
              </button>
            </div>
            {[
              ["name", "Nome do mercado", "text"],
              ["slug", "Identificador", "text"],
              ["admin_name", "Nome do administrador", "text"],
              ["admin_email", "Email do administrador", "email"],
              ["admin_password", "Senha inicial", "password"],
              ["logo_url", "URL da logo", "url"],
            ].map(([key, label, type]) => (
              <label className="text-xs" key={key}>
                {label}
                <input
                  required={!["logo_url"].includes(key)}
                  minLength={key === "admin_password" ? 8 : undefined}
                  type={type}
                  value={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  className="block border rounded p-2 mt-1 w-full"
                />
              </label>
            ))}
            <label className="text-xs">
              Cor principal
              <input
                type="color"
                value={form.primary_color}
                onChange={(e) =>
                  setForm({ ...form, primary_color: e.target.value })
                }
                className="block w-full h-10 mt-1"
              />
            </label>
            <label className="text-xs">
              Cor secundária
              <input
                type="color"
                value={form.secondary_color}
                onChange={(e) =>
                  setForm({ ...form, secondary_color: e.target.value })
                }
                className="block w-full h-10 mt-1"
              />
            </label>
            <button
              disabled={saving}
              className="sm:col-span-2 bg-accent text-white rounded-lg p-2 flex justify-center gap-2"
            >
              <Save className="w-4" />
              {saving ? "Criando..." : "Criar com todos os módulos"}
            </button>
          </form>
        </div>
      )}
      <div className="grid lg:grid-cols-2 gap-4 mt-6">
        {markets.map((m) => (
          <article className="border bg-card rounded-xl p-5" key={m.id}>
            <div className="flex items-center gap-3">
              <div
                className="w-11 h-11 rounded-lg grid place-items-center overflow-hidden"
                style={{ background: m.primary_color }}
              >
                {m.logo_url ? (
                  <img
                    src={m.logo_url}
                    alt=""
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <Store className="text-white" />
                )}
              </div>
              <div className="flex-1">
                <b>{m.name}</b>
                <p className="text-xs text-muted-foreground">/{m.slug}</p>
              </div>
              <button
                onClick={() => update(m, { active: !m.active })}
                className={`text-xs px-2 py-1 rounded-full ${m.active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}
              >
                {m.active ? "Ativo" : "Inativo"}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-4">
              {MODULES.map(([key, label]) => (
                <label key={key} className="p-2 bg-muted rounded text-sm">
                  <input
                    className="mr-2"
                    type="checkbox"
                    checked={(m.enabled_modules || []).includes(key)}
                    onChange={() =>
                      update(m, {
                        enabled_modules: (m.enabled_modules || []).includes(key)
                          ? m.enabled_modules.filter((x) => x !== key)
                          : [...(m.enabled_modules || []), key],
                      })
                    }
                  />
                  {label}
                </label>
              ))}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
