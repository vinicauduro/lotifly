/* ===== Lotfly — o contrato como página =====
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
  openModal({ title: 'Número do contrato',
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
const ABAS_CONTRATO = [['resumo', 'Resumo'], ['partes', 'Partes'], ['parcelas', 'Parcelas'], ['documentos', 'Documentos'], ['historico', 'Histórico']];
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
  const voltarRot = { vendas: 'Contratos', clientes: 'Clientes', recebiveis: 'A receber', cobranca: 'Cobrança', emp: 'Imóveis', painel: 'Início' }[de] || 'Voltar';
  /* Cabeçalho com uma ação principal: registrar o pagamento da próxima parcela em aberto, que
     é o que mais se faz num contrato. Documentos (contrato, extrato, resumo pelo WhatsApp) e o
     resto (editar, antecipar, excluir) ficam em dois menus; Excluir fica separado e em vermelho,
     longe do que se usa todo dia. */
  const proxima = x.status !== 'distrato' ? recebiveisDo('').filter(rc => rc.vendaId === x.id && recRestante(rc) > 0.005).sort((a, b) => a.vencimento.localeCompare(b.vencimento) || a.numero - b.numero)[0] : null;
  const docs = [
    `<button class="menu-item" role="menuitem" onclick="fecharMenus();gerarContratoVenda('${x.id}')"><i class=ico data-i=file-text></i>Contrato</button>`,
    `<button class="menu-item" role="menuitem" onclick="fecharMenus();imprimirExtrato('${x.id}')"><i class=ico data-i=receipt></i>Extrato</button>`,
    c.telefone ? `<a class="menu-item" role="menuitem" target="_blank" href="${waLink(c.telefone, extratoTexto(x))}" onclick="fecharMenus()"><i class=ico data-i=whatsapp-logo></i>Enviar resumo pelo WhatsApp</a>` : ''
  ].filter(Boolean).join('');
  const mais = [
    pode('vendas.editar') ? `<button class="menu-item" role="menuitem" onclick="fecharMenus();abrirVendaForm('${x.id}')"><i class=ico data-i=pencil-simple></i>Editar contrato</button>` : '',
    x.status !== 'distrato' && r.restante > 0.005 && pode('financeiro.antecipar') ? `<button class="menu-item" role="menuitem" onclick="fecharMenus();abrirAntecipacao('${x.id}')"><i class=ico data-i=coins></i>Antecipar / quitar</button>` : '',
    podeCeder(x) ? `<button class="menu-item" role="menuitem" onclick="fecharMenus();abrirCessao('${x.id}')"><i class=ico data-i=users></i>Cessão de direitos</button>` : '',
    x.status !== 'distrato' && pode('vendas.distrato') ? `<button class="menu-item" role="menuitem" onclick="fecharMenus();abrirDistrato('${x.id}')"><i class=ico data-i=arrow-u-up-left></i>Fazer distrato</button>` : ''
  ].filter(Boolean).join('');
  const excluir = pode('vendas.distrato') ? `<button class="menu-item perigo" role="menuitem" onclick="fecharMenus();excluirVenda('${x.id}')"><i class=ico data-i=trash></i>Excluir contrato</button>` : '';
  const menus = [
    `<details class="menu"><summary class="btn btn-secondary btn-sm">Documentos <i class=ico data-i=caret-down></i></summary><div class="menu-lista" role="menu">${docs}</div></details>`,
    mais || excluir ? `<details class="menu"><summary class="btn btn-secondary btn-sm">Mais <i class=ico data-i=caret-down></i></summary><div class="menu-lista" role="menu">${mais}${mais && excluir ? '<hr>' : ''}${excluir}</div></details>` : ''
  ].filter(Boolean).join('');
  const principal = proxima && pode('financeiro.baixar') ? `<button class="btn btn-primary btn-sm ct-principal" onclick="abrirPagamento('${proxima.id}','${x.id}')" title="${esc(proxima.descricao)} · vence ${fmtDate(proxima.vencimento)}"><i class=ico data-i=money></i>Registrar pagamento</button>` : '';
  el.innerHTML = `
    <div class="ct-topo"><button class="btn btn-secondary btn-sm" onclick="voltarDoContrato()">‹ ${esc(voltarRot)}</button><div class="ct-menus">${menus}</div>${principal}</div>
    <div class="card ct-cab">
      <div class="ct-num">${x.numeroContrato ? `Contrato <b>Nº ${esc(x.numeroContrato)}</b>` : '<span class="muted">Contrato sem número</span>'}
        ${pode('vendas.editar') ? `<button class="btn-icon" title="${x.numeroContrato ? 'Alterar o número' : 'Dar número'}" onclick="${x.numeroContrato ? `editarNumeroContrato('${x.id}')` : `numerarVenda('${x.id}')`}">${x.numeroContrato ? '<i class=ico data-i=pencil-simple></i>' : '<i class=ico data-i=hash></i>'}</button>` : ''}
        <span class="badge ${x.status === 'distrato' ? 'distrato' : x.status}">${({ ativa: 'Ativo', quitada: 'Quitado' })[x.status] || statusLabel(x.status)}</span></div>
      <h2 class="ct-titulo">${esc(imovelLabel(x))}${lot ? ` <span class="ct-emp muted">${esc(lot.nome)}</span>` : ''}</h2>
      <div class="meta"><span>${esc(c.nome || '')}${extras ? ` e mais ${extras}` : ''}</span><span>· ${fmtDate(x.dataVenda)}</span><span>· ${x.nParcelas ? `${x.nParcelas}× ${fmtMoney(x.valorParcela)}` : 'à vista'}</span></div>
      ${x.status === 'distrato' && x.distrato ? kpisDistratoHtml(x) : `<div class="kpi-grid ct-kpis">
        <div class="kpi c-primary"><div class="lbl">Valor do contrato</div><div class="val">${fmtMoney(x.valorTotal)}</div><div class="sub">${nPlural(r.n, 'parcela')} com a entrada</div></div>
        <div class="kpi c-green"><div class="lbl">Recebido</div><div class="val">${fmtMoney(r.pago)}</div><div class="sub">${pct}% · ${r.nPagas}/${r.n} pagas</div></div>
        <div class="kpi c-amber"><div class="lbl">A receber</div><div class="val">${fmtMoney(Math.max(0, r.restante))}</div><div class="sub">${proximaParcelaTxt(x)}</div></div>
        <div class="kpi ${r.atrasado ? 'c-red' : 'c-green zero'}"><div class="lbl">Em atraso</div><div class="val">${fmtMoney(r.atrasado)}</div><div class="sub">${r.atrasado ? 'veja em Parcelas' : 'em dia'}</div></div>
      </div>`}
      <div class="progress"><div style="width:${pct}%"></div></div>
    </div>
    <div class="subtabs">${ABAS_CONTRATO.map(([k, rot]) => `<div class="chip ${aba === k ? 'active' : ''}" onclick="state.contratoAba='${k}';renderContrato()">${rot}${k === 'parcelas' ? `<span class="n">${r.n}</span>` : ''}</div>`).join('')}</div>
    <div id="ctConteudo">${({ resumo: ctResumoHtml, partes: ctPartesHtml, parcelas: ctParcelasHtml, documentos: ctDocumentosHtml, historico: ctHistoricoHtml })[aba](x)}</div>`;
  $('#fab').classList.remove('show');
}
/* Contrato distratado: o que interessa é o que foi pago, retido e devolvido, não o a receber. */
function kpisDistratoHtml(x) {
  const d = x.distrato;
  const devolvido = (d.custoIds || []).map(id => db.custos.find(c => c.id === id)).filter(c => c && c.status === 'pago').reduce((s, c) => s + num(c.valor), 0);
  return `<div class="kpi-grid ct-kpis">
        <div class="kpi c-primary"><div class="lbl">Pago pelo comprador</div><div class="val">${fmtMoney(d.pago)}</div><div class="sub">até o distrato</div></div>
        <div class="kpi c-green"><div class="lbl">Retido</div><div class="val">${fmtMoney(d.retencao + num(d.outrosDescontos))}</div><div class="sub">${pctTxt(d.retencaoPct)} de retenção${d.outrosDescontos ? ' + descontos' : ''}</div></div>
        <div class="kpi c-amber"><div class="lbl">A devolver</div><div class="val">${fmtMoney(Math.max(0, d.devolucao - devolvido))}</div><div class="sub">de ${fmtMoney(d.devolucao)}</div></div>
        <div class="kpi c-red"><div class="lbl">Distrato</div><div class="val">${fmtDate(d.data)}</div><div class="sub">${esc(d.motivo || '')}</div></div>
      </div>`;
}
function proximaParcelaTxt(x) {
  const prox = recebiveisDe(x.id).filter(rc => recRestante(rc) > 0.005).sort((a, b) => a.vencimento.localeCompare(b.vencimento))[0];
  /* A mais antiga em aberto: se já venceu, é atraso, não "próxima". */
  if (!prox) return 'nada em aberto';
  return prox.vencimento < todayStr() ? `em atraso desde ${fmtDate(prox.vencimento)}` : `próxima: ${fmtDate(prox.vencimento)}`;
}

// ---------------------------------------------------------------- abas
function ctResumoHtml(x) {
  const c = x.cliente || {};
  return `${distratoHtml(x)}<div class="card"><div class="detail-grid">
      <div><div class="k">Imóvel</div><div class="v">${esc(imovelLabel(x))}</div></div><div><div class="k">Data da venda</div><div class="v">${fmtDate(x.dataVenda)}</div></div>
      <div><div class="k">Comprador</div><div class="v">${esc(c.nome || '')}${(x.compradoresExtras || []).length ? ` <span class="tiny muted">e mais ${(x.compradoresExtras || []).length}</span>` : ''}</div></div><div><div class="k">CPF/CNPJ</div><div class="v">${esc(fmtCPF(c.cpf)) || '—'}</div></div>
      <div><div class="k">Telefone</div><div class="v">${c.telefone ? `<a href="${waLink(c.telefone, '')}" target="_blank">${esc(fmtPhone(c.telefone))}</a>` : '—'}</div></div><div><div class="k">E-mail</div><div class="v">${esc(c.email) || '—'}</div></div>
      <div><div class="k">Valor total</div><div class="v">${fmtMoney(x.valorTotal)}</div></div><div><div class="k">Entrada</div><div class="v">${fmtMoney(x.entrada)}${x.dataEntrada ? ` <span class="tiny muted">em ${fmtDate(x.dataEntrada)}</span>` : ''}</div></div>
      <div><div class="k">Parcelas</div><div class="v">${x.nParcelas ? `${x.nParcelas}× ${fmtMoney(x.valorParcela)}` : 'à vista'}${(x.baloes || []).length ? ` + ${x.baloes.length} reforço(s)` : ''}</div></div><div><div class="k">Juros</div><div class="v">${x.jurosMes ? fmtNum(x.jurosMes, 2) + '% ao mês' : 'sem juros'}</div></div>
      <div><div class="k">Corretor</div><div class="v">${esc((x.corretor || {}).nome || '—')}${(x.corretor || {}).creci ? ' · ' + esc(x.corretor.creci) : ''}</div></div>
      <div><div class="k">Comissão</div><div class="v">${num(x.comissaoValor) ? `${fmtMoney(x.comissaoValor)} (${fmtNum(x.comissaoPct, 1)}%) <span class="badge ${x.comissaoPaga ? 'paga' : 'pendente'}">${x.comissaoPaga ? 'paga' : 'a pagar'}</span>` : '—'}</div></div>
      ${x.obs ? `<div class="full"><div class="k">Observações</div><div class="v">${esc(x.obs)}</div></div>` : ''}
    </div></div>
    ${correcaoResumoVenda(x)}
    ${despesasDoImovelHtml(x)}`;
}
/* Despesas vinculadas a este imóvel (Fase 4): as lançadas para o contrato ou para o lote dele —
   IPTU de imóvel avulso, conserto, taxa de transferência… Com o atalho para lançar outra. */
function despesasDoImovelHtml(x) {
  if (!pode('custos.ver')) return '';
  const lista = db.custos.filter(c => c.categoriaId !== CAT_DEVOLUCAO && (c.vendaId === x.id || (x.loteId && c.loteId === x.loteId))).sort((a, b) => (b.dataCompetencia || '').localeCompare(a.dataCompetencia || ''));
  const imovel = x.loteId ? 'l:' + x.loteId : 'v:' + x.id;
  const lancar = pode('custos.editar') ? `<button class="btn btn-secondary btn-sm" onclick="abrirCustoForm(null, { emp: '${x.loteamentoId}', imovel: '${imovel}' })"><i class=ico data-i=plus></i>Despesa</button>` : '';
  const tot = lista.reduce((s, c) => s + num(c.valor), 0), aPagar = lista.filter(c => c.status !== 'pago').reduce((s, c) => s + num(c.valor), 0);
  return `<div class="card"><h2>Despesas deste imóvel <span class="h-actions">${lancar}</span></h2>
    ${lista.length ? `<p class="small muted mb">${lista.length} lançamento(s) · ${fmtMoney(tot)}${aPagar ? ` · ${fmtMoney(aPagar)} a pagar` : ''}</p><div class="lista">${lista.map(c => custoRowHtml(c)).join('')}</div>`
      : '<p class="help">Nenhuma despesa vinculada a este imóvel. Lance aqui o que for dele — IPTU, conserto, taxa de transferência — para saber o custo de cada imóvel.</p>'}</div>`;
}
function ctPartesHtml(x) {
  const bloco = (titulo, pessoas, comFicha) => `<div class="card"><h2>${titulo}</h2>${pessoas.map(p => {
    const falta = faltaQualificacao(p);
    const ficha = comFicha && typeof clientePorChave === 'function' ? clientePorChave(chaveCliente(p)) : null;
    return `<div class="ct-parte"><div class="row-between"><b>${esc(p.nome || '')}</b>${ficha ? `<button class="btn btn-secondary btn-sm" style="flex:none" onclick="abrirClienteForm('${esc(ficha.id)}')">Ficha do cliente</button>` : ''}</div>
      <p class="ct-qualif">${esc(qualificacaoParte(p)) || '<span class="muted">sem qualificação</span>'}</p>
      ${falta.length ? `<div class="tiny" style="color:var(--danger)">Falta para o contrato: ${esc(falta.join(', '))}</div>` : ''}</div>`;
  }).join('') || '<p class="help">Ninguém cadastrado.</p>'}</div>`;
  const k = x.corretor || {};
  return bloco('Comprador' + (todosCompradores(x).length > 1 ? 'es' : ''), todosCompradores(x), true)
    + bloco('Vendedor' + (todosVendedores(x).length > 1 ? 'es' : ''), todosVendedores(x), false)
    + `<div class="card"><h2>Intermediação</h2>${k.nome && k.nome !== 'Venda direta' ? `<div class="detail-grid"><div><div class="k">Corretor</div><div class="v">${esc(k.nome)}</div></div><div><div class="k">CRECI</div><div class="v">${esc(k.creci || '—')}</div></div><div><div class="k">Imobiliária</div><div class="v">${esc(k.imobiliaria || '—')}</div></div><div><div class="k">Telefone</div><div class="v">${esc(fmtPhone(k.telefone)) || '—'}</div></div></div>` : '<p class="help">Venda direta, sem corretor.</p>'}
      ${pode('vendas.editar') ? `<p class="help mt">Para mudar as partes, use <b>Editar</b> no topo. Para passar o contrato a outro comprador, use <b>Mais › Cessão de direitos</b>.</p>` : ''}</div>`
    + cessoesHtml(x);
}
function ctParcelasHtml(x) {
  const recs = recebiveisDe(x.id); const r = vendaResumo(x);
  return `<div class="card"><div class="table-wrap"><table class="tbl tbl-parcelas"><thead><tr><th>Parcela</th><th>Venc.</th><th class="num">Valor</th><th class="num">Pago</th><th>Status</th><th><span class="sr-only">Ações</span></th></tr></thead>
    <tbody>${recs.map(rc => { const st = x.status === 'distrato' && recStatus(rc) !== 'pago' ? 'cancelada' : recStatus(rc); return `<tr data-st="p:${rc.id}"><td>${esc(rc.descricao)}</td><td>${fmtDate(rc.vencimento)}</td><td class="num">${fmtMoney(recValor(rc))}${recCorrecao(rc) > 0.005 ? `<br><span class="tiny muted">base ${fmtMoney(rc.valor)}</span>` : ''}</td><td class="num">${rc.valorPago ? fmtMoney(rc.valorPago) + (rc.dataPagamento ? `<br><span class="tiny muted">${fmtDate(rc.dataPagamento)}</span>` : '') : '—'}</td><td><span class="badge ${st}">${statusLabel(st)}</span>${st === 'atrasado' ? `<br><span class="tiny" style="color:var(--danger)">atual. ${fmtMoney(recAtualizado(rc))}</span>` : ''}</td><td class="ct-acoes-linha">${x.status !== 'distrato' ? (!pode('financeiro.baixar') ? '' : st === 'pago' ? `<button class="btn-icon" title="Estornar" onclick="estornarPagamento('${rc.id}','${x.id}')"><i class=ico data-i=arrow-u-up-left></i></button>` : `<button class="btn-icon ok" title="Registrar pagamento" onclick="abrirPagamento('${rc.id}','${x.id}')"><i class=ico data-i=money></i></button>`) : ''} ${num(rc.valorPago) > 0 ? `<button class="btn-icon" title="Recibo" onclick="gerarRecibo('${rc.id}')"><i class=ico data-i=receipt></i></button> ` : ''}<button class="btn-icon" title="Boleto" onclick="abrirBoleto('${rc.id}')"><i class=ico data-i=bank></i></button> <button class="btn-icon" title="Editar parcela" onclick="editarRecebivel('${rc.id}','${x.id}')"><i class=ico data-i=pencil-simple></i></button></td></tr>`; }).join('')}</tbody>
    <tfoot><tr><td colspan="2">Total</td><td class="num">${fmtMoney(r.total)}</td><td class="num">${fmtMoney(r.pago)}</td><td colspan="2"></td></tr></tfoot></table></div></div>`;
}
function ctDocumentosHtml(x) {
  const c = x.cliente || {};
  const linha = (ic, titulo, desc, botao) => `<div class="item" style="cursor:default"><div class="info"><div class="title">${ic} ${titulo}</div><div class="meta"><span>${desc}</span></div></div><div class="side">${botao}</div></div>`;
  return `<div class="card">
    ${linha('<i class=ico data-i=file-text></i>', 'Contrato de compra e venda', `Pelo modelo da empresa, com a qualificação das partes${x.numeroContrato ? ` e o número ${esc(x.numeroContrato)}` : ''}. Dá para conferir e corrigir antes de imprimir.`, `<button class="btn btn-primary btn-sm" onclick="gerarContratoVenda('${x.id}')">Gerar</button>`)}
    ${x.status === 'distrato' && x.distrato ? linha('<i class=ico data-i=arrow-u-up-left></i>', 'Termo de distrato', `Distrato de ${fmtDate(x.distrato.data)}: retenção, devolução e quitação.`, `<button class="btn btn-outline btn-sm" onclick="gerarTermoDistrato('${x.id}')">Gerar</button>`) : ''}
    ${(x.cessoes || []).length ? linha('<i class=ico data-i=users></i>', 'Termo de cessão de direitos', `A última cessão, de ${fmtDate(cessoesDe(x).slice(-1)[0].data)}: cedente, cessionário e a empresa como anuente.`, `<button class="btn btn-outline btn-sm" onclick="gerarTermoCessao('${x.id}')">Gerar</button>`) : ''}
    ${linha('<i class=ico data-i=printer></i>', 'Extrato do contrato', 'Todas as parcelas, o que foi pago e o que falta.', `<button class="btn btn-outline btn-sm" onclick="imprimirExtrato('${x.id}')">Imprimir</button>`)}
    ${c.telefone ? linha('<i class=ico data-i=whatsapp-logo></i>', 'Resumo por WhatsApp', `Para ${esc(c.nome || '')}, com o saldo e a próxima parcela.`, `<a class="btn btn-wa btn-sm" target="_blank" href="${waLink(c.telefone, extratoTexto(x))}">Enviar</a>`) : ''}
    ${linha('<i class=ico data-i=bank></i>', 'Boletos', 'O boleto de cada parcela abre pela aba Parcelas, no botão <i class=ico data-i=bank></i>.', `<button class="btn btn-secondary btn-sm" onclick="state.contratoAba='parcelas';renderContrato()">Ver parcelas</button>`)}
  </div>`;
}
/* O histórico é montado do que o sistema guarda com data: a venda, cada pagamento, cada
   boleto registrado no banco, cada cobrança, a comissão e as alterações registradas no
   histórico geral que citam este contrato. */
function eventosDoContrato(x) {
  const ev = [];
  const add = (data, ic, txt) => { if (data) ev.push({ data: String(data), ic, txt }); };
  add(x.criadoEm || x.dataVenda, '<i class=ico data-i=note-pencil></i>', `Contrato registrado: ${fmtMoney(x.valorTotal)} para ${x.cliente.nome}${x.dataVenda ? ` (venda de ${fmtDate(x.dataVenda)})` : ''}`);
  recebiveisDe(x.id).forEach(r => {
    if (num(r.valorPago) > 0) add(r.dataPagamento, '<i class=ico data-i=money></i>', `${r.descricao} paga: ${fmtMoney(r.valorPago)}${r.forma ? ' · ' + r.forma : ''}`);
    if (r.remessaEm) add(r.remessaEm, '<i class=ico data-i=bank></i>', `${r.descricao} registrada no banco${r.nossoNumero ? ' (nosso número ' + r.nossoNumero + ')' : ''}`);
  });
  db.cobrancas.filter(cb => cb.vendaId === x.id).forEach(cb => add(cb.data || cb.criadoEm, '<i class=ico data-i=bell></i>', `Cobrança por ${cb.canal || 'contato'}${cb.dias ? ` com ${cb.dias} dia(s) de atraso` : ''}${cb.obs ? ': ' + cb.obs : ''}`));
  if (x.comissaoPaga && x.comissaoData) add(x.comissaoData, '<i class=ico data-i=handshake></i>', `Comissão paga a ${x.corretor.nome}: ${fmtMoney(x.comissaoValor)}`);
  if (x.distratoEm) add(x.distratoEm, '<i class=ico data-i=arrow-u-up-left></i>', x.distrato ? `Distrato: ${x.distrato.motivo || ''} · retenção ${fmtMoney(x.distrato.retencao)} · devolução ${fmtMoney(x.distrato.devolucao)}` : 'Distrato');
  (x.cessoes || []).forEach(c => add(c.data, '<i class=ico data-i=users></i>', `Cessão de direitos: de ${nomesDasPartes(c.cedentes)} para ${nomesDasPartes(c.cessionarios)}${c.taxa ? ` · taxa ${fmtMoney(c.taxa)}` : ''}`));
  const marcas = [imovelLabel(x), x.numeroContrato].filter(Boolean);
  /* Os registros da memória mais os que a nuvem trouxe só deste contrato, sem repetir */
  const doBanco = (Cloud.logContratos || {})[x.id] || [];
  const log = db.log.concat(doBanco.filter(l => !db.log.some(d => d.id === l.id)));
  log.filter(l => marcas.some(m => String(l.msg || '').includes(m)) && !/^(Venda registrada|Cessão de direitos:|Distrato:)/.test(l.msg || ''))
    .forEach(l => add(l.ts, '<i class=ico data-i=clock-counter-clockwise></i>', `${l.msg}${l.who ? ' — ' + l.who : ''}`));
  return ev.sort((a, b) => b.data.localeCompare(a.data));
}
function ctHistoricoHtml(x) {
  if (Cloud.active) Cloud.historicoDoContrato(x);
  const ev = eventosDoContrato(x);
  return `<div class="card">${ev.length ? `<div class="ct-linha-tempo">${ev.map(e => `<div class="ct-ev"><span class="ct-ev-ic">${e.ic}</span><div><div>${esc(e.txt)}</div><div class="tiny muted">${fmtDate(e.data.slice(0, 10))}${e.data.length > 10 ? ' · ' + e.data.slice(11, 16) : ''}</div></div></div>`).join('')}</div>` : '<p class="help">Nada registrado ainda.</p>'}</div>`;
}
