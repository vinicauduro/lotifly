// Configurações em quatro grupos (Empresa, Equipe, Financeiro, Sistema), cada um com no máximo
// quatro telas; e, no celular, os filtros do A pagar atrás do botão "Filtros (n)".
// Rodar: BASE=http://127.0.0.1:8765/gestao/ node testes/config-filtros.test.js
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
  await page.evaluate(() => { sessionStorage.setItem('gl_admin', '1'); startRole('admin'); document.querySelectorAll('#devDados,.toast').forEach(e => e.remove()); state.sub.cad = null; });
  const telas = () => page.evaluate(() => ({ grupos: [...document.querySelectorAll('#av-cadastros .cfg-grupo')].map(b => b.textContent + (b.classList.contains('active') ? '*' : '')).join(), sub: [...document.querySelectorAll('#av-cadastros .cfg-telas .chip')].map(c => c.textContent + (c.classList.contains('active') ? '*' : '')).join() }));

  await passo('Configurações abre com os quatro grupos e as telas do grupo escolhido (no máximo quatro)', async () => {
    await page.evaluate(() => switchTab('cadastros'));
    const t = await telas();
    if (t.grupos !== 'Empresa*,Equipe,Financeiro,Sistema') throw new Error(t.grupos);
    if (t.sub !== 'Dados da empresa*,Modelos de documento,Geral') throw new Error(t.sub);
  });
  await passo('trocar de grupo abre a primeira tela dele; cada tela continua alcançável', async () => {
    await page.click('#av-cadastros .cfg-grupo:has-text("Financeiro")');
    let t = await telas();
    if (t.sub !== 'Plano de contas*,Centros de custo,Contas bancárias,Régua de cobrança') throw new Error(t.sub);
    await page.click('#av-cadastros .cfg-grupo:has-text("Sistema")');
    t = await telas();
    if (!/^Nuvem\*,Backup/.test(t.sub)) throw new Error(t.sub);
    const todas = await page.evaluate(() => ['empresa', 'documentos', 'config', 'permissoes', 'categorias', 'centros', 'banco', 'cobranca', 'nuvem', 'backup'].map(k => { state.sub.cad = k; renderCurrent(); return state.sub.cad === k && document.querySelector('#av-cadastros .cfg-grupo.active') ? '' : k; }).filter(Boolean).join());
    if (todas) throw new Error('não abriu: ' + todas);
  });
  await passo('grupo com uma tela só não mostra a segunda linha', async () => {
    await page.evaluate(() => { state.sub.cad = 'permissoes'; renderCurrent(); });
    const t = await telas();
    if (!t.grupos.includes('Equipe*') || t.sub) throw new Error(JSON.stringify(t));
  });
  await passo('no computador, os filtros do A pagar ficam à vista e o botão "Filtros" some', async () => {
    await page.evaluate(() => { state.filters.custos = null; switchTab('custos'); });
    if (!(await page.locator('#custosFiltros').isVisible()) || await page.locator('#av-custos .filtros-btn').isVisible()) throw new Error('desktop');
  });
  await passo('no celular, os filtros ficam atrás de "Filtros", que diz quantos estão ligados', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => { state.filters.custos = null; renderCustos(); });
    if (await page.locator('#custosFiltros').isVisible()) throw new Error('filtros abertos de saída');
    const b = page.locator('#av-custos .filtros-btn');
    if ((await b.innerText()).trim() !== 'Filtros' || await b.getAttribute('aria-expanded') !== 'false') throw new Error(await b.innerText());
    await b.click();
    if (!(await page.locator('#custosFiltros').isVisible())) throw new Error('não abriu');
    await page.selectOption('#custosFiltros select[aria-label="Mês"]', { index: 1 });
    await page.click('#custosFiltros .chips-vinc .chip:has-text("Só da empresa")');
    const txt = (await page.locator('#av-custos .filtros-btn').innerText()).trim();
    if (txt !== 'Filtros (2)' || !(await page.locator('#custosFiltros').isVisible())) throw new Error(txt);
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error('rolagem lateral');
  });
  await browser.close();
  if (erros.length) { console.log('\nERROS:\n' + erros.join('\n')); process.exit(1); }
  console.log('\nTudo certo.');
})();
