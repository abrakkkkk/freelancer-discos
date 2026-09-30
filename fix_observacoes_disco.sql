-- ========================================================================
-- FREELANCER DISCOS - CORREÇÃO DE OBSERVAÇÕES PARA CDS, DVDS E VHS
-- ========================================================================
-- Motivo: A tabela observacoes_disco foi criada com a coluna disco_id NOT NULL.
-- Ao adicionar observações em CDs, DVDs ou VHS, disco_id fica nulo,
-- violando a restrição NOT NULL (código 23502: "null value in column disco_id").
--
-- Como executar:
-- 1. Acesse o painel do seu projeto no Supabase (https://supabase.com/dashboard)
-- 2. No menu lateral esquerdo, clique em "SQL Editor"
-- 3. Cole o script abaixo e clique no botão verde "Run"
-- ========================================================================

-- 1. Permite que disco_id seja nulo (permitindo observações de CDs, DVDs e VHS)
ALTER TABLE public.observacoes_disco ALTER COLUMN disco_id DROP NOT NULL;

-- 2. Cria índices de performance para buscas rápidas em cada categoria
CREATE INDEX IF NOT EXISTS idx_obs_disco_disco_id ON public.observacoes_disco (disco_id);
CREATE INDEX IF NOT EXISTS idx_obs_disco_cd_id ON public.observacoes_disco (cd_id);
CREATE INDEX IF NOT EXISTS idx_obs_disco_dvd_id ON public.observacoes_disco (dvd_id);
CREATE INDEX IF NOT EXISTS idx_obs_disco_vhs_id ON public.observacoes_disco (vhs_id);
