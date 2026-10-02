// Cliente com cache em dois níveis (Memória + sessionStorage) para buscas Discogs
const memoryCache = new Map();
const MAX_MEM_ENTRIES = 150;

function getCacheKey({ q, catno, barcode, format = 'vinyl' }) {
  return `discogs:${barcode || ''}|${catno || ''}|${q || ''}|${format}`;
}

export async function fetchDiscogs({ q, catno, barcode, format = 'vinyl' }, signal) {
  const cacheKey = getCacheKey({ q, catno, barcode, format });

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
  if (format) params.set('format', format);

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
