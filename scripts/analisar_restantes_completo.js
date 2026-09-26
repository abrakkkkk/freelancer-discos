const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

const key = process.env.DISCOGS_KEY;
const secret = process.env.DISCOGS_SECRET;

const restantes = JSON.parse(fs.readFileSync('./scripts/restantes_genericos_capa_fisica.json', 'utf8'));

async function searchDiscogs(q) {
  try {
    const url = `https://api.discogs.com/database/search?type=release&per_page=5&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, {
      headers: {
        'Authorization': `Discogs key=${key}, secret=${secret}`,
        'User-Agent': 'FreelancerDiscosAudit/1.0'
      }
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.results || [];
  } catch (e) {
    return [];
  }
}

async function run() {
  console.log(`Iniciando análise dos ${restantes.length} itens restantes...`);
  
  const cachePath = './scripts/discogs_remaining_cache.json';
  let cache = {};
  if (fs.existsSync(cachePath)) {
    cache = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
  }

  for (let i = 0; i < restantes.length; i++) {
    const r = restantes[i];
    const tit = r.titulo.trim();
    
    if (!cache[tit]) {
      // Limpar termo de busca para aumentar precisão
      const cleanTerm = tit.replace(/\s*\([^)]*\)/g, '').replace(/IMP/g, '').trim();
      const results = await searchDiscogs(cleanTerm);
      cache[tit] = results.map(res => ({
        title: res.title,
        country: res.country,
        year: res.year,
        catno: res.catno,
        format: res.format
      }));
      fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2), 'utf8');
      process.stdout.write(`\rConsultando Discogs: ${i + 1}/${restantes.length}`);
      await new Promise(res => setTimeout(res, 1100)); // 1.1s rate limit
    } else {
      process.stdout.write(`\rUsando cache: ${i + 1}/${restantes.length}`);
    }
  }

  console.log('\nBusca finalizada. Processando classificação...');

  // Classificação
  const altaCerteza = [];
  const coletaneasVarious = [];
  const pendenteFisico = [];

  restantes.forEach(r => {
    const tit = r.titulo.trim();
    const hits = cache[tit] || [];
    
    // Análise manual / heurística combinada com resultados do Discogs
    // Vamos registrar cada um com a melhor correspondência
    r.hits = hits;
  });

  fs.writeFileSync('./scripts/restantes_com_discogs.json', JSON.stringify(restantes, null, 2), 'utf8');
  console.log('Salvo em ./scripts/restantes_com_discogs.json');
}

run().catch(console.error);
