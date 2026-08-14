'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { FaEdit, FaSortUp, FaSortDown, FaSort } from "react-icons/fa";
import { PiVinylRecord, PiDisc, PiFilmStrip } from "react-icons/pi";

const ITENS_POR_PAGINA = 50;

export default function Catalogo() {
  const [activeTab, setActiveTab] = useState('discos'); // 'discos' | 'dvds' | 'cds'
  const [itens, setItens] = useState([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [filtroCaixa, setFiltroCaixa] = useState('');
  const [busca, setBusca] = useState('');
  const [mostrarAtivos, setMostrarAtivos] = useState(true);
  const [mostrarInativos, setMostrarInativos] = useState(false);
  const [caixas, setCaixas] = useState([]);
  const [loading, setLoading] = useState(true);

  // Ordenação: coluna e direção
  // null = padrão (caixa > artista > titulo), 'asc' = crescente, 'desc' = decrescente
  const [ordenarColuna, setOrdenarColuna] = useState(null); // 'artista' | 'titulo' | null
  const [ordenarDirecao, setOrdenarDirecao] = useState(null); // 'asc' | 'desc' | null

  function toggleOrdenacao(coluna) {
    if (ordenarColuna === coluna) {
      if (ordenarDirecao === 'asc') {
        setOrdenarDirecao('desc');
      } else if (ordenarDirecao === 'desc') {
        // Voltar ao padrão
        setOrdenarColuna(null);
        setOrdenarDirecao(null);
      }
    } else {
      setOrdenarColuna(coluna);
      setOrdenarDirecao('asc');
    }
    setPagina(1);
  }

  function renderSortIcon(coluna) {
    if (ordenarColuna !== coluna) {
      return <FaSort size={16} style={{ marginLeft: '6px', opacity: 0.35 }} />;
    }
    if (ordenarDirecao === 'asc') {
      return <FaSortUp size={16} style={{ marginLeft: '6px', color: 'var(--accent)' }} />;
    }
    return <FaSortDown size={16} style={{ marginLeft: '6px', color: 'var(--accent)' }} />;
  }

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

  // Buscar itens com filtros e paginação
  useEffect(() => {
    async function fetchItens() {
      setLoading(true);

      const columns = activeTab === 'dvds' 
        ? 'id, titulo, preco, quantidade, ativo, loja' 
        : activeTab === 'cds'
        ? 'id, artista, titulo, preco, quantidade, ativo, loja'
        : 'id, caixa, artista, titulo, preco, quantidade, ativo, loja';

      let query = supabase
        .from(activeTab)
        .select(columns, { count: 'exact' });

      if (mostrarAtivos && !mostrarInativos) {
        query = query.eq('ativo', true);
      } else if (!mostrarAtivos && mostrarInativos) {
        query = query.eq('ativo', false);
      } else if (!mostrarAtivos && !mostrarInativos) {
        setItens([]);
        setTotal(0);
        setLoading(false);
        return;
      }
      if (filtroCaixa) {
        query = query.eq('caixa', parseInt(filtroCaixa));
      }
      if (busca) {
        if (activeTab === 'dvds') {
          query = query.or(`titulo.ilike.%${busca}%`);
        } else {
          query = query.or(`artista.ilike.%${busca}%,titulo.ilike.%${busca}%`);
        }
      }

      // Aplicar ordenação personalizada ou padrão
      if (ordenarColuna && ordenarDirecao) {
        const ascending = ordenarDirecao === 'asc';
        query = query.order(ordenarColuna, { ascending, nullsFirst: ascending });
      } else {
        if (activeTab === 'discos') {
          query = query.order('caixa');
        }
        if (activeTab !== 'dvds') {
          query = query.order('artista');
        }
        query = query.order('titulo');
      }

      query = query.range((pagina - 1) * ITENS_POR_PAGINA, pagina * ITENS_POR_PAGINA - 1);

      const { data, count, error } = await query;
      
      // Se a tabela não existir, vai dar erro. Tratar graciosamente:
      if (error) {
        console.error("Erro ao buscar itens:", error);
        setItens([]);
        setTotal(0);
      } else {
        setItens(data || []);
        setTotal(count || 0);
      }
      setLoading(false);
    }
    fetchItens();
  }, [pagina, filtroCaixa, busca, mostrarAtivos, mostrarInativos, ordenarColuna, ordenarDirecao, activeTab]);

  // Resetar página e ordenação ao mudar filtros ou abas
  useEffect(() => {
    setPagina(1);
  }, [filtroCaixa, busca, mostrarAtivos, mostrarInativos, activeTab]);

  const totalPaginas = Math.max(1, Math.ceil(total / ITENS_POR_PAGINA));

  const itemName = activeTab === 'discos' ? 'discos' : activeTab === 'dvds' ? 'DVDs' : 'CDs';

  return (
    <div>
      <div className="page-header">
        {activeTab === 'discos' ? <PiVinylRecord size={28} color="var(--accent)" /> : 
         activeTab === 'dvds' ? <PiFilmStrip size={28} color="var(--accent)" /> : 
         <PiDisc size={28} color="var(--accent)" />}
        <h1 className="page-title">Catálogo Completo</h1>
      </div>

      <div className="tabs">
        <button 
          className={`tab-btn ${activeTab === 'discos' ? 'active' : ''}`}
          onClick={() => setActiveTab('discos')}
        >
          <PiVinylRecord style={{ marginRight: '6px', verticalAlign: 'middle' }} /> Discos
        </button>
        <button 
          className={`tab-btn ${activeTab === 'dvds' ? 'active' : ''}`}
          onClick={() => setActiveTab('dvds')}
        >
          <PiFilmStrip style={{ marginRight: '6px', verticalAlign: 'middle' }} /> DVDs
        </button>
        <button 
          className={`tab-btn ${activeTab === 'cds' ? 'active' : ''}`}
          onClick={() => setActiveTab('cds')}
        >
          <PiDisc style={{ marginRight: '6px', verticalAlign: 'middle' }} /> CDs
        </button>
      </div>

      <div className="filters">
        {activeTab === 'discos' && (
          <div className="form-group" style={{ flex: '0 0 220px' }}>
            <label>Filtrar por caixa</label>
            <select value={filtroCaixa} onChange={(e) => setFiltroCaixa(e.target.value)}>
              <option value="">Todas</option>
              {caixas.map(c => (
                <option key={c} value={c}>Caixa {c}</option>
              ))}
            </select>
          </div>
        )}
        <div className="form-group" style={{ flex: 1 }}>
          <label>Buscar por {activeTab === 'dvds' ? 'título' : 'artista ou título'}</label>
          <input
            type="text"
            placeholder={activeTab === 'dvds' ? "Ex: O Poderoso Chefão, Matrix..." : "Ex: Beatles, Abbey Road, Roberto Carlos..."}
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <div className="form-group" style={{ flex: '0 0 auto' }}>
          <label>Exibição</label>
          <div className="filter-checkboxes">
            <label className="filter-checkbox-item" htmlFor="mostrarAtivos">
              <input
                type="checkbox"
                id="mostrarAtivos"
                checked={mostrarAtivos}
                onChange={(e) => setMostrarAtivos(e.target.checked)}
              />
              <span>Ativos</span>
            </label>
            <label className="filter-checkbox-item" htmlFor="mostrarInativos">
              <input
                type="checkbox"
                id="mostrarInativos"
                checked={mostrarInativos}
                onChange={(e) => setMostrarInativos(e.target.checked)}
              />
              <span>Inativos</span>
            </label>
          </div>
        </div>
      </div>

      {loading ? (
        <p>Carregando...</p>
      ) : itens.length === 0 ? (
        <div className="empty-state">Nenhum {itemName.slice(0, -1)} encontrado (Tabela `{activeTab}` vazia ou não criada).</div>
      ) : (
        <>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px' }}>
            Mostrando {(pagina - 1) * ITENS_POR_PAGINA + 1}–{Math.min(pagina * ITENS_POR_PAGINA, total)} de {total} {itemName}
          </p>
          <div className="table-responsive">
            <table>
            <thead>
              <tr>
                {activeTab === 'discos' && <th>Caixa</th>}
                {activeTab !== 'dvds' && (
                  <th className="th-sortable" onClick={() => toggleOrdenacao('artista')}>
                    <div className="th-sortable-content">
                      <span>Artista</span>
                      {renderSortIcon('artista')}
                    </div>
                  </th>
                )}
                <th className="th-sortable" onClick={() => toggleOrdenacao('titulo')}>
                  <div className="th-sortable-content">
                    <span>Título</span>
                    {renderSortIcon('titulo')}
                  </div>
                </th>
                <th>Loja</th>
                <th>Preço</th>
                <th>Qtd</th>
                <th>Status</th>
                <th style={{ width: '40px' }}></th>
              </tr>
            </thead>
            <tbody>
              {itens.map((d) => (
                <tr key={d.id} style={d.ativo === false ? { opacity: 0.5 } : {}}>
                  {activeTab === 'discos' && <td data-label="Caixa">{d.caixa}</td>}
                  {activeTab !== 'dvds' && (
                    <td data-label="Artista">{d.artista || <span className="text-empty">—</span>}</td>
                  )}
                  <td data-label="Título">{d.titulo || <span className="text-empty">—</span>}</td>
                  <td data-label="Loja">
                    {d.loja ? (
                      <span style={{ fontWeight: 600, color: 'var(--accent)' }}>{d.loja}</span>
                    ) : (
                      <span className="text-empty">—</span>
                    )}
                  </td>
                  <td data-label="Preço">R$ {Number(d.preco || 0).toFixed(2)}</td>
                  <td data-label="Qtd">{d.quantidade}</td>
                  <td data-label="Status">
                    <span className={`badge ${d.ativo ? 'badge-entrada' : 'badge-saida'}`}>
                      {d.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td data-label="Ação" style={{ textAlign: 'center' }}>
                    <Link href={`/editar?id=${d.id}&tipo=${activeTab}`} title={`Editar ${itemName.slice(0, -1)}`} style={{ fontSize: '16px', padding: '10px' }}><FaEdit color="var(--text-muted)" /></Link>
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
