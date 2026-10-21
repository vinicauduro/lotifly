// Acabamento: plural de verdade no lugar do "(s)", o item do menu marcado como página atual para
// leitor de tela, o contrato que diz "em atraso desde" em vez de "próxima" com data passada e o
// selo "Ativo" (contrato é masculino), e o foco do teclado num anel sólido. Relógio em 19/10/2026.
// Rodar: BASE=http://127.0.0.1:8765/gestao/ node testes/acabamento.test.js
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
  await page.evaluate(() => { sessionStorage.setItem('gl_admin', '1'); startRole('admin'); document.querySelectorAll('#devDados,.toast').forEach(e => e.remove()); });

  await passo('plural de verdade: "1 parcela", "2 parcelas"; Início e listas sem "(s)"', async () => {
    const r = await page.evaluate(() => [nPlural(1, 'parcela'), nPlural(2, 'parcela'), nPlural(0, 'conta')].join('|'));
    if (r !== '1 parcela|2 parcelas|0 contas') throw new Error(r);
    const com = await page.evaluate(() => ['painel', 'recebiveis', 'custos', 'cobranca', 'vendas', 'reservas'].filter(t => { switchTab(t); return /\w\(s\)/.test(document.getElementById('av-' + t).innerText); }));
    if (com.length) throw new Error('ainda com "(s)": ' + com.join());
  });
  await passo('o item do menu da tela aberta é a página atual para o leitor de tela', async () => {
    const r = await page.evaluate(() => { switchTab('cobranca'); return [...document.querySelectorAll('#screen-admin .tab[aria-current="page"]')].map(t => t.dataset.tab).join(); });
    if (r !== 'cobranca') throw new Error(r);
  });
  await passo('contrato atrasado diz "em atraso desde"; o selo é "Ativo"', async () => {
    const r = await page.evaluate(() => {
      const x = db.vendas.find(v => v.status === 'ativa' && recebiveisDe(v.id).some(p => recRestante(p) > 0.005 && p.vencimento < todayStr()));
      abrirContrato(x.id, 'resumo');
      const t = document.querySelector('.ct-cab').innerText.replace(/\s+/g, ' ');
      return { atraso: /em atraso desde \d\d\/\d\d\/\d{4}/.test(t), proximaPassada: /próxima: (\d\d)\/(\d\d)\/(\d{4})/.test(t) && (() => { const m = t.match(/próxima: (\d\d)\/(\d\d)\/(\d{4})/); return `${m[3]}-${m[2]}-${m[1]}` < todayStr(); })(), selo: document.querySelector('.ct-cab .ct-num .badge').textContent };
    });
    if (!r.atraso || r.proximaPassada || r.selo !== 'Ativo') throw new Error(JSON.stringify(r));
  });
  await passo('foco do teclado: anel sólido de 2 px na cor da marca', async () => {
    await page.evaluate(() => switchTab('recebiveis'));
    await page.focus('#av-recebiveis .st-item'); await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab');
    const o = await page.evaluate(() => { const s = getComputedStyle(document.activeElement); return [s.outlineStyle, s.outlineWidth].join(' '); });
    if (o !== 'solid 2px') throw new Error(o);
  });
  await browser.close();
  if (erros.length) { console.log('\nERROS:\n' + erros.join('\n')); process.exit(1); }
  console.log('\nTudo certo.');
})();
