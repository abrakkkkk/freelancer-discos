'use client';

import { useState, useEffect } from 'react';
import { MdCurrencyExchange } from "react-icons/md";
import { useMobileLeaveConfirm } from '@/hooks/useMobileLeaveConfirm';
import { useCaixas } from '@/hooks/useCaixas';
import { itemService } from '@/services/itemService';
import { movimentacaoService } from '@/services/movimentacaoService';
import { supabase } from '@/lib/supabase';
import CategoryTabs from '@/components/CategoryTabs';
import AlertMessage from '@/components/AlertMessage';
import { CATEGORY_IDS, STORE_OPTIONS } from '@/constants/config';

export default function Saida() {
  useMobileLeaveConfirm();
  
  const [activeTab, setActiveTab] = useState(CATEGORY_IDS.DISCOS);
  const { caixas } = useCaixas();
  
  const [termo, setTermo] = useState('');
  const [filtroCaixa, setFiltroCaixa] = useState('');
  const [filtroLoja, setFiltroLoja] = useState('');
  
  const [resultados, setResultados] = useState([]);
  const [selecionados, setSelecionados] = useState([]);
  const [selecionadosData, setSelecionadosData] = useState([]);
  
  const [qtdSaida, setQtdSaida] = useState(1);
  const [observacao, setObservacao] = useState('');
  const [mensagem, setMensagem] = useState(null);
  const [loadingPesquisa, setLoadingPesquisa] = useState(false);

  useEffect(() => {
    const buscar = async () => {
      setLoadingPesquisa(true);
      setMensagem(null);
      try {
        const { data } = await itemService.fetchItems(activeTab, { 
          busca: termo, 
          filtroCaixa, 
          filtroLoja, 
          mostrarAtivos: true, 
          mostrarInativos: true 
        });
        setResultados(data?.filter(i => i.ativo !== false) || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingPesquisa(false);
      }
    };
    
    const delay = setTimeout(buscar, 300);
    return () => clearTimeout(delay);
  }, [termo, filtroCaixa, filtroLoja, activeTab]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setTermo('');
    setFiltroCaixa('');
    setFiltroLoja('');
    limparSelecao();
  };

  const toggleSelecionarTodos = () => {
    const visibleIds = resultados.map(d => d.id);
    const allVisibleSelected = visibleIds.every(id => selecionados.includes(id));
    
    if (allVisibleSelected && visibleIds.length > 0) {
      setSelecionados(selecionados.filter(id => !visibleIds.includes(id)));
      setSelecionadosData(selecionadosData.filter(d => !visibleIds.includes(d.id)));
    } else {
      const newIds = visibleIds.filter(id => !selecionados.includes(id));
      setSelecionados([...selecionados, ...newIds]);
      const newItemsData = resultados.filter(d => newIds.includes(d.id));
      setSelecionadosData([...selecionadosData, ...newItemsData]);
    }
  };

  const toggleSelecionar = (id) => {
    if (selecionados.includes(id)) {
      setSelecionados(selecionados.filter(sid => sid !== id));
      setSelecionadosData(selecionadosData.filter(d => d.id !== id));
    } else {
      setSelecionados([...selecionados, id]);
      const itemData = resultados.find(d => d.id === id) || selecionadosData.find(d => d.id === id);
      if (itemData) setSelecionadosData([...selecionadosData, itemData]);
    }
  };

  const limparSelecao = () => {
    setSelecionados([]);
    setSelecionadosData([]);
  };

  const confirmarSaida = async () => {
    if (selecionadosData.length === 0) return;
    setMensagem(null);

    if (!qtdSaida || qtdSaida < 1 || isNaN(qtdSaida)) {
      return setMensagem({ tipo: 'error', texto: 'A quantidade deve ser pelo menos 1.' });
    }

    const insufficientStock = selecionadosData.filter(item => qtdSaida > (item.quantidade || 0));
    if (insufficientStock.length > 0) {
      return setMensagem({ tipo: 'error', texto: `Quantidade maior que o estoque disponível para: ${insufficientStock.map(i => i.titulo).join(', ')}.` });
    }

    setLoadingPesquisa(true);
    try {
      const updates = selecionadosData.map(item => 
        supabase.from(activeTab).update({ quantidade: (item.quantidade || 0) - qtdSaida }).eq('id', item.id)
      );
      
      const movements = selecionadosData.map(item => 
        movimentacaoService.createMovementPayload(activeTab, item.id, 'saida', qtdSaida, observacao)
      );

      const updateResults = await Promise.all(updates);
      const errors = updateResults.filter(r => r.error);
      
      if (errors.length > 0) throw new Error(errors[0].error.message);

      await movimentacaoService.registerMovement(movements); // Ensure we pass array to insert directly if we fix the service, wait, registerMovement takes a single obj or array in supabase. Let's use supabase directly here for bulk insert.
      await supabase.from('movimentacoes').insert(movements);

      const tipoNome = activeTab === 'discos' ? 'Disco' : activeTab === 'dvds' ? 'DVD' : activeTab === 'vhs' ? 'VHS' : 'CD';
      setMensagem({ tipo: 'success', texto: `Saída de ${qtdSaida}x ${selecionadosData.length} ${tipoNome}(s) registrada com sucesso!` });
      
      setResultados(resultados.map(r => selecionados.includes(r.id) ? { ...r, quantidade: (r.quantidade || 0) - qtdSaida } : r));
      
      limparSelecao();
      setQtdSaida(1);
      setObservacao('');
    } catch (err) {
      setMensagem({ tipo: 'error', texto: `Erro ao registrar saída: ${err.message}` });
    } finally {
      setLoadingPesquisa(false);
    }
  };

  const selecionadosChipsBlock = selecionadosData.length > 0 ? (
    <div style={{ marginBottom: '16px', padding: '12px 16px', border: '1px solid var(--accent)', borderRadius: '8px', background: 'rgba(197, 48, 48, 0.05)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--accent)' }}>{selecionadosData.length} selecionado(s)</span>
        <button onClick={limparSelecao} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '12px', textDecoration: 'underline' }}>Limpar tudo</button>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '150px', overflowY: 'auto' }}>
        {selecionadosData.map(d => (
          <span key={d.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '999px', fontSize: '12px', background: 'var(--accent)', color: '#fff', fontWeight: 500, lineHeight: 1.4 }}>
            {(activeTab !== CATEGORY_IDS.DVDS && activeTab !== CATEGORY_IDS.VHS) && d.artista ? `${d.artista} — ` : ''}{d.titulo}
            <button onClick={() => toggleSelecionar(d.id)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: '0', fontSize: '14px', lineHeight: 1, fontWeight: 700, opacity: 0.8 }} title="Remover da seleção">×</button>
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

      <CategoryTabs activeTab={activeTab} onTabChange={handleTabChange} />
      <AlertMessage message={mensagem} />

      <div className="filters">
        {activeTab === CATEGORY_IDS.DISCOS && (
          <div className="form-group" style={{ flex: '0 0 160px' }}>
            <label>Caixa</label>
            <select value={filtroCaixa} onChange={(e) => setFiltroCaixa(e.target.value)}>
              <option value="">Todas</option>
              {caixas.map(c => <option key={c} value={c}>Caixa {c}</option>)}
            </select>
          </div>
        )}
        <div className="form-group" style={{ flex: '0 0 160px' }}>
          <label>Loja</label>
          <select value={filtroLoja} onChange={(e) => setFiltroLoja(e.target.value)}>
            <option value="">Todas</option>
            {STORE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
        </div>
        <div className="form-group" style={{ flex: 1 }}>
          <label>Buscar por {(activeTab === CATEGORY_IDS.DVDS || activeTab === CATEGORY_IDS.VHS) ? 'título' : 'artista ou título'}</label>
          <input value={termo} onChange={(e) => setTermo(e.target.value)} placeholder="Digite para pesquisar..." />
        </div>
      </div>

      {loadingPesquisa && <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Pesquisando...</p>}

      <div className="hide-on-mobile">{selecionadosChipsBlock}</div>

      {resultados.length > 0 && (
        <div className="table-responsive" style={{ maxHeight: '500px', overflowY: 'auto', marginBottom: '24px' }}>
          <table>
            <thead>
              <tr>
                <th style={{ width: '40px', textAlign: 'center' }}>
                  <input type="checkbox" checked={resultados.length > 0 && resultados.every(d => selecionados.includes(d.id))} onChange={toggleSelecionarTodos} style={{ cursor: 'pointer', width: '16px', height: '16px' }} />
                </th>
                {activeTab === CATEGORY_IDS.DISCOS && <th>Caixa</th>}
                {(activeTab !== CATEGORY_IDS.DVDS && activeTab !== CATEGORY_IDS.VHS) && <th>Artista</th>}
                <th>Título</th>
                <th>Loja</th>
                <th>Preço</th>
              </tr>
            </thead>
            <tbody>
              {resultados.map((d) => (
                <tr key={d.id} onClick={() => toggleSelecionar(d.id)} style={{ backgroundColor: selecionados.includes(d.id) ? 'rgba(197, 48, 48, 0.08)' : 'transparent', cursor: 'pointer' }}>
                  <td data-label="Selecionar" style={{ textAlign: 'center' }}><input type="checkbox" checked={selecionados.includes(d.id)} onChange={() => {}} onClick={(e) => { e.stopPropagation(); toggleSelecionar(d.id); }} style={{ cursor: 'pointer', width: '18px', height: '18px', margin: 0 }} /></td>
                  {activeTab === CATEGORY_IDS.DISCOS && <td data-label="Caixa">{d.caixa}</td>}
                  {(activeTab !== CATEGORY_IDS.DVDS && activeTab !== CATEGORY_IDS.VHS) && <td data-label="Artista">{d.artista || '—'}</td>}
                  <td data-label="Título">{d.titulo || '—'}</td>
                  <td data-label="Loja">{d.loja || '—'}</td>
                  <td data-label="Preço">R$ {Number(d.preco || 0).toFixed(2).replace('.', ',')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="hide-on-desktop">{selecionadosChipsBlock}</div>

      {selecionadosData.length > 0 && (
        <div style={{ marginBottom: '40px', padding: '20px', border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--bg-card)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <div>
              <h3 style={{ margin: '0 0 8px 0' }}>Confirmar Saída</h3>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '14px' }}>Você vai dar saída em <strong>{selecionadosData.length}</strong> iten(s).</p>
            </div>
          </div>
          <div className="form-row" style={{ maxWidth: '600px' }}>
            <div className="form-group">
              <label>Qtd a retirar (cada)</label>
              <input type="number" min="1" value={qtdSaida} onChange={(e) => setQtdSaida(parseInt(e.target.value) || 1)} />
            </div>
            <div className="form-group">
              <label>Observação (opcional)</label>
              <input value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="ex: venda balcão, troca..." />
            </div>
          </div>
          <button className="btn btn-primary" onClick={confirmarSaida}>Confirmar Saída em Lote</button>
        </div>
      )}
    </div>
  );
}
