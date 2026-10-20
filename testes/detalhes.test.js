// Detalhes e movimento: janelas, avisos, troca de situação, pagamento, telas vazias e carregando.
// Rodar: servir a pasta do app (ex.: python3 -m http.server 8765 na pasta acima) e
//   BASE=http://127.0.0.1:8765/lotifly/ node testes/detalhes.test.js
// Precisa do Playwright com Chromium (CHROMIUM=/caminho/do/chromium se não for o padrão).
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/gestao/';
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--disable-gpu'] });
  const erros = [];
  const passo = async (nome, fn) => { try { await fn(); console.log('✔', nome); } catch (e) { console.log('✘', nome, e.message.split('\n')[0]); erros.push(nome + ': ' + e.message.split('\n')[0]); } };
  const abrir = async ({ w = 1366, est = 'exemplo', reduzir = false } = {}) => {
    const ctx = await browser.newContext({ viewport: { width: w, height: 860 }, reducedMotion: reduzir ? 'reduce' : 'no-preference', serviceWorkers: 'block', isMobile: w < 700, hasTouch: w < 700 });
    await ctx.route(/config\.js/, r => r.fulfill({ contentType: 'application/javascript', body: "window.GL_CONFIG={supabaseUrl:'',supabaseAnonKey:''};" }));
    const page = await ctx.newPage(); page.setDefaultTimeout(8000);
    page.on('pageerror', e => erros.push(`pageerror (${w}${reduzir ? ', reduzir' : ''}): ` + e.message)); page.on('dialog', d => d.accept());
    await page.goto(BASE + 'index.html?dados=' + est); await page.waitForFunction(() => window.PiorCaso && db.loteamentos.length); await page.waitForTimeout(400);
    await page.evaluate(() => { sessionStorage.setItem('gl_admin', '1'); startRole('admin'); document.querySelectorAll('.toast').forEach(t => t.remove()); }); await page.waitForTimeout(200);
    return { ctx, page };
  };
  const anim = (page, sel) => page.evaluate(s => { const e = document.querySelector(s); return e ? getComputedStyle(e).animationName : null; }, sel);

  // ---------------------------------------------------------------- janela no computador
  {
    const { ctx, page } = await abrir();
    await passo('janela entra com janela-entra e o fundo com fundo-entra', async () => {
      await page.evaluate(() => abrirPagamento(db.recebiveis.find(r => !r.valorPago).id));
      const a = await anim(page, '#modalBox'), b = await anim(page, '#modalOverlay');
      if (a !== 'janela-entra' || b !== 'fundo-entra') throw new Error(a + ' / ' + b);
    });
    await passo('fechar pelo ✕ anima a saída e fecha em até 300 ms', async () => {
      await page.click('.modal-close');
      if (!await page.evaluate(() => document.getElementById('modalOverlay').classList.contains('saindo'))) throw new Error('sem classe saindo');
      if (await anim(page, '#modalBox') !== 'janela-sai') throw new Error('sem janela-sai');
      await page.waitForTimeout(300);
      if (await page.evaluate(() => document.getElementById('modalOverlay').classList.contains('open'))) throw new Error('não fechou');
    });
    await passo('abrir outra janela durante a saída cancela a saída', async () => {
      await page.evaluate(() => abrirPagamento(db.recebiveis.find(r => !r.valorPago).id)); await page.waitForTimeout(250);
      await page.evaluate(() => { fecharJanela(); abrirPagamento(db.recebiveis.find(r => !r.valorPago).id); });
      await page.waitForTimeout(300);
      const st = await page.evaluate(() => ({ open: modalOverlay.classList.contains('open'), saindo: modalOverlay.classList.contains('saindo') }));
      if (!st.open || st.saindo) throw new Error(JSON.stringify(st));
      await page.evaluate(() => closeModal());
    });

    await passo('reserva: a parcela da proposta é a mesma do simulador do corretor (tabela Price)', async () => {
      const r = await page.evaluate(() => db.reservas.filter(r => r.proposta && r.proposta.nParcelas).map(r => { const lot = getLoteamento(r.loteamentoId); const sim = Math.round(pmt((num((lot.cond || {}).jurosMes) || 0) / 100, r.proposta.nParcelas, Math.max(0, r.proposta.valor - r.proposta.entrada)) * 100) / 100; return [parcelaDaProposta(r), sim]; }));
      if (!r.length || r.some(([a, b]) => Math.abs(a - b) > 0.005)) throw new Error(JSON.stringify(r));
      const id = await page.evaluate(() => db.reservas.find(r => r.proposta && r.proposta.nParcelas).id);
      await page.evaluate(id => abrirReservaAdmin(id), id); await page.waitForTimeout(250);
      const t = await page.evaluate(() => [...document.querySelectorAll('#modalBody .k')].find(k => k.textContent === 'Parcelas').parentElement.textContent);
      const esperado = await page.evaluate(id => fmtMoney(parcelaDaProposta(db.reservas.find(r => r.id === id))), id);
      if (!t.includes(esperado)) throw new Error(t + ' ≠ ' + esperado);
      await page.evaluate(() => closeModal());
    });

    await passo('teclado: a janela recebe o foco, o Tab não sai dela e, ao fechar, o foco volta', async () => {
      await page.evaluate(() => { const f = filtroRec(); f.status = 'aberto'; f.mes = 'all'; f.busca = ''; switchTab('recebiveis'); });
      const botao = page.locator('#av-recebiveis button[aria-label="Registrar pagamento"]').first();
      await botao.focus(); await page.keyboard.press('Enter'); await page.waitForTimeout(250);
      if (!await page.evaluate(() => document.getElementById('modalBox').contains(document.activeElement))) throw new Error('foco fora da janela ao abrir');
      for (let i = 0; i < 15; i++) await page.keyboard.press('Tab');
      if (!await page.evaluate(() => document.getElementById('modalBox').contains(document.activeElement))) throw new Error('Tab saiu da janela');
      await page.keyboard.press('Escape'); await page.waitForTimeout(300);
      const volta = await page.evaluate(() => document.activeElement && document.activeElement.getAttribute('aria-label'));
      if (volta !== 'Registrar pagamento') throw new Error('foco voltou para: ' + volta);
    });

    await passo('Início: % em atraso do mês = atraso das parcelas do mês ÷ valor de todas as parcelas do mês', async () => {
      await page.evaluate(() => { const m = todayStr().slice(0, 7); const r = recebiveisDo('').find(r => monthKey(r.vencimento) === m && !r.valorPago); upsert('recebiveis', Object.assign({}, r, { vencimento: addDays(todayStr(), -1).slice(0, 7) === m ? addDays(todayStr(), -1) : r.vencimento })); switchTab('painel'); });
      const r = await page.evaluate(() => { const m = todayStr().slice(0, 7); const rs = recebiveisDo('').filter(r => monthKey(r.vencimento) === m); const prev = rs.reduce((s, r) => s + recValor(r), 0), atr = rs.filter(r => recStatus(r) === 'atrasado').reduce((s, r) => s + recRestante(r), 0); return { esperado: fmtNum(atr / prev * 100, 1) + '% das parcelas do mês em atraso', txt: document.querySelector('#av-painel .bm').textContent }; });
      if (!r.txt.includes(r.esperado)) throw new Error(r.txt + ' ≠ ' + r.esperado);
    });

    await passo('inadimplência do mês: Início, Cobrança e Relatório mostram a mesma % e o mesmo atraso', async () => {
      /* uma parcela do mês passa a estar vencida e sem pagamento, para a % não ser zero */
      await page.evaluate(() => { const m = todayStr().slice(0, 7), ontem = addDays(todayStr(), -1); const r = recebiveisDo('').find(r => monthKey(r.vencimento) === m && !r.valorPago); if (r && ontem.slice(0, 7) === m) upsert('recebiveis', Object.assign({}, r, { vencimento: ontem })); state.escopo = ''; });
      const r = await page.evaluate(() => {
        const im = inadimplenciaDoMes(''); const pct = fmtNum(im.pct, 1) + '%';
        switchTab('painel'); const inicio = document.querySelector('#av-painel .bm').textContent;
        switchTab('cobranca'); const cob = document.querySelector('#av-cobranca .ct-resumo').textContent, cobAtraso = document.querySelector('#av-cobranca .cob-total').textContent.trim();
        const rel = relInadimplencia('').kpis;
        return { pct, inicio, cob, cobAtraso, inicioAtraso: document.querySelector('#av-painel .kpi.c-red .val').textContent.trim(), rel };
      });
      if (!r.inicio.includes(r.pct + ' das parcelas do mês')) throw new Error('Início: ' + r.inicio + ' ≠ ' + r.pct);
      if (!r.cob.includes(r.pct + ' das parcelas do mês')) throw new Error('Cobrança: ' + r.cob + ' ≠ ' + r.pct);
      if (r.cobAtraso !== r.inicioAtraso) throw new Error('Em atraso: Cobrança ' + r.cobAtraso + ' ≠ Início ' + r.inicioAtraso);
      if (!r.rel.includes(r.pct) || /da carteira/.test(r.rel)) throw new Error('Relatório: ' + r.rel.replace(/<[^>]+>/g, ' '));
    });

    // ---------------------------------------------------------------- pagamento recebido
    await passo('pagamento: a linha paga fica tingida de verde e o aviso diz de quem foi', async () => {
      await page.evaluate(() => { const f = filtroRec(); f.status = 'all'; f.mes = 'all'; f.busca = ''; switchTab('recebiveis'); }); await page.waitForTimeout(200);
      const id = await page.evaluate(() => db.recebiveis.find(r => !r.valorPago && document.querySelector(`[data-st="p:${r.id}"]`)).id);
      await page.evaluate(id => abrirPagamento(id), id); await page.waitForTimeout(250);
      await page.click('#modalFoot .btn-success'); await page.waitForTimeout(80);
      const r = await page.evaluate(id => { const el = document.querySelector(`[data-st="p:${id}"]`); const t = document.querySelector('.toast:last-child'); return { cls: el && el.className, cor: el && el.style.getPropertyValue('--destaque'), toast: t && t.className, txt: t && t.textContent }; }, id);
      if (!/st-mudou/.test(r.cls) || !/success/.test(r.cor)) throw new Error('linha: ' + JSON.stringify(r));
      if (!/\bok\b/.test(r.toast) || !/Parcela/.test(r.txt)) throw new Error('aviso: ' + JSON.stringify(r));
    });
    await passo('pagamento: o número "Pagas" da faixa ganha o tom de mudança', async () => {
      const k = await page.evaluate(() => [...document.querySelectorAll('.view.active .st-item.st-mudou .st-l')].map(l => l.textContent));
      if (!k.includes('Pagas')) throw new Error('marcados: ' + k.join(', '));
    });
    await passo('o aviso sai animado e é removido', async () => {
      await page.waitForTimeout(4700);
      if (await page.evaluate(() => document.querySelectorAll('.toast').length)) throw new Error('aviso continua na tela');
    });

    // ---------------------------------------------------------------- troca de situação do lote
    await passo('lote que muda de situação: a planta passa da cor antiga para a nova', async () => {
      await page.evaluate(() => { startRole('corretor'); switchTab('planta'); }); await page.waitForTimeout(400);
      /* A cor do primeiro quadro é lida na mesma chamada que desenha: numa chamada separada,
         com a máquina lenta, os dois quadros da troca às vezes já tinham passado. */
      const { id, logo } = await page.evaluate(() => { const l = lotesDo(curLot().id).find(x => x.status === 'disponivel'); upsert('lotes', Object.assign({}, l, { status: 'bloqueado' })); renderCurrent(); return { id: l.id, logo: document.querySelector(`.lote-shape[data-id="${l.id}"]`).getAttribute('class') }; });
      if (!/disponivel/.test(logo)) throw new Error('primeiro quadro deveria ter a cor antiga: ' + logo);
      await page.waitForTimeout(120);
      const depois = await page.evaluate(id => document.querySelector(`.lote-shape[data-id="${id}"]`).getAttribute('class'), id);
      if (!/bloqueado/.test(depois) || !/mudou/.test(depois) || /disponivel/.test(depois)) throw new Error('depois: ' + depois);
    });
    await passo('lote que muda de situação: a linha da lista do corretor é marcada', async () => {
      const id = await page.evaluate(() => { const l = lotesDo(curLot().id).find(x => x.status === 'disponivel'); switchTab('lotes'); upsert('lotes', Object.assign({}, l, { status: 'reservado' })); renderCurrent(); return l.id; });
      const r = await page.evaluate(id => { const el = document.querySelector(`#cv-lotes [data-st="l:${id}"]`); return el && el.className + ' ' + el.style.getPropertyValue('--destaque'); }, id);
      if (!/st-mudou/.test(r) || !/warn/.test(r)) throw new Error(r);
    });
    await passo('mudança em massa (10 lotes de uma vez) não pisca nada', async () => {
      await page.waitForTimeout(1600);
      await page.evaluate(() => { startRole('admin'); abrirEmpreendimento(curLot().id, 'lotes'); });
      await page.evaluate(() => { lotesDo(curLot().id).filter(l => l.status === 'disponivel').slice(0, 10).forEach(l => upsert('lotes', Object.assign({}, l, { status: 'bloqueado' }))); renderCurrent(); });
      const n = await page.evaluate(() => [...document.querySelectorAll('.st-mudou, .lote-shape.mudou')].filter(e => e.getClientRects().length).length);
      if (n) throw new Error(n + ' elementos marcados');
    });
    await ctx.close();
  }

  // ---------------------------------------------------------------- movimento reduzido
  {
    const { ctx, page } = await abrir({ reduzir: true });
    await passo('reduzir movimento: janela e aviso só aparecem (opacidade), sem deslizar', async () => {
      await page.evaluate(() => { abrirPagamento(db.recebiveis.find(r => !r.valorPago).id); toast('✅', 'teste', ''); });
      const a = await anim(page, '#modalBox'), b = await anim(page, '#modalOverlay'), t = await anim(page, '.toast');
      if (a !== 'aparecer' || b !== 'none' || t !== 'aparecer') throw new Error([a, b, t].join(' / '));
      await page.click('.modal-close');
      if (await anim(page, '#modalBox') !== 'sumir') throw new Error('saída: ' + await anim(page, '#modalBox'));
      await page.waitForTimeout(300);
    });
    await passo('reduzir movimento: a linha muda de cor, mas o selo e o contorno não se mexem', async () => {
      await page.evaluate(() => { const f = filtroRec(); f.status = 'all'; f.mes = 'all'; switchTab('recebiveis'); });
      const id = await page.evaluate(() => db.recebiveis.find(r => !r.valorPago && document.querySelector(`[data-st="p:${r.id}"]`)).id);
      await page.evaluate(id => { abrirPagamento(id); salvarPagamento(id); }, id); await page.waitForTimeout(60);
      /* Paga, a linha só mostra a data (selo é para exceção); se houver selo, ele fica parado */
      const r = await page.evaluate(id => { const el = document.querySelector(`[data-st="p:${id}"]`); const selo = el.querySelector('.pill, .badge'); return [getComputedStyle(el).animationName, selo ? getComputedStyle(selo).animationName : 'none']; }, id);
      if (r[0] !== 'linha-mudou' || r[1] !== 'none') throw new Error(r.join(' / '));
    });
    await passo('reduzir movimento: o carregando pulsa em vez de girar', async () => {
      const a = await page.evaluate(() => { const d = document.createElement('div'); d.innerHTML = carregandoHtml('x'); document.body.appendChild(d); const n = getComputedStyle(d.querySelector('.spinner')).animationName; d.remove(); return n; });
      if (a !== 'pulsar') throw new Error(a);
    });
    await ctx.close();
  }

  // ---------------------------------------------------------------- telas vazias e carregando
  {
    const { ctx, page } = await abrir({ est: 'vazio' });
    await passo('gráfico sem dados mostra uma frase, não a escala "0, 1, 1"', async () => {
      await page.evaluate(() => { window.__vazios = 0; const f = window.graficoVazio; window.graficoVazio = (...a) => { window.__vazios++; return f(...a); }; switchTab('painel'); }); await page.waitForTimeout(300);
      if (await page.evaluate(() => window.__vazios) < 2) throw new Error('graficoVazio chamado ' + await page.evaluate(() => window.__vazios) + 'x');
    });
    await passo('A receber sem contratos explica de onde vêm as parcelas', async () => {
      await page.evaluate(() => switchTab('recebiveis'));
      const t = await page.textContent('#av-recebiveis .empty'); if (!/registra um contrato/.test(t)) throw new Error(t);
    });
    await passo('corretor sem lotes: "ainda não tem lotes", não "nenhum lote com esses filtros"', async () => {
      await page.evaluate(() => { startRole('corretor'); switchTab('lotes'); });
      const t = await page.textContent('#cv-lotes .empty'); if (!/ainda não tem lotes/.test(t)) throw new Error(t);
    });
    await passo('carregando gira e só aparece depois de 250 ms', async () => {
      const r = await page.evaluate(() => { const d = document.createElement('div'); d.innerHTML = carregandoHtml('x'); document.body.appendChild(d); const e = d.firstChild; const o = [getComputedStyle(d.querySelector('.spinner')).animationName, getComputedStyle(e).animationDelay, e.getAttribute('role')]; d.remove(); return o; });
      if (r[0] !== 'girar' || r[1] !== '0.25s' || r[2] !== 'status') throw new Error(r.join(' / '));
    });
    await passo('botão ocupado trava, mostra o indicador e volta ao normal', async () => {
      const r = await page.evaluate(() => { const b = document.createElement('button'); b.className = 'btn btn-primary'; b.textContent = 'Enviar pedido'; document.body.appendChild(b); botaoOcupado(b, 'Enviando…'); const a = [b.disabled, b.textContent, getComputedStyle(b, '::before').animationName]; botaoOcupado(b); a.push(b.disabled, b.textContent); b.remove(); return a; });
      if (r.join('|') !== 'true|Enviando…|girar|false|Enviar pedido') throw new Error(r.join(' | '));
    });
    await ctx.close();
  }

  // ---------------------------------------------------------------- celular: a gaveta continua com mola
  {
    const { ctx, page } = await abrir({ w: 390 });
    await passo('celular: a janela continua sendo a gaveta com mola (sem animação CSS)', async () => {
      await page.evaluate(() => abrirPagamento(db.recebiveis.find(r => !r.valorPago).id));
      const a = await anim(page, '#modalBox'); if (a !== 'none') throw new Error(a);
      await page.evaluate(() => fecharJanela()); await page.waitForTimeout(900);
      if (await page.evaluate(() => modalOverlay.classList.contains('open'))) throw new Error('gaveta não fechou');
    });
    await ctx.close();
  }

  console.log(erros.length ? '\nERROS:\n' + erros.join('\n') : '\ntudo ok');
  await browser.close(); process.exit(erros.length ? 1 : 0);
})();
