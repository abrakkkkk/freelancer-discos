import { supabase } from '../src/lib/supabase.js';
import fs from 'fs';

const key = process.env.DISCOGS_KEY;
const secret = process.env.DISCOGS_SECRET;
const headers = {
  'Authorization': `Discogs key=${key}, secret=${secret}`,
  'User-Agent': 'FreelancerDiscos/1.0'
};

async function testCoverSearch(artista, titulo, ano) {
  const cleanAno = ano && String(ano) !== 'null' && String(ano) !== 'undefined' ? String(ano).trim() : '';
  const q = `${artista || ''} ${titulo || ''}`.trim();

  // Test current cover search logic
  let url = `https://api.discogs.com/database/search?type=release&per_page=3&q=${encodeURIComponent(q)}`;
  if (cleanAno) url += `&year=${encodeURIComponent(cleanAno)}`;

  let res = await fetch(url, { headers });
  let data = res.ok ? await res.json() : { results: [] };
  let result = data.results && data.results[0];

  // Fallback without year
  if (!result && cleanAno) {
    const fallbackUrl = `https://api.discogs.com/database/search?type=release&per_page=3&q=${encodeURIComponent(q)}`;
    const fRes = await fetch(fallbackUrl, { headers });
    const fData = fRes.ok ? await fRes.json() : { results: [] };
    result = fData.results && fData.results[0];
  }

  return {
    q,
    cleanAno,
    found: !!result,
    cover: result?.cover_image || result?.thumb || null,
    discogsTitle: result?.title || null
  };
}

async function main() {
  const { data: c21b } = await supabase
    .from('discos')
    .select('id, artista, titulo, ano')
    .ilike('caixa', '%21b%')
    .order('id', { ascending: true });

  console.log(`Testando 15 primeiros itens da Caixa 21B com a lógica atual de /api/cover...`);

  for (const item of c21b.slice(0, 15)) {
    const res = await testCoverSearch(item.artista, item.titulo, item.ano);
    console.log(`[${item.id}] "${item.artista}" - "${item.titulo}" (${item.ano}) => Found: ${res.found} | Discogs: "${res.discogsTitle}" | Cover: ${!!res.cover}`);
    // Sleep 1.1s to respect Discogs rate limit (60 req/min)
    await new Promise(r => setTimeout(r, 1100));
  }
}

main().catch(console.error);
