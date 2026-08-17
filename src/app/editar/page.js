'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { FaEdit, FaTrash } from 'react-icons/fa';
import { TbTools } from "react-icons/tb";

function EditarExcluirContent() {
  const searchParams = useSearchParams();

  // Estado geral
  const [tela, setTela] = useState('busca'); // 'busca' ou 'edicao'
  const [termo, setTermo] = useState('');
  const [resultados, setResultados] = useState([]);
  const [mostrarInativos, setMostrarInativos] = useState(false);
  const [caixas, setCaixas] = useState([]);
  const [mensagem, setMensagem] = useState(null);
  const [confirmarExclusao, setConfirmarExclusao] = useState(null);

  // Estado da edição
  const [discoEditando, setDiscoEditando] = useState(null);
  const [form, setForm] = useState({});
  const [observacoes, setObservacoes] = useState([]);
  const [novaObservacao, setNovaObservacao] = useState('');
  const [loadingObs, setLoadingObs] = useState(false);

  // Carregar disco direto se vier com ?id= na URL
  useEffect(() => {
    const id = searchParams.get('id');
    if (id) {
      carregarDiscoPorId(parseInt(id));
    }
  }, [searchParams]);

  async function carregarCaixas() {
    const { data: caixaData } = await supabase
      .from('caixas_distintas')
      .select('caixa');
    if (caixaData) {
      setCaixas([...new Set(caixaData.map(d => d.caixa))]);
    }
  }

  async function carregarDiscoPorId(id) {
    await carregarCaixas();

    const { data } = await supabase
      .from('discos')
      .select('id, caixa, artista, titulo, preco, quantidade, ativo, observacao')
      .eq('id', id)
      .single();

    if (data) {
      setResultados([data]);
      abrirEdicao(data);
    }
  }

  async function buscar() {
    if (!termo) return;
    await carregarCaixas();

    let query = supabase
      .from('discos')
      .select('id, caixa, artista, titulo, preco, quantidade, ativo, observacao');
      
    const words = termo.trim().split(/\s+/);
    words.forEach(word => {
      query = query.or(`artista.ilike.%${word}%,titulo.ilike.%${word}%`);
    });

    const { data } = await query
      .order('artista')
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
    let str = typeof valor === 'number' ? valor.toFixed(2) : String(valor);
    str = str.replace(/\D/g, '');
    if (!str) return '';
    str = (parseInt(str, 10) / 100).toFixed(2);
    str = str.replace('.', ',');
    str = str.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
    return str;
  }

  function abrirEdicao(disco) {
    setDiscoEditando(disco);
    setForm({
      artista: disco.artista || '',
      titulo: disco.titulo || '',
      caixa: disco.caixa || '',
      preco: formatarMoedaParaEdicao(disco.preco),
      quantidade: disco.quantidade || 0,
      observacao: disco.observacao || '',
    });
    setMensagem(null);
    setTela('edicao');
    carregarObservacoes(disco.id);
  }

  function voltarParaBusca() {
    setDiscoEditando(null);
    setTela('busca');
  }

  function handleChange(e) {
    if (e.target.name === 'preco') {
      let value = e.target.value.replace(/\D/g, '');
      if (!value) {
        setForm({ ...form, preco: '' });
        return;
      }
      value = (parseInt(value, 10) / 100).toFixed(2);
      value = value.replace('.', ',');
      value = value.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
      setForm({ ...form, preco: value });
      return;
    }
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function salvar() {
    if (!form.titulo || !form.titulo.trim()) {
      setMensagem({ tipo: 'error', texto: 'O Título é obrigatório.' });
      return;
    }

    const qtd = parseInt(form.quantidade);
    if (isNaN(qtd) || qtd < 0) {
      setMensagem({ tipo: 'error', texto: 'A quantidade não pode ser negativa.' });
      return;
    }

    if (form.caixa) {
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

    const { error } = await supabase
      .from('discos')
      .update({
        artista: form.artista,
        titulo: form.titulo,
        caixa: form.caixa ? parseInt(form.caixa) : null,
        preco: unmaskedPreco,
        quantidade: parseInt(form.quantidade) || 0,
        observacao: form.observacao || null,
      })
      .eq('id', discoEditando.id);

    if (error) {
      setMensagem({ tipo: 'error', texto: error.message });
      return;
    }

    setMensagem({ tipo: 'success', texto: 'Disco atualizado com sucesso!' });
    // Atualiza o disco na lista de resultados
    setResultados(prev => prev.map(d =>
      d.id === discoEditando.id
        ? { ...d, artista: form.artista, titulo: form.titulo, caixa: form.caixa ? parseInt(form.caixa) : null, preco: unmaskedPreco, quantidade: parseInt(form.quantidade) || 0, observacao: form.observacao || null }
        : d
    ));
  }

  async function excluir(id) {
    const { error } = await supabase.from('discos').delete().eq('id', id);
    if (error) {
      setMensagem({ tipo: 'error', texto: error.message });
      return;
    }
    setMensagem({ tipo: 'success', texto: 'Disco excluído.' });
    setConfirmarExclusao(null);
    setResultados(prev => prev.filter(d => d.id !== id));
  }

  async function toggleAtivo(disco) {
    const novoStatus = !disco.ativo;
    const { error } = await supabase
      .from('discos')
      .update({ ativo: novoStatus })
      .eq('id', disco.id);

    if (error) {
      setMensagem({ tipo: 'error', texto: error.message });
      return;
    }
    setMensagem({ tipo: 'success', texto: novoStatus ? 'Disco reativado!' : 'Disco inativado!' });
    setResultados(prev => prev.map(d =>
      d.id === disco.id ? { ...d, ativo: novoStatus } : d
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
      .insert({ disco_id: discoEditando.id, observacao: novaObservacao.trim() })
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
  if (tela === 'edicao' && discoEditando) {
    return (
      <div>
        <div className="page-header">
          <button className="btn btn-secondary btn-back" onClick={voltarParaBusca}>
            ← Voltar
          </button>
          <TbTools size={28} color="var(--accent)" />
          <h1 className="page-title">Editando Disco</h1>
        </div>

        {mensagem && (
          <div className={`alert alert-${mensagem.tipo}`}>{mensagem.texto}</div>
        )}

        <div className="edit-info">
          <div className="edit-info-item">
            <span className="edit-info-label">Artista</span>
            <span className="edit-info-value">{discoEditando.artista || '—'}</span>
          </div>
          <div className="edit-info-item">
            <span className="edit-info-label">Título</span>
            <span className="edit-info-value">{discoEditando.titulo}</span>
          </div>
          <div className="edit-info-item">
            <span className="edit-info-label">Caixa</span>
            <span className="edit-info-value">{discoEditando.caixa || '—'}</span>
          </div>
          <div className="edit-info-item">
            <span className="edit-info-label">Preço</span>
            <span className="edit-info-value">R$ {Number(discoEditando.preco || 0).toFixed(2)}</span>
          </div>
          <div className="edit-info-item">
            <span className="edit-info-label">Quantidade</span>
            <span className="edit-info-value">{discoEditando.quantidade}</span>
          </div>
          {discoEditando.observacao && (
            <div className="edit-info-item" style={{ gridColumn: '1 / -1' }}>
              <span className="edit-info-label">Observação</span>
              <span className="edit-info-value">{discoEditando.observacao}</span>
            </div>
          )}
          <div className="edit-info-item">
            <span className="edit-info-label">Status</span>
            <span className="edit-info-value">
              <span className={`badge ${discoEditando.ativo !== false ? 'badge-entrada' : 'badge-saida'}`}>
                {discoEditando.ativo !== false ? 'Ativo' : 'Inativo'}
              </span>
            </span>
          </div>
        </div>

        <div className="edit-form-card">
          <h2>Alterar dados</h2>

          <div className="form-row">
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
            <div className="form-group">
              <label>Título *</label>
              <input name="titulo" value={form.titulo} onChange={handleChange} />
            </div>
          </div>

          <div className="form-row">
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
            <div className="form-group">
              <label>Preço (R$)</label>
              <input name="preco" type="text" value={form.preco} onChange={handleChange} />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Quantidade</label>
              <input name="quantidade" type="number" min="0" value={form.quantidade} onChange={handleChange} />
            </div>
            <div className="form-group"></div>
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
                className={`btn ${discoEditando.ativo !== false ? 'btn-secondary' : 'btn-primary'}`}
                onClick={() => toggleAtivo(discoEditando)}
              >
                {discoEditando.ativo !== false ? 'Inativar' : 'Reativar'}
              </button>
              <button className="btn btn-danger" onClick={() => setConfirmarExclusao(discoEditando.id)}>
                Excluir
              </button>
            </div>
          </div>
        </div>

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
                      <td data-label="Data" style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                        {new Date(obs.criado_em).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
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

        {/* Modal de confirmação de exclusão */}
        {confirmarExclusao && (
          <div className="modal-overlay" onClick={() => setConfirmarExclusao(null)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <h3>Confirmar Exclusão</h3>
              <p>
                Tem certeza que deseja excluir{' '}
                <strong>{discoEditando.artista} — {discoEditando.titulo}</strong>?
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
        <h1 className="page-title">Editar ou Excluir Disco</h1>
      </div>

      {mensagem && (
        <div className={`alert alert-${mensagem.tipo}`}>{mensagem.texto}</div>
      )}

      <div className="filters">
        <div className="form-group" style={{ flex: 1 }}>
          <label>Buscar disco por artista ou título</label>
          <input
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite e aperte Enter..."
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
                <th>Caixa</th>
                <th>Artista</th>
                <th>Título</th>
                <th>Preço</th>
                <th>Qtd</th>
                <th>Status</th>
                <th style={{ width: '80px' }}>Ação</th>
              </tr>
            </thead>
            <tbody>
              {resultados
                .filter(d => mostrarInativos || d.ativo !== false)
                .map((d) => (
                <tr key={d.id} style={d.ativo === false ? { opacity: 0.5 } : {}}>
                  <td data-label="Caixa">{d.caixa}</td>
                  <td data-label="Artista">{d.artista}</td>
                  <td data-label="Título">{d.titulo}</td>
                  <td data-label="Preço">R$ {Number(d.preco || 0).toFixed(2)}</td>
                  <td data-label="Qtd">{d.quantidade}</td>
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
