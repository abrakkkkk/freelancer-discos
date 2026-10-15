# Especificação de Design — Vitrine de Visitantes (Freelancer Discos)

- **Data:** 2026-10-15
- **Status:** Aprovado em brainstorming (aguardando revisão da spec)
- **Destino:** `c:\Users\FREE LANCER\Documents\freelancer-discos-vitrine` (junction `vitrine/` no workspace principal)
- **Repo:** `abrakkkkk/freelancer-discos-vitrine` · **Deploy:** projeto Vercel próprio

---

## 1. Propósito

Versão pública, somente leitura, do catálogo da loja para clientes consultarem produtos, lojas e caixas — no celular, dentro da loja ou de casa — e montarem uma sacola fechada via WhatsApp. Nenhuma operação de escrita no banco.

## 2. Escopo

**Entra:**
- Abas Discos / CDs / DVDs / VHS
- Busca por texto (artista/título, insensível a acentos)
- Filtros por Loja e Caixa; ordenação por preço e artista; paginação
- Navegação Loja → grade de Caixas → itens da caixa
- Sacola com fechamento no WhatsApp

**Não entra:** edição, exclusão, baixa, exportação, scanner de capa/código, movimentações, reposição, itens Inativos, chamadas ao Discogs/Gemini.

## 3. Arquitetura

1. **Repositório independente**, sem import de código do admin. Componentes reaproveitados são **copiados** e reduzidos para leitura.
2. **Stack:** Next.js 16.3, React 19.2, `react-icons`, CSS vanilla. Antes de codar, ler `node_modules/next/dist/docs/` (versão com breaking changes).
3. **Dados exclusivamente no servidor** (Server Components / Route Handlers) via `@supabase/supabase-js` com `SUPABASE_SECRET_KEY`.
   - Proibido qualquer env `NEXT_PUBLIC_SUPABASE_*`.
   - Módulo do cliente Supabase marcado `server-only`.
4. **Consulta padrão** (toda leitura):
   - `.eq('deletado', false).eq('ativo', true)`
   - Colunas permitidas: `id, titulo, preco, loja, caixa, ano, capa_url, observacao`; `artista` só em `discos` e `cds` (DVD/VHS não têm a coluna).
   - Prensagem/estado vêm do campo `observacao`. A tabela `observacoes_disco` **não** é lida (notas internas).
   - Ordenação por artista só aparece em Discos/CDs; em DVD/VHS a opção vira título.
   - Busca com `removeAcentos` + curingas `_` em vogais (mesma regra do admin).
5. **Cache:** respostas de catálogo com revalidação de ~60 s (mecanismo conforme docs do Next 16).
6. **Capas:** usar `capa_url`; ausência → ícone de vinil/disco (`react-icons/pi`). Sem fetch externo.
7. **Caixas:** Loja 1 exibe `Caixa N`; Loja 2 sempre lista `Caixa 1B`…`Caixa 20B`, mesmo vazias (contagem 0).

## 4. Rotas e Telas (mobile-first)

| Rota | Conteúdo |
|---|---|
| `/` | Catálogo: abas, busca, filtros Loja/Caixa, ordenação, paginação |
| `/lojas` | 2 cards: Loja 1 e Loja 2 com total de itens |
| `/lojas/[loja]` | Grade de caixas com contagem |
| `/lojas/[loja]/[caixa]` | Itens da caixa (mesmo card do catálogo) |
| `POST /api/sacola/validar` | Recebe ids por categoria, devolve quais seguem disponíveis |

**Componentes:**
- **Card de produto:** capa 1:1, artista, título, preço (R$), selo `Loja · Caixa`, botão "Adicionar à sacola" (≥ 44×44 px).
- **Folha de detalhe:** bottom sheet ao tocar no card com `observacao`, ano e botão de sacola. `max-height: calc(100vh - 32px)`, rolagem interna.
- **BottomNav:** Catálogo · Lojas · Sacola (badge numérico). Safe area inferior respeitada; conteúdo com `padding-bottom: calc(var(--bottom-nav-height) + 24px)`.
- **Sacola:** `localStorage`, máx. 1 unidade por item, total, campos opcionais Nome e Bairro (inputs 16 px), CTA "Finalizar no WhatsApp" → `https://wa.me/5585987879214?text=...`.

**Mensagem do WhatsApp:**
```text
Olá, Freelancer Discos! Tenho interesse nestes itens:
• Artista - Título (Loja 1 · Caixa 5) - R$ 120,00
• Artista - Título (Loja 2 · Caixa 3B) - R$ 80,00

Total: R$ 200,00
Nome: [nome]
Bairro: [bairro]
```
Linhas de Nome/Bairro omitidas se vazias.

## 5. Design Visual

1. **Fiel ao admin:** copiar tokens de `src/app/globals.css` do admin: `--bg #09090b`, `--bg-card #151518`, `--bg-card-alt #121215`, `--border #232328`, `--text #e4e4e7`, `--text-muted #a1a1aa`, `--accent #8b1e1e`, `--accent-hover #731717`, `--nav-bg #111114`, raios 8/10/14 px. Fontes Outfit (títulos) e Figtree (corpo).
2. **SEM glassmorphism e SEM translucidez:**
   - Proibido `backdrop-filter` e qualquer `background` com alfa < 1 (rgba/hsla/opacity em superfícies).
   - Cards, BottomNav, header, sacola e folha de detalhe: cores sólidas.
   - Overlay de modal/folha: **`#050506` sólido e opaco** cobrindo o conteúdo; a folha aparece sobre ele.
   - Bordas: tokens sólidos (`--border`), não rgba.
   - `box-shadow` com rgba é permitido (sombra não é superfície).
3. **Sem emojis**; ícones `react-icons` (`Fi`, `Md`, `Pi`, `Tb`).
4. Títulos: desktop 26–28 px / peso 700; mobile 22–23 px; `letter-spacing: -0.025em`.
5. Micro-animações só de transform/cor (entrada da folha, feedback ao adicionar), sem efeitos translúcidos.

## 6. Erros e Estados

1. **Item indisponível no checkout:** antes de abrir o WhatsApp, chamar `/api/sacola/validar`; remover indisponíveis e avisar "X não está mais disponível" (auto-dismiss 5 s). Se todos saírem, não abre o WhatsApp.
2. **Busca vazia / caixa vazia:** mensagem com orientação (limpar filtros, ver outras caixas).
3. **Falha do Supabase:** "Catálogo indisponível, tente em instantes" + botão Recarregar.
4. Troca de aba/filtro reseta paginação para 1 e limpa mensagens residuais.

## 7. Deploy

1. Repo GitHub novo + projeto Vercel novo apontando para `main`.
2. Envs (somente servidor): `SUPABASE_URL`, `SUPABASE_SECRET_KEY`.
3. Push em `main` → deploy automático.

## 8. Critérios de Aceite e Verificação

1. `npm run build` e `npm run lint` sem erros.
2. Varredura em `.next/static` não encontra a chave secreta nem a anon key.
3. Nenhuma rota/handler executa `insert`, `update` ou `delete`.
4. Busca de CSS por `backdrop-filter` e fundos com alfa retorna zero ocorrências em superfícies.
5. Browser subagent em 375 px e 1440 px: catálogo → Lojas → Caixa → detalhe → sacola → link WhatsApp com texto correto.

## 9. Fora de Escopo (tarefa separada)

Risco existente no admin: `_next/static` fica fora do Basic Auth em `src/proxy.js` e a anon key está no bundle, sem RLS versionada no repo. Tratar em spec própria.
