// Atualização dos preços de venda. Manual: percentual, valor somado a cada lote, preço por m² ou
// índice acumulado; num empreendimento, nos imóveis selecionados ou em todos os imóveis da
// empresa; muda disponíveis, bloqueados e reservados (vendidos nunca); Desfazer. Mensal: ligada
// no formulário do imóvel (% ao mês, R$ por lote ou índice), entra sozinha no dia 1º (o índice,
// quando o do mês anterior sai), recupera os meses que faltaram, avisa no Início com Desfazer.
// Relógio fixo em 19/10/2026.
// Rodar: BASE=http://127.0.0.1:8765/gestao/ node testes/atualizacao-precos.test.js
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
    db.loteamentos = [{ id: 'L1', nome: 'Vista Verde', tipo: 'loteamento', cidade: 'Rio do Sul' }, { id: 'A1', nome: 'Apto 302 Ed. Aurora', tipo: 'carteira', categoria: 'apartamento', preco: 300000, area: 80 }];
    const lote = (id, n, status, preco, area) => ({ id, loteamentoId: 'L1', quadra: 'A', numero: String(n), status, preco, area });
    db.lotes = [lote('d1', 1, 'disponivel', 100000, 250), lote('d2', 2, 'disponivel', 120000, 300), lote('b1', 3, 'bloqueado', 90000, 200), lote('r1', 4, 'reservado', 110000, 250), lote('v1', 5, 'vendido', 95000, 250)];
    db.vendas = []; db.reservas = []; db.recebiveis = [];
    db.indices = [{ id: 'ix-cub', codigo: 'CUB', nome: 'CUB (Sinduscon)', tipo: 'pontos', valores: { '2026-07': 2800, '2026-08': 2828, '2026-09': 2856.28 } }];
    db.config.reajusteAuto = {};
    state.reajusteRecente = null; state._reajusteEm = 0;
  });
  const precos = () => page.evaluate(() => db.lotes.map(l => l.id + ':' + l.preco).join(' ') + ' A1:' + getLoteamento('A1').preco);
  const abrir = async escopo => { await page.evaluate(e => abrirReajuste(e), escopo); await page.waitForTimeout(100); };
  const aplicar = async () => { await page.click('#rjAplicar'); await page.waitForTimeout(150); };
  const desfazer = async () => { await page.locator('.toast .toast-acao', { hasText: 'Desfazer' }).last().click(); await page.waitForTimeout(100); await page.evaluate(() => document.querySelectorAll('.toast').forEach(e => e.remove())); };
  const original = 'd1:100000 d2:120000 b1:90000 r1:110000 v1:95000 A1:300000';

  await passo('manual, percentual: muda disponíveis, bloqueados e reservados; vendido não; arredonda para a centena', async () => {
    await abrir('L1');
    await page.fill('#rjPct', '3.33'); await page.dispatchEvent('#rjPct', 'input');
    const prev = (await page.locator('#rjPrevia').innerText()).replace(/\s+/g, ' ');
    if (!prev.startsWith('4 itens · de R$') || !(await page.locator('#rjAplicar').innerText()).includes('Atualizar 4 preços')) throw new Error(prev);
    await aplicar();
    if (await precos() !== 'd1:103300 d2:124000 b1:93000 r1:113700 v1:95000 A1:300000') throw new Error(await precos());
  });
  await passo('Desfazer volta os preços', async () => {
    await desfazer();
    if (await precos() !== original) throw new Error(await precos());
  });
  await passo('valor somado a cada lote, só os disponíveis', async () => {
    await abrir('L1');
    await page.selectOption('#rjModo', 'valor'); await page.fill('#rjValor', '1000'); await page.selectOption('#rjStatus', 'disponivel');
    await aplicar();
    if (await precos() !== 'd1:101000 d2:121000 b1:90000 r1:110000 v1:95000 A1:300000') throw new Error(await precos());
    await desfazer();
  });
  await passo('novo preço por m²', async () => {
    await abrir('L1');
    await page.selectOption('#rjModo', 'm2'); await page.fill('#rjM2', '450'); await page.dispatchEvent('#rjM2', 'input');
    await aplicar();
    if (await precos() !== 'd1:112500 d2:135000 b1:90000 r1:112500 v1:95000 A1:300000') throw new Error(await precos());
    await desfazer();
  });
  await passo('índice acumulado: CUB de agosto a setembro (+2,01%); mês sem lançamento trava o botão', async () => {
    await abrir('L1');
    await page.selectOption('#rjModo', 'indice'); await page.fill('#rjDe', '2026-08'); await page.fill('#rjAte', '2026-10'); await page.dispatchEvent('#rjAte', 'input');
    if (!/Falta lançar CUB de out\/26/.test(await page.locator('#rjPrevia').innerText()) || !await page.locator('#rjAplicar').isDisabled()) throw new Error('não travou');
    await page.fill('#rjAte', '2026-09'); await page.dispatchEvent('#rjAte', 'input'); await page.uncheck('#rjArredonda');
    await aplicar();
    if (await precos() !== 'd1:102010 d2:122412 b1:91809 r1:112211 v1:95000 A1:300000') throw new Error(await precos());
    await desfazer();
  });
  await passo('todos os imóveis da empresa: inclui o imóvel avulso não vendido', async () => {
    await abrir('empresa');
    if (await page.inputValue('#rjOnde') !== 'empresa') throw new Error('escopo');
    await page.fill('#rjPct', '10'); await page.dispatchEvent('#rjPct', 'input');
    await aplicar();
    if (await precos() !== 'd1:110000 d2:132000 b1:99000 r1:121000 v1:95000 A1:330000') throw new Error(await precos());
    await desfazer();
  });
  await passo('Imóveis: botão "Atualizar preços" no alto e na barra das selecionadas', async () => {
    await page.evaluate(() => switchTab('emp'));
    const topo = await page.evaluate(() => [...document.querySelectorAll('#av-emp .pg-acoes .btn')].map(b => b.textContent.trim()));
    if (!topo.includes('Atualizar preços')) throw new Error(topo.join());
    await page.evaluate(() => selMarcar('imoveis', 'A1', true));
    await page.locator('#selBarra button', { hasText: 'Atualizar preços' }).click(); await page.waitForTimeout(100);
    if (!/1 imóvel selecionado/.test(await page.locator('#modalBody').innerText())) throw new Error('janela');
    await page.fill('#rjPct', '5'); await page.dispatchEvent('#rjPct', 'input'); await aplicar();
    if (await page.evaluate(() => getLoteamento('A1').preco) !== 315000) throw new Error(await precos());
    await desfazer();
  });

  await passo('mensal por %: ligada no formulário a partir de agosto, entra agosto, setembro e outubro de uma vez', async () => {
    await page.evaluate(() => abrirLoteamentoForm('L1')); await page.waitForTimeout(150);
    await page.click('#lmReajBox > summary'); await page.check('#rmAtivo'); await page.selectOption('#rmModo', 'pct'); await page.fill('#rmPct', '1'); await page.fill('#rmDesde', '2026-08');
    await page.click('#modalFoot .btn-primary'); await page.waitForTimeout(200);
    const r = await page.evaluate(() => ({ cfg: db.config.reajusteAuto.L1, d1: db.lotes.find(l => l.id === 'd1').preco, v1: db.lotes.find(l => l.id === 'v1').preco, n: (state.reajusteRecente || []).length }));
    // 100000 → 101000 → 102000 (102010 arredonda) → 103000 (103020 arredonda)
    if (r.cfg.ultimoMes !== '2026-10' || r.d1 !== 103000 || r.v1 !== 95000 || r.n !== 3) throw new Error(JSON.stringify(r));
  });
  await passo('o Início avisa a atualização com "Desfazer"; desfazer volta os preços e pausa a mensal', async () => {
    await page.evaluate(() => switchTab('painel'));
    const t = (await page.locator('#av-painel .reaj-aviso').innerText()).replace(/\s+/g, ' ');
    if (!t.includes('Preços atualizados sozinhos') || !t.includes('Vista Verde') || !t.includes('ago/26')) throw new Error(t);
    await page.click('#av-painel .reaj-aviso button:has-text("Desfazer")'); await page.waitForTimeout(150);
    const r = await page.evaluate(() => ({ ativo: db.config.reajusteAuto.L1.ativo, d1: db.lotes.find(l => l.id === 'd1').preco, aviso: !!document.querySelector('#av-painel .reaj-aviso') }));
    if (r.ativo !== false || r.d1 !== 100000 || r.aviso) throw new Error(JSON.stringify(r));
    await page.evaluate(() => document.querySelectorAll('.toast').forEach(e => e.remove()));
  });
  await passo('rodar de novo no mesmo mês não aplica outra vez', async () => {
    await page.evaluate(() => { db.config.reajusteAuto = { L1: { ativo: true, modo: 'valor', valor: 500, arredondar: false, desde: '2026-10' } }; state.reajusteRecente = null; aplicarReajustesMensais(true); aplicarReajustesMensais(true); });
    const r = await page.evaluate(() => ({ d1: db.lotes.find(l => l.id === 'd1').preco, ult: db.config.reajusteAuto.L1.ultimoMes }));
    if (r.d1 !== 100500 || r.ult !== '2026-10') throw new Error(JSON.stringify(r));
  });
  await passo('mensal por índice: espera o índice do mês anterior; com ele lançado, aplica', async () => {
    await page.evaluate(() => { db.lotes.forEach(l => { if (l.id === 'd1') l.preco = 100000; }); db.config.reajusteAuto = { L1: { ativo: true, modo: 'indice', indiceId: 'ix-cub', arredondar: false, desde: '2026-10' } }; db.indices[0].valores = { '2026-07': 2800, '2026-08': 2828 }; state.reajusteRecente = null; aplicarReajustesMensais(true); });
    const antes = await page.evaluate(() => ({ d1: db.lotes.find(l => l.id === 'd1').preco, ult: db.config.reajusteAuto.L1.ultimoMes || null }));
    if (antes.d1 !== 100000 || antes.ult) throw new Error('aplicou sem o índice: ' + JSON.stringify(antes));
    await page.evaluate(() => { db.indices[0].valores['2026-09'] = 2856.28; aplicarReajustesMensais(true); });
    const r = await page.evaluate(() => ({ d1: db.lotes.find(l => l.id === 'd1').preco, ult: db.config.reajusteAuto.L1.ultimoMes, txt: db.config.reajusteAuto.L1.ultimo.texto }));
    if (r.d1 !== 101000 || r.ult !== '2026-10' || !/1,00% \(CUB\)/.test(r.txt)) throw new Error(JSON.stringify(r));
  });
  await passo('a tela de lotes mostra a mensal e a próxima data', async () => {
    const t = await page.evaluate(() => resumoReajusteCfg(getLoteamento('L1')));
    if (t !== 'Atualização mensal: CUB · próxima em nov/26') throw new Error(t);
  });
  await browser.close();
  if (erros.length) { console.log('\nERROS:\n' + erros.join('\n')); process.exit(1); }
  console.log('\nTudo certo.');
})();
