// Planta e app sem internet (modo nuvem). O Supabase é simulado e a falta de internet é a do
// próprio navegador (setOffline). Confere: a planta fica guardada no aparelho ao ser vista e
// ao entrar na empresa; abre sem internet; versão nova substitui a antiga; sair da conta apaga
// tudo; o app abre sem internet com os dados salvos (também quando o login não renova);
// alteração sem internet fica pendente com aviso certo; voltando a internet, recarrega.
// Rodar: BASE=http://127.0.0.1:8765/lotifly/ node testes/planta-offline.test.js
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/gestao/';
const ORG = '11111111-1111-1111-1111-111111111111';
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--disable-gpu'] });
  const erros = [];
  const passo = async (nome, fn) => { try { await fn(); console.log('✔', nome); } catch (e) { console.log('✘', nome, e.message.split('\n')[0]); erros.push(`${nome}: ${e.message.split('\n')[0]}`); } };
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, serviceWorkers: 'block' });
  await ctx.route(/config\.js/, r => r.fulfill({ contentType: 'application/javascript', body: "window.GL_CONFIG={supabaseUrl:'',supabaseAnonKey:''};" }));
  const page = await ctx.newPage(); page.setDefaultTimeout(8000);
  page.on('pageerror', e => erros.push(`pageerror: ${e.message}`)); page.on('dialog', d => d.accept());
  await page.goto(BASE + 'index.html?dados=exemplo'); await page.waitForFunction(() => window.PiorCaso && db.loteamentos.length); await page.waitForTimeout(300);
  await page.evaluate((ORG) => {
    sessionStorage.setItem('gl_admin', '1'); startRole('admin'); document.querySelectorAll('#devDados,.toast').forEach(e => e.remove());
    /* Nuvem simulada: Storage com link assinado e download; banco que falha sem internet */
    const icone = location.href.split('index.html')[0] + 'icon-192.png';
    window.pedidos = 0; window.baixados = []; window.abertas = [];
    const semRedeErr = () => new TypeError('Failed to fetch');
    const consulta = () => { const q = { select: () => q, eq: () => q, limit: () => q, order: () => q, upsert: () => q, delete: () => q, then: (ok, ko) => (navigator.onLine ? Promise.resolve({ data: [], error: null }) : Promise.reject(semRedeErr())).then(ok, ko) }; return q; };
    Cloud.client = {
      storage: { from: () => ({
        createSignedUrl: async () => { if (!navigator.onLine) throw semRedeErr(); return { data: { signedUrl: icone + '?token=' + (++pedidos) }, error: null }; },
        download: async (p) => { baixados.push(p); const r = await fetch(icone); return { data: await r.blob(), error: null }; }
      }) },
      from: () => consulta(), removeChannel: () => {},
      auth: { getSession: async () => ({ data: { session: null }, error: { message: 'Failed to fetch' } }), signOut: async () => {} }
    };
    Cloud.user = { id: 'u1' }; Cloud.org = { id: ORG };
    window.abrirPlanta = (img, lotIdx = 0) => {
      const lot = db.loteamentos[lotIdx];
      db.loteamentos[lotIdx] = Object.assign({}, lot, { planta: { img, w: 192, h: 192 } });
      prefs.aModo = 'imagem'; state.plantaAdmin = null; abrirEmpreendimento(lot.id, 'planta');
    };
    window.hrefPlanta = () => { const i = [...document.querySelectorAll('svg image')].find(x => x.getBoundingClientRect().width > 0) || document.querySelector('svg image'); return i ? (i.getAttribute('href') || '') : null; };
    window.chaves = async () => (await caches.has('lotifly-plantas')) ? (await (await caches.open('lotifly-plantas')).keys()).map(r => r.url.split('__plantas__/')[1]) : null;
    window.carrega = src => new Promise(res => { const i = new Image(); i.onload = () => res(i.naturalWidth); i.onerror = () => res(0); i.src = src; });
  }, ORG);
  const espera = ms => page.waitForTimeout(ms);

  await passo('planta vista com internet fica guardada no aparelho (uma cópia por arquivo e versão)', async () => {
    await page.evaluate((ORG) => abrirPlanta(`storage:plantas/${ORG}/lot1.jpg?v=1`), ORG); await espera(700);
    const r = await page.evaluate(async () => ({ href: hrefPlanta(), chaves: await chaves(), baixados }));
    if (!/token=/.test(r.href || '')) throw new Error('sem link assinado: ' + r.href);
    if (!(r.chaves || []).includes(`${ORG}/lot1.jpg?v=1`)) throw new Error('não guardou: ' + JSON.stringify(r.chaves));
  });
  await passo('ao entrar na empresa, guarda as plantas que a pessoa ainda nem abriu', async () => {
    const r = await page.evaluate(async (ORG) => {
      const outro = db.loteamentos.find((l, i) => i > 0) || db.loteamentos[0];
      if (outro === db.loteamentos[0]) db.loteamentos.push(Object.assign({}, outro, { id: 'lot-b', nome: 'Outro' }));
      const b = db.loteamentos.find((l, i) => i > 0); b.planta = { img: `storage:plantas/${ORG}/lot2.jpg?v=5`, w: 192, h: 192 };
      await PlantaOffline.guardarTodas(); return chaves();
    }, ORG);
    if (!r.includes(`${ORG}/lot2.jpg?v=5`)) throw new Error(JSON.stringify(r));
  });
  await passo('sem internet: a planta abre da cópia do aparelho, sem pedir nada à nuvem', async () => {
    await ctx.setOffline(true);
    const antes = await page.evaluate(() => pedidos);
    await page.evaluate((ORG) => { Cloud._assinadas = {}; abrirPlanta(`storage:plantas/${ORG}/lot1.jpg?v=1`); }, ORG); await espera(600);
    const r = await page.evaluate(async () => ({ href: hrefPlanta(), n: pedidos }));
    if (!/^blob:/.test(r.href || '')) throw new Error('href: ' + r.href);
    if (r.n !== antes) throw new Error('pediu link sem internet');
    const w = await page.evaluate(h => carrega(h), r.href);
    if (w !== 192) throw new Error('a imagem guardada não carregou');
  });
  await passo('sem internet e com versão nova ainda não baixada: mostra a última guardada', async () => {
    await page.evaluate((ORG) => abrirPlanta(`storage:plantas/${ORG}/lot1.jpg?v=9`), ORG); await espera(500);
    if (!/^blob:/.test(await page.evaluate(() => hrefPlanta()) || '')) throw new Error('não mostrou a versão anterior');
  });
  await passo('com internet de novo, a versão nova substitui a antiga no aparelho', async () => {
    await ctx.setOffline(false);
    await page.evaluate((ORG) => { Cloud._assinadas = {}; abrirPlanta(`storage:plantas/${ORG}/lot1.jpg?v=2`); }, ORG); await espera(800);
    const ks = await page.evaluate(() => chaves());
    if (!ks.includes(`${ORG}/lot1.jpg?v=2`) || ks.includes(`${ORG}/lot1.jpg?v=1`)) throw new Error(JSON.stringify(ks));
  });
  await passo('sair da conta apaga as plantas guardadas; sem internet, a planta não abre mais', async () => {
    await page.evaluate(async () => { Cloud.fecharOrg(); await new Promise(r => setTimeout(r, 200)); });
    if (await page.evaluate(() => caches.has('lotifly-plantas'))) throw new Error('as plantas continuam no aparelho');
    await ctx.setOffline(true);
    await page.evaluate((ORG) => { Cloud.org = { id: ORG }; db = normalizeDB(JSON.parse(localStorage.getItem('gestao-loteamento-db') || localStorage.getItem(DB_KEY) || 'null')); Cloud._assinadas = {}; startRole('admin'); abrirPlanta(`storage:plantas/${ORG}/lot1.jpg?v=2`); }, ORG); await espera(500);
    if (await page.evaluate(() => hrefPlanta())) throw new Error('a planta abriu depois de sair');
    await ctx.setOffline(false);
  });
  await passo('app abre sem internet com os dados salvos neste aparelho, e avisa', async () => {
    await page.evaluate((ORG) => {
      localStorage.setItem('gl_orgs_u1', JSON.stringify([{ membro: { org_id: ORG, user_id: 'u1', papel: 'admin', nome: 'Admin', ativo: true }, org: { id: ORG, nome: 'Sua Incorporadora', config: {} } }]));
      localStorage.setItem('gl_cache_' + ORG, JSON.stringify(db));
      Cloud.enabled = true; Cloud.fecharOrg(); Cloud.user = { id: 'u1' }; prefs.orgId = ORG;
      document.querySelectorAll('.toast').forEach(e => e.remove());
    }, ORG);
    await ctx.setOffline(true);
    await page.evaluate(() => Cloud.aposLogin()); await espera(400);
    const r = await page.evaluate(() => ({ sem: Cloud.semInternet, st: Cloud.status, role: state.role, n: db.loteamentos.length, pill: [...document.querySelectorAll('.sync-pill')].map(e => e.textContent).join(' '), aviso: [...document.querySelectorAll('.toast')].map(t => t.textContent).join(' ') }));
    if (!r.sem || r.st !== 'offline' || r.role !== 'admin' || !r.n) throw new Error(JSON.stringify(r).slice(0, 200));
    if (!/Sem internet/.test(r.aviso)) throw new Error('sem aviso: ' + r.aviso);
  });
  await passo('login guardado que não renova sem internet: abre do mesmo jeito', async () => {
    await page.evaluate(() => { Cloud.fecharOrg(); Cloud.user = null; localStorage.setItem('sb-teste-auth-token', JSON.stringify({ user: { id: 'u1', email: 'a@b' } })); });
    await page.evaluate(() => Cloud.boot()); await espera(400);
    const r = await page.evaluate(() => ({ u: Cloud.user && Cloud.user.id, sem: Cloud.semInternet, role: state.role }));
    if (r.u !== 'u1' || !r.sem || r.role !== 'admin') throw new Error(JSON.stringify(r));
  });
  await passo('alteração sem internet fica pendente, com o aviso de que vai quando a conexão voltar', async () => {
    await page.evaluate(() => document.querySelectorAll('.toast').forEach(e => e.remove()));
    await page.evaluate(() => { const l = db.lotes[0]; upsert('lotes', Object.assign({}, l, { obs: 'anotado sem internet' })); });
    await espera(400);
    const r = await page.evaluate(() => ({ pend: Cloud.pendentes.some(p => p.col === 'lotes' && p.id === db.lotes[0].id), aviso: [...document.querySelectorAll('.toast')].map(t => t.textContent).join(' ') }));
    if (!r.pend) throw new Error('não ficou pendente');
    if (!/vai para a nuvem quando a conexão voltar/.test(r.aviso) || /Falha ao salvar/.test(r.aviso)) throw new Error('aviso: ' + r.aviso);
  });
  await passo('voltando a internet, o app recarrega da nuvem sozinho', async () => {
    await page.evaluate(() => { window.recarregou = null; Cloud.abrirOrg = async (id) => { window.recarregou = id; Cloud.semInternet = false; }; });
    await ctx.setOffline(false); await page.evaluate(() => window.dispatchEvent(new Event('online'))); await espera(300);
    if (await page.evaluate(() => window.recarregou) !== ORG) throw new Error('não recarregou');
  });
  await passo('sem dados salvos neste aparelho, sem internet: mostra o erro de conexão no login', async () => {
    await page.evaluate(() => { localStorage.removeItem('gl_orgs_u2'); Cloud.fecharOrg(); Cloud.user = { id: 'u2' }; window.telaAuth = null; const orig = window.renderAuth; window.renderAuth = (t, a) => { window.telaAuth = [t, a]; }; window.__orig = orig; });
    await ctx.setOffline(true);
    await page.evaluate(() => Cloud.aposLogin()); await espera(200);
    const t = await page.evaluate(() => { const x = window.telaAuth; window.renderAuth = window.__orig; return x; });
    await ctx.setOffline(false);
    if (!t || t[0] !== 'login' || !/Falha ao carregar/.test(t[1] || '')) throw new Error(JSON.stringify(t));
  });
  await passo('a atualização do app (service worker) não apaga as plantas guardadas', async () => {
    const sw = await (await page.request.get(BASE + 'sw.js')).text();
    if (!/k !== 'lotifly-plantas'/.test(sw)) throw new Error('o sw.js apagaria as plantas a cada versão');
  });
  await browser.close();
  if (erros.length) { console.log('\nERROS:\n' + erros.join('\n')); process.exit(1); }
  console.log('\nTudo certo.');
})();
