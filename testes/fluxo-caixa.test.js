// Fluxo de caixa projetado (Relatórios) e, no Início, "A receber em <próximo mês>" e o saldo
// previsto. Dados montados à mão para conferir as contas. Relógio fixo em 19/10/2026.
// Rodar: BASE=http://127.0.0.1:8765/gestao/ node testes/fluxo-caixa.test.js
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
  /* Hoje 19/10/2026. Contrato do empreendimento L com:
     - parcela 10/10 de 500 em aberto (atrasada)  - parcela 25/10 de 800
     - parcela 10/11 de 800 com 300 pagos (faltam 500)  - parcela 10/12 de 800
     - comissão de 1.000 ainda não paga
     Despesas: 200 vencida em 05/10, 1.000 em 15/11, e uma de 999 já paga (fica fora).
     Outra receita: 300 em 01/12. Conta: 2.000 em 01/10 + 100 lançados em 05/10 = 2.100 hoje. */
  await page.evaluate(() => {
    sessionStorage.setItem('gl_admin', '1'); startRole('admin'); document.querySelectorAll('#devDados,.toast').forEach(e => e.remove());
    window.print = () => { window.__impresso = document.getElementById('printArea').innerHTML; };
    const L = db.loteamentos.find(l => !ehCarteira(l)).id; window.__L = L;
    db.vendas = [{ id: 'vf', loteamentoId: L, loteId: null, cliente: { nome: 'Ana Prado' }, corretor: { nome: 'Caio' }, dataVenda: '2026-09-01', valorTotal: 10000, entrada: 0, nParcelas: 4, valorParcela: 800, baloes: [], comissaoPct: 10, comissaoValor: 1000, comissaoPaga: false, status: 'ativa' }];
    const rp = (id, venc, valor, pago) => ({ id, vendaId: 'vf', loteamentoId: L, descricao: 'Parcela', valor, vencimento: venc, valorPago: pago || 0, dataPagamento: pago ? '2026-10-15' : null });
    db.recebiveis = [rp('r1', '2026-10-10', 500), rp('r2', '2026-10-25', 800), rp('r3', '2026-11-10', 800, 300), rp('r4', '2026-12-10', 800)];
    const cu = (id, venc, valor, status) => ({ id, loteamentoId: L, descricao: 'Despesa ' + id, valor, dataCompetencia: venc, vencimento: venc, status, dataPagamento: status === 'pago' ? venc : null });
    db.custos = [cu('c1', '2026-10-05', 200, 'aberto'), cu('c2', '2026-11-15', 1000, 'aberto'), cu('c3', '2026-11-20', 999, 'pago')];
    db.receitas = [{ id: 'x1', descricao: 'Aluguel do salão', valor: 300, loteamentoId: L, dataCompetencia: '2026-12-01', vencimento: '2026-12-01', status: 'aberto' }];
    db.contasCaixa = [{ id: 'cc1', nome: 'Banco', tipo: 'corrente', saldoInicial: 2000, dataSaldo: '2026-10-01', ativa: true }];
    db.movimentos = [{ id: 'm1', contaId: 'cc1', data: '2026-10-05', valor: 100, natureza: 'manual', descricao: 'Ajuste' }];
    state.escopo = ''; switchTab('painel');
  });

  await passo('cálculo: parte do saldo de hoje das contas e soma mês a mês (atrasado a receber fora)', async () => {
    const r = await page.evaluate(() => { const p = fluxoProjetado('', 12, 'fora'); return { hoje: p.saldoHoje, com: p.comSaldo, m: p.meses.slice(0, 3).map(l => [l.mes, l.contratos, l.receitas, l.despesas, l.comissoes, l.saldoFim]), fim: p.saldoFinal, neg: p.negativo, n: p.meses.length, atr: p.atraso.contratos }; });
    const esperado = { hoje: 2100, com: true, m: [['2026-10', 800, 0, 200, 1000, 1700], ['2026-11', 500, 0, 1000, 0, 1200], ['2026-12', 800, 300, 0, 0, 2300]], fim: 2300, neg: null, n: 12, atr: 500 };
    if (JSON.stringify(r) !== JSON.stringify(esperado)) throw new Error(JSON.stringify(r));
  });
  await passo('contar os atrasados: a parcela atrasada entra no mês atual', async () => {
    const r = await page.evaluate(() => { const p = fluxoProjetado('', 6, 'entram'); return [p.meses.length, p.meses[0].contratos, p.saldoFinal]; });
    if (JSON.stringify(r) !== '[6,1300,2800]') throw new Error(JSON.stringify(r));
  });
  await passo('relatório de um empreendimento: sem o saldo das contas, e avisa o mês em que fica negativo', async () => {
    const r = await page.evaluate(() => { const p = fluxoProjetado(window.__L, 12, 'fora'); return [p.comSaldo, p.saldoHoje, p.meses[0].saldoFim, p.meses[1].saldoFim, p.negativo && p.negativo.mes]; });
    if (JSON.stringify(r) !== '[false,0,-400,-900,"2026-10"]') throw new Error(JSON.stringify(r));
  });
  await passo('Início: "A receber em nov/26" e o saldo previsto no fim de nov/26', async () => {
    const r = await page.evaluate(() => [...document.querySelectorAll('#av-painel .kpi')].map(k => k.querySelector('.lbl').textContent.trim() + ' = ' + k.querySelector('.val').textContent.trim()));
    const prox = r.find(t => t.startsWith('A receber em nov/26')), saldo = r.find(t => t.startsWith('Saldo previsto no fim de nov/26'));
    if (!prox || !/500,00$/.test(prox) || !saldo || !/1\.200,00$/.test(saldo)) throw new Error(JSON.stringify(r));
  });
  await passo('Início: tocar em "A receber em nov/26" abre as parcelas em aberto de nov/26', async () => {
    await page.locator('#av-painel .kpi', { hasText: 'A receber em nov/26' }).click(); await page.waitForTimeout(200);
    const r = await page.evaluate(() => ({ tab: state.tab, mes: state.filters.rec.mes, st: state.filters.rec.status }));
    if (r.tab !== 'recebiveis' || r.mes !== '2026-11' || r.st !== 'aberto') throw new Error(JSON.stringify(r));
    // e "A receber no mês" volta para o mês atual
    await page.evaluate(() => switchTab('painel')); await page.locator('#av-painel .kpi', { hasText: 'A receber no mês' }).click(); await page.waitForTimeout(150);
    if (await page.evaluate(() => state.filters.rec.mes) !== '2026-10') throw new Error('não voltou ao mês atual');
  });
  await passo('Início: o saldo previsto abre o relatório do fluxo; a tela não tem De/Até', async () => {
    await page.evaluate(() => switchTab('painel')); await page.locator('#av-painel .kpi', { hasText: 'Saldo previsto' }).click(); await page.waitForTimeout(200);
    const r = await page.evaluate(() => ({ tab: state.tab, tipo: state.rel.tipo, datas: document.querySelectorAll('#av-relatorios input[type=date]').length, linhas: document.querySelectorAll('#av-relatorios .fluxo-tabela tbody tr').length, txt: document.querySelector('#av-relatorios').textContent }));
    if (r.tab !== 'relatorios' || r.tipo !== 'fluxo' || r.datas !== 0 || r.linhas !== 12 || !/Saldo hoje/.test(r.txt) || /negativo em/.test(r.txt)) throw new Error(JSON.stringify({ ...r, txt: r.txt.slice(0, 200) }));
  });
  await passo('relatório: trocar para 24 meses e contar os atrasados muda a tabela', async () => {
    await page.selectOption('#relFluxoMeses', '24'); await page.selectOption('#relFluxoAtraso', 'entram'); await page.waitForTimeout(150);
    const r = await page.evaluate(() => ({ n: document.querySelectorAll('#av-relatorios .fluxo-tabela tbody tr').length, out: document.querySelector('#av-relatorios .fluxo-tabela tbody tr').textContent }));
    if (r.n !== 24 || !/1\.300,00/.test(r.out)) throw new Error(JSON.stringify(r));
    await page.selectOption('#relFluxoMeses', '12'); await page.selectOption('#relFluxoAtraso', 'fora');
  });
  await passo('impressão e CSV: período "out/26 a set/27", sem a lista do celular', async () => {
    const r = await page.evaluate(() => {
      imprimirRelatorio(); const imp = window.__impresso;
      let csv = ''; const d0 = window.download; window.download = (nome, txt) => { csv = txt; }; exportarRelatorioCSV(); window.download = d0;
      return { periodo: /Fluxo de caixa projetado — out\/26 a set\/27/.test(imp), lista: /fl-mes/.test(imp), csv: csv.split('\n').slice(0, 2).join(' | ') };
    });
    if (!r.periodo || r.lista || !/Saldo previsto/.test(r.csv) || !/out\/26/.test(r.csv)) throw new Error(JSON.stringify(r));
  });
  await passo('empreendimento negativo: aviso vermelho com o mês', async () => {
    const t = await page.evaluate(() => { state.escopo = window.__L; renderCurrent(); return (document.querySelector('#av-relatorios .fluxo-alerta') || {}).textContent || ''; });
    if (!/negativo em out\/26/.test(t)) throw new Error(t);
    await page.evaluate(() => { state.escopo = ''; renderCurrent(); });
  });
  await passo('celular: a tabela vira lista mês a mês, sem rolagem lateral; o Início cabe na largura', async () => {
    await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(200);
    const r = await page.evaluate(() => ({ lista: document.querySelectorAll('#av-relatorios .fluxo-lista .fl-mes').length, listaVisivel: getComputedStyle(document.querySelector('.fluxo-lista')).display !== 'none', tabela: getComputedStyle(document.querySelector('.fluxo-tabela')).display, rol: document.documentElement.scrollWidth <= innerWidth }));
    await page.evaluate(() => switchTab('painel')); await page.waitForTimeout(200);
    const rolInicio = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
    if (r.lista !== 12 || !r.listaVisivel || r.tabela !== 'none' || !r.rol || !rolInicio) throw new Error(JSON.stringify({ ...r, rolInicio }));
  });
  await passo('sem contas cadastradas: vira "Sobra prevista" (entradas − saídas)', async () => {
    const t = await page.evaluate(() => { db.contasCaixa = []; db.movimentos = []; renderCurrent(); const k = [...document.querySelectorAll('#av-painel .kpi')].find(x => /prevista/.test(x.textContent)); return k ? k.textContent : ''; });
    if (!/Sobra prevista no fim de nov\/26/.test(t) || !/-R\$\s900,00/.test(t)) throw new Error(t);
  });
  await browser.close();
  if (erros.length) { console.log('\nERROS:\n' + erros.join('\n')); process.exit(1); }
  console.log('\nTudo certo.');
})();
