// Receitas avulsas (etapa 2 do financeiro): A receber › Outras receitas. Lançar comissão de
// corretagem, rendimento, aporte, empréstimo e tipos criados pela empresa; receber escolhendo a
// conta do caixa (com Desfazer); no balancete, cada tipo na sua linha, taxa de cessão avulsa
// somando com as taxas de cessão, e aporte/empréstimo fora do resultado. Relógio fixo em 19/10/2026.
// Rodar: BASE=http://127.0.0.1:8765/gestao/ node testes/receitas-avulsas.test.js
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
  await page.evaluate(() => {
    sessionStorage.setItem('gl_admin', '1'); startRole('admin'); document.querySelectorAll('#devDados,.toast').forEach(e => e.remove());
    db.vendedores = []; db.receitas = []; db.movimentos = []; db.config.tiposReceitaExtra = [];
    db.contasCaixa = [{ id: 'cx1', nome: 'BB Corrente', tipo: 'corrente', empresaId: '', saldoInicial: 1000, dataSaldo: '2026-10-01', ativa: true }];
    state.escopo = ''; state.filters.rec = null; state.filters.receitas = null;
  });
  const saldo = () => page.evaluate(() => saldoConta(getContaCaixa('cx1')));
  const limparToasts = () => page.evaluate(() => document.querySelectorAll('.toast').forEach(e => e.remove()));
  const lancar = async (o) => {
    await page.evaluate(() => abrirReceitaForm()); await page.waitForTimeout(150);
    await page.selectOption('#rtTipo', o.tipo);
    if (o.novo) { await page.fill('#rtNovoNome', o.novo); if (o.fora) await page.check('#rtNovoFora'); }
    await page.fill('#rtDesc', o.desc); await page.fill('#rtValor', String(o.valor)); await page.fill('#rtComp', o.comp);
    if (o.pagador) await page.fill('#rtPagador', o.pagador);
    if (o.venc) await page.fill('#rtVenc', o.venc);
    if (o.recebida) { await page.selectOption('#rtStatus', 'recebido'); await page.fill('#rtData', o.recebida); }
    await page.click('#modalFoot .btn-primary'); await page.waitForTimeout(150);
  };

  await passo('A receber tem "Parcelas dos contratos" e "Outras receitas"; sem receitas, a tela explica', async () => {
    await page.evaluate(() => switchTab('recebiveis'));
    const abas = await page.evaluate(() => [...document.querySelectorAll('#av-recebiveis .subtabs .chip')].map(c => c.textContent.trim()).join());
    if (abas !== 'Parcelas dos contratos,Outras receitas') throw new Error(abas);
    await page.click('#av-recebiveis .subtabs .chip >> text=Outras receitas');
    const t = (await page.locator('#av-recebiveis').innerText()).replace(/\s+/g, ' ');
    if (!t.includes('Nenhuma receita avulsa lançada') || !t.includes('Comissões de corretagem, taxa de cessão, rendimentos')) throw new Error(t.slice(0, 300));
  });
  await passo('lança comissão de corretagem a receber; aparece na lista com o tipo e o pagador', async () => {
    await lancar({ tipo: 'corretagem', desc: 'Comissão apto 302 — Ed. Aurora', valor: 8000, comp: '2026-10-05', venc: '2026-10-25', pagador: 'Construtora Aurora' });
    const t = (await page.locator('#av-recebiveis .item.linha').textContent()).replace(/\s+/g, ' ');
    for (const s of ['Comissão apto 302 — Ed. Aurora', 'Comissões de corretagem', 'Construtora Aurora', 'R$ 8.000,00', 'vence 25/10/2026']) if (!t.includes(s)) throw new Error(`faltou "${s}": ${t}`);
    if (await saldo() !== 1000) throw new Error('a receber já mexeu no caixa');
  });
  await passo('receber pergunta a conta e o saldo sobe; Desfazer devolve', async () => {
    await limparToasts();
    await page.click('#av-recebiveis .item.linha button[title="Registrar recebimento"]');
    if (await page.evaluate(() => getContaCaixa(val('rrConta')).nome) !== 'BB Corrente') throw new Error('sem conta');
    await page.fill('#rrData', '2026-10-18'); await page.click('#modalFoot .btn-primary'); await page.waitForTimeout(150);
    const r = await page.evaluate(() => ({ st: db.receitas[0].status, d: db.receitas[0].dataRecebimento }));
    if (r.st !== 'recebido' || r.d !== '2026-10-18' || await saldo() !== 9000) throw new Error(JSON.stringify(r) + ' saldo ' + await saldo());
    await page.locator('.toast .toast-acao', { hasText: 'Desfazer' }).click(); await page.waitForTimeout(100);
    if (await saldo() !== 1000 || await page.evaluate(() => db.receitas[0].status) !== 'aberto') throw new Error('desfazer');
    await page.evaluate(() => { abrirReceitaForm(db.receitas[0].id); }); await page.waitForTimeout(100);
    await page.selectOption('#rtStatus', 'recebido'); await page.fill('#rtData', '2026-10-18'); await page.click('#modalFoot .btn-primary'); await page.waitForTimeout(150);
    if (await saldo() !== 9000) throw new Error('receber pelo formulário: ' + await saldo());
  });
  await passo('aporte de sócios avisa que fica fora do resultado e entra no caixa', async () => {
    await page.evaluate(() => abrirReceitaForm()); await page.waitForTimeout(100);
    await page.selectOption('#rtTipo', 'aporte');
    if (!/fora do resultado/.test(await page.locator('#rtTipoDica').innerText())) throw new Error('sem aviso');
    await page.evaluate(() => closeModal());
    await lancar({ tipo: 'aporte', desc: 'Aporte do sócio Vinícius', valor: 50000, comp: '2026-10-10', recebida: '2026-10-10' });
    if (await saldo() !== 59000) throw new Error('saldo ' + await saldo());
  });
  await passo('cria tipo novo no próprio lançamento; ele aparece no plano de contas', async () => {
    await page.evaluate(() => abrirReceitaForm()); await page.waitForTimeout(100);
    if (!await page.locator('#rtTipo option[value="__novo"]').count()) throw new Error('sem opção de criar tipo');
    await page.evaluate(() => closeModal());
    await lancar({ tipo: '__novo', novo: 'Aluguel do stand', desc: 'Aluguel do stand — outubro', valor: 1200, comp: '2026-10-01', recebida: '2026-10-08' });
    const t = await page.evaluate(() => ({ extra: db.config.tiposReceitaExtra.map(t => t.nome + ':' + t.resultado).join(), tipo: getTipoReceita(db.receitas.find(x => x.descricao.startsWith('Aluguel')).tipoId).nome }));
    if (t.extra !== 'Aluguel do stand:true' || t.tipo !== 'Aluguel do stand') throw new Error(JSON.stringify(t));
    await page.evaluate(() => { state.sub.cad = 'categorias'; switchTab('cadastros'); }); await page.waitForTimeout(150);
    const pc = (await page.locator('#pcReceitas').textContent()).replace(/\s+/g, ' ');
    if (!pc.includes('Aluguel do stand') || !pc.includes('criado pela empresa') || !/Aporte de sócios fora do resultado/i.test(pc)) throw new Error(pc);
  });
  await passo('taxa de cessão avulsa e empréstimo lançados', async () => {
    await page.evaluate(() => { filtroRec().sub = 'receitas'; switchTab('recebiveis'); });
    await lancar({ tipo: 'cessao', desc: 'Termo de cessão — lote 4', valor: 900, comp: '2026-10-12', recebida: '2026-10-12' });
    await lancar({ tipo: 'emprestimo', desc: 'Capital de giro Sicoob', valor: 30000, comp: '2026-10-15', recebida: '2026-10-15' });
    if (await saldo() !== 91100) throw new Error('saldo ' + await saldo());
  });
  await passo('balancete (caixa): cada tipo na sua linha, cessão nas taxas, aporte e empréstimo fora do resultado', async () => {
    const r = await page.evaluate(() => {
      const antes = (() => { Object.assign(relState(), { tipo: 'balancete', regime: 'caixa', de: '2026-10-01', ate: '2026-10-31' }); state.escopo = ''; db.receitas_ = db.receitas; db.receitas = []; const x = relBalancete(''); db.receitas = db.receitas_; return x; })();
      const rel = relBalancete('');
      const linha = (b, rot) => { const l = b.csv.find(x => x[0].trim() === rot); return l ? Math.round(Number(String(l[l.length - 2]).replace(/\./g, '').replace(',', '.')) * 100) / 100 : 0; };
      return { corr: linha(rel, 'Comissões de corretagem'), alug: linha(rel, 'Aluguel do stand'), taxa: linha(rel, 'Taxas de cessão') - linha(antes, 'Taxas de cessão'), tot: Math.round((linha(rel, 'Receita total') - linha(antes, 'Receita total')) * 100) / 100,
        aporte: linha(rel, 'Aporte de sócios'), emp: linha(rel, 'Empréstimos recebidos'), fora: rel.html.includes('Fora do resultado'), ordem: rel.csv.map(x => x[0].trim()).join('|') };
    });
    if (r.corr !== 8000 || r.alug !== 1200 || r.taxa !== 900 || r.tot !== 10100) throw new Error(JSON.stringify(r));
    if (r.aporte !== 50000 || r.emp !== 30000 || !r.fora) throw new Error(JSON.stringify(r));
    if (r.ordem.indexOf('Resultado do período') > r.ordem.indexOf('Aporte de sócios')) throw new Error('aporte antes do resultado: ' + r.ordem);
  });
  await passo('balancete (competência) usa a competência, recebida ou não', async () => {
    const r = await page.evaluate(() => { Object.assign(relState(), { regime: 'competencia', de: '2026-10-01', ate: '2026-10-31' }); const rel = relBalancete(''); const l = rel.csv.find(x => x[0].trim() === 'Comissões de corretagem'); return l ? l[l.length - 2] : ''; });
    if (r.replace(/\s/g, '') !== '8.000,00') throw new Error(r);
  });
  await passo('excluir receita recebida tira o valor do caixa', async () => {
    const id = await page.evaluate(() => db.receitas.find(x => x.descricao.startsWith('Aluguel')).id);
    await page.evaluate(id => excluirReceita(id), id); await page.waitForTimeout(200);
    if (await saldo() !== 89900) throw new Error('saldo ' + await saldo());
  });
  await passo('ir para A receber pelo Início volta às parcelas', async () => {
    await page.evaluate(() => mostrarRecebiveis('atrasado'));
    const ativa = await page.evaluate(() => document.querySelector('#av-recebiveis .subtabs .chip.active').textContent.trim());
    if (ativa !== 'Parcelas dos contratos') throw new Error(ativa);
  });
  await passo('celular: Outras receitas e o formulário cabem na largura', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    const r = await page.evaluate(() => { filtroRec().sub = 'receitas'; switchTab('recebiveis'); const a = document.documentElement.scrollWidth <= innerWidth; abrirReceitaForm(); const b = document.getElementById('modalBox').getBoundingClientRect().right <= innerWidth; closeModal(); return a + ',' + b; });
    if (r !== 'true,true') throw new Error(r);
  });
  await browser.close();
  if (erros.length) { console.log('\nERROS:\n' + erros.join('\n')); process.exit(1); }
  console.log('\nTudo certo.');
})();
