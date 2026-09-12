'use client';

import { useState, useEffect, useRef } from 'react';
import { IoClose, IoCameraReverseOutline, IoCamera, IoRefresh, IoImageOutline } from 'react-icons/io5';
import { computeDHash, findInVisualCache, saveToVisualCache } from '@/utils/visualHash';

export default function CoverScannerModal({ isOpen, onClose, onRecognized, onCoverRecognized, title = 'Reconhecer Capa' }) {
  const handleRecognizedCallback = onRecognized || onCoverRecognized;
  const [stream, setStream] = useState(null);
  const [erro, setErro] = useState(null);
  const [processando, setProcessando] = useState(false);
  const [fotoPreview, setFotoPreview] = useState(null);
  const [cameras, setCameras] = useState([]);
  const [cameraIdAtiva, setCameraIdAtiva] = useState(null);

  const videoRef = useRef(null);
  const fileInputRef = useRef(null);
  const audioCtxRef = useRef(null);

  // Som suave de confirmação ao reconhecer
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
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch (_) {}

    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(80);
    }
  };

  const startCamera = async (deviceId = null) => {
    setErro(null);
    stopCamera();

    try {
      const constraints = {
        video: deviceId
          ? { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 1280 } }
          : { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 1280 } }
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }

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
      console.error('Erro ao acessar a câmera:', err);
      setErro('Não foi possível acessar a câmera. Verifique as permissões do navegador.');
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

  // Redimensiona para crop central 1:1 de 560x560 em JPEG super leve (~35KB) e extrai dHash
  const recortarEComprimir = (origem) => {
    const canvas = document.createElement('canvas');
    const size = 560;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    let srcW = 800;
    let srcH = 600;

    if (origem instanceof HTMLVideoElement) {
      srcW = origem.videoWidth || 800;
      srcH = origem.videoHeight || 600;
    } else if (origem instanceof HTMLImageElement) {
      srcW = origem.naturalWidth || origem.width || 800;
      srcH = origem.naturalHeight || origem.height || 600;
    }

    const sSize = Math.min(srcW, srcH);
    const sx = (srcW - sSize) / 2;
    const sy = (srcH - sSize) / 2;

    ctx.drawImage(origem, sx, sy, sSize, sSize, 0, 0, size, size);

    // Gera o hash perceptual visual da capa
    const hash = computeDHash(canvas);
    const base64 = canvas.toDataURL('image/jpeg', 0.75);

    return { base64, hash };
  };

  const enviarParaReconhecimento = async (base64Image, hashCalculado = null) => {
    // 1. Verificação instantânea no Cache Visual Perceptual (< 5ms, sem rede)
    if (hashCalculado) {
      const matchCache = findInVisualCache(hashCalculado);
      if (matchCache) {
        playBeep();
        stopCamera();
        if (handleRecognizedCallback) {
          handleRecognizedCallback({
            artista: matchCache.artista,
            titulo: matchCache.titulo,
            ano: matchCache.ano,
            confianca: 'alta'
          });
        }
        onClose();
        return;
      }
    }

    setProcessando(true);
    setErro(null);

    try {
      const res = await fetch('/api/recognize-cover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64Image })
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Capa não reconhecida.');
      }

      // Salva no cache visual local para que futuras leituras sejam instantâneas
      if (hashCalculado) {
        saveToVisualCache(hashCalculado, {
          artista: data.artista,
          titulo: data.titulo,
          ano: data.ano
        });
      }

      playBeep();
      stopCamera();
      if (handleRecognizedCallback) {
        handleRecognizedCallback({
          artista: data.artista,
          titulo: data.titulo,
          ano: data.ano,
          confianca: data.confianca
        });
      }
      onClose();
    } catch (err) {
      setErro(err.message || 'Falha ao identificar a capa. Tente novamente.');
    } finally {
      setProcessando(false);
    }
  };

  const capturarDoVideo = () => {
    if (!videoRef.current || processando) return;
    try {
      const { base64, hash } = recortarEComprimir(videoRef.current);
      setFotoPreview(base64);
      enviarParaReconhecimento(base64, hash);
    } catch (err) {
      setErro('Erro ao capturar frame do vídeo.');
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const { base64, hash } = recortarEComprimir(img);
        setFotoPreview(base64);
        enviarParaReconhecimento(base64, hash);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const tentarNovamente = () => {
    setFotoPreview(null);
    setErro(null);
    startCamera(cameraIdAtiva);
  };

  useEffect(() => {
    if (isOpen) {
      setFotoPreview(null);
      setErro(null);
      setProcessando(false);
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="cover-scanner-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.88)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '12px'
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '460px',
          maxHeight: 'calc(100vh - 24px)',
          overflowY: 'auto',
          backgroundColor: '#18181b',
          border: '1px solid rgba(255, 255, 255, 0.16)',
          borderRadius: '16px',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)',
          display: 'flex',
          flexDirection: 'column'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 16px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <IoCamera size={20} color="var(--accent, #e53e3e)" />
            <h2 style={{ fontSize: '17px', fontWeight: 600, color: '#fff', margin: 0 }}>
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted, #a1a1aa)',
              width: '44px',
              height: '44px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              borderRadius: '8px'
            }}
            aria-label="Fechar modal"
          >
            <IoClose size={24} />
          </button>
        </div>

        {/* Visor / Área da Câmera (Proporção Quadrada 1:1 Real de Capa de Álbum) */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            aspectRatio: '1 / 1',
            background: '#000',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}
        >
          {/* Câmera ao vivo (permanece sempre montada para evitar pulos de layout) */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: fotoPreview ? 'none' : 'block'
            }}
          />

          {/* Guia Visual Quadrada de Enquadramento da Capa (1:1 Vinil) */}
          {!fotoPreview && (
            <div
              style={{
                position: 'absolute',
                inset: '16px',
                border: '2px dashed rgba(255, 255, 255, 0.55)',
                borderRadius: '14px',
                pointerEvents: 'none',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.35)',
                zIndex: 2
              }}
            >
              {/* Cantoneiras estilizadas */}
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ width: '24px', height: '24px', borderTop: '3px solid #fff', borderLeft: '3px solid #fff', borderTopLeftRadius: '8px' }} />
                <div style={{ width: '24px', height: '24px', borderTop: '3px solid #fff', borderRight: '3px solid #fff', borderTopRightRadius: '8px' }} />
              </div>

              <div style={{ textAlign: 'center', padding: '6px 10px' }}>
                <span
                  style={{
                    background: 'rgba(0, 0, 0, 0.7)',
                    backdropFilter: 'blur(4px)',
                    color: '#fff',
                    fontSize: '12px',
                    fontWeight: 600,
                    padding: '4px 12px',
                    borderRadius: '12px',
                    border: '1px solid rgba(255, 255, 255, 0.25)',
                    letterSpacing: '0.2px'
                  }}
                >
                  Enquadre a capa frontal do disco (1:1)
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ width: '24px', height: '24px', borderBottom: '3px solid #fff', borderLeft: '3px solid #fff', borderBottomLeftRadius: '8px' }} />
                <div style={{ width: '24px', height: '24px', borderBottom: '3px solid #fff', borderRight: '3px solid #fff', borderBottomRightRadius: '8px' }} />
              </div>
            </div>
          )}

          {/* Botão de Alternar Câmera */}
          {!fotoPreview && cameras.length > 1 && (
            <button
              type="button"
              onClick={toggleCamera}
              style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                background: 'rgba(0, 0, 0, 0.65)',
                border: '1px solid rgba(255, 255, 255, 0.25)',
                color: '#fff',
                borderRadius: '50%',
                width: '44px',
                height: '44px',
                minWidth: '44px',
                minHeight: '44px',
                aspectRatio: '1 / 1',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                zIndex: 3
              }}
              title="Alternar câmera"
              aria-label="Alternar câmera"
            >
              <IoCameraReverseOutline size={22} />
            </button>
          )}

          {/* Prévia da imagem capturada */}
          {fotoPreview && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={fotoPreview}
              alt="Prévia da capa"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                background: '#09090b',
                display: 'block'
              }}
            />
          )}

          {/* Overlay de Processamento */}
          {processando && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.78)',
                backdropFilter: 'blur(3px)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                zIndex: 10
              }}
            >
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  border: '3px solid rgba(255, 255, 255, 0.2)',
                  borderTopColor: 'var(--accent, #e53e3e)',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite'
                }}
              />
              <span style={{ fontSize: '14px', fontWeight: 600, color: '#fff' }}>
                Identificando...
              </span>
            </div>
          )}
        </div>

        {/* Mensagem de Erro (se houver) */}
        {erro && (
          <div
            style={{
              padding: '10px 16px',
              backgroundColor: 'rgba(229, 62, 62, 0.12)',
              borderBottom: '1px solid rgba(229, 62, 62, 0.3)',
              color: '#fc8181',
              fontSize: '12.5px',
              display: 'flex',
              flexDirection: 'column',
              gap: '2px',
              flexShrink: 0
            }}
          >
            <span style={{ fontWeight: 600 }}>Atenção:</span>
            <span>{erro}</span>
          </div>
        )}

        {/* Rodapé / Controles com Altura Estável para Evitar Pulos Visuais */}
        <div
          style={{
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: '12px',
            minHeight: '144px',
            boxSizing: 'border-box',
            flexShrink: 0
          }}
        >
          {fotoPreview && !processando ? (
            /* Botão de Tentar Novamente quando a captura terminar com erro */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
              <button
                type="button"
                onClick={tentarNovamente}
                className="btn btn-secondary"
                style={{
                  width: '100%',
                  minHeight: '48px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  fontSize: '14px',
                  fontWeight: 600
                }}
              >
                <IoRefresh size={18} /> Tirar outra foto
              </button>
            </div>
          ) : (
            <>
              {/* Botão Obturador Central com Dimensões Estritas e Travadas */}
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={capturarDoVideo}
                  disabled={processando || !!erro}
                  style={{
                    width: '72px',
                    height: '72px',
                    minWidth: '72px',
                    minHeight: '72px',
                    maxWidth: '72px',
                    maxHeight: '72px',
                    aspectRatio: '1 / 1',
                    flexShrink: 0,
                    borderRadius: '50%',
                    backgroundColor: '#fff',
                    border: '4px solid rgba(255, 255, 255, 0.4)',
                    boxShadow: '0 0 20px rgba(255, 255, 255, 0.25)',
                    cursor: processando ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'transform 0.15s ease',
                    padding: 0,
                    boxSizing: 'border-box',
                    userSelect: 'none',
                    WebkitTapHighlightColor: 'transparent',
                    opacity: processando ? 0.6 : 1
                  }}
                  aria-label="Capturar foto da capa"
                >
                  <div
                    style={{
                      width: '56px',
                      height: '56px',
                      minWidth: '56px',
                      minHeight: '56px',
                      aspectRatio: '1 / 1',
                      flexShrink: 0,
                      borderRadius: '50%',
                      backgroundColor: '#fff',
                      border: '2px solid #18181b',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      pointerEvents: 'none'
                    }}
                  >
                    <IoCamera size={26} color="#18181b" />
                  </div>
                </button>
              </div>

              {/* Botão Secundário: Carregar da Galeria */}
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={processando}
                className="btn btn-secondary"
                style={{
                  minHeight: '44px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  fontSize: '13px',
                  fontWeight: 500
                }}
              >
                <IoImageOutline size={18} /> Escolher foto da galeria
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
