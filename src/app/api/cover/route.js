import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const CACHE_FILE = path.resolve(process.cwd(), 'src/data/covers_cache.json');
let fileCache = null;

function loadCache() {
  if (fileCache) return fileCache;
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const content = fs.readFileSync(CACHE_FILE, 'utf-8');
      fileCache = JSON.parse(content);
      return fileCache;
    }
  } catch (e) {
    console.error('Error loading covers cache:', e);
  }
  fileCache = {};
  return fileCache;
}

function saveCache(cache) {
  try {
    const dir = path.dirname(CACHE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf-8');
  } catch (e) {
    console.error('Error saving covers cache:', e);
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') || '';
  const id = searchParams.get('id') || '';

  const cache = loadCache();
  const cacheKey = id ? String(id) : q.trim().toLowerCase();

  if (cache[cacheKey]) {
    return NextResponse.json(cache[cacheKey], {
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
    cache[cacheKey] = payload;
    if (id && q) {
      cache[q.trim().toLowerCase()] = payload;
    }
    saveCache(cache);

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
