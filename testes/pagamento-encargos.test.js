// Pagamento de parcela atrasada: multa e juros não têm padrão. A janela pede a escolha entre
// cobrar e dispensar; sem escolher, não confirma. Dispensar quita a parcela e deixa escrito
// quanto foi dispensado (observação e histórico). Parcela em dia não pergunta nada.
// Relógio fixo em 19/10/2026.
// Rodar: BASE=http://127.0.0.1:8765/gestao/ node testes/pagamento-encargos.test.js
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
  await page.clock.setFixedTime(new Date('2026-10-19T12:00:00'));
  await page.goto(BASE + 'index.html?dados=exemplo'); await page.waitForFunction(() => window.PiorCaso && db.loteamentos.length); await page.waitForTimeout(300);
  await page.evaluate(() => {
    sessionStorage.setItem('gl_admin', '1'); startRole('admin'); document.querySelectorAll('#devDados,.toast').forEach(e => e.remove());
    const L = db.loteamentos[0].id;
    db.vendas = [{ id: 'vz', numeroContrato: '0007/2026', loteamentoId: L, loteId: db.lotes[0].id, cliente: { nome: 'Gustavo Lima' }, corretor: { nome: 'C' }, valorTotal: 3000, nParcelas: 3, valorParcela: 1000, dataVenda: '2026-01-01', status: 'ativa' }];
    const r = (id, venc, n) => ({ id, vendaId: 'vz', loteamentoId: L, tipo: 'parcela', numero: n, descricao: `Parcela ${n}/3`, vencimento: venc, valor: 1000, valorPago: 0, dataPagamento: null });
    db.recebiveis = [r('a1', '2026-08-20', 1), r('a2', '2026-09-20', 2), r('e3', '2026-11-20', 3)];
    db.config.multaPct = 2; db.config.jurosMesPct = 1;
  });
  const toastTxt = () => page.evaluate(() => [...document.querySelectorAll('.toast')].map(t => t.textContent.replace(/\s+/g, ' ')).join(' | '));

  await passo('atrasada: a janela pede a escolha, sem nada marcado e sem valor preenchido', async () => {
    await page.evaluate(() => abrirPagamento('a1')); await page.waitForTimeout(300);
    const t = (await page.locator('#modalBody').innerText()).replace(/\s+/g, ' ');
    for (const s of ['Multa e juros · 60 dias de atraso', 'Cobrar multa e juros', 'Sem multa e juros', 'dispensa']) if (!t.includes(s)) throw new Error(`faltou "${s}": ${t}`);
    const r = await page.evaluate(() => ({ marcado: !!document.querySelector('input[name="pgEnc"]:checked'), valor: document.getElementById('pgValor').value }));
    if (r.marcado || r.valor !== '') throw new Error(JSON.stringify(r));
  });
  await passo('sem escolher, não confirma: avisa e destaca a escolha', async () => {
    await page.click('#modalFoot .btn-primary');
    const r = await page.evaluate(() => ({ pago: db.recebiveis.find(x => x.id === 'a1').valorPago, erro: document.getElementById('pgEncargos').classList.contains('erro') }));
    if (r.pago || !r.erro || !/Escolha se cobra multa e juros/.test(await toastTxt())) throw new Error(JSON.stringify(r));
  });
  await passo('cobrar: preenche o valor com multa e juros e quita a parcela', async () => {
    await page.check('input[name="pgEnc"][value="com"]');
    const esperado = await page.evaluate(() => Math.round(recAtualizado(db.recebiveis.find(x => x.id === 'a1')) * 100) / 100);
    if (num(await page.inputValue('#pgValor')) !== esperado) throw new Error(await page.inputValue('#pgValor') + ' ≠ ' + esperado);
    await page.click('#modalFoot .btn-primary');
    const r = await page.evaluate(() => { const x = db.recebiveis.find(x => x.id === 'a1'); return { pago: x.valorPago, st: recStatus(x), obs: x.obsPagamento || '' }; });
    if (Math.abs(r.pago - esperado) > 0.005 || r.st !== 'pago' || /dispensad/.test(r.obs)) throw new Error(JSON.stringify(r));
    function num(v) { return Math.round(parseFloat(v) * 100) / 100; }
  });
  await passo('sem multa e juros: quita com o valor da parcela e registra quanto foi dispensado', async () => {
    await page.evaluate(() => { document.querySelectorAll('.toast').forEach(e => e.remove()); abrirPagamento('a2'); }); await page.waitForTimeout(300);
    const dispensa = await page.evaluate(() => { const x = db.recebiveis.find(x => x.id === 'a2'); return Math.round((recAtualizado(x) - recRestante(x)) * 100) / 100; });
    await page.check('input[name="pgEnc"][value="sem"]');
    if (await page.inputValue('#pgValor') !== '1000') throw new Error(await page.inputValue('#pgValor'));
    await page.fill('#pgObs', 'cliente pediu');
    await page.click('#modalFoot .btn-primary');
    const r = await page.evaluate(() => { const x = db.recebiveis.find(x => x.id === 'a2'); return { st: recStatus(x), obs: x.obsPagamento, hist: (db.atividades || db.log || []).map(a => a.texto || a.msg || a.descricao || JSON.stringify(a)).join(' || ') }; });
    const dTxt = await page.evaluate(d => fmtMoney(d).replace(/\s+/g, ' '), dispensa); r.obs = r.obs.replace(/\s+/g, ' ');
    if (r.st !== 'pago' || !r.obs.startsWith('cliente pediu · Multa e juros dispensados: ' + dTxt)) throw new Error(JSON.stringify(r).slice(0, 300));
    if (!(await toastTxt()).includes('multa e juros dispensados (' + dTxt + ')')) throw new Error(await toastTxt());
  });
  await passo('parcela em dia: nenhuma pergunta e o valor vem preenchido', async () => {
    await page.evaluate(() => abrirPagamento('e3')); await page.waitForTimeout(300);
    const r = await page.evaluate(() => ({ f: !!document.getElementById('pgEncargos'), v: document.getElementById('pgValor').value }));
    if (r.f || r.v !== '1000') throw new Error(JSON.stringify(r));
    await page.evaluate(() => closeModal());
  });
  await browser.close();
  if (erros.length) { console.log('\nERROS:\n' + erros.join('\n')); process.exit(1); }
  console.log('\nTudo certo.');
})();
