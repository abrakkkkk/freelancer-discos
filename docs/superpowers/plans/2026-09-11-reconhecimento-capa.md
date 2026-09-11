# Reconhecimento por Capa (Vision AI) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar o reconhecimento visual de capas de vinil usando o Gemini 1.5 Flash, integrando tanto na tela de cadastro (`/adicionar`) quanto na busca do Catálogo (`/`) para agilizar a rotina de loja sem baixa automática forçada.

**Architecture:** A foto da capa é capturada e compactada no cliente via `<canvas>` (800x800 JPEG) e enviada para o backend serverless `/api/recognize-cover`. O endpoint consulta o Gemini 1.5 Flash via REST para extrair `{ artista, titulo, ano }`. Na tela `/adicionar`, o resultado preenche os campos e consulta o Discogs. No Catálogo (`/`), o resultado filtra a listagem local com baixa manual opcional.

**Tech Stack:** Next.js (App Router), React 19, Google Gemini 1.5 Flash (REST API), Canvas API, HTML5 MediaDevices.

**Spec:** `docs/superpowers/specs/2026-09-11-reconhecimento-capa-design.md`

## Global Constraints
- Nenhuma dependência externa pesada instalada para o Gemini; usar chamada REST nativa via `fetch`.
- Touch targets mínimos de 44x44px em todos os botões mobile.
- NUNCA realizar baixa automática no Catálogo; a ação deve permanecer estritamente manual pelo lojista.
- Seguir as regras de isolamento de layout sem alterar containers globais.
- Idioma obrigatório: Português do Brasil (pt-BR).

---

### Task 1: Backend Endpoint `/api/recognize-cover`

**Files:**
- Create: `src/app/api/recognize-cover/route.js`
- Test: `scripts/test_recognize_cover.mjs`

**Interfaces:**
- Consumes: `POST /api/recognize-cover` com body `{ image: "data:image/jpeg;base64,..." }` ou `{ image: "<base64_limpo>" }`.
- Produces: JSON `{ success: true, artista: string, titulo: string, ano: string, confianca: string }` ou `{ success: false, error: string }`.

- [ ] **Step 1: Criar script de teste automatizado para o endpoint**

```javascript
// scripts/test_recognize_cover.mjs
import fs from 'fs';

async function testEndpoint() {
  // Teste 1: Validação de ausência de imagem
  const res1 = await fetch('http://localhost:3000/api/recognize-cover', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  const data1 = await res1.json();
  console.assert(res1.status === 400 || data1.success === false, 'Deveria falhar sem imagem');

  console.log('Teste de validação concluído com sucesso!');
}

testEndpoint().catch(console.error);
```

- [ ] **Step 2: Implementar a rota `/api/recognize-cover/route.js`**

Implementar endpoint POST com validação de `GEMINI_API_KEY`, limpeza de prefixo data URL base64, chamada REST direta ao Google Generative Language API (`v1beta/models/gemini-1.5-flash:generateContent`), prompt especialista em catálogo de discos/vinil e resposta formatada em JSON estrito.

- [ ] **Step 3: Testar execução do endpoint**

Executar o script de teste para garantir retorno padronizado e tratamento de erro sem quebra do servidor.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/recognize-cover/route.js scripts/test_recognize_cover.mjs
git commit -m "feat: endpoint /api/recognize-cover com integracao Gemini Flash"
```

---

### Task 2: Componente `CoverScannerModal.js`

**Files:**
- Create: `src/components/CoverScannerModal.js`

**Interfaces:**
- Props:
  - `isOpen: boolean`
  - `onClose: () => void`
  - `onRecognized: ({ artista: string, titulo: string, ano?: string }) => void`
  - `title?: string` (default: "Escanear Capa")

- [ ] **Step 1: Criar o componente `CoverScannerModal.js`**

Desenvolver modal mobile-first com:
- Acesso à câmera via `navigator.mediaDevices.getUserMedia` (com seleção de câmera traseira prioritária).
- Alternador de câmera (quando houver mais de uma).
- Visor com proporção quadrada 1:1 e guia visual translúcida de enquadramento de vinil.
- Botão de captura circular estilo obturador (mínimo 72x72px).
- Botão para carregar foto do rolo/galeria (`<input type="file" accept="image/*">`).
- Função `processarImagem(dataUrl)` que redimensiona em `<canvas>` para 800x800 JPEG (qualidade 0.8), chama `/api/recognize-cover` e exibe estado de loading "Identificando capa...".
- Beep sonoro via Web Audio API e vibração hápica ao identificar com sucesso.
- Exibição de mensagem de erro amigável se a API não conseguir identificar.

- [ ] **Step 2: Verificar comportamento e responsividade**

Garantir conformidade com `mobile-first.md`: `touch-target >= 44px`, `max-height: calc(100vh - 32px)`, sem scroll quebrado ou overflow indesejado.

- [ ] **Step 3: Commit**

```bash
git add src/components/CoverScannerModal.js
git commit -m "feat: componente CoverScannerModal com captura 1:1 e compressao canvas"
```

---

### Task 3: Integração do Reconhecimento no Cadastro (`src/app/adicionar/page.js`)

**Files:**
- Modify: `src/app/adicionar/page.js`

**Interfaces:**
- Consumes: `CoverScannerModal` com callback `handleCoverRecognized({ artista, titulo, ano })`.
- Produces: Preenchimento automático do formulário `form.artista`, `form.titulo`, `form.ano` e acionamento automático de `searchDiscogs()` para exibir lista de prensagens no dropdown.

- [ ] **Step 1: Importar dinamicamente o `CoverScannerModal`**

```javascript
const CoverScannerModal = dynamic(() => import('@/components/CoverScannerModal'), { ssr: false });
```

- [ ] **Step 2: Adicionar estado `isCoverScannerOpen` e botão "Capa" na interface**

Inserir o botão "Capa" com ícone `IoCamera` na seção `discogs-actions-row` ao lado de "Barras" e "OCR".

- [ ] **Step 3: Implementar o handler `handleCoverRecognized`**

Ao receber `{ artista, titulo, ano }`:
1. Atualizar estado do formulário (`setForm(prev => ({ ...prev, artista, titulo, ano }))`).
2. Atualizar `queryDiscogs` com `"${artista} ${titulo}"`.
3. Disparar busca no Discogs para carregar capas e prensagens oficiais no dropdown.
4. Exibir feedback de sucesso: *"Capa identificada: [Artista] - [Título]"*.

- [ ] **Step 4: Commit**

```bash
git add src/app/adicionar/page.js
git commit -m "feat: botao e fluxo de reconhecimento por capa no cadastro de itens"
```

---

### Task 4: Integração do Reconhecimento no Catálogo (`src/app/page.js`)

**Files:**
- Modify: `src/app/page.js`

**Interfaces:**
- Consumes: `CoverScannerModal` com callback `handleCatalogCoverRecognized({ artista, titulo })`.
- Produces: Preenchimento do campo de busca `catalog.setBusca(`${artista} ${titulo}`)` filtrando o catálogo local sem acionar baixa automática.

- [ ] **Step 1: Importar dinamicamente `CoverScannerModal` em `src/app/page.js`**

```javascript
const CoverScannerModal = dynamic(() => import('@/components/CoverScannerModal'), { ssr: false });
```

- [ ] **Step 2: Adicionar botão de câmera na barra de busca do Catálogo**

No container `.searchInputWrapper`, adicionar botão com ícone `IoCamera` (touch target 44x44px) que abre o `CoverScannerModal`.

- [ ] **Step 3: Implementar o callback de busca por capa**

Ao identificar a capa:
1. Fechar o modal.
2. Atualizar o valor de busca do catálogo: `catalog.setBusca(`${artista} ${titulo}`.trim())`.
3. Exibir mensagem suave de feedback: *"Buscando no estoque: [Artista] - [Título]"*.
4. Manter a baixa estritamente opcional (o lojista decide se clica no botão de lixeira/baixa do card).

- [ ] **Step 4: Commit**

```bash
git add src/app/page.js
git commit -m "feat: integracao do scanner de capa na busca do catalogo para baixa manual"
```

---

### Task 5: Validação, Build e Teste de Ponta a Ponta

**Files:**
- All touched files.

- [ ] **Step 1: Executar lint e verificação de tipagem/sintaxe**

```bash
npm run lint
```

- [ ] **Step 2: Executar build de produção**

```bash
npm run build
```

- [ ] **Step 3: Verificar consistência mobile-first e feedback visual**

Validar funcionamento dos botões, responsividade em tela de smartphone e tratamento quando `GEMINI_API_KEY` estiver ausente.

- [ ] **Step 4: Commit final e fechamento**

```bash
git commit --allow-empty -m "chore: verificacao e aprovacao do reconhecimento por capa"
```
