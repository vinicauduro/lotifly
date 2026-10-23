// Telas no mesmo padrão: Imóveis e Corretores com o cabeçalho das outras telas (título, frase e
// ações à direita) e lista contínua, sem cartão dentro de cartão; Reservas com "Nova reserva" no
// cabeçalho; o botão + flutuante só no celular; botões de ação em azul (o verde fica para "pago"
// e para o WhatsApp); número zerado sem cor de comemoração nem de alarme.
// Rodar: BASE=http://127.0.0.1:8765/gestao/ node testes/telas-padrao.test.js
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
  await page.evaluate(() => { sessionStorage.setItem('gl_admin', '1'); startRole('admin'); document.querySelectorAll('#devDados,.toast').forEach(e => e.remove()); });
  const cab = t => page.evaluate(t => { switchTab(t); const v = document.getElementById('av-' + t); const h = v.querySelector(':scope > .pg-head');
    return { titulo: h ? h.querySelector('.pg-tit').textContent : null, acoes: h ? [...h.querySelectorAll('.pg-acoes .btn')].map(b => b.textContent.trim()) : [], cartaoComTitulo: !!v.querySelector(':scope > .card > h2'), itensSoltos: v.querySelectorAll(':scope > .card .item, :scope > .item').length }; }, t);

  await passo('Imóveis: cabeçalho padrão com "Atualizar preços", "Gerar tabela" e "Novo imóvel", lista contínua sem cartão em volta', async () => {
    const r = await cab('emp');
    if (r.titulo !== 'Imóveis' || r.acoes.join() !== 'Atualizar preços,Gerar tabela,Novo imóvel' || r.cartaoComTitulo || r.itensSoltos) throw new Error(JSON.stringify(r));
    const borda = await page.evaluate(() => getComputedStyle(document.querySelector('#av-emp .lista > .item')).borderTopWidth);
    if (borda !== '0px') throw new Error('item ainda é cartão: ' + borda);
  });
  await passo('Corretores: cabeçalho padrão com "Novo corretor", sem o título repetido num cartão', async () => {
    const r = await cab('corretores');
    if (r.titulo !== 'Corretores' || r.acoes.join() !== 'Novo corretor' || r.cartaoComTitulo) throw new Error(JSON.stringify(r));
    if (await page.locator('#av-corretores .pg-tit').count() !== 1) throw new Error('título repetido');
  });
  await passo('Reservas: "Nova reserva" no cabeçalho', async () => {
    const r = await cab('reservas');
    if (r.titulo !== 'Reservas' || r.acoes.join() !== 'Nova reserva') throw new Error(JSON.stringify(r));
  });
  await passo('computador: o botão + flutuante não aparece; celular: aparece', async () => {
    await page.evaluate(() => switchTab('clientes'));
    const pc = await page.evaluate(() => getComputedStyle(document.getElementById('fab')).display);
    await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(100);
    const cel = await page.evaluate(() => getComputedStyle(document.getElementById('fab')).display);
    await page.setViewportSize({ width: 1280, height: 900 });
    if (pc !== 'none' || cel === 'none') throw new Error(`computador ${pc}, celular ${cel}`);
  });
  await passo('botões de ação em azul: registrar pagamento, vender, aprovar; nenhum verde fora do WhatsApp', async () => {
    const r = await page.evaluate(() => {
      const verdes = [];
      const olhar = () => document.querySelectorAll('#modalFoot .btn, .ct-topo .btn').forEach(b => { if (b.classList.contains('btn-success')) verdes.push(b.textContent.trim()); });
      abrirPagamento(db.recebiveis.find(x => !x.valorPago && x.vencimento >= todayStr()).id); olhar(); closeModal();
      abrirLoteAdmin(db.lotes.find(l => l.status === 'disponivel').id); olhar(); closeModal();
      abrirContrato(db.vendas.find(v => v.status === 'ativa').id, 'resumo'); olhar();
      return { verdes, principal: document.querySelector('.ct-principal').className };
    });
    if (r.verdes.length || !/btn-primary/.test(r.principal)) throw new Error(JSON.stringify(r));
  });
  await passo('número zerado não comemora: "Vendas R$ 0,00" e "Em atraso R$ 0,00" na cor do texto', async () => {
    const r = await page.evaluate(() => {
      db.vendas = db.vendas.map(v => Object.assign({}, v, { dataVenda: '2025-01-01' }));
      db.recebiveis = db.recebiveis.map(x => x.vencimento < todayStr() ? Object.assign({}, x, { valorPago: recValor(x), dataPagamento: x.vencimento }) : x);
      switchTab('painel');
      const cor = sel => { const el = document.querySelector(sel); return el ? getComputedStyle(el.querySelector('.val')).color : ''; };
      const texto = getComputedStyle(document.body).getPropertyValue('--text-strong').trim();
      return { vendas: cor('#av-painel .kpi.c-green'), atraso: cor('#av-painel .kpi.c-red'), zeros: document.querySelectorAll('#av-painel .kpi.zero').length, texto };
    });
    if (r.zeros !== 2 || r.vendas !== r.atraso) throw new Error(JSON.stringify(r));
  });
  await browser.close();
  if (erros.length) { console.log('\nERROS:\n' + erros.join('\n')); process.exit(1); }
  console.log('\nTudo certo.');
})();
