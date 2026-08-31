const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function dumpAllCaixas() {
  const tables = ['discos', 'dvds', 'cds', 'vhs'];
  const allCaixas = new Set();
  const step = 1000;
  
  for (const table of tables) {
    const { count } = await supabase.from(table).select('*', { count: 'exact', head: true });
    
    for (let from = 0; from < count; from += step) {
      const { data } = await supabase
        .from(table)
        .select('caixa')
        .not('caixa', 'is', null)
        .range(from, from + step - 1);
        
      if (data) {
        data.forEach(item => {
           if (item.caixa) allCaixas.add(item.caixa.toString());
        });
      }
    }
  }
  
  fs.writeFileSync('caixas_dump.json', JSON.stringify(Array.from(allCaixas), null, 2));
  console.log("Dumped to caixas_dump.json");
}

dumpAllCaixas();
