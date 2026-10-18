// Plano de contas e centros de custo (Configurações): grupos de despesa com as contas embaixo,
// grupo criado e renomeado pela empresa, conta nova direto no grupo, conta desativada que some
// do lançamento mas fica no histórico; centros de custo da empresa (Comercial…) escolhidos no
// lançamento, filtro na lista de despesas, balancete por centro (colunas e filtro) e relatório
// de despesas agrupado por centro. Números montados à mão e conferidos à mão.
// Rodar: BASE=http://127.0.0.1:8765/gestao/ node testes/plano-contas.test.js
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/gestao/';
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--disable-gpu'] });
  const erros = [];
  const passo = async (nome, fn) => { try { await fn(); console.log('✔', nome); } catch (e) { console.log('✘', nome, e.message.split('\n')[0]); erros.push(`${nome}: ${e.message.split('\n')[0]}`); } };
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
  await ctx.route(/config\.js/, r => r.fulfill({ contentType: 'application/javascript', body: "window.GL_CONFIG={supabaseUrl:'',supabaseAnonKey:''};" }));
  const page = await ctx.newPage(); page.setDefaultTimeout(8000);
  page.on('pageerror', e => erros.push(`pageerror: ${e.message}`)); page.on('dialog', d => d.accept());
  await page.goto(BASE + 'index.html?dados=exemplo'); await page.waitForFunction(() => window.PiorCaso && db.loteamentos.length); await page.waitForTimeout(300);
  await page.evaluate(() => {
    sessionStorage.setItem('gl_admin', '1'); startRole('admin'); document.querySelectorAll('#devDados,.toast').forEach(e => e.remove());
    db.loteamentos = db.loteamentos.slice(0, 1).concat([Object.assign({}, db.loteamentos[0], { id: 'L2', nome: 'Jardim das Águas' })]);
    const L1 = db.loteamentos[0].id; window.L1 = L1; window.N1 = db.loteamentos[0].nome;
    db.categorias.push({ id: 'cx', nome: 'Café e copa', cor: '#999999' });
    const v = (id, emp, extra) => Object.assign({ id, loteamentoId: emp, loteId: null, cliente: { nome: 'Comprador ' + id }, corretor: { nome: 'Corretor' }, valorTotal: 100000, dataVenda: '2026-01-15', status: 'ativa', comissaoValor: 0, comissaoPaga: false, comissaoData: null }, extra);
    db.vendas = [v('v1', L1, { comissaoValor: 3000, comissaoPaga: true, comissaoData: '2026-02-10' }), v('v2', 'L2')];
    const r = (id, venda, emp, valor, dataPg) => ({ id, vendaId: venda, loteamentoId: emp, tipo: 'parcela', numero: 1, descricao: 'Parcela', vencimento: dataPg, valor, valorPago: valor, dataPagamento: dataPg });
    db.recebiveis = [r('r1', 'v1', L1, 20000, '2026-01-15'), r('r2', 'v2', 'L2', 8000, '2026-02-15')];
    const c = (id, cat, valor, emp, data, extra) => Object.assign({ id, categoriaId: cat, valor, loteamentoId: emp, descricao: id, fornecedor: '', dataCompetencia: data, vencimento: data, status: 'pago', dataPagamento: data }, extra);
    db.custos = [
      c('c1', 'terraplanagem', 9000, L1, '2026-01-10'),
      c('c2', 'materiais', 1000, 'L2', '2026-02-10'),
      c('c3', 'folha', 4000, null, '2026-01-31'),
      c('c4', 'cx', 300, null, '2026-02-05')
    ];
    db.config.gruposBalancete = {}; db.config.planoGrupos = []; db.config.centrosCusto = []; db.config.contasInativas = [];
    window.bal = (extra) => {
      Object.assign(relState(), { tipo: 'balancete', regime: 'caixa', de: '2026-01-01', ate: '2026-03-31', centro: '', colunas: 'mes' }, extra || {});
      const rel = relBalancete('');
      const linha = rot => { const l = rel.csv.find(x => x[0].trim() === rot); return l ? l.slice(1, -1).map(s => Math.round(Number(String(s).replace(/\./g, '').replace(',', '.')) * 100) / 100).join() : null; };
      return { rel, linha, head: rel.csvHead.join() };
    };
  });
  const abrirCad = async sub => { await page.evaluate(s => { state.sub.cad = s; switchTab('cadastros'); }, sub); await page.waitForTimeout(150); };

  await passo('Configurações › Plano de contas: receitas automáticas e os grupos de despesa com as contas embaixo', async () => {
    await abrirCad('categorias');
    const r = await page.evaluate(() => {
      const tabs = [...document.querySelectorAll('#av-cadastros .subtabs .chip')].map(c => c.textContent);
      const grupos = [...document.querySelectorAll('#av-cadastros .pc-grupo[data-grupo]')].map(g => [g.dataset.grupo, [...g.querySelectorAll('.pc-conta .title')].map(t => t.textContent)]);
      return { tabs, grupos, txt: document.querySelector('#av-cadastros').innerText };
    });
    if (!r.tabs.includes('Plano de contas') || !r.tabs.includes('Centros de custo')) throw new Error(r.tabs.join('|'));
    if (!/Receitas[\s\S]*Parcelas[\s\S]*Despesas/i.test(r.txt)) throw new Error('sem a seção de receitas');
    const g = Object.fromEntries(r.grupos);
    if (r.grupos.map(x => x[0]).slice(0, 3).join() !== 'obra,folha,comissoes') throw new Error('ordem ' + r.grupos.map(x => x[0]).join());
    if (!g.obra.includes('Terraplanagem') || !g.folha.includes('Pró-labore') || g.comissoes.length) throw new Error(JSON.stringify(g).slice(0, 300));
    if (!g[''] || !g[''].includes('Café e copa')) throw new Error('conta sem grupo não apareceu em "Sem grupo"');
  });
  await passo('criar um grupo pela tela e uma conta direto nele; o balancete ganha a linha', async () => {
    await page.click('#av-cadastros .card h2 button:has-text("Grupo")');
    await page.fill('#gpNome', 'Veículos e combustível'); await page.click('#modalFoot .btn-primary');
    const gid = await page.evaluate(() => (gruposDespesa().find(g => g[1] === 'Veículos e combustível') || [])[0]);
    if (!gid || !/^g-/.test(gid)) throw new Error('grupo não criado: ' + JSON.stringify(await page.evaluate(() => db.config.planoGrupos)));
    if ((await page.evaluate(() => gruposDespesa().length)) !== 9) throw new Error('os grupos de fábrica sumiram');
    await page.click(`#av-cadastros .pc-grupo[data-grupo="${gid}"] button:has-text("Conta")`);
    if (await page.evaluate(() => val('ctGrupo')) !== gid) throw new Error('a conta nova não veio no grupo');
    await page.fill('#ctNome', 'Combustível'); await page.click('#modalFoot .btn-primary');
    const cid = await page.evaluate(() => db.categorias.find(c => c.nome === 'Combustível').id);
    await page.evaluate(([cid]) => { db.custos.push({ id: 'c5', categoriaId: cid, valor: 250, loteamentoId: null, descricao: 'Gasolina', dataCompetencia: '2026-03-02', vencimento: '2026-03-02', status: 'pago', dataPagamento: '2026-03-02' }); }, [cid]);
    const b = await page.evaluate(() => { const b = bal(); return [b.linha('Veículos e combustível'), b.linha('Combustível')]; });
    if (b.join('|') !== '0,0,250,250|0,0,250,250') throw new Error(b.join('|'));
  });
  await passo('renomear um grupo de fábrica muda a linha do balancete; grupo de fábrica não se apaga', async () => {
    await page.click('#av-cadastros .pc-grupo[data-grupo="administrativo"] .pc-gh button[title="Renomear o grupo"]');
    if (await page.locator('#modalFoot .btn-outline-danger').count()) throw new Error('ofereceu apagar grupo de fábrica');
    await page.fill('#gpNome', 'Administração e escritório'); await page.click('#modalFoot .btn-primary');
    const r = await page.evaluate(() => { db.config.gruposBalancete = Object.assign({}, db.config.gruposBalancete, { cx: 'administrativo' }); const b = bal(); return [b.linha('Administração e escritório'), b.linha('Despesas administrativas')]; });
    if (r[0] !== '0,300,0,300' || r[1] !== null) throw new Error(JSON.stringify(r));
  });
  await passo('grupo da empresa com conta não se apaga; vazio, apaga e a conta volta a ficar sem grupo', async () => {
    const gid = await page.evaluate(() => gruposDespesa().find(g => g[1] === 'Veículos e combustível')[0]);
    await page.evaluate(g => abrirGrupoPlanoForm(g), gid);
    if (!(await page.locator('#modalFoot .btn-outline-danger').isDisabled())) throw new Error('deixou apagar grupo com conta');
    const r = await page.evaluate(g => {
      closeModal(); const cid = db.categorias.find(c => c.nome === 'Combustível').id;
      setConfig({ gruposBalancete: Object.assign({}, db.config.gruposBalancete, { [cid]: '' }) });
      excluirGrupoPlano(g);
      return { existe: gruposDespesa().some(x => x[0] === g), grupoConta: grupoDaCategoria(cid), linha: bal().linha('Despesas administrativas') };
    }, gid);
    if (r.existe || r.grupoConta !== '') throw new Error(JSON.stringify(r));
  });
  await passo('conta desativada some do lançamento, continua no balancete e não se exclui em uso', async () => {
    await page.evaluate(() => abrirCategoriaForm('cx'));
    await page.uncheck('#ctAtiva'); await page.click('#modalFoot .btn-primary');
    const r = await page.evaluate(() => {
      abrirCustoForm(null, { emp: null }); const opts = [...document.querySelectorAll('#cuCat option')].map(o => o.textContent); const grupos = [...document.querySelectorAll('#cuCat optgroup')].map(o => o.label); closeModal();
      abrirCustoForm('c4'); const atual = document.getElementById('cuCat').selectedOptions[0].textContent; closeModal();
      excluirCategoria('cx');
      return { opts, grupos, atual, inativas: db.config.contasInativas, ainda: !!getCategoria('cx'), linha: bal().linha('Café e copa') };
    });
    if (r.opts.includes('Café e copa') || !r.grupos.includes('Folha de pagamento')) throw new Error('lançamento: ' + r.opts.join('|').slice(0, 200));
    if (r.atual !== 'Café e copa (desativada)') throw new Error('a despesa antiga perdeu a conta: ' + r.atual);
    if (r.inativas.join() !== 'cx' || !r.ainda || r.linha !== '0,300,0,300') throw new Error(JSON.stringify(r));
  });
  await passo('Centros de custo: Administração e empreendimentos automáticos; criar "Comercial" pela tela', async () => {
    await abrirCad('centros');
    const antes = await page.locator('#av-cadastros').innerText();
    if (!/Administração/.test(antes) || !antes.includes('Jardim das Águas')) throw new Error(antes.slice(0, 300));
    await page.click('#av-cadastros button:has-text("Novo centro")');
    await page.fill('#ccNome', 'Comercial'); await page.click('#modalFoot .btn-primary');
    await page.click('#av-cadastros button:has-text("Novo centro")');
    await page.fill('#ccNome', 'administração'); await page.click('#modalFoot .btn-primary');
    const r = await page.evaluate(() => { const ok = !!document.getElementById('ccNome'); closeModal(); return { ok, lista: centrosCusto().map(c => c.nome) }; });
    if (!r.ok || r.lista.join() !== 'Comercial') throw new Error('aceitou nome repetido ou não criou: ' + JSON.stringify(r));
  });
  await passo('lançar despesa da empresa no Comercial: guarda o centro, mostra na lista e filtra', async () => {
    await page.evaluate(() => { state.filters.custos = { status: 'all', cat: 'all', mes: 'all', busca: '' }; state.escopo = ''; switchTab('custos'); });
    await page.click('#av-custos button:has-text("Lançar")');
    const opts = await page.locator('#cuEmp option').allInnerTexts();
    if (!opts.includes('Empresa · Comercial') || !opts.some(o => /Administração/.test(o))) throw new Error(opts.join('|'));
    const cc = await page.evaluate(() => centrosCusto()[0].id);
    await page.selectOption('#cuEmp', 'c:' + cc);
    if (await page.locator('#cuImovelBox').isVisible()) throw new Error('centro da empresa abriu a escolha de imóvel');
    await page.fill('#cuDesc', 'Stand de vendas'); await page.selectOption('#cuCat', 'marketing'); await page.fill('#cuValor', '1200');
    await page.fill('#cuComp', '2026-03-05'); await page.selectOption('#cuStatus', 'pago'); await page.fill('#cuDataPg', '2026-03-06');
    await page.click('#modalFoot .btn-primary');
    const r = await page.evaluate(cc => {
      const c = db.custos.find(x => x.descricao === 'Stand de vendas');
      const tag = [...document.querySelectorAll('#av-custos .item')].find(i => /Stand de vendas/.test(i.textContent)).querySelector('.vinc').textContent;
      state.filters.custos.centro = cc; renderCustos();
      const so = [...document.querySelectorAll('#av-custos .item .title')].map(t => t.textContent.trim());
      state.filters.custos.centro = CENTRO_ADM; renderCustos();
      const adm = [...document.querySelectorAll('#av-custos .item .title')].map(t => t.textContent.trim());
      state.filters.custos.centro = '';
      return { c, tag, so, adm };
    }, cc);
    if (r.c.centroId !== cc || r.c.loteamentoId !== null || r.tag !== 'Empresa · Comercial') throw new Error(JSON.stringify(r).slice(0, 300));
    if (r.so.length !== 1 || !/Stand de vendas/.test(r.so[0])) throw new Error('filtro Comercial: ' + r.so.join('|'));
    if (r.adm.some(t => /Stand|Terraplanagem/.test(t)) || !r.adm.some(t => /^c3/.test(t))) throw new Error('filtro Administração: ' + r.adm.join('|'));
  });
  await passo('despesa sem centro não manda o campo novo (banco sem o schema novo continua lançando)', async () => {
    const r = await page.evaluate(() => {
      abrirCustoForm(null, { emp: null });
      document.getElementById('cuDesc').value = 'Contador'; document.getElementById('cuValor').value = '600'; salvarCusto('');
      const c = db.custos.find(x => x.descricao === 'Contador');
      const cc = centrosCusto()[0].id;
      abrirCustoForm(db.custos.find(x => x.descricao === 'Stand de vendas').id); document.getElementById('cuEmp').value = ''; salvarCusto(db.custos.find(x => x.descricao === 'Stand de vendas').id);
      const s = db.custos.find(x => x.descricao === 'Stand de vendas');
      const res = { semCampo: !('centroId' in c), voltou: s.centroId === null && centroDoCusto(s) === CENTRO_ADM };
      upsert('custos', Object.assign({}, s, { centroId: cc }));
      removeRec('custos', c.id);
      return res;
    });
    if (!r.semCampo || !r.voltou) throw new Error(JSON.stringify(r));
  });
  await passo('balancete por centro de custo: uma coluna por centro, receita e comissão no empreendimento do contrato', async () => {
    const r = await page.evaluate(() => { const b = bal({ colunas: 'centro' }); return { head: b.head, rec: b.linha('Receita total'), com: b.linha('Comissões de corretores'), com2: b.linha('Comercial e marketing'), folha: b.linha('Folha de pagamento'), desp: b.linha('Despesa total'), res: b.linha('Resultado do período: lucro'), titulo: b.rel.titulo, html: b.rel.html }; });
    const s = JSON.stringify(r).slice(0, 400);
    const n1 = await page.evaluate(() => N1);
    if (r.head !== `Conta,${n1},Jardim das Águas,Administração,Comercial,Total,% da receita`) throw new Error('colunas ' + r.head);
    if (r.rec !== '20000,8000,0,0,28000' || r.com !== '3000,0,0,0,3000' || r.com2 !== '0,0,0,1200,1200' || r.folha !== '0,0,4000,0,4000') throw new Error(s);
    if (r.desp !== '12000,1000,4550,1200,18750' || r.res !== '8000,7000,-4550,-1200,9250') throw new Error(s);
    if (!/por centro de custo/.test(r.titulo) || !/Cada coluna é um centro de custo/.test(r.html)) throw new Error(s);
  });
  await passo('balancete filtrado num centro da empresa: só as despesas dele, sem receita', async () => {
    const r = await page.evaluate(() => { const cc = centrosCusto()[0].id; const b = bal({ centro: cc }); const a = bal({ centro: CENTRO_ADM }); return { rec: b.linha('Receita total'), desp: b.linha('Despesa total'), titulo: b.rel.titulo, html: b.rel.html, adm: a.linha('Despesa total') }; });
    if (r.rec !== null && r.rec !== '0,0,0,0' && r.rec !== '0') throw new Error('receita no centro: ' + r.rec);
    if (!/1200/.test(String(r.desp).replace(/\D/g, '')) || !/Comercial/.test(r.titulo) || !/Só o centro de custo/.test(r.html)) throw new Error(JSON.stringify(r).slice(0, 300));
    if (r.adm.split(',').pop() !== '4550') throw new Error('Administração: ' + r.adm);
  });
  await passo('na tela: escolher colunas por centro e o filtro de centro', async () => {
    await page.evaluate(() => { Object.assign(relState(), { tipo: 'balancete', regime: 'caixa', de: '2026-01-01', ate: '2026-03-31', centro: '', colunas: 'mes' }); state.escopo = ''; switchTab('relatorios'); });
    await page.selectOption('#relColunas', 'centro'); await page.waitForTimeout(150);
    const th = await page.locator('.tbl-balancete thead th').allTextContents();
    if (!th.includes('Comercial') || !th.includes('Administração')) throw new Error(th.join('|'));
    const opts = await page.locator('#relCentro option').allInnerTexts();
    if (opts.join('|') !== 'Todos (empresa inteira)|Administração|Comercial') throw new Error(opts.join('|'));
    await page.evaluate(() => { state.escopo = L1; renderRelatorios(); });
    if (await page.locator('#relCentro').count()) throw new Error('filtro de centro da empresa apareceu com empreendimento escolhido');
    await page.evaluate(() => { state.escopo = ''; relState().colunas = 'mes'; });
  });
  await passo('relatório de despesas: agrupar por centro de custo e por grupo do plano; CSV com as duas colunas', async () => {
    const r = await page.evaluate(() => {
      Object.assign(relState(), { tipo: 'despesas', de: '2026-01-01', ate: '2026-03-31', agrupar: 'centro', status: 'todos', categoria: '', fornecedor: '', base: 'competencia' });
      const a = relDespesas(''); const ga = [...a.html.matchAll(/<b>([^<]+)<\/b>/g)].map(m => m[1]);
      relState().agrupar = 'grupo'; const b = relDespesas(''); const gb = [...b.html.matchAll(/<b>([^<]+)<\/b>/g)].map(m => m[1]);
      const stand = b.csv.find(l => l[3] === 'Stand de vendas');
      return { ga, gb, head: b.csvHead, stand };
    });
    if (!r.ga.includes('Comercial') || !r.ga.includes('Administração') || !r.ga.includes('Jardim das Águas')) throw new Error('centros: ' + r.ga.join('|'));
    if (!r.gb.includes('Comercial e marketing') || !r.gb.includes('Folha de pagamento')) throw new Error('grupos: ' + r.gb.join('|'));
    if (r.head[5] !== 'Grupo' || r.head[8] !== 'Centro de custo' || r.stand[5] !== 'Comercial e marketing' || r.stand[8] !== 'Comercial') throw new Error(JSON.stringify(r.stand));
  });
  await passo('centro desativado some do lançamento; em uso não se exclui', async () => {
    const r = await page.evaluate(() => {
      const cc = centrosCusto()[0].id; abrirCentroForm(cc); document.getElementById('ccAtivo').checked = false; salvarCentro(cc);
      abrirCustoForm(null, { emp: null }); const opts = [...document.querySelectorAll('#cuEmp option')].map(o => o.textContent); closeModal();
      const s = db.custos.find(x => x.descricao === 'Stand de vendas'); abrirCustoForm(s.id); const atual = val('cuEmp'); closeModal();
      excluirCentro(cc);
      return { opts, atual, cc, ainda: !!getCentro(cc), ativo: getCentro(cc).ativo };
    });
    if (r.opts.some(o => /Comercial/.test(o)) || r.atual !== 'c:' + r.cc || !r.ainda || r.ativo !== false) throw new Error(JSON.stringify(r));
  });
  await browser.close();
  if (erros.length) { console.log('\nERROS:\n' + erros.join('\n')); process.exit(1); }
  console.log('\nTudo certo.');
})();
