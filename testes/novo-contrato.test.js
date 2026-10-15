// Novo contrato, pela tela, no celular e no computador: corretor (sim/não), à vista, nº de
// parcelas com teclado numérico, aviso de índice não cadastrado, qualificação obrigatória,
// cliente casado puxado do cadastro, lote que ainda não existia, imóvel de terceiro (carteira)
// e a pergunta "Emitir o contrato agora?" depois de salvar.
// Rodar: BASE=http://127.0.0.1:8765/lotifly/ node testes/novo-contrato.test.js
const { chromium } = require('playwright');
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
    page.on('pageerror', e => erros.push(`${w} pageerror: ${e.message}`)); page.on('dialog', d => d.accept());
    await page.goto(BASE + 'index.html?dados=exemplo'); await page.waitForFunction(() => window.PiorCaso && db.loteamentos.length); await page.waitForTimeout(300);
    await page.evaluate(() => {
      sessionStorage.setItem('gl_admin', '1'); startRole('admin'); document.querySelectorAll('#devDados,.toast').forEach(e => e.remove());
      upsert('loteamentos', { id: 'cart9', nome: 'Apartamento Ed. Aurora', tipo: 'carteira', categoria: 'apartamento', preco: 480000, criadoEm: new Date().toISOString() });
      window.ultimoAviso = () => { const t = [...document.querySelectorAll('#toastContainer .toast')].pop(); return t ? t.textContent.replace(/\s+/g, ' ').trim() : ''; };
    });
    const foot = page.locator('#modalFoot');
    /* Abre "Novo contrato" pelo menu e escolhe o imóvel */
    const novo = async (empNome) => {
      await page.evaluate(() => { document.querySelectorAll('.toast').forEach(e => e.remove()); novaVendaEscolhendoEmp(); }); await page.waitForTimeout(250);
      await page.selectOption('#ceEmp', { label: await page.evaluate(n => { const o = [...document.querySelectorAll('#ceEmp option')].find(o => o.textContent.startsWith(n)); return o ? o.textContent : n; }, empNome) });
      await foot.getByRole('button', { name: 'Continuar' }).click(); await page.waitForTimeout(300);
    };
    const comprador = async (nome, cpf) => {
      await page.fill('#vcNome', nome); await page.fill('#vcDoc', cpf); await page.fill('#vcTel', '47991234567');
      await page.fill('#vcProf', 'comerciante'); await page.selectOption('#vcEstCivil', 'solteiro'); await page.fill('#vcRg', '1.234.567');
      await page.fill('#vcLogr', 'Rua XV de Novembro'); await page.fill('#vcCidade', 'Blumenau');
    };
    const salvar = async () => { await foot.getByRole('button', { name: 'Salvar venda' }).click(); await page.waitForTimeout(400); };
    const emp = await page.evaluate(() => db.loteamentos.find(l => l.tipo !== 'carteira').nome);

    await passo('venda direta é o padrão; "Sim" abre o corretor e exige nome e CRECI', async () => {
      await novo(emp);
      if (await page.evaluate(() => val('vfTemCorretor')) !== 'nao' || await page.locator('#vkBox').isVisible()) throw new Error('corretor aberto por padrão');
      await page.selectOption('#vfTemCorretor', 'sim'); await page.waitForTimeout(100);
      if (!await page.locator('#vkBox').isVisible()) throw new Error('não abriu os dados do corretor');
      await comprador('Lucas Andrade', '52998224725');
      const antes = await page.evaluate(() => db.vendas.length); await salvar();
      if (await page.evaluate(() => db.vendas.length) !== antes || !/corretor/i.test(await page.evaluate(() => ultimoAviso()))) throw new Error('salvou sem CRECI');
      await page.selectOption('#vfTemCorretor', 'nao');
    });
    await passo('nº de parcelas é texto com teclado numérico, sem setinhas', async () => {
      const r = await page.evaluate(() => { const e = document.getElementById('vfN'); return [e.type, e.inputMode]; });
      if (r.join() !== 'text,numeric') throw new Error(r.join());
    });
    await passo('à vista esconde entrada, parcelas, juros e índice e mostra "Pagamento único"', async () => {
      await page.selectOption('#vfForma', 'vista'); await page.waitForTimeout(100);
      const r = await page.evaluate(() => ({ parc: getComputedStyle(vfParcBox).display, vista: getComputedStyle(vfVistaBox).display, res: vfResumo.textContent }));
      if (r.parc !== 'none' || r.vista === 'none' || !r.res.includes('Pagamento único')) throw new Error(JSON.stringify(r));
      for (const id of ['vfEntrada', 'vfN', 'vfJuros', 'vfParcela']) if (await page.locator('#' + id).isVisible()) throw new Error(id + ' visível');
    });
    await passo('salvar à vista: uma parcela só do valor inteiro, lote vendido, e pergunta se emite o contrato', async () => {
      const lid = await page.evaluate(() => val('vfLote'));
      await salvar();
      const r = await page.evaluate((lid) => { const v = db.vendas.find(v => v.loteId === lid && v.status !== 'distrato'); const rs = v ? recebiveisDe(v.id) : []; return { v: !!v, n: rs.length, val: rs[0] && rs[0].valor, total: v && v.valorTotal, lote: getLote(lid).status, titulo: modalTitle.textContent, aberto: document.getElementById('modalOverlay').classList.contains('open') || getComputedStyle(modalOverlay).display !== 'none' }; }, lid);
      if (!r.v || r.n !== 1 || r.val !== r.total || r.lote !== 'vendido') throw new Error(JSON.stringify(r));
      if (r.titulo !== 'Emitir o contrato agora?') throw new Error('título: ' + r.titulo);
      await foot.getByRole('button', { name: 'Gerar contrato' }).click(); await page.waitForTimeout(300);
      if (await page.evaluate(() => modalTitle.textContent) !== 'Gerar contrato') throw new Error('não abriu o contrato');
      await page.evaluate(() => closeModal());
    });
    await passo('qualificação incompleta não deixa salvar e diz o que falta', async () => {
      await novo(emp);
      await page.fill('#vcNome', 'Fulano Incompleto'); await page.fill('#vcTel', '47991234567');
      const antes = await page.evaluate(() => db.vendas.length); await salvar();
      const aviso = await page.evaluate(() => ultimoAviso());
      if (await page.evaluate(() => db.vendas.length) !== antes || !/Qualificação incompleta.*CPF.*profissão/.test(aviso)) throw new Error(aviso);
      await page.evaluate(() => closeModal());
    });
    await passo('sem índice cadastrado: o formulário avisa e leva à tela de Índices', async () => {
      const guardados = await page.evaluate(() => { const g = db.indices.slice(); db.indices = []; return g.length; });
      await novo(emp);
      const alerta = page.locator('#modalBody .alert', { hasText: 'Nenhum índice cadastrado' });
      if (!await alerta.count()) throw new Error('sem aviso');
      await alerta.click(); await page.waitForTimeout(300);
      if (await page.evaluate(() => state.tab) !== 'indices') throw new Error('foi para ' + await page.evaluate(() => state.tab));
      void guardados;
    });
    await passo('cliente casado puxado do cadastro: cônjuge vem junto e fica na venda', async () => {
      await page.evaluate(() => upsert('clientes', { id: 'cl-bea', tipo: 'pf', genero: 'f', nome: 'Beatriz Ramos', cpf: '11144477735', telefone: '47988887777', nacionalidade: 'brasileiro', profissao: 'arquiteta', estadoCivil: 'casado', regimeBens: 'comunhão parcial de bens', rg: '7.654.321', logradouro: 'Rua Itajaí', numeroEnd: '50', cidade: 'Blumenau', uf: 'SC', conjuge: { tipo: 'pf', genero: 'm', nome: 'Rafael Ramos', nacionalidade: 'brasileiro', cpf: '52998224725', mesmoEndereco: true }, criadoEm: new Date().toISOString() }));
      await novo(emp);
      const rot = await page.evaluate(() => clienteRotulo(db.clientes.find(c => c.id === 'cl-bea')));
      await page.fill('#vcBusca', rot); await page.locator('#vcBusca').dispatchEvent('change'); await page.waitForTimeout(300);
      const r = await page.evaluate(() => ({ nome: val('vcNome'), cj: val('vcCjNome'), ec: val('vcEstCivil') }));
      if (r.nome !== 'Beatriz Ramos' || r.cj !== 'Rafael Ramos' || r.ec !== 'casado') throw new Error(JSON.stringify(r));
      await page.selectOption('#vfForma', 'vista'); await salvar();
      const v = await page.evaluate(() => { const v = db.vendas.filter(v => v.cliente.nome === 'Beatriz Ramos').pop(); return v && { cj: (v.cliente.conjuge || {}).nome, g: v.cliente.genero }; });
      if (!v || v.cj !== 'Rafael Ramos' || v.g !== 'f') throw new Error(JSON.stringify(v));
      await page.evaluate(() => closeModal());
    });
    await passo('lote que ainda não existia: entra no contrato, já vendido; parcelas pela Price', async () => {
      await novo(emp);
      await page.selectOption('#vfLote', '__novo'); await page.waitForTimeout(100);
      await page.fill('#vfNlQuadra', 'z'); await page.fill('#vfNlNumero', '77'); await page.fill('#vfNlArea', '360');
      await comprador('Marcos Teixeira', '11144477735');
      await page.fill('#vfTotal', '120000'); await page.fill('#vfEntrada', '20000'); await page.fill('#vfN', '48'); await page.fill('#vfJuros', '0.8');
      await page.evaluate(() => { const p = document.getElementById('vfPrimeiro'); if (p && !p.value) p.value = addMonths(todayStr(), 1); vfCalc(); });
      await salvar();
      const r = await page.evaluate(() => { const l = db.lotes.find(l => l.quadra === 'Z' && l.numero === '77'); const v = l && db.vendas.find(v => v.loteId === l.id); const rs = v ? recebiveisDe(v.id) : []; return l && { st: l.status, venda: !!v, area: l.area, n: rs.filter(x => x.tipo === 'parcela').length, entrada: (rs.find(x => x.tipo === 'entrada') || {}).valor, parcela: v && v.valorParcela }; });
      const esperado = r2(100000 * 0.008 / (1 - Math.pow(1.008, -48)));
      if (!r || r.st !== 'vendido' || !r.venda || r.area !== 360 || r.n !== 48 || r.entrada !== 20000 || r.parcela !== esperado) throw new Error(JSON.stringify(r) + ' esperado ' + esperado);
      await page.evaluate(() => closeModal());
    });
    await passo('lote repetido no contrato é recusado', async () => {
      await novo(emp);
      await page.selectOption('#vfLote', '__novo'); await page.fill('#vfNlQuadra', 'Z'); await page.fill('#vfNlNumero', '77');
      await comprador('Outra Pessoa', '52998224725'); await page.selectOption('#vfForma', 'vista');
      const antes = await page.evaluate(() => db.lotes.length); await salvar();
      if (await page.evaluate(() => db.lotes.length) !== antes || !/já existe/.test(await page.evaluate(() => ultimoAviso()))) throw new Error(await page.evaluate(() => ultimoAviso()));
      await page.evaluate(() => closeModal());
    });
    await passo('imóvel de terceiro: valor e descrição vêm do cadastro; sem descrição não salva; grava sem lote', async () => {
      await novo('Apartamento Ed. Aurora');
      if (await page.locator('#vfLote').count() || !await page.locator('#vfImDesc').count()) throw new Error('formulário de lote numa carteira');
      if (await page.evaluate(() => num(val('vfTotal'))) !== 480000) throw new Error('valor de venda não veio do imóvel');
      await comprador('Helena Costa', '52998224725'); await page.selectOption('#vfForma', 'vista');
      await page.fill('#vfImDesc', '');                                   // a descrição vem do cadastro do imóvel; apagada, o contrato não sai
      const antes = await page.evaluate(() => db.vendas.length); await salvar();
      if (await page.evaluate(() => db.vendas.length) !== antes) throw new Error('salvou sem descrição');
      await page.fill('#vfImDesc', 'Apartamento 302 do Edifício Aurora'); await salvar();
      const v = await page.evaluate(() => { const v = db.vendas.find(v => v.loteamentoId === 'cart9'); return v && { lote: v.loteId, d: v.imovel.descricao }; });
      if (!v || v.lote !== null || v.d !== 'Apartamento 302 do Edifício Aurora') throw new Error(JSON.stringify(v));
      await page.evaluate(() => closeModal());
    });
    await passo('no celular o formulário não sai da tela', async () => {
      await novo(emp);
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
