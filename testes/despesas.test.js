// Fase 4: despesa da empresa (sem empreendimento) e despesa vinculada a um empreendimento ou a
// um imóvel dele — lote do loteamento ou imóvel avulso de um contrato da carteira. Confere o
// formulário, os filtros da lista A pagar, o rótulo "de quem", o orçamento da obra (que não
// conta despesa da empresa), o cartão "Despesas deste imóvel" no contrato e o relatório.
// Rodar: BASE=http://127.0.0.1:8765/lotifly/ node testes/despesas.test.js
const { chromium } = require('playwright');
const { responderConfirmacoes } = require('./confirmacoes');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/gestao/';
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--disable-gpu'] });
  const erros = [];
  for (const w of [390, 1440]) {
    const passo = async (nome, fn) => { try { await fn(); console.log('✔', w, nome); } catch (e) { console.log('✘', w, nome, e.message.split('\n')[0]); erros.push(`${w} ${nome}: ${e.message.split('\n')[0]}`); } };
    const ctx = await browser.newContext({ viewport: { width: w, height: w < 700 ? 844 : 900 }, hasTouch: w < 700, serviceWorkers: 'block' });
    await ctx.route(/config\.js/, r => r.fulfill({ contentType: 'application/javascript', body: "window.GL_CONFIG={supabaseUrl:'',supabaseAnonKey:''};" }));
    const page = await ctx.newPage(); page.setDefaultTimeout(8000);
    page.on('pageerror', e => erros.push(`${w} pageerror: ${e.message}`)); page.on('dialog', d => d.accept()); await responderConfirmacoes(page);
    await page.goto(BASE + 'index.html?dados=exemplo'); await page.waitForFunction(() => window.PiorCaso && db.loteamentos.length); await page.waitForTimeout(300);
    /* Uma carteira com um contrato de imóvel avulso, ao lado do loteamento de exemplo */
    await page.evaluate(() => {
      sessionStorage.setItem('gl_admin', '1'); startRole('admin'); document.querySelectorAll('#devDados,.toast').forEach(e => e.remove());
      upsert('loteamentos', { id: 'cart1', nome: 'Imóveis de terceiros', tipo: 'carteira', criadoEm: new Date().toISOString() });
      const base = db.vendas.find(v => v.status === 'ativa');
      upsert('vendas', Object.assign(JSON.parse(JSON.stringify(base)), { id: 'vc1', loteamentoId: 'cart1', loteId: null, imovel: { descricao: 'Apartamento 302 do Edifício Atlântico' } }));
      /* No celular os filtros ficam atrás do botão "Filtros": aqui ficam abertos. */
      state.escopo = ''; switchTab('custos'); state.filters.custos.abertos = true; renderCustos();
    });
    await page.waitForTimeout(300);
    const lista = page.locator('#av-custos');
    const chip = t => lista.locator('.chips-vinc .chip', { hasText: t });

    await passo('A pagar da empresa: filtros Todas / Só da empresa / Só de empreendimentos', async () => {
      const r = await page.evaluate(() => [...document.querySelectorAll('#av-custos .chips-vinc .chip')].map(c => c.textContent.trim()));
      const esperado = await page.evaluate(() => [db.custos.length, db.custos.filter(c => !c.loteamentoId).length, db.custos.filter(c => c.loteamentoId).length]);
      if (r.join('|') !== `Todas as despesas${esperado[0]}|Só da empresa${esperado[1]}|Só de empreendimentos${esperado[2]}`) throw new Error(r.join('|'));
    });
    await passo('despesa da empresa aparece com o rótulo Empresa', async () => {
      const t = await lista.locator('.item[data-vinculo="empresa"] .vinc').first().innerText();
      if (t.trim() !== 'Empresa') throw new Error(t);
    });
    await passo('Só da empresa mostra só as da empresa', async () => {
      await chip('Só da empresa').click(); await page.waitForTimeout(200);
      const r = await page.evaluate(() => [...document.querySelectorAll('#av-custos .item')].map(i => i.dataset.vinculo));
      if (!r.length || r.some(x => x !== 'empresa')) throw new Error(r.join(','));
    });
    await passo('Lançar a partir de Só da empresa já vem com Empresa e sem imóvel', async () => {
      await lista.getByRole('button', { name: 'Lançar' }).click(); await page.waitForTimeout(300);
      const r = await page.evaluate(() => ({ titulo: modalTitle.textContent, emp: cuEmp.value, box: getComputedStyle(cuImovelBox).display }));
      if (r.titulo !== 'Lançar despesa' || r.emp !== '' || r.box !== 'none') throw new Error(JSON.stringify(r));
    });
    await passo('salva despesa da empresa sem empreendimento', async () => {
      await page.fill('#cuDesc', 'Internet do escritório'); await page.fill('#cuValor', '189.9');
      await page.locator('#modalBox').getByRole('button', { name: 'Salvar' }).click(); await page.waitForTimeout(300);
      const c = await page.evaluate(() => db.custos.find(c => c.descricao === 'Internet do escritório'));
      if (!c || c.loteamentoId !== null || c.loteId || c.vendaId) throw new Error(JSON.stringify(c));
      if (!await lista.locator('.item', { hasText: 'Internet do escritório' }).count()) throw new Error('não apareceu na lista');
    });
    await passo('escolher o loteamento mostra os lotes; salva vinculada ao lote', async () => {
      await lista.locator('.item', { hasText: 'Internet do escritório' }).locator('.title').click(); await page.waitForTimeout(300);
      if (await page.evaluate(() => modalTitle.textContent) !== 'Editar despesa') throw new Error('não abriu a edição');
      const lot = await page.evaluate(() => db.loteamentos.find(l => l.tipo !== 'carteira').id);
      await page.selectOption('#cuEmp', lot); await page.waitForTimeout(100);
      const ops = await page.evaluate(() => [...cuImovel.options].map(o => o.value));
      if (!(ops[0] === '' && ops.slice(1).every(v => v.startsWith('l:')) && ops.length > 2)) throw new Error(ops.slice(0, 4).join(','));
      await page.selectOption('#cuImovel', ops[1]);
      await page.fill('#cuDesc', 'Roçada do lote');
      await page.locator('#modalBox').getByRole('button', { name: 'Salvar' }).click(); await page.waitForTimeout(300);
      const r = await page.evaluate(() => { const c = db.custos.find(c => c.descricao === 'Roçada do lote'); return { c, rot: vinculoDoCusto(c) }; });
      if (r.c.loteamentoId !== lot || 'l:' + r.c.loteId !== ops[1] || r.c.vendaId || r.rot.tipo !== 'imovel' || !r.rot.rotulo.includes(' · ')) throw new Error(JSON.stringify(r));
    });
    await passo('Só de empreendimentos esconde as da empresa', async () => {
      await chip('Só de empreendimentos').click(); await page.waitForTimeout(200);
      const r = await page.evaluate(() => [...document.querySelectorAll('#av-custos .item')].map(i => i.dataset.vinculo));
      if (!r.length || r.includes('empresa')) throw new Error(r.join(','));
      const t = await lista.locator('.item', { hasText: 'Roçada do lote' }).locator('.vinc').innerText();
      if (!t.includes('Vista Verde · ')) throw new Error('rótulo: ' + t);
    });
    await passo('carteira: o imóvel é o contrato; o contrato mostra Despesas deste imóvel', async () => {
      await page.evaluate(() => abrirCustoForm(null, { emp: 'cart1' })); await page.waitForTimeout(300);
      const ops = await page.evaluate(() => [...cuImovel.options].map(o => o.value + '=' + o.textContent));
      if (!ops.some(o => o.startsWith('v:vc1=Apartamento 302'))) throw new Error(ops.join(' | '));
      await page.selectOption('#cuImovel', 'v:vc1');
      await page.fill('#cuDesc', 'IPTU 2026 do apartamento'); await page.fill('#cuValor', '1240');
      await page.locator('#modalBox').getByRole('button', { name: 'Salvar' }).click(); await page.waitForTimeout(300);
      const c = await page.evaluate(() => db.custos.find(c => c.descricao === 'IPTU 2026 do apartamento'));
      if (c.loteamentoId !== 'cart1' || c.vendaId !== 'vc1' || c.loteId) throw new Error(JSON.stringify(c));
      await page.evaluate(() => abrirContrato('vc1', 'resumo')); await page.waitForTimeout(300);
      const card = page.locator('.card', { has: page.locator('h2', { hasText: 'Despesas deste imóvel' }) });
      const t = await card.innerText();
      if (!t.includes('IPTU 2026 do apartamento') || !/1 lançamento/.test(t) || !/a pagar/.test(t)) throw new Error(t.slice(0, 200));
    });
    await passo('+ Despesa no contrato abre o formulário já no imóvel', async () => {
      await page.locator('.card h2', { hasText: 'Despesas deste imóvel' }).getByRole('button', { name: 'Despesa' }).click(); await page.waitForTimeout(300);
      const r = await page.evaluate(() => ({ emp: cuEmp.value, im: cuImovel.value }));
      if (r.emp !== 'cart1' || r.im !== 'v:vc1') throw new Error(JSON.stringify(r));
      await page.evaluate(() => closeModal()); await page.waitForTimeout(200);
    });
    await passo('orçado × realizado não conta despesa da empresa', async () => {
      const r = await page.evaluate(() => {
        const antes = orcamentoHtml('', db.custos);
        const cat = db.categorias.find(c => antes.includes(c.nome)).id;
        db.custos.push({ id: 'tmp-emp', loteamentoId: null, descricao: 'Teste', categoriaId: cat, valor: 98765, dataCompetencia: todayStr(), status: 'pendente' });
        const depois = orcamentoHtml('', db.custos);
        db.custos = db.custos.filter(c => c.id !== 'tmp-emp');
        return antes === depois;
      });
      if (!r) throw new Error('o realizado mudou com uma despesa da empresa');
    });
    await passo('relatório de despesas: agrupar por Empresa ou empreendimento, coluna De quem', async () => {
      await page.evaluate(() => { state.escopo = ''; Object.assign(relState(), { tipo: 'despesas', de: '2000-01-01', ate: '2099-12-31', agrupar: 'vinculo', status: 'todos', categoria: '', fornecedor: '' }); switchTab('relatorios'); });
      await page.waitForTimeout(300);
      const r = await page.evaluate(() => ({ th: [...document.querySelectorAll('#av-relatorios table.tbl thead th')].map(t => t.textContent), grupos: [...document.querySelectorAll('#av-relatorios table.tbl tbody tr td[colspan] b')].map(b => b.textContent) }));
      if (!r.th.includes('De quem')) throw new Error('colunas: ' + r.th.join('|'));
      if (!r.grupos.includes('Empresa (sem empreendimento)') || !r.grupos.includes('Residencial Vista Verde') || !r.grupos.includes('Imóveis de terceiros')) throw new Error('grupos: ' + r.grupos.join('|'));
    });
    await passo('excluir o contrato não apaga a despesa: ela fica na carteira, sem o vínculo', async () => {
      await page.evaluate(() => { excluirVenda('vc1'); });
      await page.waitForTimeout(200);
      await page.evaluate(() => { document.getElementById('exVenda').value = 'EXCLUIR'; confirmarExclusaoVenda('vc1'); });
      await page.waitForTimeout(200);
      const c = await page.evaluate(() => db.custos.find(c => c.descricao === 'IPTU 2026 do apartamento'));
      if (!c || c.loteamentoId !== 'cart1' || c.vendaId) throw new Error(JSON.stringify(c));
    });
    await passo('no celular nada sai da tela (lista e formulário)', async () => {
      await page.evaluate(() => { state.escopo = ''; state.filters.custos.vinc = 'todos'; switchTab('custos'); });
      await page.waitForTimeout(200);
      const lst = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      await page.evaluate(() => abrirCustoForm(null, { emp: db.loteamentos[0].id })); await page.waitForTimeout(300);
      const mod = await page.evaluate(() => { const m = document.getElementById('modalBox'); return Math.max(...[...m.querySelectorAll('select,input')].map(e => e.getBoundingClientRect().right)) - innerWidth; });
      if (lst > 0 || mod > 0) throw new Error(`lista ${lst}px, formulário ${mod}px`);
      await page.evaluate(() => closeModal());
    });
    await ctx.close();
  }
  await browser.close();
  if (erros.length) { console.log('\nERROS:\n' + erros.join('\n')); process.exit(1); }
  console.log('\nTudo certo.');
})();
