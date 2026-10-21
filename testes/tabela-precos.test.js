// Tabela de preços em PDF (Imóveis › Gerar tabela, e Lotes › Tabela de preços do corretor):
// só disponíveis e, se pedir, os reservados marcados; vendido nunca; valor, entrada, parcela
// (Price), à vista e CUB conferidos à mão; imóveis de terceiros; "Todos" com uma seção por
// empreendimento; muitas páginas com cabeçalho e rodapé em todas; o rodapé é o contato da
// empresa mesmo quando quem gera é o corretor; envio pelo WhatsApp com o PDF anexado (celular)
// ou baixando o arquivo (computador). O texto do PDF é lido de volta com o pdf.js do próprio app.
// Rodar: BASE=http://127.0.0.1:8765/gestao/ node testes/tabela-precos.test.js
const { chromium } = require('playwright');
const { responderConfirmacoes } = require('./confirmacoes');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/gestao/';
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--disable-gpu'] });
  const erros = [];
  const passo = async (nome, fn) => { try { await fn(); console.log('✔', nome); } catch (e) { console.log('✘', nome, e.message.split('\n')[0]); erros.push(`${nome}: ${e.message.split('\n')[0]}`); } };
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block', acceptDownloads: true });
  await ctx.route(/config\.js/, r => r.fulfill({ contentType: 'application/javascript', body: "window.GL_CONFIG={supabaseUrl:'',supabaseAnonKey:''};" }));
  const page = await ctx.newPage(); page.setDefaultTimeout(15000);
  page.on('pageerror', e => erros.push(`pageerror: ${e.message}`)); page.on('dialog', d => d.accept()); await responderConfirmacoes(page);
  await page.goto(BASE + 'index.html?dados=exemplo'); await page.waitForFunction(() => window.PiorCaso && db.loteamentos.length); await page.waitForTimeout(300);
  await page.evaluate(() => {
    sessionStorage.setItem('gl_admin', '1'); startRole('admin'); document.querySelectorAll('#devDados,.toast').forEach(e => e.remove());
    Object.assign(db.config, { empresa: 'Cocal Imóveis Ltda', telefone: '48999990000', adminWhatsapp: '48988887777', email: 'vendas@cocal.com.br' });
    db.indices = db.indices.filter(i => i.codigo !== 'CUB').concat([{ id: 'cub', codigo: 'CUB', nome: 'CUB/SC', tipo: 'pontos', valores: { '2026-01': 3000, [mesAtual()]: 3200, '2099-01': 9999 } }]);
    const emp = (id, nome, cond, extra) => Object.assign({ id, nome, tipo: 'loteamento', cidade: 'Cocal do Sul', uf: 'SC', cond, orcamento: {}, criadoEm: '' }, extra);
    db.loteamentos = [
      emp('E1', 'Lucia Giassi II', { entradaMinPct: 10, maxParcelas: 120, jurosMes: 1, descontoVistaPct: 5 }, { matriculaMae: '31.640', cartorio: 'Registro de Imóveis de Urussanga' }),
      emp('E2', 'Tramontin', { entradaMinPct: 0, maxParcelas: 72, jurosMes: 0, descontoVistaPct: 0, obsTabela: 'Saldo em 72x sem juros corrigidas pelo CUB/SC. Esta tabela substitui as anteriores.' }),
      { id: 'T1', nome: 'Apartamento 302 do Ed. Aurora', tipo: 'carteira', categoria: 'apartamento', cidade: 'Criciúma', preco: 480000, area: 92.5, cond: {}, orcamento: {} },
      { id: 'T2', nome: 'Casa na Rua das Flores, 120', tipo: 'carteira', categoria: 'casa', cidade: 'Urussanga', preco: 350000, area: 180, cond: { entradaMinPct: 20, maxParcelas: 60, jurosMes: 0 }, orcamento: {} },
      { id: 'T3', nome: 'Sala vendida', tipo: 'carteira', categoria: 'sala', cidade: 'Criciúma', preco: 200000, cond: {}, orcamento: {} }
    ];
    const lote = (id, emp, q, n, st, preco, area) => ({ id, loteamentoId: emp, quadra: q, numero: n, status: st, preco, area, frente: 12, fundos: 30, tipo: 'residencial' });
    db.lotes = [lote('a1', 'E1', '1', '2', 'disponivel', 150000, 369.13), lote('a2', 'E1', '1', '7', 'reservado', 160000, 430.78), lote('a3', 'E1', '1', '9', 'vendido', 999999, 400), lote('a4', 'E1', '2', '1', 'bloqueado', 888888, 400), lote('a5', 'E1', '2', '3', 'disponivel', 0, 365),
      lote('b1', 'E2', 'A', '1', 'disponivel', 216000, 360)];
    for (let i = 1; i <= 140; i++) db.lotes.push(lote('m' + i, 'E2', 'B', String(i), 'disponivel', 200000 + i * 100, 360));
    db.vendas = [{ id: 'vT3', loteamentoId: 'T3', status: 'ativa', cliente: { nome: 'X' }, corretor: { nome: 'Y' }, valorTotal: 200000, dataVenda: '2026-01-01' }];
    db.reservas = [];
    window.textoPdf = async blob => {
      const m = await import('./vendor/pdf.js'); m.GlobalWorkerOptions.workerSrc = './vendor/pdf.worker.js';
      const pdf = await m.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise; const pags = [];
      for (let p = 1; p <= pdf.numPages; p++) { const t = await (await pdf.getPage(p)).getTextContent(); pags.push(t.items.map(i => i.str).join(' ').replace(/\s+/g, ' ')); }
      return pags;
    };
    window.pdfDe = async (escolha, res) => textoPdf(await gerarTabelaPDF(dadosTabela(escolha, res)));
  });

  await passo('dados: só disponíveis com valor; reservado marcado só quando pedido; vendido e bloqueado nunca', async () => {
    const r = await page.evaluate(() => { const com = dadosTabela('E1', true).secoes[0], sem = dadosTabela('E1', false).secoes[0]; return { com: com.linhas.map(l => l.quadra + '-' + l.numero + (l.reservado ? 'R' : '')), sem: sem.linhas.map(l => l.quadra + '-' + l.numero), disp: com.disponiveis }; });
    if (r.com.join() !== '1-2,1-7R' || r.sem.join() !== '1-2' || r.disp !== 1) throw new Error(JSON.stringify(r));
  });
  await passo('contas: entrada mínima, 120× Price a 1% a.m., à vista com 5%, valor em CUB do mês (não o de mês futuro)', async () => {
    const r = await page.evaluate(() => { const d = dadosTabela('E1', false); return Object.assign({ cubMes: d.cub.valor }, d.secoes[0].linhas[0]); });
    // 150.000: entrada 15.000; saldo 135.000 em 120× a 1% → 135000*0,01/(1-1,01^-120) = 1.936,8578…
    if (r.entrada !== 15000 || r.n !== 120 || r.parcela !== 1936.86 || r.vista !== 142500) throw new Error(JSON.stringify(r));
    if (r.cubMes !== 3200 || r.cub !== 150000 / 3200) throw new Error('CUB: ' + JSON.stringify(r));
    const r2 = await page.evaluate(() => dadosTabela('E2', false).secoes[0].linhas[0]);
    if (r2.entrada !== 0 || r2.parcela !== 3000 || r2.vista !== 0) throw new Error('sem juros: ' + JSON.stringify(r2));
  });
  await passo('PDF de um empreendimento: cabeçalho, colunas, valores, "Reservado", condições e o contato da empresa', async () => {
    const t = (await page.evaluate(() => pdfDe('E1', true))).join(' | ');
    for (const s of ['Lucia Giassi II', 'Matrícula 31.640', 'Vigência:', 'CUB', 'R$ 3.200,00', 'Tabela de preços · Cocal Imóveis Ltda', '1 lote(s) disponível(is) · 1 reservado(s)', 'Valor de tabela', 'Entrada (10%)', '120× (Price)', 'À vista (-5%)', 'R$ 150.000,00', 'R$ 15.000,00', 'R$ 1.936,86', 'R$ 142.500,00', '46,88', 'Reservado', 'Entrada mínima de 10%', 'Cocal Imóveis Ltda · Tel. (48) 99999-0000 · WhatsApp (48) 98888-7777 · vendas@cocal.com.br', 'Página 1 de 1'])
      if (!t.includes(s)) throw new Error(`faltou "${s}" em: ${t.slice(0, 400)}`);
    if (t.includes('999.999') || t.includes('888.888')) throw new Error('vendido ou bloqueado entrou');
  });
  await passo('muitos lotes: várias páginas, cabeçalho de continuação e rodapé numerado em todas', async () => {
    const p = await page.evaluate(() => pdfDe('E2', false));
    if (p.length < 3) throw new Error('páginas: ' + p.length);
    if (!p[1].includes('Tramontin (continuação)') || !p.every((x, i) => x.includes(`Página ${i + 1} de ${p.length}`) && x.includes('vendas@cocal.com.br'))) throw new Error(p[1].slice(0, 300));
    if (!p[p.length - 1].includes('Saldo em 72x sem juros corrigidas pelo CUB/SC')) throw new Error('observação do empreendimento não saiu');
    const tudo = p.join(' ');
    if (!tudo.includes('B 140') || tudo.includes('À vista')) throw new Error('lote 140 ou coluna de à vista sem desconto');
  });
  await passo('"Todos": uma seção por empreendimento e os imóveis de terceiros (o vendido fica de fora)', async () => {
    const p = await page.evaluate(() => pdfDe('todas', true));
    const tudo = p.join(' | ');
    if (!p[0].includes('Lucia Giassi II') || !tudo.includes('Tramontin') || !p[p.length - 1].includes('Imóveis de terceiros')) throw new Error('seções: ' + p.map(x => x.slice(0, 40)).join(' / '));
    const terc = p[p.length - 1];
    if (!terc.includes('Apartamento 302 do Ed. Aurora') || !terc.includes('A combinar') || !terc.includes('Entrada R$ 70.000,00 + 60× R$ 4.666,67') || terc.includes('Sala vendida')) throw new Error(terc.slice(0, 400));
    const nome = await page.evaluate(() => [nomeArquivoTabela(dadosTabela('todas', true)), nomeArquivoTabela(dadosTabela('E1', true)), nomeArquivoTabela(dadosTabela('terceiros', true))].join());
    const m = await page.evaluate(() => mesAtual());
    if (nome !== `tabela-todos-os-imoveis-${m}.pdf,tabela-lucia-giassi-ii-${m}.pdf,tabela-imoveis-de-terceiros-${m}.pdf`) throw new Error(nome);
  });
  await passo('Imóveis › Gerar tabela: escolhas, baixar o PDF', async () => {
    await page.evaluate(() => { state.empAberto = null; switchTab('emp'); });
    await page.click('#av-emp button:has-text("Gerar tabela")');
    const opts = await page.locator('#tbEscolha option').allTextContents();
    if (opts.join('|') !== 'Todos: empreendimentos e imóveis de terceiros|Lucia Giassi II|Tramontin|Imóveis de terceiros') throw new Error(opts.join('|'));
    if (!(await page.isChecked('#tbReservados'))) throw new Error('reservados deveria vir marcado');
    await page.selectOption('#tbEscolha', 'E1');
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#modalFoot button:has-text("Baixar PDF")')]);
    if (!/^tabela-lucia-giassi-ii-\d{4}-\d{2}\.pdf$/.test(dl.suggestedFilename())) throw new Error(dl.suggestedFilename());
  });
  await passo('Enviar pelo WhatsApp no celular: compartilha o PDF anexado com a mensagem', async () => {
    const r = await page.evaluate(async () => {
      let pedido = null; navigator.canShare = o => !!(o && o.files); navigator.share = async o => { pedido = o; };
      abrirTabelaForm(); document.getElementById('tbEscolha').value = 'E2'; await enviarTabelaWhatsApp();
      return pedido && { n: pedido.files.length, nome: pedido.files[0].name, tipo: pedido.files[0].type, tam: pedido.files[0].size, texto: pedido.text, aberto: document.getElementById('modalOverlay').classList.contains('open') };
    });
    if (!r || r.n !== 1 || r.tipo !== 'application/pdf' || !/^tabela-tramontin-/.test(r.nome) || r.tam < 2000 || !/^Tabela de preços de .+ — Tramontin · Cocal Imóveis Ltda$/.test(r.texto) || r.aberto) throw new Error(JSON.stringify(r));
  });
  await passo('Enviar pelo WhatsApp no computador: baixa o PDF e abre o WhatsApp com a mensagem', async () => {
    const r = await page.evaluate(async () => {
      delete navigator.canShare; delete navigator.share; navigator.canShare = undefined; navigator.share = undefined;
      let url = ''; const wo = window.open; window.open = u => { url = u; };
      let baixou = ''; const sb = window.salvarBlob; window.salvarBlob = (b, n) => { baixou = n; };
      abrirTabelaForm(); const aviso = document.getElementById('modalBody').innerText; document.getElementById('tbEscolha').value = 'E1'; await enviarTabelaWhatsApp();
      window.open = wo; window.salvarBlob = sb;
      return { url, baixou, aviso };
    });
    if (!/^https:\/\/wa\.me\/\?text=Tabela%20de%20pre/.test(r.url) || !/^tabela-lucia-giassi-ii-/.test(r.baixou) || !/arraste o arquivo/i.test(r.aviso)) throw new Error(JSON.stringify(r));
  });
  await passo('nada disponível: avisa em vez de gerar PDF vazio', async () => {
    const r = await page.evaluate(async () => {
      const ls = db.lotes; db.lotes = db.lotes.filter(l => l.loteamentoId !== 'E1');
      abrirTabelaForm(); document.getElementById('tbEscolha').value = 'E1'; const a = await arquivoDaTabela(); db.lotes = ls; closeModal();
      return a;
    });
    if (r !== null) throw new Error('gerou mesmo sem lote');
  });
  await passo('Condições na tabela: o texto do empreendimento é salvo nas condições', async () => {
    const r = await page.evaluate(() => {
      abrirLoteamentoForm('E1'); document.getElementById('lmObsTab').value = 'Saldo em 240x com juros de 9,5% a.a. mais INPC.'; salvarLoteamento('E1');
      return [getLoteamento('E1').cond.obsTabela, getLoteamento('E1').cond.maxParcelas, obsDaTabela(getLoteamento('E1'))].join('|');
    });
    if (r !== 'Saldo em 240x com juros de 9,5% a.a. mais INPC.|120|Saldo em 240x com juros de 9,5% a.a. mais INPC.') throw new Error(r);
  });
  await passo('corretor: botão na lista de lotes; a tabela vem do empreendimento atual e o rodapé é o da empresa', async () => {
    const r = await page.evaluate(async () => {
      prefs.corretor = { nome: 'Juliana Prado', creci: '12345-F', telefone: '48911112222', email: 'juliana@x.com', imobiliaria: '' };
      setCurLotSilencioso('E1'); startRole('corretor'); switchTab('lotes');
      const btn = [...document.querySelectorAll('#cv-lotes button')].find(b => /Tabela de preços/.test(b.textContent)); btn.click();
      const escolhido = document.getElementById('tbEscolha').value;
      const blob = await gerarTabelaPDF(dadosTabela(escolhido, true)); closeModal();
      return { escolhido, t: (await textoPdf(blob)).join(' ') };
    });
    if (r.escolhido !== 'E1') throw new Error('escolha inicial: ' + r.escolhido);
    if (!r.t.includes('WhatsApp (48) 98888-7777') || r.t.includes('Juliana') || r.t.includes('11112222')) throw new Error(r.t.slice(-300));
  });
  await browser.close();
  if (erros.length) { console.log('\nERROS:\n' + erros.join('\n')); process.exit(1); }
  console.log('\nTudo certo.');
})();
