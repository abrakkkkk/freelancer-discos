'use client';

import { useState, useEffect, useRef } from 'react';
import { IoClose, IoCameraReverseOutline, IoCamera, IoRefresh, IoImageOutline } from 'react-icons/io5';

export default function CoverScannerModal({ isOpen, onClose, onRecognized, title = 'Reconhecer Capa' }) {
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

  // Redimensiona para crop central 1:1 de 560x560 em JPEG super leve (~35KB) para resposta instantânea
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
    return canvas.toDataURL('image/jpeg', 0.75);
  };

  const enviarParaReconhecimento = async (base64Image) => {
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

      playBeep();
      stopCamera();
      if (onRecognized) {
        onRecognized({
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
      const base64 = recortarEComprimir(videoRef.current);
      setFotoPreview(base64);
      enviarParaReconhecimento(base64);
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
        const base64 = recortarEComprimir(img);
        setFotoPreview(base64);
        enviarParaReconhecimento(base64);
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

        {/* Visor / Área da Câmera (Proporção Quadrada 1:1) */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            aspectRatio: '1 / 1',
            background: '#000',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          {!fotoPreview ? (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover'
                }}
              />

              {/* Guia Visual Quadrada de Enquadramento da Capa */}
              <div
                style={{
                  position: 'absolute',
                  inset: '24px',
                  border: '2px dashed rgba(255, 255, 255, 0.45)',
                  borderRadius: '12px',
                  pointerEvents: 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.35)'
                }}
              >
                {/* Cantoneiras estilizadas */}
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div style={{ width: '20px', height: '20px', borderTop: '3px solid #fff', borderLeft: '3px solid #fff', borderTopLeftRadius: '6px' }} />
                  <div style={{ width: '20px', height: '20px', borderTop: '3px solid #fff', borderRight: '3px solid #fff', borderTopRightRadius: '6px' }} />
                </div>

                <div style={{ textAlign: 'center', padding: '8px 12px' }}>
                  <span
                    style={{
                      background: 'rgba(0, 0, 0, 0.65)',
                      backdropFilter: 'blur(4px)',
                      color: '#fff',
                      fontSize: '12px',
                      fontWeight: 500,
                      padding: '4px 10px',
                      borderRadius: '12px',
                      border: '1px solid rgba(255, 255, 255, 0.2)'
                    }}
                  >
                    Enquadre a capa frontal do disco
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div style={{ width: '20px', height: '20px', borderBottom: '3px solid #fff', borderLeft: '3px solid #fff', borderBottomLeftRadius: '6px' }} />
                  <div style={{ width: '20px', height: '20px', borderBottom: '3px solid #fff', borderRight: '3px solid #fff', borderBottomRightRadius: '6px' }} />
                </div>
              </div>

              {/* Botão de Alternar Câmera */}
              {cameras.length > 1 && (
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
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    zIndex: 2
                  }}
                  title="Alternar câmera"
                  aria-label="Alternar câmera"
                >
                  <IoCameraReverseOutline size={22} />
                </button>
              )}
            </>
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={fotoPreview}
              alt="Prévia da capa"
              style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#09090b' }}
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
              padding: '12px 16px',
              backgroundColor: 'rgba(229, 62, 62, 0.12)',
              borderBottom: '1px solid rgba(229, 62, 62, 0.3)',
              color: '#fc8181',
              fontSize: '13px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}
          >
            <span style={{ fontWeight: 600 }}>Atenção:</span>
            <span>{erro}</span>
          </div>
        )}

        {/* Rodapé / Controles Mobile-First */}
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {!fotoPreview ? (
            <>
              {/* Botão Obturador Central */}
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={capturarDoVideo}
                  disabled={processando || !!erro}
                  style={{
                    width: '72px',
                    height: '72px',
                    borderRadius: '50%',
                    backgroundColor: '#fff',
                    border: '4px solid rgba(255, 255, 255, 0.4)',
                    boxShadow: '0 0 20px rgba(255, 255, 255, 0.25)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'transform 0.15s ease'
                  }}
                  aria-label="Capturar foto da capa"
                >
                  <div
                    style={{
                      width: '56px',
                      height: '56px',
                      borderRadius: '50%',
                      backgroundColor: '#fff',
                      border: '2px solid #000'
                    }}
                  />
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
          ) : (
            /* Botão de Tentar Novamente se falhar */
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={tentarNovamente}
                disabled={processando}
                className="btn btn-secondary"
                style={{
                  flex: 1,
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
          )}
        </div>
      </div>
    </div>
  );
}
