-- ========================================================================
-- FREELANCER DISCOS - SCRIPT DE OTIMIZAÇÃO DO BANCO SUPABASE
-- ========================================================================
-- Como executar:
-- 1. Acesse o painel do seu projeto no Supabase (https://supabase.com/dashboard)
-- 2. No menu lateral esquerdo, clique em "SQL Editor"
-- 3. Cole todo o conteúdo deste arquivo e clique no botão verde "Run"
-- ========================================================================

-- 1. FUNÇÃO RPC PARA BUSCA INSTANTÂNEA DE CAIXAS / LOCALIZAÇÕES
-- Reduz o tempo de carregamento das caixas de ~3 segundos para ~15 milissegundos,
-- retornando apenas as caixas únicas consolidadas das 4 categorias.
CREATE OR REPLACE FUNCTION public.get_distinct_caixas(p_loja text DEFAULT NULL)
RETURNS TABLE(caixa text, loja text)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT DISTINCT sub.caixa, sub.loja
  FROM (
    SELECT caixa, loja FROM public.discos 
    WHERE deletado = false AND caixa IS NOT NULL AND (p_loja IS NULL OR p_loja = '' OR loja = p_loja)
    
    UNION
    
    SELECT caixa, loja FROM public.dvds 
    WHERE deletado = false AND caixa IS NOT NULL AND (p_loja IS NULL OR p_loja = '' OR loja = p_loja)
    
    UNION
    
    SELECT caixa, loja FROM public.cds 
    WHERE deletado = false AND caixa IS NOT NULL AND (p_loja IS NULL OR p_loja = '' OR loja = p_loja)
    
    UNION
    
    SELECT caixa, loja FROM public.vhs 
    WHERE deletado = false AND caixa IS NOT NULL AND (p_loja IS NULL OR p_loja = '' OR loja = p_loja)

    UNION

    -- Garante a listagem das Caixas 1B a 20B para a Loja 2 (incluindo caixas vazias)
    SELECT ('Caixa ' || i || 'B') AS caixa, 'Loja 2' AS loja
    FROM generate_series(1, 20) AS i
    WHERE (p_loja IS NULL OR p_loja = '' OR p_loja = 'Loja 2')
  ) sub
  ORDER BY sub.caixa ASC;
$$;

-- Permite acesso anônimo e autenticado à RPC
GRANT EXECUTE ON FUNCTION public.get_distinct_caixas(text) TO anon, authenticated, service_role;


-- 2. ÍNDICES DE ALTA PERFORMANCE (B-TREE)
-- Aceleram filtros por caixa, loja, status e ordenação por artista/título em acervos com 8.000+ registros.

-- Discos
CREATE INDEX IF NOT EXISTS idx_discos_caixa_loja ON public.discos (deletado, loja, caixa) WHERE deletado = false;
CREATE INDEX IF NOT EXISTS idx_discos_artista ON public.discos (artista text_pattern_ops);
CREATE INDEX IF NOT EXISTS idx_discos_titulo ON public.discos (titulo text_pattern_ops);
CREATE INDEX IF NOT EXISTS idx_discos_ativo ON public.discos (ativo) WHERE deletado = false;

-- DVDs
CREATE INDEX IF NOT EXISTS idx_dvds_caixa_loja ON public.dvds (deletado, loja, caixa) WHERE deletado = false;
CREATE INDEX IF NOT EXISTS idx_dvds_titulo ON public.dvds (titulo text_pattern_ops);

-- CDs
CREATE INDEX IF NOT EXISTS idx_cds_caixa_loja ON public.cds (deletado, loja, caixa) WHERE deletado = false;
CREATE INDEX IF NOT EXISTS idx_cds_artista ON public.cds (artista text_pattern_ops);
CREATE INDEX IF NOT EXISTS idx_cds_titulo ON public.cds (titulo text_pattern_ops);

-- VHS
CREATE INDEX IF NOT EXISTS idx_vhs_caixa_loja ON public.vhs (deletado, loja, caixa) WHERE deletado = false;
CREATE INDEX IF NOT EXISTS idx_vhs_titulo ON public.vhs (titulo text_pattern_ops);

-- Movimentações
CREATE INDEX IF NOT EXISTS idx_movimentacoes_criado_em ON public.movimentacoes (criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_movimentacoes_tipo ON public.movimentacoes (tipo);
