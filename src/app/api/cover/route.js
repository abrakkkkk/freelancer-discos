import fs from 'fs';
import path from 'path';

const PRIMARY_CACHE_FILE = path.resolve(process.cwd(), '.cache/covers_cache.json');
const LEGACY_CACHE_FILE = path.resolve(process.cwd(), 'src/data/covers_cache.json');

let initialCovers = {};
try {
  if (fs.existsSync(PRIMARY_CACHE_FILE)) {
    initialCovers = JSON.parse(fs.readFileSync(PRIMARY_CACHE_FILE, 'utf-8'));
  } else if (fs.existsSync(LEGACY_CACHE_FILE)) {
    initialCovers = JSON.parse(fs.readFileSync(LEGACY_CACHE_FILE, 'utf-8'));
  }
} catch (_) {}

const runtimeMemoryCache = new Map(Object.entries(initialCovers || {}));

function getFromCache(key) {
  return runtimeMemoryCache.get(key) || null;
}

let saveDebounceTimer = null;
let isSavingCache = false;

function scheduleSaveCache() {
  // Apenas grava em disco no ambiente de desenvolvimento local (fora da Vercel / serverless)
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL) return;

  if (saveDebounceTimer) {
    clearTimeout(saveDebounceTimer);
  }

  saveDebounceTimer = setTimeout(async () => {
    if (isSavingCache) {
      scheduleSaveCache();
      return;
    }
    isSavingCache = true;
    try {
      const dir = path.dirname(PRIMARY_CACHE_FILE);
      if (!fs.existsSync(dir)) {
        await fs.promises.mkdir(dir, { recursive: true });
      }
      const currentCacheObj = Object.fromEntries(runtimeMemoryCache);
      await fs.promises.writeFile(PRIMARY_CACHE_FILE, JSON.stringify(currentCacheObj, null, 2), 'utf-8');
    } catch (_) {
      // Ignora silenciosamente erros de gravação em disco
    } finally {
      isSavingCache = false;
    }
  }, 2000);
}

function setToCache(key, payload) {
  runtimeMemoryCache.set(key, payload);
  scheduleSaveCache();
}

function deleteFromCache(key) {
  runtimeMemoryCache.delete(key);
  scheduleSaveCache();
}

function normalizeSearchQuery(str) {
  if (!str) return '';
  return str
    .replace(/\b(v[aá]rios(\s+artistas)?|trilha\s+sonora(\s+original)?)\b/gi, 'Various')
    .trim();
}

async function searchDiscogsCover(rawQ, cleanAno, key, secret) {
  const normQ = normalizeSearchQuery(rawQ);
  const headers = {
    'Authorization': `Discogs key=${key}, secret=${secret}`,
    'User-Agent': 'FreelancerDiscos/1.0',
  };

  // 1. Busca padrão com ano (se houver)
  let url = `https://api.discogs.com/database/search?type=release&per_page=5&q=${encodeURIComponent(normQ)}`;
  if (cleanAno) url += `&year=${encodeURIComponent(cleanAno)}`;

  try {
    const res = await fetch(url, { headers });
    if (res.ok) {
      const data = await res.json();
      if (data.results && data.results.length > 0) {
        const item = data.results.find(r => r.cover_image || r.thumb) || data.results[0];
        if (item) return item;
      }
    }
  } catch (_) {}

  // 2. Fallback sem ano
  if (cleanAno) {
    try {
      const fallbackUrl = `https://api.discogs.com/database/search?type=release&per_page=5&q=${encodeURIComponent(normQ)}`;
      const fallbackRes = await fetch(fallbackUrl, { headers });
      if (fallbackRes.ok) {
        const fallbackData = await fallbackRes.json();
        if (fallbackData.results && fallbackData.results.length > 0) {
          const item = fallbackData.results.find(r => r.cover_image || r.thumb) || fallbackData.results[0];
          if (item) return item;
        }
      }
    } catch (_) {}
  }

  // 3. Smart Fallback para trilhas/coletâneas: busca por título limpo sem Various e sem ruídos de novela
  if (/^various\s+/i.test(normQ)) {
    const titleOnly = normQ.replace(/^various\s+/i, '').trim();
    const cleanTitle = titleOnly
      .replace(/\s*\(.*?\)/g, '')
      .replace(/\s*-\s*(nacional|internacional|volume\s*\d+|vol\.?\s*\d+)/gi, '')
      .replace(/:.*$/, '')
      .trim();

    if (cleanTitle && cleanTitle.length >= 3) {
      try {
        const titleUrl = `https://api.discogs.com/database/search?type=release&per_page=5&country=Brazil&q=${encodeURIComponent(cleanTitle)}`;
        const titleRes = await fetch(titleUrl, { headers });
        if (titleRes.ok) {
          const titleData = await titleRes.json();
          const match = titleData.results?.find(r => r.title?.toLowerCase().includes('various') && (r.cover_image || r.thumb))
            || titleData.results?.find(r => r.cover_image || r.thumb)
            || titleData.results?.[0];
          if (match) return match;
        }
      } catch (_) {}
    }
  }

  return null;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const rawQ = searchParams.get('q') || '';
  const id = searchParams.get('id') || '';
  const ano = searchParams.get('ano') || searchParams.get('year') || '';
  const refresh = searchParams.get('refresh') === 'true';

  const q = normalizeSearchQuery(rawQ);
  const cleanAno = ano && String(ano) !== 'null' ? String(ano).trim() : '';
  const qFull = `${q} ${cleanAno}`.trim();
  const qKey = qFull.toLowerCase();
  const idKey = id ? String(id) : '';

  if (!refresh) {
    // 1. Se tem idKey, verifica se há cache com imagem válida no idKey
    if (idKey) {
      const cachedById = getFromCache(idKey);
      if (cachedById && (cachedById.cover || cachedById.thumb)) {
        const isSameQuery = !cachedById.q || !qKey || cachedById.q.toLowerCase() === qKey;
        if (isSameQuery) {
          return Response.json(cachedById, {
            headers: {
              'Cache-Control': 'no-cache, no-store, must-revalidate',
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
            'Cache-Control': 'no-cache, no-store, must-revalidate',
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
    const result = await searchDiscogsCover(q, cleanAno, key, secret);
    const thumb = result?.thumb || null;
    const cover = result?.cover_image || thumb || null;

    const payload = { cover, thumb, q: qKey, ano: cleanAno };
    if (cover || thumb) {
      if (idKey) setToCache(idKey, payload);
      if (qKey) setToCache(qKey, payload);
    }

    return Response.json(payload, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
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
    const rawQ = `${artista || ''} ${titulo || ''}`.trim();
    const q = normalizeSearchQuery(rawQ);
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

    const result = await searchDiscogsCover(q, cleanAno, key, secret);
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
