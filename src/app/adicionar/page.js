'use client';

import { useState, useEffect, useRef } from 'react';
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
    observacao: '',
  };
  const [form, setForm] = useState(initialForm);
  const [mensagem, setMensagem] = useState(null);

  const [sugestoesArtista, setSugestoesArtista] = useState([]);
  const [mostrarSugestoesArtista, setMostrarSugestoesArtista] = useState(false);
  const [sugestoesTitulo, setSugestoesTitulo] = useState([]);
  const [mostrarSugestoesTitulo, setMostrarSugestoesTitulo] = useState(false);
  const timerBuscaRef = useRef(null);
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

    if (name === 'artista') {
      if (timerBuscaRef.current) clearTimeout(timerBuscaRef.current);
      timerBuscaRef.current = setTimeout(() => buscarSugestoes('artista', value), 300);
    } else if (name === 'titulo') {
      if (timerBuscaRef.current) clearTimeout(timerBuscaRef.current);
      timerBuscaRef.current = setTimeout(() => buscarSugestoes('titulo', value), 300);
    }
  }

  async function buscarSugestoes(campo, valor) {
    if (!valor || valor.trim().length < 2) {
      if (campo === 'artista') setSugestoesArtista([]);
      if (campo === 'titulo') setSugestoesTitulo([]);
      return;
    }

    const { data, error } = await supabase
      .from(activeTab)
      .select(campo)
      .ilike(campo, `%${valor.trim()}%`)
      .limit(20);

    if (error) {
      console.error("Erro na busca de sugestões:", error);
      return;
    }

    if (data) {
      const unicas = [...new Set(data.map(d => d[campo]).filter(Boolean))];
      if (campo === 'artista') {
        setSugestoesArtista(unicas);
        setMostrarSugestoesArtista(unicas.length > 0);
      } else {
        setSugestoesTitulo(unicas);
        setMostrarSugestoesTitulo(unicas.length > 0);
      }
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setMensagem(null);

    if (!form.titulo.trim()) {
      setMensagem({ tipo: 'error', texto: 'O Título é obrigatório.' });
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
      loja: form.loja || null,
      preco: unmaskedPreco,
      quantidade: 1,
      observacao: form.observacao || null,
    };

    if (activeTab === 'discos') {
      payload.caixa = form.caixa ? parseInt(form.caixa) : null;
    }

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

    const movData = {
      tipo: 'entrada',
      quantidade: 1,
      observacao: 'Cadastro inicial',
    };

    if (activeTab === 'discos') {
      movData.disco_id = data.id;
    } else if (activeTab === 'dvds') {
      movData.dvd_id = data.id;
    } else if (activeTab === 'cds') {
      movData.cd_id = data.id;
    }

    const { error: errMov } = await supabase.from('movimentacoes').insert(movData);
    if (errMov) {
      console.error('Erro ao registrar movimentação:', errMov);
    }

    const tipoNome = activeTab === 'discos' ? 'Disco' : activeTab === 'dvds' ? 'DVD' : 'CD';
    setMensagem({ tipo: 'success', texto: `"${form.titulo}" adicionado como ${tipoNome}${(activeTab === 'discos' && form.caixa) ? ` na Caixa ${form.caixa}` : ''}.` });
    setForm({ ...initialForm, caixa: form.caixa, loja: form.loja });
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
          onClick={() => { setActiveTab('discos'); setMensagem(null); setForm(initialForm); setSugestoesArtista([]); setSugestoesTitulo([]); }}
        >
          <PiVinylRecord style={{ marginRight: '6px', verticalAlign: 'middle' }} /> Discos
        </button>
        <button 
          className={`tab-btn ${activeTab === 'dvds' ? 'active' : ''}`}
          onClick={() => { setActiveTab('dvds'); setMensagem(null); setForm(initialForm); setSugestoesArtista([]); setSugestoesTitulo([]); }}
        >
          <PiFilmStrip style={{ marginRight: '6px', verticalAlign: 'middle' }} /> DVDs
        </button>
        <button 
          className={`tab-btn ${activeTab === 'cds' ? 'active' : ''}`}
          onClick={() => { setActiveTab('cds'); setMensagem(null); setForm(initialForm); setSugestoesArtista([]); setSugestoesTitulo([]); }}
        >
          <PiDisc style={{ marginRight: '6px', verticalAlign: 'middle' }} /> CDs
        </button>
      </div>

      {mensagem && (
        <div className={`alert alert-${mensagem.tipo}`}>{mensagem.texto}</div>
      )}

      <form onSubmit={handleSubmit} style={{ maxWidth: '600px' }}>
        <div className="form-row" style={{ position: 'relative', zIndex: (mostrarSugestoesArtista || mostrarSugestoesTitulo) ? 50 : 1 }}>
          {(activeTab === 'discos' || activeTab === 'cds') && (
            <div className="form-group" style={{ position: 'relative', zIndex: mostrarSugestoesArtista ? 60 : 1 }}>
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
              <input 
                name="artista" 
                value={form.artista} 
                onChange={handleChange} 
                onFocus={() => { if (sugestoesArtista.length > 0) setMostrarSugestoesArtista(true); }}
                onBlur={() => setTimeout(() => setMostrarSugestoesArtista(false), 200)}
                autoComplete="off"
              />
              {mostrarSugestoesArtista && sugestoesArtista.length > 0 && (
                <ul className="sugestoes-dropdown">
                  {sugestoesArtista.map((sug, idx) => (
                    <li key={idx} onMouseDown={(e) => {
                      e.preventDefault();
                      setForm(prev => ({ ...prev, artista: sug }));
                      setMostrarSugestoesArtista(false);
                    }}>{sug}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
          
          <div className="form-group" style={{ position: 'relative', zIndex: mostrarSugestoesTitulo ? 60 : 1 }}>
            <label>Título *</label>
            <input 
              name="titulo" 
              value={form.titulo} 
              onChange={handleChange} 
              onFocus={() => { if (sugestoesTitulo.length > 0) setMostrarSugestoesTitulo(true); }}
              onBlur={() => setTimeout(() => setMostrarSugestoesTitulo(false), 200)}
              autoComplete="off"
            />
            {mostrarSugestoesTitulo && sugestoesTitulo.length > 0 && (
              <ul className="sugestoes-dropdown">
                {sugestoesTitulo.map((sug, idx) => (
                  <li key={idx} onMouseDown={(e) => {
                    e.preventDefault();
                    setForm(prev => ({ ...prev, titulo: sug }));
                    setMostrarSugestoesTitulo(false);
                  }}>{sug}</li>
                ))}
              </ul>
            )}
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

        <div style={{ marginTop: '8px' }}>
          <button type="submit" className="btn btn-primary" style={{ minWidth: '180px', width: '100%', maxWidth: '320px' }}>
            Adicionar {activeTab === 'discos' ? 'Disco' : activeTab === 'dvds' ? 'DVD' : 'CD'}
          </button>
        </div>
      </form>
    </div>
  );
}
