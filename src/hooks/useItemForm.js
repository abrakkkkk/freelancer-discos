import { useState, useRef } from 'react';
import { itemService } from '@/services/itemService';

export function useItemForm(initialState, category) {
  const [form, setForm] = useState(initialState);
  const [sugestoesArtista, setSugestoesArtista] = useState([]);
  const [mostrarSugestoesArtista, setMostrarSugestoesArtista] = useState(false);
  const [sugestoesTitulo, setSugestoesTitulo] = useState([]);
  const [mostrarSugestoesTitulo, setMostrarSugestoesTitulo] = useState(false);
  
  const timerBuscaRef = useRef(null);

  const formatPreco = (value) => {
    let val = value.replace(/\D/g, '');
    if (!val) return '';
    val = parseInt(val, 10).toString();
    return val.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    if (name === 'preco') {
      setForm({ ...form, preco: formatPreco(value) });
      return;
    }
    
    setForm({ ...form, [name]: value });

    if (name === 'artista' || name === 'titulo') {
      if (timerBuscaRef.current) clearTimeout(timerBuscaRef.current);
      timerBuscaRef.current = setTimeout(() => fetchSuggestions(name, value), 300);
    }
  };

  const fetchSuggestions = async (campo, valor) => {
    try {
      const suggestions = await itemService.searchSuggestions(category, campo, valor);
      
      if (campo === 'artista') {
        setSugestoesArtista(suggestions);
        setMostrarSugestoesArtista(suggestions.length > 0);
      } else if (campo === 'titulo') {
        setSugestoesTitulo(suggestions);
        setMostrarSugestoesTitulo(suggestions.length > 0);
      }
    } catch (err) {
      console.error(`Erro ao buscar sugestões para ${campo}:`, err);
    }
  };

  const selectSuggestion = (sug, type) => {
    if (type === 'artista') {
      setForm(prev => ({ ...prev, artista: sug }));
      setMostrarSugestoesArtista(false);
    } else if (type === 'titulo') {
      let precoFormatado = '';
      if (sug.preco) {
        precoFormatado = Math.round(sug.preco).toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
      }
      setForm(prev => ({ 
        ...prev, 
        titulo: sug.titulo,
        artista: sug.artista || prev.artista,
        preco: precoFormatado || prev.preco,
        loja: sug.loja || prev.loja
      }));
      setMostrarSugestoesTitulo(false);
    }
  };

  const getUnmaskedPreco = () => {
    return form.preco ? parseFloat(form.preco.replace(/\./g, '').replace(',', '.')) : 0;
  };

  return {
    form,
    setForm,
    handleChange,
    sugestoesArtista,
    mostrarSugestoesArtista,
    setMostrarSugestoesArtista,
    sugestoesTitulo,
    mostrarSugestoesTitulo,
    setMostrarSugestoesTitulo,
    selectSuggestion,
    getUnmaskedPreco
  };
}
