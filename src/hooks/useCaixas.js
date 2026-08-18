import { useState, useEffect } from 'react';
import { caixaService } from '@/services/caixaService';

export function useCaixas() {
  const [caixas, setCaixas] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCaixas() {
      try {
        const data = await caixaService.getCaixas();
        setCaixas(data);
      } catch (err) {
        console.error('Erro ao buscar caixas:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchCaixas();
  }, []);

  return { caixas, loading };
}
