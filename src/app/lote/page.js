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
  const [selecionadosData, setSelecionadosData] = useState([]);
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
      .eq('deletado', false)
      .order('titulo', { ascending: true })
      .limit(3000); // Increased limit to allow larger bulk actions

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
    const visibleIds = itens.map(d => d.id);
    const allVisibleSelected = visibleIds.every(id => selecionados.includes(id));
    
    if (allVisibleSelected && visibleIds.length > 0) {
      // Unselect visible items
      setSelecionados(selecionados.filter(id => !visibleIds.includes(id)));
      setSelecionadosData(selecionadosData.filter(d => !visibleIds.includes(d.id)));
    } else {
      // Select all visible items
      const newIds = visibleIds.filter(id => !selecionados.includes(id));
      setSelecionados([...selecionados, ...newIds]);
      const newItemsData = itens.filter(d => newIds.includes(d.id));
      setSelecionadosData([...selecionadosData, ...newItemsData]);
    }
  }

  function toggleSelecionar(id) {
    if (selecionados.includes(id)) {
      setSelecionados(selecionados.filter(sid => sid !== id));
      setSelecionadosData(selecionadosData.filter(d => d.id !== id));
    } else {
      setSelecionados([...selecionados, id]);
      const itemData = itens.find(d => d.id === id) || selecionadosData.find(d => d.id === id);
      if (itemData) {
        setSelecionadosData([...selecionadosData, itemData]);
      }
    }
  }

  function limparSelecao() {
    setSelecionados([]);
    setSelecionadosData([]);
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
      limparSelecao();
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
      limparSelecao();
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
      limparSelecao();
      carregarItens();
    }
    setLoading(false);
  }

  async function excluirSelecionados() {
    setLoading(true);
    const { error } = await supabase
      .from(activeTab)
      .update({ deletado: true })
      .in('id', selecionados);
      
    if (error) {
      setMensagem({ tipo: 'error', texto: error.message });
    } else {
      setMensagem({ tipo: 'success', texto: `${selecionados.length} item(ns) excluídos (ocultados do catálogo).` });
      setConfirmarExclusao(false);
      limparSelecao();
      carregarItens();
    }
    setLoading(false);
  }

  const itensParaMostrar = [
    ...selecionadosData,
    ...itens.filter(d => !selecionados.includes(d.id))
  ];

  return (
    <div>
      <div className="page-header">
        <MdLayers size={28} color="var(--accent)" />
        <h1 className="page-title">Alteração em Lote</h1>
      </div>
      
      <div className="tabs">
        <button 
          className={`tab-btn ${activeTab === 'discos' ? 'active' : ''}`}
          onClick={() => { setActiveTab('discos'); setMensagem(null); setBusca(''); limparSelecao(); }}
        >
          <PiVinylRecord style={{ marginRight: '6px', verticalAlign: 'middle' }} /> Discos
        </button>
        <button 
          className={`tab-btn ${activeTab === 'dvds' ? 'active' : ''}`}
          onClick={() => { setActiveTab('dvds'); setMensagem(null); setBusca(''); limparSelecao(); }}
        >
          <PiFilmStrip style={{ marginRight: '6px', verticalAlign: 'middle' }} /> DVDs
        </button>
        <button 
          className={`tab-btn ${activeTab === 'cds' ? 'active' : ''}`}
          onClick={() => { setActiveTab('cds'); setMensagem(null); setBusca(''); limparSelecao(); }}
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

      {/* --- SELECIONADOS (chips) --- */}
      {selecionadosData.length > 0 && (
        <div style={{ 
          marginBottom: '16px', 
          padding: '12px 16px', 
          border: '1px solid var(--accent)', 
          borderRadius: '8px', 
          background: 'rgba(197, 48, 48, 0.05)' 
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--accent)' }}>
              {selecionadosData.length} selecionado(s)
            </span>
            <button 
              onClick={limparSelecao} 
              style={{ 
                background: 'none', border: 'none', color: 'var(--text-muted)', 
                cursor: 'pointer', fontSize: '12px', textDecoration: 'underline' 
              }}
            >
              Limpar tudo
            </button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {selecionadosData.map(d => (
              <span 
                key={d.id} 
                style={{ 
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  padding: '4px 10px', borderRadius: '999px', fontSize: '12px',
                  background: 'var(--accent)', color: '#fff', fontWeight: 500, 
                  lineHeight: 1.4
                }}
              >
                {activeTab !== 'dvds' && d.artista ? `${d.artista} — ` : ''}{d.titulo}
                <button
                  onClick={() => toggleSelecionar(d.id)}
                  style={{ 
                    background: 'none', border: 'none', color: '#fff', cursor: 'pointer', 
                    padding: '0', fontSize: '14px', lineHeight: 1, fontWeight: 700, opacity: 0.8
                  }}
                  title="Remover da seleção"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {loading && !itens.length && <p>Carregando...</p>}

      {!loading && itens.length === 0 && selecionadosData.length === 0 && (
        <div className="empty-state">Nenhum item encontrado.</div>
      )}

      {itens.length > 0 && (
        <>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px' }}>
            {busca || caixaSelecionada 
              ? `${itens.filter(d => !selecionados.includes(d.id)).length} resultado(s)` 
              : `Listando ${itens.length} iten(s)`
            }
          </p>
          <div className="table-responsive" style={{ marginBottom: '120px' }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: '40px', textAlign: 'center' }}>
                    <input 
                      type="checkbox" 
                      checked={itens.length > 0 && itens.every(d => selecionados.includes(d.id))}
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
        <div className="bulk-actions-panel" style={{ 
          boxShadow: '0 -4px 20px rgba(0,0,0,0.4)', 
          border: '1px solid var(--border)',
          borderTopColor: 'var(--accent)',
          borderTopWidth: '3px'
        }}>
          <div className="bulk-actions-content" style={{ flexWrap: 'nowrap', gap: '20px' }}>
            
            <div className="bulk-actions-info" style={{ display: 'flex', alignItems: 'center', gap: '12px', whiteSpace: 'nowrap' }}>
              <button 
                onClick={limparSelecao}
                style={{
                  background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%',
                  width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--text)', cursor: 'pointer', transition: 'background 0.2s'
                }}
                title="Cancelar seleção"
                onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
                onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
              >
                ✕
              </button>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '15px', fontWeight: 'bold', color: '#fff' }}>{selecionados.length} selecionados</span>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Ações em lote</span>
              </div>
            </div>
            
            <div className="bulk-actions-tools" style={{ flexWrap: 'nowrap', overflowX: 'auto', paddingBottom: '4px', gap: '12px' }}>
              
              {/* Mover Caixa só para Discos */}
              {activeTab === 'discos' && (
                <div className="bulk-move-group" style={{ borderColor: 'var(--border)', background: 'rgba(255,255,255,0.03)' }}>
                  <input 
                    type="number" 
                    placeholder="Nº da Caixa" 
                    value={novaCaixa} 
                    onChange={(e) => setNovaCaixa(e.target.value)}
                    className="bulk-input"
                    style={{ width: '100px', color: '#fff' }}
                  />
                  <button className="btn btn-secondary" style={{ background: 'rgba(255,255,255,0.08)', borderLeft: '1px solid var(--border)', padding: '0 16px' }} onClick={moverSelecionados} disabled={loading}>
                    Mover
                  </button>
                </div>
              )}

              {/* Opção de Mover para Loja */}
              <div className="bulk-move-group" style={{ borderColor: 'var(--accent)', background: 'rgba(197, 48, 48, 0.1)' }}>
                <select 
                  className="bulk-input" 
                  style={{ width: '120px', color: '#fff' }}
                  value={lojaDestino}
                  onChange={(e) => setLojaDestino(e.target.value)}
                >
                  <option value="" style={{ color: '#000' }}>Loja destino...</option>
                  <option value="Loja 1" style={{ color: '#000' }}>Loja 1</option>
                  <option value="Loja 2" style={{ color: '#000' }}>Loja 2</option>
                  <option value="Anexo" style={{ color: '#000' }}>Anexo</option>
                </select>
                <button className="btn btn-primary" style={{ borderLeft: '1px solid var(--accent)', padding: '0 16px' }} onClick={migrarParaLoja} disabled={loading}>
                  Transferir
                </button>
              </div>

              <div style={{ width: '1px', height: '32px', background: 'var(--border)', margin: '0 4px' }}></div>
              
              <button className="btn btn-secondary" style={{ background: 'rgba(255,255,255,0.05)', whiteSpace: 'nowrap' }} onClick={inativarSelecionados} disabled={loading}>
                Inativar
              </button>
              
              {confirmarExclusao ? (
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                  <button className="btn btn-danger" style={{ whiteSpace: 'nowrap' }} onClick={excluirSelecionados} disabled={loading}>Confirmar</button>
                  <button className="btn btn-secondary" style={{ whiteSpace: 'nowrap', padding: '6px 12px' }} onClick={() => setConfirmarExclusao(false)}>Cancelar</button>
                </div>
              ) : (
                <button className="btn btn-danger" style={{ background: 'transparent', border: '1px solid var(--danger)', color: 'var(--danger)', whiteSpace: 'nowrap' }} onClick={() => setConfirmarExclusao(true)} disabled={loading}>
                  Excluir
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
