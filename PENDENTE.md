# Pendências para testar no computador

Lista do que foi construído e ainda não foi testado por você, mais as decisões que dependem da
sua conferência. Atualizada em 15/10/2026: roteiro único de conferência logo abaixo.

---

## ✔ Roteiro de conferência (15/10)

Em 15/10 passei pelos 156 itens abertos desta lista e cruzei cada um com o que você já fez
e com os testes automáticos de `testes/`:

- **14 já estavam feitos por você.** Os oito "rode o schema" anteriores à Fase 4 entraram
  quando você rodou o schema em 15/10, porque ele é cumulativo. Também já estavam feitos a
  planta do Hessen, a empresa na nuvem, o visual aprovado, a faixa do nosso número e a
  carteira sem orçamento.
- **19 estão cobertos pelos testes automáticos atuais**: reserva, permissões, contrato,
  despesas, fluxo principal, telas e banco.
- **5 ficaram obsoletos**, porque a tela mudou depois (abas que viraram menu, chip de
  Cobrança, painel antigo).
- **7 não eram teste**, eram aviso ou informação.
- **Depois, no mesmo dia, mais 31** passaram para teste automático novo: a conta da
  antecipação (`antecipacao.test`), o texto dos documentos (`documentos.test`) e o
  formulário de novo contrato (`novo-contrato.test`). Esses testes acharam 5 defeitos, já
  corrigidos (seção 7z10).

Esses 76 ficaram marcados `[x]` em cada seção, com o motivo ao lado. Os que sobraram estão
agrupados abaixo, sem repetição. Cada bloco é uma sentada.

Os testes antigos (test8 a test39), que conferiram muita coisa na época de cada entrega, se
perderam na limpeza do ambiente. Só os arquivos de `testes/` contam como cobertura hoje.

### A. Configurar com os seus dados (uma vez; não é teste)
- [x] *(feito por você em 15/10)* Rodar o `supabase/schema.sql` da Fase 4 (seção 7z9).
- [ ] **Rodar o `supabase/schema.sql` de novo** para fechar as plantas (seção 7z11).
- [ ] **Dados da empresa**, com quem assina; colar o **seu contrato** e a **sua proposta** em
      Modelos de documento e usar **Ver exemplo** (seções 3 e 7h).
- [ ] **Índices reais** (IGP-M, INPC, IPCA, CUB), colando da planilha (seções 4 e 7h).
- [ ] **Chave PIX** e os cinco textos da régua de cobrança (seção 6).
- [ ] **Multa** da conta bancária (seção 7d).
- [ ] **Redistribuir o orçamento** entre as categorias divididas e revisar os lançamentos
      antigos (seção 7b2).
- [ ] Revisar o padrão de permissões de cada função (seção 7b).
- [ ] Contratos › **Numerar agora**; se quiser, `{{contrato.numero}}` no modelo (seção 7t).
- [ ] Clientes › **Trazer agora** (seção 7m).
- [ ] Lote 15 da Quadra 300: tipo **Lote** e valor de venda (seções 7r e 7o).
- [ ] Quem instalou o app: reinstalar pelo endereço novo (seção 00).

### B. Conferir as contas com a sua planilha (só você tem o número certo)
- [ ] **Índices**: o valor corrigido bate; lançar um mês antigo e ver a tela de diferença.
- [ ] **Antecipação**: a conta já é conferida pelo teste contra uma tabela Price feita à
      parte (`antecipacao.test`). Falta você pegar **um contrato real** seu, comparar o
      "Para quitar" com a sua planilha e ver se o demonstrativo impresso está apresentável.
- [ ] **Início**: os quatro números do mês e o Total a receber batem com o que você sabe;
      clicar abre a lista certa (seções 7s e 7u).
- [ ] **Orçado × realizado** com o seu orçamento redistribuído (seção 7c).

### C. Ler os documentos
- [ ] Ler o **seu** modelo de contrato preenchido com uma venda de verdade, depois de colar o
      seu texto (bloco A). Concordância, cônjuge, várias partes, extenso, ordem das cláusulas
      e a parcela da proposta já são conferidos pelo teste (`documentos.test`); falta o seu
      olho jurídico sobre o texto.
- [ ] **Recibo** de pagamento e o PDF dele (seção 7v).
- [ ] **Relatórios**: os sete abrem, filtros de despesas, PDF apresentável, CSV na planilha
      (inclusive o da inadimplência) (seções 6 e 7c).

### D. Novo contrato
- [x] *(testes: novo-contrato.test — corretor sim/não, à vista, nº de parcelas, "emitir o
      contrato?", aviso de índice, qualificação obrigatória, cliente casado do cadastro, lote
      novo no contrato, lote repetido, imóvel de terceiro; no celular e no computador)*
- [ ] Excluir um cliente de teste (seção 7m).

### E. Banco do Brasil (precisa do banco)
- [ ] **Remessa de teste** com poucos títulos pelo Gerenciador Financeiro (seção 7d).
- [ ] Retorno com título **recusado**: o número fica queimado (seção 7i).
- [ ] **Boletos e banco**: gerar as cobranças do mês, tudo junto com uma conta só (seções 7e
      e 7l).
- [ ] Uma **cobrança de verdade** pelo WhatsApp; o caminho Início › alerta de atraso ›
      Cobrança, com os filtros respondendo (seções 6 e 7j).

### F. Equipe na nuvem (precisa de duas pessoas)
- [ ] Convite aberto em outro aparelho, com as opções de validade e de quantas pessoas
      (seções 2 e 7b).
- [ ] Um **financeiro de verdade** logado: vê o que deve ver, e o banco recusa mudar o preço
      de um lote (seção 7b).
- [ ] Cadastrar dois imóveis, editar o valor de um e recarregar a página: a mudança fica
      salva (seção 7p).

### G. Planta real (Hessen)
- [ ] Numeração uniforme e legível, na administração e na tela do corretor (seção 7k).
- [ ] ＋ Lote desenhando, filtro "Só lotes sem posição", camadas do DXF (seção 1).

### H. No celular de verdade (o teste automático simula, mas não substitui)
- [ ] Tocar num campo de valor sem a tela aproximar; puxar a janela pela alça; abrir e
      fechar a gaveta do menu; registrar pagamento com o teclado aberto e o Confirmar à vista
      (seções 7l e 7y).
- [ ] Com **Reduzir movimento** ligado nos Ajustes, abrir uma janela e registrar um pagamento
      (seção 7z2).
- [ ] No iPhone, abrir pelo ícone da tela inicial e conferir o topo (seção 7x).
- [ ] Planta: legenda e desenhos de situação legíveis (seção 7z7).
- [ ] Contrato grande: os valores aparecem inteiros nos cartões (seção 7z).

As decisões e a segurança continuam nas seções 7f, 8b e 8c: planos do SaaS, domínio, e-mail,
dois passos, Supabase Pro, backup e termos de uso.

---

## 00. Mudança para o repositório próprio (29/09)

O sistema saiu da pasta `gestao/` do repositório `agenda-corretor` e ganhou o repositório
dele, **`vinicauduro/lotifly`**, com todo o histórico. O endereço passa a ser
**https://vinicauduro.github.io/lotifly/**.

- [x] ~~Ativar o GitHub Pages~~ — feito por você em 29/09. O repositório foi renomeado para
      `lotifly`, em minúsculas, e o endereço acompanha: `/lotifly/`.
- [x] ~~Conferir que o endereço novo abre~~ — conferido por você em 01/10.
- [x] ~~Trocar no Supabase o *Site URL* e as *Redirect URLs* para
      `https://vinicauduro.github.io/lotifly/`~~ — feito por você em 01/10. Confirmação de
      e-mail e recuperação de senha já voltam para o endereço novo.
- [ ] Quem instalou o app no celular ou no computador: abrir o endereço novo e instalar de
      novo. O endereço antigo passa a redirecionar para o novo.

Os dados não se perdem. Os da nuvem ficam no Supabase, que é o mesmo. Os do modo local ficam
no navegador, e o endereço novo continua em `vinicauduro.github.io`, que o navegador trata
como o mesmo site.

---

## 0. Antes de tudo

- [x] ~~Rodar o `schema.sql`~~ — feito por você em 17/09, já com a separação do perfil
      financeiro e os convites novos.
- [x] *(feito 15/10: você rodou o schema, que é cumulativo e inclui esta mudança)* **Rodar o `schema.sql` de novo.** Acumulou o seguinte desde aquela execução: a limpeza
      de dados passou a apagar também categorias e modelos (antes sobrava resto ao importar
      backup), a semente de categorias já vem dividida, os juros da conta bancária ganharam
      coluna em % ao mês, e agora entrou a **tabela de vendedores** e as colunas de
      qualificação do imóvel (descrição da matrícula, endereço do lote, cartório, código
      IBGE). Esta última é necessária: sem rodar, o cadastro de vendedores não sincroniza.
      Em 23/09 entrou mais uma: o schema agora **apaga as duas funções públicas da vitrine**
      (`vitrine_dados` e `registrar_lead`). Rodando, o banco deixa de ter qualquer porta aberta
      para quem não tem login. E entrou a **tabela de clientes** (seção 7m): sem rodar, o
      cadastro de clientes funciona só neste computador e não sincroniza, mas o resto do
      aplicativo segue normal.
- [x] *(obsoleto: o endereço mudou para /lotifly/ e o app se atualiza sozinho)* Abrir o app e forçar a atualização (Ctrl+Shift+R no computador) para pegar a versão nova.
      Endereço: https://vinicauduro.github.io/agenda-corretor/gestao/
- [x] *(em uso desde 23/09; telas.test abre todas as telas do menu)* Conferir o **menu lateral novo** (seção 7l). A barra de abas em cima saiu.

---

## 1. Planta em DXF e lotes manuais

- [x] *(feito por você: a planta do Hessen já está no sistema (seção 7k))* Importar o DXF do Hessen e conferir se a planta ficou bonita e alinhada.
- [ ] Testar o botão **＋ Lote** para criar um lote que a detecção não pegou, desenhando o
      retângulo sobre a planta.
- [ ] Testar o filtro **Só lotes sem posição** no seletor de lotes.
      (Tudo isso agora fica em **Empreendimentos › abra o loteamento › Planta / Lotes**.)
- [ ] Em "Rotação e camadas do desenho (avançado)", testar ligar e desligar camadas.

**Decidido em 17/09: vale o PDF.** O DXF era outra revisão. Você vai mandar a planta nova
nos próximos dias, com as alterações do loteamento — quando chegar, eu reimporto.

---

## 2. Nuvem, equipe e corretores

- [x] *(feito por você: a empresa está na nuvem com dados reais (seções 7o e 7p))* Criar conta, criar a empresa e entrar como dono.
- [ ] Gerar um convite em Configurações › Equipe e testar em outro celular ou janela anônima.
- [x] *(testes: permissoes-banco (o banco barra o corretor) e telas (área do corretor))* Conferir que o corretor vê a planta e os preços, mas não vê recebíveis, custos nem as
      reservas dos outros.
- [x] *(testes: reserva.test (pedido do corretor, aprovação, recusa, prazo))* Testar a reserva pelo corretor e a aprovação por você.

---

## 3. Documentos: proposta e contrato

- [ ] Preencher **Configurações › Dados da empresa**: CNPJ,
      endereço, cidade do foro, quem assina e CPF de quem assina.
- [ ] Em **Configurações › Modelos de documento**, colar o **seu** contrato de promessa de compra e venda no
      lugar do modelo de exemplo, marcando as partes variáveis com os campos da paleta.
- [ ] Fazer o mesmo com a **sua** proposta.
- [ ] Usar o botão **Ver exemplo** para conferir o texto preenchido antes de salvar.
- [x] *(testes: documentos.test)* Como corretor, abrir um lote e gerar uma **proposta**, testando entrada, parcelas, juros
      e reforço anual. Conferir o PDF e o envio por WhatsApp.
- [x] *(testes: documentos.test)* Em uma venda, gerar o **contrato** e conferir os valores, as parcelas e o texto por extenso.
- [x] *(testes: documentos.test)* Testar a edição da prévia antes de imprimir.

**Observação:** campos que você inventar no modelo, como `{{foro}}`, viram preenchimento na
hora de gerar e ficam guardados para a próxima.

---

## 4. Índices de correção

- [ ] Em **Financeiro › Índices**, criar IGP-M, INPC, IPCA e CUB.
- [ ] Lançar alguns meses de histórico, de preferência colando a lista de uma planilha.
- [ ] Escolher o índice e o mês base em uma venda.
- [ ] Conferir nos recebíveis se o valor corrigido bate com a sua planilha.

**Regras aplicadas, confirmar se estão certas:**

- A parcela de setembro corrige pelo índice de agosto, porque o índice sai no mês seguinte.
- Mês negativo entra como 0%, a correção não reduz parcela.
- Parcela vencida congela e passa a responder só por multa e juros.
- Parcela paga congela o valor pago.
- A entrada nunca é corrigida.

**Decidido em 17/09: o índice atrasado vale, mas com aviso.** Se a loteadora esqueceu de
lançar, ela pode lançar depois e o valor da parcela em aberto muda. O que o índice alcança não
mudou: cada parcela é corrigida pelos índices até o mês anterior ao vencimento dela, e só isso.

- A parcela de novembro usa o índice de **outubro**. Lançar o índice de novembro depois não
  mexe nela, nem que esteja vencida — vencida só toma multa e juros.
- Parcela paga fica quitada, sem diferença a cobrar.
- O saldo em aberto segue corrigido mês a mês, porque cada parcela futura carrega o índice
  acumulado até o vencimento dela.

**O que foi construído:** ao lançar, editar ou apagar o índice de um mês que já passou, o
sistema mostra antes de salvar **o que muda, de quanto para quanto**, contrato por contrato,
com o total da diferença. Quem já pagou aparece numa lista à parte, com o aviso de que não
muda e quanto deixou de ser cobrado. Se o lançamento não mexe em parcela nenhuma, salva direto.

- [ ] Testar: lance um mês antigo de propósito e confira a tela de diferença.
- [x] *(lembrete, não é teste)* Lembrar que, se a parcela já virou boleto, o boleto precisa ser refeito.

---

## 5. Antecipação e quitação

- [x] *(testes: antecipacao.test, contra uma tabela Price calculada à parte)* Abrir uma venda e clicar em **💸 Antecipar / quitar**.
- [x] *(testes: antecipacao.test, contra uma tabela Price calculada à parte)* Conferir a tabela **Saldo devedor mês a mês** contra a sua planilha.
- [x] *(testes: antecipacao.test, contra uma tabela Price calculada à parte)* Abrir a **tabela de amortização** e conferir juro do mês, amortização e saldo.
- [x] *(testes: antecipacao.test, contra uma tabela Price calculada à parte)* Testar as três operações: quitar tudo, antecipar as últimas parcelas e amortizar um valor
      livre, nos dois modos, reduzindo prazo e reduzindo parcela.
- [ ] Imprimir o demonstrativo e conferir se está apresentável para o cliente.

**Decidido em 17/09:** o desconto é exatamente o juro cobrado no contrato, sobre os meses que
o cliente não usou. É o que já está implementado. Sem taxa de antecipação e sem teto.

---

## 6. Inadimplência e cobrança

- [ ] Preencher a **chave PIX** em Configurações › Régua de cobrança.
- [ ] Revisar os cinco textos da régua e ajustar ao seu tom.
- [x] *(obsoleto: Cobrança virou item do menu (seção 7l))* Abrir o painel pelo chip **🔔 Cobrança** na aba Recebíveis.
- [ ] Testar uma cobrança de verdade: escolher etapa, editar a mensagem, abrir o WhatsApp e ver
      o registro aparecer no histórico.
- [ ] Conferir o CSV da inadimplência.

---

## 7. ~~Vitrine pública e leads~~ — retiradas em 23/09

Decisão sua: a empresa administra o comercial, quem vende são os corretores. Saíram a tela de
leads, a publicação da vitrine, a página pública (`vitrine.html`) e as duas funções do banco
que atendiam visitante sem login. Um link de vitrine que já tenha sido mandado para alguém
deixa de abrir. As tabelas `vitrines` e `leads` continuam no banco, sem uso, para não apagar
nada que exista; dá para removê-las quando você quiser.

---

## 7b. Permissões por função

- [ ] Em **Configurações › 🔐 Permissões**, revisar o que cada papel pode.
- [ ] Convidar alguém como financeiro e conferir que ele vê recebíveis, despesas, cobrança e
      vendas, mas não vê reservas nem consegue editar lote.
- [ ] Com o financeiro logado, tentar mudar o preço de um lote (Empreendimentos › o
      loteamento › Lotes): tem que dar recusa vinda do banco, não só sumir o botão.
- [x] *(testes: permissoes.test (o item some do menu para quem não tem a permissão))* Testar desmarcar uma permissão e ver a aba sumir para quem tem aquele papel.
- [ ] Gerar um convite e conferir as novas opções de validade e de quantas pessoas podem usar.

---

## 7b2. Categorias de custo divididas

As categorias padrão que juntavam dois assuntos foram separadas. Ao abrir o app, quem já tinha
as antigas recebe a divisão sozinho, e fica registrado no histórico.

| Antes | Agora |
|---|---|
| Água e Esgoto | Água · Esgoto |
| Pavimentação e Drenagem | Pavimentação · Drenagem |
| Documentação e Cartório | Documentação · Cartório |
| Projetos e Licenças | Projetos · Licenças |
| Impostos e Taxas | Impostos · Taxas |
| Marketing e Vendas | Marketing · Vendas |
| Rede Elétrica / Iluminação | continua junta, como você pediu |

- [ ] **Redistribuir o orçamento.** O valor orçado ficou inteiro na primeira das duas: os
      R$ 1.065.418,00 de Água e Esgoto estão todos em **Água**, e Esgoto está zerado. O sistema
      não chuta rateio. Abra Custos › ✏️ e divida do seu jeito. Vale o mesmo para as outras.
- [ ] Conferir se algum lançamento antigo precisa trocar de categoria (o que estava em Água e
      Esgoto foi todo para Água).
- [x] *(informação, não é teste)* Categoria que você mesmo criou ou renomeou não foi tocada.

---

## 7c. Relatórios

- [ ] Abrir a aba **📊 Relatórios** e passar pelos sete: resumo gerencial, espelho de vendas,
      vendas, contas a receber, inadimplência, comissões e despesas.
- [ ] No de despesas, testar os filtros de categoria, fornecedor, situação e data considerada,
      além dos agrupamentos por categoria, fornecedor, mês e lote.
- [ ] Conferir o comparativo de orçado contra realizado.
- [ ] Imprimir um relatório em PDF e conferir se está apresentável.
- [ ] Exportar um CSV e abrir na planilha.

---

## 7d. Cobrança bancária: fluxo mensal, remessa e retorno do Banco do Brasil

**Pronto e conferido contra os seus arquivos** (17/09). Layout CNAB 400, carteira 17, variação
035, convênio de 7 dígitos, conferido posição a posição contra a remessa real; código de barras
e linha digitável idênticos ao boleto impresso.

### Como funciona, no formato do seu ERP

- **Recebíveis › 🧾 Gerar cobranças** — escolhe o mês. Três cartões: **contratos sem índice do
  mês** (o nosso substituto do "contratos a reajustar": lista quem está esperando índice e
  fica de fora até você lançar), **já geradas no mês** e **prontas para gerar**. Botão
  **Simular** imprime o resumo agrupado por cliente sem gerar nada; **Gerar agora** registra as
  parcelas, numera o nosso número e baixa o arquivo de remessa.
- **Aviso no topo da lista** — qualquer cobrança alterada depois de registrada no banco
  (vencimento, valor, índice lançado depois, paga por fora, distrato) aparece como "marcada
  para remessa" até você gerar. A remessa de alteração baixa o título antigo e registra um
  novo; a de pagamento por fora só baixa.
- **📥 Retorno** — lê o arquivo, mostra o que entendeu e só dá baixa depois da confirmação.
- **Configurações › 🏦 Contas bancárias** — convênio, carteira, instruções padrão (multa, juros ao dia,
  desconto, protesto, baixa, mensagens) e histórico de remessas. Multa é por conta e pode ser
  zero: com zero, o registro de multa nem sai no arquivo.

### As posições 23-25 do registro de multa — resolvido

Você tinha razão em não aceitar cópia sem entender. Investiguei em fonte independente: o
gerador de remessa BB de uma biblioteca de código aberto usada em produção (laravel-boleto)
monta o registro de multa como `5` + `99` + código + data + percentual em 011-022, e **brancos
de 023 a 394**. O `090` do seu arquivo é preenchimento do ERP antigo, não campo do banco.
O sistema agora manda brancos, como o layout define.

Pela mesma fonte confirmei as posições do **retorno** (valor recebido 254-266, crédito
176-181, tarifa 182-188, mora 267-279, multa 280-292, motivo da recusa 383-392), que eu tinha
escrito de memória com erro de uma posição em alguns campos.

- [x] *(feito 15/10: você rodou o schema, que é cumulativo e inclui esta mudança)* Rodar o `schema.sql` (entraram `remessas` e as colunas `banco_valor`/`banco_venc`).
- [ ] Ajustar a **multa** em Configurações › Contas bancárias (o arquivo atual é de aluguel, 10%).
- [x] *(decidido por você: faixa alta, a partir de 10.000.000 (seção 7i))* **Escolher a faixa do nosso número — corrigido em 17/09.** Eu tinha dito "comece em
      2637". **Estava errado**: 2636 era só o maior número da única remessa que você mandou, de
      02/09. O boleto que você enviou tem nosso número **1819** e foi processado em 17/09, ou
      seja, *depois* — a numeração do seu ERP não segue ordem de emissão. E a remessa de 02/09
      tem 23 títulos espalhados de 2450 a 2636, com 164 buracos: o Superlógica reserva o número
      quando a cobrança é criada (é o "id interno" que aparece na tela), não quando vai ao banco.

      Conclusão: **não dá para saber onde o sistema antigo está**, e ele continua consumindo
      números enquanto os dois rodarem. Em vez de continuar a contagem, **comece numa faixa
      separada e bem alta — 1000000**. São 10 dígitos disponíveis, quase 10 bilhões: os dois
      nunca se encontram. Se quiser conferir o que já existe no banco, o Gerenciador Financeiro
      tem a relação de títulos em ser, mas ela não mostra os já baixados, então não serve como
      garantia — a faixa separada serve.
- [ ] Gerar uma remessa de teste com poucos títulos e mandar pelo Gerenciador Financeiro.
- [x] ~~Me mandar um retorno com movimento~~ — **feito em 17/09**, três arquivos (08, 09 e
      10/09) com 14 liquidações e uma entrada confirmada. A leitura foi conferida campo a campo
      contra eles: ocorrência, datas, vencimento, valor do título, valor recebido, juros, multa,
      tarifa e data do crédito. Um teste roda em cima dos arquivos de verdade a cada mudança.

      O que os arquivos ensinaram, além de confirmar o layout:

      - O banco cobra **R$ 2,18 de tarifa por título liquidado**. Sai do seu bolso, não da
        parcela. A tela do retorno mostra o total por arquivo, para você lançar como despesa
        bancária se quiser acompanhar.
      - O rodapé traz a **posição da carteira** (títulos em ser e valor). Em 16/09 eram 15
        títulos somando R$ 64.828,35. A tela mostra isso como conferência.
      - O crédito cai **no dia seguinte** ao pagamento.
      - Um título pode ser **registrado e pago no mesmo arquivo** (aconteceu com o 2640 em
        09/09). O sistema trata e não baixa duas vezes.

### O que ainda NÃO foi exercitado contra arquivo real

Tudo que aparece nos seus arquivos está conferido. O que nunca apareceu neles segue sem
conferência, e o sistema agora se recusa a chutar:

- **Códigos de instrução (protestar, baixar automaticamente).** Sua remessa vem com `00 00`,
  ou seja, sem instrução. Eu estava emitindo códigos que deduzi — e um código errado pode
  fazer o banco **protestar um comprador por engano**. Agora só sai o código que você digitar
  em Configurações › Contas bancárias, copiado do manual do seu banco. Em branco, o banco não age sozinho.
  Os campos "protestar após N dias" continuam valendo para o texto impresso no boleto.
- **Desconto e abatimento**: os seus arquivos vêm zerados nesses campos.
- **Ocorrência 03 (recusa)**: nenhum dos quatro retornos tinha recusa. A leitura segue a
  indicação do BB (motivo em 087/088) e está testada com arquivo sintético.

### Outros bancos

Caixa, Bradesco, Sicoob e C6 seguem sem layout: o sistema recusa gerar em vez de gerar errado.
Para cada um preciso de remessa gerada pelo sistema atual, retorno real e um boleto.

Para mandar boleto por e-mail preciso ligar um serviço de envio; por WhatsApp o PDF vai para o
Storage e o link segue na mensagem.

---

## 7e. Empreendimentos e navegação nova

> Substituída pela 7l em 23/09. Continua valendo a ideia de empreendimento e carteira; a barra
> de seis abas virou o menu lateral, e reservas saíram do empreendimento para o menu.

Reorganizado em 17/09, conforme você propôs. O sistema deixa de girar em torno de um
loteamento por vez e passa a gerir **a empresa inteira**.

**Barra de cima, seis abas:** Painel · 🏗️ Empreendimentos · Vendas · Recebíveis · Relatórios ·
Cadastros.

**Aba Empreendimentos** — lista tudo que a empresa toca, com lotes, vendidos, disponíveis,
reservas a aprovar e total vendido. Clicando em um, abre o espaço dele, com sub-abas:

| Resumo | Planta | Lotes | Reservas | Obra e custos | Leads |
|---|---|---|---|---|---|

Ao cadastrar, escolhe-se o tipo:

- **Loteamento** — planta, lotes numerados, reservas pelo corretor.
- **Carteira** — sem planta e sem lotes; cada venda descreve o imóvel (descrição, endereço,
  matrícula). Apartamento, sala, casa, terreno de terceiros. Nela as sub-abas de planta, lotes
  e reservas nem aparecem.

**Vendas, Recebíveis, Relatórios e Painel** passaram a ser da empresa inteira, com um seletor
"Todos os empreendimentos" para restringir quando quiser. A inadimplência, a régua de cobrança
e os relatórios somam tudo.

**A cobrança bancária é por conta bancária, não por empreendimento.** O que o banco exige é
um arquivo de remessa por convênio — isso nunca teve a ver com empreendimento.

- **Uma conta só:** a tela mostra tudo junto, todos os empreendimentos, sem filtro nenhum.
  A coluna "Empreendimento" aparece na lista quando há mais de um.
- **Mais de uma conta:** aparece um seletor de **conta de cobrança** no topo da tela. Cada
  conta gera o seu arquivo, com o seu convênio e a sua numeração de nosso número.
- **O retorno descobre a conta sozinho**, pela agência, conta e convênio do cabeçalho do
  arquivo. Você não escolhe nada.

Em **Configurações › 🏦 Contas bancárias** agora existe uma lista de contas. Cada conta diz o que cobra:
*todos os empreendimentos* (o normal) ou *só o empreendimento X*. Uma venda é cobrada pela
conta do empreendimento dela; se o empreendimento não tiver conta própria, cai na conta geral.

O corretor não muda: continua vendo planta e reservando lote, e carteiras não aparecem para ele.

- [x] *(obsoleto: as abas viraram o menu lateral (seção 7l))* Passear pelas seis abas e conferir que nada sumiu do caminho.
- [x] *(testes: fluxo.test (abre o loteamento, vende um lote) e telas.test)* Abrir um empreendimento e usar planta, lotes, reservas e obra por dentro dele.
- [x] *(testes: novo-contrato.test)* Criar uma carteira e registrar uma venda de imóvel avulso.
- [x] *(testes: telas.test e detalhes.test (mesmos números com e sem filtro))* Ver os recebíveis e os relatórios com todos os empreendimentos juntos, e depois filtrados.
- [ ] Gerar cobranças e conferir que, com uma conta bancária só, sai tudo junto sem perguntar nada.
- [x] *(decidido por você: carteira não tem orçamento (seção 7f))* Decidir se a carteira precisa de orçamento de custos (hoje a tela existe igual).

---

## 7g. Qualificação das partes e do imóvel (novo)

Sem isto não sai contrato, e é também a base da declaração fiscal mais adiante. O motor de
contrato já citava `{{cliente.rg}}`, `{{cliente.nacionalidade}}` e `{{cliente.estadoCivil}}`,
mas o formulário nunca coletou esses campos — saía tudo em branco e ninguém percebia.

**O que testar:**

- [x] *(testes: documentos.test)* Abra uma venda. O bloco do comprador agora tem, além de nome, CPF, telefone e e-mail,
      um **📋 Qualificação completa** que abre: nacionalidade, profissão, estado civil,
      regime de bens, RG com órgão expedidor e endereço em campos separados (CEP,
      logradouro, número, complemento, bairro, cidade, UF).
- [x] *(testes: documentos.test)* O resumo desse bloco diz o que ainda falta — "falta profissão, RG, cidade". É a mesma
      conferência que a declaração fiscal vai exigir depois, então vale preencher já.
- [x] *(testes: documentos.test)* Escolha **estado civil casado** ou **união estável**: aparece sozinho o bloco do
      **cônjuge**, com os mesmos campos e a opção "mora no mesmo endereço" já marcada.
- [x] *(testes: documentos.test)* **Confira a concordância.** Cada pessoa tem um seletor masculino/feminino que controla
      só o texto do contrato: brasileiro/brasileira, casado/casada, portador/portadora.
      Ao trocar a do comprador, a do cônjuge vira sozinha para a oposta — se o casal for do
      mesmo sexo, troque à mão e o sistema não mexe mais nela.
- [ ] Em **Cadastros › Vendedores**, cadastre outro CNPJ do grupo. A empresa das
      Configurações continua sendo o vendedor padrão; a venda pergunta qual deles assina.
      Era o seu caso de incorporadora com vários CNPJs.
- [ ] No lote, abra **📋 Qualificação do imóvel**: descrição conforme a matrícula (copie do
      registro, com as confrontações), e o endereço próprio do lote. Em branco, o contrato
      usa o endereço do empreendimento.
- [ ] No empreendimento, **📋 Endereço e registro**: CEP, logradouro, bairro, UF, cartório de
      registro, matrícula mãe e código do município no IBGE (este só a declaração fiscal usa;
      pode ficar para depois).
- [x] *(testes: documentos.test)* Gere um contrato de uma venda já qualificada e leia o parágrafo das partes. Ele sai
      assim: *"FULANO, brasileiro, casado sob o regime da comunhão parcial de bens, corretor
      de imóveis, portador da cédula de identidade RG nº X SSP/SC, inscrito no CPF sob o nº
      Y, residente e domiciliado na Rua Z, nº 10, Centro, CEP 88800-000, Criciúma/SC, e sua
      esposa BELTRANA, brasileira, professora, …, residente e domiciliada no mesmo endereço"*.
- [x] *(testes: documentos.test)* O contrato agora tem linha de assinatura do cônjuge quando existe cônjuge.

**Atenção, uma coisa que eu não faço sozinho:** o modelo padrão de contrato mudou para usar
`{{vendedor.qualificacao}}`, `{{comprador.qualificacao}}` e `{{imovel.descricao}}`. **Se você
já editou o seu modelo em Configurações › Modelos de documento, o seu texto não é tocado** — ele continua
com os campos antigos, que seguem funcionando. Para aproveitar os novos, entre no modelo e
troque os parágrafos das partes por esses três campos; a lista de campos à direita já os
mostra.

**Mais de uma parte de cada lado** (feito depois que você confirmou que acontece):

- [x] *(testes: documentos.test)* No comprador há um botão **＋ Adicionar comprador**: dois irmãos, dois sócios, pai e
      filho. Cada um ganha o bloco inteiro de qualificação, com o seu próprio cônjuge, e
      pode ser removido no 🗑. Marido e mulher **não** precisam de dois blocos — para isso é
      o estado civil e o cônjuge.
- [ ] No vendedor há **＋ Adicionar vendedor**, quando duas empresas do grupo assinam a mesma
      venda. Escolher o mesmo vendedor duas vezes não duplica.
- [x] *(informação, não é teste)* O **primeiro** comprador continua sendo quem aparece nas telas de venda, recebível,
      cobrança e boleto — só ele tem telefone obrigatório. Os demais existem para o contrato.
      Na tela da venda aparece "e mais 1" e a lista dos demais.
- [x] *(testes: documentos.test)* No contrato as partes saem separadas por ponto e vírgula, com "e" antes da última, e
      **cada uma ganha a sua linha de assinatura**, mais uma linha para cada cônjuge.

Para isso o bloco de assinaturas do modelo padrão passou a usar `{{assinaturas.vendedores}}`
e `{{assinaturas.compradores}}`, que montam as linhas sozinhos para quantas partes existirem.
Se o seu modelo já estava editado, ele continua com as linhas fixas de antes — funcionam,
mas só imprimem a primeira parte de cada lado.

---

## 7h. Primeira rodada de testes seus (18/09) — o que mudou

Vinte apontamentos seus. Todos atendidos; três eu resolvi diferente do pedido literal e
explico por quê.

**Venda**

- [x] *(testes: documentos.test)* A qualificação **abria recolhida** e você não viu que os campos existiam — parecia que
      o sistema presumia brasileiro e casado. Agora abre visível. Nacionalidade sempre foi
      campo digitável (vem sugerido "brasileiro") e estado civil sempre foi lista com
      solteiro, casado, união estável, divorciado, separado e viúvo.
- [x] *(testes: documentos.test)* **Nome, CPF, RG, profissão, estado civil, nacionalidade, endereço e cidade viraram
      obrigatórios.** Salvar sem eles é recusado, dizendo qual falta e levando a tela até o
      comprador certo. Vale para cada comprador da lista.
- [x] *(testes: novo-contrato.test)* **Corretor**: o sistema pergunta *"O negócio foi intermediado por corretor de
      imóveis?"*. Só no "Sim" aparecem os campos, agora com a qualificação inteira mais
      CRECI, que é obrigatório. No "Não" a comissão vai a zero.
- [x] *(testes: novo-contrato.test)* **Pagamento à vista**: nova opção. Escolhendo, somem entrada, parcelas, juros, índice e
      reforços, e o valor inteiro entra como uma parcela só.
- [x] *(testes: novo-contrato.test)* **Número de parcelas**: virou campo de texto com teclado numérico, sem as setinhas.
      Aqui eu não consegui reproduzir o travamento que você viu — digitando no meu teste o
      campo aceitava normalmente. Mudei o tipo do campo, que é de onde esse tipo de
      comportamento costuma vir. **Confirme se resolveu.**
- [x] *(testes: novo-contrato.test)* **Salva a venda, o sistema pergunta se emite o contrato** e abre a tela para conferir.
- [x] *(testes: novo-contrato.test)* **Sem índice cadastrado**, a venda avisa e leva ao cadastro, em vez de mostrar um
      seletor vazio.

**Cadastros**

- [ ] A aba **Vendedores virou 🏢 Dados da empresa** e reúne três coisas: a empresa (razão
      social, CNPJ, inscrição estadual, telefone, e-mail e endereço em campos separados),
      **quem assina** e os outros CNPJs do grupo. O cartão que ficava em Configurações saiu
      de lá.
- [ ] **Quem assina virou lista**, porque contrato social costuma exigir duas assinaturas.
      Cada signatário tem qualificação completa, com RG, endereço e cargo.
- [ ] **O editor de modelo abre em tela cheia**, com a paleta de campos numa coluna ao lado.

**Banco — dois pedidos que eu resolvi diferente, e o porquê**

- [x] *(informação, não é teste)* **Nosso número saiu do cadastro**: o sistema numera sozinho, começando em
      **10.000.000**. Você pediu número *aleatório* e perguntou a chance de repetir; a conta
      está na seção 7i. Resumo: sequencial não tem probabilidade de colisão nenhuma, e a
      faixa alta serve para ficar longe do sistema antigo, que estava na casa dos milhares.
      Conta que já vinha numerando continua de onde estava; conta cadastrada mas que ainda
      não emitiu boleto acompanha o piso novo.
- [x] *(informação, não é teste)* **Códigos de instrução saíram da tela.** Você perguntou o que fazem: são o comando para
      o banco **agir sozinho** depois do vencimento — protestar em cartório, baixar o título,
      negativar. Cada banco tem os seus códigos. **Zerados, o banco não faz nada por conta
      própria**: o boleto fica registrado, o cliente pode pagar depois do vencimento com
      multa e juros, e ninguém é protestado. É exatamente como a remessa que a sua empresa
      manda hoje já vem (`00 00`), e é o comportamento seguro — código errado protesta um
      comprador por engano. Os dias de protesto continuam saindo **impressos no boleto**,
      como aviso. Se um dia você quiser protesto automático de verdade, isso se liga junto
      com o seu gerente, com o manual na mão.

**Índices**

- [ ] **Tela nova, no formato que você mandou**: navegação por ano (‹ 2025 · 2026 · 2027 ›) e
      os doze meses numa tabela só, com o valor ao lado. Aceita vírgula. Enter desce para o
      mês seguinte. Trocar de ano não perde o que você digitou — tudo salva junto.
- [ ] **No topo da tela de índices** entrou o painel de **acumulado dos últimos 12 meses** por
      índice, como no sistema que você usa hoje, com aviso de qual mês falta lançar.

**Painel e recebíveis**

- [x] *(obsoleto: o Início foi refeito em 29/09 (seção 7s))* Saíram do painel os **próximos vencimentos** e a **atividade recente**.
- [x] *(informação, não é teste)* **Recebíveis abre no mês corrente.** Para ver tudo, o seletor de mês tem "Todos os
      meses"; o extrato completo de um contrato fica na tela da venda. **Atenção:** no filtro
      **Atrasados** o mês é ignorado de propósito — parcela vencida em julho continua
      atrasada em setembro, e esconder isso seria pior.

**Antecipação e quitação**

- [x] *(testes: antecipacao.test, contra uma tabela Price calculada à parte)* "Juros não usados" virou **Desconto**.
- [x] *(testes: antecipacao.test, contra uma tabela Price calculada à parte)* Saiu a projeção de quitação dos próximos meses: fica só **o valor do mês vigente**,
      válido até o último dia do mês, que é como o cálculo é feito.
- [x] *(testes: antecipacao.test, contra uma tabela Price calculada à parte)* A mensagem de WhatsApp diz **"para quitar até o último dia do mês"**.
- [x] *(testes: antecipacao.test, contra uma tabela Price calculada à parte)* **Amortização parcial**: no modo "reduzir prazo" o cliente pode pagar qualquer valor —
      10, 100, 1000. O sistema quita as parcelas inteiras que o dinheiro fecha e **amortiza em
      parte a parcela seguinte, que continua em aberto com o saldo**. O pedaço pago adiantado
      ganha o mesmo desconto que a parcela inteira ganharia. No extrato aparecem duas linhas:
      a amortização, quitada na data do pagamento, e a parcela original com o saldo — que
      continua sujeita à correção do índice, como qualquer saldo devedor. **Confira esse
      cálculo contra a sua planilha**, é o ponto mais delicado desta rodada.

**Distrato**

- [x] *(testes: contrato.test (Excluir no menu Mais) e despesas.test (exclusão com EXCLUIR))* Como combinado, o distrato saiu e virou **🗑️ Excluir contrato**, em duas etapas: a
      primeira tela mostra quantas parcelas somem, quanto já foi recebido e que o lote volta a
      ficar disponível; a segunda pede que você escreva **EXCLUIR**. Se o contrato tiver
      pagamento registrado, o aviso é explícito: esse dinheiro some dos relatórios. Tire um
      backup antes, em Cadastros › Backup.

---

## 7i. Nosso número: a conta que você pediu (18/09)

Você perguntou qual a chance de sortear e repetir. A conta, com os 10 dígitos livres que o
BB dá no convênio de 7 dígitos (10 bilhões de números):

| Boletos emitidos | Chance de ao menos uma repetição |
|---|---|
| 1.000 | 0,005% |
| 10.000 | 0,5% |
| 36.000 | 6,3% |
| 100.000 | 39% |
| 118.000 | 50% |

Trinta e seis mil boletos é um loteamento de 300 lotes em 120 parcelas — não é cenário
distante. **Mas isso vale para sorteio cego.** Conferindo na própria base antes de usar, a
repetição comigo mesmo vira zero. O "recusa certa" que eu disse antes estava mal colocado.

O motivo de verdade para o sequencial é outro: rastreabilidade. Buraco na sequência significa
alguma coisa, dá para conferir contra a relação de títulos em ser do banco, e reconciliar
retorno com remessa fica legível. Além disso eu sei que o banco recusa número repetido que
ainda está **em aberto**; o que ele faz com um já **baixado** anos atrás eu não sei, e
pagamento indo para o título errado é pior que recusa.

**Decidido por você: faixa alta.** O piso subiu de 1.000.000 para **10.000.000**. O seu ERP
antigo estava na casa dos milhares nos arquivos que você mandou; nesse ritmo ele levaria
décadas para chegar aqui, e ainda sobram 9,99 bilhões de números.

**Duas correções que saíram desta conversa** (as duas eram defeitos de verdade):

- A marca d'água somava os números de **todas** as contas bancárias. A unicidade é por
  convênio: uma conta não pode empurrar a numeração da outra. Agora cada conta tem a sua.
- O recebível passou a **gravar qual conta o numerou**. Antes, trocar a conta de um
  empreendimento fazia um número emitido por um convênio contar para outro. Isso pede uma
  coluna nova no banco (`recebiveis.conta_id`) — **rode o `schema.sql` de novo.**
- [ ] Título **recusado** pelo banco agora queima o número na marca d'água da conta antes de
      soltar a parcela: ele nunca volta a ser usado, mesmo que o histórico de remessas seja
      limpo. A parcela volta a "não registrada" e entra na próxima remessa com número novo.
      Continua sem teste contra arquivo real — falta um retorno seu com ocorrência 03.

---

## 7j. Defeito do vídeo de 21/09 — corrigido

**O que você viu:** do painel, clicando no alerta de parcelas em atraso, a tela vai para a
cobrança; lá, os botões **Em aberto · Atrasados · Pagos · Todos** não respondiam a nada.

**O que era:** o filtro dos recebíveis só era criado quando a *lista* era desenhada. Entrando
direto na cobrança — que é o que o alerta do painel faz — a lista nunca foi desenhada, então o
filtro não existia, e o clique tentava mexer num objeto inexistente. O erro acontecia em
silêncio, dentro do `onclick`, e nada na tela mudava: por isso parecia travado.

**Corrigido:** o filtro passa a nascer numa função só, chamada por todos os caminhos — pela
lista, pela cobrança e pelo alerta do painel. Os botões dos dois lugares agora usam a mesma
rota de volta para a lista.

- [ ] Refazer o caminho do vídeo e confirmar: painel › alerta de atraso › cobrança › clicar em
      cada um dos quatro filtros.
- [x] *(obsoleto: o chip saiu, Cobrança é item do menu)* Testar também o contrário: da lista, chip 🔔 Cobrança, e voltar.

O `test24` cobre esses caminhos. Conferi que ele **falha** no código antigo e passa no novo —
teste que passa nos dois não prova nada.

---

## 7k. Numeração da planta uniforme (22/09)

**O que você viu:** na planta real, os números dos lotes saíam de tamanhos diferentes — lote
de fundos com número enorme, lote estreito com número quase ilegível.

**O que era:** cada número era dimensionado pelo próprio lote. Nos seus dados isso dava uma
variação de **9 vezes** entre o menor e o maior número na mesma planta.

**Corrigido:** a planta inteira passa a usar um corpo só, calculado a partir do **lote típico**
(a mediana), com piso e teto. Metade dos lotes cabe com folga e os menores ficam com o número
um pouco maior que a testada — que é como o projetista desenha também. Ancorei na mediana e
não no menor lote de propósito: bastaria um lote residual espremido para deixar a numeração da
planta inteira ilegível.

Vale para as duas telas, porque o desenho da planta é o mesmo código: administração e corretor.

- [ ] Abrir a planta do Hessen e conferir se a numeração ficou uniforme e legível.
- [ ] Conferir também na tela do corretor.
- [x] *(só se precisar ajustar)* Se ficar pequena demais na sua planta, me diga: o piso e o teto são dois números, ajusto
      na hora.

Em **esquemática** a numeração já era uniforme, porque ali todos os blocos têm o mesmo tamanho.
O `test25` cobre os dois modos; no modo planta real ele falha no código antigo e passa no novo.

---

## 7l. Menu lateral e nova organização (23/09) — Fase 1 de 6

A barra de abas em cima virou um **menu lateral**, agrupado pelo que você faz no dia:

| Grupo | Itens |
|---|---|
| — | 🏠 Início |
| Comercial | Empreendimentos · Reservas · Corretores |
| Contratos | Todos os contratos · ＋ Novo contrato |
| Financeiro | A receber · Cobrança · Boletos e banco · A pagar · Índices |
| — | 📊 Relatórios · ⚙️ Configurações |

O que mudou de lugar:

- **Reservas** saíram de dentro do empreendimento e viraram a fila da empresa inteira, com o
  filtro de empreendimento no topo. O número vermelho no menu é o que espera aprovação.
- **Cobrança** deixou de ser um chip dentro de Recebíveis e virou tela própria. O alerta de
  atraso do Início leva direto para ela.
- **Boletos e banco** é novo: o que está pronto para gerar no mês, os botões de gerar
  cobranças e ler o retorno, as alterações que ainda não foram ao banco e o histórico de
  remessas de cada conta.
- **A pagar** junta as despesas de todos os empreendimentos, com o nome de cada um na linha.
  Escolhendo um empreendimento no filtro, aparece o orçado × realizado dele. Dentro do
  empreendimento a aba continua, com o nome **Obra e orçamento**.
- **Índices** e **Corretores** saíram das configurações e foram para o menu, porque são rotina.
- **Configurações** ficou só com o que se ajusta uma vez: Equipe, Dados da empresa,
  Permissões, Categorias, Modelos de documento, Contas bancárias, Régua de cobrança, Geral,
  Nuvem/Conta e Backup.
- No topo aparece o nome da **empresa**, não mais o de um empreendimento.
- No celular o menu vira gaveta (botão ☰) e fecha sozinho ao escolher.
- O menu já respeita as permissões: item sem permissão some, e o título do grupo some junto
  quando todos os itens dele somem. As permissões passaram a ser ajustáveis pessoa a pessoa na Fase 6 (7z8).
- Cores ficam como estão; a identidade visual vem depois.

Para conferir:

- [x] *(testes: telas.test (abre as 20 telas do menu, administração e corretor))* Passar por cada item do menu e ver se a tela abre no lugar certo.
- [x] *(testes: reserva.test)* Aprovar uma reserva pelo item **Reservas**.
- [x] *(testes: despesas.test)* Lançar uma despesa por **A pagar** (o formulário pergunta de quem é) e ver ela aparecer
      também dentro do empreendimento, em Obra e orçamento.
- [ ] Abrir **Boletos e banco** e gerar as cobranças do mês por ali.
- [ ] No celular, abrir e fechar a gaveta do menu.

Próximas fases, na ordem combinada: **2** contrato como página própria, com número
sequencial · **3** cadastro de clientes · **4** despesas da empresa com vínculo opcional
(empresa, empreendimento ou carteira › imóvel — feita, 7z9) · **5** Início com a rotina do mês · **6**
permissões por funcionário, definidas por você e garantidas também no banco.

`test26` cobre o menu: cada item abre só a sua tela, Boletos com e sem conta, A pagar da
empresa inteira, lançar despesa pelo menu, reservas, permissões escondendo item e grupo, e a
gaveta no celular sem rolagem lateral. As outras 17 suítes e os testes do banco passam.

---

## 7z11. Plantas fechadas: só quem é da empresa abre (15/10)

Antes, a imagem da planta ficava num endereço público: quem tivesse o link abria, mesmo sem
conta. Agora a planta só abre para quem é **membro da empresa**, ou seja, quem entrou pelo
**convite da construtora**: dono, administrador, financeiro e corretores convidados.

- Para mostrar a planta, o app pede ao banco um **link que vence em uma hora**, e só entrega
  esse link para quem é da empresa. Link antigo, copiado ou mandado por WhatsApp, deixa de
  abrir.
- Quem não é da empresa, o visitante sem login e a pessoa **desativada** na equipe não
  conseguem abrir. Uma empresa não grava na pasta de outra.
- As plantas que você já enviou continuam valendo, sem precisar enviar de novo: o app
  reconhece o endereço antigo e pede o link novo do mesmo arquivo.
- O aplicativo instalado deixou de guardar no aparelho o que vem da nuvem (dados e
  plantas). Só os arquivos do próprio app ficam guardados, para abrir sem internet.
- No modo local (sem nuvem), nada muda: a planta fica no próprio aparelho.

**⚠ Rode o `supabase/schema.sql` de novo no Supabase.** É ele que fecha a pasta das plantas.
Enquanto não rodar, a planta continua abrindo como antes.

- [ ] Rodar o `supabase/schema.sql`.
- [ ] Abrir a planta como administrador e como corretor convidado: ela aparece.
- [ ] Copiar o endereço da imagem da planta (botão direito › copiar endereço da imagem) e abrir
      numa janela anônima depois de uma hora: não abre.

`testes/plantas-privadas.test.js` confere o app (link assinado, reaproveitamento, endereço
antigo, falha sem quebrar a tela, corretor, modo local). O teste do banco confere quem abre e
quem não abre o arquivo.

---

## 7z10. Testes de contas, documentos e novo contrato — 5 defeitos corrigidos (15/10)

Três testes automáticos novos tiraram do roteiro o que dava para conferir sem você:

- **`antecipacao.test`**: contrato de R$ 100.000,00 a 1% ao mês em 12 parcelas. Cada número
  é comparado com uma tabela Price feita à parte, fora do sistema: quitar hoje, tabela de
  amortização linha a linha, antecipar as últimas, amortizar R$ 20.000 reduzindo o prazo ou
  mantendo o prazo, parcela vencida com multa e juros, contrato sem juros, e a tela, o
  WhatsApp e o demonstrativo com os mesmos números.
- **`documentos.test`**: valores e datas por extenso, qualificação no feminino, cônjuge,
  união estável, várias partes, empresa com dois representantes, a parcela da proposta com
  reforço anual, o contrato gerado pela tela, e a prévia editada indo para a impressão.
- **`novo-contrato.test`**: o formulário inteiro, no celular e no computador.

**O que eles acharam, e já está corrigido:**
- **Gerar o contrato apagava o cônjuge da venda.** O formulário do contrato não mostrava os
  campos do cônjuge, e "Guardar esses dados no cadastro da venda" (que vem marcado) gravava
  a venda sem ele. O contrato também saía sem a linha de assinatura do cônjuge. Agora os
  campos aparecem, e um formulário que não tem o bloco do cônjuge mantém o que estava
  gravado, em vez de apagar. **Se você gerou contrato de comprador casado pela tela, abra a
  venda e confira se o cônjuge continua lá.**
- **Contrato com índice saía com duas "CLÁUSULA TERCEIRA"** (a da correção e a do atraso).
  A correção virou "Parágrafo único" da cláusula do preço, e a numeração ficou certa com ou
  sem índice. Vale para o modelo padrão; se você já salvou um modelo seu, confira a numeração
  dele.
- **R$ 0,50 por extenso saía "zero reais e cinquenta centavos"**; agora sai "cinquenta
  centavos".
- **Dia 1 saía "1 de outubro"**; agora sai "1º de outubro", como se escreve em contrato.
- **A última linha da tabela de amortização podia mostrar saldo de −R$ 0,02**, por causa do
  arredondamento da parcela. A última parcela agora fecha o saldo em zero, como numa
  planilha bem montada.

---

## 7z9. Fase 4: despesas da empresa, do empreendimento ou de um imóvel (15/10)

Antes toda despesa precisava ser de um empreendimento — aluguel do escritório, salários e
contador não tinham onde entrar. Agora, ao lançar, o primeiro campo é **De quem é a despesa**:

- **Empresa** — escritório, pessoal, contador… Não pertence a nenhum empreendimento.
- **Um empreendimento** — e, se quiser, **um imóvel dele**: um lote do loteamento ou, numa
  carteira de imóveis de terceiros, o imóvel do contrato (IPTU, conserto, taxa de transferência).

Onde aparece:
- **Financeiro › A pagar** ganhou os filtros **Todas as despesas · Só da empresa · Só de
  empreendimentos**. Cada linha diz de quem é (as da empresa com a marca **Empresa**).
  **Lançar** já vem com a escolha do filtro.
- **No contrato**, o resumo tem o cartão **Despesas deste imóvel**, com total, quanto falta
  pagar e o botão **+ Despesa**, que já abre o formulário no imóvel certo.
- **Relatório de despesas**: nova coluna **De quem** e o agrupamento **Empresa ou
  empreendimento**.
- **Orçado × realizado** da obra **não conta** despesa da empresa — orçamento é da obra.
- O Início (a pagar no mês), o fluxo de caixa e o resumo gerencial continuam somando tudo.
- Excluir um contrato ou um lote **não apaga** a despesa ligada a ele: ela fica no
  empreendimento, só sem o vínculo.

**⚠ Rode o `supabase/schema.sql` de novo no Supabase** (SQL Editor › colar › Run). Ele deixa
a despesa sem empreendimento e cria o vínculo com o contrato. Enquanto não rodar, a nuvem
recusa salvar despesas (falta a coluna nova).

- [x] *(feito por você em 15/10)* Rodar o `supabase/schema.sql` de novo no Supabase.
- [x] *(testes: despesas.test)* Lançar o aluguel do escritório como **Empresa** e ver em A pagar › Só da empresa.
- [x] *(testes: despesas.test)* Lançar uma despesa para um lote e outra para um imóvel da carteira; abrir o contrato e
      ver o cartão **Despesas deste imóvel**.
- [x] *(testes: despesas.test)* No relatório de despesas, agrupar por **Empresa ou empreendimento**.

`testes/despesas.test.js` cobre tudo isso no celular e no computador; o teste do banco
(`testes/permissoes-banco.test.mjs`) confere a despesa sem empreendimento e a ligada ao contrato.

---

## 7z8. Fase 6: permissões pessoa a pessoa (15/10)

Antes as permissões eram só por função (administrador, financeiro, corretor). Agora você
ajusta **cada pessoa** em cima do padrão da função dela.

- Em **Configurações › Equipe**, toque na pessoa e depois em **Permissões**. Cada opção mostra
  se segue o **padrão** da função ou foi **ajustada**. Salvar grava só o que ficou diferente.
- Quem tem ajuste aparece na lista com a marca **permissões próprias**; em **Configurações ›
  Permissões** (agora "Padrão de cada função") aparece a lista dessas pessoas.
- Mudar o padrão de uma função continua valendo para tudo o que não foi ajustado na pessoa.
- **Voltar ao padrão** apaga os ajustes da pessoa.
- O **dono** sempre pode tudo; **ninguém ajusta as próprias permissões** (para não se trancar
  fora); **corretor** usa a área dele — para dar acesso ao escritório, mude o papel dele.
- Para o financeiro, editar lotes, planta e preços aparecem travados: o banco de dados não
  libera isso para essa função, então marcar não teria efeito.

**Também no banco de dados** (decisão de 15/10, pensando no Lotifly como produto): o banco
confere os ajustes de cada pessoa nas ações que mexem com dinheiro e contratos — quem tiver a
permissão desligada é recusado mesmo que tente gravar por fora do aplicativo:
- registrar e estornar pagamentos; antecipar e quitar;
- registrar, editar, excluir contrato e fazer distrato; marcar comissão;
- lançar e editar despesas;
- mudar permissões e equipe (ninguém muda as próprias); alterar configurações; restaurar backup.
O que é só "ver uma tela" continua por função (o financeiro já enxerga esses dados).

**⚠ Para valer, rode o `supabase/schema.sql` de novo no Supabase** (SQL Editor › colar › Run).
Enquanto não rodar, tudo funciona como antes, com a trava por pessoa só no aplicativo.

- [x] *(testes: permissoes.test (ajuste, pessoa logada, voltar ao padrão))* Em Equipe, ajustar as permissões de uma pessoa (ex.: tirar "Registrar cobranças"), pedir
  para ela entrar e ver que a opção sumiu.
- [x] *(testes: permissoes.test)* Voltar ao padrão e conferir que a opção voltou.
- [x] *(feito 15/10: você rodou o schema, que é cumulativo e inclui esta mudança)* Rodar o `supabase/schema.sql` de novo no Supabase.

`testes/permissoes-banco.test.mjs` roda o schema inteiro num Postgres de teste e confere, como
cada pessoa, o que o banco aceita e recusa. `testes/permissoes.test.js` simula uma equipe (dono, administradora, financeiro, corretor) só
no navegador e confere tudo isso.

---

## 7z7. Planta: situação por desenho, legenda à vista e teclado (15/10)

- **Situação também por desenho**, não só pela cor: vendido com listras, reservado com pontos,
  indisponível com xadrez; disponível fica liso. Quem não distingue verde de vermelho (ou
  imprime em preto e branco) vê a diferença. As cores continuam as mesmas.
- **Legenda dentro da planta**, no canto de baixo — no celular ela ficava abaixo da tela.
- **Botões de zoom não cobrem mais lotes**: ao enquadrar, a planta deixa livre a coluna dos
  botões e a faixa da legenda (antes o lote A5 ficava escondido no celular).
- **Teclado**: a planta é uma parada só no Tab; as setas andam de lote em lote (com um contorno
  escuro no lote atual), Enter abre, + e − aproximam, 0 enquadra. O leitor de tela fala o lote
  ("Quadra A · Lote 5 — Reservado — 325 m² — R$ …"; preço de vendido só se a configuração deixar).
- A lista de lotes ao lado da planta do administrador usa as mesmas amostras com desenho.

- [ ] No celular: abrir a planta e conferir se a legenda e os desenhos ficaram claros.

`testes/planta.test.js` confere tudo isso no celular e no computador, para corretor e
administração.

---

## 7z6. Cabeçalho do contrato mais limpo (15/10)

Antes eram 6 botões soltos (Editar, Antecipar / quitar, Contrato, Extrato, Enviar resumo,
Excluir), dois verdes, com Excluir ao lado de Enviar resumo; no celular ocupavam três linhas.

Agora:
- **Registrar pagamento** é o único botão de destaque: abre direto a próxima parcela em aberto
  do contrato. Some quando o contrato está quitado ou distratado.
- **Documentos ▾**: Contrato, Extrato e Enviar resumo pelo WhatsApp.
- **Mais ▾**: Editar contrato, Antecipar / quitar e, separado por uma linha e em vermelho,
  Excluir contrato (que continua pedindo confirmação).
- No celular: Voltar, Documentos e Mais numa linha; Registrar pagamento ocupa a linha de baixo
  inteira, perto do polegar.
- Os menus fecham ao escolher uma opção, ao clicar fora ou com Esc, e abrem para o lado em que
  cabem na tela.

- [x] *(testes: contrato.test, no celular e no computador)* No celular: abrir um contrato e registrar um pagamento pelo botão do topo.

`testes/contrato.test.js` confere tudo isso no celular e no computador.

---

## 7z5. Inadimplência com um número só (15/10)

A % de inadimplência agora é a mesma em todo o sistema, com a definição que você escolheu:
**das parcelas que vencem no mês, quanto do valor já venceu e não foi pago, sobre o valor de
todas elas** (só o principal, sem multa e juros, sem contratos distratados).

- **Início**, cartão "Em atraso": "X% das parcelas do mês em atraso (R$ a de R$ b)".
- **Cobrança** (Financeiro › Cobrança): o cartão passou a se chamar "Inadimplência do mês" com
  a mesma %; antes era "1,4% da carteira a receber". O "Em atraso" mostra o mesmo valor do
  Início (o principal, ex.: R$ 6.910,00) e, embaixo, "com multa e juros R$ 7.153,00" — antes
  mostrava só o valor com multa e juros, e os dois números não batiam.
- **Relatório de Inadimplência**: o mesmo cartão "Inadimplência do mês".
- O gráfico "Recebido × inadimplência (12 meses)" já seguia a mesma regra mês a mês.

A conta mora num lugar só (`inadimplenciaDoMes`, em financeiro.js), então as três telas não
voltam a divergir. `testes/detalhes.test.js` confere que Início, Cobrança e Relatório mostram o
mesmo número.

---

## 7z4. Reserva: pedido enxuto e aprovação refeita (15/10)

**Pedido do corretor (celular)**: só o essencial, como você decidiu.
- Do cliente, só **nome e telefone**; CPF, e-mail e cidade ficam recolhidos como opcionais.
  Profissão, estado civil e endereço saíram: o escritório pede no contrato.
- Depois a **proposta** (valor, entrada, parcelas, observações).
- Os **dados do próprio corretor** vêm do perfil numa linha ("Corretor: Ana Paula · SC-54321 ·
  alterar"); só abrem na primeira vez ou se faltar algo.
- **Sem sinal**: o pedido não se perde. Fica guardado no celular e volta preenchido quando ele
  abrir a reserva do mesmo lote, com o aviso "Recuperamos o pedido que não chegou a ser enviado".

**Aprovação (escritório)**
- A **proposta vem primeiro**, comparada com a tabela: "−3,2% da tabela (R$ 184.500,00)",
  "10,0% do valor · mínimo 10%", "60× R$ 2.555,77 · tabela Price, 0,80% a.m. · máximo 120×".
  Se a entrada estiver abaixo do mínimo ou o prazo acima do máximo, aparece um aviso amarelo.
- Rodapé com **só Recusar e Aprovar**. Converter em venda, Renovar prazo, Editar dados e o
  WhatsApp do corretor ficam numa linha de "Outras ações".
- **Depois de aprovar**, a janela continua aberta com "Reserva aprovada, válida até…", o botão
  **Avisar o corretor** (WhatsApp com a mensagem pronta) e **Desfazer**.
- **Recusar** e **Liberar o lote** pedem o motivo dentro da janela; **Renovar prazo** mostra a
  nova validade antes de confirmar. Não aparece mais a caixinha do navegador.
- Reserva aprovada: a ação principal vira Converter em venda.

- [x] *(testes: reserva.test, no celular)* No celular: pedir uma reserva com o perfil preenchido e ver que só pede nome, telefone e
  proposta.
- [x] *(testes: reserva.test (Avisar o corretor e Desfazer))* No computador: aprovar, tocar em "Avisar o corretor" e conferir a mensagem no WhatsApp.

`testes/reserva.test.js` faz o caminho inteiro (pedido no celular → aprovar, desfazer, recusar
com motivo, renovar prazo) e falha se aparecer qualquer caixa do navegador.

---

## 7z3. Revisão final antes de publicar (15/10)

**Corrigido**
- **Parcela da reserva**: na aprovação, o escritório via uma parcela sem juros (ex.: 60× R$
  2.023,50), enquanto o corretor tinha mostrado ao cliente a parcela da tabela Price (60× R$
  2.555,77). Agora a reserva guarda os juros e as duas telas mostram o mesmo número, com "tabela
  Price, 0,80% a.m.". A mensagem de WhatsApp para o administrador também leva a parcela.
- **A receber**: o número de cada filtro (Em aberto, Pagos…) agora conta o mesmo que a lista
  mostra no mês escolhido.
- **Teclado e leitor de tela** (sem mudar nada do que se vê):
  - tudo o que se toca agora também funciona com Tab e Enter;
  - botões só com ícone têm nome;
  - os rótulos estão ligados aos campos (clicar no rótulo põe o cursor no campo);
  - o foco do teclado fica dentro da janela aberta e volta ao botão que a abriu;
  - há "Pular para o conteúdo";
  - os títulos estão em ordem e as regiões da página estão marcadas.
  A auditoria automática (axe) passou de 6 tipos de problema para nenhum, em 13 telas.
- Selo de situação com letra maior (11px); texto de exemplo nos campos e número de vendidos na
  tela de entrada com contraste suficiente.
- Busca com "…" no texto de exemplo; aviso do navegador ao recarregar com uma janela de cadastro
  preenchida pela metade.

**Avaliação de design (24/40, "aceitável")**: o conteúdo é muito bem feito para o mercado; o
que mais pesa:
- "Inadimplência" tem dois números diferentes (Início × Cobrança);
- a aprovação de reserva esconde a proposta e tem 6 botões;
- o formulário de reserva do corretor tem 14 campos;
- o cabeçalho do contrato tem 6 botões.
O relatório completo está em `.impeccable/critique/`.

- **Início, cartão "Em atraso"** (decisão sua, 15/10): mostra a % em atraso **do mês** — das
  parcelas que vencem neste mês, quanto do valor já venceu e não foi pago, sobre o valor de
  todas elas. O valor grande continua sendo o atraso total, de todos os meses. No começo do mês
  a % é baixa e sobe conforme as parcelas vencem sem pagamento.
- [x] Cobrança e Relatório de Inadimplência alinhados com o Início (7z5).
- [x] Reserva do corretor só com o essencial e aprovação refeita: ver 7z4.

Testes no projeto: `testes/fluxo.test.js` (entrar, abrir loteamento, vender, registrar
recebimento — no iPhone e no computador), `testes/acessibilidade.test.js` (axe), além de
`detalhes` e `telas`.

---

## 7z2. Detalhes e movimento (15/10)

Pedido seu: revisar sombras, bordas, carregamento, telas vazias e o retorno ao salvar; e pôr
movimento só onde ajuda a entender, respeitando "reduzir movimento" do sistema.

**Movimento (só nestes três lugares)**
- **Janelas no computador**: entram subindo 6 px e saem encolhendo um pouco, em 0,2 s; o
  fundo escurece e clareia junto. Antes abriam com um salto e fechavam de estalo. No celular a
  gaveta com mola continua como estava.
- **Troca de situação do lote**: na planta o lote passa da cor antiga para a nova e ganha um
  contorno que se desfaz; na lista, a linha fica tingida da cor nova por um instante. Vale
  também quando a mudança vem de outra pessoa pela nuvem. Mudança em massa (importação) não
  pisca nada.
- **Pagamento recebido**: a linha da parcela fica verde por um instante, os totais que mudaram
  (Recebido, A receber) ganham o mesmo tom, e o aviso agora é verde e diz de quem e qual
  parcela foi ("João da Silva · Parcela 9/60 · R$ 1.901,33").

Com **reduzir movimento** ligado: nada desliza nem encolhe; janelas e avisos só aparecem e
somem; as cores que mudam continuam (ajudam a entender e não são movimento).

**Detalhes**
- Sombras só no que flutua (janela, aviso, dica do gráfico, botão +), em duas camadas suaves;
  a janela do computador tinha a sombra virada para cima, de gaveta.
- Carregando ("Carregando…", "Lendo o arquivo…") tinha a ampulheta parada, igual a uma tela
  vazia. Agora gira, e só aparece se demorar mais de 0,25 s. Botões que esperam a nuvem
  ("Entrar", "Enviar pedido", "Importar") mostram o indicador e não aceitam um segundo clique.
- Telas vazias que diziam a coisa errada: o corretor via "Nenhum lote com esses filtros" num
  loteamento sem lotes; A receber vazio agora explica de onde vêm as parcelas; busca sem
  resultado tem o botão "Limpar busca". Gráfico sem dados mostrava a escala "0, 0, 1, 1, 1":
  agora diz "Nada previsto para os próximos 12 meses".
- Categoria de custo salva sem nome era ignorada em silêncio; agora avisa. Salvar mostra
  "Categoria salva".

- [x] *(testes: detalhes.test)* No computador: abrir e fechar uma janela; registrar um pagamento e ver a linha e os totais.
- [ ] No celular, com "Reduzir movimento" ligado (Ajustes › Acessibilidade › Movimento): abrir
  uma janela e ver que ela só aparece.

**Testes agora ficam no projeto**: `testes/detalhes.test.js` (como rodar está no começo do
arquivo). Os testes anteriores (test8 a test39) ficavam numa pasta temporária que foi apagada
quando o ambiente reiniciou e não puderam ser recuperados.

---

## 7z. Teste com dados no pior caso (16/10)

Pedido seu: testar lotes, clientes, contratos e contas a receber com o tipo de dado que quebra a
tela — nome de cliente enorme, e-mail enorme, contrato de R$ 10.000.000,00, loteamento com 500
lotes, listas vazias e campos em branco — e corrigir o que quebrou.

**O que quebrava e foi corrigido**
- **Valores cortados com "…"** nos cartões (Início e cabeçalho do contrato): "R$ 10.000.…".
  Agora o número aparece sempre inteiro; a fonte só diminui quando ele não cabe, e os cartões
  lado a lado ficam com o mesmo tamanho. Em telas de 320 px os quatro cartões do contrato ficam
  um embaixo do outro.
- **E-mail enorme alargava a página** do contrato no celular (rolagem para o lado). Agora ele
  quebra dentro do campo. Em 320 px o resumo do contrato vira uma coluna só, para "R$
  10.000.000,00" não partir no meio.
- **Lista de contratos**: venda à vista mostrava "0× R$ 0,00" (agora "à vista"); venda sem
  corretor mostrava "· ·" (agora o corretor é omitido).
- **Cabeçalho do contrato**: nome, data e parcelas apareciam grudados ("Silva· 14/08/2025·").
- **Lote sem área ou sem preço**: a tabela mostrava "0" e "R$ 0,00", a lista do corretor "0 m²".
  Agora aparece "—" (ou nada, na lista do corretor).
- **Planta esquemática com 500 lotes**: as 20 quadras ficavam numa coluna só e cada lote virava
  um risco. Agora as quadras se arrumam em colunas conforme o formato da tela.
- **Topo do corretor no celular**: com mais de um empreendimento, título, "Área do corretor" e o
  seletor ficavam espremidos com reticências. No celular o seletor ocupa o topo sozinho.
- **Gráficos do Início em 320 px**: os meses se sobrepunham e o último era cortado na borda.

**O que já aguentava**: a lista de clientes, a lista de contas a receber, as telas vazias, as
parcelas do contrato no celular (120 parcelas), a ficha do cliente e a tabela de 500 lotes
(abre em cerca de 0,1 s).

**Como ver no seu computador**: abra o app em `localhost` com `?dados=pior` no endereço. Aparece um
seletor embaixo (Exemplo / Pior caso / Vazio / Um de cada). Ele **não existe no app publicado** e
substitui os dados locais do navegador — use só para testar.

- [ ] No celular: abrir um contrato grande e ver os valores inteiros nos cartões.

`test39` confere tudo isso em 320, 390 e 1440 px.

---

## 7y. Celular com cara de app (15/10)

Pedido seu: corrigir o que faz o Lotifly parecer site no celular e dar às janelas e ao menu o
movimento do iPhone.

**Correções de celular**
- **Zoom ao tocar no campo**: todo campo, inclusive o seletor de empreendimento do topo (que
  estava com 13px), tem 16px em aparelho de toque. O zoom da tela continua liberado.
- **Flash cinza ao tocar**: desligado; cada botão, cartão e aba mostra o próprio "apertou" no
  instante do toque. Segurar o dedo num botão não seleciona mais o texto dele.
- **Altura da tela**: o app usa a altura visível de verdade (a barra do navegador não empurra mais
  nada para fora); a planta não muda de tamanho quando a barra some ao rolar.
- **Realce preso depois do toque**: todo efeito de passar o mouse só vale onde existe mouse.
- **Teclado cobrindo campos**: com o teclado aberto, a janela passa a ocupar só a parte visível —
  o campo e o botão Confirmar ficam acima do teclado. No celular a janela não abre mais o
  teclado sozinha: ele abre quando você toca no campo.
- Os avisos que aparecem no topo não bloqueiam mais o toque no que está embaixo deles.

**Janelas e menu**
- No celular a janela é uma gaveta com alça: **puxe para baixo para fechar**. Um puxão rápido
  fecha mesmo curto; puxado devagar e pouco, ela volta.
- O **menu lateral** fecha arrastando para a esquerda.
- O movimento é de **mola** e pode ser **interrompido**: dá para segurar a janela ou o menu no
  meio do caminho e trazer de volta.
- Com "Reduzir movimento" ligado no celular, nada desliza: aparece e some na hora.
- No computador nada mudou.

- [ ] No celular: tocar num campo de valor e ver se a tela não aproxima.
- [ ] Abrir uma janela, puxar pela alça para baixo; abrir o menu e arrastar para a esquerda.
- [ ] Registrar um pagamento com o teclado aberto e ver se o Confirmar aparece.

`test38` roda tudo isso no iPhone 13 e no Pixel 7 simulados, com toque de verdade para o
navegador. O teclado é simulado: a confirmação final é no aparelho.

---

## 7x. Visual novo, minimalista (14/10)

Pedido seu: redesign na direção minimalista, sem mexer em nenhuma função, cálculo ou dado,
mantendo as cores da marca, com os números financeiros em destaque e tudo padronizado.

**O que mudou**
- **Fonte Geist** (instalada no app, funciona sem internet) e algarismos de largura fixa nos
  valores: os R$ ficam alinhados e fáceis de comparar.
- **Cores**: o azul-marinho da marca segue no topo, no menu e no botão principal. O fundo
  passou a um cinza claro levemente quente; verde, âmbar e vermelho só onde dizem algo. Todos
  os textos e botões agora passam no contraste mínimo (eram 219 pontos abaixo; agora nenhum).
- **Sem emojis na interface**: viraram ícones de traço único (Phosphor) ou saíram dos
  rótulos. As mensagens de WhatsApp continuam como eram.
- **Início**: o **Total a receber** é o número grande; ao lado, Em atraso (com a
  inadimplência dos 12 meses), A receber no mês, A pagar no mês e Vendas. Os cartões mostram o
  **valor exato** (R$ 498.407,77), não mais "R$ 498,4 mil".
- **Gráficos** com a escala de valores à esquerda; o rótulo de atraso não fica mais por cima
  das barras.
- **Padrão único** de botões (mesma altura e cantos), cartões (borda fina, sem sombra),
  tabelas (cabeçalho discreto, números à direita) e filtros.
- **Celular**: na aba Parcelas do contrato, cada parcela vira um bloco com valor, situação e os
  botões à vista; campos com fonte de 16px (o iPhone não dá mais zoom ao tocar); folga para o
  entalhe do iPhone no app instalado; o nome do empreendimento não passa mais por cima dos
  botões do corretor.
- Nome **Lotifly** na aba do navegador, no ícone da tela inicial e na entrada.

**Achado no caminho, sem mexer:** o gráfico "Custos por categoria" em A pagar já aparecia
vazio antes — fica para uma correção à parte.

- [x] *(aprovado por você no PR do visual novo (14/10))* Abrir no computador e no celular e ver se o visual agrada.
- [ ] No iPhone, abrir pelo ícone da tela inicial e conferir o topo (relógio e bateria).

Prints de antes (`diagnostico/`) e depois (`diagnostico/depois/`) de todas as telas estão no
repositório e no PR.

---

## 7w. Aviso "1 alteração não chegou à nuvem… falta de permissão" — corrigido (08/10)

O que era: o item parado era um registro do **histórico de atividades**, não um dado seu. O
histórico, de propósito, só aceita inclusão no banco (ninguém reescreve o que já foi
registrado). Quando a internet oscila, o registro às vezes chega ao banco mas a resposta não
volta; o app guarda para reenviar, e no reenvio o banco via aquilo como "alteração" de algo
que já existia e recusava — para sempre, com a mensagem de falta de permissão.

Correção: no histórico, o reenvio agora diz ao banco "inclua se não existir; se já existe,
ignore". Nada a rodar no Supabase.

- Ao abrir a versão nova, o aviso some sozinho (o app reenvia os pendentes ao entrar). Se
  não sumir, clique em **Tentar de novo** uma vez.
- Quando o pendente for só do histórico, o aviso agora diz isso, para não assustar.

`test37` simula a resposta perdida e confere o reenvio, o recarregar e que os outros
cadastros continuam sendo alterados normalmente. O banco simulado dos testes passou a recusar
alteração no histórico, como o real.

---

## 7v. Recibo de pagamento (05/10)

Pedido seu: gerar recibo nas parcelas, na própria tela de pagamento.

- Na janela **Registrar pagamento** há agora o botão **🧾 Confirmar e gerar recibo**, ao
  lado do Confirmar. Ele registra o pagamento e já abre o recibo **desse pagamento**: num
  pagamento parcial, o recibo é só do que entrou e diz quanto ainda falta na parcela.
- Para reemitir depois, toda parcela com pagamento tem o botão **🧾** na aba **Parcelas** do
  contrato e na lista **A receber**. Esse recibo é do total já pago na parcela.
- O recibo traz: valor em número e por extenso, todos os compradores com CPF/CNPJ, a parcela
  e o vencimento, o número do contrato, o imóvel, a data e a forma de pagamento, a observação,
  a cidade e a data por extenso, e uma linha de assinatura para cada vendedor do contrato.
- Como o contrato, dá para **clicar no texto e corrigir** antes de imprimir ou salvar em PDF,
  e há o botão **Enviar** para mandar a confirmação por WhatsApp ao cliente (o PDF você anexa
  na conversa).

Quem assina é o **vendedor do contrato** (o mesmo do contrato). Se em algum caso quem recebe
for a imobiliária em nome do proprietário, me avise que eu ponho essa opção.

- [ ] Registrar um pagamento com "Confirmar e gerar recibo" e conferir o texto.
- [ ] Salvar em PDF e ver se o nome do arquivo e o layout servem.

`test36` cobre o pagamento parcial, o total, a impressão, o WhatsApp, os botões na página do
contrato e na lista, e a tela no celular.

---

## 7u. Início: Total a receber (03/10)

Pedido seu: mais um indicador no Início, o **Total a receber** — a carteira inteira em
aberto, somando todos os meses e todos os contratos (o que já venceu e não foi pago, mais o
que ainda vai vencer). Embaixo aparece em quantos contratos esse dinheiro está.

Clicando nele, abre **A receber** já em "Em aberto" e "Todos os meses", da empresa inteira,
e a soma da lista bate com o número do Início.

Achado no caminho, já corrigido: parcelas de contrato **distratado** ainda entravam no
"Em atraso", no "A receber no mês" e no gráfico de inadimplência. Agora ficam fora de todos
os números do Início, como já acontecia em A receber e na Cobrança.

No computador os cinco números ficam lado a lado; em tela média, três em cima e dois
embaixo; no celular, dois por linha e o último na linha inteira.

- [ ] Conferir o Total a receber com o saldo da carteira que você conhece.
- [ ] Clicar nele e ver a lista de todas as parcelas em aberto.

`test34` ganhou uma parcela de distrato e uma parcela futura no cenário, e confere o total,
o atalho e a lista.

---

## 7t. Fase 2: o contrato como página, com número (01/10)

**Número do contrato.** Cada contrato tem um número sequencial por ano: 0001/2026,
0002/2026… A contagem recomeça a cada ano, pelo ano da data da venda.

- Venda nova recebe o número sozinha, na hora de salvar.
- Na nuvem, quem dá o número é o banco: duas pessoas registrando venda ao mesmo tempo nunca
  recebem o mesmo, e o banco recusa número repetido.
- Os contratos que você já tem aparecem com um aviso em **Todos os contratos**: um clique
  e eles são numerados na ordem da data da venda.
- Contrato antigo que já tinha número no papel: o ✏️ ao lado do número deixa trocar. Os
  próximos continuam a partir do maior número do ano, então nada se repete.
- O número aparece na lista, entra na busca e vira um campo do modelo de contrato:
  `{{contrato.numero}}` (em Configurações › Modelos de documento, grupo Documento).

**Página do contrato.** Clicar num contrato, em qualquer tela, abre a página dele no lugar
da janela:

- **No topo:** número, imóvel, comprador, situação e quatro números (valor, recebido, a
  receber e em atraso), com as ações: Editar, Antecipar/quitar, Contrato, Extrato, enviar
  resumo pelo WhatsApp e Excluir.
- **Resumo:** os dados da venda e a correção monetária.
- **Partes:** a qualificação de cada comprador e vendedor, como sai no contrato, com o que
  falta e o botão para a ficha do cliente; e o corretor.
- **Parcelas:** a tabela com pagar, estornar, boleto e editar. Registrar um pagamento não
  tira você da página.
- **Documentos:** contrato, extrato, resumo por WhatsApp e boletos.
- **Histórico:** a venda, cada pagamento, boleto registrado, cobrança, comissão paga e as
  alterações, do mais novo para o mais antigo.
- O botão de voltar leva para onde você estava: Todos os contratos, Cobrança, Clientes, A
  receber…

Para conferir:

- [x] *(feito 15/10: você rodou o schema, que é cumulativo e inclui esta mudança)* Rodar o `schema.sql` (coluna do número, contador por ano e a função que dá o número).
- [ ] Em **Todos os contratos**, clicar em **Numerar agora** e conferir a ordem.
- [x] *(testes: contrato.test e fluxo.test)* Abrir um contrato e passar pelas cinco abas; registrar um pagamento pela aba Parcelas.
- [ ] Se quiser o número impresso no contrato, pôr `{{contrato.numero}}` no seu modelo.

Fica para a próxima rodada: o **novo contrato em passos** (imóvel, compradores, vendedor,
valores, parcelas, conferência), no lugar do formulário único de hoje.

`test35` cobre tudo isso, inclusive o número vindo do banco na nuvem; o teste de banco
confere a sequência, o ano, o número à mão, o número repetido e a permissão.

---

## 7s. Início da empresa (29/09)

Pedido seu: o Início é da empresa, não do empreendimento. Saíram o filtro de empreendimento,
a contagem de lotes, o VGV, a pizza da situação dos lotes, o "resultado projetado" e o aviso
de lotes sem preço. Isso tudo continua dentro de cada empreendimento, em Imóveis.

Agora o Início tem:

- **No topo, o que precisa de alguém**: reservas esperando, parcelas em atraso e contas
  vencidas.
- **Quatro números do mês** (hoje cinco, veja 7u), todos clicáveis:
  - **Vendas do mês**, em valor e contratos (leva a Todos os contratos);
  - **A receber no mês**, com quanto já entrou do previsto (leva a A receber);
  - **Em atraso**, em valor, parcelas e contratos (leva a Cobrança);
  - **A pagar no mês**, com as contas vencidas (leva a A pagar).
- **Fluxo previsto (12 meses)**, como estava.
- **Recebido × inadimplência (12 meses)**: uma barra por mês com o que venceu naquele mês,
  dividida em recebido (azul), em atraso (vermelho) e, no mês corrente, a vencer (amarelo).
  O mês com a pior inadimplência leva o percentual em cima. Passando o mouse, aparecem os
  valores; em **Ver em tabela**, os 12 meses em números.

Uma decisão de conta: **inadimplência é o atraso dividido pelo que já venceu.** A parcela
que vence daqui a dez dias não entra, porque ainda não teve chance de ser paga.

As cores do gráfico foram conferidas para quem não distingue vermelho de verde; por isso é
azul, vermelho e amarelo, e não verde e vermelho.

- [ ] Abrir o Início e conferir os quatro números com o que você sabe do mês.
- [ ] Passar o mouse no gráfico de inadimplência e abrir a tabela.

`test34` monta um cenário conhecido e confere cada número, o gráfico, a dica, a tabela, os
atalhos e a tela no celular.

---

## 7r. Tipos de imóvel (25/09)

Pedido seu: em vez de "Loteamento" e "Imóvel de terceiro", o tipo diz o que o imóvel é.

O seletor de tipo agora tem **Empreendimento** no topo e, logo abaixo, os imóveis avulsos
em ordem alfabética: **Apartamento, Casa, Galpão, Lote, Sala comercial e Sítio**. Deixei o
Empreendimento separado porque ele funciona diferente: tem planta, quadras e muitos lotes.
Os outros são um imóvel só, com valor de venda.

- **O tipo começa sem escolha** e é obrigatório, para uma casa não ser cadastrada como
  apartamento por descuido.
- **O exemplo do campo muda com o tipo**: "Apartamento 302 do Ed. Aurora", "Casa na Rua das
  Flores, 120", "Sítio Boa Vista"…
- **Na lista e no resumo** aparece o tipo com o ícone dele: 🏘️ Empreendimento, 🏢
  Apartamento, 🏠 Casa, 🏭 Galpão, 📐 Lote, 🏬 Sala comercial, 🌳 Sítio.
- **Editando um avulso**, dá para trocar entre os tipos avulsos (casa → sítio, por exemplo),
  mas ele não vira empreendimento, e empreendimento não vira avulso.
- **O que já está cadastrado continua funcionando.** Um avulso criado antes desta mudança
  aparece como "Imóvel" até você abrir, escolher o tipo e salvar.
- **O contrato continua dizendo "Lote 3 da Quadra A do Loteamento Tal"**, que é o nome
  jurídico. "Empreendimento" é só como aparece na tela.

- [x] *(feito 15/10: você rodou o schema, que é cumulativo e inclui esta mudança)* Rodar o `schema.sql` (coluna nova `categoria` em loteamentos).
- [ ] Abrir o Lote 15 da Quadra 300, escolher **Lote** e salvar.

`test33` cobre a ordem da lista, o tipo obrigatório, os exemplos por tipo, a troca entre
avulsos, o imóvel antigo sem tipo e a redação do contrato.

---

## 7q. Cadastrar o imóvel no próprio contrato (24/09)

Pedido seu: dar para registrar um contrato mesmo que o imóvel ainda não esteja no sistema —
venda antiga sendo trazida para cá, imóvel que entrou e saiu vendido sem passar pelo estoque.

- **＋ Novo contrato** agora sempre pergunta qual é o imóvel, mesmo quando só existe um, e
  tem o botão **＋ Novo imóvel** ao lado da lista. Ele abre o cadastro do imóvel de terceiro
  (valor de venda, matrícula, endereço…) ou do loteamento. **Salvar e abrir o contrato** já
  leva para o contrato com os dados preenchidos. **‹ Voltar** retorna à escolha sem criar nada.
- **No contrato de loteamento**, ao lado da lista de lotes, tem o botão **＋ Novo lote**. Os
  campos do lote (quadra, número, área, frente, fundos, matrícula e preço de tabela) abrem
  dentro do próprio contrato, sem perder o que já foi digitado. O lote só é gravado junto
  com o contrato, já como vendido; se o contrato for recusado, não fica lote solto. A posição
  na planta você marca depois.
- **Venda antiga de lote**: um lote marcado como vendido que não tem contrato no sistema
  aparece na lista ("marcado vendido, sem contrato"), para lançar o contrato dele.
- Quem vê os botões: só dono e administrador, que são quem o banco deixa criar imóvel e lote.
  O financeiro registra o contrato de um imóvel já cadastrado.

- [x] *(testes: novo-contrato.test)* Lançar uma venda antiga de um imóvel de terceiro direto pelo **＋ Novo contrato**.
- [x] *(testes: novo-contrato.test)* Lançar um contrato de um lote que ainda não estava cadastrado.

`test31` cobre os dois caminhos, o "Voltar", o lote repetido, o contrato recusado sem lote
solto, o lote vendido sem contrato e a permissão.

De quebra, corrigi um defeito que o teste pegou: ao abrir o cadastro do imóvel ou da despesa,
o sistema põe o cursor no primeiro campo logo depois da abertura. Se você já tinha clicado
em outro campo e começado a digitar, o cursor era puxado de volta e o texto caía no campo
errado. Agora ele não mexe no cursor de quem já está digitando (`test32`).

---

## 7p. Alteração perdida quando a nuvem recusa — corrigido (24/09)

Seu relato: cadastrou 2 imóveis, editou o valor de um, deu erro e tudo que foi alterado na
sessão sumiu.

**Causa.** Quando o banco recusava uma gravação, o app mostrava "Falha ao salvar na nuvem"
e a alteração ficava só na memória do navegador. Ao recarregar, o app baixa tudo do banco de
novo, e o que não tinha chegado lá sumia. A recusa, quase certamente, foi porque o
`schema.sql` desta versão ainda não tinha sido rodado: o cadastro do imóvel manda os campos
novos (valor de venda, área, matrícula), o banco ainda não os conhecia e recusava a gravação.
Reproduzi exatamente isso no teste.

**Correção**, que vale para qualquer recusa, não só esta:

- A alteração recusada fica guardada no navegador, numa lista de pendentes da empresa, e
  continua aparecendo na tela mesmo depois de recarregar.
- Um **aviso fixo no topo** diz quantas alterações não foram, quais são e o motivo em
  português. Por exemplo: "O banco está sem os campos novos desta versão: rode o schema.sql
  no Supabase e depois clique em Tentar de novo".
- O botão **Tentar de novo** reenvia tudo. Ao entrar no sistema, o app também tenta sozinho.
  Quando o banco aceita, o aviso some.
- Exclusão recusada também fica pendente: o registro apagado não volta ao recarregar.

O que você perdeu naquela sessão não dá para recuperar. Por isso, **rode o `schema.sql`
antes de continuar os testes** e cadastre os dois imóveis de novo.

- [x] *(feito 15/10: você rodou o schema, que é cumulativo e inclui esta mudança)* Rodar o `schema.sql`.
- [ ] Recadastrar os dois imóveis e editar o valor de um, recarregando a página no fim.

`test30` simula o banco sem as colunas novas e cobre todos os passos: falhava no código
antigo e passa no novo.

---

## 7o. Imóveis e imóvel de terceiro no singular (24/09)

O que você pediu testando:

- **"Empreendimentos" virou "Imóveis"**, no menu e na tela.
- **Loteamento não mostra valor na lista.** São centenas de lotes com preços diferentes, e o
  número aparece quando você abre o loteamento.
- **"Carteira" virou "Imóvel de terceiro", no singular.** Cada cadastro é um imóvel só: um
  lote, uma casa, um apartamento. O cadastro pede primeiro **qual é o imóvel** e o **valor de
  venda**, que é obrigatório. Depois vêm matrícula, área, endereço, cartório e a descrição
  conforme a matrícula. As condições de pagamento ficaram recolhidas e opcionais: sem preço,
  condição não serve para nada.
- **Na lista, o imóvel de terceiro mostra o valor de venda** e a situação: Disponível ou
  Vendido (com o nome do comprador).
- **Aberto, ele mostra** o valor de venda, a situação e o botão **💰 Registrar venda**. Se já
  foi vendido, o botão abre o contrato.
- **A venda já nasce preenchida** com o valor de venda, a descrição, a matrícula, a área, o
  endereço e a descrição da matrícula do cadastro. Tudo continua editável no contrato.
- **Não dá para vender duas vezes o mesmo imóvel.** Ele sai da lista de "Novo contrato"
  enquanto tiver venda ativa, e volta a ficar disponível depois de um distrato.

Para conferir:

- [x] *(feito 15/10: você rodou o schema, que é cumulativo e inclui esta mudança)* Rodar o `schema.sql` (colunas novas de valor de venda, área, matrícula e descrição da
      matrícula do imóvel).
- [ ] Abrir o **Lote 15 da Quadra 300** que você cadastrou e informar o valor de venda: ele foi
      criado antes e está sem preço, então a lista mostra "sem valor de venda".
- [x] *(testes: novo-contrato.test)* Cadastrar um apartamento de terceiro e registrar a venda dele.

`test29` cobre tudo isso; `test19` e `test20` foram ajustados para o imóvel no singular.

---

## 7n. Janela fechando ao trocar um valor — corrigido (23/09)

Você selecionava o valor do imóvel, os juros ou a quantidade de parcelas arrastando o mouse
para digitar por cima, e a janela fechava. A causa: o fundo escuro fechava a janela com
qualquer clique que terminasse nele. Ao selecionar arrastando, o mouse passa da borda da
janela antes de soltar, e o navegador entrega esse clique ao fundo.

Agora o fundo só fecha a janela quando o clique começa **e** termina nele. Vale para todas
as janelas do sistema. Clicar de propósito no fundo, o X e a tecla Esc continuam fechando
como antes.

- [x] ~~Refazer o gesto no valor, nos juros e nas parcelas~~ — **conferido por você em 23/09.**

O `test28` reproduz o gesto nos três campos: falhava no código antigo e passa no novo.

---

## 7m. Contratos › Clientes (23/09)

Pedido seu: dentro de Contratos, uma sub-seção de clientes para listar, cadastrar, editar e
excluir. Ficou no menu como **Contratos › Clientes**, entre "Todos os contratos" e
"＋ Novo contrato".

- **A ficha** é a mesma qualificação do comprador no contrato: nome, CPF/CNPJ, RG e órgão,
  nacionalidade, profissão, estado civil e regime de bens, cônjuge com os dados dele,
  endereço completo, telefone, e-mail e observações. Pessoa jurídica também.
- **A lista** busca por nome, parte do CPF, telefone, e-mail ou cidade, mostra quantos
  contratos cada um tem e avisa o que falta para o contrato sair qualificado.
- **CPF e CNPJ são conferidos pelo dígito verificador**, e o mesmo CPF não entra duas vezes.
  Isso já prepara o terreno para a DIMOB, que recusa documento inválido.
- **Os compradores dos contratos que você já tem** aparecem num aviso no topo: um clique e
  eles entram no cadastro. Quem comprou mais de uma vez vira uma ficha só, com os dados do
  contrato mais recente.
- **No contrato novo**, cada bloco de comprador tem o campo **📇 Puxar do cadastro de
  clientes**: digite o nome ou o CPF, escolha na lista e o formulário se preenche inteiro,
  cônjuge incluído.
- **Ao salvar um contrato**, o comprador entra no cadastro sozinho. Se já existia, a ficha é
  atualizada com o que foi digitado no contrato. Um campo em branco no contrato não apaga
  o que a ficha já tinha.
- **Editar a ficha não mexe em contrato já feito.** O contrato guarda os dados como estavam
  no dia da assinatura, que é o certo juridicamente. Vale para os próximos.
- **Excluir** é em dois passos: o primeiro avisa em quantos contratos ele aparece, o segundo
  apaga. Os contratos continuam intactos.
- **Quem vê:** no banco, só dono, administrador e financeiro, porque a ficha tem CPF e RG.
  O corretor não lê o cadastro. No menu, aparece para quem pode criar ou editar contratos.

Para conferir:

- [x] *(feito 15/10: você rodou o schema, que é cumulativo e inclui esta mudança)* Rodar o `schema.sql` (cria a tabela de clientes).
- [ ] Abrir **Contratos › Clientes** e clicar em **Trazer agora** para puxar os compradores
      dos seus contratos.
- [x] *(testes: novo-contrato.test)* Cadastrar um cliente casado, com cônjuge, e depois puxar ele num contrato novo.
- [ ] Editar e excluir um cliente de teste.

Atenção: um comprador antigo com CPF digitado errado entra no cadastro, mas a ficha só salva
de novo depois que o CPF for corrigido.

`test27` cobre o fluxo inteiro, mais o caso do banco ainda sem a tabela nova. O teste de
banco confere que o corretor não lê nem grava clientes.

---

## 7f. Decisões que só dependem de você

Nenhuma me trava hoje, mas todas mudam o produto:

- [x] ~~Carteira precisa de orçamento de custos?~~ — **não.** Imóvel de terceiros não tem obra:
      a carteira perdeu a aba de obra e o orçamento no resumo. Se uma carteira já tiver custo
      lançado, a aba reaparece, para não esconder dado que alguém registrou.
- [x] ~~Multa e juros padrão~~ — **multa 2% e juros 1% ao mês**, já pré-preenchidos em toda
      conta nova. O cliente muda como quiser em Configurações › Contas bancárias. O campo de juros agora é em
      **% ao mês**, do jeito que o contrato fala; o sistema converte para o valor por dia que o
      banco pede.
- [ ] **Divisão dos planos do SaaS** — ainda não definida.
- [x] ~~Nome do produto~~ — **Lotifly**, provável. Falta confirmar e registrar o domínio.

---

## 8. O que ainda não foi construído

Em ordem de prioridade acordada:

1. ~~Cobrança bancária~~ — **feito para o Banco do Brasil.** Faltam Caixa, Bradesco, Sicoob e
   C6, esperando os arquivos de cada um.
2. **DIMOB** — a qualificação das partes e do imóvel já está pronta (seção 7g), que era a
   parte difícil. Falta o leiaute oficial do arquivo de importação e um `.txt` de um ano que
   você já entregou, para eu conferir campo por campo em vez de adivinhar. O sistema gera o
   arquivo; quem transmite é o programa da Receita, com o certificado digital. Perguntas
   pendentes para o seu contador: o valor declarado no ano inclui juros, multa e correção?
   Venda distratada no meio do ano, como entra? Venda parcelada declara a alienação inteira
   no ano do contrato? Você é obrigado pela loteadora, pela imobiliária, ou pelas duas?
   Decidido: locação fica fora, não é o que você busca.
3. **Portal do comprador** — segunda via e extrato para o cliente final.
4. **Distrato e transferência de lote.**
5. **Planos do SaaS** — definir o que entra em cada plano e travar por plano no sistema.

Descartado por decisão sua: assinatura digital, que é serviço contratado à parte. Sem
necessidade: anexar documentos do cliente no sistema e comissão fixa por corretor, já que a
comissão é definida em cada venda.

---

## 8b. Site próprio e SaaS

Decidido em conversa: sair do endereço do GitHub e ir para domínio próprio, com página de
vendas e área de login.

- [ ] Confirmar o nome: **Lotifly**. Primeira consulta daqui (só DNS, o acesso à web está
      bloqueado neste ambiente): `lotifly.com` **já tem dono** — o domínio resolve e aponta
      para hospedagem de alguém. `lotifly.com.br` e `lotifly.net` não resolvem, o que quase
      sempre quer dizer livres, mas isso precisa ser confirmado no registro.br e num
      registrador internacional antes de contar como certo. Falta também a busca de marca no
      INPI em classe parecida (software e serviços imobiliários). Se estiver livre, registrar
      antes de falar do nome por aí.
- [ ] Registrar o domínio (registro.br para .com.br).
- [ ] Definir se o e-mail profissional será Zoho gratuito ou Google Workspace.

Depois disso eu faço a página de vendas e movo o aplicativo para o domínio novo. O Supabase
continua o mesmo, só mudam os endereços autorizados no painel dele e os links de vitrine já
divulgados, que dá para manter funcionando em paralelo.

---

## 8c. Segurança: revisão feita e o que falta fechar

Revisei o código e o banco em 17/09. Resumo honesto.

**O que está certo (conferido agora):**

- Todas as 17 tabelas do banco estão com RLS ligado, inclusive as novas (índices, cobranças,
  contas_banco, modelos, vitrines e leads). A proteção está no banco, não na tela: mesmo que
  alguém chame o Supabase por fora do app, só enxerga a própria empresa.
- O visitante sem login não tem acesso a nada. Até 23/09 havia duas funções abertas para a
  vitrine; com a vitrine retirada, o `schema.sql` apaga as duas (vale depois de você rodar).
- Não existe `eval` nem execução de texto no código, e tudo que vai para a tela passa pelo
  escape. Um nome de cliente ou um lead não consegue injetar script.
- Nenhuma senha ou chave secreta no repositório. A chave que está no `config.js` é a pública,
  feita para ficar exposta.

**Três coisas que eu quero arrumar antes de cliente pagante:**

- [x] **Código de convite** — feito. Agora são 10 caracteres sorteados pelo gerador
      criptográfico, num alfabeto sem 0/O e 1/I/L. Ao criar você escolhe quantas pessoas podem
      usar (padrão: uma só) e por quantos dias vale (padrão: 7 dias). Vencido ou esgotado, o
      banco recusa e a lista mostra marcado.
- [x] **Financeiro separado do administrador no banco** — feito, conforme você decidiu.
      O financeiro mexe em recebíveis, despesas, contratos, vendas, índices, conta bancária e
      cobrança. Não mexe na planta: um gatilho no banco compara a linha antiga com a nova e só
      deixa passar a mudança de **situação** do lote (que é o que acontece ao registrar venda
      ou distrato). Desenho, quadra, número, área, medidas, preço, tipo, matrícula e observação
      ficam travados, e criar ou excluir lote é só do administrador. Ele também deixou de
      convidar gente, publicar vitrine, trocar o modelo de contrato, mexer na configuração da
      empresa e apagar dados — o que fecha o caminho de virar administrador sozinho.
- [x] *(feito 15/10, seção 7z11 — vale depois de rodar o schema)* ~~**Bucket das plantas é de leitura pública.**~~ Era por causa da vitrine, que saiu; agora
      dá para fechar, mas as telas usam o link público da imagem, então fechar exige trocar
      para link assinado. Fica para uma rodada própria. O endereço
      tem o identificador da empresa e é impossível de adivinhar, mas quem tiver o link abre o
      arquivo. Regra: ali só planta. Quando formos anexar documento de cliente, vai em pasta
      privada com link que expira.

**Riscos que não são de código e dependem de nós:**

- [ ] Ligar **verificação em dois passos** para o dono e os administradores.
- [ ] Assinar o **Supabase Pro** antes do primeiro cliente pagante: o plano gratuito não tem
      backup diário. Perder dado é o risco mais real, bem mais que roubo.
- [ ] Exportar o **backup em JSON** de vez em quando por Cadastros, enquanto estivermos no free.
- [ ] Senha forte e não repetida de outro site, para você e para cada pessoa da equipe. A porta
      mais fácil de arrombar é sempre a senha de alguém, não o sistema.
- [ ] Quando sairmos do GitHub: travar no painel do Supabase os endereços autorizados só para o
      nosso domínio.
- [ ] **Termos de uso e política de privacidade** (LGPD). Guardamos CPF e telefone de comprador,
      que é dado pessoal, e como SaaS você passa a ser operador dos dados dos seus clientes.

Sobre "sequestro de informação": não existe servidor nosso para alguém criptografar. O
aplicativo é arquivo estático e o banco é gerenciado pelo Supabase, com backup deles. O cenário
realista não é ransomware, é alguém entrar com a senha de um usuário seu.

---

## 9. Ideia registrada para depois

Transformar o sistema em SaaS, com site próprio, assinatura e cadastro de novas incorporadoras.
A base já é multiempresa, cada cliente com seus dados isolados. Falta domínio, site de
apresentação, cobrança recorrente, teste grátis, termos de uso e suporte. Melhor atacar depois
que o Hessen estiver rodando de verdade por algumas semanas.
