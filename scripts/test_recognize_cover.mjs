import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// Cria um teste simulando a chamada direta à lógica da rota
import { POST } from '../src/app/api/recognize-cover/route.js';

async function runTests() {
  console.log('--- Teste 1: Validação de corpo vazio ---');
  const req1 = new Request('http://localhost:3000/api/recognize-cover', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });
  const res1 = await POST(req1);
  const data1 = await res1.json();
  console.assert(res1.status === 400 && data1.success === false, 'Deveria retornar 400');
  console.log('Teste 1 passou:', data1);

  console.log('\n--- Teste 2: Imagem real via URL de capa do Discogs ---');
  try {
    const testUrl = 'https://i.discogs.com/Lb0zKjfgFJLBOqzodiMNM7yi5h1VVP4TqjVyWmDo83s/rs:fit/g:sm/q:90/h:602/w:600/czM6Ly9kaXNjb2dz/LWRhdGFiYXNlLWlt/YWdlcy9SLTU3MzI1/Mi0xMzg0Mzg2MzA1/LTgwMDcuanBlZw.jpeg';
    const imgFetch = await fetch(testUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    if (imgFetch.ok) {
      const buffer = await imgFetch.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');
      const dataUri = `data:image/jpeg;base64,${base64}`;

      const req2 = new Request('http://localhost:3000/api/recognize-cover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: dataUri })
      });

      const start = Date.now();
      const res2 = await POST(req2);
      const data2 = await res2.json();
      console.log(`Resposta (${Date.now() - start}ms):`, data2);
      console.assert(data2.success === true, 'Deveria reconhecer a capa');
      console.log('Teste 2 passou com sucesso!');
    } else {
      console.log('Não foi possível baixar a imagem de teste externa, status:', imgFetch.status);
    }
  } catch (err) {
    console.log('Aviso no teste 2:', err.message);
  }
}

runTests().catch(console.error);
