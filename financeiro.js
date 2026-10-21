/* ===== Gestão de Loteamento — financeiro (recebíveis, custos, comissões, gráficos) ===== */
'use strict';

// ================================================================ RECEBÍVEIS
/* O filtro dos recebíveis nasce aqui, não dentro da tela. Quem entra direto no painel de
   cobrança — pelo alerta do painel, por exemplo — nunca passou pela lista, e mexer num
   filtro que ainda não existia quebrava o clique em silêncio: a tela parecia travada. */
function filtroRec() {
  return (state.filters.rec = Object.assign({ status: 'aberto', mes: mesAtual(), busca: '' }, state.filters.rec || {}));
}
function mostrarRecebiveis(st) {
  const f = filtroRec();
  if (st) f.status = st;
  switchTab('recebiveis');
}
/* A carteira inteira em aberto: todos os meses e todos os empreendimentos, para a lista
   bater com o número do Início. */
function mostrarCarteira() {
  const f = filtroRec(); f.status = 'aberto'; f.mes = 'all'; state.escopo = '';
  switchTab('recebiveis');
}
function abrirPainelCobranca() { filtroRec(); switchTab('cobranca'); }
function renderRecebiveis() {
  const esc0 = escopoAtual(); const v = $('#av-recebiveis');
  /* A tela abre no mês corrente, não na carteira inteira: um loteamento com trezentas
     parcelas vira uma lista que ninguém lê. O extrato completo de um contrato fica na tela
     da venda, e quem quiser tudo aqui escolhe "Todos os meses". */
  const f = filtroRec();
  const all = recebiveisDo(esc0);
  const grupos = { aberto: r => recStatus(r) !== 'pago', atrasado: r => recStatus(r) === 'atrasado', pago: r => recStatus(r) === 'pago', all: () => true,
    avencer: r => recStatus(r) !== 'pago' && r.vencimento >= todayStr(), atrasadoMes: r => recStatus(r) === 'atrasado' };
  if (!grupos[f.status]) f.status = 'aberto';
  const REC_FAIXA = [['aberto', 'Em aberto', 'a receber'], ['avencer', 'A vencer', 'a receber'], ['atrasado', 'Atrasadas', 'em atraso'], ['pago', 'Pagas', 'recebido'], ['all', 'Todas', 'no total']];
  const meses = [...new Set(all.map(r => monthKey(r.vencimento)).concat([mesAtual()]))].sort();
  /* Atraso não é do mês: parcela vencida em julho continua atrasada em setembro. Nesse
     filtro o mês é ignorado, senão o que a empresa mais precisa ver ficaria escondido. */
  const porMes = r => f.status === 'atrasado' || f.mes === 'all' || monthKey(r.vencimento) === f.mes;
  /* O número de cada filtro conta o que a lista mostraria com ele (no mês escolhido; atraso, de
     todos os meses): o chip e a lista nunca discordam. */
  const list = all.filter(r => grupos[f.status](r) && porMes(r) && (!f.busca || clienteDe(r).toLowerCase().includes(f.busca.toLowerCase())))
    .sort((a, b) => a.vencimento.localeCompare(b.vencimento) || a.numero - b.numero);
  const tot = all.reduce((s, r) => s + recValor(r), 0), pago = all.reduce((s, r) => s + num(r.valorPago), 0);
  const atr = all.filter(r => recStatus(r) === 'atrasado').reduce((s, r) => s + recRestante(r), 0);
  const mesKey = todayStr().slice(0, 7);
  const mes = all.filter(r => monthKey(r.vencimento) === mesKey && recStatus(r) !== 'pago').reduce((s, r) => s + recRestante(r), 0);
  const recMes = all.filter(r => r.dataPagamento && monthKey(r.dataPagamento) === mesKey).reduce((s, r) => s + num(r.valorPago), 0);
  const somaLista = list.reduce((s, r) => s + (f.status === 'pago' ? num(r.valorPago) : recRestante(r)), 0);
  v.innerHTML = `
    ${avisoRemessaHtml(esc0)}
    ${faixaHtml(REC_FAIXA.map(([k, l, sub]) => { const cs = all.filter(r => grupos[k](r) && (k === 'atrasado' || f.mes === 'all' || monthKey(r.vencimento) === f.mes)); return { k, l, n: cs.length, v: (cs.length ? fmtMoneyShort(cs.reduce((t, r) => t + (k === 'pago' ? num(r.valorPago) : k === 'all' ? recValor(r) : recRestante(r)), 0)) + ' ' + sub : '—') + (k === 'atrasado' ? ' · todos os meses' : f.mes !== 'all' ? ` · ${monthLabel(f.mes)}` : ''), ativo: f.status === k, acao: `mostrarRecebiveis('${k}')` }; }), 'Situação das parcelas')}
    <div class="ct-resumo">${f.mes === 'all' ? 'Todos os meses' : `${monthLabel(f.mes)} (atrasadas: de todos os meses)`} · Carteira: <b>${fmtMoney(tot - pago)}</b> a receber de ${fmtMoneyShort(tot)} contratado · ${fmtMoneyShort(pago)} já recebido (${fmtMoneyShort(recMes)} neste mês) · <a href="#" onclick="mostrarCarteira();return false">ver a carteira inteira</a></div>
    <div class="filters">
      ${escopoSelectHtml('renderRecebiveis()')}
      <select aria-label="Mês" onchange="filtroRec().mes=this.value;renderRecebiveis()"><option value="all">Todos os meses</option>${meses.map(m => `<option value="${m}" ${f.mes === m ? 'selected' : ''}>${monthLabel(m)}${m === mesAtual() ? ' (mês atual)' : ''}</option>`).join('')}</select>
      <input type="text" placeholder="Cliente ou lote…" value="${esc(f.busca)}" oninput="aSetFiltro('rec','busca',this.value,renderRecebiveis,this)">
      <button class="btn btn-secondary btn-sm" onclick="exportarRecebiveisCSV()">CSV</button>
      ${contasComLayout().length ? `<button class="btn btn-secondary btn-sm" onclick="abrirGerarCobrancas()"><i class=ico data-i=bank></i>Gerar cobranças <span class="n">${parcelasDoMes(esc0, mesAtual()).filter(r => !registradaNoBanco(r) && !bloqueioRemessa(r)).length}</span></button>
      <button class="btn btn-secondary btn-sm" onclick="abrirRetorno()">Retorno</button>` : ''}
    </div>
    <p class="small muted mb">${nPlural(list.length, 'parcela')} · ${fmtMoney(somaLista)}${f.status === 'avencer' ? ` · a vencer em ${monthLabel(f.mes)}` : f.status === 'atrasadoMes' ? ` · vencidas em ${monthLabel(f.mes)} e não pagas. <a href="#" onclick="mostrarRecebiveis('atrasado');return false">Ver os atrasos de todos os meses</a>` : f.status === 'atrasado' ? ' · atrasos de todos os meses' : f.mes !== 'all' ? ` · ${monthLabel(f.mes)}. O extrato completo de um contrato fica na tela da venda.` : ''}</p>
    ${list.length ? `<div class="lista">${list.map(r => recRowHtml(r)).join('')}</div>`
      : !all.length ? `<div class="empty"><div class="ic"><i class=ico data-i=calendar-blank></i></div><p>Ainda não há parcelas a receber.</p><p>Elas aparecem aqui quando você registra um contrato com parcelas.</p></div>`
      : f.busca ? `<div class="empty"><div class="ic"><i class=ico data-i=magnifying-glass></i></div><p>Nenhuma parcela de “${esc(f.busca)}” nesta lista.</p><p><button class="btn btn-secondary btn-sm" onclick="filtroRec().busca='';renderRecebiveis()">Limpar busca</button></p></div>`
      : f.status === 'atrasado' ? `<div class="empty"><div class="ic"><i class=ico data-i=check-circle></i></div><p>Nenhuma parcela em atraso.</p></div>`
      : `<div class="empty"><div class="ic"><i class=ico data-i=calendar-blank></i></div><p>Nenhuma parcela nesta lista.</p></div>`}`;
}
/* Inadimplência do mês (definição do dono, 15/10), a mesma no Início e na Cobrança: das
   parcelas que vencem no mês, quanto do valor já venceu e não foi pago, sobre o valor de todas
   elas. Só o principal (sem multa e juros) e sem contratos distratados. */
function inadimplenciaDoMes(escopo, mesKey = todayStr().slice(0, 7)) {
  const rs = recebiveisDo(escopo).filter(r => monthKey(r.vencimento) === mesKey);
  const previsto = rs.reduce((s, r) => s + recValor(r), 0);
  const atraso = rs.filter(r => recStatus(r) === 'atrasado').reduce((s, r) => s + recRestante(r), 0);
  return { mesKey, previsto, atraso, pct: previsto ? atraso / previsto * 100 : 0 };
}
function inadimplenciaTexto(im) {
  return im.previsto ? `${fmtNum(im.pct, 1)}% das parcelas do mês em atraso (${fmtMoneyShort(im.atraso)} de ${fmtMoneyShort(im.previsto)})` : 'nenhuma parcela vence este mês';
}
/* As parcelas que vencem no mês, numa barra só: quanto já entrou, quanto ainda vai vencer e
   quanto venceu e não foi pago. É o recorte do mês; o atraso de meses anteriores fica no
   número "Em atraso". Cada trecho abre a lista que o compõe. */
function cobrancasDoMes(escopo, mes = mesAtual()) {
  const hoje = todayStr(), c = { mes, recebido: 0, aVencer: 0, atraso: 0, nRec: 0, nVen: 0, nAtr: 0 };
  recebiveisDo(escopo).filter(r => monthKey(r.vencimento) === mes).forEach(r => {
    const pago = Math.min(num(r.valorPago), recValor(r)), rest = recRestante(r);
    if (pago > 0.005) c.recebido += pago;
    if (rest <= 0.005) c.nRec++;
    else if (r.vencimento < hoje) { c.atraso += rest; c.nAtr++; }
    else { c.aVencer += rest; c.nVen++; }
  });
  c.total = c.recebido + c.aVencer + c.atraso;
  return c;
}
function verParcelasDoMes(st) { const f = filtroRec(); f.status = st; f.mes = mesAtual(); f.busca = ''; switchTab('recebiveis'); }
function barraMesHtml(escopo) {
  const c = cobrancasDoMes(escopo);
  if (c.total < 0.005) return '';
  const pct = v => fmtNum(v / c.total * 100, 1) + '%';
  const seg = (cls, v, rot, st) => v > 0.005 ? `<button type="button" class="bm-seg ${cls}" style="flex-grow:${Math.max(v / c.total, 0.015)}" onclick="verParcelasDoMes('${st}')" title="${rot}: ${fmtMoney(v)}" aria-label="${rot}: ${fmtMoney(v)} (${pct(v)}). Ver as parcelas"></button>` : '';
  const leg = (cls, rot, v, n, st, extra) => `<button type="button" class="bm-leg" onclick="verParcelasDoMes('${st}')"><span class="dot ${cls}"></span><span class="bm-rot">${rot}</span><b>${fmtMoney(v)}</b><span class="bm-n">${n} parcela${n === 1 ? '' : 's'}${extra || ''}</span></button>`;
  return `<div class="card bm"><div class="bm-cab"><h2>Parcelas de ${monthLabel(c.mes)}</h2><span class="bm-total">${fmtMoney(c.total)}</span></div>
    <div class="bm-barra">${seg('rec', c.recebido, 'Recebido', 'pago')}${seg('ven', c.aVencer, 'A vencer', 'avencer')}${seg('atr', c.atraso, 'Em atraso', 'atrasadoMes')}</div>
    <div class="bm-legenda">${leg('rec', 'Recebido', c.recebido, c.nRec, 'pago', ` · ${pct(c.recebido)}`)}${leg('ven', 'A vencer', c.aVencer, c.nVen, 'avencer')}${leg('atr', 'Em atraso no mês', c.atraso, c.nAtr, 'atrasadoMes', ` · ${inadimplenciaTexto(inadimplenciaDoMes(escopo, c.mes)).replace(/ \(.*\)$/, '')}`)}</div></div>`;
}
function clienteDe(r) { const v = getVenda(r.vendaId); if (!v) return ''; return v.cliente.nome + ' ' + imovelLabel(v); }
/* Faixa de situação no alto das listas: cada número é o filtro dele, como em Contratos. */
function faixaHtml(itens, rotulo) {
  return `<div class="st-faixa" style="--n:${itens.length}" role="group" aria-label="${esc(rotulo)}">${itens.map(it => `<button type="button" class="st-item st-${it.k} ${it.ativo ? 'active' : ''} ${+it.n === 0 ? 'st-zero' : ''}" aria-pressed="${!!it.ativo}" onclick="${it.acao}"><span class="st-n">${it.n}</span><span class="st-l">${it.l}</span><span class="st-v">${it.v}</span></button>`).join('')}</div>`;
}
/* Quando vence e o selo, só na exceção: atrasada ou vence em até 5 dias. Paga mostra a data. */
function prazoHtml(venc, st, dataPg, rotAtraso = 'Atrasada') {
  const hoje = todayStr();
  if (st === 'pago') return `<div class="ct-data"><span class="tiny muted">paga em</span> ${fmtDate(dataPg || venc)}</div>`;
  if (!venc) return '<div class="ct-data muted">sem vencimento</div>';
  if (venc < hoje) { const d = daysBetween(venc, hoje); return `<div class="ct-data"><span class="tiny muted">venceu</span> ${fmtDate(venc)}</div><span class="pill atrasado">${rotAtraso} há ${d} dia${d === 1 ? '' : 's'}</span>`; }
  const d = daysBetween(hoje, venc);
  return `<div class="ct-data"><span class="tiny muted">vence</span> ${fmtDate(venc)}</div>${d <= 5 ? `<span class="pill vence">${d === 0 ? 'Vence hoje' : d === 1 ? 'Vence amanhã' : `Vence em ${d} dias`}</span>` : ''}`;
}
/* Uma linha por parcela: quando vence, de quem é (cliente, contrato, imóvel), quanto falta e
   as ações. */
function recRowHtml(r) {
  const v = getVenda(r.vendaId); const st = recStatus(r);
  const rest = recRestante(r), emp = v && !escopoAtual() ? (getLoteamento(v.loteamentoId) || {}).nome || '' : '';
  const im = v ? imovelLabel(v) : '';
  return `<div class="item linha ${st}" data-st="p:${r.id}" onclick="abrirVendaAdmin('${r.vendaId}')">
    <div class="ct-venc">${prazoHtml(r.vencimento, st, r.dataPagamento)}${st === 'parcial' ? '<span class="pill vence">Pago em parte</span>' : ''}</div>
    <div class="info"><div class="title">${v ? esc(v.cliente.nome) : '—'}</div>
      <div class="ct-pessoa"><i class=ico data-i=file-text></i>${v && v.numeroContrato ? `Contrato ${esc(v.numeroContrato)} · ` : ''}${esc(r.descricao)}</div>
      <div class="meta"><span>${esc(im)}${emp && im.indexOf(emp) < 0 ? ` — ${esc(emp)}` : ''}</span>${st === 'pago' && r.forma ? `<span>· ${esc(r.forma)}</span>` : ''}</div></div>
    <div class="side"><div class="value">${fmtMoney(st === 'pago' ? r.valorPago : rest)}</div>
      ${st === 'parcial' ? `<div class="tiny muted">pago ${fmtMoney(r.valorPago)}</div>` : ''}${recCorrecao(r) > 0.005 && st !== 'pago' ? `<div class="tiny muted" title="Correção pelo índice do contrato">base ${fmtMoney(r.valor)} + correção</div>` : ''}${st === 'atrasado' ? `<div class="tiny ct-atraso">atualizado ${fmtMoney(recAtualizado(r))}</div>` : ''}
      <div class="btns" onclick="event.stopPropagation()">${st !== 'pago' && v && v.status !== 'distrato' && pode('financeiro.baixar') ? `<button class="btn-icon ok" title="Registrar pagamento" onclick="abrirPagamento('${r.id}')"><i class=ico data-i=money></i></button>` : ''}${num(r.valorPago) > 0 ? `<button class="btn-icon" title="Recibo" onclick="gerarRecibo('${r.id}')"><i class=ico data-i=receipt></i></button>` : ''}${pode('financeiro.baixar') ? `<button class="btn-icon" title="Editar" onclick="editarRecebivel('${r.id}')"><i class=ico data-i=pencil-simple></i></button>` : ''}</div></div></div>`;
}
/* Parcela atrasada: multa e juros não têm padrão. A pessoa escolhe, a cada pagamento, se cobra
   ou dispensa; a dispensa fica escrita na observação e no histórico. */
function abrirPagamento(id, voltarVendaId) {
  const r = db.recebiveis.find(x => x.id === id); if (!r) return;
  const v = getVenda(r.vendaId); const rest = recRestante(r); const atual = recAtualizado(r);
  const atrasada = atual > rest + 0.01, dias = atrasada ? daysBetween(r.vencimento, todayStr()) : 0;
  const r2 = x => Math.round(x * 100) / 100;
  const encargos = atrasada ? `<fieldset class="pg-encargos" id="pgEncargos"><legend>Multa e juros · ${nPlural(dias, 'dia')} de atraso *</legend>
      <label class="pg-opcao"><input type="radio" name="pgEnc" value="com" onchange="pgEscolherEncargos(${r2(atual)})"><span><b>Cobrar multa e juros</b><span class="tiny muted">${fmtMoney(atual)} · multa de ${fmtNum(db.config.multaPct, 1)}% + juros de ${fmtNum(db.config.jurosMesPct, 2)}% a.m.</span></span></label>
      <label class="pg-opcao"><input type="radio" name="pgEnc" value="sem" onchange="pgEscolherEncargos(${r2(rest)})"><span><b>Sem multa e juros</b><span class="tiny muted">${fmtMoney(rest)} · dispensa ${fmtMoney(atual - rest)}</span></span></label>
    </fieldset>` : '';
  const body = `<p class="small mb"><b>${v ? esc(v.cliente.nome) : ''}</b> · ${esc(r.descricao)} · vencimento ${fmtDate(r.vencimento)}</p>
    <div class="detail-grid"><div><div class="k">Valor da parcela</div><div class="v">${fmtMoney(recValor(r))}${recCorrecao(r) > 0.005 ? `<div class="tiny muted">base ${fmtMoney(r.valor)} + ${fmtMoney(recCorrecao(r))} de correção</div>` : ''}</div></div><div><div class="k">Em aberto</div><div class="v">${fmtMoney(rest)}</div></div></div>
    ${encargos}
    <div class="frow"><div class="fg"><label for="pgValor">Valor recebido (R$) *</label><input type="number" id="pgValor" step="0.01" value="${atrasada ? '' : r2(rest)}" ${atrasada ? 'placeholder="escolha acima"' : ''}></div><div class="fg"><label for="pgData">Data do pagamento *</label><input type="date" id="pgData" value="${todayStr()}"></div></div>
    <div class="fg"><label for="pgForma">Forma</label><select id="pgForma"><option>PIX</option><option>Boleto</option><option>Transferência</option><option>Dinheiro</option><option>Cartão</option><option>Cheque</option><option>Permuta</option></select></div>
    <div class="fg"><label for="pgObs">Observação</label><input type="text" id="pgObs" value="${esc(r.obsPagamento || '')}"></div>`;
  openModal({ title: 'Registrar pagamento', body, footer: `<button class="btn btn-secondary" onclick="${voltarVendaId ? `abrirVendaAdmin('${voltarVendaId}')` : 'closeModal()'}">Cancelar</button><button class="btn btn-outline" onclick="salvarPagamento('${r.id}','${voltarVendaId || ''}',true)">Confirmar e gerar recibo</button><button class="btn btn-success" onclick="salvarPagamento('${r.id}','${voltarVendaId || ''}')">Confirmar</button>` });
}
function pgEscolherEncargos(valor) {
  setVal('pgValor', valor);
  const f = document.getElementById('pgEncargos'); if (f) f.classList.remove('erro');
}
function salvarPagamento(id, voltarVendaId, comRecibo) {
  if (!pode('financeiro.baixar')) { toast('🔒', 'Sem permissão', 'Seu perfil não registra pagamentos.', true); return; }
  const r = db.recebiveis.find(x => x.id === id); if (!r) return;
  const rest = recRestante(r), atual = recAtualizado(r);
  const escolha = (document.querySelector('input[name="pgEnc"]:checked') || {}).value || '';
  if (atual > rest + 0.01 && !escolha) {
    const f = document.getElementById('pgEncargos'); if (f) { f.classList.add('erro'); f.scrollIntoView({ block: 'nearest' }); }
    toast('⚠️', 'Escolha se cobra multa e juros', 'A parcela está atrasada: marque "Cobrar multa e juros" ou "Sem multa e juros" antes de confirmar.', true); return;
  }
  const valor = num(val('pgValor')), data = val('pgData');
  if (!valor) { toast('⚠️', 'Informe o valor recebido', 'Digite quanto entrou, em reais.', true); return; }
  if (!data) { toast('⚠️', 'Informe a data do pagamento', 'Use o calendário do campo "Data do pagamento".', true); return; }
  const forma = val('pgForma');
  const novoPago = num(r.valorPago) + valor;
  // se pagou a mais (juros/multa), registra o valor efetivamente recebido e considera quitada
  const devido = recValor(r);
  const quitou = novoPago >= devido - 0.005;
  const dispensa = escolha === 'sem' && quitou ? Math.round((atual - rest) * 100) / 100 : 0;
  const notaDispensa = dispensa ? `Multa e juros dispensados: ${fmtMoney(dispensa)} (${fmtDate(todayStr())})` : '';
  const obs = [val('pgObs'), notaDispensa].filter(Boolean).join(' · ');
  const upd = Object.assign({}, r, { valorPago: novoPago, dataPagamento: data, forma, obsPagamento: obs,
    valorCorrigido: quitou ? Math.round(Math.max(devido, novoPago) * 100) / 100 : (r.valorCorrigido || null) });
  upsert('recebiveis', upd);
  atualizarStatusVenda(r.vendaId);
  const v = getVenda(r.vendaId);
  logAct(`Pagamento recebido: ${v ? v.cliente.nome : ''} — ${r.descricao} — ${fmtMoney(valor)}${dispensa ? ` — multa e juros dispensados (${fmtMoney(dispensa)})` : escolha === 'com' ? ' — com multa e juros' : ''}`);
  toast('✅', 'Pagamento registrado', `${v ? v.cliente.nome + ' · ' : ''}${r.descricao} · ${fmtMoney(valor)}${quitou ? '' : ' (parcial)'}${dispensa ? ` · multa e juros dispensados (${fmtMoney(dispensa)})` : ''}`);
  if (voltarVendaId) abrirVendaAdmin(voltarVendaId); else closeModal();
  renderCurrent();
  /* O recibo é deste pagamento, não do total já pago na parcela. */
  if (comRecibo) gerarRecibo(id, { valor, data, forma, obs });
}
function estornarPagamento(id, voltarVendaId) {
  const r = db.recebiveis.find(x => x.id === id); if (!r) return;
  if (!confirm('Estornar o pagamento desta parcela? Ela voltará a ficar em aberto.')) return;
  upsert('recebiveis', Object.assign({}, r, { valorPago: 0, dataPagamento: null, forma: null }));
  atualizarStatusVenda(r.vendaId);
  logAct(`Pagamento estornado: ${r.descricao}`);
  if (voltarVendaId) abrirVendaAdmin(voltarVendaId); else closeModal();
  renderCurrent();
}
/* Recibo de pagamento de parcela. Sem "pg", é o recibo do que a parcela já tem pago (para
   reemitir depois); com "pg", é só do pagamento que acabou de ser registrado. Quem recebe e
   assina é o vendedor do contrato; quem paga são os compradores. */
function reciboDados(id, pg) {
  const r = db.recebiveis.find(x => x.id === id); if (!r) return null;
  const v = getVenda(r.vendaId); if (!v) return null;
  pg = pg || { valor: num(r.valorPago), data: r.dataPagamento || todayStr(), forma: r.forma || '', obs: r.obsPagamento || '' };
  const lot = getLoteamento(v.loteamentoId) || {};
  return { r, v, pg, valor: num(pg.valor), resta: recRestante(r), compradores: compradoresNaData(v, pg.data), vendedores: todosVendedores(v),
    cidade: db.config.cidade || lot.cidade || '' };
}
function reciboHtml(d) {
  const { r, v, pg } = d;
  const pessoa = p => `<b>${esc(p.nome)}</b>${p.cpf ? `, ${onlyDigits(p.cpf).length === 14 ? 'CNPJ' : 'CPF'} ${esc(fmtCPF(p.cpf))}` : ''}`;
  const lista = ps => ps.length <= 1 ? ps.map(pessoa).join('') : ps.slice(0, -1).map(pessoa).join('; ') + ' e ' + pessoa(ps[ps.length - 1]);
  const plural = d.vendedores.length > 1;
  return `<h2>Recibo</h2>
    <p style="text-align:right;font-size:1.05rem"><b>${fmtMoney(d.valor)}</b></p>
    <p>${plural ? 'Recebemos' : 'Recebi'} de ${lista(d.compradores)} a importância de <b>${fmtMoney(d.valor)}</b> (${moedaExtenso(d.valor)}), referente ao pagamento da <b>${esc(r.descricao)}</b>, com vencimento em ${fmtDate(r.vencimento)}, do contrato${v.numeroContrato ? ` nº ${esc(v.numeroContrato)}` : ''} de compra e venda de ${esc(imovelLabel(v))}.</p>
    <p>Pagamento feito em ${fmtDate(pg.data)}${pg.forma ? `, por ${esc(pg.forma)}` : ''}.${d.resta > 0.005 ? ` Pagamento parcial: permanece em aberto nesta parcela o valor de ${fmtMoney(d.resta)}.` : ''}</p>
    ${pg.obs ? `<p>${esc(pg.obs)}</p>` : ''}
    <p>Pelo que ${plural ? 'damos' : 'dou'} plena quitação do valor recebido.</p>
    <p style="text-align:right;margin-top:18px">${esc(d.cidade ? d.cidade + ', ' : '')}${dataExtenso(pg.data)}.</p>
    ${d.vendedores.map(p => `<p style="text-align:center;margin-top:40px">______________________________________<br>${esc(p.nome)}${p.cpf ? `<br>${onlyDigits(p.cpf).length === 14 ? 'CNPJ' : 'CPF'} ${esc(fmtCPF(p.cpf))}` : ''}</p>`).join('')}`;
}
function gerarRecibo(id, pg) {
  const d = reciboDados(id, pg); if (!d) return;
  if (!(d.valor > 0)) { toast('⚠️', 'Parcela sem pagamento', 'Registre o pagamento antes de gerar o recibo.', true); return; }
  const c = d.v.cliente || {};
  const texto = `Olá, ${c.nome || ''}! Confirmamos o recebimento de ${fmtMoney(d.valor)} referente à ${d.r.descricao}${d.v.numeroContrato ? ` do contrato nº ${d.v.numeroContrato}` : ''}, pago em ${fmtDate(d.pg.data)}. Obrigado!`;
  docPreview({ titulo: 'Recibo de pagamento', html: reciboHtml(d), arquivo: `Recibo ${d.r.descricao} ${c.nome || ''}`.replace(/[\\/:*?"'<>|]/g, '-'),
    whatsTexto: c.telefone ? waLink(c.telefone, texto) : '' });
}
function editarRecebivel(id, voltarVendaId) {
  const r = db.recebiveis.find(x => x.id === id); if (!r) return;
  const body = `<div class="fg"><label>Descrição</label><input type="text" id="erDesc" value="${esc(r.descricao)}"></div>
    <div class="frow"><div class="fg"><label>Vencimento</label><input type="date" id="erVenc" value="${r.vencimento}"></div><div class="fg"><label>Valor base (R$)</label><input type="number" id="erValor" step="0.01" value="${r.valor}">${recCorrecao(r) > 0.005 ? `<div class="hint">Com a correção do contrato: ${fmtMoney(recValor(r))}</div>` : ''}</div></div>
    <div class="frow"><div class="fg"><label>Valor pago (R$)</label><input type="number" id="erPago" step="0.01" value="${r.valorPago || 0}"></div><div class="fg"><label>Data do pagamento</label><input type="date" id="erData" value="${r.dataPagamento || ''}"></div></div>`;
  openModal({ title: 'Editar parcela', body, footer: `<button class="btn btn-outline-danger" onclick="excluirRecebivel('${r.id}','${voltarVendaId || ''}')">Excluir</button><button class="btn btn-secondary" onclick="${voltarVendaId ? `abrirVendaAdmin('${voltarVendaId}')` : 'closeModal()'}">Cancelar</button><button class="btn btn-primary" onclick="salvarRecebivel('${r.id}','${voltarVendaId || ''}')">Salvar</button>` });
}
function salvarRecebivel(id, voltarVendaId) {
  const r = db.recebiveis.find(x => x.id === id); if (!r) return;
  upsert('recebiveis', Object.assign({}, r, { descricao: val('erDesc') || r.descricao, vencimento: val('erVenc') || r.vencimento, valor: num(val('erValor')), valorPago: num(val('erPago')), dataPagamento: val('erData') || null }));
  atualizarStatusVenda(r.vendaId);
  if (voltarVendaId) abrirVendaAdmin(voltarVendaId); else closeModal();
  renderCurrent(); toast('✅', 'Parcela atualizada', '');
}
function excluirRecebivel(id, voltarVendaId) {
  const r = db.recebiveis.find(x => x.id === id); if (!r) return;
  if (registradaNoBanco(r) && recStatus(r) !== 'pago') { toast('🏦', 'Esta parcela está registrada no banco', 'Zere o valor ou marque como paga para gerar a baixa na remessa; depois exclua.', true); return; }
  if (!confirm('Excluir esta parcela do cronograma?')) return;
  removeRec('recebiveis', id); atualizarStatusVenda(r.vendaId);
  if (voltarVendaId) abrirVendaAdmin(voltarVendaId); else closeModal();
  renderCurrent();
}
function exportarRecebiveisCSV() {
  const esc0 = escopoAtual(); const rows = [['Cliente', 'Imóvel', 'Parcela', 'Vencimento', 'Valor', 'Pago', 'Data pagamento', 'Forma', 'Status']];
  recebiveisDo(esc0).sort((a, b) => a.vencimento.localeCompare(b.vencimento)).forEach(r => { const v = getVenda(r.vendaId); rows.push([v ? v.cliente.nome : '', v ? imovelShort(v) : '', r.descricao, fmtDate(r.vencimento), fmtNum(recValor(r)), fmtNum(r.valorPago), r.dataPagamento ? fmtDate(r.dataPagamento) : '', r.forma || '', statusLabel(recStatus(r))]); });
  download(`recebiveis-${todayStr()}.csv`, toCSV(rows), 'text/csv');
}

// ================================================================ EXTRATO
function extratoTexto(v) {
  const lot = getLoteamento(v.loteamentoId); const r = vendaResumo(v);
  const abertas = recebiveisDe(v.id).filter(x => recStatus(x) !== 'pago');
  let t = `*${lot ? lot.nome : ''}* — ${imovelLabel(v)}\nCliente: ${v.cliente.nome}\nValor: ${fmtMoney(v.valorTotal)} · Pago: ${fmtMoney(r.pago)} · Saldo: ${fmtMoney(r.restante)}`;
  if (abertas.length) t += `\n\nPróximas parcelas:\n` + abertas.slice(0, 6).map(x => `• ${x.descricao} — ${fmtDate(x.vencimento)} — ${fmtMoney(recRestante(x))}${recStatus(x) === 'atrasado' ? ' (em atraso)' : ''}`).join('\n');
  return t;
}
function imprimirExtrato(vendaId) {
  const v = getVenda(vendaId); if (!v) return; const lot = getLoteamento(v.loteamentoId); const r = vendaResumo(v);
  const recs = recebiveisDe(v.id);
  $('#printArea').innerHTML = `
    <h1>${esc(db.config.empresa || lot.nome)}</h1><div>${esc(lot.nome)}${lot.cidade ? ' · ' + esc(lot.cidade) : ''}</div>
    <h2>Extrato de pagamentos — ${esc(imovelLabel(v))}</h2>
    <table><tr><th>Cliente</th><td>${esc(v.cliente.nome)}</td><th>CPF/CNPJ</th><td>${esc(fmtCPF(v.cliente.cpf))}</td></tr>
    <tr><th>Data da venda</th><td>${fmtDate(v.dataVenda)}</td><th>Valor</th><td>${fmtMoney(v.valorTotal)}</td></tr>
    <tr><th>Recebido</th><td>${fmtMoney(r.pago)}</td><th>Saldo devedor</th><td>${fmtMoney(r.restante)}</td></tr>
    <tr><th>Corretor</th><td>${esc(v.corretor.nome)}</td><th>Emitido em</th><td>${fmtDate(todayStr())}</td></tr></table>
    <h2>Parcelas</h2>
    <table><thead><tr><th>Parcela</th><th>Vencimento</th><th class="num">Valor</th><th class="num">Pago</th><th>Data pgto</th><th>Forma</th><th>Situação</th></tr></thead>
    <tbody>${recs.map(x => `<tr><td>${esc(x.descricao)}</td><td>${fmtDate(x.vencimento)}</td><td class="num">${fmtMoney(recValor(x))}</td><td class="num">${x.valorPago ? fmtMoney(x.valorPago) : ''}</td><td>${x.dataPagamento ? fmtDate(x.dataPagamento) : ''}</td><td>${esc(x.forma || '')}</td><td>${statusLabel(recStatus(x))}</td></tr>`).join('')}</tbody>
    <tfoot><tr><th colspan="2">Total</th><th class="num">${fmtMoney(r.total)}</th><th class="num">${fmtMoney(r.pago)}</th><th colspan="3"></th></tr></tfoot></table>
    ${(v.cessoes || []).length ? `<p style="margin-top:10px"><b>Cessão de direitos:</b> ${(v.cessoes || []).map(c => `em ${fmtDate(c.data)}, de ${esc(nomesDasPartes(c.cedentes))} para ${esc(nomesDasPartes(c.cessionarios))}`).join('; ')}. Os pagamentos anteriores a cada cessão foram feitos pelos cedentes.</p>` : ''}
    ${v.obs ? `<p style="margin-top:10px"><b>Observações:</b> ${esc(v.obs)}</p>` : ''}`;
  window.print();
}

// ================================================================ CUSTOS
function aSetFiltroCusto(st) { state.filters.custos = Object.assign(state.filters.custos || {}, { status: st }); switchTab('custos'); }
/* Mesma tela em dois lugares. Dentro do empreendimento é a obra dele, com o orçamento. No
   menu Financeiro › A pagar é a empresa inteira, com o filtro de empreendimento em cima e o
   orçado × realizado só quando um empreendimento está escolhido — somar orçamentos de
   obras diferentes não diz nada. */
function renderCustos(alvo) {
  const global = state.tab === 'custos';
  const escopo = global ? escopoAtual() : curLot().id;
  const lot = escopo ? getLoteamento(escopo) : null;
  const v = alvo || alvoDoEmp('av-custos');
  const f = state.filters.custos = state.filters.custos || { status: 'all', cat: 'all', mes: 'all', busca: '' };
  /* Na lista da empresa (sem empreendimento escolhido): todas, só as da empresa ou só as dos
     empreendimentos. Escolhido um empreendimento, valem só as dele. */
  const vinc = global && !escopo ? (f.vinc || 'todos') : 'todos';
  /* Centro de custo da empresa (Administração, Comercial…): só faz sentido sem empreendimento */
  const centros = centrosCusto();
  const centro = global && !escopo && vinc !== 'emps' && centros.length && (f.centro === CENTRO_ADM || getCentro(f.centro)) ? f.centro : '';
  const doEscopo = custosDo(escopo);
  const all = (vinc === 'empresa' ? doEscopo.filter(c => !c.loteamentoId) : vinc === 'emps' ? doEscopo.filter(c => c.loteamentoId) : doEscopo)
    .filter(c => !centro || centroDoCusto(c) === centro);
  const meses = [...new Set(all.map(c => monthKey(c.dataCompetencia)))].sort().reverse();
  const list = all.filter(c => (f.status === 'all' || custoStatus(c) === f.status) && (f.cat === 'all' || c.categoriaId === f.cat) && (f.mes === 'all' || monthKey(c.dataCompetencia) === f.mes) && (!f.busca || (c.descricao + ' ' + (c.fornecedor || '')).toLowerCase().includes(f.busca.toLowerCase())))
    .sort((a, b) => (b.dataCompetencia || '').localeCompare(a.dataCompetencia || ''));
  const tot = all.reduce((s, c) => s + num(c.valor), 0), pago = all.filter(c => c.status === 'pago').reduce((s, c) => s + num(c.valor), 0);
  const atr = all.filter(c => custoStatus(c) === 'atrasado').reduce((s, c) => s + num(c.valor), 0);
  const prox = all.filter(c => c.status !== 'pago' && c.vencimento && c.vencimento >= todayStr() && daysBetween(todayStr(), c.vencimento) <= 30).reduce((s, c) => s + num(c.valor), 0);
  const orcTotal = lot ? Object.values(lot.orcamento || {}).reduce((s, x) => s + num(x), 0) : 0;
  const porCat = {}; all.forEach(c => { porCat[c.categoriaId] = (porCat[c.categoriaId] || 0) + num(c.valor); });
  const catData = Object.entries(porCat).map(([id, value]) => { const c = getCategoria(id); return { label: c ? c.nome : 'Sem categoria', color: c ? c.cor : '#94a3b8', value }; }).sort((a, b) => b.value - a.value);
  /* No A pagar da empresa a lista vem primeiro (é o que se usa todo dia); o gráfico e o
     orçado ficam embaixo. Dentro do empreendimento a obra começa pelo orçamento. */
  const graficosCustos = `    <div class="grid2">
      <div class="card"><h2>Custos por categoria</h2><canvas class="chart" id="chartCustos" height="190"></canvas><div class="legend-list" id="chartCustosLegend"></div></div>
      ${!lot ? `<div class="card"><h2>Orçado × realizado</h2><p class="help">Escolha um empreendimento no filtro acima para comparar com o orçamento da obra dele.</p></div>` : `<div class="card"><h2>Orçado × realizado <span class="h-actions"><button class="btn btn-secondary btn-sm" onclick="setCurLotSilencioso('${lot.id}');abrirOrcamentoForm()" title="Editar" aria-label="Editar"><i class=ico data-i=pencil-simple></i></button></span></h2>
        ${db.categorias.filter(c => num((lot.orcamento || {})[c.id]) > 0).map(c => { const o = lot.orcamento[c.id]; const real = porCat[c.id] || 0; const pct = Math.round(real / o * 100); return `<div class="mb"><div class="row-between small"><span><span class="dot" style="background:${c.cor}"></span> ${esc(c.nome)}</span><span class="muted">${fmtMoneyShort(real)} / ${fmtMoneyShort(o)} · ${pct}%</span></div><div class="progress"><div class="${pct > 100 ? 'over' : pct >= 90 ? 'warn' : ''}" style="width:${Math.min(100, pct)}%"></div></div></div>`; }).join('') || '<p class="help">Defina o orçamento por categoria para acompanhar aqui.</p>'}</div>`}
    </div>`;
  /* No celular os filtros ficam atrás do botão "Filtros (n)": o número diz quantos estão ligados. */
  const nFiltros = [global && escopo, vinc !== 'todos', centro, f.cat !== 'all', f.mes !== 'all'].filter(Boolean).length;
  const CUSTO_FAIXA = [['all', 'Todas', c => true], ['pendente', 'A vencer', c => custoStatus(c) === 'pendente'], ['atrasado', 'Vencidas', c => custoStatus(c) === 'atrasado'], ['pago', 'Pagas', c => c.status === 'pago']];
  v.innerHTML = `
    ${faixaHtml(CUSTO_FAIXA.map(([k, l, fn]) => { const cs = all.filter(fn); return { k, l, n: cs.length, v: cs.length ? fmtMoneyShort(cs.reduce((t, c) => t + num(c.valor), 0)) : '—', ativo: f.status === k, acao: `state.filters.custos.status='${k}';renderCustos()` }; }), 'Situação das contas')}
    <div class="ct-resumo">Total <b>${fmtMoney(tot)}</b>${orcTotal ? ` · ${Math.round(tot / orcTotal * 100)}% do orçamento (${fmtMoneyShort(orcTotal)})` : ''} · em aberto ${fmtMoney(tot - pago)}${prox ? ` · ${fmtMoneyShort(prox)} vencem nos próximos 30 dias` : ''}</div>
    ${global ? '' : graficosCustos}
    <div class="filtros-bloco">
      <div class="filtros-mais ${f.abertos ? 'aberto' : ''}" id="custosFiltros">
        ${global ? `<div class="filters">${escopoSelectHtml('renderCustos()')}</div>` : ''}
        ${global && !escopo ? `<div class="chips chips-vinc" role="group" aria-label="De quem é a despesa">${[['todos', 'Todas as despesas'], ['empresa', 'Só da empresa'], ['emps', 'Só de empreendimentos']].map(([k, l]) => `<div class="chip ${vinc === k ? 'active' : ''}" onclick="state.filters.custos.vinc='${k}';renderCustos()">${l}<span class="n">${k === 'todos' ? doEscopo.length : k === 'empresa' ? doEscopo.filter(c => !c.loteamentoId).length : doEscopo.filter(c => c.loteamentoId).length}</span></div>`).join('')}</div>` : ''}
        <div class="filters">
          ${global && !escopo && vinc !== 'emps' && centros.length ? `<select aria-label="Centro de custo" onchange="state.filters.custos.centro=this.value;renderCustos()"><option value="">Todos os centros de custo</option>${[[CENTRO_ADM, 'Administração']].concat(centros.map(c => [c.id, c.nome])).map(([k, l]) => `<option value="${esc(k)}" ${centro === k ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>` : ''}
          <select aria-label="Conta do plano de contas" onchange="state.filters.custos.cat=this.value;renderCustos()"><option value="all">Todas as contas</option>${opcoesContasHtml(f.cat, db.categorias)}</select>
          <select aria-label="Mês" onchange="state.filters.custos.mes=this.value;renderCustos()"><option value="all">Todos os meses</option>${meses.map(m => `<option value="${m}" ${f.mes === m ? 'selected' : ''}>${monthLabel(m)}</option>`).join('')}</select>
        </div>
      </div>
      <div class="filters filtros-linha">
          <input type="text" placeholder="Descrição ou fornecedor…" value="${esc(f.busca)}" oninput="aSetFiltro('custos','busca',this.value,renderCustos,this)">
        <button type="button" class="btn btn-secondary btn-sm filtros-btn" aria-controls="custosFiltros" aria-expanded="${!!f.abertos}" onclick="state.filters.custos.abertos=!state.filters.custos.abertos;renderCustos()">Filtros${nFiltros ? ` (${nFiltros})` : ''}<i class=ico data-i=caret-down></i></button>
          <button class="btn btn-primary btn-sm" onclick="abrirCustoForm(null, { emp: ${escopo ? `'${escopo}'` : vinc === 'emps' ? `'${(curLot() || {}).id || ''}'` : 'null'}${centro && centro !== CENTRO_ADM ? `, centro: '${esc(centro)}'` : ''} })"><i class=ico data-i=plus></i>Lançar</button>
      </div>
    </div>
    <p class="small muted mb">${nPlural(list.length, 'lançamento')} · ${fmtMoney(list.reduce((s, c) => s + num(c.valor), 0))}</p>
    ${list.length ? `<div class="lista">${list.map(c => custoRowHtml(c)).join('')}</div>` : `<div class="empty"><div class="ic"><i class=ico data-i=receipt></i></div><p>${vinc === 'empresa' ? 'Nenhuma despesa da empresa lançada.<br>Toque em <b>Lançar</b> para registrar aluguel, salários, contador…' : 'Nenhum custo lançado.<br>Toque em <b>Lançar</b> para registrar despesas da obra, documentação, marketing…'}</p></div>`}
    ${global ? graficosCustos : ''}`;
  drawDonut($('#chartCustos'), $('#chartCustosLegend'), catData, true);
}
/* Uma linha por conta: quando vence (ou quando foi paga), o que é e de quem, a conta do plano e
   o fornecedor, o valor e o botão de pagar. */
function custoRowHtml(c) {
  const st = custoStatus(c); const cat = getCategoria(c.categoriaId);
  /* De quem é: na lista da empresa aparece sempre; dentro do empreendimento, só o imóvel */
  const vc = vinculoDoCusto(c), naEmpresa = state.tab === 'custos' && !escopoAtual();
  const rotulo = naEmpresa ? vc.rotulo : vc.tipo === 'imovel' ? vc.rotulo.split(' · ').pop() : '';
  return `<div class="item linha ${st}" data-vinculo="${vc.tipo}" onclick="abrirCustoForm('${c.id}')">
    <div class="ct-venc">${prazoHtml(c.vencimento, st, c.dataPagamento, 'Vencida')}</div>
    <div class="info"><div class="title">${esc(c.descricao)}${rotulo ? ` <span class="vinc ${vc.tipo}">${vc.tipo === 'empresa' ? '<i class=ico data-i=buildings></i>' : ''}${esc(rotulo)}</span>` : ''}</div>
      <div class="meta"><span class="badge neutral badge-cat"><span class="dot" style="background:${cat ? cat.cor : '#94a3b8'}"></span>${cat ? esc(cat.nome) : 'Sem categoria'}</span>${c.fornecedor ? `<span>· ${esc(c.fornecedor)}</span>` : ''}<span>· competência ${monthLabel(monthKey(c.dataCompetencia))}</span>${c.formaPagamento && st === 'pago' ? `<span>· ${esc(c.formaPagamento)}</span>` : ''}</div></div>
    <div class="side"><div class="value">${fmtMoney(c.valor)}</div>
      <div class="btns" onclick="event.stopPropagation()">${st !== 'pago' && pode('custos.editar') ? `<button class="btn-icon ok" title="Marcar como pago" onclick="pagarCusto('${c.id}')"><i class=ico data-i=money></i></button>` : ''}</div></div></div>`;
}
/* Mantido para chamadas antigas: agora o formulário já pergunta de quem é a despesa */
function novoCustoEscolhendoEmp() { abrirCustoForm(null, { emp: escopoAtual() || null }); }
/* De quem é a despesa: empresa, um empreendimento ou um imóvel dele (lote do loteamento ou
   imóvel avulso de um contrato da carteira). "imovel" vale 'l:<lote>' ou 'v:<contrato>'. */
function opcoesImovelCusto(empId, atual) {
  const emp = getLoteamento(empId); if (!emp) return '';
  const geral = `<option value="">— Despesa geral ${ehCarteira(emp) ? 'da carteira' : 'do empreendimento'} —</option>`;
  const lotes = lotesDo(emp.id).map(l => `<option value="l:${l.id}" ${atual === 'l:' + l.id ? 'selected' : ''}>${esc(loteLabel(l))}</option>`).join('');
  const contratos = ehCarteira(emp) ? db.vendas.filter(v => v.loteamentoId === emp.id && v.status !== 'distrato').map(v => `<option value="v:${v.id}" ${atual === 'v:' + v.id ? 'selected' : ''}>${esc(imovelShort(v) || imovelLabel(v))} · ${esc(v.cliente.nome || '')}</option>`).join('') : '';
  return geral + lotes + contratos;
}
/* O valor do campo "De quem é": vazio (Administração), 'c:<centro>' ou o id do empreendimento */
function cuEmpDoCampo() { const v = val('cuEmp'); return v && !v.startsWith('c:') ? v : ''; }
function cuTrocarVinculo() {
  const emp = cuEmpDoCampo(), box = document.getElementById('cuImovelBox');
  if (!box) return;
  box.style.display = emp ? '' : 'none';
  const sel = document.getElementById('cuImovel'); if (sel) sel.innerHTML = opcoesImovelCusto(emp, '');
}
function abrirCustoForm(id, opc = {}) {
  const c = id ? db.custos.find(x => x.id === id) : null;
  /* empreendimento inicial: o da despesa; ao lançar, o pedido (null = empresa); sem pedido, o atual */
  const empIni = c ? (c.loteamentoId || '') : ('emp' in opc ? (opc.emp || '') : (curLot() || {}).id || '');
  /* Despesa da empresa: Administração ou um centro de custo criado pela empresa */
  const centroIni = c && !c.loteamentoId && c.centroId && getCentro(c.centroId) ? c.centroId : (!c && opc.centro) || '';
  const centros = centrosCusto().filter(x => x.ativo !== false || x.id === centroIni);
  const imovelIni = c ? (c.loteId ? 'l:' + c.loteId : c.vendaId ? 'v:' + c.vendaId : '') : (opc.imovel || '');
  const fornecedores = [...new Set(db.custos.map(x => x.fornecedor).filter(Boolean))].sort(naturalCmp);
  const optEmpresa = `<option value="" ${!empIni && !centroIni ? 'selected' : ''}>${centros.length ? 'Empresa · Administração' : 'Empresa (escritório, pessoal, contador…)'}</option>`
    + centros.map(x => `<option value="c:${esc(x.id)}" ${!empIni && centroIni === x.id ? 'selected' : ''}>Empresa · ${esc(x.nome)}</option>`).join('');
  const optEmps = db.loteamentos.map(l => `<option value="${l.id}" ${empIni === l.id ? 'selected' : ''}>${esc(l.nome)}</option>`).join('');
  const body = `<div class="frow"><div class="fg"><label for="cuEmp">De quem é a despesa (centro de custo) *</label><select id="cuEmp" onchange="cuTrocarVinculo()">${centros.length ? `<optgroup label="Empresa">${optEmpresa}</optgroup>${optEmps ? `<optgroup label="Empreendimentos">${optEmps}</optgroup>` : ''}` : optEmpresa + optEmps}</select></div>
      <div class="fg" id="cuImovelBox" style="${empIni ? '' : 'display:none'}"><label>Imóvel (opcional)</label><select id="cuImovel">${empIni ? opcoesImovelCusto(empIni, imovelIni) : ''}</select></div></div>
    <div class="fg"><label>Descrição *</label><input type="text" id="cuDesc" value="${esc(c ? c.descricao : '')}" placeholder="Ex.: Pavimentação — 2ª medição"></div>
    <div class="frow"><div class="fg"><label for="cuCat">Conta (plano de contas) *</label><select id="cuCat">${opcoesContasHtml(c ? c.categoriaId : (categoriasParaLancar()[0] || db.categorias[0] || {}).id)}</select></div><div class="fg"><label>Fornecedor</label><input type="text" id="cuForn" list="fornList" value="${esc(c ? c.fornecedor || '' : '')}"><datalist id="fornList">${fornecedores.map(f => `<option value="${esc(f)}">`).join('')}</datalist></div></div>
    <div class="frow"><div class="fg"><label>Valor (R$) *</label><input type="number" id="cuValor" step="0.01" value="${c ? c.valor : ''}"></div><div class="fg"><label>Forma de pagamento</label><select id="cuForma">${['PIX', 'Boleto', 'Transferência', 'Dinheiro', 'Cartão', 'Cheque', 'Permuta'].map(o => `<option ${c && c.formaPagamento === o ? 'selected' : ''}>${o}</option>`).join('')}</select></div></div>
    <div class="frow"><div class="fg"><label>Competência *</label><input type="date" id="cuComp" value="${c ? c.dataCompetencia : todayStr()}"></div><div class="fg"><label>Vencimento</label><input type="date" id="cuVenc" value="${c ? c.vencimento || '' : ''}"></div></div>
    <div class="frow"><div class="fg"><label>Status</label><select id="cuStatus" onchange="document.getElementById('cuDataPg').parentElement.style.display=this.value==='pago'?'':'none'"><option value="pendente" ${!c || c.status !== 'pago' ? 'selected' : ''}>A pagar</option><option value="pago" ${c && c.status === 'pago' ? 'selected' : ''}>Pago</option></select></div><div class="fg" style="${c && c.status === 'pago' ? '' : 'display:none'}"><label>Data do pagamento</label><input type="date" id="cuDataPg" value="${c ? c.dataPagamento || todayStr() : todayStr()}"></div></div>
    <div class="fg"><label>Observações</label><textarea id="cuObs">${esc(c ? c.obs || '' : '')}</textarea></div>`;
  openModal({ title: c ? 'Editar despesa' : 'Lançar despesa', body, footer: `${c ? `<button class="btn btn-outline-danger" onclick="excluirCusto('${c.id}')">Excluir</button>` : ''}<button class="btn btn-secondary" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" onclick="salvarCusto('${c ? c.id : ''}')">Salvar</button>` });
  focarSeLivre('cuDesc');
}
function salvarCusto(id) {
  const prev = id ? db.custos.find(x => x.id === id) : null;
  if (!val('cuDesc') || !num(val('cuValor')) || !val('cuComp')) { toast('⚠️', 'Preencha descrição, valor e competência', '', true); return; }
  const st = val('cuStatus');
  const emp = cuEmpDoCampo() || null, imv = emp ? val('cuImovel') : '';
  const campo = val('cuEmp') || '', centro = !emp && campo.startsWith('c:') ? campo.slice(2) : null;
  const rec = Object.assign({}, prev || { id: genId(), criadoEm: new Date().toISOString() }, { loteamentoId: emp, loteId: imv.startsWith('l:') ? imv.slice(2) : null, vendaId: imv.startsWith('v:') ? imv.slice(2) : null, descricao: val('cuDesc'), categoriaId: val('cuCat'), fornecedor: val('cuForn'), valor: num(val('cuValor')), formaPagamento: val('cuForma'), dataCompetencia: val('cuComp'), vencimento: val('cuVenc') || null, status: st, dataPagamento: st === 'pago' ? (val('cuDataPg') || todayStr()) : null, obs: val('cuObs') });
  /* O centro só vai para o banco quando existe: quem ainda não rodou o schema novo continua
     lançando normalmente as despesas sem centro. */
  if (centro) rec.centroId = centro; else if (prev && prev.centroId) rec.centroId = null; else delete rec.centroId;
  upsert('custos', rec);
  if (!prev) logAct(`Despesa lançada: ${rec.descricao} — ${fmtMoney(rec.valor)} (${vinculoDoCusto(rec).rotulo})`);
  closeModal(); renderCurrent(); toast('✅', 'Despesa salva', `${rec.descricao} · ${vinculoDoCusto(rec).rotulo}`);
}
/* Pagar uma conta: a mesma janela do recebimento de parcela (data, forma e observação), com o
   valor e o vencimento à vista; depois, "Desfazer" no aviso volta a conta para em aberto. */
function pagarCusto(id) {
  const c = db.custos.find(x => x.id === id); if (!c) return;
  const cat = getCategoria(c.categoriaId);
  const body = `<p class="small mb"><b>${esc(c.descricao)}</b>${c.fornecedor ? ` · ${esc(c.fornecedor)}` : ''}${cat ? ` · ${esc(cat.nome)}` : ''}</p>
    <div class="detail-grid"><div><div class="k">Valor</div><div class="v">${fmtMoney(c.valor)}</div></div><div><div class="k">Vencimento</div><div class="v">${c.vencimento ? fmtDate(c.vencimento) : '—'}</div></div></div>
    <div class="frow"><div class="fg"><label for="cpData">Data do pagamento *</label><input type="date" id="cpData" value="${todayStr()}" max="${todayStr()}"></div><div class="fg"><label for="cpForma">Forma</label><select id="cpForma">${['PIX', 'Boleto', 'Transferência', 'Dinheiro', 'Cartão', 'Cheque', 'Permuta'].map(o => `<option ${c.formaPagamento === o ? 'selected' : ''}>${o}</option>`).join('')}</select></div></div>
    <div class="fg"><label for="cpObs">Observação</label><input type="text" id="cpObs" value="${esc(c.obs || '')}"></div>`;
  openModal({ title: 'Pagar conta', body, footer: `<button class="btn btn-secondary" onclick="closeModal()">Cancelar</button><button class="btn btn-success" onclick="salvarPagamentoCusto('${c.id}')">Confirmar pagamento</button>` });
}
function salvarPagamentoCusto(id) {
  if (!pode('custos.editar')) { toast('🔒', 'Sem permissão', 'Seu perfil não paga contas.', true); return; }
  const c = db.custos.find(x => x.id === id); if (!c) return;
  const data = val('cpData');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data || '')) { toast('⚠️', 'Informe a data do pagamento', 'Use o calendário do campo "Data do pagamento".', true); return; }
  if (data > todayStr()) { toast('⚠️', 'Data no futuro', 'Uma conta só é paga hoje ou antes. Para agendar, deixe em aberto com o vencimento.', true); return; }
  const antes = Object.assign({}, c);
  upsert('custos', Object.assign({}, c, { status: 'pago', dataPagamento: data, formaPagamento: val('cpForma'), obs: val('cpObs') }));
  logAct(`Custo pago: ${c.descricao} — ${fmtMoney(c.valor)}`);
  closeModal(); renderCurrent();
  toast('✅', 'Conta paga', `${c.descricao} · ${fmtMoney(c.valor)} em ${fmtDate(data)}`, false, { rotulo: 'Desfazer', fn: () => {
    upsert('custos', antes); logAct(`Pagamento desfeito: ${c.descricao}`); renderCurrent(); toast('↩️', 'Pagamento desfeito', `${c.descricao} voltou para em aberto.`);
  } });
}
function excluirCusto(id) {
  const c = db.custos.find(x => x.id === id); if (!c) return;
  if (!confirm(`Excluir "${c.descricao}"?`)) return;
  removeRec('custos', id); closeModal(); renderCurrent();
}
function exportarCustosCSV() {
  const lot = curLot(); const rows = [['Descrição', 'Categoria', 'Fornecedor', 'Valor', 'Competência', 'Vencimento', 'Status', 'Pagamento', 'Forma', 'Lote', 'Obs']];
  custosDo(lot.id).sort((a, b) => a.dataCompetencia.localeCompare(b.dataCompetencia)).forEach(c => { const cat = getCategoria(c.categoriaId); const l = c.loteId && getLote(c.loteId); rows.push([c.descricao, cat ? cat.nome : '', c.fornecedor || '', fmtNum(c.valor), fmtDate(c.dataCompetencia), c.vencimento ? fmtDate(c.vencimento) : '', statusLabel(custoStatus(c)), c.dataPagamento ? fmtDate(c.dataPagamento) : '', c.formaPagamento || '', l ? loteShort(l) : '', c.obs || '']); });
  download(`custos-${todayStr()}.csv`, toCSV(rows), 'text/csv');
}

// ================================================================ COMISSÕES
function renderComissoes(v, f) {
  const lot = curLot();
  const vendas = db.vendas.filter(x => x.loteamentoId === lot.id && x.status !== 'distrato').sort((a, b) => (b.dataVenda || '').localeCompare(a.dataVenda || ''));
  const tot = vendas.reduce((s, x) => s + num(x.comissaoValor), 0), pago = vendas.filter(x => x.comissaoPaga).reduce((s, x) => s + num(x.comissaoValor), 0);
  const porCorretor = {};
  vendas.forEach(x => { const k = x.corretor.nome || 'Venda direta'; porCorretor[k] = porCorretor[k] || { n: 0, tot: 0, pago: 0 }; porCorretor[k].n++; porCorretor[k].tot += num(x.comissaoValor); if (x.comissaoPaga) porCorretor[k].pago += num(x.comissaoValor); });
  v.innerHTML = `
    ${tituloTela('Contratos')}<div class="subtabs"><div class="chip" onclick="state.filters.avendas.sub='vendas';renderAVendas()">Contratos</div><div class="chip active">Comissões</div></div>
    <div class="kpi-grid cols3"><div class="kpi c-primary"><div class="lbl">Total de comissões</div><div class="val">${fmtMoneyShort(tot)}</div></div><div class="kpi c-green"><div class="lbl">Pagas</div><div class="val">${fmtMoneyShort(pago)}</div></div><div class="kpi c-amber"><div class="lbl">A pagar</div><div class="val">${fmtMoney(tot - pago)}</div></div></div>
    <div class="card"><h2>Por corretor</h2><div class="table-wrap"><table class="tbl"><thead><tr><th>Corretor</th><th class="num">Vendas</th><th class="num">Comissões</th><th class="num">Pagas</th><th class="num">A pagar</th></tr></thead><tbody>${Object.entries(porCorretor).sort((a, b) => b[1].tot - a[1].tot).map(([k, s]) => `<tr><td>${esc(k)}</td><td class="num">${s.n}</td><td class="num">${fmtMoney(s.tot)}</td><td class="num">${fmtMoney(s.pago)}</td><td class="num"><b>${fmtMoney(s.tot - s.pago)}</b></td></tr>`).join('') || '<tr><td colspan="5" class="muted">Sem vendas.</td></tr>'}</tbody></table></div></div>
    ${vendas.map(x => { const r = vendaResumo(x); return `<div class="item ${x.comissaoPaga ? 'pago' : 'pendente'}" onclick="abrirVendaAdmin('${x.id}')"><div class="info"><div class="title">${esc(x.corretor.nome)} <span class="tiny muted">· ${esc(imovelShort(x))} · ${esc(x.cliente.nome)}</span></div><div class="meta"><span>Venda ${fmtDate(x.dataVenda)} · ${fmtMoney(x.valorTotal)}</span><span>· ${fmtNum(x.comissaoPct, 1)}%</span><span>· cliente já pagou ${fmtMoney(r.pago)}</span>${x.comissaoPaga && x.comissaoData ? `<span>· paga em ${fmtDate(x.comissaoData)}</span>` : ''}</div></div>
      <div class="side"><div class="value">${fmtMoney(x.comissaoValor)}</div><span class="badge ${x.comissaoPaga ? 'paga' : 'pendente'}">${x.comissaoPaga ? 'Paga' : 'A pagar'}</span><div class="btns" onclick="event.stopPropagation()"><button class="btn-icon ${x.comissaoPaga ? '' : 'ok'}" title="${x.comissaoPaga ? 'Marcar como não paga' : 'Marcar como paga'}" onclick="toggleComissao('${x.id}')">${x.comissaoPaga ? '<i class=ico data-i=arrow-u-up-left></i>' : '<i class=ico data-i=money></i>'}</button></div></div></div>`; }).join('') || '<div class="empty"><div class="ic"><i class=ico data-i=handshake></i></div><p>Nenhuma comissão.</p></div>'}`;
}
function toggleComissao(id) {
  const x = getVenda(id); if (!x) return;
  const paga = !x.comissaoPaga;
  upsert('vendas', Object.assign({}, x, { comissaoPaga: paga, comissaoData: paga ? todayStr() : null }));
  logAct(`Comissão ${paga ? 'paga' : 'reaberta'}: ${x.corretor.nome} — ${fmtMoney(x.comissaoValor)}`); renderCurrent();
}

// ================================================================ GRÁFICOS (canvas)
function setupCanvas(cv) {
  const dpr = window.devicePixelRatio || 1; const rect = cv.getBoundingClientRect();
  const w = Math.max(200, rect.width || cv.parentElement.clientWidth - 32), h = Number(cv.getAttribute('height')) || 200;
  cv.width = w * dpr; cv.height = h * dpr; cv.style.height = h + 'px';
  const ctx = cv.getContext('2d'); ctx.scale(dpr, dpr); return { ctx, w, h };
}
/* O dinheiro de cada mês: o que já foi pago conta no mês em que entrou ou saiu; o que falta,
   no mês do vencimento. Assim a parcela antecipada sai do mês em que venceria e aparece no
   mês em que o cliente pagou, e o que falta de um pagamento parcial continua previsto. */
function fluxoPorMes(meses, recs, custos) {
  const zero = () => Object.fromEntries(meses.map(m => [m, 0]));
  const recebido = zero(), aReceber = zero(), pago = zero(), aPagar = zero();
  const soma = (alvo, data, v) => { const m = monthKey(data); if (m in alvo && v > 0.005) alvo[m] += v; };
  recs.forEach(r => {
    if (num(r.valorPago) > 0) soma(recebido, r.dataPagamento || r.vencimento, num(r.valorPago));
    soma(aReceber, r.vencimento, recRestante(r));
  });
  custos.forEach(c => { if (c.status === 'pago') soma(pago, c.dataPagamento || c.vencimento || c.dataCompetencia, num(c.valor)); else soma(aPagar, c.vencimento || c.dataCompetencia, num(c.valor)); });
  const lista = o => meses.map(m => o[m]);
  return { entra: meses.map(m => recebido[m] + aReceber[m]), sai: meses.map(m => pago[m] + aPagar[m]), recebido: lista(recebido), aReceber: lista(aReceber), pago: lista(pago), aPagar: lista(aPagar) };
}
function drawFluxoChart(cv, recs, custos, tip) {
  if (!cv) return; const { ctx, w, h } = setupCanvas(cv);
  const months = []; const now = new Date();
  for (let i = -1; i < 11; i++) { const d = new Date(now.getFullYear(), now.getMonth() + i, 1); months.push(d.getFullYear() + '-' + pad2(d.getMonth() + 1)); }
  const fluxo = fluxoPorMes(months, recs, custos), rIn = fluxo.entra, cOut = fluxo.sai;
  const max = Math.max(...rIn, ...cOut, 1);
  const padL = 56, padR = 8, padB = 22, padT = 14; const cw = w - padL - padR, ch = h - padB - padT; const gw = cw / months.length; const bw = gw * 0.34;
  ctx.clearRect(0, 0, w, h);
  if (!rIn.some(Boolean) && !cOut.some(Boolean)) { graficoVazio(ctx, w, h, 'Nada previsto para os próximos 12 meses.'); return; }
  eixoValores(ctx, w, padL, padR, padT, ch, max);
  const passo = passoRotulos(ctx, gw, months.map(monthLabel)), showVals = gw >= 64;
  months.forEach((m, i) => {
    const x = padL + i * gw + gw / 2;
    const h1 = rIn[i] / max * ch, h2 = cOut[i] / max * ch;
    ctx.fillStyle = m === monthKey(todayStr()) ? '#1d4ed8' : '#60a5fa'; ctx.fillRect(x - bw - 1, padT + ch - h1, bw, h1);
    ctx.fillStyle = m === monthKey(todayStr()) ? '#ea580c' : '#fdba74'; ctx.fillRect(x + 1, padT + ch - h2, bw, h2);
    ctx.fillStyle = '#6b6a65'; ctx.font = (m === monthKey(todayStr()) ? '600 ' : '') + '11px Geist, system-ui'; ctx.textAlign = 'center';
    if (i % passo === 0) rotuloMes(ctx, monthLabel(m), x, h - 6, w);
    if (showVals) {
      ctx.fillStyle = '#3a3d40'; ctx.font = '10px Geist, system-ui';
      if (h1 >= 14) ctx.fillText(fmtMoneyShort(rIn[i]).replace('R$ ', ''), x - bw / 2 - 1, padT + ch - h1 - 3);
      if (h2 >= 14) ctx.fillText(fmtMoneyShort(cOut[i]).replace('R$ ', ''), x + bw / 2 + 1, padT + ch - h2 - 3);
    }
  });
  /* Passando o mouse (ou tocando, no celular) em cima de um mês: os valores daquele mês */
  if (!tip) return;
  const linha = (cor, rot, v, forte) => `<div><span class="dot" style="background:${cor}"></span>${rot} <span>${forte ? '<b>' + fmtMoney(v) + '</b>' : fmtMoney(v)}</span></div>`;
  const mostrar = ev => {
    const rect = cv.getBoundingClientRect(); const px = ev.clientX - rect.left;
    const i = Math.floor((px - padL) / gw);
    if (i < 0 || i >= months.length) { tip.style.display = 'none'; return; }
    const saldo = rIn[i] - cOut[i];
    tip.innerHTML = `<b>${monthLabel(months[i])}</b>
      ${linha('#2563eb', 'Recebimentos', rIn[i], true)}
      ${fluxo.recebido[i] > 0.005 && fluxo.aReceber[i] > 0.005 ? `<div class="tip-sub">já recebido ${fmtMoney(fluxo.recebido[i])} · a receber ${fmtMoney(fluxo.aReceber[i])}</div>` : fluxo.recebido[i] > 0.005 ? '<div class="tip-sub">tudo já recebido</div>' : ''}
      ${linha('#f97316', 'Despesas', cOut[i], true)}
      ${fluxo.pago[i] > 0.005 && fluxo.aPagar[i] > 0.005 ? `<div class="tip-sub">já pago ${fmtMoney(fluxo.pago[i])} · a pagar ${fmtMoney(fluxo.aPagar[i])}</div>` : fluxo.pago[i] > 0.005 ? '<div class="tip-sub">tudo já pago</div>' : ''}
      <div class="tip-total">Saldo do mês <span style="color:${saldo < -0.005 ? 'var(--danger)' : 'inherit'}">${fmtMoney(saldo)}</span></div>`;
    tip.style.display = 'block';
    const cx = padL + i * gw + gw / 2; const tw = tip.offsetWidth;
    tip.style.left = Math.max(0, Math.min(rect.width - tw, cx - tw / 2)) + 'px'; tip.style.top = '4px';
  };
  cv.onmousemove = mostrar; cv.onmouseleave = () => { tip.style.display = 'none'; };
  cv.onclick = mostrar;   // no celular, tocar mostra os valores
}
/* De quantos em quantos meses escrever o rótulo para que nenhum encoste no vizinho:
   1 no computador, 2 no celular, 3 em telas de 320 px. */
function passoRotulos(ctx, gw, rotulos) {
  ctx.font = '600 11px Geist, system-ui';
  const maior = Math.max(...rotulos.map(t => ctx.measureText(t).width)) + 6;
  return Math.max(1, Math.ceil(maior / gw));
}
/* Sem nenhum valor, a escala virava "0, 0, 1, 1, 1": em vez de eixo vazio, uma frase. */
function graficoVazio(ctx, w, h, frase) {
  ctx.strokeStyle = '#e8e7e3'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(16, h - 22.5); ctx.lineTo(w - 16, h - 22.5); ctx.stroke();
  ctx.fillStyle = '#6b6a65'; ctx.font = '13px Geist, system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(frase, w / 2, h / 2 - 10); ctx.textBaseline = 'alphabetic';
}
/* O último mês fica colado na borda direita: o rótulo é empurrado para dentro em vez de cortado. */
function rotuloMes(ctx, txt, x, y, w) {
  const meio = ctx.measureText(txt).width / 2;
  ctx.fillText(txt, Math.min(x, w - meio - 1), y);
}
/* Linhas de grade com o valor de cada uma à esquerda: o gráfico precisa dizer quanto é. */
function eixoValores(ctx, w, padL, padR, padT, ch, max) {
  ctx.strokeStyle = '#e8e7e3'; ctx.lineWidth = 1; ctx.fillStyle = '#6b6a65'; ctx.font = '11px Geist, system-ui'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  [0, 0.25, 0.5, 0.75, 1].forEach(p => {
    const y = Math.round(padT + ch - ch * p) + 0.5;
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke();
    const v = max * p; ctx.fillText(v >= 1e6 ? fmtNum(v / 1e6, 1) + ' mi' : v >= 1e3 ? fmtNum(v / 1e3, 0) + ' mil' : fmtNum(v, 0), padL - 8, y);
  });
  ctx.textBaseline = 'alphabetic';
}
/* Recebido × inadimplência. Cores conferidas no validador de paleta, inclusive para quem
   não distingue vermelho de verde: azul, vermelho e amarelo. O amarelo tem pouco contraste
   com o fundo branco, por isso o gráfico vem com legenda, dica ao passar o mouse e a tabela. */
const COR_RECEBIDO = '#2a78d6', COR_ATRASO = '#d03b3b', COR_A_VENCER = '#eda100';
function drawRecebimentosChart(cv, tip, serie) {
  if (!cv) return; const { ctx, w, h } = setupCanvas(cv);
  const padL = 56, padR = 8, padB = 22, padT = 18; const cw = w - padL - padR, ch = h - padB - padT; const gw = cw / serie.length;
  const bw = Math.min(24, gw * 0.56);   // barra fina: no máximo 24 px, o resto do espaço é respiro
  const max = Math.max(...serie.map(x => x.devido), 1);
  ctx.clearRect(0, 0, w, h);
  if (!serie.some(x => x.devido > 0.005)) { graficoVazio(ctx, w, h, 'Nenhuma parcela venceu nos últimos 12 meses.'); return; }
  eixoValores(ctx, w, padL, padR, padT, ch, max);
  const passo = passoRotulos(ctx, gw, serie.map(x => monthLabel(x.mes)));
  serie.forEach((x, i) => {
    const cx = padL + i * gw + gw / 2; let base = padT + ch;
    /* Recebido embaixo, atraso no meio, a vencer em cima; 2 px de fundo entre os pedaços e
       só o topo arredondado. */
    const partes = [[x.recebido, COR_RECEBIDO], [x.atraso, COR_ATRASO], [x.aVencer, COR_A_VENCER]].filter(p => p[0] > 0.005);
    partes.forEach(([val, cor], j) => {
      let hh = val / max * ch; if (hh < 2) hh = 2;
      const topo = j === partes.length - 1;
      const y = base - hh + (j ? 2 : 0), altura = hh - (j ? 2 : 0);
      if (altura <= 0) { base -= hh; return; }
      ctx.fillStyle = cor; ctx.beginPath();
      const r = topo ? Math.min(4, altura, bw / 2) : 0;
      ctx.moveTo(cx - bw / 2, y + altura); ctx.lineTo(cx - bw / 2, y + r);
      if (r) ctx.quadraticCurveTo(cx - bw / 2, y, cx - bw / 2 + r, y);
      ctx.lineTo(cx + bw / 2 - r, y);
      if (r) ctx.quadraticCurveTo(cx + bw / 2, y, cx + bw / 2, y + r);
      ctx.lineTo(cx + bw / 2, y + altura); ctx.closePath(); ctx.fill();
      base -= hh;
    });
    ctx.fillStyle = x.mes === mesAtual() ? '#15181b' : '#6b6a65'; ctx.font = (x.mes === mesAtual() ? '600 ' : '') + '11px Geist, system-ui'; ctx.textAlign = 'center';
    if ((serie.length - 1 - i) % passo === 0) rotuloMes(ctx, monthLabel(x.mes), cx, h - 6, w);
  });
  /* Só o mês com a maior inadimplência leva o número em cima; o resto fica na dica e na tabela. */
  const pior = serie.reduce((a, x, i) => (x.pct > (serie[a] || {}).pct ? i : a), 0);
  if (serie[pior] && serie[pior].pct >= 0.5) {
    const x = serie[pior], cx = padL + pior * gw + gw / 2, topoY = padT + ch - x.devido / max * ch;
    /* Etiqueta com fundo branco, para não se misturar com as barras vizinhas */
    const txt = fmtNum(x.pct, 0) + '% atraso'; ctx.font = '600 11px Geist, system-ui'; ctx.textAlign = 'center';
    const tw = ctx.measureText(txt).width + 10, ty = Math.max(2, topoY - 20), tx = Math.min(w - padR - tw / 2, Math.max(padL + tw / 2, cx));
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#e8e7e3'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.rect(Math.round(tx - tw / 2) + 0.5, Math.round(ty) + 0.5, Math.round(tw), 16); ctx.fill(); ctx.stroke();
    ctx.fillStyle = COR_ATRASO; ctx.fillText(txt, tx, ty + 12);
  }
  if (!tip) return;
  const mostrar = ev => {
    const rect = cv.getBoundingClientRect(); const px = ev.clientX - rect.left;
    const i = Math.floor((px - padL) / gw);
    if (i < 0 || i >= serie.length) { tip.style.display = 'none'; return; }
    const x = serie[i];
    tip.innerHTML = `<b>${monthLabel(x.mes)}</b><div><span class="dot" style="background:${COR_RECEBIDO}"></span>Recebido <span>${fmtMoney(x.recebido)}</span></div>
      <div><span class="dot" style="background:${COR_ATRASO}"></span>Em atraso <span>${fmtMoney(x.atraso)}</span></div>
      ${x.aVencer ? `<div><span class="dot" style="background:${COR_A_VENCER}"></span>A vencer <span>${fmtMoney(x.aVencer)}</span></div>` : ''}
      <div class="tip-total">Venceu ${fmtMoney(x.devido)} · inadimplência ${fmtNum(x.pct, 1)}%</div>`;
    tip.style.display = 'block';
    const cx = padL + i * gw + gw / 2; const tw = tip.offsetWidth;
    tip.style.left = Math.max(0, Math.min(rect.width - tw, cx - tw / 2)) + 'px'; tip.style.top = '4px';
  };
  cv.onmousemove = mostrar; cv.onmouseleave = () => { tip.style.display = 'none'; };
  cv.onclick = mostrar;   // no celular, tocar mostra a dica
}
function drawDonut(cv, legendEl, data, money) {
  if (!cv) return; const { ctx, w, h } = setupCanvas(cv);
  ctx.clearRect(0, 0, w, h);
  const items = data.filter(d => d.value > 0); const total = items.reduce((s, d) => s + d.value, 0);
  if (!total) { ctx.fillStyle = '#94a3b8'; ctx.font = '13px system-ui'; ctx.textAlign = 'center'; ctx.fillText('Sem dados', w / 2, h / 2); if (legendEl) legendEl.innerHTML = ''; return; }
  const cx = w / 2, cy = h / 2, r = Math.min(cx, cy) - 8; let start = -Math.PI / 2;
  items.forEach(d => { const a = d.value / total * Math.PI * 2; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r, start, start + a); ctx.closePath(); ctx.fillStyle = d.color; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke(); start += a; });
  ctx.beginPath(); ctx.arc(cx, cy, r * 0.58, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill();
  ctx.fillStyle = '#0f172a'; ctx.font = 'bold 15px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(money ? fmtMoneyShort(total) : String(total), cx, cy - 2);
  ctx.fillStyle = '#64748b'; ctx.font = '10px system-ui'; ctx.fillText(money ? 'total' : 'lotes', cx, cy + 14);
  if (legendEl) legendEl.innerHTML = items.map(d => `<div><span class="dot" style="background:${d.color}"></span>${esc(d.label)}<span class="lv">${money ? fmtMoney(d.value) : d.value} (${Math.round(d.value / total * 100)}%)</span></div>`).join('');
}
