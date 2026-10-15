// Cabeçalho do contrato: uma ação principal (registrar o pagamento da próxima parcela),
// Documentos e Mais como menus, Excluir separado. No celular e no computador.
// Rodar: BASE=http://127.0.0.1:8765/lotifly/ node testes/contrato.test.js
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/gestao/';
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--disable-gpu'] });
  const erros = [];
  for (const w of [390, 1440]) {
    const passo = async (nome, fn) => { try { await fn(); console.log('✔', w, nome); } catch (e) { console.log('✘', w, nome, e.message.split('\n')[0]); erros.push(`${w} ${nome}: ${e.message.split('\n')[0]}`); } };
    const ctx = await browser.newContext({ viewport: { width: w, height: w < 700 ? 844 : 900 }, hasTouch: w < 700, serviceWorkers: 'block' });
    await ctx.route(/config\.js/, r => r.fulfill({ contentType: 'application/javascript', body: "window.GL_CONFIG={supabaseUrl:'',supabaseAnonKey:''};" }));
    const page = await ctx.newPage(); page.setDefaultTimeout(8000);
    page.on('pageerror', e => erros.push(`${w} pageerror: ${e.message}`)); page.on('dialog', d => d.dismiss());
    await page.goto(BASE + 'index.html?dados=exemplo'); await page.waitForFunction(() => window.PiorCaso && db.loteamentos.length); await page.waitForTimeout(300);
    const vid = await page.evaluate(() => { sessionStorage.setItem('gl_admin', '1'); startRole('admin'); document.querySelectorAll('#devDados,.toast').forEach(e => e.remove()); const v = db.vendas.find(v => v.status === 'ativa'); abrirContrato(v.id, 'resumo'); return v.id; });
    await page.waitForTimeout(300);
    const topo = page.locator('.ct-topo');

    await passo('só um botão de destaque: Registrar pagamento', async () => {
      const r = await topo.evaluate(t => ({ cheios: [...t.querySelectorAll('.btn-success, .btn-primary, .btn-wa')].map(b => b.textContent.trim()), soltos: [...t.querySelectorAll(':scope > .btn, .ct-menus > details > summary')].map(b => b.textContent.trim()) }));
      if (r.cheios.join('|') !== 'Registrar pagamento') throw new Error('destaques: ' + r.cheios.join('|'));
      if (!/^‹ [^|]+\|Documentos\|Mais\|Registrar pagamento$/.test(r.soltos.join('|'))) throw new Error('topo: ' + r.soltos.join('|'));
    });
    await passo('Registrar pagamento abre a próxima parcela em aberto', async () => {
      await topo.getByRole('button', { name: 'Registrar pagamento' }).click(); await page.waitForTimeout(400);
      const r = await page.evaluate(vid => { const p = recebiveisDo('').filter(rc => rc.vendaId === vid && recRestante(rc) > 0.005).sort((a, b) => a.vencimento.localeCompare(b.vencimento) || a.numero - b.numero)[0]; return { esperado: p.descricao, titulo: document.getElementById('modalTitle').textContent, corpo: document.getElementById('modalBody').textContent }; }, vid);
      if (r.titulo !== 'Registrar pagamento' || !r.corpo.includes(r.esperado)) throw new Error(JSON.stringify(r).slice(0, 200));
      await page.evaluate(() => closeModal()); await page.waitForTimeout(200);
    });
    await passo('Documentos: Contrato, Extrato e o resumo pelo WhatsApp, dentro da tela', async () => {
      await topo.locator('summary', { hasText: 'Documentos' }).click(); await page.waitForTimeout(200);
      const lista = topo.locator('details.menu[open] .menu-lista');
      const t = (await lista.innerText()).replace(/\s+/g, ' ');
      if (!/Contrato/.test(t) || !/Extrato/.test(t) || !/WhatsApp/.test(t)) throw new Error(t);
      const b = await lista.boundingBox(); if (b.x < 0 || b.x + b.width > w) throw new Error(`lista fora da tela: ${Math.round(b.x)}–${Math.round(b.x + b.width)}`);
    });
    await passo('abrir Mais fecha Documentos; Excluir fica separado e em vermelho', async () => {
      await topo.locator('summary', { hasText: 'Mais' }).click(); await page.waitForTimeout(200);
      if (await topo.locator('details.menu[open]').count() !== 1) throw new Error('dois menus abertos');
      const r = await topo.locator('details.menu[open] .menu-lista').evaluate(l => ({ ultimo: l.lastElementChild.textContent.trim(), perigo: l.lastElementChild.classList.contains('perigo'), hr: !!l.querySelector('hr') }));
      if (r.ultimo !== 'Excluir contrato' || !r.perigo || !r.hr) throw new Error(JSON.stringify(r));
    });
    await passo('Esc fecha o menu e devolve o foco ao botão', async () => {
      await page.keyboard.press('Escape'); await page.waitForTimeout(100);
      if (await topo.locator('details.menu[open]').count()) throw new Error('continua aberto');
      if (await page.evaluate(() => document.activeElement.tagName) !== 'SUMMARY') throw new Error('foco em ' + await page.evaluate(() => document.activeElement.tagName));
    });
    await passo('clicar fora fecha o menu', async () => {
      await topo.locator('summary', { hasText: 'Documentos' }).click(); await page.waitForTimeout(100);
      await page.locator('.ct-cab').click({ position: { x: 10, y: 10 } }); await page.waitForTimeout(100);
      if (await topo.locator('details.menu[open]').count()) throw new Error('continua aberto');
    });
    await passo('contrato quitado não mostra Registrar pagamento', async () => {
      await page.evaluate(() => { const v = db.vendas.find(v => v.status === 'quitada') || db.vendas.find(v => recebiveisDo('').filter(r => r.vendaId === v.id).every(r => recRestante(r) <= 0.005)); if (v) abrirContrato(v.id, 'resumo'); window.__temQuitada = !!v; });
      if (!await page.evaluate(() => window.__temQuitada)) return;
      if (await page.locator('.ct-topo .ct-principal').count()) throw new Error('botão aparece em contrato quitado');
    });
    await ctx.close();
  }
  console.log(erros.length ? '\nERROS:\n' + erros.join('\n') : '\ntudo ok');
  await browser.close(); process.exit(erros.length ? 1 : 0);
})();
