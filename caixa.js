/* ===== Caixa e bancos =====
   Cada conta (corrente, poupança, aplicação ou o caixa em dinheiro) é de uma empresa do grupo:
   empresaId vazio é a empresa principal (Configurações › Dados da empresa); senão, uma das
   "outras empresas do grupo" (db.vendedores). O saldo começa no saldo inicial, informado numa
   data de corte; dali em diante soma os movimentos da conta.

   Os movimentos nascem sozinhos: recebimento de parcela (inclusive baixa do retorno do banco e
   antecipação), conta paga e comissão paga. Quem grava chama upsert/removeRec (core.js), que
   chama caixaAoGravar/caixaAoApagar: assim nenhum caminho de pagamento fica sem caixa. A conta
   vem da janela em que a pessoa escolheu (Caixa.escolha); sem escolha, da conta de cobrança do
   boleto ou da conta padrão da empresa. O que aconteceu antes da data de corte já está no
   saldo inicial e não vira movimento. */
'use strict';

const TIPOS_CONTA = { corrente: 'Conta corrente', poupanca: 'Poupança', aplicacao: 'Aplicação', caixa: 'Caixa (dinheiro)' };
const NATUREZAS = { recebimento: 'Recebimento', pagamento: 'Conta paga', comissao: 'Comissão paga', transferencia: 'Transferência', manual: 'Lançamento' };
const Caixa = { escolha: null };
const r2c = x => Math.round(num(x) * 100) / 100;

// ---------------------------------------------------------------- empresas e contas
function nomeEmpresaPrincipal() { return db.config.empresa || (Cloud.org && Cloud.org.nome) || 'Empresa principal'; }
/* Empresas do grupo: a principal e as outras cadastradas (na ordem do cadastro) */
function empresasDoGrupo() { return [{ id: '', nome: nomeEmpresaPrincipal() }].concat(db.vendedores.map(v => ({ id: v.id, nome: v.nome || 'Empresa sem nome' }))); }
function nomeEmpresaDe(id) { const e = empresasDoGrupo().find(x => x.id === (id || '')); return e ? e.nome : nomeEmpresaPrincipal(); }
function getContaCaixa(id) { return db.contasCaixa.find(c => c.id === id) || null; }
function contaAtivaCaixa(c) { return !!(c && c.ativa !== false && c.dataSaldo); }
function contasCaixaAtivas() { return db.contasCaixa.filter(contaAtivaCaixa); }
function caixaSemTabela() { return (Cloud.tabelasFaltando || []).some(t => t === 'contasCaixa' || t === 'movimentos'); }
function caixaLigado() { return !caixaSemTabela() && contasCaixaAtivas().length > 0; }
/* Venda → empresa que assina (e que recebe) */
function empresaDaVenda(v) { return (v && v.vendedorId) || ''; }
/* Conta padrão de uma empresa: a última usada nela; senão a primeira ativa dela; senão qualquer ativa */
function contaPadrao(empresaId) {
  const ativas = contasCaixaAtivas(), emp = empresaId || '';
  const ult = getContaCaixa(((prefs.caixaConta || {})[emp]) || '');
  if (contaAtivaCaixa(ult) && (ult.empresaId || '') === emp) return ult;
  return ativas.find(c => (c.empresaId || '') === emp) || ativas[0] || null;
}
function lembrarConta(contaId) {
  const c = getContaCaixa(contaId); if (!c) return;
  prefs.caixaConta = Object.assign({}, prefs.caixaConta, { [c.empresaId || '']: c.id }); savePrefs();
}
/* Roda fn com a conta que a pessoa escolheu na janela; os movimentos que nascerem dali vão nela */
function comConta(contaId, fn) {
  const c = getContaCaixa(contaId);
  Caixa.escolha = contaAtivaCaixa(c) ? c.id : null;
  if (Caixa.escolha) lembrarConta(Caixa.escolha);
  try { return fn(); } finally { Caixa.escolha = null; }
}
function contaEscolhida() { const c = getContaCaixa(Caixa.escolha); return contaAtivaCaixa(c) ? c : null; }
function movsDe(campo, id) { return db.movimentos.filter(m => m[campo] === id); }
function somaMovs(ms) { return r2c(ms.reduce((s, m) => s + num(m.valor), 0)); }
/* Saldo da conta: saldo inicial + o que entrou e saiu desde a data de corte (até "ate", se dada) */
function movimentosDaConta(c) { return db.movimentos.filter(m => m.contaId === c.id && m.data >= (c.dataSaldo || '')); }
function saldoConta(c, ate) { return r2c(num(c.saldoInicial) + movimentosDaConta(c).filter(m => !ate || m.data <= ate).reduce((s, m) => s + num(m.valor), 0)); }

/* Campo "Entrou na conta" / "Saiu da conta" das janelas de pagamento; só com o caixa ligado */
function contaCaixaCampoHtml(id, rotulo, empresaId, atualId) {
  if (!caixaLigado()) return '';
  const atual = getContaCaixa(atualId) && contaAtivaCaixa(getContaCaixa(atualId)) ? atualId : (contaPadrao(empresaId) || {}).id;
  return `<div class="fg"><label for="${id}">${rotulo}</label><select id="${id}">${opcoesContasCaixa(atual)}</select></div>`;
}
function opcoesContasCaixa(atual, filtro) {
  const ativas = contasCaixaAtivas().filter(c => !filtro || filtro(c));
  const grupos = empresasDoGrupo().map(e => [e, ativas.filter(c => (c.empresaId || '') === e.id)]).filter(([, cs]) => cs.length);
  const op = c => `<option value="${esc(c.id)}" ${c.id === atual ? 'selected' : ''}>${esc(c.nome)}</option>`;
  return grupos.length > 1 ? grupos.map(([e, cs]) => `<optgroup label="${esc(e.nome)}">${cs.map(op).join('')}</optgroup>`).join('') : ativas.map(op).join('');
}

// ---------------------------------------------------------------- o caixa acompanha os pagamentos
function caixaAoGravar(col, rec, antes) {
  if (col === 'recebiveis') sincronizarRecebimento(rec, antes);
  else if (col === 'custos') sincronizarContaPaga(rec);
  else if (col === 'vendas') sincronizarComissao(rec);
}
function caixaAoApagar(col, antes) {
  if (col === 'recebiveis') movsDe('recebivelId', antes.id).forEach(m => removeRec('movimentos', m.id));
  else if (col === 'custos') { if (db.movimentos.some(m => m.id === 'mc-' + antes.id)) removeRec('movimentos', 'mc-' + antes.id); }
  else if (col === 'vendas') { if (db.movimentos.some(m => m.id === 'mk-' + antes.id)) removeRec('movimentos', 'mk-' + antes.id); }
}
/* Conta para um recebimento: a escolhida; pago por boleto, a conta ligada ao convênio que
   numerou o título; senão a padrão da empresa que assina o contrato. */
function contaDoRecebimento(r) {
  const esc0 = contaEscolhida(); if (esc0) return esc0;
  if (r.forma === 'Boleto' && r.contaId) { const c = contasCaixaAtivas().find(x => x.contaBancoId && x.contaBancoId === r.contaId); if (c) return c; }
  return contaPadrao(empresaDaVenda(getVenda(r.vendaId)));
}
/* O que já entrou numa parcela tem de bater com o que o caixa registrou dela. Pagamento novo
   (ou parcial) vira um movimento com a diferença; estorno apaga os movimentos dela. */
function sincronizarRecebimento(r, antes) {
  const movs = movsDe('recebivelId', r.id), pago = r2c(r.valorPago);
  if (pago <= 0.005 || !r.dataPagamento) { movs.forEach(m => removeRec('movimentos', m.id)); return; }
  let base = somaMovs(movs);
  if (Math.abs(pago - base) < 0.005) return;
  if (pago < base) { movs.forEach(m => removeRec('movimentos', m.id)); base = 0; }
  if (!caixaLigado()) return;
  const c = contaDoRecebimento(r); if (!c || r.dataPagamento < c.dataSaldo) return;
  /* O que a parcela já tinha recebido antes da data de corte está no saldo inicial */
  if (!movs.length && antes && r2c(antes.valorPago) > 0 && antes.dataPagamento && antes.dataPagamento < c.dataSaldo) base = r2c(antes.valorPago);
  const valor = r2c(pago - base); if (valor <= 0.005) return;
  const v = getVenda(r.vendaId);
  upsert('movimentos', { id: genId(), contaId: c.id, data: r.dataPagamento, valor, natureza: 'recebimento',
    descricao: `${v ? v.cliente.nome + ' · ' : ''}${r.descricao || 'Parcela'}`, recebivelId: r.id, vendaId: r.vendaId || null, obs: '', criadoEm: new Date().toISOString() });
}
/* Despesa paga: um movimento só (mc-<despesa>), que acompanha valor, data e conta */
function sincronizarSaida(id, ativo, data, valor, campos, empresaId) {
  const m = db.movimentos.find(x => x.id === id);
  if (!ativo || !data || !(valor > 0)) { if (m) removeRec('movimentos', id); return; }
  const c = contaEscolhida() || (m && getContaCaixa(m.contaId)) || (caixaLigado() ? contaPadrao(empresaId) : null);
  if (!c || caixaSemTabela() || data < (c.dataSaldo || '9999')) { if (m) removeRec('movimentos', id); return; }
  const novo = Object.assign({ id, contaId: c.id, data, valor: -r2c(valor), obs: '', criadoEm: (m && m.criadoEm) || new Date().toISOString() }, campos);
  if (m && ['contaId', 'data', 'valor', 'descricao'].every(k => m[k] === novo[k])) return;
  upsert('movimentos', novo);
}
function sincronizarContaPaga(c) {
  sincronizarSaida('mc-' + c.id, c.status === 'pago', c.dataPagamento, num(c.valor),
    { natureza: 'pagamento', descricao: c.descricao + (c.fornecedor ? ' · ' + c.fornecedor : ''), custoId: c.id }, '');
}
function sincronizarComissao(v) {
  sincronizarSaida('mk-' + v.id, !!v.comissaoPaga, v.comissaoData, num(v.comissaoValor),
    { natureza: 'comissao', descricao: `Comissão · ${(v.corretor || {}).nome || 'corretor'} · ${imovelShort(v) || ''}`, vendaId: v.id }, empresaDaVenda(v));
}

/* Pagamentos feitos depois da data de corte que ainda não estão em conta nenhuma (lançados
   antes de o caixa existir, ou de uma empresa que ganhou conta depois). */
function corteDaEmpresa(empresaId) {
  const ativas = contasCaixaAtivas(), daEmp = ativas.filter(c => (c.empresaId || '') === (empresaId || ''));
  const ds = (daEmp.length ? daEmp : ativas).map(c => c.dataSaldo).sort();
  return ds[0] || null;
}
function pendenciasCaixa() {
  if (!caixaLigado()) return [];
  const out = [];
  db.recebiveis.forEach(r => {
    const pago = r2c(r.valorPago); if (pago <= 0.005 || !r.dataPagamento) return;
    const v = getVenda(r.vendaId), emp = empresaDaVenda(v), corte = corteDaEmpresa(emp);
    if (!corte || r.dataPagamento < corte) return;
    const falta = r2c(pago - somaMovs(movsDe('recebivelId', r.id)));
    if (falta > 0.005) out.push({ col: 'recebiveis', id: r.id, data: r.dataPagamento, valor: falta, desc: `${v ? v.cliente.nome + ' · ' : ''}${r.descricao}`, emp });
  });
  db.custos.forEach(c => {
    const corte = corteDaEmpresa('');
    if (c.status === 'pago' && c.dataPagamento && corte && c.dataPagamento >= corte && !db.movimentos.some(m => m.id === 'mc-' + c.id))
      out.push({ col: 'custos', id: c.id, data: c.dataPagamento, valor: -num(c.valor), desc: c.descricao + (c.fornecedor ? ' · ' + c.fornecedor : ''), emp: '' });
  });
  db.vendas.forEach(v => {
    const emp = empresaDaVenda(v), corte = corteDaEmpresa(emp);
    if (v.comissaoPaga && num(v.comissaoValor) > 0 && v.comissaoData && corte && v.comissaoData >= corte && !db.movimentos.some(m => m.id === 'mk-' + v.id))
      out.push({ col: 'vendas', id: v.id, data: v.comissaoData, valor: -num(v.comissaoValor), desc: `Comissão · ${(v.corretor || {}).nome || 'corretor'}`, emp });
  });
  return out.sort((a, b) => a.data.localeCompare(b.data));
}

// ---------------------------------------------------------------- tela
function renderCaixa() {
  const v = $('#av-caixa');
  const contaId = state.sub.caixaConta;
  if (contaId && getContaCaixa(contaId)) { v.innerHTML = extratoHtml(getContaCaixa(contaId)); return; }
  state.sub.caixaConta = null;
  const podeConta = pode('config.editar') && !caixaSemTabela(), podeTransf = pode('financeiro.baixar') && contasCaixaAtivas().length > 1;
  const acoes = `${podeTransf ? `<button class="btn btn-secondary btn-sm" onclick="abrirTransferencia()"><i class=ico data-i=arrows-left-right></i>Transferir</button>` : ''}${podeConta ? `<button class="btn btn-primary btn-sm" onclick="abrirContaCaixa()"><i class=ico data-i=plus></i>Nova conta</button>` : ''}`;
  const sub = 'Saldo de cada conta, por empresa do grupo';
  if (caixaSemTabela()) {
    v.innerHTML = tituloTela('Caixa e bancos', '', sub) + `<div class="alert warn" style="cursor:default"><span><b>Falta atualizar o banco de dados.</b> Para ligar o caixa, rode de novo o arquivo <code>supabase/schema.sql</code> no Supabase (SQL Editor) e recarregue a página.</span></div>`;
    return;
  }
  if (!db.contasCaixa.length) {
    v.innerHTML = tituloTela('Caixa e bancos', acoes, sub) + `<div class="card"><div class="empty"><div class="ic"><i class=ico data-i=wallet></i></div>
      <p><b>Cadastre as contas de cada empresa</b>: banco, poupança, aplicação e o caixa em dinheiro, com o saldo de uma data de corte.</p>
      <p>Daí em diante, todo recebimento de parcela, conta paga, comissão paga e baixa de boleto diz em qual conta o dinheiro entrou ou saiu, e o saldo anda sozinho.</p>
      ${podeConta ? '<div class="btn-row" style="justify-content:center"><button class="btn btn-primary" onclick="abrirContaCaixa()"><i class=ico data-i=plus></i>Cadastrar a primeira conta</button></div>' : '<p>Peça a quem pode alterar as configurações para cadastrar as contas.</p>'}</div></div>`;
    return;
  }
  const pend = pendenciasCaixa();
  const ativas = contasCaixaAtivas(), total = r2c(ativas.reduce((s, c) => s + saldoConta(c), 0));
  const grupos = empresasDoGrupo().map(e => [e, db.contasCaixa.filter(c => (c.empresaId || '') === e.id)]).filter(([, cs]) => cs.length);
  v.innerHTML = tituloTela('Caixa e bancos', acoes, sub) + `
    <div class="ct-resumo">Total em caixa e bancos <b class="${total < 0 ? 'neg' : ''}">${fmtMoney(total)}</b>${grupos.length > 1 ? ` · ${nPlural(grupos.length, 'empresa')}` : ''} · ${nPlural(ativas.length, 'conta ativa', 'contas ativas')}</div>
    ${pend.length && pode('financeiro.baixar') ? `<div class="alert warn cx-pend" onclick="abrirPendenciasCaixa()"><span><b>${nPlural(pend.length, 'pagamento')} desde a data de corte ainda sem conta</b> (${[[pend.filter(p => p.valor > 0), 'entrando'], [pend.filter(p => p.valor < 0), 'saindo']].filter(([ps]) => ps.length).map(([ps, l]) => `${fmtMoney(Math.abs(ps.reduce((s, p) => s + p.valor, 0)))} ${l}`).join(', ')}). Escolha em qual conta cada um entrou ou saiu.</span><button class="btn btn-secondary btn-sm">Escolher contas</button></div>` : ''}
    ${grupos.map(([e, cs]) => { const tot = r2c(cs.filter(contaAtivaCaixa).reduce((s, c) => s + saldoConta(c), 0)); return `<section class="cx-empresa">
      <div class="cx-emp-head"><h3>${esc(e.nome)}</h3><span class="cx-emp-tot ${tot < 0 ? 'neg' : ''}">${fmtMoney(tot)}</span></div>
      <div class="lista">${cs.map(contaLinhaHtml).join('')}</div></section>`; }).join('')}`;
}
function contaLinhaHtml(c) {
  const ativa = contaAtivaCaixa(c), s = saldoConta(c), n = movimentosDaConta(c).length;
  const cb = c.contaBancoId && db.contasBanco.find(x => x.id === c.contaBancoId);
  return `<div class="item linha linha2 cx-conta ${ativa ? '' : 'inativa'}" tabindex="0" role="button" onclick="abrirExtrato('${c.id}')" onkeydown="if(event.key==='Enter')abrirExtrato('${c.id}')">
    <div class="info"><div class="title"><i class="ico cx-ico" data-i=${c.tipo === 'caixa' ? 'coins' : c.tipo === 'aplicacao' ? 'chart-line-up' : 'bank'}></i>${esc(c.nome)}${ativa ? '' : ' <span class="badge neutral">inativa</span>'}</div>
      <div class="meta"><span>${esc(TIPOS_CONTA[c.tipo] || 'Conta')}${c.banco ? ' · ' + esc(c.banco) : ''}</span><span>· saldo inicial ${fmtMoney(c.saldoInicial)} em ${c.dataSaldo ? fmtDate(c.dataSaldo) : '—'}</span><span>· ${nPlural(n, 'movimento')}</span>${cb ? '<span>· recebe os boletos</span>' : ''}</div></div>
    <div class="side"><div class="value ${s < 0 ? 'neg' : ''}">${fmtMoney(s)}</div><div class="tiny muted">saldo hoje</div></div></div>`;
}
function abrirExtrato(id) { state.sub.caixaConta = id; state.sub.caixaMes = null; renderCurrent(); window.scrollTo(0, 0); }
function voltarContas() { state.sub.caixaConta = null; renderCurrent(); }

/* Extrato: do mais novo para o mais antigo, com o saldo depois de cada movimento. O filtro de
   mês mostra o saldo do começo e do fim do mês. */
function extratoHtml(c) {
  const movs = movimentosDaConta(c).slice().sort((a, b) => a.data.localeCompare(b.data) || (a.criadoEm || '').localeCompare(b.criadoEm || ''));
  let saldo = num(c.saldoInicial);
  const linhas = movs.map(m => { saldo = r2c(saldo + num(m.valor)); return { m, saldo }; });
  const meses = [...new Set(movs.map(m => m.data.slice(0, 7)))].sort().reverse();
  const mes = meses.includes(state.sub.caixaMes) ? state.sub.caixaMes : 'all';
  const vis = linhas.filter(x => mes === 'all' || x.m.data.slice(0, 7) === mes).reverse();
  const ent = vis.filter(x => x.m.valor > 0).reduce((s, x) => s + num(x.m.valor), 0), sai = vis.filter(x => x.m.valor < 0).reduce((s, x) => s - num(x.m.valor), 0);
  const inicioMes = mes === 'all' ? null : r2c(num(c.saldoInicial) + movs.filter(m => m.data.slice(0, 7) < mes).reduce((s, m) => s + num(m.valor), 0));
  const atual = saldoConta(c);
  const acoes = `${pode('config.editar') ? `<button class="btn btn-secondary btn-sm" onclick="abrirContaCaixa('${c.id}')"><i class=ico data-i=pencil-simple></i>Editar conta</button>` : ''}${pode('financeiro.baixar') && contasCaixaAtivas().length > 1 && contaAtivaCaixa(c) ? `<button class="btn btn-secondary btn-sm" onclick="abrirTransferencia('${c.id}')"><i class=ico data-i=arrows-left-right></i>Transferir</button>` : ''}`;
  return `<button class="btn btn-secondary btn-sm mb" onclick="voltarContas()"><i class=ico data-i=caret-left></i>Todas as contas</button>
    ${tituloTela(esc(c.nome), acoes, `${esc(nomeEmpresaDe(c.empresaId))} · ${esc(TIPOS_CONTA[c.tipo] || 'Conta')}${c.banco ? ' · ' + esc(c.banco) : ''}`)}
    <div class="cx-saldos">
      <div><div class="k">Saldo hoje</div><div class="v ${atual < 0 ? 'neg' : ''}">${fmtMoney(atual)}</div></div>
      <div><div class="k">Entradas${mes === 'all' ? '' : ' no mês'}</div><div class="v pos">${fmtMoney(ent)}</div></div>
      <div><div class="k">Saídas${mes === 'all' ? '' : ' no mês'}</div><div class="v">${fmtMoney(sai)}</div></div>
    </div>
    <div class="filters mb"><select aria-label="Mês" onchange="state.sub.caixaMes=this.value;renderCurrent()"><option value="all">Desde a data de corte</option>${meses.map(m => `<option value="${m}" ${mes === m ? 'selected' : ''}>${monthLabel(m)}</option>`).join('')}</select></div>
    <div class="lista">
      ${vis.map(({ m, saldo }) => movLinhaHtml(m, saldo)).join('')}
      <div class="item linha cx-mov cx-inicial"><div class="ct-venc"><div class="ct-data">${fmtDate(mes === 'all' ? c.dataSaldo : mes + '-01')}</div></div>
        <div class="info"><div class="title">${mes === 'all' ? 'Saldo inicial (data de corte)' : 'Saldo no começo do mês'}</div></div>
        <div class="side"><div class="value">${fmtMoney(mes === 'all' ? c.saldoInicial : inicioMes)}</div></div></div>
    </div>
    ${!vis.length ? `<p class="help mt">Nenhum movimento ${mes === 'all' ? 'desde a data de corte' : 'neste mês'}. Recebimentos, contas pagas, comissões e transferências desta conta aparecem aqui.</p>` : ''}`;
}
function movLinhaHtml(m, saldo) {
  return `<div class="item linha cx-mov" tabindex="0" role="button" onclick="abrirMovimento('${m.id}')" onkeydown="if(event.key==='Enter')abrirMovimento('${m.id}')">
    <div class="ct-venc"><div class="ct-data">${fmtDate(m.data)}</div></div>
    <div class="info"><div class="title">${esc(m.descricao || NATUREZAS[m.natureza] || 'Movimento')}</div><div class="meta"><span>${esc(NATUREZAS[m.natureza] || 'Movimento')}</span>${m.obs ? `<span>· ${esc(m.obs)}</span>` : ''}</div></div>
    <div class="side"><div class="value ${m.valor > 0 ? 'pos' : 'neg'}">${m.valor > 0 ? '+' : '−'} ${fmtMoney(Math.abs(m.valor))}</div><div class="tiny muted">saldo ${fmtMoney(saldo)}</div></div></div>`;
}

// ---------------------------------------------------------------- conta: cadastro
function abrirContaCaixa(id) {
  if (!pode('config.editar')) { toast('🔒', 'Sem permissão', 'Cadastrar contas pede "alterar configurações".', true); return; }
  const c = id ? getContaCaixa(id) : null;
  const usadas = new Set(db.contasCaixa.filter(x => x.id !== id).map(x => x.contaBancoId).filter(Boolean));
  const conv = db.contasBanco.filter(b => !usadas.has(b.id));
  const nMov = c ? db.movimentos.filter(m => m.contaId === c.id).length : 0;
  const body = `<div class="frow"><div class="fg"><label for="cxNome">Nome da conta *</label><input type="text" id="cxNome" value="${esc(c ? c.nome : '')}" placeholder="Ex.: BB Corrente, Sicoob, Caixa do escritório"></div>
      <div class="fg"><label for="cxEmp">Empresa</label><select id="cxEmp">${empresasDoGrupo().map(e => `<option value="${esc(e.id)}" ${(c ? c.empresaId || '' : '') === e.id ? 'selected' : ''}>${esc(e.nome)}</option>`).join('')}</select></div></div>
    <div class="frow"><div class="fg"><label for="cxTipo">Tipo</label><select id="cxTipo">${Object.entries(TIPOS_CONTA).map(([k, l]) => `<option value="${k}" ${(c ? c.tipo : 'corrente') === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      <div class="fg"><label for="cxBanco">Banco (opcional)</label><input type="text" id="cxBanco" value="${esc(c ? c.banco || '' : '')}" placeholder="Banco do Brasil · ag 1234 / cc 56789-0"></div></div>
    <div class="fieldset"><span class="lg">Saldo de partida</span>
      <div class="frow"><div class="fg"><label for="cxSaldo">Saldo inicial (R$) *</label><input type="number" id="cxSaldo" step="0.01" inputmode="decimal" value="${c ? c.saldoInicial : ''}" placeholder="0,00"></div>
        <div class="fg"><label for="cxData">Data de corte *</label><input type="date" id="cxData" value="${c ? c.dataSaldo || '' : todayStr()}"></div></div>
      <p class="help">O saldo que a conta tinha no começo desse dia, como no extrato do banco. O que entrou e saiu antes já está nele; daí em diante o sistema soma sozinho.${nMov ? ` Mudar a data de corte deixa de fora os movimentos anteriores a ela.` : ''}</p></div>
    ${conv.length || (c && c.contaBancoId) ? `<div class="fg"><label for="cxConv">Boletos que caem nesta conta</label><select id="cxConv"><option value="">Nenhum</option>${db.contasBanco.filter(b => !usadas.has(b.id)).map(b => `<option value="${esc(b.id)}" ${c && c.contaBancoId === b.id ? 'selected' : ''}>${esc((BANCOS[pad(b.banco, 3)] || {}).nome || b.banco)} · ag ${esc(b.agencia)} / conta ${esc(b.conta)} · convênio ${esc(b.convenio)}</option>`).join('')}</select><div class="hint">A baixa do retorno do banco entra nesta conta.</div></div>` : ''}
    ${c ? `<label class="check"><input type="checkbox" id="cxAtiva" ${c.ativa !== false ? 'checked' : ''}> Conta ativa (aparece para escolher nos pagamentos)</label>` : ''}`;
  openModal({ title: c ? 'Editar conta' : 'Nova conta', body,
    footer: `${c ? `<button class="btn btn-outline-danger" onclick="excluirContaCaixa('${c.id}')">Excluir</button>` : ''}<button class="btn btn-secondary" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" onclick="salvarContaCaixa('${c ? c.id : ''}')">Salvar conta</button>` });
  focarSeLivre('cxNome');
}
function salvarContaCaixa(id) {
  const prev = id ? getContaCaixa(id) : null;
  const nome = val('cxNome'), data = val('cxData'), saldoTxt = val('cxSaldo');
  if (!nome) { toast('⚠️', 'Dê um nome à conta', 'Ex.: BB Corrente, Caixa do escritório.', true); return; }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) { toast('⚠️', 'Informe a data de corte', 'É o dia do saldo inicial.', true); return; }
  if (saldoTxt === '' || isNaN(Number(saldoTxt))) { toast('⚠️', 'Informe o saldo inicial', 'Pode ser zero ou negativo (cheque especial).', true); return; }
  if (db.contasCaixa.some(x => x.id !== id && x.nome.trim().toLowerCase() === nome.toLowerCase() && (x.empresaId || '') === val('cxEmp'))) { toast('⚠️', 'Já existe uma conta com esse nome', 'Use um nome que diferencie as duas.', true); return; }
  const ativa = document.getElementById('cxAtiva') ? document.getElementById('cxAtiva').checked : true;
  const rec = Object.assign({}, prev || { id: genId(), criadoEm: new Date().toISOString() }, {
    nome, tipo: val('cxTipo') || 'corrente', banco: val('cxBanco'), empresaId: val('cxEmp') || '', contaBancoId: val('cxConv') || '',
    saldoInicial: r2c(saldoTxt), dataSaldo: data, ativa });
  upsert('contasCaixa', rec);
  logAct(`${prev ? 'Conta do caixa alterada' : 'Conta do caixa criada'}: ${rec.nome} (${nomeEmpresaDe(rec.empresaId)}) — saldo de ${fmtMoney(rec.saldoInicial)} em ${fmtDate(rec.dataSaldo)}`);
  closeModal(); renderCurrent();
  toast('✅', prev ? 'Conta salva' : 'Conta criada', `${rec.nome} · saldo ${fmtMoney(saldoConta(rec))}`);
}
async function excluirContaCaixa(id) {
  const c = getContaCaixa(id); if (!c) return;
  if (db.movimentos.some(m => m.contaId === id)) { avisar({ titulo: 'Conta com movimentos', texto: 'Esta conta já tem recebimentos, pagamentos ou transferências. Para não perder o histórico, desmarque "Conta ativa": ela some das escolhas e o extrato continua guardado.' }); return; }
  if (!(await confirmar({ titulo: `Excluir a conta "${c.nome}"?`, valores: [['Saldo inicial', fmtMoney(c.saldoInicial)]], acao: 'Excluir conta', perigo: true }))) return;
  removeRec('contasCaixa', id); logAct(`Conta do caixa excluída: ${c.nome}`);
  state.sub.caixaConta = null; closeModal(); renderCurrent();
}

// ---------------------------------------------------------------- transferência entre contas
function abrirTransferencia(deId) {
  if (!pode('financeiro.baixar')) { toast('🔒', 'Sem permissão', 'Transferir pede "registrar pagamentos".', true); return; }
  const ativas = contasCaixaAtivas(); if (ativas.length < 2) { toast('⚠️', 'Precisa de duas contas', 'Cadastre a outra conta antes de transferir.', true); return; }
  const de = deId || ativas[0].id, para = (ativas.find(c => c.id !== de) || {}).id;
  const body = `<div class="frow"><div class="fg"><label for="trDe">Sai da conta</label><select id="trDe">${opcoesContasCaixa(de)}</select></div>
      <div class="fg"><label for="trPara">Entra na conta</label><select id="trPara">${opcoesContasCaixa(para)}</select></div></div>
    <div class="frow"><div class="fg"><label for="trValor">Valor (R$) *</label><input type="number" id="trValor" step="0.01" inputmode="decimal"></div>
      <div class="fg"><label for="trData">Data *</label><input type="date" id="trData" value="${todayStr()}" max="${todayStr()}"></div></div>
    <div class="fg"><label for="trObs">Observação</label><input type="text" id="trObs" placeholder="Ex.: aplicação do mês, sangria do caixa"></div>
    <p class="help">Entre empresas diferentes do grupo, a transferência sai de uma e entra na outra do mesmo jeito; no balancete ela não é receita nem despesa.</p>`;
  openModal({ title: 'Transferir entre contas', body, footer: `<button class="btn btn-secondary" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" onclick="salvarTransferencia()">Transferir</button>` });
  focarSeLivre('trValor');
}
function salvarTransferencia() {
  const de = getContaCaixa(val('trDe')), para = getContaCaixa(val('trPara')), valor = r2c(val('trValor')), data = val('trData');
  if (!de || !para || de.id === para.id) { toast('⚠️', 'Escolha duas contas diferentes', '', true); return; }
  if (!(valor > 0)) { toast('⚠️', 'Informe o valor', '', true); return; }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) { toast('⚠️', 'Informe a data', '', true); return; }
  if (data > todayStr()) { toast('⚠️', 'Data no futuro', 'A transferência é lançada no dia em que aconteceu.', true); return; }
  const corte = [de, para].find(c => data < c.dataSaldo);
  if (corte) { toast('⚠️', 'Antes da data de corte', `${corte.nome} começa em ${fmtDate(corte.dataSaldo)}. O que aconteceu antes já está no saldo inicial.`, true); return; }
  const tid = genId(), agora = new Date().toISOString(), obs = val('trObs');
  upsert('movimentos', { id: genId(), contaId: de.id, data, valor: -valor, natureza: 'transferencia', descricao: `Transferência para ${para.nome}`, transferenciaId: tid, obs, criadoEm: agora });
  upsert('movimentos', { id: genId(), contaId: para.id, data, valor, natureza: 'transferencia', descricao: `Transferência de ${de.nome}`, transferenciaId: tid, obs, criadoEm: agora });
  logAct(`Transferência: ${fmtMoney(valor)} de ${de.nome} para ${para.nome} (${fmtDate(data)})`);
  closeModal(); renderCurrent();
  toast('✅', 'Transferência lançada', `${fmtMoney(valor)} · ${de.nome} → ${para.nome}`, false, { rotulo: 'Desfazer', fn: () => { movsDe('transferenciaId', tid).forEach(m => removeRec('movimentos', m.id)); logAct(`Transferência desfeita: ${fmtMoney(valor)} de ${de.nome} para ${para.nome}`); renderCurrent(); } });
}

// ---------------------------------------------------------------- um movimento: ver, mudar de conta
function abrirMovimento(id) {
  const m = db.movimentos.find(x => x.id === id); if (!m) return;
  const c = getContaCaixa(m.contaId), podeMexer = pode('financeiro.baixar') || (m.natureza === 'pagamento' && pode('custos.editar')) || (m.natureza === 'comissao' && pode('comissao.gerenciar'));
  const origem = m.recebivelId && m.vendaId ? `<button class="btn btn-secondary btn-sm" onclick="closeModal();abrirVendaAdmin('${m.vendaId}')">Abrir o contrato</button>`
    : m.custoId ? `<button class="btn btn-secondary btn-sm" onclick="abrirCustoForm('${m.custoId}')">Abrir a despesa</button>`
    : m.natureza === 'comissao' && m.vendaId ? `<button class="btn btn-secondary btn-sm" onclick="closeModal();abrirVendaAdmin('${m.vendaId}')">Abrir o contrato</button>` : '';
  const body = `<p class="small mb"><b>${esc(m.descricao)}</b></p>
    <div class="detail-grid"><div><div class="k">Valor</div><div class="v ${m.valor > 0 ? 'pos' : 'neg'}">${m.valor > 0 ? '+' : '−'} ${fmtMoney(Math.abs(m.valor))}</div></div><div><div class="k">Data</div><div class="v">${fmtDate(m.data)}</div></div>
      <div><div class="k">Tipo</div><div class="v">${esc(NATUREZAS[m.natureza] || 'Movimento')}</div></div><div><div class="k">Empresa</div><div class="v">${esc(nomeEmpresaDe(c && c.empresaId))}</div></div></div>
    ${m.obs ? `<p class="small muted mb">${esc(m.obs)}</p>` : ''}
    ${podeMexer && m.natureza !== 'transferencia' ? `<div class="fg"><label for="mvConta">Conta</label><select id="mvConta">${opcoesContasCaixa(m.contaId, x => m.data >= x.dataSaldo || x.id === m.contaId)}</select><div class="hint">Se o dinheiro entrou ou saiu por outra conta, troque aqui.</div></div>` : ''}
    ${m.natureza !== 'transferencia' ? '<p class="help">Para mudar valor ou data, mude o pagamento na origem; o caixa acompanha.</p>' : ''}
    ${origem ? `<div class="btn-row">${origem}</div>` : ''}`;
  openModal({ title: 'Movimento', body, footer: `${m.natureza === 'transferencia' && pode('financeiro.baixar') ? `<button class="btn btn-outline-danger" onclick="excluirTransferencia('${m.transferenciaId}')">Excluir transferência</button>` : ''}<button class="btn btn-secondary" onclick="closeModal()">Fechar</button>${podeMexer && m.natureza !== 'transferencia' ? `<button class="btn btn-primary" onclick="moverMovimento('${m.id}')">Salvar</button>` : ''}` });
}
function moverMovimento(id) {
  const m = db.movimentos.find(x => x.id === id), c = getContaCaixa(val('mvConta'));
  if (!m || !c) return;
  if (c.id !== m.contaId) {
    upsert('movimentos', Object.assign({}, m, { contaId: c.id }));
    lembrarConta(c.id);
    logAct(`Movimento trocado de conta: ${m.descricao} — ${fmtMoney(Math.abs(m.valor))} para ${c.nome}`);
    toast('✅', 'Movimento trocado de conta', `${m.descricao} agora está em ${c.nome}.`);
  }
  closeModal(); renderCurrent();
}
async function excluirTransferencia(tid) {
  const ms = movsDe('transferenciaId', tid); if (!ms.length) return;
  const sai = ms.find(m => m.valor < 0) || ms[0];
  if (!(await confirmar({ titulo: 'Excluir esta transferência?', valores: [['Valor', fmtMoney(Math.abs(sai.valor)), true], ['Data', fmtDate(sai.data)]], texto: 'Sai das duas contas.', acao: 'Excluir', perigo: true }))) return;
  ms.forEach(m => removeRec('movimentos', m.id));
  logAct(`Transferência excluída: ${sai.descricao} — ${fmtMoney(Math.abs(sai.valor))}`);
  closeModal(); renderCurrent();
}

// ---------------------------------------------------------------- pagamentos sem conta
function abrirPendenciasCaixa() {
  const pend = pendenciasCaixa(); if (!pend.length) return;
  const mostra = pend.slice(0, 200);
  const body = `<p class="help mb">Pagamentos feitos depois da data de corte que ainda não estão em conta nenhuma. Confira a conta de cada um e lance.</p>
    <div class="fg"><label for="pdTodas">Todos para a conta</label><select id="pdTodas" onchange="document.querySelectorAll('.pd-conta').forEach(s=>{if([...s.options].some(o=>o.value===this.value))s.value=this.value})"><option value="">—</option>${opcoesContasCaixa('')}</select></div>
    <div class="lista cx-pend-lista">${mostra.map((p, i) => `<div class="item linha linha2"><div class="info"><div class="title">${esc(p.desc)}</div><div class="meta"><span>${fmtDate(p.data)}</span><span>· ${esc(nomeEmpresaDe(p.emp))}</span></div>
        <select class="pd-conta" data-i="${i}" aria-label="Conta de ${esc(p.desc)}">${opcoesContasCaixa((contaPadrao(p.emp) || {}).id, c => p.data >= c.dataSaldo)}</select></div>
      <div class="side"><div class="value ${p.valor > 0 ? 'pos' : 'neg'}">${p.valor > 0 ? '+' : '−'} ${fmtMoney(Math.abs(p.valor))}</div></div></div>`).join('')}</div>
    ${pend.length > mostra.length ? `<p class="help">Mostrando os ${mostra.length} mais antigos; depois de lançar, abra de novo para os outros.</p>` : ''}`;
  Caixa.pendentes = mostra;
  openModal({ title: `${nPlural(pend.length, 'pagamento')} sem conta`, body, footer: `<button class="btn btn-secondary" onclick="closeModal()">Agora não</button><button class="btn btn-primary" onclick="lancarPendencias()">Lançar nas contas</button>` });
}
function lancarPendencias() {
  const lista = Caixa.pendentes || []; let n = 0;
  document.querySelectorAll('.pd-conta').forEach(sel => {
    const p = lista[+sel.dataset.i], rec = p && db[p.col].find(x => x.id === p.id); if (!rec || !sel.value) return;
    comConta(sel.value, () => caixaAoGravar(p.col, rec, null)); n++;
  });
  Caixa.pendentes = null;
  logAct(`Caixa: ${nPlural(n, 'pagamento')} sem conta lançado(s) nas contas`);
  closeModal(); renderCurrent();
  toast('✅', `${nPlural(n, 'pagamento lançado', 'pagamentos lançados')}`, 'O saldo das contas já inclui esses valores.');
}
