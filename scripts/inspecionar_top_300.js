const fs = require('fs');
const top = JSON.parse(fs.readFileSync('./scripts/top_raridades_300.json', 'utf8'));

console.log('--- Top 130 Discos com Preço >= R$ 300 ---');
top.forEach((d, i) => {
  console.log(`${i+1}. [ID ${d.id}] R$ ${d.preco} | ${d.artista || '(sem artista)'} - ${d.titulo} | Ano atual: ${d.ano || '---'} | C${d.caixa} (${d.loja})`);
});
