import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('Buscando discos cadastrados a partir de 10:01 (13:01 UTC) na Caixa 11B...');
  
  // Buscar itens alvo
  const { data: targetDiscos, error: fetchErr } = await supabase
    .from('discos')
    .select('id, artista, titulo, caixa, loja, criado_em')
    .gte('criado_em', '2026-09-16T13:01:00')
    .ilike('caixa', '%11b%')
    .order('criado_em', { ascending: true });

  if (fetchErr) {
    console.error('Erro ao buscar discos:', fetchErr);
    process.exit(1);
  }

  console.log(`Encontrados ${targetDiscos.length} discos para transferir.`);
  targetDiscos.forEach(d => console.log(`- [${d.id}] ${d.artista} - ${d.titulo} (${d.caixa} -> Caixa 12B)`));

  if (targetDiscos.length === 0) {
    console.log('Nenhum disco encontrado para atualizar.');
    return;
  }

  const ids = targetDiscos.map(d => d.id);

  // Atualizar para Caixa 12B da Loja 2
  const { data: updateRes, error: updateErr } = await supabase
    .from('discos')
    .update({ caixa: 'Caixa 12B', loja: 'Loja 2' })
    .in('id', ids)
    .select('id, artista, titulo, caixa, loja');

  if (updateErr) {
    console.error('Erro ao atualizar discos:', updateErr);
    process.exit(1);
  }

  console.log(`\nAtualização concluída com sucesso para ${updateRes.length} discos.`);

  // Verificação independente pós-update
  const { data: verify12b, error: verifyErr } = await supabase
    .from('discos')
    .select('id, artista, titulo, caixa, loja')
    .in('id', ids);

  if (verifyErr) {
    console.error('Erro na verificação:', verifyErr);
    process.exit(1);
  }

  console.log('\n--- EVIDÊNCIA DE VERIFICAÇÃO NO BANCO ---');
  console.log(`Total verificado na Caixa 12B: ${verify12b.filter(d => d.caixa === 'Caixa 12B' && d.loja === 'Loja 2').length} / ${ids.length}`);
  verify12b.forEach(d => {
    console.log(`ID ${d.id}: "${d.artista} - ${d.titulo}" => ${d.caixa} (${d.loja})`);
  });
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
