const fs = require('fs');

const dados = JSON.parse(fs.readFileSync('./scripts/relatorio_rodada_3.json', 'utf8'));

const siglas = new Set([
  'KC', 'MPB', 'RPM', 'INXS', 'ELO', 'UB40', 'AC/DC', 'U2', 'CCR', 'DJ', 'MC', 'R.E.M.', 'B.B.', 'LL', 'IMP', 'EP', 'LP', 'TV', 'USA'
]);

let ajustados = 0;

dados.forEach(d => {
  // Se o artistaAtual continha sigla em caixa alta, restaurar a caixa alta no artistaRecomendado
  if (d.artistaAtual && d.artistaRecomendado) {
    const palavrasOrig = d.artistaAtual.split(/\s+/);
    const palavrasRec = d.artistaRecomendado.split(/\s+/);
    
    if (palavrasOrig.length === palavrasRec.length) {
      palavrasOrig.forEach((orig, idx) => {
        const origNorm = orig.replace(/[^A-Za-z0-9]/g, '');
        if (siglas.has(origNorm)) {
          palavrasRec[idx] = orig;
          ajustados++;
        }
      });
      d.artistaRecomendado = palavrasRec.join(' ');
    }
  }
  
  // Da mesma forma no título
  if (d.tituloAtual && d.tituloRecomendado) {
    const palavrasOrig = d.tituloAtual.split(/\s+/);
    const palavrasRec = d.tituloRecomendado.split(/\s+/);
    
    if (palavrasOrig.length === palavrasRec.length) {
      palavrasOrig.forEach((orig, idx) => {
        const origNorm = orig.replace(/[^A-Za-z0-9]/g, '');
        if (siglas.has(origNorm)) {
          palavrasRec[idx] = orig;
        }
      });
      d.tituloRecomendado = palavrasRec.join(' ');
    }
  }
});

console.log(`Siglas preservadas em ${ajustados} ocorrências.`);

// Filtrar itens onde artistaRecomendado === artistaAtual E tituloRecomendado === tituloAtual (sem alteração necessária)
const apenasComAlteracao = dados.filter(d => 
  d.artistaRecomendado !== d.artistaAtual || d.tituloRecomendado !== d.tituloAtual
);

console.log(`Total com alteração real após preservação de siglas: ${apenasComAlteracao.length}`);
fs.writeFileSync('./scripts/relatorio_rodada_3.json', JSON.stringify(apenasComAlteracao, null, 2), 'utf8');
