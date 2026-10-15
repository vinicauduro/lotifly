// Abre todas as telas (administração e corretor) no celular e no computador, com e sem
// "reduzir movimento", e falha se alguma der erro de JavaScript.
// Rodar: BASE=http://127.0.0.1:8765/lotifly/ node testes/telas.test.js
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  let total = 0;
  for (const w of [390, 1440]) for (const rm of ['no-preference', 'reduce']) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 860 }, reducedMotion: rm, serviceWorkers: 'block' });
    await ctx.route(/config\.js/, r => r.fulfill({ contentType: 'application/javascript', body: "window.GL_CONFIG={supabaseUrl:'',supabaseAnonKey:''};" }));
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('dialog', d => d.accept());
    await page.goto((process.env.BASE || 'http://127.0.0.1:8765/gestao/') + 'index.html?dados=exemplo'); await page.waitForFunction(() => window.PiorCaso && db.loteamentos.length); await page.waitForTimeout(400);
    await page.evaluate(() => { sessionStorage.setItem('gl_admin', '1'); startRole('admin'); });
    const tabs = await page.evaluate(() => [...document.querySelectorAll('#screen-admin .view')].map(v => v.id.replace('av-', '')));
    for (const t of tabs) { await page.evaluate(t => { try { switchTab(t); } catch (e) { throw e; } }, t).catch(e => errs.push(t + ': ' + e.message)); await page.waitForTimeout(80); }
    await page.evaluate(() => { const v = db.vendas[0]; abrirContrato(v.id, 'parcelas'); });
    await page.waitForTimeout(100);
    await page.evaluate(() => { startRole('corretor'); }); 
    for (const t of ['planta', 'lotes', 'reservas', 'perfil']) { await page.evaluate(t => switchTab(t), t).catch(e => errs.push(t + ': ' + e.message)); await page.waitForTimeout(80); }
    console.log(w, rm, tabs.length + 4 + ' telas', errs.length ? 'ERROS: ' + errs.join(' | ') : 'sem erros'); total += errs.length;
    await ctx.close();
  }
  await browser.close(); process.exit(total ? 1 : 0);
})();
