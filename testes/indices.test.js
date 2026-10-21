// Correção das parcelas por índice, conferida contra uma planilha calculada aqui, à parte.
// Regras do sistema: a parcela que vence no mês M usa os índices do mês base até M-1 (o índice
// de um mês só sai no mês seguinte); mês negativo (deflação) entra como 0%; depois de vencida
// a parcela não recebe mais índice; paga, o valor congela; entrada não é corrigida. No CUB
// (pontos), a correção é a razão entre os valores publicados, sem baixar.
// Também confere a tela de lançamento: lançar um mês antigo mostra o que muda antes de salvar.
// Rodar: BASE=http://127.0.0.1:8765/lotifly/ node testes/indices.test.js
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/gestao/';
const r2 = x => Math.round(x * 100) / 100;
/* IPCA de teste: março com deflação; setembro ainda não lançado */
const IPCA = { '2026-01': 0.50, '2026-02': 0.40, '2026-03': -0.20, '2026-04': 0.30, '2026-05': 0.25, '2026-06': 0.10, '2026-07': 0.35, '2026-08': 0.45 };
const CUB = { '2025-12': 2500, '2026-01': 2525, '2026-02': 2550, '2026-03': 2540, '2026-04': 2600, '2026-05': 2613 };
const meses = (de, ate) => { const out = []; let [y, m] = de.split('-').map(Number); const [y2, m2] = ate.split('-').map(Number); while (y < y2 || (y === y2 && m <= m2)) { out.push(`${y}-${String(m).padStart(2, '0')}`); m++; if (m > 12) { m = 1; y++; } } return out; };
const mesAnt = mm => { let [y, m] = mm.split('-').map(Number); m--; if (!m) { m = 12; y--; } return `${y}-${String(m).padStart(2, '0')}`; };
/* A planilha: valor corrigido de uma parcela de 1.000,00 que vence em mesParc, base 2026-01 */
const planilhaPct = (vals, mesParc) => r2(1000 * meses('2026-01', mesAnt(mesParc)).reduce((f, m) => vals[m] == null ? f : f * (1 + Math.max(0, vals[m]) / 100), 1));
const planilhaCub = mesParc => { let f = 1; meses('2026-01', mesAnt(mesParc)).forEach(m => { const v = CUB[m], a = CUB[mesAnt(m)]; if (v && a) f *= Math.max(1, v / a); }); return r2(1000 * f); };
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--disable-gpu'] });
  const erros = [];
  for (const w of [1440, 390]) {
    const passo = async (nome, fn) => { try { await fn(); console.log('✔', w, nome); } catch (e) { console.log('✘', w, nome, e.message.split('\n')[0]); erros.push(`${w} ${nome}: ${e.message.split('\n')[0]}`); } };
    const ctx = await browser.newContext({ viewport: { width: w, height: w < 700 ? 844 : 900 }, hasTouch: w < 700, serviceWorkers: 'block' });
    await ctx.route(/config\.js/, r => r.fulfill({ contentType: 'application/javascript', body: "window.GL_CONFIG={supabaseUrl:'',supabaseAnonKey:''};" }));
    const page = await ctx.newPage(); page.setDefaultTimeout(8000);
    page.on('pageerror', e => erros.push(`${w} pageerror: ${e.message}`)); page.on('dialog', d => d.accept());
    await page.goto(BASE + 'index.html?dados=exemplo'); await page.waitForFunction(() => window.PiorCaso && db.loteamentos.length); await page.waitForTimeout(300);
    /* Dois contratos de teste, venda em 10/01/2026, base jan/2026, entrada de 5.000 e 12
       parcelas de 1.000,00 de fev/2026 a jan/2027: um pelo IPCA, outro pelo CUB */
    await page.evaluate(({ IPCA, CUB }) => {
      sessionStorage.setItem('gl_admin', '1'); startRole('admin'); document.querySelectorAll('#devDados,.toast').forEach(e => e.remove());
      upsert('indices', { id: 'ix-ipca', codigo: 'IPCA', nome: 'IPCA (IBGE)', tipo: 'percentual', valores: IPCA });
      upsert('indices', { id: 'ix-cub', codigo: 'CUB', nome: 'CUB (Sinduscon)', tipo: 'pontos', valores: CUB });
      const base = db.vendas.find(v => v.status === 'ativa');
      const cria = (id, indiceId) => {
        const v = Object.assign(JSON.parse(JSON.stringify(base)), { id, loteId: null, imovel: { descricao: 'Lote de teste ' + id }, status: 'ativa', dataVenda: '2026-01-10', valorTotal: 17000, entrada: 5000, dataEntrada: '2026-01-10', nParcelas: 12, valorParcela: 1000, jurosMes: 0, baloes: [], primeiroVencimento: '2026-02-10', indiceId, indiceBase: '2026-01' });
        upsert('vendas', v); gerarRecebiveis(v).forEach(r => upsert('recebiveis', r));
      };
      cria('vi1', 'ix-ipca'); cria('vi2', 'ix-cub');
      window.parcela = (vid, mes) => recebiveisDe(vid).find(r => r.tipo === 'parcela' && r.vencimento.startsWith(mes));
    }, { IPCA, CUB });

    if (w === 1440) {
      await passo('IPCA: cada parcela corrigida bate com a planilha (deflação de março entra como 0%)', async () => {
        const sis = await page.evaluate(() => recebiveisDe('vi1').filter(r => r.tipo === 'parcela').map(r => [r.vencimento.slice(0, 7), recValor(r)]));
        const ruins = sis.filter(([m, v]) => Math.abs(v - planilhaPct(IPCA, m)) > 0.005).map(([m, v]) => `${m}: sistema ${v} × planilha ${planilhaPct(IPCA, m)}`);
        if (ruins.length) throw new Error(ruins.join(' | '));
        const [fev, mar, abr] = ['2026-02', '2026-03', '2026-04'].map(m => sis.find(x => x[0] === m)[1]);
        if (fev !== 1005 || mar !== 1009.02 || abr !== mar) throw new Error(`fev ${fev}, mar ${mar}, abr ${abr} (março negativo não pode reduzir)`);
      });
      await passo('a parcela usa o índice do mês anterior ao vencimento (a de agosto não vê o IPCA de agosto)', async () => {
        const r = await page.evaluate(() => { const antes = recValor(parcela('vi1', '2026-08')); const ind = getIndice('ix-ipca'); const vals = Object.assign({}, ind.valores, { '2026-08': 5 }); ind.valores = vals; const depois = recValor(parcela('vi1', '2026-08')), set = recValor(parcela('vi1', '2026-09')); ind.valores = Object.assign({}, vals, { '2026-08': 0.45 }); return { antes, depois, set }; });
        if (r.antes !== r.depois) throw new Error(`agosto mudou com o índice de agosto: ${r.antes} → ${r.depois}`);
        if (r.set <= r.depois) throw new Error('setembro deveria usar o índice de agosto');
      });
      await passo('mês sem lançamento: a parcela fica sem aquele mês, o sistema aponta o que falta e a remessa espera', async () => {
        const r = await page.evaluate(() => ({ falta: mesesFaltando('ix-ipca', '2026-01', '2026-10'), bloq: bloqueioRemessa(parcela('vi1', '2026-10')), out: recValor(parcela('vi1', '2026-10')) }));
        if (r.falta.join() !== '2026-09') throw new Error('falta: ' + r.falta.join());
        if (!/Falta lançar IPCA de set/i.test(r.bloq || '')) throw new Error('remessa: ' + r.bloq);
        if (Math.abs(r.out - planilhaPct(IPCA, '2026-10')) > 0.005) throw new Error(`outubro ${r.out}`);
      });
      await passo('entrada não é corrigida', async () => {
        const e = await page.evaluate(() => recValor(recebiveisDe('vi1').find(r => r.tipo === 'entrada')));
        if (e !== 5000) throw new Error('entrada ' + e);
      });
      await passo('CUB (pontos): razão entre os valores publicados; mês de queda conta 0% e a alta seguinte conta inteira', async () => {
        const sis = await page.evaluate(() => ['2026-02', '2026-03', '2026-04', '2026-05', '2026-06'].map(m => [m, recValor(parcela('vi2', m))]));
        const ruins = sis.filter(([m, v]) => Math.abs(v - planilhaCub(m)) > 0.005).map(([m, v]) => `${m}: sistema ${v} × planilha ${planilhaCub(m)}`);
        if (ruins.length) throw new Error(ruins.join(' | '));
        /* Março caiu (2.550 → 2.540) e conta 0%; abril subiu (2.540 → 2.600) e conta inteiro.
           É a regra do contrato ("variação negativa = zero") mês a mês — o "efeito catraca":
           maio fica 4,41% acima, enquanto o CUB subiu 4,0% de dezembro a abril. */
        if (sis[2][1] !== 1020 || sis[3][1] !== r2(1020 * 2600 / 2540)) throw new Error(`abril ${sis[2][1]}, maio ${sis[3][1]}`);
      });
      await passo('parcela paga congela: um índice lançado depois não muda o que o cliente já pagou', async () => {
        const pago = await page.evaluate(() => { const r = parcela('vi1', '2026-06'); abrirPagamento(r.id); return recValor(r); });
        await page.waitForTimeout(200);
        /* parcela atrasada: escolhe "sem multa e juros" para pagar exatamente o valor da parcela */
        if (await page.locator('input[name="pgEnc"][value="sem"]').count()) await page.check('input[name="pgEnc"][value="sem"]');
        await page.locator('#modalFoot').getByRole('button', { name: 'Confirmar', exact: true }).click(); await page.waitForTimeout(200);
        const r = await page.evaluate(() => { const ind = getIndice('ix-ipca'); const orig = ind.valores; ind.valores = Object.assign({}, orig, { '2026-02': 1.40 }); const out = { jun: recValor(parcela('vi1', '2026-06')), jul: recValor(parcela('vi1', '2026-07')) }; ind.valores = orig; return out; });
        if (r.jun !== pago) throw new Error(`a paga mudou: ${pago} → ${r.jun}`);
        if (Math.abs(r.jul - planilhaPct(Object.assign({}, IPCA, { '2026-02': 1.40 }), '2026-07')) > 0.005) throw new Error('a em aberto não mudou como devia: ' + r.jul);
      });
    }
    await passo('lançar um mês antigo pela tela: mostra o que muda (cobrado → ajustado), separa as pagas, e só salva ao confirmar', async () => {
      await page.evaluate(() => { const r = parcela('vi1', '2026-06'); if (!(num(r.valorPago) > 0)) upsert('recebiveis', Object.assign({}, r, { valorPago: recValor(r), valorCorrigido: recValor(r), dataPagamento: '2026-06-10', forma: 'PIX' })); switchTab('indices'); abrirLancarIndice('ix-ipca', '2026-02'); });
      await page.waitForTimeout(250);
      await page.fill('#lxValor', '1.40'); await page.locator('#modalFoot').getByRole('button', { name: 'Salvar' }).click(); await page.waitForTimeout(300);
      const m = await page.evaluate(() => ({ t: modalTitle.textContent, corpo: modalBody.innerText.replace(/\s+/g, ' '), salvo: getIndice('ix-ipca').valores['2026-02'] }));
      if (m.t !== 'Isto muda parcelas que já existem') throw new Error('título: ' + m.t);
      if (m.salvo !== 0.4) throw new Error('salvou antes de confirmar');
      const mar = await page.evaluate(() => fmtMoney(recValor(parcela('vi1', '2026-03'))).replace(/\s+/g, ' '));
      const novo = 'R$ ' + planilhaPct(Object.assign({}, IPCA, { '2026-02': 1.40 }), '2026-03').toLocaleString('pt-BR', { minimumFractionDigits: 2 });
      if (!m.corpo.includes('Parcelas em aberto que mudam') || !m.corpo.includes(mar) || !m.corpo.includes(novo)) throw new Error(`sem ${mar} → ${novo}: ` + m.corpo.slice(0, 300));
      if (!/Parcelas já pagas que não mudam/.test(m.corpo)) throw new Error('não separou a paga');
      const sobra = await page.evaluate(() => document.getElementById('modalBox').getBoundingClientRect().right - innerWidth);
      if (sobra > 1) throw new Error(`janela sai ${sobra}px da tela`);
      await page.locator('#modalFoot').getByRole('button', { name: 'Confirmar e salvar' }).click(); await page.waitForTimeout(300);
      const r = await page.evaluate(() => ({ v: getIndice('ix-ipca').valores['2026-02'], mar: recValor(parcela('vi1', '2026-03')) }));
      if (r.v !== 1.4 || Math.abs(r.mar - planilhaPct(Object.assign({}, IPCA, { '2026-02': 1.40 }), '2026-03')) > 0.005) throw new Error(JSON.stringify(r));
      await page.evaluate(() => { const ind = getIndice('ix-ipca'); upsert('indices', Object.assign({}, ind, { valores: Object.assign({}, ind.valores, { '2026-02': 0.4 }) })); });
    });
    await passo('lançar o mês corrente que não mexe em nada já existente salva direto, sem perguntar', async () => {
      await page.evaluate(() => abrirLancarIndice('ix-ipca', '2027-06')); await page.waitForTimeout(200);
      await page.fill('#lxValor', '0.30'); await page.locator('#modalFoot').getByRole('button', { name: 'Salvar' }).click(); await page.waitForTimeout(300);
      const r = await page.evaluate(() => ({ v: getIndice('ix-ipca').valores['2027-06'], aberto: document.getElementById('modalOverlay').classList.contains('open') }));
      if (r.v !== 0.3 || r.aberto) throw new Error(JSON.stringify(r));
    });
    await ctx.close();
  }
  await browser.close();
  if (erros.length) { console.log('\nERROS:\n' + erros.join('\n')); process.exit(1); }
  console.log('\nTudo certo.');
})();
