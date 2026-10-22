// Caixa e bancos (etapa 1 do financeiro): contas de cada empresa do grupo com saldo inicial numa
// data de corte; recebimento de parcela, conta paga, comissão paga e baixa de boleto dizem em
// qual conta o dinheiro entrou ou saiu, e o saldo anda sozinho. Estorno e "Desfazer" tiram o
// movimento. Transferência entre contas. Extrato com o saldo depois de cada movimento.
// Pagamentos depois da data de corte que ficaram sem conta aparecem para escolher a conta; os
// de antes da data de corte já estão no saldo inicial. Relógio fixo em 19/10/2026.
// Rodar: BASE=http://127.0.0.1:8765/gestao/ node testes/caixa-bancos.test.js
const { chromium } = require('playwright');
const { responderConfirmacoes } = require('./confirmacoes');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/gestao/';
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--disable-gpu'] });
  const erros = [];
  const passo = async (nome, fn) => { try { await fn(); console.log('✔', nome); } catch (e) { console.log('✘', nome, e.message.split('\n')[0]); erros.push(`${nome}: ${e.message.split('\n')[0]}`); } };
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
  await ctx.route(/config\.js/, r => r.fulfill({ contentType: 'application/javascript', body: "window.GL_CONFIG={supabaseUrl:'',supabaseAnonKey:''};" }));
  const page = await ctx.newPage(); page.setDefaultTimeout(8000);
  page.on('pageerror', e => erros.push(`pageerror: ${e.message}`)); await responderConfirmacoes(page, 'aceitar');
  await page.clock.setFixedTime(new Date('2026-10-19T12:00:00'));
  await page.goto(BASE + 'index.html?dados=exemplo'); await page.waitForFunction(() => window.PiorCaso && db.loteamentos.length); await page.waitForTimeout(300);
  await page.evaluate(() => {
    sessionStorage.setItem('gl_admin', '1'); startRole('admin'); document.querySelectorAll('#devDados,.toast').forEach(e => e.remove());
    const L = db.loteamentos[0].id;
    db.config.empresa = 'Cauduro Incorporadora';
    db.vendedores = [{ id: 'emp2', tipo: 'pj', nome: 'Vista Verde SPE Ltda' }];
    const venda = (id, vendedorId, cliente) => ({ id, numeroContrato: id, loteamentoId: L, loteId: db.lotes[0].id, vendedorId, cliente: { nome: cliente }, corretor: { nome: 'Ana Paula Souza' }, valorTotal: 30000, nParcelas: 3, valorParcela: 1000, dataVenda: '2026-01-01', status: 'ativa', comissaoPct: 5, comissaoValor: 1500, comissaoPaga: false, comissaoData: null });
    db.vendas = [venda('va', '', 'Gustavo Lima'), venda('vb', 'emp2', 'Helena Prado')];
    const r = (id, vendaId, venc, extra) => Object.assign({ id, vendaId, loteamentoId: L, tipo: 'parcela', numero: 1, descricao: 'Parcela ' + id, vencimento: venc, valor: 1000, valorPago: 0, dataPagamento: null }, extra);
    db.recebiveis = [
      r('a1', 'va', '2026-10-25'), r('a2', 'va', '2026-11-25'),
      r('b1', 'vb', '2026-10-25'),
      r('antes', 'va', '2026-09-20', { valorPago: 1000, dataPagamento: '2026-09-20', forma: 'PIX' }),     // antes do corte: já no saldo inicial
      r('semconta', 'va', '2026-10-05', { valorPago: 1000, dataPagamento: '2026-10-05', forma: 'PIX' }), // depois do corte, lançado antes de existir conta
      r('bol', 'va', '2026-10-15', { contaId: 'cb1' })
    ];
    db.custos = [{ id: 'k1', descricao: 'Contador', categoriaId: 'administrativo', fornecedor: 'Contábil Rio', valor: 900, formaPagamento: 'PIX', loteamentoId: null, dataCompetencia: '2026-10-01', vencimento: '2026-10-10', status: 'pendente' }];
    db.contasBanco = [{ id: 'cb1', banco: '001', agencia: '1234', conta: '56789', convenio: '1234567', carteira: '17' }];
    db.contasCaixa = []; db.movimentos = [];
  });
  const saldos = () => page.evaluate(() => Object.fromEntries(db.contasCaixa.map(c => [c.nome, saldoConta(c)])));
  const limparToasts = () => page.evaluate(() => document.querySelectorAll('.toast').forEach(e => e.remove()));
  const novaConta = async (nome, emp, tipo, saldo, data, conv) => {
    await page.evaluate(() => abrirContaCaixa()); await page.waitForTimeout(150);
    await page.fill('#cxNome', nome); await page.selectOption('#cxEmp', emp); await page.selectOption('#cxTipo', tipo);
    await page.fill('#cxSaldo', String(saldo)); await page.fill('#cxData', data);
    if (conv) await page.selectOption('#cxConv', conv);
    await page.click('#modalFoot .btn-primary'); await page.waitForTimeout(150);
  };

  await passo('menu Financeiro tem "Caixa e bancos"; sem contas, a tela explica e convida a cadastrar', async () => {
    if (!await page.locator('.aside .tab[data-tab="caixa"]', { hasText: 'Caixa e bancos' }).count()) throw new Error('sem item no menu');
    await page.evaluate(() => switchTab('caixa'));
    const t = (await page.locator('#av-caixa').innerText()).replace(/\s+/g, ' ');
    if (!t.includes('Cadastre as contas de cada empresa') || !t.includes('Cadastrar a primeira conta')) throw new Error(t);
    const r = await page.evaluate(() => ({ campo: (abrirPagamento('a1'), !!document.getElementById('pgConta')) }));
    await page.evaluate(() => closeModal());
    if (r.campo) throw new Error('sem conta cadastrada, a janela de pagamento já pede conta');
  });
  await passo('cadastra contas de duas empresas; o saldo começa no saldo inicial', async () => {
    await novaConta('BB Corrente', '', 'corrente', 10000, '2026-10-01', 'cb1');
    await novaConta('Caixa do escritório', '', 'caixa', 500, '2026-10-01');
    await novaConta('Sicoob SPE', 'emp2', 'corrente', 2000, '2026-10-01');
    const s = await saldos();
    if (JSON.stringify(s) !== JSON.stringify({ 'BB Corrente': 10000, 'Caixa do escritório': 500, 'Sicoob SPE': 2000 })) throw new Error(JSON.stringify(s));
    const t = (await page.locator('#av-caixa').innerText()).replace(/\s+/g, ' ');
    for (const x of ['Total em caixa e bancos R$ 12.500,00', 'Cauduro Incorporadora', 'Vista Verde SPE Ltda', 'R$ 10.500,00', 'recebe os boletos']) if (!t.includes(x)) throw new Error(`faltou "${x}": ${t}`);
    if (await page.evaluate(() => db.movimentos.some(m => m.recebivelId === 'antes'))) throw new Error('pagamento de antes do corte virou movimento');
  });
  await passo('pagamento de outubro lançado antes de existir conta aparece como "sem conta" e é lançado', async () => {
    await page.evaluate(() => renderCurrent());
    const aviso = (await page.locator('#av-caixa .cx-pend').innerText()).replace(/\s+/g, ' ');
    if (!/1 pagamento desde a data de corte ainda sem conta/.test(aviso)) throw new Error(aviso);
    await page.click('#av-caixa .cx-pend');
    await page.selectOption('#pdTodas', { label: 'Caixa do escritório' });
    await page.click('#modalFoot .btn-primary'); await page.waitForTimeout(150);
    const s = await saldos();
    if (s['Caixa do escritório'] !== 1500 || await page.locator('#av-caixa .cx-pend').count()) throw new Error(JSON.stringify(s));
  });
  await passo('registrar pagamento pergunta "Entrou na conta" (a última usada na empresa do contrato) e o saldo sobe', async () => {
    await limparToasts();
    await page.evaluate(() => abrirPagamento('b1')); await page.waitForTimeout(150);
    const padrao = await page.evaluate(() => getContaCaixa(val('pgConta')).nome);
    if (padrao !== 'Sicoob SPE') throw new Error('padrão da SPE: ' + padrao);
    await page.evaluate(() => closeModal());
    await page.evaluate(() => abrirPagamento('a1')); await page.waitForTimeout(150);
    /* na principal, vem a última conta usada nela (a dos pagamentos sem conta) */
    if (await page.evaluate(() => getContaCaixa(val('pgConta')).nome) !== 'Caixa do escritório') throw new Error('padrão da principal');
    await page.selectOption('#pgConta', { label: 'BB Corrente' });
    await page.click('#modalFoot .btn-primary'); await page.waitForTimeout(150);
    const s = await saldos();
    if (s['BB Corrente'] !== 11000) throw new Error(JSON.stringify(s));
    if (!/entrou em BB Corrente/.test(await page.locator('#toastContainer').innerText())) throw new Error('aviso não diz a conta');
  });
  await passo('estornar o pagamento tira o movimento', async () => {
    await page.evaluate(() => estornarPagamento('a1')); await page.waitForTimeout(250);
    if ((await saldos())['BB Corrente'] !== 10000 || await page.evaluate(() => db.movimentos.some(m => m.recebivelId === 'a1'))) throw new Error('ficou movimento');
  });
  await passo('baixa por boleto cai na conta ligada ao convênio, mesmo com outra conta como última usada', async () => {
    await page.evaluate(() => { lembrarConta(db.contasCaixa.find(c => c.nome === 'Caixa do escritório').id); const r = db.recebiveis.find(x => x.id === 'bol'); upsert('recebiveis', Object.assign({}, r, { valorPago: 1000, dataPagamento: '2026-10-16', forma: 'Boleto' })); });
    if ((await saldos())['BB Corrente'] !== 11000) throw new Error(JSON.stringify(await saldos()));
  });
  await passo('pagar conta: "Saiu da conta"; Desfazer devolve o saldo', async () => {
    await limparToasts();
    await page.evaluate(() => pagarCusto('k1')); await page.waitForTimeout(150);
    await page.selectOption('#cpConta', { label: 'Caixa do escritório' });
    await page.click('#modalFoot .btn-primary'); await page.waitForTimeout(150);
    if ((await saldos())['Caixa do escritório'] !== 600) throw new Error(JSON.stringify(await saldos()));
    await page.locator('.toast .toast-acao', { hasText: 'Desfazer' }).click(); await page.waitForTimeout(100);
    if ((await saldos())['Caixa do escritório'] !== 1500) throw new Error('desfazer: ' + JSON.stringify(await saldos()));
  });
  await passo('despesa lançada já paga sai da conta escolhida; voltando para "a pagar", o movimento sai', async () => {
    await page.evaluate(() => abrirCustoForm(null, { emp: null })); await page.waitForTimeout(150);
    await page.fill('#cuDesc', 'Material de escritório'); await page.fill('#cuValor', '250'); await page.fill('#cuVenc', '2026-10-12');
    await page.selectOption('#cuStatus', 'pago');
    if (!await page.isVisible('#cuConta')) throw new Error('sem campo de conta');
    await page.selectOption('#cuConta', { label: 'BB Corrente' });
    await page.click('#modalFoot .btn-primary'); await page.waitForTimeout(150);
    if ((await saldos())['BB Corrente'] !== 10750) throw new Error(JSON.stringify(await saldos()));
    const id = await page.evaluate(() => db.custos.find(c => c.descricao === 'Material de escritório').id);
    await page.evaluate(id => abrirCustoForm(id), id); await page.waitForTimeout(150);
    if (await page.evaluate(() => getContaCaixa(val('cuConta')).nome) !== 'BB Corrente') throw new Error('edição não mostra a conta usada');
    await page.selectOption('#cuStatus', 'pendente'); await page.click('#modalFoot .btn-primary'); await page.waitForTimeout(150);
    if ((await saldos())['BB Corrente'] !== 11000) throw new Error(JSON.stringify(await saldos()));
  });
  await passo('despesa parcelada lançada como paga: só a 1ª parcela sai da conta escolhida', async () => {
    await page.evaluate(() => abrirCustoForm(null, { emp: null })); await page.waitForTimeout(150);
    await page.fill('#cuDesc', 'Notebook'); await page.fill('#cuVenc', '2026-10-14');
    await page.check('#cuParc'); await page.fill('#cuParcValor', '400'); await page.fill('#cuParcN', '3');
    await page.selectOption('#cuStatus', 'pago'); await page.selectOption('#cuConta', { label: 'Caixa do escritório' });
    await page.click('#modalFoot .btn-primary'); await page.waitForTimeout(150);
    if ((await saldos())['Caixa do escritório'] !== 1100) throw new Error(JSON.stringify(await saldos()));
    await page.locator('.toast .toast-acao', { hasText: 'Desfazer' }).last().click(); await page.waitForTimeout(100);
    if ((await saldos())['Caixa do escritório'] !== 1500) throw new Error('desfazer: ' + JSON.stringify(await saldos()));
  });
  await passo('comissão paga: janela com data e conta; reabrir tira o movimento', async () => {
    await page.evaluate(() => toggleComissao('vb')); await page.waitForTimeout(150);
    if (!/Pagar comissão/.test(await page.locator('#modalBox').innerText())) throw new Error('sem janela');
    if (await page.evaluate(() => getContaCaixa(val('kmConta')).nome) !== 'Sicoob SPE') throw new Error('conta padrão da SPE');
    await page.fill('#kmData', '2026-10-18'); await page.click('#modalFoot .btn-primary'); await page.waitForTimeout(150);
    if ((await saldos())['Sicoob SPE'] !== 500) throw new Error(JSON.stringify(await saldos()));
    await page.evaluate(() => toggleComissao('vb')); await page.waitForTimeout(100);
    if ((await saldos())['Sicoob SPE'] !== 2000) throw new Error('reabrir: ' + JSON.stringify(await saldos()));
  });
  await passo('transferência entre contas: sai de uma, entra na outra; data antes do corte é recusada', async () => {
    await limparToasts();
    await page.evaluate(() => { switchTab('caixa'); abrirTransferencia(); }); await page.waitForTimeout(150);
    await page.selectOption('#trDe', { label: 'BB Corrente' }); await page.selectOption('#trPara', { label: 'Caixa do escritório' });
    await page.fill('#trValor', '300'); await page.fill('#trData', '2026-09-30');
    await page.click('#modalFoot .btn-primary');
    if (!/Antes da data de corte/.test(await page.locator('#toastContainer').innerText())) throw new Error('aceitou antes do corte');
    await page.fill('#trData', '2026-10-17'); await page.click('#modalFoot .btn-primary'); await page.waitForTimeout(150);
    const s = await saldos();
    if (s['BB Corrente'] !== 10700 || s['Caixa do escritório'] !== 1800) throw new Error(JSON.stringify(s));
  });
  await passo('extrato: do mais novo ao mais antigo, com o saldo depois de cada um e o saldo inicial no fim', async () => {
    await page.evaluate(() => abrirExtrato(db.contasCaixa.find(c => c.nome === 'BB Corrente').id));
    const linhas = await page.evaluate(() => [...document.querySelectorAll('#av-caixa .cx-mov')].map(x => x.innerText.replace(/\s+/g, ' ').trim()));
    if (linhas.length !== 3) throw new Error(linhas.join(' | '));
    if (!/17\/10\/2026 Transferência para Caixa do escritório .*− R\$ 300,00 saldo R\$ 10\.700,00/.test(linhas[0])) throw new Error(linhas[0]);
    if (!/16\/10\/2026 Gustavo Lima · Parcela bol .*\+ R\$ 1\.000,00 saldo R\$ 11\.000,00/.test(linhas[1])) throw new Error(linhas[1]);
    if (!/01\/10\/2026 Saldo inicial \(data de corte\) R\$ 10\.000,00/.test(linhas[2])) throw new Error(linhas[2]);
    const t = (await page.locator('#av-caixa .cx-saldos').innerText()).replace(/\s+/g, ' ');
    if (!t.includes('Saldo hoje R$ 10.700,00') || !t.includes('Entradas R$ 1.000,00') || !t.includes('Saídas R$ 300,00')) throw new Error(t);
  });
  await passo('trocar o movimento de conta pelo extrato', async () => {
    await page.click('#av-caixa .cx-mov >> nth=1'); await page.waitForTimeout(150);
    await page.selectOption('#mvConta', { label: 'Caixa do escritório' }); await page.click('#modalFoot .btn-primary'); await page.waitForTimeout(150);
    const s = await saldos();
    if (s['BB Corrente'] !== 9700 || s['Caixa do escritório'] !== 2800) throw new Error(JSON.stringify(s));
  });
  await passo('conta com movimentos não se exclui (só desativa)', async () => {
    await page.evaluate(() => { closeModal(); window.__confirmacoes = []; excluirContaCaixa(db.contasCaixa.find(c => c.nome === 'BB Corrente').id); }); await page.waitForTimeout(200);
    if (!(await page.evaluate(() => db.contasCaixa.some(c => c.nome === 'BB Corrente')))) throw new Error('excluiu conta com movimentos');
  });
  await passo('celular: lista de contas e extrato cabem na largura', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    const r = await page.evaluate(() => { const out = []; state.sub.caixaConta = null; switchTab('caixa'); out.push(document.documentElement.scrollWidth <= innerWidth);
      abrirExtrato(db.contasCaixa[0].id); out.push(document.documentElement.scrollWidth <= innerWidth); return out.join(); });
    if (r !== 'true,true') throw new Error(r);
  });
  await browser.close();
  if (erros.length) { console.log('\nERROS:\n' + erros.join('\n')); process.exit(1); }
  console.log('\nTudo certo.');
})();
