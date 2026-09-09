'use client';

import { useState, useEffect } from 'react';
import { PiVinylRecord } from 'react-icons/pi';

const memoryCoverCache = new Map();

export default function AlbumCover({ artista, titulo, id, size = 80 }) {
  const [coverUrl, setCoverUrl] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const q = `${artista || ''} ${titulo || ''}`.trim();
    const qKey = q.toLowerCase();
    // Inclui a chave da busca (artista + titulo) para invalidar automaticamente se o disco for editado
    const cacheKey = id ? `${id}_${qKey}` : qKey;

    if (!cacheKey || !qKey) {
      setCoverUrl(null);
      setLoading(false);
      return;
    }

    // 1. Memória RAM
    if (memoryCoverCache.has(cacheKey)) {
      setCoverUrl(memoryCoverCache.get(cacheKey));
      setLoading(false);
      return;
    }

    // 2. SessionStorage
    try {
      const stored = sessionStorage.getItem(`cover_${cacheKey}`);
      if (stored) {
        memoryCoverCache.set(cacheKey, stored);
        setCoverUrl(stored);
        setLoading(false);
        return;
      }
    } catch (e) {}

    // Reseta capa e ativa loading para nova busca
    setCoverUrl(null);
    setLoading(true);

    // 3. Buscar na API com versão da query (evita cache HTTP antigo do navegador)
    const controller = new AbortController();

    async function fetchCover() {
      try {
        const res = await fetch(`/api/cover?id=${encodeURIComponent(id || '')}&q=${encodeURIComponent(q)}&v=${encodeURIComponent(qKey)}`, {
          signal: controller.signal
        });
        if (!res.ok) throw new Error('Cover fetch failed');
        const data = await res.json();
        const img = data.thumb || data.cover || null;

        if (isMounted) {
          setCoverUrl(img);
          setLoading(false);
        }

        if (img) {
          memoryCoverCache.set(cacheKey, img);
          try {
            sessionStorage.setItem(`cover_${cacheKey}`, img);
          } catch (e) {}
        }
      } catch (err) {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchCover();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [artista, titulo, id]);

  const containerStyle = {
    width: `${size}px`,
    height: `${size}px`,
    minWidth: `${size}px`,
    minHeight: `${size}px`,
    borderRadius: '8px',
    overflow: 'hidden',
    background: '#18181b',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 3px 8px rgba(0, 0, 0, 0.3)',
    position: 'relative',
    flexShrink: 0,
  };

  if (coverUrl) {
    return (
      <div style={containerStyle} className="album-cover-container">
        <img
          src={coverUrl}
          alt={titulo || 'Capa do álbum'}
          loading="lazy"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
          }}
          onError={() => setCoverUrl(null)}
        />
      </div>
    );
  }

  return (
    <div style={containerStyle} className="album-cover-container album-cover-placeholder">
      <PiVinylRecord
        size={Math.round(size * 0.48)}
        color="rgba(255, 255, 255, 0.3)"
        style={loading ? { animation: 'pulse 1.5s infinite' } : {}}
      />
    </div>
  );
}
