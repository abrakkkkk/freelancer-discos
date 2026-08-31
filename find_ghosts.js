const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function findGhosts() {
  const tables = ['discos', 'dvds', 'cds', 'vhs'];
  const ghostCaixas = ['Eita 2', 'Caixa 2'];
  
  for (const table of tables) {
    for (const caixa of ghostCaixas) {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .eq('caixa', caixa)
        .eq('deletado', false);
        
      if (error) {
        console.error(`Error querying ${table} for ${caixa}:`, error);
      } else if (data && data.length > 0) {
        console.log(`Found ${data.length} items in ${table} with caixa '${caixa}':`);
        data.forEach(item => {
          console.log(` - ID: ${item.id}, Título: ${item.titulo}, Loja: ${item.loja}, Ativo: ${item.ativo}`);
        });
      } else {
        console.log(`No items found in ${table} with caixa '${caixa}'`);
      }
    }
  }
}

findGhosts();
