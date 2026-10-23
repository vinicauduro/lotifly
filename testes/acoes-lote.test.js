// Ações em lote da barra das selecionadas: aprovar e recusar várias reservas; registrar o
// pagamento de várias parcelas (no vencimento de cada uma ou numa data, com a escolha de multa e
// juros quando pagas depois do vencimento); gerar os boletos das parcelas marcadas (remessa ao
// banco das novas e impressão). Relógio fixo em 19/10/2026.
// Rodar: BASE=http://127.0.0.1:8765/gestao/ node testes/acoes-lote.test.js
const { chromium } = require('playwright');
const { responderConfirmacoes } = require('./confirmacoes');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/gestao/';
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--disable-gpu'] });
  const erros = [];
  const passo = async (nome, fn) => { try { await fn(); console.log('✔', nome); } catch (e) { console.log('✘', nome, e.message.split('\n')[0]); erros.push(`${nome}: ${e.message.split('\n')[0]}`); } };
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block', acceptDownloads: true });
  await ctx.route(/config\.js/, r => r.fulfill({ contentType: 'application/javascript', body: "window.GL_CONFIG={supabaseUrl:'',supabaseAnonKey:''};" }));
  const page = await ctx.newPage(); page.setDefaultTimeout(8000);
  page.on('pageerror', e => erros.push(`pageerror: ${e.message}`)); await responderConfirmacoes(page, 'aceitar');
  await page.clock.setFixedTime(new Date('2026-10-19T12:00:00'));
  await page.goto(BASE + 'index.html?dados=exemplo'); await page.waitForFunction(() => window.PiorCaso && db.loteamentos.length); await page.waitForTimeout(300);
  await page.evaluate(() => {
    sessionStorage.setItem('gl_admin', '1'); startRole('admin'); document.querySelectorAll('#devDados,.toast').forEach(e => e.remove());
    window.print = () => { window.__impresso = document.getElementById('printArea').innerHTML; };
    const L = db.loteamentos[0].id;
    db.lotes = db.lotes.concat([1, 2, 3].map(n => ({ id: 'z' + n, loteamentoId: L, quadra: 'Z', numero: String(n), status: n === 3 ? 'reservado' : 'disponivel', reservaId: n === 3 ? 'r4' : null, preco: 1, area: 1 })));
    const res = (id, lote, status, criado, cliente) => ({ id, loteamentoId: L, loteId: lote, status, validade: '2026-10-25', dataReserva: '2026-10-15', criadoEm: criado, cliente: { nome: cliente }, corretor: { nome: 'Ana Paula Souza' }, proposta: { valor: 100000 } });
    db.reservas = [res('r1', 'z1', 'pendente', '1', 'Lucas Pereira'), res('r2', 'z1', 'pendente', '2', 'Juliana Rocha'), res('r3', 'z2', 'pendente', '3', 'Marcos Dias'), res('r4', 'z3', 'aprovada', '0', 'Paula Reis')];
    db.vendas = [{ id: 'vz', numeroContrato: '0007/2026', loteamentoId: L, loteId: db.lotes[0].id, cliente: { nome: 'Gustavo Lima', cpf: '12345678909' }, corretor: { nome: 'C' }, valorTotal: 3000, nParcelas: 3, valorParcela: 1000, dataVenda: '2026-01-01', status: 'ativa' }];
    const r = (id, venc, n, extra) => Object.assign({ id, vendaId: 'vz', loteamentoId: L, tipo: 'parcela', numero: n, descricao: `Parcela ${n}/3`, vencimento: venc, valor: 1000, valorPago: 0, dataPagamento: null }, extra);
    db.recebiveis = [r('a1', '2026-08-20', 1), r('a2', '2026-10-25', 2), r('a3', '2026-07-20', 3, { valorPago: 1000, dataPagamento: '2026-07-20', forma: 'PIX' })];
    db.config.multaPct = 2; db.config.jurosMesPct = 1;
    db.contasBanco = [{ id: 'cb1', loteamentoId: '', banco: '001', carteira: '17', variacao: '019', agencia: '1234', conta: '56789', convenio: '1234567', nossoNumeroAtual: 10000000, nnMax: 0, remessaSeq: 1, multaPct: 2, jurosMesPct: 1, especie: 'DM', aceite: 'N' }];
    db.remessas = []; db.contasCaixa = []; db.movimentos = [];
    state.escopo = ''; state.filters.ares = { status: 'ativas' };
  });
  const barraBtn = rot => page.locator('#selBarra button', { hasText: rot });
  const ultimaConf = () => page.evaluate(() => (window.__confirmacoes || []).slice(-1)[0] || '');

  await passo('reservas: a barra oferece Aprovar e Recusar', async () => {
    await page.evaluate(() => { switchTab('reservas'); selTodas('reservas', true); });
    const b = await page.evaluate(() => document.getElementById('selBarra').innerText.replace(/\s+/g, ' '));
    if (!b.includes('Aprovar') || !b.includes('Recusar')) throw new Error(b);
  });
  await passo('aprovar várias: as que aguardam; duas no mesmo lote, a mais antiga leva; a já aprovada não muda', async () => {
    await barraBtn('Aprovar').click(); await page.waitForTimeout(300);
    const conf = await ultimaConf();
    if (!conf.includes('Aprovar 2 reservas?') || !conf.includes('Juliana Rocha') || !conf.includes('outra reserva da seleção pede o mesmo lote')) throw new Error(conf);
    const r = await page.evaluate(() => ({ st: db.reservas.map(x => x.id + ':' + x.status).join(), lotes: ['z1', 'z2'].map(id => getLote(id).status + ':' + getLote(id).reservaId).join() }));
    if (r.st !== 'r1:aprovada,r2:pendente,r3:aprovada,r4:aprovada' || r.lotes !== 'reservado:r1,reservado:r3') throw new Error(JSON.stringify(r));
  });
  await passo('Desfazer devolve as reservas e os lotes', async () => {
    await page.locator('.toast .toast-acao', { hasText: 'Desfazer' }).click(); await page.waitForTimeout(100);
    const r = await page.evaluate(() => db.reservas.map(x => x.status).join() + '|' + ['z1', 'z2'].map(id => getLote(id).status).join());
    if (r !== 'pendente,pendente,pendente,aprovada|disponivel,disponivel') throw new Error(r);
  });
  await passo('recusar várias com um motivo para todas', async () => {
    await page.evaluate(() => { document.querySelectorAll('.toast').forEach(e => e.remove()); state.filters.ares = { status: 'pendente' }; renderCurrent(); ['r2', 'r3'].forEach(id => selMarcar('reservas', id, true)); });
    await barraBtn('Recusar').click(); await page.waitForTimeout(150);
    if (!/Recusar 2 reservas/.test(await page.locator('#modalTitle').innerText())) throw new Error('janela');
    await page.fill('#rsMotivoLote', 'entrada abaixo do mínimo'); await page.click('#modalFoot .btn-danger'); await page.waitForTimeout(150);
    const r = await page.evaluate(() => db.reservas.filter(x => ['r2', 'r3'].includes(x.id)).map(x => x.status + ':' + x.motivo).join('|'));
    if (r !== 'recusada:entrada abaixo do mínimo|recusada:entrada abaixo do mínimo') throw new Error(r);
  });

  await passo('parcelas: "Registrar pagamento" deixa de fora a já paga e, no vencimento de cada uma, não pergunta multa e juros', async () => {
    await page.evaluate(() => { document.querySelectorAll('.toast').forEach(e => e.remove()); const f = filtroRec(); f.status = 'all'; f.mes = 'all'; f.sub = 'parcelas'; switchTab('recebiveis'); selTodas('recebiveis', true); });
    await barraBtn('Registrar pagamento').click(); await page.waitForTimeout(150);
    const t = (await page.locator('#modalBox').innerText()).replace(/\s+/g, ' ');
    if (!t.includes('Registrar pagamento de 2 parcelas') || !t.includes('1 já paga') || !t.includes('Total a registrar: R$ 2.000,00')) throw new Error(t);
    if (await page.isVisible('#ppEncargos')) throw new Error('perguntou multa e juros pagando no vencimento');
    await page.click('#modalFoot .btn-primary'); await page.waitForTimeout(150);
    const r = await page.evaluate(() => ['a1', 'a2'].map(id => { const x = db.recebiveis.find(r => r.id === id); return `${recStatus(x)}:${x.dataPagamento}:${x.valorPago}`; }).join('|') + '|' + getVenda('vz').status);
    if (r !== 'pago:2026-08-20:1000|pago:2026-10-19:1000|quitada') throw new Error(r);
  });
  await passo('Desfazer volta as duas para em aberto e o contrato para ativo', async () => {
    await page.locator('.toast .toast-acao', { hasText: 'Desfazer' }).click(); await page.waitForTimeout(100);
    const r = await page.evaluate(() => ['a1', 'a2'].map(id => recStatus(db.recebiveis.find(r => r.id === id))).join() + '|' + getVenda('vz').status);
    if (r !== 'atrasado,pendente|ativa') throw new Error(r);
  });
  await passo('todas numa data depois do vencimento: a escolha de multa e juros é obrigatória; sem, quita e anota a dispensa', async () => {
    await page.evaluate(() => { document.querySelectorAll('.toast').forEach(e => e.remove()); selLimpar('recebiveis'); selMarcar('recebiveis', 'a1', true); });
    await barraBtn('Registrar pagamento').click(); await page.waitForTimeout(150);
    await page.check('input[name="ppData"][value="uma"]'); await page.fill('#ppData', '2026-10-19'); await page.dispatchEvent('#ppData', 'input');
    if (!await page.isVisible('#ppEncargos')) throw new Error('não perguntou multa e juros');
    await page.click('#modalFoot .btn-primary'); await page.waitForTimeout(100);
    if (await page.evaluate(() => recStatus(db.recebiveis.find(r => r.id === 'a1'))) === 'pago' || !/Escolha se cobra multa e juros/.test(await page.locator('#toastContainer').innerText())) throw new Error('pagou sem escolher');
    await page.check('input[name="ppEnc"][value="com"]');
    const com = await page.evaluate(() => document.getElementById('ppTotal').textContent);
    await page.check('input[name="ppEnc"][value="sem"]');
    if (!/R\$\s1\.0\d\d,\d\d/.test(com) || com.includes('1.000,00')) throw new Error('total com encargos: ' + com);
    await page.click('#modalFoot .btn-primary'); await page.waitForTimeout(150);
    const r = await page.evaluate(() => { const x = db.recebiveis.find(r => r.id === 'a1'); return { st: recStatus(x), pago: x.valorPago, obs: x.obsPagamento, data: x.dataPagamento }; });
    if (r.st !== 'pago' || r.pago !== 1000 || r.data !== '2026-10-19' || !/Multa e juros dispensados/.test(r.obs)) throw new Error(JSON.stringify(r));
  });

  await passo('gerar boletos: a já paga fica de fora; a nova ganha nosso número, vai para a remessa e é impressa', async () => {
    await page.evaluate(() => { document.querySelectorAll('.toast').forEach(e => e.remove()); selLimpar('recebiveis'); ['a2', 'a3'].forEach(id => selMarcar('recebiveis', id, true)); });
    await barraBtn('Gerar boletos').click(); await page.waitForTimeout(150);
    const t = (await page.locator('#modalBox').innerText()).replace(/\s+/g, ' ');
    if (!t.includes('Boletos de 2 parcelas') || !t.includes('1 nova para registrar') || !t.includes('Parcela 3/3: já paga')) throw new Error(t);
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#modalFoot .btn-primary')]);
    await page.waitForTimeout(150);
    const r = await page.evaluate(() => { const x = db.recebiveis.find(r => r.id === 'a2'); return { nn: x.nossoNumero, em: x.remessaEm, rem: db.remessas.length, imp: (window.__impresso || '').split('boleto-pagina').length - 1 }; });
    if (dl.suggestedFilename() !== 'CB000001.REM' || !r.nn || r.em !== '2026-10-19' || r.rem !== 1 || r.imp !== 1) throw new Error(dl.suggestedFilename() + ' ' + JSON.stringify(r));
  });
  await passo('gerar boletos de novo da mesma parcela: só imprime, sem outra remessa', async () => {
    await page.evaluate(() => { window.__impresso = ''; document.querySelectorAll('.toast').forEach(e => e.remove()); selMarcar('recebiveis', 'a2', true); });
    await barraBtn('Gerar boletos').click(); await page.waitForTimeout(150);
    const btn = await page.locator('#modalFoot .btn-primary').innerText();
    if (btn.trim() !== 'Imprimir 1 boleto') throw new Error(btn);
    await page.click('#modalFoot .btn-primary'); await page.waitForTimeout(150);
    const r = await page.evaluate(() => ({ rem: db.remessas.length, imp: (window.__impresso || '').includes('boleto-pagina') }));
    if (r.rem !== 1 || !r.imp) throw new Error(JSON.stringify(r));
  });
  await passo('sem conta de cobrança, "Gerar boletos" não aparece na barra', async () => {
    const r = await page.evaluate(() => { db.contasBanco = []; selMarcar('recebiveis', 'a2', true); return document.getElementById('selBarra').innerText; });
    if (/Gerar boletos/.test(r)) throw new Error(r);
  });
  await browser.close();
  if (erros.length) { console.log('\nERROS:\n' + erros.join('\n')); process.exit(1); }
  console.log('\nTudo certo.');
})();
