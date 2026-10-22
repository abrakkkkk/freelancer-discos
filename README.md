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

`npm run lint` executa o ESLint.

## Configuração

Para autenticação, configure `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` e `AUTH_SESSION_SECRET` em `.env.local`. As integrações opcionais usam `DISCOGS_KEY` e `DISCOGS_SECRET`; o OCR pode usar `GEMINI_API_KEY` e as alternativas `GEMINI_API_KEY_BACKUP`, `GEMINI_API_KEY_SECONDARY` ou `GROQ_API_KEY`. Nunca inclua valores de credenciais no Git.

As migrações do banco ficam em `supabase/migrations/` e devem ser aplicadas ao projeto Supabase correspondente.

Antes de publicar esta versão em outro projeto Supabase, aplique `20261022_atomic_stock_operations.sql`. Cadastro, baixa, reposição, alterações em lote, observações e desfazer dependem das funções transacionais criadas por essa migration. No projeto de produção atual, ela foi aplicada pelo SQL Editor em 22/10/2026; a execução manual não aparece no histórico de migrations do painel.

## Estrutura

- `src/app/`: páginas e rotas de API.
- `src/components/`: componentes da interface.
- `src/contexts/`, `src/hooks/`, `src/services/` e `src/lib/`: estado e lógica compartilhada.
- `public/`: logos, ícones e outros recursos estáticos.
- `supabase/migrations/`: alterações versionadas do banco.
