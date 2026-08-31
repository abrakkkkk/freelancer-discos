const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function findFuzzyGhosts() {
  const tables = ['discos', 'dvds', 'cds', 'vhs'];
  const queries = ['%Eita%', '%Caixa 2%'];
  
  for (const table of tables) {
    for (const q of queries) {
      const { data, error } = await supabase
        .from(table)
        .select('id, titulo, caixa, loja, deletado, ativo')
        .ilike('caixa', q);
        
      if (error) {
        console.error(`Error querying ${table}:`, error);
      } else if (data && data.length > 0) {
        console.log(`Found ${data.length} items in ${table} matching ${q}:`);
        console.log(data);
      }
    }
  }
}

findFuzzyGhosts();
