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
  const { data: d1 } = await supabase.from('discos').select('id').limit(1);
  const { data: d2 } = await supabase.from('dvds').select('id').limit(1);
  const { data: d3 } = await supabase.from('cds').select('id').limit(1);
  console.log("Disco ID type:", typeof d1[0]?.id, d1[0]?.id);
  console.log("DVD ID type:", typeof d2[0]?.id, d2[0]?.id);
  console.log("CD ID type:", typeof d3[0]?.id, d3[0]?.id);
}
main();
