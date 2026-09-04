'use client';

import { useState } from 'react';
import { IoIosAddCircleOutline } from "react-icons/io";
import { FaMagnifyingGlass } from "react-icons/fa6";
import { useMobileLeaveConfirm } from '@/hooks/useMobileLeaveConfirm';
import { useCaixas } from '@/hooks/useCaixas';
import { useItemForm } from '@/hooks/useItemForm';
import { itemService } from '@/services/itemService';
import { movimentacaoService } from '@/services/movimentacaoService';
import CategoryTabs from '@/components/CategoryTabs';
import AlertMessage from '@/components/AlertMessage';
import { CATEGORY_IDS, STORE_OPTIONS } from '@/constants/config';
import { useStore } from '@/contexts/StoreContext';
import { cleanDiscogsString } from '@/utils/stringUtils';

const INITIAL_FORM = {
  artista: '',
  titulo: '',
  ano: '',
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
  const { activeStore } = useStore();

  const [queryDiscogs, setQueryDiscogs] = useState('');
  const [isSearchingDiscogs, setIsSearchingDiscogs] = useState(false);
  const [discogsResults, setDiscogsResults] = useState([]);
  const [showDiscogsDropdown, setShowDiscogsDropdown] = useState(false);

  const initialFormWithStore = { ...INITIAL_FORM, loja: activeStore || '' };

  const {
    form, setForm, handleChange,
    sugestoesArtista, mostrarSugestoesArtista, setMostrarSugestoesArtista,
    sugestoesTitulo, mostrarSugestoesTitulo, setMostrarSugestoesTitulo,
    selectSuggestion, getUnmaskedPreco
  } = useItemForm(initialFormWithStore, activeTab);

  const isVideo = activeTab === CATEGORY_IDS.DVDS || activeTab === CATEGORY_IDS.VHS;

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setMensagem(null);
    setForm({ ...INITIAL_FORM, loja: activeStore || '' });
    setMostrarSugestoesArtista(false);
    setMostrarSugestoesTitulo(false);
    setShowDiscogsDropdown(false);
    setDiscogsResults([]);
    setQueryDiscogs('');
  };

  const validateForm = () => {
    if (!isVideo && !form.artista) return 'Preencha o artista.';
    if (!form.titulo.trim()) return 'O Título é obrigatório.';
    if (!form.loja) return 'Selecione uma loja.';
    if (getUnmaskedPreco() < 0) return 'O preço não pode ser negativo.';
    return null;
  };

  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    
    setMensagem(null);
    const errorMsg = validateForm();
    if (errorMsg) {
      setMensagem({ tipo: 'error', texto: errorMsg });
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Inserir item
      const insertData = {
        titulo: form.titulo.trim(),
        preco: getUnmaskedPreco(),
        loja: form.loja || null,
        observacao: form.observacao || null,
        caixa: form.caixa?.trim() || null,
        ano: form.ano?.trim() || null,
      };

      if (!isVideo) insertData.artista = form.artista.trim();

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
      const localText = form.caixa ? ` em "${form.caixa}"` : '';
      
      setMensagem({ tipo: 'success', texto: `"${form.titulo}" adicionado como ${tipoNome}${localText} (${form.loja}).` });
      setForm({ ...INITIAL_FORM, caixa: form.caixa, loja: form.loja });
    } catch (err) {
      console.error(err);
      setMensagem({ tipo: 'error', texto: `Erro: ${err.message}` });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="pageContainer">
      <div className="topHeader">
        <div className="titleGroup">
          <IoIosAddCircleOutline size={28} color="var(--accent)" />
          <h1 className="page-title">Adicionar Item</h1>
        </div>
      </div>
      
      <div className="mainCard">
        <CategoryTabs activeTab={activeTab} onTabChange={handleTabChange} />
        <AlertMessage message={mensagem} />

        <form onSubmit={handleSubmit} style={{ maxWidth: '600px', marginTop: '24px' }}>
        
        {(activeTab === CATEGORY_IDS.DISCOS || activeTab === CATEGORY_IDS.CDS) && (
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
                    <li key={result.id} onMouseDown={(e) => { e.preventDefault(); handleSelectDiscogsResult(result); }} style={{ padding: '8px', display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: 'bold' }}>{result.title}</span>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {result.year && `${result.year} • `}
                        {result.catno && `${result.catno} • `}
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
          {!isVideo && (
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
              {!isVideo && (
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
                    {(!isVideo && sug.artista) ? `${sug.artista} — ${sug.titulo}` : sug.titulo}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>{form.loja === 'Loja 1' && activeTab === CATEGORY_IDS.DISCOS ? 'Caixa' : 'Localização'} {activeTab === CATEGORY_IDS.DISCOS ? '' : '(Opcional)'}</label>
            <input 
              name="caixa" 
              type="text" 
              list="caixas-list"
              value={form.caixa || ''} 
              onChange={handleChange}
              placeholder={form.loja === 'Loja 1' && activeTab === CATEGORY_IDS.DISCOS ? "Ex: 15" : "Ex: 15, Estante A, Prateleira 3..."}
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
            <select name="loja" value={form.loja} onChange={handleChange}>
              <option value="">Selecione uma loja</option>
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
          <button type="submit" className="btn btn-primary" style={{ minWidth: '180px', width: '100%', maxWidth: '320px', opacity: isSubmitting ? 0.7 : 1 }} disabled={isSubmitting}>
            {isSubmitting ? 'Adicionando...' : `Adicionar ${activeTab === 'discos' ? 'Disco' : activeTab === 'dvds' ? 'DVD' : activeTab === 'vhs' ? 'VHS' : 'CD'}`}
          </button>
        </div>
      </form>
      </div>
    </div>
  );
}
