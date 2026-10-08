'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { FaCamera, FaCheck, FaTrash, FaMagnifyingGlass, FaCheckDouble, FaExclamationTriangle } from "react-icons/fa6";
import { MdInventory2, MdCheckCircle } from "react-icons/md";
import { PiVinylRecord } from "react-icons/pi";
import { IoRefresh } from "react-icons/io5";
import { useCaixas } from '@/hooks/useCaixas';
import { useStore } from '@/contexts/StoreContext';
import { itemService } from '@/services/itemService';
import { movimentacaoService } from '@/services/movimentacaoService';
import { fetchDiscogs, extractSeloPrensagem } from '@/utils/discogsClient';
import { normalizeCaixa, cleanDiscogsString } from '@/utils/stringUtils';
import { CATEGORY_IDS, STORE_OPTIONS } from '@/constants/config';
import AlertMessage from '@/components/AlertMessage';
import { prepararFoto } from '@/utils/imageUtils';

export default function CadastroLoteFotos() {
  const { activeStore } = useStore();

  // Configuração global do lote
  const [tipo, setTipo] = useState(CATEGORY_IDS.DISCOS);
  const [loja, setLoja] = useState(activeStore || 'Loja 1');
  const [caixaPadrao, setCaixaPadrao] = useState('');
  const [precoPadrao, setPrecoPadrao] = useState('');

  const { caixas } = useCaixas(loja || activeStore);

  // Lista de itens do lote
  const [itens, setItens] = useState([]);
  const [processando, setProcessando] = useState(false);
  const [progresso, setProgresso] = useState({ atual: 0, total: 0 });
  const [statusProgresso, setStatusProgresso] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [progressoSalvar, setProgressoSalvar] = useState({ atual: 0, total: 0 });
  const [mensagem, setMensagem] = useState(null);
  const [sucessoFinal, setSucessoFinal] = useState(null);

  // Modal de busca manual de prensagem para um item específico
  const [itemPesquisa, setItemPesquisa] = useState(null);
  const [queryPesquisa, setQueryPesquisa] = useState('');
  const [resultadosPesquisa, setResultadosPesquisa] = useState([]);
  const [buscandoPesquisa, setBuscandoPesquisa] = useState(false);

  const fileInputRef = useRef(null);

  // Atualiza loja padrão se mudar contexto
  useEffect(() => {
    if (activeStore && !loja) setLoja(activeStore);
  }, [activeStore, loja]);

  // Auto-dismiss de mensagens de feedback para mobile
  useEffect(() => {
    if (!sucessoFinal) return;
    const timer = setTimeout(() => {
      setSucessoFinal(null);
    }, 5000);
    return () => clearTimeout(timer);
  }, [sucessoFinal]);

  useEffect(() => {
    if (!mensagem) return;
    const timer = setTimeout(() => {
      setMensagem(null);
    }, 5000);
    return () => clearTimeout(timer);
  }, [mensagem]);

  // Função resiliente para chamar o reconhecimento visual com backoff exponencial
  const reconhecerFoto = async (dataUrl) => {
    if (!dataUrl) return null;
    const delays = [0, 2500, 5000];

    for (let attempt = 0; attempt < delays.length; attempt++) {
      if (delays[attempt] > 0) {
        setStatusProgresso(`Aguardando cota da IA... (${delays[attempt] / 1000}s)`);
        await new Promise(r => setTimeout(r, delays[attempt]));
      }
      try {
        const res = await fetch('/api/recognize-cover', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: dataUrl })
        });

        if (res.status === 429 || res.status === 502 || res.status === 504) {
          console.warn(`[Lote] Tentativa ${attempt + 1} retornou status ${res.status}.`);
          continue;
        }

        if (res.ok) {
          const data = await res.json();
          if (data && data.success) {
            return data;
          }
        }
      } catch (err) {
        console.warn(`[Lote] Erro de rede tentativa ${attempt + 1}:`, err);
      }
    }
    return null;
  };

  // Helper de enriquecimento com Discogs
  const enriquecerComDiscogs = async (artistaGemini, tituloGemini, anoGemini) => {
    let discogsMatch = null;
    let seloDetectado = '';
    const termoBusca = [artistaGemini, tituloGemini].filter(Boolean).join(' ');

    if (termoBusca.trim()) {
      try {
        const dData = await fetchDiscogs({ q: termoBusca });
        if (dData?.results && dData.results.length > 0) {
          discogsMatch = dData.results[0];
          seloDetectado = extractSeloPrensagem(discogsMatch);
        }
      } catch (dErr) {
        console.warn('Erro Discogs no lote:', dErr);
      }
    }

    let finalArtista = artistaGemini;
    let finalTitulo = tituloGemini;

    if (discogsMatch) {
      if (!finalArtista && discogsMatch.artist) {
        finalArtista = discogsMatch.artist;
      }
      if (!finalTitulo && discogsMatch.album) {
        finalTitulo = cleanDiscogsString(discogsMatch.album);
      }
      if ((!finalArtista || !finalTitulo) && discogsMatch.title?.includes(' - ')) {
        const parts = discogsMatch.title.split(' - ');
        if (!finalArtista) finalArtista = cleanDiscogsString(parts[0]);
        if (!finalTitulo) finalTitulo = cleanDiscogsString(parts.slice(1).join(' - '));
      } else if (!finalTitulo && discogsMatch.title) {
        finalTitulo = cleanDiscogsString(discogsMatch.title);
      }
    }

    const finalAno = anoGemini || (discogsMatch?.year ? String(discogsMatch.year) : '');
    const finalCapa = discogsMatch?.thumb || discogsMatch?.cover_image || null;

    return {
      artista: finalArtista,
      titulo: finalTitulo,
      ano: finalAno,
      selo: seloDetectado,
      capaUrl: finalCapa,
      discogsMatch
    };
  };

  // Reprocessar um item individual não reconhecido
  const reprocessarItem = async (itemId) => {
    const item = itens.find(it => it.id === itemId);
    if (!item) return;

    let dataUrl = item.dataUrl;
    if (!dataUrl && item.file) {
      try {
        const prep = await prepararFoto(item.file, 800, 160);
        dataUrl = prep.dataUrl;
      } catch (e) {
        console.error('Erro ao regerar dataUrl para reprocessar:', e);
      }
    }
    if (!dataUrl) {
      setMensagem({ tipo: 'error', texto: 'Não foi possível carregar a imagem para reprocessamento.' });
      return;
    }

    setItens(prev => prev.map(it => it.id === itemId ? { ...it, processandoItem: true } : it));

    try {
      const geminiData = await reconhecerFoto(dataUrl);
      const artistaGemini = (geminiData?.artista || '').trim();
      const tituloGemini = (geminiData?.titulo || '').trim();
      const anoGemini = (geminiData?.ano || '').trim();
      const confianca = geminiData?.confianca || (artistaGemini || tituloGemini ? 'media' : 'baixa');

      const enriquecido = await enriquecerComDiscogs(artistaGemini, tituloGemini, anoGemini);
      const temDados = Boolean(enriquecido.titulo || enriquecido.artista);

      setItens(prev => prev.map(it => {
        if (it.id !== itemId) return it;
        return {
          ...it,
          dataUrl,
          artista: enriquecido.artista || it.artista,
          titulo: enriquecido.titulo || it.titulo,
          ano: enriquecido.ano || it.ano,
          selo: enriquecido.selo || it.selo,
          capaUrl: enriquecido.capaUrl || it.capaUrl,
          confianca,
          reconhecido: temDados,
          selecionado: temDados ? true : it.selecionado,
          processandoItem: false
        };
      }));
    } catch (e) {
      console.error('Erro ao reprocessar item:', e);
      setItens(prev => prev.map(it => it.id === itemId ? { ...it, processandoItem: false } : it));
    }
  };

  // Reprocessar todos os itens que continuam com título/artista vazios
  const reprocessarVazios = async () => {
    const vazios = itens.filter(it => !it.titulo?.trim() && !it.artista?.trim() && (it.dataUrl || it.file));
    if (vazios.length === 0) return;

    setProcessando(true);
    setProgresso({ atual: 0, total: vazios.length });

    for (let i = 0; i < vazios.length; i++) {
      const item = vazios[i];
      setProgresso({ atual: i + 1, total: vazios.length });
      setStatusProgresso(`Reprocessando foto ${i + 1} de ${vazios.length}...`);
      if (i > 0) await new Promise(r => setTimeout(r, 1000));
      await reprocessarItem(item.id);
    }

    setProcessando(false);
    setStatusProgresso('');
  };

  // Upload e processamento das fotos com streaming visual e proteção anti-bloqueio
  const handleFilesSelected = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setMensagem(null);
    setSucessoFinal(null);
    setProcessando(true);
    setProgresso({ atual: 0, total: files.length });
    setStatusProgresso('');

    let currentPacing = 1000;
    let reconhecidosCount = 0;

    for (let i = 0; i < files.length; i++) {
      setProgresso({ atual: i + 1, total: files.length });
      setStatusProgresso(`Analisando foto ${i + 1} de ${files.length} (${reconhecidosCount} identificados)...`);
      const file = files[i];

      // Pacing inteligente e adaptativo entre fotos
      if (i > 0) {
        await new Promise(r => setTimeout(r, currentPacing));
      }

      try {
        // 1. Redimensiona a foto de forma otimizada sem estourar a memória
        const { dataUrl, thumbUrl, erro } = await prepararFoto(file, 800, 160);
        if (erro || !dataUrl) {
          throw new Error(erro || 'Falha ao processar miniatura da foto');
        }

        // 2. Chama Gemini Vision com retentativas e backoff resiliente
        const t0 = Date.now();
        const geminiData = await reconhecerFoto(dataUrl);
        const elapsed = Date.now() - t0;

        // Se geminiData veio nulo ou demorou muito, ajusta pacing
        if (!geminiData) {
          currentPacing = Math.min(currentPacing + 600, 2500);
        } else if (elapsed > 4000) {
          currentPacing = Math.min(currentPacing + 300, 2000);
        } else {
          currentPacing = Math.max(currentPacing - 200, 800);
        }

        const artistaGemini = (geminiData?.artista || '').trim();
        const tituloGemini = (geminiData?.titulo || '').trim();
        const anoGemini = (geminiData?.ano || '').trim();
        const confianca = geminiData?.confianca || (artistaGemini || tituloGemini ? 'media' : 'baixa');

        // 3. Enriquecimento via Discogs
        const enriquecido = await enriquecerComDiscogs(artistaGemini, tituloGemini, anoGemini);
        const temDados = Boolean(enriquecido.titulo || enriquecido.artista);
        if (temDados) reconhecidosCount++;

        const novoItem = {
          id: `item-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 4)}`,
          file,
          dataUrl,
          fotoPreview: thumbUrl || dataUrl,
          artista: enriquecido.artista,
          titulo: enriquecido.titulo,
          ano: enriquecido.ano,
          preco: precoPadrao || '',
          caixa: caixaPadrao || '',
          selo: enriquecido.selo,
          capaUrl: enriquecido.capaUrl,
          confianca,
          reconhecido: temDados,
          processandoItem: false,
          discogsResults: enriquecido.discogsMatch ? [enriquecido.discogsMatch] : [],
          selecionado: temDados // Apenas itens com dados são marcados inicialmente
        };

        setItens(prev => [...prev, novoItem]);
      } catch (err) {
        console.error(`Erro ao processar arquivo ${file.name}:`, err);
        let fallbackUrl = '';
        try { fallbackUrl = URL.createObjectURL(file); } catch (_) {}
        setItens(prev => [...prev, {
          id: `item-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 4)}`,
          file,
          dataUrl: null,
          fotoPreview: fallbackUrl,
          artista: '',
          titulo: '',
          ano: '',
          preco: precoPadrao || '',
          caixa: caixaPadrao || '',
          selo: '',
          capaUrl: null,
          confianca: 'baixa',
          reconhecido: false,
          processandoItem: false,
          discogsResults: [],
          selecionado: false
        }]);
      }
    }

    setProcessando(false);
    setStatusProgresso('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Limpeza de lote liberando memória
  const limparLote = () => {
    itens.forEach(item => {
      if (item.fotoPreview?.startsWith('blob:')) {
        try { URL.revokeObjectURL(item.fotoPreview); } catch (_) {}
      }
    });
    setItens([]);
  };

  // Selecionar / Deselecionar tudo
  const todosSelecionados = itens.length > 0 && itens.every(item => item.selecionado);
  const toggleSelecionarTudo = () => {
    const novoValor = !todosSelecionados;
    setItens(prev => prev.map(item => ({ ...item, selecionado: novoValor })));
  };

  const toggleItem = (id) => {
    setItens(prev => prev.map(item => item.id === id ? { ...item, selecionado: !item.selecionado } : item));
  };

  const atualizarItem = (id, campo, valor) => {
    setItens(prev => prev.map(item => item.id === id ? { ...item, [campo]: valor } : item));
  };

  const removerItem = (id) => {
    setItens(prev => {
      const itemToRemove = prev.find(item => item.id === id);
      if (itemToRemove?.fotoPreview?.startsWith('blob:')) {
        try { URL.revokeObjectURL(itemToRemove.fotoPreview); } catch (_) {}
      }
      return prev.filter(item => item.id !== id);
    });
  };

  // Busca manual no Discogs para ajustar um item específico
  const abrirPesquisaDiscogs = (item) => {
    setItemPesquisa(item);
    setQueryPesquisa([item.artista, item.titulo].filter(Boolean).join(' '));
    setResultadosPesquisa([]);
  };

  const executarPesquisaManual = async (e) => {
    if (e) e.preventDefault();
    if (!queryPesquisa.trim()) return;
    setBuscandoPesquisa(true);
    try {
      const data = await fetchDiscogs({ q: queryPesquisa });
      setResultadosPesquisa(data.results || []);
    } catch (err) {
      console.error(err);
    } finally {
      setBuscandoPesquisa(false);
    }
  };

  const aplicarResultadoPesquisa = (result) => {
    if (!itemPesquisa) return;

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
    const selo = extractSeloPrensagem(result);
    const cover = result.thumb || result.cover_image || null;

    setItens(prev => prev.map(item => {
      if (item.id === itemPesquisa.id) {
        return {
          ...item,
          artista: artista || item.artista,
          titulo: titulo || item.titulo,
          ano: year || item.ano,
          selo: selo || item.selo,
          capaUrl: cover || item.capaUrl,
          confianca: 'alta',
          selecionado: true
        };
      }
      return item;
    }));

    setItemPesquisa(null);
    setResultadosPesquisa([]);
  };

  // Salvar itens aprovados no banco de dados
  const salvarAprovados = async () => {
    const aprovados = itens.filter(item => item.selecionado && item.titulo?.trim());
    if (aprovados.length === 0) {
      return setMensagem({ tipo: 'error', texto: 'Nenhum disco selecionado com título preenchido.' });
    }

    setSalvando(true);
    setProgressoSalvar({ atual: 0, total: aprovados.length });
    setMensagem(null);

    let salvosCount = 0;
    const idsSalvos = [];

    for (let i = 0; i < aprovados.length; i++) {
      setProgressoSalvar({ atual: i + 1, total: aprovados.length });
      const item = aprovados[i];

      try {
        const finalCaixa = item.caixa?.trim() ? normalizeCaixa(item.caixa.trim(), loja) : (caixaPadrao ? normalizeCaixa(caixaPadrao, loja) : null);
        const precoNumerico = Number(String(item.preco || '0').replace(/\D/g, '')) || 0;

        // Inclui o selo e ano formatados na observação [Selo • Ano] se disponíveis
        let finalObservacao = null;
        if (item.selo?.trim() || item.ano?.trim()) {
          const tag = [item.selo?.trim(), item.ano?.trim()].filter(Boolean).join(' • ');
          if (tag) finalObservacao = `[${tag}]`;
        }

        const insertData = {
          titulo: item.titulo.trim(),
          artista: item.artista?.trim() || null,
          ano: item.ano?.trim() || null,
          preco: precoNumerico,
          loja: loja || null,
          caixa: finalCaixa,
          observacao: finalObservacao,
          ativo: true,
          capa_url: item.capaUrl || null
        };

        const itemCriado = await itemService.addItem(tipo, insertData);

        // Movimentação de entrada
        const movData = movimentacaoService.createMovementPayload(tipo, itemCriado.id, 'entrada', 1, 'Cadastro em lote por fotos');
        await movimentacaoService.registerMovement(movData);

        salvosCount++;
        idsSalvos.push(item.id);
      } catch (err) {
        console.error(`Erro ao cadastrar disco ${item.titulo}:`, err);
      }
    }

    setSalvando(false);
    // Remove os itens que foram salvos da lista atual
    setItens(prev => prev.filter(item => !idsSalvos.includes(item.id)));
    const restantes = itens.length - salvosCount;
    setSucessoFinal(
      restantes > 0 
        ? `${salvosCount} disco(s) cadastrado(s) com sucesso na ${loja}! (${restantes} foto(s) pendente(s) continuam na lista).`
        : `${salvosCount} disco(s) cadastrado(s) com sucesso na ${loja}!`
    );
  };

  const totalSelecionados = itens.filter(i => i.selecionado).length;
  const vaziosCount = itens.filter(i => !i.titulo?.trim() && !i.artista?.trim()).length;

  return (
    <div className="pageContainer" style={{ maxWidth: '1000px', margin: '0 auto', paddingBottom: 'calc(var(--bottom-nav-height, 62px) + 32px)' }}>
      
      {/* Top Header */}
      <div className="lote-fotos-top-header">
        <div className="titleGroup" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <FaCamera size={22} color="var(--accent)" />
          <h1 className="page-title" style={{ margin: 0, fontSize: '20px', letterSpacing: '-0.025em' }}>Cadastro por Fotos</h1>
        </div>
        <Link href="/" className="btn lote-fotos-back-btn">
          Voltar
        </Link>
      </div>

      {mensagem && <AlertMessage tipo={mensagem.tipo} texto={mensagem.texto} onClose={() => setMensagem(null)} />}
      
      {sucessoFinal && (
        <div className="lote-fotos-success-alert">
          <MdCheckCircle size={20} />
          <span style={{ fontWeight: 600, fontSize: '13px' }}>{sucessoFinal}</span>
        </div>
      )}

      {/* Configuração Rápida do Lote */}
      <div className="lote-fotos-config-card">
        <div className="lote-fotos-config-grid">
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Loja</label>
            <select value={loja} onChange={(e) => setLoja(e.target.value)}>
              {STORE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Caixa Padrão</label>
            <input 
              type="text" 
              list="caixas-lote-list" 
              value={caixaPadrao} 
              onChange={(e) => setCaixaPadrao(e.target.value)} 
              placeholder="Ex: 15, 49..."
            />
            <datalist id="caixas-lote-list">
              {caixas.map(c => <option key={`${c.caixa}-${c.loja}`} value={c.caixa}>{c.label}</option>)}
            </datalist>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Preço Padrão</label>
            <input 
              type="text" 
              inputMode="numeric"
              value={precoPadrao} 
              onChange={(e) => setPrecoPadrao(e.target.value)} 
              placeholder="R$ (opcional)"
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Formato</label>
            <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
              <option value={CATEGORY_IDS.DISCOS}>Vinil</option>
              <option value={CATEGORY_IDS.CDS}>CD</option>
            </select>
          </div>
        </div>
      </div>

      {/* Área de Adição de Fotos */}
      <div 
        onClick={() => !processando && fileInputRef.current?.click()}
        className={`lote-fotos-dropzone ${processando ? 'is-processing' : ''}`}
      >
        <input 
          ref={fileInputRef} 
          type="file" 
          multiple 
          accept="image/*" 
          onChange={handleFilesSelected} 
          style={{ display: 'none' }}
          disabled={processando}
        />
        <div className="lote-fotos-dropzone-icon">
          <FaCamera size={18} color="#ffffff" />
        </div>
        <div className="lote-fotos-dropzone-text">
          {processando ? (statusProgresso || `Processando foto ${progresso.atual} de ${progresso.total}...`) : 'Adicionar fotos (câmera ou galeria)'}
        </div>
        {processando && (
          <div className="lote-fotos-progress-track">
            <div className="lote-fotos-progress-bar" style={{ width: `${(progresso.atual / (progresso.total || 1)) * 100}%` }}></div>
          </div>
        )}
      </div>

      {/* Lista de Discos */}
      {itens.length > 0 && (
        <div>
          {/* Barra de Ações em Massa */}
          <div className="lote-fotos-actions-bar">
            <label className="lote-fotos-select-all-label">
              <input 
                type="checkbox" 
                checked={todosSelecionados} 
                onChange={toggleSelecionarTudo}
                style={{ width: '18px', height: '18px', accentColor: 'var(--accent)', cursor: 'pointer' }}
              />
              <FaCheckDouble size={13} color="var(--accent)" />
              Selecionar Tudo ({totalSelecionados}/{itens.length})
            </label>

            <div className="lote-fotos-actions-tools">
              {vaziosCount > 0 && (
                <button 
                  type="button" 
                  className="btn lote-fotos-btn-vazios" 
                  onClick={reprocessarVazios}
                  disabled={salvando || processando}
                  title="Tentar reconhecer novamente fotos que ficaram vazias"
                >
                  <IoRefresh size={14} style={{ animation: processando ? 'spin 1s linear infinite' : 'none' }} />
                  Tentar Vazios ({vaziosCount})
                </button>
              )}

              <button 
                type="button" 
                className="btn lote-fotos-btn-secondary" 
                onClick={limparLote}
                disabled={salvando || processando}
              >
                Limpar
              </button>

              <button 
                type="button" 
                className="btn btn-primary lote-fotos-btn-submit" 
                onClick={salvarAprovados}
                disabled={salvando || totalSelecionados === 0}
              >
                {salvando ? `Salvando (${progressoSalvar.atual}/${progressoSalvar.total})...` : (
                  <>
                    <FaCheck size={12} /> Cadastrar ({totalSelecionados})
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Cards Mobile-First */}
          <div className="lote-fotos-list">
            {itens.map((item, idx) => (
              <div 
                key={item.id}
                className={`lote-fotos-card ${item.selecionado ? 'selected' : ''}`}
              >
                {/* Linha 1: Seleção, Número, Selo, Ações */}
                <div className="lote-fotos-card-header">
                  <div className="lote-fotos-card-header-left">
                    <input 
                      type="checkbox" 
                      checked={item.selecionado} 
                      onChange={() => toggleItem(item.id)}
                      style={{ width: '20px', height: '20px', accentColor: 'var(--accent)', cursor: 'pointer' }}
                    />
                    <span className="lote-fotos-card-idx">
                      #{idx + 1}
                    </span>
                    {(!item.titulo?.trim() && !item.artista?.trim()) && (
                      <span className="lote-fotos-badge-empty">
                        NÃO IDENTIFICADO
                      </span>
                    )}
                    {item.selo && (
                      <span className="lote-fotos-badge-selo">
                        {item.selo.toUpperCase()}
                      </span>
                    )}
                  </div>

                  <div className="lote-fotos-card-header-actions">
                    {(!item.titulo?.trim() && !item.artista?.trim()) && (
                      <button 
                        type="button" 
                        onClick={() => reprocessarItem(item.id)}
                        disabled={item.processandoItem || processando || salvando}
                        className="btn lote-fotos-item-btn-retry"
                        title="Tentar reconhecer foto novamente"
                      >
                        <IoRefresh size={12} style={{ animation: item.processandoItem ? 'spin 1s linear infinite' : 'none' }} />
                        {item.processandoItem ? 'Lendo...' : 'Reconhecer'}
                      </button>
                    )}
                    <button 
                      type="button" 
                      onClick={() => abrirPesquisaDiscogs(item)}
                      className="btn lote-fotos-item-btn"
                      title="Procurar outra edição no Discogs"
                    >
                      <FaMagnifyingGlass size={10} /> Trocar
                    </button>
                    <button 
                      type="button" 
                      onClick={() => removerItem(item.id)}
                      className="lote-fotos-item-btn-remove"
                      title="Remover"
                    >
                      <FaTrash size={12} />
                    </button>
                  </div>
                </div>

                {/* Linha 2: Capas + Título & Artista */}
                <div className="lote-fotos-card-body">
                  {/* Capas lado a lado */}
                  <div className="lote-fotos-covers-wrap">
                    <div className="lote-fotos-cover-thumb" title="Foto Real">
                      {item.fotoPreview ? (
                        <img 
                          src={item.fotoPreview} 
                          alt=""
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : null}
                      <div className="lote-fotos-cover-placeholder">
                        <FaCamera size={18} color="var(--text-muted)" />
                      </div>
                    </div>

                    <div className="lote-fotos-cover-thumb" title="Capa Discogs">
                      {item.capaUrl ? (
                        <img 
                          src={item.capaUrl} 
                          alt=""
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : null}
                      <div className="lote-fotos-cover-placeholder">
                        <PiVinylRecord size={22} color="var(--text-muted)" />
                      </div>
                    </div>
                  </div>

                  {/* Campos Principais: Título e Artista */}
                  <div className="lote-fotos-fields-main">
                    <input 
                      type="text" 
                      value={item.titulo} 
                      onChange={(e) => atualizarItem(item.id, 'titulo', e.target.value)}
                      placeholder="Título do álbum *"
                      className="lote-fotos-input-titulo"
                    />
                    <input 
                      type="text" 
                      value={item.artista} 
                      onChange={(e) => atualizarItem(item.id, 'artista', e.target.value)}
                      placeholder="Artista"
                      className="lote-fotos-input-artista"
                    />
                  </div>
                </div>

                {/* Linha 3: Detalhes compactos (Ano, Preço, Caixa) */}
                <div className="lote-fotos-card-grid-details">
                  <div>
                    <input 
                      type="text" 
                      value={item.ano} 
                      onChange={(e) => atualizarItem(item.id, 'ano', e.target.value)}
                      placeholder="Ano"
                      className="lote-fotos-input-detail"
                    />
                  </div>
                  <div>
                    <input 
                      type="text" 
                      inputMode="numeric"
                      value={item.preco} 
                      onChange={(e) => atualizarItem(item.id, 'preco', e.target.value)}
                      placeholder="Preço R$"
                      className="lote-fotos-input-detail"
                    />
                  </div>
                  <div>
                    <input 
                      type="text" 
                      value={item.caixa} 
                      onChange={(e) => atualizarItem(item.id, 'caixa', e.target.value)}
                      placeholder={caixaPadrao || "Caixa"}
                      className="lote-fotos-input-detail"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal de Busca Manual no Discogs */}
      {itemPesquisa && (
        <div className="lote-fotos-modal-overlay">
          <div className="lote-fotos-modal-content">
            <div className="lote-fotos-modal-header">
              <h3 className="lote-fotos-modal-title">Buscar no Discogs</h3>
              <button 
                type="button" 
                onClick={() => setItemPesquisa(null)}
                className="lote-fotos-modal-close"
              >
                ✕
              </button>
            </div>

            <div className="lote-fotos-modal-search-wrap">
              <form onSubmit={executarPesquisaManual} className="lote-fotos-modal-search-form">
                <input 
                  type="text" 
                  value={queryPesquisa} 
                  onChange={(e) => setQueryPesquisa(e.target.value)} 
                  placeholder="Artista ou álbum..."
                  className="lote-fotos-modal-input"
                  autoFocus
                />
                <button type="submit" className="btn btn-primary lote-fotos-modal-submit" disabled={buscandoPesquisa}>
                  {buscandoPesquisa ? '...' : 'Buscar'}
                </button>
              </form>
            </div>

            <div className="lote-fotos-modal-results">
              {resultadosPesquisa.length > 0 ? (
                <div className="lote-fotos-modal-results-list">
                  {resultadosPesquisa.map(res => (
                    <div 
                      key={res.id} 
                      onClick={() => aplicarResultadoPesquisa(res)}
                      className="lote-fotos-modal-result-item"
                    >
                      {res.thumb ? (
                        <img src={res.thumb} alt="" className="lote-fotos-result-thumb" />
                      ) : (
                        <div className="lote-fotos-result-thumb-placeholder">
                          <PiVinylRecord size={18} color="var(--text-muted)" />
                        </div>
                      )}
                      <div className="lote-fotos-result-info">
                        <div className="lote-fotos-result-title">
                          {res.title}
                        </div>
                        <div className="lote-fotos-result-meta">
                          {[res.year, res.country, res.format?.join(', ')].filter(Boolean).join(' • ')}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="lote-fotos-modal-empty">
                  {buscandoPesquisa ? 'Buscando...' : 'Digite para buscar.'}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
