// Trocar o tipo de um imóvel já cadastrado (empreendimento ↔ imóvel avulso, ou entre os tipos
// de avulso): pede confirmação com o que muda, volta atrás se a pessoa desistir, bloqueia o
// que não faz sentido (vários contratos, reserva em andamento) e não perde lotes nem dados.
// Rodar: BASE=http://127.0.0.1:8765/lotifly/ node testes/tipo-imovel.test.js
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
    /* As janelas do navegador (confirmar/avisar): anota a mensagem e responde como mandado */
    let resposta = 'accept'; const dialogos = [];
    /* A confirmação agora é uma janela do app: registra tipo (confirm/alert) e texto e responde. */
    await page.exposeFunction('__dialogoTeste', (tipo, msg) => { dialogos.push({ tipo, msg }); return resposta; });
    await page.addInitScript(() => { new MutationObserver(() => { const box = document.getElementById('confirmaBox'); if (!box || box.dataset.visto) return; box.dataset.visto = '1'; const nao = box.querySelector('.conf-nao'); window.__dialogoTeste(nao ? 'confirm' : 'alert', box.innerText).then(r => (r === 'accept' || !nao ? box.querySelector('.conf-sim') : nao).click()); }).observe(document, { childList: true, subtree: true }); });
    page.on('pageerror', e => erros.push(`${w} pageerror: ${e.message}`));
    await page.goto(BASE + 'index.html?dados=exemplo'); await page.waitForFunction(() => window.PiorCaso && db.loteamentos.length); await page.waitForTimeout(300);
    await page.evaluate(() => {
      sessionStorage.setItem('gl_admin', '1'); startRole('admin'); document.querySelectorAll('#devDados,.toast').forEach(e => e.remove());
      window.ultimoAviso = () => { const t = [...document.querySelectorAll('#toastContainer .toast')].pop(); return t ? t.textContent.replace(/\s+/g, ' ').trim() : ''; };
      /* Um empreendimento novo, com 3 lotes e sem venda */
      upsert('loteamentos', { id: 'emp9', nome: 'Jardim das Águas', tipo: 'loteamento', criadoEm: new Date().toISOString(), orcamento: {} });
      ['1', '2', '3'].forEach(n => upsert('lotes', { id: 'emp9-' + n, loteamentoId: 'emp9', quadra: 'A', numero: n, area: 300, preco: 90000, status: 'disponivel', tipo: 'residencial' }));
    });
    const foot = page.locator('#modalFoot');
    const ultimo = () => dialogos[dialogos.length - 1] || {};

    await passo('empreendimento com vários contratos não vira imóvel avulso: avisa e o tipo volta', async () => {
      const id = await page.evaluate(() => db.loteamentos.find(l => l.id !== 'emp9' && l.tipo !== 'carteira').id);
      await page.evaluate(id => abrirLoteamentoForm(id), id); await page.waitForTimeout(200);
      const n = dialogos.length;
      await page.selectOption('#lmTipo', 'carteira:casa'); await page.waitForTimeout(150);
      if (dialogos.length !== n + 1 || ultimo().tipo !== 'alert' || !/contratos\. Um imóvel avulso tem um contrato só/.test(ultimo().msg)) throw new Error(JSON.stringify(ultimo()));
      if (await page.evaluate(() => val('lmTipo')) !== 'loteamento') throw new Error('o seletor não voltou');
      await page.evaluate(() => closeModal());
    });
    await passo('trocar para Lote pede confirmação com o que muda; desistir volta ao tipo de antes', async () => {
      await page.evaluate(() => abrirLoteamentoForm('emp9')); await page.waitForTimeout(200);
      resposta = 'dismiss';
      await page.selectOption('#lmTipo', 'carteira:lote'); await page.waitForTimeout(150);
      const d = ultimo();
      const f = ['característica importante', 'pode alterar os dados', 'Empreendimento → Lote', 'os 3 lotes deixam de aparecer', 'valor de venda, matrícula e descrição', 'Deixa de aparecer para os corretores'];
      const falta = f.filter(x => !d.msg.includes(x));
      if (d.tipo !== 'confirm' || falta.length) throw new Error('falta: ' + falta.join(' | '));
      const r = await page.evaluate(() => ({ v: val('lmTipo'), aviso: lmTrocaAviso.textContent, terc: getComputedStyle(lmBoxTerceiro).display }));
      if (r.v !== 'loteamento' || r.aviso || r.terc !== 'none') throw new Error(JSON.stringify(r));
      resposta = 'accept';
    });
    await passo('confirmando: aviso no formulário, pede o valor de venda e salva como Lote sem perder os lotes', async () => {
      await page.selectOption('#lmTipo', 'carteira:lote'); await page.waitForTimeout(150);
      const r = await page.evaluate(() => ({ aviso: lmTrocaAviso.textContent, terc: getComputedStyle(lmBoxTerceiro).display }));
      if (!/Tipo trocado: Empreendimento → Lote/.test(r.aviso) || r.terc === 'none') throw new Error(JSON.stringify(r));
      if (await page.evaluate(() => getLoteamento('emp9').tipo) !== 'loteamento') throw new Error('mudou antes de salvar');
      await foot.getByRole('button', { name: /Salvar/ }).click(); await page.waitForTimeout(250);
      if (!/valor de venda/i.test(await page.evaluate(() => ultimoAviso()))) throw new Error('salvou sem valor: ' + await page.evaluate(() => ultimoAviso()));
      const n = dialogos.length;
      await page.fill('#lmPreco', '95000'); await foot.getByRole('button', { name: /Salvar/ }).click(); await page.waitForTimeout(300);
      if (dialogos.length !== n) throw new Error('perguntou de novo, mesmo já confirmado');
      const s = await page.evaluate(() => { const l = getLoteamento('emp9'); return { tipo: l.tipo, cat: l.categoria, preco: l.preco, lotes: lotesDo('emp9').length, log: db.log.slice(-3).map(x => x.msg).join(' | '), subs: empSubsVisiveis(l).map(x => x[0]).join() }; });
      if (s.tipo !== 'carteira' || s.cat !== 'lote' || s.preco !== 95000 || s.lotes !== 3) throw new Error(JSON.stringify(s));
      if (!/Tipo do imóvel trocado: Jardim das Águas — Empreendimento → Lote/.test(s.log)) throw new Error('log: ' + s.log);
      if (/planta|lotes/.test(s.subs)) throw new Error('abas de empreendimento num imóvel avulso: ' + s.subs);
    });
    await passo('trocar de tipo de avulso (Lote → Sítio) também pede confirmação', async () => {
      await page.evaluate(() => abrirLoteamentoForm('emp9')); await page.waitForTimeout(200);
      resposta = 'dismiss';
      await page.selectOption('#lmTipo', 'carteira:sitio'); await page.waitForTimeout(150);
      if (!/Lote → Sítio/.test(ultimo().msg)) throw new Error(ultimo().msg);
      if (await page.evaluate(() => val('lmTipo')) !== 'carteira:lote') throw new Error('não voltou');
      resposta = 'accept'; await page.evaluate(() => closeModal());
    });
    await passo('voltar para Empreendimento: lotes reaparecem e o valor de venda fica guardado', async () => {
      await page.evaluate(() => abrirLoteamentoForm('emp9')); await page.waitForTimeout(200);
      await page.selectOption('#lmTipo', 'loteamento'); await page.waitForTimeout(150);
      if (!/O valor de venda, a matrícula e a descrição do imóvel deixam de ser usados/.test(ultimo().msg) || !/aparece para os corretores/.test(ultimo().msg)) throw new Error(ultimo().msg);
      await foot.getByRole('button', { name: /Salvar/ }).click(); await page.waitForTimeout(300);
      const s = await page.evaluate(() => { const l = getLoteamento('emp9'); return { tipo: l.tipo, preco: l.preco, lotes: lotesDo('emp9').length, subs: empSubsVisiveis(l).map(x => x[0]).join() }; });
      if (s.tipo !== 'loteamento' || s.preco !== 95000 || s.lotes !== 3 || !/planta/.test(s.subs)) throw new Error(JSON.stringify(s));
    });
    await passo('reserva em andamento bloqueia a troca para imóvel avulso', async () => {
      await page.evaluate(() => upsert('reservas', { id: 'res9', loteamentoId: 'emp9', loteId: 'emp9-1', status: 'pendente', cliente: { nome: 'Cliente' }, corretor: { nome: 'Corretor' }, criadoEm: new Date().toISOString(), validade: addDays(todayStr(), 3) }));
      await page.evaluate(() => abrirLoteamentoForm('emp9')); await page.waitForTimeout(200);
      await page.selectOption('#lmTipo', 'carteira:casa'); await page.waitForTimeout(150);
      if (ultimo().tipo !== 'alert' || !/1 reserva em andamento/.test(ultimo().msg)) throw new Error(JSON.stringify(ultimo()));
      if (await page.evaluate(() => val('lmTipo')) !== 'loteamento') throw new Error('não voltou');
      await page.evaluate(() => { removeRec('reservas', 'res9'); closeModal(); });
    });
    await passo('imóvel avulso com contrato vira empreendimento; o aviso cita o contrato, que continua igual', async () => {
      const r0 = await page.evaluate(() => {
        upsert('loteamentos', { id: 'cart7', nome: 'Casa Rua das Flores', tipo: 'carteira', categoria: 'casa', preco: 300000, criadoEm: new Date().toISOString() });
        const base = db.vendas.find(v => v.status === 'ativa');
        upsert('vendas', Object.assign(JSON.parse(JSON.stringify(base)), { id: 'vc7', loteamentoId: 'cart7', loteId: null, imovel: { descricao: 'Casa na Rua das Flores, 120' } }));
        abrirLoteamentoForm('cart7'); return getVenda('vc7').cliente.nome;
      });
      await page.waitForTimeout(200);
      await page.selectOption('#lmTipo', 'loteamento'); await page.waitForTimeout(150);
      if (!ultimo().msg.includes(`O contrato que já existe (${r0}) continua o mesmo`)) throw new Error(ultimo().msg);
      await foot.getByRole('button', { name: /Salvar/ }).click(); await page.waitForTimeout(300);
      const s = await page.evaluate(() => ({ tipo: getLoteamento('cart7').tipo, im: imovelLabel(getVenda('vc7')) }));
      if (s.tipo !== 'loteamento' || s.im !== 'Casa na Rua das Flores, 120') throw new Error(JSON.stringify(s));
    });
    await passo('imóvel novo: escolher o tipo não pede confirmação', async () => {
      const n = dialogos.length;
      await page.evaluate(() => abrirLoteamentoForm()); await page.waitForTimeout(200);
      await page.selectOption('#lmTipo', 'carteira:apartamento'); await page.waitForTimeout(100);
      await page.selectOption('#lmTipo', 'loteamento'); await page.waitForTimeout(100);
      if (dialogos.length !== n) throw new Error('pediu confirmação num imóvel novo');
      await page.evaluate(() => closeModal());
    });
    await ctx.close();
  }
  await browser.close();
  if (erros.length) { console.log('\nERROS:\n' + erros.join('\n')); process.exit(1); }
  console.log('\nTudo certo.');
})();
