'use client';

import React from 'react';
import { FiSearch } from 'react-icons/fi';
import { STORE_OPTIONS } from '@/constants/config';

const OPCOES_TIPO = [
  { value: '', label: 'Todas' },
  { value: 'entrada', label: 'Entradas' },
  { value: 'saida', label: 'Saídas' },
];

const OPCOES_PERIODO = [
  { value: 'hoje', label: 'Hoje' },
  { value: 'semana', label: 'Últimos 7 dias' },
  { value: 'mes', label: 'Últimos 30 dias' },
  { value: 'todos', label: 'Todo o histórico' },
];

/**
 * Componente de filtros para a página de movimentações (busca por texto, tipo, período e loja)
 */
export default function MovimentacoesFilters({
  busca,
  onBuscaChange,
  filtroTipoMov,
  onFiltroTipoMovChange,
  filtroPeriodo,
  onFiltroPeriodoChange,
  filtroLoja,
  onFiltroLojaChange,
  activeStore,
}) {
  return (
    <div className="mov-filter-bar">
      {/* Campo de Busca Textual */}
      <div className="mov-search-clean">
        <FiSearch color="var(--text-muted)" size={15} style={{ flexShrink: 0 }} />
        <input
          type="text"
          placeholder="Buscar por artista, título ou caixa..."
          value={busca}
          onChange={(e) => onBuscaChange(e.target.value)}
        />
        {busca && (
          <button
            type="button"
            onClick={() => onBuscaChange('')}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: '16px',
            }}
            title="Limpar busca"
          >
            ×
          </button>
        )}
      </div>

      {/* Controles: Abas de Tipo + Período e Loja */}
      <div className="mov-controls-row">
        <div className="mov-tabs-clean">
          {OPCOES_TIPO.map((opcao) => (
            <button
              key={opcao.value}
              type="button"
              onClick={() => onFiltroTipoMovChange(opcao.value)}
              className={`mov-tab-btn ${filtroTipoMov === opcao.value ? 'active' : ''}`}
            >
              {opcao.label}
            </button>
          ))}
        </div>

        <div className="mov-selects-group">
          <select
            value={filtroPeriodo}
            onChange={(e) => onFiltroPeriodoChange(e.target.value)}
            className="mov-select-clean"
            aria-label="Filtro de período"
          >
            {OPCOES_PERIODO.map((opcao) => (
              <option key={opcao.value} value={opcao.value}>
                {opcao.label}
              </option>
            ))}
          </select>

          {!activeStore && (
            <select
              value={filtroLoja}
              onChange={(e) => onFiltroLojaChange(e.target.value)}
              className="mov-select-clean"
              aria-label="Filtro de loja"
            >
              <option value="">Todas as Lojas</option>
              {STORE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>
    </div>
  );
}
