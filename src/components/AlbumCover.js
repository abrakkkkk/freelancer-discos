'use client';

import { useState, useEffect } from 'react';
import { PiVinylRecord, PiDisc } from 'react-icons/pi';

export const memoryCoverCache = new Map();

export function setAlbumCoverCache(id, qKey, url) {
  if (id) memoryCoverCache.set(String(id), url);
  if (qKey) memoryCoverCache.set(qKey.toLowerCase(), url);
  if (id && qKey) memoryCoverCache.set(`${id}_${qKey.toLowerCase()}`, url);
}

export function clearAlbumCoverCache(id) {
  if (!id) return;
  const idStr = String(id);
  for (const key of memoryCoverCache.keys()) {
    if (key === idStr || key.startsWith(`${idStr}_`)) {
      memoryCoverCache.delete(key);
    }
  }
}

export default function AlbumCover({ artista, titulo, ano, id, size = 80, capaUrl = null, tipo = 'discos' }) {
  const [coverUrl, setCoverUrl] = useState(capaUrl || null);
  const [loading, setLoading] = useState(!capaUrl);

  useEffect(() => {
    const cleanAno = ano && String(ano) !== 'null' ? String(ano).trim() : '';
    const q = `${artista || ''} ${titulo || ''}`.trim();
    const qWithAno = `${q} ${cleanAno}`.trim();
    const qKey = qWithAno.toLowerCase();
    const scopedId = id ? (tipo ? `${tipo}_${id}` : String(id)) : '';

    if (capaUrl) {
      setCoverUrl(capaUrl);
      setLoading(false);
      setAlbumCoverCache(scopedId || id, qKey, capaUrl);
      return;
    }

    let isMounted = true;
    // Inclui namespace do tipo e chave da busca (artista + titulo + ano) para isolamento
    const cacheKey = scopedId ? `${scopedId}_${qKey}` : (id ? `${id}_${qKey}` : qKey);

    if (!cacheKey || !q) {
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

    // 3. Buscar na API com versão da query e tipo
    const controller = new AbortController();

    async function fetchCover() {
      try {
        const anoParam = cleanAno ? `&ano=${encodeURIComponent(cleanAno)}` : '';
        const tipoParam = tipo ? `&tipo=${encodeURIComponent(tipo)}` : '';
        const res = await fetch(`/api/cover?id=${encodeURIComponent(id || '')}&q=${encodeURIComponent(q)}${anoParam}${tipoParam}&v=${encodeURIComponent(qKey)}`, {
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
  }, [artista, titulo, ano, id, capaUrl, tipo]);

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
      {tipo === 'cds' ? (
        <PiDisc
          size={Math.round(size * 0.48)}
          color="rgba(255, 255, 255, 0.3)"
          style={loading ? { animation: 'pulse 1.5s infinite' } : {}}
        />
      ) : (
        <PiVinylRecord
          size={Math.round(size * 0.48)}
          color="rgba(255, 255, 255, 0.3)"
          style={loading ? { animation: 'pulse 1.5s infinite' } : {}}
        />
      )}
    </div>
  );
}
