// Início › Fluxo previsto (12 meses): o que já foi pago conta no mês do pagamento e o que falta,
// no mês do vencimento. A parcela de novembro paga em outubro (antecipada) sai de novembro e
// entra em outubro; pagamento parcial deixa só o que falta previsto; parcela de contrato
// distratado não entra; despesa paga conta no mês em que foi paga.
// Rodar: BASE=http://127.0.0.1:8765/gestao/ node testes/fluxo-previsto.test.js
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
  // O gráfico mostra do mês passado até 10 meses à frente: o relógio fica em outubro de 2026
  // para os meses do teste caberem na janela em qualquer dia que ele rode.
  await page.clock.setFixedTime(new Date('2026-10-19T12:00:00'));
  await page.goto(BASE + 'index.html?dados=exemplo'); await page.waitForFunction(() => window.PiorCaso && db.loteamentos.length); await page.waitForTimeout(300);
  await page.evaluate(() => {
    sessionStorage.setItem('gl_admin', '1'); startRole('admin'); document.querySelectorAll('#devDados,.toast').forEach(e => e.remove());
    const L = db.loteamentos[0].id;
    db.vendas = [{ id: 'v1', loteamentoId: L, status: 'ativa', cliente: { nome: 'A' }, corretor: { nome: 'C' }, valorTotal: 1, dataVenda: '2026-01-01' },
      { id: 'v2', loteamentoId: L, status: 'distrato', cliente: { nome: 'B' }, corretor: { nome: 'C' }, valorTotal: 1, dataVenda: '2026-01-01' }];
    const r = (id, venda, venc, valor, pago, dataPg) => ({ id, vendaId: venda, loteamentoId: L, tipo: 'parcela', numero: 1, vencimento: venc, valor, valorPago: pago || 0, dataPagamento: dataPg || null });
    db.recebiveis = [
      r('out', 'v1', '2026-10-15', 1000, 1000, '2026-10-14'),        // outubro, paga em dia
      r('nov', 'v1', '2026-11-15', 1000, 1000, '2026-10-20'),        // novembro, antecipada em outubro
      r('dez', 'v1', '2026-12-15', 1000, 400, '2026-10-25'),         // dezembro, 400 adiantados em outubro
      r('jan', 'v1', '2027-01-15', 1000),                            // janeiro, em aberto
      r('dis', 'v2', '2026-11-15', 5000)                             // contrato distratado
    ];
    db.custos = [
      { id: 'c1', valor: 300, status: 'pago', vencimento: '2026-11-10', dataPagamento: '2026-10-30', dataCompetencia: '2026-11-01' },
      { id: 'c2', valor: 200, status: 'pendente', vencimento: '2026-11-10', dataCompetencia: '2026-10-01' },
      { id: 'c3', valor: 50, status: 'pendente', vencimento: null, dataCompetencia: '2026-12-05' }
    ];
  });

  await passo('parcela antecipada sai do mês em que venceria e entra no mês em que foi paga', async () => {
    const r = await page.evaluate(() => fluxoPorMes(['2026-10', '2026-11', '2026-12', '2027-01'], recebiveisDo(''), db.custos));
    // outubro: 1000 (em dia) + 1000 (novembro antecipada) + 400 (parte de dezembro); novembro: nada
    if (r.entra.join() !== '2400,0,600,1000') throw new Error('entradas ' + r.entra.join());
    if (r.sai.join() !== '300,200,50,0') throw new Error('saídas ' + r.sai.join());
  });
  await passo('parcela de contrato distratado não entra no fluxo', async () => {
    const r = await page.evaluate(() => fluxoPorMes(['2026-11'], db.recebiveis, []).entra[0]);
    if (r !== 5000) throw new Error('a conta crua devia ver os 5000: ' + r);
    const ok = await page.evaluate(() => fluxoPorMes(['2026-11'], recebiveisDo(''), []).entra[0]);
    if (ok !== 0) throw new Error('distrato entrou: ' + ok);
  });
  await passo('a tela do Início desenha o gráfico com a conta nova e explica a regra', async () => {
    const r = await page.evaluate(() => {
      let chamado = null; const orig = window.fluxoPorMes;
      window.fluxoPorMes = (m, recs, c) => { chamado = recs.map(x => x.id).sort().join(); return orig(m, recs, c); };
      switchTab('painel'); window.fluxoPorMes = orig;
      return { chamado, txt: document.querySelector('#chartFluxo').closest('.card').innerText };
    });
    if (r.chamado !== 'dez,jan,nov,out') throw new Error('recebíveis usados: ' + r.chamado);
    if (!/mês do pagamento/.test(r.txt)) throw new Error(r.txt);
  });
  await passo('passar o mouse num mês mostra os valores dele (recebimentos, despesas, o que já foi pago e o saldo)', async () => {
    const meses = await page.evaluate(() => { const ms = []; const now = new Date(); for (let i = -1; i < 11; i++) { const d = new Date(now.getFullYear(), now.getMonth() + i, 1); ms.push(d.getFullYear() + '-' + pad2(d.getMonth() + 1)); } return ms; });
    const i = meses.indexOf('2026-10'); if (i !== 1) throw new Error('janela do gráfico: ' + meses.join());
    await page.evaluate(() => document.getElementById('chartFluxo').scrollIntoView());
    const box = await page.locator('#chartFluxo').boundingBox();
    const gw = (box.width - 56 - 8) / 12;
    await page.mouse.move(box.x + 56 + gw * i + gw / 2, box.y + box.height / 2);
    const tip = page.locator('#chartFluxoTip');
    await tip.waitFor({ state: 'visible' });
    const t = (await tip.innerText()).replace(/\s+/g, ' ');
    // outubro: entra 2.400 (tudo já recebido); sai 300 (paga em outubro); saldo 2.100
    for (const s of ['out/26', 'Recebimentos R$ 2.400,00', 'tudo já recebido', 'Despesas R$ 300,00', 'tudo já pago', 'Saldo do mês R$ 2.100,00'])
      if (!t.includes(s)) throw new Error(`faltou "${s}" em: ${t}`);
    const i2 = meses.indexOf('2026-12');
    await page.mouse.move(box.x + 56 + gw * i2 + gw / 2, box.y + box.height / 2);
    await page.waitForFunction(() => /dez\/26/.test(document.getElementById('chartFluxoTip').innerText));
    const t2 = (await tip.innerText()).replace(/\s+/g, ' ');
    for (const s of ['Recebimentos R$ 600,00', 'Despesas R$ 50,00', 'Saldo do mês R$ 550,00']) if (!t2.includes(s)) throw new Error(`dezembro: faltou "${s}" em: ${t2}`);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height + 60);
    await page.waitForFunction(() => getComputedStyle(document.getElementById('chartFluxoTip')).display === 'none');
  });
  await passo('mês com parte paga e parte a pagar mostra as duas partes', async () => {
    const r = await page.evaluate(() => { const f = fluxoPorMes(['2026-11'], recebiveisDo(''), db.custos.concat([{ id: 'c4', valor: 100, status: 'pago', dataPagamento: '2026-11-02', vencimento: '2026-11-02' }])); return [f.pago[0], f.aPagar[0], f.sai[0]].join(); });
    if (r !== '100,200,300') throw new Error(r);
  });
  await browser.close();
  if (erros.length) { console.log('\nERROS:\n' + erros.join('\n')); process.exit(1); }
  console.log('\nTudo certo.');
})();
