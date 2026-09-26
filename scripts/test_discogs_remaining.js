const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

const key = process.env.DISCOGS_KEY;
const secret = process.env.DISCOGS_SECRET;

async function searchDiscogs(q) {
  const url = `https://api.discogs.com/database/search?type=release&per_page=5&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, {
    headers: {
      'Authorization': `Discogs key=${key}, secret=${secret}`,
      'User-Agent': 'FreelancerDiscosTest/1.0'
    }
  });
  if (!res.ok) return { error: res.statusText };
  const data = await res.json();
  return data.results ? data.results.slice(0, 3).map(r => ({ title: r.title, country: r.country, year: r.year, catno: r.catno })) : [];
}

async function test() {
  const titles = [
    'Sarah + 2',
    'Fathers and Sons',
    'Uri Geller 1976',
    'The Best Of Chris Barber & Bilk Acker',
    'The Karate Kid Part II',
    'A Musica de Paulo Vanzolini',
    'Zabriskie Point',
    'Trio Tamoyo interpreta Ritmos Variados',
    'Play Bach Volume 1',
    'Tootsie',
    'Coompor canta lupi'
  ];

  for (const t of titles) {
    const res = await searchDiscogs(t);
    console.log(`\n=== "${t}" ===`);
    console.log(res);
    await new Promise(r => setTimeout(r, 1100)); // Discogs rate limit (60 req/min = 1 req/sec)
  }
}

test();
