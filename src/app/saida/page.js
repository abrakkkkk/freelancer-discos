'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { MdCurrencyExchange, MdHistory } from "react-icons/md";
import { PiVinylRecord, PiFilmStrip, PiDisc } from "react-icons/pi";

export default function SaidaEHistorico() {
  const [activeTab, setActiveTab] = useState('discos');
  const [termo, setTermo] = useState('');
  const [filtroCaixa, setFiltroCaixa] = useState('');
  const [filtroLoja, setFiltroLoja] = useState('');
  const [caixas, setCaixas] = useState([]);
  
  // Saída states
  const [resultados, setResultados] = useState([]);
  const [selecionado, setSelecionado] = useState(null);
  const [qtdSaida, setQtdSaida] = useState(1);
  const [observacao, setObservacao] = useState('');
  const [mensagem, setMensagem] = useState(null);
  const [loadingPesquisa, setLoadingPesquisa] = useState(false);

  // Histórico states
  const [movimentacoes, setMovimentacoes] = useState([]);
  const [filtroTipoMov, setFiltroTipoMov] = useState('');
  const [loadingHist, setLoadingHist] = useState(true);

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

  // Fetch histórico
  async function fetchMovimentacoes() {
    setLoadingHist(true);
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
      .limit(100);

    if (filtroTipoMov) {
      query = query.eq('tipo', filtroTipoMov);
    }

    const { data, error } = await query;
    if (error) {
      console.error("Erro ao buscar histórico:", error);
      setMovimentacoes([]);
    } else {
      setMovimentacoes(data || []);
    }
    setLoadingHist(false);
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchMovimentacoes();
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroTipoMov]);

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
      setLoadingPesquisa(false);
    }
    
    // Debounce a busca se houver termo, senão busca direto
    const delay = setTimeout(() => {
      buscar();
    }, 300);

    return () => clearTimeout(delay);
  }, [termo, filtroCaixa, filtroLoja, activeTab]);

  async function confirmarSaida() {
    if (!selecionado) return;
    setMensagem(null);

    if (!qtdSaida || qtdSaida < 1 || isNaN(qtdSaida)) {
      setMensagem({ tipo: 'error', texto: 'A quantidade deve ser pelo menos 1.' });
      return;
    }

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

    const { error: errMov } = await supabase.from('movimentacoes').insert(movData);
    if (errMov) {
      console.error('Erro ao registrar movimentação:', errMov);
    }

    const tipoNome = activeTab === 'discos' ? 'Disco' : activeTab === 'dvds' ? 'DVD' : 'CD';
    setMensagem({ tipo: 'success', texto: `Saída de ${qtdSaida}x ${tipoNome}(s) registrada com sucesso!` });
    setSelecionado(null);
    setQtdSaida(1);
    setObservacao('');
    
    // Refresh history
    fetchMovimentacoes();
    
    // Opcional: Atualizar lista chamando um refetch, mas o react já re-renderiza pelo setResultados
    setResultados(resultados.map(r => r.id === selecionado.id ? { ...r, quantidade: r.quantidade - qtdSaida } : r));
  }

  return (
    <div>
      <div className="page-header">
        <MdCurrencyExchange size={28} color="var(--accent)" />
        <h1 className="page-title">Saída e Histórico</h1>
      </div>

      <div className="tabs">
        <button 
          className={`tab-btn ${activeTab === 'discos' ? 'active' : ''}`}
          onClick={() => { setActiveTab('discos'); setTermo(''); setFiltroCaixa(''); setFiltroLoja(''); }}
        >
          <PiVinylRecord style={{ marginRight: '6px', verticalAlign: 'middle' }} /> Discos
        </button>
        <button 
          className={`tab-btn ${activeTab === 'dvds' ? 'active' : ''}`}
          onClick={() => { setActiveTab('dvds'); setTermo(''); setFiltroCaixa(''); setFiltroLoja(''); }}
        >
          <PiFilmStrip style={{ marginRight: '6px', verticalAlign: 'middle' }} /> DVDs
        </button>
        <button 
          className={`tab-btn ${activeTab === 'cds' ? 'active' : ''}`}
          onClick={() => { setActiveTab('cds'); setTermo(''); setFiltroCaixa(''); setFiltroLoja(''); }}
        >
          <PiDisc style={{ marginRight: '6px', verticalAlign: 'middle' }} /> CDs
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
          <label>Buscar por {activeTab === 'dvds' ? 'título' : 'artista ou título'}</label>
          <input
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            placeholder="Digite para pesquisar..."
          />
        </div>
      </div>

      {loadingPesquisa && <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Pesquisando...</p>}

      {resultados.length > 0 && !selecionado && (
        <div className="table-responsive" style={{ maxHeight: '300px', overflowY: 'auto', marginBottom: '24px' }}>
          <table>
            <thead>
              <tr>
                {activeTab === 'discos' && <th>Caixa</th>}
                {activeTab !== 'dvds' && <th>Artista</th>}
                <th>Título</th>
                <th>Loja</th>
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
                  <td data-label="Preço">R$ {Number(d.preco || 0).toFixed(2).replace('.', ',')}</td>
                  <td data-label="Ação">
                    <button
                      className="btn btn-primary"
                      style={{ fontSize: '12px', padding: '6px 12px' }}
                      onClick={() => { setSelecionado(d); setQtdSaida(1); setObservacao(''); setMensagem(null); }}
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
        <div style={{ marginBottom: '40px', padding: '20px', border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--bg-card)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <div>
              <h3 style={{ margin: '0 0 8px 0' }}>Confirmar Saída</h3>
              <p style={{ margin: 0, color: 'var(--text-muted)' }}>
                {activeTab === 'discos' ? `[Cx ${selecionado.caixa}] ` : ''} 
                {activeTab !== 'dvds' && selecionado.artista ? `${selecionado.artista} — ` : ''}
                {selecionado.titulo}
              </p>
              <p style={{ margin: '4px 0 0 0', fontSize: '13px' }}>
                Estoque atual: <strong>{selecionado.quantidade}</strong> | Preço: <strong>R$ {Number(selecionado.preco || 0).toFixed(2).replace('.', ',')}</strong>
              </p>
            </div>
            <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '12px' }} onClick={() => setSelecionado(null)}>Cancelar</button>
          </div>

          <div className="form-row" style={{ maxWidth: '600px' }}>
            <div className="form-group" style={{ flex: '0 0 150px' }}>
              <label>Qtd a retirar</label>
              <input
                type="number"
                min="1"
                max={selecionado.quantidade}
                value={qtdSaida}
                onChange={(e) => setQtdSaida(parseInt(e.target.value) || 1)}
              />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Observação (opcional)</label>
              <input
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                placeholder="ex: venda balcão, troca..."
              />
            </div>
          </div>

          <button className="btn btn-primary" onClick={confirmarSaida}>Confirmar Saída</button>
        </div>
      )}


      <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '40px 0' }} />


      {/* --- SEÇÃO DE HISTÓRICO --- */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <MdHistory size={24} color="var(--accent)" />
          <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Últimas Movimentações</h2>
        </div>
        
        <div className="form-group" style={{ marginBottom: 0, flex: 'none' }}>
          <select 
            value={filtroTipoMov} 
            onChange={(e) => setFiltroTipoMov(e.target.value)}
            style={{ width: '150px' }}
          >
            <option value="">Todas</option>
            <option value="entrada">Entradas</option>
            <option value="saida">Saídas</option>
          </select>
        </div>
      </div>

      {loadingHist ? (
        <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Carregando histórico...</p>
      ) : movimentacoes.length === 0 ? (
        <div className="empty-state" style={{ padding: '30px' }}>Nenhuma movimentação encontrada.</div>
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
                <td data-label="Data" style={{ fontSize: '13px', whiteSpace: 'nowrap' }}>{new Date(m.criado_em.endsWith('Z') ? m.criado_em : m.criado_em + 'Z').toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</td>
                <td data-label="Tipo">
                  <span className={`badge badge-${m.tipo}`}>
                    {m.tipo === 'entrada' ? '↓ Entrada' : '↑ Saída'}
                  </span>
                </td>
                <td data-label="Caixa">{m.discos?.caixa || '—'}</td>
                <td data-label="Artista">{m.discos?.artista || m.cds?.artista || '—'}</td>
                <td data-label="Título">{m.discos?.titulo || m.dvds?.titulo || m.cds?.titulo || '—'}</td>
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
