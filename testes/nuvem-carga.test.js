// Carga da nuvem sem o corte de 1.000 linhas. O Supabase entrega no máximo "Max rows" linhas
// por pedido (1.000 no padrão) e corta o resto calado; aqui o banco é simulado com esse corte.
// Confere: 2.500 parcelas chegam inteiras, sem repetir nem pular; tabela com exatamente 1.000
// e tabela vazia; corte menor (500) configurado no painel; banco que não informa o total;
// linhas apagadas no meio da carga não travam; erro num bloco do meio não carrega pela metade.
// Rodar: BASE=http://127.0.0.1:8765/gestao/ node testes/nuvem-carga.test.js
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
    const ORG = '11111111-1111-1111-1111-111111111111';
    const pad = n => String(n).padStart(5, '0');
    /* Banco simulado: cada tabela é uma lista de linhas; o pedido respeita eq/order/range/limit
       e o corte de MAX linhas, como o PostgREST do Supabase. */
    window.cenario = (op = {}) => {
      window.MAX = op.max || 1000; window.semTotal = !!op.semTotal; window.pedidos = []; window.aoPedir = op.aoPedir || null; window.falhaEm = op.falhaEm || null;
      window.banco = {};
      const linhas = (t, n, f) => { banco[tabelaDe(t)] = Array.from({ length: n }, (_, i) => Object.assign({ id: t[0] + pad(i + 1), org_id: ORG }, f ? f(i) : {})); };
      linhas('recebiveis', op.recebiveis ?? 2500, i => ({ venda_id: 'v' + pad(i % 40), tipo: 'parcela', numero: i % 60 + 1, valor: 1000 + i, valor_pago: 0, vencimento: '2027-01-10' }));
      linhas('lotes', op.lotes ?? 1000, i => ({ quadra: 'A', numero: String(i + 1), status: 'disponivel', preco: 100000 }));
      linhas('vendas', 40, i => ({ cliente: { nome: 'Comprador ' + i }, valor_total: 100000, status: 'ativa' }));
      linhas('log', 50, i => ({ ts: new Date(2026, 0, 1, 0, i).toISOString(), msg: 'evento ' + i }));
    };
    const consulta = tabela => {
      const st = { contar: false, de: 0, ate: null, lim: null, ordem: null };
      const q = {
        select: (c, o) => { st.contar = !!(o && o.count); return q; }, eq: () => q,
        order: c => { st.ordem = c; return q; }, limit: n => { st.lim = n; return q; }, range: (a, b) => { st.de = a; st.ate = b; return q; },
        upsert: () => q, delete: () => q,
        then: (ok, ko) => {
          pedidos.push({ tabela, de: st.de, ate: st.ate });
          if (falhaEm && falhaEm.tabela === tabela && falhaEm.de === st.de) return Promise.resolve({ data: null, error: { message: 'tempo esgotado' } }).then(ok, ko);
          const todas = (banco[tabela] || []).slice().sort((a, b) => String(a[st.ordem] ?? '') < String(b[st.ordem] ?? '') ? -1 : 1);
          let fim = st.ate != null ? st.ate + 1 : st.lim != null ? st.de + st.lim : todas.length;
          fim = Math.min(fim, st.de + MAX);
          const resp = { data: todas.slice(st.de, fim), error: null, count: st.contar && !semTotal ? todas.length : null };
          if (aoPedir) aoPedir(tabela, st);
          return Promise.resolve(resp).then(ok, ko);
        }
      };
      return q;
    };
    Cloud.client = { from: t => consulta(t), removeChannel: () => {}, auth: { getSession: async () => ({ data: { session: null } }) } };
    Cloud.user = { id: 'u1' }; Cloud.org = { id: ORG }; Cloud.admin = false;
    window.carregar = async () => { try { await Cloud.loadAll(); return null; } catch (e) { return e.message; } };
    window.conferir = col => { const ids = db[col].map(r => r.id); return { n: ids.length, unicos: new Set(ids).size, ultimo: ids[ids.length - 1] }; };
  });

  await passo('2.500 parcelas com o corte padrão de 1.000: chegam todas, sem repetir', async () => {
    const r = await page.evaluate(async () => { cenario(); const e = await carregar(); return { e, ...conferir('recebiveis'), pedidos: pedidos.filter(p => p.tabela === tabelaDe('recebiveis')).length }; });
    if (r.e || r.n !== 2500 || r.unicos !== 2500 || r.ultimo !== 'r02500') throw new Error(JSON.stringify(r));
    if (r.pedidos !== 3) throw new Error('pedidos: ' + r.pedidos);
  });
  await passo('o resto do app enxerga as 2.500: soma do contas a receber bate com o banco', async () => {
    const r = await page.evaluate(() => ({ soma: db.recebiveis.reduce((s, x) => s + num(x.valor), 0), banco: banco[tabelaDe('recebiveis')].reduce((s, x) => s + x.valor, 0) }));
    if (r.soma !== r.banco) throw new Error(JSON.stringify(r));
  });
  await passo('tabela com exatamente 1.000 linhas e tabela vazia: um pedido só cada', async () => {
    const r = await page.evaluate(async () => { cenario({ recebiveis: 0 }); const e = await carregar(); const p = t => pedidos.filter(x => x.tabela === tabelaDe(t)).length; return { e, lotes: db.lotes.length, rec: db.recebiveis.length, pl: p('lotes'), pr: p('recebiveis') }; });
    if (r.e || r.lotes !== 1000 || r.rec !== 0 || r.pl !== 1 || r.pr !== 1) throw new Error(JSON.stringify(r));
  });
  await passo('corte menor configurado no painel (500): continua trazendo tudo', async () => {
    const r = await page.evaluate(async () => { cenario({ max: 500, lotes: 1234 }); const e = await carregar(); return { e, rec: conferir('recebiveis'), lotes: conferir('lotes') }; });
    if (r.e || r.rec.n !== 2500 || r.rec.unicos !== 2500 || r.lotes.n !== 1234) throw new Error(JSON.stringify(r));
  });
  await passo('banco que não informa o total: vai até o bloco incompleto', async () => {
    const r = await page.evaluate(async () => { cenario({ semTotal: true }); const e = await carregar(); return { e, ...conferir('recebiveis') }; });
    if (r.e || r.n !== 2500 || r.unicos !== 2500) throw new Error(JSON.stringify(r));
  });
  await passo('linhas apagadas por outro usuário no meio da carga: termina, sem travar', async () => {
    const r = await page.evaluate(async () => {
      cenario({ aoPedir: (t, st) => { if (t === tabelaDe('recebiveis') && st.de === 0) banco[t] = banco[t].slice(0, 1000); } });
      const e = await Promise.race([carregar(), new Promise(res => setTimeout(() => res('travou'), 3000))]);
      return { e, n: db.recebiveis.length };
    });
    if (r.e || r.n !== 1000) throw new Error(JSON.stringify(r));
  });
  await passo('erro num bloco do meio: a carga falha inteira, não fica pela metade', async () => {
    const r = await page.evaluate(async () => {
      cenario(); await carregar(); const antes = db.recebiveis.length;
      cenario({ falhaEm: { tabela: tabelaDe('recebiveis'), de: 1000 } }); const e = await carregar();
      return { e, antes, depois: db.recebiveis.length };
    });
    if (!r.e || !/recebiveis/.test(r.e) || r.depois !== r.antes) throw new Error(JSON.stringify(r));
  });
  await passo('histórico continua com um pedido só, limitado a 400', async () => {
    const r = await page.evaluate(async () => { cenario(); await carregar(); return { n: db.log.length, p: pedidos.filter(x => x.tabela === tabelaDe('log')).length }; });
    if (r.n !== 50 || r.p !== 1) throw new Error(JSON.stringify(r));
  });
  await browser.close();
  if (erros.length) { console.log('\nERROS:\n' + erros.join('\n')); process.exit(1); }
  console.log('\nTudo certo.');
})();
