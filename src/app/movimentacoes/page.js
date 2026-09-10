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
    <div className="pageContainer">
      {/* Topo Limpo e Métricas */}
      <div className="topHeader" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
        <div className="titleGroup">
          <MdHistory size={26} color="var(--accent)" />
          <h1 className="page-title" style={{ fontSize: '20px', fontWeight: 700, margin: 0 }}>Histórico de Movimentações</h1>
        </div>

        {!loadingHist && movimentacoes.length > 0 && (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', background: 'rgba(16, 185, 129, 0.12)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.28)', padding: '3px 10px', borderRadius: '12px', fontWeight: 600 }}>
              ↓ {totalEntradas} entradas
            </span>
            <span style={{ fontSize: '12px', background: 'rgba(239, 68, 68, 0.12)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.28)', padding: '3px 10px', borderRadius: '12px', fontWeight: 600 }}>
              ↑ {totalSaidas} saídas
            </span>
            {totalExclusoes > 0 && (
              <span style={{ fontSize: '12px', background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-muted)', border: '1px solid var(--border)', padding: '3px 10px', borderRadius: '12px', fontWeight: 600 }}>
                ✖ {totalExclusoes} exclusões
              </span>
            )}
          </div>
        )}
      </div>

      <div className="mainCard" style={{ padding: '16px' }}>
        {/* Barra de Filtros Rápidos (Sem Poluição) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
          {/* Campo de Busca com ícone e limpar rápido */}
          <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0 12px', minHeight: '40px' }}>
            <FiSearch color="var(--text-muted)" size={16} style={{ flexShrink: 0, marginRight: '10px' }} />
            <input 
              type="text" 
              placeholder="Buscar por artista, título, observação ou caixa..." 
              value={busca} 
              onChange={(e) => setBusca(e.target.value)}
              style={{ border: 'none', background: 'transparent', width: '100%', outline: 'none', color: 'var(--text)', fontSize: '13.5px', padding: 0 }}
            />
            {busca && (
              <button 
                type="button" 
                onClick={() => setBusca('')}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '16px', padding: '0 4px', lineHeight: 1 }}
                title="Limpar busca"
              >
                ×
              </button>
            )}
          </div>

          {/* Segmented Pills de Tipo, Período e Loja */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              {/* Filtro por Tipo */}
              <div style={{ display: 'inline-flex', background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '8px', padding: '3px', gap: '2px' }}>
                {[
                  { value: '', label: 'Todas' },
                  { value: 'entrada', label: '↓ Entradas' },
                  { value: 'saida', label: '↑ Saídas' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setFiltroTipoMov(opt.value)}
                    style={{
                      padding: '4px 10px',
                      fontSize: '12px',
                      fontWeight: filtroTipoMov === opt.value ? 700 : 500,
                      borderRadius: '6px',
                      border: filtroTipoMov === opt.value ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid transparent',
                      background: filtroTipoMov === opt.value ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                      color: filtroTipoMov === opt.value ? '#ffffff' : 'var(--text-muted)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      touchAction: 'manipulation'
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Filtro por Período */}
              <div style={{ display: 'inline-flex', background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '8px', padding: '3px', gap: '2px' }}>
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
                    style={{
                      padding: '4px 10px',
                      fontSize: '12px',
                      fontWeight: filtroPeriodo === opt.value ? 700 : 500,
                      borderRadius: '6px',
                      border: filtroPeriodo === opt.value ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid transparent',
                      background: filtroPeriodo === opt.value ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                      color: filtroPeriodo === opt.value ? '#ffffff' : 'var(--text-muted)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      touchAction: 'manipulation'
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Seletor de Loja (caso não tenha loja ativa global) */}
            {!activeStore && (
              <select 
                value={filtroLoja} 
                onChange={(e) => setFiltroLoja(e.target.value)}
                style={{
                  padding: '5px 10px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  background: 'rgba(255, 255, 255, 0.04)',
                  color: 'var(--text)',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  outline: 'none'
                }}
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
                return (
                  <div
                    key={m.id}
                    style={{
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid rgba(255, 255, 255, 0.07)',
                      borderRadius: '10px',
                      padding: '12px 14px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                    }}
                  >
                    {/* Topo do card: Tipo de Movimentação + Data */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                      <span
                        style={{
                          fontSize: '11px',
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
                        }}
                      >
                        {isEntrada ? '↓ Entrada' : isSaida ? '↑ Saída' : '✖ Exclusão'}
                      </span>

                      <span style={{ fontSize: '11px', color: '#a1a1aa', fontWeight: 500 }}>
                        {formatarDataHora(m.criado_em)}
                      </span>
                    </div>

                    {/* Informações da obra: Título e Artista */}
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff', lineHeight: 1.3 }}>
                        {item.titulo}
                      </div>
                      {item.artista && item.artista !== '—' && (
                        <div style={{ fontSize: '12px', color: '#a1a1aa', marginTop: '1px' }}>
                          {item.artista}
                        </div>
                      )}
                    </div>

                    {/* Meta: Caixa e Loja */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '2px' }}>
                      {item.caixa && item.caixa !== '—' && (
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            color: '#d4d4d8',
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            padding: '2px 7px',
                            borderRadius: '5px',
                          }}
                        >
                          {formatCaixa(item.caixa, item.loja)}
                        </span>
                      )}

                      {!activeStore && item.loja && item.loja !== '—' && (
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            color: 'var(--accent)',
                            background: 'rgba(197, 48, 48, 0.1)',
                            border: '1px solid rgba(197, 48, 48, 0.25)',
                            padding: '2px 7px',
                            borderRadius: '5px',
                          }}
                        >
                          {item.loja}
                        </span>
                      )}
                    </div>

                    {/* Observação (apenas se existir de fato) */}
                    {m.observacao && m.observacao !== '—' && (
                      <div
                        style={{
                          fontSize: '11.5px',
                          color: '#a1a1aa',
                          background: 'rgba(0, 0, 0, 0.25)',
                          border: '1px solid rgba(255, 255, 255, 0.05)',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          marginTop: '2px',
                          lineHeight: 1.35,
                        }}
                      >
                        <span style={{ color: '#71717a', marginRight: '4px', fontWeight: 600 }}>Obs:</span>
                        {m.observacao}
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
                          {m.observacao || '—'}
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
