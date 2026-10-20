// Início: aviso só para o que não aparece em outro lugar da tela. Atraso (cartão "Em atraso" e
// número da Cobrança no menu), conta vencida (número do A pagar) e reserva a aprovar (número de
// Reservas) não viram faixa; reserva vencida e reserva vencendo, sim. "Tudo em dia" só quando
// não há nada pendente. Relógio fixo em 19/10/2026.
// Rodar: BASE=http://127.0.0.1:8765/gestao/ node testes/inicio-avisos.test.js
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
  await page.clock.setFixedTime(new Date('2026-10-19T12:00:00'));
  await page.goto(BASE + 'index.html?dados=exemplo'); await page.waitForFunction(() => window.PiorCaso && db.loteamentos.length); await page.waitForTimeout(300);
  await page.evaluate(() => {
    sessionStorage.setItem('gl_admin', '1'); startRole('admin'); document.querySelectorAll('#devDados,.toast').forEach(e => e.remove());
    const L = db.loteamentos[0].id;
    const res = (id, status, validade) => ({ id, loteamentoId: L, loteId: db.lotes[0].id, status, validade, dataReserva: '2026-10-10', criadoEm: id, cliente: { nome: 'X' }, corretor: { nome: 'C' } });
    db.reservas = [res('r1', 'pendente', '2026-10-25'), res('r2', 'aprovada', '2026-10-15'), res('r3', 'aprovada', '2026-10-14'), res('r4', 'aprovada', '2026-10-20')];
    db.custos = [{ id: 'k1', descricao: 'Contador', categoriaId: 'administrativo', valor: 900, loteamentoId: null, dataCompetencia: '2026-10-01', vencimento: '2026-10-10', status: 'pendente' }];
  });
  const avisos = () => page.evaluate(() => { switchTab('painel'); return [...document.querySelectorAll('#av-painel > .alert')].map(a => a.textContent.replace(/\s+/g, ' ').trim()); });

  await passo('o que já está no cartão ou no menu não vira faixa; reserva vencida e vencendo ficam, no plural certo', async () => {
    const a = await avisos();
    if (a.join(' | ') !== '2 reservas vencidas — libere o lote ou renove | 1 reserva vence em até 2 dias') throw new Error(a.join(' | '));
    const menu = await page.evaluate(() => ['aBadgeReservas', 'aBadgeCobranca', 'aBadgeCustos'].map(id => document.getElementById(id).style.display !== 'none').join());
    if (menu !== 'true,true,true') throw new Error('menu: ' + menu);
    if (!/Em atraso/.test(await page.locator('#av-painel .kpi.c-red').innerText())) throw new Error('cartão de atraso sumiu');
  });
  await passo('quem não vê o número de Reservas no menu recebe o aviso da reserva a aprovar', async () => {
    const a = await page.evaluate(() => { const orig = window.pode; window.pode = c => c !== 'reservas.aprovar' && orig(c); switchTab('painel'); const t = document.querySelector('#av-painel > .alert').textContent.trim(); window.pode = orig; return t; });
    if (a !== '1 reserva aguardando aprovação') throw new Error(a);
  });
  await passo('"Tudo em dia" só quando nada está pendente', async () => {
    await page.evaluate(() => { db.reservas = []; });
    let a = await avisos();
    if (a.length) throw new Error('com atraso e conta vencida não pode dizer "tudo em dia": ' + a.join(' | '));
    await page.evaluate(() => { db.custos = []; db.recebiveis.forEach(r => { if (r.vencimento < todayStr()) { r.valorPago = recValor(r); r.dataPagamento = r.vencimento; } }); });
    a = await avisos();
    if (a.join() !== 'Tudo em dia.') throw new Error(a.join(' | '));
  });
  await browser.close();
  if (erros.length) { console.log('\nERROS:\n' + erros.join('\n')); process.exit(1); }
  console.log('\nTudo certo.');
})();
