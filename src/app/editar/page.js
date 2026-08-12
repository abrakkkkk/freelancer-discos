'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { FaEdit, FaTrash } from 'react-icons/fa';
import { TbTools } from "react-icons/tb";

export default function EditarExcluir() {
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
      .select('id, caixa, artista, titulo, preco, quantidade, ativo')
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

    const { data } = await supabase
      .from('discos')
      .select('id, caixa, artista, titulo, preco, quantidade, ativo')
      .or(`artista.ilike.%${termo}%,titulo.ilike.%${termo}%`)
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
    });
    setMensagem(null);
    setTela('edicao');
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
    if (!form.titulo) {
      setMensagem({ tipo: 'error', texto: 'Título é obrigatório.' });
      return;
    }

    const unmaskedPreco = form.preco ? parseFloat(String(form.preco).replace(/\./g, '').replace(',', '.')) : 0;

    const { error } = await supabase
      .from('discos')
      .update({
        artista: form.artista,
        titulo: form.titulo,
        caixa: form.caixa ? parseInt(form.caixa) : null,
        preco: unmaskedPreco,
        quantidade: parseInt(form.quantidade) || 0,
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
        ? { ...d, artista: form.artista, titulo: form.titulo, caixa: form.caixa ? parseInt(form.caixa) : null, preco: unmaskedPreco, quantidade: parseInt(form.quantidade) || 0 }
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
              <label>Artista</label>
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
              <select name="caixa" value={form.caixa} onChange={handleChange}>
                <option value="">Selecione...</option>
                {caixas.map(c => (
                  <option key={c} value={c}>Caixa {c}</option>
                ))}
              </select>
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
                  <td>{d.caixa}</td>
                  <td>{d.artista}</td>
                  <td>{d.titulo}</td>
                  <td>R$ {Number(d.preco || 0).toFixed(2)}</td>
                  <td>{d.quantidade}</td>
                  <td>
                    <span className={`badge ${d.ativo !== false ? 'badge-entrada' : 'badge-saida'}`}>
                      {d.ativo !== false ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td>
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
