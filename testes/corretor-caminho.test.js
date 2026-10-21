// Caminho do corretor no celular: da planta, "Enviar tabela de preços" a um toque; os contadores
// da planta abrem a lista já filtrada; a lista abre em Disponíveis; na ficha do lote o resultado
// do simulador vem antes dos campos e não há selo repetido; a área do lote some na planta quando
// ficaria ilegível e volta ao aproximar.
// Rodar: BASE=http://127.0.0.1:8765/gestao/ node testes/corretor-caminho.test.js
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/gestao/';
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--disable-gpu'] });
  const erros = [];
  const passo = async (nome, fn) => { try { await fn(); console.log('✔', nome); } catch (e) { console.log('✘', nome, e.message.split('\n')[0]); erros.push(`${nome}: ${e.message.split('\n')[0]}`); } };
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', hasTouch: true, isMobile: true });
  await ctx.route(/config\.js/, r => r.fulfill({ contentType: 'application/javascript', body: "window.GL_CONFIG={supabaseUrl:'',supabaseAnonKey:''};" }));
  const page = await ctx.newPage(); page.setDefaultTimeout(8000);
  page.on('pageerror', e => erros.push(`pageerror: ${e.message}`));
  await page.goto(BASE + 'index.html?dados=exemplo'); await page.waitForFunction(() => window.PiorCaso && db.loteamentos.length); await page.waitForTimeout(300);
  await page.evaluate(() => { prefs.corretor = null; prefs.cModo = 'esquema'; savePrefs(); startRole('corretor'); document.querySelectorAll('#devDados,.toast').forEach(e => e.remove()); state.filters.clotes = null; switchTab('planta'); });
  await page.waitForTimeout(300);

  await passo('planta: "Enviar tabela de preços" logo abaixo dos contadores, visível sem rolar', async () => {
    const b = page.locator('#cv-planta .c-enviar-tabela');
    const box = await b.boundingBox();
    if (!box || box.y + box.height > 844) throw new Error('fora da primeira tela: ' + JSON.stringify(box));
    await b.click(); await page.waitForTimeout(300);
    if (!/Tabela de preços/i.test(await page.locator('#modalTitle').innerText())) throw new Error('não abriu a tabela');
    await page.evaluate(() => closeModal());
  });
  await passo('tocar em "disponíveis" na planta abre a lista só com os disponíveis', async () => {
    const n = await page.evaluate(() => lotesDo(curLot().id).filter(l => l.status === 'disponivel').length);
    await page.click('#cv-planta .status-strip .pill:has-text("disponíveis")'); await page.waitForTimeout(200);
    const r = await page.evaluate(() => ({ tab: state.tab, itens: document.querySelectorAll('#cv-lotes .item').length, outros: document.querySelectorAll('#cv-lotes .item:not(.disponivel)').length }));
    if (r.tab !== 'lotes' || r.itens !== n || r.outros) throw new Error(JSON.stringify(r) + ' esperado ' + n);
  });
  await passo('a lista de lotes abre em Disponíveis', async () => {
    const ativo = await page.evaluate(() => { state.filters.clotes = null; switchTab('lotes'); return document.querySelector('#cv-lotes .chip.active').textContent.replace(/\d+$/, '').trim(); });
    if (ativo !== 'Disponíveis') throw new Error(ativo);
  });
  await passo('ficha do lote: resultado do simulador antes dos campos e sem o selo repetido ao lado do preço', async () => {
    await page.click('#cv-lotes .item.disponivel >> nth=0'); await page.waitForTimeout(400);
    const r = await page.evaluate(() => {
      const res = document.getElementById('simResult'), ent = document.getElementById('simEntrada');
      return { antes: !!(res.compareDocumentPosition(ent) & Node.DOCUMENT_POSITION_FOLLOWING), texto: res.textContent.trim().length, selos: document.querySelectorAll('#modalBody .badge.disponivel').length };
    });
    if (!r.antes || !r.texto || r.selos) throw new Error(JSON.stringify(r));
    const prim = await page.evaluate(() => [...document.querySelectorAll('#modalFoot .btn')].map(b => b.className.match(/btn-(primary|wa|secondary|outline)/)[1] + ':' + b.textContent.trim()).join());
    if (prim !== 'secondary:Compartilhar,outline:Proposta,primary:Solicitar reserva') throw new Error(prim);
    await page.evaluate(() => closeModal());
  });
  await passo('planta: a área some com a planta inteira no celular e volta ao aproximar', async () => {
    await page.evaluate(() => switchTab('planta')); await page.waitForTimeout(300);
    const longe = await page.evaluate(() => { state.plantaCorretor.resetView(); return document.querySelector('#cPlantaBox svg').classList.contains('area-miuda'); });
    const perto = await page.evaluate(() => { const pv = state.plantaCorretor; pv.zoomBy(2.5); return document.querySelector('#cPlantaBox svg').classList.contains('area-miuda'); });
    if (longe !== true || perto !== false) throw new Error(`longe=${longe} perto=${perto}`);
  });
  await browser.close();
  if (erros.length) { console.log('\nERROS:\n' + erros.join('\n')); process.exit(1); }
  console.log('\nTudo certo.');
})();
