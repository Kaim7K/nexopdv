import React, { useState } from "react";
import { X, User as UserIcon } from "lucide-react";
import { nexoApi } from "@/api/nexoApi";
import { toast } from "react-hot-toast";
export default function EditUserModal({ user, onClose, onSaved }) {
  const [form, setForm] = useState({
      full_name: user.full_name || "",
      role: user.role,
      photo_url: user.photo_url || "",
      active: user.active !== false,
    }),
    [saving, setSaving] = useState(false);
  const save = async (e) => {
    e.preventDefault();
    if (!form.full_name.trim()) {
      toast.error("Informe o nome");
      return;
    }
    setSaving(true);
    try {
      await nexoApi.entities.User.update(user.id, form);
      toast.success("Usuário atualizado");
      await onSaved();
      onClose();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <div
      className="fixed inset-0 bg-black/50 grid place-items-center z-50 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <form
        onSubmit={save}
        className="bg-card rounded-xl p-6 w-full max-w-sm space-y-3"
      >
        <div className="flex justify-between">
          <h2 className="font-bold text-lg">Editar usuário</h2>
          <button type="button" onClick={onClose}>
            <X className="w-5" />
          </button>
        </div>
        <div className="mx-auto w-20 h-20 rounded-full bg-secondary overflow-hidden grid place-items-center">
          {form.photo_url ? (
            <img
              src={form.photo_url}
              alt="Foto"
              className="w-full h-full object-cover"
            />
          ) : (
            <UserIcon />
          )}
        </div>
        <label className="text-xs block">
          Nome
          <input
            required
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            className="block border rounded p-2 mt-1 w-full"
          />
        </label>
        <label className="text-xs block">
          URL da foto
          <input
            type="url"
            value={form.photo_url}
            onChange={(e) => setForm({ ...form, photo_url: e.target.value })}
            className="block border rounded p-2 mt-1 w-full"
          />
        </label>
        <label className="text-xs block">
          Perfil
          <select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            className="block border rounded p-2 mt-1 w-full"
          >
            <option value="vendedor">Vendedor</option>
            <option value="gerente">Gerente</option>
            <option value="admin">Administrador</option>
          </select>
        </label>
        <button
          disabled={saving}
          className="w-full bg-accent text-white p-2 rounded-lg"
        >
          {saving ? "Salvando..." : "Salvar"}
        </button>
      </form>
    </div>
  );
}
