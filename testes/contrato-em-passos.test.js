// Novo contrato em passos: imóvel → compradores → vendedor → valores → parcelas → conferência.
// Cada passo confere o que é dele antes de deixar avançar; à vista o passo de parcelas some;
// a conferência mostra o contrato do jeito que vai ser gravado; vindo do lote ou da reserva
// começa no comprador; editar uma venda continua sendo uma folha só.
// Rodar: BASE=http://127.0.0.1:8765/gestao/ node testes/contrato-em-passos.test.js
const { chromium } = require('playwright');
const { responderConfirmacoes } = require('./confirmacoes');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/gestao/';
const r2 = x => Math.round(x * 100) / 100;
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--disable-gpu'] });
  const erros = [];
  for (const w of [390, 1440]) {
    const passo = async (nome, fn) => { try { await fn(); console.log('✔', w, nome); } catch (e) { console.log('✘', w, nome, e.message.split('\n')[0]); erros.push(`${w} ${nome}: ${e.message.split('\n')[0]}`); } };
    const celular = w < 700;
    const ctx = await browser.newContext({ viewport: { width: w, height: celular ? 844 : 900 }, hasTouch: celular, serviceWorkers: 'block' });
    await ctx.route(/config\.js/, r => r.fulfill({ contentType: 'application/javascript', body: "window.GL_CONFIG={supabaseUrl:'',supabaseAnonKey:''};" }));
    const page = await ctx.newPage(); page.setDefaultTimeout(8000);
    page.on('pageerror', e => erros.push(`${w} pageerror: ${e.message}`)); page.on('dialog', d => d.accept()); await responderConfirmacoes(page);
    await page.goto(BASE + 'index.html?dados=exemplo'); await page.waitForFunction(() => window.PiorCaso && db.loteamentos.length); await page.waitForTimeout(300);
    await page.evaluate(() => {
      sessionStorage.setItem('gl_admin', '1'); startRole('admin'); document.querySelectorAll('#devDados,.toast').forEach(e => e.remove());
      window.ultimoAviso = () => { const t = [...document.querySelectorAll('#toastContainer .toast')].pop(); return t ? t.textContent.replace(/\s+/g, ' ').trim() : ''; };
    });
    const foot = page.locator('#modalFoot');
    const botao = nome => foot.getByRole('button', { name: nome, exact: true });
    const tocar = async loc => { if (celular) await loc.tap(); else await loc.click(); await page.waitForTimeout(120); };
    const atual = () => page.evaluate(() => window.vfPasso && vfPasso.atual);
    const limparAvisos = () => page.evaluate(() => document.querySelectorAll('.toast').forEach(e => e.remove()));
    const emp = await page.evaluate(() => db.loteamentos.find(l => l.tipo !== 'carteira').id);
    const novo = async () => {
      await page.evaluate(id => { closeModal(); document.querySelectorAll('.toast').forEach(e => e.remove()); novaVendaEscolhendoEmp(); setVal('ceEmp', id); }, emp);
      await tocar(botao('Continuar'));
    };
    const comprador = async (nome, cpf) => {
      await page.fill('#vcNome', nome); await page.fill('#vcDoc', cpf); await page.fill('#vcTel', '47991234567');
      await page.fill('#vcProf', 'engenheira'); await page.selectOption('#vcEstCivil', 'solteiro'); await page.fill('#vcRg', '9.876.543');
      await page.fill('#vcLogr', 'Rua das Palmeiras'); await page.fill('#vcCidade', 'Gaspar');
    };

    await passo('abre no passo 1 (Imóvel), com a barra de passos e só Cancelar e Avançar no rodapé', async () => {
      await novo();
      if (await atual() !== 1) throw new Error('passo ' + await atual());
      if (!await page.locator('#vfLote').isVisible() || await page.locator('#vcNome').isVisible()) throw new Error('mostra mais que o passo 1');
      const pe = await foot.locator('button').allInnerTexts();
      if (pe.map(t => t.trim()).join('|') !== 'Cancelar|Avançar') throw new Error(pe.join('|'));
      if (celular) {
        const t = (await page.locator('.vf-passos-cel').innerText()).replace(/\s+/g, ' ').trim();
        if (!t.startsWith('Passo 1 de 6 · Imóvel')) throw new Error(t);
        if (await page.locator('.vf-passos ol').isVisible()) throw new Error('lista de passos inteira no celular');
      } else {
        const nomes = (await page.locator('.vf-passos li').allInnerTexts()).map(t => t.replace(/^\d+\s*/, '').trim());
        if (nomes.join(',') !== 'Imóvel,Compradores,Vendedor,Valores,Parcelas,Conferência') throw new Error(nomes.join(','));
        if (!await page.locator('.vf-passos li').nth(3).locator('button').isDisabled()) throw new Error('passo ainda não visto está clicável');
      }
    });
    await passo('comprador sem qualificação: Avançar não sai do passo 2 e diz o que falta', async () => {
      await tocar(botao('Avançar'));
      if (await atual() !== 2) throw new Error('passo ' + await atual());
      await limparAvisos(); await page.fill('#vcNome', 'Ana Sem Dados'); await page.fill('#vcTel', '47991112222');
      await tocar(botao('Avançar'));
      if (await atual() !== 2 || !/Qualificação incompleta.*CPF/.test(await page.evaluate(() => ultimoAviso()))) throw new Error(await atual() + ' ' + await page.evaluate(() => ultimoAviso()));
    });
    await passo('Voltar leva ao passo anterior sem conferir nada', async () => {
      await tocar(botao('Voltar'));
      if (await atual() !== 1) throw new Error('passo ' + await atual());
      await tocar(botao('Avançar'));
    });
    await passo('corretor marcado sem CRECI segura o passo 3', async () => {
      await comprador('Juliana Prado', '52998224725');
      await tocar(botao('Avançar'));
      if (await atual() !== 3) throw new Error('passo ' + await atual());
      await page.selectOption('#vfTemCorretor', 'sim'); await page.fill('#vkNome', 'Paulo Corretor'); await limparAvisos();
      await tocar(botao('Avançar'));
      if (await atual() !== 3 || !/corretor/i.test(await page.evaluate(() => ultimoAviso()))) throw new Error('avançou sem CRECI');
      await page.fill('#vkCreci', '12345-F'); await page.fill('#vkPct', '5'); await page.locator('#vkPct').dispatchEvent('input');
      await tocar(botao('Avançar'));
      if (await atual() !== 4) throw new Error('passo ' + await atual());
    });
    await passo('valores e parcelas: o resumo da soma aparece nos dois passos', async () => {
      await page.fill('#vfTotal', '150000'); await page.fill('#vfEntrada', '30000');
      if (!await page.locator('#vfResumo').isVisible()) throw new Error('resumo escondido no passo 4');
      await tocar(botao('Avançar'));
      if (await atual() !== 5) throw new Error('passo ' + await atual());
      await page.fill('#vfN', '60'); await page.fill('#vfJuros', '1');
      if (!await page.locator('#vfResumo').isVisible()) throw new Error('resumo escondido no passo 5');
      await tocar(botao('Avançar'));
      if (await atual() !== 6) throw new Error('passo ' + await atual());
    });
    await passo('conferência: imóvel, comprador, corretor, parcelas e total do jeito que vai ser gravado', async () => {
      const t = (await page.locator('#vfConf').innerText()).replace(/\s+/g, ' ');
      const r = await page.evaluate(() => { const l = getLote(val('vfLote')); return { lote: loteLabel(l), parc: fmtMoney(r2p(120000 * 0.01 / (1 - Math.pow(1.01, -60)))), fim: fmtDate(addMonths(val('vfPrimeiro'), 59)), ini: fmtDate(val('vfPrimeiro')) }; function r2p(x) { return Math.round(x * 100) / 100; } });
      const soma = r2(30000 + 60 * r2(120000 * 0.01 / (1 - Math.pow(1.01, -60))));
      const somaTxt = await page.evaluate(v => fmtMoney(v), soma);
      for (const s of [r.lote, 'Juliana Prado', '529.982.247-25', 'Paulo Corretor', 'CRECI 12345-F', 'Comissão', 'R$ 150.000,00', `60× ${r.parc}`, `${r.ini} a ${r.fim}`, '1,00% a.m.', somaTxt].map(x => x.replace(/\s+/g, ' ')))
        if (!t.includes(s)) throw new Error('falta "' + s + '" em: ' + t.slice(0, 400));
      const pe = (await foot.locator('button').allInnerTexts()).map(x => x.trim());
      if (pe.join('|') !== 'Voltar|Salvar venda') throw new Error(pe.join('|'));
      if (await page.locator('#vfResumo').isVisible()) throw new Error('resumo duplicado na conferência');
      if (!await page.locator('#vfObs').isVisible()) throw new Error('sem observações');
    });
    await passo('"Alterar" volta ao passo; pular para a conferência confere o caminho', async () => {
      await tocar(page.locator('#vfConf').getByRole('button', { name: 'Alterar comprador' }));
      if (await atual() !== 2) throw new Error('passo ' + await atual());
      await page.fill('#vcTel', ''); await limparAvisos();
      await page.evaluate(() => vfIrPasso(6));
      if (await atual() !== 2 || !/telefone/i.test(await page.evaluate(() => ultimoAviso()))) throw new Error('pulou sem telefone: passo ' + await atual());
      await page.fill('#vcTel', '47991234567');
      if (!celular) { await tocar(page.locator('.vf-passos li').nth(5).locator('button')); }
      else await page.evaluate(() => vfIrPasso(6));
      if (await atual() !== 6) throw new Error('não voltou à conferência');
    });
    await passo('salvar na conferência grava a venda com as parcelas da conferência', async () => {
      const lid = await page.evaluate(() => val('vfLote'));
      await tocar(botao('Salvar venda')); await page.waitForTimeout(400);
      const r = await page.evaluate(lid => { const v = db.vendas.find(v => v.loteId === lid && v.status !== 'distrato'); const rs = v ? recebiveisDe(v.id) : []; return v && { n: rs.filter(x => x.tipo === 'parcela').length, ent: (rs.find(x => x.tipo === 'entrada') || {}).valor, corr: v.corretor.creci, com: v.comissaoValor, st: getLote(lid).status, titulo: modalTitle.textContent }; }, lid);
      if (!r || r.n !== 60 || r.ent !== 30000 || r.corr !== '12345-F' || r.com !== 7500 || r.st !== 'vendido' || r.titulo !== 'Emitir o contrato agora?') throw new Error(JSON.stringify(r));
      await page.evaluate(() => closeModal());
    });
    await passo('à vista: o passo Parcelas some, a conta vira 5 e Valores vai direto à conferência', async () => {
      await novo(); await tocar(botao('Avançar'));
      await comprador('Rita Moraes', '11144477735'); await tocar(botao('Avançar')); await tocar(botao('Avançar'));
      await page.selectOption('#vfForma', 'vista'); await page.waitForTimeout(80);
      if (celular) { const t = (await page.locator('.vf-passos-cel').innerText()).replace(/\s+/g, ' '); if (!t.startsWith('Passo 4 de 5')) throw new Error(t); }
      else if (await page.locator('.vf-passos li').count() !== 5) throw new Error('ainda tem 6 passos');
      await tocar(botao('Avançar'));
      if (await atual() !== 6) throw new Error('passo ' + await atual());
      const t = (await page.locator('#vfConf').innerText()).replace(/\s+/g, ' ');
      if (!/Pagamento à vista/.test(t) || !/Pagamento único/.test(t) || /Parcelas/.test(t)) throw new Error(t.slice(0, 300));
      await page.evaluate(() => closeModal());
    });
    await passo('conta que não fecha: a conferência avisa quanto falta', async () => {
      await novo(); await page.evaluate(() => { vfMostrarPasso(4); setVal('vfTotal', 100000); setVal('vfEntrada', 10000); vfMostrarPasso(5); setVal('vfN', 10); window.vfManual = true; setVal('vfParcela', 5000); vfMostrarPasso(6); });
      const t = (await page.locator('#vfConf').innerText()).replace(/\s+/g, ' ');
      if (!/Faltam R\$\s?40\.000,00/.test(t)) throw new Error(t.slice(-300));
      await page.evaluate(() => closeModal());
    });
    await passo('vindo do lote ("Vender"), começa no comprador com o imóvel já marcado como feito', async () => {
      const lid = await page.evaluate(id => lotesDo(id).find(l => l.status === 'disponivel').id, emp);
      await page.evaluate(([id, lid]) => { setCurLotSilencioso(id); abrirVendaForm(null, lid); }, [emp, lid]);
      if (await atual() !== 2) throw new Error('passo ' + await atual());
      if (await page.evaluate(() => val('vfLote')) !== lid) throw new Error('lote errado');
      if (!celular && !(await page.locator('.vf-passos li').first().getAttribute('class')).includes('feito')) throw new Error('passo 1 não aparece como feito');
      await page.evaluate(() => closeModal());
    });
    await passo('converter reserva: começa no comprador, já preenchido, e a reserva vira convertida', async () => {
      const r = await page.evaluate(() => db.reservas.find(r => ['pendente', 'aprovada'].includes(r.status) && r.loteId && getLote(r.loteId) && getLote(r.loteId).status === 'reservado'));
      if (!r) throw new Error('sem reserva no exemplo');
      await page.evaluate(r => { closeModal(); setCurLotSilencioso(r.loteamentoId); abrirVendaForm(null, r.loteId, r.id); }, r);
      if (await atual() !== 2 || await page.evaluate(() => val('vcNome')) !== r.cliente.nome) throw new Error('passo ' + await atual() + ' nome ' + await page.evaluate(() => val('vcNome')));
      /* a reserva do exemplo não traz a qualificação completa: completa aqui */
      await page.evaluate(() => { document.querySelectorAll('.toast').forEach(e => e.remove()); });
      await comprador(r.cliente.nome, '52998224725');
      for (let i = 0; i < 6 && !await botao('Salvar venda').count(); i++) await tocar(botao('Avançar'));
      await tocar(botao('Salvar venda')); await page.waitForTimeout(400);
      const st = await page.evaluate(id => getReserva(id).status, r.id);
      if (st !== 'convertida') throw new Error('reserva ' + st + ' · ' + await page.evaluate(() => ultimoAviso()));
      await page.evaluate(() => closeModal());
    });
    await passo('editar venda continua numa folha só: sem barra de passos, tudo à vista, salva', async () => {
      const id = await page.evaluate(() => db.vendas.find(v => v.status === 'ativa' && v.loteId && v.nParcelas).id);
      await page.evaluate(id => { const v = getVenda(id); setCurLotSilencioso(v.loteamentoId); abrirVendaForm(id); }, id);
      if (await page.locator('#vfPassos').count()) throw new Error('barra de passos na edição');
      for (const s of ['#vcNome', '#vfTemCorretor', '#vfTotal', '#vfN', '#vfObs']) if (!await page.locator(s).isVisible()) throw new Error(s + ' escondido');
      if (await page.evaluate(() => modalTitle.textContent) !== 'Editar venda') throw new Error('título');
      /* as vendas do exemplo não trazem a qualificação completa, e sem ela nem a edição salva */
      await comprador(await page.evaluate(() => val('vcNome')), '52998224725');
      await page.fill('#vfObs', 'Editado no teste'); await page.waitForTimeout(50);
      const pe = (await foot.locator('button').allInnerTexts()).map(x => x.trim());
      if (pe.join('|') !== 'Cancelar|Salvar venda') throw new Error(pe.join('|'));
      await limparAvisos(); await tocar(botao('Salvar venda')); await page.waitForTimeout(300);
      const obs = await page.evaluate(id => getVenda(id).obs, id);
      if (obs !== 'Editado no teste') throw new Error('obs ' + obs + ' · ' + await page.evaluate(() => ultimoAviso()));
    });
    await passo('no celular nenhum passo sai da tela', async () => {
      await novo();
      for (const p of [1, 2, 3, 4, 5, 6]) {
        await page.evaluate(p => vfMostrarPasso(p), p);
        const sobra = await page.evaluate(() => Math.max(0, ...[...document.querySelectorAll('#modalBox *')].filter(e => e.offsetParent && e.getClientRects().length).map(e => e.getBoundingClientRect().right)) - innerWidth);
        if (sobra > 1) throw new Error(`passo ${p}: ${sobra}px para fora`);
      }
      await page.evaluate(() => closeModal());
    });
    await ctx.close();
  }
  await browser.close();
  if (erros.length) { console.log('\nERROS:\n' + erros.join('\n')); process.exit(1); }
  console.log('\nTudo certo.');
})();
