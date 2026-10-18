// Sair da conta apaga deste aparelho o que é da empresa: a cópia dos dados (clientes, CPF,
// contratos), a lista de empresas, os erros guardados e o e-mail da tela de entrada. Alteração
// que a nuvem ainda não recebeu só sai com confirmação; se a sessão cai sozinha, ela fica.
// O Supabase é simulado.
// Rodar: BASE=http://127.0.0.1:8765/gestao/ node testes/sair-limpa.test.js
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
  let dialogo = 'accept';
  page.on('dialog', d => (dialogo === 'accept' ? d.accept() : d.dismiss()));
  await page.goto(BASE + 'index.html?dados=exemplo'); await page.waitForFunction(() => window.PiorCaso && db.loteamentos.length); await page.waitForTimeout(300);
  await page.evaluate(() => {
    document.querySelectorAll('#devDados,.toast').forEach(e => e.remove());
    const ORG = '11111111-1111-1111-1111-111111111111';
    window.saiu = 0; window.errosEnviados = [];
    /* Cenário: alguém da empresa entrou na nuvem neste aparelho e vai sair */
    window.preparar = (pendentes = []) => {
      Cloud.enabled = true; Cloud.active = true; Cloud.user = { id: 'u1' }; Cloud.org = { id: ORG }; Cloud.membro = { nome: 'Ana' }; Cloud.pendentes = pendentes.slice();
      Cloud.client = {
        auth: { signOut: async () => { saiu++; } },
        from: () => { const q = { insert: rows => { errosEnviados.push(...rows); return q; }, then: (ok, ko) => Promise.resolve({ error: null }).then(ok, ko) }; return q; },
        removeChannel: () => {}
      };
      localStorage.setItem('gl_cache_' + ORG, JSON.stringify({ clientes: [{ nome: 'Beatriz Ramos', cpf: '11144477735' }] }));
      localStorage.setItem('gl_cache_outra-empresa', '{"clientes":[]}');
      localStorage.setItem('gl_orgs_u1', '[{"org":{"id":"' + ORG + '"}}]');
      localStorage.setItem('gl_pend_' + ORG, JSON.stringify(pendentes));
      localStorage.setItem('outra_coisa', 'fica');
      Erros.limparLocais(); Erros.vistos.clear(); Erros.nSessao = 0;
      Erros.registrar({ mensagem: 'Erro de teste antes de sair' });
      prefs.ultimoEmail = 'ana@cocal.com.br'; prefs.orgId = ORG; savePrefs();
    };
    window.chaves = () => Object.keys(localStorage).filter(k => k.startsWith('gl_') && k !== 'gl_prefs' && k !== DB_KEY && !k.startsWith('gl_pref')).sort();
  });

  await passo('sair apaga a cópia dos dados, a lista de empresas, os erros e o e-mail; o resto do navegador fica', async () => {
    await page.evaluate(() => preparar());
    await page.evaluate(() => sair()); await page.waitForTimeout(300);
    const r = await page.evaluate(() => ({ ch: chaves(), email: prefs.ultimoEmail, org: prefs.orgId, outra: localStorage.getItem('outra_coisa'), saiu, campo: (document.getElementById('auEmail') || {}).value }));
    if (r.ch.some(k => /^gl_(cache|orgs|pend)_|^gl_erros$/.test(k))) throw new Error('sobrou: ' + r.ch.join(', '));
    if (r.email || r.org || r.outra !== 'fica' || r.saiu !== 1) throw new Error(JSON.stringify(r));
    if (r.campo) throw new Error('a tela de entrada mostra o e-mail: ' + r.campo);
  });
  await passo('os erros guardados vão para a nuvem antes de sair', async () => {
    const r = await page.evaluate(() => errosEnviados.map(e => e.mensagem));
    if (!r.includes('Erro de teste antes de sair')) throw new Error(JSON.stringify(r));
  });
  await passo('com alteração que a nuvem não recebeu: pergunta; "Cancelar" não sai nem apaga nada', async () => {
    await page.evaluate(() => preparar([{ op: 'upsert', col: 'recebiveis', id: 'r1', rec: { id: 'r1' } }]));
    dialogo = 'dismiss';
    let pergunta = '';
    page.once('dialog', d => { pergunta = d.message(); });
    await page.evaluate(() => sair()); await page.waitForTimeout(200);
    dialogo = 'accept';
    const r = await page.evaluate(() => ({ ch: chaves(), saiu }));
    if (!/1 alteração.*não chegaram à nuvem/s.test(pergunta)) throw new Error('pergunta: ' + pergunta);
    if (r.saiu !== 1 || !r.ch.some(k => k.startsWith('gl_cache_'))) throw new Error('saiu ou apagou mesmo cancelando: ' + JSON.stringify(r));
  });
  await passo('confirmando, sai e apaga também a alteração pendente', async () => {
    await page.evaluate(() => sair()); await page.waitForTimeout(300);
    const r = await page.evaluate(() => ({ ch: chaves(), saiu }));
    if (r.saiu !== 2 || r.ch.some(k => /^gl_(cache|orgs|pend)_/.test(k))) throw new Error(JSON.stringify(r));
  });
  await passo('sessão que cai sozinha (sem clicar em Sair): apaga a cópia, mas guarda a alteração pendente', async () => {
    await page.evaluate(() => { preparar([{ op: 'upsert', col: 'custos', id: 'c1', rec: { id: 'c1' } }]); Cloud.fecharOrg(); Cloud.limparAparelho(false); });
    const r = await page.evaluate(() => chaves());
    if (r.some(k => /^gl_(cache|orgs)_|^gl_erros$/.test(k)) || !r.some(k => k.startsWith('gl_pend_'))) throw new Error(r.join(', '));
  });
  await browser.close();
  if (erros.length) { console.log('\nERROS:\n' + erros.join('\n')); process.exit(1); }
  console.log('\nTudo certo.');
})();
