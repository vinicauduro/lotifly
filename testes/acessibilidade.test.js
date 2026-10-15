// Auditoria automática de acessibilidade (axe-core, regras WCAG 2.1 A/AA + boas práticas) em 17
// telas, no celular e no computador. Falha se aparecer qualquer violação.
// Precisa do axe-core: npm install axe-core (em qualquer pasta) e AXE=caminho/do/axe.min.js
// Rodar: AXE=.../node_modules/axe-core/axe.min.js BASE=http://127.0.0.1:8765/lotifly/ node testes/acessibilidade.test.js
const { chromium } = require('playwright'); const fs = require('fs');
if (!process.env.AXE) { console.log('defina AXE com o caminho do axe.min.js'); process.exit(2); }
const AXE = fs.readFileSync(process.env.AXE, 'utf8');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const res = {};
  for (const w of [390, 1440]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 860 }, serviceWorkers: 'block' });
    await ctx.route(/config\.js/, r => r.fulfill({ contentType: 'application/javascript', body: "window.GL_CONFIG={supabaseUrl:'',supabaseAnonKey:''};" }));
    const page = await ctx.newPage(); page.on('dialog', d => d.accept());
    await page.goto((process.env.BASE || 'http://127.0.0.1:8765/gestao/') + 'index.html?dados=exemplo'); await page.waitForFunction(() => window.PiorCaso && db.loteamentos.length); await page.waitForTimeout(400);
    await page.addScriptTag({ content: AXE });
    const telas = [['landing', `(()=>{})()`], ['inicio', `(()=>{sessionStorage.setItem('gl_admin','1');startRole('admin');switchTab('painel')})()`], ['imoveis', `switchTab('emp')`], ['lotes', `abrirEmpreendimento(db.loteamentos[0].id,'lotes')`], ['contratos', `switchTab('vendas')`], ['contrato', `abrirContrato(db.vendas[0].id,'parcelas')`], ['a-receber', `switchTab('recebiveis')`], ['clientes', `switchTab('clientes')`], ['pagamento', `abrirPagamento(db.recebiveis.find(r=>!r.valorPago).id)`], ['config', `(()=>{closeModal();switchTab('cadastros')})()`], ['reserva-admin', `abrirReservaAdmin(db.reservas.find(r=>r.status==='pendente').id)`], ['reserva-aprovada', `aprovarReserva(db.reservas.find(r=>r.status==='pendente').id)`], ['reserva-recusar', `pedirMotivoReserva(db.reservas[0].id,'recusada')`], ['corretor-planta', `(()=>{startRole('corretor');switchTab('planta')})()`], ['corretor-lotes', `switchTab('lotes')`], ['lote', `abrirLoteCorretor(db.lotes.find(l=>l.status==='disponivel').id)`], ['reserva-pedido', `abrirReservaForm(db.lotes.find(l=>l.status==='disponivel').id)`]];
    for (const [n, js] of telas) {
      await page.evaluate(js).catch(e => console.log('falhou', n, e.message)); await page.waitForTimeout(350);
      if (n === 'landing') { await page.evaluate(() => document.getElementById('devDados') && document.getElementById('devDados').remove()); }
      /* aviso no meio da animação de saída tem cor intermediária: limpa antes de medir */
      await page.evaluate(() => document.querySelectorAll(".toast").forEach(t => t.remove()));
      const r = await page.evaluate(async () => { const o = await axe.run(document, { exclude: [['#devDados']], resultTypes: ['violations'], runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] } }); return o.violations.map(v => ({ id: v.id, impacto: v.impact, n: v.nodes.length, ex: v.nodes.slice(0, 2).map(x => x.target.join(' ') + ' :: ' + (x.failureSummary || '').split('\n').slice(1, 2).join('')) })); });
      for (const v of r) { const k = v.id; res[k] = res[k] || { impacto: v.impacto, telas: [], ex: v.ex }; res[k].telas.push(`${n}@${w}(${v.n})`); }
    }
    await ctx.close();
  }
  for (const [k, v] of Object.entries(res).sort((a, b) => ['critical', 'serious', 'moderate', 'minor'].indexOf(a[1].impacto) - ['critical', 'serious', 'moderate', 'minor'].indexOf(b[1].impacto))) {
    console.log(`\n[${v.impacto}] ${k}: ${v.telas.join(', ')}`); v.ex.forEach(e => console.log('   ', e.slice(0, 220)));
  }
  const n = Object.keys(res).length;
  console.log(n ? `\n${n} tipo(s) de violação` : 'nenhuma violação');
  await browser.close(); process.exit(n ? 1 : 0);
})();
