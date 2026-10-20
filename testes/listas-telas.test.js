// Cobrança, Clientes e Reservas no mesmo desenho das outras listas: faixa no alto em que o número
// é o filtro, lista contínua com uma linha por item e o selo só na exceção. Contagem zerada fica
// neutra. Relógio fixo em 19/10/2026.
// Rodar: BASE=http://127.0.0.1:8765/gestao/ node testes/listas-telas.test.js
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
  await page.clock.setFixedTime(new Date('2026-10-19T12:00:00'));
  await page.goto(BASE + 'index.html?dados=exemplo'); await page.waitForFunction(() => window.PiorCaso && db.loteamentos.length); await page.waitForTimeout(300);
  await page.evaluate(() => {
    sessionStorage.setItem('gl_admin', '1'); startRole('admin'); document.querySelectorAll('#devDados,.toast').forEach(e => e.remove());
    const L = db.loteamentos[0].id;
    db.lotes = db.lotes.concat([1, 2, 3].map(n => ({ id: 'z' + n, loteamentoId: L, quadra: 'Z', numero: String(n), status: 'reservado', preco: 1, area: 1 })));
    db.vendas = [{ id: 'vz', numeroContrato: '0007/2026', loteamentoId: L, loteId: 'z1', cliente: { nome: 'Gustavo Lima', cpf: '12345678909' }, corretor: { nome: 'C' }, valorTotal: 10000, nParcelas: 4, valorParcela: 1000, dataVenda: '2026-01-01', status: 'ativa' }];
    const r = (id, venc, n) => ({ id, vendaId: 'vz', loteamentoId: L, tipo: 'parcela', numero: n, descricao: `Parcela ${n}/4`, vencimento: venc, valor: 1000, valorPago: 0, dataPagamento: null });
    db.recebiveis = [r('p1', '2026-08-10', 1), r('p2', '2026-09-10', 2), r('p3', '2026-11-10', 3)];
    db.cobrancas = [];
    db.clientes = [
      { id: 'c1', nome: 'Gustavo Lima', cpf: '12345678909', telefone: '47999990000', cidade: 'Rio do Sul', uf: 'SC' },
      { id: 'c2', nome: 'Helena Prado', cpf: '98765432100', telefone: '', cidade: 'Blumenau', uf: 'SC', profissao: 'Médica', estadoCivil: 'solteiro', rg: '123', endereco: 'Rua A, 1', numero: '1', bairro: 'Centro', cep: '89160000', email: 'h@x.com', nacionalidade: 'brasileira', dataNascimento: '1980-01-01' }
    ];
    const res = (id, lote, status, validade, cliente, valor, criado) => ({ id, loteamentoId: L, loteId: lote, status, validade, dataReserva: '2026-10-10', criadoEm: criado, cliente: { nome: cliente }, corretor: { nome: 'Ana Paula Souza', imobiliaria: 'Souza Imóveis' }, proposta: { valor, entrada: valor / 10, nParcelas: 60 } });
    db.reservas = [res('r1', 'z1', 'pendente', '2026-10-25', 'Lucas Pereira', 100000, '3'), res('r2', 'z2', 'aprovada', '2026-10-20', 'Juliana Rocha', 200000, '2'), res('r3', 'z3', 'aprovada', '2026-10-15', 'Marcos Dias', 50000, '1')];
    state.escopo = ''; state.filters.cob = null; state.filters.clientes = null; state.filters.ares = null;
  });

  await passo('Cobrança: faixa por dias de atraso, zerada fica neutra; sem os cartões antigos', async () => {
    await page.evaluate(() => switchTab('cobranca'));
    const f = await page.evaluate(() => [...document.querySelectorAll('#av-cobranca .st-item')].map(b => b.innerText.replace(/\s+/g, ' ').trim() + (b.classList.contains('st-zero') ? ' (zero)' : '')).join(' | '));
    if (!/^1 Todos R\$ 2\.000,00 \| 0 1-15 dias — \(zero\) \| 0 16-30 dias — \(zero\) \| 0 31-60 dias — \(zero\) \| 1 61-90 dias R\$ 2\.000,00 \| 0 90\+ dias — \(zero\)$/.test(f)) throw new Error(f);
    if (await page.locator('#av-cobranca .kpi').count()) throw new Error('os cartões antigos continuam');
    const resumo = (await page.locator('#av-cobranca .ct-resumo').innerText()).replace(/\s+/g, ' ');
    if (!/Em atraso R\$ 2\.000,00 em 1 contrato/.test(resumo) || !/1 nunca cobrado/.test(resumo)) throw new Error(resumo);
  });
  await passo('Cobrança: linha com desde quando, dias de atraso, cliente, contrato, valor e as ações', async () => {
    const t = await page.evaluate(() => document.querySelector('#av-cobranca .item.linha').innerText.replace(/\s+/g, ' '));
    for (const s of ['venceu 10/08/2026', '70 dias de atraso', 'Gustavo Lima', 'Contrato 0007/2026 · 2 parcelas em atraso', 'Quadra Z · Lote 1', 'Ainda não foi cobrado', 'Cobrar', 'Acordo']) if (!t.includes(s)) throw new Error(`faltou "${s}": ${t}`);
    await page.click('#av-cobranca .st-item.st-zero >> nth=0');
    if (await page.locator('#av-cobranca .item.linha').count()) throw new Error('faixa vazia mostrou linha');
    await page.click('#av-cobranca .st-semnum');
    if (await page.locator('#av-cobranca .item.linha').count() !== 1) throw new Error('"nunca cobrado" não filtrou');
  });
  await passo('Clientes: faixa Todos, Com contrato, Sem contrato e Falta dado; linha com CPF, telefone, cidade e WhatsApp', async () => {
    await page.evaluate(() => switchTab('clientes'));
    const f = await page.evaluate(() => [...document.querySelectorAll('#av-clientes .st-item .st-n')].map(b => b.textContent).join());
    if (f !== '2,1,1,1') throw new Error(f);
    const t = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('#av-clientes .item.linha')].map(x => [x.querySelector('.title').textContent.split(' ')[0], x.innerText.replace(/\s+/g, ' ')])));
    if (!t.Gustavo || !t.Gustavo.includes('123.456.789-09') || !t.Gustavo.includes('Rio do Sul/SC') || !t.Gustavo.includes('1 contrato') || !t.Gustavo.includes('Falta para o contrato')) throw new Error(JSON.stringify(t));
    if (await page.locator('#av-clientes .item.linha .btn-icon.wa').count() !== 1) throw new Error('WhatsApp só para quem tem telefone');
    await page.click('#av-clientes .st-item.st-sem');
    const n = await page.evaluate(() => [...document.querySelectorAll('#av-clientes .item.linha .title')].map(x => x.textContent.split(' ')[0]).join());
    if (n !== 'Helena') throw new Error('filtro sem contrato: ' + n);
  });
  await passo('Reservas: faixa com valor das propostas; aguardando, vence amanhã e vencida com selo', async () => {
    await page.evaluate(() => switchTab('reservas'));
    const f = await page.evaluate(() => [...document.querySelectorAll('#av-reservas .st-item')].map(b => b.innerText.replace(/\s+/g, ' ').trim()).join(' | '));
    if (f !== '2 Ativas R$ 300 mil em propostas | 1 Aguardando R$ 100 mil em propostas | 1 Aprovadas R$ 200 mil em propostas | 1 Vencidas R$ 50 mil em propostas | 1 Histórico R$ 50 mil em propostas') throw new Error(f);
    const t = await page.evaluate(() => [...document.querySelectorAll('#av-reservas .item.linha')].map(x => x.innerText.replace(/\s+/g, ' ')));
    if (t.length !== 2 || !t[0].includes('Aguardando aprovação') || !t[0].includes('Lucas Pereira') || !t[0].includes('corretor Ana Paula Souza (Souza Imóveis)') || !t[0].includes('R$ 100.000,00')) throw new Error(t.join(' | '));
    if (!t[1].includes('vale até 20/10/2026') || !t[1].includes('Vence amanhã')) throw new Error(t[1]);
    await page.click('#av-reservas .st-item.st-atrasado');
    const v = await page.evaluate(() => document.querySelector('#av-reservas .item.linha').innerText.replace(/\s+/g, ' '));
    if (!v.includes('venceu 15/10/2026') || !v.includes('Vencida há 4 dias')) throw new Error(v);
  });
  await passo('celular: as três telas cabem na largura, sem rolagem lateral', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    const r = await page.evaluate(() => ['cobranca', 'clientes', 'reservas'].map(t => { switchTab(t); return document.documentElement.scrollWidth <= innerWidth && document.querySelector('#av-' + t + ' .st-faixa').getBoundingClientRect().right <= innerWidth; }));
    if (r.join() !== 'true,true,true') throw new Error(r.join());
  });
  await browser.close();
  if (erros.length) { console.log('\nERROS:\n' + erros.join('\n')); process.exit(1); }
  console.log('\nTudo certo.');
})();
