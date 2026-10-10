'use client';

import { FiSearch } from 'react-icons/fi';
import { IoCamera, IoClose } from 'react-icons/io5';
import { STORE_OPTIONS } from '@/constants/config';

/**
 * Componente modular de filtros de busca, localização e loja do catálogo
 */
export default function CatalogFilters({
  busca,
  onBuscaChange,
  onClearBusca,
  onOpenScanner,
  filtroCaixa,
  onFiltroCaixaChange,
  caixas = [],
  filtroLoja,
  onFiltroLojaChange,
  activeStore,
  mostrarAtivos,
  onMostrarAtivosChange,
  mostrarInativos,
  onMostrarInativosChange,
  isVideo = false,
  localLabel = 'Localização',
}) {
  const placeholderBusca = isVideo
    ? 'Ex: O Poderoso Chefão, Matrix...'
    : 'Ex: Beatles, Abbey Road, Roberto Carlos...';

  return (
    <div className="filterCard">
      <div className="filtersRow">
        <div className="filterGroup" style={{ flex: '1 1 100%' }}>
          <label>Buscar por {isVideo ? 'título' : 'artista ou título'}</label>
          <div className="search-bar-row">
            <div className="searchInputWrapper">
              <FiSearch size={18} className="searchIconLeft" />
              <input
                type="text"
                className="searchInputWithLeftIcon"
                placeholder={placeholderBusca}
                value={busca}
                onChange={(e) => onBuscaChange(e.target.value)}
              />
              {busca && (
                <button
                  type="button"
                  onClick={onClearBusca}
                  className="search-clear-btn"
                  title="Limpar busca"
                  aria-label="Limpar busca"
                >
                  <IoClose size={16} />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={onOpenScanner}
              className="catalog-camera-btn"
              title="Buscar disco por foto da capa"
              aria-label="Buscar disco por foto da capa"
            >
              <IoCamera size={20} />
            </button>
          </div>
        </div>

        <div className="filterGroup">
          <label>Filtrar por {localLabel.toLowerCase()}</label>
          <select value={filtroCaixa} onChange={(e) => onFiltroCaixaChange(e.target.value)}>
            <option value="">Todas</option>
            {caixas.map((caixaOption) => (
              <option
                key={`${caixaOption.caixa}-${caixaOption.loja}`}
                value={caixaOption.caixa}
              >
                {caixaOption.label} {!activeStore && caixaOption.loja ? `(${caixaOption.loja})` : ''}
              </option>
            ))}
          </select>
        </div>

        {!activeStore && (
          <div className="filterGroup">
            <label>Filtrar por loja</label>
            <select value={filtroLoja} onChange={(e) => onFiltroLojaChange(e.target.value)}>
              <option value="">Todas</option>
              {STORE_OPTIONS.map((opcaoLoja) => (
                <option key={opcaoLoja.value} value={opcaoLoja.value}>
                  {opcaoLoja.label}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="filterGroup" style={{ flex: '0 0 auto' }}>
          <label>Exibição</label>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center', height: '100%' }}>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                color: 'var(--text)',
                fontSize: '13px',
                fontWeight: 500,
              }}
            >
              <input
                type="checkbox"
                checked={mostrarAtivos}
                onChange={(e) => onMostrarAtivosChange(e.target.checked)}
                style={{ accentColor: 'var(--accent)' }}
              />
              Ativos
            </label>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                color: 'var(--text)',
                fontSize: '13px',
                fontWeight: 500,
              }}
            >
              <input
                type="checkbox"
                checked={mostrarInativos}
                onChange={(e) => onMostrarInativosChange(e.target.checked)}
                style={{ accentColor: 'var(--accent)' }}
              />
              Inativos
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
