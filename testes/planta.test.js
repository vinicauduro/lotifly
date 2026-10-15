// Planta: situação também por desenho, legenda dentro da planta, botões de zoom sem cobrir
// lotes e navegação pelo teclado. No celular e no computador, corretor e administração.
// Rodar: BASE=http://127.0.0.1:8765/lotifly/ node testes/planta.test.js
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/gestao/';
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--disable-gpu'] });
  const erros = [];
  const sobrepoe = (a, b) => a.x < b.x + b.width - 1 && a.x + a.width > b.x + 1 && a.y < b.y + b.height - 1 && a.y + a.height > b.y + 1;
  for (const w of [390, 1440]) for (const quem of ['corretor', 'admin']) {
    const passo = async (nome, fn) => { try { await fn(); console.log('✔', w, quem, nome); } catch (e) { console.log('✘', w, quem, nome, e.message.split('\n')[0]); erros.push(`${w} ${quem} ${nome}: ${e.message.split('\n')[0]}`); } };
    const ctx = await browser.newContext({ viewport: { width: w, height: w < 700 ? 844 : 900 }, serviceWorkers: 'block' });
    await ctx.route(/config\.js/, r => r.fulfill({ contentType: 'application/javascript', body: "window.GL_CONFIG={supabaseUrl:'',supabaseAnonKey:''};" }));
    const page = await ctx.newPage(); page.setDefaultTimeout(8000);
    page.on('pageerror', e => erros.push(`${w} ${quem} pageerror: ${e.message}`));
    await page.goto(BASE + 'index.html?dados=exemplo'); await page.waitForFunction(() => window.PiorCaso && db.loteamentos.length); await page.waitForTimeout(300);
    await page.evaluate(quem => { document.querySelectorAll('#devDados,.toast').forEach(e => e.remove()); if (quem === 'admin') { sessionStorage.setItem('gl_admin', '1'); startRole('admin'); abrirEmpreendimento(db.loteamentos[0].id, 'planta'); } else { startRole('corretor'); switchTab('planta'); } }, quem);
    await page.waitForTimeout(600);
    const box = page.locator(quem === 'admin' ? '#aPlantaBox' : '#cPlantaBox');
    await box.scrollIntoViewIfNeeded();

    await passo('botões de zoom e legenda não cobrem nenhum lote', async () => {
      const r = await box.evaluate(b => {
        const ret = el => { const x = el.getBoundingClientRect(); return { x: x.x, y: x.y, width: x.width, height: x.height }; };
        return { ctrls: ret(b.querySelector('.planta-ctrls')), leg: ret(b.querySelector('.planta-legenda')), caixa: ret(b), lotes: [...b.querySelectorAll('.lote-shape')].map(p => ({ id: p.dataset.id, ...ret(p) })) };
      });
      const cobertos = r.lotes.filter(l => sobrepoe(l, r.ctrls) || sobrepoe(l, r.leg)).map(l => l.id);
      if (cobertos.length) throw new Error('cobertos: ' + cobertos.join(', '));
      if (r.leg.x < r.caixa.x || r.leg.y + r.leg.height > r.caixa.y + r.caixa.height + 1) throw new Error('legenda fora da planta');
    });
    await passo('situação também por desenho: listras, pontos e xadrez', async () => {
      const r = await box.evaluate(b => {
        const marcas = new Map([...b.querySelectorAll('.lote-marca')].map(m => [m.getAttribute('points'), m.getAttribute('fill')]));
        return [...b.querySelectorAll('.lote-shape')].map(p => { const st = ['disponivel', 'reservado', 'vendido', 'bloqueado'].find(s => p.classList.contains(s)); const f = marcas.get(p.getAttribute('points')) || ''; return { st, ok: st === 'disponivel' ? !f : f.includes('-' + st + ')') }; });
      });
      const ruins = r.filter(x => !x.ok); if (ruins.length) throw new Error(JSON.stringify(ruins.slice(0, 3)));
      if (!r.some(x => x.st !== 'disponivel')) throw new Error('sem lotes não disponíveis no exemplo');
    });
    await passo('teclado: setas percorrem os lotes, o leitor ouve o lote e Enter abre', async () => {
      await box.focus();
      await page.keyboard.press('ArrowRight'); await page.waitForTimeout(80);
      const fala1 = await box.locator('[aria-live]').textContent();
      if (!/Quadra A · Lote 1 — /.test(fala1)) throw new Error('primeiro: ' + fala1);
      await page.keyboard.press('ArrowRight'); await page.waitForTimeout(80);
      const fala2 = await box.locator('[aria-live]').textContent();
      if (!/Quadra A · Lote 2 — /.test(fala2)) throw new Error('direita: ' + fala2);
      await page.keyboard.press('ArrowDown'); await page.waitForTimeout(80);
      const fala3 = await box.locator('[aria-live]').textContent();
      if (/Lote 2 —/.test(fala3) && /Quadra A/.test(fala3)) throw new Error('para baixo não andou: ' + fala3);
      if (await box.locator('.lote-shape.teclado').count() !== 1) throw new Error('cursor do teclado não aparece');
      await page.keyboard.press('Enter'); await page.waitForTimeout(400);
      if (!await page.evaluate(() => document.getElementById('modalOverlay').classList.contains('open') || (state.editorLoteId != null))) throw new Error('Enter não abriu o lote');
    });
    await ctx.close();
  }
  console.log(erros.length ? '\nERROS:\n' + erros.join('\n') : '\ntudo ok');
  await browser.close(); process.exit(erros.length ? 1 : 0);
})();
