'use client';

import { useState, useEffect, useRef } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { IoClose, IoCameraReverseOutline, IoImageOutline } from 'react-icons/io5';
import { FaBarcode } from 'react-icons/fa6';

export default function BarcodeScannerModal({ isOpen, onClose, onScan }) {
  const [erroCamera, setErroCamera] = useState(null);
  const [cameras, setCameras] = useState([]);
  const [cameraIdAtiva, setCameraIdAtiva] = useState(null);
  const [manualCode, setManualCode] = useState('');
  const [isStarting, setIsStarting] = useState(true);

  const scannerRef = useRef(null);
  const audioCtxRef = useRef(null);
  const fileInputRef = useRef(null);

  // Som sutil de confirmação de leitura via Web Audio API
  const playBeep = () => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1046.5, ctx.currentTime); // C6
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch (e) {
      // Ignora erro de áudio se o navegador bloquear
    }

    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(80);
    }
  };

  const handleDetected = (decodedText) => {
    playBeep();
    stopScanner();
    onScan(decodedText.trim());
    onClose();
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErroCamera(null);
    setIsStarting(true);

    try {
      const html5QrCode = new Html5Qrcode('barcode-file-reader', {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.QR_CODE,
        ],
        verbose: false,
      });

      const decodedText = await html5QrCode.scanFile(file, false);
      html5QrCode.clear();
      if (decodedText) {
        handleDetected(decodedText);
      }
    } catch (err) {
      console.warn('Falha ao decodificar imagem:', err);
      setErroCamera('Código de barras não encontrado na foto. Tente uma imagem mais nítida/aproximada ou digite o código.');
    } finally {
      setIsStarting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        await scannerRef.current.clear();
      } catch (err) {
        console.warn('Erro ao finalizar scanner:', err);
      }
      scannerRef.current = null;
    }
  };

  const startScanner = async (preferredCameraId = null) => {
    setErroCamera(null);
    setIsStarting(true);

    try {
      await stopScanner();

      const html5QrCode = new Html5Qrcode('barcode-reader-container', {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.QR_CODE,
        ],
        verbose: false,
      });

      scannerRef.current = html5QrCode;

      // Obter lista de câmeras disponíveis
      const devices = await Html5Qrcode.getCameras();
      setCameras(devices || []);

      let cameraToUse;
      if (preferredCameraId) {
        cameraToUse = { deviceId: { exact: preferredCameraId } };
      } else if (devices && devices.length > 0) {
        // Tentar câmera traseira no mobile (back / environment)
        const backCam = devices.find(d => 
          d.label.toLowerCase().includes('back') || 
          d.label.toLowerCase().includes('traseira') ||
          d.label.toLowerCase().includes('rear') ||
          d.label.toLowerCase().includes('environment')
        );
        cameraToUse = backCam ? { deviceId: { exact: backCam.id } } : { facingMode: 'environment' };
        setCameraIdAtiva(backCam ? backCam.id : devices[0].id);
      } else {
        cameraToUse = { facingMode: 'environment' };
      }

      const qrboxFunction = (viewfinderWidth, viewfinderHeight) => {
        // Caixa retangular otimizada para códigos de barra horizontais (EAN/UPC)
        const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
        const width = Math.floor(minEdge * 0.85);
        const height = Math.floor(width * 0.55);
        return { width: Math.max(220, width), height: Math.max(140, height) };
      };

      await html5QrCode.start(
        cameraToUse,
        {
          fps: 15,
          qrbox: qrboxFunction,
          aspectRatio: 1.333333,
        },
        (decodedText) => {
          handleDetected(decodedText);
        },
        () => {
          // Frame sem código detectado (normal)
        }
      );

      setIsStarting(false);
    } catch (err) {
      console.error('Erro ao iniciar câmera:', err);
      setIsStarting(false);
      setErroCamera(
        err?.message?.includes('Permission') || err?.name === 'NotAllowedError'
          ? 'Permissão de acesso à câmera negada. Habilite a câmera nas configurações do seu navegador para escanear.'
          : 'Não foi possível acessar a câmera. Digite o código de barras manualmente abaixo.'
      );
    }
  };

  const toggleCamera = async () => {
    if (!cameras || cameras.length <= 1) return;
    const currentIndex = cameras.findIndex(c => c.id === cameraIdAtiva);
    const nextIndex = (currentIndex + 1) % cameras.length;
    const nextCamera = cameras[nextIndex];
    setCameraIdAtiva(nextCamera.id);
    await startScanner(nextCamera.id);
  };

  useEffect(() => {
    if (isOpen) {
      // Pequeno delay para garantir que o DOM renderizou o container com ID
      const timer = setTimeout(() => {
        startScanner();
      }, 150);
      return () => {
        clearTimeout(timer);
        stopScanner();
      };
    } else {
      stopScanner();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="scanner-modal-overlay" onClick={() => { stopScanner(); onClose(); }}>
      <div className="scanner-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="scanner-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FaBarcode size={20} color="var(--accent)" />
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600 }}>Leitor de Código de Barras</h3>
          </div>
          <button 
            type="button" 
            className="scanner-close-btn"
            onClick={() => { stopScanner(); onClose(); }}
            title="Fechar"
          >
            <IoClose size={22} />
          </button>
        </div>

        <div className="scanner-viewfinder-wrapper">
          <div id="barcode-reader-container" style={{ width: '100%', minHeight: '260px' }} />

          {isStarting && !erroCamera && (
            <div className="scanner-status-overlay">
              <div className="scanner-spinner" />
              <span>Iniciando câmera...</span>
            </div>
          )}

          {!erroCamera && !isStarting && (
            <div className="scanner-laser-line" />
          )}

          {erroCamera && (
            <div className="scanner-error-box">
              <p style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#fc8181' }}>{erroCamera}</p>
            </div>
          )}
        </div>

        <div className="scanner-modal-footer">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Aponte a câmera para o código no verso do vinil ou CD
            </span>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
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
                className="btn btn-secondary" 
                style={{ padding: '6px 10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                title="Carregar foto da galeria"
              >
                <IoImageOutline size={16} /> Foto
              </button>
              {cameras.length > 1 && (
                <button 
                  type="button" 
                  onClick={toggleCamera} 
                  className="btn btn-secondary" 
                  style={{ padding: '6px 10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                  title="Alternar câmera"
                >
                  <IoCameraReverseOutline size={16} /> Alternar
                </button>
              )}
            </div>
          </div>
          <div id="barcode-file-reader" style={{ display: 'none' }} />

          <form 
            onSubmit={(e) => {
              e.preventDefault();
              if (manualCode.trim()) {
                handleDetected(manualCode.trim());
              }
            }} 
            style={{ display: 'flex', gap: '8px', width: '100%' }}
          >
            <input 
              type="text" 
              placeholder="Ou digite o código de barras (EAN/UPC)..." 
              value={manualCode} 
              onChange={(e) => setManualCode(e.target.value)}
              style={{ flex: 1, fontSize: '14px', padding: '8px 12px', borderRadius: 'var(--radius-sm)' }}
            />
            <button 
              type="submit" 
              className="btn btn-primary" 
              disabled={!manualCode.trim()}
              style={{ whiteSpace: 'nowrap', padding: '8px 14px' }}
            >
              OK
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
