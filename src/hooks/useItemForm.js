'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { itemService } from '@/services/itemService';
import { normalizeCaixa } from '@/utils/stringUtils';

/**
 * Hook reutilizável para gerenciar o estado, validações e sugestões de formulários de itens
 */
export function useItemForm(estadoInicial, categoria) {
  const [form, setForm] = useState(estadoInicial);
  const [sugestoesArtista, setSugestoesArtista] = useState([]);
  const [mostrarSugestoesArtista, setMostrarSugestoesArtista] = useState(false);
  const [sugestoesTitulo, setSugestoesTitulo] = useState([]);
  const [mostrarSugestoesTitulo, setMostrarSugestoesTitulo] = useState(false);

  const timerBuscaRef = useRef(null);

  // Limpa o timer pendente ao desmontar o componente
  useEffect(() => {
    return () => {
      if (timerBuscaRef.current) {
        clearTimeout(timerBuscaRef.current);
      }
    };
  }, []);

  const formatarPreco = (valorTexto) => {
    const apenasDigitos = String(valorTexto || '').replace(/\D/g, '');
    if (!apenasDigitos) return '';
    const valorInteiro = parseInt(apenasDigitos, 10).toString();
    return valorInteiro.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
  };

  const handleChange = (evento) => {
    const { name, value } = evento.target;

    if (name === 'preco') {
      setForm((prev) => ({ ...prev, preco: formatarPreco(value) }));
      return;
    }

    setForm((prev) => ({ ...prev, [name]: value }));

    if (name === 'artista' || name === 'titulo') {
      if (timerBuscaRef.current) {
        clearTimeout(timerBuscaRef.current);
      }
      timerBuscaRef.current = setTimeout(() => {
        buscarSugestoes(name, value);
      }, 300);
    }
  };

  const buscarSugestoes = async (campo, termo) => {
    try {
      const sugestoes = await itemService.searchSuggestions(categoria, campo, termo);

      if (campo === 'artista') {
        setSugestoesArtista(sugestoes);
        setMostrarSugestoesArtista(sugestoes.length > 0);
      } else if (campo === 'titulo') {
        setSugestoesTitulo(sugestoes);
        setMostrarSugestoesTitulo(sugestoes.length > 0);
      }
    } catch (erro) {
      console.warn(`Erro ao buscar sugestões para ${campo}:`, erro);
    }
  };

  const selectSuggestion = (sugestao, tipoCampo) => {
    if (tipoCampo === 'artista') {
      setForm((prev) => ({ ...prev, artista: sugestao }));
      setMostrarSugestoesArtista(false);
    } else if (tipoCampo === 'titulo') {
      let precoFormatado = '';
      if (sugestao.preco) {
        precoFormatado = Math.round(sugestao.preco)
          .toString()
          .replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
      }

      setForm((prev) => ({
        ...prev,
        titulo: sugestao.titulo,
        artista: sugestao.artista || prev.artista,
        preco: precoFormatado || prev.preco,
        loja: prev.loja || sugestao.loja,
      }));
      setMostrarSugestoesTitulo(false);
    }
  };

  /**
   * Normaliza a caixa no evento onBlur (ex: '5b' -> 'Caixa 5B')
   */
  const handleCaixaBlur = useCallback((lojaContexto) => {
    setForm((prev) => {
      if (!prev.caixa) return prev;
      const caixaNormalizada = normalizeCaixa(prev.caixa, lojaContexto || prev.loja);
      if (caixaNormalizada !== prev.caixa) {
        return { ...prev, caixa: caixaNormalizada };
      }
      return prev;
    });
  }, []);

  const getUnmaskedPreco = () => {
    if (!form.preco) return 0;
    return parseFloat(String(form.preco).replace(/\./g, '').replace(',', '.'));
  };

  return {
    form,
    setForm,
    handleChange,
    handleCaixaBlur,
    sugestoesArtista,
    mostrarSugestoesArtista,
    setMostrarSugestoesArtista,
    sugestoesTitulo,
    mostrarSugestoesTitulo,
    setMostrarSugestoesTitulo,
    selectSuggestion,
    getUnmaskedPreco,
  };
}
