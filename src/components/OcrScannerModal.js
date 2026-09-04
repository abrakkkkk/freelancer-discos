'use client';

import { useState, useEffect, useRef } from 'react';
import { IoClose, IoCameraReverseOutline, IoSparkles, IoCamera } from 'react-icons/io5';
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
          // Restringe apenas para caracteres de códigos de catálogo
          tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-./ ',
          tessedit_pageseg_mode: '6', // Trata como bloco único / linha uniforme de texto (10x mais rápido)
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

  // Filtro de extração de códigos de catálogo (COLP 12225, SMOFB 3749, 6349 050, etc.)
  const extrairCodigoCatalogo = (textoBruto) => {
    if (!textoBruto) return '';

    // Remove caracteres estranhos
    const textoLimpo = textoBruto.replace(/[^A-Za-z0-9\-\.\s]/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase();

    // 1. Padrão Letras + Números (ex: COLP 12225, SMOFB 3749, XSLP 1001, BBL 1300)
    const matchPrefixoNumero = textoLimpo.match(/\b([A-Z]{2,6}[\s\-\.]*[\d]{3,8})\b/i);
    if (matchPrefixoNumero) {
      return matchPrefixoNumero[1].replace(/[\s\-\.]+/g, ' ').trim();
    }

    // 2. Padrão Numérico de Gravadora (ex: 6349 050, 103.0001, 064 422894)
    const matchNumerico = textoLimpo.match(/\b([\d]{3,6}[\s\-\.][\d]{3,6})\b/);
    if (matchNumerico) {
      return matchNumerico[1].trim();
    }

    // 3. Fallback: pega a sequência com letras e números
    const palavras = textoLimpo.split(/\s+/).filter(w => w.length >= 4 && /\d/.test(w));
    if (palavras.length > 0) return palavras[0];

    return textoLimpo.slice(0, 25);
  };

  // Pré-processamento da imagem em Preto e Branco com Contraste Equilibrado (legível e natural)
  const aplicarPretoEBrancoEContraste = (canvas, cropWidth, cropHeight) => {
    const ctx = canvas.getContext('2d');
    const imgData = ctx.getImageData(0, 0, cropWidth, cropHeight);
    const d = imgData.data;

    // Fator 1.30 a 1.35 fornece aumento de nitidez sem estourar degradês nem desfigurar fontes
    const contrastFactor = 1.32;

    for (let i = 0; i < d.length; i += 4) {
      // Luminância perceptual
      const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];

      // Curva suave de contraste em torno do tom médio
      let adjusted = ((gray - 128) * contrastFactor) + 128;
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
          tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-./ ',
          tessedit_pageseg_mode: '6',
        });
        workerRef.current = worker;
      }

      const ret = await worker.recognize(imageSource);
      const textoLido = ret?.data?.text || '';
      const codigoEncontrado = extrairCodigoCatalogo(textoLido);

      playBeep();
      setTextoDetectado(codigoEncontrado || textoLido.trim());
    } catch (err) {
      console.error('Erro no OCR:', err);
      alert('Não foi possível ler o código. Tente aproximar mais da luz ou digite o código.');
    } finally {
      setProcessando(false);
    }
  };

  // Capturar quadro do vídeo da câmera com recorte da mira
  const capturarDoVideo = () => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    const vWidth = video.videoWidth || 1280;
    const vHeight = video.videoHeight || 720;

    // Recortar exatamente a área central da mira
    const cropWidth = Math.floor(vWidth * 0.72);
    const cropHeight = Math.floor(vHeight * 0.28);
    const cropX = Math.floor((vWidth - cropWidth) / 2);
    const cropY = Math.floor((vHeight - cropHeight) / 2);

    // Redimensionar para tamanho ideal (~450px de largura) para OCR ultrarrápido
    const targetWidth = 460;
    const targetHeight = Math.floor((cropHeight / cropWidth) * targetWidth);

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');

    // Desenha a imagem recortada e escalada
    ctx.drawImage(video, cropX, cropY, cropWidth, cropHeight, 0, 0, targetWidth, targetHeight);

    // Aplica o filtro Preto e Branco com Alto Contraste (Binarização)
    aplicarPretoEBrancoEContraste(canvas, targetWidth, targetHeight);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
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
        const maxDim = 800;
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
        aplicarPretoEBrancoEContraste(canvas, w, h);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
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

  const handleTentarNovamente = () => {
    setFotoPreview(null);
    setTextoDetectado('');
    if (!stream) startCamera(cameraIdAtiva);
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
        <div className="scanner-viewfinder-wrapper" style={{ minHeight: '300px' }}>
          {!fotoPreview ? (
            <>
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                muted 
                className="ocr-camera-video"
              />

              {/* Mira visual para enquadrar o texto */}
              <div className="ocr-target-frame">
                <div className="ocr-frame-corner top-left" />
                <div className="ocr-frame-corner top-right" />
                <div className="ocr-frame-corner bottom-left" />
                <div className="ocr-frame-corner bottom-right" />
                <span className="ocr-frame-hint">Enquadre o código (ex: COLP 12225)</span>
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
            </>
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#000', padding: '16px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px' }}>Imagem processada em alto contraste:</span>
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
          {textoDetectado ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <IoSparkles color="var(--accent)" size={16} />
                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Código detectado:</span>
              </div>
              
              <div style={{ display: 'flex', gap: '8px' }}>
                <input 
                  type="text" 
                  value={textoDetectado} 
                  onChange={(e) => setTextoDetectado(e.target.value)}
                  style={{ flex: 1, fontSize: '15px', fontWeight: 'bold', letterSpacing: '0.5px', padding: '8px 12px' }}
                />
                <button 
                  type="button" 
                  onClick={handleConfirmar} 
                  className="btn btn-primary"
                  style={{ whiteSpace: 'nowrap', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <FaMagnifyingGlass size={14} /> Buscar
                </button>
              </div>

              <button 
                type="button" 
                onClick={handleTentarNovamente}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '12px', cursor: 'pointer', textAlign: 'center', textDecoration: 'underline', marginTop: '2px' }}
              >
                Capturar novamente
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
              <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                {/* Botão de Captura da Câmera ao Vivo */}
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

              {/* Botão alternativo para foto em alta resolução / galeria */}
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
