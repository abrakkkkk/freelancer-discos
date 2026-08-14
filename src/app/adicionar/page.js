'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { IoIosAddCircleOutline } from "react-icons/io";
import { PiVinylRecord, PiDisc, PiFilmStrip } from "react-icons/pi";

export default function AdicionarItem() {
  const [activeTab, setActiveTab] = useState('discos'); // 'discos' | 'dvds' | 'cds'
  const [caixas, setCaixas] = useState([]);
  
  const initialForm = {
    artista: '',
    titulo: '',
    caixa: '',
    loja: '',
    preco: '',
    quantidade: '1',
  };
  const [form, setForm] = useState(initialForm);
  const [mensagem, setMensagem] = useState(null);

  useEffect(() => {
    async function fetchCaixas() {
      const { data } = await supabase
        .from('caixas_distintas')
        .select('caixa');
      if (data) {
        const unicas = [...new Set(data.map(d => d.caixa))];
        setCaixas(unicas);
      }
    }
    fetchCaixas();
  }, []);

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

  async function handleSubmit(e) {
    e.preventDefault();
    setMensagem(null);

    if (!form.titulo.trim()) {
      setMensagem({ tipo: 'error', texto: 'O Título é obrigatório.' });
      return;
    }

    const qtd = parseInt(form.quantidade);
    if (isNaN(qtd) || qtd < 1) {
      setMensagem({ tipo: 'error', texto: 'A quantidade deve ser de pelo menos 1.' });
      return;
    }

    if (activeTab === 'discos' && form.caixa) {
      if (isNaN(Number(form.caixa)) || parseInt(form.caixa) < 0) {
        setMensagem({ tipo: 'error', texto: 'Número da caixa inválido.' });
        return;
      }
    }

    const unmaskedPreco = form.preco ? parseFloat(form.preco.replace(/\./g, '').replace(',', '.')) : 0;
    if (unmaskedPreco < 0) {
      setMensagem({ tipo: 'error', texto: 'O preço não pode ser negativo.' });
      return;
    }
    
    let payload = {
      titulo: form.titulo,
      caixa: (activeTab === 'discos' && form.caixa) ? parseInt(form.caixa) : null,
      loja: form.loja || null,
      preco: unmaskedPreco,
      quantidade: parseInt(form.quantidade) || 1,
    };

    if (activeTab === 'discos' || activeTab === 'cds') {
      payload.artista = form.artista;
    }

    const { data, error } = await supabase
      .from(activeTab)
      .insert(payload)
      .select('id')
      .single();

    if (error) {
      setMensagem({ tipo: 'error', texto: `Erro: ${error.message}` });
      return;
    }

    // Registrar movimentação de entrada (opcional dependendo se a tabela mov_dvds ou mov_cds existir,
    // mas se 'movimentacoes' usa disco_id, talvez seja melhor não inserir movimentação para cds/dvds, ou talvez usar a mesma.
    // Como não foi especificado, e o esquema de bd de DVDs/CDs ainda vai ser criado, vamos pular movimentações para DVDs/CDs 
    // ou inserir genérico se possível. Vamos fazer só para 'discos' por enquanto para não quebrar o banco deles.)
    if (activeTab === 'discos') {
      await supabase.from('movimentacoes').insert({
        disco_id: data.id,
        tipo: 'entrada',
        quantidade: parseInt(form.quantidade) || 1,
        observacao: 'Cadastro inicial',
      });
    }

    const tipoNome = activeTab === 'discos' ? 'Disco' : activeTab === 'dvds' ? 'DVD' : 'CD';
    setMensagem({ tipo: 'success', texto: `"${form.titulo}" adicionado como ${tipoNome}${(activeTab === 'discos' && form.caixa) ? ` na Caixa ${form.caixa}` : ''}.` });
    setForm({ ...initialForm, caixa: form.caixa });
  }

  return (
    <div>
      <div className="page-header">
        <IoIosAddCircleOutline size={28} color="var(--accent)" />
        <h1 className="page-title">Adicionar Item</h1>
      </div>
      
      <div className="tabs">
        <button 
          className={`tab-btn ${activeTab === 'discos' ? 'active' : ''}`}
          onClick={() => { setActiveTab('discos'); setMensagem(null); setForm(initialForm); }}
        >
          <PiVinylRecord style={{ marginRight: '6px', verticalAlign: 'middle' }} /> Discos
        </button>
        <button 
          className={`tab-btn ${activeTab === 'dvds' ? 'active' : ''}`}
          onClick={() => { setActiveTab('dvds'); setMensagem(null); setForm(initialForm); }}
        >
          <PiFilmStrip style={{ marginRight: '6px', verticalAlign: 'middle' }} /> DVDs
        </button>
        <button 
          className={`tab-btn ${activeTab === 'cds' ? 'active' : ''}`}
          onClick={() => { setActiveTab('cds'); setMensagem(null); setForm(initialForm); }}
        >
          <PiDisc style={{ marginRight: '6px', verticalAlign: 'middle' }} /> CDs
        </button>
      </div>

      {mensagem && (
        <div className={`alert alert-${mensagem.tipo}`}>{mensagem.texto}</div>
      )}

      <form onSubmit={handleSubmit} style={{ maxWidth: '600px' }}>
        <div className="form-row">
          {(activeTab === 'discos' || activeTab === 'cds') && (
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ marginBottom: 0 }}>Artista</label>
                <button 
                  type="button" 
                  onClick={() => setForm(prev => ({ ...prev, artista: prev.titulo }))}
                  style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '12px' }}
                  title="Copiar título para o campo artista"
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
          {activeTab === 'discos' && (
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
            <select name="loja" value={form.loja} onChange={handleChange}>
              <option value="">Nenhuma / Sem Loja</option>
              <option value="Loja 1">Loja 1</option>
              <option value="Loja 2">Loja 2</option>
              <option value="Anexo">Anexo</option>
            </select>
          </div>
          <div className="form-group">
            <label>Quantidade</label>
            <input name="quantidade" type="number" min="1" value={form.quantidade} onChange={handleChange} />
          </div>
        </div>

        <div style={{ marginTop: '8px' }}>
          <button type="submit" className="btn btn-primary" style={{ minWidth: '180px', width: '100%', maxWidth: '320px' }}>
            Adicionar {activeTab === 'discos' ? 'Disco' : activeTab === 'dvds' ? 'DVD' : 'CD'}
          </button>
        </div>
      </form>
    </div>
  );
}
