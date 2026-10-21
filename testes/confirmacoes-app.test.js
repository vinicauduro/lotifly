// Confirmação do app no lugar da caixinha do navegador: abre por cima da janela que já estava
// aberta sem fechá-la; mostra os valores formatados; o foco começa no Cancelar quando a ação não
// tem volta; Esc e Cancelar desistem; excluir um empreendimento com tudo pede o nome digitado.
// Nenhuma caixinha do navegador aparece.
// Rodar: BASE=http://127.0.0.1:8765/gestao/ node testes/confirmacoes-app.test.js
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
  page.on('dialog', d => { erros.push('caixinha do navegador apareceu: ' + d.message()); d.dismiss(); });
  await page.goto(BASE + 'index.html?dados=exemplo'); await page.waitForFunction(() => window.PiorCaso && db.loteamentos.length); await page.waitForTimeout(300);
  await page.evaluate(() => { sessionStorage.setItem('gl_admin', '1'); startRole('admin'); document.querySelectorAll('#devDados,.toast').forEach(e => e.remove()); });
  const box = page.locator('#confirmaBox');

  await passo('excluir despesa: a confirmação abre por cima da despesa, com o valor, e o foco no Cancelar', async () => {
    const id = await page.evaluate(() => { const c = db.custos[0]; abrirCustoForm(c.id); return c.id; });
    await page.waitForTimeout(250);
    await page.evaluate(id => { excluirCusto(id); }, id); await box.waitFor();
    const r = await page.evaluate(() => ({ t: document.getElementById('confirmaBox').innerText.replace(/\s+/g, ' '), foco: document.activeElement.className, modal: document.getElementById('modalOverlay').classList.contains('open'), role: document.getElementById('confirmaBox').getAttribute('role') }));
    if (!/^Excluir ".+"\? Valor R\$ [\d.]+,\d\d Cancelar Excluir despesa$/.test(r.t) || !/conf-nao/.test(r.foco) || !r.modal || r.role !== 'alertdialog') throw new Error(JSON.stringify(r));
  });
  await passo('Esc desiste: a confirmação fecha, a despesa continua e a janela de baixo segue aberta', async () => {
    const n = await page.evaluate(() => db.custos.length);
    await page.keyboard.press('Escape'); await page.waitForTimeout(100);
    const r = await page.evaluate(() => ({ n: db.custos.length, box: !!document.getElementById('confirmaBox'), modal: document.getElementById('modalOverlay').classList.contains('open') }));
    if (r.n !== n || r.box || !r.modal) throw new Error(JSON.stringify(r));
  });
  await passo('confirmar exclui', async () => {
    const id = await page.evaluate(() => db.custos[0].id), n = await page.evaluate(() => db.custos.length);
    await page.evaluate(id => { excluirCusto(id); }, id); await box.waitFor();
    await page.click('#confirmaBox .conf-sim'); await page.waitForTimeout(150);
    if (await page.evaluate(() => db.custos.length) !== n - 1) throw new Error('não excluiu');
  });
  await passo('estorno mostra a parcela e o valor pago; Cancelar não estorna', async () => {
    const id = await page.evaluate(() => db.recebiveis.find(r => num(r.valorPago) > 0).id);
    await page.evaluate(id => { estornarPagamento(id); }, id); await box.waitFor();
    const t = (await box.innerText()).replace(/\s+/g, ' ');
    if (!/Estornar o pagamento desta parcela\?.* Parcela .+ Valor pago R\$/.test(t)) throw new Error(t);
    await page.click('#confirmaBox .conf-nao'); await page.waitForTimeout(100);
    if (!(await page.evaluate(id => num(db.recebiveis.find(r => r.id === id).valorPago) > 0, id))) throw new Error('estornou mesmo cancelando');
  });
  await passo('excluir empreendimento: mostra o que vai junto e só libera o botão com o nome digitado', async () => {
    const l = await page.evaluate(() => { const l = db.loteamentos[0]; excluirLoteamento(l.id); return { id: l.id, nome: l.nome }; });
    await box.waitFor();
    const t = (await box.innerText()).replace(/\s+/g, ' ');
    for (const s of ['Isto não tem volta', 'Lotes', 'Reservas', 'Contratos e parcelas', 'Despesas', 'Para confirmar, digite ' + l.nome]) if (!t.includes(s)) throw new Error(`faltou "${s}": ${t}`);
    const sim = page.locator('#confirmaBox .conf-sim');
    if (!(await sim.isDisabled())) throw new Error('botão liberado sem digitar');
    await page.fill('#confDigitar', 'outro nome');
    if (!(await sim.isDisabled())) throw new Error('liberou com o nome errado');
    await page.fill('#confDigitar', l.nome.toUpperCase());
    if (await sim.isDisabled()) throw new Error('não liberou com o nome certo');
    await page.click('#confirmaBox .conf-nao'); await page.waitForTimeout(100);
    if (!(await page.evaluate(id => !!getLoteamento(id), l.id))) throw new Error('excluiu mesmo cancelando');
  });
  await passo('Tab fica dentro da confirmação', async () => {
    await page.evaluate(() => { excluirCusto(db.custos[0].id); }); await box.waitFor();
    const r = [];
    for (let i = 0; i < 4; i++) { await page.keyboard.press('Tab'); r.push(await page.evaluate(() => !!document.activeElement.closest('#confirmaBox'))); }
    await page.keyboard.press('Escape');
    if (r.includes(false)) throw new Error(r.join());
  });
  await passo('celular: a confirmação vira uma gaveta embaixo, com os botões largos', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => { excluirCusto(db.custos[0].id); }); await box.waitFor();
    const r = await page.evaluate(() => { const b = document.getElementById('confirmaBox').getBoundingClientRect(); const bt = document.querySelector('#confirmaBox .conf-sim').getBoundingClientRect(); return { fundo: Math.round(innerHeight - b.bottom), larg: Math.round(bt.width), alt: Math.round(bt.height) }; });
    await page.keyboard.press('Escape');
    if (r.fundo > 1 || r.larg < 300 || r.alt < 44) throw new Error(JSON.stringify(r));
  });
  await browser.close();
  if (erros.length) { console.log('\nERROS:\n' + erros.join('\n')); process.exit(1); }
  console.log('\nTudo certo.');
})();
