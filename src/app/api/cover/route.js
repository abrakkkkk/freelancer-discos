import fs from 'fs';
import path from 'path';

const CACHE_FILE = path.resolve(process.cwd(), 'src/data/covers_cache.json');
let initialCovers = {};
try {
  if (fs.existsSync(CACHE_FILE)) {
    initialCovers = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
  }
} catch (_) {}

const runtimeMemoryCache = new Map(Object.entries(initialCovers || {}));

function getFromCache(key) {
  return runtimeMemoryCache.get(key) || null;
}

function setToCache(key, payload) {
  runtimeMemoryCache.set(key, payload);

  // Apenas tenta gravar em disco no ambiente local (fora da Vercel / serverless)
  if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    try {
      const dir = path.dirname(CACHE_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const currentCacheObj = Object.fromEntries(runtimeMemoryCache);
      fs.writeFileSync(CACHE_FILE, JSON.stringify(currentCacheObj, null, 2), 'utf-8');
    } catch (_) {
      // Ignora silenciosamente se o disco for read-only
    }
  }
}

function deleteFromCache(key) {
  runtimeMemoryCache.delete(key);
  if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    try {
      const currentCacheObj = Object.fromEntries(runtimeMemoryCache);
      fs.writeFileSync(CACHE_FILE, JSON.stringify(currentCacheObj, null, 2), 'utf-8');
    } catch (_) {}
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') || '';
  const id = searchParams.get('id') || '';
  const ano = searchParams.get('ano') || searchParams.get('year') || '';
  const refresh = searchParams.get('refresh') === 'true';

  const cleanAno = ano && String(ano) !== 'null' ? String(ano).trim() : '';
  const qFull = `${q} ${cleanAno}`.trim();
  const qKey = qFull.toLowerCase();
  const idKey = id ? String(id) : '';

  if (!refresh) {
    // 1. Se tem idKey, verifica se há cache com imagem válida no idKey
    if (idKey) {
      const cachedById = getFromCache(idKey);
      if (cachedById && (cachedById.cover || cachedById.thumb)) {
        // Se o item em cache gravou para qual query 'q' ele foi gerado,
        // e a query atual é diferente, os dados do disco mudaram! Cache desatualizado.
        const isSameQuery = !cachedById.q || !qKey || cachedById.q.toLowerCase() === qKey;
        if (isSameQuery) {
          return Response.json(cachedById, {
            headers: {
              'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400',
              'X-Cache': 'HIT-ID',
            },
          });
        }
      }
    }

    // 2. Verifica se há cache com imagem válida pela query do texto (artista + título + ano)
    if (qKey) {
      const cachedByQ = getFromCache(qKey);
      if (cachedByQ && (cachedByQ.cover || cachedByQ.thumb)) {
        if (idKey) {
          setToCache(idKey, { ...cachedByQ, q: qKey });
        }
        return Response.json(cachedByQ, {
          headers: {
            'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400',
            'X-Cache': 'HIT-Q',
          },
        });
      }
    }
  }

  if (!q && !id) {
    return Response.json({ cover: null, thumb: null });
  }

  const key = process.env.DISCOGS_KEY;
  const secret = process.env.DISCOGS_SECRET;

  if (!key || !secret) {
    return Response.json({ cover: null, thumb: null });
  }

  try {
    let url = `https://api.discogs.com/database/search?type=release&per_page=3&q=${encodeURIComponent(q)}`;
    if (cleanAno) {
      url += `&year=${encodeURIComponent(cleanAno)}`;
    }
    const res = await fetch(url, {
      headers: {
        'Authorization': `Discogs key=${key}, secret=${secret}`,
        'User-Agent': 'FreelancerDiscos/1.0',
      },
    });

    if (!res.ok) {
      return Response.json({ cover: null, thumb: null }, { status: res.status });
    }

    const data = await res.json();
    let result = data.results && data.results[0];

    // Fallback se não encontrar com ano específico (ex: reedição cadastrada com ano diferente)
    if (!result && cleanAno) {
      try {
        const fallbackUrl = `https://api.discogs.com/database/search?type=release&per_page=3&q=${encodeURIComponent(q)}`;
        const fallbackRes = await fetch(fallbackUrl, {
          headers: {
            'Authorization': `Discogs key=${key}, secret=${secret}`,
            'User-Agent': 'FreelancerDiscos/1.0',
          },
        });
        if (fallbackRes.ok) {
          const fallbackData = await fallbackRes.json();
          result = fallbackData.results && fallbackData.results[0];
        }
      } catch (_) {}
    }

    const thumb = result?.thumb || null;
    const cover = result?.cover_image || thumb || null;

    const payload = { cover, thumb, q: qKey, ano: cleanAno };
    if (cover || thumb) {
      if (idKey) setToCache(idKey, payload);
      if (qKey) setToCache(qKey, payload);
    }

    return Response.json(payload, {
      headers: {
        'Cache-Control': cover || thumb 
          ? 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400'
          : 'no-cache, no-store',
        'X-Cache': 'MISS',
      },
    });
  } catch (err) {
    console.error('Discogs cover fetch error:', err);
    return Response.json({ cover: null, thumb: null });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { id, artista = '', titulo = '', ano = '', cover, thumb } = body;

    const cleanAno = ano && String(ano) !== 'null' ? String(ano).trim() : '';
    const idKey = id ? String(id) : '';
    const q = `${artista || ''} ${titulo || ''}`.trim();
    const qFull = `${q} ${cleanAno}`.trim();
    const qKey = qFull.toLowerCase();

    // Se o cliente forneceu diretamente a imagem (ex: escolheu no dropdown Discogs)
    if (cover || thumb) {
      const payload = { cover: cover || thumb, thumb: thumb || cover, q: qKey, ano: cleanAno };
      if (idKey) setToCache(idKey, payload);
      if (qKey) setToCache(qKey, payload);
      return Response.json({ success: true, ...payload });
    }

    if (!q) {
      const emptyPayload = { cover: null, thumb: null, q: '' };
      if (idKey) setToCache(idKey, emptyPayload);
      return Response.json({ success: true, ...emptyPayload });
    }

    const key = process.env.DISCOGS_KEY;
    const secret = process.env.DISCOGS_SECRET;

    if (!key || !secret) {
      return Response.json({ error: 'Credenciais Discogs não configuradas' }, { status: 500 });
    }

    let url = `https://api.discogs.com/database/search?type=release&per_page=3&q=${encodeURIComponent(q)}`;
    if (cleanAno) {
      url += `&year=${encodeURIComponent(cleanAno)}`;
    }
    const res = await fetch(url, {
      headers: {
        'Authorization': `Discogs key=${key}, secret=${secret}`,
        'User-Agent': 'FreelancerDiscos/1.0',
      },
    });

    if (!res.ok) {
      return Response.json({ error: 'Falha na busca Discogs' }, { status: res.status });
    }

    const data = await res.json();
    let result = data.results && data.results[0];

    // Fallback se não encontrar com ano
    if (!result && cleanAno) {
      try {
        const fallbackUrl = `https://api.discogs.com/database/search?type=release&per_page=3&q=${encodeURIComponent(q)}`;
        const fallbackRes = await fetch(fallbackUrl, {
          headers: {
            'Authorization': `Discogs key=${key}, secret=${secret}`,
            'User-Agent': 'FreelancerDiscos/1.0',
          },
        });
        if (fallbackRes.ok) {
          const fallbackData = await fallbackRes.json();
          result = fallbackData.results && fallbackData.results[0];
        }
      } catch (_) {}
    }

    const newThumb = result?.thumb || null;
    const newCover = result?.cover_image || newThumb || null;

    const payload = { cover: newCover, thumb: newThumb, q: qKey, ano: cleanAno };
    if (idKey) setToCache(idKey, payload);
    if (qKey) setToCache(qKey, payload);

    return Response.json({ success: true, ...payload });
  } catch (err) {
    console.error('Erro no POST /api/cover:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (id) {
    deleteFromCache(String(id));
  }
  return Response.json({ success: true });
}
