'use client';

import { useState, useEffect, useRef } from 'react';
import { IoClose, IoCameraReverseOutline, IoSparkles, IoCamera } from 'react-icons/io5';
import { MdDocumentScanner } from 'react-icons/md';
import { FaMagnifyingGlass } from 'react-icons/fa6';

export default function OcrScannerModal({ isOpen, onClose, onScan }) {
  const [stream, setStream] = useState(null);
  const [erroCamera, setErroCamera] = useState(null);
  const [processando, setProcessando] = useState(false);
  const [progressoOcr, setProgressoOcr] = useState(0);
  const [textoDetectado, setTextoDetectado] = useState('');
  const [fotoPreview, setFotoPreview] = useState(null);
  const [cameras, setCameras] = useState([]);
  const [cameraIdAtiva, setCameraIdAtiva] = useState(null);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const audioCtxRef = useRef(null);

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
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch (e) {}

    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(80);
    }
  };

  // Iniciar câmera nativa
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

  // Extrair padrões de catálogo conhecidos (COLP 12225, SMOFB 3749, 6349 050, etc.)
  const extrairCodigoCatalogo = (textoBruto) => {
    if (!textoBruto) return '';

    // Remove quebras de linha e excesso de espaços
    const textoLimpo = textoBruto.replace(/\r?\n|\r/g, ' ').trim();

    // 1. Padrão Letras + Números (ex: COLP 12225, SMOFB 3749, XSLP 1001, BBL 1300)
    const matchPrefixoNumero = textoLimpo.match(/\b([A-Z]{2,6}[\s\-\.]*[\d]{3,8})\b/i);
    if (matchPrefixoNumero) {
      return matchPrefixoNumero[1].replace(/[\s\-\.]+/g, ' ').trim().toUpperCase();
    }

    // 2. Padrão Numérico de Gravadora (ex: 6349 050, 103.0001, 064 422894)
    const matchNumerico = textoLimpo.match(/\b([\d]{3,6}[\s\-\.][\d]{3,6})\b/);
    if (matchNumerico) {
      return matchNumerico[1].trim();
    }

    // 3. Fallback: pega a linha ou palavra mais relevante
    const palavras = textoLimpo.split(/\s+/).filter(w => w.length >= 4 && /\d/.test(w));
    if (palavras.length > 0) return palavras[0].toUpperCase();

    return textoLimpo.slice(0, 30);
  };

  // Processar imagem via Tesseract.js
  const executarOcrEmImagem = async (imageSource) => {
    setProcessando(true);
    setProgressoOcr(10);
    setTextoDetectado('');

    try {
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('por+eng', 1, {
        logger: (m) => {
          if (m.status === 'recognizing text' && m.progress) {
            setProgressoOcr(Math.round(m.progress * 100));
          }
        },
      });

      setProgressoOcr(40);
      const ret = await worker.recognize(imageSource);
      await worker.terminate();

      const textoLido = ret?.data?.text || '';
      const codigoEncontrado = extrairCodigoCatalogo(textoLido);

      playBeep();
      setTextoDetectado(codigoEncontrado || textoLido.trim());
      setProgressoOcr(100);
    } catch (err) {
      console.error('Erro no OCR:', err);
      alert('Não foi possível reconhecer o texto da foto. Tente novamente com mais foco e luz.');
    } finally {
      setProcessando(false);
    }
  };

  // Capturar quadro do vídeo da câmera
  const capturarDoVideo = () => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');

    // Desenhar quadro
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Recortar a faixa central (onde fica a mira de foco)
    const cropWidth = Math.floor(canvas.width * 0.75);
    const cropHeight = Math.floor(canvas.height * 0.35);
    const cropX = Math.floor((canvas.width - cropWidth) / 2);
    const cropY = Math.floor((canvas.height - cropHeight) / 2);

    const croppedCanvas = document.createElement('canvas');
    croppedCanvas.width = cropWidth;
    croppedCanvas.height = cropHeight;
    const cropCtx = croppedCanvas.getContext('2d');
    cropCtx.drawImage(canvas, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

    const dataUrl = croppedCanvas.toDataURL('image/jpeg', 0.9);
    setFotoPreview(dataUrl);
    executarOcrEmImagem(dataUrl);
  };

  // Capturar via input file (foto macro de alta resolução do celular)
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target.result;
      setFotoPreview(dataUrl);
      executarOcrEmImagem(dataUrl);
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

        <div className="scanner-viewfinder-wrapper" style={{ minHeight: '290px' }}>
          {!fotoPreview ? (
            <>
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                muted 
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />

              {/* Mira visual para enquadrar o texto */}
              <div className="ocr-target-frame">
                <div className="ocr-frame-corner top-left" />
                <div className="ocr-frame-corner top-right" />
                <div className="ocr-frame-corner bottom-left" />
                <div className="ocr-frame-corner bottom-right" />
                <span className="ocr-frame-hint">Enquadre o código (ex: COLP 12225)</span>
              </div>
            </>
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000' }}>
              <img src={fotoPreview} alt="Captura" style={{ maxWidth: '100%', maxHeight: '280px', objectFit: 'contain' }} />
            </div>
          )}

          {processando && (
            <div className="scanner-status-overlay">
              <div className="scanner-spinner" />
              <span style={{ fontWeight: 600 }}>Lendo texto da imagem... {progressoOcr}%</span>
            </div>
          )}

          {erroCamera && !fotoPreview && (
            <div className="scanner-error-box">
              <p style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#fc8181' }}>{erroCamera}</p>
            </div>
          )}
        </div>

        <div className="scanner-modal-footer">
          {/* Se um texto já foi detectado */}
          {textoDetectado ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <IoSparkles color="var(--accent)" size={16} />
                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Código identificado:</span>
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

                {/* Alternar Câmera */}
                {cameras.length > 1 && !erroCamera && (
                  <button 
                    type="button" 
                    onClick={toggleCamera} 
                    className="btn btn-secondary" 
                    style={{ padding: '0 12px', minHeight: '44px' }}
                    title="Alternar câmera"
                  >
                    <IoCameraReverseOutline size={20} />
                  </button>
                )}
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
                Tirar foto macro com foco ou escolher da galeria
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
