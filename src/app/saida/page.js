'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { MdCurrencyExchange } from "react-icons/md";
import { PiVinylRecord, PiDisc, PiFilmStrip, PiCassetteTape } from "react-icons/pi";
import { useMobileLeaveConfirm } from '@/hooks/useMobileLeaveConfirm';

export default function Saida() {
  useMobileLeaveConfirm();
  const [activeTab, setActiveTab] = useState('discos');
  const [termo, setTermo] = useState('');
  const [filtroCaixa, setFiltroCaixa] = useState('');
  const [filtroLoja, setFiltroLoja] = useState('');
  const [caixas, setCaixas] = useState([]);
  
  // Saída states
  const [resultados, setResultados] = useState([]);
  const [selecionados, setSelecionados] = useState([]);
  const [selecionadosData, setSelecionadosData] = useState([]);
  const [qtdSaida, setQtdSaida] = useState(1);
  const [observacao, setObservacao] = useState('');
  const [mensagem, setMensagem] = useState(null);
  const [loadingPesquisa, setLoadingPesquisa] = useState(false);

  // Fetch caixas on mount
  useEffect(() => {
    async function fetchCaixas() {
      const { data } = await supabase.from('caixas_distintas').select('caixa');
      if (data) {
        setCaixas([...new Set(data.map(d => d.caixa))]);
      }
    }
    fetchCaixas();
  }, []);

  // Pesquisa Otimizada (Auto-fetch)
  useEffect(() => {
    async function buscar() {
      setLoadingPesquisa(true);
      setMensagem(null);
      let query = supabase.from(activeTab).select('*').eq('deletado', false);

      if (activeTab === 'discos' && filtroCaixa) {
        query = query.eq('caixa', parseInt(filtroCaixa));
      }
      if (filtroLoja) {
        query = query.eq('loja', filtroLoja);
      }
      if (termo) {
        const words = termo.trim().split(/\s+/);
        if (activeTab === 'dvds' || activeTab === 'vhs') {
          words.forEach(word => {
            query = query.ilike('titulo', `%${word}%`);
          });
        } else {
          words.forEach(word => {
            query = query.or(`artista.ilike.%${word}%,titulo.ilike.%${word}%`);
          });
        }
      }

      const { data } = await query.limit(50);
      setResultados(data || []);
      setLoadingPesquisa(false);
    }
    
    // Debounce a busca se houver termo, senão busca direto
    const delay = setTimeout(() => {
      buscar();
    }, 300);

    return () => clearTimeout(delay);
  }, [termo, filtroCaixa, filtroLoja, activeTab]);

  function toggleSelecionarTodos() {
    const visibleIds = resultados.map(d => d.id);
    const allVisibleSelected = visibleIds.every(id => selecionados.includes(id));
    
    if (allVisibleSelected && visibleIds.length > 0) {
      // Unselect visible items
      setSelecionados(selecionados.filter(id => !visibleIds.includes(id)));
      setSelecionadosData(selecionadosData.filter(d => !visibleIds.includes(d.id)));
    } else {
      // Select all visible items
      const newIds = visibleIds.filter(id => !selecionados.includes(id));
      setSelecionados([...selecionados, ...newIds]);
      const newItemsData = resultados.filter(d => newIds.includes(d.id));
      setSelecionadosData([...selecionadosData, ...newItemsData]);
    }
  }

  function toggleSelecionar(id) {
    if (selecionados.includes(id)) {
      setSelecionados(selecionados.filter(sid => sid !== id));
      setSelecionadosData(selecionadosData.filter(d => d.id !== id));
    } else {
      setSelecionados([...selecionados, id]);
      const itemData = resultados.find(d => d.id === id) || selecionadosData.find(d => d.id === id);
      if (itemData) {
        setSelecionadosData([...selecionadosData, itemData]);
      }
    }
  }

  function limparSelecao() {
    setSelecionados([]);
    setSelecionadosData([]);
  }

  async function confirmarSaida() {
    if (selecionadosData.length === 0) return;
    setMensagem(null);

    if (!qtdSaida || qtdSaida < 1 || isNaN(qtdSaida)) {
      setMensagem({ tipo: 'error', texto: 'A quantidade deve ser pelo menos 1.' });
      return;
    }

    // Verificar se há estoque suficiente para todos os itens selecionados
    const insufficientStock = selecionadosData.filter(item => qtdSaida > item.quantidade);
    if (insufficientStock.length > 0) {
      setMensagem({ 
        tipo: 'error', 
        texto: `Quantidade maior que o estoque disponível para: ${insufficientStock.map(i => i.titulo).join(', ')}.` 
      });
      return;
    }

    setLoadingPesquisa(true);

    const updates = [];
    const movements = [];

    for (const item of selecionadosData) {
      updates.push(
        supabase
          .from(activeTab)
          .update({ quantidade: item.quantidade - qtdSaida })
          .eq('id', item.id)
      );
      
      const movData = {
        tipo: 'saida',
        quantidade: qtdSaida,
        observacao: observacao || null,
      };
      if (activeTab === 'discos') movData.disco_id = item.id;
      else if (activeTab === 'dvds') movData.dvd_id = item.id;
      else if (activeTab === 'cds') movData.cd_id = item.id;
      else if (activeTab === 'vhs') movData.vhs_id = item.id;
      
      movements.push(movData);
    }

    const updateResults = await Promise.all(updates);
    const errors = updateResults.filter(r => r.error);
    
    if (errors.length > 0) {
      setMensagem({ tipo: 'error', texto: `Erro ao atualizar estoque: ${errors[0].error.message}` });
      setLoadingPesquisa(false);
      return;
    }

    const { error: errMov } = await supabase.from('movimentacoes').insert(movements);
    if (errMov) {
      console.error('Erro ao registrar movimentações:', errMov);
    }

    const tipoNome = activeTab === 'discos' ? 'Disco' : activeTab === 'dvds' ? 'DVD' : activeTab === 'vhs' ? 'VHS' : 'CD';
    setMensagem({ tipo: 'success', texto: `Saída de ${qtdSaida}x ${selecionadosData.length} ${tipoNome}(s) registrada com sucesso!` });
    limparSelecao();
    setQtdSaida(1);
    setObservacao('');
    
    // Update local state results
    setResultados(resultados.map(r => {
      if (selecionados.includes(r.id)) {
        return { ...r, quantidade: r.quantidade - qtdSaida };
      }
      return r;
    }));
    
    setLoadingPesquisa(false);
  }

  const selecionadosChipsBlock = selecionadosData.length > 0 ? (
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
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '150px', overflowY: 'auto' }}>
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
            {(activeTab !== 'dvds' && activeTab !== 'vhs') && d.artista ? `${d.artista} — ` : ''}{d.titulo}
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
  ) : null;

  return (
    <div>
      <div className="page-header">
        <MdCurrencyExchange size={28} color="var(--accent)" />
        <h1 className="page-title">Saída de Discos</h1>
      </div>

      <div className="tabs">
        <button 
          className={`tab-btn ${activeTab === 'discos' ? 'active' : ''}`}
          onClick={() => { setActiveTab('discos'); setTermo(''); setFiltroCaixa(''); setFiltroLoja(''); limparSelecao(); }}
        >
          <PiVinylRecord style={{ marginRight: '6px', verticalAlign: 'middle' }} /> Discos
        </button>
        <button 
          className={`tab-btn ${activeTab === 'dvds' ? 'active' : ''}`}
          onClick={() => { setActiveTab('dvds'); setTermo(''); setFiltroCaixa(''); setFiltroLoja(''); limparSelecao(); }}
        >
          <PiFilmStrip style={{ marginRight: '6px', verticalAlign: 'middle' }} /> DVDs
        </button>
        <button 
          className={`tab-btn ${activeTab === 'cds' ? 'active' : ''}`}
          onClick={() => { setActiveTab('cds'); setTermo(''); setFiltroCaixa(''); setFiltroLoja(''); limparSelecao(); }}
        >
          <PiDisc style={{ marginRight: '6px', verticalAlign: 'middle' }} /> CDs
        </button>
        <button 
          className={`tab-btn ${activeTab === 'vhs' ? 'active' : ''}`}
          onClick={() => { setActiveTab('vhs'); setTermo(''); setFiltroCaixa(''); setFiltroLoja(''); limparSelecao(); }}
        >
          <PiCassetteTape style={{ marginRight: '6px', verticalAlign: 'middle' }} /> VHS
        </button>
      </div>

      {mensagem && (
        <div className={`alert alert-${mensagem.tipo}`}>{mensagem.texto}</div>
      )}

      {/* --- SEÇÃO DE SAÍDA --- */}
      <div className="filters">
        {activeTab === 'discos' && (
          <div className="form-group" style={{ flex: '0 0 160px' }}>
            <label>Caixa</label>
            <select value={filtroCaixa} onChange={(e) => setFiltroCaixa(e.target.value)}>
              <option value="">Todas</option>
              {caixas.map(c => (
                <option key={c} value={c}>Caixa {c}</option>
              ))}
            </select>
          </div>
        )}
        <div className="form-group" style={{ flex: '0 0 160px' }}>
          <label>Loja</label>
          <select value={filtroLoja} onChange={(e) => setFiltroLoja(e.target.value)}>
            <option value="">Todas</option>
            <option value="Loja 1">Loja 1</option>
            <option value="Loja 2">Loja 2</option>
            <option value="Anexo">Anexo</option>
          </select>
        </div>
        <div className="form-group" style={{ flex: 1 }}>
          <label>Buscar por {(activeTab === 'dvds' || activeTab === 'vhs') ? 'título' : 'artista ou título'}</label>
          <input
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            placeholder="Digite para pesquisar..."
          />
        </div>
      </div>

      {loadingPesquisa && <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Pesquisando...</p>}

      <div className="hide-on-mobile">
        {selecionadosChipsBlock}
      </div>

      {resultados.length > 0 && (
        <div className="table-responsive" style={{ maxHeight: '500px', overflowY: 'auto', marginBottom: '24px' }}>
          <table>
            <thead>
              <tr>
                <th style={{ width: '40px', textAlign: 'center' }}>
                  <input 
                    type="checkbox" 
                    checked={resultados.length > 0 && resultados.every(d => selecionados.includes(d.id))}
                    onChange={toggleSelecionarTodos}
                    style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                  />
                </th>
                {activeTab === 'discos' && <th>Caixa</th>}
                {(activeTab !== 'dvds' && activeTab !== 'vhs') && <th>Artista</th>}
                <th>Título</th>
                <th>Loja</th>
                <th>Preço</th>
              </tr>
            </thead>
            <tbody>
              {resultados.map((d) => (
                <tr 
                  key={d.id} 
                  onClick={() => toggleSelecionar(d.id)}
                  style={{ 
                    backgroundColor: selecionados.includes(d.id) ? 'rgba(197, 48, 48, 0.08)' : 'transparent', 
                    cursor: 'pointer'
                  }}
                >
                  <td data-label="Selecionar" style={{ textAlign: 'center' }}>
                    <input 
                      type="checkbox" 
                      checked={selecionados.includes(d.id)}
                      onChange={() => {}} 
                      onClick={(e) => { e.stopPropagation(); toggleSelecionar(d.id); }} 
                      style={{ cursor: 'pointer', width: '18px', height: '18px', margin: 0 }}
                    />
                  </td>
                  {activeTab === 'discos' && <td data-label="Caixa">{d.caixa}</td>}
                  {(activeTab !== 'dvds' && activeTab !== 'vhs') && <td data-label="Artista">{d.artista || '—'}</td>}
                  <td data-label="Título">{d.titulo || '—'}</td>
                  <td data-label="Loja">{d.loja || '—'}</td>
                  <td data-label="Preço">R$ {Number(d.preco || 0).toFixed(2).replace('.', ',')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* --- SELECIONADOS (chips) e FORMULÁRIO DE SAÍDA --- */}
      <div className="hide-on-desktop">
        {selecionadosChipsBlock}
      </div>

      {selecionadosData.length > 0 && (
        <div style={{ marginBottom: '40px', padding: '20px', border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--bg-card)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <div>
              <h3 style={{ margin: '0 0 8px 0' }}>Confirmar Saída</h3>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '14px' }}>
                Você vai dar saída em <strong>{selecionadosData.length}</strong> iten(s).
              </p>
            </div>
          </div>

          <div className="form-row" style={{ maxWidth: '600px' }}>
            <div className="form-group">
              <label>Qtd a retirar (cada)</label>
              <input
                type="number"
                min="1"
                value={qtdSaida}
                onChange={(e) => setQtdSaida(parseInt(e.target.value) || 1)}
              />
            </div>
            <div className="form-group">
              <label>Observação (opcional)</label>
              <input
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                placeholder="ex: venda balcão, troca..."
              />
            </div>
          </div>

          <button className="btn btn-primary" onClick={confirmarSaida}>Confirmar Saída em Lote</button>
        </div>
      )}
    </div>
  );
}
