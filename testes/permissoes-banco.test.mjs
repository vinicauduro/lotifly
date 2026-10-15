// Fase 6 no banco: roda supabase/schema.sql inteiro num Postgres de teste (PGlite) e confere, como
// cada pessoa da equipe, que o banco recusa o que a permissão dela não deixa — mesmo gravando por
// fora do app. Também confere que o padrão de fábrica do banco é o mesmo de permissoes.js.
// Rodar: PGLITE=/caminho/node_modules/@electric-sql/pglite/dist/index.js node testes/permissoes-banco.test.mjs
//        (npm install @electric-sql/pglite em qualquer pasta)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const { PGlite } = await import(process.env.PGLITE ? pathToFileURL(process.env.PGLITE).href : '@electric-sql/pglite');
const db = new PGlite();
const erros = [];
const passo = async (nome, fn) => { try { await fn(); console.log('✔', nome); } catch (e) { console.log('✘', nome, String(e.message).split('\n')[0]); erros.push(nome + ': ' + String(e.message).split('\n')[0]); } };

// ---- o mínimo do Supabase que o schema usa
await db.exec(`
  create schema if not exists auth;
  create table auth.users (id uuid primary key, email text);
  create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
  do $$ begin create role anon; exception when duplicate_object then null; end $$;
`);
const SCHEMA = fs.readFileSync(path.join(raiz, 'supabase/schema.sql'), 'utf8');
await db.exec(SCHEMA);
await db.exec(SCHEMA);   // rodar de novo (como no Supabase, a cada versão) não pode dar erro
await db.exec(`grant usage on schema public, auth to authenticated; grant all on all tables in schema public to authenticated; grant execute on all functions in schema public to authenticated;`);

const ORG = '11111111-1111-1111-1111-111111111111';
const U = { dono: 'aaaaaaaa-0000-0000-0000-000000000001', admin: 'aaaaaaaa-0000-0000-0000-000000000002', fin: 'aaaaaaaa-0000-0000-0000-000000000003', cor: 'aaaaaaaa-0000-0000-0000-000000000004' };
await db.exec(`
  insert into auth.users values ('${U.dono}','dono@x'),('${U.admin}','adm@x'),('${U.fin}','fin@x'),('${U.cor}','cor@x');
  insert into public.organizacoes (id, nome) values ('${ORG}', 'Cocal Loteamentos');
  insert into public.membros (org_id, user_id, papel, nome) values
    ('${ORG}','${U.dono}','dono','Dono'),('${ORG}','${U.admin}','admin','Admin'),('${ORG}','${U.fin}','financeiro','Fin'),('${ORG}','${U.cor}','corretor','Cor');
  insert into public.loteamentos (org_id, id, nome) values ('${ORG}','lot1','Vista Verde');
  insert into public.vendas (org_id, id, loteamento_id, lote_id, valor_total) values ('${ORG}','v1','lot1','l1',100000),('${ORG}','v2','lot1','l2',90000);
  insert into public.recebiveis (org_id, id, loteamento_id, venda_id, numero, descricao, vencimento, valor) values
    ('${ORG}','r1','lot1','v1',1,'Parcela 1/2','2026-10-15',1000),('${ORG}','r2','lot1','v1',2,'Parcela 2/2','2026-11-15',1000);
`);

/* Executa como uma pessoa logada (papel authenticated + o id dela no token) */
async function como(quem, sql) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${U[quem]}', false); set role authenticated;`);
  try { return await db.query(sql); } finally { await db.exec("reset role; select set_config('request.jwt.claim.sub', '', false);"); }
}
const recusa = async (quem, sql, trecho = 'Sem permissão') => {
  try { await como(quem, sql); } catch (e) { if (!String(e.message).includes(trecho)) throw new Error('recusou com outra mensagem: ' + e.message); return; }
  throw new Error('o banco deixou passar');
};
const ajustar = (obj) => db.exec(`update public.organizacoes set config = config || '${JSON.stringify(obj)}'::jsonb where id = '${ORG}'`);   // como dono do banco (sem gatilho de pessoa)

await passo('padrão de fábrica do banco = PERM_PADRAO de permissoes.js', async () => {
  const js = fs.readFileSync(path.join(raiz, 'permissoes.js'), 'utf8');
  const chaves = [...js.matchAll(/\['([a-z]+\.[a-z]+)', '/g)].map(m => m[1]);
  const fin = JSON.parse('{' + js.match(/financeiro: \{([\s\S]*?)\n  \},/)[1].replace(/'/g, '"') + '}');
  const dif = [];
  for (const k of chaves) {
    const r = (await db.query(`select public.permissao_padrao('admin','${k}') a, public.permissao_padrao('financeiro','${k}') f, public.permissao_padrao('corretor','${k}') c`)).rows[0];
    if (r.a !== true) dif.push(`admin ${k}`);
    if (r.f !== !!fin[k]) dif.push(`financeiro ${k}: banco ${r.f}, app ${!!fin[k]}`);
    if (r.c !== false) dif.push(`corretor ${k}`);
  }
  if (!chaves.length || dif.length) throw new Error(dif.join('; ') || 'nenhuma chave lida');
});
await passo('financeiro no padrão: registra pagamento e vende; não exclui nem distrata', async () => {
  await como('fin', `update public.recebiveis set valor_pago = 1000, data_pagamento = '2026-10-15' where id = 'r1'`);
  await como('fin', `insert into public.vendas (org_id, id, loteamento_id, lote_id, valor_total) values ('${ORG}','v3','lot1','l3',50000)`);
  await recusa('fin', `delete from public.vendas where id = 'v3'`);
  await recusa('fin', `update public.vendas set status = 'distrato', distrato_em = '2026-10-15' where id = 'v2'`);
});
await passo('desligar "registrar pagamentos" só para o financeiro: o banco recusa a baixa', async () => {
  await ajustar({ permissoesPessoas: { [U.fin]: { 'financeiro.baixar': false, 'financeiro.antecipar': false } } });
  await recusa('fin', `update public.recebiveis set valor_pago = 1000 where id = 'r2'`, 'registrar ou estornar pagamentos');
  /* o que não é pagamento (ex.: número do boleto) continua liberado */
  await como('fin', `update public.recebiveis set nosso_numero = '123' where id = 'r2'`);
  /* o administrador, sem ajuste, continua podendo */
  await como('admin', `update public.recebiveis set valor_pago = 500 where id = 'r2'`);
});
await passo('ligar "fazer distrato" só para o financeiro: o banco passa a aceitar', async () => {
  await ajustar({ permissoesPessoas: { [U.fin]: { 'vendas.distrato': true } } });
  await como('fin', `update public.vendas set status = 'distrato', distrato_em = '2026-10-15', motivo = 'teste' where id = 'v2'`);
});
await passo('comissão e edição de contrato seguem as próprias permissões', async () => {
  await ajustar({ permissoesPessoas: { [U.fin]: { 'comissao.gerenciar': false, 'vendas.editar': false } } });
  await recusa('fin', `update public.vendas set comissao_paga = true where id = 'v1'`, 'marcar comissões');
  await recusa('fin', `update public.vendas set obs = 'x' where id = 'v1'`, 'editar contratos');
  /* recálculo da antecipação (só parcela e índice) passa com "antecipar" */
  await como('fin', `update public.vendas set valor_parcela = 999 where id = 'v1'`);
  /* ativa -> quitada ao registrar pagamento passa com "registrar pagamentos" */
  await como('fin', `update public.vendas set status = 'quitada' where id = 'v1'`);
});
await passo('upsert sem mudança real não é barrado (o app reenvia linhas iguais)', async () => {
  await como('fin', `insert into public.recebiveis (org_id, id, loteamento_id, venda_id, numero, descricao, vencimento, valor) values ('${ORG}','r2','lot1','v1',2,'Parcela 2/2','2026-11-15',1000)
                     on conflict (org_id, id) do update set descricao = excluded.descricao`);
});
await passo('despesas: administrador com "lançar despesas" desligado é recusado; o dono pode', async () => {
  await ajustar({ permissoesPessoas: { [U.admin]: { 'custos.editar': false } } });
  await recusa('admin', `insert into public.custos (org_id, id, loteamento_id, descricao, valor, data_competencia) values ('${ORG}','c1','lot1','Terraplanagem',5000,'2026-10-01')`, 'despesas');
  await como('dono', `insert into public.custos (org_id, id, loteamento_id, descricao, valor, data_competencia) values ('${ORG}','c1','lot1','Terraplanagem',5000,'2026-10-01')`);
});
await passo('ninguém ajusta as próprias permissões; o administrador ajusta os outros', async () => {
  await ajustar({ permissoesPessoas: {} });
  await recusa('admin', `update public.organizacoes set config = config || jsonb_build_object('permissoesPessoas', jsonb_build_object('${U.admin}', '{"x.y": true}'::jsonb)) where id = '${ORG}'`, 'próprias permissões');
  await como('admin', `update public.organizacoes set config = config || jsonb_build_object('permissoesPessoas', jsonb_build_object('${U.fin}', '{"relatorios.ver": false}'::jsonb)) where id = '${ORG}'`);
});
await passo('configurações e equipe pedem as próprias permissões', async () => {
  await ajustar({ permissoesPessoas: { [U.admin]: { 'config.editar': false, 'equipe.gerenciar': false } } });
  await recusa('admin', `update public.organizacoes set config = config || '{"reservaDias": 9}'::jsonb where id = '${ORG}'`, 'configurações');
  await recusa('admin', `update public.organizacoes set config = config || '{"permissoes": {}}'::jsonb where id = '${ORG}'`, 'mudar permissões');
  /* sem "gerenciar a equipe", a linha do outro membro nem aparece para ele alterar: nada muda */
  await como('admin', `update public.membros set papel = 'admin' where user_id = '${U.fin}'`);
  const papel = (await db.query(`select papel from public.membros where user_id = '${U.fin}'`)).rows[0].papel;
  if (papel !== 'financeiro') throw new Error('o papel do financeiro mudou para ' + papel);
  /* o próprio perfil continua editável */
  await como('admin', `update public.membros set telefone = '47999999999' where user_id = '${U.admin}'`);
});
await passo('restaurar backup: pede "fazer backup" e, com ela, a limpeza não é barrada pelas travas', async () => {
  await ajustar({ permissoesPessoas: { [U.admin]: { 'backup.usar': false } } });
  await recusa('admin', `select public.limpar_dados_org('${ORG}')`, 'restaurar backup');
  await como('dono', `select public.limpar_dados_org('${ORG}')`);
  const n = (await db.query(`select (select count(*) from public.vendas) + (select count(*) from public.recebiveis) + (select count(*) from public.custos) as n`)).rows[0].n;
  if (Number(n) !== 0) throw new Error('sobraram ' + n + ' linhas');
});
await passo('corretor continua barrado pela função (nem chega às travas por pessoa)', async () => {
  await db.exec(`insert into public.vendas (org_id, id, loteamento_id, lote_id, valor_total) values ('${ORG}','v9','lot1','l9',1)`);
  const r = await como('cor', `update public.vendas set obs = 'x' where id = 'v9' returning id`);
  if (r.rows.length) throw new Error('corretor conseguiu editar');
});

console.log(erros.length ? '\nERROS:\n' + erros.join('\n') : '\ntudo ok');
process.exit(erros.length ? 1 : 0);
