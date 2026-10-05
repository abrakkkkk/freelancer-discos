# Correção Resiliente do Reconhecimento em Lote por Fotos

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminar falhas e bloqueios por cota no reconhecimento de 50+ fotos em lote, garantindo recuperação automática com múltiplas chaves/modelos e interface com reprocessamento individual e em massa.

**Architecture:** 
1. Backend `/api/recognize-cover`: rotação round-robin de chaves (primária + secundária), múltiplos modelos ordenados por velocidade (`gemini-3.5-flash-lite`, `gemini-flash-lite-latest`, `gemini-3.6-flash`, `gemini-3.5-flash`, `gemini-3.8-flash`), timeout ampliado para 12s e continuidade de fallback mesmo sob 429.
2. Frontend `/cadastro-lote-fotos`: pacing adaptativo inteligente (aumenta espera caso detecte rate limit), retentativa exponencial com jitter (até 3 tentativas com 2.5s e 5s), status visual no card com botão "Reconhecer" individual e botão "Tentar vazios" no topo.

**Tech Stack:** Next.js (App Router), Google Gemini Generative Language API, React Icons.

---

### Task 1: Rotação de Chaves, Modelos e Timeout em `/api/recognize-cover`
**Files:**
- Modify: `src/app/api/recognize-cover/route.js`

- [ ] **Step 1: Atualizar lista de modelos e tempo limite**
- [ ] **Step 2: Implementar rotação round-robin de chaves e fallback entre modelos sem interrupção abrupta no 429**
- [ ] **Step 3: Testar execução da rota localmente**

### Task 2: Pacing Adaptativo e Retentativas com Backoff no Cliente
**Files:**
- Modify: `src/app/cadastro-lote-fotos/page.js`

- [ ] **Step 1: Ajustar pacing inteligente e retentativas com backoff (2.5s / 5s) ao encontrar 429 ou 502**
- [ ] **Step 2: Adicionar botão de re-tentativa individual em cada card não reconhecido**
- [ ] **Step 3: Adicionar botão de reprocessar itens vazios no topo da tela**

### Task 3: Verificação, Build e Deploy Contínuo
**Files:**
- Verify: `npm run build`
- Deploy: Commit e push direto para `main`

- [ ] **Step 1: Rodar build do Next.js e certificar ausência de erros**
- [ ] **Step 2: Commit e push para branch main**
