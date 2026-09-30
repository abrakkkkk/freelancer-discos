const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/);
const keyMatch = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/);
const discogsKeyMatch = env.match(/DISCOGS_KEY=(.+)/);
const discogsSecretMatch = env.match(/DISCOGS_SECRET=(.+)/);

if (!urlMatch || !keyMatch || !discogsKeyMatch || !discogsSecretMatch) {
  console.error('Faltam chaves de ambiente no .env.local');
  process.exit(1);
}

const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());
const DISCOGS_KEY = discogsKeyMatch[1].trim();
const DISCOGS_SECRET = discogsSecretMatch[1].trim();

async function delay(ms) {
  return new Promise(res => setTimeout(res, ms));
}

async function buscarCapaDiscogs(artista, titulo, ano) {
  const normQ = `${artista || ''} ${titulo || ''}`.trim();
  const headers = {
    'Authorization': `Discogs key=${DISCOGS_KEY}, secret=${DISCOGS_SECRET}`,
    'User-Agent': 'FreelancerDiscos/1.0',
  };

  let url = `https://api.discogs.com/database/search?type=release&per_page=3&q=${encodeURIComponent(normQ)}`;
  if (ano) url += `&year=${encodeURIComponent(ano)}`;

  try {
    const res = await fetch(url, { headers });
    if (res.ok) {
      const data = await res.json();
      if (data.results && data.results.length > 0) {
        const item = data.results.find(r => r.cover_image || r.thumb) || data.results[0];
        if (item?.thumb || item?.cover_image) {
          return item.thumb || item.cover_image;
        }
      }
    }
  } catch (_) {}

  // Fallback sem ano
  if (ano) {
    try {
      const fallbackUrl = `https://api.discogs.com/database/search?type=release&per_page=3&q=${encodeURIComponent(normQ)}`;
      const fallbackRes = await fetch(fallbackUrl, { headers });
      if (fallbackRes.ok) {
        const fallbackData = await fallbackRes.json();
        if (fallbackData.results && fallbackData.results.length > 0) {
          const item = fallbackData.results.find(r => r.cover_image || r.thumb) || fallbackData.results[0];
          if (item?.thumb || item?.cover_image) {
            return item.thumb || item.cover_image;
          }
        }
      }
    } catch (_) {}
  }

  return null;
}

async function preencherCapasCds() {
  const { data: cds, error } = await supabase
    .from('cds')
    .select('id, artista, titulo, ano, capa_url')
    .is('capa_url', null)
    .eq('deletado', false);

  if (error) {
    console.error('Erro ao buscar CDs:', error);
    return;
  }

  console.log(`Encontrados ${cds.length} CDs sem capa no banco.`);

  let atualizados = 0;
  for (const cd of cds) {
    console.log(`Buscando [${cd.id}] ${cd.artista} - ${cd.titulo} (${cd.ano || 'sem ano'})...`);
    const capa = await buscarCapaDiscogs(cd.artista, cd.titulo, cd.ano);
    if (capa) {
      const { error: updateError } = await supabase
        .from('cds')
        .update({ capa_url: capa })
        .eq('id', cd.id);

      if (!updateError) {
        console.log(`  -> Capa salva com sucesso!`);
        atualizados++;
      } else {
        console.error(`  -> Erro ao atualizar CD ${cd.id}:`, updateError.message);
      }
    } else {
      console.log(`  -> Nenhuma capa encontrada no Discogs.`);
    }

    // Rate limit respeitoso com Discogs API (1 req/seg)
    await delay(1100);
  }

  console.log(`Processo finalizado. ${atualizados} de ${cds.length} CDs atualizados com capas.`);
}

preencherCapasCds();
