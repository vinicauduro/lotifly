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
  await browser.close();
  if (erros.length) { console.log('\nERROS:\n' + erros.join('\n')); process.exit(1); }
  console.log('\nTudo certo.');
})();
