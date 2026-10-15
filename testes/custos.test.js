// A pagar: o gráfico "Custos por categoria" desenha a rosca e a legenda, também depois de
// abrir a aba Custos dentro do empreendimento (que deixava uma cópia oculta com os mesmos ids
// e fazia a tela de A pagar ficar em branco). No celular e no computador.
// Rodar: BASE=http://127.0.0.1:8765/lotifly/ node testes/custos.test.js
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/gestao/';
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--disable-gpu'] });
  const erros = [];
  /* Confere o gráfico visível dentro de `sel`: a legenda lista todas as categorias com custo e o
     canvas tem pixels pintados. */
  const conferir = (page, sel) => page.evaluate(sel => {
    const raiz = document.querySelector(sel);
    const cv = raiz && raiz.querySelector('canvas.chart'), lg = raiz && raiz.querySelector('.legend-list');
    if (!cv || !lg) return 'gráfico não encontrado em ' + sel;
    if (!cv.offsetParent) return 'gráfico oculto em ' + sel;
    const escopo = state.tab === 'custos' ? escopoAtual() : curLot().id;
    const esperadas = [...new Set(custosDo(escopo).map(c => { const k = getCategoria(c.categoriaId); return k ? k.nome : 'Sem categoria'; }))].sort();
    const naLegenda = [...lg.children].map(d => d.firstChild.nextSibling.textContent.trim()).sort();
    if (!esperadas.length) return 'sem custos nos dados de exemplo';
    if (JSON.stringify(naLegenda) !== JSON.stringify(esperadas)) return `legenda: [${naLegenda.join(', ')}], esperado [${esperadas.join(', ')}]`;
    const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let pintados = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i]) pintados++;
    if (pintados < 1000) return `canvas em branco (${pintados} pixels pintados, ${cv.width}×${cv.height})`;
    return '';
  }, sel);
  for (const w of [390, 1440]) {
    const passo = async (nome, fn) => { try { await fn(); console.log('✔', w, nome); } catch (e) { console.log('✘', w, nome, e.message.split('\n')[0]); erros.push(`${w} ${nome}: ${e.message.split('\n')[0]}`); } };
    const ctx = await browser.newContext({ viewport: { width: w, height: w < 700 ? 844 : 900 }, serviceWorkers: 'block' });
    await ctx.route(/config\.js/, r => r.fulfill({ contentType: 'application/javascript', body: "window.GL_CONFIG={supabaseUrl:'',supabaseAnonKey:''};" }));
    const page = await ctx.newPage(); page.setDefaultTimeout(8000);
    page.on('pageerror', e => erros.push(`${w} pageerror: ${e.message}`)); page.on('dialog', d => d.accept());
    await page.goto(BASE + 'index.html?dados=exemplo'); await page.waitForFunction(() => window.PiorCaso && db.loteamentos.length); await page.waitForTimeout(300);
    await page.evaluate(() => { document.querySelectorAll('#devDados,.toast').forEach(e => e.remove()); sessionStorage.setItem('gl_admin', '1'); startRole('admin'); });
    const tela = async (fn, sel) => { await page.evaluate(fn); await page.waitForTimeout(300); const r = await conferir(page, sel); if (r) throw new Error(r); };

    await passo('A pagar desenha a rosca e a legenda', () => tela(() => switchTab('custos'), '#av-custos'));
    await passo('Custos do empreendimento desenha a rosca e a legenda', () => tela(() => abrirEmpreendimento(db.loteamentos[0].id, 'custos'), '#empConteudo'));
    await passo('A pagar depois de abrir os custos do empreendimento', () => tela(() => switchTab('custos'), '#av-custos'));
    await passo('A pagar filtrado por um empreendimento', () => tela(() => { state.escopo = db.loteamentos[0].id; renderCustos(); }, '#av-custos'));
    await ctx.close();
  }
  console.log(erros.length ? '\nERROS:\n' + erros.join('\n') : '\ntudo ok');
  await browser.close(); process.exit(erros.length ? 1 : 0);
})();
