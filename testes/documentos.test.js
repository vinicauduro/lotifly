// Documentos: o texto que vai para o papel. Valores por extenso, qualificação das partes com
// concordância (masculino/feminino), cônjuge, várias partes de cada lado, linhas de
// assinatura, a proposta com reforço anual conferida contra a conta da planilha, e o
// contrato gerado pela tela: cláusulas em ordem, nada de "undefined", edição da prévia.
// Rodar: BASE=http://127.0.0.1:8765/lotifly/ node testes/documentos.test.js
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/gestao/';
const r2 = x => Math.round(x * 100) / 100;
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--disable-gpu'] });
  const erros = [];
  const passo = async (nome, fn) => { try { await fn(); console.log('✔', nome); } catch (e) { console.log('✘', nome, e.message.split('\n')[0]); erros.push(`${nome}: ${e.message.split('\n')[0]}`); } };
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' });
  await ctx.route(/config\.js/, r => r.fulfill({ contentType: 'application/javascript', body: "window.GL_CONFIG={supabaseUrl:'',supabaseAnonKey:''};" }));
  const page = await ctx.newPage(); page.setDefaultTimeout(8000);
  page.on('pageerror', e => erros.push(`pageerror: ${e.message}`)); page.on('dialog', d => d.accept());
  await page.goto(BASE + 'index.html?dados=exemplo'); await page.waitForFunction(() => window.PiorCaso && db.loteamentos.length); await page.waitForTimeout(300);
  await page.evaluate(() => {
    sessionStorage.setItem('gl_admin', '1'); startRole('admin'); document.querySelectorAll('#devDados,.toast').forEach(e => e.remove());
    window.print = () => { window.__imprimiu = true; };
    /* Pessoas de teste, com todos os campos que o contrato pede */
    const end = { logradouro: 'Rua das Palmeiras', numeroEnd: '120', bairro: 'Centro', cep: '88300000', cidade: 'Itajaí', uf: 'SC' };
    window.MARIA = Object.assign({ tipo: 'pf', genero: 'f', nome: 'Maria Aparecida Souza', nacionalidade: 'brasileiro', estadoCivil: 'casado', regimeBens: 'comunhão parcial de bens', profissao: 'professora', rg: '4.567.890', rgOrgao: 'SSP/SC', cpf: '12345678909', telefone: '47991234567' }, end,
      { conjuge: Object.assign({ tipo: 'pf', genero: 'm', nome: 'João Carlos Souza', nacionalidade: 'brasileiro', estadoCivil: 'casado', regimeBens: 'comunhão parcial de bens', profissao: 'motorista', rg: '3.210.987', rgOrgao: 'SSP/SC', cpf: '98765432100' }, end) });
    window.PEDRO = Object.assign({ tipo: 'pf', genero: 'm', nome: 'Pedro Henrique Lima', nacionalidade: 'brasileiro', estadoCivil: 'solteiro', profissao: 'engenheiro', rg: '5.555.555', rgOrgao: 'SSP/SC', cpf: '11122233396', logradouro: 'Avenida Brasil', numeroEnd: '45', cidade: 'Balneário Camboriú', uf: 'SC' });
  });

  await passo('valores por extenso, como o cartório escreve', async () => {
    const casos = [
      [142600, 'cento e quarenta e dois mil e seiscentos reais'], [1901.33, 'mil novecentos e um reais e trinta e três centavos'],
      [1000000, 'um milhão de reais'], [10000000, 'dez milhões de reais'], [2500000, 'dois milhões e quinhentos mil reais'],
      [1, 'um real'], [100, 'cem reais'], [101, 'cento e um reais'], [1001, 'mil e um reais'], [1100, 'mil e cem reais'],
      [1250, 'mil duzentos e cinquenta reais'], [21, 'vinte e um reais'], [0.5, 'cinquenta centavos'], [0.01, 'um centavo'],
      [1000100, 'um milhão e cem reais'], [8884.88, 'oito mil oitocentos e oitenta e quatro reais e oitenta e oito centavos']
    ];
    const r = await page.evaluate(c => c.map(([v, e]) => [v, moedaExtenso(v), e]), casos);
    const ruins = r.filter(([, s, e]) => s !== e);
    if (ruins.length) throw new Error(ruins.map(([v, s, e]) => `${v}: "${s}" (esperado "${e}")`).join(' | '));
  });
  await passo('data por extenso: dia 1º e mês por extenso', async () => {
    const r = await page.evaluate(() => [dataExtenso('2026-10-01'), dataExtenso('2026-03-15')]);
    if (r[0] !== '1º de outubro de 2026' || r[1] !== '15 de março de 2026') throw new Error(r.join(' | '));
  });
  await passo('compradora casada: concordância no feminino, regime de bens e o marido no mesmo endereço', async () => {
    const t = await page.evaluate(() => qualificacaoParte(MARIA));
    const dela = t.split(', e seu marido ')[0], dele = t.split(', e seu marido ')[1] || '';
    for (const f of ['Maria Aparecida Souza, brasileira, casada sob o regime da comunhão parcial de bens, professora', 'portadora da cédula de identidade RG nº 4.567.890 SSP/SC', 'inscrita no CPF sob o nº 123.456.789-09', 'residente e domiciliada na Rua das Palmeiras, nº 120, Centro, CEP 88300-000, Itajaí/SC'])
      if (!dela.includes(f)) throw new Error('falta: ' + f + ' — em: ' + dela);
    if (/brasileiro,|casado |portador |inscrito |domiciliado /.test(dela)) throw new Error('masculino no trecho dela: ' + dela);
    if (!dele.startsWith('João Carlos Souza, brasileiro, casado sob o regime da comunhão parcial de bens, motorista') || !dele.endsWith('residente e domiciliado no mesmo endereço')) throw new Error('cônjuge: ' + dele);
    if ((t.match(/Rua das Palmeiras/g) || []).length !== 1) throw new Error('endereço repetido');
  });
  await passo('união estável vira "sua companheira"; viúva e separada judicialmente no feminino', async () => {
    const r = await page.evaluate(() => [
      qualificacaoParte(Object.assign({}, PEDRO, { estadoCivil: 'união estável', conjuge: { genero: 'f', nome: 'Ana Paula Reis', nacionalidade: 'brasileiro', mesmoEndereco: true } })),
      qualificacaoPessoa({ genero: 'f', nome: 'Rosa', nacionalidade: 'brasileiro', estadoCivil: 'viúvo' }),
      qualificacaoPessoa({ genero: 'f', nome: 'Lia', estadoCivil: 'separado judicialmente' })]);
    if (!r[0].includes(', e sua companheira Ana Paula Reis, brasileira') || !r[0].includes('residente e domiciliada no mesmo endereço')) throw new Error(r[0]);
    if (r[1] !== 'Rosa, brasileira, viúva') throw new Error(r[1]);
    if (r[2] !== 'Lia, separada judicialmente') throw new Error(r[2]);
  });
  await passo('logradouro: "na Rua", "no Loteamento", "em" quando não reconhece', async () => {
    const r = await page.evaluate(() => [prepLogradouro('Rua A'), prepLogradouro('Loteamento Vista Verde'), prepLogradouro('BR-101 km 12')]);
    if (r.join() !== 'na,no,em') throw new Error(r.join());
  });
  await passo('cadastro incompleto: o campo em branco some, sem vírgula sobrando nem "undefined"', async () => {
    const t = await page.evaluate(() => qualificacaoParte({ genero: 'm', nome: 'Carlos', cpf: '12345678909', estadoCivil: 'casado', conjuge: {} }));
    if (t !== 'Carlos, casado, inscrito no CPF sob o nº 123.456.789-09') throw new Error(t);
  });
  await passo('várias partes: "; e" antes da última, nomes com "e", assinatura de cada uma e do cônjuge', async () => {
    const r = await page.evaluate(() => {
      const ana = { genero: 'f', nome: 'Ana Lima', nacionalidade: 'brasileiro' };
      return { q: qualificacaoPartes([MARIA, PEDRO, ana]), n: nomesDasPartes([MARIA, PEDRO, ana]), a: linhasAssinatura([MARIA, PEDRO], 'Promitente comprador') };
    });
    if (!/no mesmo endereço; Pedro Henrique Lima, .*; e Ana Lima, brasileira$/.test(r.q)) throw new Error(r.q.slice(-220));
    if (r.n !== 'Maria Aparecida Souza, Pedro Henrique Lima e Ana Lima') throw new Error(r.n);
    const linhas = r.a.split('\n\n').map(b => b.split('\n').slice(1).join(' / '));
    if (linhas.join(' | ') !== 'Maria Aparecida Souza / Promitente comprador | João Carlos Souza / Cônjuge de Maria Aparecida Souza | Pedro Henrique Lima / Promitente comprador') throw new Error(linhas.join(' | '));
  });
  await passo('empresa vendedora com dois representantes', async () => {
    const t = await page.evaluate(() => qualificacaoPessoa({ tipo: 'pj', nome: 'Vista Verde Empreendimentos Ltda', cpf: '12345678000195', logradouro: 'Avenida Central', numeroEnd: '900', cidade: 'Itajaí', uf: 'SC',
      representantes: [{ genero: 'm', nome: 'Paulo Reis', cpf: '12345678909', cargo: 'sócio administrador' }, { genero: 'f', nome: 'Clara Reis', cpf: '98765432100', cargo: 'sócia' }] }));
    if (!t.startsWith('Vista Verde Empreendimentos Ltda, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº 12.345.678/0001-95, com sede na Avenida Central, nº 900, Itajaí/SC, neste ato representada por Paulo Reis, na qualidade de sócio administrador, inscrito no CPF sob o nº 123.456.789-09; e Clara Reis, na qualidade de sócia, inscrita no CPF'))
      throw new Error(t);
  });
  await passo('proposta com reforço anual: a parcela é a da planilha (reforços trazidos a valor presente)', async () => {
    const lid = await page.evaluate(() => { const l = db.lotes.find(l => l.status === 'disponivel' && l.preco); abrirPropostaForm(l.id); return l.id; });
    await page.waitForTimeout(300);
    await page.fill('#ppNome', 'Maria Aparecida Souza'); await page.fill('#ppTel', '47991234567');
    await page.fill('#ppTotal', '100000'); await page.fill('#ppEntrada', '10000'); await page.fill('#ppN', '60'); await page.fill('#ppJuros', '1'); await page.fill('#ppReforco', '5000');
    await page.waitForTimeout(100);
    const sis = await page.evaluate(() => num(val('ppParcela')));
    let vpRef = 0; for (let k = 12; k <= 60; k += 12) vpRef += 5000 / Math.pow(1.01, k);
    const saldo = 100000 - 10000 - vpRef, esperado = r2(saldo * 0.01 / (1 - Math.pow(1.01, -60)));
    if (Math.abs(sis - esperado) > 0.005) throw new Error(`parcela ${sis} × planilha ${esperado}`);
    await page.locator('#modalFoot').getByRole('button', { name: 'Gerar proposta' }).click(); await page.waitForTimeout(300);
    const t = await page.evaluate(() => document.getElementById('docFolha').innerText);
    const p = await page.evaluate(v => fmtMoney(v), esperado);
    if (!t.includes('Maria Aparecida Souza') || !t.includes(p) || !/5 reforços de R\$\s?5\.000,00/.test(t)) throw new Error(t.slice(0, 300));
    if (/undefined|NaN|null/.test(t)) throw new Error('texto quebrado na proposta');
    await page.evaluate(() => closeModal()); void lid;
  });

  /* Contrato de uma venda já qualificada, gerado pela tela, com e sem índice */
  const contrato = async (comIndice) => {
    await page.evaluate((comIndice) => {
      if (!db.indices.find(i => i.id === 'ipca-t')) upsert('indices', { id: 'ipca-t', nome: 'IPCA', valores: {} });
      const base = db.vendas.find(v => v.status === 'ativa' && v.loteId);
      const v = Object.assign(JSON.parse(JSON.stringify(base)), { id: 'doc1', cliente: MARIA, compradoresExtras: [PEDRO], valorTotal: 142600, entrada: 28520, nParcelas: 60, valorParcela: 1901.33, jurosMes: 0, indiceId: comIndice ? 'ipca-t' : null, indiceBase: comIndice ? '2026-02' : null, baloes: [] });
      upsert('vendas', v); gerarContratoVenda('doc1');
    }, comIndice);
    await page.waitForTimeout(300);
    await page.locator('#modalFoot').getByRole('button', { name: 'Gerar contrato' }).click(); await page.waitForTimeout(300);
    return page.evaluate(() => ({ texto: document.getElementById('docFolha').innerText, clausulas: [...document.querySelectorAll('#docFolha h3')].map(h => h.textContent.split('—')[0].trim()) }));
  };
  const ORDINAIS = ['PRIMEIRA', 'SEGUNDA', 'TERCEIRA', 'QUARTA', 'QUINTA', 'SEXTA', 'SÉTIMA', 'OITAVA'];
  for (const comIndice of [false, true]) {
    await passo(`contrato ${comIndice ? 'com' : 'sem'} índice: cláusulas em ordem, sem número repetido`, async () => {
      const r = await contrato(comIndice);
      const cl = r.clausulas.filter(c => c.startsWith('CLÁUSULA')).map(c => c.replace('CLÁUSULA ', ''));
      if (cl.join(',') !== ORDINAIS.slice(0, cl.length).join(',')) throw new Error(cl.join(', '));
      if (comIndice && !/Parágrafo único — da correção monetária\. As parcelas são corrigidas mensalmente pela variação do IPCA/.test(r.texto)) throw new Error('sem a correção pelo IPCA');
      if (/undefined|NaN|\bnull\b/.test(r.texto)) throw new Error('texto quebrado');
      if (!/R\$\s142\.600,00 \(cento e quarenta e dois mil e seiscentos reais\)/.test(r.texto)) throw new Error('preço/extenso: ' + (r.texto.match(/preço certo[^.]*/) || [''])[0]);
      if (!r.texto.includes('Maria Aparecida Souza, brasileira, casada') || !r.texto.includes('; e Pedro Henrique Lima, brasileiro, solteiro')) throw new Error('partes');
      if (!r.texto.includes('Parcelas 7 a 60') || !r.texto.includes('Cônjuge de Maria Aparecida Souza')) throw new Error('tabela ou assinaturas: ' + r.texto.slice(-700).replace(/\s+/g, ' '));
      await page.evaluate(() => closeModal());
    });
  }
  await passo('gerar o contrato não apaga o cônjuge da venda (o formulário traz os dados dele)', async () => {
    const r = await page.evaluate(() => ({ cj: (getVenda('doc1').cliente.conjuge || {}).nome, extra: (getVenda('doc1').compradoresExtras || []).map(p => p.nome) }));
    if (r.cj !== 'João Carlos Souza' || r.extra.join() !== 'Pedro Henrique Lima') throw new Error(JSON.stringify(r));
  });
  await passo('ficha do cliente casado: um bloco de cônjuge só, e ele é salvo', async () => {
    await page.evaluate(() => abrirClienteForm()); await page.waitForTimeout(300);
    await page.fill('#clNome', 'Beatriz Ramos'); await page.selectOption('#clGenero', 'f'); await page.selectOption('#clEstCivil', 'casado'); await page.waitForTimeout(100);
    const n = await page.evaluate(() => document.querySelectorAll('[id="clCjNome"]').length);
    if (n !== 1) throw new Error(n + ' blocos de cônjuge');
    await page.fill('#clCjNome', 'Rafael Ramos');
    await page.locator('#modalFoot').getByRole('button', { name: /Salvar|Cadastrar/ }).click(); await page.waitForTimeout(300);
    const c = await page.evaluate(() => db.clientes.find(c => c.nome === 'Beatriz Ramos'));
    if (!c || (c.conjuge || {}).nome !== 'Rafael Ramos' || c.conjuge.genero !== 'm') throw new Error(JSON.stringify(c && c.conjuge));
  });
  await passo('edição da prévia vai para a impressão', async () => {
    await contrato(false);
    await page.evaluate(() => { const f = document.getElementById('docFolha'); f.querySelector('p').textContent = 'Trecho ajustado à mão pelo escritório.'; docImprimir('Contrato teste'); });
    const r = await page.evaluate(() => ({ p: document.getElementById('printArea').textContent, imp: window.__imprimiu }));
    if (!r.imp || !r.p.includes('Trecho ajustado à mão pelo escritório.')) throw new Error('a edição não foi para a impressão');
  });
  await browser.close();
  if (erros.length) { console.log('\nERROS:\n' + erros.join('\n')); process.exit(1); }
  console.log('\nTudo certo.');
})();
