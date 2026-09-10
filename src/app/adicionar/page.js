'use client';

import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { IoIosAddCircleOutline } from "react-icons/io";
import { FaMagnifyingGlass, FaBarcode } from "react-icons/fa6";
import { MdDocumentScanner } from "react-icons/md";
import { PiVinylRecord } from "react-icons/pi";
import StatusSwitch from '@/components/StatusSwitch';
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

const BarcodeScannerModal = dynamic(() => import('@/components/BarcodeScannerModal'), { ssr: false });
const OcrScannerModal = dynamic(() => import('@/components/OcrScannerModal'), { ssr: false });

const INITIAL_FORM = {
  artista: '',
  titulo: '',
  ano: '',
  caixa: '',
  loja: '',
  preco: '',
  observacao: '',
  ativo: true,
};

export default function AdicionarItem() {
  useMobileLeaveConfirm();
  
  const [activeTab, setActiveTab] = useState(CATEGORY_IDS.DISCOS);
  const { caixas } = useCaixas();
  const [mensagem, setMensagem] = useState(null);
  const { activeStore } = useStore();

  const artistaInputRef = useRef(null);
  const tituloInputRef = useRef(null);

  const [modoSequencia, setModoSequencia] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        return localStorage.getItem('freelancer_adicionar_sequencia') !== 'false';
      } catch (_) {
        return true;
      }
    }
    return true;
  });

  const handleToggleSequencia = (checked) => {
    setModoSequencia(checked);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('freelancer_adicionar_sequencia', String(checked));
      } catch (_) {}
    }
  };

  const [selectedCover, setSelectedCover] = useState(null);
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
    setForm({ ...INITIAL_FORM, loja: activeStore || '', ativo: true });
    setSelectedCover(null);
    setMostrarSugestoesArtista(false);
    setMostrarSugestoesTitulo(false);
    setShowDiscogsDropdown(false);
    setDiscogsResults([]);
    setQueryDiscogs('');
  };

  const validateForm = () => {
    if (!isVideo && !form.artista) return 'Preencha o artista.';
    if (!form.titulo.trim()) return 'O Título é obrigatório.';
    if (form.ativo !== false && !form.loja) return 'Selecione uma loja.';
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

  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isOcrOpen, setIsOcrOpen] = useState(false);

  const handleBarcodeScan = async (barcode) => {
    if (!barcode) return;
    setIsSearchingDiscogs(true);
    setQueryDiscogs(barcode);
    setDiscogsResults([]);
    setShowDiscogsDropdown(false);
    setMensagem(null);

    try {
      const res = await fetch(`/api/discogs?barcode=${encodeURIComponent(barcode)}`);
      const data = await res.json();
      if (data.results && data.results.length > 0) {
        if (data.results.length === 1) {
          handleSelectDiscogsResult(data.results[0]);
          setMensagem({ tipo: 'success', texto: `Código ${barcode} identificado: ${data.results[0].title}` });
        } else {
          setDiscogsResults(data.results);
          setShowDiscogsDropdown(true);
          setMensagem({ tipo: 'success', texto: `Código ${barcode}: ${data.results.length} edições encontradas. Escolha uma abaixo.` });
        }
      } else {
        const fallbackRes = await fetch(`/api/discogs?q=${encodeURIComponent(barcode)}`);
        const fallbackData = await fallbackRes.json();
        if (fallbackData.results && fallbackData.results.length > 0) {
          setDiscogsResults(fallbackData.results);
          setShowDiscogsDropdown(true);
          setMensagem({ tipo: 'success', texto: `Código ${barcode}: ${fallbackData.results.length} edições encontradas.` });
        } else {
          setMensagem({ tipo: 'error', texto: `Nenhum disco encontrado no Discogs para o código de barras "${barcode}".` });
        }
      }
    } catch (err) {
      console.error(err);
      setMensagem({ tipo: 'error', texto: 'Erro ao buscar código de barras no Discogs.' });
    } finally {
      setIsSearchingDiscogs(false);
    }
  };

  const handleOcrScan = async (codigoTexto) => {
    if (!codigoTexto) return;
    setQueryDiscogs(codigoTexto);
    setIsSearchingDiscogs(true);
    setDiscogsResults([]);
    setShowDiscogsDropdown(false);
    setMensagem(null);

    try {
      const res = await fetch(`/api/discogs?catno=${encodeURIComponent(codigoTexto)}`);
      const data = await res.json();
      if (data.results && data.results.length > 0) {
        if (data.results.length === 1) {
          handleSelectDiscogsResult(data.results[0]);
          setMensagem({ tipo: 'success', texto: `Catálogo "${codigoTexto}" identificado: ${data.results[0].title}` });
        } else {
          setDiscogsResults(data.results);
          setShowDiscogsDropdown(true);
          setMensagem({ tipo: 'success', texto: `Catálogo "${codigoTexto}": ${data.results.length} edições encontradas. Escolha uma abaixo.` });
        }
      } else {
        setMensagem({ tipo: 'error', texto: `Nenhum resultado encontrado no Discogs para o código "${codigoTexto}".` });
      }
    } catch (err) {
      console.error(err);
      setMensagem({ tipo: 'error', texto: 'Erro ao buscar código de catálogo no Discogs.' });
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

    if (result.thumb || result.cover_image) {
      setSelectedCover({
        thumb: result.thumb || null,
        cover: result.cover_image || result.thumb || null
      });
    }

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
        ativo: form.ativo !== false,
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

      if (activeTab === CATEGORY_IDS.DISCOS) {
        const coverToSend = selectedCover?.cover || selectedCover?.thumb;
        const qKey = `${(insertData.artista || '').trim()} ${(insertData.titulo || '').trim()}`.toLowerCase();
        if (coverToSend && typeof window !== 'undefined') {
          try {
            sessionStorage.setItem(`cover_${itemInfo.id}_${qKey}`, coverToSend);
            sessionStorage.setItem(`cover_${qKey}`, coverToSend);
          } catch (_) {}
        }
        try {
          await fetch('/api/cover', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: itemInfo.id,
              artista: insertData.artista || '',
              titulo: insertData.titulo || '',
              cover: selectedCover?.cover || null,
              thumb: selectedCover?.thumb || null,
            })
          });
        } catch (_) {}
      }
      setSelectedCover(null);

      // Sucesso
      const tipoNome = activeTab === 'discos' ? 'Disco' : activeTab === 'dvds' ? 'DVD' : activeTab === 'vhs' ? 'VHS' : 'CD';
      const localText = form.caixa ? ` em "${form.caixa}"` : '';
      const statusText = form.ativo === false ? ' [Estoque Superior]' : '';
      
      const lojaText = form.loja ? ` (${form.loja})` : '';
      
      if (modoSequencia) {
        setMensagem({ 
          tipo: 'success', 
          texto: `"${form.titulo}" adicionado como ${tipoNome}${statusText}${localText}${lojaText}! Pronto para o próximo.` 
        });
        setForm({ ...INITIAL_FORM, caixa: form.caixa, loja: form.loja, ativo: form.ativo !== false });
      } else {
        setMensagem({ 
          tipo: 'success', 
          texto: `"${form.titulo}" adicionado como ${tipoNome}${statusText}${localText}${lojaText}.` 
        });
        setForm({ ...INITIAL_FORM, loja: activeStore || '', ativo: true });
      }

      setQueryDiscogs('');
      setDiscogsResults([]);
      setShowDiscogsDropdown(false);

      setTimeout(() => {
        if (isVideo) {
          tituloInputRef.current?.focus();
        } else {
          artistaInputRef.current?.focus();
        }
      }, 50);
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
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><FaMagnifyingGlass /> Buscar no Discogs</label>
              <div className="discogs-search-row">
                <input 
                  type="text" 
                  value={queryDiscogs} 
                  onChange={(e) => setQueryDiscogs(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); searchDiscogs(); } }}
                  placeholder="Ex: 6328 286, COLP 12225..."
                  autoComplete="off"
                />
                <div className="discogs-actions-row">
                  <button 
                    type="button" 
                    onClick={searchDiscogs}
                    className="btn btn-secondary discogs-btn-buscar"
                    disabled={isSearchingDiscogs}
                  >
                    <FaMagnifyingGlass size={13} /> {isSearchingDiscogs ? 'Buscando...' : 'Buscar'}
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setIsScannerOpen(true)}
                    className="btn btn-primary discogs-btn-escanear"
                    title="Escanear código de barras (CDs e Vinis modernos)"
                  >
                    <FaBarcode size={14} /> Barras
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setIsOcrOpen(true)}
                    className="btn btn-primary discogs-btn-ocr"
                    title="Ler código de catálogo com a câmera (ex: COLP, SMOFB, 6349)"
                  >
                    <MdDocumentScanner size={16} /> OCR
                  </button>
                </div>
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
                        padding: '8px 10px', 
                        display: 'flex', 
                        alignItems: 'center',
                        gap: '12px',
                        background: result.isExactMatch ? 'rgba(56, 161, 105, 0.05)' : undefined,
                        borderLeft: result.isExactMatch ? '3px solid rgba(56, 161, 105, 0.6)' : undefined,
                        cursor: 'pointer'
                      }}
                    >
                      {result.thumb ? (
                        <img 
                          src={result.thumb} 
                          alt="" 
                          style={{ width: '42px', height: '42px', objectFit: 'cover', borderRadius: '4px', flexShrink: 0, background: '#18181b', border: '1px solid var(--border)' }} 
                          loading="lazy"
                        />
                      ) : (
                        <div style={{ width: '42px', height: '42px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <PiVinylRecord size={22} color="var(--text-muted)" />
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                          <span style={{ fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{result.title}</span>
                          {result.isExactMatch && (
                            <span style={{ background: 'rgba(56, 161, 105, 0.15)', color: '#48bb78', border: '1px solid rgba(56, 161, 105, 0.3)', fontSize: '10px', padding: '1px 6px', borderRadius: '4px', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}>
                              MATCH EXATO
                            </span>
                          )}
                        </div>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {result.year && `${result.year} • `}
                          {result.catno && `${result.catno} • `}
                          {result.country && `${result.country} • `}
                          {result.format?.join(', ')}
                        </span>
                      </div>
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
                ref={artistaInputRef}
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
              ref={tituloInputRef}
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
            <label>{(form.loja === 'Loja 1' || form.loja === 'Loja 2') && activeTab === CATEGORY_IDS.DISCOS ? 'Caixa' : 'Localização'} {activeTab === CATEGORY_IDS.DISCOS ? '' : '(Opcional)'}</label>
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
            <label>Loja {form.ativo !== false ? '*' : '(Opcional)'}</label>
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
            style={{ width: '100%', resize: 'vertical' }}
            placeholder="Qualquer detalhe adicional sobre o item..."
          ></textarea>
        </div>

        <div className="form-group" style={{ marginBottom: '16px' }}>
          <StatusSwitch
            ativo={form.ativo !== false}
            onChange={(novoAtivo) => setForm(prev => ({ ...prev, ativo: novoAtivo }))}
          />
        </div>

        <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <label style={{ 
            display: 'inline-flex', 
            alignItems: 'center', 
            gap: '10px', 
            cursor: 'pointer',
            userSelect: 'none',
            padding: '10px 14px',
            minHeight: '44px',
            borderRadius: '8px',
            background: modoSequencia ? 'rgba(59, 130, 246, 0.08)' : 'rgba(255, 255, 255, 0.02)',
            border: `1px solid ${modoSequencia ? 'var(--accent)' : 'var(--border)'}`,
            transition: 'all 0.2s ease',
            maxWidth: '380px'
          }}>
            <input 
              type="checkbox" 
              checked={modoSequencia} 
              onChange={(e) => handleToggleSequencia(e.target.checked)}
              style={{ 
                width: '18px', 
                height: '18px', 
                accentColor: 'var(--accent)', 
                cursor: 'pointer' 
              }}
            />
            <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)' }}>
              Manter Caixa e Loja
            </span>
          </label>

          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{ 
              width: '100%', 
              maxWidth: '380px', 
              minHeight: '48px',
              fontSize: '15px',
              fontWeight: 600,
              borderRadius: '10px',
              touchAction: 'manipulation',
              opacity: isSubmitting ? 0.7 : 1 
            }} 
            disabled={isSubmitting}
          >
            {isSubmitting 
              ? 'Adicionando...' 
              : modoSequencia 
                ? 'Salvar e Adicionar Outro' 
                : `Adicionar ${activeTab === 'discos' ? 'Disco' : activeTab === 'dvds' ? 'DVD' : activeTab === 'vhs' ? 'VHS' : 'CD'}`
            }
          </button>
        </div>
      </form>
      </div>

      <BarcodeScannerModal 
        isOpen={isScannerOpen} 
        onClose={() => setIsScannerOpen(false)} 
        onScan={handleBarcodeScan} 
      />

      <OcrScannerModal 
        isOpen={isOcrOpen} 
        onClose={() => setIsOcrOpen(false)} 
        onScan={handleOcrScan} 
      />
    </div>
  );
}
