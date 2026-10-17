// Histórico na nuvem: ao abrir a empresa vêm os 400 registros MAIS RECENTES (antes vinham os
// 400 mais antigos e, passado esse número, nada novo aparecia); e a aba Histórico de um
// contrato busca no banco os registros dele que já saíram da memória, uma vez só, sem repetir.
// O Supabase é simulado.
// Rodar: BASE=http://127.0.0.1:8765/gestao/ node testes/historico-recente.test.js
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/gestao/';
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--disable-gpu'] });
  const erros = [];
  const passo = async (nome, fn) => { try { await fn(); console.log('✔', nome); } catch (e) { console.log('✘', nome, e.message.split('\n')[0]); erros.push(`${nome}: ${e.message.split('\n')[0]}`); } };
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
  await ctx.route(/config\.js/, r => r.fulfill({ contentType: 'application/javascript', body: "window.GL_CONFIG={supabaseUrl:'',supabaseAnonKey:''};" }));
  const page = await ctx.newPage(); page.setDefaultTimeout(8000);
  page.on('pageerror', e => erros.push(`pageerror: ${e.message}`));
  await page.goto(BASE + 'index.html?dados=exemplo'); await page.waitForFunction(() => window.PiorCaso && db.loteamentos.length); await page.waitForTimeout(300);
  await page.evaluate(() => {
    sessionStorage.setItem('gl_admin', '1'); startRole('admin'); document.querySelectorAll('#devDados,.toast').forEach(e => e.remove());
    const ORG = '11111111-1111-1111-1111-111111111111';
    window.venda = db.vendas.find(v => v.status === 'ativa' && v.loteId);
    const L = imovelLabel(venda);
    const ts = i => new Date(Date.UTC(2025, 0, 1) + i * 3600e3).toISOString();
    /* 600 registros: os 100 primeiros (os mais antigos) são deste contrato; os outros 500,
       mais novos, são de outras coisas. O último do contrato é o mais novo de todos. */
    window.banco = { log: Array.from({ length: 600 }, (_, i) => ({ id: 'g' + String(i).padStart(4, '0'), org_id: ORG, ts: ts(i), who: 'Ana', msg: i < 100 ? `Parcela ${i + 1}/60 recebida — ${L}` : `Despesa lançada nº ${i}` })) };
    banco.log.push({ id: 'g9999', org_id: ORG, ts: ts(700), who: 'Ana', msg: `Venda editada: ${L} — ${venda.cliente.nome}` });
    window.pedidos = [];
    const consulta = tabela => {
      const st = { lim: null, asc: true, ordem: 'id', filtros: [] };
      const q = {
        select: () => q, eq: () => q, range: () => q, upsert: () => q, delete: () => q,
        ilike: (c, p) => { st.filtros.push(p); return q; },
        order: (c, o) => { st.ordem = c; st.asc = !o || o.ascending !== false; return q; }, limit: n => { st.lim = n; return q; },
        then: (ok, ko) => {
          pedidos.push({ tabela, filtros: st.filtros.slice() });
          let rows = (banco[tabela] || []).slice();
          st.filtros.forEach(p => { const txt = p.slice(1, -1).replace(/\\(.)/g, '$1'); rows = rows.filter(r => r.msg.includes(txt)); });
          rows.sort((a, b) => (String(a[st.ordem]) < String(b[st.ordem]) ? -1 : 1) * (st.asc ? 1 : -1));
          if (st.lim != null) rows = rows.slice(0, st.lim);
          return Promise.resolve({ data: rows, error: null, count: rows.length }).then(ok, ko);
        }
      };
      return q;
    };
    Cloud.client = { from: t => consulta(t), removeChannel: () => {}, auth: { getSession: async () => ({ data: { session: null } }) } };
    Cloud.user = { id: 'u1' }; Cloud.org = { id: ORG }; Cloud.admin = false; Cloud.membro = { nome: 'Ana' };
    /* Só o histórico vem do banco simulado; o resto continua o do exemplo */
    window.carregar = async () => { const guarda = JSON.parse(JSON.stringify(db)); await Cloud.loadAll(); Object.keys(guarda).forEach(k => { if (k !== 'log') db[k] = guarda[k]; }); };
    window.abrirHistorico = () => { state.contratoAba = 'historico'; abrirContrato(venda.id); state.contratoAba = 'historico'; renderContrato(); };
    window.textoHistorico = () => (document.querySelector('#ctConteudo') || {}).textContent || '';
  });

  await passo('ao abrir a empresa vêm os 400 mais recentes, em ordem do mais antigo ao mais novo', async () => {
    const r = await page.evaluate(async () => { await carregar(); const l = db.log; return { n: l.length, primeiro: l[0].id, ultimo: l[l.length - 1].id, ordem: l.every((x, i) => !i || l[i - 1].ts <= x.ts) }; });
    if (r.n !== 400 || r.ultimo !== 'g9999' || r.primeiro !== 'g0201' || !r.ordem) throw new Error(JSON.stringify(r));
  });
  await passo('registro novo entra no fim e a memória continua com 400', async () => {
    const r = await page.evaluate(() => { Cloud.active = true; logAct('Teste de registro novo'); const l = db.log; Cloud.active = false; return { n: l.length, ultimo: l[l.length - 1].msg }; });
    if (r.n !== 400 || r.ultimo !== 'Teste de registro novo') throw new Error(JSON.stringify(r));
  });
  await passo('aba Histórico de um contrato antigo traz do banco os registros que saíram da memória', async () => {
    await page.evaluate(async () => { await carregar(); Cloud.active = true; pedidos = []; abrirHistorico(); });
    await page.waitForTimeout(400);
    const r = await page.evaluate(() => ({ t: textoHistorico(), n: (textoHistorico().match(/recebida/g) || []).length, busca: pedidos.filter(p => p.filtros.length).length }));
    if (!r.t.includes('Parcela 1/60 recebida') || r.n !== 100) throw new Error(`achou ${r.n} registros antigos; buscas ${r.busca}`);
    if (!r.t.includes('Venda editada')) throw new Error('perdeu o registro que já estava na memória');
  });
  await passo('sem repetir o que já estava na memória, e sem buscar de novo ao reabrir', async () => {
    const r = await page.evaluate(async () => { pedidos = []; abrirHistorico(); await new Promise(res => setTimeout(res, 200)); return { editada: (textoHistorico().match(/Venda editada/g) || []).length, buscas: pedidos.filter(p => p.filtros.length).length }; });
    if (r.editada !== 1 || r.buscas !== 0) throw new Error(JSON.stringify(r));
  });
  await passo('caractere especial no nome do imóvel ( % e _ ) vai escapado na busca', async () => {
    const r = await page.evaluate(async () => { pedidos = []; const x = Object.assign({}, venda, { id: 'vx', numeroContrato: '' , imovel: { descricao: 'Sala 50%_A' }, loteId: null }); const orig = imovelLabel; window.imovelLabel = v => v.id === 'vx' ? 'Sala 50%_A' : orig(v); await Cloud.historicoDoContrato(x); window.imovelLabel = orig; return pedidos.map(p => p.filtros).flat(); });
    if (!r.includes('%Sala 50\\%\\_A%')) throw new Error(JSON.stringify(r));
  });
  await passo('sem internet ou fora da nuvem: não busca nada e mostra o que tem', async () => {
    const r = await page.evaluate(async () => { pedidos = []; Cloud.logContratos = {}; Cloud.semInternet = true; abrirHistorico(); Cloud.semInternet = false; Cloud.active = false; abrirHistorico(); await new Promise(res => setTimeout(res, 200)); return { buscas: pedidos.length, t: textoHistorico().includes('Venda editada') }; });
    if (r.buscas !== 0 || !r.t) throw new Error(JSON.stringify(r));
  });
  await browser.close();
  if (erros.length) { console.log('\nERROS:\n' + erros.join('\n')); process.exit(1); }
  console.log('\nTudo certo.');
})();
