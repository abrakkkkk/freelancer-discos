'use client';

import { useState, useEffect, useRef } from 'react';
import { IoClose, IoCameraReverseOutline, IoSparkles, IoCamera, IoRefresh } from 'react-icons/io5';
import { MdDocumentScanner } from 'react-icons/md';
import { FaMagnifyingGlass } from 'react-icons/fa6';
import { LuZoomIn, LuZoomOut } from 'react-icons/lu';

export default function OcrScannerModal({ isOpen, onClose, onScan }) {
  const [stream, setStream] = useState(null);
  const [erroCamera, setErroCamera] = useState(null);
  const [processando, setProcessando] = useState(false);
  const [workerPronto, setWorkerPronto] = useState(false);
  const [textoDetectado, setTextoDetectado] = useState('');
  const [fotoPreview, setFotoPreview] = useState(null);
  const [cameras, setCameras] = useState([]);
  const [cameraIdAtiva, setCameraIdAtiva] = useState(null);
  const [zoomAtual, setZoomAtual] = useState(1);
  const [maxZoom, setMaxZoom] = useState(1);

  const videoRef = useRef(null);
  const targetFrameRef = useRef(null);
  const fileInputRef = useRef(null);
  const audioCtxRef = useRef(null);
  const workerRef = useRef(null);

  // Som suave de confirmação
  const playBeep = () => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1174.66, ctx.currentTime); // D6
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch (e) {}

    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(80);
    }
  };

  // Pré-aquecimento do Tesseract em background ao abrir o modal (Velocidade instantânea)
  useEffect(() => {
    if (!isOpen) return;

    let cancelado = false;
    setWorkerPronto(false);

    const prepararWorker = async () => {
      try {
        const { createWorker } = await import('tesseract.js');
        // Carrega apenas 'eng' (A-Z e 0-9), muito mais leve e rápido que português+inglês
        const worker = await createWorker('eng');
        await worker.setParameters({
          // Suporta maiúsculas, minúsculas, dígitos e separadores de catálogo
          tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-./ ',
          tessedit_pageseg_mode: '6', // Modo bloco/linha uniforme rápido e estável
        });

        if (!cancelado) {
          workerRef.current = worker;
          setWorkerPronto(true);
        } else {
          worker.terminate();
        }
      } catch (err) {
        console.error('Erro ao pré-carregar OCR:', err);
      }
    };

    prepararWorker();

    return () => {
      cancelado = true;
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, [isOpen]);

  // Iniciar câmera com Macro e Zoom automáticos
  const startCamera = async (deviceId = null) => {
    setErroCamera(null);
    stopCamera();

    try {
      const constraints = {
        video: deviceId 
          ? { deviceId: { exact: deviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } }
          : { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }

      const track = mediaStream.getVideoTracks()[0];
      if (track) {
        const capabilities = track.getCapabilities ? track.getCapabilities() : {};
        const advanced = [];

        // 1. Tentar ativar modo Macro ou Foco Contínuo nativo
        if (capabilities.focusMode && capabilities.focusMode.includes('macro')) {
          advanced.push({ focusMode: 'macro' });
        } else if (capabilities.focusMode && capabilities.focusMode.includes('continuous')) {
          advanced.push({ focusMode: 'continuous' });
        }

        // 2. Aplicar zoom inicial de 1.8x a 2.0x para foco nítido de perto (Macro ótico/digital)
        if (capabilities.zoom) {
          const maxZ = capabilities.zoom.max || 1;
          const minZ = capabilities.zoom.min || 1;
          setMaxZoom(maxZ);

          const zoomIdeal = Math.min(maxZ, Math.max(minZ, 1.8));
          setZoomAtual(zoomIdeal);
          advanced.push({ zoom: zoomIdeal });
        }

        if (advanced.length > 0 && track.applyConstraints) {
          try {
            await track.applyConstraints({ advanced });
          } catch (e) {
            console.warn('Não foi possível aplicar restrições avançadas de macro:', e);
          }
        }
      }

      // Buscar câmeras disponíveis
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(d => d.kind === 'videoinput');
      setCameras(videoDevices);
      if (!deviceId && videoDevices.length > 0) {
        const backCam = videoDevices.find(d => 
          d.label.toLowerCase().includes('back') || 
          d.label.toLowerCase().includes('traseira') ||
          d.label.toLowerCase().includes('rear') ||
          d.label.toLowerCase().includes('environment')
        );
        setCameraIdAtiva(backCam ? backCam.deviceId : videoDevices[0].deviceId);
      }
    } catch (err) {
      console.error('Erro ao acessar câmera para OCR:', err);
      setErroCamera(
        err?.name === 'NotAllowedError'
          ? 'Permissão de câmera negada. Habilite o acesso nas configurações do navegador ou use o botão de foto abaixo.'
          : 'Não foi possível ligar a câmera em tempo real. Você pode tirar uma foto usando o botão abaixo.'
      );
    }
  };

  const alternarZoom = async () => {
    if (!stream) return;
    const track = stream.getVideoTracks()[0];
    if (!track || !track.applyConstraints) return;

    const novoZoom = zoomAtual >= 1.8 ? 1 : Math.min(maxZoom, 2.0);
    try {
      await track.applyConstraints({ advanced: [{ zoom: novoZoom }] });
      setZoomAtual(novoZoom);
    } catch (e) {
      console.warn('Erro ao alterar zoom:', e);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const toggleCamera = async () => {
    if (!cameras || cameras.length <= 1) return;
    const currentIndex = cameras.findIndex(c => c.deviceId === cameraIdAtiva);
    const nextIndex = (currentIndex + 1) % cameras.length;
    const nextCam = cameras[nextIndex];
    setCameraIdAtiva(nextCam.deviceId);
    await startCamera(nextCam.deviceId);
  };

  // Auxiliar para evitar que anos de prensagem (1940 a 2030) sejam confundidos com código
  const ehAno = (str) => {
    const n = parseInt(str, 10);
    return str.length === 4 && n >= 1940 && n <= 2030;
  };

  // Avalia individualmente uma linha de texto com pontuação de relevância
  const extrairCodigoCatalogoLinha = (linha) => {
    if (!linha) return null;
    const limpo = linha.replace(/[^A-Za-z0-9\-\.\s\/]/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase();
    if (limpo.length < 3 || limpo.length > 30) return null;

    // Ignora termos jurídicos/empresariais (CGC, CNPJ)
    if (/CGC|CNPJ|\/000\d/.test(limpo)) return null;

    // Ignora expressões de capa comuns que não são códigos
    const ignorarExatos = [
      'DISCO E CULTURA', 'DISCO E CULTURA', 'STEREO', 'MONO', '33 RPM', '45 RPM',
      'LADO 1', 'LADO 2', 'LADO A', 'LADO B', 'SERIE LUXO', 'SOM IND E COM'
    ];
    if (ignorarExatos.includes(limpo)) return null;

    // 1. Prefixo especial estilo EMI-Odeon: 31C 064 422894
    const matchEmi = limpo.match(/\b(\d{2}[A-Z][\s\-\.]+\d{2,4}[\s\-\.]+\d{4,8})\b/i);
    if (matchEmi) return { codigo: matchEmi[1].trim(), score: 100 };

    // 2. Letras clássicas + Números (ex: COLP 82383, COLP 12225, SMOFB 3749, XSLP 1001, BBL 1300)
    const matchLetras = limpo.match(/\b([A-Z]{2,6}[\s\-\.]+(\d{3,8})(?:[\s\-\.]\d{1,4})?)\b/i);
    if (matchLetras) {
      const p = matchLetras[1].trim();
      const digitos = matchLetras[2];
      const prefixo = p.split(/[\s\-\.]+/)[0];
      const ignorarPrefixos = ['STEREO', 'MONO', 'DISCOS', 'SERIE', 'BRASIL', 'EDICAO', 'SOM', 'LIVRE', 'GRAVACOES', 'PRODUCOES', 'LADO', 'FAIXA'];
      if (!ignorarPrefixos.includes(prefixo) && !ehAno(digitos)) {
        return { codigo: p, score: 95 };
      }
    }

    // 3. Numérico Composto com pontuação ou espaço (ex: 6349 050, 103.0001, 403.6001, 825 000-1)
    const matchComposto = limpo.match(/\b(\d{2,6}[\s\.\-]+\d{2,6}(?:[\s\.\-]\d{1,4})?)\b/);
    if (matchComposto) {
      return { codigo: matchComposto[1].trim(), score: 90 };
    }

    // 4. Numérico Puro contínuo (5 a 10 dígitos) - ex: 6349050, 4036001, 1030001, 064422894, 138001
    const matchPuro = limpo.match(/\b(\d{5,10})\b/);
    if (matchPuro) {
      return { codigo: matchPuro[1].trim(), score: 85 };
    }

    // 5. Letras juntas com números (ex: COLP82383, SMOFB3749)
    const matchJunto = limpo.match(/\b([A-Z]{2,6}(\d{3,8}))\b/i);
    if (matchJunto && !ehAno(matchJunto[2])) {
      return { codigo: matchJunto[1], score: 80 };
    }

    // 6. Tratamento para códigos numéricos com confusão típica de OCR (ex: '6349 O5O' ou '4O36OO1')
    const palavras = limpo.split(/\s+/);
    for (let i = 0; i < palavras.length; i++) {
      const w = palavras[i];
      const norm = w.replace(/O/g, '0').replace(/[IL]/g, '1').replace(/S/g, '5');
      if (/^\d{5,10}$/.test(norm)) {
        return { codigo: norm, score: 75 };
      }
      if (i < palavras.length - 1) {
        const w2 = palavras[i + 1];
        const norm2 = (w + ' ' + w2).replace(/O/g, '0').replace(/[IL]/g, '1').replace(/S/g, '5');
        if (/^\d{2,6}\s\d{2,6}$/.test(norm2)) {
          return { codigo: norm2, score: 75 };
        }
      }
    }

    return null;
  };

  // Filtro inteligente de extração de códigos de catálogo
  // Analisa linha por linha para isolar o código mesmo se houver textos ou rabiscos acima/abaixo
  const extrairCodigoCatalogo = (textoBruto) => {
    if (!textoBruto) return '';

    const linhas = textoBruto.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    let melhorResultado = null;

    for (const linha of linhas) {
      const res = extrairCodigoCatalogoLinha(linha);
      if (res) {
        if (!melhorResultado || res.score > melhorResultado.score) {
          melhorResultado = res;
        }
      }
    }

    if (melhorResultado) {
      return melhorResultado.codigo;
    }

    // Fallback: se nenhuma linha isolada deu match, tenta na string completa normalizada
    const resTotal = extrairCodigoCatalogoLinha(textoBruto.replace(/\s+/g, ' '));
    if (resTotal) return resTotal.codigo;

    return '';
  };

  // Pré-processamento: escala de cinza com Auto-Níveis e contraste equilibrado (sem ruído de convolução)
  const processarImagemParaOcr = (canvas, width, height) => {
    const ctx = canvas.getContext('2d');
    const imgData = ctx.getImageData(0, 0, width, height);
    const d = imgData.data;
    const len = d.length;

    let minVal = 255;
    let maxVal = 0;

    for (let i = 0; i < len; i += 4) {
      const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      if (gray < minVal) minVal = gray;
      if (gray > maxVal) maxVal = gray;
    }

    const range = Math.max(30, maxVal - minVal);

    for (let i = 0; i < len; i += 4) {
      const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      const normalized = ((gray - minVal) / range) * 255;
      let adjusted = ((normalized - 128) * 1.45) + 128;
      adjusted = Math.max(0, Math.min(255, Math.round(adjusted)));

      d[i] = adjusted;
      d[i + 1] = adjusted;
      d[i + 2] = adjusted;
    }

    ctx.putImageData(imgData, 0, 0);
  };

  // Processar imagem via Tesseract.js (Instantâneo com Worker pré-carregado)
  const executarOcrEmImagem = async (imageSource) => {
    setProcessando(true);
    setTextoDetectado('');

    try {
      let worker = workerRef.current;

      // Se o worker ainda não terminou de carregar, cria rapidamente
      if (!worker) {
        const { createWorker } = await import('tesseract.js');
        worker = await createWorker('eng');
        await worker.setParameters({
          tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-./ ',
          tessedit_pageseg_mode: '6',
        });
        workerRef.current = worker;
      }

      const ret = await worker.recognize(imageSource);
      const textoLido = ret?.data?.text || '';
      const codigoEncontrado = extrairCodigoCatalogo(textoLido);

      let resultadoFinal = codigoEncontrado;
      if (!resultadoFinal) {
        // Pega a linha mais curta que contenha caracteres alfanuméricos válidos
        const linhas = textoLido.split(/\r?\n/).map(l => l.trim()).filter(l => l.length >= 4 && l.length <= 20);
        resultadoFinal = linhas[0] || '';
      }

      if (resultadoFinal) {
        playBeep();
      }
      setTextoDetectado(resultadoFinal);
    } catch (err) {
      console.error('Erro no OCR:', err);
    } finally {
      setProcessando(false);
    }
  };

  // Capturar quadro do vídeo da câmera com recorte centralizado e resolução nítida
  const capturarDoVideo = () => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    const vWidth = video.videoWidth || 1280;
    const vHeight = video.videoHeight || 720;

    // Recorta a faixa central onde a mira visual está posicionada (faixa mais restrita de 22% de altura para evitar pegar textos acima ou abaixo)
    const cropWidth = Math.floor(vWidth * 0.78);
    const cropHeight = Math.floor(vHeight * 0.22);
    const cropX = Math.floor((vWidth - cropWidth) / 2);
    const cropY = Math.floor((vHeight - cropHeight) / 2);

    // Resolução nítida para OCR (~880px de largura - perfeito para Tesseract sem borramento)
    const targetWidth = Math.min(cropWidth, 880);
    const targetHeight = Math.floor((cropHeight / cropWidth) * targetWidth);

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');

    ctx.drawImage(video, cropX, cropY, cropWidth, cropHeight, 0, 0, targetWidth, targetHeight);

    // Processamento de contraste auto-levels
    processarImagemParaOcr(canvas, targetWidth, targetHeight);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    setFotoPreview(dataUrl);
    executarOcrEmImagem(dataUrl);
  };

  // Capturar via foto macro nativa do celular
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 1200;
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.floor((h / w) * maxDim);
            w = maxDim;
          } else {
            w = Math.floor((w / h) * maxDim);
            h = maxDim;
          }
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        processarImagemParaOcr(canvas, w, h);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
        setFotoPreview(dataUrl);
        executarOcrEmImagem(dataUrl);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleConfirmar = () => {
    if (!textoDetectado.trim()) return;
    stopCamera();
    onScan(textoDetectado.trim());
    onClose();
  };

  const handleTentarNovamente = async () => {
    setFotoPreview(null);
    setTextoDetectado('');
    setProcessando(false);

    // Garante que o stream de vídeo continue tocando sem desconectar
    if (stream && videoRef.current) {
      if (!videoRef.current.srcObject) {
        videoRef.current.srcObject = stream;
      }
      try {
        await videoRef.current.play();
      } catch (e) {
        startCamera(cameraIdAtiva);
      }
    } else {
      startCamera(cameraIdAtiva);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setTextoDetectado('');
      setFotoPreview(null);
      setProcessando(false);
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="scanner-modal-overlay" onClick={() => { stopCamera(); onClose(); }}>
      <div className="scanner-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="scanner-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MdDocumentScanner size={22} color="var(--accent)" />
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600 }}>Leitor de Catálogo (OCR)</h3>
          </div>
          <button 
            type="button" 
            className="scanner-close-btn"
            onClick={() => { stopCamera(); onClose(); }}
            title="Fechar"
          >
            <IoClose size={22} />
          </button>
        </div>

        {/* Viewfinder da Câmera em Preto e Branco com Alto Contraste */}
        <div className="scanner-viewfinder-wrapper" style={{ minHeight: '300px', position: 'relative' }}>
          {/* O vídeo e a mira sempre continuam montados no DOM para a câmera nunca travar */}
          <div style={{ width: '100%', height: '100%', display: fotoPreview ? 'none' : 'block' }}>
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted 
              className="ocr-camera-video"
            />

            {/* Mira visual para enquadrar o texto */}
            <div ref={targetFrameRef} className="ocr-target-frame">
              <div className="ocr-frame-corner top-left" />
              <div className="ocr-frame-corner top-right" />
              <div className="ocr-frame-corner bottom-left" />
              <div className="ocr-frame-corner bottom-right" />
              <span className="ocr-frame-hint">Enquadre o código (ex: COLP 12225 ou 6349 050)</span>
            </div>

            {/* Botões flutuantes de Zoom Macro e Câmera */}
            <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', gap: '8px', zIndex: 5 }}>
              {maxZoom > 1 && (
                <button 
                  type="button"
                  onClick={alternarZoom}
                  className="ocr-floating-btn"
                  title="Alternar Macro / Zoom"
                >
                  {zoomAtual >= 1.8 ? <LuZoomOut size={16} /> : <LuZoomIn size={16} />}
                  <span>{zoomAtual >= 1.8 ? 'Macro (2x)' : '1x'}</span>
                </button>
              )}

              {cameras.length > 1 && (
                <button 
                  type="button"
                  onClick={toggleCamera}
                  className="ocr-floating-btn"
                  title="Alternar lente da câmera"
                >
                  <IoCameraReverseOutline size={18} />
                </button>
              )}
            </div>
          </div>

          {/* Quando fotoPreview existir, ela é exibida por cima sem desmontar a câmera */}
          {fotoPreview && (
            <div style={{ width: '100%', height: '100%', minHeight: '300px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#000', padding: '16px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px' }}>Imagem processada:</span>
              <img src={fotoPreview} alt="Captura B&W" style={{ maxWidth: '100%', maxHeight: '180px', objectFit: 'contain', border: '1px solid var(--border)', borderRadius: '6px' }} />
            </div>
          )}

          {processando && (
            <div className="scanner-status-overlay">
              <div className="scanner-spinner" />
              <span style={{ fontWeight: 600 }}>Lendo caracteres em alto contraste...</span>
            </div>
          )}

          {erroCamera && !fotoPreview && (
            <div className="scanner-error-box">
              <p style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#fc8181' }}>{erroCamera}</p>
            </div>
          )}
        </div>

        <div className="scanner-modal-footer">
          {fotoPreview ? (
            /* Estado quando a foto foi tirada / carregada */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
              {processando ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '10px 0' }}>
                  <div className="scanner-spinner" style={{ width: '22px', height: '22px' }} />
                  <span style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-header)' }}>
                    Lendo caracteres no disco...
                  </span>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <IoSparkles color="var(--accent)" size={16} />
                      <span style={{ fontSize: '13px', fontWeight: 700, color: textoDetectado ? 'var(--text-header)' : '#f6ad55' }}>
                        {textoDetectado ? 'Código detectado:' : 'Nenhum código reconhecido com certeza:'}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input 
                      type="text" 
                      value={textoDetectado} 
                      onChange={(e) => setTextoDetectado(e.target.value)}
                      placeholder="Ex: COLP 12225 ou 6349 050"
                      style={{ flex: 1, fontSize: '15px', fontWeight: 'bold', letterSpacing: '0.5px', padding: '8px 12px' }}
                    />
                    <button 
                      type="button" 
                      onClick={handleConfirmar} 
                      disabled={!textoDetectado.trim()}
                      className="btn btn-primary"
                      style={{ whiteSpace: 'nowrap', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <FaMagnifyingGlass size={14} /> Buscar
                    </button>
                  </div>

                  <button 
                    type="button" 
                    onClick={handleTentarNovamente}
                    className="btn btn-secondary"
                    style={{ width: '100%', fontSize: '13px', padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontWeight: 600 }}
                  >
                    <IoRefresh size={16} /> Tirar outra foto / Tentar novamente
                  </button>
                </>
              )}
            </div>
          ) : (
            /* Estado de câmera ao vivo */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
              <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                <button 
                  type="button" 
                  onClick={capturarDoVideo} 
                  disabled={processando || !!erroCamera}
                  className="btn btn-primary" 
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', minHeight: '44px', fontWeight: 600 }}
                >
                  <IoCamera size={18} /> Capturar e Ler
                </button>
              </div>

              <input 
                type="file" 
                ref={fileInputRef} 
                accept="image/*" 
                capture="environment" 
                onChange={handleFileUpload} 
                style={{ display: 'none' }} 
              />
              <button 
                type="button" 
                onClick={() => fileInputRef.current?.click()}
                disabled={processando}
                className="btn btn-secondary"
                style={{ width: '100%', fontSize: '12.5px', padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                Tirar foto macro com foco da câmera nativa
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
