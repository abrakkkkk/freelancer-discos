'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { TbTools } from "react-icons/tb";
import { FaMagnifyingGlass } from "react-icons/fa6";
import { supabase } from '@/lib/supabase';
import { useCaixas } from '@/hooks/useCaixas';
import { itemService } from '@/services/itemService';
import { movimentacaoService } from '@/services/movimentacaoService';
import { useItemForm } from '@/hooks/useItemForm';
import CategoryTabs from '@/components/CategoryTabs';
import AlertMessage from '@/components/AlertMessage';
import { CATEGORY_IDS, STORE_OPTIONS } from '@/constants/config';
import { useUndo } from '@/contexts/UndoContext';
import { useStore } from '@/contexts/StoreContext';
import { formatCaixa, cleanDiscogsString } from '@/utils/stringUtils';

function EditarExcluirContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { caixas } = useCaixas();
  const { activeStore } = useStore();

  const [tipo, setTipo] = useState(searchParams.get('tipo') || CATEGORY_IDS.DISCOS);
  const [tela, setTela] = useState('busca'); 
  const [termo, setTermo] = useState('');
  const [resultados, setResultados] = useState([]);
  const [mostrarInativos, setMostrarInativos] = useState(false);
  const [mensagem, setMensagem] = useState(null);
  const [confirmarExclusao, setConfirmarExclusao] = useState(null);

  const [queryDiscogs, setQueryDiscogs] = useState('');
  const [isSearchingDiscogs, setIsSearchingDiscogs] = useState(false);
  const [discogsResults, setDiscogsResults] = useState([]);
  const [showDiscogsDropdown, setShowDiscogsDropdown] = useState(false);

  const [loadedWithId] = useState(!!searchParams.get('id'));

  const { registerUndo } = useUndo();

  const [itemEditando, setItemEditando] = useState(null);
  const {
    form, setForm, handleChange,
    sugestoesArtista, mostrarSugestoesArtista, setMostrarSugestoesArtista,
    sugestoesTitulo, mostrarSugestoesTitulo, setMostrarSugestoesTitulo,
    selectSuggestion, getUnmaskedPreco
  } = useItemForm({
    artista: '',
    titulo: '',
    ano: '',
    caixa: '',
    preco: '',
    loja: ''
  }, tipo);

  const [observacoes, setObservacoes] = useState([]);
  const [novaObservacao, setNovaObservacao] = useState('');
  const [loadingObs, setLoadingObs] = useState(false);

  const tipoNome = tipo === CATEGORY_IDS.DISCOS ? 'Disco' : tipo === CATEGORY_IDS.DVDS ? 'DVD' : tipo === CATEGORY_IDS.VHS ? 'VHS' : 'CD';
  const temArtista = tipo !== CATEGORY_IDS.DVDS && tipo !== CATEGORY_IDS.VHS;

  useEffect(() => {
    const urlTipo = searchParams.get('tipo');
    if (urlTipo && urlTipo !== tipo) setTipo(urlTipo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    const id = searchParams.get('id');
    if (id) carregarItemPorId(parseInt(id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const carregarItemPorId = async (id) => {
    try {
      const data = await itemService.getItemById(tipo, id);
      if (data) {
        setResultados([data]);
        abrirEdicao(data);
      }
    } catch (err) {
      console.error("Erro ao carregar item:", err);
    }
  };

  const buscar = async () => {
    if (!termo) return;
    try {
      const { data } = await itemService.fetchItems(tipo, { 
        busca: termo, 
        mostrarAtivos: true, 
        mostrarInativos 
      });
      setResultados(data || []);
      setMensagem(null);
      setConfirmarExclusao(null);
    } catch (err) {
      console.error("Erro na busca:", err);
    }
  };

  const formatarMoeda = (valor) => {
    if (valor == null) return '';
    let str = typeof valor === 'number' ? Math.floor(valor).toString() : String(valor);
    str = str.replace(/\D/g, '');
    if (!str) return '';
    return parseInt(str, 10).toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
  };

  const abrirEdicao = (item) => {
    setItemEditando(item);
    setForm({
      artista: item.artista || '',
      titulo: item.titulo || '',
      ano: item.ano || '',
      caixa: item.caixa || '',
      preco: formatarMoeda(item.preco),
      loja: item.loja || '',
    });
    setMensagem(null);
    setTela('edicao');
    carregarObservacoes(item.id);
  };

  const voltarParaBusca = () => {
    if (loadedWithId) {
      router.push('/');
    } else {
      setItemEditando(null);
      setTela('busca');
      setShowDiscogsDropdown(false);
      setDiscogsResults([]);
      setQueryDiscogs('');
    }
  };

  const searchDiscogs = async (e) => {
    if (e) e.preventDefault();
    if (!queryDiscogs.trim()) return;
    setIsSearchingDiscogs(true);
    setDiscogsResults([]);
    setShowDiscogsDropdown(false);
    try {
      const res = await fetch(`/api/discogs?q=${encodeURIComponent(queryDiscogs)}`);
      const data = await res.json();
      if (data.results && data.results.length > 0) {
        setDiscogsResults(data.results);
        setShowDiscogsDropdown(true);
      } else {
        setMensagem({ tipo: 'error', texto: 'Nenhum resultado encontrado no Discogs.' });
      }
    } catch (err) {
      console.error(err);
      setMensagem({ tipo: 'error', texto: 'Erro ao buscar no Discogs.' });
    } finally {
      setIsSearchingDiscogs(false);
    }
  };

  const handleSelectDiscogsResult = (result) => {
    const parts = result.title.split(' - ');
    let artista = '';
    let titulo = cleanDiscogsString(result.title);
    
    if (parts.length > 1) {
      artista = cleanDiscogsString(parts[0]);
      titulo = cleanDiscogsString(parts.slice(1).join(' - '));
    }

    const year = result.year ? String(result.year) : '';

    setForm(prev => ({
      ...prev,
      artista,
      titulo,
      ano: year || prev.ano,
    }));
    
    setShowDiscogsDropdown(false);
    setQueryDiscogs('');
  };
  const salvar = async () => {
    if (!form.titulo?.trim()) return setMensagem({ tipo: 'error', texto: 'O Título é obrigatório.' });
    
    const unmaskedPreco = getUnmaskedPreco();
    if (unmaskedPreco < 0) return setMensagem({ tipo: 'error', texto: 'O preço não pode ser negativo.' });

    const updateData = {
      titulo: form.titulo.trim(),
      preco: unmaskedPreco,
      loja: form.loja || null,
      caixa: form.caixa?.trim() || null,
      ano: form.ano?.trim() || null,
    };
    if (temArtista) updateData.artista = form.artista;

    try {
      const snapshotAntes = JSON.parse(JSON.stringify(itemEditando));
      await itemService.updateItem(tipo, itemEditando.id, updateData);
      const updatedItem = { ...itemEditando, ...updateData };
      setItemEditando(updatedItem);
      setMensagem({ tipo: 'success', texto: `${tipoNome} atualizado com sucesso!` });
      setResultados(prev => prev.map(d => d.id === itemEditando.id ? updatedItem : d));
      registerUndo(tipo, [snapshotAntes], () => {
        carregarItemPorId(itemEditando.id);
        buscar();
      });
    } catch (err) {
      setMensagem({ tipo: 'error', texto: err.message });
    }
  };

  const excluir = async (id) => {
    try {
      const itemParaExcluir = resultados.find(d => d.id === id) || itemEditando;
      const snapshotAntes = JSON.parse(JSON.stringify(itemParaExcluir));
      
      await itemService.deleteItem(tipo, id);
      
      const movData = movimentacaoService.createMovementPayload(tipo, id, 'saida', itemParaExcluir?.quantidade || 1, 'Saída (Excluído via Edição)');
      await movimentacaoService.registerMovement(movData);

      setMensagem({ tipo: 'success', texto: `Saída do ${tipoNome} registrada.` });
      setConfirmarExclusao(null);
      setResultados(prev => prev.filter(d => d.id !== id));
      registerUndo(tipo, [snapshotAntes], () => {
        if (itemEditando && itemEditando.id === id) {
          carregarItemPorId(id);
        }
        buscar();
      });
    } catch (err) {
      setMensagem({ tipo: 'error', texto: err.message });
    }
  };

  const toggleAtivo = async (item) => {
    const novoStatus = !item.ativo;
    try {
      const snapshotAntes = JSON.parse(JSON.stringify(item));
      await itemService.updateItem(tipo, item.id, { ativo: novoStatus });
      const updatedItem = { ...item, ativo: novoStatus };
      setItemEditando(updatedItem);
      setMensagem({ tipo: 'success', texto: novoStatus ? `${tipoNome} reativado!` : `${tipoNome} inativado!` });
      setResultados(prev => prev.map(d => d.id === item.id ? updatedItem : d));
      registerUndo(tipo, [snapshotAntes], () => {
        carregarItemPorId(item.id);
        buscar();
      });
    } catch (err) {
      setMensagem({ tipo: 'error', texto: err.message });
    }
  };


  const getObsField = () => tipo === 'discos' ? 'disco_id' : tipo === 'dvds' ? 'dvd_id' : tipo === 'cds' ? 'cd_id' : 'vhs_id';

  const carregarObservacoes = async (id) => {
    setLoadingObs(true);
    const { data } = await supabase.from('observacoes_disco').select('*').eq(getObsField(), id).order('criado_em', { ascending: false });
    setObservacoes(data || []);
    setLoadingObs(false);
  };

  const adicionarObservacao = async () => {
    if (!novaObservacao.trim()) return;
    try {
      const { data, error } = await supabase.from('observacoes_disco').insert({ [getObsField()]: itemEditando.id, observacao: novaObservacao.trim() }).select().single();
      if (error) throw error;
      setObservacoes([data, ...observacoes]);
      setNovaObservacao('');
    } catch (err) {
      setMensagem({ tipo: 'error', texto: 'Erro ao adicionar observação: ' + err.message });
    }
  };

  const excluirObservacao = async (id) => {
    try {
      await supabase.from('observacoes_disco').delete().eq('id', id);
      setObservacoes(prev => prev.filter(o => o.id !== id));
    } catch (err) {
      setMensagem({ tipo: 'error', texto: 'Erro ao excluir observação: ' + err.message });
    }
  };

    if (tela === 'edicao' && itemEditando) {
    return (
      <div className="pageContainer">
        <div className="topHeader" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary btn-back" style={{ flexShrink: 0 }} onClick={voltarParaBusca}>← Voltar</button>
          <div className="titleGroup" style={{ flex: 1, minWidth: '200px' }}>
            <TbTools size={24} color="var(--accent)" />
            <h1 className="page-title" style={{ textAlign: 'left', margin: 0, fontSize: '20px' }}>Editando {tipoNome}</h1>
          </div>
        </div>

        <AlertMessage message={mensagem} />

        <div className="mainCard">
          {(tipo === CATEGORY_IDS.DISCOS || tipo === CATEGORY_IDS.CDS) && (
            <div className="form-row" style={{ position: 'relative', zIndex: showDiscogsDropdown ? 70 : 1 }}>
              <div className="form-group" style={{ width: '100%', marginBottom: '20px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><FaMagnifyingGlass /> Buscar no Discogs (Catálogo, Matrix, Artista ou Título)</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input 
                    type="text" 
                    value={queryDiscogs} 
                    onChange={(e) => setQueryDiscogs(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); searchDiscogs(); } }}
                    placeholder="Ex: COLP 12225, Tim Maia Racional..."
                    autoComplete="off"
                  />
                  <button 
                    type="button" 
                    onClick={searchDiscogs}
                    className="btn btn-secondary"
                    style={{ whiteSpace: 'nowrap', opacity: isSearchingDiscogs ? 0.7 : 1, cursor: 'pointer' }}
                    disabled={isSearchingDiscogs}
                  >
                    {isSearchingDiscogs ? 'Buscando...' : 'Buscar'}
                  </button>
                </div>
                {showDiscogsDropdown && discogsResults.length > 0 && (
                  <ul className="sugestoes-dropdown" style={{ top: '100%', left: 0, right: 0, maxHeight: '300px', overflowY: 'auto' }}>
                    <li style={{ background: 'var(--bg-card)', padding: '8px', fontSize: '12px', borderBottom: '1px solid var(--border)', textAlign: 'right' }}>
                      <button type="button" onClick={() => setShowDiscogsDropdown(false)} style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>Fechar (X)</button>
                    </li>
                    {discogsResults.map((result) => (
                      <li 
                        key={result.id} 
                        onMouseDown={(e) => { e.preventDefault(); handleSelectDiscogsResult(result); }} 
                        style={{ 
                          padding: '8px', 
                          display: 'flex', 
                          flexDirection: 'column',
                          background: result.isExactMatch ? 'rgba(56, 161, 105, 0.08)' : undefined,
                          borderLeft: result.isExactMatch ? '3px solid #38a169' : undefined
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                          <span style={{ fontWeight: 'bold' }}>{result.title}</span>
                          {result.isExactMatch && (
                            <span style={{ background: '#38a169', color: '#fff', fontSize: '10px', padding: '1px 6px', borderRadius: '4px', fontWeight: 700, whiteSpace: 'nowrap' }}>
                              MATCH EXATO
                            </span>
                          )}
                        </div>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          {result.year && `${result.year} • `}
                          {result.catno && `${result.catno} • `}
                          {result.country && `${result.country} • `}
                          {result.format?.join(', ')}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          <div className="form-row" style={{ position: 'relative', zIndex: (mostrarSugestoesArtista || mostrarSugestoesTitulo) ? 50 : 1 }}>
            {temArtista && (
              <div className="form-group" style={{ position: 'relative', zIndex: mostrarSugestoesArtista ? 60 : 1 }}>
                <label>Artista</label>
                <input 
                  name="artista" 
                  value={form.artista} 
                  onChange={handleChange} 
                  onFocus={() => { if (sugestoesArtista.length > 0) setMostrarSugestoesArtista(true); }}
                  onBlur={() => setTimeout(() => setMostrarSugestoesArtista(false), 200)}
                  autoComplete="off"
                />
                {mostrarSugestoesArtista && (
                  <ul className="sugestoes-dropdown">
                    {sugestoesArtista.map((sug, idx) => (
                      <li key={idx} onMouseDown={(e) => { e.preventDefault(); selectSuggestion(sug, 'artista'); }}>{sug}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            
            <div className="form-group" style={{ position: 'relative', zIndex: mostrarSugestoesTitulo ? 60 : 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ marginBottom: 0 }}>Título *</label>
                {temArtista && (
                  <button 
                    type="button" 
                    onClick={() => setForm(prev => ({ ...prev, titulo: prev.artista }))}
                    style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '12px' }}
                    title="Copiar artista para o campo título"
                  >
                    Usar Artista
                  </button>
                )}
              </div>
              <input 
                name="titulo" 
                value={form.titulo} 
                onChange={handleChange} 
                onFocus={() => { if (sugestoesTitulo.length > 0) setMostrarSugestoesTitulo(true); }}
                onBlur={() => setTimeout(() => setMostrarSugestoesTitulo(false), 200)}
                autoComplete="off"
              />
              {mostrarSugestoesTitulo && (
                <ul className="sugestoes-dropdown">
                  {sugestoesTitulo.map((sug, idx) => (
                    <li key={idx} onMouseDown={(e) => { e.preventDefault(); selectSuggestion(sug, 'titulo'); }}>
                      {(temArtista && sug.artista) ? `${sug.artista} — ${sug.titulo}` : sug.titulo}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>{itemEditando.loja === 'Loja 1' && itemEditando.categoria === 'discos' ? 'Caixa' : 'Localização'}</label>
              <input 
                name="caixa" 
                type="text" 
                list="caixas-list"
                value={form.caixa || ''} 
                onChange={handleChange}
                placeholder={itemEditando.loja === 'Loja 1' && itemEditando.categoria === 'discos' ? "Ex: 15" : "Ex: 15, Estante A..."}
              />
              <datalist id="caixas-list">
                {caixas.map(c => <option key={`${c.caixa}-${c.loja}`} value={c.caixa}>{c.label} {!activeStore && c.loja ? `(${c.loja})` : ''}</option>)}
              </datalist>
            </div>
            <div className="form-group">
              <label>Preço (R$)</label>
              <input name="preco" type="text" value={form.preco} onChange={handleChange} />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Loja *</label>
              <select name="loja" value={form.loja || ''} onChange={handleChange}>
                <option value="">Nenhuma / Sem Loja</option>
                {STORE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Ano</label>
              <input 
                name="ano" 
                type="text" 
                value={form.ano || ''} 
                onChange={handleChange} 
                placeholder="Ex: 1982" 
              />
            </div>
          </div>

          <div className="edit-actions" style={{ marginTop: '24px', display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'space-between', alignItems: 'stretch' }}>
            <div className="edit-actions-right" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', flex: 1, minWidth: '200px' }}>
              <button className={`btn ${itemEditando.ativo !== false ? 'btn-warning' : 'btn-primary'}`} style={{ flex: 1 }} onClick={() => toggleAtivo(itemEditando)}>{itemEditando.ativo !== false ? 'Inativar' : 'Reativar'}</button>
              <button className="btn btn-danger" style={{ flex: 1 }} onClick={() => setConfirmarExclusao(itemEditando.id)}>Excluir</button>
            </div>
            <button className="btn btn-primary" style={{ flex: 1, minWidth: '160px' }} onClick={salvar}>Salvar</button>
          </div>
        </div>

        {/* Observações */}
        <div className="edit-form-card" style={{ marginTop: '24px' }}>
          <h2>Observações do {tipoNome}</h2>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            <input style={{ flex: 1, padding: '10px 14px', border: '1px solid var(--border)', borderRadius: '4px', background: 'var(--bg-card)', color: 'var(--text)' }} placeholder="Digite uma nova observação..." value={novaObservacao} onChange={(e) => setNovaObservacao(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && adicionarObservacao()} />
            <button className="btn btn-primary" onClick={adicionarObservacao} disabled={!novaObservacao.trim()}>Adicionar</button>
          </div>
          {loadingObs ? <p style={{ color: 'var(--text-muted)' }}>Carregando observações...</p> : observacoes.length === 0 ? <p style={{ color: 'var(--text-muted)' }}>Nenhuma observação registrada.</p> : (
            <div className="table-responsive">
              <table>
                <thead><tr><th style={{ width: '180px' }}>Data</th><th>Observação</th><th style={{ width: '40px' }}></th></tr></thead>
                <tbody>
                  {observacoes.map(obs => (
                    <tr key={obs.id}>
                      <td data-label="Data" style={{ color: 'var(--text-muted)', fontSize: '13px', whiteSpace: 'nowrap' }}>{new Date(obs.criado_em.endsWith('Z') ? obs.criado_em : obs.criado_em + 'Z').toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</td>
                      <td data-label="Observação">{obs.observacao}</td>
                      <td data-label="Excluir" style={{ textAlign: 'center' }}><button onClick={() => excluirObservacao(obs.id)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '16px', padding: '10px' }}>✕</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {confirmarExclusao && (
          <div className="modal-overlay" onClick={() => setConfirmarExclusao(null)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <h3>Confirmar Saída</h3>
              <p>Tem certeza que deseja registrar a saída de <strong>{temArtista && itemEditando.artista ? `${itemEditando.artista} — ` : ''}{itemEditando.titulo}</strong>?<br/>Esta ação não pode ser desfeita, exceto com o histórico atual.</p>
              <div className="modal-actions">
                <button className="btn btn-secondary" onClick={() => setConfirmarExclusao(null)}>Cancelar</button>
                <button className="btn btn-danger" onClick={() => { excluir(confirmarExclusao); voltarParaBusca(); }}>Sim, registrar saída</button>
              </div>
            </div>
          </div>
        )}

      </div>
    );
  }

  return (
    <div className="pageContainer">
      <div className="topHeader">
        <div className="titleGroup">
          <TbTools size={28} color="var(--accent)" />
          <h1 className="page-title">Editar ou Excluir</h1>
        </div>
      </div>

      <div className="mainCard">
        <CategoryTabs activeTab={tipo} onTabChange={(t) => { setTipo(t); setResultados([]); setMensagem(null); setItemEditando(null); setTela('busca'); }} />
        <AlertMessage message={mensagem} />

        <div className="filterCard" style={{ marginTop: '24px' }}>
          <div className="filters">
        <div className="form-group" style={{ flex: 1 }}>
          <label>Buscar por {(tipo === CATEGORY_IDS.DVDS || tipo === CATEGORY_IDS.VHS) ? 'título' : 'artista ou título'}</label>
          <input value={termo} onChange={(e) => setTermo(e.target.value)} placeholder="Ex: Beatles..." onKeyDown={(e) => e.key === 'Enter' && buscar()} />
        </div>
          <button type="button" className="btn btn-primary" onClick={buscar}>Buscar</button>
        </div>

        <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <input type="checkbox" id="mostrarInativos" checked={mostrarInativos} onChange={(e) => setMostrarInativos(e.target.checked)} style={{ width: 'auto' }} />
          <label htmlFor="mostrarInativos" style={{ fontSize: '13px' }}>Incluir inativos na busca</label>
        </div>
      </div>

      {resultados.length > 0 && (
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Localização</th>
                {temArtista && <th>Artista</th>}
                <th>Título</th>
                <th>Loja</th>
                <th>Preço</th>
                <th>Status</th>
                <th style={{ width: '80px' }}>Ação</th>
              </tr>
            </thead>
            <tbody>
              {resultados.filter(d => mostrarInativos || d.ativo !== false).map((d) => (
                <tr key={d.id} style={d.ativo === false ? { opacity: 0.5 } : {}}>
                  <td data-label="Local">{formatCaixa(d.caixa, d.loja)}</td>
                  {temArtista && <td data-label="Artista">{d.artista}</td>}
                  <td data-label="Título">{d.titulo}</td>
                  <td data-label="Loja">{d.loja || '—'}</td>
                  <td data-label="Preço">R$ {Number(d.preco || 0).toFixed(2).replace('.', ',')}</td>
                  <td data-label="Status"><span className={`badge ${d.ativo !== false ? 'badge-entrada' : 'badge-saida'}`}>{d.ativo !== false ? 'Ativo' : 'Inativo'}</span></td>
                  <td data-label="Ação"><button className="btn btn-primary" onClick={() => abrirEdicao(d)}>Editar</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}
      </div>

    </div>
  );
}

export default function EditarExcluir() {
  return (
    <Suspense fallback={<p>Carregando...</p>}>
      <EditarExcluirContent />
    </Suspense>
  );
}
