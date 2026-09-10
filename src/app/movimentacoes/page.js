'use client';

import { useState, useEffect } from 'react';
import { MdHistory } from "react-icons/md";
import { FiSearch } from "react-icons/fi";
import { movimentacaoService } from '@/services/movimentacaoService';
import { STORE_OPTIONS } from '@/constants/config';
import { formatCaixa, removeAcentos } from '@/utils/stringUtils';
import { useStore } from '@/contexts/StoreContext';

const ITENS_POR_PAGINA = 50;

function formatarDataHora(criadoEm) {
  if (!criadoEm) return '—';
  try {
    const dataObj = new Date(criadoEm.endsWith('Z') ? criadoEm : criadoEm + 'Z');
    const agora = new Date();

    const ehHoje = dataObj.toLocaleDateString('pt-BR') === agora.toLocaleDateString('pt-BR');

    const hora = dataObj.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Sao_Paulo',
    });

    if (ehHoje) return `Hoje às ${hora}`;

    const ontem = new Date();
    ontem.setDate(ontem.getDate() - 1);
    if (dataObj.toLocaleDateString('pt-BR') === ontem.toLocaleDateString('pt-BR')) {
      return `Ontem às ${hora}`;
    }

    return `${dataObj.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })} • ${hora}`;
  } catch (_) {
    return criadoEm;
  }
}

export default function Movimentacoes() {
  const [movimentacoes, setMovimentacoes] = useState([]);
  const [filtroTipoMov, setFiltroTipoMov] = useState('');
  const [filtroPeriodo, setFiltroPeriodo] = useState('semana');
  const [filtroLoja, setFiltroLoja] = useState('');
  const [busca, setBusca] = useState('');
  const [loadingHist, setLoadingHist] = useState(true);
  const [pagina, setPagina] = useState(1);
  const { activeStore } = useStore();

  // Sync with global store
  useEffect(() => {
    setFiltroLoja(activeStore || '');
  }, [activeStore]);

  // Reset page when filters change
  useEffect(() => {
    setPagina(1);
  }, [filtroTipoMov, filtroPeriodo, filtroLoja, busca]);

  useEffect(() => {
    const fetchMovimentacoes = async () => {
      setLoadingHist(true);
      try {
        const data = await movimentacaoService.fetchMovimentacoes(filtroPeriodo, filtroTipoMov, filtroLoja);
        setMovimentacoes(data);
      } catch (err) {
        console.error("Erro ao buscar histórico:", err);
        setMovimentacoes([]);
      } finally {
        setLoadingHist(false);
      }
    };
    fetchMovimentacoes();
  }, [filtroTipoMov, filtroPeriodo, filtroLoja]);

  const getItemData = (m) => {
    const item = m.discos || m.dvds || m.cds || m.vhs;
    return {
      caixa: item?.caixa || '',
      artista: m.discos?.artista || m.cds?.artista || '',
      titulo: m.discos?.titulo || m.dvds?.titulo || m.cds?.titulo || m.vhs?.titulo || 'Item sem título',
      loja: item?.loja || '',
    };
  };

  const totalEntradas = movimentacoes.filter(m => m.tipo === 'entrada').length;
  const totalSaidas = movimentacoes.filter(m => m.tipo === 'saida').length;
  const totalExclusoes = movimentacoes.filter(m => m.tipo === 'exclusao').length;

  const movimentacoesFiltradas = movimentacoes.filter((m) => {
    if (!busca.trim()) return true;
    const term = removeAcentos(busca.trim());
    const item = getItemData(m);
    const artista = removeAcentos(item.artista || '');
    const titulo = removeAcentos(item.titulo || '');
    const obs = removeAcentos(m.observacao || '');
    const local = removeAcentos(item.caixa || '');
    return artista.includes(term) || titulo.includes(term) || obs.includes(term) || local.includes(term);
  });

  const totalItens = movimentacoesFiltradas.length;
  const totalPaginas = Math.max(1, Math.ceil(totalItens / ITENS_POR_PAGINA));
  const itensPaginados = movimentacoesFiltradas.slice((pagina - 1) * ITENS_POR_PAGINA, pagina * ITENS_POR_PAGINA);

  return (
    <div className="pageContainer mov-page-container">
      {/* Header Limpo com Métricas Discretas */}
      <div className="mov-header">
        <div className="mov-header-title-group">
          <MdHistory size={24} color="var(--accent)" />
          <h1 className="page-title" style={{ fontSize: '20px', fontWeight: 700, margin: 0 }}>
            Histórico de Movimentações
          </h1>
        </div>

        {!loadingHist && movimentacoes.length > 0 && (
          <div className="mov-header-metrics">
            <span className="mov-metric-item">
              <span className="mov-metric-dot mov-metric-dot-green" />
              <span><b style={{ color: '#34d399' }}>{totalEntradas}</b> entradas</span>
            </span>
            <span style={{ color: 'rgba(255,255,255,0.2)' }}>•</span>
            <span className="mov-metric-item">
              <span className="mov-metric-dot mov-metric-dot-red" />
              <span><b style={{ color: '#f87171' }}>{totalSaidas}</b> saídas</span>
            </span>
            {totalExclusoes > 0 && (
              <>
                <span style={{ color: 'rgba(255,255,255,0.2)' }}>•</span>
                <span className="mov-metric-item">
                  <span className="mov-metric-dot mov-metric-dot-zinc" />
                  <span><b>{totalExclusoes}</b> exclusões</span>
                </span>
              </>
            )}
          </div>
        )}
      </div>

      <div className="mov-main-panel">
        {/* Barra de Filtros Refinada e Alinhada */}
        <div className="mov-filter-toolbar">
          {/* Busca Rápida */}
          <div className="mov-search-box">
            <FiSearch color="var(--text-muted)" size={16} style={{ flexShrink: 0, marginRight: '10px' }} />
            <input 
              type="text" 
              placeholder="Buscar por artista, título, observação ou caixa..." 
              value={busca} 
              onChange={(e) => setBusca(e.target.value)}
              className="mov-search-input"
            />
            {busca && (
              <button 
                type="button" 
                onClick={() => setBusca('')}
                className="mov-search-clear"
                title="Limpar busca"
              >
                ×
              </button>
            )}
          </div>

          {/* Segmented Controls para Tipo e Período */}
          <div className="mov-segmented-row">
            {/* Filtro por Tipo */}
            <div className="mov-segmented-control">
              {[
                { value: '', label: 'Todas' },
                { value: 'entrada', label: '↓ Entradas' },
                { value: 'saida', label: '↑ Saídas' },
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setFiltroTipoMov(opt.value)}
                  className={`mov-segmented-btn ${filtroTipoMov === opt.value ? 'active' : ''}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Filtro por Período */}
            <div className="mov-segmented-control">
              {[
                { value: 'semana', label: '7 dias' },
                { value: 'hoje', label: 'Hoje' },
                { value: 'mes', label: '30 dias' },
                { value: 'todos', label: 'Todos' },
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setFiltroPeriodo(opt.value)}
                  className={`mov-segmented-btn ${filtroPeriodo === opt.value ? 'active' : ''}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Seletor de Loja (caso não haja loja ativa global) */}
            {!activeStore && (
              <select 
                value={filtroLoja} 
                onChange={(e) => setFiltroLoja(e.target.value)}
                className="mov-store-select"
              >
                <option value="">Todas as Lojas</option>
                {STORE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            )}
          </div>
        </div>

        {/* Estado de Carregamento */}
        {loadingHist ? (
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', padding: '24px 0', textAlign: 'center' }}>
            Carregando movimentações...
          </p>
        ) : totalItens === 0 ? (
          /* Estado Vazio */
          <div
            style={{
              padding: '44px 16px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            <MdHistory size={36} color="var(--text-muted)" style={{ opacity: 0.4 }} />
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#e4e4e7' }}>
              Nenhuma movimentação encontrada
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              {busca || filtroTipoMov || filtroPeriodo !== 'semana'
                ? 'Tente ajustar os filtros acima ou limpar a busca.'
                : 'Não há registros para o período selecionado.'}
            </div>
          </div>
        ) : (
          <>
            {/* 1. VISUALIZAÇÃO EM CARDS PARA MOBILE (<= 768px) */}
            <div className="movimentacoes-cards-mobile">
              {itensPaginados.map((m) => {
                const item = getItemData(m);
                const isEntrada = m.tipo === 'entrada';
                const isSaida = m.tipo === 'saida';
                const cardModifier = isEntrada ? 'mov-card-entrada' : isSaida ? 'mov-card-saida' : 'mov-card-exclusao';
                const badgeClass = isEntrada ? 'mov-badge-entrada' : isSaida ? 'mov-badge-saida' : 'mov-badge-exclusao';
                const isAutoDeleteObs = m.observacao === 'Saída (Excluído via Catálogo)';
                const hasCustomObs = m.observacao && m.observacao !== '—' && !isAutoDeleteObs;

                return (
                  <div key={m.id} className={`mov-card ${cardModifier}`}>
                    {/* Linha 1: Título e Data */}
                    <div className="mov-card-line1">
                      <span className="mov-card-titulo" title={item.titulo}>
                        {item.titulo}
                      </span>
                      <span className="mov-card-data">
                        {formatarDataHora(m.criado_em)}
                      </span>
                    </div>

                    {/* Linha 2: Artista + Tags + Badge */}
                    <div className="mov-card-line2">
                      <div className="mov-card-meta">
                        {item.artista && item.artista !== '—' && (
                          <span className="mov-card-artista" title={item.artista}>
                            {item.artista}
                          </span>
                        )}

                        {item.caixa && item.caixa !== '—' && (
                          <span className="mov-card-tag">
                            {formatCaixa(item.caixa, item.loja)}
                          </span>
                        )}

                        {!activeStore && item.loja && item.loja !== '—' && (
                          <span 
                            className="mov-card-tag"
                            style={{
                              color: 'var(--accent)',
                              background: 'rgba(197, 48, 48, 0.12)',
                              borderColor: 'rgba(197, 48, 48, 0.25)'
                            }}
                          >
                            {item.loja}
                          </span>
                        )}
                      </div>

                      <span className={`mov-card-badge ${badgeClass}`}>
                        {isEntrada ? '↓ Entrada' : isSaida ? '↑ Saída' : '✖ Exclusão'}
                      </span>
                    </div>

                    {/* Observação apenas se não for a automática de exclusão */}
                    {hasCustomObs && (
                      <div className="mov-card-obs" title={m.observacao}>
                        📝 {m.observacao}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* 2. TABELA LIMPA PARA DESKTOP (> 768px) */}
            <div className="movimentacoes-table-desktop table-responsive">
              <table>
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Tipo</th>
                    <th>Localização</th>
                    {!activeStore && <th>Loja</th>}
                    <th>Artista</th>
                    <th>Título</th>
                    <th>Observação</th>
                  </tr>
                </thead>
                <tbody>
                  {itensPaginados.map((m) => {
                    const item = getItemData(m);
                    const isEntrada = m.tipo === 'entrada';
                    const isSaida = m.tipo === 'saida';
                    const isAutoDeleteObs = m.observacao === 'Saída (Excluído via Catálogo)';
                    const displayObs = isAutoDeleteObs ? 'Excluído via catálogo' : (m.observacao || '—');

                    return (
                      <tr key={m.id}>
                        <td data-label="Data" style={{ fontSize: '12.5px', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>
                          {formatarDataHora(m.criado_em)}
                        </td>
                        <td data-label="Tipo">
                          <span
                            style={{
                              fontSize: '11.5px',
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: '6px',
                              background: isEntrada
                                ? 'rgba(16, 185, 129, 0.14)'
                                : isSaida
                                ? 'rgba(239, 68, 68, 0.14)'
                                : 'rgba(113, 113, 122, 0.14)',
                              color: isEntrada ? '#34d399' : isSaida ? '#f87171' : '#a1a1aa',
                              border: `1px solid ${isEntrada ? 'rgba(16, 185, 129, 0.3)' : isSaida ? 'rgba(239, 68, 68, 0.3)' : 'rgba(113, 113, 122, 0.3)'}`,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {isEntrada ? '↓ Entrada' : isSaida ? '↑ Saída' : '✖ Exclusão'}
                          </span>
                        </td>
                        <td data-label="Local">{formatCaixa(item.caixa, item.loja)}</td>
                        {!activeStore && (
                          <td data-label="Loja">
                            <span style={{ fontWeight: 600, color: 'var(--accent)' }}>{item.loja || '—'}</span>
                          </td>
                        )}
                        <td data-label="Artista">{item.artista || '—'}</td>
                        <td data-label="Título" style={{ fontWeight: 600, color: '#fff' }}>{item.titulo}</td>
                        <td data-label="Observação" style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                          {displayObs}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Paginação */}
            {totalPaginas > 1 && (
              <div className="paginationRow" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px 0 8px 0', gap: '8px', borderTop: '1px solid var(--border)', marginTop: '16px', flexWrap: 'wrap' }}>
                <button 
                  className="pageBtn" 
                  disabled={pagina === 1}
                  onClick={() => setPagina(p => Math.max(1, p - 1))}
                  style={{ width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                  title="Página anterior"
                >
                  &lt;
                </button>
                
                {Array.from({ length: Math.min(5, totalPaginas) }, (_, i) => {
                  let pageNum;
                  if (totalPaginas <= 5) {
                    pageNum = i + 1;
                  } else if (pagina <= 3) {
                    pageNum = i + 1;
                  } else if (pagina >= totalPaginas - 2) {
                    pageNum = totalPaginas - 4 + i;
                  } else {
                    pageNum = pagina - 2 + i;
                  }
                  return (
                    <button 
                      key={pageNum} 
                      className={`pageBtn ${pagina === pageNum ? 'active' : ''}`}
                      onClick={() => setPagina(pageNum)}
                      style={{ width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                
                {totalPaginas > 5 && pagina < totalPaginas - 2 && (
                  <>
                    <span style={{ padding: '0 4px', color: 'var(--text-muted)' }}>...</span>
                    <button 
                      className={`pageBtn ${pagina === totalPaginas ? 'active' : ''}`}
                      onClick={() => setPagina(totalPaginas)}
                      style={{ width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                    >
                      {totalPaginas}
                    </button>
                  </>
                )}

                <button 
                  className="pageBtn" 
                  disabled={pagina === totalPaginas}
                  onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))}
                  style={{ width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                  title="Próxima página"
                >
                  &gt;
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
