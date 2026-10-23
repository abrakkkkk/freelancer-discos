# Freelancer Discos — Controle de Estoque

Aplicação web interna para gerenciar o catálogo de discos e mídias da Freelancer Discos. O sistema usa Next.js, React e Supabase; as rotas privadas exigem autenticação.

## Desenvolvimento local

Requisitos: Node.js e npm.

```bash
npm install
npm run dev
```

Abra `http://localhost:3000`. Para validar a versão de produção localmente:

```bash
npm run build
npm run start
```

`npm run lint` executa o ESLint e `npm test` roda os testes unitários e SQL. Os testes SQL usam PostgreSQL descartável em memória via PGlite e não acessam o projeto de produção.

## Configuração

Para autenticação, configure `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` e `AUTH_SESSION_SECRET` em `.env.local`. As integrações opcionais usam `DISCOGS_KEY` e `DISCOGS_SECRET`; o OCR pode usar `GEMINI_API_KEY` e as alternativas `GEMINI_API_KEY_BACKUP`, `GEMINI_API_KEY_SECONDARY` ou `GROQ_API_KEY`. Nunca inclua valores de credenciais no Git.

As migrações do banco ficam em `supabase/migrations/` e devem ser aplicadas ao projeto Supabase correspondente.

Antes de publicar esta versão em outro projeto Supabase, aplique, em ordem, `20261022_atomic_stock_operations.sql`, `20261022_fix_dynamic_exec_row_checks.sql` e `20261022_fix_stock_write_counts.sql`. As funções transacionais cobrem cadastro, baixa, reposição, alterações em lote, observações e desfazer; as duas últimas migrations corrigem a validação de linhas afetadas e preservam a contagem de operações. No projeto de produção atual, as duas primeiras correções já estavam aplicadas. `20261022_fix_stock_write_counts.sql` foi aplicada pelo SQL Editor em 22/10/2026; execuções manuais não aparecem no histórico de migrations do painel.

## Estrutura

- `src/app/`: páginas e rotas de API.
- `src/components/`: componentes da interface.
- `src/contexts/`, `src/hooks/`, `src/services/` e `src/lib/`: estado e lógica compartilhada.
- `public/`: logos, ícones e outros recursos estáticos.
- `supabase/migrations/`: alterações versionadas do banco.
