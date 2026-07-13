import React, { useState } from "react";
import { nexoApi } from "@/api/nexoApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Lock, Loader2 } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import { usePageMetadata } from "@/hooks/use-page-metadata";

export default function Login() {
  usePageMetadata({ title: 'Entrar | Nexo PDV', description: 'Acesso restrito ao Nexo PDV.', robots: 'noindex, nofollow, noarchive' });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { user } = await nexoApi.auth.login(email.trim().toLowerCase(), password);
      window.location.href = user.role === 'super_admin' ? '/admin/mercados' : '/pdv';
    } catch (err) {
      setError(err.message || "Email ou senha inválidos");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Acesse sua conta" subtitle="Nexo PDV">
      {error && (
        <div id="login-error" role="alert" aria-live="assertive" className="mb-4 rounded-xl border border-destructive/25 bg-destructive/10 p-3 text-sm font-medium text-destructive">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="email"
              type="email"
              autoComplete="email"
              autoFocus
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-10 h-11"
              required
              aria-invalid={Boolean(error)}
              aria-describedby={error ? 'login-error' : undefined}
            />
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Senha</Label>
            <span className="text-xs text-muted-foreground">Contate o administrador para redefinir</span>
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-10 h-11"
              required
              aria-invalid={Boolean(error)}
              aria-describedby={error ? 'login-error' : undefined}
            />
          </div>
        </div>
        <Button type="submit" className="w-full font-bold" disabled={loading} aria-busy={loading}>
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Entrando...
            </>
          ) : (
            "Entrar"
          )}
        </Button>
      </form>
    </AuthLayout>
  );
}
