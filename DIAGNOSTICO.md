# Diagnóstico do Lotifly — 14/10/2026

Diagnóstico completo da interface, sem alteração de código. Três fontes, juntas num relatório só:

1. **Prints de todas as telas** no iPhone e no computador. Foram 46 telas e 91 prints, abertos pelo Playwright. Em cada abertura rodaram também uma checagem automática de acessibilidade (axe-core 4), a medida dos alvos de toque e a procura de rolagem lateral.
2. **Auditoria técnica `/impeccable audit`**: acessibilidade, desempenho, cores e estilos, celular e consistência do código, com o detector automático da Impeccable.
3. **Revisão pelas diretrizes de interface** (Web Interface Guidelines da Vercel, versão baixada hoje) de todos os arquivos de tela: `index.html`, `style.css` e os 19 arquivos `.js` que desenham telas.

**Como foi testado:**
- **Celular:** iPhone 13 simulado, com tela de 390 × 844 pontos.
- **Computador:** tela de 1440 × 900.
- **Dados:** os dados de exemplo, no modo "só neste navegador".
- **Limite:** nada foi testado num iPhone de verdade. Onde isso faz diferença, o texto avisa.

Os prints estão na pasta [`diagnostico/`](diagnostico/), e a galeria completa está no fim deste arquivo.

---

## Resumo

| Prioridade | Quantos | O que significa |
|---|---|---|
| 🔴 **Crítico** | 2 | Trava o uso ou vai travar com o crescimento da carteira |
| 🟠 **Importante** | 9 | Atrapalha o trabalho de alguém todo dia, ou descumpre norma de acessibilidade (WCAG AA) |
| 🟡 **Detalhe** | 11 | Acabamento: vale corrigir quando passar por perto |

**Os cinco que mais pesam:**

1. **O app fica lento com uma carteira grande.**
   - Com 30 mil parcelas, o Início leva 7,5 segundos para abrir no celular, e "Total a receber" leva 14 segundos.
   - Um loteamento de 300 lotes em 120 parcelas já passa de 36 mil parcelas.
2. **No iPhone, com o app instalado na tela inicial, o cabeçalho fica embaixo do relógio e da bateria.** Não existe proteção para o entalhe da tela.
3. **Botões importantes com pouco contraste.**
   - O "Compartilhar" verde do WhatsApp e o botão laranja ficam com metade do contraste mínimo.
   - O corretor usa esses botões na rua, no sol.
4. **No celular, a aba Parcelas do contrato esconde o botão de registrar pagamento.** Ele fica fora da tela, e nada mostra que dá para arrastar a tabela para o lado.
5. **Os gráficos do Início não mostram valores.** Dá para ver o desenho das barras, mas não dá para conferir os números. Isso vai contra o princípio 1 do PRODUCT.md: número financeiro claro e conferível.

**O que está bom:**
- Nenhuma tela tem rolagem lateral no iPhone (as 46 foram verificadas).
- Não houve nenhum erro de JavaScript nas 91 aberturas.
- A ficha do lote do corretor está clara.
- No celular, as janelas abrem de baixo para cima, com botões grandes.

Os detalhes estão em [O que está bom](#o-que-está-bom).

---

## 🔴 Críticos

### C1. O app fica lento quando a carteira cresce

**O que acontece.** Medi o tempo de desenhar as telas com parcelas a mais, num iPhone simulado com o processador 4 vezes mais lento, para chegar perto de um celular médio. Os tempos contam só o cálculo e a montagem da tela; o tempo real de aparecer é um pouco maior.

| Parcelas na carteira | Abrir o Início | Clicar em "Total a receber" (todas as parcelas em aberto) |
|---|---|---|
| ~2 mil | 0,4 s | 0,9 s (2.160 itens desenhados) |
| ~10 mil | 2,7 s | 3,9 s (10.160 itens) |
| ~30 mil | **7,5 s** | **14,3 s** (30.160 itens) |

Durante esse tempo a tela fica congelada: não rola e não responde ao toque. Um loteamento de 300 lotes vendidos em 120 parcelas tem 36 mil parcelas, e a Cocal, a incorporadora e os futuros clientes do Lotifly vão chegar nesse tamanho.

**Por quê.**
- Cada vez que o app precisa do valor de uma parcela, `recValor` (`indices.js:76`) faz três coisas de novo:
  - procura o contrato da parcela na lista inteira de contratos (`getVenda`, `core.js:695`);
  - recalcula a correção pelo índice;
  - cria a data de hoje de novo (`recStatus` → `todayStr`, `core.js:1234`).
- O Início faz isso várias vezes por parcela: no mês, no atraso, na carteira e nos dois gráficos.
- A lista A receber (`financeiro.js`, `renderRecebiveis`) desenha todas as parcelas de uma vez. "Total a receber" abre em "Todos os meses" justamente na lista mais longa.

**Como corrigir.**
- Calcular uma vez por tela:
  - um índice dos contratos por código;
  - a data de hoje;
  - o valor de cada parcela, guardado durante o desenho.
- Na lista, mostrar as primeiras 100 parcelas com um botão "mostrar mais", ou agrupar a carteira por contrato.
- Medir de novo com 30 mil parcelas. A meta é abrir em menos de 1 segundo.

**Comando sugerido:** `/impeccable optimize`

---

### C2. No iPhone, com o app instalado, o cabeçalho fica embaixo da barra de status

**O que acontece.**
- O app pede para ocupar a tela inteira do iPhone, inclusive a área do relógio e do entalhe (`index.html:5`, `viewport-fit=cover`).
- Ele também pede que a barra de status fique transparente (`index.html:9`, `black-translucent`).
- Mas não há um único `env(safe-area-inset-*)` no CSS. O cabeçalho começa com só 10px de folga (`style.css:75-77`).
- Resultado, quando o corretor instala o app na tela inicial:
  - o nome do empreendimento e os botões **Sair** e **Admin** ficam por baixo do relógio e da bateria;
  - embaixo, os botões das janelas e o botão "＋" ficam colados no traço de voltar do iPhone.

**Grau de certeza.** Verificado no código: essa combinação sempre produz esse resultado. Não foi testado num iPhone de verdade porque o simulador não reproduz o modo instalado. Vale abrir no seu iPhone, pelo ícone da tela inicial, para confirmar.

**Como corrigir.**
- Cabeçalho: somar `env(safe-area-inset-top)` ao espaço de cima.
- Rodapé das janelas e botão "＋": somar `env(safe-area-inset-bottom)` ao espaço de baixo.
- Menu lateral: aplicar as duas folgas também.

**Comando sugerido:** `/impeccable adapt`

---

## 🟠 Importantes

### I1. Botões e textos com contraste abaixo do mínimo

**Números.** A checagem automática achou 219 trechos com contraste insuficiente, em 30 telas. As medidas (o mínimo é 4,5 para texto comum e 3 para texto grande):

| Onde | Contraste | Arquivo |
|---|---|---|
| Botão verde do WhatsApp ("Compartilhar", "Enviar resumo", "Cobrar") | **1,98** | `style.css:242` |
| Selo de categoria amarelo (`#eab308` com texto branco) | **1,92** | cor da categoria, `core.js:164` |
| Botão laranja ("Carregar dados de exemplo") | **2,15** | `style.css:237` |
| Botão verde de confirmar ("Confirmar", "Antecipar / quitar") | 3,30 | `style.css:236` |
| Texto cinza de apoio sobre o fundo cinza da página | 4,34 | `style.css:13` |
| Texto branco sobre o degradê da entrada | 4,1 | `style.css` (`.landing`) |
| Contadores dentro das abas, como "Em aberto **160**" | abaixo de 4,5 | `style.css:201` |

**Por que importa.**
- O corretor usa o celular na rua, no sol. Com contraste 2, um botão de WhatsApp com texto branco vira só uma mancha verde.
- O "Confirmar" do pagamento é a ação mais usada pelo financeiro.

**Como corrigir.** Escurecer os tons dos botões, sem trocar a cor:
- o verde do WhatsApp para algo como `#128c4a`;
- o laranja para `#b45309`;
- o verde de confirmar para `#15803d`;
- o cinza de apoio para `#475569` quando estiver sobre o fundo cinza.

**Comando sugerido:** `/impeccable polish`

<img src="diagnostico/celular-52-corretor-lote.jpg" width="260" alt="Ficha do lote no celular, com o botão Compartilhar do WhatsApp em verde claro"> <img src="diagnostico/celular-22-contrato-parcelas.jpg" width="260" alt="Contrato no celular: botões Antecipar e Enviar resumo em verde claro">

---

### I2. Quase nada funciona pelo teclado, e as janelas não prendem o foco

**Menus e cartões.**
- Itens do menu lateral, abas, cartões das listas, números do Início, alertas e filtros são `<div onclick>`, não botões.
- São 84 lugares no código, e em cada tela aparecem de 15 a 85 desses elementos.
- Não existe nenhum `tabindex` ou `role="button"` no app.
- Teste real: no Início, a tecla Tab só passa por 3 elementos (👁️, Sair e "Ver em tabela") e volta para o começo. O menu inteiro fica inacessível.

**Janelas (`core.js:112`, `openModal`).**
- Faltam `role="dialog"` e `aria-modal`.
- O foco inicial fica no fundo da página.
- Em 25 apertos de Tab, o foco saiu da janela 6 vezes, para trás dela.

**Por que importa.**
- Descumpre a WCAG 2.1.1, de nível A, o mais básico.
- No dia a dia do escritório, também atrapalha quem quer só usar Tab e Enter num cadastro longo.
- E vale para quando o Lotifly for vendido para outras empresas.

**Como corrigir.**
- Trocar os `<div onclick>` de navegação e ação por `<button>`, mantendo o visual.
- Nas janelas:
  - pôr `role="dialog"`, `aria-modal="true"` e `aria-labelledby="modalTitle"`;
  - focar o primeiro campo ao abrir;
  - manter o Tab dentro da janela;
  - devolver o foco ao botão que abriu, ao fechar.

**Comando sugerido:** `/impeccable harden`

---

### I3. Os rótulos dos campos não estão ligados aos campos

**Números.**
- O app tem 305 `<label>` e nenhum `for=`.
- A checagem achou 206 campos sem nome acessível, em 11 telas. Exemplos: o cadastro de imóvel (`admin.js:1068`, Cidade) e o formulário de contrato.
- São 80 seletores de filtro sem nome, em 17 telas. Exemplos: "Todas as quadras" (`admin.js:355`) e "Planta real / Esquemática" (`admin.js:214`).
- Quase nenhum campo tem `name` ou `autocomplete`. São 12 `autocomplete` no total, e só 5 `inputmode`.

**Por que importa.**
- No celular, tocar no rótulo "Valor recebido" não põe o cursor no campo.
- Leitor de tela não diz o que é cada campo.
- O navegador não sugere preenchimento automático (nome, CPF, telefone, e-mail) nos cadastros de cliente.

**Como corrigir.**
- Ligar cada `<label>` ao seu campo, com `for` e `id`, ou pondo o campo dentro do rótulo.
- Dar `aria-label` aos filtros.
- Pôr `autocomplete`, `inputmode` e `type` certos:
  - `tel` para telefone;
  - `email` para e-mail;
  - `inputmode="numeric"` para CPF e CEP.

**Comando sugerido:** `/impeccable harden`

---

### I4. Os gráficos do Início não mostram valores

**O que acontece.**
- **"Fluxo previsto (12 meses)"** (`financeiro.js:328`):
  - tem linhas de grade, mas nenhum valor no eixo;
  - os valores sobre as barras só aparecem quando cada mês tem 64px ou mais (`showVals = gw >= 64`), o que não acontece nem no computador;
  - as barras do mês atual são mais escuras, mas a legenda não explica isso.
- **"Recebido × inadimplência"**: o rótulo "28% atraso" (`financeiro.js:394`) é escrito por cima das barras vizinhas e fica ilegível no celular.

**Por que importa.** O PRODUCT.md diz que cada número deve ser conferível. Hoje o gráfico de fluxo mostra só a forma, não quanto entra e quanto sai.

**Como corrigir.**
- Pôr valores no eixo em formato curto ("R$ 50 mil").
- Ao tocar ou passar o mouse no mês, mostrar uma dica com os valores, como o outro gráfico já faz.
- Pôr uma tabela "Ver em tabela" também no fluxo.
- Explicar na legenda que a barra escura é o mês atual.
- Posicionar o rótulo de inadimplência acima de tudo, ou movê-lo para a dica.

**Comando sugerido:** `/impeccable clarify`

<img src="diagnostico/celular-10-inicio.jpg" width="260" alt="Início no celular: gráficos sem valores no eixo">

---

### I5. No celular, tabelas cortam colunas e escondem ações

**O que acontece.**
- **Contrato › Parcelas** (`contrato.js:159-163`):
  - no iPhone só aparecem Parcela, Vencimento e Valor;
  - "Pago", "Status" e os botões 💵 Registrar pagamento, 🧾 Recibo, 🏦 e ✏️ ficam fora da tela, à direita;
  - nada mostra que dá para arrastar a tabela para o lado.
- **Imóvel › Lotes e preços**:
  - a tabela também corta colunas (situação e ações);
  - o botão redondo "＋" (`style.css:334`) fica por cima das linhas da tabela.
- **Relatórios**: a tabela rolável não dá para alcançar pelo teclado.

**Bom exemplo dentro do próprio app.** A tela **A receber** no celular usa cartões em vez de tabela, e tudo cabe.

**Como corrigir.**
- No celular, mostrar Parcelas e Lotes como cartões, no mesmo modelo de A receber.
- Ou fixar a coluna de ações e mostrar uma sombra indicando que há mais conteúdo à direita.
- Reservar espaço no fim da lista para o "＋" não cobrir a última linha.

**Comando sugerido:** `/impeccable adapt`

<img src="diagnostico/celular-22-contrato-parcelas.jpg" width="260" alt="Parcelas do contrato no celular: colunas de pagamento e ações cortadas"> <img src="diagnostico/celular-13-imovel-lotes.jpg" width="260" alt="Lotes e preços no celular: botão ＋ sobre a tabela"> <img src="diagnostico/celular-30-a-receber.jpg" width="260" alt="A receber no celular em cartões: o modelo que funciona">

---

### I6. No celular, o nome do empreendimento passa por cima dos botões do corretor

**O que acontece.**
- Na área do corretor, o título "Residencial Vista Verde" vai até 253px, e os botões da direita começam em 243px. Os dois se sobrepõem.
- Com nomes maiores, ou com o seletor de empreendimento aparecendo, piora.
- Fica em `index.html:41`, no cabeçalho do corretor.

**Como corrigir.** Cortar o título com reticências (`min-width: 0`, `text-overflow: ellipsis`) ou quebrá-lo em duas linhas. No celular, deixar o seletor de empreendimento em uma linha própria, abaixo.

**Comando sugerido:** `/impeccable adapt`

<img src="diagnostico/celular-50-corretor-planta.jpg" width="260" alt="Planta do corretor no celular: título sobre o botão Admin e zoom sobre os lotes">

---

### I7. O nome do produto aparece de três jeitos

**Onde aparece cada nome.**

| Onde | Nome |
|---|---|
| Aba do navegador (`index.html:6`) | "Gestão de Loteamento" |
| Ícone na tela inicial do iPhone (`index.html:10`) | "Lotes" |
| Tela de entrada (`index.html:22-23`) | "Gestão de Loteamento", com a casinha 🏘️ como logo |
| Manifesto do app | "Lotifly" |

**Termos que divergem do PRODUCT.md.**
- A entrada diz "Nenhum loteamento cadastrado", mas o termo fixado é **Imóveis**.
- O menu diz "Novo contrato", mas o formulário abre com o título **"Registrar venda"**.

**Como corrigir.**
- Usar "Lotifly" no título, no ícone e na entrada.
- Revisar os termos da entrada e do formulário de contrato.

**Comando sugerido:** `/impeccable clarify`

---

### I8. O PIN padrão aparece na tela de entrada

**O que acontece.**
- No modo "só neste dispositivo", enquanto o PIN não é trocado, a tela de entrada mostra a todos o aviso "O PIN do administrador ainda é o padrão (**1234**)" (`index.html:32`, `core.js:1410`).
- Isso inclui os corretores, que passam a saber como entrar na administração.
- No modo nuvem, que é o que você usa, esse PIN não existe. O risco é de quem usa o modo local.

**Como corrigir.** Mostrar o aviso só depois de entrar como administrador, sem escrever o número na tela pública.

**Comando sugerido:** `/impeccable harden`

<img src="diagnostico/celular-00-entrada-vazia.jpg" width="260" alt="Entrada: nome antigo, casinha como logo e PIN padrão escrito na tela">

---

### I9. Números do mesmo painel em formatos diferentes

**O que acontece.**
- Na mesma fileira do Início, "Total a receber **R$ 498,4 mil**" fica ao lado de "Em atraso **R$ 6.910,00**".
- O mesmo acontece no contrato: "R$ 142,6 mil" ao lado de "R$ 0,00".
- O valor arredondado não tem como ser visto inteiro: nem passando o mouse, nem na linha de baixo.
- A regra hoje (`fmtMoneyShort`) é: acima de R$ 10 mil, arredonda.

**Por que importa.** Para conferir com o extrato do banco ou com o contador, é preciso o valor exato.

**Como corrigir.**
- Mostrar o valor exato na linha de baixo do cartão.
- Ou usar sempre o formato inteiro e reduzir o tamanho da fonte do número.

**Comando sugerido:** `/impeccable clarify`

---

## 🟡 Detalhes

| # | O que | Onde | Como corrigir |
|---|---|---|---|
| D1 | Botões pequenos para o dedo. Passam no mínimo da norma (24px), mas ficam abaixo dos 44px recomendados: botões de ícone 30×30 (💵 🧾 ✏️), botões pequenos com ~28px de altura e filtros com ~30px. | `style.css:175` (`.btn-icon`), `:240` (`.btn-sm`), `:199` (`.chip`) | No celular, subir para 40–44px. As caixinhas de Permissões foram apontadas pela checagem, mas o rótulo inteiro é clicável: falso alarme. |
| D2 | Textos menores que 11px: os grupos do menu ("Comercial", "Contratos", "Financeiro") têm 10,56px, e "Administração" / "Área do corretor" têm 10,88px. | `style.css:456`, `.topbar .role` | Subir para 11–12px. |
| D3 | Estrutura da página: não há `<main>`, os títulos pulam de h1 para h3 (em 20 telas) e as colunas de ação das tabelas têm cabeçalho vazio. | `index.html`, `admin.js`, `contrato.js:161` | Envolver o conteúdo em `<main>`, usar h2 nos cartões e dar nome às colunas de ação (pode ser escondido na tela). |
| D4 | Os avisos que aparecem no canto (toasts) não são lidos por leitor de tela, e a animação deles não respeita "reduzir movimento". | `core.js:102`, `index.html:17`, `style.css:337` | Usar `aria-live="polite"` no contêiner e desligar a animação com `prefers-reduced-motion`. |
| D5 | Celular: faltam `touch-action: manipulation` (o toque fica com atraso) e `-webkit-tap-highlight-color`. Nas janelas, falta `overscroll-behavior: contain`: rolar até o fim da janela arrasta a página de trás. | `style.css:22`, `:246` | Três linhas de CSS. |
| D6 | Colunas de dinheiro não alinham os dígitos: `tabular-nums` aparece em um único lugar. | `style.css` (`.tbl .num`, `.kpi .val`) | Aplicar `font-variant-numeric: tabular-nums` nos números. |
| D7 | Cores e estilos espalhados: 86 cores fixas no CSS, 111 no JavaScript e 202 `style="…"` no meio do código (49 só em `admin.js`). As cores-base (`:root`) existem, mas são pouco usadas. | todos | Antes de definir a identidade visual, juntar as cores em variáveis; senão trocar a cor vai exigir caçar cada uso. Comando: `/impeccable extract`. |
| D8 | Registrar pagamento no celular: os três botões empilhados ocupam ~¼ da tela e escondem o campo Observação. Em A receber, os filtros cortam o texto ("out/26 (mês a", "Cliente ou lo"). | `financeiro.js:81`, A receber | No celular, deixar "Cancelar" só no ✕ do topo e encurtar os textos dos filtros. |
| D9 | Planta do corretor: os botões de zoom ficam por cima dos lotes da coluna da direita (lotes 5 e 10 da quadra A). A dica embaixo começa com um ponto solto ("· Toque no lote…"). | `planta.js`, `corretor.js` | Pôr os controles fora da área dos lotes, ou com fundo, e tirar o ponto. |
| D10 | O detector apontou: faixa colorida de 4px na lateral de alertas, avisos e cartões (`style.css:144`, `:156`, `:337`) e brilho colorido na sombra do botão "＋" (`:334`). A fonte Arial do boleto (`:385`) é falso alarme: o boleto bancário pede essa fonte. | `style.css` | Decidir junto com a identidade visual. |
| D11 | Carregamento: ~895 KB de JavaScript e CSS sem compactar, em 21 arquivos carregados de uma vez. O `supabase.js` (218 KB) carrega até no modo local. O app instalado guarda tudo depois da 1ª visita, então pesa só na primeira abertura com internet fraca. | `index.html:129-149` | `defer` nos scripts e carregar o Supabase só quando há nuvem configurada. |

---

## Nota da auditoria técnica (`/impeccable audit`)

| # | Dimensão | Nota | Principal achado |
|---|---|---|---|
| 1 | Acessibilidade | 1/4 | Navegação por teclado praticamente ausente (I2), rótulos soltos (I3), contraste (I1) |
| 2 | Desempenho | 2/4 | Bom com os dados de exemplo; congela com carteira grande (C1) |
| 3 | Cores e estilos | 2/4 | Variáveis de cor existem, mas há cores fixas e estilos espalhados (D7) |
| 4 | Celular e telas | 2/4 | Nada transborda para o lado, mas falta folga para o entalhe do iPhone (C2), tabelas cortam (I5) e há sobreposição (I6) |
| 5 | Consistência do código | 2/4 | `<div>` no lugar de botão como padrão do app inteiro, nome do produto em três versões (I7) |
| **Total** | | **9/20** | **Faixa "fraco": precisa de uma rodada grande de ajustes** |

**Leitura da nota.** A nota mede a qualidade técnica da interface, não se o sistema funciona. As regras de negócio estão bem cobertas por testes, e as telas funcionam. O que puxa a nota para baixo são acessibilidade e acabamento de celular, e são problemas que se repetem no app inteiro (o mesmo padrão em todas as telas). Por isso, corrigir o padrão uma vez resolve dezenas de pontos de uma vez.

**Veredito de consistência.** A interface tem um sistema próprio e coerente:
- cartões, filtros e alertas aparecem iguais em todas as telas;
- as cores de situação (disponível, reservado, vendido) são as mesmas em todo lugar;
- a linguagem é do mercado imobiliário.

Ela falha em dois pontos que se repetem em todas as telas: a base técnica (`<div>` clicável no lugar de botão, rótulos soltos) e a identidade (nome antigo e casinha emoji como logo). Não é uma interface genérica, mas ainda não tem a cara do Lotifly.

**Contagem por gravidade (escala da auditoria).** P0: 1 (C1) · P1: 6 (C2, I1, I2, I3, I5, I6) · P2: 5 (I4, I7, I8, I9, D8) · P3: 10 (os demais detalhes).

---

## Diretrizes de interface (Vercel), arquivo por arquivo

### index.html

```text
index.html:5   viewport-fit=cover sem env(safe-area-inset-*) no CSS (ver C2)
index.html:6   <title> "Gestão de Loteamento" ≠ Lotifly
index.html:10  apple-mobile-web-app-title "Lotes" ≠ Lotifly
index.html:12  theme-color #0e4c73 ≠ fundo da página (#f1f5f9); ok só se a intenção é casar com o cabeçalho
index.html:17  #toastContainer sem aria-live="polite"
index.html:22  logo emoji 🏘️ sem aria-hidden
index.html:46-49  abas do corretor <div onclick> → <button>
index.html:64-85  menu lateral <div onclick> → <button>/<a>; sem rota no endereço (não dá para abrir em nova aba nem recarregar na mesma tela)
index.html:116 .fab "＋" só com title → aria-label
index.html:119-121 modal sem role="dialog", aria-modal, aria-labelledby
index.html:129-149 21 <script> síncronos → defer
—              sem <main>; sem link "pular para o conteúdo"
```

### style.css

```text
style.css:13   --muted #64748b sobre --bg #f1f5f9 = 4,34:1 (< 4,5)
style.css:22   html sem touch-action: manipulation, sem -webkit-tap-highlight-color
style.css:75   .topbar padding sem env(safe-area-inset-top)
style.css:175  .btn-icon 30×30 (< 44 no toque)
style.css:199  .chip ~30px de altura
style.css:201  .chip .n contraste baixo
style.css:213  outline:none em campos — tem substituto (box-shadow), ok; mas usar :focus-visible
style.css:236  .btn-success branco sobre #16a34a = 3,30:1
style.css:237  .btn-accent branco sobre #f59e0b = 2,15:1
style.css:240  .btn-sm ~28px de altura
style.css:242  .btn-wa branco sobre #25d366 = 1,98:1
style.css:246  .modal-overlay sem overscroll-behavior: contain
style.css:334  .fab bottom:22px sem env(safe-area-inset-bottom); cobre conteúdo de listas
style.css:337  .toast animation slideIn sem prefers-reduced-motion
style.css:456  .aside-grupo 0,66rem = 10,56px (< 11px)
—              tabular-nums só em 1 lugar; nenhum :focus-visible; nenhum text-wrap: balance nos títulos
```

### admin.js

```text
admin.js:180   kpi-grid: cartões <div onclick> sem teclado; números curtos sem o exato (I9)
admin.js:214   <select id="aPlantaModo"> sem rótulo
admin.js:226   .lote-picker rolável sem acesso por teclado
admin.js:355   <select> de quadra sem rótulo
admin.js:1068  <label>Cidade</label> sem for → #lmCidade sem nome acessível (padrão repetido em todo o formulário)
—              49 style="" inline; 84 <div onclick> no app (maioria aqui); confirm() nativo em exclusões (aceitável)
```

### financeiro.js

```text
financeiro.js:71    botões 💵 ✏️ 🧾 só com title; emoji sem aria-hidden
financeiro.js:81   rodapé com 3 botões empilhados no celular cobre o formulário
financeiro.js:328  drawFluxoChart: sem valores no eixo, valores só com gw ≥ 64; cor do mês atual sem legenda
financeiro.js:394  rótulo "% atraso" desenhado sobre barras vizinhas
—                  lista A receber sem limite: desenha todas as parcelas (ver C1)
```

### contrato.js

```text
contrato.js:161  <th></th> vazio na coluna de ações
contrato.js:162  ações no fim da linha ficam fora da tela no celular (ver I5)
```

### core.js

```text
core.js:102   toast() sem aria-live
core.js:112   openModal(): sem prender o foco, sem devolver o foco ao fechar, foco inicial no fundo
core.js:695   getVenda() busca linear chamada por parcela (ver C1)
core.js:1234  recStatus() chama todayStr() a cada chamada (ver C1)
core.js:1410  aviso com o PIN padrão na tela pública (ver I8)
core.js:42    fmtDate monta dd/mm/aaaa à mão — aceitável (app só em pt-BR); dinheiro já usa Intl
```

### indices.js

```text
indices.js:76  recValor(): getVenda + fatorIndice a cada chamada, sem guardar o resultado (ver C1)
```

### corretor.js · clientes.js · cobranca.js · banco.js · cnab.js · relatorios.js · docs.js · auth.js · permissoes.js · antecipacao.js · planta.js · admin-pdf.js

```text
—  mesmos padrões de cima: <div onclick> em cartões e abas, <label> sem for, campos sem name/autocomplete
corretor.js  cabeçalho do corretor sem min-width:0 no título (ver I6)
relatorios.js  .table-wrap rolável sem tabindex (não rola pelo teclado)
auth.js  campos de login com autocomplete correto (username / current-password / new-password) — ✓
docs.js  prévia do documento editável com contenteditable — ✓
```

---

## O que está bom

- **Nenhuma rolagem lateral** em nenhuma das 46 telas do iPhone.
- **Nenhum erro de JavaScript** nas 91 aberturas.
- **Zoom liberado** (sem `user-scalable=no`) e idioma declarado (`lang="pt-BR"`).
- **Dinheiro formatado pelo padrão brasileiro** (`Intl`, R$ com vírgula).
- **Janelas no celular abrem de baixo para cima**, com botões grandes e de largura total. Bom para usar com o polegar.
- **A ficha do lote do corretor** mostra preço grande, R$/m², condição à vista, medidas, simulador e as três ações (Compartilhar, Proposta, Solicitar reserva) ao alcance do dedo.
- **A receber no celular em cartões**: tudo cabe sem arrastar. É o modelo para Parcelas e Lotes.
- **O gráfico de inadimplência** tem cores conferidas para daltonismo, uma dica com os valores ao passar o mouse e a opção "Ver em tabela".
- **Ações que apagam pedem confirmação.** Excluir contrato exige digitar EXCLUIR.
- **O menu lateral respeita "reduzir movimento"** no celular.
- **Nada se perde:** alteração que não subiu para a nuvem fica guardada e visível.

---

## Ordem sugerida para corrigir

1. **[P0] `/impeccable optimize`**: a lentidão com carteira grande (C1). Primeiro porque piora a cada contrato novo.
2. **[P1] `/impeccable adapt`**: folga para o entalhe do iPhone (C2), tabelas no celular (I5) e cabeçalho do corretor (I6).
3. **[P1] `/impeccable harden`**: teclado e janelas (I2), rótulos dos campos (I3) e PIN na entrada (I8).
4. **[P1] `/impeccable polish`**: contraste dos botões e textos (I1) e os detalhes D1–D6 e D8–D9.
5. **[P2] `/impeccable clarify`**: valores nos gráficos (I4), nome Lotifly e termos (I7) e números exatos (I9).
6. **[P3] `/impeccable extract`**: juntar cores e estilos em variáveis (D7), antes de decidir a identidade visual.
7. **`/impeccable polish`** no fim, para fechar.

Dá para pedir um de cada vez, todos de uma vez ou em outra ordem. Depois das correções, rodar `/impeccable audit` de novo para ver a nota subir.

---

## Galeria de prints

Celular: iPhone 13 (390 × 844). Computador: 1440 × 900. Nos prints de página inteira no computador, o menu lateral escuro termina na altura da tela. Isso é só do print: no uso real, o menu acompanha a rolagem.

| Tela | Celular | Computador |
|---|---|---|
| **Entrada (primeiro acesso, sem dados)** | <img src="diagnostico/celular-00-entrada-vazia.jpg" width="180" alt="Entrada (primeiro acesso, sem dados) no celular"> | <img src="diagnostico/computador-00-entrada-vazia.jpg" width="360" alt="Entrada (primeiro acesso, sem dados) no computador"> |
| **Entrada com empreendimento** | <img src="diagnostico/celular-01-entrada.jpg" width="180" alt="Entrada com empreendimento no celular"> | <img src="diagnostico/computador-01-entrada.jpg" width="360" alt="Entrada com empreendimento no computador"> |
| **PIN do administrador** | <img src="diagnostico/celular-02-pin.jpg" width="180" alt="PIN do administrador no celular"> | <img src="diagnostico/computador-02-pin.jpg" width="360" alt="PIN do administrador no computador"> |
| **Início** | <img src="diagnostico/celular-10-inicio.jpg" width="180" alt="Início no celular"> | <img src="diagnostico/computador-10-inicio.jpg" width="360" alt="Início no computador"> |
| **Menu lateral aberto (celular)** | <img src="diagnostico/celular-11-menu.jpg" width="180" alt="Menu lateral aberto (celular) no celular"> | — (só existe no celular) |
| **Imóveis (lista)** | <img src="diagnostico/celular-12-imoveis.jpg" width="180" alt="Imóveis (lista) no celular"> | <img src="diagnostico/computador-12-imoveis.jpg" width="360" alt="Imóveis (lista) no computador"> |
| **Imóvel aberto › Resumo** | <img src="diagnostico/celular-13-imovel-resumo.jpg" width="180" alt="Imóvel aberto › Resumo no celular"> | <img src="diagnostico/computador-13-imovel-resumo.jpg" width="360" alt="Imóvel aberto › Resumo no computador"> |
| **Imóvel aberto › Planta (editor)** | <img src="diagnostico/celular-13-imovel-planta.jpg" width="180" alt="Imóvel aberto › Planta (editor) no celular"> | <img src="diagnostico/computador-13-imovel-planta.jpg" width="360" alt="Imóvel aberto › Planta (editor) no computador"> |
| **Imóvel aberto › Lotes e preços** | <img src="diagnostico/celular-13-imovel-lotes.jpg" width="180" alt="Imóvel aberto › Lotes e preços no celular"> | <img src="diagnostico/computador-13-imovel-lotes.jpg" width="360" alt="Imóvel aberto › Lotes e preços no computador"> |
| **Imóvel aberto › Obra e orçamento** | <img src="diagnostico/celular-13-imovel-custos.jpg" width="180" alt="Imóvel aberto › Obra e orçamento no celular"> | <img src="diagnostico/computador-13-imovel-custos.jpg" width="360" alt="Imóvel aberto › Obra e orçamento no computador"> |
| **Cadastro de imóvel (formulário)** | <img src="diagnostico/celular-14-imovel-form.jpg" width="180" alt="Cadastro de imóvel (formulário) no celular"> | <img src="diagnostico/computador-14-imovel-form.jpg" width="360" alt="Cadastro de imóvel (formulário) no computador"> |
| **Reservas** | <img src="diagnostico/celular-15-reservas.jpg" width="180" alt="Reservas no celular"> | <img src="diagnostico/computador-15-reservas.jpg" width="360" alt="Reservas no computador"> |
| **Corretores** | <img src="diagnostico/celular-16-corretores.jpg" width="180" alt="Corretores no celular"> | <img src="diagnostico/computador-16-corretores.jpg" width="360" alt="Corretores no computador"> |
| **Todos os contratos** | <img src="diagnostico/celular-20-contratos.jpg" width="180" alt="Todos os contratos no celular"> | <img src="diagnostico/computador-20-contratos.jpg" width="360" alt="Todos os contratos no computador"> |
| **Clientes** | <img src="diagnostico/celular-21-clientes.jpg" width="180" alt="Clientes no celular"> | <img src="diagnostico/computador-21-clientes.jpg" width="360" alt="Clientes no computador"> |
| **Página do contrato › Resumo** | <img src="diagnostico/celular-22-contrato-resumo.jpg" width="180" alt="Página do contrato › Resumo no celular"> | <img src="diagnostico/computador-22-contrato-resumo.jpg" width="360" alt="Página do contrato › Resumo no computador"> |
| **Página do contrato › Partes** | <img src="diagnostico/celular-22-contrato-partes.jpg" width="180" alt="Página do contrato › Partes no celular"> | <img src="diagnostico/computador-22-contrato-partes.jpg" width="360" alt="Página do contrato › Partes no computador"> |
| **Página do contrato › Parcelas** | <img src="diagnostico/celular-22-contrato-parcelas.jpg" width="180" alt="Página do contrato › Parcelas no celular"> | <img src="diagnostico/computador-22-contrato-parcelas.jpg" width="360" alt="Página do contrato › Parcelas no computador"> |
| **Página do contrato › Documentos** | <img src="diagnostico/celular-22-contrato-documentos.jpg" width="180" alt="Página do contrato › Documentos no celular"> | <img src="diagnostico/computador-22-contrato-documentos.jpg" width="360" alt="Página do contrato › Documentos no computador"> |
| **Página do contrato › Histórico** | <img src="diagnostico/celular-22-contrato-historico.jpg" width="180" alt="Página do contrato › Histórico no celular"> | <img src="diagnostico/computador-22-contrato-historico.jpg" width="360" alt="Página do contrato › Histórico no computador"> |
| **Novo contrato (escolher imóvel)** | <img src="diagnostico/celular-23-novo-contrato.jpg" width="180" alt="Novo contrato (escolher imóvel) no celular"> | <img src="diagnostico/computador-23-novo-contrato.jpg" width="360" alt="Novo contrato (escolher imóvel) no computador"> |
| **Novo contrato (formulário)** | <img src="diagnostico/celular-24-contrato-form.jpg" width="180" alt="Novo contrato (formulário) no celular"> | <img src="diagnostico/computador-24-contrato-form.jpg" width="360" alt="Novo contrato (formulário) no computador"> |
| **A receber** | <img src="diagnostico/celular-30-a-receber.jpg" width="180" alt="A receber no celular"> | <img src="diagnostico/computador-30-a-receber.jpg" width="360" alt="A receber no computador"> |
| **Registrar pagamento** | <img src="diagnostico/celular-31-pagamento.jpg" width="180" alt="Registrar pagamento no celular"> | <img src="diagnostico/computador-31-pagamento.jpg" width="360" alt="Registrar pagamento no computador"> |
| **Recibo de pagamento** | <img src="diagnostico/celular-32-recibo.jpg" width="180" alt="Recibo de pagamento no celular"> | <img src="diagnostico/computador-32-recibo.jpg" width="360" alt="Recibo de pagamento no computador"> |
| **Cobrança** | <img src="diagnostico/celular-33-cobranca.jpg" width="180" alt="Cobrança no celular"> | <img src="diagnostico/computador-33-cobranca.jpg" width="360" alt="Cobrança no computador"> |
| **Boletos e banco** | <img src="diagnostico/celular-34-boletos.jpg" width="180" alt="Boletos e banco no celular"> | <img src="diagnostico/computador-34-boletos.jpg" width="360" alt="Boletos e banco no computador"> |
| **A pagar** | <img src="diagnostico/celular-35-a-pagar.jpg" width="180" alt="A pagar no celular"> | <img src="diagnostico/computador-35-a-pagar.jpg" width="360" alt="A pagar no computador"> |
| **Índices** | <img src="diagnostico/celular-36-indices.jpg" width="180" alt="Índices no celular"> | <img src="diagnostico/computador-36-indices.jpg" width="360" alt="Índices no computador"> |
| **Relatórios** | <img src="diagnostico/celular-40-relatorios.jpg" width="180" alt="Relatórios no celular"> | <img src="diagnostico/computador-40-relatorios.jpg" width="360" alt="Relatórios no computador"> |
| **Configurações › Dados da empresa** | <img src="diagnostico/celular-41-config-empresa.jpg" width="180" alt="Configurações › Dados da empresa no celular"> | <img src="diagnostico/computador-41-config-empresa.jpg" width="360" alt="Configurações › Dados da empresa no computador"> |
| **Configurações › Permissões** | <img src="diagnostico/celular-41-config-permissoes.jpg" width="180" alt="Configurações › Permissões no celular"> | <img src="diagnostico/computador-41-config-permissoes.jpg" width="360" alt="Configurações › Permissões no computador"> |
| **Configurações › Categorias** | <img src="diagnostico/celular-41-config-categorias.jpg" width="180" alt="Configurações › Categorias no celular"> | <img src="diagnostico/computador-41-config-categorias.jpg" width="360" alt="Configurações › Categorias no computador"> |
| **Configurações › Modelos de documento** | <img src="diagnostico/celular-41-config-documentos.jpg" width="180" alt="Configurações › Modelos de documento no celular"> | <img src="diagnostico/computador-41-config-documentos.jpg" width="360" alt="Configurações › Modelos de documento no computador"> |
| **Configurações › Contas bancárias** | <img src="diagnostico/celular-41-config-banco.jpg" width="180" alt="Configurações › Contas bancárias no celular"> | <img src="diagnostico/computador-41-config-banco.jpg" width="360" alt="Configurações › Contas bancárias no computador"> |
| **Configurações › Régua de cobrança** | <img src="diagnostico/celular-41-config-cobranca.jpg" width="180" alt="Configurações › Régua de cobrança no celular"> | <img src="diagnostico/computador-41-config-cobranca.jpg" width="360" alt="Configurações › Régua de cobrança no computador"> |
| **Configurações › Geral** | <img src="diagnostico/celular-41-config-config.jpg" width="180" alt="Configurações › Geral no celular"> | <img src="diagnostico/computador-41-config-config.jpg" width="360" alt="Configurações › Geral no computador"> |
| **Configurações › Nuvem** | <img src="diagnostico/celular-41-config-nuvem.jpg" width="180" alt="Configurações › Nuvem no celular"> | <img src="diagnostico/computador-41-config-nuvem.jpg" width="360" alt="Configurações › Nuvem no computador"> |
| **Configurações › Backup** | <img src="diagnostico/celular-41-config-backup.jpg" width="180" alt="Configurações › Backup no celular"> | <img src="diagnostico/computador-41-config-backup.jpg" width="360" alt="Configurações › Backup no computador"> |
| **Corretor › Planta** | <img src="diagnostico/celular-50-corretor-planta.jpg" width="180" alt="Corretor › Planta no celular"> | <img src="diagnostico/computador-50-corretor-planta.jpg" width="360" alt="Corretor › Planta no computador"> |
| **Corretor › Lotes** | <img src="diagnostico/celular-51-corretor-lotes.jpg" width="180" alt="Corretor › Lotes no celular"> | <img src="diagnostico/computador-51-corretor-lotes.jpg" width="360" alt="Corretor › Lotes no computador"> |
| **Corretor › Lote aberto** | <img src="diagnostico/celular-52-corretor-lote.jpg" width="180" alt="Corretor › Lote aberto no celular"> | <img src="diagnostico/computador-52-corretor-lote.jpg" width="360" alt="Corretor › Lote aberto no computador"> |
| **Corretor › Simulação** | <img src="diagnostico/celular-53-corretor-simular.jpg" width="180" alt="Corretor › Simulação no celular"> | <img src="diagnostico/computador-53-corretor-simular.jpg" width="360" alt="Corretor › Simulação no computador"> |
| **Corretor › Pedir reserva** | <img src="diagnostico/celular-54-corretor-reserva.jpg" width="180" alt="Corretor › Pedir reserva no celular"> | <img src="diagnostico/computador-54-corretor-reserva.jpg" width="360" alt="Corretor › Pedir reserva no computador"> |
| **Corretor › Minhas reservas** | <img src="diagnostico/celular-55-corretor-reservas.jpg" width="180" alt="Corretor › Minhas reservas no celular"> | <img src="diagnostico/computador-55-corretor-reservas.jpg" width="360" alt="Corretor › Minhas reservas no computador"> |
| **Corretor › Perfil** | <img src="diagnostico/celular-56-corretor-perfil.jpg" width="180" alt="Corretor › Perfil no celular"> | <img src="diagnostico/computador-56-corretor-perfil.jpg" width="360" alt="Corretor › Perfil no computador"> |
