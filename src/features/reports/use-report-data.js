import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { nexoApi } from '@/api/nexoApi';
import { loadReportData } from './report-data.js';

export function useReportData() {
  const [state, setState] = useState({
    sales: [],
    fiados: [],
    products: [],
    loading: true,
    loadError: '',
  });
  const requestVersion = useRef(0);

  const loadData = useCallback(async () => {
    const version = ++requestVersion.current;
    setState(previous => ({ ...previous, loading: true, loadError: '' }));
    try {
      const data = await loadReportData(nexoApi);
      if (version !== requestVersion.current) return;
      setState({ ...data, loading: false, loadError: '' });
    } catch (error) {
      if (version !== requestVersion.current) return;
      setState(previous => ({
        ...previous,
        loading: false,
        loadError: error.message || 'Não foi possível carregar os relatórios.',
      }));
      toast.error('Erro ao carregar dados.');
    }
  }, []);

  useEffect(() => {
    loadData();
    // Ignore late completions after leaving the page, including their toasts.
    return () => { requestVersion.current++; };
  }, [loadData]);

  return { ...state, loadData };
}
