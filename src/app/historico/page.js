'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { MdHistory } from "react-icons/md";

export default function Historico() {
  const [movimentacoes, setMovimentacoes] = useState([]);
  const [filtroTipo, setFiltroTipo] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchMovimentacoes() {
      setLoading(true);

      let query = supabase
        .from('movimentacoes')
        .select(`
          id,
          tipo,
          observacao,
          criado_em,
          discos ( caixa, artista, titulo ),
          dvds ( titulo ),
          cds ( artista, titulo )
        `)
        .order('criado_em', { ascending: false })
        .limit(500);

      if (filtroTipo) {
        query = query.eq('tipo', filtroTipo);
      }

      const { data } = await query;
      setMovimentacoes(data || []);
      setLoading(false);
    }
    fetchMovimentacoes();
  }, [filtroTipo]);

  return (
    <div>
      <div className="page-header">
        <MdHistory size={28} color="var(--accent)" />
        <h1 className="page-title">Histórico de Movimentações</h1>
      </div>

      <div className="filters">
        <div className="form-group">
          <label>Filtrar por tipo</label>
          <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
            <option value="">Todos</option>
            <option value="entrada">Entrada</option>
            <option value="saida">Saída</option>
          </select>
        </div>
      </div>

      {loading ? (
        <p>Carregando...</p>
      ) : movimentacoes.length === 0 ? (
        <div className="empty-state">Nenhuma movimentação registrada ainda.</div>
      ) : (
        <>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px' }}>
            {movimentacoes.length} movimentação(ões)
          </p>
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
                  <td data-label="Data">{new Date(m.criado_em).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</td>
                  <td data-label="Tipo">
                    <span className={`badge badge-${m.tipo}`}>
                      {m.tipo === 'entrada' ? '↓ Entrada' : '↑ Saída'}
                    </span>
                  </td>
                  <td data-label="Caixa">{m.discos?.caixa || '—'}</td>
                  <td data-label="Artista">{m.discos?.artista || m.cds?.artista || '—'}</td>
                  <td data-label="Título">{m.discos?.titulo || m.dvds?.titulo || m.cds?.titulo || '—'}</td>
                  <td data-label="Observação">{m.observacao || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </>
      )}
    </div>
  );
}
