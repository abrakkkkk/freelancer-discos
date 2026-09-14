import { supabase } from '../src/lib/supabase.js';

async function inspectC21B() {
  const { data: items } = await supabase
    .from('discos')
    .select('id, artista, titulo, ano, caixa, loja')
    .ilike('caixa', '%21b%')
    .order('id', { ascending: true });

  console.log(`Total items in Caixa 21B: ${items.length}\n`);

  const needsFix = [];

  for (const item of items) {
    const art = (item.artista || '').trim();
    const tit = (item.titulo || '').trim();

    const isVariousLike = /^(v[aá]rios|v[aá]rios\s+artistas|trilha\s+sonora|trilha\s+sonora\s+original)$/i.test(art);
    const isHallucinatedArtist = [
      'Elizeth Cardoso',
      'Cristiana Oliveira',
      'Marília Pêra',
      'Pantanal',
      'Salome',
      'Ronnie Von / Agnaldo Rayol / Ângela Maria'
    ].includes(art);

    if (isVariousLike || isHallucinatedArtist || art !== 'Various') {
      needsFix.push({
        id: item.id,
        currentArtista: art,
        currentTitulo: tit,
        currentAno: item.ano,
        reason: isVariousLike ? 'Nome em português/variação' : isHallucinatedArtist ? 'Artista alucinado/ator' : 'Outro artista'
      });
    }
  }

  console.log(`Itens que não são 'Various' em Caixa 21B (${needsFix.length}):`);
  needsFix.forEach(n => {
    console.log(`[${n.id}] [${n.reason}] "${n.currentArtista}" - "${n.currentTitulo}" (${n.currentAno})`);
  });
}

inspectC21B().catch(console.error);
