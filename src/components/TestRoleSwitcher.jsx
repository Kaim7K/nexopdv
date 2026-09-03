import { useState } from 'react';
import { FlaskConical, Loader2 } from 'lucide-react';
import { nexoApi } from '@/api/nexoApi';
import { useAuth } from '@/lib/AuthContext';

const TEST_ROLES = [
  { value: 'vendedor', label: 'Vendedor' },
  { value: 'gerente', label: 'Gerente' },
  { value: 'admin', label: 'Administrador' },
];

export default function TestRoleSwitcher() {
  const { user } = useAuth();
  const [switchingRole, setSwitchingRole] = useState('');

  if (import.meta.env.VITE_MOCK_API !== 'true') return null;

  const switchRole = async (role) => {
    if (switchingRole || user?.role === role) return;
    setSwitchingRole(role);
    try {
      await nexoApi.auth.simulateRole(role);
      window.location.assign('/pdv');
    } finally {
      setSwitchingRole('');
    }
  };

  return (
    <details className="group fixed bottom-3 right-3 z-[100] max-w-[calc(100vw-1.5rem)] rounded-xl border border-violet-300/60 bg-card/95 shadow-xl backdrop-blur">
      <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 px-3 text-xs font-black text-violet-700 dark:text-violet-300">
        <FlaskConical className="h-4 w-4" />
        Simular cargo
        {user?.role && (
          <span className="rounded-full bg-violet-500/10 px-2 py-0.5 font-bold capitalize">
            {user.role}
          </span>
        )}
      </summary>
      <div className="grid gap-1 border-t border-border p-2" aria-label="Escolher perfil de teste">
        {TEST_ROLES.map((role) => (
          <button
            key={role.value}
            type="button"
            disabled={Boolean(switchingRole) || user?.role === role.value}
            onClick={() => switchRole(role.value)}
            className="flex min-h-9 items-center justify-between gap-3 rounded-lg px-3 text-left text-xs font-bold transition hover:bg-violet-500/10 disabled:cursor-default disabled:bg-muted disabled:text-muted-foreground"
          >
            <span>{role.label}</span>
            {switchingRole === role.value ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : user?.role === role.value ? (
              <span className="text-[10px] uppercase">Atual</span>
            ) : null}
          </button>
        ))}
      </div>
    </details>
  );
}
