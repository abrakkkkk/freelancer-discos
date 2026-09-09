import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import staticCovers from '@/data/covers_cache.json';

const CACHE_FILE = path.resolve(process.cwd(), 'src/data/covers_cache.json');
const runtimeMemoryCache = new Map(Object.entries(staticCovers || {}));

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
  const refresh = searchParams.get('refresh') === 'true';

  const qKey = q.trim().toLowerCase();
  const idKey = id ? String(id) : '';

  if (!refresh) {
    // 1. Se tem idKey, verifica se há cache no idKey
    if (idKey) {
      const cachedById = getFromCache(idKey);
      if (cachedById) {
        // Se o item em cache gravou para qual query 'q' ele foi gerado,
        // e a query atual é diferente, os dados do disco mudaram! Cache desatualizado.
        const isSameQuery = !cachedById.q || !qKey || cachedById.q.toLowerCase() === qKey;
        if (isSameQuery) {
          return NextResponse.json(cachedById, {
            headers: {
              'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400',
              'X-Cache': 'HIT-ID',
            },
          });
        }
      }
    }

    // 2. Verifica se há cache pela query do texto (artista + título)
    if (qKey) {
      const cachedByQ = getFromCache(qKey);
      if (cachedByQ) {
        if (idKey) {
          setToCache(idKey, { ...cachedByQ, q: qKey });
        }
        return NextResponse.json(cachedByQ, {
          headers: {
            'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400',
            'X-Cache': 'HIT-Q',
          },
        });
      }
    }
  }

  if (!q && !id) {
    return NextResponse.json({ cover: null, thumb: null });
  }

  const key = process.env.DISCOGS_KEY;
  const secret = process.env.DISCOGS_SECRET;

  if (!key || !secret) {
    return NextResponse.json({ cover: null, thumb: null });
  }

  try {
    const url = `https://api.discogs.com/database/search?type=release&per_page=3&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, {
      headers: {
        'Authorization': `Discogs key=${key}, secret=${secret}`,
        'User-Agent': 'FreelancerDiscos/1.0',
      },
    });

    if (!res.ok) {
      return NextResponse.json({ cover: null, thumb: null }, { status: res.status });
    }

    const data = await res.json();
    const result = data.results && data.results[0];
    const thumb = result?.thumb || null;
    const cover = result?.cover_image || thumb || null;

    const payload = { cover, thumb, q: qKey };
    if (idKey) {
      setToCache(idKey, payload);
    }
    if (qKey) {
      setToCache(qKey, payload);
    }

    return NextResponse.json(payload, {
      headers: {
        'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400',
        'X-Cache': 'MISS',
      },
    });
  } catch (err) {
    console.error('Discogs cover fetch error:', err);
    return NextResponse.json({ cover: null, thumb: null });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { id, artista = '', titulo = '', cover, thumb } = body;

    const idKey = id ? String(id) : '';
    const q = `${artista || ''} ${titulo || ''}`.trim();
    const qKey = q.toLowerCase();

    // Se o cliente forneceu diretamente a imagem (ex: escolheu no dropdown Discogs)
    if (cover || thumb) {
      const payload = { cover: cover || thumb, thumb: thumb || cover, q: qKey };
      if (idKey) setToCache(idKey, payload);
      if (qKey) setToCache(qKey, payload);
      return NextResponse.json({ success: true, ...payload });
    }

    if (!q) {
      const emptyPayload = { cover: null, thumb: null, q: '' };
      if (idKey) setToCache(idKey, emptyPayload);
      return NextResponse.json({ success: true, ...emptyPayload });
    }

    const key = process.env.DISCOGS_KEY;
    const secret = process.env.DISCOGS_SECRET;

    if (!key || !secret) {
      return NextResponse.json({ error: 'Credenciais Discogs não configuradas' }, { status: 500 });
    }

    const url = `https://api.discogs.com/database/search?type=release&per_page=3&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, {
      headers: {
        'Authorization': `Discogs key=${key}, secret=${secret}`,
        'User-Agent': 'FreelancerDiscos/1.0',
      },
    });

    if (!res.ok) {
      return NextResponse.json({ error: 'Falha na busca Discogs' }, { status: res.status });
    }

    const data = await res.json();
    const result = data.results && data.results[0];
    const newThumb = result?.thumb || null;
    const newCover = result?.cover_image || newThumb || null;

    const payload = { cover: newCover, thumb: newThumb, q: qKey };
    if (idKey) setToCache(idKey, payload);
    if (qKey) setToCache(qKey, payload);

    return NextResponse.json({ success: true, ...payload });
  } catch (err) {
    console.error('Erro no POST /api/cover:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (id) {
    deleteFromCache(String(id));
  }
  return NextResponse.json({ success: true });
}
