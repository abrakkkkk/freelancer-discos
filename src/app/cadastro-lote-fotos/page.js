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
      const precoGemini = geminiData?.preco ? String(geminiData.preco) : '';
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
          preco: precoGemini || it.preco,
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
        const precoGemini = geminiData?.preco ? String(geminiData.preco) : '';
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
          preco: precoGemini || precoPadrao || '',
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', width: '100%' }}>
        <div className="titleGroup" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <FaCamera size={22} color="var(--accent)" />
          <h1 className="page-title" style={{ margin: 0, fontSize: '20px', letterSpacing: '-0.025em' }}>Cadastro por Fotos</h1>
        </div>
        <Link href="/" className="btn btn-secondary" style={{ fontSize: '12px', padding: '5px 12px', minHeight: '32px', display: 'inline-flex', alignItems: 'center' }}>
          Voltar
        </Link>
      </div>

      {mensagem && <AlertMessage tipo={mensagem.tipo} texto={mensagem.texto} onClose={() => setMensagem(null)} />}
      
      {sucessoFinal && (
        <div style={{ background: 'rgba(56, 161, 105, 0.15)', border: '1px solid rgba(56, 161, 105, 0.3)', color: '#48bb78', padding: '12px 14px', borderRadius: '8px', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <MdCheckCircle size={20} />
          <span style={{ fontWeight: 600, fontSize: '13px' }}>{sucessoFinal}</span>
        </div>
      )}

      {/* Configuração Rápida do Lote */}
      <div className="filterCard" style={{ marginBottom: '14px', padding: '12px 14px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '3px' }}>Loja</label>
            <select value={loja} onChange={(e) => setLoja(e.target.value)} style={{ fontSize: '14px', height: '36px' }}>
              {STORE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '3px' }}>Caixa Padrão</label>
            <input 
              type="text" 
              list="caixas-lote-list" 
              value={caixaPadrao} 
              onChange={(e) => setCaixaPadrao(e.target.value)} 
              placeholder="Ex: 15, 49..."
              style={{ fontSize: '14px', height: '36px' }}
            />
            <datalist id="caixas-lote-list">
              {caixas.map(c => <option key={`${c.caixa}-${c.loja}`} value={c.caixa}>{c.label}</option>)}
            </datalist>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '3px' }}>Preço Padrão</label>
            <input 
              type="text" 
              inputMode="numeric"
              value={precoPadrao} 
              onChange={(e) => setPrecoPadrao(e.target.value)} 
              placeholder="R$ (opcional)"
              style={{ fontSize: '14px', height: '36px' }}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '3px' }}>Formato</label>
            <select value={tipo} onChange={(e) => setTipo(e.target.value)} style={{ fontSize: '14px', height: '36px' }}>
              <option value={CATEGORY_IDS.DISCOS}>Vinil</option>
              <option value={CATEGORY_IDS.CDS}>CD</option>
            </select>
          </div>
        </div>
      </div>

      {/* Área de Adição de Fotos */}
      <div 
        onClick={() => !processando && fileInputRef.current?.click()}
        style={{
          border: '1.5px dashed var(--border)',
          borderRadius: '10px',
          padding: '18px 14px',
          textAlign: 'center',
          cursor: processando ? 'wait' : 'pointer',
          background: 'rgba(255, 255, 255, 0.015)',
          marginBottom: '16px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '6px'
        }}
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
        <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(197, 48, 48, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <FaCamera size={18} color="var(--accent)" />
        </div>
        <div style={{ fontSize: '14px', fontWeight: 600 }}>
          {processando ? (statusProgresso || `Processando foto ${progresso.atual} de ${progresso.total}...`) : 'Adicionar fotos (câmera ou galeria)'}
        </div>
        {processando && (
          <div style={{ width: '100%', maxWidth: '240px', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden', marginTop: '4px' }}>
            <div style={{ width: `${(progresso.atual / (progresso.total || 1)) * 100}%`, height: '100%', background: 'var(--accent)', transition: 'width 0.3s ease' }}></div>
          </div>
        )}
      </div>

      {/* Lista de Discos */}
      {itens.length > 0 && (
        <div>
          {/* Barra de Ações em Massa */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            padding: '8px 12px',
            marginBottom: '10px',
            flexWrap: 'wrap',
            gap: '8px'
          }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '13px', margin: 0, minHeight: '36px' }}>
              <input 
                type="checkbox" 
                checked={todosSelecionados} 
                onChange={toggleSelecionarTudo}
                style={{ width: '18px', height: '18px', accentColor: 'var(--accent)', cursor: 'pointer' }}
              />
              <FaCheckDouble size={13} color="var(--accent)" />
              Selecionar Tudo ({totalSelecionados}/{itens.length})
            </label>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {vaziosCount > 0 && (
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={reprocessarVazios}
                  style={{ fontSize: '12px', padding: '6px 12px', minHeight: '34px', display: 'flex', alignItems: 'center', gap: '6px', borderColor: 'rgba(236, 201, 75, 0.4)', color: '#ecc94b' }}
                  disabled={salvando || processando}
                  title="Tentar reconhecer novamente fotos que ficaram vazias"
                >
                  <IoRefresh size={14} style={{ animation: processando ? 'spin 1s linear infinite' : 'none' }} />
                  Tentar Vazios ({vaziosCount})
                </button>
              )}

              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={limparLote}
                style={{ fontSize: '12px', padding: '6px 12px', minHeight: '34px' }}
                disabled={salvando || processando}
              >
                Limpar
              </button>

              <button 
                type="button" 
                className="btn btn-primary" 
                onClick={salvarAprovados}
                disabled={salvando || totalSelecionados === 0}
                style={{ fontSize: '13px', padding: '6px 14px', minHeight: '34px', display: 'flex', alignItems: 'center', gap: '6px' }}
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {itens.map((item, idx) => (
              <div 
                key={item.id}
                style={{
                  background: 'var(--bg-card)',
                  border: item.selecionado ? '1px solid rgba(197, 48, 48, 0.45)' : '1px solid var(--border)',
                  borderRadius: '10px',
                  padding: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  position: 'relative'
                }}
              >
                {/* Linha 1: Seleção, Número, Selo, Ações */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input 
                      type="checkbox" 
                      checked={item.selecionado} 
                      onChange={() => toggleItem(item.id)}
                      style={{ width: '20px', height: '20px', accentColor: 'var(--accent)', cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>
                      #{idx + 1}
                    </span>
                    {(!item.titulo?.trim() && !item.artista?.trim()) && (
                      <span style={{
                        fontSize: '10px',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontWeight: 600,
                        background: 'rgba(236, 201, 75, 0.15)',
                        color: '#ecc94b',
                        border: '1px solid rgba(236, 201, 75, 0.3)'
                      }}>
                        NÃO IDENTIFICADO
                      </span>
                    )}
                    {item.selo && (
                      <span style={{
                        fontSize: '10px',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontWeight: 600,
                        background: 'rgba(167, 139, 250, 0.15)',
                        color: '#c084fc',
                        border: '1px solid rgba(167, 139, 250, 0.3)'
                      }}>
                        {item.selo.toUpperCase()}
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {(!item.titulo?.trim() && !item.artista?.trim()) && (
                      <button 
                        type="button" 
                        onClick={() => reprocessarItem(item.id)}
                        disabled={item.processandoItem || processando || salvando}
                        className="btn btn-secondary"
                        style={{
                          fontSize: '11px',
                          padding: '4px 8px',
                          minHeight: '28px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          borderColor: 'rgba(236, 201, 75, 0.4)',
                          color: '#ecc94b'
                        }}
                        title="Tentar reconhecer foto novamente"
                      >
                        <IoRefresh size={12} style={{ animation: item.processandoItem ? 'spin 1s linear infinite' : 'none' }} />
                        {item.processandoItem ? 'Lendo...' : 'Reconhecer'}
                      </button>
                    )}
                    <button 
                      type="button" 
                      onClick={() => abrirPesquisaDiscogs(item)}
                      className="btn btn-secondary"
                      style={{
                        fontSize: '11px',
                        padding: '4px 8px',
                        minHeight: '28px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                      title="Procurar outra edição no Discogs"
                    >
                      <FaMagnifyingGlass size={10} /> Trocar
                    </button>
                    <button 
                      type="button" 
                      onClick={() => removerItem(item.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minWidth: '32px',
                        minHeight: '32px'
                      }}
                      title="Remover"
                    >
                      <FaTrash size={12} />
                    </button>
                  </div>
                </div>

                {/* Linha 2: Capas + Título & Artista */}
                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  {/* Capas lado a lado */}
                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                    <div style={{ width: '56px', height: '56px', position: 'relative', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.03)' }} title="Foto Real">
                      {item.fotoPreview ? (
                        <img 
                          src={item.fotoPreview} 
                          alt=""
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : null}
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: -1 }}>
                        <FaCamera size={18} color="var(--text-muted)" />
                      </div>
                    </div>

                    <div style={{ width: '56px', height: '56px', position: 'relative', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.03)' }} title="Capa Discogs">
                      {item.capaUrl ? (
                        <img 
                          src={item.capaUrl} 
                          alt=""
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : null}
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: -1 }}>
                        <PiVinylRecord size={22} color="var(--text-muted)" />
                      </div>
                    </div>
                  </div>

                  {/* Campos Principais: Título e Artista (16px em mobile evita zoom indesejado) */}
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <input 
                      type="text" 
                      value={item.titulo} 
                      onChange={(e) => atualizarItem(item.id, 'titulo', e.target.value)}
                      placeholder="Título do álbum *"
                      style={{ width: '100%', fontSize: '15px', fontWeight: 600, padding: '6px 8px', height: '36px' }}
                    />
                    <input 
                      type="text" 
                      value={item.artista} 
                      onChange={(e) => atualizarItem(item.id, 'artista', e.target.value)}
                      placeholder="Artista"
                      style={{ width: '100%', fontSize: '14px', padding: '6px 8px', height: '34px' }}
                    />
                  </div>
                </div>

                {/* Linha 3: Detalhes compactos (Ano, Preço, Caixa) */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                  <div>
                    <input 
                      type="text" 
                      value={item.ano} 
                      onChange={(e) => atualizarItem(item.id, 'ano', e.target.value)}
                      placeholder="Ano"
                      style={{ width: '100%', fontSize: '13px', padding: '6px 8px', height: '34px' }}
                    />
                  </div>
                  <div>
                    <input 
                      type="text" 
                      inputMode="numeric"
                      value={item.preco} 
                      onChange={(e) => atualizarItem(item.id, 'preco', e.target.value)}
                      placeholder="Preço R$"
                      style={{ width: '100%', fontSize: '13px', padding: '6px 8px', height: '34px' }}
                    />
                  </div>
                  <div>
                    <input 
                      type="text" 
                      value={item.caixa} 
                      onChange={(e) => atualizarItem(item.id, 'caixa', e.target.value)}
                      placeholder={caixaPadrao || "Caixa"}
                      style={{ width: '100%', fontSize: '13px', padding: '6px 8px', height: '34px' }}
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
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.85)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '12px'
        }}>
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            maxWidth: '520px',
            width: '100%',
            maxHeight: 'calc(100vh - 32px)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>Buscar no Discogs</h3>
              <button 
                type="button" 
                onClick={() => setItemPesquisa(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '18px', cursor: 'pointer', minWidth: '44px', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: '12px 16px' }}>
              <form onSubmit={executarPesquisaManual} style={{ display: 'flex', gap: '8px' }}>
                <input 
                  type="text" 
                  value={queryPesquisa} 
                  onChange={(e) => setQueryPesquisa(e.target.value)} 
                  placeholder="Artista ou álbum..."
                  style={{ flex: 1, fontSize: '15px', height: '40px' }}
                  autoFocus
                />
                <button type="submit" className="btn btn-primary" disabled={buscandoPesquisa} style={{ height: '40px', padding: '0 16px' }}>
                  {buscandoPesquisa ? '...' : 'Buscar'}
                </button>
              </form>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 16px' }}>
              {resultadosPesquisa.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {resultadosPesquisa.map(res => (
                    <div 
                      key={res.id} 
                      onClick={() => aplicarResultadoPesquisa(res)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '10px',
                        background: 'rgba(255, 255, 255, 0.02)',
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        minHeight: '48px'
                      }}
                    >
                      {res.thumb ? (
                        <img src={res.thumb} alt="" style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px', flexShrink: 0 }} />
                      ) : (
                        <div style={{ width: '40px', height: '40px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <PiVinylRecord size={18} color="var(--text-muted)" />
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {res.title}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {[res.year, res.country, res.format?.join(', ')].filter(Boolean).join(' • ')}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px 0', fontSize: '13px' }}>
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
