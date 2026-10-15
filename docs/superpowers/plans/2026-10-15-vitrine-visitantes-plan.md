# Vitrine de Visitantes (Freelancer Discos) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar uma aplicação Next.js independente (vitrine somente leitura) para que clientes consultem discos, CDs, DVDs e VHS por loja e caixa e fechem pedidos via sacola no WhatsApp, com zero operações de escrita no banco e design idêntico ao admin (100% sólido, sem glassmorphism/translucidez).

**Architecture:** Next.js 16 (App Router) em novo repositório com dados lidos estritamente no servidor via `@supabase/supabase-js` com `SUPABASE_SECRET_KEY`. Zero chaves públicas expostas no bundle cliente. Consultas com filtro rígido `deletado = false AND ativo = true`. Sacola mantida no `localStorage` com endpoint de validação de disponibilidade antes do redirecionamento para o WhatsApp.

**Tech Stack:** Next.js 16.3, React 19.2, `@supabase/supabase-js`, `server-only`, `react-icons`, Vitest, Playwright.

**Spec:** [2026-10-15-vitrine-visitantes-design.md](file:///c:/Users/FREE%20LANCER/Documents/freelancer-discos/docs/superpowers/specs/2026-10-15-vitrine-visitantes-design.md)

## Global Constraints

- **Design:** Proibido `backdrop-filter` e qualquer background translúcido (alfa < 1) em superfícies. Cores sólidas: `--bg: #09090b`, `--bg-card: #151518`, `--border: #232328`, `--accent: #8b1e1e`. Overlay modal/folha: `#050506` opaco.
- **Mobile-first:** Áreas de toque mínimas de 44x44px. Inputs com `font-size: 16px`. Safe-area respeitada no `BottomNav`.
- **Segurança de dados:** Somente operações `select`. Proibido `insert`, `update`, `delete`. Proibido variáveis com prefixo `NEXT_PUBLIC_SUPABASE_*`.
- **Regras de Loja/Caixa:** Loja 1 exibe `Caixa N`; Loja 2 exibe `Caixa 1B` a `Caixa 20B` (todas as 20 fixas, inclusive vazias).
- **Sem Emojis:** Utilizar apenas ícones SVG de `react-icons`.

---

## Guia do Usuário: Criação do Repo GitHub e Vercel

Antes ou durante a execução do plano, siga este passo a passo:

1. **Criar repositório no GitHub:**
   - Acesse: `https://github.com/new`
   - Nome do repositório: `freelancer-discos-vitrine`
   - Visibilidade: Público ou Privado (sua escolha).
   - Não marque "Add a README file" nem ".gitignore" (serão gerados pelo projeto).
   - Clique em **Create repository**.

2. **Criar projeto na Vercel:**
   - Acesse: `https://vercel.com/new`
   - Conecte sua conta do GitHub e selecione o repositório `freelancer-discos-vitrine`.
   - Framework Preset: **Next.js**.
   - Root Directory: `./`.
   - Em **Environment Variables**, adicione exatamente:
     - `SUPABASE_URL`: (a URL do seu projeto Supabase existente em `.env.local`)
     - `SUPABASE_SECRET_KEY`: (a chave secreta `SUPABASE_SERVICE_ROLE_KEY` do Supabase)
   - Clique em **Deploy**.

---

## Estrutura de Arquivos Planejada

```text
c:\Users\FREE LANCER\Documents\freelancer-discos-vitrine/
├── package.json
├── next.config.mjs
├── jsconfig.json
├── vitest.config.mjs
├── .env.local (somente local para dev)
├── src/
│   ├── app/
│   │   ├── globals.css
│   │   ├── layout.js
│   │   ├── page.js                     # Catálogo geral
│   │   ├── lojas/
│   │   │   ├── page.js                 # Lista de Lojas (Loja 1 e Loja 2)
│   │   │   └── [loja]/
│   │   │       ├── page.js             # Grade de caixas da loja
│   │   │       └── [caixa]/
│   │   │           └── page.js         # Produtos da caixa
│   │   └── api/
│   │       └── sacola/
│   │           └── validar/
│   │               └── route.js        # POST validação de itens ativos
│   ├── components/
│   │   ├── AlbumCover.js               # Imagem estática com fallback de vinil/disco
│   │   ├── BottomNav.js                # Navegação fixa inferior (Catálogo, Lojas, Sacola)
│   │   ├── CategoryTabs.js             # Abas Discos, CDs, DVDs, VHS
│   │   ├── ProductCard.js              # Card de produto com toque e botão sacola
│   │   ├── ProductDetailSheet.js       # Bottom sheet com detalhes (observação, ano)
│   │   ├── CartDrawer.js               # Drawer/Sheet da sacola + link WhatsApp
│   │   ├── CatalogFilters.js           # Busca, filtro loja/caixa, ordenação
│   │   └── CatalogPagination.js        # Paginação clássica
│   ├── lib/
│   │   └── supabaseServer.js           # Cliente Supabase server-only com secret key
│   ├── services/
│   │   ├── catalogService.js           # Queries seguras de itens ativos
│   │   └── caixaService.js             # Mapeamento e contagem de caixas
│   └── utils/
│       ├── stringUtils.js              # removeAcentos, tokens de busca, formatCaixa
│       └── cartUtils.js                # Formatação da mensagem WhatsApp
└── tests/
    ├── stringUtils.test.js
    ├── catalogService.test.js
    ├── cartValidation.test.js
    └── securityAudit.test.js
```

---

### Task 1: Scaffolding do Projeto Independente e Configuração Inicial

**Files:**
- Create: `c:\Users\FREE LANCER\Documents\freelancer-discos-vitrine\package.json`
- Create: `c:\Users\FREE LANCER\Documents\freelancer-discos-vitrine\next.config.mjs`
- Create: `c:\Users\FREE LANCER\Documents\freelancer-discos-vitrine\jsconfig.json`
- Create: `c:\Users\FREE LANCER\Documents\freelancer-discos-vitrine\vitest.config.mjs`
- Create: `c:\Users\FREE LANCER\Documents\freelancer-discos-vitrine\.gitignore`
- Modify: `c:\Users\FREE LANCER\Documents\freelancer-discos\vitrine` (Criar NTFS Junction)

**Interfaces:**
- Produz: Ambiente Next.js 16 funcional com scripts `dev`, `build`, `test`.

- [ ] **Step 1: Criar pasta do projeto e junction no workspace principal**

Comando PowerShell:
```powershell
New-Item -ItemType Directory -Path "c:\Users\FREE LANCER\Documents\freelancer-discos-vitrine" -Force
cmd /c mklink /J "c:\Users\FREE LANCER\Documents\freelancer-discos\vitrine" "c:\Users\FREE LANCER\Documents\freelancer-discos-vitrine"
```

- [ ] **Step 2: Criar package.json e instalar dependências essenciais**

Escrever `package.json`:
```json
{
  "name": "freelancer-discos-vitrine",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.112.3",
    "next": "16.3.0",
    "react": "19.2.8",
    "react-dom": "19.2.8",
    "react-icons": "^5.7.0",
    "server-only": "^0.0.1"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.4",
    "vitest": "^2.1.8"
  }
}
```

Executar instalação:
`npm install` dentro de `freelancer-discos-vitrine`.

- [ ] **Step 3: Configurar next.config.mjs, jsconfig.json e vitest.config.mjs**

`next.config.mjs`:
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: true,
};
export default nextConfig;
```

`jsconfig.json`:
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

`vitest.config.mjs`:
```javascript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

`.gitignore`:
```text
node_modules
.next
.env*.local
dist
coverage
```

- [ ] **Step 4: Inicializar repositório Git e primeiro commit**

```bash
git init
git branch -M main
git add .
git commit -m "chore: initial scaffold of vitrine project"
```

---

### Task 2: Design System e Estilos 100% Sólidos (Zero Glassmorphism)

**Files:**
- Create: `src/app/globals.css`
- Create: `src/app/layout.js`
- Test: `tests/stylesAudit.test.js`

**Interfaces:**
- Produz: Variáveis CSS globais, reset, tipografia (Outfit/Figtree), layout com safe-areas, verificação de zero translucidez.

- [ ] **Step 1: Escrever teste de auditoria de estilos proibidos**

`tests/stylesAudit.test.js`:
```javascript
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Auditoria de Estilos Sólidos', () => {
  it('não deve conter backdrop-filter nem transparência em backgrounds de superfícies', () => {
    const cssContent = fs.readFileSync(path.resolve(__dirname, '../src/app/globals.css'), 'utf-8');
    expect(cssContent).not.toMatch(/backdrop-filter/i);
    expect(cssContent).not.toMatch(/background(-color)?:\s*rgba\(/i);
    expect(cssContent).not.toMatch(/background(-color)?:\s*hsla\(/i);
  });
});
```

- [ ] **Step 2: Rodar teste e confirmar falha**

Executar: `npm run test tests/stylesAudit.test.js`
Resultado esperado: FAIL (arquivo ainda não existe).

- [ ] **Step 3: Implementar globals.css com tokens sólidos**

`src/app/globals.css`:
```css
* {
  box-sizing: border-box;
  padding: 0;
  margin: 0;
}

:root {
  --font-title: var(--font-outfit), 'Outfit', system-ui, sans-serif;
  --font-body: var(--font-figtree), 'Figtree', system-ui, sans-serif;
  --bottom-nav-height: 64px;

  /* Cores 100% Sólidas */
  --bg: #09090b;
  --bg-card: #151518;
  --bg-card-alt: #121215;
  --bg-modal: #18181c;
  --bg-overlay: #050506; /* Overlay 100% sólido e opaco */
  --nav-bg: #111114;

  --border: #232328;
  --border-light: #323238;

  --accent: #8b1e1e;
  --accent-hover: #731717;

  --text: #e4e4e7;
  --text-muted: #a1a1aa;
  --text-dim: #71717a;

  --radius-sm: 8px;
  --radius-md: 10px;
  --radius-lg: 14px;

  --shadow-sm: 0 1px 3px rgba(0,0,0,0.4);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.5);
  --shadow-lg: 0 8px 24px rgba(0,0,0,0.6);
}

html, body {
  min-height: 100%;
  background: var(--bg);
  color: var(--text);
  font-family: var(--font-body);
  -webkit-font-smoothing: antialiased;
}

h1, h2, h3, h4, .titleFont {
  font-family: var(--font-title);
  letter-spacing: -0.025em;
}

.pageContainer {
  max-width: 1200px;
  margin: 0 auto;
  padding: 16px;
  padding-bottom: calc(var(--bottom-nav-height) + 32px);
}

@media (max-width: 640px) {
  .pageContainer {
    padding: 12px 10px;
    padding-bottom: calc(var(--bottom-nav-height) + 24px);
  }
}
```

- [ ] **Step 4: Implementar layout.js com fontes e Safe Area**

`src/app/layout.js`:
```javascript
import { Outfit, Figtree } from 'next/font/google';
import './globals.css';

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
  display: 'swap',
});

const figtree = Figtree({
  subsets: ['latin'],
  variable: '--font-figtree',
  display: 'swap',
});

export const metadata = {
  title: 'Freelancer Discos — Vitrine do Catálogo',
  description: 'Catálogo de discos de vinil, CDs, DVDs e fitas VHS da Freelancer Discos',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#09090b',
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR" className={`${outfit.variable} ${figtree.variable}`}>
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 5: Rodar teste e commitar**

Executar: `npm run test tests/stylesAudit.test.js` -> PASS
```bash
git add src/app/globals.css src/app/layout.js tests/stylesAudit.test.js
git commit -m "feat(styles): implement solid dark design system without glassmorphism"
```

---

### Task 3: Camada de Utilitários de Texto e Dados do Supabase (Server-Only)

**Files:**
- Create: `src/utils/stringUtils.js`
- Create: `src/lib/supabaseServer.js`
- Create: `src/services/catalogService.js`
- Create: `src/services/caixaService.js`
- Test: `tests/stringUtils.test.js`
- Test: `tests/catalogService.test.js`

**Interfaces:**
- `removeAcentos(text: string): string`
- `formatCaixa(caixa: string, loja: string): string`
- `catalogService.fetchItems({ category, pagina, itensPorPagina, filtroLoja, filtroCaixa, busca, ordenarColuna, ordenarDirecao })`
- `caixaService.getCaixasPorLoja(loja: string)`

- [ ] **Step 1: Escrever testes unitários para stringUtils**

`tests/stringUtils.test.js`:
```javascript
import { describe, it, expect } from 'vitest';
import { removeAcentos, formatCaixa, extractSearchTokens } from '../src/utils/stringUtils';

describe('stringUtils', () => {
  it('remove acentos corretamente', () => {
    expect(removeAcentos('Álbum Clássico')).toBe('album classico');
  });

  it('formata caixas da Loja 1 e Loja 2', () => {
    expect(formatCaixa('5', 'Loja 1')).toBe('Caixa 5');
    expect(formatCaixa('5b', 'Loja 2')).toBe('Caixa 5B');
    expect(formatCaixa('Caixa 10b', 'Loja 2')).toBe('Caixa 10B');
  });

  it('extrai tokens de busca removendo stop words', () => {
    const { effectiveWords } = extractSearchTokens('The Beatles Abbey Road');
    expect(effectiveWords).toContain('beatles');
    expect(effectiveWords).toContain('abbey');
    expect(effectiveWords).toContain('road');
    expect(effectiveWords).not.toContain('the');
  });
});
```

- [ ] **Step 2: Implementar stringUtils.js**

Copiar e modularizar as funções puras de `src/utils/stringUtils.js` do projeto principal para a vitrine.

- [ ] **Step 3: Implementar lib/supabaseServer.js com proteção server-only**

`src/lib/supabaseServer.js`:
```javascript
import 'server-only';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseSecretKey) {
  throw new Error('As variáveis SUPABASE_URL e SUPABASE_SECRET_KEY são obrigatórias no servidor.');
}

export const supabaseServer = createClient(supabaseUrl, supabaseSecretKey, {
  auth: { persistSession: false },
});
```

- [ ] **Step 4: Implementar catalogService.js com filtro rígido de Ativo e Não-Deletado**

`src/services/catalogService.js`:
- Garantir que `.eq('deletado', false).eq('ativo', true)` seja aplicado incondicionalmente em todas as queries.
- Selecionar apenas colunas públicas: `id, titulo, preco, loja, caixa, ano, capa_url, observacao` (+ `artista` se categoria for `discos` ou `cds`).
- Implementar busca tolerante a acentos e curingas fonéticos.

- [ ] **Step 5: Implementar caixaService.js para Loja 1 e Loja 2**

`src/services/caixaService.js`:
- Garantir que Loja 2 sempre retorne as 20 caixas fixas (`Caixa 1B` a `Caixa 20B`) com contagens de itens disponíveis.
- Garantir que Loja 1 retorne as caixas numéricas (`Caixa 1`, `Caixa 2`...) com itens.

- [ ] **Step 6: Executar testes e commitar**

Executar: `npm run test tests/stringUtils.test.js` -> PASS
```bash
git add src/utils/stringUtils.js src/lib/supabaseServer.js src/services/ tests/
git commit -m "feat(backend): add server-only supabase client, catalogService and string utilities"
```

---

### Task 4: Componentes de UI de Alta Fidelidade (Somente Leitura)

**Files:**
- Create: `src/components/AlbumCover.js`
- Create: `src/components/ProductCard.js`
- Create: `src/components/ProductDetailSheet.js`
- Create: `src/components/CategoryTabs.js`
- Create: `src/components/BottomNav.js`
- Create: `src/components/CatalogPagination.js`
- Test: `tests/componentsRender.test.js`

**Interfaces:**
- `ProductCard({ item, tipo, onOpenDetail, onAddToCart, isInCart })`
- `ProductDetailSheet({ item, isOpen, onClose, onAddToCart, isInCart })`
- `CategoryTabs({ activeTab, onTabChange })`
- `BottomNav({ cartCount, activeRoute })`

- [ ] **Step 1: Implementar AlbumCover.js**
- Renderização estática da `capa_url`.
- Fallback em SVG puro para `PiVinylRecord` ou `PiDisc` em caso de erro ou ausência de URL.
- Zero requisições ao Discogs/Gemini.

- [ ] **Step 2: Implementar ProductCard.js**
- Proporção da capa 1:1.
- Exibição de Artista (se aplicável), Título, Preço em destaque e Badge `Loja · Caixa`.
- Botão "Adicionar à Sacola" com target mínimo de 44x44px e feedback visual ao toque.
- Toque no corpo do card aciona o `ProductDetailSheet`.

- [ ] **Step 3: Implementar ProductDetailSheet.js**
- Folha inferior (bottom sheet) com fundo sólido `--bg-modal` (`#18181c`) e borda sólida.
- Overlay cobrindo a tela inteira em cor sólida e opaca `#050506`.
- Exibe observações, prensagem/estado (oriundo do campo `observacao`), ano e localização física.

- [ ] **Step 4: Implementar CategoryTabs.js e BottomNav.js**
- `CategoryTabs`: Discos, DVDs, CDs, VHS.
- `BottomNav`: Ícones `PiVinylRecord` (Catálogo), `FiMapPin` / `MdStore` (Lojas) e `FiShoppingBag` (Sacola com badge de quantidade).

- [ ] **Step 5: Rodar testes e commitar**

```bash
git add src/components/
git commit -m "feat(ui): implement product card, bottom detail sheet and navigation components"
```

---

### Task 5: Página de Catálogo Completo (`/`) com Filtros e Busca

**Files:**
- Create: `src/components/CatalogFilters.js`
- Create: `src/app/page.js`
- Create: `src/app/api/catalogo/route.js` (Route Handler para busca dinâmica cliente sem expor Supabase)

**Interfaces:**
- `GET /api/catalogo?categoria=discos&loja=Loja%201&caixa=1&busca=rock&pagina=1&ordenar=preco_asc`

- [ ] **Step 1: Implementar Route Handler seguro `/api/catalogo`**
- Valida parâmetros recebidos.
- Chama `catalogService.fetchItems()`.
- Retorna JSON com itens e metadados de paginação.

- [ ] **Step 2: Implementar CatalogFilters.js**
- Campo de busca com debounce e botão de limpar.
- Filtro por Loja (`Todas`, `Loja 1`, `Loja 2`).
- Filtro por Caixa (carregado dinamicamente via serviço de caixas).
- Ordenação por Preço (Menor/Maior) e Artista/Título.

- [ ] **Step 3: Implementar página principal `src/app/page.js`**
- Conexão entre abas de categoria, filtros e listagem em grade responsiva.
- Estados de Carregando (Skeleton sem transparência) e Estado Vazio amigável.
- Sincronização da sacola ativa com o `localStorage`.

- [ ] **Step 4: Verificar no navegador e commitar**

```bash
git add src/app/page.js src/app/api/catalogo/ src/components/CatalogFilters.js
git commit -m "feat(catalog): complete main catalog page with filters, search and pagination"
```

---

### Task 6: Navegação de Lojas e Caixas (`/lojas`, `/lojas/[loja]`, `/lojas/[loja]/[caixa]`)

**Files:**
- Create: `src/app/lojas/page.js`
- Create: `src/app/lojas/[loja]/page.js`
- Create: `src/app/lojas/[loja]/[caixa]/page.js`
- Test: `tests/lojasRoutes.test.js`

**Interfaces:**
- `/lojas`: 2 cards principais (Loja 1 e Loja 2) com total de itens ativos.
- `/lojas/[loja]`: Grade de caixas com contagem de títulos.
- `/lojas/[loja]/[caixa]`: Listagem direta de todos os títulos daquela caixa.

- [ ] **Step 1: Implementar `src/app/lojas/page.js`**
- Cards de Loja 1 e Loja 2 com ícones de loja e endereço/identificação.
- Totalizadores de itens disponíveis.

- [ ] **Step 2: Implementar `src/app/lojas/[loja]/page.js`**
- Para Loja 2: renderizar sempre Caixa 1B até Caixa 20B em grade 4x5 ou 2x10.
- Para Loja 1: renderizar caixas com estoque ativo ordenadas numericamente.
- Toque em uma caixa redireciona para a rota da caixa.

- [ ] **Step 3: Implementar `src/app/lojas/[loja]/[caixa]/page.js`**
- Cabeçalho mostrando a Caixa selecionada e botão de voltar para a Loja.
- Grade de produtos com o mesmo `ProductCard`.

- [ ] **Step 4: Commitar**

```bash
git add src/app/lojas/
git commit -m "feat(navigation): implement store and box browsing routes"
```

---

### Task 7: Sacola de Compras, Validador de Estoque e Fechamento no WhatsApp

**Files:**
- Create: `src/app/api/sacola/validar/route.js`
- Create: `src/components/CartDrawer.js`
- Create: `src/utils/cartUtils.js`
- Test: `tests/cartValidation.test.js`

**Interfaces:**
- `POST /api/sacola/validar`: Body `{ itens: [{ id, categoria }] }` -> Response `{ disponiveis: [...], indisponiveis: [...] }`
- `generateWhatsAppUrl({ itens, nome, bairro, telefone })`: string URL wa.me

- [ ] **Step 1: Escrever teste de validação de itens da sacola e mensagem WhatsApp**

`tests/cartValidation.test.js`:
```javascript
import { describe, it, expect } from 'vitest';
import { formatWhatsAppMessage } from '../src/utils/cartUtils';

describe('cartUtils', () => {
  it('gera texto formatado com loja e caixa para o WhatsApp', () => {
    const itens = [
      { titulo: 'Abbey Road', artista: 'The Beatles', preco: 150, loja: 'Loja 1', caixa: '5' },
      { titulo: 'Thriller', artista: 'Michael Jackson', preco: 120, loja: 'Loja 2', caixa: 'Caixa 3B' },
    ];
    const msg = formatWhatsAppMessage(itens, 'Carlos', 'Aldeota');
    expect(msg).toContain('The Beatles - Abbey Road (Loja 1 · Caixa 5) - R$ 150,00');
    expect(msg).toContain('Michael Jackson - Thriller (Loja 2 · Caixa 3B) - R$ 120,00');
    expect(msg).toContain('Total: R$ 270,00');
    expect(msg).toContain('Nome: Carlos');
    expect(msg).toContain('Bairro: Aldeota');
  });
});
```

- [ ] **Step 2: Implementar endpoint `POST /api/sacola/validar`**
- Faz consulta em lote no Supabase pelas tabelas respectivas dos itens.
- Retorna quais ainda possuem `deletado = false AND ativo = true`.

- [ ] **Step 3: Implementar CartDrawer.js**
- Drawer deslizante ou tela modal com lista dos itens na sacola.
- Botão de remover item.
- Inputs opcionais de Nome e Bairro (`font-size: 16px` para mobile).
- Ao clicar em "Finalizar no WhatsApp":
  - Dispara validação contra `/api/sacola/validar`.
  - Se algum item foi vendido/desativado, remove da sacola e exibe alerta temporário (5s auto-dismiss).
  - Se itens continuam válidos, abre a URL do WhatsApp (`https://wa.me/5585987879214?text=...`).

- [ ] **Step 4: Rodar testes e commitar**

Executar: `npm run test tests/cartValidation.test.js` -> PASS
```bash
git add src/app/api/sacola/validar/ src/components/CartDrawer.js src/utils/cartUtils.js tests/cartValidation.test.js
git commit -m "feat(cart): add cart drawer, inventory pre-check and whatsapp checkout"
```

---

### Task 8: Auditoria de Segurança de Bundle e Teste Visual E2E

**Files:**
- Create: `tests/securityAudit.test.js`
- Create: `tests/e2e/vitrineFlow.spec.js`

**Interfaces:**
- `npm run build` deve gerar bundle sem qualquer chave secreta ou pública de Supabase.
- Teste E2E em viewport 375x812 (mobile) e 1440x900 (desktop).

- [ ] **Step 1: Escrever teste de auditoria estática do bundle gerado**

`tests/securityAudit.test.js`:
- Roda após `npm run build`.
- Inspeciona todos os arquivos de `.next/static/chunks/`.
- Garante ausência de `SUPABASE_SECRET_KEY` ou termos sensíveis.

- [ ] **Step 2: Executar build e validação de segurança**

```bash
npm run build
npm run test tests/securityAudit.test.js
```

- [ ] **Step 3: Validar visualmente via Browser Subagent em 375px e 1440px**
- Testar catálogo, navegação por abas, detalhe bottom-sheet, adição na sacola e link gerado.
- Confirmar ausência de qualquer elemento com glassmorphism ou transparência indesejada.

- [ ] **Step 4: Commit final e push para o repositório**

```bash
git add .
git commit -m "chore: complete vitrine setup with full test coverage and security audit"
```
