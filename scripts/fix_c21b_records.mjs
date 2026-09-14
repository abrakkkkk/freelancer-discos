import { supabase } from '../src/lib/supabase.js';

async function fixRecords() {
  console.log('Iniciando correção dos registros da Caixa 21B no Supabase...\n');

  // 1. Atualiza registros com artistas pontuais alucinados/específicos
  const specificFixes = [
    { id: 25621, artista: 'Various', titulo: 'Riacho Doce', ano: '1990' },
    { id: 25556, artista: 'Various', titulo: 'Pantanal', ano: '1990' },
    { id: 25591, artista: 'Various', titulo: 'Anos Rebeldes', ano: '1992' },
    { id: 25586, artista: 'Various', titulo: 'Pantanal 2', ano: '1990' },
    { id: 25596, artista: 'Various', titulo: 'Pantanal 2', ano: '1990' },
    { id: 25631, artista: 'Various', titulo: 'Pantanal 2', ano: '1990' },
    { id: 25670, artista: 'Various', titulo: 'Roque Santeiro - Volume 2', ano: '1985' },
    { id: 25612, artista: 'Various', titulo: 'Salomé', ano: '1991' },
    { id: 25602, artista: 'Various', titulo: 'Os Inocentes (Trilha Sonora Original)', ano: '1974' },
    { id: 25570, artista: 'Various', titulo: 'A História de Ana Raio e Zé Trovão', ano: '1990' }
  ];

  for (const fix of specificFixes) {
    const { error } = await supabase
      .from('discos')
      .update({ artista: fix.artista, titulo: fix.titulo, ano: fix.ano })
      .eq('id', fix.id);
    if (error) {
      console.error(`Erro ao atualizar [${fix.id}]:`, error);
    } else {
      console.log(`✓ [${fix.id}] Corrigido especificamente para: "${fix.artista}" - "${fix.titulo}" (${fix.ano})`);
    }
  }

  // 2. Busca todos os itens da Caixa 21B com "Vários", "Vários Artistas", "Trilha Sonora", etc.
  const { data: c21b, error: fetchErr } = await supabase
    .from('discos')
    .select('id, artista, titulo, ano')
    .ilike('caixa', '%21b%');

  if (fetchErr) {
    console.error('Erro ao buscar Caixa 21B:', fetchErr);
    return;
  }

  let countVariousNormalized = 0;
  for (const item of c21b) {
    const art = (item.artista || '').trim();
    const isVariousLike = /^(v[aá]rios(\s+artistas)?|trilha\s+sonora(\s+original)?)$/i.test(art);

    if (isVariousLike) {
      const { error } = await supabase
        .from('discos')
        .update({ artista: 'Various' })
        .eq('id', item.id);

      if (error) {
        console.error(`Erro ao normalizar [${item.id}]:`, error);
      } else {
        countVariousNormalized++;
        console.log(`✓ [${item.id}] "${item.titulo}" (${art} -> Various)`);
      }
    }
  }

  console.log(`\nConcluído! ${specificFixes.length} itens específicos e ${countVariousNormalized} itens "Vários" padronizados para "Various".`);
}

fixRecords().catch(console.error);
