// Cessão de direitos, pela tela: o comprador passa o contrato a outra pessoa com a anuência da
// empresa. Confere o formulário (saldo, avisos, validações), o que muda e o que não muda no
// contrato, a taxa de cessão, o termo gerado, o histórico, o recibo de pagamento antigo no
// nome de quem pagou, desfazer, cessões em sequência e o modelo no editor.
// Rodar: BASE=http://127.0.0.1:8765/lotifly/ node testes/cessao.test.js
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/gestao/';
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--disable-gpu'] });
  const erros = [];
  for (const w of [390, 1440]) {
    const passo = async (nome, fn) => { try { await fn(); console.log('✔', w, nome); } catch (e) { console.log('✘', w, nome, e.message.split('\n')[0]); erros.push(`${w} ${nome}: ${e.message.split('\n')[0]}`); } };
    const ctx = await browser.newContext({ viewport: { width: w, height: w < 700 ? 844 : 900 }, hasTouch: w < 700, serviceWorkers: 'block' });
    await ctx.route(/config\.js/, r => r.fulfill({ contentType: 'application/javascript', body: "window.GL_CONFIG={supabaseUrl:'',supabaseAnonKey:''};" }));
    const page = await ctx.newPage(); page.setDefaultTimeout(8000);
    page.on('pageerror', e => erros.push(`${w} pageerror: ${e.message}`)); page.on('dialog', d => d.accept());
    await page.goto(BASE + 'index.html?dados=exemplo'); await page.waitForFunction(() => window.PiorCaso && db.loteamentos.length); await page.waitForTimeout(300);
    /* Contrato de teste: as 3 primeiras parcelas pagas pelo comprador atual, o resto em aberto */
    const vid = await page.evaluate(() => {
      sessionStorage.setItem('gl_admin', '1'); startRole('admin'); document.querySelectorAll('#devDados,.toast').forEach(e => e.remove());
      window.print = () => { window.__imprimiu = true; };
      window.ultimoAviso = () => { const t = [...document.querySelectorAll('#toastContainer .toast')].pop(); return t ? t.textContent.replace(/\s+/g, ' ').trim() : ''; };
      const v = db.vendas.find(v => v.status === 'ativa' && v.loteId && (v.compradoresExtras || []).length === 0);
      const rs = recebiveisDe(v.id);
      rs.forEach((r, i) => upsert('recebiveis', Object.assign({}, r, i < 3 ? { valorPago: recValor(r), dataPagamento: addDays(todayStr(), -60 + i), forma: 'PIX' } : { valorPago: 0, dataPagamento: null, nossoNumero: null, vencimento: r.vencimento < todayStr() ? addMonths(todayStr(), 1) : r.vencimento })));
      upsert('vendas', Object.assign({}, v, { cliente: Object.assign({}, v.cliente, { cpf: '39053344705' }) }));   // CPF válido, como num cadastro real
      window.CEDENTE = v.cliente.nome; window.PAGA_ANTES = rs[0].id;
      abrirContrato(v.id, 'resumo');
      return v.id;
    });
    const foot = page.locator('#modalFoot');
    const abrir = async () => {
      await page.evaluate(() => document.querySelectorAll('.toast').forEach(e => e.remove()));
      await page.locator('.ct-topo summary', { hasText: 'Mais' }).click(); await page.waitForTimeout(150);
      await page.locator('.ct-topo details.menu[open] .menu-item', { hasText: 'Cessão de direitos' }).click(); await page.waitForTimeout(300);
    };
    const preencher = async (nome, cpf, casada) => {
      await page.fill('#csNome', nome); await page.fill('#csDoc', cpf); await page.fill('#csTel', '47977776666');
      await page.selectOption('#csGenero', 'f'); await page.fill('#csProf', 'arquiteta'); await page.fill('#csRg', '7.654.321');
      await page.fill('#csLogr', 'Rua Itajaí'); await page.fill('#csNum', '50'); await page.fill('#csCidade', 'Blumenau');
      if (casada) { await page.selectOption('#csEstCivil', 'casado'); await page.waitForTimeout(80); await page.selectOption('#csRegime', 'comunhão parcial de bens'); await page.fill('#csCjNome', 'Rafael Ramos'); await page.fill('#csCjDoc', '52998224725'); }
      else await page.selectOption('#csEstCivil', 'solteiro');
    };
    const registrar = async () => { await foot.getByRole('button', { name: 'Registrar cessão' }).click(); await page.waitForTimeout(400); };

    await passo('Mais › Cessão de direitos abre com o cedente e o saldo que fica para o cessionário', async () => {
      await abrir();
      const r = await page.evaluate((vid) => { const v = getVenda(vid); const ab = recebiveisDe(vid).filter(x => recRestante(x) > 0.005); return { t: modalTitle.textContent, corpo: modalBody.textContent, esperado: `${ab.length} parcela(s) · ${fmtMoney(ab.reduce((s, x) => s + recRestante(x), 0))}`, ced: v.cliente.nome }; }, vid);
      if (r.t !== 'Cessão de direitos' || !r.corpo.includes(r.ced) || !r.corpo.includes(r.esperado)) throw new Error(JSON.stringify({ t: r.t, esperado: r.esperado }));
    });
    await passo('sem cessionário, qualificação incompleta, mesmo CPF do cedente ou data antes da venda: não registra', async () => {
      const antes = await page.evaluate((vid) => JSON.stringify(getVenda(vid).cliente), vid);
      await registrar(); if (!/Informe o cessionário/.test(await page.evaluate(() => ultimoAviso()))) throw new Error('vazio: ' + await page.evaluate(() => ultimoAviso()));
      await page.fill('#csNome', 'Beatriz Ramos'); await page.fill('#csTel', '47977776666'); await registrar();
      if (!/Qualificação incompleta.*CPF/.test(await page.evaluate(() => ultimoAviso()))) throw new Error('incompleta: ' + await page.evaluate(() => ultimoAviso()));
      const cpfCed = await page.evaluate((vid) => getVenda(vid).cliente.cpf, vid);
      if (cpfCed) { await preencher('Beatriz Ramos', cpfCed, false); await registrar(); if (!/já é comprador/.test(await page.evaluate(() => ultimoAviso()))) throw new Error('mesmo CPF: ' + await page.evaluate(() => ultimoAviso())); }
      await preencher('Beatriz Ramos', '11144477735', true);
      await page.fill('#csData', '2000-01-01'); await registrar();
      if (!/antes da venda/.test(await page.evaluate(() => ultimoAviso()))) throw new Error('data: ' + await page.evaluate(() => ultimoAviso()));
      if (await page.evaluate((vid) => JSON.stringify(getVenda(vid).cliente), vid) !== antes) throw new Error('mudou o contrato');
    });
    await passo('registrar: a cessionária casada vira a compradora; número, lote e parcelas em aberto não mudam', async () => {
      const antes = await page.evaluate((vid) => { const v = getVenda(vid); return { num: v.numeroContrato, lote: v.loteId, abertas: recebiveisDe(vid).filter(x => recRestante(x) > 0.005).map(x => x.id + ':' + recValor(x)).join(','), total: v.valorTotal }; }, vid);
      await page.evaluate(() => { document.getElementById('csData').value = todayStr(); });
      await page.fill('#csValor', '45000'); await page.fill('#csTaxa', '1500'); await page.selectOption('#csForma', 'PIX');
      await registrar();
      if (!(await page.evaluate((vid) => (getVenda(vid).cessoes || []).length, vid))) throw new Error('não registrou: ' + await page.evaluate(() => ultimoAviso()));
      const r = await page.evaluate((vid) => { const v = getVenda(vid); const l = getLote(v.loteId); const tx = recebiveisDe(vid).find(x => x.tipo === 'taxa');
        return { cli: v.cliente.nome, cj: (v.cliente.conjuge || {}).nome, ext: (v.compradoresExtras || []).length, n: (v.cessoes || []).length, ced: v.cessoes[0].cedentes.map(p => p.nome).join(), num: v.numeroContrato, lote: v.loteId, loteSt: l.status, loteVenda: l.vendaId, total: v.valorTotal,
          abertas: recebiveisDe(vid).filter(x => recRestante(x) > 0.005).map(x => x.id + ':' + recValor(x)).join(','), taxa: tx && [tx.valor, tx.valorPago, tx.forma, recStatus(tx)].join('/'), cad: db.clientes.some(c => c.nome === 'Beatriz Ramos'), titulo: modalTitle.textContent }; }, vid);
      if (r.cli !== 'Beatriz Ramos' || r.cj !== 'Rafael Ramos' || r.ext !== 0 || r.n !== 1 || r.ced !== await page.evaluate(() => CEDENTE)) throw new Error('partes: ' + JSON.stringify(r));
      if (r.num !== antes.num || r.lote !== antes.lote || r.loteSt !== 'vendido' || r.loteVenda !== vid || r.total !== antes.total || r.abertas !== antes.abertas) throw new Error('contrato mudou: ' + JSON.stringify(r).slice(0, 300));
      if (r.taxa !== '1500/1500/PIX/pago') throw new Error('taxa: ' + r.taxa);
      if (!r.cad) throw new Error('cessionária não entrou no cadastro de clientes');
      if (r.titulo !== 'Gerar o termo de cessão agora?') throw new Error('não perguntou do termo: ' + r.titulo);
    });
    await passo('termo de cessão: partes, anuência, saldo por extenso, taxa e assinaturas', async () => {
      await foot.getByRole('button', { name: 'Gerar termo' }).click(); await page.waitForTimeout(300);
      const r = await page.evaluate((vid) => { const c = getVenda(vid).cessoes[0]; return { t: document.getElementById('docFolha').innerText, saldo: `${fmtMoney(c.saldo)} (${moedaExtenso(c.saldo)})`, n: c.parcelasEmAberto, h3: [...document.querySelectorAll('#docFolha h3')].map(h => h.textContent.split('—')[0].trim().replace('CLÁUSULA ', '')) }; }, vid);
      const ced = await page.evaluate(() => CEDENTE);
      const f = ['INSTRUMENTO PARTICULAR DE CESSÃO DE DIREITOS', 'CEDENTE: ' + ced, 'CESSIONÁRIO: Beatriz Ramos, brasileira, casada sob o regime da comunhão parcial de bens, arquiteta', 'e seu marido Rafael Ramos', 'ANUENTE (PROMITENTE VENDEDORA):', `composto de ${r.n} parcela(s) em aberto que somam`, 'declara sua anuência', 'Cônjuge de Beatriz Ramos', 'Anuente — promitente vendedora'];
      const falta = f.filter(x => !r.t.replace(/\s+/g, ' ').includes(x));
      if (falta.length) throw new Error('falta: ' + falta.join(' | '));
      if (!r.t.replace(/\s+/g, ' ').includes(r.saldo.replace(/\s+/g, ' '))) throw new Error('saldo: ' + r.saldo);
      if (!/taxa de cessão de R\$\s1\.500,00/.test(r.t) || !/preço de R\$\s45\.000,00 \(quarenta e cinco mil reais\)/.test(r.t)) throw new Error('valores');
      if (/undefined|NaN|\bnull\b/.test(r.t)) throw new Error('texto quebrado');
      if (r.h3.join(',') !== 'PRIMEIRA,SEGUNDA,TERCEIRA,QUARTA,QUINTA,SEXTA') throw new Error('cláusulas: ' + r.h3.join(','));
      await page.evaluate(() => closeModal());
    });
    await passo('aba Partes mostra a cessão; Histórico registra; Documentos oferece o termo', async () => {
      await page.evaluate(() => { state.contratoAba = 'partes'; renderContrato(); });
      const p = await page.locator('#ctConteudo .card', { has: page.locator('h2', { hasText: 'Cessões de direitos' }) }).innerText();
      if (!p.includes('para Beatriz Ramos') || !/taxa R\$\s1\.500,00/.test(p) || !p.includes('Desfazer')) throw new Error(p.slice(0, 200));
      await page.evaluate(() => { state.contratoAba = 'historico'; renderContrato(); });
      const h = await page.locator('#ctConteudo').innerText();
      if ((h.match(/Cessão de direitos: de/g) || []).length !== 1) throw new Error('histórico: ' + h.slice(0, 300));
      await page.evaluate(() => { state.contratoAba = 'documentos'; renderContrato(); });
      if (!await page.locator('#ctConteudo', { hasText: 'Termo de cessão de direitos' }).count()) throw new Error('sem o termo em Documentos');
    });
    await passo('recibo de pagamento antigo sai no nome do cedente; o da taxa, no da cessionária', async () => {
      const r = await page.evaluate((vid) => ({ antigo: reciboDados(PAGA_ANTES).compradores.map(p => p.nome).join(), taxa: reciboDados(recebiveisDe(vid).find(x => x.tipo === 'taxa').id).compradores.map(p => p.nome).join() }), vid);
      if (r.antigo !== await page.evaluate(() => CEDENTE) || r.taxa !== 'Beatriz Ramos') throw new Error(JSON.stringify(r));
    });
    await passo('cobrança e WhatsApp vão para a cessionária; o índice não corrige a taxa', async () => {
      const r = await page.evaluate((vid) => {
        if (!db.indices.find(i => i.id === 'ind-t')) upsert('indices', { id: 'ind-t', nome: 'IPCA', tipo: 'percentual', valores: { [monthKey(addMonths(todayStr(), -2))]: 5, [monthKey(addMonths(todayStr(), -1))]: 5 } });
        const v = getVenda(vid); upsert('vendas', Object.assign({}, v, { indiceId: 'ind-t', indiceBase: monthKey(addMonths(todayStr(), -3)) }));
        const tx = recebiveisDe(vid).find(x => x.tipo === 'taxa');
        return { txt: extratoTexto(getVenda(vid)), taxa: recValor(tx), st: recStatus(tx) };
      }, vid);
      if (!r.txt.includes('Cliente: Beatriz Ramos')) throw new Error(r.txt.slice(0, 80));
      if (r.taxa !== 1500 || r.st !== 'pago') throw new Error(`taxa ${r.taxa} ${r.st}`);
    });
    await passo('desfazer a cessão: o contrato volta para o cedente e a taxa sai', async () => {
      await page.evaluate(() => { state.contratoAba = 'partes'; renderContrato(); });
      await page.locator('#ctConteudo').getByRole('button', { name: 'Desfazer' }).click(); await page.waitForTimeout(300);
      const r = await page.evaluate((vid) => { const v = getVenda(vid); return { cli: v.cliente.nome, n: (v.cessoes || []).length, taxa: recebiveisDe(vid).some(x => x.tipo === 'taxa') }; }, vid);
      if (r.cli !== await page.evaluate(() => CEDENTE) || r.n !== 0 || r.taxa) throw new Error(JSON.stringify(r));
    });
    await passo('duas cessões seguidas: só a última se desfaz; o recibo segue quem era o comprador em cada data', async () => {
      await page.evaluate((vid) => abrirContrato(vid, 'resumo'), vid);
      await abrir(); await preencher('Beatriz Ramos', '11144477735', false);
      await page.evaluate(() => { document.getElementById('csData').value = addDays(todayStr(), -20); }); await registrar(); await page.evaluate(() => closeModal());
      await page.evaluate((vid) => abrirContrato(vid, 'resumo'), vid);
      await abrir(); await preencher('Helena Costa', '52998224725', false);
      await registrar(); await page.evaluate(() => closeModal());
      const r = await page.evaluate((vid) => { const v = getVenda(vid); return { cli: v.cliente.nome, n: v.cessoes.length, meio: compradoresNaData(v, addDays(todayStr(), -10)).map(p => p.nome).join(), antes: compradoresNaData(v, addDays(todayStr(), -40)).map(p => p.nome).join() }; }, vid);
      if (r.cli !== 'Helena Costa' || r.n !== 2 || r.meio !== 'Beatriz Ramos' || r.antes !== await page.evaluate(() => CEDENTE)) throw new Error(JSON.stringify(r));
      await page.evaluate(() => { state.contratoAba = 'partes'; renderContrato(); });
      if (await page.locator('#ctConteudo').getByRole('button', { name: 'Desfazer' }).count() !== 1) throw new Error('mais de um Desfazer');
      if (await page.locator('#ctConteudo').getByRole('button', { name: 'Termo' }).count() !== 2) throw new Error('cada cessão precisa do seu termo');
    });
    await passo('modelo de cessão no editor: aparece como exemplo e o "Ver exemplo" preenche os campos dela', async () => {
      await page.evaluate(() => { switchTab('cadastros'); }); await page.waitForTimeout(200);
      const lista = await page.evaluate(() => cadDocumentosHtml());
      if (!lista.includes('Cessão de direitos')) throw new Error('não aparece na lista de modelos');
      await page.evaluate(() => abrirModeloForm('', 'cessao')); await page.waitForTimeout(200);
      const r = await page.evaluate(() => ({ tipo: val('mdTipo'), corpo: val('mdCorpo').slice(0, 45) }));
      if (r.tipo !== 'cessao' || !r.corpo.startsWith('# INSTRUMENTO PARTICULAR DE CESSÃO')) throw new Error(JSON.stringify(r));
      await foot.getByRole('button', { name: 'Ver exemplo' }).click(); await page.waitForTimeout(200);
      const t = await page.evaluate(() => document.querySelector('#modalBody .doc-folha').innerText);
      if (!/R\$\s91\.263,84/.test(t) || !t.includes('Ana Souza') || !t.includes('Carlos Pereira')) throw new Error(t.slice(0, 200));
      await page.evaluate(() => closeModal());
    });
    await passo('no celular o formulário da cessão não sai da tela', async () => {
      await page.evaluate((vid) => abrirCessao(vid), vid); await page.waitForTimeout(300);
      const sobra = await page.evaluate(() => Math.max(...[...document.querySelectorAll('#modalBox input, #modalBox select')].filter(e => e.offsetParent).map(e => e.getBoundingClientRect().right)) - innerWidth);
      if (sobra > 0) throw new Error(`${sobra}px para fora`);
      await page.evaluate(() => closeModal());
    });
    await ctx.close();
  }
  await browser.close();
  if (erros.length) { console.log('\nERROS:\n' + erros.join('\n')); process.exit(1); }
  console.log('\nTudo certo.');
})();
