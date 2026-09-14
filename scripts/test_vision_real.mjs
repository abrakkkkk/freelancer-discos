import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { POST } from '../src/app/api/recognize-cover/route.js';

const key = process.env.DISCOGS_KEY;
const secret = process.env.DISCOGS_SECRET;
const headers = {
  'Authorization': `Discogs key=${key}, secret=${secret}`,
  'User-Agent': 'FreelancerDiscos/1.0'
};

async function testAlbumRecognition(searchQuery) {
  console.log(`\n=== Testando reconhecimento de: "${searchQuery}" ===`);
  const discogsRes = await fetch(`https://api.discogs.com/database/search?type=release&per_page=1&q=${encodeURIComponent(searchQuery)}`, { headers });
  const discogsData = await discogsRes.json();
  const item = discogsData.results?.[0];

  if (!item || !item.cover_image) {
    console.log('Não encontrou imagem no Discogs para', searchQuery);
    return;
  }

  console.log(`Imagem encontrada no Discogs: ${item.title} (${item.year}) -> ${item.cover_image}`);
  const imgRes = await fetch(item.cover_image, { headers: { 'User-Agent': 'FreelancerDiscos/1.0' } });
  if (!imgRes.ok) {
    console.log('Falha ao baixar imagem, status:', imgRes.status);
    return;
  }

  const buf = await imgRes.arrayBuffer();
  const base64 = Buffer.from(buf).toString('base64');
  const dataUri = `data:image/jpeg;base64,${base64}`;

  const req = new Request('http://localhost:3000/api/recognize-cover', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: dataUri })
  });

  const start = Date.now();
  const apiRes = await POST(req);
  const data = await apiRes.json();
  console.log(`Resultado Gemini (${Date.now() - start}ms):`, data);
}

async function main() {
  await testAlbumRecognition('Various Riacho Doce');
  await testAlbumRecognition('Various Roque Santeiro Volume 2');
  await testAlbumRecognition('Various Pantanal');
}

main().catch(console.error);
