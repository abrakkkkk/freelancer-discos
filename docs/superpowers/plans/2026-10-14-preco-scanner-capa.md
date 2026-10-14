# Extração de Preço em Etiqueta Manuscrita no Scanner de Capas - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que o scanner de capas identifique o preço escrito à mão em etiqueta adesiva branca sobre a capa/plástico do disco/CD e preencha automaticamente o campo de preço nos formulários quando identificado; caso não identifique, não preencher o preço.

**Architecture:** Modificação no prompt do Gemini Vision em `/api/recognize-cover` com regras estritas para detecção de etiqueta branca manuscrita, sanitização do valor numérico em reais na API, propagação do campo `preco` pelo `CoverScannerModal` e preenchimento condicional nos formulários (`/adicionar`, `/editar`, `/cadastro-lote-fotos`).

**Tech Stack:** Next.js 16 App Router, Gemini Vision API (Google Generative AI REST API), React 19.

## Global Constraints
- Em 100% das respostas seguir `.agents/rules/i-have-adhd.md` (respostas diretas, sem preâmbulo, pt-BR, max 5 itens por lista).
- Se o preço não for identificado ou for incerto, `preco` deve ser vazio `""` e nenhum valor deve ser preenchido no input de preço.
- Manter fidelidade visual da imagem e não quebrar validações existentes.

---

### Task 1: Atualizar Prompt e Tratamento na Rota `/api/recognize-cover`

**Files:**
- Modify: `src/app/api/recognize-cover/route.js`

- [ ] **Step 1: Modificar `systemPrompt` para instruir a detecção da etiqueta branca com preço à mão**
- [ ] **Step 2: Adicionar extração por regex no fallback para o campo `preco`**
- [ ] **Step 3: Implementar função de sanitização `extrairPrecoValido`**
- [ ] **Step 4: Incluir `preco` no payload de sucesso retornado**

---

### Task 2: Atualizar `CoverScannerModal` e Repasse do Preço

**Files:**
- Modify: `src/components/CoverScannerModal.js`

- [ ] **Step 1: Repassar `preco: data.preco || ''` em `handleRecognizedCallback`**

---

### Task 3: Atualizar Formulários de Cadastro e Edição

**Files:**
- Modify: `src/hooks/useItemForm.js`
- Modify: `src/app/adicionar/page.js`
- Modify: `src/app/editar/page.js`
- Modify: `src/app/cadastro-lote-fotos/page.js`

- [ ] **Step 1: Exportar `formatarPreco` em `src/hooks/useItemForm.js`**
- [ ] **Step 2: Preencher `preco` condicionalmente em `handleCoverRecognized` de `src/app/adicionar/page.js`**
- [ ] **Step 3: Preencher `preco` condicionalmente em `handleCoverRecognized` de `src/app/editar/page.js`**
- [ ] **Step 4: Suportar `dadosGemini?.preco` em `src/app/cadastro-lote-fotos/page.js`**

---

### Task 4: Verificação e Deploy Contínuo

- [ ] **Step 1: Executar `npm run build` para garantir ausência de erros**
- [ ] **Step 2: Commitar as alterações e dar push na branch `main`**
