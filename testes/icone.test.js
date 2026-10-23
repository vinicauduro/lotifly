// Ícone do Lotifly: a aba do navegador mostra a marca (favicon.svg, com PNG de reserva) e o app
// instalado usa os PNGs do manifesto, que precisam ser imagens válidas no tamanho certo.
// Rodar: BASE=http://127.0.0.1:8765/gestao/ node testes/icone.test.js
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/gestao/';
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--disable-gpu'] });
  const erros = [];
  const passo = async (nome, fn) => { try { await fn(); console.log('✔', nome); } catch (e) { console.log('✘', nome, e.message.split('\n')[0]); erros.push(`${nome}: ${e.message.split('\n')[0]}`); } };
  const ctx = await browser.newContext({ serviceWorkers: 'block' });
  await ctx.route(/config\.js/, r => r.fulfill({ contentType: 'application/javascript', body: "window.GL_CONFIG={supabaseUrl:'',supabaseAnonKey:''};" }));
  const page = await ctx.newPage();
  await page.goto(BASE + 'index.html');
  await passo('a página aponta o ícone da aba (SVG) e o PNG de reserva', async () => {
    const r = await page.evaluate(() => [...document.querySelectorAll('link[rel="icon"]')].map(l => l.getAttribute('type') + ':' + l.getAttribute('href')).join());
    if (r !== 'image/svg+xml:favicon.svg,image/png:icon-192.png') throw new Error(r);
  });
  await passo('os arquivos do ícone abrem e têm o tamanho do manifesto', async () => {
    const r = await page.evaluate(async () => {
      const svg = await fetch('favicon.svg').then(x => x.ok ? x.text() : '');
      const tam = src => new Promise(ok => { const i = new Image(); i.onload = () => ok(i.naturalWidth + 'x' + i.naturalHeight); i.onerror = () => ok('erro'); i.src = src + '?t=' + Date.now(); });
      const man = await fetch('manifest.json').then(x => x.json());
      return { svg: /<svg[\s\S]*#0e4c73/.test(svg), svgImg: await tam('favicon.svg'), pngs: await Promise.all(man.icons.map(async i => i.sizes + '=' + await tam(i.src))) };
    });
    if (!r.svg || r.svgImg === 'erro' || r.pngs.join() !== '192x192=192x192,512x512=512x512') throw new Error(JSON.stringify(r));
  });
  await browser.close();
  if (erros.length) { console.log('\nERROS:\n' + erros.join('\n')); process.exit(1); }
  console.log('\nTudo certo.');
})();
