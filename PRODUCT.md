# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Administrador (dono):** Vinicius Cauduro, corretor (CRECI 24.575) e dono da Cocal Imóveis e
  da incorporadora. Usa no computador, no escritório. Acompanha a empresa inteira: vendas,
  contratos, quanto entra e quanto sai, quem está atrasado, o que precisa de aprovação.
- **Corretores:** da equipe da Cocal e também parceiros externos (autônomos e imobiliárias que
  vendem os lotes). Usam o modo corretor quase sempre no celular, muitas vezes com o cliente do
  lado: ver a planta e o que está disponível, consultar preço e condição, pedir reserva.
- **Equipe do escritório:** administrativo e financeiro. Cadastram contratos e clientes,
  registram pagamentos, emitem recibos, boletos e remessas, cobram atrasados, lançam contas a
  pagar.

Papéis no sistema: dono, administrador, financeiro e corretor, cada um com permissões próprias.

## Product Purpose

Gestão de uma loteadora, incorporadora e imobiliária num lugar só: imóveis e loteamentos (quadras
e lotes com situação disponível, reservado, vendido ou indisponível), reservas, vendas e
contratos, clientes, contas a receber, inadimplência e cobrança, boletos e remessa bancária,
contas a pagar, índices de correção, relatórios e o cadastro das empresas (vendedores e CNPJs do
grupo).

Sucesso é o dono abrir o Início e saber, sem planilha paralela, quanto vendeu, quanto tem a
receber, quem está atrasado e o que precisa pagar; e o corretor, no celular, responder o cliente
na hora sem ligar para o escritório.

## Positioning

Nasce da operação real de uma loteadora, incorporadora e imobiliária que vende em parcelamento
direto. Por isso cobre a ponta que sistemas genéricos de imobiliária não cobrem:
- a planta do loteamento importada de PDF ou DXF, com o status de cada lote;
- o contrato com qualificação das partes e do imóvel no padrão que o cartório pede;
- parcelas com índice de correção, reforços, antecipação e quitação;
- a cobrança bancária com remessa e retorno.

O lançamento é por etapas. Hoje é a ferramenta da Cocal e da incorporadora. Depois vira produto
vendido a outras loteadoras, incorporadoras e imobiliárias, com domínio próprio, página de vendas e
login. As decisões de agora já valem para as duas fases: tudo é por empresa, e o nome da empresa
cliente aparece dentro do app.

## Operating Context

- **Escritório, no computador:** cadastro de contratos (inclusive vendas antigas sendo trazidas
  para o sistema), baixa de pagamentos, recibos, boletos, remessa e retorno do banco (Banco do
  Brasil primeiro, outros bancos depois), contas a pagar, relatórios e a declaração ao contador
  (DIMOB).
- **Rua e plantão, no celular:** corretor com o cliente, internet às vezes fraca. Planta,
  disponibilidade, simulação e pedido de reserva, que o escritório aprova.
- **Documentos que saem do sistema:** proposta, contrato, recibo, extrato, demonstrativo de
  antecipação. São conferidos e editados antes de imprimir ou salvar em PDF. Vão ao cliente pelo
  WhatsApp e ao cartório impressos.
- **Dois modos de dados:** na nuvem (Supabase, com equipe, convites e tempo real) ou só no
  navegador, com PIN de administrador. Se a nuvem recusa ou a internet cai, a alteração fica
  guardada no aparelho e é reenviada; nada pode se perder em silêncio.

## Capabilities and Constraints

- App web estático (HTML, CSS e JavaScript, sem etapa de build), instalável como PWA, publicado
  no GitHub Pages (https://vinicauduro.github.io/lotifly/). O banco é atualizado rodando
  `supabase/schema.sql`; mudança que depende de coluna nova precisa funcionar, ou avisar com
  clareza, enquanto o schema não foi rodado.
- Idioma: português do Brasil, com os termos do mercado imobiliário. Dinheiro em R$ com vírgula
  decimal, datas dd/mm/aaaa.
- Termos fixos:
  - **Imóveis**: empreendimento, ou imóvel avulso de terceiro (apartamento, casa, galpão, lote,
    sala comercial, sítio), sempre no singular.
  - **Contrato** nº 0001/AAAA, sequencial por ano.
  - **Parcelas** e **reforços**.
  - **Distrato**.
  - **Inadimplência**: o atraso sobre o que já venceu.
  - **Total a receber**: a carteira em aberto.
- Todo número do Início leva à lista que o compõe, e a soma da lista bate com o número.
- Em aberto:
  - o nome Lotifly ainda depende de confirmar domínio e marca (INPI);
  - a identidade visual (cores e marca) ainda não foi decidida;
  - permissões por funcionário definidas pelo dono (Fase 6);
  - despesas da empresa vinculadas a empreendimento ou imóvel (Fase 4).

## Brand Commitments

- Nome do produto: **Lotifly**. Dentro do app aparece o nome da empresa cliente (por exemplo
  "Cauduro Loteamentos"); não carrega a marca da Cocal Imóveis.
- Tom: profissional, confiável, direto. Frases curtas, linguagem simples, sem jargão técnico de
  software. Mensagem de erro diz o que aconteceu e o que fazer.
- Ícones do app: `icon-192.png`, `icon-512.png`.

## Evidence on Hand

- A operação da Cocal Imóveis e da incorporadora é o primeiro uso real.
- Os "dados de exemplo" do app são fictícios e servem só para demonstração.
- Ainda não há outros clientes, depoimentos, números de uso ou preços. Nada disso pode ser
  inventado em página de vendas ou tela.

## Product Principles

1. **Número financeiro é claro e conferível.** Cada valor diz do que é feito, abre a lista que o
   compõe e bate com ela. Clareza vem antes de enfeite.
2. **O celular do corretor é rápido.** A resposta ao cliente sai em poucos toques, mesmo com
   internet fraca.
3. **Nada se perde.** Gravação que não chegou fica guardada e visível até subir; ação destrutiva
   pede confirmação.
4. **A empresa vem antes do empreendimento.** As telas gerais mostram a empresa inteira; o detalhe
   de cada empreendimento fica dentro dele.
5. **Fala a língua do mercado.** Termos, documentos e contas seguem o que corretor, cartório,
   banco e contador já usam.
