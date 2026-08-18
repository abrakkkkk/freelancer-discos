import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  console.log("Checking columns of table 'discos'...");
  const { data, error } = await supabase.from('discos').select('*').limit(1);
  if (error) {
    console.log("Error:", error.message);
  } else {
    console.log("Data row columns:", Object.keys(data[0] || {}));
  }
}

run();
