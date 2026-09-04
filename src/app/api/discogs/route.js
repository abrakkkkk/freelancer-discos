import { NextResponse } from 'next/server';

function normalizeCatno(str) {
  if (!str) return '';
  return str.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');
  const barcode = searchParams.get('barcode');
  const catnoParam = searchParams.get('catno');

  if (!query && !barcode && !catnoParam) {
    return NextResponse.json({ error: 'Query parameter "q", "catno" or "barcode" is required' }, { status: 400 });
  }

  const key = process.env.DISCOGS_KEY;
  const secret = process.env.DISCOGS_SECRET;

  if (!key || !secret) {
    return NextResponse.json({ error: 'Discogs credentials not configured' }, { status: 500 });
  }

  const headers = {
    'Authorization': `Discogs key=${key}, secret=${secret}`,
    'User-Agent': 'FreelancerDiscos/1.0'
  };

  try {
    // 1. Busca específica por Código de Barras
    if (barcode) {
      const cleanBarcode = barcode.replace(/[^0-9A-Za-z]/g, '');
      const url = `https://api.discogs.com/database/search?type=release&per_page=15&barcode=${encodeURIComponent(cleanBarcode)}`;
      const response = await fetch(url, { headers });
      if (!response.ok) {
        return NextResponse.json({ error: 'Failed to fetch from Discogs' }, { status: response.status });
      }
      const data = await response.json();
      return NextResponse.json(data);
    }

    // 2. Busca por Catálogo ou Termo de Busca (q)
    const rawSearch = catnoParam || query;
    const cleanQ = rawSearch.trim();
    const normQuery = normalizeCatno(cleanQ);
    const temDigitos = /\d/.test(cleanQ);

    const requests = [
      fetch(`https://api.discogs.com/database/search?type=release&per_page=15&q=${encodeURIComponent(cleanQ)}`, { headers })
        .then(r => r.ok ? r.json() : { results: [] })
        .catch(() => ({ results: [] }))
    ];

    if (temDigitos || catnoParam) {
      // Busca específica por campo de catálogo no Discogs
      requests.push(
        fetch(`https://api.discogs.com/database/search?type=release&per_page=15&catno=${encodeURIComponent(cleanQ)}`, { headers })
          .then(r => r.ok ? r.json() : { results: [] })
          .catch(() => ({ results: [] }))
      );

      // Se tiver espaços ou pontuação (ex: 6328 286 ou 403.6001), busca também a versão junta (6328286)
      const catnoJunto = cleanQ.replace(/[\s\-\.]+/g, '');
      if (catnoJunto !== cleanQ && catnoJunto.length >= 4) {
        requests.push(
          fetch(`https://api.discogs.com/database/search?type=release&per_page=10&catno=${encodeURIComponent(catnoJunto)}`, { headers })
            .then(r => r.ok ? r.json() : { results: [] })
            .catch(() => ({ results: [] }))
        );
      }
    }

    const responses = await Promise.all(requests);
    const generalResults = responses[0]?.results || [];
    const catnoResults = responses[1]?.results || [];
    const catnoJuntoResults = responses[2]?.results || [];

    const map = new Map();

    function calcularScore(item, originatesFromCatno) {
      let score = 0;
      const itemCatno = normalizeCatno(item.catno);

      // Match exato do código de catálogo (ex: "6328 286" == "6328286")
      const isExact = !!(itemCatno && normQuery && itemCatno === normQuery);
      if (isExact) {
        score += 2000;
      } else if (itemCatno && normQuery && (itemCatno.includes(normQuery) || normQuery.includes(itemCatno))) {
        score += 500;
      }

      if (originatesFromCatno) {
        score += 150;
      }

      // Prioridade para edições brasileiras
      if (item.country === 'Brazil') {
        score += 60;
      }

      // Prioridade para vinil
      if (Array.isArray(item.format) && item.format.some(f => f.toLowerCase().includes('vinyl') || f.toLowerCase().includes('lp'))) {
        score += 30;
      }

      return { score, isExact };
    }

    catnoResults.forEach(item => {
      const { score, isExact } = calcularScore(item, true);
      map.set(item.id, { ...item, _score: score, isExactMatch: isExact });
    });

    catnoJuntoResults.forEach(item => {
      if (!map.has(item.id)) {
        const { score, isExact } = calcularScore(item, true);
        map.set(item.id, { ...item, _score: score, isExactMatch: isExact });
      }
    });

    generalResults.forEach(item => {
      if (!map.has(item.id)) {
        const { score, isExact } = calcularScore(item, false);
        map.set(item.id, { ...item, _score: score, isExactMatch: isExact });
      }
    });

    const sortedResults = Array.from(map.values()).sort((a, b) => b._score - a._score);
    return NextResponse.json({ results: sortedResults });
  } catch (error) {
    console.error('Discogs Fetch Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
