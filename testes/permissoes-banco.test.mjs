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
  -- como no Supabase: tudo o que nasce no public já vem liberado para anon e authenticated
  grant usage on schema public to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on functions to anon, authenticated;
  alter default privileges in schema public grant all on sequences to anon, authenticated;
  -- o pedaço do Storage do Supabase que as políticas das plantas usam
  create schema if not exists storage;
  create table storage.buckets (id text primary key, name text, public boolean not null default false);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
  alter table storage.objects enable row level security;
  create or replace function storage.foldername(name text) returns text[] language sql immutable as $$
    select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
  grant usage on schema storage to authenticated, anon; grant all on storage.objects to authenticated, anon;
  insert into storage.buckets values ('plantas', 'plantas', true);   -- como era antes: público
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
await passo('despesas da empresa: sem empreendimento, e despesa ligada a um contrato da carteira', async () => {
  await como('fin', `insert into public.custos (org_id, id, loteamento_id, descricao, valor, data_competencia) values ('${ORG}','c2',null,'Aluguel do escritório',3800,'2026-10-01')`);
  await como('fin', `insert into public.custos (org_id, id, loteamento_id, venda_id, descricao, valor, data_competencia) values ('${ORG}','c3','lot1','v1','IPTU do imóvel',420,'2026-10-01')`);
  const r = (await db.query(`select id, loteamento_id, venda_id from public.custos where id in ('c2','c3') order by id`)).rows;
  if (r.length !== 2 || r[0].loteamento_id !== null || r[1].venda_id !== 'v1') throw new Error('gravou errado: ' + JSON.stringify(r));
  await recusa('cor', `insert into public.custos (org_id, id, loteamento_id, descricao, valor, data_competencia) values ('${ORG}','c4',null,'Café',50,'2026-10-01')`);
});
await passo('centro de custo: a despesa da empresa guarda o centro; criar centro ou grupo do plano é configuração', async () => {
  await como('fin', `insert into public.custos (org_id, id, loteamento_id, centro_id, descricao, valor, data_competencia) values ('${ORG}','c5',null,'cc-1','Stand de vendas',1200,'2026-10-01')`);
  const r = (await db.query(`select centro_id from public.custos where id = 'c5'`)).rows;
  if (r.length !== 1 || r[0].centro_id !== 'cc-1') throw new Error('não gravou o centro: ' + JSON.stringify(r));
  /* O financeiro não altera a empresa: o banco recusa ou simplesmente não grava */
  const cfg = async () => (await db.query(`select config->'centrosCusto' as c, config->'planoGrupos' as g from public.organizacoes where id = '${ORG}'`)).rows[0];
  for (const sql of [`update public.organizacoes set config = config || '{"centrosCusto":[{"id":"cc-1","nome":"Comercial","ativo":true}]}'::jsonb where id = '${ORG}'`,
    `update public.organizacoes set config = config || '{"planoGrupos":[{"id":"g-1","nome":"Veículos"}]}'::jsonb where id = '${ORG}'`]) {
    try { await como('fin', sql); } catch (e) { if (!/configura|permiss/i.test(e.message)) throw e; }
  }
  const antes = await cfg();
  if (antes.c !== null || antes.g !== null) throw new Error('o financeiro mudou a configuração: ' + JSON.stringify(antes));
  await como('dono', `update public.organizacoes set config = config || '{"centrosCusto":[{"id":"cc-1","nome":"Comercial","ativo":true}],"planoGrupos":[{"id":"g-1","nome":"Veículos"}]}'::jsonb where id = '${ORG}'`);
  const depois = await cfg();
  if (!depois.c || depois.c[0].nome !== 'Comercial' || depois.g[0].nome !== 'Veículos') throw new Error('o dono não conseguiu: ' + JSON.stringify(depois));
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
await passo('cessão de direitos: o banco aceita o histórico no contrato e o modelo de cessão; sem "editar contratos", recusa', async () => {
  await db.exec(`insert into public.vendas (org_id, id, loteamento_id, lote_id, valor_total) values ('${ORG}','v20','lot1','l20',80000)`);
  const cessoes = JSON.stringify([{ id: 'c1', data: '2026-10-15', cedentes: [{ nome: 'A' }], cessionarios: [{ nome: 'B' }] }]);
  await ajustar({ permissoesPessoas: { [U.admin]: { 'vendas.editar': false } } });
  await recusa('admin', `update public.vendas set cliente = '{"nome":"B"}'::jsonb, cessoes = '${cessoes}'::jsonb where id = 'v20'`, 'editar contratos');
  await ajustar({ permissoesPessoas: {} });
  await como('admin', `update public.vendas set cliente = '{"nome":"B"}'::jsonb, cessoes = '${cessoes}'::jsonb where id = 'v20'`);
  const r = (await db.query(`select cliente->>'nome' as n, jsonb_array_length(cessoes) as c from public.vendas where id = 'v20'`)).rows[0];
  if (r.n !== 'B' || Number(r.c) !== 1) throw new Error(JSON.stringify(r));
  await como('admin', `insert into public.modelos (org_id, id, nome, tipo, corpo) values ('${ORG}','mc1','Cessão','cessao','texto do modelo de cessão')`);
  let recusou = false; try { await db.exec(`insert into public.modelos (org_id, id, nome, tipo, corpo) values ('${ORG}','mx1','X','outro','x')`); } catch (e) { recusou = /modelos_tipo_check/.test(e.message); }
  if (!recusou) throw new Error('aceitou um tipo de modelo desconhecido');
});
await passo('distrato: grava retenção e devolução no contrato; o financeiro (sem "fazer distrato") é recusado', async () => {
  await db.exec(`insert into public.vendas (org_id, id, loteamento_id, lote_id, valor_total) values ('${ORG}','v30','lot1','l30',90000)`);
  const d = JSON.stringify({ data: '2026-10-16', pago: 30000, retencaoPct: 25, retencao: 7500, devolucao: 22500, forma: 'parcelado', parcelas: [] });
  const sql = `update public.vendas set status = 'distrato', distrato_em = '2026-10-16', motivo = 'teste', distrato = '${d}'::jsonb where id = 'v30'`;
  await recusa('fin', sql, 'fazer distrato');
  await como('admin', sql);
  const r = (await db.query(`select status, distrato->>'retencao' as ret from public.vendas where id = 'v30'`)).rows[0];
  if (r.status !== 'distrato' || r.ret !== '7500') throw new Error(JSON.stringify(r));
  await recusa('fin', `update public.vendas set distrato = null, status = 'ativa' where id = 'v30'`, 'fazer distrato');
  await como('admin', `insert into public.modelos (org_id, id, nome, tipo, corpo) values ('${ORG}','md1','Distrato','distrato','texto do modelo de distrato')`);
});
await passo('plantas fechadas: só quem é da empresa (entrou pelo convite) abre o arquivo', async () => {
  const ORG2 = '22222222-2222-2222-2222-222222222222', FORA = 'aaaaaaaa-0000-0000-0000-000000000009';
  await db.exec(`
    insert into auth.users values ('${FORA}','fora@x');
    insert into public.organizacoes (id, nome) values ('${ORG2}', 'Outra Construtora');
    insert into storage.objects (bucket_id, name) values ('plantas','${ORG}/lot1.jpg'),('plantas','${ORG2}/lotX.jpg'),('plantas','sem-uuid/teste.jpg');`);
  const pub = (await db.query(`select public from storage.buckets where id = 'plantas'`)).rows[0].public;
  if (pub !== false) throw new Error('o bucket continua público');
  U.fora = FORA;
  const ve = async quem => (await como(quem, `select name from storage.objects where bucket_id = 'plantas' order by name`)).rows.map(r => r.name).join(',');
  for (const quem of ['dono', 'admin', 'fin', 'cor']) { const r = await ve(quem); if (r !== `${ORG}/lot1.jpg`) throw new Error(`${quem} vê: ${r || 'nada'}`); }
  if (await ve('fora')) throw new Error('quem não é da empresa vê a planta');
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false); set role anon;`);
  const anon = (await db.query(`select count(*)::int as n from storage.objects`)).rows[0].n;
  await db.exec('reset role;');
  if (anon) throw new Error('visitante sem login vê ' + anon + ' arquivo(s)');
  await db.exec(`set session_replication_role = replica; update public.membros set ativo = false where user_id = '${U.cor}'; set session_replication_role = origin;`);   // como o dono do banco, sem os gatilhos
  const inativo = await ve('cor');
  await db.exec(`set session_replication_role = replica; update public.membros set ativo = true where user_id = '${U.cor}'; set session_replication_role = origin;`);
  if (inativo) throw new Error('membro desativado continua vendo');
  await como('admin', `insert into storage.objects (bucket_id, name) values ('plantas', '${ORG}/lot2.jpg')`);
  await recusa('cor', `insert into storage.objects (bucket_id, name) values ('plantas', '${ORG}/lot3.jpg')`, 'row-level security');
  await recusa('admin', `insert into storage.objects (bucket_id, name) values ('plantas', '${ORG2}/invasao.jpg')`, 'row-level security');
});
await passo('erros do app: todo membro grava os seus; só dono e admin leem e apagam; 90 dias', async () => {
  const ORG2 = '22222222-2222-2222-2222-222222222222';
  const ins = (org, extra = '') => `insert into public.erros (org_id, mensagem, tela${extra ? ', user_id' : ''}) values (${org ? `'${org}'` : 'null'}, 'x is not a function', 'admin › vendas'${extra})`;
  await como('cor', ins(ORG));
  await como('fin', ins(ORG));
  await como('fora', ins(null));                                       // na tela de entrada, antes de escolher a empresa
  await recusa('cor', ins(ORG2), 'row-level security');                // empresa que não é a dele
  await recusa('cor', ins(ORG, `, '${U.dono}'`), 'row-level security'); // em nome de outra pessoa
  const n = async quem => (await como(quem, `select count(*)::int as n from public.erros`)).rows[0].n;
  if (await n('cor') !== 0 || await n('fin') !== 0) throw new Error('corretor ou financeiro lê os erros');
  if (await n('admin') !== 2 || await n('dono') !== 2) throw new Error('admin/dono não leem os 2 da empresa');
  const quem = (await como('admin', `select user_id from public.erros where org_id = '${ORG}' order by user_id`)).rows.map(r => r.user_id).join();
  if (quem !== [U.fin, U.cor].sort().join()) throw new Error('user_id não ficou o de quem gravou: ' + quem);
  let grande = false; try { await como('cor', `insert into public.erros (org_id, mensagem) values ('${ORG}', repeat('a', 1001))`); } catch (e) { grande = /check/.test(e.message); }
  if (!grande) throw new Error('aceitou mensagem gigante');
  await db.exec(`insert into public.erros (org_id, mensagem, ts) values ('${ORG}', 'velho', now() - interval '100 days')`);
  await como('cor', ins(ORG));
  if ((await db.query(`select count(*)::int as n from public.erros where mensagem = 'velho'`)).rows[0].n) throw new Error('erro de 100 dias não saiu');
  await como('cor', `delete from public.erros where org_id = '${ORG}'`);
  if (await n('admin') !== 3) throw new Error('corretor apagou');
  await como('admin', `delete from public.erros where org_id = '${ORG}'`);
  if (await n('admin') !== 0) throw new Error('admin não apagou');
});
await passo('visitante sem login: nenhuma tabela, nenhuma função; quem está logado continua executando', async () => {
  const anon = async sql => { await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false); set role anon;`); try { await db.query(sql); return 'passou'; } catch (e) { return e.message.split('\n')[0]; } finally { await db.exec('reset role;'); } };
  const tabelas = (await db.query(`select tablename from pg_tables where schemaname = 'public' order by 1`)).rows.map(r => r.tablename);
  const col1 = async t => (await db.query(`select column_name from information_schema.columns where table_schema = 'public' and table_name = '${t}' order by ordinal_position limit 1`)).rows[0].column_name;
  if (tabelas.length < 20) throw new Error('poucas tabelas: ' + tabelas.length);
  const furos = [];
  for (const t of tabelas) for (const sql of [`select * from public.${t}`, `insert into public.${t} default values`, `update public.${t} set ${await col1(t)} = ${await col1(t)}`, `delete from public.${t}`]) {
    const r = await anon(sql); if (!/permission denied/.test(r)) furos.push(`${sql}: ${r}`);
  }
  const funcs = (await db.query(`select p.oid, p.proname, has_function_privilege('anon', p.oid, 'execute') anon, has_function_privilege('authenticated', p.oid, 'execute') logado
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.prorettype <> 'trigger'::regtype order by 2`)).rows;
  funcs.filter(f => f.anon).forEach(f => furos.push('anon executa ' + f.proname));
  /* a liberação das reservas vencidas é só do banco (pg_cron): fechada de propósito para todos */
  funcs.filter(f => !f.logado && f.proname !== 'liberar_reservas_vencidas').forEach(f => furos.push('quem está logado não executa ' + f.proname));
  for (const sql of [`select public.limpar_dados_org('${ORG}')`, `select public.criar_organizacao('Invasora')`, `select public.entrar_com_convite('X')`, `select public.eh_membro('${ORG}')`]) {
    const r = await anon(sql); if (!/permission denied/.test(r)) furos.push(`${sql}: ${r}`);
  }
  if (furos.length) throw new Error(furos.length + ' furo(s): ' + furos.slice(0, 4).join(' | '));
  if (funcs.length < 15) throw new Error('poucas funções conferidas: ' + funcs.length);
});
await passo('reserva vencida: o banco libera sozinho só na empresa que escolheu; ninguém do app chama a função', async () => {
  const ORG3 = '33333333-3333-3333-3333-333333333333';
  await db.exec(`
    insert into public.organizacoes (id, nome) values ('${ORG3}', 'Outra Loteadora');
    insert into public.loteamentos (org_id, id, nome) values ('${ORG3}', 'lotx', 'Outro');
    update public.organizacoes set config = config || '{"reservaLiberaSozinha": true}'::jsonb where id = '${ORG}';
    set session_replication_role = replica;
    insert into public.lotes (org_id, id, loteamento_id, quadra, numero, status, reserva_id) values
      ('${ORG}', 'lv1', 'lot1', 'R', '1', 'reservado', 'rv1'),
      ('${ORG}', 'lv2', 'lot1', 'R', '2', 'reservado', 'rv2'),
      ('${ORG}', 'lv3', 'lot1', 'R', '3', 'reservado', 'rv3'),
      ('${ORG3}', 'lv9', 'lotx', 'R', '9', 'reservado', 'rv9');
    set session_replication_role = origin;
    insert into public.reservas (org_id, id, loteamento_id, lote_id, cliente, status, validade) values
      ('${ORG}', 'rv1', 'lot1', 'lv1', '{"nome":"Vencida Ontem"}', 'aprovada', (now() at time zone 'America/Sao_Paulo')::date - 1),
      ('${ORG}', 'rv2', 'lot1', 'lv2', '{"nome":"Vence Hoje"}', 'aprovada', (now() at time zone 'America/Sao_Paulo')::date),
      ('${ORG}', 'rv3', 'lot1', 'lv3', '{"nome":"Pedido Velho"}', 'pendente', (now() at time zone 'America/Sao_Paulo')::date - 3),
      ('${ORG3}', 'rv9', 'lotx', 'lv9', '{"nome":"Empresa Manual"}', 'aprovada', (now() at time zone 'America/Sao_Paulo')::date - 5);`);
  const n = (await db.query(`select public.liberar_reservas_vencidas() as n`)).rows[0].n;
  const st = (await db.query(`select r.id, r.status, l.status as lote, l.reserva_id from public.reservas r join public.lotes l on l.org_id = r.org_id and l.id = r.lote_id where r.id in ('rv1','rv2','rv3','rv9') order by r.id`)).rows.map(x => `${x.id}:${x.status}/${x.lote}${x.reserva_id ? '' : '(livre)'}`).join(' ');
  if (n !== 2 || st !== 'rv1:expirada/disponivel(livre) rv2:aprovada/reservado rv3:expirada/disponivel(livre) rv9:aprovada/reservado') throw new Error(n + ' · ' + st);
  const log = (await db.query(`select count(*)::int as n from public.log where org_id = '${ORG}' and msg like 'Reserva expirada: Quadra R · Lote 1 — Vencida Ontem%'`)).rows[0].n;
  if (log !== 1) throw new Error('sem registro no histórico');
  if ((await db.query(`select public.liberar_reservas_vencidas() as n`)).rows[0].n !== 0) throw new Error('liberou de novo');
  await db.exec(SCHEMA);   // como no Supabase: o schema rodado de novo deixa a função fechada
  const pode = (await db.query(`select has_function_privilege('authenticated', 'public.liberar_reservas_vencidas()', 'execute') a, has_function_privilege('anon', 'public.liberar_reservas_vencidas()', 'execute') b`)).rows[0];
  if (pode.a || pode.b) throw new Error('app consegue chamar a função: ' + JSON.stringify(pode));
});
await passo('corretor continua barrado pela função (nem chega às travas por pessoa)', async () => {
  await db.exec(`insert into public.vendas (org_id, id, loteamento_id, lote_id, valor_total) values ('${ORG}','v9','lot1','l9',1)`);
  const r = await como('cor', `update public.vendas set obs = 'x' where id = 'v9' returning id`);
  if (r.rows.length) throw new Error('corretor conseguiu editar');
});

await passo('caixa e bancos: conta nova pede "alterar configurações"; o financeiro lança movimento; o corretor nem vê', async () => {
  await ajustar({ permissoesPessoas: {} });
  const conta = id => `insert into public.contas_caixa (org_id, id, nome, tipo, saldo_inicial, data_saldo) values ('${ORG}','${id}','BB Corrente','corrente',12500.5,'2026-10-01')`;
  await recusa('fin', conta('cx1'), 'contas do caixa');
  await como('admin', conta('cx1'));
  const mov = (id, v) => `insert into public.movimentos (org_id, id, conta_id, data, valor, natureza, recebivel_id) values ('${ORG}','${id}','cx1','2026-10-15',${v},'recebimento','r1')`;
  await como('fin', mov('m1', 1000));
  await como('fin', `update public.movimentos set valor = 1000 where id = 'm1'`);   // reenvio sem mudança
  await recusa('cor', mov('m2', 50), 'lançar no caixa');
  if ((await como('cor', `select * from public.movimentos`)).rows.length) throw new Error('corretor viu o caixa');
  await ajustar({ permissoesPessoas: { [U.fin]: { 'financeiro.baixar': false, 'financeiro.antecipar': false, 'custos.editar': false, 'comissao.gerenciar': false } } });
  await recusa('fin', mov('m3', 10), 'lançar no caixa');
  await ajustar({ permissoesPessoas: {} });
  const r = (await db.query(`select c.saldo_inicial + coalesce(sum(m.valor), 0) as saldo from public.contas_caixa c left join public.movimentos m on m.org_id = c.org_id and m.conta_id = c.id and m.data >= c.data_saldo where c.id = 'cx1' group by c.saldo_inicial`)).rows[0];
  if (r.saldo !== 13500.5) throw new Error('saldo ' + r.saldo);
});
await passo('receitas avulsas: o financeiro lança e recebe; sem "registrar pagamentos", o banco recusa; o corretor nem vê', async () => {
  await ajustar({ permissoesPessoas: {} });
  const ins = id => `insert into public.receitas (org_id, id, tipo_id, descricao, valor, data_competencia) values ('${ORG}','${id}','corretagem','Comissão apto 302',8000,'2026-10-01')`;
  await como('fin', ins('rc1'));
  await como('fin', `update public.receitas set status = 'recebido', data_recebimento = '2026-10-10', forma = null where id = 'rc1'`);
  await como('fin', `insert into public.movimentos (org_id, id, conta_id, data, valor, natureza, receita_id) values ('${ORG}','mr-rc1','cx1','2026-10-10',8000,'receita','rc1')`);
  await recusa('cor', ins('rc2'), 'lançar receitas');
  if ((await como('cor', `select * from public.receitas`)).rows.length) throw new Error('corretor viu as receitas');
  await ajustar({ permissoesPessoas: { [U.fin]: { 'financeiro.baixar': false } } });
  await recusa('fin', ins('rc3'), 'lançar receitas');
  await ajustar({ permissoesPessoas: {} });
});
console.log(erros.length ? '\nERROS:\n' + erros.join('\n') : '\ntudo ok');
process.exit(erros.length ? 1 : 0);
