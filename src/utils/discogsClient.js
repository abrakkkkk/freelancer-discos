// Cliente com cache em dois níveis (Memória + sessionStorage) para buscas Discogs
const memoryCache = new Map();
const MAX_MEM_ENTRIES = 150;

function getCacheKey({ q, catno, barcode }) {
  return `discogs:${barcode || ''}|${catno || ''}|${q || ''}`;
}

export async function fetchDiscogs({ q, catno, barcode }, signal) {
  const cacheKey = getCacheKey({ q, catno, barcode });

  // 1. Nível 1: Memória da aplicação (0ms síncrono)
  if (memoryCache.has(cacheKey)) {
    return memoryCache.get(cacheKey);
  }

  // 2. Nível 2: sessionStorage do navegador (0ms persistido na aba)
  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      const stored = sessionStorage.getItem(cacheKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        memoryCache.set(cacheKey, parsed);
        return parsed;
      }
    } catch (_) {}
  }

  // 3. Nível 3: Chamada de rede via API Proxy
  const params = new URLSearchParams();
  if (barcode) params.set('barcode', barcode);
  else if (catno) params.set('catno', catno);
  else if (q) params.set('q', q);

  const url = `/api/discogs?${params.toString()}`;
  const res = await fetch(url, { signal });
  
  if (!res.ok) {
    throw new Error(`Discogs fetch error: ${res.status}`);
  }

  const data = await res.json();

  // Armazena no cache se retornou resultados
  if (data?.results && Array.isArray(data.results)) {
    if (memoryCache.size >= MAX_MEM_ENTRIES) {
      const firstKey = memoryCache.keys().next().value;
      memoryCache.delete(firstKey);
    }
    memoryCache.set(cacheKey, data);

    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        sessionStorage.setItem(cacheKey, JSON.stringify(data));
      } catch (_) {}
    }
  }

  return data;
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
