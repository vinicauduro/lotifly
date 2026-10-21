// Distrato pela tela: retenção padrão de 25% (editável), outros descontos, devolução à vista ou
// em até 12 parcelas, o que acontece com o contrato, as parcelas, o lote, os boletos e A pagar,
// o termo de distrato, desfazer e o modelo no editor. No celular e no computador.
// Rodar: BASE=http://127.0.0.1:8765/lotifly/ node testes/distrato.test.js
const { chromium } = require('playwright');
const { responderConfirmacoes } = require('./confirmacoes');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/gestao/';
const r2 = x => Math.round(x * 100) / 100;
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--disable-gpu'] });
  const erros = [];
  for (const w of [390, 1440]) {
    const passo = async (nome, fn) => { try { await fn(); console.log('✔', w, nome); } catch (e) { console.log('✘', w, nome, e.message.split('\n')[0]); erros.push(`${w} ${nome}: ${e.message.split('\n')[0]}`); } };
    const ctx = await browser.newContext({ viewport: { width: w, height: w < 700 ? 844 : 900 }, hasTouch: w < 700, serviceWorkers: 'block' });
    await ctx.route(/config\.js/, r => r.fulfill({ contentType: 'application/javascript', body: "window.GL_CONFIG={supabaseUrl:'',supabaseAnonKey:''};" }));
    const page = await ctx.newPage(); page.setDefaultTimeout(8000);
    const dialogos = []; page.on('dialog', d => { dialogos.push(d.message()); d.accept(); }); await responderConfirmacoes(page);
    page.on('pageerror', e => erros.push(`${w} pageerror: ${e.message}`));
    await page.goto(BASE + 'index.html?dados=exemplo'); await page.waitForFunction(() => window.PiorCaso && db.loteamentos.length); await page.waitForTimeout(300);
    /* Contrato de teste: entrada e 3 parcelas pagas, o resto em aberto; uma parcela em aberto já
       registrada no banco; comissão ainda não paga */
    const vid = await page.evaluate(() => {
      sessionStorage.setItem('gl_admin', '1'); startRole('admin'); document.querySelectorAll('#devDados,.toast').forEach(e => e.remove());
      window.print = () => {};
      window.ultimoAviso = () => { const t = [...document.querySelectorAll('#toastContainer .toast')].pop(); return t ? t.textContent.replace(/\s+/g, ' ').trim() : ''; };
      const v = db.vendas.find(v => v.status === 'ativa' && v.loteId && getLote(v.loteId).vendaId === v.id);
      upsert('vendas', Object.assign({}, v, { comissaoValor: 7000, comissaoPaga: false }));
      recebiveisDe(v.id).forEach((r, i) => upsert('recebiveis', Object.assign({}, r, i < 4 ? { valorPago: recValor(r), dataPagamento: addDays(todayStr(), -90 + i), forma: 'PIX' } : { valorPago: 0, dataPagamento: null, nossoNumero: i === 4 ? '10000123' : null, remessaEm: i === 4 ? addDays(todayStr(), -5) : null })));
      window.PAGO = Math.round(recebiveisDe(v.id).reduce((s, r) => s + num(r.valorPago), 0) * 100) / 100;
      window.NREC = recebiveisDe(v.id).length; window.LOTE = v.loteId; window.BOLETO = recebiveisDe(v.id)[4].id;
      abrirContrato(v.id, 'resumo');
      return v.id;
    });
    const foot = page.locator('#modalFoot');
    const PAGO = await page.evaluate(() => PAGO);
    const abrir = async () => {
      await page.evaluate(() => document.querySelectorAll('.toast').forEach(e => e.remove()));
      await page.locator('.ct-topo summary', { hasText: 'Mais' }).click(); await page.waitForTimeout(150);
      await page.locator('.ct-topo details.menu[open] .menu-item', { hasText: 'Fazer distrato' }).click(); await page.waitForTimeout(300);
    };
    const registrar = async () => { await foot.getByRole('button', { name: 'Registrar distrato' }).click(); await page.waitForTimeout(400); };

    await passo('Mais › Fazer distrato: o que foi pago, as parcelas canceladas, os avisos e a retenção padrão de 25%', async () => {
      await abrir();
      const r = await page.evaluate(() => { const n = t => t.replace(/\s+/g, ' '); return { t: modalTitle.textContent, corpo: n(modalBody.textContent), ret: val('dtRetPct'), res: n(dtResumo.textContent), pago: n(fmtMoney(PAGO)), dev: n(fmtMoney(Math.round(PAGO * 75) / 100)) }; });
      if (r.t !== 'Distrato do contrato' || !r.corpo.includes(r.pago) || r.ret !== '25') throw new Error(JSON.stringify({ t: r.t, ret: r.ret }));
      if (!/1 parcela\(s\) têm boleto registrado/.test(r.corpo) || !/comissão de R\$\s7\.000,00/.test(r.corpo)) throw new Error('avisos: ' + r.corpo.slice(0, 300));
      if (!r.res.includes('devolver ' + r.dev)) throw new Error('resumo: ' + r.res);
    });
    await passo('retenção editável: acima de 25% avisa; o resumo acompanha', async () => {
      await page.fill('#dtRetPct', '30'); await page.waitForTimeout(80);
      if (!/acima de 25%/.test(await page.evaluate(() => dtRetHint.textContent))) throw new Error('sem aviso acima de 25%');
      await page.fill('#dtRetPct', '20'); await page.fill('#dtOutros', '500'); await page.waitForTimeout(80);
      const res = await page.evaluate(() => dtResumo.textContent.replace(/\s+/g, ' '));
      const dev = await page.evaluate(() => fmtMoney(Math.round((PAGO - Math.round(PAGO * 20) / 100 - 500) * 100) / 100).replace(/\s+/g, ' '));
      if (!res.includes('devolver ' + dev)) throw new Error(res);
    });
    await passo('parcelado: de 1 a 12 parcelas; outros descontos e "outro motivo" precisam de descrição', async () => {
      await page.selectOption('#dtForma', 'parcelado'); await page.fill('#dtN', '13'); await page.waitForTimeout(80);
      if (!/de 1 a 12 parcelas/.test(await page.evaluate(() => dtResumo.textContent))) throw new Error('sem aviso de 13 parcelas');
      await registrar(); if (!/Parcelamento de 1 a 12/.test(await page.evaluate(() => ultimoAviso()))) throw new Error(await page.evaluate(() => ultimoAviso()));
      await page.fill('#dtN', '6'); await page.selectOption('#dtMotivo', 'outro'); await registrar();
      if (!/Descreva o motivo/.test(await page.evaluate(() => ultimoAviso()))) throw new Error(await page.evaluate(() => ultimoAviso()));
      await page.selectOption('#dtMotivo', 'inadimplencia'); await page.fill('#dtMotivoTxt', '6 parcelas em atraso'); await registrar();
      if (!/outros descontos/.test(await page.evaluate(() => ultimoAviso()))) throw new Error(await page.evaluate(() => ultimoAviso()));
      if (await page.evaluate((vid) => getVenda(vid).status, vid) === 'distrato') throw new Error('registrou com erro no formulário');
    });
    await passo('registrar: contrato vira Distrato, lote volta a disponível, devolução em 6 parcelas em A pagar', async () => {
      await page.fill('#dtOutrosDesc', 'IPTU de 2025 e 2026'); await registrar();
      const r = await page.evaluate((vid) => { const v = getVenda(vid), d = v.distrato || {}, l = getLote(LOTE); const cs = (d.custoIds || []).map(id => db.custos.find(c => c.id === id));
        return { st: v.status, em: v.distratoEm, d: [d.pago, d.retencaoPct, d.retencao, d.outrosDescontos, d.devolucao, d.forma, (d.parcelas || []).length], soma: Math.round((d.parcelas || []).reduce((s, p) => s + p.valor, 0) * 100) / 100,
          cs: cs.map(c => c && [c.categoriaId, c.status, c.vendaId === vid, c.valor].join(':')), cat: db.categorias.some(c => c.id === CAT_DEVOLUCAO), lote: [l.status, l.vendaId], nrec: recebiveisDe(vid).length, aReceber: recebiveisDo('').filter(x => x.vendaId === vid).length, titulo: modalTitle.textContent }; }, vid);
      const ret = r2(PAGO * 0.2), dev = r2(PAGO - ret - 500);
      if (r.st !== 'distrato' || !r.em) throw new Error('situação ' + r.st);
      if (r.d.join('|') !== [PAGO, 20, ret, 500, dev, 'parcelado', 6].join('|') || r.soma !== dev) throw new Error(JSON.stringify(r.d) + ' soma ' + r.soma);
      if (r.cs.length !== 6 || r.cs.some(c => !c || !c.startsWith('devolucao-distrato:pendente:true')) || !r.cat) throw new Error('A pagar: ' + JSON.stringify(r.cs));
      if (r.lote.join() !== 'disponivel,') throw new Error('lote: ' + r.lote);
      if (r.nrec !== await page.evaluate(() => NREC) || r.aReceber !== 0) throw new Error(`parcelas: ${r.nrec} guardadas, ${r.aReceber} a receber`);
      if (r.titulo !== 'Gerar o termo de distrato agora?') throw new Error('não perguntou do termo');
    });
    await passo('termo de distrato: partes, motivo, valores por extenso, retenção, outros descontos, 6 parcelas e quitação', async () => {
      await foot.getByRole('button', { name: 'Gerar termo' }).click(); await page.waitForTimeout(300);
      const r = await page.evaluate((vid) => { const d = getVenda(vid).distrato; return { t: document.getElementById('docFolha').innerText.replace(/\s+/g, ' '), pago: `${fmtMoney(d.pago)} (${moedaExtenso(d.pago)})`.replace(/\s+/g, ' '), dev: `${fmtMoney(d.devolucao)} (${moedaExtenso(d.devolucao)})`.replace(/\s+/g, ' '), h3: [...document.querySelectorAll('#docFolha h3')].map(h => h.textContent.split('—')[0].trim().replace('CLÁUSULA ', '')).join() }; }, vid);
      const f = ['INSTRUMENTO PARTICULAR DE DISTRATO', 'em razão de inadimplência do promitente comprador — 6 parcelas em atraso', r.pago, 'correspondentes a 20% do valor pago', 'referentes a IPTU de 2025 e 2026', r.dev, 'em 6 parcelas mensais e sucessivas', 'plena, geral e irrevogável quitação', 'Promitente comprador', 'Promitente vendedora'];
      const falta = f.filter(x => !r.t.includes(x));
      if (falta.length) throw new Error('falta: ' + falta.join(' | '));
      if (/undefined|NaN|\bnull\b/.test(r.t)) throw new Error('texto quebrado');
      if (r.h3 !== 'PRIMEIRA,SEGUNDA,TERCEIRA,QUARTA,QUINTA') throw new Error('cláusulas: ' + r.h3);
      await page.evaluate(() => closeModal());
    });
    await passo('página do contrato: números do distrato, parcelas canceladas, termo em Documentos, histórico e menu sem cessão/antecipar', async () => {
      const k = await page.locator('.ct-kpis').innerText();
      if (!/Pago pelo comprador/.test(k) || !/A devolver/.test(k) || /A receber/.test(k)) throw new Error('KPIs: ' + k.replace(/\s+/g, ' '));
      const card = await page.locator('.ct-distrato').innerText();
      const badges = await page.evaluate(() => [...document.querySelectorAll('.ct-distrato tbody .badge')].map(b => b.textContent).join());
      if (badges !== Array(6).fill('Pendente').join() || !/Retenção \(20%\)/.test(card)) throw new Error('cartão: ' + badges + ' / ' + card.replace(/\s+/g, ' ').slice(0, 160));
      await page.evaluate(() => { state.contratoAba = 'parcelas'; renderContrato(); });
      const p = await page.evaluate(() => [...document.querySelectorAll('#ctConteudo tbody .badge')].map(b => b.textContent));
      if (!p.includes('Cancelada') || p.includes('Atrasado') || p.includes('Pendente')) throw new Error('parcelas: ' + [...new Set(p)].join(','));
      await page.evaluate(() => { state.contratoAba = 'documentos'; renderContrato(); });
      if (!await page.locator('#ctConteudo', { hasText: 'Termo de distrato' }).count()) throw new Error('sem o termo em Documentos');
      await page.evaluate(() => { state.contratoAba = 'historico'; renderContrato(); });
      if ((await page.locator('#ctConteudo').innerText()).match(/Distrato:/g).length !== 1) throw new Error('histórico');
      await page.locator('.ct-topo summary', { hasText: 'Mais' }).click(); await page.waitForTimeout(150);
      const menu = await page.locator('.ct-topo details.menu[open] .menu-lista').innerText();
      if (/Fazer distrato|Cessão de direitos|Antecipar/.test(menu)) throw new Error('menu: ' + menu.replace(/\s+/g, ' '));
      await page.keyboard.press('Escape');
    });
    await passo('boleto registrado vai para a baixa na remessa; devolução fora do orçamento da obra e das despesas do imóvel', async () => {
      const r = await page.evaluate((vid) => ({ acao: remessaPendente(db.recebiveis.find(x => x.id === BOLETO)), obra: db.custos.filter(c => c.vendaId === vid && custoDeObra(c)).length, desp: despesasDoImovelHtml(getVenda(vid)).includes('Devolução do distrato') }), vid);
      if (r.acao !== 'baixar' || r.obra !== 0 || r.desp) throw new Error(JSON.stringify(r));
    });
    await page.evaluate(() => { if (document.getElementById('modalOverlay').classList.contains('open')) closeModal(); });
    await passo('desfazer (sem devolução paga): o contrato volta, o lote volta a vendido e A pagar perde a devolução', async () => {
      await page.evaluate(() => { state.contratoAba = 'resumo'; renderContrato(); });
      await page.locator('.ct-distrato').getByRole('button', { name: 'Desfazer' }).click(); await page.waitForTimeout(300);
      const r = await page.evaluate((vid) => { const v = getVenda(vid); return { st: v.status, d: v.distrato, lote: [getLote(LOTE).status, getLote(LOTE).vendaId === vid], custos: db.custos.filter(c => c.vendaId === vid && c.categoriaId === CAT_DEVOLUCAO).length }; }, vid);
      if (r.st !== 'ativa' || r.d || r.lote.join() !== 'vendido,true' || r.custos !== 0) throw new Error(JSON.stringify(r));
    });
    await passo('distrato à vista; com a devolução paga, não dá mais para desfazer', async () => {
      await page.evaluate((vid) => abrirContrato(vid, 'resumo'), vid);
      await abrir(); await registrar(); await page.evaluate(() => closeModal());
      const c = await page.evaluate((vid) => { const d = getVenda(vid).distrato; return { n: d.parcelas.length, forma: d.forma, dev: d.devolucao, esperado: Math.round(PAGO * 75) / 100, custo: d.custoIds[0] }; }, vid);
      if (c.n !== 1 || c.forma !== 'vista' || c.dev !== c.esperado) throw new Error(JSON.stringify(c));
      await page.evaluate((id) => { pagarCusto(id); salvarPagamentoCusto(id); }, c.custo); await page.waitForTimeout(200);
      await page.evaluate((vid) => { abrirContrato(vid, 'resumo'); }, vid); await page.waitForTimeout(200);
      if (await page.locator('.ct-distrato').getByRole('button', { name: 'Desfazer' }).count()) throw new Error('Desfazer aparece com devolução paga');
      await page.evaluate((vid) => desfazerDistrato(vid), vid); await page.waitForTimeout(150);
      if (await page.evaluate((vid) => getVenda(vid).status, vid) !== 'distrato' || !/já paga/.test(await page.evaluate(() => ultimoAviso()))) throw new Error('desfez com devolução paga');
    });
    await passo('modelo de distrato no editor, com "Ver exemplo" preenchido', async () => {
      if (!await page.evaluate(() => cadDocumentosHtml().includes('Distrato'))) throw new Error('não aparece na lista');
      await page.evaluate(() => abrirModeloForm('', 'distrato')); await page.waitForTimeout(200);
      if (await page.evaluate(() => val('mdTipo')) !== 'distrato' || !await page.evaluate(() => val('mdCorpo').startsWith('# INSTRUMENTO PARTICULAR DE DISTRATO'))) throw new Error('modelo');
      await foot.getByRole('button', { name: 'Ver exemplo' }).click(); await page.waitForTimeout(200);
      const t = await page.evaluate(() => document.querySelector('#modalBody .doc-folha').innerText);
      if (!/R\$\s30\.300,00/.test(t) || !t.includes('IPTU de 2025 e 2026')) throw new Error(t.slice(0, 200));
      await page.evaluate(() => closeModal());
    });
    await passo('no celular o formulário do distrato não sai da tela', async () => {
      await page.evaluate(() => { const v = db.vendas.find(v => v.status === 'ativa'); abrirDistrato(v.id); }); await page.waitForTimeout(300);
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
