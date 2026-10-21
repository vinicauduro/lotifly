// Registro de erros do app (erros.js) e a tela Configurações › Erros do app. Confere: erro
// solto e promessa rejeitada ficam registrados com tela e pilha; o mesmo erro repetido vira um
// registro com a conta; barulho (extensão, ResizeObserver, falta de internet) não entra; limite
// por sessão; na nuvem (simulada) vai para a tabela erros com empresa e quem, e fica guardado
// quando o banco ainda não tem a tabela ou não há internet; recusa da nuvem ao salvar também
// entra; a tela lista, faz erro de teste e apaga; corretor não vê a tela.
// Rodar: BASE=http://127.0.0.1:8765/gestao/ node testes/erros.test.js
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
  /* os erros deste teste são de propósito: só falha o que não for deles */
  page.on('pageerror', e => { if (!/de propósito|teste|reading 'x'|Failed to fetch/i.test(e.message)) erros.push(`pageerror: ${e.message}`); });
  page.on('dialog', d => d.accept()); await responderConfirmacoes(page);
  await page.goto(BASE + 'index.html?dados=exemplo'); await page.waitForFunction(() => window.PiorCaso && db.loteamentos.length); await page.waitForTimeout(300);
  await page.evaluate(() => { sessionStorage.setItem('gl_admin', '1'); startRole('admin'); document.querySelectorAll('#devDados,.toast').forEach(e => e.remove()); Erros.limparLocais(); });
  const espera = ms => page.waitForTimeout(ms);
  const guardados = () => page.evaluate(() => Erros.guardados());

  await passo('erro solto na tela fica registrado com mensagem, tela, pilha e navegador', async () => {
    await page.evaluate(() => { switchTab('vendas'); window.quebra = () => { const o = null; return o.x; }; setTimeout(quebra, 0); }); await espera(150);
    const g = await guardados();
    if (g.length !== 1) throw new Error(JSON.stringify(g));
    const e = g[0];
    if (!/null|Cannot read/i.test(e.mensagem) || !e.tela.includes('admin') || !e.tela.includes('vendas') || !e.pilha || !e.navegador || e.vezes !== 1 || e.enviado) throw new Error(JSON.stringify(e));
  });
  await passo('o mesmo erro três vezes vira um registro só, "3 vezes"', async () => {
    await page.evaluate(() => { for (let i = 0; i < 2; i++) setTimeout(quebra, 0); }); await espera(150);
    const g = await guardados();
    if (g.length !== 1 || g[0].vezes !== 3) throw new Error(JSON.stringify(g.map(e => [e.mensagem, e.vezes])));
  });
  await passo('promessa rejeitada sem tratamento também entra', async () => {
    await page.evaluate(() => { Promise.reject(new Error('Falha de teste na promessa')); }); await espera(150);
    if (!(await guardados()).some(e => e.mensagem === 'Falha de teste na promessa')) throw new Error('não registrou');
  });
  await passo('barulho não entra: extensão do navegador, ResizeObserver, falta de internet', async () => {
    const antes = (await guardados()).length;
    await page.evaluate(() => {
      window.dispatchEvent(new ErrorEvent('error', { message: 'erro de teste da extensão', filename: 'chrome-extension://abc/inject.js', error: new Error('erro de teste da extensão') }));
      window.dispatchEvent(new ErrorEvent('error', { message: 'ResizeObserver loop completed with undelivered notifications.' }));
      window.dispatchEvent(new ErrorEvent('error', { message: 'Script error.' }));
    });
    await ctx.setOffline(true);
    await page.evaluate(() => { Promise.reject(new TypeError('Failed to fetch')); }); await espera(150);
    await ctx.setOffline(false);
    const g = await guardados();
    if (g.length !== antes) throw new Error(g.slice(antes).map(e => e.mensagem).join(' | '));
  });
  await passo('no máximo 30 erros diferentes por sessão (um defeito em laço não enche o banco)', async () => {
    const r = await page.evaluate(async () => {
      const n0 = Erros.nSessao;
      for (let i = 0; i < 40; i++) Erros.registrar({ mensagem: 'Erro de teste em série nº ' + i });
      const n = Erros.guardados().filter(e => e.mensagem.startsWith('Erro de teste em série')).length;
      Erros.nSessao = 0; Erros.vistos.clear(); Erros.limparLocais();
      return { n, esperado: 30 - n0 };
    });
    if (r.n !== r.esperado) throw new Error(JSON.stringify(r));
  });
  await passo('tela Configurações › Erros do app: lista, erro de teste aparece, apagar todos limpa', async () => {
    await page.evaluate(() => { setTimeout(() => { throw new Error('Erro de teste da tela'); }, 0); });
    await espera(100);
    await page.evaluate(() => { state.sub.cad = 'erros'; switchTab('cadastros'); });
    await page.locator('#errosLista .erro-item').first().waitFor();
    if (!(await page.locator('#errosLista').innerText()).includes('Erro de teste da tela')) throw new Error('não listou');
    await page.getByRole('button', { name: 'Fazer um erro de teste' }).click(); await espera(2800);
    const t = await page.locator('#errosLista').innerText();
    if (!t.includes('Erro de teste, feito de propósito')) throw new Error(t.slice(0, 200));
    await page.getByRole('button', { name: 'Apagar todos' }).click(); await espera(300);
    if (!(await page.locator('#errosLista').innerText()).includes('Nenhum erro registrado') || (await guardados()).length) throw new Error('não apagou');
  });
  await passo('na nuvem: vai para a tabela com empresa, quem, tela e versão, e fica marcado como enviado', async () => {
    const r = await page.evaluate(async () => {
      window.inseridos = []; window.respostaInsert = null; window.lidos = 0;
      const q = (t) => { const o = { _t: t, select: () => o, eq: () => o, order: () => o, limit: () => o, delete: () => { o._del = true; return o; },
        insert: rows => { if (!respostaInsert) inseridos.push(...rows.map(r => Object.assign({ _t: t }, r))); o._ins = true; return o; },
        then: (ok, ko) => { let r; if (o._ins) r = respostaInsert || { error: null }; else if (o._del) { inseridos = []; r = { error: null }; } else { lidos++; r = { data: inseridos.slice().reverse(), error: null }; } return Promise.resolve(r).then(ok, ko); } }; return o; };
      Cloud.client = { from: t => q(t), removeChannel: () => {} };
      Cloud.active = true; Cloud.user = { id: 'u1' }; Cloud.org = { id: 'org-1' }; Cloud.membro = { nome: 'Marina Souza' }; Cloud.papel = 'admin';
      Erros.versao = 'v99';
      Erros.registrar({ mensagem: 'Erro de teste na nuvem', pilha: 'at x (core.js:1:1)' });
      await Erros.enviar();
      return { ins: inseridos, g: Erros.guardados() };
    });
    const e = r.ins[0];
    if (!e || e._t !== 'erros' || e.org_id !== 'org-1' || e.quem !== 'Marina Souza' || e.versao !== 'v99' || !e.tela || e.mensagem !== 'Erro de teste na nuvem') throw new Error(JSON.stringify(r.ins));
    if (!r.g[0].enviado) throw new Error('não marcou como enviado');
    if ('user_id' in e) throw new Error('mandou user_id (o banco põe o de quem está logado)');
  });
  await passo('banco ainda sem a tabela: fica guardado no aparelho e a tela pede para rodar o schema', async () => {
    const r = await page.evaluate(async () => {
      respostaInsert = { error: { message: 'relation "public.erros" does not exist' } };
      Erros.registrar({ mensagem: 'Erro de teste sem tabela' }); await Erros.enviar();
      return { pend: Erros.guardados().filter(e => !e.enviado).length, sem: Erros.semTabela };
    });
    if (r.pend !== 1 || !r.sem) throw new Error(JSON.stringify(r));
    await page.evaluate(() => { Cloud.client.from = (orig => t => { const o = orig(t); const th = o.then; o.then = (ok, ko) => (o._ins || o._del ? th(ok, ko) : Promise.resolve({ data: null, error: { message: 'relation "public.erros" does not exist' } }).then(ok, ko)); return o; })(Cloud.client.from); state.sub.cad = 'erros'; renderCurrent(); });
    await espera(300);
    const t = await page.locator('#errosLista').innerText();
    if (!/schema\.sql/.test(t) || !t.includes('Erro de teste sem tabela') || !t.includes('ainda não enviado')) throw new Error(t.slice(0, 300));
  });
  await passo('sem internet não tenta; voltando a internet, manda o que ficou', async () => {
    const r1 = await page.evaluate(async () => {
      const f = Cloud.client.from; Cloud.client.from = t => { const o = f(t); return o; };
      respostaInsert = null; Erros.limparLocais(); inseridos = [];
      return true;
    });
    void r1;
    await ctx.setOffline(true);
    await page.evaluate(async () => { Erros.registrar({ mensagem: 'Erro de teste sem internet' }); await Erros.enviar(); });
    if ((await page.evaluate(() => inseridos.length)) !== 0) throw new Error('tentou mandar sem internet');
    await ctx.setOffline(false); await espera(2000);
    const r = await page.evaluate(() => ({ ins: inseridos.map(e => e.mensagem), pend: Erros.guardados().filter(e => !e.enviado).length }));
    if (!r.ins.includes('Erro de teste sem internet') || r.pend) throw new Error(JSON.stringify(r));
  });
  await passo('a nuvem recusou uma gravação: entra como erro, com o nome do que era', async () => {
    const r = await page.evaluate(() => { Cloud.erro({ message: 'new row violates row-level security policy' }, 'recebiveis'); return Erros.guardados().map(e => e.mensagem); });
    if (!r.some(m => m === 'A nuvem recusou gravar parcela: new row violates row-level security policy')) throw new Error(JSON.stringify(r));
  });
  await passo('corretor e financeiro não veem a tela de erros', async () => {
    const r = await page.evaluate(() => { const v = []; for (const p of ['corretor', 'financeiro', 'admin', 'dono']) { Cloud.papel = p; v.push(p + ':' + podeVerErros()); } Cloud.active = false; return v.join(' '); });
    if (r !== 'corretor:false financeiro:false admin:true dono:true') throw new Error(r);
  });
  await browser.close();
  if (erros.length) { console.log('\nERROS:\n' + erros.join('\n')); process.exit(1); }
  console.log('\nTudo certo.');
})();
