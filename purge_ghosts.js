const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function purgeGhosts() {
  const tables = ['discos', 'dvds', 'cds', 'vhs'];
  
  for (const table of tables) {
    const { data, error } = await supabase
      .from(table)
      .select('id, caixa');
      
    if (error) {
      console.error(error);
      continue;
    }
    
    for (const item of data) {
      if (item.caixa && (item.caixa.includes('Eita') || item.caixa.includes('Caixa 2'))) {
        console.log(`Purging ${item.caixa} in ${table} ID: ${item.id}`);
        await supabase.from(table).update({ caixa: null }).eq('id', item.id);
      }
    }
  }
  console.log("Done");
}

purgeGhosts();
