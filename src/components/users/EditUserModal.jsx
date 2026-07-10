import React, { useState, useRef } from 'react';
import { X, Camera, Loader2, User as UserIcon } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'react-hot-toast';

export default function EditUserModal({ user, onClose, onSaved }) {
  const [fullName, setFullName] = useState(user.full_name || '');
  const [role, setRole] = useState(user.role);
  const [photoUrl, setPhotoUrl] = useState(user.photo_url || '');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('Arquivo muito grande (máx 5MB)'); return; }
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setPhotoUrl(file_url);
    } catch { toast.error('Erro ao enviar foto'); }
    setUploading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await base44.entities.User.update(user.id, {
        full_name: fullName,
        role,
        photo_url: photoUrl
      });
      toast.success('Usuário atualizado');
      onSaved();
      onClose();
    } catch (e) { toast.error('Erro ao atualizar usuário'); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Editar Usuário</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex flex-col items-center mb-4">
          <div className="relative">
            <div className="w-24 h-24 rounded-full overflow-hidden bg-secondary flex items-center justify-center border-2 border-border">
              {photoUrl ? (
                <img src={photoUrl} alt="Foto" className="w-full h-full object-cover" />
              ) : (
                <UserIcon className="w-10 h-10 text-muted-foreground" />
              )}
            </div>
            <button onClick={() => fileRef.current?.click()} disabled={uploading}
              className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-accent text-accent-foreground flex items-center justify-center hover:bg-accent/90 disabled:opacity-50">
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
            </button>
            <input ref={fileRef} type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
          </div>
          <p className="text-xs text-muted-foreground mt-2">{user.email}</p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">Nome</label>
            <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Nome completo"
              className="w-full mt-1 px-3 py-2 border border-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Perfil</label>
            <select value={role} onChange={(e) => setRole(e.target.value)}
              className="w-full mt-1 px-3 py-2 border border-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-accent">
              <option value="vendedor">Vendedor</option>
              <option value="gerente">Gerente</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-secondary">Cancelar</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 px-4 py-2 rounded-lg bg-accent text-accent-foreground hover:bg-accent/90 disabled:opacity-40 text-sm font-bold">
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}