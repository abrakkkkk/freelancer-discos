const fs = require('fs');

const restantes = JSON.parse(fs.readFileSync('./scripts/restantes_genericos_capa_fisica.json', 'utf8'));

console.log('Total em restantes:', restantes.length);

// Categorizar os casos
const trilhasSonoras = [];
const festivaisOuCompilacoesFamosas = [];
const classicosOuArtistasEvidentes = [];
const puroGenerico = [];

restantes.forEach(r => {
  const tit = (r.titulo || '').trim();
  const titLower = tit.toLowerCase();
  const cat = (r.categoria || '').toLowerCase();
  
  // 1. Trilhas Sonoras de Novela / Cinema
  if (titLower.includes('trilha') || titLower.includes('novela') || titLower.includes('soundtrack') || titLower.includes('internacional') || titLower.includes('nacional') && (titLower.includes('bambolê') || titLower.includes('selva') || titLower.includes('top model') || titLower.includes('roque santeiro') || titLower.includes('vale tudo') || titLower.includes('tieta') || titLower.includes('fera radical') || titLower.includes('mandala') || titLower.includes('salvador da pátria') || titLower.includes('brega & chique') || titLower.includes('cambalacho') || titLower.includes('hipertensão') || titLower.includes('livre para voar') || titLower.includes('corpo a corpo') || titLower.includes('guerra dos sexos') || titLower.includes('vereda tropical') || titLower.includes('de quina pra lua') || titLower.includes('sassaricando') || titLower.includes('bebê a bordo') || titLower.includes('que rei sou eu') || titLower.includes('rainha da sucata') || titLower.includes('barriga de aluguel') || titLower.includes('meu bem, meu mal') || titLower.includes('vamp') || titLower.includes('pedra sobre pedra') || titLower.includes('de corpo e alma') || titLower.includes('mulheres de areia') || titLower.includes('renascer') || titLower.includes('sonho meu') || titLower.includes('fera ferida') || titLower.includes('a viagem') || titLower.includes('tropicaliente') || titLower.includes('pátria minha') || titLower.includes('quatro por quatro') || titLower.includes('a próxima vítima') || titLower.includes('história de amor') || titLower.includes('cara & coroa') || titLower.includes('explode coração') || titLower.includes('o fim do mundo') || titLower.includes('o rei do gado') || titLower.includes('anjo de mim') || titLower.includes('salsa e merengue') || titLower.includes('a indomada') || titLower.includes('zazá') || titLower.includes('por amor') || titLower.includes('anjo mau') || titLower.includes('corpo dourado') || titLower.includes('torre de babel') || titLower.includes('era uma vez') || titLower.includes('meu bem querer') || titLower.includes('suave veneno') || titLower.includes('andando nas nuvens') || titLower.includes('terra nostra') || titLower.includes('vila madalena') || titLower.includes('laços de família') || titLower.includes('ugue ugue') || titLower.includes('o clone') || titLower.includes('celebridade') || titLower.includes('senhora do destino') || titLower.includes('américa') || titLower.includes('belíssima') || titLower.includes('páginas da vida') || titLower.includes('paraíso tropical') || titLower.includes('duas caras') || titLower.includes('a favorita') || titLower.includes('caminho das índias') || titLower.includes('passione') || titLower.includes('insensato coração') || titLower.includes('fina estampa') || titLower.includes('avenida brasil'))) {
    trilhasSonoras.push(r);
  } else {
    puroGenerico.push(r);
  }
});

console.log('Trilhas sonoras identificadas:', trilhasSonoras.length);
console.log('Outros:', puroGenerico.length);

fs.writeFileSync('./scripts/trilhas_sonoras.json', JSON.stringify(trilhasSonoras, null, 2));
fs.writeFileSync('./scripts/puro_generico.json', JSON.stringify(puroGenerico, null, 2));
