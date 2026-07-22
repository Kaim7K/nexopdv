import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const [request, setRequest] = useState(null);
  const resolver = useRef(null);

  const confirm = useCallback(options => new Promise(resolve => {
    resolver.current?.(false);
    resolver.current = resolve;
    setRequest({
      title: 'Confirmar ação',
      description: 'Revise as informações antes de continuar.',
      confirmLabel: 'Confirmar',
      cancelLabel: 'Voltar',
      tone: 'default',
      ...options,
    });
  }), []);

  const settle = useCallback(result => {
    resolver.current?.(result);
    resolver.current = null;
    setRequest(null);
  }, []);

  useEffect(() => () => resolver.current?.(false), []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AlertDialog open={Boolean(request)} onOpenChange={open => !open && settle(false)}>
        <AlertDialogContent>
          <AlertDialogHeader className="text-left">
            <div className={cn(
              'mb-1 grid h-11 w-11 place-items-center rounded-lg',
              request?.tone === 'destructive'
                ? 'bg-destructive/10 text-destructive'
                : 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
            )}>
              <AlertTriangle className="h-5 w-5" aria-hidden="true" />
            </div>
            <AlertDialogTitle>{request?.title}</AlertDialogTitle>
            <AlertDialogDescription className="leading-6">
              {request?.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => settle(false)}>{request?.cancelLabel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => settle(true)}
              className={cn(
                request?.tone === 'destructive' &&
                  'bg-destructive text-destructive-foreground hover:bg-destructive/90',
              )}
            >
              {request?.confirmLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error('useConfirm deve ser usado dentro de ConfirmProvider.');
  return confirm;
}
