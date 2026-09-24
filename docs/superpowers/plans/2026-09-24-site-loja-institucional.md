# Freelancer Discos Site — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar a versão inicial independente do site da loja Freelancer Discos em `c:\Users\FREE LANCER\Documents\freelancer-discos-site`, com identidade visual editorial, catálogo dos 183 discos reais das Caixas 50 e 51 e sacola de compras com checkout via WhatsApp.

**Architecture:** Site estático puro (HTML5 + CSS Tokens + JS Vanilla) desacoplado do sistema de estoque. Dados alimentados por `data/discos.json` gerado a partir do Supabase por um script Node.js. Interface responsiva mobile-first com touch targets adequados, busca em tempo real e persistência local da sacola.

**Tech Stack:** HTML5, CSS3 (Design Tokens, Gradients, Flexbox/Grid), JavaScript ES6+ Vanilla, Supabase JS (para script de exportação), Google Fonts (*Playfair Display*, *Bebas Neue*, *Inter*).

**Spec:** `docs/superpowers/specs/2026-09-24-site-loja-institucional-design.md`

## Global Constraints

- Diretório de destino obrigatório: `c:\Users\FREE LANCER\Documents\freelancer-discos-site`
- Sem dependências de build ou frameworks no cliente (Vanilla HTML/CSS/JS)
- Mobile-first: touch targets >= 44x44px, inputs >= 16px font-size, layout fluido
- Tipografia oficial: *Playfair Display*, *Bebas Neue*, *Inter*
- Paleta: `#0a0a0a` (fundo), `#c0392b` (vinho/vermelho), `#7b1a1a` (destaque escuro), `#ffffff` (texto), `#aaaaaa` (metadados), `#2b2b2b` (linhas)
- Idioma obrigatório das mensagens: Português do Brasil (pt-BR)

---

### Task 1: Scaffolding e Script de Exportação dos Discos

**Files:**
- Create: `c:\Users\FREE LANCER\Documents\freelancer-discos-site\scripts\export-caixas.js`
- Create: `c:\Users\FREE LANCER\Documents\freelancer-discos-site\data\discos.json`

**Interfaces:**
- Produces: `data/discos.json` (array de objetos com `id`, `artista`, `titulo`, `preco`, `caixa`, `ano`, `capa_url`)

- [ ] **Step 1: Criar a árvore de diretórios do novo site**

Criar as pastas `css`, `js`, `data` e `scripts` em `c:\Users\FREE LANCER\Documents\freelancer-discos-site`.

- [ ] **Step 2: Escrever o script de exportação `scripts/export-caixas.js`**

Script que lê as chaves do Supabase, consulta discos das Caixas 50 e 51 ativos, busca capas no cache local ou fallback, e salva em `data/discos.json`.

- [ ] **Step 3: Executar o script de exportação e verificar saída**

Executar `node scripts/export-caixas.js` e validar que `data/discos.json` possui 183 registros formatados com id, artista, titulo, preco e caixa.

- [ ] **Step 4: Commit das alterações de documentação e dados**

---

### Task 2: Configuração e Design Tokens (`config.js` e `tokens.css`)

**Files:**
- Create: `c:\Users\FREE LANCER\Documents\freelancer-discos-site\js\config.js`
- Create: `c:\Users\FREE LANCER\Documents\freelancer-discos-site\css\tokens.css`

**Interfaces:**
- Consumes: Definições da especificação de design
- Produces: `window.STORE_CONFIG` em `config.js` e variáveis CSS em `:root`

- [ ] **Step 1: Criar `js/config.js`**

Definir número de WhatsApp da loja, links para redes sociais, e-mail e texto padrão de saudação.

- [ ] **Step 2: Criar `css/tokens.css`**

Definir variáveis de cores (primitivas e semânticas), escalas de fontes, alturas de linha, espaçamentos e transições suaves.

- [ ] **Step 3: Testar carregamento sintático**

Verificar integridade do CSS de tokens.

---

### Task 3: Estrutura HTML Semântica Editorial (`index.html`)

**Files:**
- Create: `c:\Users\FREE LANCER\Documents\freelancer-discos-site\index.html`

**Interfaces:**
- Consumes: `tokens.css`, `style.css`, `config.js`, `app.js`
- Produces: Estrutura visual da página com IDs semânticos para automação e testes

- [ ] **Step 1: Escrever a estrutura de `index.html`**

Incluir:
- Google Fonts preconnect e stylesheet
- Meta tags de viewport e tema
- Topbar de edição e data
- Header com logo e navegação
- Seção Hero editorial com o vinil gráfico
- Seção Quem Somos com container da estante interativa
- Seção Catálogo com barra de busca (`#searchInput`), filtros por Caixa (`#filterAll`, `#filter50`, `#filter51`) e grid (`#catalogGrid`)
- Drawer/Modal da Sacola de Compras (`#cartDrawer`) com botão WhatsApp
- Rodapé completo com redes sociais e contatos

- [ ] **Step 2: Validar integridade da marcação HTML**

---

### Task 4: Estilização Editorial & Mobile-First (`css/style.css`)

**Files:**
- Create: `c:\Users\FREE LANCER\Documents\freelancer-discos-site\css\style.css`

**Interfaces:**
- Consumes: `tokens.css` e elementos de `index.html`
- Produces: Estilos responsivos de 320px a 1440px+, animações e efeitos táteis

- [ ] **Step 1: Escrever estilos base, reset e container principal**

Configurar box-sizing, tipografia padrão, fundo escuro e espaçamentos fluidos com `clamp()`.

- [ ] **Step 2: Estilizar Hero e Vinil CSS animado**

Efeito de reflexo de luz (*conic-gradient* e *radial-gradient*), rótulo do vinil e animação suave de rotação no hover/mobile.

- [ ] **Step 3: Estilizar Quem Somos e Estante Vintage**

Layout de duas colunas no desktop e empilhado no mobile, bloco de citação editorial e moldura da estante.

- [ ] **Step 4: Estilizar Catálogo, Barra de Busca e Cards**

Grade responsiva (1 col mobile, 2 tablet, 4 desktop), cards de vinil com proporção 1:1, badge NOVO/Caixa, preços destacados e botões touch de 44px+.

- [ ] **Step 5: Estilizar Drawer da Sacola de Compras**

Overlay suave, painel deslizante, botões de incremento/remoção e botão principal do WhatsApp com verde e ícone.

---

### Task 5: Lógica Interativa do Catálogo e Sacola (`js/app.js`)

**Files:**
- Create: `c:\Users\FREE LANCER\Documents\freelancer-discos-site\js\app.js`

**Interfaces:**
- Consumes: `data/discos.json` e `window.STORE_CONFIG`
- Produces: Renderização dinâmica, reatividade da sacola e geração de links de checkout

- [ ] **Step 1: Implementar renderização da estante generativa**

Portar e aprimorar o script que gera as lombadas coloridas dos vinis com alturas e tonalidades dinâmicas.

- [ ] **Step 2: Implementar carregamento e renderização do catálogo**

Buscar `data/discos.json`, normalizar termos de busca e renderizar cards com paginação/lazy load inicial (24 discos iniciais + botão carregar mais).

- [ ] **Step 3: Implementar busca em tempo real e filtros por Caixa**

Busca por artista ou álbum sem diferenciação de acentos e filtros pelas Caixas 50 e 51.

- [ ] **Step 4: Implementar sistema da Sacola de Compras**

Adicionar disco, remover disco, calcular total em R$, persistir no `localStorage` e atualizar badges de contagem.

- [ ] **Step 5: Implementar geração de mensagem e redirecionamento WhatsApp**

Construir texto formatado com lista de itens, valores e link `https://wa.me/55...`.

---

### Task 6: Validação End-to-End via Navegador e Evidências

**Files:**
- Teste executável no navegador real via browser subagent

- [ ] **Step 1: Subir servidor HTTP local no diretório do novo site**

- [ ] **Step 2: Executar validação no navegador em modo Mobile (390px)**

Testar:
1. Carregamento inicial da página e exibição do Hero e vinil
2. Digitação no campo de busca (ex: "Taylor") e validação de filtro
3. Adição de 2 vinis à sacola
4. Abertura do drawer da sacola, verificação do subtotal e clique no botão do WhatsApp

- [ ] **Step 3: Executar validação no navegador em modo Desktop (1440px)**

Verificar harmonia visual editorial, grid de 4 colunas e responsividade.

- [ ] **Step 4: Gerar relatório final de validação e entrega para o usuário**
