const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });
const { createClient } = require('@supabase/supabase-js');

const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, supabaseKey);

const CACHE_FILE = path.resolve(__dirname, '../src/data/covers_cache.json');

async function preencherCapasLoja1() {
  console.log('=== Preenchendo cache de capas para Loja 1 ===');

  let cache = {};
  if (fs.existsSync(CACHE_FILE)) {
    try {
      cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
    } catch (e) {}
  }

  // Buscar os primeiros 50 discos da Loja 1 na ordem padrão do catálogo
  const { data: discos, error } = await supabase
    .from('discos')
    .select('id, artista, titulo, ano, caixa')
    .eq('loja', 'Loja 1')
    .eq('deletado', false)
    .order('caixa', { ascending: true })
    .order('artista', { ascending: true })
    .order('titulo', { ascending: true })
    .limit(50);

  if (error || !discos) {
    console.error('Erro ao buscar discos da Loja 1:', error);
    return;
  }

  console.log(`Buscando capas para ${discos.length} discos da Loja 1...`);

  const key = process.env.DISCOGS_KEY;
  const secret = process.env.DISCOGS_SECRET;

  if (!key || !secret) {
    console.error('DISCOGS_KEY ou DISCOGS_SECRET não configurados no .env.local');
    return;
  }

  let encontrados = 0;

  for (let i = 0; i < discos.length; i++) {
    const d = discos[i];
    const idKey = String(d.id);
    const qKey = `${d.artista || ''} ${d.titulo || ''}`.trim().toLowerCase();

    if (cache[idKey] || cache[qKey]) {
      encontrados++;
      console.log(`[${i + 1}/${discos.length}] ✓ Em cache: "${d.artista} - ${d.titulo}"`);
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
          console.log(`[${i + 1}/${discos.length}] ✓ Encontrado: "${d.artista} - ${d.titulo}"`);
        } else {
          console.log(`[${i + 1}/${discos.length}] - Não encontrado: "${d.artista} - ${d.titulo}"`);
          cache[idKey] = { cover: null, thumb: null };
          cache[qKey] = { cover: null, thumb: null };
        }
      } else {
        console.warn(`[${i + 1}/${discos.length}] Resposta da API: ${res.status}`);
      }

      // Intervalo para respeitar o rate-limit do Discogs (~1 req/segundo)
      await new Promise(r => setTimeout(r, 1100));
    } catch (err) {
      console.error(`Erro ao buscar "${query}":`, err.message);
    }

    // Salva periodicamente a cada 5 buscas
    if (i % 5 === 0) {
      fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf-8');
    }
  }

  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf-8');
  console.log(`\nConcluído! ${encontrados} capas salvas no cache de capas.`);
}

preencherCapasLoja1();
