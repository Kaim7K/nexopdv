import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

export default function NetworkStatus() {
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );

  useEffect(() => {
    const goOnline = () => {
      setOnline(true);
      toast.success('Conexão restaurada.');
    };
    const goOffline = () => {
      setOnline(false);
      toast.error('Sem conexão com a internet.');
    };
    const sessionExpired = () =>
      toast.error('Sua sessão expirou. Faça login novamente.');

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    window.addEventListener('nexo:session-expired', sessionExpired);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('nexo:session-expired', sessionExpired);
    };
  }, []);

  if (online) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-3 bottom-3 z-[100] rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-center text-sm font-bold text-amber-950 shadow-xl sm:left-auto sm:max-w-md"
    >
      Sem conexão. Suas ações voltarão a funcionar quando a internet retornar.
    </div>
  );
}
