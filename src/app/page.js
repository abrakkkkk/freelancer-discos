'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { FaEdit } from "react-icons/fa";
import { PiVinylRecord } from "react-icons/pi";

const ITENS_POR_PAGINA = 50;

export default function Catalogo() {
  const [discos, setDiscos] = useState([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [filtroCaixa, setFiltroCaixa] = useState('');
  const [busca, setBusca] = useState('');
  const [mostrarInativos, setMostrarInativos] = useState(false);
  const [caixas, setCaixas] = useState([]);
  const [loading, setLoading] = useState(true);

  // Buscar lista de caixas disponíveis
  useEffect(() => {
    async function fetchCaixas() {
      const { data } = await supabase
        .from('caixas_distintas')
        .select('caixa');

      if (data) {
        const unicas = [...new Set(data.map(d => d.caixa))];
        setCaixas(unicas);
      }
    }
    fetchCaixas();
  }, []);

  // Buscar discos com filtros e paginação
  useEffect(() => {
    async function fetchDiscos() {
      setLoading(true);

      let query = supabase
        .from('discos')
        .select('id, caixa, artista, titulo, preco, quantidade, ativo', { count: 'exact' });

      if (mostrarInativos) {
        query = query.eq('ativo', false);
      } else {
        query = query.eq('ativo', true);
      }
      if (filtroCaixa) {
        query = query.eq('caixa', parseInt(filtroCaixa));
      }
      if (busca) {
        query = query.or(`artista.ilike.%${busca}%,titulo.ilike.%${busca}%`);
      }

      query = query
        .order('caixa')
        .order('artista')
        .order('titulo')
        .range((pagina - 1) * ITENS_POR_PAGINA, pagina * ITENS_POR_PAGINA - 1);

      const { data, count } = await query;

      setDiscos(data || []);
      setTotal(count || 0);
      setLoading(false);
    }
    fetchDiscos();
  }, [pagina, filtroCaixa, busca, mostrarInativos]);

  // Resetar página ao mudar filtros
  useEffect(() => {
    setPagina(1);
  }, [filtroCaixa, busca, mostrarInativos]);

  const totalPaginas = Math.max(1, Math.ceil(total / ITENS_POR_PAGINA));

  return (
    <div>
      <div className="page-header">
        <PiVinylRecord size={28} color="var(--accent)" />
        <h1 className="page-title">Catálogo Completo</h1>
      </div>

      <div className="filters">
        <div className="form-group" style={{ flex: '0 0 220px' }}>
          <label>Filtrar por caixa</label>
          <select value={filtroCaixa} onChange={(e) => setFiltroCaixa(e.target.value)}>
            <option value="">Todas</option>
            {caixas.map(c => (
              <option key={c} value={c}>Caixa {c}</option>
            ))}
          </select>
        </div>
        <div className="form-group" style={{ flex: 1 }}>
          <label>Buscar por artista ou título</label>
          <input
            type="text"
            placeholder="Ex: Beatles, Abbey Road, Roberto Carlos..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <div className="form-group" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '6px', flex: '0 0 auto', marginBottom: '8px' }}>
          <input
            type="checkbox"
            id="mostrarInativos"
            checked={mostrarInativos}
            onChange={(e) => setMostrarInativos(e.target.checked)}
            style={{ width: 'auto' }}
          />
          <label htmlFor="mostrarInativos" style={{ marginBottom: 0 }}>Mostrar inativos</label>
        </div>
      </div>

      {loading ? (
        <p>Carregando...</p>
      ) : discos.length === 0 ? (
        <div className="empty-state">Nenhum disco encontrado.</div>
      ) : (
        <>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px' }}>
            Mostrando {(pagina - 1) * ITENS_POR_PAGINA + 1}–{Math.min(pagina * ITENS_POR_PAGINA, total)} de {total} discos
          </p>
          <div className="table-responsive">
            <table>
            <thead>
              <tr>
                <th>Caixa</th>
                <th>Artista</th>
                <th>Título</th>
                <th>Preço</th>
                <th>Qtd</th>
                <th>Status</th>
                <th style={{ width: '40px' }}></th>
              </tr>
            </thead>
            <tbody>
              {discos.map((d) => (
                <tr key={d.id} style={d.ativo === false ? { opacity: 0.5 } : {}}>
                  <td>{d.caixa}</td>
                  <td>{d.artista}</td>
                  <td>{d.titulo}</td>
                  <td>R$ {Number(d.preco || 0).toFixed(2)}</td>
                  <td>{d.quantidade}</td>
                  <td>
                    <span className={`badge ${d.ativo ? 'badge-entrada' : 'badge-saida'}`}>
                      {d.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td>
                    <Link href={`/editar?id=${d.id}`} title="Editar disco" style={{ fontSize: '16px' }}><FaEdit color="var(--text-muted)" /></Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>

          <div className="pagination">
            <button
              className="btn btn-secondary"
              disabled={pagina <= 1}
              onClick={() => setPagina(p => p - 1)}
            >
              ← Anterior
            </button>
            <span>Página {pagina} de {totalPaginas}</span>
            <button
              className="btn btn-secondary"
              disabled={pagina >= totalPaginas}
              onClick={() => setPagina(p => p + 1)}
            >
              Próxima →
            </button>
          </div>
        </>
      )}
    </div>
  );
}
