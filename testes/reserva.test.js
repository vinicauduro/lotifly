// Reserva de ponta a ponta: o corretor pede no celular (só o essencial) e o escritório decide
// no computador (proposta primeiro; Aprovar/Recusar; desfazer; motivo e prazo dentro da janela).
// Rodar: BASE=http://127.0.0.1:8765/lotifly/ node testes/reserva.test.js
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/gestao/';
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--disable-gpu'] });
  const erros = [];
  const passo = async (nome, fn) => { try { await fn(); console.log('✔', nome); } catch (e) { console.log('✘', nome, e.message.split('\n')[0]); erros.push(nome + ': ' + e.message.split('\n')[0]); } };
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, serviceWorkers: 'block' });
  await ctx.route(/config\.js/, r => r.fulfill({ contentType: 'application/javascript', body: "window.GL_CONFIG={supabaseUrl:'',supabaseAnonKey:''};" }));
  const page = await ctx.newPage(); page.setDefaultTimeout(8000);
  page.on('pageerror', e => erros.push('pageerror: ' + e.message));
  page.on('dialog', d => { erros.push('caixa do navegador apareceu: ' + d.message()); d.dismiss(); });
  await page.goto(BASE + 'index.html?dados=exemplo'); await page.waitForFunction(() => window.PiorCaso && db.loteamentos.length); await page.waitForTimeout(300);
  await page.evaluate(() => { prefs.corretor = null; savePrefs(); startRole('corretor'); document.querySelectorAll('#devDados,.toast').forEach(e => e.remove()); });
  const janela = page.locator('#modalOverlay.open');
  let loteId, resId;

  await passo('corretor: o pedido mostra só nome e telefone do cliente e a proposta', async () => {
    loteId = await page.evaluate(() => lotesDo(curLot().id).find(l => l.status === 'disponivel').id);
    await page.evaluate(id => abrirReservaForm(id), loteId); await page.waitForTimeout(500);
    const visiveis = await page.evaluate(() => [...document.querySelectorAll('#modalBody input, #modalBody select, #modalBody textarea')].filter(e => e.checkVisibility({ contentVisibilityAuto: true, visibilityProperty: true })).map(e => e.id));
    const esperado = ['rlNome', 'rlTel', 'rpValor', 'rpEntrada', 'rpParcelas', 'rpObs', 'rcNome', 'rcCreci', 'rcTel', 'rcEmail', 'rcImob'];   // sem perfil: os dados do corretor vêm abertos
    if (visiveis.join() !== esperado.join()) throw new Error(visiveis.join());
    if (await page.evaluate(() => ['rlProf', 'rlEstCivil', 'rlEnd'].some(id => document.getElementById(id)))) throw new Error('qualificação completa ainda no pedido');
  });
  await passo('corretor: envia o pedido e o lote fica reservado', async () => {
    await page.fill('#rlNome', 'Bruno Albuquerque'); await page.fill('#rlTel', '(47) 99111-2233');
    await page.fill('#rcNome', 'Ana Paula Souza'); await page.fill('#rcTel', '(47) 98888-7777'); await page.fill('#rcCreci', 'SC-54321');
    await page.fill('#rpValor', '150000'); await page.fill('#rpEntrada', '15000'); await page.fill('#rpParcelas', '60');
    await janela.getByRole('button', { name: 'Enviar pedido' }).tap();
    await janela.getByText('Pedido enviado').waitFor();
    const r = await page.evaluate(id => { const l = getLote(id); const r = db.reservas.find(r => r.loteId === id && r.status === 'pendente'); return { st: l.status, id: r && r.id }; }, loteId);
    if (r.st !== 'reservado' || !r.id) throw new Error(JSON.stringify(r)); resId = r.id;
    await page.evaluate(() => closeModal());
  });
  await passo('corretor: com perfil salvo, os dados dele ficam recolhidos numa linha', async () => {
    const outro = await page.evaluate(() => lotesDo(curLot().id).find(l => l.status === 'disponivel').id);
    await page.evaluate(id => abrirReservaForm(id), outro); await page.waitForTimeout(400);
    const r = await page.evaluate(() => ({ aberto: document.getElementById('rcDados').open, resumo: document.querySelector('#rcDados summary').textContent }));
    if (r.aberto || !/Ana Paula Souza/.test(r.resumo)) throw new Error(JSON.stringify(r));
  });
  await passo('corretor: pedido que não chegou fica guardado e volta preenchido', async () => {
    await page.fill('#rlNome', 'Cliente Sem Sinal'); await page.fill('#rlTel', '(47) 90000-0000');
    const outro = await page.evaluate(() => { const id = lotesDo(curLot().id).find(l => l.status === 'disponivel').id; guardarRascunhoReserva(id); closeModal(); abrirReservaForm(id); return id; });
    await page.waitForTimeout(300);
    if (await page.inputValue('#rlNome') !== 'Cliente Sem Sinal') throw new Error('rascunho não voltou');
    if (!/não chegou a ser enviado/.test(await page.textContent('#modalBody'))) throw new Error('sem aviso de rascunho');
    await page.evaluate(() => { apagarRascunhoReserva(); closeModal(); });
  });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate(() => { sessionStorage.setItem('gl_admin', '1'); startRole('admin'); });
  await passo('escritório: a proposta vem antes dos dados, com a comparação com a tabela', async () => {
    await page.evaluate(id => abrirReservaAdmin(id), resId); await page.waitForTimeout(300);
    const ordem = await page.evaluate(() => { const b = document.getElementById('modalBody'); const p = b.querySelector('.rs-proposta'), d = b.querySelector('details'); return p && d && (p.compareDocumentPosition(d) & Node.DOCUMENT_POSITION_FOLLOWING) ? 'ok' : 'errada'; });
    if (ordem !== 'ok') throw new Error('ordem ' + ordem);
    const t = await page.textContent('.rs-proposta');
    if (!/da tabela/.test(t) || !/tabela Price/.test(t)) throw new Error(t);
  });
  await passo('escritório: o rodapé tem só Recusar e Aprovar', async () => {
    const b = await page.$$eval('#modalFoot button', bs => bs.map(b => b.textContent.trim()));
    if (b.join('|') !== 'Recusar|Aprovar') throw new Error(b.join('|'));
  });
  await passo('escritório: aprovar mostra "Avisar o corretor" e "Desfazer"; desfazer volta a pendente', async () => {
    await janela.getByRole('button', { name: 'Aprovar' }).click(); await page.waitForTimeout(300);
    if (await page.evaluate(id => getReserva(id).status, resId) !== 'aprovada') throw new Error('não aprovou');
    if (!await page.locator('.rs-ok a', { hasText: 'Avisar o corretor' }).count()) throw new Error('sem Avisar o corretor');
    await page.locator('.rs-ok button', { hasText: 'Desfazer' }).click(); await page.waitForTimeout(300);
    if (await page.evaluate(id => getReserva(id).status, resId) !== 'pendente') throw new Error('não desfez');
  });
  await passo('escritório: recusar pede o motivo dentro da janela e libera o lote', async () => {
    await janela.getByRole('button', { name: 'Recusar' }).click();
    await page.fill('#rsMotivo', 'Entrada abaixo do combinado');
    await janela.getByRole('button', { name: 'Recusar reserva' }).click(); await page.waitForTimeout(300);
    const r = await page.evaluate(([id, lid]) => ({ st: getReserva(id).status, motivo: getReserva(id).motivo, lote: getLote(lid).status }), [resId, loteId]);
    if (r.st !== 'recusada' || r.motivo !== 'Entrada abaixo do combinado' || r.lote !== 'disponivel') throw new Error(JSON.stringify(r));
  });
  await passo('escritório: renovar prazo dentro da janela', async () => {
    const id = await page.evaluate(() => db.reservas.find(r => r.status === 'aprovada' || r.status === 'pendente').id);
    await page.evaluate(id => abrirReservaAdmin(id), id); await page.waitForTimeout(200);
    await janela.getByRole('button', { name: 'Renovar prazo' }).click();
    await page.fill('#rsDias', '10'); await janela.getByRole('button', { name: 'Renovar', exact: true }).click(); await page.waitForTimeout(200);
    const v = await page.evaluate(id => getReserva(id).validade === addDays(todayStr(), 10), id);
    if (!v) throw new Error('validade não mudou para hoje + 10');
  });
  await ctx.close();
  console.log(erros.length ? '\nERROS:\n' + erros.join('\n') : '\ntudo ok');
  await browser.close(); process.exit(erros.length ? 1 : 0);
})();
