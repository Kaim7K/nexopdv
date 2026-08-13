import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { nexoApi } from '@/api/nexoApi';

const CashRegisterContext = createContext(null);

const emptyCashState = (user) => ({
  required: user?.role === 'vendedor' && Boolean(user?.require_cash_register),
  market_requires_cash: Boolean(user?.require_cash_register),
  session: null,
  summary: null,
});

export function CashRegisterProvider({ user, children }) {
  const [cashState, setCashState] = useState(() => emptyCashState(user));
  const [cashLoading, setCashLoading] = useState(Boolean(user?.market_id));

  const clearCashContext = useCallback(() => {
    nexoApi.cache?.clear?.('/cash');
    setCashState(emptyCashState(user));
  }, [user]);

  const refreshCash = useCallback(async () => {
    if (!user?.market_id) {
      setCashState(emptyCashState(user));
      setCashLoading(false);
      return emptyCashState(user);
    }
    setCashLoading(true);
    try {
      const current = await nexoApi.cash.current();
      setCashState(current);
      return current;
    } finally {
      setCashLoading(false);
    }
  }, [user]);

  useEffect(() => {
    setCashState(emptyCashState(user));
    setCashLoading(Boolean(user?.market_id));
    refreshCash().catch(() => {
      setCashLoading(false);
    });
  }, [refreshCash, user]);

  const openCash = useCallback(
    async (openingAmount) => {
      const result = await nexoApi.cash.open(openingAmount);
      nexoApi.cache?.clear?.('/cash');
      setCashState((previous) => ({
        ...previous,
        session: result.session,
        summary: result.summary,
      }));
      return result;
    },
    [],
  );

  const closeCash = useCallback(async (closingAmount, closingExpense, closingEntry) => {
    const result = await nexoApi.cash.close(
      closingAmount,
      closingExpense,
      closingEntry,
    );
    nexoApi.cache?.clear?.('/cash');
    setCashState((previous) => ({
      ...previous,
      session: null,
      summary: null,
    }));
    return result;
  }, []);

  const status = cashState.session ? 'aberto' : 'fechado';
  const canUseOperationalCash = !cashState.required || Boolean(cashState.session);

  const value = useMemo(
    () => ({
      cashState,
      cashLoading,
      status,
      canUseOperationalCash,
      refreshCash,
      openCash,
      closeCash,
      clearCashContext,
    }),
    [
      cashState,
      cashLoading,
      status,
      canUseOperationalCash,
      refreshCash,
      openCash,
      closeCash,
      clearCashContext,
    ],
  );

  return (
    <CashRegisterContext.Provider value={value}>
      {children}
    </CashRegisterContext.Provider>
  );
}

export const useCashRegister = () => useContext(CashRegisterContext);
