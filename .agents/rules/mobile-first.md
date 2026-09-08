# Diretriz de Desenvolvimento: Mobile-First Obrigatório

> **REGRA FUNDAMENTAL DO PROJETO:**
> Este sistema é operado prioritariamente em dispositivos móveis (smartphones e tablets) no balcão e no estoque físico das lojas.
> **Toda e qualquer alteração, tela, modal ou componente DEVE ser planejado, desenhado e otimizado PRIMEIRO para celulares (Mobile-First).**

---

## Princípios Obrigatórios de UI/UX Mobile

1. **Áreas de Toque (Touch Targets):**
   - Todos os botões, ícones clicáveis e links devem ter área de toque mínima de **44x44px** (padrão iOS HIG e Android Material).
   - Espaçamento adequado entre botões adjacentes para evitar toques acidentais.

2. **Modais e Diálogos:**
   - Devem ocupar até `100%` da largura útil em telas pequenas (com margens laterais seguras de 12px a 16px).
   - Devem conter `max-height: calc(100vh - 32px)` e rolagem vertical suave (`overflow-y: auto`) para nunca quebrar em telas menores, rotação horizontal ou quando o teclado virtual estiver aberto.
   - Botões de confirmação/cancelamento grandes e de fácil alcance para os polegares.

3. **Formulários e Teclado Virtual:**
   - Campos de texto (`input`, `select`, `textarea`) devem ter `font-size: 16px` em mobile para evitar o zoom automático indesejado no Safari/iOS.
   - Tipos de input adequados (`inputmode="numeric"` para preços, códigos e quantidades) para acionar o teclado correto.

4. **Safe Area & Barra de Navegação Inferior (`BottomNav`):**
   - Respeitar sempre a área segura de aparelhos modernos (`env(safe-area-inset-bottom)`).
   - O conteúdo das páginas deve ter padding inferior suficiente (`padding-bottom: calc(var(--bottom-nav-height) + 24px)`) para que nenhum botão fique oculto atrás da `BottomNav`.

5. **Interações sem Dependência de Hover:**
   - Não depender de `:hover` para revelar informações críticas ou botões de ação (celulares usam toque).

6. **Performance e Conexões Móveis:**
   - Evitar transferências pesadas de dados pela rede móvel (3G/4G/5G).
   - Usar cache em memória e `sessionStorage` para navegação instantânea.
