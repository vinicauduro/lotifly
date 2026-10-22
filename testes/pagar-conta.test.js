// Pagar conta (A pagar) numa janela do app, como o recebimento de parcela: data, forma e
// observação; data no futuro é recusada; "Desfazer" no aviso volta a conta para em aberto.
// Bloquear lote também pede o motivo numa janela do app. E cada número diz o seu escopo:
// "Em atraso no mês" na barra, "todos os meses" nas atrasadas de A receber, sem a barra do mês
// na Cobrança. Relógio fixo em 19/10/2026.
// Rodar: BASE=http://127.0.0.1:8765/gestao/ node testes/pagar-conta.test.js
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/gestao/';
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--disable-gpu'] });
  const erros = [];
  const passo = async (nome, fn) => { try { await fn(); console.log('✔', nome); } catch (e) { console.log('✘', nome, e.message.split('\n')[0]); erros.push(`${nome}: ${e.message.split('\n')[0]}`); } };
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
  await ctx.route(/config\.js/, r => r.fulfill({ contentType: 'application/javascript', body: "window.GL_CONFIG={supabaseUrl:'',supabaseAnonKey:''};" }));
  const page = await ctx.newPage(); page.setDefaultTimeout(8000);
  let dialogos = 0;
  page.on('pageerror', e => erros.push(`pageerror: ${e.message}`)); page.on('dialog', d => { dialogos++; d.dismiss(); });
  await page.clock.setFixedTime(new Date('2026-10-19T12:00:00'));
  await page.goto(BASE + 'index.html?dados=exemplo'); await page.waitForFunction(() => window.PiorCaso && db.loteamentos.length); await page.waitForTimeout(300);
  await page.evaluate(() => {
    sessionStorage.setItem('gl_admin', '1'); startRole('admin'); document.querySelectorAll('#devDados,.toast').forEach(e => e.remove());
    db.custos = [{ id: 'k1', descricao: 'Contador', categoriaId: 'administrativo', fornecedor: 'Contábil Rio', valor: 900, formaPagamento: 'Boleto', loteamentoId: null, dataCompetencia: '2026-10-01', vencimento: '2026-10-10', status: 'pendente' }];
    state.filters.custos = null;
  });

  await passo('o botão de pagar abre a janela com valor, vencimento, data, forma e observação (sem caixinha do navegador)', async () => {
    await page.evaluate(() => switchTab('custos'));
    await page.click('#av-custos .item.linha button[title="Marcar como pago"]');
    const t = (await page.locator('#modalBox').innerText()).replace(/\s+/g, ' ');
    for (const s of ['Pagar conta', 'Contador', 'Contábil Rio', 'R$ 900,00', '10/10/2026', 'Data do pagamento', 'Forma', 'Observação', 'Confirmar pagamento']) if (!t.includes(s)) throw new Error(`faltou "${s}": ${t}`);
    if (await page.inputValue('#cpData') !== '2026-10-19' || await page.inputValue('#cpForma') !== 'Boleto') throw new Error('padrões');
    if (dialogos) throw new Error('abriu caixinha do navegador');
  });
  await passo('data no futuro é recusada e a conta continua em aberto', async () => {
    await page.fill('#cpData', '2026-11-01'); await page.click('#modalFoot .btn-primary');
    if (await page.evaluate(() => db.custos[0].status) !== 'pendente') throw new Error('pagou com data futura');
    if (!/Data no futuro/.test(await page.locator('#toastContainer').innerText())) throw new Error('sem aviso');
  });
  await passo('confirmar grava data, forma e observação; o aviso traz "Desfazer", que volta a conta para em aberto', async () => {
    await page.evaluate(() => document.querySelectorAll('.toast').forEach(e => e.remove()));
    await page.fill('#cpData', '2026-10-15'); await page.selectOption('#cpForma', 'PIX'); await page.fill('#cpObs', 'pago pelo app do banco');
    await page.click('#modalFoot .btn-primary');
    const c = await page.evaluate(() => { const c = db.custos[0]; return [c.status, c.dataPagamento, c.formaPagamento, c.obs].join('|'); });
    if (c !== 'pago|2026-10-15|PIX|pago pelo app do banco') throw new Error(c);
    const desfazer = page.locator('.toast .toast-acao', { hasText: 'Desfazer' });
    await desfazer.click();
    const d = await page.evaluate(() => { const c = db.custos[0]; return [c.status, c.dataPagamento || ''].join('|'); });
    if (d !== 'pendente|') throw new Error('desfazer: ' + d);
  });
  await passo('bloquear lote pede o motivo numa janela do app e grava nas observações', async () => {
    const id = await page.evaluate(() => db.lotes.find(l => l.status === 'disponivel').id);
    await page.evaluate(id => { abrirLoteAdmin(id); bloquearLote(id, true); }, id);
    if (!/Motivo/.test(await page.locator('#modalBox').innerText())) throw new Error('sem janela');
    await page.fill('#blMotivo', 'área institucional'); await page.click('#modalFoot .btn-danger');
    const l = await page.evaluate(id => { const l = getLote(id); return l.status + '|' + l.obs; }, id);
    if (l !== 'bloqueado|área institucional' || dialogos) throw new Error(l + ' dialogos=' + dialogos);
  });
  await passo('cada número diz o escopo: barra "Em atraso no mês", atrasadas "todos os meses", Cobrança sem a barra do mês', async () => {
    const r = await page.evaluate(() => {
      switchTab('painel'); const bm = document.querySelector('#av-painel .bm'); const barra = bm ? bm.textContent : '';
      state.filters.rec = null; switchTab('recebiveis'); const atr = document.querySelector('#av-recebiveis .st-item.st-atrasado').textContent;
      switchTab('cobranca'); return { barra, atr, cobBarra: !!document.querySelector('#av-cobranca .bm'), resumo: document.querySelector('#av-cobranca .ct-resumo') ? document.querySelector('#av-cobranca .ct-resumo').textContent : '' };
    });
    if (r.barra && !/Em atraso no mês/.test(r.barra)) throw new Error('barra: ' + r.barra);
    if (!/todos os meses/.test(r.atr)) throw new Error('atrasadas: ' + r.atr);
    if (r.cobBarra) throw new Error('Cobrança ainda tem a barra do mês');
    if (r.resumo && !/todos os meses/.test(r.resumo)) throw new Error('resumo: ' + r.resumo);
  });
  await browser.close();
  if (erros.length) { console.log('\nERROS:\n' + erros.join('\n')); process.exit(1); }
  console.log('\nTudo certo.');
})();
