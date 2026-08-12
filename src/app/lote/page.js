'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { MdLayers } from "react-icons/md";

export default function AcoesEmLote() {
  const [caixas, setCaixas] = useState([]);
  const [caixaSelecionada, setCaixaSelecionada] = useState('');
  const [discos, setDiscos] = useState([]);
  const [selecionados, setSelecionados] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mensagem, setMensagem] = useState(null);
  
  // Ações state
  const [novaCaixa, setNovaCaixa] = useState('');
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);

  useEffect(() => {
    carregarCaixas();
  }, []);

  useEffect(() => {
    if (caixaSelecionada) {
      carregarDiscosDaCaixa(caixaSelecionada);
    } else {
      setDiscos([]);
      setSelecionados([]);
    }
  }, [caixaSelecionada]);

  async function carregarCaixas() {
    const { data } = await supabase.from('caixas_distintas').select('caixa');
    if (data) {
      setCaixas([...new Set(data.map(d => d.caixa))].sort((a, b) => a - b));
    }
  }

  async function carregarDiscosDaCaixa(caixa) {
    setLoading(true);
    setMensagem(null);
    setSelecionados([]);
    const { data, error } = await supabase
      .from('discos')
      .select('id, artista, titulo, preco, quantidade, ativo')
      .eq('caixa', caixa)
      .order('artista', { ascending: true });
      
    if (error) {
      setMensagem({ tipo: 'error', texto: `Erro ao carregar: ${error.message}` });
    } else {
      setDiscos(data || []);
    }
    setLoading(false);
  }

  function toggleSelecionarTodos() {
    if (selecionados.length === discos.length) {
      setSelecionados([]);
    } else {
      setSelecionados(discos.map(d => d.id));
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
    if (!novaCaixa) {
      setMensagem({ tipo: 'error', texto: 'Digite o número da nova caixa.' });
      return;
    }
    setLoading(true);
    const { error } = await supabase
      .from('discos')
      .update({ caixa: parseInt(novaCaixa) })
      .in('id', selecionados);
      
    if (error) {
      setMensagem({ tipo: 'error', texto: error.message });
    } else {
      setMensagem({ tipo: 'success', texto: `${selecionados.length} disco(s) movidos para a Caixa ${novaCaixa}.` });
      setNovaCaixa('');
      carregarDiscosDaCaixa(caixaSelecionada);
      carregarCaixas();
    }
    setLoading(false);
  }

  async function inativarSelecionados() {
    setLoading(true);
    const { error } = await supabase
      .from('discos')
      .update({ ativo: false })
      .in('id', selecionados);
      
    if (error) {
      setMensagem({ tipo: 'error', texto: error.message });
    } else {
      setMensagem({ tipo: 'success', texto: `${selecionados.length} disco(s) inativados.` });
      carregarDiscosDaCaixa(caixaSelecionada);
    }
    setLoading(false);
  }

  async function excluirSelecionados() {
    setLoading(true);
    const { error } = await supabase
      .from('discos')
      .delete()
      .in('id', selecionados);
      
    if (error) {
      setMensagem({ tipo: 'error', texto: error.message });
    } else {
      setMensagem({ tipo: 'success', texto: `${selecionados.length} disco(s) excluídos definitivamente.` });
      setConfirmarExclusao(false);
      carregarDiscosDaCaixa(caixaSelecionada);
    }
    setLoading(false);
  }

  return (
    <div>
      <div className="page-header">
        <MdLayers size={28} color="var(--accent)" />
        <h1 className="page-title">Alteração em Lote</h1>
      </div>

      <div className="filters">
        <div className="form-group" style={{ flex: 1, maxWidth: '300px' }}>
          <label>Selecione uma Caixa para gerenciar</label>
          <select value={caixaSelecionada} onChange={(e) => setCaixaSelecionada(e.target.value)}>
            <option value="">Selecione...</option>
            {caixas.map(c => (
              <option key={c} value={c}>Caixa {c}</option>
            ))}
          </select>
        </div>
      </div>

      {mensagem && (
        <div className={`alert alert-${mensagem.tipo}`}>{mensagem.texto}</div>
      )}

      {loading && !discos.length && <p>Carregando...</p>}

      {!loading && caixaSelecionada && discos.length === 0 && (
        <div className="empty-state">Nenhum disco encontrado nesta caixa.</div>
      )}

      {discos.length > 0 && (
        <>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px' }}>
            {discos.length} disco(s) na Caixa {caixaSelecionada}
          </p>
          <div className="table-responsive" style={{ marginBottom: '100px' }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: '40px', textAlign: 'center' }}>
                    <input 
                      type="checkbox" 
                      checked={selecionados.length === discos.length && discos.length > 0}
                      onChange={toggleSelecionarTodos}
                      style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                    />
                  </th>
                  <th>Artista</th>
                  <th>Título</th>
                  <th>Preço</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {discos.map((d) => (
                  <tr key={d.id} style={{ backgroundColor: selecionados.includes(d.id) ? 'rgba(197, 48, 48, 0.08)' : 'transparent', opacity: d.ativo === false ? 0.6 : 1 }}>
                    <td style={{ textAlign: 'center' }}>
                      <input 
                        type="checkbox" 
                        checked={selecionados.includes(d.id)}
                        onChange={() => toggleSelecionar(d.id)}
                        style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                      />
                    </td>
                    <td>{d.artista}</td>
                    <td>{d.titulo}</td>
                    <td>R$ {Number(d.preco || 0).toFixed(2).replace('.', ',')}</td>
                    <td>
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

      {/* PAINEL FLUTUANTE DE AÇÕES (Se houver discos selecionados) */}
      {selecionados.length > 0 && (
        <div className="bulk-actions-panel">
          <div className="bulk-actions-content">
            <div className="bulk-actions-info">
              <span className="badge badge-entrada" style={{ fontSize: '14px' }}>{selecionados.length} selecionados</span>
            </div>
            
            <div className="bulk-actions-tools">
              <div className="bulk-move-group">
                <input 
                  type="number" 
                  placeholder="Nova cx." 
                  value={novaCaixa} 
                  onChange={(e) => setNovaCaixa(e.target.value)}
                  className="bulk-input"
                />
                <button className="btn btn-secondary" onClick={moverSelecionados} disabled={loading}>Mover</button>
              </div>
              
              <button className="btn btn-secondary" onClick={inativarSelecionados} disabled={loading}>Inativar</button>
              
              {confirmarExclusao ? (
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button className="btn btn-danger" onClick={excluirSelecionados} disabled={loading}>Confirmar Exclusão</button>
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
