import { useState, useEffect } from 'react';
import { caixaService } from '@/services/caixaService';
import { useStore } from '@/contexts/StoreContext';

export function useCaixas() {
  const [caixas, setCaixas] = useState([]);
  const [loading, setLoading] = useState(true);
  const { activeStore } = useStore();

  useEffect(() => {
    async function fetchCaixas() {
      try {
        const data = await caixaService.getCaixas(activeStore);
        setCaixas(data);
      } catch (err) {
        console.error('Erro ao buscar localizações:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchCaixas();
  }, [activeStore]);

  return { caixas, loading };
}
