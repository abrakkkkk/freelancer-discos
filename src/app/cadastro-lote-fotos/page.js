'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { FaCamera, FaCheck, FaTrash, FaMagnifyingGlass, FaCheckDouble, FaExclamationTriangle } from "react-icons/fa6";
import { MdInventory2, MdCheckCircle } from "react-icons/md";
import { PiVinylRecord } from "react-icons/pi";
import { useCaixas } from '@/hooks/useCaixas';
import { useStore } from '@/contexts/StoreContext';
import { itemService } from '@/services/itemService';
import { movimentacaoService } from '@/services/movimentacaoService';
import { fetchDiscogs, extractSeloPrensagem } from '@/utils/discogsClient';
import { normalizeCaixa, cleanDiscogsString } from '@/utils/stringUtils';
import { CATEGORY_IDS, STORE_OPTIONS } from '@/constants/config';
import AlertMessage from '@/components/AlertMessage';

// Helper para redimensionar imagem no cliente via Canvas (evita uploads de 5MB do celular)
// Helper resiliente para redimensionar imagem no cliente via Canvas (evita uploads pesados e vazamento de RAM)
async function resizeImage(file, maxDimension = 800) {
  return new Promise((resolve) => {
    let blobUrl = '';
    try {
      blobUrl = URL.createObjectURL(file);
    } catch (_) {
      blobUrl = '';
    }

    if (!blobUrl) {
      return resolve({ dataUrl: null, previewUrl: '' });
    }

    const img = new Image();
    img.onload = () => {
      try {
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDimension) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        // Libera memória do canvas imediatamente
        canvas.width = 0;
        canvas.height = 0;

        resolve({
          dataUrl,
          previewUrl: blobUrl
        });
      } catch (err) {
        console.warn('Erro no canvas resize:', err);
        resolve({
          dataUrl: null,
          previewUrl: blobUrl
        });
      }
    };

    img.onerror = () => {
      console.warn('Erro ao decodificar imagem para preview:', file.name);
      resolve({
        dataUrl: null,
        previewUrl: blobUrl
      });
    };

    img.src = blobUrl;
  });
}

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

  // Upload e processamento das fotos com streaming visual e proteção anti-bloqueio
  const handleFilesSelected = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setMensagem(null);
    setSucessoFinal(null);
    setProcessando(true);
    setProgresso({ atual: 0, total: files.length });

    for (let i = 0; i < files.length; i++) {
      setProgresso({ atual: i + 1, total: files.length });
      const file = files[i];

      // Pacing inteligente entre fotos para evitar bloqueio por RPM
      if (i > 0) {
        await new Promise(r => setTimeout(r, 600));
      }

      try {
        // 1. Redimensiona a foto de forma leve com Blob Object URL (consome zero RAM extra)
        const { dataUrl, previewUrl } = await resizeImage(file, 800);

        // 2. Chama Gemini Vision com retentativa se der erro transitório/rate limit
        let geminiData = null;
        if (dataUrl) {
          try {
            let res = await fetch('/api/recognize-cover', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ image: dataUrl })
            });

            // Se recebeu 429 ou erro temporário de rate limit, aguarda 1.5s e tenta mais uma vez
            if (res.status === 429 || res.status === 502) {
              await new Promise(r => setTimeout(r, 1500));
              res = await fetch('/api/recognize-cover', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: dataUrl })
              });
            }

            if (res.ok) {
              geminiData = await res.json();
            }
          } catch (err) {
            console.warn('Erro ao chamar recognize-cover:', err);
          }
        }

        const artistaGemini = (geminiData?.artista || '').trim();
        const tituloGemini = (geminiData?.titulo || '').trim();
        const anoGemini = (geminiData?.ano || '').trim();
        const confianca = geminiData?.confianca || (artistaGemini || tituloGemini ? 'media' : 'baixa');

        // 3. Enriquecimento via Discogs se houver termos
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

        // Extrai artista e título com inteligência se o Discogs tiver encontrado
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

        const novoItem = {
          id: `item-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 4)}`,
          fotoPreview: previewUrl,
          artista: finalArtista,
          titulo: finalTitulo,
          ano: finalAno,
          preco: precoPadrao || '',
          caixa: caixaPadrao || '',
          selo: seloDetectado,
          capaUrl: finalCapa,
          confianca,
          discogsResults: discogsMatch ? [discogsMatch] : [],
          selecionado: true // Sempre selecionado por padrão para edição em lote
        };

        // Adiciona PROGRESSIVAMENTE para que o usuário veja cada disco aparecer na hora
        setItens(prev => [...prev, novoItem]);
      } catch (err) {
        console.error(`Erro ao processar arquivo ${file.name}:`, err);
        // Mesmo com erro inesperado, adiciona o card com a foto preservada para não perder o disco
        let fallbackUrl = '';
        try { fallbackUrl = URL.createObjectURL(file); } catch (_) {}
        setItens(prev => [...prev, {
          id: `item-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 4)}`,
          fotoPreview: fallbackUrl,
          artista: '',
          titulo: '',
          ano: '',
          preco: precoPadrao || '',
          caixa: caixaPadrao || '',
          selo: '',
          capaUrl: null,
          confianca: 'baixa',
          discogsResults: [],
          selecionado: true
        }]);
      }
    }

    setProcessando(false);
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

        // Se for Caixa 49, 50 ou 51, inclui o selo e ano formatados na observação
        let finalObservacao = null;
        const isCaixaNova = ['49', '50', '51', 'Caixa 49', 'Caixa 50', 'Caixa 51'].includes(String(finalCaixa || '').trim());
        if (isCaixaNova && (item.selo?.trim() || item.ano?.trim())) {
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
    setSucessoFinal(`${salvosCount} disco(s) cadastrado(s) com sucesso na ${loja}!`);
  };

  const totalSelecionados = itens.filter(i => i.selecionado).length;

  return (
    <div className="pageContainer" style={{ maxWidth: '1100px', margin: '0 auto', padding: '16px' }}>
      
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1 className="page-title" style={{ margin: 0, fontSize: '22px' }}>Cadastro em Lote por Fotos</h1>
            <span style={{ fontSize: '10px', background: 'rgba(234, 179, 8, 0.15)', color: '#eab308', border: '1px solid rgba(234, 179, 8, 0.3)', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
              TESTE PRIVADO
            </span>
          </div>
          <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            Faça upload das fotos das capas e compare o reconhecimento lado a lado sem alucinações.
          </span>
        </div>
        <Link href="/" className="btn btn-secondary" style={{ fontSize: '13px' }}>
          ← Voltar ao Acervo
        </Link>
      </div>

      {mensagem && <AlertMessage tipo={mensagem.tipo} texto={mensagem.texto} onClose={() => setMensagem(null)} />}
      
      {sucessoFinal && (
        <div style={{ background: 'rgba(56, 161, 105, 0.15)', border: '1px solid rgba(56, 161, 105, 0.3)', color: '#48bb78', padding: '14px', borderRadius: '8px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <MdCheckCircle size={22} />
          <span style={{ fontWeight: 600 }}>{sucessoFinal}</span>
        </div>
      )}

      {/* Painel de Configuração do Lote */}
      <div className="form-section-card" style={{ marginBottom: '20px' }}>
        <div className="form-section-header">
          <MdInventory2 size={18} color="var(--accent)" />
          <h3 className="form-section-title">1. Configuração do Lote</h3>
        </div>

        <div className="form-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Loja *</label>
            <select value={loja} onChange={(e) => setLoja(e.target.value)}>
              {STORE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Categoria</label>
            <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
              <option value={CATEGORY_IDS.DISCOS}>Discos de Vinil</option>
              <option value={CATEGORY_IDS.CDS}>CDs</option>
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Caixa Padrão</label>
            <input 
              type="text" 
              list="caixas-lote-list" 
              value={caixaPadrao} 
              onChange={(e) => setCaixaPadrao(e.target.value)} 
              placeholder="Ex: 15, 49, 50..."
            />
            <datalist id="caixas-lote-list">
              {caixas.map(c => <option key={`${c.caixa}-${c.loja}`} value={c.caixa}>{c.label}</option>)}
            </datalist>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Preço Padrão (Opcional)</label>
            <input 
              type="text" 
              value={precoPadrao} 
              onChange={(e) => setPrecoPadrao(e.target.value)} 
              placeholder="Ex: 60"
            />
          </div>
        </div>
      </div>

      {/* Área de Upload de Fotos */}
      <div 
        onClick={() => !processando && fileInputRef.current?.click()}
        style={{
          border: '2px dashed var(--border)',
          borderRadius: '12px',
          padding: '32px 20px',
          textAlign: 'center',
          cursor: processando ? 'wait' : 'pointer',
          background: 'rgba(255, 255, 255, 0.02)',
          transition: 'all 0.2s ease',
          marginBottom: '24px'
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
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(255, 107, 0, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FaCamera size={26} color="var(--accent)" />
          </div>
          <span style={{ fontSize: '16px', fontWeight: 600 }}>
            {processando ? `Analisando foto ${progresso.atual} de ${progresso.total}...` : 'Clique para selecionar fotos ou tirar com a câmera'}
          </span>
          <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            Você pode escolher várias fotos de uma só vez. A IA e o Discogs farão o reconhecimento inicial.
          </span>
          {processando && (
            <div style={{ width: '100%', maxWidth: '300px', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden', marginTop: '8px' }}>
              <div style={{ width: `${(progresso.atual / (progresso.total || 1)) * 100}%`, height: '100%', background: 'var(--accent)', transition: 'width 0.3s ease' }}></div>
            </div>
          )}
        </div>
      </div>

      {/* Mesa de Comparação Anti-Alucinação */}
      {itens.length > 0 && (
        <div style={{ marginBottom: '40px' }}>
          
          {/* Barra de Ações em Massa */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            padding: '12px 16px',
            marginBottom: '16px',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '14px', margin: 0 }}>
                <input 
                  type="checkbox" 
                  checked={todosSelecionados} 
                  onChange={toggleSelecionarTudo}
                  style={{ width: '18px', height: '18px', accentColor: 'var(--accent)', cursor: 'pointer' }}
                />
                <FaCheckDouble size={14} color="var(--accent)" />
                Selecionar Tudo ({totalSelecionados}/{itens.length})
              </label>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={limparLote}
                style={{ fontSize: '13px', padding: '6px 12px' }}
                disabled={salvando}
              >
                Limpar Lote
              </button>

              <button 
                type="button" 
                className="btn btn-primary" 
                onClick={salvarAprovados}
                disabled={salvando || totalSelecionados === 0}
                style={{ fontSize: '14px', padding: '8px 18px', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                {salvando ? `Cadastrando (${progressoSalvar.atual}/${progressoSalvar.total})...` : (
                  <>
                    <FaCheck size={14} /> Cadastrar Selecionados ({totalSelecionados})
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Grid de Cards de Comparação */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {itens.map((item, idx) => (
              <div 
                key={item.id}
                style={{
                  background: 'var(--bg-card)',
                  border: item.selecionado ? '1px solid rgba(255, 107, 0, 0.4)' : '1px solid var(--border)',
                  borderRadius: '10px',
                  padding: '14px',
                  display: 'flex',
                  gap: '16px',
                  alignItems: 'flex-start',
                  flexWrap: 'wrap',
                  position: 'relative',
                  boxShadow: item.selecionado ? '0 0 10px rgba(255, 107, 0, 0.05)' : 'none'
                }}
              >
                {/* Checkbox de seleção */}
                <div style={{ paddingTop: '4px' }}>
                  <input 
                    type="checkbox" 
                    checked={item.selecionado} 
                    onChange={() => toggleItem(item.id)}
                    style={{ width: '20px', height: '20px', accentColor: 'var(--accent)', cursor: 'pointer' }}
                  />
                </div>

                {/* Coluna 1: Foto Real Original Tirada */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', width: '100px', flexShrink: 0 }}>
                  <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Foto Real</span>
                  <div style={{ width: '100px', height: '100px', position: 'relative', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.03)' }}>
                    {item.fotoPreview ? (
                      <img 
                        src={item.fotoPreview} 
                        alt={`Foto ${idx + 1}`}
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      />
                    ) : null}
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: -1 }}>
                      <FaCamera size={26} color="var(--text-muted)" />
                    </div>
                  </div>
                </div>

                {/* Coluna 2: Capa Oficial Reconhecida (Discogs) */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', width: '100px', flexShrink: 0 }}>
                  <span style={{ fontSize: '10px', fontWeight: 700, color: '#38a169', textTransform: 'uppercase' }}>Capa Discogs</span>
                  <div style={{ width: '100px', height: '100px', position: 'relative', borderRadius: '6px', overflow: 'hidden', border: '1px solid rgba(56, 161, 105, 0.3)', background: 'rgba(255,255,255,0.03)' }}>
                    {item.capaUrl ? (
                      <img 
                        src={item.capaUrl} 
                        alt="Capa Oficial"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      />
                    ) : null}
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: -1 }}>
                      <PiVinylRecord size={36} color="var(--text-muted)" />
                    </div>
                  </div>
                </div>

                {/* Coluna 3: Dados Identificados e Editáveis */}
                <div style={{ flex: 1, minWidth: '260px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  
                  {/* Badges de Confiança e Selo */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <span style={{
                      fontSize: '11px',
                      padding: '2px 7px',
                      borderRadius: '4px',
                      fontWeight: 600,
                      background: item.confianca === 'alta' ? 'rgba(56, 161, 105, 0.15)' : item.confianca === 'media' ? 'rgba(234, 179, 8, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                      color: item.confianca === 'alta' ? '#48bb78' : item.confianca === 'media' ? '#eab308' : '#f87171',
                      border: `1px solid ${item.confianca === 'alta' ? 'rgba(56, 161, 105, 0.3)' : item.confianca === 'media' ? 'rgba(234, 179, 8, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                    }}>
                      {item.confianca === 'alta' ? 'Confiança Alta' : item.confianca === 'media' ? 'Confiança Média' : 'Verificar / Baixa'}
                    </span>

                    {item.selo && (
                      <span style={{
                        fontSize: '11px',
                        padding: '2px 7px',
                        borderRadius: '4px',
                        fontWeight: 600,
                        background: 'rgba(167, 139, 250, 0.15)',
                        color: '#c084fc',
                        border: '1px solid rgba(167, 139, 250, 0.3)'
                      }}>
                        {item.selo.toUpperCase()}
                      </span>
                    )}

                    <button 
                      type="button" 
                      onClick={() => abrirPesquisaDiscogs(item)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--accent)',
                        fontSize: '12px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        marginLeft: 'auto'
                      }}
                      title="Procurar outra edição no Discogs"
                    >
                      <FaMagnifyingGlass size={11} /> Trocar Edição
                    </button>
                  </div>

                  {/* Campos do Disco */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px' }}>
                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px', display: 'block' }}>Artista</label>
                      <input 
                        type="text" 
                        value={item.artista} 
                        onChange={(e) => atualizarItem(item.id, 'artista', e.target.value)}
                        style={{ width: '100%', fontSize: '13px', padding: '6px 8px' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px', display: 'block' }}>Título *</label>
                      <input 
                        type="text" 
                        value={item.titulo} 
                        onChange={(e) => atualizarItem(item.id, 'titulo', e.target.value)}
                        style={{ width: '100%', fontSize: '13px', padding: '6px 8px', fontWeight: 600 }}
                      />
                    </div>
                    <div style={{ maxWidth: '90px' }}>
                      <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px', display: 'block' }}>Ano</label>
                      <input 
                        type="text" 
                        value={item.ano} 
                        onChange={(e) => atualizarItem(item.id, 'ano', e.target.value)}
                        style={{ width: '100%', fontSize: '13px', padding: '6px 8px' }}
                      />
                    </div>
                    <div style={{ maxWidth: '100px' }}>
                      <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px', display: 'block' }}>Preço R$</label>
                      <input 
                        type="text" 
                        value={item.preco} 
                        onChange={(e) => atualizarItem(item.id, 'preco', e.target.value)}
                        placeholder="0"
                        style={{ width: '100%', fontSize: '13px', padding: '6px 8px' }}
                      />
                    </div>
                    <div style={{ maxWidth: '110px' }}>
                      <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px', display: 'block' }}>Caixa</label>
                      <input 
                        type="text" 
                        value={item.caixa} 
                        onChange={(e) => atualizarItem(item.id, 'caixa', e.target.value)}
                        placeholder={caixaPadrao || "Ex: 15"}
                        style={{ width: '100%', fontSize: '13px', padding: '6px 8px' }}
                      />
                    </div>
                  </div>
                </div>

                {/* Botão de Excluir do Lote */}
                <button 
                  type="button" 
                  onClick={() => removerItem(item.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: '6px'
                  }}
                  title="Remover este disco do lote"
                >
                  <FaTrash size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal de Troca de Prensagem / Busca Manual no Discogs */}
      {itemPesquisa && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}>
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            maxWidth: '560px',
            width: '100%',
            maxHeight: '85vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            <div style={{ padding: '16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '16px' }}>Buscar Edição no Discogs</h3>
              <button 
                type="button" 
                onClick={() => setItemPesquisa(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '16px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: '16px' }}>
              <form onSubmit={executarPesquisaManual} style={{ display: 'flex', gap: '8px' }}>
                <input 
                  type="text" 
                  value={queryPesquisa} 
                  onChange={(e) => setQueryPesquisa(e.target.value)} 
                  placeholder="Nome do artista e álbum..."
                  style={{ flex: 1 }}
                  autoFocus
                />
                <button type="submit" className="btn btn-primary" disabled={buscandoPesquisa}>
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
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid var(--border)',
                        borderRadius: '6px',
                        cursor: 'pointer'
                      }}
                    >
                      {res.thumb ? (
                        <img src={res.thumb} alt="" style={{ width: '42px', height: '42px', objectFit: 'cover', borderRadius: '4px' }} />
                      ) : (
                        <div style={{ width: '42px', height: '42px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <PiVinylRecord size={20} color="var(--text-muted)" />
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {res.title}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {res.year && `${res.year} • `}
                          {res.country && `${res.country} • `}
                          {res.format?.join(', ')}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px 0', fontSize: '13px' }}>
                  {buscandoPesquisa ? 'Buscando edições...' : 'Digite o nome do álbum e clique em Buscar.'}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
