# Especificação de Design — Site Institucional e Vitrine de Discos Novos (Freelancer Discos)

- **Data:** 2026-09-24
- **Autor:** Freelancer Discos & Pair Programming Agent
- **Status:** Aprovado para Implementação
- **Destino da Pasta:** `c:\Users\FREE LANCER\Documents\freelancer-discos-site`

---

## 1. Visão Geral e Propósito

Criar um site estático e independente para a **Freelancer Discos**, com identidade visual editorial sofisticada inspirada no mockup (`Freelancer Discos — Mockup Desktop (Editorial).html`). O site possui dois objetivos centrais:
1. **Institucional:** Apresentar a história, curadoria, identidade e autoridade fonográfica da Freelancer Discos (seções Início e Quem Somos com animações estéticas).
2. **Comercial / E-commerce Conversacional:** Exibir e vender os discos novos das **Caixas 50 e 51** (atualmente 183 itens cadastrados no Supabase), permitindo busca instantânea, filtros e checkout direto via **Sacola de Compras com fechamento no WhatsApp**.

---

## 2. Decisões de Arquitetura

1. **Localização:** Criado em pasta independente em `c:\Users\FREE LANCER\Documents\freelancer-discos-site`, completamente desacoplado da base de código do sistema operacional de estoque.
2. **Stack Tecnológica:**
   - **HTML5 Semântico:** Estrutura limpa, acessível e otimizada para SEO.
   - **CSS3 Vanilla com Tokens de Design:** Arquitetura de 3 camadas (primitivos, semânticos, componentes), paleta dark wine/vintage (#0a0a0a, #c0392b, #7b1a1a, #fff, #aaa).
   - **Tipografia:** Google Fonts (*Playfair Display*, *Bebas Neue*, *Inter*).
   - **JavaScript Vanilla (ES6+):** Zero dependências externas de runtime; carrega em menos de 1 segundo.
   - **Fonte de Dados:** Arquivo `data/discos.json` contendo os 183 discos ativos das Caixas 50 e 51, exportados via script Node.js direto do Supabase com integração de capas do Discogs.

---

## 3. Estrutura de Arquivos

```text
c:\Users\FREE LANCER\Documents\freelancer-discos-site/
├── index.html               # Página única editorial com todas as seções e modais
├── css/
│   ├── tokens.css           # Variáveis CSS (cores, tipografia, espaçamentos, sombras)
│   └── style.css            # Estilos da página, layout responsivo e animações
├── js/
│   ├── config.js            # Configurações da loja (telefone WhatsApp, Instagram, e-mail)
│   └── app.js               # Carregamento do catálogo, busca, filtros e sacola
├── data/
│   └── discos.json          # 183 discos das Caixas 50 e 51 com metadados e capas
└── scripts/
    └── export-caixas.js     # Script Node.js para re-exportar os dados do Supabase
```

---

## 4. Design System & Diretrizes Visuais

### 4.1. Tokens de Cores
- `--bg: #0a0a0a` (Fundo primário escuro vinil)
- `--bg-surface: #121212` (Cards e superfícies elevadas)
- `--red: #c0392b` (Acento principal / selo)
- `--red-dark: #7b1a1a` (Hover e detalhes de profundidade)
- `--white: #ffffff` (Títulos e textos de alto contraste)
- `--gray: #aaaaaa` (Textos de apoio e metadados)
- `--line: #2b2b2b` (Bordas e divisores editoriais duplos)

### 4.2. Tipografia
- `--font-serif: 'Playfair Display', Georgia, serif` (Títulos principais, citações e nomes de álbuns)
- `--font-head: 'Bebas Neue', Impact, sans-serif` (Numerações, badges, cabeçalhos de seção e botões)
- `--font-body: 'Inter', system-ui, sans-serif` (Textos corridos, inputs e controles da sacola)

### 4.3. Regras Mobile-First
- Todos os botões e áreas de toque com no mínimo `44x44px`.
- Campos de busca e inputs com `font-size: 16px` para prevenir zoom automático no Safari/iOS.
- Suporte a Safe Areas do iOS (`env(safe-area-inset-top)` e `env(safe-area-inset-bottom)`).
- Grid fluido:
  - Mobile (< 640px): 1 coluna confortável com cards expandidos.
  - Tablet (640px - 1024px): 2 colunas.
  - Desktop (> 1024px): 4 colunas clássicas.

---

## 5. Seções da Página

### 5.1. Topbar & Header
- **Edição & Localização:** Meta bar com `Edição Nº 51 · Vinil · Novidades · São Paulo, Brasil`.
- **Navegação:** Links ancorados (`#inicio`, `#sobre`, `#catalogo`, `#contato`) e logotipo institucional Freelancer Discos.
- **Botão da Sacola:** Indicador com badge numérico em tempo real (ex: `Sacola (3)`).

### 5.2. Hero Section ("Cada Disco, Uma História")
- Headline editorial com ênfase visual em itálico.
- Selo de categoria `CAPA · A SELEÇÃO DA SEMANA`.
- Disco de vinil interativo construído com CSS radial e conic gradients (com rotação suave e efeito de reflexo sonoro).
- Botão de ação rápida direcionando para o catálogo.

### 5.3. Seção "Quem Somos" (Sobre Nós)
- Perfil institucional da loja focado na cultura do vinil.
- Citação editorial em destaque (*"Cada disco carrega uma história, e a nossa é encontrar o próximo dono dela."*).
- **Estante Generativa:** Componente dinâmico em JavaScript que renderiza lombadas de discos coloridas com variações sutis de altura e tons retrô, fiel ao mockup.

### 5.4. Catálogo das Novidades (Caixas 50 e 51)
- **Barra de Controle:**
  - Campo de busca instantânea (pesquisa por nome do artista ou título do álbum, insensível a acentos).
  - Pílulas de filtro: `Todos os Discos`, `Caixa 50`, `Caixa 51`.
  - Contador de itens encontrados (ex: `183 discos disponíveis`).
- **Cards de Produto:**
  - Capa do álbum quadrada (proporção 1:1) com fallback dinâmico de selo de vinil para itens sem imagem externa.
  - Badge `NOVO` e identificação da Caixa (`Caixa 50` ou `Caixa 51`).
  - Nome do artista (uppercase) e título do álbum (serif itálico).
  - Preço formatado em Reais (`R$ 250,00`).
  - Botão de toque: `Adicionar à Sacola` (com feedback de clique instantâneo).

### 5.5. Drawer / Modal da Sacola de Compras
- Painel deslizante lateral (desktop) ou bottom-sheet (mobile).
- Lista com os vinis adicionados, botão de remover individual e controle de quantidade (máximo 1 para itens de estoque único).
- Cálculo automático do valor total do pedido.
- Campo opcional: Nome do cliente e Cidade/Bairro (para cálculo prévio de frete).
- Botão de CTA: **"Finalizar Pedido no WhatsApp"** que monta a URL `https://wa.me/55...` com a mensagem pré-formatada:
  ```text
  Olá, Freelancer Discos! Gostaria de comprar os seguintes discos da loja:
  • Sam Smith - In The Lonely Hour (Caixa 50) - R$ 220,00
  • Taylor Swift - The life of a showgirl (Caixa 50) - R$ 395,00

  Total: R$ 615,00
  Nome: [Nome do Cliente]
  Local: [Cidade/Bairro]
  ```

### 5.6. Rodapé (Footer)
- Logotipo, dados de contato, redes sociais (@freelancerdiscos), link direto para WhatsApp e links de navegação.

---

## 6. Fluxo de Dados e Exportação (`export-caixas.js`)

1. O script de exportação lê as credenciais do Supabase de `.env.local` do projeto principal.
2. Faz query na tabela `discos`:
   ```sql
   SELECT id, artista, titulo, preco, caixa, ano, observacao 
   FROM discos 
   WHERE caixa IN ('50', '51') AND deletado = false 
   ORDER BY artista ASC;
   ```
3. Cruza os discos com as capas já armazenadas em cache ou executa resolução rápida de capas do Discogs.
4. Salva o resultado minificado e formatado em `data/discos.json` dentro da pasta do novo site.

---

## 7. Critérios de Aceite e Verificação

1. **Isolamento Completo:** A pasta `c:\Users\FREE LANCER\Documents\freelancer-discos-site` é autônoma e executável independentemente.
2. **Visual Fiel:** A tipografia, cores, espaçamentos e efeitos visuais do vinil reproduzem a estética do arquivo de mockup.
3. **Mobile-First Testado:** Layout verificado em 375px e 1440px via browser subagent.
4. **Catálogo Funcional:** Todos os 183 discos carregam com busca rápida e filtros por caixa funcionais.
5. **Sacola Reativa:** Adição, remoção, persistência no `localStorage` e link do WhatsApp gerado perfeitamente.
