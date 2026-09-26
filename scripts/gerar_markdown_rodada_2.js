const fs = require('fs');
const path = require('path');

const dados = JSON.parse(fs.readFileSync('./scripts/relatorio_rodada_2.json', 'utf8'));

// Separar em duas categorias:
// 1. Typos e padronizações
// 2. Autores Faltando resolvidos
const typos = dados.filter(d => d.problema.toLowerCase().includes('grafia') || d.problema.toLowerCase().includes('digitação'));
const autoresFaltando = dados.filter(d => !d.problema.toLowerCase().includes('grafia') && !d.problema.toLowerCase().includes('digitação'));

let md = `# Segundo Relatório Completo de Tratamento de Dados: Discos (Reverificação)

> [!IMPORTANT]
> **Rigor e Máxima Certeza Aplicados (Sem Achismos)**:
> Esta 2ª rodada auditou todos os 10.322 discos ativos após a primeira migração. Foram identificados **${dados.length} discos adicionais** com resolução comprovada em discografias oficiais. Os 227 discos restantes são coletâneas multirartistas ou genéricas (ex: "As 14 Mais", "Rock Esperto", "A Bienal do Samba") que não possuem artista único no título, exigindo preservação ou checagem física da capa para evitar qualquer tipo de suposição.

---

## 1. Resumo Executivo da Reverificação

- **Total de discos ativos no banco**: 10.322
- **Discos já tratados na 1ª rodada**: 537 (aplicados com sucesso no banco)
- **Novos discos com resolução de 100% de certeza (2ª rodada)**: ${dados.length}
- **Autores ausentes desmembrados com sucesso**: ${autoresFaltando.length}
- **Padronizações de grafia e correções adicionais**: ${typos.length}
- **Discos genéricos/coletâneas multiartistas isolados**: 227 (preservados sem achismos)
- **Status do Banco de Dados**: Nenhuma alteração da 2ª rodada aplicada ainda (aguardando aprovação).

---

## 2. Autores Faltando / Artistas Mesclados no Título (${autoresFaltando.length} itens)

| ID | Loja / Caixa | Categoria | Título Original | Artista Recomendado | Título Recomendado | Justificativa / Origem |
|:---|:---|:---|:---|:---|:---|:---|
`;

autoresFaltando.forEach(a => {
  const titAtual = a.tituloAtual.replace(/\|/g, '-');
  const artRec = a.artistaRecomendado.replace(/\|/g, '-');
  const titRec = a.tituloRecomendado.replace(/\|/g, '-');
  const prob = a.problema.replace(/\|/g, '-');
  md += `| **${a.id}** | ${a.loja} - C${a.caixa} | ${a.categoria} | ${titAtual} | **${artRec}** | **${titRec}** | ${prob} |\n`;
});

if (typos.length > 0) {
  md += `\n---

## 3. Padronizações e Correções Adicionais (${typos.length} itens)

| ID | Loja / Caixa | Artista Atual | Título Atual | Artista Correto | Título Correto | Motivo |
|:---|:---|:---|:---|:---|:---|:---|
`;
  typos.forEach(t => {
    const artAtual = t.artistaAtual || '*(vazio)*';
    const titAtual = t.tituloAtual.replace(/\|/g, '-');
    const artRec = t.artistaRecomendado.replace(/\|/g, '-');
    const titRec = t.tituloRecomendado.replace(/\|/g, '-');
    const prob = t.problema.replace(/\|/g, '-');
    md += `| **${t.id}** | ${t.loja} - C${t.caixa} | \`${artAtual}\` | ${titAtual} | **${artRec}** | **${titRec}** | ${prob} |\n`;
  });
}

md += `\n---

## 4. Discos Preservados (Coletâneas Genéricas e Casos Físicos)

Os 227 discos restantes foram catalogados sem autor direto por representarem compilações de múltiplos artistas ou títulos que não permitem dedução sem a capa física em mãos (ex.: *"Rock Esperto"*, *"A Bienal do Samba"*, *"16 Italo Hits"*, *"Musica Popular do Norte N.3"*, *"Flash Back Hits"*). Por estrita conformidade com a regra de **máxima certeza e sem achismos**, nenhuma atribuição fictícia foi inserida nesses registros.

---

## 5. Próximos Passos (Aguardando Aprovação)

1. **Aprovação do Usuário**: Validação das ${dados.length} recomendações listadas acima.
2. **Execução Segura no Banco**: Aplicação das atualizações com backup prévio em JSON.
3. **Deploy e Registro**: Commit e push direto para a branch \`main\`.
`;

const targetDir = 'C:\\Users\\FREE LANCER\\.gemini\\antigravity-ide\\brain\\816b2013-0c4e-486e-99c8-8030dd3a061f';
const targetFile = path.join(targetDir, 'relatorio_tratamento_dados_discos_rodada_2.md');

fs.writeFileSync(targetFile, md, 'utf8');
console.log(`Relatório da 2ª rodada salvo em: ${targetFile}`);
console.log(`Tamanho do arquivo: ${md.length} bytes`);
