'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { TbTools } from "react-icons/tb";
import { PiVinylRecord, PiDisc, PiFilmStrip, PiCassetteTape } from "react-icons/pi";

function EditarExcluirContent() {
  const searchParams = useSearchParams();

  // Tipo do item: inicializado pela URL, alterável por abas
  const [tipo, setTipo] = useState(searchParams.get('tipo') || 'discos');
  const tipoNome = tipo === 'discos' ? 'Disco' : tipo === 'dvds' ? 'DVD' : tipo === 'vhs' ? 'VHS' : 'CD';
  const temArtista = tipo !== 'dvds' && tipo !== 'vhs';
  const temCaixa = tipo === 'discos';

  // Sincronizar tipo quando navegar via URL (ex: vindo do catálogo)
  useEffect(() => {
    const urlTipo = searchParams.get('tipo');
    if (urlTipo && urlTipo !== tipo) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTipo(urlTipo);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Estado geral
  const [tela, setTela] = useState('busca'); // 'busca' ou 'edicao'
  const [termo, setTermo] = useState('');
  const [resultados, setResultados] = useState([]);
  const [mostrarInativos, setMostrarInativos] = useState(false);
  const [caixas, setCaixas] = useState([]);
  const [mensagem, setMensagem] = useState(null);
  const [confirmarExclusao, setConfirmarExclusao] = useState(null);

  // Estado da edição
  const [itemEditando, setItemEditando] = useState(null);
  const [form, setForm] = useState({});
  const [observacoes, setObservacoes] = useState([]);
  const [novaObservacao, setNovaObservacao] = useState('');
  const [loadingObs, setLoadingObs] = useState(false);

  async function carregarCaixas() {
    const { data: caixaData } = await supabase
      .from('caixas_distintas')
      .select('caixa');
    if (caixaData) {
      setCaixas([...new Set(caixaData.map(d => d.caixa))]);
    }
  }

  function getColumns() {
    if (tipo === 'dvds' || tipo === 'vhs') return 'id, titulo, preco, ativo, loja, observacao';
    if (tipo === 'cds') return 'id, artista, titulo, preco, ativo, loja, observacao';
    return 'id, caixa, artista, titulo, preco, ativo, loja, observacao';
  }

  async function carregarItemPorId(id) {
    await carregarCaixas();

    const { data } = await supabase
      .from(tipo)
      .select(getColumns())
      .eq('id', id)
      .single();

    if (data) {
      setResultados([data]);
      abrirEdicao(data);
    }
  }

  // Carregar item direto se vier com ?id= na URL
  useEffect(() => {
    const id = searchParams.get('id');
    if (id) {
      carregarItemPorId(parseInt(id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  async function buscar() {
    if (!termo) return;
    await carregarCaixas();

    let query = supabase
      .from(tipo)
      .select(getColumns());

    // Filtrar inativos no servidor quando checkbox desmarcado
    if (!mostrarInativos) {
      query = query.eq('ativo', true);
    }

    const words = termo.trim().split(/\s+/);
    if (temArtista) {
      words.forEach(word => {
        query = query.or(`artista.ilike.%${word}%,titulo.ilike.%${word}%`);
      });
    } else {
      words.forEach(word => {
        query = query.ilike('titulo', `%${word}%`);
      });
    }

    const { data } = await query
      .order(temArtista ? 'artista' : 'titulo')
      .limit(50);

    setResultados(data || []);
    setMensagem(null);
    setConfirmarExclusao(null);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') buscar();
  }

  function formatarMoedaParaEdicao(valor) {
    if (valor === null || valor === undefined) return '';
    let str = typeof valor === 'number' ? Math.floor(valor).toString() : String(valor);
    str = str.replace(/\D/g, '');
    if (!str) return '';
    str = parseInt(str, 10).toString();
    str = str.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
    return str;
  }

  function abrirEdicao(item) {
    setItemEditando(item);
    setForm({
      artista: item.artista || '',
      titulo: item.titulo || '',
      caixa: item.caixa || '',
      preco: formatarMoedaParaEdicao(item.preco),
      loja: item.loja || '',
      observacao: item.observacao || '',
    });
    setMensagem(null);
    setTela('edicao');
    if (tipo === 'discos') {
      carregarObservacoes(item.id);
    } else {
      setObservacoes([]);
    }
  }

  function voltarParaBusca() {
    setItemEditando(null);
    setTela('busca');
  }

  function handleChange(e) {
    const { name, value } = e.target;
    if (name === 'preco') {
      let val = value.replace(/\D/g, '');
      if (!val) {
        setForm({ ...form, preco: '' });
        return;
      }
      val = parseInt(val, 10).toString();
      val = val.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
      setForm({ ...form, preco: val });
      return;
    }
    setForm({ ...form, [name]: value });
  }

  async function salvar() {
    if (!form.titulo || !form.titulo.trim()) {
      setMensagem({ tipo: 'error', texto: 'O Título é obrigatório.' });
      return;
    }

    if (temCaixa && form.caixa) {
      if (isNaN(Number(form.caixa)) || parseInt(form.caixa) < 0) {
        setMensagem({ tipo: 'error', texto: 'Número da caixa inválido.' });
        return;
      }
    }

    const unmaskedPreco = form.preco ? parseFloat(String(form.preco).replace(/\./g, '').replace(',', '.')) : 0;
    if (unmaskedPreco < 0) {
      setMensagem({ tipo: 'error', texto: 'O preço não pode ser negativo.' });
      return;
    }

    const updateData = {
      titulo: form.titulo.trim(),
      preco: unmaskedPreco,
      loja: form.loja || null,
      observacao: form.observacao || null,
    };

    if (temArtista) updateData.artista = form.artista;
    if (temCaixa) updateData.caixa = form.caixa ? parseInt(form.caixa) : null;

    const { error } = await supabase
      .from(tipo)
      .update(updateData)
      .eq('id', itemEditando.id);

    if (error) {
      setMensagem({ tipo: 'error', texto: error.message });
      return;
    }

    const updatedItem = { ...itemEditando, ...updateData };
    setItemEditando(updatedItem);
    setMensagem({ tipo: 'success', texto: `${tipoNome} atualizado com sucesso!` });
    setResultados(prev => prev.map(d =>
      d.id === itemEditando.id ? updatedItem : d
    ));
  }

  async function excluir(id) {
    const { error } = await supabase.from(tipo).delete().eq('id', id);
    if (error) {
      setMensagem({ tipo: 'error', texto: error.message });
      return;
    }
    setMensagem({ tipo: 'success', texto: `${tipoNome} excluído.` });
    setConfirmarExclusao(null);
    setResultados(prev => prev.filter(d => d.id !== id));
  }

  async function toggleAtivo(item) {
    const novoStatus = !item.ativo;
    const { error } = await supabase
      .from(tipo)
      .update({ ativo: novoStatus })
      .eq('id', item.id);

    if (error) {
      setMensagem({ tipo: 'error', texto: error.message });
      return;
    }
    const updatedItem = { ...item, ativo: novoStatus };
    setItemEditando(updatedItem);
    setMensagem({ tipo: 'success', texto: novoStatus ? `${tipoNome} reativado!` : `${tipoNome} inativado!` });
    setResultados(prev => prev.map(d =>
      d.id === item.id ? updatedItem : d
    ));
  }

  async function carregarObservacoes(id) {
    setLoadingObs(true);
    const { data } = await supabase
      .from('observacoes_disco')
      .select('*')
      .eq('disco_id', id)
      .order('criado_em', { ascending: false });
    setObservacoes(data || []);
    setLoadingObs(false);
  }

  async function adicionarObservacao() {
    if (!novaObservacao.trim()) return;
    
    const { data, error } = await supabase
      .from('observacoes_disco')
      .insert({ disco_id: itemEditando.id, observacao: novaObservacao.trim() })
      .select()
      .single();
      
    if (error) {
      setMensagem({ tipo: 'error', texto: 'Erro ao adicionar observação: ' + error.message });
      return;
    }
    
    setObservacoes([data, ...observacoes]);
    setNovaObservacao('');
  }

  async function excluirObservacao(id) {
    const { error } = await supabase
      .from('observacoes_disco')
      .delete()
      .eq('id', id);

    if (error) {
      setMensagem({ tipo: 'error', texto: 'Erro ao excluir observação: ' + error.message });
      return;
    }

    setObservacoes(prev => prev.filter(o => o.id !== id));
  }

  // =============================================
  //  TELA DE EDIÇÃO
  // =============================================
  if (tela === 'edicao' && itemEditando) {
    return (
      <div>
        <div className="page-header">
          <button className="btn btn-secondary btn-back" onClick={voltarParaBusca}>
            ← Voltar
          </button>
          <TbTools size={28} color="var(--accent)" />
          <h1 className="page-title">Editando {tipoNome}</h1>
        </div>

        {mensagem && (
          <div className={`alert alert-${mensagem.tipo}`}>{mensagem.texto}</div>
        )}

        <div className="edit-info">
          {temArtista && (
            <div className="edit-info-item">
              <span className="edit-info-label">Artista</span>
              <span className="edit-info-value">{itemEditando.artista || '—'}</span>
            </div>
          )}
          <div className="edit-info-item">
            <span className="edit-info-label">Título</span>
            <span className="edit-info-value">{itemEditando.titulo}</span>
          </div>
          {temCaixa && (
            <div className="edit-info-item">
              <span className="edit-info-label">Caixa</span>
              <span className="edit-info-value">{itemEditando.caixa || '—'}</span>
            </div>
          )}
          <div className="edit-info-item">
            <span className="edit-info-label">Preço</span>
            <span className="edit-info-value">R$ {Number(itemEditando.preco || 0).toFixed(2).replace('.', ',')}</span>
          </div>
          {itemEditando.observacao && (
            <div className="edit-info-item" style={{ gridColumn: '1 / -1' }}>
              <span className="edit-info-label">Observação</span>
              <span className="edit-info-value">{itemEditando.observacao}</span>
            </div>
          )}
          <div className="edit-info-item">
            <span className="edit-info-label">Status</span>
            <span className="edit-info-value">
              <span className={`badge ${itemEditando.ativo !== false ? 'badge-entrada' : 'badge-saida'}`}>
                {itemEditando.ativo !== false ? 'Ativo' : 'Inativo'}
              </span>
            </span>
          </div>
        </div>

        <div className="edit-form-card">
          <h2>Alterar dados</h2>

          <div className="form-row">
            {temArtista && (
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ marginBottom: 0 }}>Artista</label>
                  <button 
                    type="button" 
                    onClick={() => setForm(prev => ({ ...prev, artista: prev.titulo }))}
                    style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '12px' }}
                    title="Copiar título para o campo artista (para discos self-titled)"
                  >
                    Usar Título
                  </button>
                </div>
                <input name="artista" value={form.artista} onChange={handleChange} />
              </div>
            )}
            <div className="form-group">
              <label>Título *</label>
              <input name="titulo" value={form.titulo} onChange={handleChange} />
            </div>
          </div>

          <div className="form-row">
            {temCaixa && (
              <div className="form-group">
                <label>Caixa</label>
                <input 
                  name="caixa" 
                  type="number" 
                  list="caixas-list"
                  value={form.caixa || ''} 
                  onChange={handleChange}
                  placeholder="Ex: 15"
                />
                <datalist id="caixas-list">
                  {caixas.map(c => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
            )}
            <div className="form-group">
              <label>Preço (R$)</label>
              <input name="preco" type="text" value={form.preco} onChange={handleChange} />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Loja (Opcional)</label>
              <select name="loja" value={form.loja || ''} onChange={handleChange}>
                <option value="">Nenhuma / Sem Loja</option>
                <option value="Loja 1">Loja 1</option>
                <option value="Loja 2">Loja 2</option>
                <option value="Anexo">Anexo</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Observação (Opcional)</label>
            <textarea 
              name="observacao" 
              value={form.observacao} 
              onChange={handleChange} 
              rows="2" 
              style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text)', resize: 'vertical' }}
              placeholder="Qualquer detalhe adicional sobre o item..."
            ></textarea>
          </div>

          <div className="edit-actions">
            <button className="btn btn-primary" onClick={salvar}>Salvar Alterações</button>

            <div className="edit-actions-right">
              <button
                className={`btn ${itemEditando.ativo !== false ? 'btn-secondary' : 'btn-primary'}`}
                onClick={() => toggleAtivo(itemEditando)}
              >
                {itemEditando.ativo !== false ? 'Inativar' : 'Reativar'}
              </button>
              <button className="btn btn-danger" onClick={() => setConfirmarExclusao(itemEditando.id)}>
                Excluir
              </button>
            </div>
          </div>
        </div>

        {/* Observações — apenas para discos */}
        {tipo === 'discos' && (
          <div className="edit-form-card" style={{ marginTop: '24px' }}>
            <h2>Observações do Disco</h2>
            
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <input 
                style={{ flex: 1, padding: '10px 14px', border: '1px solid var(--border)', borderRadius: '4px', background: 'var(--bg-card)', color: 'var(--text)' }}
                placeholder="Digite uma nova observação..." 
                value={novaObservacao} 
                onChange={(e) => setNovaObservacao(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && adicionarObservacao()}
              />
              <button className="btn btn-primary" onClick={adicionarObservacao} disabled={!novaObservacao.trim()}>
                Adicionar
              </button>
            </div>

            {loadingObs ? (
              <p style={{ color: 'var(--text-muted)' }}>Carregando observações...</p>
            ) : observacoes.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>Nenhuma observação registrada para este disco.</p>
            ) : (
              <div className="table-responsive">
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: '180px' }}>Data</th>
                      <th>Observação</th>
                      <th style={{ width: '40px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {observacoes.map(obs => (
                      <tr key={obs.id}>
                        <td data-label="Data" style={{ color: 'var(--text-muted)', fontSize: '13px', whiteSpace: 'nowrap' }}>
                          {new Date(obs.criado_em.endsWith('Z') ? obs.criado_em : obs.criado_em + 'Z').toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
                        </td>
                        <td data-label="Observação">{obs.observacao}</td>
                        <td data-label="Excluir" style={{ textAlign: 'center' }}>
                          <button
                            onClick={() => excluirObservacao(obs.id)}
                            title="Excluir observação"
                            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '16px', padding: '10px' }}
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Modal de confirmação de exclusão */}
        {confirmarExclusao && (
          <div className="modal-overlay" onClick={() => setConfirmarExclusao(null)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <h3>Confirmar Exclusão</h3>
              <p>
                Tem certeza que deseja excluir{' '}
                <strong>{temArtista && itemEditando.artista ? `${itemEditando.artista} — ` : ''}{itemEditando.titulo}</strong>?
                <br />
                Esta ação não pode ser desfeita.
              </p>
              <div className="modal-actions">
                <button className="btn btn-secondary" onClick={() => setConfirmarExclusao(null)}>Cancelar</button>
                <button className="btn btn-danger" onClick={() => { excluir(confirmarExclusao); voltarParaBusca(); }}>Sim, excluir</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // =============================================
  //  TELA DE BUSCA (padrão)
  // =============================================
  return (
    <div>
      <div className="page-header">
        <TbTools size={28} color="var(--accent)" />
        <h1 className="page-title">Editar ou Excluir</h1>
      </div>

      <div className="tabs">
        <button 
          className={`tab-btn ${tipo === 'discos' ? 'active' : ''}`}
          onClick={() => { setTipo('discos'); setResultados([]); setMensagem(null); setItemEditando(null); setTela('busca'); }}
        >
          <PiVinylRecord style={{ marginRight: '6px', verticalAlign: 'middle' }} /> Discos
        </button>
        <button 
          className={`tab-btn ${tipo === 'dvds' ? 'active' : ''}`}
          onClick={() => { setTipo('dvds'); setResultados([]); setMensagem(null); setItemEditando(null); setTela('busca'); }}
        >
          <PiFilmStrip style={{ marginRight: '6px', verticalAlign: 'middle' }} /> DVDs
        </button>
        <button 
          className={`tab-btn ${tipo === 'cds' ? 'active' : ''}`}
          onClick={() => { setTipo('cds'); setResultados([]); setMensagem(null); setItemEditando(null); setTela('busca'); }}
        >
          <PiDisc style={{ marginRight: '6px', verticalAlign: 'middle' }} /> CDs
        </button>
        <button 
          className={`tab-btn ${tipo === 'vhs' ? 'active' : ''}`}
          onClick={() => { setTipo('vhs'); setResultados([]); setMensagem(null); setItemEditando(null); setTela('busca'); }}
        >
          <PiCassetteTape style={{ marginRight: '6px', verticalAlign: 'middle' }} /> VHS
        </button>
      </div>

      {mensagem && (
        <div className={`alert alert-${mensagem.tipo}`}>{mensagem.texto}</div>
      )}

      <div className="filters">
        <div className="form-group" style={{ flex: 1 }}>
          <label>Buscar por {(tipo === 'dvds' || tipo === 'vhs') ? 'título' : 'artista ou título'}</label>
          <input
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            placeholder={(tipo === 'dvds' || tipo === 'vhs') ? "Ex: O Poderoso Chefão, Matrix..." : "Ex: Beatles, Abbey Road..."}
            onKeyDown={(e) => e.key === 'Enter' && buscar()}
          />
        </div>
        <button type="button" className="btn btn-primary" onClick={buscar}>Buscar</button>
      </div>

      <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <input
          type="checkbox"
          id="mostrarInativos"
          checked={mostrarInativos}
          onChange={(e) => setMostrarInativos(e.target.checked)}
          style={{ width: 'auto' }}
        />
        <label htmlFor="mostrarInativos" style={{ fontSize: '13px' }}>Incluir inativos na busca</label>
      </div>

      {resultados.length > 0 && (
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                {temCaixa && <th>Caixa</th>}
                {temArtista && <th>Artista</th>}
                <th>Título</th>
                <th>Preço</th>
                <th>Status</th>
                <th style={{ width: '80px' }}>Ação</th>
              </tr>
            </thead>
            <tbody>
              {resultados
                .filter(d => mostrarInativos || d.ativo !== false)
                .map((d) => (
                <tr key={d.id} style={d.ativo === false ? { opacity: 0.5 } : {}}>
                  {temCaixa && <td data-label="Caixa">{d.caixa}</td>}
                  {temArtista && <td data-label="Artista">{d.artista}</td>}
                  <td data-label="Título">{d.titulo}</td>
                  <td data-label="Preço">R$ {Number(d.preco || 0).toFixed(2).replace('.', ',')}</td>
                  <td data-label="Status">
                    <span className={`badge ${d.ativo !== false ? 'badge-entrada' : 'badge-saida'}`}>
                      {d.ativo !== false ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td data-label="Ação">
                    <button className="btn btn-primary" onClick={() => abrirEdicao(d)}>
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
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
