const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });
const { createClient } = require('@supabase/supabase-js');

const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, supabaseKey);

const CACHE_FILE = path.resolve(__dirname, '../src/data/covers_cache.json');

async function preencherCapas() {
  console.log('=== Preenchendo cache de capas para Loja 2 ===');

  let cache = {};
  if (fs.existsSync(CACHE_FILE)) {
    try {
      cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
    } catch (e) {}
  }

  // Buscar primeiros 50 discos da Loja 2 ordenados por artista
  const { data: discos, error } = await supabase
    .from('discos')
    .select('id, artista, titulo, ano, caixa')
    .eq('loja', 'Loja 2')
    .eq('deletado', false)
    .order('artista', { ascending: true })
    .limit(50);

  if (error || !discos) {
    console.error('Erro ao buscar discos:', error);
    return;
  }

  console.log(`Buscando capas para ${discos.length} discos...`);

  const key = process.env.DISCOGS_KEY;
  const secret = process.env.DISCOGS_SECRET;

  let encontrados = 0;

  for (let i = 0; i < discos.length; i++) {
    const d = discos[i];
    const idKey = String(d.id);
    const qKey = `${d.artista || ''} ${d.titulo || ''}`.trim().toLowerCase();

    if (cache[idKey] || cache[qKey]) {
      encontrados++;
      continue;
    }

    const query = `${d.artista || ''} ${d.titulo || ''}`.trim();
    if (!query) continue;

    try {
      const url = `https://api.discogs.com/database/search?type=release&per_page=1&q=${encodeURIComponent(query)}`;
      const res = await fetch(url, {
        headers: {
          'Authorization': `Discogs key=${key}, secret=${secret}`,
          'User-Agent': 'FreelancerDiscos/1.0',
        },
      });

      if (res.ok) {
        const json = await res.json();
        const result = json.results && json.results[0];
        if (result) {
          const thumb = result.thumb || result.cover_image || null;
          const cover = result.cover_image || result.thumb || null;
          cache[idKey] = { cover, thumb };
          cache[qKey] = { cover, thumb };
          encontrados++;
          console.log(`[${i + 1}/${discos.length}] ✓ "${d.artista} - ${d.titulo}"`);
        } else {
          console.log(`[${i + 1}/${discos.length}] - "${d.artista} - ${d.titulo}" (não encontrado)`);
          cache[idKey] = { cover: null, thumb: null };
        }
      }

      // Pequena pausa para respeitar rate-limit do Discogs (~1 por segundo)
      await new Promise(r => setTimeout(r, 1100));
    } catch (err) {
      console.error(`Erro ao buscar "${query}":`, err.message);
    }

    // Salvar periodicamente
    if (i % 10 === 0) {
      fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf-8');
    }
  }

  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf-8');
  console.log(`\nConcluído! ${encontrados} capas salvas no cache.`);
}

preencherCapas();
