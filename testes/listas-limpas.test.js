// Listas mais limpas: A receber com uma linha só no resumo (de quando são as parcelas e o atalho
// para a carteira; os totais da carteira ficam no Início); Cobrança com o atraso da carteira numa
// linha e o mês numa segunda linha discreta; Clientes sem a contradição de "5 compradores sem
// ficha" ao lado de números zerados e "Nenhum cliente cadastrado".
// Relógio fixo em 19/10/2026.
// Rodar: BASE=http://127.0.0.1:8765/gestao/ node testes/listas-limpas.test.js
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

  await passo('A receber: o resumo diz de quando são as parcelas e leva à carteira, sem repetir os totais', async () => {
    const t = await page.evaluate(() => { state.filters.rec = null; switchTab('recebiveis'); return document.querySelector('#av-recebiveis .ct-resumo').textContent.replace(/\s+/g, ' ').trim(); });
    if (t !== 'Parcelas de out/26; as atrasadas, de todos os meses · ver a carteira inteira') throw new Error(t);
  });
  await passo('Cobrança: o atraso da carteira numa linha; o mês numa segunda linha menor', async () => {
    const r = await page.evaluate(() => { switchTab('cobranca'); const [a, b] = document.querySelectorAll('#av-cobranca .ct-resumo'); return { a: a.textContent.replace(/\s+/g, ' ').trim(), b: b ? b.textContent.replace(/\s+/g, ' ').trim() : '', menor: b ? parseFloat(getComputedStyle(b).fontSize) < parseFloat(getComputedStyle(a).fontSize) : false }; });
    if (!/^Em atraso \(todos os meses\): R\$ [\d.,]+ em 1 contrato · R\$ [\d.,]+ com multa e juros · 1 nunca cobrado$/.test(r.a)) throw new Error(r.a);
    if (!/^Em out\/26: recuperado R\$ .+ · inadimplência .+$/.test(r.b) || !r.menor) throw new Error(JSON.stringify(r));
  });
  await passo('Clientes sem ficha e com compradores nos contratos: a tela é o convite para trazer, sem zeros nem "Nenhum cliente"', async () => {
    const r = await page.evaluate(() => { db.clientes = []; switchTab('clientes'); const v = document.getElementById('av-clientes'); return { t: v.innerText.replace(/\s+/g, ' '), faixa: !!v.querySelector('.st-faixa'), alerta: !!v.querySelector('.alert'), botoes: [...v.querySelectorAll('.btn')].map(b => b.textContent.trim()) }; });
    if (r.faixa || r.alerta || /Nenhum cliente/.test(r.t) || !/5 compradores dos contratos ainda não têm ficha/.test(r.t) || r.botoes.join() !== 'Trazer os 5 compradores,Novo cliente') throw new Error(JSON.stringify(r));
  });
  await passo('trazendo, a lista aparece e o aviso diz no plural certo', async () => {
    await page.click('#av-clientes .btn-primary'); await page.waitForTimeout(200);
    const r = await page.evaluate(() => ({ n: document.querySelectorAll('#av-clientes .item.linha').length, toast: [...document.querySelectorAll('.toast')].map(t => t.textContent).join(' ') }));
    if (r.n !== 5 || !/5 compradores trazidos dos contratos/.test(r.toast)) throw new Error(JSON.stringify(r));
  });
  await browser.close();
  if (erros.length) { console.log('\nERROS:\n' + erros.join('\n')); process.exit(1); }
  console.log('\nTudo certo.');
})();
