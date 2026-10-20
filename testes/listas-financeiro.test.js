// A receber e A pagar no mesmo desenho da lista de contratos: faixa de situação no alto em que o
// número é o filtro (com o valor de cada um), lista contínua com quando vence e o selo só na
// exceção (atrasada / vencida há N dias, vence em até 5 dias), o que é e de quem, o valor e as
// ações. Relógio fixo em 19/10/2026.
// Rodar: BASE=http://127.0.0.1:8765/gestao/ node testes/listas-financeiro.test.js
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/gestao/';
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--disable-gpu'] });
  const erros = [];
  const passo = async (nome, fn) => { try { await fn(); console.log('✔', nome); } catch (e) { console.log('✘', nome, e.message.split('\n')[0]); erros.push(`${nome}: ${e.message.split('\n')[0]}`); } };
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
  await ctx.route(/config\.js/, r => r.fulfill({ contentType: 'application/javascript', body: "window.GL_CONFIG={supabaseUrl:'',supabaseAnonKey:''};" }));
  const page = await ctx.newPage(); page.setDefaultTimeout(8000);
  page.on('pageerror', e => erros.push(`pageerror: ${e.message}`)); page.on('dialog', d => d.accept());
  await page.clock.setFixedTime(new Date('2026-10-19T12:00:00'));
  await page.goto(BASE + 'index.html?dados=exemplo'); await page.waitForFunction(() => window.PiorCaso && db.loteamentos.length); await page.waitForTimeout(300);
  await page.evaluate(() => {
    sessionStorage.setItem('gl_admin', '1'); startRole('admin'); document.querySelectorAll('#devDados,.toast').forEach(e => e.remove());
    const L = db.loteamentos[0].id;
    db.lotes = db.lotes.concat([{ id: 'z1', loteamentoId: L, quadra: 'Z', numero: '1', status: 'vendido', preco: 1, area: 1 }]);
    db.vendas = [{ id: 'vz', numeroContrato: '0007/2026', loteamentoId: L, loteId: 'z1', cliente: { nome: 'Gustavo Lima' }, corretor: { nome: 'C' }, valorTotal: 10000, nParcelas: 4, valorParcela: 1000, dataVenda: '2026-01-01', status: 'ativa' }];
    const r = (id, venc, valor, pago, dataPg, n) => ({ id, vendaId: 'vz', loteamentoId: L, tipo: 'parcela', numero: n, descricao: `Parcela ${n}/4`, vencimento: venc, valor, valorPago: pago || 0, dataPagamento: dataPg || null });
    db.recebiveis = [r('p1', '2026-09-10', 1000, 0, null, 1), r('p2', '2026-10-05', 1000, 1000, '2026-10-04', 2), r('p3', '2026-10-21', 1000, 0, null, 3), r('p4', '2026-10-30', 1000, 400, '2026-10-12', 4)];
    db.custos = [
      { id: 'k1', descricao: 'Contador', categoriaId: 'administrativo', fornecedor: 'Contábil Rio', valor: 900, loteamentoId: null, dataCompetencia: '2026-10-01', vencimento: '2026-10-10', status: 'pendente' },
      { id: 'k2', descricao: 'Topografia', categoriaId: 'projetos', valor: 2500, loteamentoId: L, dataCompetencia: '2026-10-01', vencimento: '2026-10-22', status: 'pendente' },
      { id: 'k3', descricao: 'Aluguel', categoriaId: 'administrativo', valor: 3800, loteamentoId: null, dataCompetencia: '2026-10-01', vencimento: '2026-10-05', status: 'pago', dataPagamento: '2026-10-05' }
    ];
    state.escopo = ''; state.filters.rec = null; state.filters.custos = null;
  });

  await passo('A receber: faixa com Em aberto, A vencer, Atrasadas, Pagas e Todas, cada uma com valor', async () => {
    await page.evaluate(() => switchTab('recebiveis'));
    const f = await page.evaluate(() => [...document.querySelectorAll('#av-recebiveis .st-item')].map(b => b.innerText.replace(/\s+/g, ' ').trim()).join(' | '));
    // outubro: p2 paga; p3 a vencer 1000; p4 parcial (resta 600); p1 atrasada (setembro)
    if (f !== '2 Em aberto R$ 1.600,00 a receber · out/26 | 2 A vencer R$ 1.600,00 a receber · out/26 | 1 Atrasadas R$ 1.000,00 em atraso · todos os meses | 1 Pagas R$ 1.000,00 recebido · out/26 | 3 Todas R$ 3.000,00 no total · out/26') throw new Error(f);
    if (await page.locator('#av-recebiveis .kpi').count()) throw new Error('os cartões antigos continuam');
  });
  await passo('A receber: linha com vencimento e selo, cliente, contrato e parcela, imóvel, valor e ações', async () => {
    const t = await page.evaluate(() => [...document.querySelectorAll('#av-recebiveis .item.linha')].map(x => x.innerText.replace(/\s+/g, ' ').trim()));
    if (t.length !== 2) throw new Error('linhas: ' + t.length);
    for (const s of ['vence 21/10/2026', 'Vence em 2 dias', 'Gustavo Lima', 'Contrato 0007/2026 · Parcela 3/4', 'Quadra Z · Lote 1', 'R$ 1.000,00']) if (!t[0].includes(s)) throw new Error(`faltou "${s}": ${t[0]}`);
    if (!t[1].includes('Pago em parte') || !t[1].includes('pago R$ 400,00') || !t[1].includes('R$ 600,00')) throw new Error('parcial: ' + t[1]);
    if (await page.locator('#av-recebiveis .item.linha button[aria-label="Registrar pagamento"]').count() !== 2) throw new Error('sem o botão de pagar');
  });
  await passo('A receber: o número da faixa filtra; atrasada mostra há quantos dias e o valor atualizado', async () => {
    await page.click('#av-recebiveis .st-item.st-atrasado');
    const t = await page.evaluate(() => [...document.querySelectorAll('#av-recebiveis .item.linha')].map(x => x.innerText.replace(/\s+/g, ' ').trim()));
    if (t.length !== 1 || !t[0].includes('venceu 10/09/2026') || !t[0].includes('Atrasada há 39 dias') || !/atualizado R\$/.test(t[0])) throw new Error(t.join(' | '));
    await page.click('#av-recebiveis .st-item.st-pago');
    const p = await page.evaluate(() => document.querySelector('#av-recebiveis .item.linha').innerText.replace(/\s+/g, ' '));
    if (!p.includes('paga em 04/10/2026') || /Atrasada|Vence/.test(p) || p.includes('Paga ')) throw new Error('paga: ' + p);
  });
  await passo('A pagar: faixa com Todas, A vencer, Vencidas e Pagas; linha com selo, conta, fornecedor e competência', async () => {
    await page.evaluate(() => switchTab('custos'));
    const f = await page.evaluate(() => [...document.querySelectorAll('#av-custos .st-item')].map(b => b.innerText.replace(/\s+/g, ' ').trim()).join(' | '));
    if (f !== '3 Todas R$ 7.200,00 | 1 A vencer R$ 2.500,00 | 1 Vencidas R$ 900,00 | 1 Pagas R$ 3.800,00') throw new Error(f);
    const t = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('#av-custos .item.linha')].map(x => [x.querySelector('.title').textContent.split(' ')[0], x.innerText.replace(/\s+/g, ' ').trim()])));
    if (!t.Contador.includes('venceu 10/10/2026') || !t.Contador.includes('Vencida há 9 dias') || !t.Contador.includes('Contábil Rio') || !t.Contador.includes('competência out/26')) throw new Error(t.Contador);
    if (!t.Topografia.includes('Vence em 3 dias') || !t.Aluguel.includes('paga em 05/10/2026')) throw new Error(JSON.stringify(t));
    await page.click('#av-custos .st-item.st-atrasado');
    const n = await page.evaluate(() => [...document.querySelectorAll('#av-custos .item.linha .title')].map(x => x.textContent.split(' ')[0]).join());
    if (n !== 'Contador') throw new Error('filtro vencidas: ' + n);
    if (!/Total R\$\s7\.200,00 · em aberto R\$\s3\.400,00/.test(await page.locator('#av-custos .ct-resumo').innerText())) throw new Error('resumo');
  });
  await passo('celular: faixa e linhas cabem na tela, sem rolagem lateral', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    const r = await page.evaluate(() => ['recebiveis', 'custos'].map(t => { switchTab(t); return document.documentElement.scrollWidth <= innerWidth && document.querySelector('#av-' + t + ' .st-faixa').getBoundingClientRect().right <= innerWidth; }));
    if (r.join() !== 'true,true') throw new Error(r.join());
  });
  await browser.close();
  if (erros.length) { console.log('\nERROS:\n' + erros.join('\n')); process.exit(1); }
  console.log('\nTudo certo.');
})();
