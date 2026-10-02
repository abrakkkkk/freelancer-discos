'use client';

import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { IoIosAddCircleOutline } from "react-icons/io";
import { FaMagnifyingGlass, FaBarcode } from "react-icons/fa6";
import { MdDocumentScanner, MdInventory2 } from "react-icons/md";
import { PiVinylRecord, PiMusicNotesSimple } from "react-icons/pi";
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
import { cleanDiscogsString, normalizeCaixa, formatDiscogsQuery } from '@/utils/stringUtils';
import { searchMusicHybrid } from '@/utils/musicSearchClient';

import { IoCamera } from "react-icons/io5";

const BarcodeScannerModal = dynamic(() => import('@/components/BarcodeScannerModal'), { ssr: false });
const OcrScannerModal = dynamic(() => import('@/components/OcrScannerModal'), { ssr: false });
const CoverScannerModal = dynamic(() => import('@/components/CoverScannerModal'), { ssr: false });

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
  const { activeStore } = useStore();
  const [customCaixaMode, setCustomCaixaMode] = useState(false);
  const [mensagem, setMensagem] = useState(null);

  // Pré-carrega o leitor de código de barras em background para abertura instantânea
  useEffect(() => {
    import('@/components/BarcodeScannerModal');
  }, []);

  // Auto-dismiss para alertas de feedback (desocupa espaço do viewport mobile após 5 segundos)
  useEffect(() => {
    if (!mensagem) return;
    const timer = setTimeout(() => {
      setMensagem(null);
    }, 5000);
    return () => clearTimeout(timer);
  }, [mensagem]);

  const artistaInputRef = useRef(null);
  const tituloInputRef = useRef(null);

  const [selectedCover, setSelectedCover] = useState(null);
  const [queryDiscogs, setQueryDiscogs] = useState('');
  const [isSearchingDiscogs, setIsSearchingDiscogs] = useState(false);
  const [discogsResults, setDiscogsResults] = useState([]);
  const [showDiscogsDropdown, setShowDiscogsDropdown] = useState(false);
  const [seloPrensagem, setSeloPrensagem] = useState('');
  const [anoPrensagem, setAnoPrensagem] = useState('');

  // AbortController para cancelar requests Discogs anteriores ao iniciar nova busca
  const discogsAbortRef = useRef(null);
  const searchDebounceRef = useRef(null);

  function abortPreviousDiscogs() {
    if (discogsAbortRef.current) {
      discogsAbortRef.current.abort();
    }
    discogsAbortRef.current = new AbortController();
    return discogsAbortRef.current.signal;
  }

  const initialFormWithStore = { ...INITIAL_FORM, loja: activeStore || '' };

  const {
    form, setForm, handleChange,
    sugestoesArtista, mostrarSugestoesArtista, setMostrarSugestoesArtista,
    sugestoesTitulo, mostrarSugestoesTitulo, setMostrarSugestoesTitulo,
    selectSuggestion, getUnmaskedPreco
  } = useItemForm(initialFormWithStore, activeTab);

  const { caixas } = useCaixas(form.loja || activeStore);

  const isVideo = activeTab === CATEGORY_IDS.DVDS || activeTab === CATEGORY_IDS.VHS;

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setMensagem(null);
    setForm({ ...INITIAL_FORM, loja: activeStore || '', ativo: true });
    setSelectedCover(null);
    setSeloPrensagem('');
    setAnoPrensagem('');
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

    // Debounce de 400ms para evitar disparos rápidos consecutivos
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);

    const signal = abortPreviousDiscogs();
    setIsSearchingDiscogs(true);
    setDiscogsResults([]);
    setShowDiscogsDropdown(false);
    try {
      const data = await searchMusicHybrid({ q: queryDiscogs }, signal, (results) => {
        if (results && results.length > 0) {
          setDiscogsResults(results);
          setShowDiscogsDropdown(true);
        }
      });
      if (!data.results || data.results.length === 0) {
        setMensagem({ tipo: 'error', texto: 'Nenhum resultado encontrado.' });
      }
    } catch (err) {
      if (err.name === 'AbortError') return; // Cancelado por nova busca, ignora
      console.error(err);
      setMensagem({ tipo: 'error', texto: 'Erro ao buscar dados do disco.' });
    } finally {
      setIsSearchingDiscogs(false);
    }
  };

  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isOcrOpen, setIsOcrOpen] = useState(false);
  const [isCoverScannerOpen, setIsCoverScannerOpen] = useState(false);

  const handleCoverRecognized = async ({ artista, titulo, ano }) => {
    if (!artista && !titulo) return;

    // Normaliza e formata o termo exato para busca eficiente
    const query = formatDiscogsQuery(artista, titulo);

    let normArtista = (artista || '').trim();
    if (/^(v[aá]rios(\s+artistas)?|various(\s+artists)?|trilha\s+sonora(\s+original)?)$/i.test(normArtista)) {
      normArtista = 'Various';
    }

    setForm(prev => ({
      ...prev,
      artista: normArtista || prev.artista,
      titulo: titulo || prev.titulo,
      ano: ano || prev.ano,
    }));

    setQueryDiscogs(query);
    setMensagem({
      tipo: 'success',
      texto: `Capa identificada: "${query}"${ano ? ` (${ano})` : ''}. Buscando prensagens...`
    });

    if (query) {
      const signal = abortPreviousDiscogs();
      setIsSearchingDiscogs(true);
      setDiscogsResults([]);
      setShowDiscogsDropdown(false);

      try {
        const data = await searchMusicHybrid({ q: query }, signal, (results) => {
          if (results && results.length > 0) {
            setDiscogsResults(results);
            setShowDiscogsDropdown(true);
          }
        });
        if (data.results && data.results.length > 0) {
          setMensagem({
            tipo: 'success',
            texto: `Capa identificada: "${query}". Selecione a prensagem correta abaixo ou confirme os dados.`
          });
        } else {
          setMensagem({
            tipo: 'success',
            texto: `Capa identificada: "${query}". Nenhuma prensagem encontrada; campos preenchidos.`
          });
        }
      } catch (err) {
        if (err.name === 'AbortError') return;
        console.error('Erro na busca pós-reconhecimento:', err);
      } finally {
        setIsSearchingDiscogs(false);
      }
    }
  };

  const handleBarcodeScan = async (barcode) => {
    if (!barcode) return;
    setIsSearchingDiscogs(true);
    setQueryDiscogs(barcode);
    setDiscogsResults([]);
    setShowDiscogsDropdown(false);
    setMensagem(null);

    const signal = abortPreviousDiscogs();
    try {
      const data = await searchMusicHybrid({ barcode }, signal, (results) => {
        if (results && results.length > 0) {
          if (results.length === 1) {
            handleSelectDiscogsResult(results[0]);
            setMensagem({ tipo: 'success', texto: `Código ${barcode} identificado: ${results[0].title}` });
          } else {
            setDiscogsResults(results);
            setShowDiscogsDropdown(true);
            setMensagem({ tipo: 'success', texto: `Código ${barcode}: ${results.length} edições encontradas. Escolha uma abaixo.` });
          }
        }
      });
      if (!data.results || data.results.length === 0) {
        setMensagem({ tipo: 'error', texto: `Nenhum disco encontrado para o código de barras "${barcode}".` });
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.error(err);
      setMensagem({ tipo: 'error', texto: 'Erro ao buscar código de barras.' });
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

    const signal = abortPreviousDiscogs();
    try {
      const data = await searchMusicHybrid({ catno: codigoTexto }, signal, (results) => {
        if (results && results.length > 0) {
          if (results.length === 1) {
            handleSelectDiscogsResult(results[0]);
            setMensagem({ tipo: 'success', texto: `Catálogo "${codigoTexto}" identificado: ${results[0].title}` });
          } else {
            setDiscogsResults(results);
            setShowDiscogsDropdown(true);
            setMensagem({ tipo: 'success', texto: `Catálogo "${codigoTexto}": ${results.length} edições encontradas. Escolha uma abaixo.` });
          }
        }
      });
      if (!data.results || data.results.length === 0) {
        setMensagem({ tipo: 'error', texto: `Nenhum resultado encontrado para o código "${codigoTexto}".` });
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.error(err);
      setMensagem({ tipo: 'error', texto: 'Erro ao buscar código de catálogo.' });
    } finally {
      setIsSearchingDiscogs(false);
    }
  };

  const handleSelectDiscogsResult = (result) => {
    let artista = result.artist || '';
    let titulo = cleanDiscogsString(result.album || result.title);
    
    if (!artista) {
      const parts = result.title.split(' - ');
      if (parts.length > 1) {
        artista = cleanDiscogsString(parts[0]);
        titulo = cleanDiscogsString(parts.slice(1).join(' - '));
      }
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
      artista: artista || prev.artista,
      titulo: titulo || prev.titulo,
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
      const finalCaixa = form.caixa?.trim() ? normalizeCaixa(form.caixa.trim(), form.loja || activeStore) : null;
      const chosenCover = selectedCover?.cover || selectedCover?.thumb || null;

      let finalObservacao = form.observacao?.trim() || null;
      const isCaixaNova = ['49', '50', '51', 'Caixa 49', 'Caixa 50', 'Caixa 51'].includes(String(form.caixa || '').trim());
      if (isCaixaNova && (seloPrensagem.trim() || anoPrensagem.trim())) {
        const tag = [seloPrensagem.trim(), anoPrensagem.trim()].filter(Boolean).join(' • ');
        finalObservacao = tag ? `[${tag}] ${finalObservacao || ''}`.trim() : finalObservacao;
      }

      const insertData = {
        titulo: form.titulo.trim(),
        preco: getUnmaskedPreco(),
        loja: form.loja || null,
        observacao: finalObservacao,
        caixa: finalCaixa,
        ano: form.ano?.trim() || null,
        ativo: form.ativo !== false,
        capa_url: chosenCover,
      };

      if (!isVideo) insertData.artista = form.artista.trim();

      const itemInfo = await itemService.addItem(activeTab, insertData);

      // 2-4. Registrar Movimentação, Observação e Capa em paralelo (não sequencial)
      const parallelTasks = [];

      // Movimentação (obrigatória)
      const movData = movimentacaoService.createMovementPayload(activeTab, itemInfo.id, 'entrada', 1, 'Cadastro inicial');
      parallelTasks.push(movimentacaoService.registerMovement(movData));

      // Observação (opcional)
      if (form.observacao?.trim()) {
        const obsField = activeTab === 'discos' ? 'disco_id' : activeTab === 'dvds' ? 'dvd_id' : activeTab === 'cds' ? 'cd_id' : 'vhs_id';
        parallelTasks.push(
          movimentacaoService.registerInitialObservation({
            [obsField]: itemInfo.id,
            observacao: form.observacao.trim()
          }).catch(obsErr => {
            console.warn('Aviso: observação não registrada:', obsErr);
          })
        );
      }

      // Aguarda apenas movimentação e observação (são rápidas, ~100ms)
      await Promise.allSettled(parallelTasks);

      // Cover: fire-and-forget (não bloqueia o usuário — a capa aparece depois)
      if (activeTab === CATEGORY_IDS.DISCOS || activeTab === CATEGORY_IDS.CDS) {
        const coverToSend = selectedCover?.cover || selectedCover?.thumb;
        const qKey = `${(insertData.artista || '').trim()} ${(insertData.titulo || '').trim()}`.toLowerCase();
        if (coverToSend && typeof window !== 'undefined') {
          try {
            sessionStorage.setItem(`cover_${activeTab}_${itemInfo.id}_${qKey}`, coverToSend);
            sessionStorage.setItem(`cover_${itemInfo.id}_${qKey}`, coverToSend);
            sessionStorage.setItem(`cover_${qKey}`, coverToSend);
            sessionStorage.setItem(`cover_${activeTab}_${itemInfo.id}`, coverToSend);
            sessionStorage.setItem(`cover_${itemInfo.id}`, coverToSend);
          } catch (_) {}
        }
        // Envia capa em background — não bloqueia o submit
        fetch('/api/cover', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: itemInfo.id,
            tipo: activeTab,
            artista: insertData.artista || '',
            titulo: insertData.titulo || '',
            ano: insertData.ano || '',
            cover: selectedCover?.cover || null,
            thumb: selectedCover?.thumb || null,
          })
        }).catch(() => {}); // Fire-and-forget
      }
      setSelectedCover(null);

      // Sucesso
      const tipoNome = activeTab === 'discos' ? 'Disco' : activeTab === 'dvds' ? 'DVD' : activeTab === 'vhs' ? 'VHS' : 'CD';
      const localText = form.caixa ? ` em "${form.caixa}"` : '';
      const statusText = form.ativo === false ? ' [Inativo]' : '';
      
      const lojaText = form.loja ? ` (${form.loja})` : '';
      
      setMensagem({ 
        tipo: 'success', 
        texto: `"${form.titulo}" adicionado como ${tipoNome}${statusText}${localText}${lojaText}.` 
      });
      setForm({ ...INITIAL_FORM, caixa: finalCaixa || form.caixa, loja: form.loja, ativo: form.ativo !== false });
      setSeloPrensagem('');
      setAnoPrensagem('');

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
        <AlertMessage message={mensagem} onClose={() => setMensagem(null)} />

        <form onSubmit={handleSubmit} className="form-container-desktop" style={{ marginTop: '24px' }}>
        
        {/* Bloco 1: Identificação da Obra */}
        <div className="form-section-card">
          <div className="form-section-header">
            <PiMusicNotesSimple size={18} color="var(--accent)" />
            <h3 className="form-section-title">Identificação da Obra</h3>
          </div>

          {(activeTab === CATEGORY_IDS.DISCOS || activeTab === CATEGORY_IDS.CDS) && (
            <div className="form-row" style={{ position: 'relative', zIndex: showDiscogsDropdown ? 70 : 1 }}>
              <div className="form-group" style={{ width: '100%', marginBottom: '16px' }}>
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
                  <button 
                    type="button" 
                    onClick={searchDiscogs}
                    className="discogs-btn-buscar"
                    disabled={isSearchingDiscogs}
                  >
                    <FaMagnifyingGlass size={13} /> {isSearchingDiscogs ? 'Buscando...' : 'Buscar'}
                  </button>
                </div>
                <div className="discogs-scanners-row">
                  <button 
                    type="button" 
                    onClick={() => setIsCoverScannerOpen(true)}
                    className="discogs-scanner-chip"
                    title="Reconhecer capa frontal do disco"
                  >
                    <IoCamera size={15} /> Capa
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setIsScannerOpen(true)}
                    className="discogs-scanner-chip"
                    title="Escanear código de barras (CDs e Vinis modernos)"
                  >
                    <FaBarcode size={14} /> Barras
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setIsOcrOpen(true)}
                    className="discogs-scanner-chip"
                    title="Ler código de catálogo com a câmera (ex: COLP, SMOFB, 6349)"
                  >
                    <MdDocumentScanner size={16} /> OCR
                  </button>
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
                            {result.source === 'musicbrainz' && (
                              <span style={{ background: 'rgba(59, 130, 246, 0.12)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.25)', fontSize: '10px', padding: '1px 6px', borderRadius: '4px', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}>
                                MUSICBRAINZ
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
            <div className="form-group" style={{ maxWidth: '200px' }}>
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
        </div>

        {/* Bloco 2: Estoque & Localização */}
        <div className="form-section-card">
          <div className="form-section-header">
            <MdInventory2 size={18} color="var(--accent)" />
            <h3 className="form-section-title">Estoque & Localização</h3>
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <label style={{ marginBottom: 0 }}>
                  {(form.loja === 'Loja 1' || form.loja === 'Loja 2') && activeTab === CATEGORY_IDS.DISCOS ? 'Caixa' : 'Localização'} {activeTab === CATEGORY_IDS.DISCOS ? '' : '(Opcional)'}
                </label>
                {(form.loja === 'Loja 1' || form.loja === 'Loja 2') && activeTab === CATEGORY_IDS.DISCOS && (
                  <button
                    type="button"
                    onClick={() => setCustomCaixaMode(!customCaixaMode)}
                    style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '12px', fontWeight: 500 }}
                  >
                    {customCaixaMode ? '← Selecionar da lista' : '+ Digitar outra'}
                  </button>
                )}
              </div>
              {(form.loja === 'Loja 1' || form.loja === 'Loja 2') && activeTab === CATEGORY_IDS.DISCOS && !customCaixaMode ? (
                <select
                  name="caixa"
                  value={form.caixa || ''}
                  onChange={handleChange}
                >
                  <option value="">Selecione a caixa</option>
                  {caixas.map(c => (
                    <option key={`${c.caixa}-${c.loja}`} value={c.caixa}>
                      {c.label}
                    </option>
                  ))}
                  {form.caixa && !caixas.some(c => c.caixa === form.caixa) && (
                    <option value={form.caixa}>{form.caixa} (Personalizada)</option>
                  )}
                </select>
              ) : (
                <>
                  <input 
                    name="caixa" 
                    type="text" 
                    list="caixas-list"
                    value={form.caixa || ''} 
                    onChange={handleChange}
                    onBlur={() => {
                      if (form.caixa) {
                        const normalizada = normalizeCaixa(form.caixa, form.loja || activeStore);
                        if (normalizada !== form.caixa) {
                          setForm(prev => ({ ...prev, caixa: normalizada }));
                        }
                      }
                    }}
                    placeholder={form.loja === 'Loja 2' ? "Ex: Caixa 5B, 5b..." : form.loja === 'Loja 1' && activeTab === CATEGORY_IDS.DISCOS ? "Ex: 15" : "Ex: 15, Estante A, Prateleira 3..."}
                    autoComplete="off"
                  />
                  <datalist id="caixas-list">
                    {caixas.map(c => <option key={`${c.caixa}-${c.loja}`} value={c.caixa}>{c.label} {!activeStore && c.loja ? `(${c.loja})` : ''}</option>)}
                  </datalist>
                </>
              )}

              {['49', '50', '51', 'Caixa 49', 'Caixa 50', 'Caixa 51'].includes(String(form.caixa || '').trim()) && (
                <div style={{ marginTop: '12px', padding: '12px 14px', background: 'rgba(168, 85, 247, 0.05)', border: '1px solid rgba(168, 85, 247, 0.25)', borderRadius: '8px', width: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#c084fc' }}>
                      Prensagem Nova / Edição Especial (Caixa {form.caixa})
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    <div style={{ flex: '1 1 200px' }}>
                      <label style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Selo da Prensagem</label>
                      <input 
                        type="text" 
                        value={seloPrensagem} 
                        onChange={(e) => setSeloPrensagem(e.target.value)} 
                        placeholder="Ex: Três Selos, Noize..."
                        style={{ width: '100%' }}
                      />
                      <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                        {['Três Selos', 'Noize', 'Rocinante', 'Fatiado', 'Universal', 'Polysom'].map(s => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setSeloPrensagem(s)}
                            style={{
                              fontSize: '11px',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              background: seloPrensagem === s ? 'var(--accent)' : 'rgba(255,255,255,0.06)',
                              color: seloPrensagem === s ? '#fff' : 'var(--text-muted)',
                              border: '1px solid var(--border)',
                              cursor: 'pointer'
                            }}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div style={{ width: '120px' }}>
                      <label style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Ano Prensagem</label>
                      <input 
                        type="text" 
                        value={anoPrensagem} 
                        onChange={(e) => setAnoPrensagem(e.target.value)} 
                        placeholder="Ex: 2023"
                        style={{ width: '100%' }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Preço (R$)</label>
              <input name="preco" type="text" value={form.preco} onChange={handleChange} />
            </div>
            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', marginBottom: '8px' }}>
              <StatusSwitch
                ativo={form.ativo !== false}
                onChange={(novoAtivo) => setForm(prev => ({ ...prev, ativo: novoAtivo }))}
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
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
        </div>

        <div style={{ marginTop: '20px' }}>
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
              : `Adicionar ${activeTab === 'discos' ? 'Disco' : activeTab === 'dvds' ? 'DVD' : activeTab === 'vhs' ? 'VHS' : 'CD'}`
            }
          </button>
        </div>
      </form>
      </div>

      <CoverScannerModal 
        isOpen={isCoverScannerOpen} 
        onClose={() => setIsCoverScannerOpen(false)} 
        onRecognized={handleCoverRecognized} 
      />

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
