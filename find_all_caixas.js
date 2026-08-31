const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function findAllCaixas() {
  const tables = ['discos', 'dvds', 'cds', 'vhs'];
  const allCaixas = new Set();
  
  for (const table of tables) {
    const { data, error } = await supabase
      .from(table)
      .select('id, caixa, loja')
      .eq('deletado', false)
      .not('caixa', 'is', null);
      
    if (error) {
      console.error(`Error querying ${table}:`, error);
    } else if (data) {
      data.forEach(item => {
        allCaixas.add(`${item.caixa} | ${item.loja} | id: ${item.id} | table: ${table}`);
      });
    }
  }
  
  console.log("All unique caixas:");
  Array.from(allCaixas).sort().forEach(c => console.log(c));
}

findAllCaixas();
