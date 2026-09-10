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
    <div className="pageContainer mov-page">
      {/* Header Direto e Minimalista */}
      <div className="mov-header-clean">
        <h1>
          <MdHistory size={22} color="var(--accent)" />
          Histórico de Movimentações
        </h1>
        {!loadingHist && movimentacoes.length > 0 && (
          <div className="mov-header-counter">
            <span><strong style={{ color: '#34d399', fontWeight: 600 }}>{totalEntradas}</strong> entradas</span>
            <span style={{ opacity: 0.35 }}>•</span>
            <span><strong style={{ color: '#f87171', fontWeight: 600 }}>{totalSaidas}</strong> saídas</span>
          </div>
        )}
      </div>

      <div className="mov-panel-clean">
        {/* Barra de Filtros Compacta */}
        <div className="mov-filter-bar">
          {/* Busca */}
          <div className="mov-search-clean">
            <FiSearch color="var(--text-muted)" size={15} style={{ flexShrink: 0 }} />
            <input 
              type="text" 
              placeholder="Buscar por artista, título ou caixa..." 
              value={busca} 
              onChange={(e) => setBusca(e.target.value)}
            />
            {busca && (
              <button 
                type="button" 
                onClick={() => setBusca('')}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '16px' }}
              >
                ×
              </button>
            )}
          </div>

          {/* Controles: Abas de Tipo + Período e Loja */}
          <div className="mov-controls-row">
            <div className="mov-tabs-clean">
              {[
                { value: '', label: 'Todas' },
                { value: 'entrada', label: 'Entradas' },
                { value: 'saida', label: 'Saídas' },
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setFiltroTipoMov(opt.value)}
                  className={`mov-tab-btn ${filtroTipoMov === opt.value ? 'active' : ''}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="mov-selects-group">
              <select 
                value={filtroPeriodo} 
                onChange={(e) => setFiltroPeriodo(e.target.value)}
                className="mov-select-clean"
              >
                <option value="hoje">Hoje</option>
                <option value="semana">Últimos 7 dias</option>
                <option value="mes">Últimos 30 dias</option>
                <option value="todos">Todo o histórico</option>
              </select>

              {!activeStore && (
                <select 
                  value={filtroLoja} 
                  onChange={(e) => setFiltroLoja(e.target.value)}
                  className="mov-select-clean"
                >
                  <option value="">Todas as Lojas</option>
                  {STORE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              )}
            </div>
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
              padding: '40px 16px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            <MdHistory size={32} color="var(--text-muted)" style={{ opacity: 0.3 }} />
            <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#e4e4e7' }}>
              Nenhuma movimentação encontrada
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              {busca || filtroTipoMov || filtroPeriodo !== 'semana'
                ? 'Tente ajustar os filtros ou a busca.'
                : 'Não há registros para o período selecionado.'}
            </div>
          </div>
        ) : (
          <>
            {/* 1. FEED MINIMALISTA PARA MOBILE (<= 768px) */}
            <div className="mov-feed-list">
              {itensPaginados.map((m) => {
                const item = getItemData(m);
                const isEntrada = m.tipo === 'entrada';
                const isSaida = m.tipo === 'saida';
                const statusColorClass = isEntrada ? 'mov-status-entrada' : isSaida ? 'mov-status-saida' : 'mov-status-exclusao';
                const statusLabel = isEntrada ? '+ Entrada' : isSaida ? '− Saída' : '✖ Exclusão';

                // Detalhes em texto simples: Artista • Caixa • Data
                const details = [
                  item.artista && item.artista !== '—' ? item.artista : null,
                  item.caixa && item.caixa !== '—' ? formatCaixa(item.caixa, item.loja) : null,
                  !activeStore && item.loja && item.loja !== '—' ? item.loja : null,
                  formatarDataHora(m.criado_em),
                ].filter(Boolean).join(' • ');

                return (
                  <div key={m.id} className="mov-row-item">
                    <div className="mov-item-content">
                      <span className="mov-item-title" title={item.titulo}>
                        {item.titulo}
                      </span>
                      <span className="mov-item-subtitle" title={details}>
                        {details}
                      </span>
                    </div>

                    <span className={`mov-item-status ${statusColorClass}`}>
                      {statusLabel}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* 2. TABELA DIRETA PARA DESKTOP (> 768px) */}
            <div className="mov-table-desktop">
              <table>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th style={{ width: '130px' }}>Tipo</th>
                    <th style={{ width: '160px' }}>Local</th>
                    <th style={{ width: '160px' }}>Data</th>
                  </tr>
                </thead>
                <tbody>
                  {itensPaginados.map((m) => {
                    const item = getItemData(m);
                    const isEntrada = m.tipo === 'entrada';
                    const isSaida = m.tipo === 'saida';
                    const statusColorClass = isEntrada ? 'mov-status-entrada' : isSaida ? 'mov-status-saida' : 'mov-status-exclusao';
                    const statusLabel = isEntrada ? '↓ Entrada' : isSaida ? '↑ Saída' : '✖ Exclusão';

                    return (
                      <tr key={m.id}>
                        <td>
                          <div style={{ fontWeight: 600, color: '#ffffff', lineHeight: 1.3 }}>{item.titulo}</div>
                          {item.artista && item.artista !== '—' && (
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{item.artista}</div>
                          )}
                        </td>
                        <td>
                          <span className={statusColorClass} style={{ fontWeight: 600, fontSize: '12.5px' }}>
                            {statusLabel}
                          </span>
                        </td>
                        <td style={{ color: 'var(--text-muted)', fontSize: '12.5px' }}>
                          {formatCaixa(item.caixa, item.loja)}
                          {!activeStore && item.loja && (
                            <span style={{ marginLeft: '6px', color: 'var(--accent)', fontWeight: 600 }}>({item.loja})</span>
                          )}
                        </td>
                        <td style={{ color: 'var(--text-muted)', fontSize: '12px', whiteSpace: 'nowrap' }}>
                          {formatarDataHora(m.criado_em)}
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
