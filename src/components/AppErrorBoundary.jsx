import React from 'react';
import { AlertTriangle } from 'lucide-react';

export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, info) {
    console.error('Falha inesperada na interface:', error, info);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="grid min-h-dvh place-items-center bg-background p-5 text-center">
        <div className="surface-card max-w-md p-6 sm:p-8" role="alert">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-lg bg-destructive/10 text-destructive">
            <AlertTriangle className="h-6 w-6" aria-hidden="true" />
          </div>
          <h1 className="mt-4 text-xl font-bold">A tela encontrou um problema</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Recarregue para restaurar a sessão. Se o problema continuar, informe ao suporte qual ação estava realizando.</p>
          <button type="button" onClick={() => window.location.reload()} className="mt-5 min-h-11 rounded-lg bg-accent px-5 text-sm font-bold text-accent-foreground shadow-sm transition hover:-translate-y-px hover:bg-accent/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:translate-y-0">
            Recarregar sistema
          </button>
        </div>
      </main>
    );
  }
}
