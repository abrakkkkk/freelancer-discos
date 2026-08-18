'use client';

import { useState } from 'react';
import { IoIosAddCircleOutline } from "react-icons/io";
import { useMobileLeaveConfirm } from '@/hooks/useMobileLeaveConfirm';
import { useCaixas } from '@/hooks/useCaixas';
import { useItemForm } from '@/hooks/useItemForm';
import { itemService } from '@/services/itemService';
import { movimentacaoService } from '@/services/movimentacaoService';
import CategoryTabs from '@/components/CategoryTabs';
import AlertMessage from '@/components/AlertMessage';
import { CATEGORY_IDS, STORE_OPTIONS } from '@/constants/config';

const INITIAL_FORM = {
  artista: '',
  titulo: '',
  caixa: '',
  loja: '',
  preco: '',
  observacao: '',
};

export default function AdicionarItem() {
  useMobileLeaveConfirm();
  
  const [activeTab, setActiveTab] = useState(CATEGORY_IDS.DISCOS);
  const { caixas } = useCaixas();
  const [mensagem, setMensagem] = useState(null);

  const {
    form, setForm, handleChange,
    sugestoesArtista, mostrarSugestoesArtista, setMostrarSugestoesArtista,
    sugestoesTitulo, mostrarSugestoesTitulo, setMostrarSugestoesTitulo,
    selectSuggestion, getUnmaskedPreco
  } = useItemForm(INITIAL_FORM, activeTab);

  const isVideo = activeTab === CATEGORY_IDS.DVDS || activeTab === CATEGORY_IDS.VHS;

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setMensagem(null);
    setForm(INITIAL_FORM);
    setMostrarSugestoesArtista(false);
    setMostrarSugestoesTitulo(false);
  };

  const validateForm = () => {
    if (!isVideo && !form.artista) return 'Preencha o artista.';
    if (!form.titulo.trim()) return 'O Título é obrigatório.';
    if (activeTab === CATEGORY_IDS.DISCOS && form.caixa) {
      if (isNaN(Number(form.caixa)) || parseInt(form.caixa) < 0) return 'Número da caixa inválido.';
    }
    if (getUnmaskedPreco() < 0) return 'O preço não pode ser negativo.';
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMensagem(null);

    const errorMsg = validateForm();
    if (errorMsg) {
      setMensagem({ tipo: 'error', texto: errorMsg });
      return;
    }

    try {
      // 1. Inserir item
      const insertData = {
        titulo: form.titulo.trim(),
        preco: getUnmaskedPreco(),
        loja: form.loja || null,
        observacao: form.observacao || null
      };

      if (!isVideo) insertData.artista = form.artista.trim();
      if (activeTab === CATEGORY_IDS.DISCOS) insertData.caixa = form.caixa ? parseInt(form.caixa) : null;

      const itemInfo = await itemService.addItem(activeTab, insertData);

      // 2. Registrar Movimentação
      const movData = movimentacaoService.createMovementPayload(activeTab, itemInfo.id, 'entrada', 1, 'Cadastro inicial');
      await movimentacaoService.registerMovement(movData);

      // 3. Registrar Observação se existir
      if (form.observacao?.trim()) {
        const obsField = activeTab === 'discos' ? 'disco_id' : activeTab === 'dvds' ? 'dvd_id' : activeTab === 'cds' ? 'cd_id' : 'vhs_id';
        await movimentacaoService.registerInitialObservation({
          [obsField]: itemInfo.id,
          observacao: form.observacao.trim()
        });
      }

      // Sucesso
      const tipoNome = activeTab === 'discos' ? 'Disco' : activeTab === 'dvds' ? 'DVD' : activeTab === 'vhs' ? 'VHS' : 'CD';
      const caixaText = (activeTab === 'discos' && form.caixa) ? ` na Caixa ${form.caixa}` : '';
      
      setMensagem({ tipo: 'success', texto: `"${form.titulo}" adicionado como ${tipoNome}${caixaText}.` });
      setForm({ ...INITIAL_FORM, caixa: form.caixa, loja: form.loja });
    } catch (err) {
      console.error(err);
      setMensagem({ tipo: 'error', texto: `Erro: ${err.message}` });
    }
  };

  return (
    <div>
      <div className="page-header">
        <IoIosAddCircleOutline size={28} color="var(--accent)" />
        <h1 className="page-title">Adicionar Item</h1>
      </div>
      
      <CategoryTabs activeTab={activeTab} onTabChange={handleTabChange} />
      <AlertMessage message={mensagem} />

      <form onSubmit={handleSubmit} style={{ maxWidth: '600px' }}>
        <div className="form-row" style={{ position: 'relative', zIndex: (mostrarSugestoesArtista || mostrarSugestoesTitulo) ? 50 : 1 }}>
          {!isVideo && (
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
            <label>Título *</label>
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
                    {(!isVideo && sug.artista) ? `${sug.artista} — ${sug.titulo}` : sug.titulo}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="form-row">
          {activeTab === CATEGORY_IDS.DISCOS && (
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
                {caixas.map(c => <option key={c} value={c} />)}
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
              {STORE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
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
            Adicionar {activeTab === 'discos' ? 'Disco' : activeTab === 'dvds' ? 'DVD' : activeTab === 'vhs' ? 'VHS' : 'CD'}
          </button>
        </div>
      </form>
    </div>
  );
}
