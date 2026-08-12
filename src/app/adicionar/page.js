'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { IoIosAddCircleOutline } from "react-icons/io";

export default function AdicionarDisco() {
  const [caixas, setCaixas] = useState([]);
  const [form, setForm] = useState({
    artista: '',
    titulo: '',
    caixa: '',
    preco: '',
    quantidade: '1',
  });
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

    if (!form.titulo) {
      setMensagem({ tipo: 'error', texto: 'Título é obrigatório.' });
      return;
    }

    const unmaskedPreco = form.preco ? parseFloat(form.preco.replace(/\./g, '').replace(',', '.')) : 0;

    const { data, error } = await supabase
      .from('discos')
      .insert({
        artista: form.artista,
        titulo: form.titulo,
        caixa: form.caixa ? parseInt(form.caixa) : null,
        preco: unmaskedPreco,
        quantidade: parseInt(form.quantidade) || 1,
      })
      .select('id')
      .single();

    if (error) {
      setMensagem({ tipo: 'error', texto: `Erro: ${error.message}` });
      return;
    }

    // Registrar movimentação de entrada
    await supabase.from('movimentacoes').insert({
      disco_id: data.id,
      tipo: 'entrada',
      quantidade: parseInt(form.quantidade) || 1,
      observacao: 'Cadastro inicial',
    });

    setMensagem({ tipo: 'success', texto: `"${form.titulo}" adicionado à Caixa ${form.caixa}.` });
    setForm({ artista: '', titulo: '', caixa: form.caixa, preco: '', quantidade: '1' });
  }

  return (
    <div>
      <div className="page-header">
        <IoIosAddCircleOutline size={28} color="var(--accent)" />
        <h1 className="page-title">Adicionar Novo Disco</h1>
      </div>

      {mensagem && (
        <div className={`alert alert-${mensagem.tipo}`}>{mensagem.texto}</div>
      )}

      <form onSubmit={handleSubmit} style={{ maxWidth: '600px' }}>
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

        <div className="form-group">
          <label>Quantidade</label>
          <input name="quantidade" type="number" min="1" value={form.quantidade} onChange={handleChange} />
        </div>

        <button type="submit" className="btn btn-primary">Adicionar</button>
      </form>
    </div>
  );
}
