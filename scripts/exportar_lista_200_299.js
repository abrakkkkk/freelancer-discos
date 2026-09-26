const fs = require('fs');
const discos = JSON.parse(fs.readFileSync('./scripts/faixa_200_299.json', 'utf8'));

// Ordenar por preço decrescente e depois por artista
discos.sort((a, b) => b.preco - a.preco || (a.artista || '').localeCompare(b.artista || ''));

const linhas = discos.map((d, i) => {
  return `${i + 1}. [ID ${d.id}] R$ ${d.preco} | C${d.caixa} (${d.loja}) | ${d.artista || '(sem artista)'} - ${d.titulo} | Ano atual: ${d.ano || '---'}`;
});

fs.writeFileSync('./scripts/lista_faixa_200_299.txt', linhas.join('\n'), 'utf8');
console.log('Salvo em ./scripts/lista_faixa_200_299.txt');
