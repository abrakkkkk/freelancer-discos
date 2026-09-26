const fs = require('fs');
const restantes = JSON.parse(fs.readFileSync('./scripts/restantes_genericos_capa_fisica.json', 'utf8'));
const curados = JSON.parse(fs.readFileSync('./scripts/curadoria_alta_certeza_rodada_4.json', 'utf8'));
const curadosIds = new Set(curados.map(c => c.id));

const sobram = restantes.filter(r => !curadosIds.has(r.id));
console.log('Restam:', sobram.length);
sobram.forEach((s, idx) => {
  console.log(`${idx + 1}. ID ${s.id} | C${s.caixa} [${s.categoria || '-'}]: "${s.titulo}"`);
});
