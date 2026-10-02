// Rota de busca ultra-rápida via MusicBrainz Web Service v2
// Retorna schema compatível com a interface do Freelancer Discos

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hora
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

const FETCH_TIMEOUT_MS = 5000;

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
  const catno = searchParams.get('catno');

  if (!query && !barcode && !catno) {
    return Response.json({ error: 'Parâmetro "q", "catno" ou "barcode" é obrigatório' }, { status: 400 });
  }

  const cacheKey = `mb:b:${barcode || ''}|c:${catno || ''}|q:${query || ''}`;
  const cached = getFromCache(cacheKey);
  if (cached) {
    return Response.json(cached, {
      headers: {
        'X-Cache': 'HIT',
        'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800'
      }
    });
  }

  let luceneQuery = '';
  if (barcode) {
    const cleanBarcode = barcode.replace(/[^0-9A-Za-z]/g, '');
    luceneQuery = `barcode:${cleanBarcode}`;
  } else if (catno) {
    const cleanCatno = catno.trim().replace(/["\\]/g, '');
    luceneQuery = `catno:"${cleanCatno}" OR "${cleanCatno}"`;
  } else {
    const cleanQ = query.trim().replace(/["\\]/g, '');
    luceneQuery = `"${cleanQ}" OR release:"${cleanQ}" OR artist:"${cleanQ}"`;
  }

  const url = `https://musicbrainz.org/ws/2/release?query=${encodeURIComponent(luceneQuery)}&fmt=json&limit=15`;
  const headers = {
    'User-Agent': 'FreelancerDiscos/1.0 ( contatofreelancerdiscos@gmail.com )',
    'Accept': 'application/json'
  };

  try {
    const response = await fetchWithTimeout(url, { headers });
    if (!response.ok) {
      return Response.json({ results: [] }, { status: 200 });
    }

    const data = await response.json();
    const rawReleases = data.releases || [];

    const results = rawReleases.map(r => {
      const artistCredits = r['artist-credit'] || [];
      const artist = artistCredits.map(a => (a.name || '') + (a.joinphrase || '')).join('').trim() || 'Desconhecido';
      const albumTitle = r.title || '';
      const fullTitle = `${artist} - ${albumTitle}`;

      // Extrai catálogo e gravadora do label-info
      const labelInfos = r['label-info'] || [];
      const catnos = labelInfos.map(l => l['catalog-number']).filter(Boolean);
      const labels = labelInfos.map(l => l.label?.name).filter(Boolean);
      const catnoStr = catnos[0] || '';
      const labelStr = labels[0] || '';

      // Extrai ano do formato YYYY ou YYYY-MM-DD
      const year = r.date ? r.date.slice(0, 4) : '';

      // Formato de mídia (Vinyl, CD, etc.)
      const media = r.media || [];
      const formats = media.map(m => m.format).filter(Boolean);

      const country = r.country === 'BR' ? 'Brazil' : (r.country || '');

      return {
        id: `mb-${r.id}`,
        title: fullTitle,
        artist,
        album: albumTitle,
        year,
        catno: catnoStr,
        label: labelStr,
        country,
        format: formats.length > 0 ? formats : ['Vinyl'],
        source: 'musicbrainz',
        _score: Number(r.score || 0)
      };
    });

    // Prioriza edições brasileiras no topo
    results.sort((a, b) => {
      const aBr = a.country === 'Brazil' ? 100 : 0;
      const bBr = b.country === 'Brazil' ? 100 : 0;
      return (b._score + bBr) - (a._score + aBr);
    });

    const payload = { results };
    setToCache(cacheKey, payload);

    return Response.json(payload, {
      headers: {
        'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800'
      }
    });
  } catch (error) {
    console.error('MusicBrainz Fetch Error:', error.message);
    return Response.json({ results: [] }, { status: 200 });
  }
}
