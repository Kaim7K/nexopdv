import React from 'react';

const UserNotRegisteredError = () => (
  <div className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground">
    <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-card-foreground shadow-xl">
      <div className="text-center">
        <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-full bg-orange-500/15">
          <svg className="h-8 w-8 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h1 className="mb-4 text-2xl font-bold">Acesso não liberado</h1>
        <p className="text-sm text-muted-foreground">
          Este usuário ainda não possui acesso ao Nexo PDV. Entre em contato com o administrador do mercado.
        </p>
      </div>
    </div>
  </div>
);

export default UserNotRegisteredError;
