const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRealGhosts() {
  const tables = ['discos', 'dvds', 'cds', 'vhs'];
  const queries = ['%Eita%', '%Caixa 2%'];
  
  for (const table of tables) {
    for (const q of queries) {
      const { data, error } = await supabase
        .from(table)
        .select('id, titulo, caixa, loja, deletado, ativo')
        .ilike('caixa', q);
        
      if (data && data.length > 0) {
        console.log(`Matched ${q} in ${table}:`, data);
        
        // Let's also just delete them directly
        for (const item of data) {
           console.log(`Setting caixa = null for ID ${item.id} in ${table}`);
           await supabase.from(table).update({ caixa: null }).eq('id', item.id);
        }
      }
    }
  }
  console.log("Done");
}

checkRealGhosts();
