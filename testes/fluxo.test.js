// Fluxo principal, clicando na tela como uma pessoa faria, no celular e no computador:
// entrar como administrador → abrir um loteamento → vender um lote → registrar um recebimento.
// Rodar: BASE=http://127.0.0.1:8765/lotifly/ node testes/fluxo.test.js   (PRINTS=pasta salva prints)
const { chromium, devices } = require('playwright'); const path = require('path'); const fs = require('fs');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/gestao/';
const PRINTS = process.env.PRINTS; if (PRINTS) fs.mkdirSync(PRINTS, { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--disable-gpu'] });
  const erros = [];
  const aparelhos = [['celular', { ...devices['iPhone 13'], defaultBrowserType: undefined }], ['computador', { viewport: { width: 1440, height: 900 } }]];
  for (const [nome, opc] of aparelhos) {
    const ctx = await browser.newContext({ ...opc, serviceWorkers: 'block' });
    await ctx.route(/config\.js/, r => r.fulfill({ contentType: 'application/javascript', body: "window.GL_CONFIG={supabaseUrl:'',supabaseAnonKey:''};" }));
    const page = await ctx.newPage(); page.setDefaultTimeout(8000);
    page.on('pageerror', e => erros.push(`${nome} pageerror: ${e.message}`));
    page.on('dialog', d => d.accept());
    const celular = nome === 'celular';
    const tocar = async loc => { await loc.scrollIntoViewIfNeeded(); if (celular) await loc.tap(); else await loc.click(); };
    let n = 0; const print = async rot => { if (PRINTS) await page.screenshot({ path: path.join(PRINTS, `${nome}-${++n}-${rot}.png`) }); };
    const passo = async (rot, fn) => { try { await fn(); console.log('✔', nome, '·', rot); await print(rot.split(' ')[0]); } catch (e) { console.log('✘', nome, '·', rot, e.message.split('\n')[0]); erros.push(`${nome} · ${rot}: ${e.message.split('\n')[0]}`); await print('ERRO'); } };
    const janela = () => page.locator('#modalOverlay.open');
    let loteId, vendaId;

    await page.goto(BASE + 'index.html?dados=exemplo');
    await page.waitForFunction(() => window.PiorCaso && db.loteamentos.length);
    await page.evaluate(() => { const d = document.getElementById('devDados'); if (d) d.style.display = 'none'; document.querySelectorAll('.toast').forEach(t => t.remove()); });

    await passo('entrar como administrador com o PIN', async () => {
      await tocar(page.getByRole('button', { name: /Administrador/ }));
      await page.locator('#pinInput').fill('1234');
      await tocar(janela().getByRole('button', { name: 'Entrar' }));
      await page.locator('#screen-admin.active').waitFor();
    });

    await passo('abrir o loteamento pelo menu Imóveis', async () => {
      if (celular) { await tocar(page.getByRole('button', { name: 'Abrir menu' })); await page.waitForTimeout(500); }
      await tocar(page.locator('#aAside .tab[data-tab="emp"]'));
      await page.waitForTimeout(celular ? 500 : 150);
      await tocar(page.locator('#av-emp .item').filter({ hasText: 'Residencial Vista Verde' }).first());
      await page.getByText('Lotes e preços').first().waitFor();
    });

    await passo('abrir um lote disponível na lista de lotes', async () => {
      await tocar(page.getByText('Lotes e preços').first());
      const linha = page.locator('#av-emp tr.clickable').filter({ hasText: 'Disponível' }).first();
      loteId = (await linha.getAttribute('data-st')).replace('l:', '');
      await tocar(linha);
      await janela().getByRole('button', { name: 'Vender' }).waitFor();
    });

    await passo('vender o lote: preencher comprador e salvar', async () => {
      await tocar(janela().getByRole('button', { name: 'Vender' }));
      /* "Nome completo" também existe nos blocos de vendedor e corretor: o do comprador é o vc* */
      const j = janela(), comprador = rot => j.getByLabel(rot).and(page.locator('[id^="vc"]')).filter({ visible: true });
      await comprador('Nome completo').fill('Carla Regina Teixeira');
      await comprador('CPF').fill('529.982.247-25');
      await comprador('Telefone').fill('(47) 99876-5432');
      await comprador('Profissão').fill('Professora');
      await comprador('Estado civil').selectOption({ index: 1 });
      await comprador(/^RG/).fill('4.567.890');
      await comprador('Cidade').fill('Itajaí');
      await tocar(j.getByRole('button', { name: 'Salvar venda' }));
      await page.waitForTimeout(600);
      const r = await page.evaluate(id => { const l = getLote(id); const v = db.vendas.find(v => v.loteId === id && v.status !== 'distrato'); return { st: l.status, venda: v && v.id, cli: v && v.cliente.nome }; }, loteId);
      if (r.st !== 'vendido' || r.cli !== 'Carla Regina Teixeira') throw new Error(JSON.stringify(r));
      vendaId = r.venda;
      /* Depois de salvar, o app abre o contrato e pergunta se quer emitir o documento agora */
      await tocar(janela().getByRole('button', { name: 'Agora não' }));
    });

    await passo('o lote aparece como Vendido na tela', async () => {
      if (await janela().count()) await page.evaluate(() => closeModal());
      await page.evaluate(() => abrirEmpreendimento(curLot().id, 'lotes'));
      const t = await page.locator(`#av-emp [data-st="l:${loteId}"]`).innerText();
      if (!/Vendido/i.test(t)) throw new Error(t);
    });

    await passo('registrar o recebimento da entrada no contrato', async () => {
      await page.evaluate(id => abrirContrato(id, 'parcelas'), vendaId);
      const linha = page.locator('.tbl-parcelas tbody tr').first();
      await tocar(linha.getByRole('button', { name: 'Registrar pagamento' }));
      await tocar(janela().getByRole('button', { name: 'Confirmar', exact: true }));
      await page.waitForTimeout(400);
      const r = await page.evaluate(id => { const rec = db.recebiveis.filter(r => r.vendaId === id).sort((a, b) => a.numero - b.numero)[0]; return { pago: rec.valorPago, st: recStatus(rec) }; }, vendaId);
      if (r.st !== 'pago') throw new Error(JSON.stringify(r));
      const aviso = await page.locator('.toast.ok').last().innerText();
      if (!/Carla Regina Teixeira/.test(aviso)) throw new Error('aviso: ' + aviso);
      if (!/Pago/i.test(await page.locator('.tbl-parcelas tbody tr').first().innerText())) throw new Error('linha não mostra Pago');
    });

    if (!celular) await passo('teclado: Tab até um contrato e Enter abre', async () => {
      await page.evaluate(() => switchTab('vendas'));
      const item = page.locator('#av-vendas .item').first();
      await item.focus(); await page.keyboard.press('Enter');
      await page.locator('.ct-cab').waitFor();
    });

    await ctx.close();
  }
  console.log(erros.length ? '\nERROS:\n' + erros.join('\n') : '\ntudo ok');
  await browser.close(); process.exit(erros.length ? 1 : 0);
})();
