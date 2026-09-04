'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { IoCamera, IoCameraReverseOutline, IoDownloadOutline, IoRefresh, IoArrowBack } from 'react-icons/io5';
import { FaFire, FaSkull, FaTerminal } from 'react-icons/fa6';
import { MdOutlineContrast } from 'react-icons/md';

const FILTROS = [
  { id: 'deepfried', label: 'Deep-Fried', icon: <FaFire size={14} color="#ff4500" />, desc: 'Binarização 1-bit extrema (o efeito original!)' },
  { id: 'contraste500', label: 'Contraste 500%', icon: <MdOutlineContrast size={14} color="#ffd700" />, desc: 'Preto e branco super saturado' },
  { id: 'negativo', label: 'Raio-X', icon: <FaSkull size={14} color="#00ffff" />, desc: 'Inversão total de cores' },
  { id: 'matrix', label: 'Matrix', icon: <FaTerminal size={14} color="#00ff66" />, desc: 'Verde hacker monocromático' },
];

export default function CameraEstranha() {
  const [stream, setStream] = useState(null);
  const [filtroAtivo, setFiltroAtivo] = useState('deepfried');
  const [fotoCapturada, setFotoCapturada] = useState(null);
  const [cameras, setCameras] = useState([]);
  const [cameraIdAtiva, setCameraIdAtiva] = useState(null);
  const [carregando, setCarregando] = useState(true);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);

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
      console.error('Erro ao acessar câmera estranha:', err);
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

  // Efeitos matemáticos aplicados diretamente no canvas pixel por pixel
  const aplicarEfeitoCanvas = (ctx, w, h, tipo) => {
    const imgData = ctx.getImageData(0, 0, w, h);
    const d = imgData.data;

    if (tipo === 'deepfried') {
      // O efeito extremo original que o amigo adorou: Binarização 1-bit pura (0 ou 255)
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
    } else if (tipo === 'contraste500') {
      for (let i = 0; i < d.length; i += 4) {
        const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        let val = ((gray - 128) * 4.5) + 128;
        val = Math.max(0, Math.min(255, val));
        d[i] = val;
        d[i + 1] = val;
        d[i + 2] = val;
      }
    } else if (tipo === 'negativo') {
      for (let i = 0; i < d.length; i += 4) {
        d[i] = 255 - d[i];
        d[i + 1] = 255 - d[i + 1];
        d[i + 2] = 255 - d[i + 2];
      }
    } else if (tipo === 'matrix') {
      for (let i = 0; i < d.length; i += 4) {
        const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        d[i] = 0;
        d[i + 1] = Math.min(255, gray * 1.5);
        d[i + 2] = 0;
      }
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
    aplicarEfeitoCanvas(ctx, canvas.width, canvas.height, filtroAtivo);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    setFotoCapturada(dataUrl);
    stopCamera();
  };

  const baixarFoto = () => {
    if (!fotoCapturada) return;
    const link = document.createElement('a');
    link.href = fotoCapturada;
    link.download = `foto_estranha_${Date.now()}.jpg`;
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

  const getCssFilter = () => {
    switch (filtroAtivo) {
      case 'deepfried': return 'grayscale(100%) contrast(350%) brightness(1.1)';
      case 'contraste500': return 'grayscale(100%) contrast(500%)';
      case 'negativo': return 'invert(100%) contrast(150%)';
      case 'matrix': return 'grayscale(100%) contrast(250%) sepia(100%) hue-rotate(90deg)';
      default: return 'none';
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#09090b', color: '#fff', padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ width: '100%', maxWidth: '480px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', textDecoration: 'none', fontSize: '13px' }}>
          <IoArrowBack size={16} /> Voltar ao Estoque
        </Link>
        <span style={{ fontSize: '11px', background: '#e53e3e', color: '#fff', padding: '2px 8px', borderRadius: '12px', fontWeight: 700, letterSpacing: '0.5px' }}>
          SECRET LINK 👽
        </span>
      </div>

      <div style={{ width: '100%', maxWidth: '480px', textAlign: 'center', marginBottom: '16px' }}>
        <h1 style={{ margin: '0 0 4px 0', fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-0.5px' }}>Câmera Estranha 📸</h1>
        <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--text-muted)' }}>
          Modo secreto de alto contraste extremo e deep-fried
        </p>
      </div>

      <div style={{ width: '100%', maxWidth: '480px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginBottom: '14px' }}>
        {FILTROS.map(f => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFiltroAtivo(f.id)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              padding: '8px 4px',
              borderRadius: '8px',
              border: filtroAtivo === f.id ? '2px solid var(--accent)' : '1px solid rgba(255,255,255,0.1)',
              background: filtroAtivo === f.id ? 'rgba(229, 62, 62, 0.18)' : '#141416',
              color: filtroAtivo === f.id ? '#fff' : 'var(--text-muted)',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {f.icon}
            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%', textAlign: 'center' }}>
              {f.label}
            </span>
          </button>
        ))}
      </div>

      <div style={{ width: '100%', maxWidth: '480px', position: 'relative', borderRadius: '16px', overflow: 'hidden', background: '#000', border: '1px solid rgba(255,255,255,0.15)', boxShadow: '0 10px 30px rgba(0,0,0,0.6)', minHeight: '340px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
                maxHeight: '440px',
                objectFit: 'cover',
                filter: getCssFilter(),
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
                  width: '38px',
                  height: '38px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  zIndex: 2,
                }}
                title="Alternar câmera frontal/traseira"
              >
                <IoCameraReverseOutline size={20} />
              </button>
            )}
          </>
        ) : (
          <img
            src={fotoCapturada}
            alt="Foto Estranha"
            style={{ width: '100%', height: '100%', maxHeight: '440px', objectFit: 'contain' }}
          />
        )}
      </div>

      <div style={{ width: '100%', maxWidth: '480px', marginTop: '16px' }}>
        {!fotoCapturada ? (
          <button
            type="button"
            onClick={capturarFoto}
            className="btn btn-primary"
            style={{
              width: '100%',
              minHeight: '48px',
              fontSize: '15px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 4px 20px rgba(229, 62, 62, 0.4)',
            }}
          >
            <IoCamera size={22} /> Tirar Foto Estranha
          </button>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <button
              type="button"
              onClick={tirarOutra}
              className="btn btn-secondary"
              style={{ minHeight: '48px', fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
            >
              <IoRefresh size={18} /> Tirar Outra
            </button>
            <button
              type="button"
              onClick={baixarFoto}
              className="btn btn-primary"
              style={{ minHeight: '48px', fontSize: '14px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
            >
              <IoDownloadOutline size={20} /> Baixar Foto
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
