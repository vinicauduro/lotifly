// Redesenho inspirado no ERP de locação (crítica de 19/10): lista de contratos em linhas (próximo
// vencimento e selo só na exceção, nº do contrato, imóvel, comprador, parcelas, valor com saldo e
// atraso), ordem por urgência, faixa de situação em que o número é o filtro; busca geral (Ctrl+K)
// que abre contrato, cliente, lote, imóvel e tela; título em cada tela; barra das parcelas do mês
// (recebido, a vencer, em atraso) que abre a lista certa; A pagar com a lista antes do gráfico e
// sem lixeira na linha; menu sem "Novo contrato". Relógio fixo em 19/10/2026.
// Rodar: BASE=http://127.0.0.1:8765/gestao/ node testes/lista-contratos.test.js
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
  await page.clock.setFixedTime(new Date('2026-10-19T12:00:00'));
  await page.goto(BASE + 'index.html?dados=exemplo'); await page.waitForFunction(() => window.PiorCaso && db.loteamentos.length); await page.waitForTimeout(300);
  await page.evaluate(() => {
    sessionStorage.setItem('gl_admin', '1'); startRole('admin'); document.querySelectorAll('#devDados,.toast').forEach(e => e.remove());
    const L = db.loteamentos[0].id; window.L = L;
    const lote = (id, q, n) => ({ id, loteamentoId: L, quadra: q, numero: n, status: 'vendido', preco: 100000, area: 360 });
    db.lotes = db.lotes.concat([lote('t1', 'T', '1'), lote('t2', 'T', '2'), lote('t3', 'T', '3'), lote('t4', 'T', '4'), lote('t5', 'T', '5')]);
    const v = (id, num, cliente, loteId, extra) => Object.assign({ id, numeroContrato: num, loteamentoId: L, loteId, cliente: { nome: cliente }, corretor: { nome: 'Juliana Prado' }, valorTotal: 100000, entrada: 0, nParcelas: 3, valorParcela: 1000, dataVenda: '2026-01-10', status: 'ativa' }, extra);
    db.vendas = [
      v('emdia', '0001/2026', 'Ana Em Dia', 't1', { dataVenda: '2026-09-01' }),
      v('atrasado', '0002/2026', 'Bruno Atrasado', 't2', { valorTotal: 90000 }),
      v('vence', null, 'Carla Vence Logo', 't3', { valorTotal: 120000 }),
      v('quitado', '0003/2026', 'Davi Quitado', 't4', { valorTotal: 50000, status: 'quitada' }),
      v('distrato', '0004/2026', 'Eva Distrato', 't5', { valorTotal: 70000, status: 'distrato', distratoEm: '2026-10-05' })
    ];
    const r = (id, venda, venc, valor, pago, dataPg) => ({ id, vendaId: venda, loteamentoId: L, tipo: 'parcela', numero: 1, descricao: 'Parcela', vencimento: venc, valor, valorPago: pago || 0, dataPagamento: dataPg || null });
    db.recebiveis = [
      r('e1', 'emdia', '2026-10-10', 1000, 1000, '2026-10-09'), r('e2', 'emdia', '2026-11-10', 1000),
      r('a1', 'atrasado', '2026-09-01', 1000), r('a2', 'atrasado', '2026-10-15', 1000), r('a3', 'atrasado', '2026-11-15', 1000),
      r('v1', 'vence', '2026-10-21', 2000),
      r('q1', 'quitado', '2026-08-01', 5000, 5000, '2026-08-01'),
      r('d1', 'distrato', '2026-10-20', 7000)
    ];
    db.clientes = [{ id: 'cl1', nome: 'Bruno Atrasado', cpf: '123.456.789-09', cidade: 'Cocal do Sul' }];
    state.escopo = ''; state.filters.avendas = null;
  });

  await passo('situação de cada contrato: atrasado (dias desde a parcela mais antiga), em dia, vence logo, quitado, distrato', async () => {
    const r = await page.evaluate(() => db.vendas.map(x => { const s = situacaoContrato(x); return [x.id, s.tipo, s.dias || '', s.diasPara ?? '', seloContrato(s).replace(/<[^>]+>/g, '')].join(':'); }).join('|'));
    if (r !== 'emdia:emdia::22:|atrasado:atrasado:48::Atrasado há 48 dias|vence:emdia::2:Vence em 2 dias|quitado:quitado:::Quitado|distrato:distrato:::Distrato') throw new Error(r);
  });
  await passo('Contratos: título, faixa de situação com contagem e valor, lista na ordem de urgência', async () => {
    await page.evaluate(() => switchTab('vendas'));
    const r = await page.evaluate(() => ({
      tit: document.querySelector('#av-vendas .pg-tit').textContent,
      faixa: [...document.querySelectorAll('#av-vendas .st-item')].map(b => b.querySelector('.st-n').textContent + ' ' + b.querySelector('.st-l').textContent + ' ' + b.querySelector('.st-v').textContent).join(' | '),
      ordem: [...document.querySelectorAll('#av-vendas .ct-row')].map(x => x.querySelector('.ct-pessoa').textContent.trim()),
      semnum: (document.querySelector('#av-vendas .st-semnum') || {}).textContent,
      fab: document.getElementById('fab').classList.contains('show'),
      resumo: document.querySelector('#av-vendas .ct-resumo').textContent
    }));
    if (r.tit !== 'Contratos') throw new Error('título ' + r.tit);
    const esperado = '5 Todos R$ 6.000,00 a receber | 2 Em dia R$ 3.000,00 a receber | 1 Atrasados R$ 2.000,00 em atraso | 1 Quitados R$ 50 mil vendido | 1 Distratos R$ 70 mil vendido';
    if (r.faixa.replace(/\s+/g, ' ') !== esperado) throw new Error('faixa: ' + r.faixa);
    if (r.ordem.join() !== 'Bruno Atrasado,Carla Vence Logo,Ana Em Dia,Davi Quitado,Eva Distrato') throw new Error('ordem: ' + r.ordem.join());
    if (r.semnum !== '1 sem número' || r.fab) throw new Error(JSON.stringify(r));
    if (!/Em out\/26: 0 contratos novos · 1 distrato/.test(r.resumo.replace(/\s+/g, ' '))) throw new Error('resumo: ' + r.resumo);
  });
  await passo('linha do contrato: vencimento e selo, nº, imóvel, comprador, parcelas, valor com saldo e atraso', async () => {
    const t = await page.evaluate(() => [...document.querySelectorAll('#av-vendas .ct-row')].map(x => x.innerText.replace(/\s+/g, ' ').trim()));
    const atr = t[0], vence = t[1], emdia = t[2], quit = t[3];
    for (const s of ['venceu 01/09/2026', 'Atrasado há 48 dias', 'Contrato 0002/2026', 'Quadra T · Lote 2', 'Bruno Atrasado', 'Juliana Prado', 'vendido em 10/01/2026', '0 de 3 parcelas', '3× R$ 1.000,00', 'R$ 90.000,00', 'saldo R$ 3.000,00', 'R$ 2.000,00 em atraso'])
      if (!atr.includes(s)) throw new Error(`atrasado sem "${s}": ${atr}`);
    if (!vence.includes('Sem nº') || !vence.includes('próxima 21/10/2026') || !vence.includes('Vence em 2 dias')) throw new Error('vence: ' + vence);
    if (!emdia.includes('próxima 10/11/2026') || /Vence|Atrasado/.test(emdia) || !emdia.includes('1 de 2 parcelas')) throw new Error('em dia: ' + emdia);
    if (!quit.includes('Quitado') || quit.includes('saldo')) throw new Error('quitado: ' + quit);
  });
  await passo('o número da faixa é o filtro; "sem número" filtra e volta; outras ordens', async () => {
    await page.click('#av-vendas .st-item.st-atrasado');
    let n = await page.evaluate(() => [...document.querySelectorAll('#av-vendas .ct-row .ct-pessoa')].map(x => x.textContent.trim()).join());
    if (n !== 'Bruno Atrasado' || !(await page.evaluate(() => document.querySelector('#av-vendas .st-item.st-atrasado').getAttribute('aria-pressed') === 'true'))) throw new Error('atrasados: ' + n);
    await page.click('#av-vendas .st-semnum');
    n = await page.evaluate(() => [...document.querySelectorAll('#av-vendas .ct-row .ct-pessoa')].map(x => x.textContent.trim()).join());
    if (n !== 'Carla Vence Logo') throw new Error('sem número: ' + n);
    await page.click('#av-vendas .st-item.st-all');
    await page.selectOption('#av-vendas select[aria-label="Ordem da lista"]', 'valor');
    n = await page.evaluate(() => [...document.querySelectorAll('#av-vendas .ct-row .ct-pessoa')].map(x => x.textContent.trim()).join());
    if (n !== 'Carla Vence Logo,Ana Em Dia,Bruno Atrasado,Eva Distrato,Davi Quitado') throw new Error('por valor: ' + n);
    await page.selectOption('#av-vendas select[aria-label="Ordem da lista"]', 'numero');
    n = await page.evaluate(() => [...document.querySelectorAll('#av-vendas .ct-row .ct-num')].map(x => x.textContent.trim()).join());
    if (n !== 'Contrato 0001/2026,Contrato 0002/2026,Contrato 0003/2026,Contrato 0004/2026,Sem nº') throw new Error('por número: ' + n);
    await page.selectOption('#av-vendas select[aria-label="Ordem da lista"]', 'urgencia');
  });
  await passo('busca geral: Ctrl+K abre, acha contrato pelo número, cliente pelo CPF, lote por "quadra t lote 3" e tela; Enter abre', async () => {
    await page.keyboard.press('Control+k');
    await page.locator('#buscaGeral').waitFor();
    await page.fill('#buscaGeral', '0002/2026');
    let r = await page.evaluate(() => [...document.querySelectorAll('#buscaRes .busca-item')].map(x => x.innerText.replace(/\s+/g, ' ')));
    if (!r[0] || !r[0].includes('Contrato 0002/2026 · Bruno Atrasado')) throw new Error('contrato: ' + r.join(' | '));
    await page.fill('#buscaGeral', '12345678909');
    r = await page.evaluate(() => [...document.querySelectorAll('#buscaRes .busca-grupo')].map(x => x.textContent));
    if (!r.includes('Clientes')) throw new Error('cliente pelo CPF: ' + r.join());
    await page.fill('#buscaGeral', 'quadra t lote 3');
    r = await page.evaluate(() => [...document.querySelectorAll('#buscaRes .busca-item .busca-tit')].map(x => x.textContent));
    if (r[0] !== 'Contrato sem nº · Carla Vence Logo' || !r.includes('Quadra T · Lote 3')) throw new Error('lote: ' + r.join(' | '));
    await page.fill('#buscaGeral', 'quadra t');
    r = await page.evaluate(() => [...document.querySelectorAll('#buscaRes .busca-item .busca-tit')].map(x => x.textContent));
    if (r.filter(t => /^Contrato/.test(t)).length !== 5) throw new Error('quadra t: ' + r.join(' | '));
    await page.fill('#buscaGeral', 'quadra b');
    r = await page.evaluate(() => [...document.querySelectorAll('#buscaRes .busca-item .busca-tit')].map(x => x.textContent));
    if (r.some(t => /^Contrato/.test(t))) throw new Error('"quadra b" achou contrato da quadra T: ' + r.join(' | '));
    await page.fill('#buscaGeral', 'a pagar');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => state.tab === 'custos' && !document.getElementById('modalOverlay').classList.contains('open'));
    await page.keyboard.press('Control+k'); await page.fill('#buscaGeral', 'bruno');
    await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowUp');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => state.tab === 'contrato' && state.contratoId === 'atrasado');
  });
  await passo('títulos nas telas do menu; menu sem "Novo contrato"; badge de reservas neutro', async () => {
    const r = await page.evaluate(() => {
      const t = {}; ['recebiveis', 'cobranca', 'custos', 'clientes', 'reservas', 'cadastros'].forEach(x => { switchTab(x); const h = document.querySelector('#av-' + x + ' > .pg-head .pg-tit'); t[x] = h ? h.textContent : ''; });
      return { t, novo: !!document.getElementById('aNovoContrato'), neutro: document.getElementById('aBadgeReservas').classList.contains('neutro'), menu: document.querySelector('[data-tab="vendas"]').textContent.trim() };
    });
    if (JSON.stringify(r.t) !== JSON.stringify({ recebiveis: 'A receber', cobranca: 'Cobrança', custos: 'A pagar', clientes: 'Clientes', reservas: 'Reservas', cadastros: 'Configurações' })) throw new Error(JSON.stringify(r.t));
    if (r.novo || !r.neutro || r.menu !== 'Contratos') throw new Error(JSON.stringify(r));
  });
  await passo('barra das parcelas do mês: recebido, a vencer e em atraso de outubro, e cada parte abre a lista certa', async () => {
    await page.evaluate(() => switchTab('painel'));
    const c = await page.evaluate(() => { const c = cobrancasDoMes(''); return [c.recebido, c.aVencer, c.atraso, c.nRec, c.nVen, c.nAtr].join(); });
    // outubro: e1 pago 1000; a2 (15/10) 1000 atrasado; v1 (21/10) 2000 a vencer; d1 é de distrato e não entra
    if (c !== '1000,2000,1000,1,1,1') throw new Error(c);
    const t = (await page.locator('#av-painel .bm').innerText()).replace(/\s+/g, ' ');
    for (const s of ['Parcelas de out/26', 'R$ 4.000,00', 'Recebido R$ 1.000,00 1 parcela · 25,0%', 'A vencer R$ 2.000,00 1 parcela', 'Em atraso no mês R$ 1.000,00 1 parcela · 25,0% das parcelas do mês em atraso'])
      if (!t.includes(s)) throw new Error(`faltou "${s}" em ${t}`);
    await page.click('#av-painel .bm-leg:has-text("A vencer")');
    let l = await page.evaluate(() => ({ tab: state.tab, ids: [...document.querySelectorAll('#av-recebiveis .item')].length, txt: document.querySelector('#av-recebiveis p.small').textContent.replace(/\s+/g, ' ') }));
    if (l.tab !== 'recebiveis' || l.ids !== 1 || !/R\$ 2\.000,00 · a vencer em out\/26/.test(l.txt)) throw new Error(JSON.stringify(l));
    await page.evaluate(() => switchTab('painel'));
    await page.click('#av-painel .bm-seg.atr');
    l = await page.evaluate(() => ({ n: document.querySelectorAll('#av-recebiveis .item').length, txt: document.querySelector('#av-recebiveis p.small').textContent.replace(/\s+/g, ' ') }));
    if (l.n !== 1 || !/R\$ 1\.000,00 · vencidas em out\/26 e não pagas/.test(l.txt)) throw new Error('atraso do mês: ' + JSON.stringify(l));
    const cob = await page.evaluate(() => { switchTab('cobranca'); return !document.querySelector('#av-cobranca .bm') && [...document.querySelectorAll('#av-cobranca .st-item:not(.st-zero) .st-l')].map(c => c.textContent.trim()); });
    if (!cob || cob.join() !== 'Todos,31-60 dias') throw new Error('cobrança: ' + JSON.stringify(cob));
  });
  await passo('A pagar: a lista vem antes do gráfico; sem lixeira na linha; excluir fica dentro da despesa', async () => {
    const r = await page.evaluate(() => {
      db.custos = [{ id: 'k1', descricao: 'Contador', categoriaId: 'administrativo', valor: 900, loteamentoId: null, dataCompetencia: '2026-10-01', vencimento: '2026-10-30', status: 'pendente' }];
      state.filters.custos = null; switchTab('custos');
      const lista = document.querySelector('#av-custos .item'), graf = document.getElementById('chartCustos');
      return { antes: !!(lista && graf && (lista.compareDocumentPosition(graf) & Node.DOCUMENT_POSITION_FOLLOWING)), lixeira: document.querySelectorAll('#av-custos .item .btn-icon.del').length, pagar: document.querySelectorAll('#av-custos .item .btn-icon.ok').length };
    });
    if (!r.antes || r.lixeira || r.pagar !== 1) throw new Error(JSON.stringify(r));
    await page.evaluate(() => abrirCustoForm('k1'));
    if (!(await page.locator('#modalFoot .btn-outline-danger:has-text("Excluir")').count())) throw new Error('sem Excluir dentro da despesa');
    await page.evaluate(() => closeModal());
  });
  await passo('celular: faixa de situação cabe na tela, linha com valor no alto e sem rolagem lateral', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    const r = await page.evaluate(() => { switchTab('vendas'); const f = document.querySelector('#av-vendas .st-faixa').getBoundingClientRect(); const row = document.querySelector('#av-vendas .ct-row'); const v = row.querySelector('.ct-valor').getBoundingClientRect(), id = row.querySelector('.ct-id').getBoundingClientRect(); return { larg: f.width, sw: document.documentElement.scrollWidth, iw: innerWidth, valorAcima: v.top < id.top }; });
    if (r.sw > r.iw || r.larg > r.iw || !r.valorAcima) throw new Error(JSON.stringify(r));
    await page.setViewportSize({ width: 1280, height: 900 });
  });
  await browser.close();
  if (erros.length) { console.log('\nERROS:\n' + erros.join('\n')); process.exit(1); }
  console.log('\nTudo certo.');
})();
