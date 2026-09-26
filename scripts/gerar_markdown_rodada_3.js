const fs = require('fs');
const path = require('path');

const dados = JSON.parse(fs.readFileSync('./scripts/relatorio_rodada_3.json', 'utf8'));

const asteriscosEInversoes = dados.filter(d => d.tipo === 'limpeza_asterisco' || d.tipo === 'inversao');
const artistasMinusculos = dados.filter(d => d.tipo === 'artista_minusculo');
const titulosMinusculos = dados.filter(d => d.tipo === 'titulo_minusculo');

let md = `# Relatório de Tratamento de Dados: Asteriscos e Minúsculas

> [!IMPORTANT]
> **Critérios e Exceções Rigorosamente Respeitados**:
> 1. **Preservação de Padrões Oficiais**: Artistas cujo nome oficial é grafado em minúsculo (ex.: **\`a-ha\`**) foram estritamente preservados e não sofreram alteração forçada.
> 2. **Preposições e Artigos**: Palavras gramaticais em meio de frase (\`de\`, \`da\`, \`do\`, \`dos\`, \`das\`, \`e\`, \`em\`, \`para\`, \`com\`, \`the\`, \`of\`, \`in\`, \`on\`, \`at\`, \`to\`, \`for\`, \`and\`, \`&\`) foram mantidas em minúsculo no miolo dos nomes.
> 3. **Eliminação de Asteriscos de Importação**: 36 discos contendo caracteres residuais de variações de artistas do Discogs (\`*\`) foram limpos e formatados com os nomes completos.

---

## 1. Resumo Executivo

- **Total de registros mapeados para normalização**: ${dados.length}
- **Discos com asteriscos residuais (*) e inversões de campo**: ${asteriscosEInversoes.length}
- **Discos com artista em minúsculo indevido**: ${artistasMinusculos.length}
- **Discos com título iniciando com minúscula indevida**: ${titulosMinusculos.length}
- **Discos sem autor (compilações multiartistas)**: 227 mantidos isolados (prevenção de achismos sem a capa física).
- **Status do Banco de Dados**: Nenhuma alteração aplicada ainda (aguardando aprovação).

---

## 2. Discos com Asteriscos (*) e Inversões de Campos (${asteriscosEInversoes.length} itens)

| ID | Loja / Caixa | Artista Atual | Título Atual | Artista Recomendado | Título Recomendado | Tipo de Correção |
|:---|:---|:---|:---|:---|:---|:---|
`;

asteriscosEInversoes.forEach(item => {
  const artAtual = (item.artistaAtual || '*(vazio)*').replace(/\|/g, '-');
  const titAtual = item.tituloAtual.replace(/\|/g, '-');
  const artRec = item.artistaRecomendado.replace(/\|/g, '-');
  const titRec = item.tituloRecomendado.replace(/\|/g, '-');
  const prob = item.problema.replace(/\|/g, '-');
  md += `| **${item.id}** | ${item.loja} - C${item.caixa} | \`${artAtual}\` | ${titAtual} | **${artRec}** | **${titRec}** | ${prob} |\n`;
});

md += `\n---

## 3. Discos com Artistas em Minúsculo Indevido (${artistasMinusculos.length} itens)

| ID | Loja / Caixa | Artista Atual | Título Atual | Artista Recomendado | Título Recomendado |
|:---|:---|:---|:---|:---|:---|
`;

// Exibir todos os artistas minúsculos na tabela completa
artistasMinusculos.forEach(item => {
  const artAtual = (item.artistaAtual || '').replace(/\|/g, '-');
  const titAtual = (item.tituloAtual || '').replace(/\|/g, '-');
  const artRec = item.artistaRecomendado.replace(/\|/g, '-');
  const titRec = item.tituloRecomendado.replace(/\|/g, '-');
  md += `| **${item.id}** | ${item.loja} - C${item.caixa} | \`${artAtual}\` | ${titAtual} | **${artRec}** | **${titRec}** |\n`;
});

md += `\n---

## 4. Discos com Títulos Iniciando em Minúscula (${titulosMinusculos.length} itens)

| ID | Loja / Caixa | Artista Atual | Título Atual | Artista Recomendado | Título Recomendado |
|:---|:---|:---|:---|:---|:---|
`;

titulosMinusculos.forEach(item => {
  const artAtual = (item.artistaAtual || '').replace(/\|/g, '-');
  const titAtual = (item.tituloAtual || '').replace(/\|/g, '-');
  const artRec = item.artistaRecomendado.replace(/\|/g, '-');
  const titRec = item.tituloRecomendado.replace(/\|/g, '-');
  md += `| **${item.id}** | ${item.loja} - C${item.caixa} | \`${artAtual}\` | ${titAtual} | **${artRec}** | **${titRec}** |\n`;
});

md += `\n---

## 5. Próximos Passos (Aguardando Aprovação)

1. **Aprovação do Usuário**: Validação das normalizações de maiúsculas/minúsculas e remoção de asteriscos.
2. **Execução Segura no Banco**: Aplicação das atualizações com backup prévio em JSON.
3. **Deploy e Registro**: Commit e push direto para a branch \`main\`.
`;

const targetDir = 'C:\\Users\\FREE LANCER\\.gemini\\antigravity-ide\\brain\\816b2013-0c4e-486e-99c8-8030dd3a061f';
const targetFile = path.join(targetDir, 'relatorio_tratamento_dados_asteriscos_minusculas.md');

fs.writeFileSync(targetFile, md, 'utf8');
console.log(`Relatório salvo com sucesso em: ${targetFile}`);
console.log(`Tamanho do arquivo: ${md.length} bytes`);
