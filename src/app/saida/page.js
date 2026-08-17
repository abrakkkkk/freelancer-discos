'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { MdCurrencyExchange } from "react-icons/md";
import { PiVinylRecord, PiFilmStrip, PiDisc } from "react-icons/pi";

export default function SaidaDeDiscos() {
  const [activeTab, setActiveTab] = useState('discos');
  const [termo, setTermo] = useState('');
  const [filtroCaixa, setFiltroCaixa] = useState('');
  const [filtroLoja, setFiltroLoja] = useState('');
  const [caixas, setCaixas] = useState([]);
  const [resultados, setResultados] = useState([]);
  const [selecionado, setSelecionado] = useState(null);
  const [qtdSaida, setQtdSaida] = useState(1);
  const [observacao, setObservacao] = useState('');
  const [mensagem, setMensagem] = useState(null);

  useEffect(() => {
    async function fetchCaixas() {
      const { data } = await supabase.from('caixas_distintas').select('caixa');
      if (data) {
        setCaixas([...new Set(data.map(d => d.caixa))]);
      }
    }
    fetchCaixas();
  }, []);

  async function buscar() {
    setMensagem(null);
    let query = supabase.from(activeTab).select('*');

    if (activeTab === 'discos' && filtroCaixa) {
      query = query.eq('caixa', parseInt(filtroCaixa));
    }
    if (filtroLoja) {
      query = query.eq('loja', filtroLoja);
    }
    if (termo) {
      const words = termo.trim().split(/\s+/);
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

    const { data } = await query.limit(50);
    setResultados(data || []);
    setSelecionado(null);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') buscar();
  }

  async function confirmarSaida() {
    if (!selecionado) return;
    setMensagem(null);

    if (qtdSaida > selecionado.quantidade) {
      setMensagem({ tipo: 'error', texto: 'Quantidade maior que o estoque disponível.' });
      return;
    }

    const { error: errUpdate } = await supabase
      .from(activeTab)
      .update({ quantidade: selecionado.quantidade - qtdSaida })
      .eq('id', selecionado.id);

    if (errUpdate) {
      setMensagem({ tipo: 'error', texto: errUpdate.message });
      return;
    }

    const movData = {
      tipo: 'saida',
      quantidade: qtdSaida,
      observacao: observacao || null,
    };
    if (activeTab === 'discos') movData.disco_id = selecionado.id;
    else if (activeTab === 'dvds') movData.dvd_id = selecionado.id;
    else if (activeTab === 'cds') movData.cd_id = selecionado.id;

    await supabase.from('movimentacoes').insert(movData);

    const tipoNome = activeTab === 'discos' ? 'Disco' : activeTab === 'dvds' ? 'DVD' : 'CD';
    setMensagem({ tipo: 'success', texto: `Saída de ${qtdSaida}x ${tipoNome}(s) registrada com sucesso!` });
    setSelecionado(null);
    setQtdSaida(1);
    setObservacao('');
    buscar(); // refresh list
  }

  return (
    <div>
      <div className="page-header">
        <MdCurrencyExchange size={28} color="var(--accent)" />
        <h1 className="page-title">Registrar Saída</h1>
      </div>

      <div className="tabs">
        <button 
          className={`tab-btn ${activeTab === 'discos' ? 'active' : ''}`}
          onClick={() => { setActiveTab('discos'); setResultados([]); setSelecionado(null); setMensagem(null); }}
        >
          <PiVinylRecord style={{ marginRight: '6px', verticalAlign: 'middle' }} /> Discos
        </button>
        <button 
          className={`tab-btn ${activeTab === 'dvds' ? 'active' : ''}`}
          onClick={() => { setActiveTab('dvds'); setResultados([]); setSelecionado(null); setMensagem(null); }}
        >
          <PiFilmStrip style={{ marginRight: '6px', verticalAlign: 'middle' }} /> DVDs
        </button>
        <button 
          className={`tab-btn ${activeTab === 'cds' ? 'active' : ''}`}
          onClick={() => { setActiveTab('cds'); setResultados([]); setSelecionado(null); setMensagem(null); }}
        >
          <PiDisc style={{ marginRight: '6px', verticalAlign: 'middle' }} /> CDs
        </button>
      </div>

      {mensagem && (
        <div className={`alert alert-${mensagem.tipo}`}>{mensagem.texto}</div>
      )}

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
          <label>Buscar por {activeTab === 'dvds' ? 'título' : 'artista ou título'}</label>
          <input
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite e aperte Enter..."
          />
        </div>
        <button type="button" className="btn btn-primary" onClick={buscar}>Buscar</button>
      </div>

      {resultados.length > 0 && (
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                {activeTab === 'discos' && <th>Caixa</th>}
                {activeTab !== 'dvds' && <th>Artista</th>}
                <th>Título</th>
                <th>Loja</th>
                <th>Qtd</th>
                <th>Preço</th>
                <th>Ação</th>
              </tr>
            </thead>
            <tbody>
              {resultados.map((d) => (
                <tr key={d.id}>
                  {activeTab === 'discos' && <td data-label="Caixa">{d.caixa}</td>}
                  {activeTab !== 'dvds' && <td data-label="Artista">{d.artista || '—'}</td>}
                  <td data-label="Título">{d.titulo || '—'}</td>
                  <td data-label="Loja">{d.loja || '—'}</td>
                  <td data-label="Qtd">{d.quantidade}</td>
                  <td data-label="Preço">R$ {Number(d.preco || 0).toFixed(2)}</td>
                  <td data-label="Ação">
                    <button
                      className="btn btn-primary"
                      style={{ fontSize: '12px', padding: '6px 12px' }}
                      onClick={() => { setSelecionado(d); setQtdSaida(1); setObservacao(''); }}
                    >
                      Selecionar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selecionado && (
        <div style={{ marginTop: '24px' }}>
          <div className="summary-box">
            <strong>Selecionado:</strong> {activeTab === 'discos' ? `[Cx ${selecionado.caixa}] ` : ''} 
            {activeTab !== 'dvds' && selecionado.artista ? `${selecionado.artista} — ` : ''}
            {selecionado.titulo}
            <br />
            <strong>Estoque atual:</strong> {selecionado.quantidade} | <strong>Preço unitário:</strong> R$ {Number(selecionado.preco || 0).toFixed(2)}
          </div>

          <div className="form-row" style={{ maxWidth: '500px' }}>
            <div className="form-group">
              <label>Quantidade a retirar</label>
              <input
                type="number"
                min="1"
                max={selecionado.quantidade}
                value={qtdSaida}
                onChange={(e) => setQtdSaida(parseInt(e.target.value) || 1)}
              />
            </div>
            <div className="form-group">
              <label>Observação (opcional)</label>
              <input
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                placeholder="ex: venda balcão, troca, dano"
              />
            </div>
          </div>

          <div className="summary-box">
            <strong>Resumo:</strong> {qtdSaida}x a R$ {Number(selecionado.preco || 0).toFixed(2)} = R$ {(qtdSaida * Number(selecionado.preco || 0)).toFixed(2)} | Estoque após saída: {selecionado.quantidade - qtdSaida}
          </div>

          <button className="btn btn-primary" onClick={confirmarSaida}>Confirmar Saída</button>
        </div>
      )}
    </div>
  );
}
