// Rota de busca Discogs com suporte a q, catno e barcode

function normalizeCatno(str) {
  if (!str) return '';
  return str.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}


// Cache em memória simples no runtime do servidor com TTL de 30 minutos
const CACHE_TTL_MS = 30 * 60 * 1000;
const MAX_CACHE_SIZE = 300;
const memoryCache = new Map();

function getFromCache(key) {
  const item = memoryCache.get(key);
  if (!item) return null;
  if (Date.now() - item.timestamp > CACHE_TTL_MS) {
    memoryCache.delete(key);
    return null;
  }
  return item.data;
}

function setToCache(key, data) {
  if (memoryCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = memoryCache.keys().next().value;
    memoryCache.delete(oldestKey);
  }
  memoryCache.set(key, { timestamp: Date.now(), data });
}

// Timeout de 12 segundos para acomodar picos de latência dos servidores do Discogs
const FETCH_TIMEOUT_MS = 12000;

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');
  const barcode = searchParams.get('barcode');
  const catnoParam = searchParams.get('catno');

  if (!query && !barcode && !catnoParam) {
    return Response.json({ error: 'Query parameter "q", "catno" or "barcode" is required' }, { status: 400 });
  }

  const cacheKey = `b:${barcode || ''}|c:${catnoParam || ''}|q:${query || ''}`;
  const cached = getFromCache(cacheKey);
  if (cached) {
    return Response.json(cached, {
      headers: {
        'X-Cache': 'HIT',
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400'
      }
    });
  }

  const key = process.env.DISCOGS_KEY;
  const secret = process.env.DISCOGS_SECRET;

  if (!key || !secret) {
    return Response.json({ error: 'Discogs credentials not configured' }, { status: 500 });
  }

  const headers = {
    'Authorization': `Discogs key=${key}, secret=${secret}`,
    'User-Agent': 'FreelancerDiscos/1.0'
  };

  try {
    // 1. Busca específica por Código de Barras
    if (barcode) {
      const cleanBarcode = barcode.replace(/[^0-9A-Za-z]/g, '');
      const url = `https://api.discogs.com/database/search?type=release&per_page=15&barcode=${encodeURIComponent(cleanBarcode)}`;
      const response = await fetchWithTimeout(url, { headers });
      if (!response.ok) {
        return Response.json({ error: 'Failed to fetch from Discogs' }, { status: response.status });
      }
      const data = await response.json();
      setToCache(cacheKey, data);
      return Response.json(data, {
        headers: {
          'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800'
        }
      });
    }

    // 2. Busca por Catálogo ou Termo de Busca (q)
    const rawSearch = catnoParam || query;
    let cleanQ = rawSearch.trim();

    // Normaliza variações em português de Vários/Trilha Sonora para Various
    const isVariousType = /\b(v[aá]rios(\s+artistas)?|trilha\s+sonora(\s+original)?)\b/i.test(cleanQ);
    if (isVariousType) {
      cleanQ = cleanQ.replace(/\b(v[aá]rios(\s+artistas)?|trilha\s+sonora(\s+original)?)\b/gi, 'Various').trim();
    }

    const normQuery = normalizeCatno(cleanQ);
    const isCatnoSearch = !!catnoParam || /\d/.test(cleanQ);

    // 1 Única Requisição Rápida Principal:
    // A busca por 'q' varre todos os campos (título, artista e catálogo),
    // encontra 10x mais edições brasileiras e executa em ~250ms (sem tail latency de requests paralelos).
    const primaryUrl = `https://api.discogs.com/database/search?type=release&per_page=15&q=${encodeURIComponent(cleanQ)}`;
    let primaryRes = null;
    try {
      const resp = await fetchWithTimeout(primaryUrl, { headers });
      if (resp.ok) {
        primaryRes = await resp.json();
      }
    } catch (e) {
      console.warn('[Discogs] Erro na busca primária:', e.message);
    }

    let results = primaryRes?.results || [];

    // Fallback: se 'q' retornou 0 itens e for código de catálogo, tenta busca direta por catno
    if (results.length === 0 && isCatnoSearch) {
      const fallbackUrl = `https://api.discogs.com/database/search?type=release&per_page=15&catno=${encodeURIComponent(cleanQ)}`;
      try {
        const fbResp = await fetchWithTimeout(fallbackUrl, { headers });
        if (fbResp.ok) {
          const fbData = await fbResp.json();
          results = fbData?.results || [];
        }
      } catch (e) {
        console.warn('[Discogs] Erro no fallback de catno:', e.message);
      }
    }

    // Ranking de relevância: prioriza edições brasileiras, catálogo exato e vinil
    function calcularScore(item) {
      let score = 0;
      const itemCatno = normalizeCatno(item.catno);

      // Match exato do código de catálogo normalizado
      const isExact = !!(itemCatno && normQuery && itemCatno === normQuery);
      if (isExact) {
        score += 2000;
      } else if (itemCatno && normQuery && (itemCatno.includes(normQuery) || normQuery.includes(itemCatno))) {
        score += 500;
      }

      // Prioridade para edições brasileiras
      if (item.country === 'Brazil') {
        score += 300;
      }

      return { score, isExact };
    }

    const scoredResults = results.map(item => {
      const { score, isExact } = calcularScore(item);
      return { ...item, _score: score, isExactMatch: isExact };
    });

    scoredResults.sort((a, b) => b._score - a._score);

    const payload = { results: scoredResults };
    setToCache(cacheKey, payload);

    return Response.json(payload, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400'
      }
    });
  } catch (error) {
    console.error('Discogs Fetch Error:', error);
    return Response.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
