// Fase 6: permissões pessoa a pessoa em cima do padrão da função. Simula a nuvem com uma equipe
// (dono, administradora, financeiro, corretor) só neste navegador — nada é enviado a servidor.
// Rodar: BASE=http://127.0.0.1:8765/lotifly/ node testes/permissoes.test.js
const { chromium } = require('playwright');
const { responderConfirmacoes } = require('./confirmacoes');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/gestao/';
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--disable-gpu'] });
  const erros = [];
  const passo = async (nome, fn) => { try { await fn(); console.log('✔', nome); } catch (e) { console.log('✘', nome, e.message.split('\n')[0]); erros.push(nome + ': ' + e.message.split('\n')[0]); } };
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, serviceWorkers: 'block' });
  await ctx.route(/config\.js/, r => r.fulfill({ contentType: 'application/javascript', body: "window.GL_CONFIG={supabaseUrl:'',supabaseAnonKey:''};" }));
  const page = await ctx.newPage(); page.setDefaultTimeout(8000);
  page.on('pageerror', e => erros.push('pageerror: ' + e.message)); page.on('dialog', d => d.accept()); await responderConfirmacoes(page);
  await page.goto(BASE + 'index.html?dados=exemplo'); await page.waitForFunction(() => window.PiorCaso && db.loteamentos.length); await page.waitForTimeout(300);
  /* "Nuvem" de mentira: a equipe e o usuário logado; gravar não sai do navegador */
  const comoPessoa = (papel, userId) => page.evaluate(([papel, userId]) => {
    Object.assign(Cloud, { active: true, papel, user: { id: userId, email: userId + '@x.com' }, org: { id: 'org1', nome: 'Cocal Loteamentos' }, convites: [], status: 'on', msg: 'Sincronizado' });
    Cloud.membros = [
      { id: 'm-dono', userId: 'u-dono', nome: 'Vinicius', email: 'dono@x.com', papel: 'dono', ativo: true },
      { id: 'm-adm', userId: 'u-adm', nome: 'Paula Admin', email: 'adm@x.com', papel: 'admin', ativo: true },
      { id: 'm-fin', userId: 'u-fin', nome: 'Marcos Financeiro', email: 'fin@x.com', papel: 'financeiro', ativo: true },
      { id: 'm-cor', userId: 'u-cor', nome: 'Ana Corretora', email: 'cor@x.com', papel: 'corretor', ativo: true }];
    Cloud.membro = Cloud.membros.find(m => m.userId === userId);
    Cloud.saveConfig = () => Promise.resolve(); Cloud.upsert = () => Promise.resolve(); Cloud.remove = () => Promise.resolve();
    document.querySelectorAll('#devDados,.toast').forEach(e => e.remove());
  }, [papel, userId]);

  await comoPessoa('dono', 'u-dono');
  await passo('sem ajuste, a pessoa segue o padrão da função', async () => {
    const r = await page.evaluate(() => { db.config.permissoesPessoas = {}; const p = permsDaPessoa('u-fin', 'financeiro'); return [p['vendas.distrato'], p['cobranca.ver']]; });
    if (r.join() !== 'false,true') throw new Error(r.join());
  });
  await passo('Equipe: botão Permissões abre as opções da pessoa, com o padrão marcado', async () => {
    await page.evaluate(() => { startRole('admin'); state.sub.cad = 'corretores'; switchTab('cadastros'); });
    await page.locator('#av-cadastros .item', { hasText: 'Marcos Financeiro' }).click();
    await page.locator('#modalFoot button', { hasText: 'Permissões' }).click(); await page.waitForTimeout(200);
    const r = await page.evaluate(() => ({ titulo: document.getElementById('modalTitle').textContent, distrato: document.querySelector('[data-perm="vendas.distrato"]').checked, preco: document.querySelector('[data-perm="lotes.preco"]').disabled, tag: document.querySelector('[data-perm="cobranca.ver"]').parentElement.querySelector('.perm-tag').textContent }));
    if (!/Marcos Financeiro/.test(r.titulo) || r.distrato || !r.preco || r.tag !== 'padrão') throw new Error(JSON.stringify(r));
  });
  await passo('ajustar duas opções grava só a diferença e marca "ajustado"', async () => {
    await page.check('[data-perm="vendas.distrato"]'); await page.uncheck('[data-perm="cobranca.ver"]');
    const tag = await page.locator('[data-perm="vendas.distrato"]').locator('xpath=..').locator('.perm-tag').textContent();
    if (tag !== 'ajustado') throw new Error('etiqueta: ' + tag);
    await page.locator('#modalFoot button', { hasText: 'Salvar' }).click(); await page.waitForTimeout(200);
    const salvo = await page.evaluate(() => db.config.permissoesPessoas['u-fin']);
    if (JSON.stringify(salvo) !== JSON.stringify({ 'vendas.distrato': true, 'cobranca.ver': false })) throw new Error(JSON.stringify(salvo));
    if (!await page.locator('#av-cadastros .item', { hasText: 'Marcos Financeiro' }).locator('text=permissões próprias').count()) throw new Error('sem a marca na lista');
  });
  await passo('mudar o padrão da função vale para o que a pessoa não ajustou', async () => {
    const r = await page.evaluate(() => { const salvo = db.config.permissoes; db.config.permissoes = Object.assign({}, salvo, { financeiro: Object.assign({}, permsDoPapel('financeiro'), { 'relatorios.ver': false, 'cobranca.ver': true }) }); const p = permsDaPessoa('u-fin', 'financeiro'); db.config.permissoes = salvo; return [p['relatorios.ver'], p['cobranca.ver']]; });
    if (r.join() !== 'false,false') throw new Error(r.join());
  });

  await comoPessoa('financeiro', 'u-fin');
  await passo('logado como a pessoa: o ajuste vale (pode distrato, não vê Cobrança no menu)', async () => {
    await page.evaluate(() => { startRole('admin'); aplicarPermissoesNasAbas(); });
    const r = await page.evaluate(() => ({ distrato: pode('vendas.distrato'), cob: pode('cobranca.ver'), menu: getComputedStyle(document.querySelector('#aAside .tab[data-tab="cobranca"]')).display }));
    if (!r.distrato || r.cob || r.menu !== 'none') throw new Error(JSON.stringify(r));
  });
  await passo('ninguém ajusta as próprias permissões', async () => {
    await page.evaluate(() => abrirPermissoesPessoa('m-fin')); await page.waitForTimeout(150);
    const r = await page.evaluate(() => ({ t: document.getElementById('modalTitle').textContent, inputs: document.querySelectorAll('#modalBody input[data-perm]').length }));
    if (r.t !== 'Suas permissões' || r.inputs) throw new Error(JSON.stringify(r));
    await page.evaluate(() => closeModal());
  });

  await comoPessoa('dono', 'u-dono');
  await passo('dono e corretor não têm o que ajustar; "Voltar ao padrão" apaga o ajuste', async () => {
    const dono = await page.evaluate(() => { abrirPermissoesPessoa('m-dono'); const n = document.querySelectorAll('#modalBody input[data-perm]').length; closeModal(); return n; });
    const cor = await page.evaluate(() => { abrirPermissoesPessoa('m-cor'); const n = document.querySelectorAll('#modalBody input[data-perm]').length; closeModal(); return n; });
    if (dono || cor) throw new Error(`dono ${dono}, corretor ${cor}`);
    await page.evaluate(() => abrirPermissoesPessoa('m-fin')); await page.waitForTimeout(150);
    await page.locator('#modalFoot button', { hasText: 'Voltar ao padrão' }).click(); await page.waitForTimeout(150);
    if (await page.evaluate(() => 'u-fin' in (db.config.permissoesPessoas || {}))) throw new Error('ajuste continuou');
  });
  await ctx.close();
  console.log(erros.length ? '\nERROS:\n' + erros.join('\n') : '\ntudo ok');
  await browser.close(); process.exit(erros.length ? 1 : 0);
})();
