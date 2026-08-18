'use client';

import { useState, useEffect } from 'react';
import { MdHistory } from "react-icons/md";
import { useMobileLeaveConfirm } from '@/hooks/useMobileLeaveConfirm';
import { movimentacaoService } from '@/services/movimentacaoService';

export default function Movimentacoes() {
  useMobileLeaveConfirm();
  
  const [movimentacoes, setMovimentacoes] = useState([]);
  const [filtroTipoMov, setFiltroTipoMov] = useState('');
  const [filtroPeriodo, setFiltroPeriodo] = useState('hoje');
  const [loadingHist, setLoadingHist] = useState(true);

  useEffect(() => {
    const fetchMovimentacoes = async () => {
      setLoadingHist(true);
      try {
        const data = await movimentacaoService.fetchMovimentacoes(filtroPeriodo, filtroTipoMov);
        setMovimentacoes(data);
      } catch (err) {
        console.error("Erro ao buscar histórico:", err);
        setMovimentacoes([]);
      } finally {
        setLoadingHist(false);
      }
    };
    fetchMovimentacoes();
  }, [filtroTipoMov, filtroPeriodo]);

  return (
    <div>
      <div className="page-header">
        <MdHistory size={28} color="var(--accent)" />
        <h1 className="page-title">Histórico de Movimentações</h1>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '600' }}>Últimas Atividades</h2>
        </div>
        
        <div style={{ display: 'flex', gap: '8px' }}>
          <div className="form-group" style={{ marginBottom: 0, flex: 'none' }}>
            <select value={filtroPeriodo} onChange={(e) => setFiltroPeriodo(e.target.value)} style={{ width: '130px' }}>
              <option value="hoje">Hoje</option>
              <option value="todos">Todas</option>
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0, flex: 'none' }}>
            <select value={filtroTipoMov} onChange={(e) => setFiltroTipoMov(e.target.value)} style={{ width: '130px' }}>
              <option value="">Todos Tipos</option>
              <option value="entrada">Entradas</option>
              <option value="saida">Saídas</option>
              <option value="exclusao">Exclusões</option>
            </select>
          </div>
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
                <th>Caixa</th>
                <th>Artista</th>
                <th>Título</th>
                <th>Observação</th>
              </tr>
            </thead>
            <tbody>
              {movimentacoes.map((m) => (
                <tr key={m.id}>
                  <td data-label="Data" style={{ fontSize: '13px', whiteSpace: 'nowrap' }}>
                    {new Date(m.criado_em.endsWith('Z') ? m.criado_em : m.criado_em + 'Z').toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
                  </td>
                  <td data-label="Tipo">
                    <span className={`badge badge-${m.tipo}`}>
                      {m.tipo === 'entrada' ? '↓ Entrada' : m.tipo === 'exclusao' ? '✖ Exclusão' : '↑ Saída'}
                    </span>
                  </td>
                  <td data-label="Caixa">{m.discos?.caixa || '—'}</td>
                  <td data-label="Artista">{m.discos?.artista || m.cds?.artista || '—'}</td>
                  <td data-label="Título">{m.discos?.titulo || m.dvds?.titulo || m.cds?.titulo || m.vhs?.titulo || '—'}</td>
                  <td data-label="Observação" style={{ fontSize: '13px' }}>{m.observacao || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
