'use client';

import { useState, useEffect, useCallback } from 'react';
import { MdLayers } from "react-icons/md";
import { useMobileLeaveConfirm } from '@/hooks/useMobileLeaveConfirm';
import { useCaixas } from '@/hooks/useCaixas';
import { itemService } from '@/services/itemService';
import { movimentacaoService } from '@/services/movimentacaoService';
import { supabase } from '@/lib/supabase';
import CategoryTabs from '@/components/CategoryTabs';
import AlertMessage from '@/components/AlertMessage';
import { CATEGORY_IDS, STORE_OPTIONS, getStoreColor } from '@/constants/config';
import { removeAcentos, formatCaixa } from '@/utils/stringUtils';
import { useUndo } from '@/contexts/UndoContext';
import SuccessModal from '@/components/SuccessModal';
import { useStore } from '@/contexts/StoreContext';

const getLoteStorage = (key, defaultValue) => {
  if (typeof window === 'undefined') return defaultValue;
  try {
    const saved = sessionStorage.getItem(`lote_${key}`);
    return saved !== null ? JSON.parse(saved) : defaultValue;
  } catch (e) {
    return defaultValue;
  }
};

export default function AcoesEmLote() {
  const [activeTab, setActiveTab] = useState(() => getLoteStorage('activeTab', CATEGORY_IDS.DISCOS));
  const { activeStore } = useStore();
  
  const [caixaSelecionada, setCaixaSelecionada] = useState(() => getLoteStorage('caixaSelecionada', ''));
  const [filtroLoja, setFiltroLoja] = useState(activeStore || '');
  const [busca, setBusca] = useState(() => getLoteStorage('busca', ''));
  const [buscaDebounced, setBuscaDebounced] = useState(() => getLoteStorage('busca', ''));

  const { caixas, loading: loadingCaixas } = useCaixas(filtroLoja || activeStore);

  // Sync with global store
  useEffect(() => {
    setFiltroLoja(activeStore || '');
  }, [activeStore]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setBuscaDebounced(busca);
    }, 500);
    return () => clearTimeout(timer);
  }, [busca]);
  
  const [itens, setItens] = useState([]);
  const [selecionados, setSelecionados] = useState(() => getLoteStorage('selecionados', []));
  const [selecionadosData, setSelecionadosData] = useState(() => getLoteStorage('selecionadosData', []));
  const [loading, setLoading] = useState(false);
  const [mensagem, setMensagem] = useState(null);
  
  const [novaLocalizacao, setNovaLocalizacao] = useState(() => getLoteStorage('novaLocalizacao', ''));
  const [lojaDestino, setLojaDestino] = useState(() => getLoteStorage('lojaDestino', ''));
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);
  const [confirmarExclusaoNaoSelecionados, setConfirmarExclusaoNaoSelecionados] = useState(false);
  const [successModalMessage, setSuccessModalMessage] = useState('');

  const { registerUndo } = useUndo();

  // Salva automaticamente o rascunho de alteração em lote no sessionStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('lote_activeTab', JSON.stringify(activeTab));
      sessionStorage.setItem('lote_caixaSelecionada', JSON.stringify(caixaSelecionada));
      sessionStorage.setItem('lote_busca', JSON.stringify(busca));
      sessionStorage.setItem('lote_selecionados', JSON.stringify(selecionados));
      sessionStorage.setItem('lote_selecionadosData', JSON.stringify(selecionadosData));
      sessionStorage.setItem('lote_novaLocalizacao', JSON.stringify(novaLocalizacao));
      sessionStorage.setItem('lote_lojaDestino', JSON.stringify(lojaDestino));
    }
  }, [activeTab, caixaSelecionada, busca, selecionados, selecionadosData, novaLocalizacao, lojaDestino]);

  const carregarItens = useCallback(async () => {
    setLoading(true);
    setMensagem(null);
    
    try {
      let query = supabase.from(activeTab).select('*').eq('deletado', false).order('titulo', { ascending: true });
      if (caixaSelecionada) query = query.eq('caixa', caixaSelecionada);
      if (filtroLoja) query = query.eq('loja', filtroLoja);
      
      if (buscaDebounced) {
        const words = removeAcentos(buscaDebounced).trim().split(/\s+/);
        const isVideo = activeTab === CATEGORY_IDS.DVDS || activeTab === CATEGORY_IDS.VHS;
        words.forEach(word => {
          const wildcardWord = word.replace(/[aeiou]/g, '_');
          if (isVideo) {
            query = query.ilike('titulo', `%${wildcardWord}%`);
          } else {
            query = query.or(`titulo.ilike.%${wildcardWord}%,artista.ilike.%${wildcardWord}%`);
          }
        });
      }

      query = query.limit(10000);
      
      const { data, error } = await query;
      if (error) throw error;

      let itensFiltrados = data || [];

      if (buscaDebounced) {
        const words = removeAcentos(buscaDebounced).trim().split(/\s+/);
        const isVideo = activeTab === CATEGORY_IDS.DVDS || activeTab === CATEGORY_IDS.VHS;
        itensFiltrados = itensFiltrados.filter(item => {
          const itemTitulo = removeAcentos(item.titulo || '');
          const itemArtista = removeAcentos(item.artista || '');
          return words.every(word => {
            if (isVideo) return itemTitulo.includes(word);
            return itemTitulo.includes(word) || itemArtista.includes(word);
          });
        });
      }

      setItens(itensFiltrados);
    } catch (err) {
      console.error(err);
      setMensagem({ tipo: 'error', texto: 'Erro ao carregar itens: ' + err.message });
      setItens([]);
    } finally {
      setLoading(false);
    }
  }, [activeTab, caixaSelecionada, filtroLoja, buscaDebounced]);

  useEffect(() => {
    carregarItens();
  }, [carregarItens]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setMensagem(null);
    setBusca('');
    setCaixaSelecionada('');
    limparSelecao();
  };

  const toggleSelecionarTodos = () => {
    const visibleIds = itens.map(d => d.id);
    const allVisibleSelected = visibleIds.every(id => selecionados.includes(id));
    
    if (allVisibleSelected && visibleIds.length > 0) {
      setSelecionados(selecionados.filter(id => !visibleIds.includes(id)));
      setSelecionadosData(selecionadosData.filter(d => !visibleIds.includes(d.id)));
    } else {
      const newIds = visibleIds.filter(id => !selecionados.includes(id));
      setSelecionados([...selecionados, ...newIds]);
      const newItemsData = itens.filter(d => newIds.includes(d.id));
      setSelecionadosData([...selecionadosData, ...newItemsData]);
    }
  };

  const toggleSelecionar = (id) => {
    if (selecionados.includes(id)) {
      setSelecionados(selecionados.filter(sid => sid !== id));
      setSelecionadosData(selecionadosData.filter(d => d.id !== id));
    } else {
      setSelecionados([...selecionados, id]);
      const itemData = itens.find(d => d.id === id) || selecionadosData.find(d => d.id === id);
      if (itemData) setSelecionadosData([...selecionadosData, itemData]);
    }
  };

  const limparSelecao = () => {
    setSelecionados([]);
    setSelecionadosData([]);
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('lote_selecionados');
      sessionStorage.removeItem('lote_selecionadosData');
    }
  };

  const handleBulkAction = async (actionFn, successMsgBuilder, itensAfetados) => {
    setLoading(true);
    try {
      if (itensAfetados && itensAfetados.length > 0) {
        registerUndo(activeTab, itensAfetados, () => {
          carregarItens();
        });
      }

      await actionFn();
      const msg = successMsgBuilder(itensAfetados ? itensAfetados.length : selecionados.length);
      setMensagem({ tipo: 'success', texto: msg });
      
      if (msg.includes('excluídos') || msg.includes('inativados')) {
        setSuccessModalMessage(msg);
      }
      
      limparSelecao();
      setNovaLocalizacao('');
      setLojaDestino('');
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('lote_novaLocalizacao');
        sessionStorage.removeItem('lote_lojaDestino');
      }
      await carregarItens();
    } catch (err) {
      setMensagem({ tipo: 'error', texto: err.message });
    } finally {
      setLoading(false);
    }
  };

  const aplicarMudancas = () => {
    if (!novaLocalizacao && !lojaDestino) {
      return setMensagem({ tipo: 'error', texto: 'Selecione uma loja ou digite uma localização para aplicar.' });
    }
    
    let updateData = {};
    if (novaLocalizacao) {
      updateData.caixa = novaLocalizacao.trim();
    }
    if (lojaDestino) {
      updateData.loja = lojaDestino;
    }

    handleBulkAction(
      () => itemService.bulkUpdate(activeTab, selecionados, updateData),
      (count) => `${count} item(ns) atualizado(s) com sucesso.`,
      selecionadosData
    ).then(() => {
      setNovaLocalizacao('');
      setLojaDestino('');
    });
  };

  const inativarSelecionados = () => {
    handleBulkAction(
      () => itemService.bulkUpdate(activeTab, selecionados, { ativo: false }),
      (count) => `${count} item(ns) inativados.`,
      selecionadosData
    );
  };

  const excluirSelecionados = async () => {
    handleBulkAction(
      async () => {
        await itemService.bulkUpdate(activeTab, selecionados, { deletado: true });
        const movements = selecionadosData.map(item => movimentacaoService.createMovementPayload(activeTab, item.id, 'exclusao', item.quantidade || 1, 'Exclusão em lote'));
        await supabase.from('movimentacoes').insert(movements);
      },
      (count) => `${count} item(ns) excluídos (ocultados do catálogo).`,
      selecionadosData
    ).then(() => setConfirmarExclusao(false));
  };

  const excluirNaoSelecionados = async () => {
    const naoSelecionados = itens.filter(d => !selecionados.includes(d.id));
    if (naoSelecionados.length === 0) return;
    
    const ids = naoSelecionados.map(i => i.id);
    
    handleBulkAction(
      async () => {
        await itemService.bulkUpdate(activeTab, ids, { deletado: true });
        const movements = naoSelecionados.map(item => movimentacaoService.createMovementPayload(activeTab, item.id, 'exclusao', item.quantidade || 1, 'Exclusão de não selecionados'));
        await supabase.from('movimentacoes').insert(movements);
      },
      (count) => `${count} item(ns) não selecionados excluídos.`,
      naoSelecionados
    ).then(() => setConfirmarExclusaoNaoSelecionados(false));
  };

  const isVideo = activeTab === CATEGORY_IDS.DVDS || activeTab === CATEGORY_IDS.VHS;

  const selecionadosChipsBlock = selecionadosData.length > 0 ? (
    <div style={{ marginBottom: '16px', padding: '12px 16px', border: '1px solid var(--accent)', borderRadius: '8px', background: 'rgba(197, 48, 48, 0.05)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--accent)' }}>{selecionadosData.length} selecionado(s)</span>
        <button onClick={limparSelecao} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '12px', textDecoration: 'underline' }}>Limpar tudo</button>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {selecionadosData.map(d => (
          <span key={d.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '999px', fontSize: '12px', background: 'var(--accent)', color: '#fff', fontWeight: 500, lineHeight: 1.4 }}>
            {!isVideo && d.artista ? `${d.artista} — ` : ''}{d.titulo}
            <button onClick={() => toggleSelecionar(d.id)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: '0', fontSize: '14px', lineHeight: 1, fontWeight: 700, opacity: 0.8 }} title="Remover da seleção">×</button>
          </span>
        ))}
      </div>
    </div>
  ) : null;

  return (
    <div className="pageContainer">
      <div className="topHeader">
        <div className="titleGroup">
          <MdLayers size={28} color="var(--accent)" />
          <h1 className="page-title">Alteração em Lote</h1>
        </div>
      </div>
      
      <div className="mainCard">
        <CategoryTabs activeTab={activeTab} onTabChange={handleTabChange} />

        <div className="filterCard" style={{ marginTop: '24px' }}>
          <div className="filters">
            <div className="form-group" style={{ flex: '1 1 100%' }}>
              <label>Buscar por {isVideo ? 'título' : 'artista ou título'}</label>
              <input type="text" placeholder="Ex: Beatles..." value={busca} onChange={(e) => setBusca(e.target.value)} />
            </div>

            <div className="form-group" style={{ flex: 1 }}>
              <label>Filtrar por Localização</label>
              <select value={caixaSelecionada} onChange={(e) => setCaixaSelecionada(e.target.value)}>
                <option value="">Todas</option>
                {caixas.map(c => <option key={`${c.caixa}-${c.loja}`} value={c.caixa} style={c.loja ? { color: getStoreColor(c.loja), fontWeight: '500' } : {}}>{c.label} {!activeStore && c.loja ? `(${c.loja})` : ''}</option>)}
              </select>
            </div>
            {!activeStore && (
              <div className="form-group" style={{ flex: 1 }}>
                <label>Filtrar por loja</label>
                <select value={filtroLoja} onChange={(e) => setFiltroLoja(e.target.value)}>
                  <option value="">Todas</option>
                  {STORE_OPTIONS.map(opt => <option key={opt.value} value={opt.value} style={{ color: opt.color, fontWeight: '500' }}>{opt.label}</option>)}
                </select>
              </div>
            )}
          </div>
        </div>

        <AlertMessage message={mensagem} />

      <SuccessModal 
        isOpen={!!successModalMessage} 
        message={successModalMessage} 
        onClose={() => setSuccessModalMessage('')} 
      />

      <div className="hide-on-mobile">{selecionadosChipsBlock}</div>

      {loading && !itens.length && <p>Carregando...</p>}
      {!loading && itens.length === 0 && selecionadosData.length === 0 && <div className="empty-state">Nenhum item encontrado.</div>}

      {itens.length > 0 && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
              {busca || caixaSelecionada ? `${itens.filter(d => !selecionados.includes(d.id)).length} resultado(s)` : null}
            </p>
            <button className="btn btn-secondary" onClick={toggleSelecionarTodos} style={{ padding: '6px 12px', fontSize: '13px', minHeight: 'auto' }}>
              {(itens.length > 0 && itens.every(d => selecionados.includes(d.id))) ? 'Desmarcar Todos' : 'Selecionar Todos'}
            </button>
          </div>
          <div className="table-responsive" style={{ marginBottom: '16px' }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: '40px', textAlign: 'center' }}>
                    <input type="checkbox" checked={itens.length > 0 && itens.every(d => selecionados.includes(d.id))} onChange={toggleSelecionarTodos} style={{ cursor: 'pointer', width: '16px', height: '16px' }} />
                  </th>
                  <th>Localização</th>
                  {!isVideo && <th>Artista</th>}
                  <th>Título</th>
                  {!activeStore && <th>Loja</th>}
                  <th>Preço</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {itens.map((d) => (
                  <tr key={d.id} onClick={() => toggleSelecionar(d.id)} style={{ backgroundColor: selecionados.includes(d.id) ? 'rgba(197, 48, 48, 0.08)' : 'transparent', opacity: d.ativo === false ? 0.6 : 1, cursor: 'pointer' }}>
                    <td data-label="Selecionar" style={{ textAlign: 'center' }}><input type="checkbox" checked={selecionados.includes(d.id)} onChange={() => {}} onClick={(e) => { e.stopPropagation(); toggleSelecionar(d.id); }} style={{ cursor: 'pointer', width: '18px', height: '18px', margin: 0 }} /></td>
                    <td data-label="Local">{formatCaixa(d.caixa, d.loja)}</td>
                    {!isVideo && <td data-label="Artista" className={!d.artista ? "empty-artist" : ""}>{d.artista}</td>}
                    <td data-label="Título">{d.titulo}</td>
                    {!activeStore && <td data-label="Loja">{d.loja ? <span style={{ fontWeight: 600, color: getStoreColor(d.loja) }}>{d.loja}</span> : <span className="text-empty">—</span>}</td>}
                    <td data-label="Preço">R$ {Number(d.preco || 0).toFixed(2).replace('.', ',')}</td>
                    <td data-label="Status"><span className={`badge ${d.ativo !== false ? 'badge-entrada' : 'badge-saida'}`}>{d.ativo !== false ? 'Ativo' : 'Inativo'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="hide-on-desktop">{selecionadosChipsBlock}</div>
          <div style={{ height: '120px' }}></div>
        </>
      )}

      {selecionados.length > 0 && (
        <div className="bulk-actions-panel" style={{ boxShadow: '0 -4px 20px rgba(0,0,0,0.4)', border: '1px solid var(--border)', borderTopColor: 'var(--accent)', borderTopWidth: '3px' }}>
          <div className="bulk-actions-content" style={{ flexWrap: 'nowrap', gap: '20px' }}>
            <div className="bulk-actions-info" style={{ display: 'flex', alignItems: 'center', gap: '12px', whiteSpace: 'nowrap' }}>
              <button onClick={limparSelecao} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text)', cursor: 'pointer', transition: 'background 0.2s' }} title="Cancelar seleção" onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'} onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}>✕</button>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '15px', fontWeight: 'bold', color: '#fff' }}>{selecionados.length} selecionados</span>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Ações em lote</span>
              </div>
              <div className="hide-on-desktop" style={{ marginLeft: 'auto', gap: '6px' }}>
                <button className="btn btn-secondary" style={{ background: 'rgba(255,255,255,0.05)', whiteSpace: 'nowrap', fontSize: '13px', padding: '6px 12px', minHeight: 'auto' }} onClick={inativarSelecionados} disabled={loading}>Inativar</button>
                {confirmarExclusao ? (
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    <button className="btn btn-danger" style={{ whiteSpace: 'nowrap', fontSize: '13px', padding: '6px 12px', minHeight: 'auto' }} onClick={excluirSelecionados} disabled={loading}>OK</button>
                    <button className="btn btn-secondary" style={{ whiteSpace: 'nowrap', fontSize: '13px', padding: '6px 12px', minHeight: 'auto' }} onClick={() => setConfirmarExclusao(false)}>✕</button>
                  </div>
                ) : (
                  <button className="btn btn-danger" style={{ background: 'transparent', border: '1px solid var(--danger)', color: 'var(--danger)', whiteSpace: 'nowrap', fontSize: '13px', padding: '6px 12px', minHeight: 'auto' }} onClick={() => setConfirmarExclusao(true)} disabled={loading}>Excluir</button>
                )}
              </div>
            </div>
            <div className="bulk-actions-tools" style={{ flexWrap: 'wrap', paddingBottom: '4px', gap: '12px' }}>
              <div className="bulk-move-group" style={{ borderColor: 'var(--accent)', background: 'rgba(255,255,255,0.03)', flexWrap: 'nowrap' }}>
                <input type="text" placeholder="Localização" value={novaLocalizacao} onChange={(e) => setNovaLocalizacao(e.target.value)} className="bulk-input" style={{ width: '110px', color: '#fff' }} list="caixas-list-lote" />
                <datalist id="caixas-list-lote">
                  {caixas.map(c => <option key={`${c.caixa}-${c.loja}`} value={c.caixa}>{c.label} {!activeStore && c.loja ? `(${c.loja})` : ''}</option>)}
                </datalist>
                <select className="bulk-input" style={{ width: '120px', color: '#fff', borderLeft: '1px solid rgba(255,255,255,0.1)' }} value={lojaDestino} onChange={(e) => setLojaDestino(e.target.value)}>
                  <option value="" style={{ color: '#000' }}>Loja...</option>
                  {STORE_OPTIONS.map(opt => <option key={opt.value} value={opt.value} style={{ color: opt.color, fontWeight: '500' }}>{opt.label}</option>)}
                </select>
                <button className="btn btn-primary" style={{ borderLeft: '1px solid var(--accent)', padding: '0 16px' }} onClick={aplicarMudancas} disabled={loading}>Aplicar</button>
              </div>
              <div className="hide-on-mobile" style={{ width: '1px', height: '32px', background: 'var(--border)', margin: '0 4px' }}></div>
              <button className="btn btn-secondary hide-on-mobile" style={{ background: 'rgba(255,255,255,0.05)', whiteSpace: 'nowrap' }} onClick={inativarSelecionados} disabled={loading}>Inativar</button>
              {confirmarExclusao ? (
                <div className="hide-on-mobile" style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                  <button className="btn btn-danger" style={{ whiteSpace: 'nowrap' }} onClick={excluirSelecionados} disabled={loading}>Confirmar</button>
                  <button className="btn btn-secondary" style={{ whiteSpace: 'nowrap', padding: '6px 12px' }} onClick={() => setConfirmarExclusao(false)}>Cancelar</button>
                </div>
              ) : (
                <button className="btn btn-danger hide-on-mobile" style={{ background: 'transparent', border: '1px solid var(--danger)', color: 'var(--danger)', whiteSpace: 'nowrap' }} onClick={() => setConfirmarExclusao(true)} disabled={loading}>Excluir</button>
              )}

              {caixaSelecionada && (
                <>
                  <div className="hide-on-mobile" style={{ width: '1px', height: '32px', background: 'var(--border)', margin: '0 4px' }}></div>
                  {confirmarExclusaoNaoSelecionados ? (
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                      <button className="btn btn-danger" style={{ whiteSpace: 'nowrap' }} onClick={excluirNaoSelecionados} disabled={loading}>Confirmar</button>
                      <button className="btn btn-secondary" style={{ whiteSpace: 'nowrap', padding: '6px 12px' }} onClick={() => setConfirmarExclusaoNaoSelecionados(false)}>Cancelar</button>
                    </div>
                  ) : (
                    <button className="btn btn-danger" style={{ background: 'var(--danger)', color: '#fff', whiteSpace: 'nowrap' }} onClick={() => setConfirmarExclusaoNaoSelecionados(true)} disabled={loading}>
                      Apagar não marcados
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
        )}

      </div>
    </div>
  );
}
