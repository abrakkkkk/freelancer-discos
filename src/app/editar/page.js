'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { TbTools } from "react-icons/tb";
import { useCaixas } from '@/hooks/useCaixas';
import { itemService } from '@/services/itemService';
import { movimentacaoService } from '@/services/movimentacaoService';
import CategoryTabs from '@/components/CategoryTabs';
import AlertMessage from '@/components/AlertMessage';
import { CATEGORY_IDS, STORE_OPTIONS } from '@/constants/config';

function EditarExcluirContent() {
  const searchParams = useSearchParams();
  const { caixas } = useCaixas();

  const [tipo, setTipo] = useState(searchParams.get('tipo') || CATEGORY_IDS.DISCOS);
  const [tela, setTela] = useState('busca'); 
  const [termo, setTermo] = useState('');
  const [resultados, setResultados] = useState([]);
  const [mostrarInativos, setMostrarInativos] = useState(false);
  const [mensagem, setMensagem] = useState(null);
  const [confirmarExclusao, setConfirmarExclusao] = useState(null);

  const [itemEditando, setItemEditando] = useState(null);
  const [form, setForm] = useState({});
  const [observacoes, setObservacoes] = useState([]);
  const [novaObservacao, setNovaObservacao] = useState('');
  const [loadingObs, setLoadingObs] = useState(false);

  const tipoNome = tipo === CATEGORY_IDS.DISCOS ? 'Disco' : tipo === CATEGORY_IDS.DVDS ? 'DVD' : tipo === CATEGORY_IDS.VHS ? 'VHS' : 'CD';
  const temArtista = tipo !== CATEGORY_IDS.DVDS && tipo !== CATEGORY_IDS.VHS;
  const temCaixa = tipo === CATEGORY_IDS.DISCOS;

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
      caixa: item.caixa || '',
      preco: formatarMoeda(item.preco),
      loja: item.loja || '',
    });
    setMensagem(null);
    setTela('edicao');
    carregarObservacoes(item.id);
  };

  const voltarParaBusca = () => {
    setItemEditando(null);
    setTela('busca');
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'preco') {
      setForm({ ...form, preco: formatarMoeda(value) });
      return;
    }
    setForm({ ...form, [name]: value });
  };

  const salvar = async () => {
    if (!form.titulo?.trim()) return setMensagem({ tipo: 'error', texto: 'O Título é obrigatório.' });
    if (temCaixa && form.caixa && (isNaN(Number(form.caixa)) || parseInt(form.caixa) < 0)) return setMensagem({ tipo: 'error', texto: 'Número da caixa inválido.' });
    
    const unmaskedPreco = form.preco ? parseFloat(String(form.preco).replace(/\./g, '').replace(',', '.')) : 0;
    if (unmaskedPreco < 0) return setMensagem({ tipo: 'error', texto: 'O preço não pode ser negativo.' });

    const updateData = {
      titulo: form.titulo.trim(),
      preco: unmaskedPreco,
      loja: form.loja || null,
    };
    if (temArtista) updateData.artista = form.artista;
    if (temCaixa) updateData.caixa = form.caixa ? parseInt(form.caixa) : null;

    try {
      await itemService.updateItem(tipo, itemEditando.id, updateData);
      const updatedItem = { ...itemEditando, ...updateData };
      setItemEditando(updatedItem);
      setMensagem({ tipo: 'success', texto: `${tipoNome} atualizado com sucesso!` });
      setResultados(prev => prev.map(d => d.id === itemEditando.id ? updatedItem : d));
    } catch (err) {
      setMensagem({ tipo: 'error', texto: err.message });
    }
  };

  const excluir = async (id) => {
    try {
      await itemService.deleteItem(tipo, id);
      
      const movData = movimentacaoService.createMovementPayload(tipo, id, 'exclusao', itemEditando?.quantidade || 1, 'Exclusão do catálogo');
      await movimentacaoService.registerMovement(movData);

      setMensagem({ tipo: 'success', texto: `${tipoNome} excluído.` });
      setConfirmarExclusao(null);
      setResultados(prev => prev.filter(d => d.id !== id));
    } catch (err) {
      setMensagem({ tipo: 'error', texto: err.message });
    }
  };

  const toggleAtivo = async (item) => {
    const novoStatus = !item.ativo;
    try {
      await itemService.updateItem(tipo, item.id, { ativo: novoStatus });
      const updatedItem = { ...item, ativo: novoStatus };
      setItemEditando(updatedItem);
      setMensagem({ tipo: 'success', texto: novoStatus ? `${tipoNome} reativado!` : `${tipoNome} inativado!` });
      setResultados(prev => prev.map(d => d.id === item.id ? updatedItem : d));
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
      <div>
        <div className="page-header">
          <button className="btn btn-secondary btn-back" onClick={voltarParaBusca}>← Voltar</button>
          <TbTools size={28} color="var(--accent)" />
          <h1 className="page-title">Editando {tipoNome}</h1>
        </div>

        <AlertMessage message={mensagem} />

        <div className="edit-info">
          {temArtista && <div className="edit-info-item"><span className="edit-info-label">Artista</span><span className="edit-info-value">{itemEditando.artista || '—'}</span></div>}
          <div className="edit-info-item"><span className="edit-info-label">Título</span><span className="edit-info-value">{itemEditando.titulo}</span></div>
          {temCaixa && <div className="edit-info-item"><span className="edit-info-label">Caixa</span><span className="edit-info-value">{itemEditando.caixa || '—'}</span></div>}
          <div className="edit-info-item"><span className="edit-info-label">Preço</span><span className="edit-info-value">R$ {Number(itemEditando.preco || 0).toFixed(2).replace('.', ',')}</span></div>
          <div className="edit-info-item"><span className="edit-info-label">Status</span><span className="edit-info-value"><span className={`badge ${itemEditando.ativo !== false ? 'badge-entrada' : 'badge-saida'}`}>{itemEditando.ativo !== false ? 'Ativo' : 'Inativo'}</span></span></div>
        </div>

        <div className="edit-form-card">
          <h2>Alterar dados</h2>
          <div className="form-row">
            {temArtista && (
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ marginBottom: 0 }}>Artista</label>
                  <button type="button" onClick={() => setForm(prev => ({ ...prev, artista: prev.titulo }))} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '12px' }}>Usar Título</button>
                </div>
                <input name="artista" value={form.artista} onChange={handleChange} />
              </div>
            )}
            <div className="form-group"><label>Título *</label><input name="titulo" value={form.titulo} onChange={handleChange} /></div>
          </div>
          <div className="form-row">
            {temCaixa && (
              <div className="form-group">
                <label>Caixa</label>
                <input name="caixa" type="number" list="caixas-list" value={form.caixa || ''} onChange={handleChange} />
                <datalist id="caixas-list">{caixas.map(c => <option key={c} value={c} />)}</datalist>
              </div>
            )}
            <div className="form-group"><label>Preço (R$)</label><input name="preco" type="text" value={form.preco} onChange={handleChange} /></div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Loja (Opcional)</label>
              <select name="loja" value={form.loja || ''} onChange={handleChange}>
                <option value="">Nenhuma / Sem Loja</option>
                {STORE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </div>
          </div>
          <div className="edit-actions">
            <button className="btn btn-primary" onClick={salvar}>Salvar Alterações</button>
            <div className="edit-actions-right">
              <button className={`btn ${itemEditando.ativo !== false ? 'btn-secondary' : 'btn-primary'}`} onClick={() => toggleAtivo(itemEditando)}>{itemEditando.ativo !== false ? 'Inativar' : 'Reativar'}</button>
              <button className="btn btn-danger" onClick={() => setConfirmarExclusao(itemEditando.id)}>Excluir</button>
            </div>
          </div>
        </div>

        {/* Observações Omitidas por brevidade, mas devem continuar intactas. */}
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
              <h3>Confirmar Exclusão</h3>
              <p>Tem certeza que deseja excluir <strong>{temArtista && itemEditando.artista ? `${itemEditando.artista} — ` : ''}{itemEditando.titulo}</strong>?<br/>Esta ação não pode ser desfeita.</p>
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

  return (
    <div>
      <div className="page-header">
        <TbTools size={28} color="var(--accent)" />
        <h1 className="page-title">Editar ou Excluir</h1>
      </div>

      <CategoryTabs activeTab={tipo} onTabChange={(t) => { setTipo(t); setResultados([]); setMensagem(null); setItemEditando(null); setTela('busca'); }} />
      <AlertMessage message={mensagem} />

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
              {resultados.filter(d => mostrarInativos || d.ativo !== false).map((d) => (
                <tr key={d.id} style={d.ativo === false ? { opacity: 0.5 } : {}}>
                  {temCaixa && <td data-label="Caixa">{d.caixa}</td>}
                  {temArtista && <td data-label="Artista">{d.artista}</td>}
                  <td data-label="Título">{d.titulo}</td>
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
  );
}

export default function EditarExcluir() {
  return (
    <Suspense fallback={<p>Carregando...</p>}>
      <EditarExcluirContent />
    </Suspense>
  );
}
