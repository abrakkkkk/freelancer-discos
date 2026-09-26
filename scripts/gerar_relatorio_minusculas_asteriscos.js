const fs = require('fs');
const path = require('path');

const discos = JSON.parse(fs.readFileSync('./scripts/temp_all_fresh.json', 'utf8'));

const preposicoesMinusculas = new Set([
  'de', 'da', 'do', 'dos', 'das', 'e', 'em', 'para', 'com', 'por', 'no', 'na', 'nos', 'nas',
  'the', 'of', 'in', 'on', 'at', 'to', 'for', 'and', 'or', 'a', 'an', '&'
]);

const artistasOficialmenteMinusculos = new Set([
  'a-ha', 'k.d. lang', 'bell hooks'
]);

function toTitleCase(str, isArtist = false) {
  if (!str) return str;
  const trimmed = str.trim();
  if (isArtist && artistasOficialmenteMinusculos.has(trimmed.toLowerCase())) {
    return trimmed.toLowerCase();
  }
  
  // Tratar pontuação e palavras
  const words = trimmed.split(/(\s+|[-–—/])/);
  let wordCount = 0;
  
  const formatted = words.map((w) => {
    if (!w || /^\s+$/.test(w) || /^[-–—/]$/.test(w)) return w;
    wordCount++;
    const lower = w.toLowerCase();
    
    // Primeira palavra sempre maiúscula
    if (wordCount === 1) {
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    }
    
    // Preposições no meio são minúsculas
    if (preposicoesMinusculas.has(lower)) {
      return lower;
    }
    
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  });
  
  return formatted.join('');
}

const relatorio = [];

// 1. DISCOS COM ASTERISCO (*) - Limpeza e Padronização
const mapaAsteriscos = {
  13764: { artista: 'Frank Sinatra & Duke Ellington', titulo: 'Francis A. & Edward K.' },
  24793: { artista: 'Ruggero Leoncavallo', titulo: 'Pagliacci' },
  25114: { artista: 'Patrícia & Luciano, Xuxa, Carequinha', titulo: 'Clube da Criança' },
  25252: { artista: 'Stéphane Grappelli & Jean-Luc Ponty', titulo: 'Giants' },
  25288: { artista: 'Oscar Peterson & Stéphane Grappelli', titulo: 'Volume II' },
  25295: { artista: 'The Love Unlimited Orchestra', titulo: 'Rhapsody in White' },
  25421: { artista: 'Patrícia & Luciano, Xuxa, Carequinha', titulo: 'Clube da Criança' },
  26029: { artista: 'José Carreras, Plácido Domingo, Luciano Pavarotti & Zubin Mehta', titulo: 'In Concert' },
  26046: { artista: 'Frank Sinatra & Duke Ellington', titulo: 'Francis A. & Edward K.' },
  26055: { artista: 'Os Trovadores do Rei Baudoin & Père Guido Haazen', titulo: 'Missa Luba' },
  26194: { artista: 'Caetano Veloso, Gilberto Gil & Gal Costa', titulo: 'Caetano Gil Gal' },
  26263: { artista: 'Heitor Villa-Lobos, Manoel Braune & Orquestra Nacional da Radiodifusão Francesa', titulo: 'Bachianas Brasileiras Nº 3 e 4' },
  26317: { artista: 'Giacomo Puccini', titulo: 'Turandot (Zubin Mehta)' },
  26397: { artista: 'Maurice Ravel, Orchestre de Paris & Daniel Barenboim', titulo: 'Bolero / La Valse / Pavane' },
  26404: { artista: 'Severino Araújo e Sua Orquestra Tabajara', titulo: '12 Ritmos Brasileiros' },
  26405: { artista: 'Severino Araújo e Sua Orquestra Tabajara', titulo: '12 Ritmos Brasileiros' },
  26410: { artista: 'Sérgio & Eduardo Abreu, English Chamber Orchestra', titulo: 'Castelnuovo-Tedesco / Santórsola: 2 Concertos para 2 Violões' },
  26428: { artista: 'Charles Munch & Boston Symphony Orchestra', titulo: 'Ravel\'s Biggest Hits' },
  26433: { artista: 'Wolfgang Amadeus Mozart & Murray Perahia', titulo: 'Piano Concertos Nos. 19 & 23' },
  26435: { artista: 'Wolfgang Amadeus Mozart, Malcolm Bilson & John Eliot Gardiner', titulo: 'Piano Concertos Nos. 13 & 15' },
  26438: { artista: 'Wolfgang Amadeus Mozart, Malcolm Bilson & John Eliot Gardiner', titulo: 'Piano Concertos Nos. 9 & 11' },
  26442: { artista: 'Sergei Rachmaninoff, Lazar Berman, Claudio Abbado & London Symphony Orchestra', titulo: 'Piano Concerto Nº 3' },
  26444: { artista: 'The Choir of the Carmelite Priory & John McCarthy', titulo: 'Gregorian Chant' },
  26445: { artista: 'Johann Strauss & Orquestra Sinfônica Vienense', titulo: 'As Mais Belas Valsas de Johann Strauss' },
  26451: { artista: 'Arthur Moreira Lima', titulo: 'Recital de Piano (Liszt, Chopin, Prokofiev, Villa-Lobos)' },
  26464: { artista: 'Johannes Brahms, Orquestra Sinfônica de Utah & Maurice Abravanel', titulo: 'Sinfonia Nº 2 Op. 73' },
  26469: { artista: 'Yukie Nishikawa', titulo: 'Beethoven / Debussy (III Prêmio Eldorado de Música)' },
  26477: { artista: 'Wolfgang Amadeus Mozart, Alfred Brendel & Neville Marriner', titulo: 'Piano Concertos K. 450 & K. 467' },
  26586: { artista: 'Moreira da Silva, Bezerra da Silva & Dicró', titulo: 'Os 3 Malandros In Concert' },
  26604: { artista: 'Pedrinho Rodrigues, Maestro Carioca & Lêda Soares', titulo: 'Som Brasileiro (Samba de Gafieira)' },
  26685: { artista: 'Carlos Pitta & Banda Forró Mistura Brasil', titulo: 'Dançando Forró' },
  26861: { artista: 'Abaeté e Banda Água Cristalina', titulo: 'Nasce Uma Flor' },
  27075: { artista: 'Caetano Veloso, Gal Costa, Gilberto Gil & Maria Bethânia', titulo: 'Doces Bárbaros' },
  27104: { artista: 'Caetano Veloso & Gilberto Gil', titulo: 'Tropicália 2' },
  27193: { artista: 'Ronnie Aldrich e Seus Dois Pianos', titulo: 'Two Pianos - Today!' },
  27324: { artista: 'Alfred Cortot', titulo: 'Liszt / Chopin: Sonata in B Minor' }
};

discos.forEach(d => {
  if (mapaAsteriscos[d.id]) {
    const item = mapaAsteriscos[d.id];
    relatorio.push({
      id: d.id,
      loja: d.loja,
      caixa: d.caixa,
      categoria: d.categoria,
      artistaAtual: d.artista,
      tituloAtual: d.titulo,
      problema: 'Artefatos de asterisco (*) e poluição de importação Discogs',
      artistaRecomendado: item.artista,
      tituloRecomendado: item.titulo,
      tipo: 'limpeza_asterisco'
    });
  }
});

// 2. DISCOS COM ARTISTA OU TÍTULO INVERTIDOS OU COM CASOS ESPECIAIS
const inversoes = {
  6860: { artista: 'Rick Wakeman', titulo: 'White Rock' },
  6941: { artista: 'The Style Council', titulo: 'Confessions of a Pop Group' },
  7431: { artista: 'INXS', titulo: 'Full Moon, Dirty Hearts' }
};

discos.forEach(d => {
  if (inversoes[d.id]) {
    relatorio.push({
      id: d.id,
      loja: d.loja,
      caixa: d.caixa,
      categoria: d.categoria,
      artistaAtual: d.artista,
      tituloAtual: d.titulo,
      problema: 'Campos invertidos / Artista e Álbum trocados',
      artistaRecomendado: inversoes[d.id].artista,
      tituloRecomendado: inversoes[d.id].titulo,
      tipo: 'inversao'
    });
  }
});

// 3. DISCOS COM ARTISTA EM MINÚSCULO INDEVIDO (ignorando "a-ha")
discos.forEach(d => {
  if (!d.artista || !d.artista.trim()) return;
  if (relatorio.find(r => r.id === d.id)) return; // já mapeado
  const art = d.artista.trim();
  if (artistasOficialmenteMinusculos.has(art.toLowerCase())) return; // ignorar a-ha
  
  // Casos onde o artista começa com minúscula ou tem palavras impróprias em minúsculo
  const artTitle = toTitleCase(art, true);
  if (artTitle !== art) {
    // Verificar se a diferença é de capitalização
    if (artTitle.toLowerCase() === art.toLowerCase()) {
      relatorio.push({
        id: d.id,
        loja: d.loja,
        caixa: d.caixa,
        categoria: d.categoria,
        artistaAtual: art,
        tituloAtual: d.titulo,
        problema: 'Artista grafado em minúsculo indevido',
        artistaRecomendado: artTitle,
        tituloRecomendado: toTitleCase(d.titulo || ''),
        tipo: 'artista_minusculo'
      });
    }
  }
});

// 4. DISCOS COM TÍTULO EM MINÚSCULO INDEVIDO (títulos consagrados em minúsculo)
discos.forEach(d => {
  if (!d.titulo || !d.titulo.trim()) return;
  if (relatorio.find(r => r.id === d.id)) return; // já mapeado
  const tit = d.titulo.trim();
  
  // Se a primeira letra for minúscula
  if (tit[0] === tit[0].toLowerCase() && /[a-zà-ÿ]/.test(tit[0])) {
    const titTitle = toTitleCase(tit, false);
    relatorio.push({
      id: d.id,
      loja: d.loja,
      caixa: d.caixa,
      categoria: d.categoria,
      artistaAtual: d.artista || '(Vazio)',
      tituloAtual: tit,
      problema: 'Título iniciando com letra minúscula',
      artistaRecomendado: d.artista ? toTitleCase(d.artista, true) : '(Vazio)',
      tituloRecomendado: titTitle,
      tipo: 'titulo_minusculo'
    });
  }
});

console.log(`Total de registros no novo relatório (Asteriscos + Minúsculas): ${relatorio.length}`);
fs.writeFileSync('./scripts/relatorio_rodada_3.json', JSON.stringify(relatorio, null, 2), 'utf8');

const resumo = {};
relatorio.forEach(r => resumo[r.problema] = (resumo[r.problema] || 0) + 1);
console.log('\nResumo dos problemas identificados:');
console.log(resumo);
