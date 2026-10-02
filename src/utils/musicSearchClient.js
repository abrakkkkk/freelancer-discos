// Cliente de busca híbrida ultra-rápida (MusicBrainz ~600ms + Discogs em segundo plano)
// Entrega progressiva de resultados com cache em dois níveis (Memória + sessionStorage)

import { fetchDiscogs } from '@/utils/discogsClient';

const memoryCache = new Map();
const MAX_MEM_ENTRIES = 200;

function getCacheKey({ q, catno, barcode }) {
  return `music_hybrid:${barcode || ''}|${catno || ''}|${q || ''}`;
}

export function mergeMusicResults(discogsResults = [], mbResults = []) {
  const map = new Map();

  // 1. Discogs primeiro (possui capas reais de vinil, país Brasil e scores de catálogo)
  discogsResults.forEach(item => {
    const key = (item.title || '').toLowerCase().trim();
    if (key) {
      map.set(key, { ...item, source: item.source || 'discogs' });
    }
  });

  // 2. MusicBrainz enriquece (acrescenta discos não listados e preenche anos faltantes)
  mbResults.forEach(item => {
    const key = (item.title || '').toLowerCase().trim();
    if (!key) return;

    if (!map.has(key)) {
      map.set(key, { ...item, source: 'musicbrainz' });
    } else {
      const existing = map.get(key);
      if (!existing.year && item.year) {
        existing.year = item.year;
      }
      if (!existing.catno && item.catno) {
        existing.catno = item.catno;
      }
      if (!existing.label && item.label) {
        existing.label = item.label;
      }
    }
  });

  return Array.from(map.values());
}

/**
 * Detecta e normaliza selos de prensagens especiais / reedições (Noize, Três Selos, Rocinante, etc.)
 */
export function extractSeloPrensagem(result) {
  if (!result) return '';
  const rawLabels = [];
  if (Array.isArray(result.label)) {
    rawLabels.push(...result.label);
  } else if (typeof result.label === 'string') {
    rawLabels.push(result.label);
  }
  if (Array.isArray(result.labels)) {
    rawLabels.push(...result.labels);
  }

  const searchCorpus = [
    ...rawLabels,
    result.title || '',
    ...(Array.isArray(result.format) ? result.format : [])
  ].join(' ');

  if (/\btr[eê]s\s*selos\b/i.test(searchCorpus)) return 'Três Selos';
  if (/\bnoize\b/i.test(searchCorpus)) return 'Noize';
  if (/\brocinante\b/i.test(searchCorpus)) return 'Rocinante';
  if (/\bfatiado\b/i.test(searchCorpus)) return 'Fatiado';
  if (/\bpolysom\b/i.test(searchCorpus)) return 'Polysom';
  if (/\buniversal(\s+music)?\b/i.test(searchCorpus)) return 'Universal';
  if (/\bsony(\s+music)?\b/i.test(searchCorpus)) return 'Sony';
  if (/\bsom\s+livre\b/i.test(searchCorpus)) return 'Som Livre';
  if (/\bbiscoito\s+fino\b/i.test(searchCorpus)) return 'Biscoito Fino';
  if (/\bassump[çc][aã]o\b/i.test(searchCorpus)) return 'Assumpção';
  if (/\bdiscos\s+nada\b/i.test(searchCorpus)) return 'Discos Nada';

  // Fallback para primeiro selo limpo
  if (rawLabels.length > 0 && typeof rawLabels[0] === 'string') {
    const first = rawLabels[0].split(/[-–/]/)[0].trim();
    if (first && first.length <= 20) {
      return first;
    }
  }

  return '';
}

async function fetchMusicBrainz({ q, catno, barcode }, signal) {
  const params = new URLSearchParams();
  if (barcode) params.set('barcode', barcode);
  else if (catno) params.set('catno', catno);
  else if (q) params.set('q', q);

  const url = `/api/musicbrainz?${params.toString()}`;
  try {
    const res = await fetch(url, { signal });
    if (!res.ok) return [];
    const data = await res.json();
    return data.results || [];
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    return [];
  }
}

export async function searchMusicHybrid({ q, catno, barcode }, signal, onProgress = null) {
  const cacheKey = getCacheKey({ q, catno, barcode });

  // 1. Nível 1: Memória da aplicação (0ms)
  if (memoryCache.has(cacheKey)) {
    const cached = memoryCache.get(cacheKey);
    if (onProgress) onProgress(cached.results, { isPartial: false, source: 'cache' });
    return cached;
  }

  // 2. Nível 2: sessionStorage (0ms)
  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      const stored = sessionStorage.getItem(cacheKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        memoryCache.set(cacheKey, parsed);
        if (onProgress) onProgress(parsed.results, { isPartial: false, source: 'sessionStorage' });
        return parsed;
      }
    } catch (_) {}
  }

  // 3. Nível 3: Disparo paralelo MusicBrainz (rápido ~600ms) + Discogs (completo ~2-5s)
  let mbResults = [];
  let discogsResults = [];
  let deliveredEarly = false;

  const mbPromise = fetchMusicBrainz({ q, catno, barcode }, signal).then(results => {
    mbResults = results;
    // Se o MusicBrainz responder antes e tiver resultados, entrega de imediato ao usuário
    if (mbResults.length > 0 && !deliveredEarly && onProgress) {
      deliveredEarly = true;
      onProgress(mbResults, { isPartial: true, source: 'musicbrainz' });
    }
    return results;
  }).catch(err => {
    if (err.name === 'AbortError') throw err;
    return [];
  });

  const discogsPromise = fetchDiscogs({ q, catno, barcode }, signal).then(data => {
    discogsResults = data?.results || [];
    return discogsResults;
  }).catch(err => {
    if (err.name === 'AbortError') throw err;
    return [];
  });

  // Aguarda ambas as fontes terminarem (ou a mais rápida se a outra falhar)
  await Promise.allSettled([mbPromise, discogsPromise]);

  const merged = mergeMusicResults(discogsResults, mbResults);
  const finalPayload = { results: merged };

  // Atualiza a tela com a fusão final completa
  if (onProgress && merged.length > 0) {
    onProgress(merged, { isPartial: false, source: 'hybrid' });
  }

  // Salva nos caches se houver resultados
  if (merged.length > 0) {
    if (memoryCache.size >= MAX_MEM_ENTRIES) {
      const firstKey = memoryCache.keys().next().value;
      memoryCache.delete(firstKey);
    }
    memoryCache.set(cacheKey, finalPayload);

    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        sessionStorage.setItem(cacheKey, JSON.stringify(finalPayload));
      } catch (_) {}
    }
  }

  return finalPayload;
}
