'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { FaEdit, FaSortUp, FaSortDown, FaSort } from "react-icons/fa";
import { PiVinylRecord, PiDisc, PiFilmStrip } from "react-icons/pi";
import { MdDownload, MdDelete } from "react-icons/md";
import * as XLSX from 'xlsx';

const ITENS_POR_PAGINA = 50;

export default function Catalogo() {
  const [activeTab, setActiveTab] = useState('discos'); // 'discos' | 'dvds' | 'cds'
  const [itens, setItens] = useState([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [filtroCaixa, setFiltroCaixa] = useState('');
  const [filtroLoja, setFiltroLoja] = useState('');
  const [busca, setBusca] = useState('');
  const [mostrarAtivos, setMostrarAtivos] = useState(true);
  const [mostrarInativos, setMostrarInativos] = useState(false);
  const [caixas, setCaixas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exportando, setExportando] = useState(false);

  async function exportarEstoque() {
    setExportando(true);
    try {
      async function fetchAll(table, select, orderBy) {
        let allData = [];
        let from = 0;
        const step = 1000;
        while (true) {
          const { data, error } = await supabase
            .from(table)
            .select(select)
            .eq('deletado', false)
            .order(orderBy)
            .range(from, from + step - 1);
            
          if (error) throw error;
          if (!data || data.length === 0) break;
          
          allData = allData.concat(data);
          if (data.length < step) break;
          from += step;
        }
        return allData;
      }

      const [ discos, dvds, cds ] = await Promise.all([
        fetchAll('discos', 'caixa, artista, titulo, loja, preco, ativo', 'artista'),
        fetchAll('dvds', 'titulo, loja, preco, ativo', 'titulo'),
        fetchAll('cds', 'artista, titulo, loja, preco, ativo', 'artista')
      ]);

      const formataStatus = (ativo) => ativo !== false ? 'Ativo (Em Estoque)' : 'Inativo (Saída/Vendido)';
      const formataPreco = (preco) => preco ? `R$ ${Number(preco).toFixed(2).replace('.', ',')}` : 'R$ 0,00';

      const discosData = discos?.map(d => ({
        'Caixa': d.caixa || '-',
        'Artista': d.artista || '-',
        'Título': d.titulo || '-',
        'Loja': d.loja || '-',
        'Preço': formataPreco(d.preco),
        'Status': formataStatus(d.ativo)
      })) || [];

      const dvdsData = dvds?.map(d => ({
        'Título': d.titulo || '-',
        'Loja': d.loja || '-',
        'Preço': formataPreco(d.preco),
        'Status': formataStatus(d.ativo)
      })) || [];

      const cdsData = cds?.map(d => ({
        'Artista': d.artista || '-',
        'Título': d.titulo || '-',
        'Loja': d.loja || '-',
        'Preço': formataPreco(d.preco),
        'Status': formataStatus(d.ativo)
      })) || [];

      const wb = XLSX.utils.book_new();
      const wsDiscos = XLSX.utils.json_to_sheet(discosData);
      const wsDvds = XLSX.utils.json_to_sheet(dvdsData);
      const wsCds = XLSX.utils.json_to_sheet(cdsData);

      wsDiscos['!cols'] = [{wch: 8}, {wch: 35}, {wch: 45}, {wch: 15}, {wch: 12}, {wch: 25}];
      wsDvds['!cols'] = [{wch: 45}, {wch: 15}, {wch: 12}, {wch: 25}];
      wsCds['!cols'] = [{wch: 35}, {wch: 45}, {wch: 15}, {wch: 12}, {wch: 25}];

      XLSX.utils.book_append_sheet(wb, wsDiscos, "Discos de Vinil");
      XLSX.utils.book_append_sheet(wb, wsDvds, "DVDs");
      XLSX.utils.book_append_sheet(wb, wsCds, "CDs");

      const hoje = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
      XLSX.writeFile(wb, `Estoque_FreelancerDiscos_${hoje}.xlsx`);

    } catch (err) {
      console.error("Erro ao exportar:", err);
      alert("Houve um erro ao gerar a planilha. Tente novamente.");
    }
    setExportando(false);
  }

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
        ? 'id, titulo, preco, ativo, loja, observacao' 
        : activeTab === 'cds'
        ? 'id, artista, titulo, preco, ativo, loja, observacao'
        : 'id, caixa, artista, titulo, preco, ativo, loja, observacao';

      let query = supabase
        .from(activeTab)
        .select(columns, { count: 'exact' })
        .eq('deletado', false);

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
      if (filtroLoja) {
        query = query.eq('loja', filtroLoja);
      }
      if (busca) {
        const words = busca.trim().split(/\s+/);
        if (activeTab === 'dvds') {
          words.forEach(word => {
            query = query.ilike('titulo', `%${word}%`);
          });
        } else {
          words.forEach(word => {
            query = query.or(`artista.ilike.%${word}%,titulo.ilike.%${word}%`);
          });
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
  }, [pagina, filtroCaixa, filtroLoja, busca, mostrarAtivos, mostrarInativos, ordenarColuna, ordenarDirecao, activeTab]);


  async function excluirItem(id, titulo) {
    if (!confirm(`Tem certeza que deseja excluir "${titulo}" do catálogo? O item não aparecerá mais, mas será mantido nas sugestões de autocompletar e o histórico de saída será preservado.`)) {
      return;
    }
    setLoading(true);
    const { error } = await supabase
      .from(activeTab)
      .update({ deletado: true })
      .eq('id', id);

    if (error) {
      console.error("Erro ao excluir:", error);
      alert("Erro ao excluir item.");
    } else {
      setItens(itens.filter(i => i.id !== id));
      setTotal(total - 1);
    }
    setLoading(false);
  }

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

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div className="tabs" style={{ marginBottom: 0 }}>
          <button 
            className={`tab-btn ${activeTab === 'discos' ? 'active' : ''}`}
            onClick={() => { setActiveTab('discos'); setPagina(1); setOrdenarColuna(null); setOrdenarDirecao(null); }}
          >
            <PiVinylRecord style={{ marginRight: '6px', verticalAlign: 'middle' }} /> Discos
          </button>
          <button 
            className={`tab-btn ${activeTab === 'dvds' ? 'active' : ''}`}
            onClick={() => { setActiveTab('dvds'); setPagina(1); setOrdenarColuna(null); setOrdenarDirecao(null); }}
          >
            <PiFilmStrip style={{ marginRight: '6px', verticalAlign: 'middle' }} /> DVDs
          </button>
          <button 
            className={`tab-btn ${activeTab === 'cds' ? 'active' : ''}`}
            onClick={() => { setActiveTab('cds'); setPagina(1); setOrdenarColuna(null); setOrdenarDirecao(null); }}
          >
            <PiDisc style={{ marginRight: '6px', verticalAlign: 'middle' }} /> CDs
          </button>
        </div>

        <button 
          className="btn btn-primary"
          onClick={exportarEstoque} 
          disabled={exportando}
          style={{ 
            display: 'flex', alignItems: 'center', gap: '8px', 
            padding: '10px 16px', borderRadius: '8px',
            background: 'var(--accent)', color: '#fff', border: 'none',
            cursor: exportando ? 'not-allowed' : 'pointer', fontSize: '14px',
            fontWeight: 600, opacity: exportando ? 0.7 : 1, transition: '0.2s',
            marginLeft: 'auto'
          }}
        >
          <MdDownload size={18} />
          {exportando ? 'Gerando...' : 'Exportar Excel'}
        </button>
      </div>

    <div className="filters">
        {activeTab === 'discos' && (
          <div className="form-group" style={{ flex: '0 0 220px' }}>
            <label>Filtrar por caixa</label>
            <select value={filtroCaixa} onChange={(e) => { setFiltroCaixa(e.target.value); setPagina(1); }}>
              <option value="">Todas</option>
              {caixas.map(c => (
                <option key={c} value={c}>Caixa {c}</option>
              ))}
            </select>
          </div>
        )}
        <div className="form-group" style={{ flex: '0 0 160px' }}>
          <label>Filtrar por loja</label>
          <select value={filtroLoja} onChange={(e) => { setFiltroLoja(e.target.value); setPagina(1); }}>
            <option value="">Todas</option>
            <option value="Loja 1">Loja 1</option>
            <option value="Loja 2">Loja 2</option>
            <option value="Anexo">Anexo</option>
          </select>
        </div>
        <div className="form-group" style={{ flex: 1 }}>
          <label>Buscar por {activeTab === 'dvds' ? 'título' : 'artista ou título'}</label>
          <input
            type="text"
            placeholder={activeTab === 'dvds' ? "Ex: O Poderoso Chefão, Matrix..." : "Ex: Beatles, Abbey Road, Roberto Carlos..."}
            value={busca}
            onChange={(e) => { setBusca(e.target.value); setPagina(1); }}
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
                onChange={(e) => { setMostrarAtivos(e.target.checked); setPagina(1); }}
              />
              <span>Ativos</span>
            </label>
            <label className="filter-checkbox-item" htmlFor="mostrarInativos">
              <input
                type="checkbox"
                id="mostrarInativos"
                checked={mostrarInativos}
                onChange={(e) => { setMostrarInativos(e.target.checked); setPagina(1); }}
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
                <th>Obs.</th>
                <th>Status</th>
                <th style={{ width: '40px' }}></th>
              </tr>
            </thead>
            <tbody>
              {itens.map((d) => (
                <tr key={d.id} style={d.ativo === false ? { opacity: 0.5 } : {}}>
                  {activeTab === 'discos' && <td data-label="Caixa">{d.caixa}</td>}
                  {activeTab !== 'dvds' && (
                    <td data-label="Artista" className={!d.artista ? "empty-artist" : ""}>{d.artista || <span className="text-empty">—</span>}</td>
                  )}
                  <td data-label="Título">{d.titulo || <span className="text-empty">—</span>}</td>
                  <td data-label="Loja">
                    {d.loja ? (
                      <span style={{ fontWeight: 600, color: 'var(--accent)' }}>{d.loja}</span>
                    ) : (
                      <span className="text-empty">—</span>
                    )}
                  </td>
                  <td data-label="Preço">R$ {Number(d.preco || 0).toFixed(2).replace('.', ',')}</td>
                  <td data-label="Obs." title={d.observacao || ''}>
                    {d.observacao ? (
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {d.observacao.length > 20 ? d.observacao.substring(0, 20) + '...' : d.observacao}
                      </span>
                    ) : (
                      <span className="text-empty">—</span>
                    )}
                  </td>
                  <td data-label="Status">
                    <span className={`badge ${d.ativo ? 'badge-entrada' : 'badge-saida'}`}>
                      {d.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td data-label="Ação" style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                    <Link href={`/editar?id=${d.id}&tipo=${activeTab}`} title={`Editar ${itemName.slice(0, -1)}`} style={{ fontSize: '16px', padding: '10px' }}><FaEdit color="var(--text-muted)" /></Link>
                    <button 
                      onClick={() => excluirItem(d.id, d.titulo || d.artista || 'Item')} 
                      title={`Excluir ${itemName.slice(0, -1)}`}
                      style={{ fontSize: '18px', padding: '10px', background: 'none', border: 'none', cursor: 'pointer', color: '#ff4d4d' }}
                    >
                      <MdDelete />
                    </button>
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
