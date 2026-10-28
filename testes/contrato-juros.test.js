// Contrato e proposta com e sem juros: sem juros, o trecho dos juros some (antes saía "incidem
// juros de sem juros") e entra "O saldo parcelado não tem juros."; com juros, sai a taxa.
// Relógio fixo em 19/10/2026. Rodar: BASE=http://127.0.0.1:8765/gestao/ node testes/contrato-juros.test.js
const { chromium } = require('playwright');
const { responderConfirmacoes } = require('./confirmacoes');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/gestao/';
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
  await page.evaluate(() => { sessionStorage.setItem('gl_admin', '1'); startRole('admin'); document.querySelectorAll('#devDados,.toast').forEach(e => e.remove()); });
  const contrato = juros => page.evaluate(j => {
    const v = db.vendas.find(x => x.status !== 'distrato' && num(x.nParcelas) > 0); v.jurosMes = j;
    gerarContratoVenda(v.id); gerarContratoConfirma(v.id);
    const t = document.getElementById('docFolha').innerText; closeModal(); return t;
  }, juros);

  await passo('contrato sem juros: não diz "juros de sem juros" e diz que o saldo não tem juros', async () => {
    const t = await contrato(0);
    if (/juros de sem juros/i.test(t) || /incidem juros/i.test(t)) throw new Error('ainda fala em incidir juros');
    if (!/O saldo parcelado não tem juros\./.test(t)) throw new Error('faltou a frase sem juros');
  });
  await passo('contrato com 0,80% ao mês: diz a taxa e não a frase de sem juros', async () => {
    const t = await contrato(0.8);
    if (!/incidem juros de 0,80% ao mês\./.test(t)) throw new Error('faltou a taxa');
    if (/não tem juros/.test(t)) throw new Error('frase de sem juros apareceu com juros');
  });
  await passo('modelo antigo salvo pelo cliente (só com pagamento.juros) não fica com texto errado sem juros', async () => {
    const t = await page.evaluate(() => {
      const v = db.vendas.find(x => x.status !== 'distrato' && num(x.nParcelas) > 0); v.jurosMes = 0;
      return docPreencher('Preço pago assim. {{#se pagamento.juros}}Sobre o saldo parcelado incidem juros de {{pagamento.juros}}.{{/se}}Fim.', docContexto({ venda: v, pagamento: { valorTotal: v.valorTotal, nParcelas: v.nParcelas, jurosMes: 0 } }));
    });
    if (t !== 'Preço pago assim. Fim.') throw new Error(t);
  });
  await passo('proposta: sem juros diz "Parcelamento sem juros."; com juros, a taxa', async () => {
    const r = await page.evaluate(() => {
      const v = db.vendas.find(x => x.status !== 'distrato' && num(x.nParcelas) > 0);
      const pg = j => ({ valorTotal: v.valorTotal, entrada: v.entrada, nParcelas: v.nParcelas, valorParcela: v.valorParcela, jurosMes: j });
      const a = docPreencher(MODELO_PROPOSTA, docContexto({ venda: v, pagamento: pg(0) }));
      const b = docPreencher(MODELO_PROPOSTA, docContexto({ venda: v, pagamento: pg(0.8) }));
      return { a: /Parcelamento sem juros\./.test(a) && !/Juros do parcelamento/.test(a), b: /Juros do parcelamento: 0,80% ao mês\./.test(b) && !/sem juros\./.test(b) };
    });
    if (!r.a || !r.b) throw new Error(JSON.stringify(r));
  });
  await browser.close();
  if (erros.length) { console.log('\nERROS:\n' + erros.join('\n')); process.exit(1); }
  console.log('\nTudo certo.');
})();
