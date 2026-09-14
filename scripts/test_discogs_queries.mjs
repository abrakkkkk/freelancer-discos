const key = process.env.DISCOGS_KEY;
const secret = process.env.DISCOGS_SECRET;
const headers = {
  'Authorization': `Discogs key=${key}, secret=${secret}`,
  'User-Agent': 'FreelancerDiscos/1.0'
};

async function test(query, year) {
  let url = `https://api.discogs.com/database/search?type=release&per_page=5&q=${encodeURIComponent(query)}`;
  if (year) url += `&year=${year}`;
  const res = await fetch(url, { headers });
  const data = await res.json();
  console.log(`\nQuery: "${query}" (ano: ${year || 'none'}) -> Status: ${res.status}, Count: ${data.results?.length}`);
  data.results?.forEach((r, i) => {
    console.log(`  [${i}] Title: "${r.title}" | Year: "${r.year}" | Country: "${r.country}" | Format: ${JSON.stringify(r.format)} | Cover: ${!!r.cover_image}`);
  });
}

async function run() {
  await test('Various Ciranda de Pedra (Trilha Sonora Original da Novela)');
  await test('Various Ciranda de Pedra');
  await test('Various Espelho Mágico: Trilha Sonora Original da Novela');
  await test('Various Espelho Mágico');
  await test('Various Roque Santeiro Volume 2');
  await test('Various Selva de Pedra');
  await test('Various Selva de Pedra - Nacional');
  await test('Ciranda de Pedra');
}

run().catch(console.error);
