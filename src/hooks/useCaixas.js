import { useState, useEffect } from 'react';
import { caixaService } from '@/services/caixaService';
import { useStore } from '@/contexts/StoreContext';

export function useCaixas(overrideLoja = null) {
  const { activeStore } = useStore();
  const effectiveLoja = overrideLoja !== null ? overrideLoja : activeStore;
  
  const [currentLoja, setCurrentLoja] = useState(effectiveLoja);
  const [caixas, setCaixas] = useState(() => caixaService.getDefaultCaixas(effectiveLoja));
  const [loading, setLoading] = useState(true);

  if (currentLoja !== effectiveLoja) {
    setCurrentLoja(effectiveLoja);
    setCaixas(caixaService.getDefaultCaixas(effectiveLoja));
  }

  useEffect(() => {
    let isMounted = true;
    async function fetchCaixas() {
      try {
        const data = await caixaService.getCaixas(effectiveLoja);
        if (isMounted && data && data.length > 0) {
          setCaixas(data);
        }
      } catch (err) {
        console.error('Erro ao buscar localizações:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    fetchCaixas();
    return () => { isMounted = false; };
  }, [effectiveLoja]);

  return { caixas, loading };
}
