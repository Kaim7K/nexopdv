import React from "react";

export default function AuthLayout({ title, subtitle, children }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5 px-4">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="flex flex-col items-center mb-8">
          <div className="mb-4 flex h-20 items-center justify-center">
            <img src="/brand/nexo-logo.svg" alt="Nexo PDV" className="h-16 w-auto max-w-[220px]" />
          </div>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
          <h1 className="text-2xl font-bold tracking-tight text-foreground mt-1">{title}</h1>
        </div>

        {/* Card */}
        <div className="bg-card rounded-2xl shadow-xl border border-border p-7">
          {children}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          © {new Date().getFullYear()} Nexo PDV
        </p>
      </div>
    </div>
  );
}
