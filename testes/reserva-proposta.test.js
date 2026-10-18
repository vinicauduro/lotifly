// Reservas que vencem e "Copiar proposta".
// Configurações › Geral › Reservas: duração e a caixa "liberar o lote sozinho". Desmarcada, a
// reserva vencida fica e o lote continua reservado (aviso "reservas vencidas"); marcada, a
// reserva vira expirada e o lote volta a disponível, só para quem pode mexer em reservas.
// "Copiar proposta" (Gerar proposta): o texto das condições vai para a área de transferência.
// Rodar: BASE=http://127.0.0.1:8765/gestao/ node testes/reserva-proposta.test.js
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
    const lot = db.loteamentos.find(l => l.tipo !== 'carteira');
    const livres = lotesDo(lot.id).filter(l => l.status === 'disponivel').slice(0, 4);
    const hoje = todayStr(), ontem = addDays(hoje, -1);
    /* Quatro reservas: vencida aprovada, vencida pendente, que vence hoje, e uma vencida cujo
       lote já foi reservado de novo para outra (o lote não pode ser solto por ela). */
    window.cenario = () => {
      db.reservas = db.reservas.filter(r => !String(r.id).startsWith('tv'));
      const mk = (id, l, status, validade, loteDeOutra) => {
        upsert('reservas', { id, loteamentoId: lot.id, loteId: l.id, cliente: { nome: 'Cliente ' + id }, corretor: { nome: 'Corretor' }, dataReserva: addDays(hoje, -10), validade, status, proposta: null, obs: '', criadoEm: new Date().toISOString() });
        upsert('lotes', Object.assign({}, getLote(l.id), { status: 'reservado', reservaId: loteDeOutra ? 'outra' : id }));
      };
      mk('tv1', livres[0], 'aprovada', ontem); mk('tv2', livres[1], 'pendente', addDays(hoje, -3)); mk('tv3', livres[2], 'aprovada', hoje); mk('tv4', livres[3], 'aprovada', ontem, true);
      state._liberouReservasEm = 0;
      return livres.map(l => l.id);
    };
    window.situacao = ids => ['tv1', 'tv2', 'tv3', 'tv4'].map((id, i) => `${id}:${getReserva(id).status}/${getLote(ids[i]).status}`).join(' ');
  });

  await passo('Configurações › Geral: duração da reserva e "liberar o lote sozinho" (desmarcada de fábrica), salvando', async () => {
    await page.evaluate(() => { state.sub.cad = 'config'; switchTab('cadastros'); });
    const r = await page.evaluate(() => ({ dias: val('cgDias'), marcada: $('#cgResAuto').checked, rotulo: document.querySelector('label.check').textContent.trim() }));
    if (r.marcada || !/Liberar o lote sozinho/.test(r.rotulo) || !r.dias) throw new Error(JSON.stringify(r));
    await page.fill('#cgDias', '10'); await page.check('#cgResAuto');
    await page.getByRole('button', { name: 'Salvar configurações' }).click(); await page.waitForTimeout(150);
    const c = await page.evaluate(() => [db.config.reservaDias, db.config.reservaLiberaSozinha].join());
    if (c !== '10,true') throw new Error(c);
    await page.evaluate(() => setConfig({ reservaLiberaSozinha: false, reservaDias: 7 }));
  });
  await passo('desmarcada: reserva vencida continua, lote reservado, e o início avisa para liberar ou renovar', async () => {
    const ids = await page.evaluate(() => cenario());
    await page.evaluate(() => { switchTab('painel'); });
    const r = await page.evaluate(ids => ({ s: situacao(ids), aviso: $('#av-painel').textContent.includes('reserva(s) vencida(s)') }), ids);
    if (r.s !== 'tv1:aprovada/reservado tv2:pendente/reservado tv3:aprovada/reservado tv4:aprovada/reservado' || !r.aviso) throw new Error(JSON.stringify(r));
  });
  await passo('marcada: as vencidas viram expiradas e os lotes voltam a disponível; a que vence hoje fica; lote de outra reserva não é solto', async () => {
    const ids = await page.evaluate(() => { setConfig({ reservaLiberaSozinha: true }); return cenario(); });
    await page.evaluate(() => renderCurrent());
    const r = await page.evaluate(ids => ({ s: situacao(ids), motivo: getReserva('tv1').motivo, log: db.log.slice(-6).map(l => l.msg).join(' | ') }), ids);
    if (r.s !== 'tv1:expirada/disponivel tv2:expirada/disponivel tv3:aprovada/reservado tv4:expirada/reservado') throw new Error(r.s);
    if (!/liberado sozinho/.test(r.motivo) || !/Reserva expirada/.test(r.log)) throw new Error(JSON.stringify(r));
  });
  await passo('reserva expirada não oferece "Renovar" nem "Converter em venda"', async () => {
    await page.evaluate(() => abrirReservaAdmin('tv1')); await page.waitForTimeout(100);
    const t = await page.locator('#modalBox').innerText();
    if (/Renovar prazo|Converter/.test(t)) throw new Error(t.slice(0, 200));
    await page.evaluate(() => closeModal());
  });
  await passo('confere no máximo uma vez por minuto (a tela redesenha muito)', async () => {
    const r = await page.evaluate(() => { cenario(); const a = liberarReservasVencidas(); const b = liberarReservasVencidas(); state._liberouReservasEm = 0; const c = liberarReservasVencidas(); return [a, b, c].join(); });
    if (r !== '3,0,0') throw new Error(r);
  });
  await passo('na nuvem, só dono e administrador liberam pelo app (corretor e financeiro esperam o banco)', async () => {
    const r = await page.evaluate(() => {
      /* nuvem simulada: grava sem rede, e quem está logado é a Ana */
      const q = { upsert: () => q, delete: () => q, eq: () => q, then: (ok, ko) => Promise.resolve({ error: null }).then(ok, ko) };
      const antes = { client: Cloud.client, membro: Cloud.membro, org: Cloud.org };
      Object.assign(Cloud, { active: true, client: { from: () => q }, membro: { nome: 'Ana' }, org: { id: 'org-1' } });
      const v = [];
      try { for (const p of ['corretor', 'financeiro', 'admin']) { cenario(); Cloud.papel = p; v.push(p + ':' + liberarReservasVencidas(true)); } }
      finally { Object.assign(Cloud, antes, { active: false, papel: null }); }
      return v.join(' ');
    });
    if (r !== 'corretor:0 financeiro:0 admin:3') throw new Error(r);
  });
  await passo('Copiar proposta: lote, valor, entrada, parcelas, 1º vencimento, validade e o corretor', async () => {
    await page.evaluate(() => { setConfig({ reservaLiberaSozinha: false }); window.copiado = null; navigator.clipboard.writeText = t => { window.copiado = t; return Promise.resolve(); }; prefs.corretor = { nome: 'Ana Souza', creci: '12345-F', telefone: '47991234567' }; savePrefs(); });
    const lid = await page.evaluate(() => { const l = lotesDo(db.loteamentos.find(x => x.tipo !== 'carteira').id).find(x => x.status === 'disponivel'); abrirPropostaForm(l.id); return l.id; });
    await page.fill('#ppNome', 'Juliana Prado'); await page.fill('#ppTotal', '150000'); await page.fill('#ppEntrada', '30000'); await page.fill('#ppN', '60'); await page.fill('#ppJuros', '1');
    await page.evaluate(() => { window.ppManual = false; ppCalc(); setVal('ppVenc', '2026-11-17'); setVal('ppValidade', '2026-10-25'); });
    await page.getByRole('button', { name: 'Copiar proposta' }).click(); await page.waitForTimeout(150);
    const r = await page.evaluate(lid => ({ t: window.copiado, rot: loteLabel(getLote(lid)), toast: [...document.querySelectorAll('.toast')].map(t => t.textContent).join(' '),
      tela: ['ppTotal', 'ppEntrada', 'ppN', 'ppJuros', 'ppParcela', 'ppReforco'].map(id => id + '=' + val(id)).join(' ') + ' manual=' + window.ppManual }), lid);
    const parcela = (120000 * 0.01 / (1 - Math.pow(1.01, -60))).toFixed(2).replace('.', ',');
    for (const s of [`*Proposta — ${r.rot}*`, 'Para: Juliana Prado', 'Valor: *R$ 150.000,00*', 'Entrada: R$ 30.000,00', `*60× de R$ ${parcela.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}*`, 'juros de 1,00% ao mês', '1º vencimento: 17/11/2026', 'Proposta válida até 25/10/2026.', 'Ana Souza · CRECI 12345-F · (47) 99123-4567'])
      if (!(r.t || '').replace(/ /g, ' ').includes(s)) throw new Error(`falta "${s}" em: ${JSON.stringify(r.t)} · tela: ${r.tela}`);
    if (!/Proposta copiada/.test(r.toast)) throw new Error('sem aviso: ' + r.toast);
  });
  await passo('à vista e sem nome do cliente: "Pagamento à vista", sem a linha "Para:"', async () => {
    await page.fill('#ppNome', ''); await page.fill('#ppN', '0'); await page.evaluate(() => ppCalc());
    await page.getByRole('button', { name: 'Copiar proposta' }).click(); await page.waitForTimeout(100);
    const t = await page.evaluate(() => window.copiado.replace(/ /g, ' '));
    if (!/Pagamento à vista: R\$ 150\.000,00/.test(t) || /Para:|Parcelas:/.test(t)) throw new Error(t);
  });
  await passo('sem a área de transferência moderna, copia pelo jeito antigo', async () => {
    const r = await page.evaluate(() => { const orig = navigator.clipboard.writeText; navigator.clipboard.writeText = undefined; let via = ''; const ex = document.execCommand; document.execCommand = c => { via = c; return true; }; document.querySelectorAll('.toast').forEach(e => e.remove()); copiarProposta(lotesDo(db.loteamentos.find(x => x.tipo !== 'carteira').id).find(x => x.status === 'disponivel').id); document.execCommand = ex; navigator.clipboard.writeText = orig; return { via, toast: [...document.querySelectorAll('.toast')].map(t => t.textContent).join(' ') }; });
    if (r.via !== 'copy' || !/Proposta copiada/.test(r.toast)) throw new Error(JSON.stringify(r));
    await page.evaluate(() => closeModal());
  });
  await browser.close();
  if (erros.length) { console.log('\nERROS:\n' + erros.join('\n')); process.exit(1); }
  console.log('\nTudo certo.');
})();
