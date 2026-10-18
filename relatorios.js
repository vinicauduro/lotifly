/* ===== Gestão de Loteamento — relatórios =====
   Tabelas com filtro de período, agrupamento, subtotais, impressão e exportação. */
'use strict';

const RELATORIOS = [
  ['resumo', 'Resumo gerencial'],
  ['balancete', 'Balancete (resultado)'],
  ['espelho', 'Espelho de vendas'],
  ['vendas', 'Vendas'],
  ['receber', 'Contas a receber'],
  ['inadimplencia', 'Inadimplência'],
  ['comissoes', 'Comissões'],
  ['despesas', 'Despesas']
];

function relState() {
  const hoje = todayStr();
  state.rel = state.rel || { tipo: 'resumo', de: hoje.slice(0, 4) + '-01-01', ate: hoje, agrupar: 'categoria', status: 'todos', categoria: '', fornecedor: '', corretor: '', quadra: '', base: 'competencia', regime: 'caixa', centro: '', colunas: 'mes' };
  return state.rel;
}
function relSet(campo, valor) { relState()[campo] = valor; renderRelatorios(); }
function relPeriodo(atalho) {
  const f = relState(); const hoje = todayStr();
  const [y, m] = hoje.split('-').map(Number);
  if (atalho === 'mes') { f.de = `${y}-${pad2(m)}-01`; f.ate = hoje; }
  else if (atalho === 'anterior') { const d = new Date(y, m - 2, 1); const ult = new Date(y, m - 1, 0); f.de = ymd(d); f.ate = ymd(ult); }
  else if (atalho === 'ano') { f.de = `${y}-01-01`; f.ate = hoje; }
  else if (atalho === 'anoAnterior') { f.de = `${y - 1}-01-01`; f.ate = `${y - 1}-12-31`; }
  else if (atalho === 'tudo') { f.de = '2000-01-01'; f.ate = '2099-12-31'; }
  renderRelatorios();
}
function noPeriodo(data) { const f = relState(); return data && data >= f.de && data <= f.ate; }

// ---------------------------------------------------------------- tela
function renderRelatorios() {
  const v = $('#av-relatorios');
  if (!pode('relatorios.ver')) { v.innerHTML = semPermissaoHtml('relatórios'); return; }
  const f = relState();
  const rel = montarRelatorio(f.tipo, escopoAtual());
  v.innerHTML = `
    <div class="chips">${RELATORIOS.map(([k, l]) => `<div class="chip ${f.tipo === k ? 'active' : ''}" onclick="relSet('tipo','${k}')">${l}</div>`).join('')}</div>
    <div class="card">
      <div class="frow"><div class="fg"><label>De</label><input type="date" value="${f.de}" onchange="relSet('de',this.value)"></div>
        <div class="fg"><label>Até</label><input type="date" value="${f.ate}" onchange="relSet('ate',this.value)"></div></div>
      <div class="chips" style="margin-top:6px">${[['mes', 'Este mês'], ['anterior', 'Mês passado'], ['ano', 'Este ano'], ['anoAnterior', 'Ano passado'], ['tudo', 'Tudo']].map(([k, l]) => `<div class="chip" onclick="relPeriodo('${k}')">${l}</div>`).join('')}</div>
      ${rel.filtros || ''}
      <div class="btn-row mt"><button class="btn btn-secondary btn-sm" onclick="imprimirRelatorio()">Imprimir / PDF</button>
        <button class="btn btn-secondary btn-sm" onclick="exportarRelatorioCSV()">CSV</button></div>
    </div>
    ${rel.kpis || ''}
    ${rel.html}`;
  window.__rel = rel;
}

function relTabela(cols, linhas, rodape) {
  if (!linhas.length) return `<div class="empty"><div class="ic"><i class=ico data-i=file-text></i></div><p>Nada encontrado neste período.</p></div>`;
  return `<div class="card" style="padding:10px"><div class="table-wrap"><table class="tbl">
    <thead><tr>${cols.map(c => `<th${c.num ? ' class="num"' : ''}>${esc(c.t)}</th>`).join('')}</tr></thead>
    <tbody>${linhas.map(l => l.grupo
      ? `<tr style="background:var(--bg)"><td colspan="${cols.length}"><b>${esc(l.grupo)}</b>${l.info ? ` <span class="tiny muted">${esc(l.info)}</span>` : ''}</td></tr>`
      : `<tr>${l.cells.map((c, i) => `<td${cols[i].num ? ' class="num"' : ''}>${c}</td>`).join('')}</tr>`).join('')}</tbody>
    ${rodape ? `<tfoot><tr>${rodape.map((c, i) => `<th${cols[i].num ? ' class="num"' : ''}>${c}</th>`).join('')}</tr></tfoot>` : ''}
  </table></div></div>`;
}
function relKpis(itens) {
  return `<div class="kpi-grid">${itens.map(k => `<div class="kpi ${k.cor || ''}"><div class="lbl">${esc(k.lbl)}</div><div class="val">${k.val}</div><div class="sub">${esc(k.sub || '')}</div></div>`).join('')}</div>`;
}
function optHtml(lista, sel, vazio) {
  return `<option value="">${esc(vazio)}</option>` + lista.map(x => `<option value="${esc(x)}" ${sel === x ? 'selected' : ''}>${esc(x)}</option>`).join('');
}

// ---------------------------------------------------------------- relatórios
/* Os relatórios são da empresa inteira; escopo vazio traz tudo, escopo com id restringe a
   um empreendimento. Quem precisa de dado do empreendimento (orçamento, espelho) usa empsDo. */
function empsDo(escopo) { return escopo ? db.loteamentos.filter(l => l.id === escopo) : db.loteamentos; }
function montarRelatorio(tipo, escopo) {
  if (!db.loteamentos.length) return { titulo: 'Relatório', html: '<div class="card"><p class="help">Cadastre um empreendimento primeiro.</p></div>', cols: [], csv: [] };
  if (tipo === 'resumo') return relResumo(escopo);
  if (tipo === 'balancete') return relBalancete(escopo);
  if (tipo === 'espelho') return relEspelho(escopo);
  if (tipo === 'vendas') return relVendas(escopo);
  if (tipo === 'receber') return relReceber(escopo);
  if (tipo === 'inadimplencia') return relInadimplencia(escopo);
  if (tipo === 'comissoes') return relComissoes(escopo);
  return relDespesas(escopo);
}

function relResumo(escopo) {
  const f = relState();
  const ls = db.lotes.filter(l => noEscopo(l, escopo));
  const vendas = db.vendas.filter(v => noEscopo(v, escopo) && v.status !== 'distrato' && noPeriodo(v.dataVenda));
  const distratos = db.vendas.filter(v => noEscopo(v, escopo) && v.status === 'distrato' && noPeriodo(v.distratoEm || v.dataVenda));
  const recs = recebiveisDo(escopo);
  const recebido = recs.filter(r => noPeriodo(r.dataPagamento)).reduce((s, r) => s + num(r.valorPago), 0);
  const aReceber = recs.reduce((s, r) => s + recRestante(r), 0);
  const atraso = recs.filter(r => recStatus(r) === 'atrasado').reduce((s, r) => s + recRestante(r), 0);
  const cs = custosDo(escopo);
  const custoPeriodo = cs.filter(c => noPeriodo(f.base === 'pagamento' ? c.dataPagamento : c.dataCompetencia)).reduce((s, c) => s + num(c.valor), 0);
  const custoPago = cs.filter(c => c.status === 'pago' && noPeriodo(c.dataPagamento)).reduce((s, c) => s + num(c.valor), 0);
  const vgv = ls.reduce((s, l) => s + num(l.preco), 0);
  const vendido = ls.filter(l => l.status === 'vendido').length;
  const comissoes = vendas.reduce((s, v) => s + num(v.comissaoValor), 0);
  const linhas = [
    ['Lotes cadastrados', String(ls.length)],
    ['Vendidos', `${vendido} (${ls.length ? fmtNum(vendido / ls.length * 100, 1) : '0,0'}%)`],
    ['Disponíveis', String(ls.filter(l => l.status === 'disponivel').length)],
    ['Reservados', String(ls.filter(l => l.status === 'reservado').length)],
    ['VGV da tabela', fmtMoney(vgv)],
    ['Vendas no período', `${vendas.length} · ${fmtMoney(vendas.reduce((s, v) => s + num(v.valorTotal), 0))}`],
    ['Distratos no período', `${distratos.length} · ${fmtMoney(distratos.reduce((s, v) => s + num(v.valorTotal), 0))}`],
    ['Recebido no período', fmtMoney(recebido)],
    ['A receber (carteira)', fmtMoney(aReceber)],
    ['Em atraso', fmtMoney(atraso)],
    ['Comissões das vendas do período', fmtMoney(comissoes)],
    ['Custos no período', fmtMoney(custoPeriodo)],
    ['Custos pagos no período', fmtMoney(custoPago)],
    ['Caixa do período (recebido - custos pagos)', fmtMoney(recebido - custoPago)]
  ];
  const cols = [{ t: 'Indicador' }, { t: 'Valor', num: true }];
  return {
    titulo: 'Resumo gerencial',
    kpis: relKpis([
      { lbl: 'Vendas no período', val: fmtMoneyShort(vendas.reduce((s, v) => s + num(v.valorTotal), 0)), sub: `${vendas.length} contrato(s)`, cor: 'c-green' },
      { lbl: 'Recebido', val: fmtMoneyShort(recebido), sub: 'no período', cor: 'c-blue' },
      { lbl: 'Custos pagos', val: fmtMoneyShort(custoPago), sub: 'no período', cor: 'c-amber' },
      { lbl: 'Caixa', val: fmtMoneyShort(recebido - custoPago), sub: 'recebido menos custos', cor: recebido - custoPago >= 0 ? 'c-green' : 'c-red' }
    ]),
    html: relTabela(cols, linhas.map(l => ({ cells: [l[0], l[1]] }))),
    cols, csv: linhas
  };
}

/* Balancete gerencial: o resultado da empresa mês a mês — receitas, despesas separadas por
   grupo (obra, folha, comissões, administrativas…) e o lucro ou prejuízo.
   Caixa: o que entrou (pagamentos recebidos) e saiu (despesas e comissões pagas) no mês.
   Competência: receitas pelo vencimento das parcelas e despesas pelo mês de competência,
   pagas ou não; comissão no mês da venda. */
const LINHAS_RECEITA = [['entrada', 'Entradas (sinal)'], ['parcela', 'Parcelas'], ['balao', 'Reforços'], ['taxa', 'Taxas de cessão'], ['encargos', 'Correção, juros e multas'], ['outras', 'Outras receitas']];
function lancamentosBalancete(escopo, regime) {
  const out = [];
  const linhaRec = r => (LINHAS_RECEITA.some(l => l[0] === r.tipo) && r.tipo !== 'encargos' ? r.tipo : 'outras');
  if (regime === 'caixa') {
    /* O que foi recebido vale mesmo se o contrato depois virou distrato: o dinheiro entrou. */
    db.recebiveis.filter(r => noEscopo(r, escopo) && num(r.valorPago) > 0 && noPeriodo(r.dataPagamento)).forEach(r => {
      const pago = num(r.valorPago), principal = Math.min(pago, num(r.valor));
      out.push({ data: r.dataPagamento, tipo: 'receita', linha: linhaRec(r), valor: principal, centro: centroDe(r) });
      if (pago - principal > 0.005) out.push({ data: r.dataPagamento, tipo: 'receita', linha: 'encargos', valor: pago - principal, centro: centroDe(r) });
    });
    custosDo(escopo).filter(c => c.status === 'pago' && noPeriodo(c.dataPagamento))
      .forEach(c => out.push({ data: c.dataPagamento, tipo: 'despesa', linha: grupoDoCusto(c), sub: c.categoriaId, valor: num(c.valor), centro: centroDoCusto(c) }));
    vendasDo(escopo).filter(v => v.comissaoPaga && num(v.comissaoValor) > 0 && noPeriodo(v.comissaoData))
      .forEach(v => out.push({ data: v.comissaoData, tipo: 'despesa', linha: 'comissoes', valor: num(v.comissaoValor), centro: centroDe(v) }));
  } else {
    recebiveisDo(escopo).filter(r => noPeriodo(r.vencimento)).forEach(r => {
      out.push({ data: r.vencimento, tipo: 'receita', linha: linhaRec(r), valor: num(r.valor), centro: centroDe(r) });
      const corr = recValor(r) - num(r.valor);
      if (corr > 0.005) out.push({ data: r.vencimento, tipo: 'receita', linha: 'encargos', valor: corr, centro: centroDe(r) });
    });
    custosDo(escopo).filter(c => noPeriodo(c.dataCompetencia))
      .forEach(c => out.push({ data: c.dataCompetencia, tipo: 'despesa', linha: grupoDoCusto(c), sub: c.categoriaId, valor: num(c.valor), centro: centroDoCusto(c) }));
    vendasDo(escopo).filter(v => v.status !== 'distrato' && num(v.comissaoValor) > 0 && noPeriodo(v.dataVenda))
      .forEach(v => out.push({ data: v.dataVenda, tipo: 'despesa', linha: 'comissoes', valor: num(v.comissaoValor), centro: centroDe(v) }));
  }
  /* Um centro de custo da empresa escolhido (sem empreendimento no alto da tela): só ele */
  const centro = !escopo && centroDoFiltro();
  return centro ? out.filter(l => l.centro === centro) : out;
}
/* Parcela e comissão são do empreendimento do contrato */
function centroDoFiltro() { const c = relState().centro; return c && (c === CENTRO_ADM || getCentro(c)) ? c : ''; }
function centroDe(rec) { return rec.loteamentoId ? 'emp:' + rec.loteamentoId : CENTRO_ADM; }
/* Colunas: um mês por coluna até 12 meses; mais que isso, um ano por coluna. Só o trecho que
   tem lançamento: "Tudo" não abre cem anos vazios. */
function colunasBalancete(lanc) {
  const f = relState();
  /* Por centro de custo: um centro por coluna (os que tiveram movimento), na ordem do cadastro */
  if (f.colunas === 'centro') {
    const tem = new Set(lanc.map(l => l.centro));
    const chaves = todosCentros().map(c => c[0]).filter(k => tem.has(k));
    tem.forEach(k => { if (!chaves.includes(k)) chaves.push(k); });
    return { porCentro: true, chaves, rotulo: k => nomeCentro(k), de: l => l.centro };
  }
  const datas = lanc.map(l => l.data).sort();
  const de = datas.length ? (datas[0] > f.de ? datas[0] : f.de) : f.de;
  const ate = datas.length ? (datas[datas.length - 1] < f.ate ? datas[datas.length - 1] : f.ate) : f.ate;
  const meses = [];
  for (let k = de.slice(0, 7); k <= ate.slice(0, 7) && meses.length <= 13; k = monthKey(addMonths(k + '-01', 1))) meses.push(k);
  if (meses.length <= 12) return { porAno: false, chaves: meses, rotulo: k => monthLabel(k), de: l => l.data.slice(0, 7) };
  const anos = [];
  for (let a = Number(de.slice(0, 4)); a <= Number(ate.slice(0, 4)); a++) anos.push(String(a));
  return { porAno: true, chaves: anos, rotulo: k => k, de: l => l.data.slice(0, 4) };
}
function relBalancete(escopo) {
  const f = relState(), regime = f.regime === 'competencia' ? 'competencia' : 'caixa';
  const lanc = lancamentosBalancete(escopo, regime);
  const col = colunasBalancete(lanc);
  const soma = (filtro, k) => lanc.filter(l => filtro(l) && (k == null || col.de(l) === k)).reduce((s, l) => s + l.valor, 0);
  const porColuna = filtro => col.chaves.map(k => soma(filtro, k)).concat(soma(filtro));
  const receita = porColuna(l => l.tipo === 'receita');
  const despesa = porColuna(l => l.tipo === 'despesa');
  const resultado = receita.map((v, i) => v - despesa[i]);
  const totRec = receita[receita.length - 1], totDesp = despesa[despesa.length - 1], totRes = totRec - totDesp;
  const pct = v => totRec ? fmtNum(v / totRec * 100, 1) + '%' : '—';
  const dinheiro = v => (Math.abs(v) < 0.005 ? '—' : fmtMoney(v));
  /* As linhas, na ordem do balancete: seção, contas, total. Linha zerada no período some. */
  const linhas = [];
  linhas.push({ classe: 'sec', rot: 'Receitas' });
  LINHAS_RECEITA.forEach(([k, rot]) => { const v = porColuna(l => l.tipo === 'receita' && l.linha === k); if (Math.abs(v[v.length - 1]) > 0.005) linhas.push({ classe: 'conta', rot, v }); });
  linhas.push({ classe: 'tot', rot: 'Receita total', v: receita });
  linhas.push({ classe: 'sec', rot: 'Despesas' });
  gruposDespesa().forEach(([g, rot]) => {
    const v = porColuna(l => l.tipo === 'despesa' && l.linha === g);
    if (Math.abs(v[v.length - 1]) < 0.005) return;
    linhas.push({ classe: 'conta', rot, v });
    /* Embaixo do grupo, as categorias que o compõem: é aqui que se vê o que é folha, o que
       é obra, o que é escritório. */
    const cats = [...new Set(lanc.filter(l => l.tipo === 'despesa' && l.linha === g && l.sub).map(l => l.sub))];
    if (cats.length) cats.map(id => ({ id, nome: (getCategoria(id) || {}).nome || 'Sem categoria' })).sort((a, b) => naturalCmp(a.nome, b.nome))
      .forEach(c => linhas.push({ classe: 'sub', rot: c.nome, v: porColuna(l => l.tipo === 'despesa' && l.linha === g && l.sub === c.id) }));
  });
  linhas.push({ classe: 'tot', rot: 'Despesa total', v: despesa });
  linhas.push({ classe: 'res', rot: totRes >= 0 ? 'Resultado do período: lucro' : 'Resultado do período: prejuízo', v: resultado });
  const cols = [{ t: 'Conta' }].concat(col.chaves.map(k => ({ t: col.rotulo(k), num: true })), [{ t: col.chaves.length > 1 ? 'Total' : 'Valor', num: true }, { t: '% da receita', num: true }]);
  const umaColuna = col.chaves.length <= 1 && !col.porCentro;
  const cel = (v, i, l) => {
    if (umaColuna && i < v.length - 1) return null;
    const neg = l.classe === 'res' && v[i] < -0.005;
    return `<td class="num${neg ? ' neg' : l.classe === 'res' ? ' pos' : ''}">${dinheiro(v[i])}</td>`;
  };
  const html = lanc.length ? `<div class="card" style="padding:10px"><div class="table-wrap" tabindex="0" role="region" aria-label="Balancete, role para o lado para ver todas as colunas"><table class="tbl tbl-balancete">
    <thead><tr><th>Conta</th>${umaColuna ? '' : col.chaves.map(k => `<th class="num">${esc(col.rotulo(k))}</th>`).join('')}<th class="num">${umaColuna ? 'Valor' : 'Total'}</th><th class="num">% da receita</th></tr></thead>
    <tbody>${linhas.map(l => l.classe === 'sec'
      ? `<tr class="bal-sec"><td colspan="${(umaColuna ? 0 : col.chaves.length) + 3}">${esc(l.rot)}</td></tr>`
      : `<tr class="bal-${l.classe}"><td>${esc(l.rot)}</td>${l.v.map((_, i) => cel(l.v, i, l)).filter(Boolean).join('')}<td class="num">${pct(l.v[l.v.length - 1])}</td></tr>`).join('')}</tbody>
  </table></div></div>` : `<div class="empty"><div class="ic"><i class=ico data-i=file-text></i></div><p>Nada ${regime === 'caixa' ? 'recebido nem pago' : 'lançado'} neste período.</p></div>`;
  /* O que o regime deixa de fora, para ninguém confundir caixa com resultado */
  const naoPagas = regime === 'caixa' ? custosDo(escopo).filter(c => c.status !== 'pago' && noPeriodo(c.dataCompetencia)).reduce((s, c) => s + num(c.valor), 0) : 0;
  const aReceber = regime === 'caixa' ? recebiveisDo(escopo).filter(r => noPeriodo(r.vencimento)).reduce((s, r) => s + recRestante(r), 0) : 0;
  const temFolha = lanc.some(l => l.linha === 'folha');
  const emp = escopo ? getLoteamento(escopo) : null;
  const centro = !escopo ? centroDoFiltro() : '';
  const notas = [
    regime === 'caixa'
      ? '<b>Regime de caixa:</b> o que entrou (pagamentos recebidos) e o que saiu (despesas e comissões pagas) em cada mês.'
      : '<b>Regime de competência:</b> receitas pelo vencimento das parcelas e despesas pelo mês de competência, pagas ou não; a comissão entra no mês da venda.',
    regime === 'caixa' && (naoPagas > 0.005 || aReceber > 0.005) ? `Ficaram de fora, por ainda não terem sido pagos: ${naoPagas > 0.005 ? `${fmtMoney(naoPagas)} de despesas do período` : ''}${naoPagas > 0.005 && aReceber > 0.005 ? ' e ' : ''}${aReceber > 0.005 ? `${fmtMoney(aReceber)} a receber de parcelas que venceram no período` : ''}.` : '',
    emp ? `Só o empreendimento <b>${esc(emp.nome)}</b>: as despesas da empresa sem empreendimento (escritório, folha) não entram. Para o resultado da empresa inteira, escolha "Todos" no alto da tela.` : '',
    !emp && centro ? `Só o centro de custo <b>${esc(nomeCentro(centro))}</b>: as despesas lançadas nele${centro === CENTRO_ADM ? ' (as da empresa sem outro centro)' : ''}. As receitas dos contratos são dos empreendimentos, por isso não aparecem aqui.` : '',
    col.porCentro ? 'Cada coluna é um centro de custo: as receitas e comissões vão para o empreendimento do contrato, e cada despesa para o centro escolhido no lançamento. O resultado da Administração e dos outros centros da empresa costuma ser negativo, porque eles só gastam: é o custo da estrutura que os empreendimentos sustentam.' : '',
    'As comissões vêm da marcação "paga" nos contratos. Se a comissão também foi lançada como despesa, ela aparece duas vezes: deixe só uma.',
    temFolha ? '' : 'Para ver a folha separada, lance salários e encargos na conta <b>Folha de pagamento</b> (e a retirada dos sócios em <b>Pró-labore</b>). O grupo de cada conta se ajusta em Configurações › Plano de contas.'
  ].filter(Boolean);
  const csv = linhas.filter(l => l.classe !== 'sec').map(l => [l.classe === 'sub' ? '   ' + l.rot : l.rot].concat((umaColuna ? [l.v[l.v.length - 1]] : l.v).map(v => fmtNum(v)), [pct(l.v[l.v.length - 1])]));
  return {
    titulo: `Balancete (${regime === 'caixa' ? 'caixa' : 'competência'})${!emp && centro ? ' · ' + nomeCentro(centro) : ''}${col.porCentro ? ' por centro de custo' : ''}`,
    filtros: `<div class="frow" style="margin-top:8px"><div class="fg"><label for="relRegime">Regime</label><select id="relRegime" onchange="relSet('regime',this.value)">
        <option value="caixa" ${regime === 'caixa' ? 'selected' : ''}>Caixa: o que entrou e saiu no mês</option>
        <option value="competencia" ${regime === 'competencia' ? 'selected' : ''}>Competência: o que é do mês, pago ou não</option></select></div>
      <div class="fg"><label for="relColunas">Colunas</label><select id="relColunas" onchange="relSet('colunas',this.value)">
        <option value="mes" ${!col.porCentro ? 'selected' : ''}>Por período (mês ou ano)</option>
        <option value="centro" ${col.porCentro ? 'selected' : ''}>Por centro de custo</option></select></div></div>
      ${!emp ? `<div class="frow"><div class="fg"><label for="relCentro">Centro de custo da empresa</label><select id="relCentro" onchange="relSet('centro',this.value)">
        <option value="">Todos (empresa inteira)</option>${[[CENTRO_ADM, 'Administração']].concat(centrosCusto().map(c => [c.id, c.nome])).map(([k, l]) => `<option value="${esc(k)}" ${centro === k ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>
        <div class="hint">Para um empreendimento, escolha-o no alto da tela.</div></div></div>` : ''}`,
    kpis: relKpis([
      { lbl: 'Receitas', val: fmtMoneyShort(totRec), sub: regime === 'caixa' ? 'recebido no período' : 'do período', cor: 'c-blue' },
      { lbl: 'Despesas', val: fmtMoneyShort(totDesp), sub: regime === 'caixa' ? 'pago no período' : 'do período', cor: 'c-amber' },
      { lbl: totRes >= 0 ? 'Lucro' : 'Prejuízo', val: fmtMoneyShort(totRes), sub: 'receitas menos despesas', cor: totRes >= 0 ? 'c-green' : 'c-red' },
      { lbl: 'Margem', val: totRec ? fmtNum(totRes / totRec * 100, 1) + '%' : '—', sub: 'do que entrou, quanto sobrou', cor: totRes >= 0 ? 'c-green' : 'c-red' }
    ]),
    html: html + `<div class="card bal-notas">${notas.map(n => `<p class="help">${n}</p>`).join('')}</div>`,
    cols, csv, csvHead: cols.filter((c, i) => !umaColuna || i === 0 || i > col.chaves.length).map(c => c.t)
  };
}

function relEspelho(escopo) {
  const f = relState();
  const ls = db.lotes.filter(l => noEscopo(l, escopo)).slice().sort(cmpLote);
  const quadras = [...new Set(ls.map(l => l.quadra))].sort(naturalCmp);
  const lista = ls.filter(l => !f.quadra || l.quadra === f.quadra).filter(l => f.status === 'todos' || l.status === f.status);
  const linhas = []; const csv = [];
  let atual = null;
  lista.forEach(l => {
    if (l.quadra !== atual) {
      atual = l.quadra;
      const daQuadra = lista.filter(x => x.quadra === atual);
      linhas.push({ grupo: `Quadra ${atual}`, info: `${daQuadra.length} lote(s) · ${fmtMoney(daQuadra.reduce((s, x) => s + num(x.preco), 0))}` });
    }
    const v = vendaAtiva(l.id);
    const cells = [esc(l.numero), fmtNum(l.area, 2), fmtMoney(l.preco), l.area ? fmtMoney(l.preco / l.area) : '—', statusLabel(l.status), v ? esc(v.cliente.nome) : '—', v ? esc(v.corretor.nome) : '—'];
    linhas.push({ cells });
    csv.push([l.quadra, l.numero, fmtNum(l.area, 2), fmtNum(l.preco), statusLabel(l.status), v ? v.cliente.nome : '', v ? v.corretor.nome : '', v ? fmtDate(v.dataVenda) : '']);
  });
  const cols = [{ t: 'Lote' }, { t: 'Área m²', num: true }, { t: 'Preço', num: true }, { t: 'R$/m²', num: true }, { t: 'Situação' }, { t: 'Cliente' }, { t: 'Corretor' }];
  const totalV = lista.reduce((s, l) => s + num(l.preco), 0);
  return {
    titulo: 'Espelho de vendas',
    filtros: `<div class="frow" style="margin-top:8px"><div class="fg"><label>Quadra</label><select aria-label="Quadra" onchange="relSet('quadra',this.value)">${optHtml(quadras, f.quadra, 'Todas')}</select></div>
      <div class="fg"><label>Situação</label><select aria-label="Situação" onchange="relSet('status',this.value)">${['todos', 'disponivel', 'reservado', 'vendido', 'bloqueado'].map(s => `<option value="${s}" ${f.status === s ? 'selected' : ''}>${s === 'todos' ? 'Todas' : statusLabel(s)}</option>`).join('')}</select></div></div>
      <p class="tiny muted">Este relatório mostra a situação atual dos lotes, sem depender do período.</p>`,
    kpis: relKpis([
      { lbl: 'Lotes na lista', val: String(lista.length), sub: `de ${ls.length}`, cor: 'c-blue' },
      { lbl: 'Valor de tabela', val: fmtMoneyShort(totalV), sub: 'soma dos lotes listados', cor: 'c-green' },
      { lbl: 'Área total', val: fmtNum(lista.reduce((s, l) => s + num(l.area), 0), 0) + ' m²', sub: '', cor: 'c-amber' }
    ]),
    html: relTabela(cols, linhas, ['Total', fmtNum(lista.reduce((s, l) => s + num(l.area), 0), 2), fmtMoney(totalV), '', '', '', '']),
    cols, csv, csvHead: ['Quadra', 'Lote', 'Área', 'Preço', 'Situação', 'Cliente', 'Corretor', 'Data da venda']
  };
}

function relVendas(escopo) {
  const f = relState();
  const todas = db.vendas.filter(v => noEscopo(v, escopo) && noPeriodo(v.dataVenda));
  const corretores = [...new Set(todas.map(v => v.corretor.nome).filter(Boolean))].sort();
  const lista = todas.filter(v => !f.corretor || v.corretor.nome === f.corretor)
    .filter(v => f.status === 'todos' || (f.status === 'distrato' ? v.status === 'distrato' : v.status !== 'distrato'))
    .sort((a, b) => a.dataVenda.localeCompare(b.dataVenda));
  const linhas = [], csv = [];
  lista.forEach(v => {
    const r = vendaResumo(v);
    linhas.push({ cells: [fmtDate(v.dataVenda), esc(imovelShort(v)) || '—', esc(v.cliente.nome), esc(v.corretor.nome || '—'), fmtMoney(v.valorTotal), fmtMoney(v.entrada), `${v.nParcelas}× ${fmtMoney(v.valorParcela)}`, fmtMoney(r.pago), fmtMoney(r.restante), statusLabel(v.status)] });
    csv.push([fmtDate(v.dataVenda), imovelShort(v), v.cliente.nome, v.cliente.cpf || '', v.corretor.nome || '', fmtNum(v.valorTotal), fmtNum(v.entrada), v.nParcelas, fmtNum(v.valorParcela), fmtNum(r.pago), fmtNum(r.restante), fmtNum(v.comissaoValor), statusLabel(v.status)]);
  });
  const cols = [{ t: 'Data' }, { t: 'Lote' }, { t: 'Cliente' }, { t: 'Corretor' }, { t: 'Valor', num: true }, { t: 'Entrada', num: true }, { t: 'Parcelas' }, { t: 'Recebido', num: true }, { t: 'Saldo', num: true }, { t: 'Situação' }];
  const total = lista.reduce((s, v) => s + num(v.valorTotal), 0);
  const pago = lista.reduce((s, v) => s + vendaResumo(v).pago, 0);
  return {
    titulo: 'Vendas do período',
    filtros: `<div class="frow" style="margin-top:8px"><div class="fg"><label>Corretor</label><select aria-label="Corretor" onchange="relSet('corretor',this.value)">${optHtml(corretores, f.corretor, 'Todos')}</select></div>
      <div class="fg"><label>Situação</label><select aria-label="Situação" onchange="relSet('status',this.value)">${[['todos', 'Ativas e quitadas'], ['distrato', 'Só distratos']].map(([k, l]) => `<option value="${k}" ${f.status === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div></div>`,
    kpis: relKpis([
      { lbl: 'Vendas', val: String(lista.length), sub: 'no período', cor: 'c-blue' },
      { lbl: 'Valor vendido', val: fmtMoneyShort(total), sub: '', cor: 'c-green' },
      { lbl: 'Ticket médio', val: fmtMoneyShort(lista.length ? total / lista.length : 0), sub: '', cor: 'c-amber' },
      { lbl: 'Já recebido', val: fmtMoneyShort(pago), sub: 'destas vendas', cor: 'c-blue' }
    ]),
    html: relTabela(cols, linhas, ['Total', '', '', '', fmtMoney(total), fmtMoney(lista.reduce((s, v) => s + num(v.entrada), 0)), '', fmtMoney(pago), fmtMoney(lista.reduce((s, v) => s + vendaResumo(v).restante, 0)), '']),
    cols, csv, csvHead: ['Data', 'Lote', 'Cliente', 'CPF', 'Corretor', 'Valor', 'Entrada', 'Parcelas', 'Valor parcela', 'Recebido', 'Saldo', 'Comissão', 'Situação']
  };
}

function relReceber(escopo) {
  const f = relState();
  const todas = recebiveisDo(escopo).filter(r => noPeriodo(r.vencimento));
  const grupos = { todos: () => true, aberto: r => recStatus(r) !== 'pago', pago: r => recStatus(r) === 'pago', atrasado: r => recStatus(r) === 'atrasado' };
  const lista = todas.filter(grupos[f.status] || grupos.todos).sort((a, b) => a.vencimento.localeCompare(b.vencimento));
  const linhas = [], csv = [];
  let mes = null;
  lista.forEach(r => {
    const mk = monthKey(r.vencimento);
    if (f.agrupar === 'mes' && mk !== mes) {
      mes = mk;
      const doMes = lista.filter(x => monthKey(x.vencimento) === mk);
      linhas.push({ grupo: monthLabel(mk), info: `${doMes.length} parcela(s) · previsto ${fmtMoney(doMes.reduce((s, x) => s + recValor(x), 0))} · recebido ${fmtMoney(doMes.reduce((s, x) => s + num(x.valorPago), 0))}` });
    }
    const v = getVenda(r.vendaId);
    linhas.push({ cells: [fmtDate(r.vencimento), v ? esc(v.cliente.nome) : '—', v ? esc(imovelShort(v)) : '—', esc(r.descricao), fmtMoney(recValor(r)), fmtMoney(r.valorPago), r.dataPagamento ? fmtDate(r.dataPagamento) : '—', statusLabel(recStatus(r))] });
    csv.push([fmtDate(r.vencimento), v ? v.cliente.nome : '', v ? imovelShort(v) : '', r.descricao, fmtNum(r.valor), fmtNum(recValor(r)), fmtNum(r.valorPago), r.dataPagamento ? fmtDate(r.dataPagamento) : '', r.forma || '', statusLabel(recStatus(r))]);
  });
  const cols = [{ t: 'Vencimento' }, { t: 'Cliente' }, { t: 'Lote' }, { t: 'Parcela' }, { t: 'Valor', num: true }, { t: 'Pago', num: true }, { t: 'Data pgto' }, { t: 'Situação' }];
  const previsto = lista.reduce((s, r) => s + recValor(r), 0);
  const recebido = lista.reduce((s, r) => s + num(r.valorPago), 0);
  return {
    titulo: 'Contas a receber',
    filtros: `<div class="frow" style="margin-top:8px"><div class="fg"><label>Situação</label><select aria-label="Situação" onchange="relSet('status',this.value)">${[['todos', 'Todas'], ['aberto', 'Em aberto'], ['atrasado', 'Atrasadas'], ['pago', 'Pagas']].map(([k, l]) => `<option value="${k}" ${f.status === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      <div class="fg"><label>Agrupar</label><select aria-label="Agrupar por" onchange="relSet('agrupar',this.value)">${[['mes', 'Por mês de vencimento'], ['nenhum', 'Sem agrupar']].map(([k, l]) => `<option value="${k}" ${f.agrupar === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div></div>
      <p class="tiny muted">Os valores já saem corrigidos pelo índice do contrato, quando houver.</p>`,
    kpis: relKpis([
      { lbl: 'Parcelas', val: String(lista.length), sub: 'no período', cor: 'c-blue' },
      { lbl: 'Previsto', val: fmtMoneyShort(previsto), sub: '', cor: 'c-amber' },
      { lbl: 'Recebido', val: fmtMoneyShort(recebido), sub: '', cor: 'c-green' },
      { lbl: 'Em aberto', val: fmtMoneyShort(lista.reduce((s, r) => s + recRestante(r), 0)), sub: '', cor: 'c-red' }
    ]),
    html: relTabela(cols, linhas, ['Total', '', '', '', fmtMoney(previsto), fmtMoney(recebido), '', '']),
    cols, csv, csvHead: ['Vencimento', 'Cliente', 'Lote', 'Parcela', 'Valor base', 'Valor corrigido', 'Pago', 'Data pgto', 'Forma', 'Situação']
  };
}

function relInadimplencia(escopo) {
  const lista = inadimplentes(escopo);
  const linhas = [], csv = [];
  FAIXAS_DIAS.forEach(([nome, min, max]) => {
    const daFaixa = lista.filter(it => it.dias >= min && it.dias <= max);
    if (!daFaixa.length) return;
    linhas.push({ grupo: `${nome} dias`, info: `${daFaixa.length} contrato(s) · ${fmtMoney(daFaixa.reduce((s, x) => s + x.valor, 0))}` });
    daFaixa.forEach(it => {
      linhas.push({ cells: [esc(it.venda.cliente.nome), esc(imovelShort(it.venda)) || '—', String(it.parcelas.length), fmtDate(it.maisAntiga.vencimento), String(it.dias), fmtMoney(it.valorBase), fmtMoney(it.valor), it.ultima ? fmtDate(it.ultima.data) : '—'] });
      csv.push([it.venda.cliente.nome, imovelShort(it.venda), it.parcelas.length, fmtDate(it.maisAntiga.vencimento), it.dias, fmtNum(it.valorBase), fmtNum(it.valor), it.ultima ? fmtDate(it.ultima.data) : '', it.venda.cliente.telefone || '']);
    });
  });
  const cols = [{ t: 'Cliente' }, { t: 'Lote' }, { t: 'Parcelas', num: true }, { t: 'Venceu em' }, { t: 'Dias', num: true }, { t: 'Principal', num: true }, { t: 'Atualizado', num: true }, { t: 'Última cobrança' }];
  const total = lista.reduce((s, x) => s + x.valor, 0);
  const im = inadimplenciaDoMes(escopo);
  return {
    titulo: 'Inadimplência',
    filtros: '<p class="tiny muted" style="margin-top:8px">Mostra a situação atual dos contratos em atraso, sem depender do período.</p>',
    kpis: relKpis([
      { lbl: 'Contratos', val: String(lista.length), sub: 'em atraso', cor: 'c-red' },
      { lbl: 'Total atualizado', val: fmtMoneyShort(total), sub: 'com multa e juros', cor: 'c-red' },
      { lbl: 'Inadimplência do mês', val: fmtNum(im.pct, 1) + '%', sub: im.previsto ? `${fmtMoneyShort(im.atraso)} de ${fmtMoneyShort(im.previsto)} em ${monthLabel(im.mesKey)}` : 'nenhuma parcela no mês', cor: 'c-amber' },
      { lbl: 'Sem contato', val: String(lista.filter(x => !x.ultima).length), sub: 'nunca cobrados', cor: 'c-blue' }
    ]),
    html: relTabela(cols, linhas, ['Total', '', '', '', '', fmtMoney(lista.reduce((s, x) => s + x.valorBase, 0)), fmtMoney(total), '']),
    cols, csv, csvHead: ['Cliente', 'Lote', 'Parcelas', 'Venceu em', 'Dias', 'Principal', 'Atualizado', 'Última cobrança', 'Telefone']
  };
}

function relComissoes(escopo) {
  const f = relState();
  const todas = db.vendas.filter(v => noEscopo(v, escopo) && v.status !== 'distrato' && noPeriodo(v.dataVenda) && num(v.comissaoValor) > 0);
  const corretores = [...new Set(todas.map(v => v.corretor.nome).filter(Boolean))].sort();
  const lista = todas.filter(v => !f.corretor || v.corretor.nome === f.corretor)
    .filter(v => f.status === 'todos' || (f.status === 'pagas' ? v.comissaoPaga : !v.comissaoPaga))
    .sort((a, b) => (a.corretor.nome || '').localeCompare(b.corretor.nome || '') || a.dataVenda.localeCompare(b.dataVenda));
  const linhas = [], csv = [];
  let atual = null;
  lista.forEach(v => {
    const nome = v.corretor.nome || 'Venda direta';
    if (nome !== atual) {
      atual = nome;
      const doCorretor = lista.filter(x => (x.corretor.nome || 'Venda direta') === nome);
      linhas.push({ grupo: nome, info: `${doCorretor.length} venda(s) · ${fmtMoney(doCorretor.reduce((s, x) => s + num(x.comissaoValor), 0))} de comissão` });
    }
    linhas.push({ cells: [fmtDate(v.dataVenda), esc(imovelShort(v)) || '—', esc(v.cliente.nome), fmtMoney(v.valorTotal), fmtNum(v.comissaoPct, 1) + '%', fmtMoney(v.comissaoValor), v.comissaoPaga ? `paga${v.comissaoData ? ' em ' + fmtDate(v.comissaoData) : ''}` : 'a pagar'] });
    csv.push([v.corretor.nome || 'Venda direta', v.corretor.creci || '', fmtDate(v.dataVenda), imovelShort(v), v.cliente.nome, fmtNum(v.valorTotal), fmtNum(v.comissaoPct, 1), fmtNum(v.comissaoValor), v.comissaoPaga ? 'paga' : 'a pagar', v.comissaoData ? fmtDate(v.comissaoData) : '']);
  });
  const cols = [{ t: 'Data' }, { t: 'Lote' }, { t: 'Cliente' }, { t: 'Venda', num: true }, { t: '%', num: true }, { t: 'Comissão', num: true }, { t: 'Situação' }];
  const total = lista.reduce((s, v) => s + num(v.comissaoValor), 0);
  const aPagar = lista.filter(v => !v.comissaoPaga).reduce((s, v) => s + num(v.comissaoValor), 0);
  return {
    titulo: 'Comissões',
    filtros: `<div class="frow" style="margin-top:8px"><div class="fg"><label>Corretor</label><select aria-label="Corretor" onchange="relSet('corretor',this.value)">${optHtml(corretores, f.corretor, 'Todos')}</select></div>
      <div class="fg"><label>Situação</label><select aria-label="Situação" onchange="relSet('status',this.value)">${[['todos', 'Todas'], ['apagar', 'A pagar'], ['pagas', 'Pagas']].map(([k, l]) => `<option value="${k}" ${f.status === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div></div>`,
    kpis: relKpis([
      { lbl: 'Comissões', val: fmtMoneyShort(total), sub: `${lista.length} venda(s)`, cor: 'c-blue' },
      { lbl: 'A pagar', val: fmtMoneyShort(aPagar), sub: '', cor: 'c-amber' },
      { lbl: 'Pagas', val: fmtMoneyShort(total - aPagar), sub: '', cor: 'c-green' }
    ]),
    html: relTabela(cols, linhas, ['Total', '', '', fmtMoney(lista.reduce((s, v) => s + num(v.valorTotal), 0)), '', fmtMoney(total), '']),
    cols, csv, csvHead: ['Corretor', 'CRECI', 'Data', 'Lote', 'Cliente', 'Venda', '%', 'Comissão', 'Situação', 'Data do pagamento']
  };
}

function relDespesas(escopo) {
  const f = relState();
  const todos = custosDo(escopo);
  const fornecedores = [...new Set(todos.map(c => c.fornecedor).filter(Boolean))].sort();
  const dataBase = c => (f.base === 'pagamento' ? c.dataPagamento : f.base === 'vencimento' ? (c.vencimento || c.dataCompetencia) : c.dataCompetencia);
  const lista = todos
    .filter(c => noPeriodo(dataBase(c)))
    .filter(c => !f.categoria || c.categoriaId === f.categoria)
    .filter(c => !f.fornecedor || c.fornecedor === f.fornecedor)
    .filter(c => f.status === 'todos' || custoStatus(c) === f.status)
    .sort((a, b) => (dataBase(a) || '').localeCompare(dataBase(b) || ''));
  const chave = c => f.agrupar === 'fornecedor' ? (c.fornecedor || 'Sem fornecedor')
    : f.agrupar === 'mes' ? monthLabel(monthKey(dataBase(c)))
      : f.agrupar === 'lote' ? (c.loteId ? loteShort(getLote(c.loteId) || {}) || 'Geral' : c.vendaId && getVenda(c.vendaId) ? imovelShort(getVenda(c.vendaId)) || 'Imóvel' : c.loteamentoId ? 'Geral do empreendimento' : 'Empresa (sem empreendimento)')
        : f.agrupar === 'vinculo' ? (c.loteamentoId ? (getLoteamento(c.loteamentoId) || {}).nome || 'Empreendimento' : 'Empresa (sem empreendimento)')
        : f.agrupar === 'centro' ? nomeCentro(centroDoCusto(c))
        : f.agrupar === 'grupo' ? nomeGrupoBalancete(grupoDoCusto(c)) || 'Sem grupo'
        : (getCategoria(c.categoriaId) || {}).nome || 'Sem categoria';
  const linhas = [], csv = [];
  let atual = null;
  const ordenada = f.agrupar === 'nenhum' ? lista : lista.slice().sort((a, b) => chave(a).localeCompare(chave(b)) || (dataBase(a) || '').localeCompare(dataBase(b) || ''));
  ordenada.forEach(c => {
    if (f.agrupar !== 'nenhum' && chave(c) !== atual) {
      atual = chave(c);
      const doGrupo = ordenada.filter(x => chave(x) === atual);
      const soma = doGrupo.reduce((s, x) => s + num(x.valor), 0);
      linhas.push({ grupo: atual, info: `${doGrupo.length} lançamento(s) · ${fmtMoney(soma)} · ${fmtNum(soma / (lista.reduce((s, x) => s + num(x.valor), 0) || 1) * 100, 1)}% do total` });
    }
    const cat = getCategoria(c.categoriaId);
    const l = c.loteId ? getLote(c.loteId) : null;
    linhas.push({ cells: [fmtDate(dataBase(c)), esc(c.descricao), cat ? esc(cat.nome) : '—', esc(c.fornecedor || '—'), esc(vinculoDoCusto(c).rotulo), fmtMoney(c.valor), statusLabel(custoStatus(c))] });
    csv.push([fmtDate(c.dataCompetencia), c.vencimento ? fmtDate(c.vencimento) : '', c.dataPagamento ? fmtDate(c.dataPagamento) : '', c.descricao, cat ? cat.nome : '', nomeGrupoBalancete(grupoDoCusto(c)), c.fornecedor || '', vinculoDoCusto(c).rotulo, nomeCentro(centroDoCusto(c)), fmtNum(c.valor), statusLabel(custoStatus(c)), c.formaPagamento || '', c.obs || '']);
  });
  const cols = [{ t: 'Data' }, { t: 'Descrição' }, { t: 'Conta' }, { t: 'Fornecedor' }, { t: 'De quem' }, { t: 'Valor', num: true }, { t: 'Situação' }];
  const total = lista.reduce((s, c) => s + num(c.valor), 0);
  const pago = lista.filter(c => c.status === 'pago').reduce((s, c) => s + num(c.valor), 0);
  const atrasado = lista.filter(c => custoStatus(c) === 'atrasado').reduce((s, c) => s + num(c.valor), 0);
  const orc = {};
  empsDo(escopo).forEach(e => Object.entries(e.orcamento || {}).forEach(([k, v]) => { orc[k] = num(orc[k]) + num(v); }));
  const orcTotal = Object.values(orc).reduce((s, x) => s + num(x), 0);
  return {
    titulo: 'Despesas',
    filtros: `<div class="frow" style="margin-top:8px">
        <div class="fg"><label>Conta</label><select aria-label="Conta do plano de contas" onchange="relSet('categoria',this.value)"><option value="">Todas</option>${opcoesContasHtml(f.categoria, db.categorias)}</select></div>
        <div class="fg"><label>Fornecedor</label><select aria-label="Fornecedor" onchange="relSet('fornecedor',this.value)">${optHtml(fornecedores, f.fornecedor, 'Todos')}</select></div></div>
      <div class="frow3">
        <div class="fg"><label>Situação</label><select aria-label="Situação" onchange="relSet('status',this.value)">${[['todos', 'Todas'], ['pago', 'Pagas'], ['pendente', 'A pagar'], ['atrasado', 'Atrasadas']].map(([k, l]) => `<option value="${k}" ${f.status === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        <div class="fg"><label>Data considerada</label><select aria-label="Base" onchange="relSet('base',this.value)">${[['competencia', 'Competência'], ['vencimento', 'Vencimento'], ['pagamento', 'Pagamento']].map(([k, l]) => `<option value="${k}" ${f.base === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        <div class="fg"><label>Agrupar por</label><select aria-label="Agrupar por" onchange="relSet('agrupar',this.value)">${[['categoria', 'Conta do plano'], ['grupo', 'Grupo do plano de contas'], ['centro', 'Centro de custo'], ['vinculo', 'Empresa ou empreendimento'], ['fornecedor', 'Fornecedor'], ['mes', 'Mês'], ['lote', 'Lote'], ['nenhum', 'Sem agrupar']].map(([k, l]) => `<option value="${k}" ${f.agrupar === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div></div>`,
    kpis: relKpis([
      { lbl: 'Despesas', val: fmtMoneyShort(total), sub: `${lista.length} lançamento(s)`, cor: 'c-amber' },
      { lbl: 'Pagas', val: fmtMoneyShort(pago), sub: '', cor: 'c-green' },
      { lbl: 'Em atraso', val: fmtMoneyShort(atrasado), sub: '', cor: 'c-red' },
      { lbl: 'Orçado no projeto', val: fmtMoneyShort(orcTotal), sub: orcTotal ? `realizado ${fmtNum(custosDo(escopo).filter(custoDeObra).reduce((s, c) => s + num(c.valor), 0) / orcTotal * 100, 0)}%` : 'sem orçamento', cor: 'c-blue' }
    ]),
    html: relTabela(cols, linhas, ['Total', '', '', '', '', fmtMoney(total), '']) + orcamentoHtml(escopo, lista),
    cols, csv, csvHead: ['Competência', 'Vencimento', 'Pagamento', 'Descrição', 'Conta', 'Grupo', 'Fornecedor', 'De quem', 'Centro de custo', 'Valor', 'Situação', 'Forma', 'Observação']
  };
}

function orcamentoHtml(escopo, lista) {
  /* Orçamento é da obra: despesa da empresa (sem empreendimento) não entra no realizado */
  lista = lista.filter(custoDeObra);
  const orc = {};
  empsDo(escopo).forEach(e => Object.entries(e.orcamento || {}).forEach(([k, v]) => { orc[k] = num(orc[k]) + num(v); }));
  const cats = db.categorias.filter(c => num(orc[c.id]) > 0 || lista.some(x => x.categoriaId === c.id));
  if (!cats.length) return '';
  const todos = custosDo(escopo).filter(custoDeObra);
  return `<div class="card"><h2>Orçado × realizado por categoria</h2>
    <div class="table-wrap"><table class="tbl"><thead><tr><th>Categoria</th><th class="num">Orçado</th><th class="num">Realizado (total)</th><th class="num">No período</th><th class="num">Saldo</th></tr></thead>
    <tbody>${cats.map(c => {
      const orcado = num(orc[c.id]);
      const real = todos.filter(x => x.categoriaId === c.id).reduce((s, x) => s + num(x.valor), 0);
      const periodo = lista.filter(x => x.categoriaId === c.id).reduce((s, x) => s + num(x.valor), 0);
      const saldo = orcado - real;
      return `<tr><td><span class="dot" style="background:${esc(c.cor)}"></span> ${esc(c.nome)}</td><td class="num">${orcado ? fmtMoney(orcado) : '—'}</td><td class="num">${fmtMoney(real)}</td><td class="num">${fmtMoney(periodo)}</td><td class="num" style="color:${saldo < 0 ? 'var(--danger)' : 'var(--muted)'}">${orcado ? fmtMoney(saldo) : '—'}</td></tr>`;
    }).join('')}</tbody></table></div></div>`;
}

// ---------------------------------------------------------------- saída
function relCabecalhoImpressao(rel) {
  const lot = escopoAtual() ? getLoteamento(escopoAtual()) : null; const f = relState();
  const periodo = (f.de === '2000-01-01' && f.ate === '2099-12-31') ? 'todo o período' : `${fmtDate(f.de)} a ${fmtDate(f.ate)}`;
  return `<h1>${esc(db.config.empresa || (lot ? lot.nome : ''))}</h1>
    <div>${lot ? esc(lot.nome) + (lot.cidade ? ' · ' + esc(lot.cidade) : '') : 'Todos os empreendimentos'}</div>
    <h2>${esc(rel.titulo)} — ${esc(periodo)}</h2>`;
}
function imprimirRelatorio() {
  const rel = window.__rel; if (!rel) return;
  const limpo = String(rel.html)
    .replace(/<div class="card"[^>]*>/g, '').replace(/<div class="table-wrap">/g, '').replace(/<\/div>/g, '')
    .replace(/ onclick="[^"]*"/g, '');
  $('#printArea').innerHTML = relCabecalhoImpressao(rel) + limpo + `<p style="margin-top:10px">Emitido em ${fmtDate(todayStr())}${Cloud.active && Cloud.membro ? ' por ' + esc(Cloud.membro.nome || '') : ''}.</p>`;
  window.print();
}
function exportarRelatorioCSV() {
  const rel = window.__rel; if (!rel || !rel.csv) return;
  const head = rel.csvHead || rel.cols.map(c => c.t);
  download(`${rel.titulo.toLowerCase().replace(/\s+/g, '-')}-${todayStr()}.csv`, toCSV([head].concat(rel.csv)), 'text/csv');
  toast('⬇️', 'CSV gerado', rel.titulo);
}
