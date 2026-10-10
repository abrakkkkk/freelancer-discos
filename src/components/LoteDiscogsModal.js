'use client';

import { useState, useEffect } from 'react';
import { PiVinylRecord } from 'react-icons/pi';
import { fetchDiscogs } from '@/utils/discogsClient';

/**
 * Modal de busca e seleção manual de edições no Discogs para um item do lote
 */
export default function LoteDiscogsModal({ item, onClose, onApplyResult }) {
  const [queryPesquisa, setQueryPesquisa] = useState('');
  const [resultados, setResultados] = useState([]);
  const [buscando, setBuscando] = useState(false);

  useEffect(() => {
    if (item) {
      const termoInicial = [item.artista, item.titulo].filter(Boolean).join(' ');
      setQueryPesquisa(termoInicial);
      setResultados([]);
    }
  }, [item]);

  if (!item) return null;

  const handleBuscar = async (e) => {
    if (e) e.preventDefault();
    if (!queryPesquisa.trim()) return;

    setBuscando(true);
    try {
      const data = await fetchDiscogs({ q: queryPesquisa });
      setResultados(data?.results || []);
    } catch (err) {
      console.error('Erro ao pesquisar no Discogs:', err);
    } finally {
      setBuscando(false);
    }
  };

  return (
    <div className="lote-fotos-modal-overlay">
      <div className="lote-fotos-modal-content">
        <div className="lote-fotos-modal-header">
          <h3 className="lote-fotos-modal-title">Buscar no Discogs</h3>
          <button
            type="button"
            onClick={onClose}
            className="lote-fotos-modal-close"
            aria-label="Fechar modal"
          >
            ✕
          </button>
        </div>

        <div className="lote-fotos-modal-search-wrap">
          <form onSubmit={handleBuscar} className="lote-fotos-modal-search-form">
            <input
              type="text"
              value={queryPesquisa}
              onChange={(e) => setQueryPesquisa(e.target.value)}
              placeholder="Artista ou álbum..."
              className="lote-fotos-modal-input"
              autoFocus
            />
            <button
              type="submit"
              className="btn btn-primary lote-fotos-modal-submit"
              disabled={buscando}
            >
              {buscando ? '...' : 'Buscar'}
            </button>
          </form>
        </div>

        <div className="lote-fotos-modal-results">
          {resultados.length > 0 ? (
            <div className="lote-fotos-modal-results-list">
              {resultados.map((resultado) => (
                <div
                  key={resultado.id}
                  onClick={() => onApplyResult(resultado)}
                  className="lote-fotos-modal-result-item"
                >
                  {resultado.thumb ? (
                    <img src={resultado.thumb} alt="" className="lote-fotos-result-thumb" />
                  ) : (
                    <div className="lote-fotos-result-thumb-placeholder">
                      <PiVinylRecord size={18} color="var(--text-muted)" />
                    </div>
                  )}
                  <div className="lote-fotos-result-info">
                    <div className="lote-fotos-result-title">{resultado.title}</div>
                    <div className="lote-fotos-result-meta">
                      {[resultado.year, resultado.country, resultado.format?.join(', ')]
                        .filter(Boolean)
                        .join(' • ')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="lote-fotos-modal-empty">
              {buscando ? 'Buscando edições...' : 'Digite artista ou álbum para pesquisar.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
