const fs = require('fs');

const discos = JSON.parse(fs.readFileSync('./scripts/faixa_200_299.json', 'utf8'));

console.log('Total:', discos.length);

const semArtista = discos.filter(d => !d.artista || d.artista.trim() === '');
console.log('Sem artista:', semArtista.length);
if (semArtista.length > 0) {
  console.log('Exemplos sem artista:');
  semArtista.forEach(d => console.log(`- [ID ${d.id}] C${d.caixa} (${d.loja}): "${d.titulo}"`));
}

// Analisar por categorias/caixas
const porCaixa = {};
discos.forEach(d => {
  porCaixa[d.caixa] = (porCaixa[d.caixa] || 0) + 1;
});
console.log('Distribuição por caixa:', porCaixa);
