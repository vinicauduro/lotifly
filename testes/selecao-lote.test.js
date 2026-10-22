// Seleção em lote nas listas: caixinha em cada linha e "Selecionar todas"; a lista mostra 30 de
// cada vez e traz mais ao rolar (ou no botão); com algo marcado, a barra embaixo diz quantas e
// o total, e oferece Imprimir, Planilha e as ações da tela (pagar e excluir despesas, excluir
// contratos, clientes e imóveis). O que sai do filtro sai da seleção. Relógio fixo em 19/10/2026.
// Rodar: BASE=http://127.0.0.1:8765/gestao/ node testes/selecao-lote.test.js
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
    /* 75 despesas: a lista mostra 30, depois 60, depois 75 */
    db.custos = Array.from({ length: 75 }, (_, i) => ({ id: 'k' + i, descricao: `Despesa ${String(i + 1).padStart(2, '0')}`, categoriaId: 'administrativo', fornecedor: 'Fornecedor ' + (i % 4), valor: 100, formaPagamento: 'PIX', loteamentoId: null,
      dataCompetencia: '2026-10-01', vencimento: `2026-10-${String(1 + (i % 28)).padStart(2, '0')}`, status: i < 5 ? 'pago' : 'pendente', dataPagamento: i < 5 ? '2026-10-01' : null }));
    db.contasCaixa = [{ id: 'cx1', nome: 'BB Corrente', tipo: 'corrente', empresaId: '', saldoInicial: 10000, dataSaldo: '2026-10-01', ativa: true }]; db.movimentos = [];
    state.filters.custos = { status: 'all', cat: 'all', mes: 'all', busca: '' }; state.escopo = '';
    db.clientes = [{ id: 'cl1', nome: 'Gustavo Lima', cpf: '12345678909' }, { id: 'cl2', nome: 'Helena Prado', cpf: '98765432100' }];
  });
  const linhas = () => page.locator('#av-custos [data-sel-lista="custos"] > .com-sel').count();
  const barra = () => page.evaluate(() => { const b = document.getElementById('selBarra'); return b && !b.hidden ? b.innerText.replace(/\s+/g, ' ').trim() : ''; });

  await passo('A pagar: mostra 30 de 75, com "Selecionar todas (75)" e caixinha em cada linha', async () => {
    await page.evaluate(() => switchTab('custos')); await page.waitForTimeout(100);
    const t = (await page.locator('#av-custos .sel-topo').innerText()).replace(/\s+/g, ' ');
    if (!t.includes('Selecionar todas (75)') || !t.includes('mostrando 30 de 75')) throw new Error(t);
    if (await linhas() !== 30 || await page.locator('#av-custos .com-sel > .sel-chk').count() !== 30) throw new Error('linhas ' + await linhas());
  });
  await passo('"Mostrar mais" traz mais 30; rolar até o fim traz o resto', async () => {
    await page.click('#av-custos .sel-mais .btn'); await page.waitForTimeout(100);
    if (await linhas() !== 60) throw new Error('depois do botão: ' + await linhas());
    await page.locator('#av-custos .sel-mais').scrollIntoViewIfNeeded(); await page.waitForTimeout(400);
    if (await linhas() !== 75 || await page.locator('#av-custos .sel-mais').count()) throw new Error('depois de rolar: ' + await linhas());
  });
  await passo('marcar linhas abre a barra com quantas e o total; clicar na caixinha não abre a despesa', async () => {
    await page.locator('#av-custos .com-sel .sel-chk').nth(0).check();
    await page.locator('#av-custos .com-sel .sel-chk').nth(1).check();
    if (await page.locator('#modalBox').isVisible()) throw new Error('abriu a despesa');
    const b = await barra();
    if (!/^2 selecionadas · R\$ 200,00/.test(b) || !b.includes('Pagar') || !b.includes('Imprimir') || !b.includes('Planilha (CSV)') || !b.includes('Excluir')) throw new Error(b);
    const meio = await page.evaluate(() => document.querySelector('[data-sel-todas="custos"]').indeterminate);
    if (!meio) throw new Error('"Selecionar todas" deveria ficar pela metade');
  });
  await passo('"Selecionar todas" marca as 75, inclusive as que ainda não apareceram', async () => {
    await page.evaluate(() => { state.pag.custos.n = 30; renderCurrent(); }); await page.waitForTimeout(100);
    await page.check('[data-sel-todas="custos"]');
    if (!/^75 selecionadas · R\$ 7\.500,00/.test(await barra())) throw new Error(await barra());
    await page.uncheck('[data-sel-todas="custos"]');
    if (await barra()) throw new Error('barra não sumiu');
  });
  await passo('filtrar tira da seleção o que saiu da lista', async () => {
    await page.check('[data-sel-todas="custos"]');
    await page.evaluate(() => { state.filters.custos.status = 'pago'; renderCustos(); }); await page.waitForTimeout(100);
    if (!/^5 selecionadas/.test(await barra())) throw new Error(await barra());
    await page.evaluate(() => { selLimpar('custos'); state.filters.custos.status = 'all'; renderCustos(); }); await page.waitForTimeout(100);
  });
  await passo('pagar em lote: cada uma no vencimento, saindo da conta escolhida; as já pagas ficam como estão; Desfazer', async () => {
    await page.evaluate(() => ['k0', 'k5', 'k10'].forEach(id => selMarcar('custos', id, true)));   // k0 já está paga
    await page.locator('#selBarra button', { hasText: 'Pagar' }).click(); await page.waitForTimeout(100);
    const t = (await page.locator('#modalBox').innerText()).replace(/\s+/g, ' ');
    if (!t.includes('Pagar 2 contas') || !t.includes('1 já paga') || !t.includes('No vencimento de cada uma')) throw new Error(t);
    await page.click('#modalFoot .btn-primary'); await page.waitForTimeout(150);
    const r = await page.evaluate(() => ({ k10: db.custos.find(c => c.id === 'k10'), saldo: saldoConta(getContaCaixa('cx1')), barra: !!document.querySelector('#selBarra:not([hidden])') }));
    if (r.k10.status !== 'pago' || r.k10.dataPagamento !== r.k10.vencimento || r.saldo !== 9800 || r.barra) throw new Error(JSON.stringify(r));
    await page.locator('.toast .toast-acao', { hasText: 'Desfazer' }).click(); await page.waitForTimeout(100);
    if (await page.evaluate(() => db.custos.filter(c => c.status === 'pago').length) !== 5 || await page.evaluate(() => saldoConta(getContaCaixa('cx1'))) !== 10000) throw new Error('desfazer');
  });
  await passo('excluir em lote pede confirmação e apaga só as marcadas', async () => {
    await page.evaluate(() => { document.querySelectorAll('.toast').forEach(e => e.remove()); ['k20', 'k21', 'k22'].forEach(id => selMarcar('custos', id, true)); });
    await page.locator('#selBarra button', { hasText: 'Excluir' }).click(); await page.waitForTimeout(300);
    const r = await page.evaluate(() => ({ n: db.custos.length, conf: (window.__confirmacoes || []).pop() || '' }));
    if (r.n !== 72 || !r.conf.includes('Excluir 3 despesas?')) throw new Error(JSON.stringify(r));
  });
  await passo('imprimir monta a tabela das selecionadas', async () => {
    await page.evaluate(() => { window.print = () => { window.__impresso = document.getElementById('printArea').innerText; }; ['k30', 'k31'].forEach(id => selMarcar('custos', id, true)); });
    await page.locator('#selBarra button', { hasText: 'Imprimir' }).click();
    const t = await page.evaluate(() => window.__impresso || '');
    if (!t.includes('Contas a pagar — 2 itens') || !t.includes('Despesa 31') || !t.includes('Despesa 32') || t.includes('Despesa 33')) throw new Error(t.slice(0, 300));
  });
  await passo('planilha (CSV) das selecionadas', async () => {
    const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('#selBarra button', { hasText: 'Planilha' }).click()]);
    const txt = require('fs').readFileSync(await dl.path(), 'utf8');
    if (!/^contas-a-pagar-2026-10-19\.csv$/.test(dl.suggestedFilename()) || txt.trim().split('\n').length !== 3 || !txt.includes('Descrição;Fornecedor')) throw new Error(dl.suggestedFilename() + ' ' + txt.slice(0, 200));
    await page.evaluate(() => selLimpar('custos'));
  });
  await passo('trocar de tela esconde a barra; cada tela tem as suas caixinhas', async () => {
    await page.evaluate(() => selMarcar('custos', 'k40', true));
    await page.evaluate(() => switchTab('clientes')); await page.waitForTimeout(100);
    if (await barra()) throw new Error('barra seguiu para outra tela');
    for (const [tab, chave] of [['vendas', 'contratos'], ['clientes', 'clientes'], ['reservas', 'reservas'], ['recebiveis', 'recebiveis'], ['emp', 'imoveis']]) {
      const n = await page.evaluate(([t, c]) => { if (t === 'recebiveis') { filtroRec().mes = 'all'; filtroRec().status = 'all'; } if (t === 'reservas') state.filters.ares = { status: 'historico' }; switchTab(t); return document.querySelectorAll(`[data-sel-lista="${c}"] .sel-chk`).length; }, [tab, chave]);
      if (!n && tab !== 'reservas') throw new Error(`${tab} sem caixinhas`);
      if (tab === 'recebiveis' && n !== 30) throw new Error('A receber deveria mostrar 30: ' + n);
    }
  });
  await passo('contratos: excluir em lote pede EXCLUIR digitado e apaga as parcelas junto', async () => {
    await page.evaluate(() => { state.filters.avendas = { sub: 'vendas', status: 'all', busca: '' }; switchTab('vendas'); });
    const ids = await page.evaluate(() => [...document.querySelectorAll('[data-sel-lista="contratos"] .sel-chk')].slice(0, 2).map(c => c.dataset.selId));
    await page.evaluate(ids => ids.forEach(id => selMarcar('contratos', id, true)), ids);
    const b = await barra();
    if (!b.startsWith('2 selecionadas') || !b.includes('Excluir')) throw new Error(b);
    await page.locator('#selBarra button', { hasText: 'Excluir' }).click(); await page.waitForTimeout(300);
    const r = await page.evaluate(ids => ({ vendas: ids.filter(id => getVenda(id)).length, parcelas: db.recebiveis.filter(x => ids.includes(x.vendaId)).length, conf: (window.__confirmacoes || []).slice(-1)[0] || '' }), ids);
    if (r.vendas || r.parcelas || !r.conf.includes('Excluir 2 contratos?') || !r.conf.includes('EXCLUIR')) throw new Error(JSON.stringify(r).slice(0, 300));
  });
  await passo('imóveis: não deixa excluir todos (fica pelo menos um)', async () => {
    await page.evaluate(() => { switchTab('emp'); selTodas('imoveis', true); });
    await page.locator('#selBarra button', { hasText: 'Excluir' }).click(); await page.waitForTimeout(200);
    const r = await page.evaluate(() => ({ n: db.loteamentos.length, conf: (window.__confirmacoes || []).slice(-1)[0] || '' }));
    if (!r.n || !r.conf.includes('Fica pelo menos um imóvel')) throw new Error(JSON.stringify(r));
    await page.evaluate(() => selLimpar('imoveis'));
  });
  await passo('celular: barra embaixo cabe na largura e esconde o botão +', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => { switchTab('custos'); selMarcar('custos', 'k40', true); }); await page.waitForTimeout(100);
    const r = await page.evaluate(() => { const b = document.getElementById('selBarra').getBoundingClientRect(); return { dentro: b.left >= 0 && b.right <= innerWidth, rol: document.documentElement.scrollWidth <= innerWidth, fab: getComputedStyle(document.getElementById('fab')).display }; });
    if (!r.dentro || !r.rol || r.fab !== 'none') throw new Error(JSON.stringify(r));
  });
  await browser.close();
  if (erros.length) { console.log('\nERROS:\n' + erros.join('\n')); process.exit(1); }
  console.log('\nTudo certo.');
})();
