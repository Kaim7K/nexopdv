import React, { useState } from "react";
import { X } from "lucide-react";
import { nexoApi } from "@/api/nexoApi";
import { toast } from "react-hot-toast";
import ImageUploadField from "@/components/ImageUploadField";
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
        <ImageUploadField
          value={form.photo_url}
          onChange={(value) => setForm({ ...form, photo_url: value })}
          kind="user"
          scopeId={user.id}
          label="Foto do usuário"
          name={form.full_name || user.email}
          previewClassName="h-20 w-20 rounded-full"
          objectFit="cover"
        />
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
