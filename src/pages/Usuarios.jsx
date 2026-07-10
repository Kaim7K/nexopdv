import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { toast } from 'react-hot-toast';
import { UserPlus, Shield, User, Mail, Pencil } from 'lucide-react';
import EditUserModal from '@/components/users/EditUserModal';

export default function Usuarios() {
  const { user: currentUser } = useOutletContext();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('vendedor');
  const [inviting, setInviting] = useState(false);
  const [editUser, setEditUser] = useState(null);

  useEffect(() => { loadUsers(); }, []);

  const loadUsers = async () => {
    try {
      const data = await base44.entities.User.list();
      setUsers(data);
    } catch { toast.error('Erro ao carregar usuários'); }
    setLoading(false);
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim()) { toast.error('Email obrigatório'); return; }
    setInviting(true);
    try {
      await base44.users.inviteUser(inviteEmail.trim(), inviteRole);
      toast.success('Convite enviado');
      setShowInvite(false); setInviteEmail('');
      loadUsers();
    } catch (e) { toast.error('Erro ao convidar usuário'); }
    setInviting(false);
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      await base44.entities.User.update(userId, { role: newRole });
      toast.success('Perfil atualizado');
      loadUsers();
    } catch { toast.error('Erro ao atualizar perfil'); }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Usuários</h1>
          <p className="text-sm text-muted-foreground">{users.length} usuários cadastrados</p>
        </div>
        <button onClick={() => setShowInvite(true)}
          className="flex items-center gap-2 px-4 py-2 bg-accent text-accent-foreground rounded-lg hover:bg-accent/90 text-sm font-bold">
          <UserPlus className="w-4 h-4" /> Convidar Usuário
        </button>
      </div>

      {loading ? <div className="text-center py-12 text-muted-foreground">Carregando...</div> : (
        <div className="grid gap-3">
          {users.map(u => (
            <div key={u.id} className="bg-white border rounded-lg p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0">
                {u.photo_url ? (
                  <img src={u.photo_url} alt={u.full_name || u.email} className="w-full h-full object-cover" />
                ) : (
                  <div className={`w-full h-full rounded-full flex items-center justify-center ${u.role === 'gerente' || u.role === 'admin' ? 'bg-accent/20 text-accent' : 'bg-secondary text-muted-foreground'}`}>
                    {u.role === 'gerente' || u.role === 'admin' ? <Shield className="w-5 h-5" /> : <User className="w-5 h-5" />}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium">{u.full_name || u.email}</div>
                <div className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                  <Mail className="w-3 h-3" /> {u.email}
                </div>
              </div>
              <button onClick={() => setEditUser(u)}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-sm font-medium hover:bg-secondary">
                <Pencil className="w-3.5 h-3.5" /> Editar
              </button>
            </div>
          ))}
        </div>
      )}

      {editUser && (
        <EditUserModal user={editUser} onClose={() => setEditUser(null)} onSaved={loadUsers} />
      )}

      {showInvite && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowInvite(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">Convidar Usuário</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground">Email</label>
                <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} autoFocus
                  className="w-full mt-1 px-3 py-2 border border-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Perfil</label>
                <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border border-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-accent">
                  <option value="vendedor">Vendedor</option>
                  <option value="gerente">Gerente</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowInvite(false)} className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-secondary">Cancelar</button>
              <button onClick={handleInvite} disabled={inviting}
                className="flex-1 px-4 py-2 rounded-lg bg-accent text-accent-foreground hover:bg-accent/90 disabled:opacity-40 text-sm font-bold">
                {inviting ? 'Enviando...' : 'Enviar Convite'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}