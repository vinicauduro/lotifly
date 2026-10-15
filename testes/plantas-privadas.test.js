// Plantas fechadas: na nuvem a imagem da planta não tem mais link público. O app guarda a
// referência ao arquivo e, para mostrar, pede ao Supabase um link assinado de uma hora.
// Aqui o Storage é simulado: confere o caminho pedido, o link na tela, o reaproveitamento do
// link, o link público antigo, a falha sem quebrar a tela e a imagem do modo local.
// Rodar: BASE=http://127.0.0.1:8765/lotifly/ node testes/plantas-privadas.test.js
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/gestao/';
const ORG = '11111111-1111-1111-1111-111111111111';
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--disable-gpu'] });
  const erros = [];
  const passo = async (nome, fn) => { try { await fn(); console.log('✔', nome); } catch (e) { console.log('✘', nome, e.message.split('\n')[0]); erros.push(`${nome}: ${e.message.split('\n')[0]}`); } };
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' });
  await ctx.route(/config\.js/, r => r.fulfill({ contentType: 'application/javascript', body: "window.GL_CONFIG={supabaseUrl:'',supabaseAnonKey:''};" }));
  const page = await ctx.newPage(); page.setDefaultTimeout(8000);
  page.on('pageerror', e => erros.push(`pageerror: ${e.message}`)); page.on('dialog', d => d.accept());
  await page.goto(BASE + 'index.html?dados=exemplo'); await page.waitForFunction(() => window.PiorCaso && db.loteamentos.length); await page.waitForTimeout(300);
  await page.evaluate((ORG) => {
    sessionStorage.setItem('gl_admin', '1'); startRole('admin'); document.querySelectorAll('#devDados,.toast').forEach(e => e.remove());
    /* Storage simulado: anota cada pedido; "falhar" faz o próximo pedido dar erro */
    window.pedidos = []; window.falhar = false; window.enviados = [];
    Cloud.org = { id: ORG };
    Cloud.client = { storage: { from: (bucket) => ({
      createSignedUrl: async (path, seg) => { pedidos.push({ bucket, path, seg }); if (falhar) return { data: null, error: { message: 'sem permissão' } }; return { data: { signedUrl: location.href.split('index.html')[0] + 'icon-192.png?token=' + pedidos.length }, error: null }; },
      upload: async (path) => { enviados.push({ bucket, path }); return { error: null }; },
      getPublicUrl: () => { throw new Error('não deveria pedir link público'); }
    }) } };
    window.abrirComImagem = (img) => {
      const lot = db.loteamentos[0];
      upsert('loteamentos', Object.assign({}, lot, { planta: { img, w: 192, h: 192 } }));
      prefs.aModo = 'imagem'; state.plantaAdmin = null; abrirEmpreendimento(lot.id, 'planta');
    };
    window.hrefDaPlanta = () => { const i = [...document.querySelectorAll('svg image')].find(x => x.closest('.screen.active, [id^="av-"]') && x.getBoundingClientRect().width > 0) || document.querySelector('svg image'); return i ? (i.getAttribute('href') || '') : null; };
  }, ORG);

  await passo('link público antigo: pede o link assinado do mesmo arquivo e mostra a planta', async () => {
    await page.evaluate((ORG) => abrirComImagem(`https://abc.supabase.co/storage/v1/object/public/plantas/${ORG}/lot1.jpg?v=1`), ORG);
    await page.waitForTimeout(500);
    const r = await page.evaluate(() => ({ pedidos, href: hrefDaPlanta() }));
    if (!r.pedidos.length || r.pedidos[0].bucket !== 'plantas' || r.pedidos[0].path !== `${ORG}/lot1.jpg` || r.pedidos[0].seg !== 3600) throw new Error(JSON.stringify(r.pedidos));
    if (!/icon-192\.png\?token=1$/.test(r.href || '')) throw new Error('href: ' + r.href);
    const ok = await page.evaluate(() => new Promise(res => { const i = new Image(); i.onload = () => res(true); i.onerror = () => res(false); i.src = hrefDaPlanta(); }));
    if (!ok) throw new Error('a imagem do link não carregou');
  });
  await passo('redesenhar a planta não pede outro link (reaproveita por 50 minutos)', async () => {
    const antes = await page.evaluate(() => pedidos.length);
    await page.evaluate(() => { state.plantaAdmin = null; renderCurrent(); }); await page.waitForTimeout(300);
    const r = await page.evaluate(() => ({ n: pedidos.length, href: hrefDaPlanta() }));
    if (r.n !== antes || !/token=1$/.test(r.href)) throw new Error(JSON.stringify(r));
  });
  await passo('enviar planta na nuvem guarda a referência ao arquivo, nunca um link', async () => {
    const ref = await page.evaluate(async () => Cloud.uploadPlanta(db.loteamentos[0].id, 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='));
    const lid = await page.evaluate(() => db.loteamentos[0].id);
    if (!new RegExp(`^storage:plantas/${ORG}/${lid}\\.jpg\\?v=\\d+$`).test(ref)) throw new Error(ref);
    const env = await page.evaluate(() => enviados[0]);
    if (env.bucket !== 'plantas' || env.path !== `${ORG}/${lid}.jpg`) throw new Error(JSON.stringify(env));
  });
  await passo('referência nova abre pelo link assinado; planta reenviada pede link novo', async () => {
    await page.evaluate((ORG) => abrirComImagem(`storage:plantas/${ORG}/lot1.jpg?v=2`), ORG); await page.waitForTimeout(400);
    const r = await page.evaluate(() => ({ ult: pedidos[pedidos.length - 1], n: pedidos.length, href: hrefDaPlanta() }));
    if (r.ult.path !== `${ORG}/lot1.jpg` || r.n !== 2 || !/token=2$/.test(r.href)) throw new Error(JSON.stringify(r));
  });
  await passo('sem permissão (quem não é da empresa): a tela abre sem imagem, sem erro, e tenta de novo depois', async () => {
    await page.evaluate((ORG) => { falhar = true; abrirComImagem(`storage:plantas/${ORG}/lot9.jpg?v=1`); }, ORG); await page.waitForTimeout(400);
    const r1 = await page.evaluate(() => ({ href: hrefDaPlanta(), n: pedidos.length }));
    if (r1.href) throw new Error('mostrou algo: ' + r1.href);
    await page.evaluate(() => { falhar = false; state.plantaAdmin = null; renderCurrent(); }); await page.waitForTimeout(400);
    const r2 = await page.evaluate(() => ({ href: hrefDaPlanta(), n: pedidos.length }));
    if (r2.n !== r1.n + 1 || !r2.href) throw new Error(JSON.stringify([r1, r2]));
  });
  await passo('modo local: a imagem guardada no aparelho vai direto, sem pedir link', async () => {
    const antes = await page.evaluate(() => pedidos.length);
    const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    await page.evaluate((png) => abrirComImagem(png), png); await page.waitForTimeout(300);
    const r = await page.evaluate(() => ({ n: pedidos.length, href: hrefDaPlanta() }));
    if (r.n !== antes || r.href !== png) throw new Error(JSON.stringify({ n: r.n, href: (r.href || '').slice(0, 40) }));
  });
  await passo('corretor: a planta dele também abre pelo link assinado', async () => {
    await page.evaluate((ORG) => {
      const lot = db.loteamentos[0];
      upsert('loteamentos', Object.assign({}, lot, { planta: { img: `storage:plantas/${ORG}/lot1.jpg?v=3`, w: 192, h: 192 } }));
      startRole('corretor'); setCurLotSilencioso(lot.id); renderCurrent();
    }, ORG);
    await page.waitForTimeout(500);
    const r = await page.evaluate(() => ({ ult: pedidos[pedidos.length - 1], hrefs: [...document.querySelectorAll('svg image')].map(i => i.getAttribute('href')) }));
    if (r.ult.path !== `${ORG}/lot1.jpg` || !r.hrefs.some(h => /icon-192\.png\?token=/.test(h || ''))) throw new Error(JSON.stringify(r));
  });
  await passo('o service worker não guarda nada de fora do app (dados e plantas da nuvem)', async () => {
    const sw = await (await page.request.get(BASE + 'sw.js')).text();
    if (!/origin !== self\.location\.origin\) return;/.test(sw)) throw new Error('o sw.js ainda guarda pedidos de outros endereços');
  });
  await browser.close();
  if (erros.length) { console.log('\nERROS:\n' + erros.join('\n')); process.exit(1); }
  console.log('\nTudo certo.');
})();
