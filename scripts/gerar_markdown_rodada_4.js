const fs = require('fs');
const path = require('path');

const dados = JSON.parse(fs.readFileSync('./scripts/curadoria_alta_certeza_rodada_4.json', 'utf8'));
const restantes = JSON.parse(fs.readFileSync('./scripts/restantes_genericos_capa_fisica.json', 'utf8'));

// Separar em duas seções claras:
// 1. Artistas e Álbuns Específicos Identificados (26 itens)
// 2. Coletâneas / Trilhas Sonoras Oficiais Multiartistas (Various) (23 itens)
const artistasEspecificos = dados.filter(d => d.artistaRecomendado !== 'Various');
const coletaneasVarious = dados.filter(d => d.artistaRecomendado === 'Various');

let md = `# Relatório de Inspeção de Alta Certeza: Rodada 4 (Discos Sem Autor / Específicos)

> [!IMPORTANT]
> **Rigor e Zero Achismo**:
> Este lote contém **apenas registros de certeza absoluta e documentada**, cruzados com catálogos oficiais e discografias consolidadas (Discogs, Memória Musical e edições brasileiras).
> Nenhuma suposição foi feita para os 178 títulos restantes, que permanecem preservados até conferência física das capas.

---

## 1. Resumo Executivo

- **Total selecionado com máxima certeza**: ${dados.length} discos
- **Artistas e álbuns específicos resgatados**: ${artistasEspecificos.length} discos (autores estavam omitidos ou mesclados no título)
- **Coletâneas e trilhas sonoras oficiais multiartistas (\`Various\`)**: ${coletaneasVarious.length} discos (séries históricas consolidadas)
- **Discos ainda mantidos para conferência física**: 178 discos
- **Status do Banco de Dados**: Nenhuma alteração aplicada ainda (aguardando sua aprovação).

---

## 2. Artistas e Álbuns Específicos Resgatados (${artistasEspecificos.length} itens)

| ID | Caixa / Loja | Artista Atual | Título Atual | Artista Recomendado | Título Recomendado | Justificativa / Comprovação |
|:---|:---|:---|:---|:---|:---|:---|
`;

artistasEspecificos.forEach(item => {
  const artAtual = (item.artistaAtual || '*(vazio)*').replace(/\|/g, '-');
  const titAtual = item.tituloAtual.replace(/\|/g, '-');
  const artRec = item.artistaRecomendado.replace(/\|/g, '-');
  const titRec = item.tituloRecomendado.replace(/\|/g, '-');
  const just = item.justificativa.replace(/\|/g, '-');
  md += `| **${item.id}** | C${item.caixa} (${item.loja}) | \`${artAtual}\` | ${titAtual} | **${artRec}** | **${titRec}** | ${just} |\n`;
});

md += `\n---

## 3. Coletâneas e Trilhas Sonoras Oficiais Multiartistas - \`Various\` (${coletaneasVarious.length} itens)

| ID | Caixa / Loja | Artista Atual | Título Atual | Artista Recomendado | Título Recomendado | Justificativa / Comprovação |
|:---|:---|:---|:---|:---|:---|:---|
`;

coletaneasVarious.forEach(item => {
  const artAtual = (item.artistaAtual || '*(vazio)*').replace(/\|/g, '-');
  const titAtual = item.tituloAtual.replace(/\|/g, '-');
  const artRec = item.artistaRecomendado.replace(/\|/g, '-');
  const titRec = item.tituloRecomendado.replace(/\|/g, '-');
  const just = item.justificativa.replace(/\|/g, '-');
  md += `| **${item.id}** | C${item.caixa} (${item.loja}) | \`${artAtual}\` | ${titAtual} | **${artRec}** | **${titRec}** | ${just} |\n`;
});

md += `\n---

## 4. O que resta? (${restantes.length - dados.length} itens)

Os 178 discos restantes possuem títulos como *"Music Master"*, *"Rock Esperto"*, *"Invasion"*, *"Kawasaki 001"*, *"Metalmorfose"*, etc., onde há mais de uma possibilidade de lançamento ou prensagem independente. Conforme a regra de **máxima certeza**, estes ficam aguardando a visualização direta da capa física na loja.

---

## 5. Próximo Passo

Aguardando seu comando: diga se está **aprovado** para aplicarmos as correções destes 49 discos no Supabase com backup prévio e deploy em \`main\`.
`;

const targetDir = 'C:\\Users\\FREE LANCER\\.gemini\\antigravity-ide\\brain\\816b2013-0c4e-486e-99c8-8030dd3a061f';
const targetFile = path.join(targetDir, 'relatorio_inspecao_alta_certeza_rodada_4.md');

fs.writeFileSync(targetFile, md, 'utf8');
console.log(`Relatório salvo em: ${targetFile}`);
console.log(`Tamanho: ${md.length} bytes`);
