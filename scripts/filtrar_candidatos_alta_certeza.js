const fs = require('fs');

const restantes = JSON.parse(fs.readFileSync('./scripts/restantes_genericos_capa_fisica.json', 'utf8'));

// Casos com forte indício de artista ou álbum específico
const candidatos = [];

restantes.forEach(r => {
  const tit = r.titulo.trim();
  const titLower = tit.toLowerCase();
  
  // Padrões:
  // 1. "X interpreta Y", "canta X", "com X", "apresenta X", "ao órgão", etc.
  // 2. Títulos clássicos únicos conhecidos
  // 3. Trilhas sonoras famosas (Tootsie, Karate Kid, Zabriskie Point)
  // 4. Nomes de bandas no título (Aquarius Band, Trio Tamoyo, Coompor, Los Maneros, etc.)
  
  let match = false;
  let motivo = '';
  
  if (titLower.includes('interpreta') || titLower.includes('canta') || titLower.includes('apresenta') || titLower.includes(' com ') || titLower.includes(' e seu ') || titLower.includes(' e sua ')) {
    match = true;
    motivo = 'Padrão com / canta / interpreta / apresenta';
  } else if (titLower.includes('trio ') || titLower.includes('band') || titLower.includes('orquestra') || titLower.includes('conjunto') || titLower.includes('grupo') || titLower.includes('quarteto')) {
    match = true;
    motivo = 'Nome de grupo / banda / conjunto no título';
  } else if (/vol(\.|ume)?\s*\d+/i.test(tit) || /as\s*14\s*mais/i.test(tit) || /hit/i.test(tit) || /festival/i.test(tit)) {
    // Coletânea genérica evidente
  } else if (tit.length > 3) {
    // Títulos específicos
    candidatos.push({ ...r, motivo: 'Título específico para verificação' });
    return;
  }
  
  if (match) {
    candidatos.push({ ...r, motivo });
  }
});

console.log(`Candidatos selecionados para verificação: ${candidatos.length}`);
fs.writeFileSync('./scripts/candidatos_verificacao.json', JSON.stringify(candidatos, null, 2), 'utf8');
