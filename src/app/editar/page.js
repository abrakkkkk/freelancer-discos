'use client';

import { useState, useEffect, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams, useRouter } from 'next/navigation';
import { TbTools } from "react-icons/tb";
import { FaMagnifyingGlass, FaBarcode } from "react-icons/fa6";
import { MdDocumentScanner, MdInventory2, MdOutlineNotes } from "react-icons/md";
import { PiVinylRecord, PiMusicNotesSimple } from "react-icons/pi";
import { supabase } from '@/lib/supabase';
import { useCaixas } from '@/hooks/useCaixas';
import { itemService } from '@/services/itemService';
import { movimentacaoService } from '@/services/movimentacaoService';
import { useItemForm } from '@/hooks/useItemForm';
import CategoryTabs from '@/components/CategoryTabs';
import AlertMessage from '@/components/AlertMessage';
import StatusSwitch from '@/components/StatusSwitch';
import { CATEGORY_IDS, STORE_OPTIONS } from '@/constants/config';
import { useUndo } from '@/contexts/UndoContext';
import { useStore } from '@/contexts/StoreContext';
import { IoCamera } from "react-icons/io5";
import { formatCaixa, cleanDiscogsString } from '@/utils/stringUtils';
import AlbumCover from '@/components/AlbumCover';

const BarcodeScannerModal = dynamic(() => import('@/components/BarcodeScannerModal'), { ssr: false });
const OcrScannerModal = dynamic(() => import('@/components/OcrScannerModal'), { ssr: false });
const CoverScannerModal = dynamic(() => import('@/components/CoverScannerModal'), { ssr: false });

function EditarExcluirContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { activeStore } = useStore();

  const [tipo, setTipo] = useState(searchParams.get('tipo') || CATEGORY_IDS.DISCOS);
  const [tela, setTela] = useState('busca'); 
  const [termo, setTermo] = useState('');
  const [resultados, setResultados] = useState([]);
  const [mostrarInativos, setMostrarInativos] = useState(false);
  const [mensagem, setMensagem] = useState(null);
  const [confirmarExclusao, setConfirmarExclusao] = useState(null);

  const [queryDiscogs, setQueryDiscogs] = useState('');
  const [isSearchingDiscogs, setIsSearchingDiscogs] = useState(false);
  const [discogsResults, setDiscogsResults] = useState([]);
  const [showDiscogsDropdown, setShowDiscogsDropdown] = useState(false);

  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isOcrOpen, setIsOcrOpen] = useState(false);
  const [isCoverScannerOpen, setIsCoverScannerOpen] = useState(false);
  const [customCaixaMode, setCustomCaixaMode] = useState(false);
  const [scannerTarget, setScannerTarget] = useState('busca'); // 'busca' ou 'discogs'

  const [loadedWithId] = useState(!!searchParams.get('id'));

  const { registerUndo } = useUndo();

  const [itemEditando, setItemEditando] = useState(null);
  const [selectedCover, setSelectedCover] = useState(null);
  const {
    form, setForm, handleChange,
    sugestoesArtista, mostrarSugestoesArtista, setMostrarSugestoesArtista,
    sugestoesTitulo, mostrarSugestoesTitulo, setMostrarSugestoesTitulo,
    selectSuggestion, getUnmaskedPreco
  } = useItemForm({
    artista: '',
    titulo: '',
    ano: '',
    caixa: '',
    preco: '',
    loja: '',
    ativo: true
  }, tipo);

  const { caixas } = useCaixas(form.loja || activeStore);

  const [observacoes, setObservacoes] = useState([]);
  const [novaObservacao, setNovaObservacao] = useState('');
  const [loadingObs, setLoadingObs] = useState(false);

  const tipoNome = tipo === CATEGORY_IDS.DISCOS ? 'Disco' : tipo === CATEGORY_IDS.DVDS ? 'DVD' : tipo === CATEGORY_IDS.VHS ? 'VHS' : 'CD';
  const temArtista = tipo !== CATEGORY_IDS.DVDS && tipo !== CATEGORY_IDS.VHS;

  async function carregarItemPorId(id) {
    try {
      const data = await itemService.getItemById(tipo, id);
      if (data) {
        setResultados([data]);
        abrirEdicao(data);
      }
    } catch (err) {
      console.error("Erro ao carregar item:", err);
    }
  }

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

  const buscar = async (termoParaBuscar = termo) => {
    const q = (typeof termoParaBuscar === 'string' ? termoParaBuscar : termo)?.trim();
    if (!q) return;
    try {
      const { data } = await itemService.fetchItems(tipo, { 
        busca: q, 
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

  const handleBarcodeScan = async (barcode) => {
    if (!barcode) return;
    if (scannerTarget === 'discogs') {
      setQueryDiscogs(barcode);
      setIsSearchingDiscogs(true);
      setDiscogsResults([]);
      setShowDiscogsDropdown(false);
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
          setMensagem({ tipo: 'error', texto: `Nenhum disco encontrado no Discogs para o código "${barcode}".` });
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsSearchingDiscogs(false);
      }
    } else {
      // Busca no acervo: consulta Discogs para obter nome do álbum ou pesquisa pelo código
      setIsSearchingDiscogs(true);
      try {
        const res = await fetch(`/api/discogs?barcode=${encodeURIComponent(barcode)}`);
        const data = await res.json();
        const first = data.results?.[0];
        let termoFinal = barcode;
        if (first && first.title) {
          const parts = first.title.split(' - ');
          termoFinal = cleanDiscogsString(parts[1] || parts[0] || first.title);
        }
        setTermo(termoFinal);
        buscar(termoFinal);
      } catch (e) {
        setTermo(barcode);
        buscar(barcode);
      } finally {
        setIsSearchingDiscogs(false);
      }
    }
  };

  const handleOcrScan = async (codigoTexto) => {
    if (!codigoTexto) return;
    if (scannerTarget === 'discogs') {
      setQueryDiscogs(codigoTexto);
      setIsSearchingDiscogs(true);
      setDiscogsResults([]);
      setShowDiscogsDropdown(false);
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
            setMensagem({ tipo: 'success', texto: `Catálogo "${codigoTexto}": ${data.results.length} edições encontradas.` });
          }
        } else {
          setMensagem({ tipo: 'error', texto: `Nenhum resultado no Discogs para o código "${codigoTexto}".` });
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsSearchingDiscogs(false);
      }
    } else {
      // Busca no acervo: consulta Discogs para obter nome do álbum ou pesquisa pelo código
      setIsSearchingDiscogs(true);
      try {
        const res = await fetch(`/api/discogs?catno=${encodeURIComponent(codigoTexto)}`);
        const data = await res.json();
        const first = data.results?.[0];
        let termoFinal = codigoTexto;
        if (first && first.title) {
          const parts = first.title.split(' - ');
          termoFinal = cleanDiscogsString(parts[1] || parts[0] || first.title);
        }
        setTermo(termoFinal);
        buscar(termoFinal);
      } catch (e) {
        setTermo(codigoTexto);
        buscar(codigoTexto);
      } finally {
        setIsSearchingDiscogs(false);
      }
    }
  };

  const formatarMoeda = (valor) => {
    if (valor == null) return '';
    let str = typeof valor === 'number' ? Math.floor(valor).toString() : String(valor);
    str = str.replace(/\D/g, '');
    if (!str) return '';
    return parseInt(str, 10).toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
  };

  function abrirEdicao(item) {
    setItemEditando(item);
    setSelectedCover(null);
    setForm({
      artista: item.artista || '',
      titulo: item.titulo || '',
      ano: item.ano || '',
      caixa: item.caixa || '',
      preco: formatarMoeda(item.preco),
      loja: item.loja || '',
      ativo: item.ativo !== false,
    });
    setMensagem(null);
    setTela('edicao');
    carregarObservacoes(item.id);
  }

  const voltarParaBusca = () => {
    if (loadedWithId) {
      router.push('/');
    } else {
      setItemEditando(null);
      setTela('busca');
      setShowDiscogsDropdown(false);
      setDiscogsResults([]);
      setQueryDiscogs('');
    }
  };

  const searchDiscogsWithQuery = async (queryText) => {
    if (!queryText || !queryText.trim()) return;
    setIsSearchingDiscogs(true);
    setDiscogsResults([]);
    setShowDiscogsDropdown(false);
    try {
      const res = await fetch(`/api/discogs?q=${encodeURIComponent(queryText)}`);
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

  const handleCoverRecognized = ({ artista, titulo, ano, coverUrl }) => {
    if (artista || titulo) {
      const query = `${artista || ''} ${titulo || ''}`.trim();
      setQueryDiscogs(query);
      if (coverUrl) {
        setSelectedCover({
          thumb: coverUrl,
          cover: coverUrl,
        });
      }
      setMensagem({
        tipo: 'success',
        texto: `Capa reconhecida: "${query}". Buscando edições no Discogs...`,
      });
      searchDiscogsWithQuery(query);
    }
  };

  const searchDiscogs = async (e) => {
    if (e) e.preventDefault();
    searchDiscogsWithQuery(queryDiscogs);
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
  const salvar = async () => {
    if (!form.titulo?.trim()) return setMensagem({ tipo: 'error', texto: 'O Título é obrigatório.' });
    
    const unmaskedPreco = getUnmaskedPreco();
    if (unmaskedPreco < 0) return setMensagem({ tipo: 'error', texto: 'O preço não pode ser negativo.' });

    const updateData = {
      titulo: form.titulo.trim(),
      preco: unmaskedPreco,
      loja: form.loja || null,
      caixa: form.caixa?.trim() || null,
      ano: form.ano?.trim() || null,
      ativo: form.ativo !== false,
    };
    if (temArtista) updateData.artista = form.artista;

    try {
      const snapshotAntes = JSON.parse(JSON.stringify(itemEditando));
      await itemService.updateItem(tipo, itemEditando.id, updateData);
      const updatedItem = { ...itemEditando, ...updateData };
      setItemEditando(updatedItem);

      // Sincronização e invalidação automática de capa se os dados do disco mudaram
      if (tipo === CATEGORY_IDS.DISCOS) {
        const artistaAlterado = temArtista && (updateData.artista || '').trim().toLowerCase() !== (snapshotAntes.artista || '').trim().toLowerCase();
        const tituloAlterado = (updateData.titulo || '').trim().toLowerCase() !== (snapshotAntes.titulo || '').trim().toLowerCase();

        if (artistaAlterado || tituloAlterado || selectedCover) {
          // 1. Limpa o cache local no sessionStorage do navegador
          if (typeof window !== 'undefined') {
            try {
              const idPrefix = `cover_${itemEditando.id}`;
              Object.keys(sessionStorage).forEach(k => {
                if (k.startsWith(idPrefix) || k.includes(String(itemEditando.id))) {
                  sessionStorage.removeItem(k);
                }
              });
              const chosenImg = selectedCover?.thumb || selectedCover?.cover;
              if (chosenImg) {
                const qKey = `${(updateData.artista || '').trim()} ${(updateData.titulo || '').trim()}`.toLowerCase();
                sessionStorage.setItem(`cover_${itemEditando.id}_${qKey}`, chosenImg);
                sessionStorage.setItem(`cover_${qKey}`, chosenImg);
              }
            } catch (e) {}
          }

          // 2. Atualiza imediatamente o cache de capas no servidor
          try {
            await fetch('/api/cover', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                id: itemEditando.id,
                artista: updateData.artista || '',
                titulo: updateData.titulo || '',
                cover: selectedCover?.cover || null,
                thumb: selectedCover?.thumb || null,
              })
            });
          } catch (e) {
            console.warn('Erro ao atualizar capa:', e);
          }
        }
      }

      setMensagem({ tipo: 'success', texto: `${tipoNome} atualizado com sucesso!` });
      setResultados(prev => prev.map(d => d.id === itemEditando.id ? updatedItem : d));
      registerUndo(tipo, [snapshotAntes], () => {
        carregarItemPorId(itemEditando.id);
        buscar();
      });
    } catch (err) {
      setMensagem({ tipo: 'error', texto: err.message });
    }
  };

  const excluir = async (id) => {
    try {
      const itemParaExcluir = resultados.find(d => d.id === id) || itemEditando;
      const snapshotAntes = JSON.parse(JSON.stringify(itemParaExcluir));
      const isAtivo = itemParaExcluir?.ativo !== false;
      
      await itemService.deleteItem(tipo, id);
      
      if (isAtivo) {
        const movData = movimentacaoService.createMovementPayload(tipo, id, 'saida', itemParaExcluir?.quantidade || 1, 'Saída (Excluído via Edição)');
        await movimentacaoService.registerMovement(movData);
        setMensagem({ tipo: 'success', texto: `Saída do ${tipoNome} registrada.` });
      } else {
        setMensagem({ tipo: 'success', texto: `${tipoNome} (Inativo) excluído com sucesso.` });
      }

      setConfirmarExclusao(null);
      setResultados(prev => prev.filter(d => d.id !== id));
      registerUndo(tipo, [snapshotAntes], () => {
        if (itemEditando && itemEditando.id === id) {
          carregarItemPorId(id);
        }
        buscar();
      });
    } catch (err) {
      setMensagem({ tipo: 'error', texto: err.message });
    }
  };

  const toggleAtivo = async (item) => {
    const novoStatus = !item.ativo;
    try {
      const snapshotAntes = JSON.parse(JSON.stringify(item));
      await itemService.updateItem(tipo, item.id, { ativo: novoStatus });
      const updatedItem = { ...item, ativo: novoStatus };
      setItemEditando(updatedItem);
      setMensagem({ tipo: 'success', texto: novoStatus ? `${tipoNome} reativado!` : `${tipoNome} inativado!` });
      setResultados(prev => prev.map(d => d.id === item.id ? updatedItem : d));
      registerUndo(tipo, [snapshotAntes], () => {
        carregarItemPorId(item.id);
        buscar();
      });
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
      <div className="pageContainer">
        <div className="topHeader" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary btn-back" style={{ flexShrink: 0 }} onClick={voltarParaBusca}>← Voltar</button>
          <div className="titleGroup" style={{ flex: 1, minWidth: '200px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            {tipo === CATEGORY_IDS.DISCOS && (
              <AlbumCover artista={form.artista} titulo={form.titulo} id={itemEditando?.id} size={48} />
            )}
            <div>
              <h1 className="page-title" style={{ textAlign: 'left', margin: 0, fontSize: '20px' }}>Editando {tipoNome}</h1>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>ID #{itemEditando.id} • {itemEditando.loja || 'Sem loja'}</span>
            </div>
          </div>
        </div>

        <AlertMessage message={mensagem} />

        <div className="mainCard">
          <div className="form-container-desktop" style={{ marginTop: '16px' }}>
            {/* Bloco 1: Identificação da Obra */}
            <div className="form-section-card">
              <div className="form-section-header">
                <PiMusicNotesSimple size={18} color="var(--accent)" />
                <h3 className="form-section-title">Identificação da Obra</h3>
              </div>

              {(tipo === CATEGORY_IDS.DISCOS || tipo === CATEGORY_IDS.CDS) && (
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
                        onClick={() => { setScannerTarget('discogs'); setIsScannerOpen(true); }}
                        className="discogs-scanner-chip"
                        title="Escanear código de barras (CDs e Vinis modernos)"
                      >
                        <FaBarcode size={14} /> Barras
                      </button>
                      <button 
                        type="button" 
                        onClick={() => { setScannerTarget('discogs'); setIsOcrOpen(true); }}
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
                {temArtista && (
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
                    {temArtista && (
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
                          {(temArtista && sug.artista) ? `${sug.artista} — ${sug.titulo}` : sug.titulo}
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
                  <label>Loja *</label>
                  <select name="loja" value={form.loja || ''} onChange={handleChange}>
                    <option value="">Nenhuma / Sem Loja</option>
                    {STORE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <label style={{ marginBottom: 0 }}>
                      {(form.loja === 'Loja 1' || form.loja === 'Loja 2') && itemEditando.categoria === 'discos' ? 'Caixa' : 'Localização'}
                    </label>
                    {(form.loja === 'Loja 1' || form.loja === 'Loja 2') && itemEditando.categoria === 'discos' && (
                      <button
                        type="button"
                        onClick={() => setCustomCaixaMode(!customCaixaMode)}
                        style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '12px', fontWeight: 500 }}
                      >
                        {customCaixaMode ? '← Selecionar da lista' : '+ Digitar outra'}
                      </button>
                    )}
                  </div>
                  {(form.loja === 'Loja 1' || form.loja === 'Loja 2') && itemEditando.categoria === 'discos' && !customCaixaMode ? (
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
                        placeholder={form.loja === 'Loja 1' && itemEditando.categoria === 'discos' ? "Ex: 15" : "Ex: 15, Estante A..."}
                        autoComplete="off"
                      />
                      <datalist id="caixas-list">
                        {caixas.map(c => <option key={`${c.caixa}-${c.loja}`} value={c.caixa}>{c.label} {!activeStore && c.loja ? `(${c.loja})` : ''}</option>)}
                      </datalist>
                    </>
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
            </div>

            {/* Ações de Edição */}
            <div className="edit-actions" style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button 
                type="button"
                className="btn btn-primary" 
                style={{ width: '100%', minHeight: '46px', fontSize: '15px', fontWeight: 600 }} 
                onClick={salvar}
              >
                Salvar Alterações
              </button>
              <button 
                type="button"
                className="btn btn-danger" 
                style={{ 
                  width: '100%', 
                  background: 'transparent', 
                  border: '1px solid rgba(243, 139, 168, 0.4)', 
                  color: 'var(--danger)',
                  minHeight: '40px',
                  fontSize: '13px'
                }} 
                onClick={() => setConfirmarExclusao(itemEditando.id)}
              >
                Excluir este item
              </button>
            </div>

            {/* Bloco 3: Observações */}
            <div className="form-section-card" style={{ marginTop: '24px' }}>
              <div className="form-section-header">
                <MdOutlineNotes size={18} color="var(--accent)" />
                <h3 className="form-section-title">Observações do {tipoNome}</h3>
              </div>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                <input style={{ flex: 1, padding: '10px 14px', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '4px', background: 'var(--bg-card)', color: 'var(--text)' }} placeholder="Digite uma nova observação..." value={novaObservacao} onChange={(e) => setNovaObservacao(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && adicionarObservacao()} />
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
          </div>
        </div>

        {confirmarExclusao && (
          <div className="modal-overlay" onClick={() => setConfirmarExclusao(null)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <h3>Confirmar Saída</h3>
              <p>Tem certeza que deseja registrar a saída de <strong>{temArtista && itemEditando.artista ? `${itemEditando.artista} — ` : ''}{itemEditando.titulo}</strong>?<br/>Esta ação não pode ser desfeita, exceto com o histórico atual.</p>
              <div className="modal-actions">
                <button className="btn btn-secondary" onClick={() => setConfirmarExclusao(null)}>Cancelar</button>
                <button className="btn btn-danger" onClick={() => { excluir(confirmarExclusao); voltarParaBusca(); }}>Sim, registrar saída</button>
              </div>
            </div>
          </div>
        )}

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

        <CoverScannerModal
          isOpen={isCoverScannerOpen}
          onClose={() => setIsCoverScannerOpen(false)}
          onCoverRecognized={handleCoverRecognized}
        />

      </div>
    );
  }

  return (
    <div className="pageContainer">
      <div className="topHeader">
        <div className="titleGroup">
          <TbTools size={28} color="var(--accent)" />
          <h1 className="page-title">Editar ou Excluir</h1>
        </div>
      </div>

      <div className="mainCard">
        <CategoryTabs activeTab={tipo} onTabChange={(t) => { setTipo(t); setResultados([]); setMensagem(null); setItemEditando(null); setTela('busca'); }} />
        <AlertMessage message={mensagem} />

        <div className="filterCard" style={{ marginTop: '24px' }}>
          <div className="filters" style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div className="form-group" style={{ flex: 1, minWidth: '220px', margin: 0 }}>
              <label>Buscar por {(tipo === CATEGORY_IDS.DVDS || tipo === CATEGORY_IDS.VHS) ? 'título' : 'artista ou título'}</label>
              <input value={termo} onChange={(e) => setTermo(e.target.value)} placeholder="Ex: Beatles..." onKeyDown={(e) => e.key === 'Enter' && buscar()} />
            </div>
            <button type="button" className="btn btn-primary" onClick={() => buscar()}>Buscar</button>
            <button 
              type="button" 
              onClick={() => { setScannerTarget('busca'); setIsScannerOpen(true); }}
              className="btn btn-primary discogs-btn-escanear"
              title="Escanear código de barras para localizar no estoque"
            >
              <FaBarcode size={14} /> Barras
            </button>
            <button 
              type="button" 
              onClick={() => { setScannerTarget('busca'); setIsOcrOpen(true); }}
              className="btn btn-primary discogs-btn-ocr"
              title="Ler código de catálogo com a câmera (OCR)"
            >
              <MdDocumentScanner size={16} /> OCR
            </button>
          </div>

        <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <input type="checkbox" id="mostrarInativos" checked={mostrarInativos} onChange={(e) => setMostrarInativos(e.target.checked)} style={{ width: 'auto' }} />
          <label htmlFor="mostrarInativos" style={{ fontSize: '13px' }}>Incluir inativos na busca</label>
        </div>
      </div>

      {resultados.length > 0 && (
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Localização</th>
                {temArtista && <th>Artista</th>}
                <th>Título</th>
                <th>Loja</th>
                <th>Preço</th>
                <th>Status</th>
                <th style={{ width: '80px' }}>Ação</th>
              </tr>
            </thead>
            <tbody>
              {resultados.filter(d => mostrarInativos || d.ativo !== false).map((d) => (
                <tr key={d.id} style={d.ativo === false ? { opacity: 0.5 } : {}}>
                  <td data-label="Local">{formatCaixa(d.caixa, d.loja)}</td>
                  {temArtista && <td data-label="Artista">{d.artista}</td>}
                  <td data-label="Título">{d.titulo}</td>
                  <td data-label="Loja">{d.loja || '—'}</td>
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

      <CoverScannerModal
        isOpen={isCoverScannerOpen}
        onClose={() => setIsCoverScannerOpen(false)}
        onCoverRecognized={handleCoverRecognized}
      />

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
