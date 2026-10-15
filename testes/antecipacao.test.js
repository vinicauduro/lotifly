// Antecipação e quitação com números conhecidos, como na planilha: contrato de R$ 100.000,00
// financiados a 1% ao mês em 12 parcelas (Price: R$ 8.884,88). Cada conta do sistema é
// comparada com uma tabela Price calculada aqui, à parte, sem usar o código do app.
// Rodar: BASE=http://127.0.0.1:8765/lotifly/ node testes/antecipacao.test.js
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/gestao/';
const r2 = x => Math.round(x * 100) / 100;
const PV = 100000, I = 0.01, N = 12;
const PMT = r2(PV * I / (1 - Math.pow(1 + I, -N)));               // 8884.88
const vp = k => PMT / Math.pow(1 + I, k);                          // parcela k, a k meses de hoje
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--disable-gpu'] });
  const erros = [];
  const passo = async (nome, fn) => { try { await fn(); console.log('✔', nome); } catch (e) { console.log('✘', nome, e.message.split('\n')[0]); erros.push(`${nome}: ${e.message.split('\n')[0]}`); } };
  const perto = (a, b, tol, oque) => { if (Math.abs(a - b) > tol) throw new Error(`${oque}: sistema ${a} × planilha ${b}`); };
  for (const w of [390, 1440]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: w < 700 ? 844 : 900 }, hasTouch: w < 700, serviceWorkers: 'block' });
    await ctx.route(/config\.js/, r => r.fulfill({ contentType: 'application/javascript', body: "window.GL_CONFIG={supabaseUrl:'',supabaseAnonKey:''};" }));
    const page = await ctx.newPage(); page.setDefaultTimeout(8000);
    page.on('pageerror', e => erros.push(`${w} pageerror: ${e.message}`)); page.on('dialog', d => d.accept());
    await page.goto(BASE + 'index.html?dados=exemplo'); await page.waitForFunction(() => window.PiorCaso && db.loteamentos.length); await page.waitForTimeout(300);
    /* Contrato de teste: 12 parcelas a partir do mês que vem, sem índice e sem entrada.
       criar(id, juros, parcela, desloc) — desloc = meses entre hoje e a 1ª parcela. */
    await page.evaluate(() => {
      sessionStorage.setItem('gl_admin', '1'); startRole('admin'); document.querySelectorAll('#devDados,.toast').forEach(e => e.remove());
      window.print = () => { window.__imprimiu = true; };
      setConfig({ multaPct: 2, jurosMesPct: 1 });
      window.criar = (id, juros, parcela, desloc) => {
        const base = db.vendas.find(v => v.status === 'ativa');
        const v = Object.assign(JSON.parse(JSON.stringify(base)), { id, loteId: null, imovel: { descricao: 'Lote de teste ' + id }, status: 'ativa', entrada: 0, nParcelas: 12, valorParcela: parcela, jurosMes: juros, indiceId: null, indiceBase: null, baloes: [], primeiroVencimento: addMonths(todayStr().slice(0, 8) + '10', desloc) });
        v.cliente = Object.assign({}, v.cliente, { telefone: '47991234567' });
        upsert('vendas', v); gerarRecebiveis(v).forEach(r => upsert('recebiveis', r));
        return v;
      };
      criar('ant1', 1, 8884.88, 1);
    });
    const pre = `${w}px:`;

    await passo(`${pre} quitar hoje custa o valor financiado (R$ 100.000,00); o desconto é o juro não usado`, async () => {
      const s = await page.evaluate(() => { const s = saldoQuitacao(getVenda('ant1'), todayStr()); return { total: s.total, nominal: s.nominal, desconto: s.desconto }; });
      let soma = 0; for (let k = 1; k <= N; k++) soma += r2(vp(k));
      perto(s.total, r2(soma), 0.01, 'para quitar'); perto(s.total, PV, 0.10, 'para quitar × valor financiado');
      perto(s.nominal, r2(PMT * N), 0.01, 'saldo pelos vencimentos'); perto(s.desconto, r2(PMT * N - s.total), 0.01, 'desconto');
    });
    await passo(`${pre} tabela de amortização = tabela Price da planilha, linha a linha`, async () => {
      const t = await page.evaluate(() => tabelaAmortizacao(getVenda('ant1'), todayStr()).map(x => [x.parcela, x.juros, x.amortizacao, x.saldo]));
      if (t.length !== N) throw new Error(`${t.length} linhas`);
      let saldo = 0; for (let k = 1; k <= N; k++) saldo += vp(k);
      t.forEach(([parcela, juros, amort, sd], k) => {
        let j = r2(saldo * I), a = r2(PMT - j);
        if (k === N - 1) { a = r2(saldo); j = r2(PMT - a); }          // a última parcela fecha o saldo, como na planilha
        saldo = r2(saldo - a);
        perto(parcela, PMT, 0.001, `parcela ${k + 1}`); perto(juros, j, 0.011, `juros da parcela ${k + 1}`); perto(amort, a, 0.011, `amortização da parcela ${k + 1}`); perto(sd, Math.abs(saldo) < 0.02 ? 0 : saldo, 0.03, `saldo depois da parcela ${k + 1}`);
      });
      perto(t[0][1], 1000, 0.01, 'juros do 1º mês'); if (t[N - 1][3] !== 0) throw new Error('saldo final ' + t[N - 1][3]);
    });
    await passo(`${pre} o valor vale o mês inteiro (dia 1 = último dia)`, async () => {
      const r = await page.evaluate(() => { const v = getVenda('ant1'), m = todayStr().slice(0, 8); return [saldoQuitacao(v, m + '01').total, saldoQuitacao(v, ultimoDiaDoMes(todayStr())).total]; });
      if (r[0] !== r[1]) throw new Error(r.join(' × '));
    });
    await passo(`${pre} antecipar as 3 últimas = valor presente das parcelas 10, 11 e 12`, async () => {
      const p = await page.evaluate(() => planoAntecipacao(getVenda('ant1'), todayStr(), 'parcelas', 3, 0, '').pagar);
      perto(p, r2(r2(vp(10)) + r2(vp(11)) + r2(vp(12))), 0.01, 'antecipar 3');
    });
    await passo(`${pre} parcela vencida entra cheia, com multa de 2% e juros de 1% ao mês pelos dias`, async () => {
      const r = await page.evaluate(() => {
        const v = criar('ant2', 1, 8884.88, -1);                         // a 1ª venceu dia 10 do mês passado
        const s = saldoQuitacao(v, todayStr()), x = s.itens[0];
        return { pagar: x.pagar, vencida: x.vencida, dias: daysBetween(x.rec.vencimento, todayStr()) };
      });
      if (!r.vencida) throw new Error('não veio como vencida');
      perto(r.pagar, r2(PMT * (1 + 0.02 + 0.01 * r.dias / 30)), 0.01, 'vencida com mora');
    });
    await passo(`${pre} contrato sem juros: antecipar não dá desconto`, async () => {
      const s = await page.evaluate(() => { const s = saldoQuitacao(criar('ant3', 0, 8333.33, 1), todayStr()); return [s.total, s.nominal, s.desconto]; });
      if (s[2] !== 0 || s[0] !== s[1]) throw new Error(s.join(' / '));
    });
    await passo(`${pre} tela: Para quitar, resumo, mensagem do WhatsApp e demonstrativo com os mesmos números`, async () => {
      await page.evaluate(() => abrirAntecipacao('ant1')); await page.waitForTimeout(300);
      const r = await page.evaluate(() => {
        const s = saldoQuitacao(getVenda('ant1'), todayStr());
        const wa = decodeURIComponent((document.querySelector('#modalFoot a.btn-wa') || {}).href || '');
        imprimirDemonstrativo('ant1');
        const pa = document.getElementById('printArea').textContent;
        return { esperado: fmtMoney(s.total), desconto: fmtMoney(s.desconto), ate: fmtDate(ultimoDiaDoMes(todayStr())), resumo: document.getElementById('anResumo').textContent, wa, pa, imprimiu: window.__imprimiu };
      });
      if (!r.resumo.includes(r.esperado) || !r.resumo.includes(r.desconto)) throw new Error('resumo: ' + r.resumo);
      if (!r.wa.includes('Para quitar até ' + r.ate) || !r.wa.includes(r.esperado)) throw new Error('WhatsApp: ' + r.wa.slice(0, 160));
      if (!r.imprimiu || !r.pa.includes(r.esperado) || !r.pa.includes('Tabela de amortização')) throw new Error('demonstrativo');
    });
    await passo(`${pre} amortizar R$ 20.000 reduzindo o prazo: a dívida cai exatamente R$ 20.000`, async () => {
      await page.selectOption('#anTipo', 'valor'); await page.fill('#anValor', '20000'); await page.selectOption('#anModo', 'prazo'); await page.waitForTimeout(100);
      const antes = await page.evaluate(() => saldoQuitacao(getVenda('ant1'), todayStr()).total);
      await page.locator('#modalFoot').getByRole('button', { name: 'Registrar pagamento' }).click(); await page.waitForTimeout(400);
      const r = await page.evaluate(() => { const rs = recebiveisDe('ant1'); return { depois: saldoQuitacao(getVenda('ant1'), todayStr()).total, pago: rs.reduce((s, x) => s + num(x.valorPago), 0), quitadas: rs.filter(x => x.forma === 'Antecipação' && x.tipo === 'parcela' && !/Amortização/.test(x.descricao)).length, parcial: rs.some(x => /Amortização da/.test(x.descricao)) }; });
      perto(r.pago, 20000, 0.01, 'valor registrado'); perto(r.depois, antes - 20000, 0.05, 'saldo para quitar depois');
      if (r.quitadas !== 2 || !r.parcial) throw new Error(`quitou ${r.quitadas} parcelas, parcial ${r.parcial}`);   // 2 últimas (≈ 15.7 mil) + parte da 10ª
    });
    await passo(`${pre} amortizar R$ 20.000 mantendo o prazo: as 12 parcelas viram a Price do saldo que sobrou (≈ R$ 7.107,90)`, async () => {
      await page.evaluate(() => { criar('ant4', 1, 8884.88, 1); abrirAntecipacao('ant4'); }); await page.waitForTimeout(300);
      await page.selectOption('#anTipo', 'valor'); await page.fill('#anValor', '20000'); await page.selectOption('#anModo', 'parcela'); await page.waitForTimeout(100);
      await page.locator('#modalFoot').getByRole('button', { name: 'Registrar pagamento' }).click(); await page.waitForTimeout(400);
      const r = await page.evaluate(() => ({ valores: [...new Set(recebiveisDe('ant4').map(x => x.valor))], saldo: saldoQuitacao(getVenda('ant4'), todayStr()).total }));
      /* a parcela de 8.884,88 é arredondada para cima: a dívida de hoje é 100.000,03, então
         sobram 80.000,03 — e a Price disso dá 7.107,91, um centavo acima da de 80 mil redondos */
      const nova = r2((r.saldo) * I / (1 - Math.pow(1 + I, -N)));
      perto(nova, 7107.90, 0.011, 'Price de 80 mil');
      if (r.valores.length !== 1) throw new Error('valores diferentes: ' + r.valores.join(', '));
      perto(r.valores[0], nova, 0.001, 'parcela nova'); perto(r.saldo, 80000, 0.10, 'saldo depois');
    });
    await passo(`${pre} quitar tudo pela tela deixa o contrato quitado`, async () => {
      await page.evaluate(() => { criar('ant5', 1, 8884.88, 1); abrirAntecipacao('ant5'); }); await page.waitForTimeout(300);
      await page.locator('#modalFoot').getByRole('button', { name: 'Registrar pagamento' }).click(); await page.waitForTimeout(400);
      const r = await page.evaluate(() => ({ st: getVenda('ant5').status, pago: recebiveisDe('ant5').reduce((s, x) => s + num(x.valorPago), 0) }));
      if (r.st !== 'quitada') throw new Error('situação ' + r.st);
      perto(r.pago, PV, 0.10, 'total pago');
    });
    await ctx.close();
  }
  await browser.close();
  if (erros.length) { console.log('\nERROS:\n' + erros.join('\n')); process.exit(1); }
  console.log('\nTudo certo.');
})();
