// Relatórios › Balancete: resultado do período com receitas, despesas por grupo (obra, folha,
// comissões, administrativas…) e lucro ou prejuízo. Números montados à mão e conferidos à mão,
// nos dois regimes (caixa e competência), mais: grupo da categoria trocado pelo dono, categoria
// do usuário sem grupo, filtro por empreendimento, colunas por mês e por ano, categorias novas
// para quem já usa o sistema, tela, impressão e CSV.
// Rodar: BASE=http://127.0.0.1:8765/gestao/ node testes/balancete.test.js
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
  page.on('pageerror', e => erros.push(`pageerror: ${e.message}`)); page.on('dialog', d => d.accept()); await responderConfirmacoes(page);
  await page.goto(BASE + 'index.html?dados=exemplo'); await page.waitForFunction(() => window.PiorCaso && db.loteamentos.length); await page.waitForTimeout(300);
  await page.evaluate(() => {
    sessionStorage.setItem('gl_admin', '1'); startRole('admin'); document.querySelectorAll('#devDados,.toast').forEach(e => e.remove());
    const L1 = db.loteamentos[0].id;
    window.L1 = L1;
    db.categorias.push({ id: 'cx', nome: 'Café e copa', cor: '#999999' }, { id: 'cy', nome: 'Topografia', cor: '#888888' });
    const v = (id, extra) => Object.assign({ id, loteamentoId: L1, loteId: null, cliente: { nome: 'Comprador ' + id }, corretor: { nome: 'Corretor' }, valorTotal: 100000, dataVenda: '2026-01-15', status: 'ativa', comissaoValor: 0, comissaoPaga: false, comissaoData: null }, extra);
    db.vendas = [v('v1', { comissaoValor: 5000, comissaoPaga: true, comissaoData: '2026-02-10' }), v('v2', { status: 'distrato', distratoEm: '2026-02-01' })];
    const r = (id, venda, tipo, valor, venc, pago, dataPg) => ({ id, vendaId: venda, loteamentoId: L1, tipo, numero: 1, descricao: tipo, vencimento: venc, valor, valorPago: pago || 0, dataPagamento: dataPg || null });
    db.recebiveis = [
      r('r1', 'v1', 'entrada', 20000, '2026-01-15', 20000, '2026-01-15'),
      r('r2', 'v1', 'parcela', 1000, '2026-02-15', 1050, '2026-02-20'),          // pago com 50 de juros
      r('r3', 'v1', 'parcela', 1000, '2026-03-15'),                              // em aberto
      r('r4', 'v1', 'balao', 5000, '2026-03-01', 5000, '2026-03-01'),
      r('r5', 'v2', 'entrada', 3000, '2026-01-10', 3000, '2026-01-10'),          // contrato que virou distrato
      r('r6', 'v1', 'taxa', 800, '2026-02-01', 800, '2026-02-01')                // taxa de cessão
    ];
    const c = (id, cat, valor, emp, comp, pago) => ({ id, categoriaId: cat, valor, loteamentoId: emp, descricao: id, dataCompetencia: comp, vencimento: comp, status: pago ? 'pago' : 'pendente', dataPagamento: pago || null });
    db.custos = [
      c('c1', 'folha', 10000, null, '2026-01-31', '2026-02-05'),
      c('c2', 'pro-labore', 5000, null, '2026-02-05', '2026-02-05'),
      c('c3', 'terraplanagem', 30000, L1, '2026-01-10', '2026-01-12'),
      c('c4', 'cx', 700, null, '2026-03-03', '2026-03-03'),                     // categoria do usuário, da empresa
      c('c5', 'cy', 900, L1, '2026-03-04', '2026-03-04'),                       // categoria do usuário, de empreendimento
      c('c6', 'administrativo', 2000, null, '2026-03-10', null),                // ainda não paga
      c('c7', 'devolucao-distrato', 1500, L1, '2026-03-20', '2026-03-20'),
      c('c8', 'tarifas-bancarias', 50, null, '2026-03-31', '2026-03-31'),
      c('c9', 'impostos', 400, null, '2026-04-02', '2026-04-02')                // fora do período
    ];
    db.config.gruposBalancete = {};
    window.bal = (regime, escopo, de = '2026-01-01', ate = '2026-03-31') => {
      Object.assign(relState(), { tipo: 'balancete', regime, de, ate });
      const rel = relBalancete(escopo || '');
      const linha = rot => { const l = rel.csv.find(x => x[0].trim() === rot); return l ? l.slice(1, -1).map(s => Math.round(Number(String(s).replace(/\./g, '').replace(',', '.')) * 100) / 100) : null; };
      return { rel, linha, csv: rel.csv, head: rel.csvHead };
    };
  });

  await passo('caixa: receitas por tipo, juros à parte, e o que entrou de contrato depois desfeito também conta', async () => {
    const r = await page.evaluate(() => { const b = bal('caixa'); return { head: b.head, ent: b.linha('Entradas (sinal)'), par: b.linha('Parcelas'), bal: b.linha('Reforços'), tax: b.linha('Taxas de cessão'), enc: b.linha('Correção, juros e multas'), tot: b.linha('Receita total') }; });
    const s = JSON.stringify(r);
    if (r.head.join() !== 'Conta,jan/26,fev/26,mar/26,Total,% da receita') throw new Error('colunas ' + r.head.join());
    if (r.ent.join() !== '23000,0,0,23000' || r.par.join() !== '0,1000,0,1000' || r.bal.join() !== '0,0,5000,5000' || r.tax.join() !== '0,800,0,800' || r.enc.join() !== '0,50,0,50' || r.tot.join() !== '23000,1850,5000,29850') throw new Error(s);
  });
  await passo('caixa: despesas por grupo, com folha (salários + pró-labore) separada e as categorias embaixo', async () => {
    const r = await page.evaluate(() => { const b = bal('caixa'); const g = n => (b.linha(n) || []).join(); return { obra: g('Custo das obras e dos imóveis'), terra: g('Terraplanagem'), topo: g('Topografia'), folha: g('Folha de pagamento'), sal: g('Folha de pagamento (salários e encargos)'), pl: g('Pró-labore'), com: g('Comissões de corretores'), adm: g('Despesas administrativas'), cafe: g('Café e copa'), fin: g('Despesas financeiras'), dev: g('Devoluções de distrato'), imp: g('Impostos e taxas'), tot: g('Despesa total'), res: g('Resultado do período: prejuízo'), ordem: b.csv.map(l => l[0].trim()) }; });
    const s = JSON.stringify(r);
    if (r.obra !== '30000,0,900,30900' || r.terra !== '30000,0,0,30000' || r.topo !== '0,0,900,900') throw new Error('obra ' + s);
    if (r.folha !== '0,15000,0,15000' || r.sal !== '0,10000,0,10000' || r.pl !== '0,5000,0,5000') throw new Error('folha ' + s);
    if (r.com !== '0,5000,0,5000' || r.adm !== '0,0,700,700' || r.cafe !== '0,0,700,700' || r.fin !== '0,0,50,50' || r.dev !== '0,0,1500,1500') throw new Error('demais ' + s);
    if (r.imp) throw new Error('imposto fora do período entrou');
    if (r.tot !== '30000,20000,3150,53150' || r.res !== '-7000,-18150,1850,-23300') throw new Error('totais ' + s);
    const i = n => r.ordem.indexOf(n);
    if (!(i('Receita total') < i('Custo das obras e dos imóveis') && i('Custo das obras e dos imóveis') < i('Terraplanagem') && i('Terraplanagem') < i('Folha de pagamento') && i('Despesa total') < i('Resultado do período: prejuízo'))) throw new Error('ordem ' + r.ordem.join(' | '));
  });
  await passo('caixa: avisa o que ficou de fora por não estar pago', async () => {
    const t = await page.evaluate(() => bal('caixa').rel.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '));
    if (!/Ficaram de fora.*R\$\s?2\.000,00 de despesas do período.*R\$\s?1\.000,00 a receber/.test(t)) throw new Error(t.slice(-500));
  });
  await passo('competência: receita pelo vencimento (sem o contrato desfeito), despesa pelo mês, paga ou não; comissão no mês da venda', async () => {
    const r = await page.evaluate(() => { const b = bal('competencia'); const g = n => (b.linha(n) || []).join(); return { rec: g('Receita total'), ent: g('Entradas (sinal)'), par: g('Parcelas'), enc: g('Correção, juros e multas'), adm: g('Despesas administrativas'), com: g('Comissões de corretores'), folha: g('Folha de pagamento'), tot: g('Despesa total'), titulo: b.rel.titulo }; });
    const s = JSON.stringify(r);
    if (r.ent !== '20000,0,0,20000' || r.par !== '0,1000,1000,2000' || r.enc || r.rec !== '20000,1800,6000,27800') throw new Error('receitas ' + s);
    if (r.adm !== '0,0,2700,2700' || r.com !== '5000,0,0,5000' || r.folha !== '10000,5000,0,15000' || r.tot !== '45000,5000,5150,55150') throw new Error('despesas ' + s);
    if (r.titulo !== 'Balancete (competência)') throw new Error(r.titulo);
  });
  await passo('o dono muda o grupo de uma categoria: "Café e copa" passa a ser folha', async () => {
    const r = await page.evaluate(() => { setConfig({ gruposBalancete: { cx: 'folha' } }); const b = bal('caixa'); const out = { folha: b.linha('Folha de pagamento').join(), adm: b.linha('Despesas administrativas') }; setConfig({ gruposBalancete: {} }); return out; });
    if (r.folha !== '0,15000,700,15700' || r.adm) throw new Error(JSON.stringify(r));
  });
  await passo('categoria de fábrica pode sair do grupo padrão e ir pelo vínculo', async () => {
    const r = await page.evaluate(() => { setConfig({ gruposBalancete: { terraplanagem: '' } }); const g = [grupoDaCategoria('terraplanagem'), grupoDoCusto(db.custos.find(c => c.id === 'c3'))]; setConfig({ gruposBalancete: {} }); return g; });
    if (r.join() !== ',obra') throw new Error(r.join());
  });
  await passo('só um empreendimento: despesas da empresa saem e a nota explica', async () => {
    const r = await page.evaluate(() => { const b = bal('caixa', L1); return { folha: b.linha('Folha de pagamento'), obra: b.linha('Custo das obras e dos imóveis').join(), html: b.rel.html.replace(/<[^>]+>/g, ' ') }; });
    if (r.folha || r.obra !== '30000,0,900,30900' || !/despesas da empresa sem empreendimento/.test(r.html)) throw new Error(JSON.stringify(r).slice(0, 300));
  });
  await passo('período de um mês mostra uma coluna; mais de 12 meses, uma coluna por ano', async () => {
    const r = await page.evaluate(() => ({ um: bal('caixa', '', '2026-02-01', '2026-02-28').head.join(), anos: (db.custos.push({ id: 'c10', categoriaId: 'impostos', valor: 100, loteamentoId: null, dataCompetencia: '2024-05-05', status: 'pago', dataPagamento: '2024-05-05' }), bal('caixa', '', '2000-01-01', '2099-12-31').head.join()) }));
    if (r.um !== 'Conta,Valor,% da receita' || r.anos !== 'Conta,2024,2025,2026,Total,% da receita') throw new Error(JSON.stringify(r));
    await page.evaluate(() => { db.custos = db.custos.filter(c => c.id !== 'c10'); });
  });
  await passo('na tela: escolher o balancete, trocar o regime, lucro/prejuízo nos cartões; imprime e exporta', async () => {
    await page.evaluate(() => { Object.assign(relState(), { tipo: 'balancete', regime: 'caixa', de: '2026-01-01', ate: '2026-03-31' }); state.escopo = ''; switchTab('relatorios'); });
    await page.locator('.tbl-balancete').waitFor();
    const kp = await page.locator('#av-relatorios .kpi').allInnerTexts();
    if (!/Prejuízo/.test(kp.join(' ')) || !/Margem/.test(kp.join(' '))) throw new Error(kp.join(' | '));
    if (await page.locator('.tbl-balancete .bal-res td.neg').count() < 1) throw new Error('resultado negativo não está em vermelho');
    await page.selectOption('#relRegime', 'competencia'); await page.waitForTimeout(150);
    if (!/competência/i.test(await page.locator('.bal-notas').innerText())) throw new Error('não trocou o regime');
    const csv = await page.evaluate(() => { let s = ''; const d = window.download; window.download = (n, c) => { s = n + '\n' + c; }; exportarRelatorioCSV(); window.download = d; return s; });
    if (!/^balancete-\(competência\)/.test(csv) || !/Resultado do período/.test(csv) || !/Folha de pagamento/.test(csv)) throw new Error(csv.slice(0, 200));
    const imp = await page.evaluate(() => { const p = window.print; window.print = () => {}; imprimirRelatorio(); window.print = p; return document.getElementById('printArea').innerHTML; });
    if (!/bal-res/.test(imp) || !/Balancete \(competência\)/.test(imp)) throw new Error('impressão sem o balancete');
  });
  await passo('quem já usa o sistema ganha as categorias Folha, Pró-labore e Tarifas, uma vez só', async () => {
    const r = await page.evaluate(() => {
      db.categorias = db.categorias.filter(c => !['folha', 'pro-labore', 'tarifas-bancarias'].includes(c.id)); db.config.categoriasCriadas = [];
      const n1 = migrarCategorias(); const tem = ['folha', 'pro-labore', 'tarifas-bancarias'].every(id => getCategoria(id));
      db.categorias = db.categorias.filter(c => c.id !== 'pro-labore');               // o dono apagou o pró-labore
      const n2 = migrarCategorias();
      return { n1, tem, n2, volta: !!getCategoria('pro-labore') };
    });
    if (r.n1 !== 3 || !r.tem || r.n2 !== 0 || r.volta) throw new Error(JSON.stringify(r));
  });
  await passo('Configurações › Plano de contas: escolher o grupo do balancete no formulário da conta', async () => {
    await page.evaluate(() => { abrirCategoriaForm('cx'); });
    const opts = await page.locator('#ctGrupo option').allInnerTexts();
    if (!opts.some(o => o === 'Folha de pagamento') || opts.some(o => /Comissões/.test(o))) throw new Error(opts.join(' | '));
    await page.selectOption('#ctGrupo', 'folha');
    await page.evaluate(() => salvarCategoria('cx'));
    const g = await page.evaluate(() => [grupoDaCategoria('cx'), db.config.gruposBalancete.cx].join());
    if (g !== 'folha,folha') throw new Error(g);
    await page.evaluate(() => { abrirCategoriaForm('terraplanagem'); });
    if (await page.evaluate(() => val('ctGrupo')) !== 'obra') throw new Error('terraplanagem não veio como obra');
    await page.evaluate(() => { salvarCategoria('terraplanagem'); });
    if ('terraplanagem' in (await page.evaluate(() => db.config.gruposBalancete))) throw new Error('guardou o grupo padrão sem precisar');
  });
  await browser.close();
  if (erros.length) { console.log('\nERROS:\n' + erros.join('\n')); process.exit(1); }
  console.log('\nTudo certo.');
})();
