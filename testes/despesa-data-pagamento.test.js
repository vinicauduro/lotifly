// Lançar despesa já paga: ao escolher "Pago", a data do pagamento vem do vencimento (sem
// vencimento, hoje). Enquanto a pessoa não mexe nela, acompanha o vencimento; depois de mexer,
// fica a que ela pôs. Despesa paga que é editada mantém a data que já tinha.
// Relógio fixo em 19/10/2026.
// Rodar: BASE=http://127.0.0.1:8765/gestao/ node testes/despesa-data-pagamento.test.js
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
  await page.evaluate(() => { sessionStorage.setItem('gl_admin', '1'); startRole('admin'); document.querySelectorAll('#devDados,.toast').forEach(e => e.remove()); switchTab('custos'); });

  await passo('escolher "Pago" puxa a data do vencimento, não a de hoje', async () => {
    await page.evaluate(() => abrirCustoForm(null, { emp: null })); await page.waitForTimeout(250);
    await page.fill('#cuVenc', '2026-10-05');
    await page.selectOption('#cuStatus', 'pago');
    if (await page.inputValue('#cuDataPg') !== '2026-10-05') throw new Error(await page.inputValue('#cuDataPg'));
  });
  await passo('mudando o vencimento depois, a data do pagamento acompanha', async () => {
    await page.fill('#cuVenc', '2026-10-08');
    if (await page.inputValue('#cuDataPg') !== '2026-10-08') throw new Error(await page.inputValue('#cuDataPg'));
  });
  await passo('a data que a pessoa digitou não é trocada, e é ela que fica gravada', async () => {
    await page.fill('#cuDataPg', '2026-10-09');
    await page.fill('#cuVenc', '2026-10-12');
    if (await page.inputValue('#cuDataPg') !== '2026-10-09') throw new Error(await page.inputValue('#cuDataPg'));
    await page.fill('#cuDesc', 'Topografia extra'); await page.fill('#cuValor', '1200');
    await page.click('#modalFoot .btn-primary'); await page.waitForTimeout(200);
    const c = await page.evaluate(() => db.custos.find(x => x.descricao === 'Topografia extra'));
    if (!c || c.status !== 'pago' || c.dataPagamento !== '2026-10-09') throw new Error(JSON.stringify(c));
  });
  await passo('sem vencimento, "Pago" usa a data de hoje', async () => {
    await page.evaluate(() => abrirCustoForm(null, { emp: null })); await page.waitForTimeout(250);
    await page.selectOption('#cuStatus', 'pago');
    if (await page.inputValue('#cuDataPg') !== '2026-10-19') throw new Error(await page.inputValue('#cuDataPg'));
    await page.evaluate(() => closeModal());
  });
  await passo('despesa já paga, aberta para editar, mantém a data de pagamento que tinha', async () => {
    const id = await page.evaluate(() => { const c = { id: 'kx', descricao: 'Aluguel', categoriaId: 'administrativo', valor: 3800, loteamentoId: null, dataCompetencia: '2026-10-01', vencimento: '2026-10-05', status: 'pago', dataPagamento: '2026-10-03' }; db.custos.push(c); return c.id; });
    await page.evaluate(id => abrirCustoForm(id), id); await page.waitForTimeout(250);
    if (await page.inputValue('#cuDataPg') !== '2026-10-03') throw new Error(await page.inputValue('#cuDataPg'));
    await page.fill('#cuVenc', '2026-10-06');
    if (await page.inputValue('#cuDataPg') !== '2026-10-03') throw new Error('trocou a data já gravada: ' + await page.inputValue('#cuDataPg'));
    await page.evaluate(() => closeModal());
  });
  await browser.close();
  if (erros.length) { console.log('\nERROS:\n' + erros.join('\n')); process.exit(1); }
  console.log('\nTudo certo.');
})();
