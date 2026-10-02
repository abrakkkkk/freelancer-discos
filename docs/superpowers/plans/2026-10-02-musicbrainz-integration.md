# Plano de Integração: Busca Híbrida MusicBrainz + Discogs & Gestão de Novas Prensagens (Caixas 49, 50 e 51)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrar a API do MusicBrainz como fonte primária ultra-rápida (~700ms) de metadados operando em conjunto com o Discogs, e implementar indicador dedicado de ano e edição/selo para prensagens modernas nas Caixas 49, 50 e 51 (Três Selos, Noize, Rocinante, etc.).

**Architecture:** O frontend dispara a busca simultaneamente para MusicBrainz e Discogs. O MusicBrainz entrega metadados textuais e ano original da obra em <800ms; o Discogs enriquece com fotos de alta qualidade e detalhes da prensagem brasileira. Para as Caixas 49, 50 e 51, o sistema ativa um fluxo especializado de identificação de selo e ano da tiragem moderna com badges visuais no acervo.

**Tech Stack:** Next.js App Router, MusicBrainz Web Service v2, Discogs API v2, Supabase, Vercel Edge Cache.

---

## 1. Como Funcionaria na Prática (Busca Híbrida)

1. **Rota Dedicada `/api/musicbrainz`:**
   - Consulta `https://musicbrainz.org/ws/2/release` com parâmetros `query`, `catno` ou `barcode`.
   - Header obrigatório de identificação de aplicação (`FreelancerDiscos/1.0 (contato@...)`).
   - Cache de borda Vercel Edge (`Cache-Control: public, s-maxage=86400`) para zerar latência em consultas repetidas.
2. **Busca Híbrida Progressiva no Cliente:**
   - O usuário digita o termo ou escaneia código/capa.
   - O MusicBrainz entrega os primeiros resultados em **~700ms** -> o dropdown abre de imediato.
   - O Discogs continua processando em segundo plano (2s a 5s) e adiciona fotos e detalhes de prensagens brasileiras assim que concluir.

---

## 2. Como Elevaria o Processo Atual

1. **Velocidade Percebida 7x Superior:** O tempo de espera cai de 5.400ms para ~700ms para ver os primeiros resultados na tela.
2. **Imunidade contra Quedas do Discogs:** Se o Discogs estiver fora do ar ou sobrecarregado (erro 500 ou 9s de latência), o cadastro de novos discos nunca é interrompido.
3. **Precisão Superior em Anos de Lançamento:** O MusicBrainz é a autoridade global mais precisa para identificar o ano de lançamento original da obra (first release date).
4. **Sem Limite Rígido de Rate Limit Privado:** A API pública do MusicBrainz não exige tokens privados caros e suporta alto tráfego quando configurada com User-Agent adequado.

---

## 3. Como Funcionaria em Conjunto com o Discogs (Sinergia)

| Recurso | MusicBrainz | Discogs | Fusão Híbrida |
| :--- | :--- | :--- | :--- |
| **Tempo de Resposta** | ~700ms (Ultra-rápido) | 2.500ms - 6.000ms | **700ms inicial**, enriquece depois |
| **Identificação Artista/Título** | Excelente | Excelente | **Unificado** |
| **Ano Original de Lançamento** | Padrão ouro mundial | Varia por prensagem | **MusicBrainz define o ano original** |
| **Capas de Discos Brasileiros** | Limitado (Cover Art Archive) | Excelente acervo de vinil BR | **Discogs fornece a capa** |
| **Códigos de Catálogo Nacional** | Razoável | Altamente detalhado | **Discogs valida a prensagem BR** |

---

## 4. Recurso Especial: Caixas 49, 50 e 51 (Discos Novos / Reedições Especiais)

### 4.1. Contexto e Necessidade
As Caixas 49, 50 e 51 concentram **discos novos e reedições de luxo modernas** de clubes e selos especializados (Três Selos, Noize Record Club, Rocinante, Fatiado Discos, Assumpção, etc.). 
Ao contrário de discos antigos de época, estes itens possuem dois anos distintos:
1. **Ano Original da Obra:** Ex: Tim Maia (1972).
2. **Ano e Selo da Prensagem Atual:** Ex: Reedição Três Selos (2022) ou Noize (2023).

### 4.2. Funcionamento no Cadastro e Edição (`adicionar` e `editar`)
- **Gatilho de Caixa:** Ao selecionar a Caixa 49, 50 ou 51, o formulário expande automaticamente a seção:
  - **Selo / Edição:** Campo de texto com botões de seleção rápida (chips de 1 clique):
    - `[Três Selos]`
    - `[Noize]`
    - `[Rocinante]`
    - `[Fatiado]`
    - `[Universal Music]`
    - `[Polysom]`
  - **Ano da Prensagem:** Campo numérico para o ano da tiragem moderna (ex: 2023).
- **Integração com Busca:** O MusicBrainz preenche o ano original da composição (1972) no campo `ano`; o Discogs preenche o ano da prensagem (2022) e o selo quando a edição selecionada for a reedição moderna.
- **Armazenamento:** Persistido na coluna `observacao` com prefixo estruturado (ex: `[Três Selos • 2022]`) ou campo dedicado, preservando total compatibilidade com o banco atual.

### 4.3. Indicador Visual no Acervo (Tabela e Cards Mobile)
- Para qualquer item alocado nas Caixas 49, 50 ou 51:
  - Exibição de uma **badge destacada** (gradiente roxo/dourado com ícone de vinil novo):
    - Exemplo: `✨ Três Selos • 2022` ou `✨ Noize Record Club • 2023`.
  - Permite aos clientes e atendentes identificar de imediato que o exemplar é uma reedição nova lacrada/especial e não um vinil de época.

---

## 5. Tarefas de Implementação

### Tarefa 1: Criar Rota de Proxy `/api/musicbrainz`
- **Arquivo:** `src/app/api/musicbrainz/route.js`
- Suporte a `q`, `catno`, `barcode`.
- Normalização do schema JSON para ser compatível com o formato consumido pelo formulário.
- Cache de borda e timeout de 5 segundos.

### Tarefa 2: Criar Cliente Unificado `musicSearchClient.js`
- **Arquivo:** `src/utils/musicSearchClient.js`
- Executa chamada paralela (`Promise.any` / entrega progressiva).
- Dispara `onFastResults(mbData)` e depois `onEnrichedResults(discogsData)`.

### Tarefa 3: Atualizar Caixas Padrão para Incluir Caixa 51
- **Arquivo:** `src/services/caixaService.js`
- Expandir o gerador de caixas padrão da Loja 1 de 50 para 55, garantindo que a Caixa 51 apareça no select imediatamente.

### Tarefa 4: Implementar Seção Especial de Prensagem (Caixas 49, 50 e 51)
- **Arquivos:** `src/app/adicionar/page.js`, `src/app/editar/page.js` e `src/app/page.js` (listagem)
- Ativação condicional dos campos de Selo/Ano da Prensagem com chips rápidos ao selecionar caixas 49, 50 ou 51.
- Renderização de badges visuais nos cards e na tabela do acervo para itens dessas caixas.

### Tarefa 5: Validação, Testes e Deploy
- Comparar latência em buscas reais (Milton Nascimento, Tim Maia, Caetano Veloso).
- Validar salvamento e renderização de discos da Três Selos / Noize nas caixas 49, 50 e 51.
- Executar `npm run build`, commitar e enviar para `main`.
