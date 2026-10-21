# Uso Obrigatório da Skill Impeccable

Para toda e qualquer alteração de interface visual (UI/UX, CSS, componentes visuais, telas, páginas e fluxos):

1. **Ativação Obrigatória**: É obrigatório consultar e seguir a skill `impeccable` em todas as sessões que envolvam frontend ou design.
2. **Contexto de Design**: Antes de planejar ou iniciar alterações visuais, consulte o contexto com `.\.agent\skills\impeccable\scripts\impeccable.cmd context` (ou `npx impeccable context`).
3. **Piso de Qualidade (Craft Floor)**: Consulte e siga as diretrizes de `.agent/skills/impeccable/reference/craft-floor.md` antes de qualquer edição em CSS ou componentes visuais.
4. **Verificação de Anti-Patterns**: Não use gradientes genéricos, cards aninhados desnecessários, tipografia sem hierarquia ou texto cinza sobre fundo colorido.
5. **Detector de Qualidade**: Ao finalizar uma alteração de UI, valide com `.\.agent\skills\impeccable\scripts\impeccable.cmd detect --json <arquivos_alterados>`.
