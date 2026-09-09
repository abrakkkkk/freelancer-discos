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

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') || '';
  const id = searchParams.get('id') || '';

  const cacheKey = id ? String(id) : q.trim().toLowerCase();
  const cached = getFromCache(cacheKey);

  if (cached) {
    return NextResponse.json(cached, {
      headers: {
        'Cache-Control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400',
        'X-Cache': 'HIT',
      },
    });
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

    const payload = { cover, thumb };
    setToCache(cacheKey, payload);
    if (id && q) {
      setToCache(q.trim().toLowerCase(), payload);
    }

    return NextResponse.json(payload, {
      headers: {
        'Cache-Control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400',
        'X-Cache': 'MISS',
      },
    });
  } catch (err) {
    console.error('Discogs cover fetch error:', err);
    return NextResponse.json({ cover: null, thumb: null });
  }
}
