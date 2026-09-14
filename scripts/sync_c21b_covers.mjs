import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { supabase } from '../src/lib/supabase.js';
import fs from 'fs';
import path from 'path';

const CACHE_FILE = path.resolve(process.cwd(), 'src/data/covers_cache.json');

const key = process.env.DISCOGS_KEY;
const secret = process.env.DISCOGS_SECRET;
const headers = {
  'Authorization': `Discogs key=${key}, secret=${secret}`,
  'User-Agent': 'FreelancerDiscos/1.0'
};

function normalizeSearchQuery(str) {
  if (!str) return '';
  return str
    .replace(/\b(v[aá]rios(\s+artistas)?|trilha\s+sonora(\s+original)?)\b/gi, 'Various')
    .trim();
}

async function searchDiscogsCover(rawQ, cleanAno) {
  const normQ = normalizeSearchQuery(rawQ);

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

async function syncCovers() {
  console.log('Iniciando sincronização de capas para a Caixa 21B...\n');

  let cache = {};
  if (fs.existsSync(CACHE_FILE)) {
    try {
      cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
    } catch (_) {}
  }

  const { data: c21b } = await supabase
    .from('discos')
    .select('id, artista, titulo, ano')
    .ilike('caixa', '%21b%')
    .order('id', { ascending: true });

  console.log(`Total de itens na Caixa 21B: ${c21b.length}`);

  let jaPossui = 0;
  let sincronizados = 0;
  let falhas = 0;

  for (let i = 0; i < c21b.length; i++) {
    const item = c21b[i];
    const cleanAno = item.ano && String(item.ano) !== 'null' ? String(item.ano).trim() : '';
    const qKey = `${item.artista || ''} ${item.titulo || ''} ${cleanAno}`.trim().toLowerCase();
    const idKey = String(item.id);

    // Se já tiver no cache pelo ID ou pela query
    if (cache[idKey]?.cover || cache[qKey]?.cover) {
      // Garante que ambos ID e qKey estejam sincronizados
      const existing = cache[idKey] || cache[qKey];
      cache[idKey] = { ...existing, q: qKey };
      cache[qKey] = { ...existing, q: qKey };
      jaPossui++;
      continue;
    }

    const rawQ = `${item.artista || ''} ${item.titulo || ''}`.trim();
    const discogsItem = await searchDiscogsCover(rawQ, cleanAno);

    if (discogsItem && (discogsItem.cover_image || discogsItem.thumb)) {
      const cover = discogsItem.cover_image || discogsItem.thumb;
      const thumb = discogsItem.thumb || discogsItem.cover_image;
      const payload = { cover, thumb, q: qKey, ano: cleanAno };
      cache[idKey] = payload;
      cache[qKey] = payload;
      sincronizados++;
      console.log(`[${i + 1}/${c21b.length}] ✓ Capa obtida para [${item.id}]: "${item.artista}" - "${item.titulo}"`);
    } else {
      falhas++;
      console.log(`[${i + 1}/${c21b.length}] ✗ Não encontrada capa para [${item.id}]: "${item.artista}" - "${item.titulo}"`);
    }

    // Salva incrementalmente a cada 5 capas para segurança
    if (sincronizados % 5 === 0) {
      fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf-8');
    }

    // Intervalo de 1s para respeitar limite da API do Discogs
    await new Promise(r => setTimeout(r, 1050));
  }

  // Grava o arquivo final
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf-8');

  console.log(`\nSincronização da Caixa 21B concluída!`);
  console.log(`- Já possuíam capa: ${jaPossui}`);
  console.log(`- Recém-sincronizados: ${sincronizados}`);
  console.log(`- Sem capa no Discogs: ${falhas}`);
}

syncCovers().catch(console.error);
