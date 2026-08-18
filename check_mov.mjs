import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envFile = fs.readFileSync('.env.local', 'utf-8');
const env = {};
envFile.split('\n').forEach(line => {
  const [key, ...val] = line.split('=');
  if (key && val.length) env[key.trim()] = val.join('=').trim().replace(/"/g, '');
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function main() {
  const { data, error } = await supabase.from('movimentacoes').select(`
          id,
          tipo,
          observacao,
          criado_em,
          discos ( caixa, artista, titulo ),
          dvds ( titulo ),
          cds ( artista, titulo )
        `).order('criado_em', { ascending: false }).limit(5);
  console.log("Error:", error);
  console.log("Data:", JSON.stringify(data, null, 2));
}
main();
