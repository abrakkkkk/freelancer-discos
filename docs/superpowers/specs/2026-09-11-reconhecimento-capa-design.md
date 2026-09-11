# Especificação Técnica: Reconhecimento de Discos por Capa (Vision AI)

**Data:** 2026-09-11  
**Status:** Proposto (Aguardando Aprovação)  
**Autor:** Antigravity & Freelancer Discos  

---

## 1. Visão Geral e Necessidade de Treinamento

### Precisa de treinamento prévio de capas via upload?
**NÃO. Nenhum treinamento é necessário.**  
O modelo multimodal **Google Gemini 1.5 Flash** opera em regime *zero-shot*: ele já foi pré-treinado em bilhões de imagens públicas da internet (incluindo Discogs, MusicBrainz, Wikipedia, acervos de gravadoras e bancos culturais). Ele reconhece capas clássicas de MPB, Rock, Bossa Nova, etc., mesmo sem texto explícito, e interpreta fontes psicodélicas ou caligrafias artísticas instantaneamente.

---

## 2. Arquitetura do Sistema

```
[ Usuário: Câmera Mobile / Upload ]
               │
               ▼
   [ Canvas Client-Side ] ──(Resize: 800x800 JPEG, ~100KB)
               │
               ▼
   [ POST /api/recognize-cover ]
               │
               ▼
   [ Google Gemini 1.5 Flash API ]
               │
               ▼
   [ Resposta JSON Estruturada ]
   {
     "artista": "Secos & Molhados",
     "titulo": "Secos & Molhados",
     "ano": "1973",
     "confianca": "alta"
   }
         ┌─────┴────────────────────────┐
         ▼                              ▼
 [ Fluxo: /adicionar ]         [ Fluxo: / (Catálogo) ]
  - Preenche form               - Preenche campo busca: "Secos & Molhados"
  - Dispara /api/discogs?q=...  - Filtra tabela local instantaneamente
  - Abre dropdown de prensagens - Baixa é OPCIONAL pelo botão existente
```

---

## 3. Backend: Endpoint `/api/recognize-cover`

- **Método:** `POST`
- **Payload de Entrada:**
  ```json
  {
    "image": "data:image/jpeg;base64,..."
  }
  ```
- **Processamento:**
  - Valida presença de `process.env.GEMINI_API_KEY`.
  - Executa chamada direta HTTP ao endpoint Gemini REST (`v1beta/models/gemini-1.5-flash:generateContent`) sem dependências pesadas.
  - Prompt com diretivas rigorosas para catálogo fonográfico (extração de Artista e Álbum normalizados, remoção de ruídos de encarte).
  - Configuração `response_mime_type: "application/json"`.
- **Payload de Saída (Sucesso - 200):**
  ```json
  {
    "success": true,
    "artista": "Chico Buarque",
    "titulo": "Construção",
    "ano": "1971",
    "confianca": "alta"
  }
  ```
- **Payload de Saída (Não Identificado / Erro - 200/400):**
  ```json
  {
    "success": false,
    "error": "Não foi possível identificar a capa com clareza."
  }
  ```

---

## 4. Frontend: Componente `CoverScannerModal.js`

- **Local:** `src/components/CoverScannerModal.js`
- **Diretrizes Mobile-First:**
  - Touch targets mínimos de 44x44px em todos os controles.
  - Visor de câmera com proporção quadrada 1:1 e guia de enquadramento translúcida.
  - Alternador de câmera (traseira/frontal) e acionador de lanterna (se suportado pelo hardware).
  - Botão secundário para envio de imagem da galeria (`<input type="file" accept="image/*">`).
  - Compressão rápida via `<canvas>` para JPEG 800px antes do envio HTTP.
  - Feedback sonoro suave (`playBeep`) e vibração hápica ao concluir.

---

## 5. Fluxos de Interface

### Fluxo A: Cadastro de Novo Disco (`src/app/adicionar/page.js`)
1. Usuário clica no novo botão **"Capa"** na seção "Identificação da Obra" (ao lado de "Barras" e "OCR").
2. Abre `CoverScannerModal`.
3. Usuário fotografa a capa.
4. O modal exibe spinner com mensagem *"Identificando capa..."*.
5. Ao retornar:
   - Preenche os campos `artista` e `titulo` do formulário.
   - Preenche o campo `queryDiscogs` com `"{artista} {titulo}"`.
   - Dispara automaticamente `searchDiscogs()` para listar as prensagens no dropdown.
   - Fecha o modal.

### Fluxo B: Busca no Catálogo e Baixa Opcional (`src/app/page.js`)
1. No campo de busca do catálogo, adiciona-se o botão de câmera com ícone `IoCamera` (touch target 44px).
2. Abre o `CoverScannerModal`.
3. Usuário fotografa a capa do disco que está no balcão.
4. Ao reconhecer:
   - Preenche `catalog.busca` com `"{artista} {titulo}"`.
   - Fecha o modal e foca na tabela.
   - A tabela filtra e exibe os itens correspondentes encontrados no estoque.
   - **Regra de Baixa:** **NÃO realiza baixa automática.** O lojista visualiza os cards encontrados e decide livremente se clica no botão de lixeira/baixa (`solicitarExclusao`), mantendo total controle do estoque e confirmação com `ConfirmModal`.

---

## 6. Tratamento de Erros e Limites

- Se a foto estiver muito borrada ou escura: exibe mensagem no modal *"Não foi possível identificar. Tente enquadrar com melhor iluminação ou use o código OCR da lombada."*.
- Fallback manual: o lojista sempre pode digitar manualmente sem travar a interface.
- Se a variável `GEMINI_API_KEY` não estiver definida no ambiente: informa erro amigável na API sem quebrar a aplicação.
