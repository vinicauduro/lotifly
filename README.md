# Lotifly

Gestão para loteadora, incorporadora e imobiliária: imóveis e empreendimentos com planta,
contratos, clientes, recebíveis, cobrança, boletos e remessa bancária, contas a pagar,
índices de correção e relatórios.

- **No ar:** https://vinicauduro.github.io/lotifly/
- **Nuvem (Supabase):** guia em [`supabase/README.md`](supabase/README.md). O banco é criado e
  atualizado rodando [`supabase/schema.sql`](supabase/schema.sql) no SQL Editor.
- **O que falta testar e as decisões pendentes:** [`PENDENTE.md`](PENDENTE.md).

É um app web estático (HTML, CSS e JavaScript, sem etapa de build), instalável como PWA.
Sem a chave do Supabase em `config.js`, funciona só no navegador, com PIN de administrador.

Veio da pasta `gestao/` do repositório `agenda-corretor`, com todo o histórico de mudanças.
