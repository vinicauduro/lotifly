// A cara do cliente: logo da empresa (Configurações › Dados da empresa) e logo do empreendimento
// (no cadastro dele). A da empresa aparece no topo do app, no alto e no fim das impressões, nos
// recibos e como marca d'água no contrato; a do empreendimento ao lado do nome, na lista de
// Imóveis, no canto da tabela de preços e no relatório dele. Relógio fixo em 19/10/2026.
// Rodar: BASE=http://127.0.0.1:8765/gestao/ node testes/logos.test.js
const path = require('path');
const { chromium } = require('playwright');
const { responderConfirmacoes } = require('./confirmacoes');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/gestao/';
const LOGO = path.join(__dirname, '..', 'icon-512.png');
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
    window.print = () => { window.__impresso = document.getElementById('printArea').innerHTML; };
    db.config.logoEmpresa = ''; db.loteamentos.forEach(l => { delete l.logo; });
  });
  const L = await page.evaluate(() => db.loteamentos.find(l => !ehCarteira(l)).id);

  await passo('Configurações › Dados da empresa: enviar a logo salva na hora, reduzida, e ela aparece no topo', async () => {
    await page.evaluate(() => { state.sub.cad = 'empresa'; switchTab('cadastros'); });
    await page.setInputFiles('#cfgLogoArq', LOGO); await page.waitForTimeout(400);
    const r = await page.evaluate(() => new Promise(ok => { const u = db.config.logoEmpresa || ''; const i = new Image(); i.onload = () => ok({ png: u.startsWith('data:image/png'), w: i.naturalWidth, topo: !document.querySelector('#screen-admin .brand-logo').hidden && document.querySelector('#screen-admin .brand-logo').getAttribute('src') === u }); i.onerror = () => ok({ erro: true }); i.src = u; }));
    if (!r.png || r.w > 480 || !r.topo) throw new Error(JSON.stringify(r));
  });
  await passo('cadastro do empreendimento: logo enviada e salva junto; aparece ao lado do nome e na lista de Imóveis', async () => {
    await page.evaluate(id => abrirLoteamentoForm(id), L); await page.waitForTimeout(150);
    await page.setInputFiles('#lmLogoArq', LOGO); await page.waitForTimeout(400);
    if (!await page.locator('#lmLogoPrev img').count()) throw new Error('sem prévia');
    await page.click('#modalFoot .btn-primary'); await page.waitForTimeout(200);
    const r = await page.evaluate(id => { const l = getLoteamento(id); state.empAberto = id; state.empSub = 'resumo'; switchTab('emp'); const cab = document.querySelector('#av-emp .emp-cab'); return { logo: (l.logo || '').startsWith('data:image/'), cab: !!(cab && cab.querySelector('.emp-logo') && cab.textContent.includes(l.nome)) }; }, L);
    if (!r.logo || !r.cab) throw new Error(JSON.stringify(r));
    const mini = await page.evaluate(() => { fecharEmpreendimento(); return document.querySelectorAll('#av-emp .emp-logo-mini').length; });
    if (mini !== 1) throw new Error('lista: ' + mini);
  });
  await passo('trocar a logo sem mexer não apaga; "Remover" tira', async () => {
    await page.evaluate(id => abrirLoteamentoForm(id), L); await page.waitForTimeout(150);
    await page.click('#modalFoot .btn-primary'); await page.waitForTimeout(150);
    if (!(await page.evaluate(id => !!getLoteamento(id).logo, L))) throw new Error('salvar sem mexer apagou a logo');
    const outro = await page.evaluate(() => (db.loteamentos.find(l => ehCarteira(l)) || {}).id);
    if (outro) {
      await page.evaluate(id => { getLoteamento(id).logo = 'data:image/png;base64,iVBORw0KGgo='; abrirLoteamentoForm(id); }, outro); await page.waitForTimeout(150);
      await page.click('#lmLogoRem'); await page.click('#modalFoot .btn-primary'); await page.waitForTimeout(150);
      if (await page.evaluate(id => getLoteamento(id).logo, outro) !== '') throw new Error('não removeu');
    }
  });
  await passo('tabela de preços em PDF: logo do empreendimento no canto e a da empresa no fim', async () => {
    const r = await page.evaluate(async id => {
      const { jsPDF } = await libTabela(); const orig = jsPDF.API.addImage; const vistos = [];
      jsPDF.API.addImage = function (url, fmt, x, y, w, h) { vistos.push({ emp: url === getLoteamento(id).logo, x: Math.round(x), y: Math.round(y) }); return orig.apply(this, arguments); };
      try { const blob = await gerarTabelaPDF(dadosTabela(id, false)); return { vistos, tam: blob.size }; } finally { jsPDF.API.addImage = orig; }
    }, L);
    const canto = r.vistos.find(v => v.emp && v.y < 10 && v.x < 20), fim = r.vistos.find(v => v.y > 30);
    if (!canto || !fim || !(r.tam > 1000)) throw new Error(JSON.stringify(r));
  });
  await passo('relatório da empresa: logo da empresa no alto e no fim; do empreendimento: a dele no alto', async () => {
    const r = await page.evaluate(id => {
      Object.assign(relState(), { tipo: 'resumo' }); state.escopo = ''; switchTab('relatorios'); imprimirRelatorio();
      const a = document.createElement('div'); a.innerHTML = window.__impresso;
      const topoEmp = a.querySelector('.print-logo-topo img').getAttribute('src') === db.config.logoEmpresa, rodape = !!a.querySelector('.print-logo-rodape img');
      state.escopo = id; renderCurrent(); imprimirRelatorio(); a.innerHTML = window.__impresso;
      return { topoEmp, rodape, topoLot: a.querySelector('.print-logo-topo img').getAttribute('src') === getLoteamento(id).logo };
    }, L);
    if (!r.topoEmp || !r.rodape || !r.topoLot) throw new Error(JSON.stringify(r));
  });
  await passo('recibo sai com a logo da empresa no alto', async () => {
    const r = await page.evaluate(() => { state.escopo = ''; const rec = db.recebiveis.find(x => num(x.valorPago) > 0); gerarRecibo(rec.id); return !!document.querySelector('#docFolha .doc-logo img'); });
    if (!r) throw new Error('sem logo no recibo');
    await page.evaluate(() => closeModal());
  });
  await passo('contrato: a logo da empresa vira marca d\'água (na prévia e em todas as páginas impressas)', async () => {
    const r = await page.evaluate(() => {
      const v = db.vendas.find(x => x.status !== 'distrato'); gerarContratoVenda(v.id); gerarContratoConfirma(v.id);
      const prev = !!document.querySelector('.doc-folha-wrap .doc-marca-prev'), topo = !!document.querySelector('#docFolha .doc-logo');
      docImprimir('x'); const a = document.createElement('div'); a.innerHTML = window.__impresso;
      return { prev, topo, agua: !!a.querySelector('.print-marca-dagua') };
    });
    if (!r.prev || r.topo || !r.agua) throw new Error(JSON.stringify(r));
    await page.evaluate(() => closeModal());
  });
  await passo('sem logo cadastrada, nada muda: sem imagem vazia no topo nem na impressão', async () => {
    const r = await page.evaluate(() => { db.config.logoEmpresa = ''; db.loteamentos.forEach(l => { delete l.logo; }); state.escopo = ''; renderCurrent(); imprimirRelatorio(); return { topo: !document.querySelector('#screen-admin .brand-logo').hidden, imp: /<img/.test(window.__impresso) }; });
    if (r.topo || r.imp) throw new Error(JSON.stringify(r));
  });
  await passo('celular: o topo com a logo cabe na largura', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    const r = await page.evaluate(() => { db.config.logoEmpresa = db.config.logoEmpresa || 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='; switchTab('painel'); return document.documentElement.scrollWidth <= innerWidth; });
    if (!r) throw new Error('rolagem lateral');
  });
  await browser.close();
  if (erros.length) { console.log('\nERROS:\n' + erros.join('\n')); process.exit(1); }
  console.log('\nTudo certo.');
})();
