'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { fetchDiscogs, parseDiscogsItem } from '@/utils/discogsClient';

/**
 * Hook reutilizável para integração, debounce e busca no Discogs via texto, barcode e OCR
 */
export function useDiscogsSearch() {
  const [queryDiscogs, setQueryDiscogs] = useState('');
  const [isSearchingDiscogs, setIsSearchingDiscogs] = useState(false);
  const [discogsResults, setDiscogsResults] = useState([]);
  const [showDiscogsDropdown, setShowDiscogsDropdown] = useState(false);

  const discogsAbortRef = useRef(null);

  const abortPreviousDiscogs = useCallback(() => {
    if (discogsAbortRef.current) {
      discogsAbortRef.current.abort();
    }
    discogsAbortRef.current = new AbortController();
    return discogsAbortRef.current.signal;
  }, []);

  useEffect(() => {
    return () => {
      if (discogsAbortRef.current) {
        discogsAbortRef.current.abort();
      }
    };
  }, []);

  const resetDiscogs = useCallback(() => {
    setQueryDiscogs('');
    setDiscogsResults([]);
    setShowDiscogsDropdown(false);
    setIsSearchingDiscogs(false);
  }, []);

  const searchByQuery = useCallback(async (termo, { isAuto = false, onError, onResults } = {}) => {
    const query = (typeof termo === 'string' ? termo : queryDiscogs)?.trim();
    if (!query) return;

    const signal = abortPreviousDiscogs();
    setIsSearchingDiscogs(true);
    setDiscogsResults([]);
    setShowDiscogsDropdown(false);

    try {
      const data = await fetchDiscogs({ q: query }, signal);
      const results = data?.results || [];

      if (results.length > 0) {
        setDiscogsResults(results);
        setShowDiscogsDropdown(true);
        if (onResults) onResults(results);
      } else {
        if (!isAuto && onError) {
          onError('Nenhum resultado encontrado.');
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.error('Erro ao buscar dados do Discogs:', err);
      if (!isAuto && onError) {
        onError('Erro ao buscar dados do disco.');
      }
    } finally {
      setIsSearchingDiscogs(false);
    }
  }, [queryDiscogs, abortPreviousDiscogs]);

  const searchByBarcode = useCallback(async (barcode, { onSingleResult, onResults, onError } = {}) => {
    if (!barcode) return;

    setQueryDiscogs(barcode);
    setIsSearchingDiscogs(true);
    setDiscogsResults([]);
    setShowDiscogsDropdown(false);

    const signal = abortPreviousDiscogs();
    try {
      const data = await fetchDiscogs({ barcode }, signal);
      const results = data?.results || [];

      if (results.length > 0) {
        if (results.length === 1 && onSingleResult) {
          onSingleResult(results[0]);
        } else {
          setDiscogsResults(results);
          setShowDiscogsDropdown(true);
          if (onResults) onResults(results);
        }
      } else if (onError) {
        onError(`Nenhum disco encontrado para o código de barras "${barcode}".`);
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.error('Erro ao buscar código de barras no Discogs:', err);
      if (onError) onError('Erro ao buscar código de barras.');
    } finally {
      setIsSearchingDiscogs(false);
    }
  }, [abortPreviousDiscogs]);

  const searchByCatno = useCallback(async (catno, { onSingleResult, onResults, onError } = {}) => {
    if (!catno) return;

    setQueryDiscogs(catno);
    setIsSearchingDiscogs(true);
    setDiscogsResults([]);
    setShowDiscogsDropdown(false);

    const signal = abortPreviousDiscogs();
    try {
      const data = await fetchDiscogs({ catno }, signal);
      const results = data?.results || [];

      if (results.length > 0) {
        if (results.length === 1 && onSingleResult) {
          onSingleResult(results[0]);
        } else {
          setDiscogsResults(results);
          setShowDiscogsDropdown(true);
          if (onResults) onResults(results);
        }
      } else if (onError) {
        onError(`Nenhum resultado para o código "${catno}".`);
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.error('Erro ao buscar catálogo no Discogs:', err);
      if (onError) onError('Erro ao buscar código de catálogo.');
    } finally {
      setIsSearchingDiscogs(false);
    }
  }, [abortPreviousDiscogs]);

  return {
    queryDiscogs,
    setQueryDiscogs,
    isSearchingDiscogs,
    discogsResults,
    setDiscogsResults,
    showDiscogsDropdown,
    setShowDiscogsDropdown,
    searchByQuery,
    searchByBarcode,
    searchByCatno,
    resetDiscogs,
    parseDiscogsItem,
  };
}
