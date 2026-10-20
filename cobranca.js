/* ===== Gestão de Loteamento — inadimplência e régua de cobrança =====
   Agrupa o atraso por contrato, separa por faixa de dias e monta a mensagem de cobrança
   de cada faixa, com histórico do que já foi cobrado. */
'use strict';

const REGUA_PADRAO = [
  { dias: 3, nome: 'Lembrete', texto: 'Olá {{primeiroNome}}, tudo bem? Aqui é da {{empresa}}. Notamos que a parcela do {{lote}} venceu em {{vencimento}} e ainda consta em aberto. Se já pagou, pode desconsiderar e nos mandar o comprovante. Valor atualizado: {{valor}}.{{#se pix}} PIX: {{pix}}{{/se}}' },
  { dias: 10, nome: 'Cobrança', texto: 'Olá {{primeiroNome}}, sobre o {{lote}} no {{loteamento}}: constam {{parcelas}} parcela(s) em aberto, com {{dias}} dias de atraso, totalizando {{valor}} já com multa e juros. Consegue regularizar esta semana?{{#se pix}} PIX: {{pix}}{{/se}}' },
  { dias: 30, nome: 'Aviso', texto: '{{cliente}}, o contrato do {{lote}} está com {{dias}} dias de atraso e {{valor}} em aberto. Precisamos regularizar para evitar a cobrança das penalidades previstas em contrato. Podemos conversar sobre um acordo? Estamos à disposição.' },
  { dias: 60, nome: 'Renegociação', texto: '{{cliente}}, seguimos sem retorno sobre o {{lote}}. O débito soma {{valor}}, com {{dias}} dias de atraso. Queremos encontrar uma saída: dá para renegociar prazo ou valor das parcelas. Me responda até sexta para combinarmos.' },
  { dias: 90, nome: 'Notificação', texto: '{{cliente}}, o contrato do {{lote}} está com {{dias}} dias de atraso e débito de {{valor}}. Sem manifestação, o caso será encaminhado para notificação extrajudicial, conforme o contrato. Entre em contato para resolvermos.' }
];
const CANAIS = [['whatsapp', 'WhatsApp'], ['ligacao', 'Ligação'], ['email', 'E-mail'], ['presencial', 'Pessoalmente'], ['carta', 'Carta / notificação']];

function reguaConfig() {
  const r = db.config.regua;
  return Array.isArray(r) && r.length ? r.slice().sort((a, b) => a.dias - b.dias) : REGUA_PADRAO;
}
function faixaDe(dias) {
  const r = reguaConfig();
  let achou = r[0];
  r.forEach(f => { if (dias >= f.dias) achou = f; });
  return dias < r[0].dias ? null : achou;
}
function cobrancasDe(vendaId) { return db.cobrancas.filter(c => c.vendaId === vendaId).sort((a, b) => (b.data || '').localeCompare(a.data || '')); }

/* Um item por contrato em atraso. */
function inadimplentes(escopo) {
  const hoje = todayStr();
  const mapa = new Map();
  recebiveisDo(escopo).filter(r => recStatus(r) === 'atrasado').forEach(r => {
    const v = getVenda(r.vendaId); if (!v || v.status === 'distrato') return;
    const it = mapa.get(v.id) || { venda: v, parcelas: [], valor: 0, valorBase: 0, dias: 0 };
    it.parcelas.push(r);
    it.valor += recAtualizado(r);
    it.valorBase += recRestante(r);
    it.dias = Math.max(it.dias, daysBetween(r.vencimento, hoje));
    mapa.set(v.id, it);
  });
  return [...mapa.values()].map(it => {
    const cobr = cobrancasDe(it.venda.id);
    return Object.assign(it, {
      valor: Math.round(it.valor * 100) / 100,
      valorBase: Math.round(it.valorBase * 100) / 100,
      maisAntiga: it.parcelas.slice().sort((a, b) => a.vencimento.localeCompare(b.vencimento))[0],
      faixa: faixaDe(it.dias),
      ultima: cobr[0] || null,
      nCobrancas: cobr.length
    });
  }).sort((a, b) => b.dias - a.dias);
}

const FAIXAS_DIAS = [['1-15', 1, 15], ['16-30', 16, 30], ['31-60', 31, 60], ['61-90', 61, 90], ['90+', 91, 99999]];

// ================================================================ PAINEL
function renderCobranca() {
  const esc0 = escopoAtual(); const v = $('#av-cobranca');
  if (!pode('cobranca.ver')) { v.innerHTML = semPermissaoHtml('cobrança'); return; }
  const f = state.filters.cob = state.filters.cob || { faixa: 'todas', busca: '' };
  const todos = inadimplentes(esc0);
  const lista = todos.filter(it => {
    if (f.faixa === 'semcontato') { if (it.ultima) return false; }
    else if (f.faixa !== 'todas') { const fx = FAIXAS_DIAS.find(x => x[0] === f.faixa); if (fx && (it.dias < fx[1] || it.dias > fx[2])) return false; }
    if (f.busca) { const alvo = (it.venda.cliente.nome + ' ' + imovelLabel(it.venda)).toLowerCase(); if (!alvo.includes(f.busca.toLowerCase())) return false; }
    return true;
  });
  /* Mesmos números do Início: o atraso é o principal; multa e juros aparecem à parte. */
  const total = todos.reduce((s, x) => s + x.valorBase, 0), totalCorrigido = todos.reduce((s, x) => s + x.valor, 0);
  const im = inadimplenciaDoMes(esc0);
  const mesKey = todayStr().slice(0, 7);
  const recuperado = recebiveisDo(esc0).filter(r => r.dataPagamento && monthKey(r.dataPagamento) === mesKey && r.vencimento < r.dataPagamento).reduce((s, r) => s + num(r.valorPago), 0);
  const semCobranca = todos.filter(x => !x.ultima).length;

  const naFaixa = (it, k) => { if (k === 'todas') return true; if (k === 'semcontato') return !it.ultima; const fx = FAIXAS_DIAS.find(x => x[0] === k); return it.dias >= fx[1] && it.dias <= fx[2]; };
  v.innerHTML = `
    ${db.loteamentos.length > 1 ? `<div class="filters">${escopoSelectHtml('renderCobranca()')}</div>` : ''}
    ${barraMesHtml(esc0)}
    ${faixaHtml([['todas', 'Todos']].concat(FAIXAS_DIAS.map(x => [x[0], x[0] + ' dias'])).map(([k, l]) => { const cs = todos.filter(it => naFaixa(it, k)); return { k: k === 'todas' ? 'all' : FAIXAS_DIAS.find(x => x[0] === k)[1] > 30 ? 'atrasado' : 'leve', l, n: cs.length, v: cs.length ? fmtMoneyShort(cs.reduce((t, it) => t + it.valorBase, 0)) : '—', ativo: f.faixa === k, acao: `state.filters.cob.faixa='${k}';renderCobranca()` }; }), 'Contratos em atraso por dias de atraso')}
    <div class="ct-resumo">Em atraso <b class="cob-total">${fmtMoney(total)}</b> em ${todos.length} contrato${todos.length === 1 ? '' : 's'}${totalCorrigido > total + 0.005 ? ` (com multa e juros ${fmtMoney(totalCorrigido)})` : ''} · recuperado no mês ${fmtMoneyShort(recuperado)}${semCobranca ? ` · <button type="button" class="st-semnum ${f.faixa === 'semcontato' ? 'active' : ''}" onclick="state.filters.cob.faixa='${f.faixa === 'semcontato' ? 'todas' : 'semcontato'}';renderCobranca()">${semCobranca} nunca cobrado${semCobranca === 1 ? '' : 's'}</button>` : ''}</div>
    <div class="filters">
      <input type="text" placeholder="Cliente ou imóvel…" value="${esc(f.busca)}" oninput="aSetFiltro('cob','busca',this.value,renderCobranca,this)">
      <button class="btn btn-secondary btn-sm" onclick="state.sub.cad='cobranca';switchTab('cadastros')">Régua</button>
      <button class="btn btn-secondary btn-sm" onclick="exportarInadimplenciaCSV()">CSV</button>
    </div>
    ${lista.length ? `<div class="lista">${lista.map(cobrancaCardHtml).join('')}</div>` : `<div class="empty"><div class="ic"><i class=ico data-i=confetti></i></div><p>${todos.length ? 'Nenhum contrato em atraso nesta faixa.' : 'Nenhum contrato em atraso.'}</p></div>`}`;
}

/* Uma linha por contrato em atraso: desde quando e há quantos dias; quem, qual contrato e
   imóvel, e a última cobrança; quanto, com multa e juros; e as ações da cobrança. */
function cobrancaCardHtml(it) {
  const c = it.venda.cliente;
  const sel = it.dias > 30 ? 'atrasado' : 'vence';
  const canal = it.ultima ? (CANAIS.find(x => x[0] === it.ultima.canal) || [, it.ultima.canal])[1] : '';
  return `<div class="item linha cob-linha atrasado">
    <div class="ct-venc"><div class="ct-data"><span class="tiny muted">venceu</span> ${fmtDate(it.maisAntiga.vencimento)}</div><span class="pill ${sel}">${it.dias} dia${it.dias === 1 ? '' : 's'} de atraso</span></div>
    <div class="info"><div class="title">${esc(c.nome)}</div>
      <div class="ct-pessoa"><i class=ico data-i=file-text></i>${it.venda.numeroContrato ? `Contrato ${esc(it.venda.numeroContrato)} · ` : ''}${it.parcelas.length} parcela${it.parcelas.length === 1 ? '' : 's'} em atraso · ${esc(imovelLabel(it.venda))}</div>
      <div class="meta">${it.ultima ? `<span>Última cobrança em ${fmtDate(it.ultima.data)} (${esc(canal)})${it.nCobrancas > 1 ? ` · ${it.nCobrancas} no total` : ''}${it.ultima.obs ? ` — ${esc(it.ultima.obs)}` : ''}</span>` : '<span class="cob-nunca">Ainda não foi cobrado</span>'}</div>
      <div class="btn-row cob-acoes">
        ${c.telefone ? `<button class="btn btn-wa btn-sm" onclick="abrirCobranca('${it.venda.id}')">Cobrar</button>` : `<button class="btn btn-secondary btn-sm" onclick="abrirCobranca('${it.venda.id}')">Cobrar</button>`}
        <button class="btn btn-secondary btn-sm" onclick="abrirVendaAdmin('${it.venda.id}')">Contrato</button>
        <button class="btn btn-secondary btn-sm" onclick="abrirAntecipacao('${it.venda.id}')">Acordo</button>
        ${it.nCobrancas ? `<button class="btn btn-secondary btn-sm" onclick="historicoCobranca('${it.venda.id}')">Histórico</button>` : ''}
      </div></div>
    <div class="side"><div class="value">${fmtMoney(it.valor)}</div>${it.valor > it.valorBase + 0.01 ? `<div class="tiny muted">principal ${fmtMoney(it.valorBase)}</div><div class="tiny muted">+ ${fmtMoney(it.valor - it.valorBase)} de multa e juros</div>` : ''}</div>
  </div>`;
}

function cobrancaCtx(it) {
  const lot = getLoteamento(it.venda.loteamentoId);
  const c = it.venda.cliente;
  return {
    cliente: c.nome, primeiroNome: (c.nome || '').split(' ')[0], empresa: db.config.empresa || '',
    lote: imovelLabel(it.venda), loteamento: lot ? lot.nome : '',
    parcelas: String(it.parcelas.length), dias: String(it.dias),
    vencimento: fmtDate(it.maisAntiga.vencimento), valor: fmtMoney(it.valor),
    valorPrincipal: fmtMoney(it.valorBase), pix: db.config.pix || ''
  };
}

function abrirCobranca(vendaId) {
  const it = inadimplentes(escopoAtual()).find(x => x.venda.id === vendaId);
  if (!it) { toast('✅', 'Sem atraso', 'Este contrato não tem parcelas vencidas.'); return; }
  const ctx = cobrancaCtx(it);
  const faixa = it.faixa || reguaConfig()[0];
  const texto = docPreencher(faixa.texto, ctx).replace(/__________/g, '');
  const c = it.venda.cliente;
  openModal({
    title: 'Cobrar · ' + esc(c.nome),
    wide: true,
    body: `<p class="small mb">${it.parcelas.length} parcela(s) · ${it.dias} dias de atraso · <b>${fmtMoney(it.valor)}</b> com multa e juros</p>
      <div class="frow"><div class="fg"><label>Etapa da régua</label><select id="cbFaixa" onchange="cbTrocaFaixa('${vendaId}')">${reguaConfig().map(f => `<option value="${f.dias}" ${f.dias === faixa.dias ? 'selected' : ''}>${esc(f.nome)} — a partir de ${f.dias} dias</option>`).join('')}</select></div>
        <div class="fg"><label>Canal</label><select id="cbCanal">${CANAIS.map(([k, l2]) => `<option value="${k}" ${k === 'whatsapp' && !c.telefone ? 'disabled' : ''}>${l2}</option>`).join('')}</select></div></div>
      <div class="fg"><label>Mensagem</label><textarea id="cbTexto" style="min-height:130px">${esc(texto)}</textarea>
        <div class="hint">Pode editar antes de enviar. O texto padrão de cada etapa fica em Configurações › Régua de cobrança.</div></div>
      <div class="fg"><label>Observação interna (opcional)</label><input type="text" id="cbObs" placeholder="Cliente pediu prazo até dia 20"></div>
      <div class="table-wrap"><table class="tbl"><thead><tr><th>Parcela</th><th>Venceu</th><th class="num">Valor</th><th class="num">Atualizado</th></tr></thead>
      <tbody>${it.parcelas.map(r => `<tr><td>${esc(r.descricao)}</td><td>${fmtDate(r.vencimento)}</td><td class="num">${fmtMoney(recRestante(r))}</td><td class="num">${fmtMoney(recAtualizado(r))}</td></tr>`).join('')}</tbody></table></div>`,
    footer: `<button class="btn btn-secondary" onclick="closeModal()">Fechar</button>
      <button class="btn btn-outline" onclick="registrarCobranca('${vendaId}',false)">Só registrar</button>
      ${c.telefone ? `<button class="btn btn-wa" onclick="registrarCobranca('${vendaId}',true)">Abrir WhatsApp e registrar</button>` : ''}`
  });
}
function cbTrocaFaixa(vendaId) {
  const it = inadimplentes(escopoAtual()).find(x => x.venda.id === vendaId); if (!it) return;
  const f = reguaConfig().find(x => String(x.dias) === val('cbFaixa')); if (!f) return;
  setVal('cbTexto', docPreencher(f.texto, cobrancaCtx(it)).replace(/__________/g, ''));
}

function registrarCobranca(vendaId, abrirZap) {
  if (!pode('cobranca.registrar')) { toast('🔒', 'Sem permissão', 'Seu perfil não registra cobranças.', true); return; }
  const it = inadimplentes(escopoAtual()).find(x => x.venda.id === vendaId); if (!it) return;
  const texto = val('cbTexto');
  const canal = val('cbCanal') || 'whatsapp';
  const f = reguaConfig().find(x => String(x.dias) === val('cbFaixa'));
  upsert('cobrancas', {
    id: genId(), vendaId, loteamentoId: it.venda.loteamentoId, data: todayStr(), canal,
    faixa: f ? f.nome : '', dias: it.dias, valor: it.valor, obs: val('cbObs') || '',
    quem: (Cloud.active && Cloud.membro ? Cloud.membro.nome : 'Administração') || 'Administração',
    criadoEm: new Date().toISOString()
  });
  logAct(`Cobrança registrada: ${it.venda.cliente.nome} — ${fmtMoney(it.valor)} (${it.dias} dias)`);
  if (abrirZap && it.venda.cliente.telefone) window.open(waLink(it.venda.cliente.telefone, texto), '_blank');
  closeModal(); renderCurrent();
  toast('✅', 'Cobrança registrada', `${it.venda.cliente.nome} · ${f ? f.nome : ''}`);
}

function historicoCobranca(vendaId) {
  const v = getVenda(vendaId); if (!v) return;
  const list = cobrancasDe(vendaId);
  openModal({
    title: 'Histórico de cobrança',
    body: `<p class="small mb"><b>${esc(v.cliente.nome)}</b> · ${list.length} registro(s)</p>
      ${list.map(c => `<div class="card" style="margin-bottom:8px"><div class="row-between"><div><b>${fmtDate(c.data)}</b> · ${esc((CANAIS.find(x => x[0] === c.canal) || [, c.canal])[1])}${c.faixa ? ` · ${esc(c.faixa)}` : ''}</div><span class="tiny muted">${esc(c.quem || '')}</span></div>
        <div class="small mt">${c.dias ? `${c.dias} dias de atraso · ${fmtMoney(c.valor)}` : ''}${c.obs ? `<br>${esc(c.obs)}` : ''}</div>
        <div class="btn-row mt"><button class="btn btn-outline-danger btn-sm" onclick="excluirCobranca('${c.id}','${vendaId}')">Excluir</button></div></div>`).join('') || '<p class="help">Nada registrado.</p>'}`,
    footer: `<button class="btn btn-secondary" onclick="closeModal()">Fechar</button><button class="btn btn-primary" onclick="abrirCobranca('${vendaId}')">Nova cobrança</button>`
  });
}
function excluirCobranca(id, vendaId) {
  removeRec('cobrancas', id); renderCurrent();
  toast('🗑️', 'Registro excluído', '');
  historicoCobranca(vendaId);
}

function exportarInadimplenciaCSV() {
  const esc0 = escopoAtual();
  const rows = [['Cliente', 'Lote', 'Parcelas em atraso', 'Dias', 'Principal', 'Atualizado', 'Última cobrança', 'Canal', 'Telefone']];
  inadimplentes(esc0).forEach(it => {
    rows.push([it.venda.cliente.nome, imovelShort(it.venda), it.parcelas.length, it.dias, fmtNum(it.valorBase), fmtNum(it.valor),
      it.ultima ? fmtDate(it.ultima.data) : '', it.ultima ? it.ultima.canal : '', it.venda.cliente.telefone || '']);
  });
  download(`inadimplencia-${todayStr()}.csv`, toCSV(rows), 'text/csv');
}

// ================================================================ CADASTRO DA RÉGUA
function cadCobrancaHtml() {
  const r = reguaConfig();
  const salva = Array.isArray(db.config.regua) && db.config.regua.length;
  return `<div class="card"><h2>Régua de cobrança</h2>
    <p class="help">Cada etapa tem um texto pronto, escolhido pelos dias de atraso. Na hora de cobrar, o sistema sugere a etapa certa e você ainda pode editar a mensagem.</p>
    <div class="fg"><label>Chave PIX para as mensagens</label><input type="text" id="cgPix" value="${esc(db.config.pix || '')}" placeholder="CNPJ, telefone ou chave aleatória"></div>
    <p class="help">Campos que você pode usar no texto: <b>{{cliente}}</b>, <b>{{primeiroNome}}</b>, <b>{{lote}}</b>, <b>{{loteamento}}</b>, <b>{{parcelas}}</b>, <b>{{dias}}</b>, <b>{{vencimento}}</b>, <b>{{valor}}</b>, <b>{{valorPrincipal}}</b>, <b>{{empresa}}</b>, <b>{{pix}}</b>.</p>
    ${r.map((f, i) => `<div class="fieldset"><span class="lg">${esc(f.nome)}</span>
      <div class="frow"><div class="fg"><label>Nome da etapa</label><input type="text" id="rgNome${i}" value="${esc(f.nome)}"></div>
        <div class="fg"><label>A partir de quantos dias</label><input type="number" id="rgDias${i}" value="${f.dias}"></div></div>
      <div class="fg"><label>Mensagem</label><textarea id="rgTexto${i}" style="min-height:90px">${esc(f.texto)}</textarea></div></div>`).join('')}
    <div class="btn-row"><button class="btn btn-primary" onclick="salvarRegua(${r.length})">Salvar régua</button>
      ${salva ? `<button class="btn btn-secondary" onclick="restaurarRegua()">Restaurar textos padrão</button>` : ''}</div></div>`;
}
function salvarRegua(n) {
  const regua = [];
  for (let i = 0; i < n; i++) {
    const nome = val('rgNome' + i), texto = val('rgTexto' + i), dias = Math.max(0, Math.round(num(val('rgDias' + i))));
    if (nome && texto) regua.push({ nome, dias, texto });
  }
  if (!regua.length) { toast('⚠️', 'Régua vazia', 'Preencha ao menos uma etapa.', true); return; }
  setConfig({ regua: regua.sort((a, b) => a.dias - b.dias), pix: val('cgPix') });
  renderCurrent(); toast('✅', 'Régua salva', `${regua.length} etapa(s)`);
}
function restaurarRegua() {
  if (!confirm('Voltar aos textos padrão da régua?')) return;
  setConfig({ regua: REGUA_PADRAO });
  renderCurrent(); toast('↩️', 'Textos padrão restaurados', '');
}
