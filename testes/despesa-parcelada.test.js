// Despesa parcelada: ao lançar, "Parcelado" abre periodicidade (mensal ou quinzenal), valor da
// parcela e número de vezes. Cada parcela entra como uma despesa, com "(parcela i de N)" na
// descrição e o vencimento andando um mês (ou 15 dias). Marcada como paga, só a 1ª entra paga.
// "Desfazer" no aviso retira todas. Editar uma despesa não mostra a opção.
// Relógio fixo em 19/10/2026.
// Rodar: BASE=http://127.0.0.1:8765/gestao/ node testes/despesa-parcelada.test.js
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
  await page.evaluate(() => { sessionStorage.setItem('gl_admin', '1'); startRole('admin'); document.querySelectorAll('#devDados,.toast').forEach(e => e.remove()); db.custos = []; state.filters.custos = null; switchTab('custos'); });
  const parcelas = prefixo => page.evaluate(p => db.custos.filter(c => c.descricao.startsWith(p)).sort((a, b) => a.vencimento.localeCompare(b.vencimento)).map(c => [c.descricao, c.valor, c.dataCompetencia, c.vencimento, c.status, c.dataPagamento || ''].join('|')), prefixo);

  await passo('"Parcelado" abre periodicidade, valor da parcela e número de vezes, e esconde o valor único', async () => {
    await page.evaluate(() => abrirCustoForm(null, { emp: null })); await page.waitForTimeout(200);
    if (await page.isVisible('#cuParcBox')) throw new Error('caixa aberta antes de marcar');
    await page.fill('#cuValor', '850');
    await page.check('#cuParc');
    const r = await page.evaluate(() => ({ box: getComputedStyle(document.getElementById('cuParcBox')).display, valor: getComputedStyle(document.getElementById('cuValorBox')).display, per: [...document.querySelectorAll('#cuParcPer option')].map(o => o.textContent).join(), vp: document.getElementById('cuParcValor').value }));
    if (r.box === 'none' || r.valor !== 'none' || r.per !== 'Mensal,Quinzenal' || r.vp !== '850') throw new Error(JSON.stringify(r));
  });
  await passo('mensal: 4 despesas "parcela i de 4", um mês entre os vencimentos; o resumo mostra o total', async () => {
    await page.fill('#cuDesc', 'Máquina de café'); await page.fill('#cuForn', 'Loja Central');
    await page.fill('#cuComp', '2026-10-01'); await page.fill('#cuVenc', '2026-10-31');
    await page.fill('#cuParcN', '4');
    const res = (await page.locator('#cuParcResumo').innerText()).replace(/\s+/g, ' ');
    if (!/4 parcelas de R\$ 850,00 = R\$ 3\.400,00/.test(res) || !res.includes('31/10/2026') || !res.includes('31/01/2027')) throw new Error(res);
    await page.click('#modalFoot .btn-primary'); await page.waitForTimeout(150);
    const p = await parcelas('Máquina de café');
    const esperado = ['Máquina de café (parcela 1 de 4)|850|2026-10-01|2026-10-31|pendente|', 'Máquina de café (parcela 2 de 4)|850|2026-11-01|2026-11-30|pendente|', 'Máquina de café (parcela 3 de 4)|850|2026-12-01|2026-12-31|pendente|', 'Máquina de café (parcela 4 de 4)|850|2027-01-01|2027-01-31|pendente|'];
    if (p.join('\n') !== esperado.join('\n')) throw new Error(p.join(' / '));
    if (await page.locator('#av-custos .item.linha').count() !== 4) throw new Error('lista não mostra as 4');
  });
  await passo('"Desfazer" no aviso retira as 4 parcelas', async () => {
    await page.locator('.toast .toast-acao', { hasText: 'Desfazer' }).click();
    if ((await parcelas('Máquina de café')).length) throw new Error('ficaram parcelas');
  });
  await passo('quinzenal e paga: 15 dias entre as parcelas e só a 1ª entra paga', async () => {
    await page.evaluate(() => { document.querySelectorAll('.toast').forEach(e => e.remove()); abrirCustoForm(null, { emp: null }); }); await page.waitForTimeout(200);
    await page.fill('#cuDesc', 'Diarista'); await page.fill('#cuComp', '2026-10-05'); await page.fill('#cuVenc', '2026-10-05');
    await page.check('#cuParc'); await page.selectOption('#cuParcPer', 'quinzenal'); await page.fill('#cuParcValor', '300'); await page.fill('#cuParcN', '3');
    await page.selectOption('#cuStatus', 'pago');
    if (!/só a 1ª parcela entra paga/.test(await page.locator('#cuParcResumo').innerText())) throw new Error('resumo sem aviso de pago');
    await page.click('#modalFoot .btn-primary'); await page.waitForTimeout(150);
    const p = await parcelas('Diarista');
    const esperado = ['Diarista (parcela 1 de 3)|300|2026-10-05|2026-10-05|pago|2026-10-05', 'Diarista (parcela 2 de 3)|300|2026-10-20|2026-10-20|pendente|', 'Diarista (parcela 3 de 3)|300|2026-11-04|2026-11-04|pendente|'];
    if (p.join('\n') !== esperado.join('\n')) throw new Error(p.join(' / '));
  });
  await passo('número de vezes menor que 2 é recusado', async () => {
    await page.evaluate(() => { document.querySelectorAll('.toast').forEach(e => e.remove()); abrirCustoForm(null, { emp: null }); }); await page.waitForTimeout(200);
    await page.fill('#cuDesc', 'Teste'); await page.check('#cuParc'); await page.fill('#cuParcValor', '100'); await page.fill('#cuParcN', '1');
    await page.click('#modalFoot .btn-primary');
    if ((await parcelas('Teste')).length || !/Número de vezes entre 2 e 120/.test(await page.locator('#toastContainer').innerText())) throw new Error('aceitou 1 vez');
    await page.evaluate(() => closeModal());
  });
  await passo('editar uma parcela não mostra "Parcelado"', async () => {
    await page.evaluate(() => abrirCustoForm(db.custos.find(c => c.descricao.startsWith('Diarista')).id)); await page.waitForTimeout(150);
    if (await page.locator('#cuParc').count()) throw new Error('opção aparece na edição');
    await page.evaluate(() => closeModal());
  });
  await passo('celular: a caixa de parcelamento cabe na largura', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => abrirCustoForm(null, { emp: null })); await page.waitForTimeout(200);
    // no celular a janela sobe de baixo: espera ela parar antes de marcar (com a bateria toda rodando, o clique caía no meio da subida)
    await page.waitForFunction(() => !document.getAnimations().some(a => a.playState === 'running'));
    await page.check('#cuParc');
    const r = await page.evaluate(() => { const b = document.getElementById('cuParcBox').getBoundingClientRect(); return { dentro: b.right <= innerWidth, rol: document.documentElement.scrollWidth <= innerWidth }; });
    if (!r.dentro || !r.rol) throw new Error(JSON.stringify(r));
  });
  await browser.close();
  if (erros.length) { console.log('\nERROS:\n' + erros.join('\n')); process.exit(1); }
  console.log('\nTudo certo.');
})();
