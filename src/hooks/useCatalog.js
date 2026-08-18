import { useState, useEffect } from 'react';
import { itemService } from '@/services/itemService';
import { PAGINATION } from '@/constants/config';

export function useCatalog(initialCategory = 'discos') {
  const [activeTab, setActiveTab] = useState(initialCategory);
  const [itens, setItens] = useState([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [filtroCaixa, setFiltroCaixa] = useState('');
  const [filtroLoja, setFiltroLoja] = useState('');
  const [busca, setBusca] = useState('');
  const [mostrarAtivos, setMostrarAtivos] = useState(true);
  const [mostrarInativos, setMostrarInativos] = useState(false);
  const [ordenarColuna, setOrdenarColuna] = useState(null);
  const [ordenarDirecao, setOrdenarDirecao] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchCatalogItems = async () => {
    setLoading(true);
    try {
      const { data, count } = await itemService.fetchItems(activeTab, {
        pagina,
        itensPorPagina: PAGINATION.ITEMS_PER_PAGE,
        filtroCaixa,
        filtroLoja,
        busca,
        mostrarAtivos,
        mostrarInativos,
        ordenarColuna,
        ordenarDirecao
      });
      setItens(data || []);
      setTotal(count || 0);
    } catch (error) {
      console.error("Erro ao buscar itens:", error);
      setItens([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Debounce for text search
    const delay = setTimeout(() => {
      fetchCatalogItems();
    }, 300);

    return () => clearTimeout(delay);
  }, [pagina, filtroCaixa, filtroLoja, busca, mostrarAtivos, mostrarInativos, ordenarColuna, ordenarDirecao, activeTab]);

  const toggleOrdenacao = (coluna) => {
    if (ordenarColuna === coluna) {
      if (ordenarDirecao === 'asc') setOrdenarDirecao('desc');
      else {
        setOrdenarColuna(null);
        setOrdenarDirecao(null);
      }
    } else {
      setOrdenarColuna(coluna);
      setOrdenarDirecao('asc');
    }
    setPagina(1);
  };

  const changeTab = (tab) => {
    setActiveTab(tab);
    setPagina(1);
    setOrdenarColuna(null);
    setOrdenarDirecao(null);
    setFiltroCaixa('');
    setFiltroLoja('');
    setBusca('');
  };

  return {
    activeTab,
    changeTab,
    itens,
    total,
    pagina,
    setPagina,
    filtroCaixa,
    setFiltroCaixa: (val) => { setFiltroCaixa(val); setPagina(1); },
    filtroLoja,
    setFiltroLoja: (val) => { setFiltroLoja(val); setPagina(1); },
    busca,
    setBusca: (val) => { setBusca(val); setPagina(1); },
    mostrarAtivos,
    setMostrarAtivos: (val) => { setMostrarAtivos(val); setPagina(1); },
    mostrarInativos,
    setMostrarInativos: (val) => { setMostrarInativos(val); setPagina(1); },
    ordenarColuna,
    ordenarDirecao,
    toggleOrdenacao,
    loading,
    refresh: fetchCatalogItems,
    setItens,
    setTotal
  };
}
