/* ===== Lotifly — o contrato como página =====
   Cada contrato tem um número sequencial por ano (0041/2026) e uma página própria: em cima,
   quem comprou o quê, quanto já entrou e as ações; embaixo, as abas Resumo, Partes,
   Parcelas, Documentos e Histórico. */
'use strict';

// ================================================================ NÚMERO DO CONTRATO
function fmtNumeroContrato(seq, ano) { return String(seq).padStart(4, '0') + '/' + ano; }
function partesNumero(txt) {
  const m = /^(\d{1,6})\/(\d{4})$/.exec(String(txt || '').trim());
  return m ? { seq: Number(m[1]), ano: Number(m[2]) } : null;
}
function anoDoContrato(v) { return Number(String((v && v.dataVenda) || todayStr()).slice(0, 4)); }
/* O maior número já usado no ano, olhando os contratos que existem. */
function maiorNumeroDoAno(ano) {
  return db.vendas.reduce((mx, v) => { const p = partesNumero(v.numeroContrato); return p && p.ano === ano ? Math.max(mx, p.seq) : mx; }, 0);
}
/* Na nuvem, quem dá o número é o banco: duas pessoas salvando ao mesmo tempo nunca recebem
   o mesmo. Sem nuvem, ou com o banco ainda sem a função nova, o número sai daqui. */
async function proximoNumero(ano) {
  if (Cloud.active) {
    try { const n = await Cloud.rpc('proximo_numero_contrato', { p_org: Cloud.org.id, p_ano: ano }); if (Number(n) > 0) return Number(n); }
    catch (e) { console.warn('numeração pela nuvem indisponível, usando a local', e); }
  }
  return maiorNumeroDoAno(ano) + 1;
}
async function numerarVenda(id) {
  const v = getVenda(id); if (!v || v.numeroContrato) return v && v.numeroContrato;
  const ano = anoDoContrato(v);
  const seq = await proximoNumero(ano);
  const atual = getVenda(id); if (!atual || atual.numeroContrato) return atual && atual.numeroContrato;
  const numero = fmtNumeroContrato(seq, ano);
  upsert('vendas', Object.assign({}, atual, { numeroContrato: numero }));
  if (state.tab === 'contrato' && state.contratoId === id) renderCurrent();
  return numero;
}
/* Contratos de antes da numeração: recebem número na ordem da data da venda, ano a ano. */
function semNumero() { return db.vendas.filter(v => !v.numeroContrato); }
async function numerarContratosAntigos() {
  if (!pode('vendas.editar') && !pode('vendas.criar')) { toast('🔒', 'Sem permissão', '', true); return; }
  const lista = semNumero().sort((a, b) => String(a.dataVenda || '').localeCompare(String(b.dataVenda || '')) || String(a.criadoEm || '').localeCompare(String(b.criadoEm || '')));
  if (!lista.length) return;
  for (const v of lista) await numerarVenda(v.id);
  logAct(`Contratos numerados: ${lista.length}`);
  renderCurrent(); toast('✅', 'Contratos numerados', `${lista.length} contrato(s), na ordem da data da venda.`);
}
/* Contrato antigo que já tinha número no papel: dá para corrigir à mão. */
function editarNumeroContrato(id) {
  const v = getVenda(id); if (!v) return;
  openModal({ title: '🔢 Número do contrato',
    body: `<div class="fg"><label>Número</label><input type="text" id="ncNumero" value="${esc(v.numeroContrato || '')}" placeholder="0041/${anoDoContrato(v)}">
      <div class="hint">No formato número/ano, como 41/${anoDoContrato(v)} ou 0041/${anoDoContrato(v)}. Os próximos contratos continuam a partir do maior número do ano.</div></div>`,
    footer: `<button class="btn btn-secondary" onclick="abrirContrato('${v.id}')">Cancelar</button><button class="btn btn-primary" onclick="salvarNumeroContrato('${v.id}')">Salvar</button>` });
  focarSeLivre('ncNumero');
}
function salvarNumeroContrato(id) {
  const v = getVenda(id); if (!v) return;
  const p = partesNumero(val('ncNumero'));
  if (!p || !p.seq) { toast('⚠️', 'Número inválido', 'Use número/ano, por exemplo 41/2026.', true); return; }
  const numero = fmtNumeroContrato(p.seq, p.ano);
  const dup = db.vendas.find(x => x.id !== id && x.numeroContrato === numero);
  if (dup) { toast('⚠️', 'Número já usado', `É o contrato de ${dup.cliente.nome} (${imovelLabel(dup)}).`, true); return; }
  upsert('vendas', Object.assign({}, v, { numeroContrato: numero }));
  logAct(`Número do contrato ${v.numeroContrato || '(sem número)'} → ${numero}: ${imovelLabel(v)}`);
  abrirContrato(id); toast('✅', 'Número salvo', numero);
}
function rotuloContrato(v) { return v && v.numeroContrato ? 'Nº ' + v.numeroContrato : 'sem número'; }

// ================================================================ PÁGINA
/* Todo lugar que abria a janela da venda agora abre a página. A janela que estiver aberta
   (pagamento, edição de parcela) fecha antes. */
function abrirVendaAdmin(id) { abrirContrato(id); }
function abrirContrato(id, aba) {
  const v = getVenda(id); if (!v) { toast('⚠️', 'Contrato não encontrado', '', true); return; }
  if (state.tab !== 'contrato') state.contratoDe = state.tab;
  if (state.contratoId !== id) state.contratoAba = aba || 'resumo'; else if (aba) state.contratoAba = aba;
  state.contratoId = id; setCurLotSilencioso(v.loteamentoId);
  if ($('#modalOverlay').classList.contains('open')) closeModal();
  if (state.tab === 'contrato') renderCurrent(); else { switchTab('contrato'); window.scrollTo(0, 0); }
}
function voltarDoContrato() {
  const de = state.contratoDe && state.contratoDe !== 'contrato' ? state.contratoDe : 'vendas';
  state.contratoId = null; switchTab(de);
}
const ABAS_CONTRATO = [['resumo', '📋 Resumo'], ['partes', '🧑‍🤝‍🧑 Partes'], ['parcelas', '📆 Parcelas'], ['documentos', '📄 Documentos'], ['historico', '🕘 Histórico']];
function renderContrato() {
  const el = $('#av-contrato'); if (!el) return;
  $$('#screen-admin .tab').forEach(t => t.classList.toggle('active', t.dataset.tab === 'vendas'));
  const x = getVenda(state.contratoId);
  if (!x) { state.contratoId = null; switchTab(state.contratoDe && state.contratoDe !== 'contrato' ? state.contratoDe : 'vendas'); return; }
  const r = vendaResumo(x); const pct = r.total ? Math.round(r.pago / r.total * 100) : 0;
  const lot = getLoteamento(x.loteamentoId); const c = x.cliente || {};
  const extras = (x.compradoresExtras || []).length;
  const aba = ABAS_CONTRATO.some(a => a[0] === state.contratoAba) ? state.contratoAba : 'resumo';
  const de = state.contratoDe && state.contratoDe !== 'contrato' ? state.contratoDe : 'vendas';
  const voltarRot = { vendas: 'Todos os contratos', clientes: 'Clientes', recebiveis: 'A receber', cobranca: 'Cobrança', emp: 'Imóveis', painel: 'Início' }[de] || 'Voltar';
  const acoes = [
    pode('vendas.editar') ? `<button class="btn btn-secondary btn-sm" onclick="abrirVendaForm('${x.id}')">✏️ Editar</button>` : '',
    x.status !== 'distrato' && r.restante > 0.005 && pode('financeiro.antecipar') ? `<button class="btn btn-success btn-sm" onclick="abrirAntecipacao('${x.id}')">💸 Antecipar / quitar</button>` : '',
    `<button class="btn btn-outline btn-sm" onclick="gerarContratoVenda('${x.id}')">📄 Contrato</button>`,
    `<button class="btn btn-outline btn-sm" onclick="imprimirExtrato('${x.id}')">🖨️ Extrato</button>`,
    c.telefone ? `<a class="btn btn-wa btn-sm" target="_blank" href="${waLink(c.telefone, extratoTexto(x))}">💬 Enviar resumo</a>` : '',
    pode('vendas.distrato') ? `<button class="btn btn-outline-danger btn-sm" onclick="excluirVenda('${x.id}')">🗑️ Excluir</button>` : ''
  ].filter(Boolean).join('');
  el.innerHTML = `
    <div class="row-between mb" style="gap:8px;flex-wrap:wrap"><button class="btn btn-secondary btn-sm" onclick="voltarDoContrato()">‹ ${esc(voltarRot)}</button><div class="ct-acoes">${acoes}</div></div>
    <div class="card ct-cab">
      <div class="ct-num">${x.numeroContrato ? `Contrato <b>Nº ${esc(x.numeroContrato)}</b>` : '<span class="muted">Contrato sem número</span>'}
        ${pode('vendas.editar') ? `<button class="btn-icon" title="${x.numeroContrato ? 'Alterar o número' : 'Dar número'}" onclick="${x.numeroContrato ? `editarNumeroContrato('${x.id}')` : `numerarVenda('${x.id}')`}">${x.numeroContrato ? '✏️' : '🔢'}</button>` : ''}
        <span class="badge ${x.status === 'distrato' ? 'distrato' : x.status}">${statusLabel(x.status)}</span></div>
      <h2 class="ct-titulo">${esc(imovelLabel(x))}${lot ? ` <span class="muted">· ${esc(lot.nome)}</span>` : ''}</h2>
      <div class="meta"><span>🧑 ${esc(c.nome || '')}${extras ? ` e mais ${extras}` : ''}</span><span>· 📅 ${fmtDate(x.dataVenda)}</span><span>· ${x.nParcelas ? `${x.nParcelas}× ${fmtMoney(x.valorParcela)}` : 'à vista'}</span></div>
      <div class="kpi-grid ct-kpis">
        <div class="kpi c-primary"><div class="lbl">Valor do contrato</div><div class="val">${fmtMoneyShort(x.valorTotal)}</div><div class="sub">${r.n} parcela(s) com a entrada</div></div>
        <div class="kpi c-green"><div class="lbl">Recebido</div><div class="val">${fmtMoneyShort(r.pago)}</div><div class="sub">${pct}% · ${r.nPagas}/${r.n} pagas</div></div>
        <div class="kpi c-amber"><div class="lbl">A receber</div><div class="val">${fmtMoneyShort(Math.max(0, r.restante))}</div><div class="sub">${proximaParcelaTxt(x)}</div></div>
        <div class="kpi ${r.atrasado ? 'c-red' : 'c-green'}"><div class="lbl">Em atraso</div><div class="val">${fmtMoneyShort(r.atrasado)}</div><div class="sub">${r.atrasado ? 'veja em Parcelas' : 'em dia'}</div></div>
      </div>
      <div class="progress"><div style="width:${pct}%"></div></div>
    </div>
    <div class="subtabs">${ABAS_CONTRATO.map(([k, rot]) => `<div class="chip ${aba === k ? 'active' : ''}" onclick="state.contratoAba='${k}';renderContrato()">${rot}${k === 'parcelas' ? `<span class="n">${r.n}</span>` : ''}</div>`).join('')}</div>
    <div id="ctConteudo">${({ resumo: ctResumoHtml, partes: ctPartesHtml, parcelas: ctParcelasHtml, documentos: ctDocumentosHtml, historico: ctHistoricoHtml })[aba](x)}</div>`;
  $('#fab').classList.remove('show');
}
function proximaParcelaTxt(x) {
  const prox = recebiveisDe(x.id).filter(rc => recRestante(rc) > 0.005).sort((a, b) => a.vencimento.localeCompare(b.vencimento))[0];
  return prox ? `próxima: ${fmtDate(prox.vencimento)}` : 'nada em aberto';
}

// ---------------------------------------------------------------- abas
function ctResumoHtml(x) {
  const c = x.cliente || {};
  return `<div class="card"><div class="detail-grid">
      <div><div class="k">Imóvel</div><div class="v">${esc(imovelLabel(x))}</div></div><div><div class="k">Data da venda</div><div class="v">${fmtDate(x.dataVenda)}</div></div>
      <div><div class="k">Comprador</div><div class="v">${esc(c.nome || '')}${(x.compradoresExtras || []).length ? ` <span class="tiny muted">e mais ${(x.compradoresExtras || []).length}</span>` : ''}</div></div><div><div class="k">CPF/CNPJ</div><div class="v">${esc(fmtCPF(c.cpf)) || '—'}</div></div>
      <div><div class="k">Telefone</div><div class="v">${c.telefone ? `<a href="${waLink(c.telefone, '')}" target="_blank">${esc(fmtPhone(c.telefone))}</a>` : '—'}</div></div><div><div class="k">E-mail</div><div class="v">${esc(c.email) || '—'}</div></div>
      <div><div class="k">Valor total</div><div class="v">${fmtMoney(x.valorTotal)}</div></div><div><div class="k">Entrada</div><div class="v">${fmtMoney(x.entrada)}${x.dataEntrada ? ` <span class="tiny muted">em ${fmtDate(x.dataEntrada)}</span>` : ''}</div></div>
      <div><div class="k">Parcelas</div><div class="v">${x.nParcelas ? `${x.nParcelas}× ${fmtMoney(x.valorParcela)}` : 'à vista'}${(x.baloes || []).length ? ` + ${x.baloes.length} reforço(s)` : ''}</div></div><div><div class="k">Juros</div><div class="v">${x.jurosMes ? fmtNum(x.jurosMes, 2) + '% ao mês' : 'sem juros'}</div></div>
      <div><div class="k">Corretor</div><div class="v">${esc((x.corretor || {}).nome || '—')}${(x.corretor || {}).creci ? ' · ' + esc(x.corretor.creci) : ''}</div></div>
      <div><div class="k">Comissão</div><div class="v">${num(x.comissaoValor) ? `${fmtMoney(x.comissaoValor)} (${fmtNum(x.comissaoPct, 1)}%) <span class="badge ${x.comissaoPaga ? 'paga' : 'pendente'}">${x.comissaoPaga ? 'paga' : 'a pagar'}</span>` : '—'}</div></div>
      ${x.obs ? `<div class="full"><div class="k">Observações</div><div class="v">${esc(x.obs)}</div></div>` : ''}
    </div></div>
    ${correcaoResumoVenda(x)}`;
}
function ctPartesHtml(x) {
  const bloco = (titulo, pessoas, comFicha) => `<div class="card"><h3>${titulo}</h3>${pessoas.map(p => {
    const falta = faltaQualificacao(p);
    const ficha = comFicha && typeof clientePorChave === 'function' ? clientePorChave(chaveCliente(p)) : null;
    return `<div class="ct-parte"><div class="row-between"><b>${esc(p.nome || '')}</b>${ficha ? `<button class="btn btn-secondary btn-sm" style="flex:none" onclick="abrirClienteForm('${esc(ficha.id)}')">👤 Ficha do cliente</button>` : ''}</div>
      <p class="ct-qualif">${esc(qualificacaoParte(p)) || '<span class="muted">sem qualificação</span>'}</p>
      ${falta.length ? `<div class="tiny" style="color:var(--danger)">Falta para o contrato: ${esc(falta.join(', '))}</div>` : ''}</div>`;
  }).join('') || '<p class="help">Ninguém cadastrado.</p>'}</div>`;
  const k = x.corretor || {};
  return bloco('🧑‍🤝‍🧑 Comprador' + (todosCompradores(x).length > 1 ? 'es' : ''), todosCompradores(x), true)
    + bloco('✍️ Vendedor' + (todosVendedores(x).length > 1 ? 'es' : ''), todosVendedores(x), false)
    + `<div class="card"><h3>🤝 Intermediação</h3>${k.nome && k.nome !== 'Venda direta' ? `<div class="detail-grid"><div><div class="k">Corretor</div><div class="v">${esc(k.nome)}</div></div><div><div class="k">CRECI</div><div class="v">${esc(k.creci || '—')}</div></div><div><div class="k">Imobiliária</div><div class="v">${esc(k.imobiliaria || '—')}</div></div><div><div class="k">Telefone</div><div class="v">${esc(fmtPhone(k.telefone)) || '—'}</div></div></div>` : '<p class="help">Venda direta, sem corretor.</p>'}
      ${pode('vendas.editar') ? `<p class="help mt">Para mudar as partes, use <b>✏️ Editar</b> no topo.</p>` : ''}</div>`;
}
function ctParcelasHtml(x) {
  const recs = recebiveisDe(x.id); const r = vendaResumo(x);
  return `<div class="card"><div class="table-wrap"><table class="tbl"><thead><tr><th>Parcela</th><th>Venc.</th><th class="num">Valor</th><th class="num">Pago</th><th>Status</th><th></th></tr></thead>
    <tbody>${recs.map(rc => { const st = recStatus(rc); return `<tr><td>${esc(rc.descricao)}</td><td>${fmtDate(rc.vencimento)}</td><td class="num">${fmtMoney(recValor(rc))}${recCorrecao(rc) > 0.005 ? `<br><span class="tiny muted">base ${fmtMoney(rc.valor)}</span>` : ''}</td><td class="num">${rc.valorPago ? fmtMoney(rc.valorPago) + (rc.dataPagamento ? `<br><span class="tiny muted">${fmtDate(rc.dataPagamento)}</span>` : '') : '—'}</td><td><span class="badge ${st}">${statusLabel(st)}</span>${st === 'atrasado' ? `<br><span class="tiny" style="color:var(--danger)">atual. ${fmtMoney(recAtualizado(rc))}</span>` : ''}</td><td class="ct-acoes-linha">${x.status !== 'distrato' ? (!pode('financeiro.baixar') ? '' : st === 'pago' ? `<button class="btn-icon" title="Estornar" onclick="estornarPagamento('${rc.id}','${x.id}')">↩</button>` : `<button class="btn-icon ok" title="Registrar pagamento" onclick="abrirPagamento('${rc.id}','${x.id}')">💵</button>`) : ''} <button class="btn-icon" title="Boleto" onclick="abrirBoleto('${rc.id}')">🏦</button> <button class="btn-icon" title="Editar parcela" onclick="editarRecebivel('${rc.id}','${x.id}')">✏️</button></td></tr>`; }).join('')}</tbody>
    <tfoot><tr><td colspan="2">Total</td><td class="num">${fmtMoney(r.total)}</td><td class="num">${fmtMoney(r.pago)}</td><td colspan="2"></td></tr></tfoot></table></div></div>`;
}
function ctDocumentosHtml(x) {
  const c = x.cliente || {};
  const linha = (ic, titulo, desc, botao) => `<div class="item" style="cursor:default"><div class="info"><div class="title">${ic} ${titulo}</div><div class="meta"><span>${desc}</span></div></div><div class="side">${botao}</div></div>`;
  return `<div class="card">
    ${linha('📄', 'Contrato de compra e venda', `Pelo modelo da empresa, com a qualificação das partes${x.numeroContrato ? ` e o número ${esc(x.numeroContrato)}` : ''}. Dá para conferir e corrigir antes de imprimir.`, `<button class="btn btn-primary btn-sm" onclick="gerarContratoVenda('${x.id}')">Gerar</button>`)}
    ${linha('🖨️', 'Extrato do contrato', 'Todas as parcelas, o que foi pago e o que falta.', `<button class="btn btn-outline btn-sm" onclick="imprimirExtrato('${x.id}')">Imprimir</button>`)}
    ${c.telefone ? linha('💬', 'Resumo por WhatsApp', `Para ${esc(c.nome || '')}, com o saldo e a próxima parcela.`, `<a class="btn btn-wa btn-sm" target="_blank" href="${waLink(c.telefone, extratoTexto(x))}">Enviar</a>`) : ''}
    ${linha('🏦', 'Boletos', 'O boleto de cada parcela abre pela aba Parcelas, no botão 🏦.', `<button class="btn btn-secondary btn-sm" onclick="state.contratoAba='parcelas';renderContrato()">Ver parcelas</button>`)}
  </div>`;
}
/* O histórico é montado do que o sistema guarda com data: a venda, cada pagamento, cada
   boleto registrado no banco, cada cobrança, a comissão e as alterações registradas no
   histórico geral que citam este contrato. */
function eventosDoContrato(x) {
  const ev = [];
  const add = (data, ic, txt) => { if (data) ev.push({ data: String(data), ic, txt }); };
  add(x.criadoEm || x.dataVenda, '📝', `Contrato registrado: ${fmtMoney(x.valorTotal)} para ${x.cliente.nome}${x.dataVenda ? ` (venda de ${fmtDate(x.dataVenda)})` : ''}`);
  recebiveisDe(x.id).forEach(r => {
    if (num(r.valorPago) > 0) add(r.dataPagamento, '💵', `${r.descricao} paga: ${fmtMoney(r.valorPago)}${r.forma ? ' · ' + r.forma : ''}`);
    if (r.remessaEm) add(r.remessaEm, '🏦', `${r.descricao} registrada no banco${r.nossoNumero ? ' (nosso número ' + r.nossoNumero + ')' : ''}`);
  });
  db.cobrancas.filter(cb => cb.vendaId === x.id).forEach(cb => add(cb.data || cb.criadoEm, '🔔', `Cobrança por ${cb.canal || 'contato'}${cb.dias ? ` com ${cb.dias} dia(s) de atraso` : ''}${cb.obs ? ': ' + cb.obs : ''}`));
  if (x.comissaoPaga && x.comissaoData) add(x.comissaoData, '🤝', `Comissão paga a ${x.corretor.nome}: ${fmtMoney(x.comissaoValor)}`);
  if (x.distratoEm) add(x.distratoEm, '↩️', 'Distrato');
  const marcas = [imovelLabel(x), x.numeroContrato].filter(Boolean);
  db.log.filter(l => marcas.some(m => String(l.msg || '').includes(m)) && !/^Venda registrada/.test(l.msg || ''))
    .forEach(l => add(l.ts, '🕘', `${l.msg}${l.who ? ' — ' + l.who : ''}`));
  return ev.sort((a, b) => b.data.localeCompare(a.data));
}
function ctHistoricoHtml(x) {
  const ev = eventosDoContrato(x);
  return `<div class="card">${ev.length ? `<div class="ct-linha-tempo">${ev.map(e => `<div class="ct-ev"><span class="ct-ev-ic">${e.ic}</span><div><div>${esc(e.txt)}</div><div class="tiny muted">${fmtDate(e.data.slice(0, 10))}${e.data.length > 10 ? ' · ' + e.data.slice(11, 16) : ''}</div></div></div>`).join('')}</div>` : '<p class="help">Nada registrado ainda.</p>'}</div>`;
}
