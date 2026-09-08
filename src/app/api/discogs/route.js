import { NextResponse } from 'next/server';

function normalizeCatno(str) {
  if (!str) return '';
  return str.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

function generateCatnoVariations(cleanQ) {
  const variations = new Set();
  const raw = cleanQ.trim();
  variations.add(raw);
  const norm = normalizeCatno(raw);
  
  if (/^\d{6}$/.test(norm)) {
    variations.add(norm);
    variations.add(`${norm.slice(0, 3)}.${norm.slice(3)}`);
    variations.add(`${norm.slice(0, 3)} ${norm.slice(3)}`);
  } else if (/^\d{7}$/.test(norm)) {
    variations.add(norm);
    variations.add(`${norm.slice(0, 3)}.${norm.slice(3)}`);
    variations.add(`${norm.slice(0, 3)} ${norm.slice(3)}`);
  } else {
    const matchPrefix = raw.match(/^([A-Za-z]{2,6})[\s\-\.]*(\d+)$/i);
    if (matchPrefix) {
      const p = matchPrefix[1].toUpperCase();
      const n = matchPrefix[2];
      variations.add(`${p} ${n}`);
      variations.add(`${p}-${n}`);
      variations.add(`${p}${n}`);
    }
  }

  // Se tiver espaços ou pontos, adiciona versão contínua
  const semEspaco = raw.replace(/[\s\-\.]+/g, '');
  if (semEspaco.length >= 3) {
    variations.add(semEspaco);
  }

  return Array.from(variations);
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

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');
  const barcode = searchParams.get('barcode');
  const catnoParam = searchParams.get('catno');

  if (!query && !barcode && !catnoParam) {
    return NextResponse.json({ error: 'Query parameter "q", "catno" or "barcode" is required' }, { status: 400 });
  }

  const cacheKey = `b:${barcode || ''}|c:${catnoParam || ''}|q:${query || ''}`;
  const cached = getFromCache(cacheKey);
  if (cached) {
    return NextResponse.json(cached, {
      headers: { 'X-Cache': 'HIT' }
    });
  }

  const key = process.env.DISCOGS_KEY;
  const secret = process.env.DISCOGS_SECRET;

  if (!key || !secret) {
    return NextResponse.json({ error: 'Discogs credentials not configured' }, { status: 500 });
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
      const response = await fetch(url, { headers });
      if (!response.ok) {
        return NextResponse.json({ error: 'Failed to fetch from Discogs' }, { status: response.status });
      }
      const data = await response.json();
      setToCache(cacheKey, data);
      return NextResponse.json(data);
    }

    // 2. Busca por Catálogo ou Termo de Busca (q)
    const rawSearch = catnoParam || query;
    const cleanQ = rawSearch.trim();
    const normQuery = normalizeCatno(cleanQ);
    const isCatnoSearch = !!catnoParam || /\d/.test(cleanQ);

    const variations = isCatnoSearch ? generateCatnoVariations(cleanQ) : [cleanQ];

    const requests = [];

    // Busca geral por termo (q)
    requests.push(
      fetch(`https://api.discogs.com/database/search?type=release&per_page=15&q=${encodeURIComponent(cleanQ)}`, { headers })
        .then(r => r.ok ? r.json() : { results: [] })
        .catch(() => ({ results: [] }))
    );

    if (isCatnoSearch) {
      // Prioridade: Busca no catálogo brasileiro para as variações principais (até 2 variações)
      const topVariations = variations.slice(0, 2);

      for (const v of topVariations) {
        // Busca direta com country=Brazil
        requests.push(
          fetch(`https://api.discogs.com/database/search?type=release&per_page=10&country=Brazil&catno=${encodeURIComponent(v)}`, { headers })
            .then(r => r.ok ? r.json() : { results: [] })
            .catch(() => ({ results: [] }))
        );

        // Busca global pelo código de catálogo
        requests.push(
          fetch(`https://api.discogs.com/database/search?type=release&per_page=10&catno=${encodeURIComponent(v)}`, { headers })
            .then(r => r.ok ? r.json() : { results: [] })
            .catch(() => ({ results: [] }))
        );
      }
    }

    const responses = await Promise.all(requests);
    const generalResults = responses[0]?.results || [];
    const catnoResponses = responses.slice(1);

    const map = new Map();

    function calcularScore(item, originatesFromCatno) {
      let score = 0;
      const itemCatno = normalizeCatno(item.catno);

      // Match exato do código de catálogo normalizado
      const isExact = !!(itemCatno && normQuery && itemCatno === normQuery);
      if (isExact) {
        score += 2000;
      } else if (itemCatno && normQuery && (itemCatno.includes(normQuery) || normQuery.includes(itemCatno))) {
        score += 500;
      }

      if (originatesFromCatno) {
        score += 150;
      }

      // Prioridade máxima para edições brasileiras
      if (item.country === 'Brazil') {
        score += 300;
      }

      // Prioridade para vinil / LP
      if (Array.isArray(item.format) && item.format.some(f => f.toLowerCase().includes('vinyl') || f.toLowerCase().includes('lp'))) {
        score += 50;
      }

      return { score, isExact };
    }

    // Processa resultados específicos de catálogo primeiro
    catnoResponses.forEach(res => {
      const results = res?.results || [];
      results.forEach(item => {
        if (!map.has(item.id)) {
          const { score, isExact } = calcularScore(item, true);
          map.set(item.id, { ...item, _score: score, isExactMatch: isExact });
        }
      });
    });

    // Processa resultados gerais
    generalResults.forEach(item => {
      if (!map.has(item.id)) {
        const { score, isExact } = calcularScore(item, false);
        map.set(item.id, { ...item, _score: score, isExactMatch: isExact });
      }
    });

    const sortedResults = Array.from(map.values()).sort((a, b) => b._score - a._score);
    const payload = { results: sortedResults };
    setToCache(cacheKey, payload);
    return NextResponse.json(payload);
  } catch (error) {
    console.error('Discogs Fetch Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
