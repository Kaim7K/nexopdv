import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { nexoApi } from '@/api/nexoApi';

export function useFinancePeriodData(kind, { from, to }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    setLoading(true);
    nexoApi.finance[kind]({ from, to })
      .then(result => { if (active) setData(result); })
      .catch(error => {
        if (active && error.code !== 'REQUEST_REPLACED') toast.error(error.message);
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [kind, from, to]);
  return { data, loading };
}
