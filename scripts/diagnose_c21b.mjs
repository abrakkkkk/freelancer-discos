import { supabase } from '../src/lib/supabase.js';
import fs from 'fs';

async function main() {
  const { data: c21b, error } = await supabase
    .from('discos')
    .select('id, artista, titulo, ano, caixa, loja, deletado, ativo')
    .ilike('caixa', '%21b%')
    .order('id', { ascending: true });

  console.log('Total items in Caixa 21B:', c21b?.length);
  if (error) console.error(error);

  let cache = {};
  try {
    cache = JSON.parse(fs.readFileSync('src/data/covers_cache.json', 'utf-8'));
  } catch (e) {
    console.error('Error reading covers_cache.json:', e);
  }

  let withCover = 0;
  let withoutCover = 0;
  const missing = [];
  const artistCounts = {};

  c21b?.forEach(item => {
    artistCounts[item.artista] = (artistCounts[item.artista] || 0) + 1;

    const qKey = `${item.artista || ''} ${item.titulo || ''} ${item.ano || ''}`.trim().toLowerCase();
    const qKeyNoYear = `${item.artista || ''} ${item.titulo || ''}`.trim().toLowerCase();
    const hasCover = (cache[item.id] && cache[item.id].cover) || (cache[qKey] && cache[qKey].cover) || (cache[qKeyNoYear] && cache[qKeyNoYear].cover);

    if (hasCover) {
      withCover++;
    } else {
      withoutCover++;
      missing.push(item);
    }
  });

  console.log('Artist distribution in Caixa 21B:', artistCounts);
  console.log(`Cover stats in Caixa 21B: withCover=${withCover}, withoutCover=${withoutCover} (Total: ${c21b?.length})`);
  console.log('\nMissing covers:');
  missing.forEach(m => console.log(`- [${m.id}] Artista: "${m.artista}" | Titulo: "${m.titulo}" | Ano: "${m.ano}"`));
}

main().catch(console.error);
