'use client';

import { useState, useEffect } from 'react';
import { MdHistory } from "react-icons/md";
import { movimentacaoService } from '@/services/movimentacaoService';
import { STORE_OPTIONS } from '@/constants/config';
import { formatCaixa } from '@/utils/stringUtils';
import { useStore } from '@/contexts/StoreContext';

export default function Movimentacoes() {
  const [movimentacoes, setMovimentacoes] = useState([]);
  const [filtroTipoMov, setFiltroTipoMov] = useState('');
  const [filtroPeriodo, setFiltroPeriodo] = useState('hoje');
  const [filtroLoja, setFiltroLoja] = useState('');
  const [loadingHist, setLoadingHist] = useState(true);
  const { activeStore } = useStore();

  // Sync with global store
  useEffect(() => {
    setFiltroLoja(activeStore || '');
  }, [activeStore]);

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

  return (
    <div className="pageContainer">
      <div className="topHeader">
        <div className="titleGroup">
          <MdHistory size={28} color="var(--accent)" />
          <h1 className="page-title">Histórico de Movimentações</h1>
        </div>
      </div>

      <div className="mainCard">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '600' }}>Últimas Atividades</h2>
        </div>

        <div className="filterCard">
          <div className="filters">
        <div className="form-group">
          <select value={filtroPeriodo} onChange={(e) => setFiltroPeriodo(e.target.value)}>
            <option value="hoje">Hoje</option>
            <option value="todos">Todas</option>
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
        <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Carregando histórico...</p>
      ) : movimentacoes.length === 0 ? (
        <div className="empty-state" style={{ padding: '40px 20px' }}>Nenhuma movimentação encontrada.</div>
      ) : (
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
              {movimentacoes.map((m) => {
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
      )}
      </div>
    </div>
  );
}
