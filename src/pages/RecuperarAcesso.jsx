import { useState } from 'react';
import { Link } from 'react-router-dom';
import AuthLayout from '@/components/AuthLayout';
import { nexoApi } from '@/api/nexoApi';
import { usePageMetadata } from '@/hooks/use-page-metadata';

export default function RecuperarAcesso() {
  usePageMetadata({ title: 'Recuperar acesso | Nexo PDV', robots: 'noindex, nofollow, noarchive' });
  const [token] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('token') || '');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  async function submit(event) {
    event.preventDefault();
    setError('');
    if (token && password !== confirmation) { setError('As senhas precisam ser iguais.'); return; }
    setBusy(true);
    try {
      const result = token ? await nexoApi.auth.resetPassword(token, password) : await nexoApi.auth.forgotPassword(email);
      setMessage(result.message);
      setDone(true);
      setPassword(''); setConfirmation('');
      if (token) window.history.replaceState(null, '', window.location.pathname);
    } catch (cause) { setError(cause.message || 'Não foi possível recuperar o acesso.'); }
    finally { setBusy(false); }
  }
  return <AuthLayout title={token ? 'Criar nova senha' : 'Recuperar acesso'} subtitle="Nexo PDV">
    <p className="mb-5 text-sm leading-6 text-muted-foreground">{token ? 'Escolha uma senha com pelo menos 10 caracteres.' : 'Informe o e-mail da sua conta para receber um link temporário.'}</p>
    {error && <p className="mb-4 text-sm text-destructive" role="alert">{error}</p>}
    {message && <p className="mb-4 text-sm" role="status">{message}</p>}
    {!done && <form onSubmit={submit} className="space-y-4">
      {token ? <><label className="block text-sm">Nova senha<input className="mt-1 h-11 w-full rounded-lg border bg-background px-3" type="password" minLength={10} maxLength={72} required autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} /></label><label className="block text-sm">Confirmar senha<input className="mt-1 h-11 w-full rounded-lg border bg-background px-3" type="password" required autoComplete="new-password" value={confirmation} onChange={event => setConfirmation(event.target.value)} /></label></> : <label className="block text-sm">E-mail<input className="mt-1 h-11 w-full rounded-lg border bg-background px-3" type="email" required autoComplete="email" maxLength={254} value={email} onChange={event => setEmail(event.target.value)} /></label>}
      <button className="h-11 w-full rounded-lg bg-accent px-4 font-bold text-accent-foreground" type="submit" disabled={busy}>{busy ? 'Aguarde...' : token ? 'Salvar nova senha' : 'Enviar link de recuperação'}</button>
    </form>}
    <Link className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-primary underline-offset-4 hover:underline" to="/login">Voltar para entrar</Link>
    {token && <a className="ml-4 text-sm text-accent underline" href="/recuperar-acesso">Solicitar outro link</a>}
    <p className="mt-3 border-t border-border pt-4 text-xs leading-5 text-muted-foreground">Não recebeu o e-mail? Confira o spam e o endereço informado. Se precisar, procure o administrador da loja.</p>
  </AuthLayout>;
}
