'use client';

import { useState, useEffect } from 'react';
import { MdHistory } from "react-icons/md";
import { movimentacaoService } from '@/services/movimentacaoService';
import { STORE_OPTIONS } from '@/constants/config';
import { formatCaixa } from '@/utils/stringUtils';
import { useStore } from '@/contexts/StoreContext';

const ITENS_POR_PAGINA = 50;

export default function Movimentacoes() {
  const [movimentacoes, setMovimentacoes] = useState([]);
  const [filtroTipoMov, setFiltroTipoMov] = useState('');
  const [filtroPeriodo, setFiltroPeriodo] = useState('semana');
  const [filtroLoja, setFiltroLoja] = useState('');
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
  }, [filtroTipoMov, filtroPeriodo, filtroLoja]);

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
      caixa: item?.caixa || '—',
      artista: m.discos?.artista || m.cds?.artista || '—',
      titulo: m.discos?.titulo || m.dvds?.titulo || m.cds?.titulo || m.vhs?.titulo || '—',
      loja: item?.loja || '—',
    };
  };

  const totalItens = movimentacoes.length;
  const totalPaginas = Math.max(1, Math.ceil(totalItens / ITENS_POR_PAGINA));
  const itensPaginados = movimentacoes.slice((pagina - 1) * ITENS_POR_PAGINA, pagina * ITENS_POR_PAGINA);

  return (
    <div className="pageContainer">
      <div className="topHeader">
        <div className="titleGroup">
          <MdHistory size={28} color="var(--accent)" />
          <h1 className="page-title">Histórico de Movimentações</h1>
        </div>
      </div>

      <div className="mainCard">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
          <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '600' }}>Últimas Atividades</h2>
          {!loadingHist && totalItens > 0 && (
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              Mostrando {(pagina - 1) * ITENS_POR_PAGINA + 1}–{Math.min(pagina * ITENS_POR_PAGINA, totalItens)} de {totalItens} movimentações
            </span>
          )}
        </div>

        <div className="filterCard">
          <div className="filters">
            <div className="form-group">
              <select value={filtroPeriodo} onChange={(e) => setFiltroPeriodo(e.target.value)}>
                <option value="semana">Esta Semana (Últimos 7 dias)</option>
                <option value="hoje">Hoje</option>
                <option value="mes">Últimos 30 dias</option>
                <option value="todos">Todas as Movimentações</option>
              </select>
            </div>
            <div className="form-group">
              <select value={filtroTipoMov} onChange={(e) => setFiltroTipoMov(e.target.value)}>
                <option value="">Todos Tipos</option>
                <option value="entrada">Entradas</option>
                <option value="saida">Saídas</option>
                <option value="exclusao">Exclusões</option>
              </select>
            </div>
            {!activeStore && (
              <div className="form-group">
                <select value={filtroLoja} onChange={(e) => setFiltroLoja(e.target.value)}>
                  <option value="">Todas Lojas</option>
                  {STORE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              </div>
            )}
          </div>
        </div>

        {loadingHist ? (
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', padding: '20px 0' }}>Carregando histórico...</p>
        ) : movimentacoes.length === 0 ? (
          <div className="empty-state" style={{ padding: '40px 20px' }}>Nenhuma movimentação encontrada para o período selecionado.</div>
        ) : (
          <>
            <div className="table-responsive">
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
                    return (
                      <tr key={m.id}>
                        <td data-label="Data" style={{ fontSize: '13px', whiteSpace: 'nowrap' }}>
                          {new Date(m.criado_em.endsWith('Z') ? m.criado_em : m.criado_em + 'Z').toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
                        </td>
                        <td data-label="Tipo">
                          <span className={`badge badge-${m.tipo}`}>
                            {m.tipo === 'entrada' ? '↓ Entrada' : m.tipo === 'exclusao' ? '✖ Exclusão' : '↑ Saída'}
                          </span>
                        </td>
                        <td data-label="Local">{formatCaixa(item.caixa, item.loja)}</td>
                        {!activeStore && <td data-label="Loja"><span style={{ fontWeight: 600, color: 'var(--accent)' }}>{item.loja}</span></td>}
                        <td data-label="Artista">{item.artista}</td>
                        <td data-label="Título">{item.titulo}</td>
                        <td data-label="Observação" style={{ fontSize: '13px' }}>{m.observacao || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {totalPaginas > 1 && (
              <div className="paginationRow" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '24px 0', gap: '8px', borderTop: '1px solid var(--border)', marginTop: '16px', flexWrap: 'wrap' }}>
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
