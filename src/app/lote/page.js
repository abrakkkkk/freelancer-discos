'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { MdLayers } from "react-icons/md";
import { PiVinylRecord, PiDisc, PiFilmStrip } from "react-icons/pi";

export default function AcoesEmLote() {
  const [activeTab, setActiveTab] = useState('discos'); // 'discos' | 'dvds' | 'cds'
  const [caixas, setCaixas] = useState([]);
  const [caixaSelecionada, setCaixaSelecionada] = useState('');
  const [busca, setBusca] = useState('');
  
  const [itens, setItens] = useState([]);
  const [selecionados, setSelecionados] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mensagem, setMensagem] = useState(null);
  
  // Ações state
  const [novaCaixa, setNovaCaixa] = useState('');
  const [lojaDestino, setLojaDestino] = useState('');
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);

  useEffect(() => {
    carregarCaixas();
  }, []);

  // Recarregar quando mudar filtros
  useEffect(() => {
    carregarItens();
  }, [caixaSelecionada, busca, activeTab]);

  async function carregarCaixas() {
    const { data } = await supabase.from('caixas_distintas').select('caixa');
    if (data) {
      setCaixas([...new Set(data.map(d => d.caixa))].sort((a, b) => a - b));
    }
  }

  async function carregarItens() {
    setLoading(true);
    setMensagem(null);
    
    // Selecionamos '*' para que se a coluna 'loja' ainda não tiver sido criada pelo usuário,
    // a requisição não falhe com um erro de coluna inexistente. O valor virá indefinido.
    let query = supabase
      .from(activeTab)
      .select('*')
      .order('titulo', { ascending: true })
      .limit(200); // hard limit to avoid browser crash

    if (activeTab === 'discos' && caixaSelecionada) {
      query = query.eq('caixa', parseInt(caixaSelecionada));
    }
    
    if (busca) {
      if (activeTab === 'dvds') {
        query = query.or(`titulo.ilike.%${busca}%`);
      } else {
        query = query.or(`artista.ilike.%${busca}%,titulo.ilike.%${busca}%`);
      }
    }

    const { data, error } = await query;
      
    if (error) {
      console.error(error);
      setItens([]);
    } else {
      setItens(data || []);
    }
    setLoading(false);
  }

  function toggleSelecionarTodos() {
    if (selecionados.length === itens.length) {
      setSelecionados([]);
    } else {
      setSelecionados(itens.map(d => d.id));
    }
  }

  function toggleSelecionar(id) {
    if (selecionados.includes(id)) {
      setSelecionados(selecionados.filter(sid => sid !== id));
    } else {
      setSelecionados([...selecionados, id]);
    }
  }

  async function moverSelecionados() {
    if (!novaCaixa || isNaN(Number(novaCaixa)) || parseInt(novaCaixa) < 0) {
      setMensagem({ tipo: 'error', texto: 'Digite um número válido e positivo para a nova caixa.' });
      return;
    }
    setLoading(true);
    const { error } = await supabase
      .from(activeTab)
      .update({ caixa: parseInt(novaCaixa) })
      .in('id', selecionados);
      
    if (error) {
      setMensagem({ tipo: 'error', texto: error.message });
    } else {
      setMensagem({ tipo: 'success', texto: `${selecionados.length} item(ns) movidos para a Caixa ${novaCaixa}.` });
      setNovaCaixa('');
      carregarItens();
      carregarCaixas();
    }
    setLoading(false);
  }
  
  async function migrarParaLoja() {
    if (!lojaDestino) {
      setMensagem({ tipo: 'error', texto: 'Selecione a loja de destino.' });
      return;
    }
    setLoading(true);
    const { error } = await supabase
      .from(activeTab)
      .update({ loja: lojaDestino })
      .in('id', selecionados);
      
    if (error) {
      // Mensagem amigável caso a coluna não exista
      if (error.message.includes('Could not find the') && error.message.includes('loja')) {
        setMensagem({ tipo: 'error', texto: 'Erro: A coluna "loja" ainda não foi criada no banco de dados para esta tabela.' });
      } else {
        setMensagem({ tipo: 'error', texto: `Erro ao migrar loja: ${error.message}` });
      }
    } else {
      setMensagem({ tipo: 'success', texto: `${selecionados.length} item(ns) migrados para ${lojaDestino}.` });
      setLojaDestino('');
      carregarItens();
    }
    setLoading(false);
  }

  async function inativarSelecionados() {
    setLoading(true);
    const { error } = await supabase
      .from(activeTab)
      .update({ ativo: false })
      .in('id', selecionados);
      
    if (error) {
      setMensagem({ tipo: 'error', texto: error.message });
    } else {
      setMensagem({ tipo: 'success', texto: `${selecionados.length} item(ns) inativados.` });
      carregarItens();
    }
    setLoading(false);
  }

  async function excluirSelecionados() {
    setLoading(true);
    const { error } = await supabase
      .from(activeTab)
      .delete()
      .in('id', selecionados);
      
    if (error) {
      setMensagem({ tipo: 'error', texto: error.message });
    } else {
      setMensagem({ tipo: 'success', texto: `${selecionados.length} item(ns) excluídos definitivamente.` });
      setConfirmarExclusao(false);
      carregarItens();
    }
    setLoading(false);
  }

  return (
    <div>
      <div className="page-header">
        <MdLayers size={28} color="var(--accent)" />
        <h1 className="page-title">Alteração em Lote</h1>
      </div>
      
      <div className="tabs">
        <button 
          className={`tab-btn ${activeTab === 'discos' ? 'active' : ''}`}
          onClick={() => { setActiveTab('discos'); setMensagem(null); setBusca(''); setSelecionados([]); }}
        >
          <PiVinylRecord style={{ marginRight: '6px', verticalAlign: 'middle' }} /> Discos
        </button>
        <button 
          className={`tab-btn ${activeTab === 'dvds' ? 'active' : ''}`}
          onClick={() => { setActiveTab('dvds'); setMensagem(null); setBusca(''); setSelecionados([]); }}
        >
          <PiFilmStrip style={{ marginRight: '6px', verticalAlign: 'middle' }} /> DVDs
        </button>
        <button 
          className={`tab-btn ${activeTab === 'cds' ? 'active' : ''}`}
          onClick={() => { setActiveTab('cds'); setMensagem(null); setBusca(''); setSelecionados([]); }}
        >
          <PiDisc style={{ marginRight: '6px', verticalAlign: 'middle' }} /> CDs
        </button>
      </div>

      <div className="filters">
        {activeTab === 'discos' && (
          <div className="form-group" style={{ flex: '0 0 200px' }}>
            <label>Filtrar por Caixa</label>
            <select value={caixaSelecionada} onChange={(e) => setCaixaSelecionada(e.target.value)}>
              <option value="">Todas</option>
              {caixas.map(c => (
                <option key={c} value={c}>Caixa {c}</option>
              ))}
            </select>
          </div>
        )}
        <div className="form-group" style={{ flex: 1, maxWidth: '400px' }}>
          <label>Buscar por {activeTab === 'dvds' ? 'título' : 'artista ou título'}</label>
          <input
            type="text"
            placeholder={activeTab === 'dvds' ? "Ex: O Poderoso Chefão..." : "Ex: Beatles..."}
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
      </div>

      {mensagem && (
        <div className={`alert alert-${mensagem.tipo}`}>{mensagem.texto}</div>
      )}

      {loading && !itens.length && <p>Carregando...</p>}

      {!loading && itens.length === 0 && (
        <div className="empty-state">Nenhum item encontrado.</div>
      )}

      {itens.length > 0 && (
        <>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px' }}>
            Listando {itens.length} iten(s)
          </p>
          <div className="table-responsive" style={{ marginBottom: '120px' }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: '40px', textAlign: 'center' }}>
                    <input 
                      type="checkbox" 
                      checked={selecionados.length === itens.length && itens.length > 0}
                      onChange={toggleSelecionarTodos}
                      style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                    />
                  </th>
                  {activeTab !== 'dvds' && <th>Artista</th>}
                  <th>Título</th>
                  <th>Loja</th>
                  <th>Preço</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {itens.map((d) => (
                  <tr key={d.id} style={{ backgroundColor: selecionados.includes(d.id) ? 'rgba(197, 48, 48, 0.08)' : 'transparent', opacity: d.ativo === false ? 0.6 : 1 }}>
                    <td data-label="Selecionar" style={{ textAlign: 'center' }}>
                      <input 
                        type="checkbox" 
                        checked={selecionados.includes(d.id)}
                        onChange={() => toggleSelecionar(d.id)}
                        style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                      />
                    </td>
                    {activeTab !== 'dvds' && <td data-label="Artista">{d.artista}</td>}
                    <td data-label="Título">{d.titulo}</td>
                    <td data-label="Loja">
                      {d.loja ? (
                        <span style={{ fontWeight: 600, color: 'var(--accent)' }}>{d.loja}</span>
                      ) : (
                        <span className="text-empty">—</span>
                      )}
                    </td>
                    <td data-label="Preço">R$ {Number(d.preco || 0).toFixed(2).replace('.', ',')}</td>
                    <td data-label="Status">
                      <span className={`badge ${d.ativo !== false ? 'badge-entrada' : 'badge-saida'}`}>
                        {d.ativo !== false ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* PAINEL FLUTUANTE DE AÇÕES (Se houver selecionados) */}
      {selecionados.length > 0 && (
        <div className="bulk-actions-panel">
          <div className="bulk-actions-content">
            <div className="bulk-actions-info">
              <span className="badge badge-entrada" style={{ fontSize: '14px' }}>{selecionados.length} selecionados</span>
            </div>
            
            <div className="bulk-actions-tools">
              {/* Opção de Mover para Loja */}
              <div className="bulk-move-group" style={{ borderColor: 'var(--accent)' }}>
                <select 
                  className="bulk-input" 
                  style={{ width: '110px' }}
                  value={lojaDestino}
                  onChange={(e) => setLojaDestino(e.target.value)}
                >
                  <option value="">Lojas...</option>
                  <option value="Loja 1">Loja 1</option>
                  <option value="Loja 2">Loja 2</option>
                  <option value="Anexo">Anexo</option>
                </select>
                <button className="btn btn-primary" onClick={migrarParaLoja} disabled={loading}>Transferir Loja</button>
              </div>

              {/* Mover Caixa só para Discos */}
              {activeTab === 'discos' && (
                <div className="bulk-move-group">
                  <input 
                    type="number" 
                    placeholder="Nº da Caixa" 
                    value={novaCaixa} 
                    onChange={(e) => setNovaCaixa(e.target.value)}
                    className="bulk-input"
                  />
                  <button className="btn btn-secondary" onClick={moverSelecionados} disabled={loading}>Mover de Caixa</button>
                </div>
              )}
              
              <button className="btn btn-secondary" onClick={inativarSelecionados} disabled={loading}>Inativar</button>
              
              {confirmarExclusao ? (
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button className="btn btn-danger" onClick={excluirSelecionados} disabled={loading}>Confirmar</button>
                  <button className="btn btn-secondary" onClick={() => setConfirmarExclusao(false)}>Cancelar</button>
                </div>
              ) : (
                <button className="btn btn-danger" onClick={() => setConfirmarExclusao(true)} disabled={loading}>Excluir</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
