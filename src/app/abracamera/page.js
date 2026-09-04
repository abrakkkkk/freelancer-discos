'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { IoCamera, IoCameraReverseOutline, IoDownloadOutline, IoRefresh, IoArrowBack } from 'react-icons/io5';

export default function AbraCamera() {
  const [stream, setStream] = useState(null);
  const [fotoCapturada, setFotoCapturada] = useState(null);
  const [cameras, setCameras] = useState([]);
  const [cameraIdAtiva, setCameraIdAtiva] = useState(null);
  const [carregando, setCarregando] = useState(true);

  const videoRef = useRef(null);

  const startCamera = async (deviceId = null) => {
    stopCamera();
    setCarregando(true);

    try {
      const constraints = {
        video: deviceId 
          ? { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
          : { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }
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
      console.error('Erro ao acessar camera:', err);
    } finally {
      setCarregando(false);
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

  const aplicarEfeito1Bit = (ctx, w, h) => {
    const imgData = ctx.getImageData(0, 0, w, h);
    const d = imgData.data;

    let minVal = 255;
    let maxVal = 0;
    let soma = 0;
    const grays = new Float32Array(w * h);

    for (let i = 0, j = 0; i < d.length; i += 4, j++) {
      const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      grays[j] = gray;
      soma += gray;
      if (gray < minVal) minVal = gray;
      if (gray > maxVal) maxVal = gray;
    }

    const media = soma / (w * h);
    const threshold = minVal + (maxVal - minVal) * 0.48;
    const fundoEscuro = media < 120;

    for (let i = 0, j = 0; i < d.length; i += 4, j++) {
      let ehTexto = grays[j] > threshold;
      if (fundoEscuro) ehTexto = grays[j] < threshold;
      const val = ehTexto ? 255 : 0;
      d[i] = val;
      d[i + 1] = val;
      d[i + 2] = val;
    }

    ctx.putImageData(imgData, 0, 0);
  };

  const capturarFoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 800;
    canvas.height = video.videoHeight || 600;
    const ctx = canvas.getContext('2d');

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    aplicarEfeito1Bit(ctx, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    setFotoCapturada(dataUrl);
    stopCamera();
  };

  const baixarFoto = () => {
    if (!fotoCapturada) return;
    const link = document.createElement('a');
    link.href = fotoCapturada;
    link.download = `foto_${Date.now()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const tirarOutra = () => {
    setFotoCapturada(null);
    startCamera(cameraIdAtiva);
  };

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  return (
    <div style={{
      minHeight: '100vh',
      background: '#09090b',
      color: '#fff',
      padding: '20px 16px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'space-between'
    }}>
      {/* Barra superior minimalista */}
      <div style={{ width: '100%', maxWidth: '440px', display: 'flex', justifyContent: 'flex-start', alignItems: 'center' }}>
        <Link 
          href="/" 
          style={{ 
            display: 'inline-flex', 
            alignItems: 'center', 
            gap: '8px', 
            color: 'var(--text-muted)', 
            textDecoration: 'none', 
            fontSize: '14px',
            padding: '8px 12px',
            borderRadius: '8px',
            background: 'rgba(255,255,255,0.05)'
          }}
        >
          <IoArrowBack size={16} /> Voltar
        </Link>
      </div>

      {/* Visor da Câmera / Preview */}
      <div style={{
        width: '100%',
        maxWidth: '440px',
        position: 'relative',
        borderRadius: '16px',
        overflow: 'hidden',
        background: '#000',
        border: '1px solid rgba(255,255,255,0.12)',
        minHeight: '380px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '20px 0'
      }}>
        {!fotoCapturada ? (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{
                width: '100%',
                height: '100%',
                maxHeight: '520px',
                objectFit: 'cover',
                filter: 'grayscale(100%) contrast(350%) brightness(1.1)',
                transform: cameraIdAtiva && cameras.find(c => c.deviceId === cameraIdAtiva)?.label.toLowerCase().includes('front') ? 'scaleX(-1)' : 'none',
              }}
            />

            {cameras.length > 1 && (
              <button
                type="button"
                onClick={toggleCamera}
                style={{
                  position: 'absolute',
                  top: '12px',
                  right: '12px',
                  background: 'rgba(0, 0, 0, 0.7)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  color: '#fff',
                  borderRadius: '50%',
                  width: '40px',
                  height: '40px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  zIndex: 2,
                }}
                aria-label="Alternar câmera"
              >
                <IoCameraReverseOutline size={22} />
              </button>
            )}
          </>
        ) : (
          <img
            src={fotoCapturada}
            alt="Foto"
            style={{ width: '100%', height: '100%', maxHeight: '520px', objectFit: 'contain' }}
          />
        )}
      </div>

      {/* Barra de Ações Inferior */}
      <div style={{ width: '100%', maxWidth: '440px', marginBottom: '16px' }}>
        {!fotoCapturada ? (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button
              type="button"
              onClick={capturarFoto}
              style={{
                width: '72px',
                height: '72px',
                borderRadius: '50%',
                background: '#fff',
                border: '4px solid rgba(255,255,255,0.4)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'transform 0.15s ease, background 0.15s ease',
                boxShadow: '0 0 20px rgba(255,255,255,0.2)'
              }}
              aria-label="Capturar foto"
            >
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                border: '2px solid #000',
                background: '#fff'
              }} />
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <button
              type="button"
              onClick={tirarOutra}
              className="btn btn-secondary"
              style={{
                minHeight: '48px',
                fontSize: '14px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <IoRefresh size={18} /> Tirar outra
            </button>
            <button
              type="button"
              onClick={baixarFoto}
              className="btn btn-primary"
              style={{
                minHeight: '48px',
                fontSize: '14px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <IoDownloadOutline size={18} /> Baixar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
