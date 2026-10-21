/* ===== Gestão de Loteamento — área do corretor ===== */
'use strict';

function renderCorretorTab() {
  updateTopbars();
  const tab = state.tab;
  const badge = $('#cBadgeReservas');
  const minhas = db.reservas.filter(r => corretorMatch(r.corretor) && (r.status === 'pendente' || r.status === 'aprovada'));
  badge.style.display = minhas.length ? '' : 'none'; badge.textContent = minhas.length;
  if (tab === 'planta') renderCPlanta();
  else if (tab === 'lotes') renderCLotes();
  else if (tab === 'reservas') renderCReservas();
  else if (tab === 'perfil') renderCPerfil();
}

// ---------------------------------------------------------------- planta
function renderCPlanta() {
  const lot = curLot();
  const v = $('#cv-planta');
  if (!lot) { v.innerHTML = `<div class="empty"><div class="ic"><i class=ico data-i=buildings></i></div><p>Nenhum loteamento cadastrado ainda.<br>Peça ao administrador para cadastrar.</p></div>`; state.plantaCorretor = null; return; }
  const ls = lotesDo(lot.id);
  const cnt = s => ls.filter(l => l.status === s).length;
  if (!state.plantaCorretor || !v.querySelector('.planta-wrap')) {
    v.innerHTML = `
      <div class="status-strip">
        <button type="button" class="pill" onclick="cVerLotes('disponivel')" aria-label="Ver a lista dos lotes disponíveis"><span class="dot disponivel"></span><div><b id="cStDisp">0</b><br>disponíveis</div></button>
        <button type="button" class="pill" onclick="cVerLotes('reservado')" aria-label="Ver a lista dos lotes reservados"><span class="dot reservado"></span><div><b id="cStRes">0</b><br>reservados</div></button>
        <button type="button" class="pill" onclick="cVerLotes('vendido')" aria-label="Ver a lista dos lotes vendidos"><span class="dot vendido"></span><div><b id="cStVend">0</b><br>vendidos</div></button>
      </div>
      <button type="button" class="btn btn-wa btn-block c-enviar-tabela" onclick="abrirTabelaForm()"><i class=ico data-i=whatsapp-logo></i>Enviar tabela de preços</button>
      <div class="filters" style="margin-bottom:8px">
        <input type="text" id="cBuscaLote" placeholder="Ir para o lote (ex.: A 12)…" oninput="cBuscarLote(this.value)">
        <select id="cPlantaModo" onchange="cTrocarModo(this.value)" style="flex:0 0 150px"></select>
      </div>
      <div id="cPlantaBox" class="planta-wrap tall"></div>
      <p class="tiny muted mt">Toque no lote para ver os detalhes. Dois dedos ou a roda do mouse aproximam; no teclado, setas e Enter.</p>
      <div id="cPlantaInfo" class="small muted mt"></div>`;
    state.plantaCorretor = new PlantaView($('#cPlantaBox'), { onLotClick: id => abrirLoteCorretor(id) });
  }
  $('#cStDisp').textContent = cnt('disponivel'); $('#cStRes').textContent = cnt('reservado'); $('#cStVend').textContent = cnt('vendido');
  const hasImg = !!(lot.planta && lot.planta.img);
  const sel = $('#cPlantaModo');
  sel.innerHTML = `<option value="imagem" ${!hasImg ? 'disabled' : ''}>Planta real</option><option value="esquema">▦ Esquemática</option>`;
  const modo = prefs.cModo && (prefs.cModo === 'esquema' || hasImg) ? prefs.cModo : (hasImg ? 'imagem' : 'esquema');
  sel.value = modo; sel.style.display = hasImg ? '' : 'none';
  state.plantaCorretor.setData(lot, ls, modo);
  const semPos = hasImg && modo === 'imagem' ? ls.filter(l => !(l.pts && l.pts.length >= 3)).length : 0;
  $('#cPlantaInfo').innerHTML = `${esc(lot.nome)}${lot.cidade ? ' · ' + esc(lot.cidade) : ''} · ${ls.length} lotes${semPos ? ` · <span style="color:#b45309">${semPos} lote(s) ainda sem posição na planta real — veja na lista ou no modo esquemático</span>` : ''}`;
}
/* Tocar no contador da planta abre a lista já filtrada (ex.: só os disponíveis). */
function cVerLotes(status) {
  state.filters.clotes = Object.assign(state.filters.clotes || { quadra: 'all', ordem: 'quadra', busca: '' }, { status });
  switchTab('lotes');
}
function cTrocarModo(m) { prefs.cModo = m; savePrefs(); renderCPlanta(); }
function cBuscarLote(q) {
  const pv = state.plantaCorretor; if (!pv) return;
  q = q.trim().toLowerCase();
  if (!q) { pv.setHighlight(null); return; }
  const norm = s => String(s).toLowerCase().replace(/\s+/g, '');
  const ls = lotesDo(curLot().id);
  const qn = q.replace(/\s+/g, '').replace(/^q(uadra)?/, '').replace(/l(ote)?/, '');
  const found = ls.filter(l => (norm(l.quadra) + norm(l.numero)) === qn || norm(l.numero) === qn || (norm(l.quadra) + '-' + norm(l.numero)) === qn);
  pv.setHighlight(found.map(l => l.id));
  if (found.length === 1) pv.zoomToLote(found[0].id);
}

// ---------------------------------------------------------------- lista de lotes
function renderCLotes() {
  const lot = curLot(); const v = $('#cv-lotes');
  if (!lot) { v.innerHTML = `<div class="empty"><div class="ic"><i class=ico data-i=buildings></i></div><p>Nenhum loteamento cadastrado.</p></div>`; return; }
  const f = state.filters.clotes = state.filters.clotes || { quadra: 'all', status: 'disponivel', ordem: 'quadra', busca: '' };
  const ls = lotesDo(lot.id);
  const quadras = quadrasDo(lot.id);
  let list = ls.filter(l => (f.quadra === 'all' || l.quadra === f.quadra) && (f.status === 'all' || l.status === f.status) && (!f.busca || loteLabel(l).toLowerCase().includes(f.busca.toLowerCase()) || String(l.numero) === f.busca.trim()));
  if (f.ordem === 'preco') list.sort((a, b) => (a.preco || 0) - (b.preco || 0));
  else if (f.ordem === 'preco-desc') list.sort((a, b) => (b.preco || 0) - (a.preco || 0));
  else if (f.ordem === 'area') list.sort((a, b) => (a.area || 0) - (b.area || 0));
  const cnt = s => ls.filter(l => l.status === s).length;
  v.innerHTML = `
    <div class="row-between mb"><span class="small muted">${esc(lot.nome)}</span><button class="btn btn-secondary btn-sm" onclick="abrirTabelaForm()"><i class=ico data-i=file-text></i>Tabela de preços</button></div>
    <div class="chips">
      ${[['all', 'Todos', ls.length], ['disponivel', 'Disponíveis', cnt('disponivel')], ['reservado', 'Reservados', cnt('reservado')], ['vendido', 'Vendidos', cnt('vendido')]].map(([k, l, n]) => `<div class="chip ${f.status === k ? 'active' : ''}" onclick="cSetFiltro('status','${k}')">${l}<span class="n">${n}</span></div>`).join('')}
    </div>
    <div class="filters">
      <select aria-label="Quadra" onchange="cSetFiltro('quadra',this.value)"><option value="all">Todas as quadras</option>${quadras.map(q => `<option value="${esc(q)}" ${f.quadra === q ? 'selected' : ''}>Quadra ${esc(q)}</option>`).join('')}</select>
      <select aria-label="Ordem" onchange="cSetFiltro('ordem',this.value)">
        <option value="quadra" ${f.ordem === 'quadra' ? 'selected' : ''}>Ordem: quadra/lote</option>
        <option value="preco" ${f.ordem === 'preco' ? 'selected' : ''}>Menor preço</option>
        <option value="preco-desc" ${f.ordem === 'preco-desc' ? 'selected' : ''}>Maior preço</option>
        <option value="area" ${f.ordem === 'area' ? 'selected' : ''}>Menor área</option>
      </select>
      <input type="text" placeholder="Buscar lote…" value="${esc(f.busca)}" oninput="cSetFiltro('busca',this.value,true)">
    </div>
    ${list.length ? list.map(l => loteCardHtml(l, 'abrirLoteCorretor')).join('')
      : !ls.length ? `<div class="empty"><div class="ic"><i class=ico data-i=package></i></div><p>Este loteamento ainda não tem lotes cadastrados.</p><p>Quando o escritório cadastrar, eles aparecem aqui e na planta.</p></div>`
      : `<div class="empty"><div class="ic"><i class=ico data-i=magnifying-glass></i></div><p>Nenhum lote com esses filtros.</p><p><button class="btn btn-secondary btn-sm" onclick="state.filters.clotes={quadra:'all',status:'all',ordem:'${f.ordem}',busca:''};renderCLotes()">Limpar filtros</button></p></div>`}`;
}
function cSetFiltro(k, v, keepFocus) {
  state.filters.clotes[k] = v;
  if (keepFocus) { // re-render sem perder o foco da busca
    const el = document.activeElement; const pos = el && el.selectionStart;
    renderCLotes();
    const n = $('#cv-lotes input[type=text]'); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) {} }
  } else renderCLotes();
}
function loteCardHtml(l, onclick) {
  const m2 = l.area ? l.preco / l.area : 0;
  const mostrarPreco = l.status !== 'vendido' || db.config.mostrarPrecoVendido || state.role === 'admin';
  return `<div class="item ${l.status}" data-st="l:${l.id}" onclick="${onclick}('${l.id}')">
    <div class="info">
      <div class="title">${esc(loteLabel(l))} ${l.tipo === 'comercial' ? '<span class="badge neutral">Comercial</span>' : ''}</div>
      <div class="meta">${[num(l.area) ? `${fmtNum(l.area, 0)} m²` : '', l.frente ? `${fmtNum(l.frente, 1)}m × ${fmtNum(l.fundos || 0, 1)}m` : '', m2 ? `${fmtMoney(m2)}/m²` : '', l.obs ? esc(l.obs) : ''].filter(Boolean).map((t, i) => `<span>${i ? '· ' : ''}${t}</span>`).join('')}</div>
    </div>
    <div class="side"><div class="value${!num(l.preco) ? ' small muted' : ''}">${mostrarPreco ? (num(l.preco) ? fmtMoney(l.preco) : 'Sob consulta') : '—'}</div><span class="badge ${l.status}">${statusLabel(l.status)}</span></div>
  </div>`;
}

// ---------------------------------------------------------------- detalhe do lote (corretor)
function abrirLoteCorretor(id) {
  const l = getLote(id); if (!l) return;
  const lot = getLoteamento(l.loteamentoId);
  const cond = lot.cond || {};
  const res = reservaAtiva(l.id);
  const minha = res && corretorMatch(res.corretor);
  const m2 = l.area ? l.preco / l.area : 0;
  let statusBox = '';
  if (l.status === 'disponivel') statusBox = `<div class="alert ok"><span><b>Disponível</b> para reserva.</span></div>`;
  else if (l.status === 'reservado') statusBox = `<div class="alert warn" style="cursor:default"><span><b>Reservado</b>${minha ? ' por você' : ''}${res ? ` · ${reservaStatus(res) === 'pendente' ? 'aguardando aprovação' : 'até ' + fmtDate(res.validade)}` : ''}.${minha && res ? ` Cliente: ${esc(res.cliente.nome)}` : ''}</span></div>`;
  else if (l.status === 'vendido') statusBox = `<div class="alert" style="cursor:default"><span><b>Vendido.</b> Este lote não está mais disponível.</span></div>`;
  else statusBox = `<div class="alert info" style="cursor:default"><span><b>Indisponível.</b> ${esc(l.obs || 'Lote não comercializável no momento.')}</span></div>`;
  const desc = cond.descontoVistaPct ? `<div class="price-sub">À vista com ${fmtNum(cond.descontoVistaPct, 0)}% de desconto: <b>${fmtMoney(l.preco * (1 - cond.descontoVistaPct / 100))}</b></div>` : '';
  const body = `
    ${statusBox}
    <div class="row-between mb">
      <div><div class="price-big"${!num(l.preco) ? ' style="font-size:1.1rem;color:var(--muted)"' : ''}>${num(l.preco) ? fmtMoney(l.preco) : 'Preço sob consulta'}</div>${m2 ? `<div class="price-sub">${fmtMoney(m2)} por m²</div>` : ''}${num(l.preco) ? desc : ''}</div>
    </div>
    <div class="detail-grid">
      <div><div class="k">Área</div><div class="v">${fmtNum(l.area, 2)} m²</div></div>
      <div><div class="k">Tipo</div><div class="v">${l.tipo === 'comercial' ? 'Comercial' : 'Residencial'}</div></div>
      ${l.frente ? `<div><div class="k">Frente</div><div class="v">${fmtNum(l.frente, 2)} m</div></div><div><div class="k">Fundos / lateral</div><div class="v">${fmtNum(l.fundos || 0, 2)} m</div></div>` : ''}
      ${l.matricula ? `<div><div class="k">Matrícula</div><div class="v">${esc(l.matricula)}</div></div>` : ''}
      ${l.obs && l.status !== 'bloqueado' ? `<div class="full"><div class="k">Observações</div><div class="v">${esc(l.obs)}</div></div>` : ''}
    </div>
    ${simuladorHtml(l, cond)}
    ${lot.descricao ? `<p class="small muted mt">${esc(lot.descricao)}</p>` : ''}`;
  let footer = `<button class="btn btn-secondary" onclick="compartilharLote('${l.id}')"><i class=ico data-i=whatsapp-logo></i>Compartilhar</button>`;
  if (l.status !== 'vendido' && l.status !== 'bloqueado') footer += `<button class="btn btn-outline" onclick="abrirPropostaForm('${l.id}')">Proposta</button>`;
  if (l.status === 'disponivel') footer += `<button class="btn btn-primary" onclick="abrirReservaForm('${l.id}')">Solicitar reserva</button>`;
  else if (minha && res && res.status === 'pendente') footer += `<button class="btn btn-outline-danger" onclick="cancelarMinhaReserva('${res.id}')">Cancelar pedido</button>`;
  openModal({ title: `${esc(loteLabel(l))}`, body, footer });
  simular(l.id);
}
function simuladorHtml(l, cond) {
  const entradaMin = Math.round(l.preco * (num(cond.entradaMinPct) || 0) / 100);
  const maxP = Number(cond.maxParcelas) || 120;
  return `<div class="sim-box">
    <div class="lg" style="font-size:0.78rem;font-weight:800;color:var(--primary);margin-bottom:8px">Simulador de pagamento</div>
    <div class="sim-result" id="simResult"></div>
    <div class="frow">
      <div class="fg"><label>Entrada (R$)${cond.entradaMinPct ? ` · mín. ${fmtNum(cond.entradaMinPct, 0)}%` : ''}</label><input type="number" id="simEntrada" value="${entradaMin}" min="0" step="100" oninput="simular('${l.id}')"></div>
      <div class="fg"><label>Parcelas (até ${maxP}×)</label><input type="number" id="simParcelas" value="${Math.min(60, maxP)}" min="1" max="${maxP}" oninput="simular('${l.id}')"></div>
    </div>
    <div class="tiny muted mt">${cond.jurosMes ? `Juros de ${fmtNum(cond.jurosMes, 2)}% ao mês (tabela Price).` : 'Parcelas sem juros.'} Valores para simulação; a proposta final é definida pela administração.</div>
  </div>`;
}
/* Parcela da proposta de reserva: a mesma conta do simulador que o corretor mostrou ao cliente
   (tabela Price com os juros do empreendimento). Os juros ficam gravados na proposta; reserva
   antiga, sem eles, usa os juros atuais do empreendimento. */
function jurosDaProposta(r) {
  const p = r.proposta || {}; if (p.jurosMes !== undefined && p.jurosMes !== null) return num(p.jurosMes);
  const lot = getLoteamento(r.loteamentoId); return num(((lot && lot.cond) || {}).jurosMes);
}
function parcelaDaProposta(r) {
  const p = r.proposta || {}; const n = Math.round(num(p.nParcelas)); if (!n) return 0;
  return Math.round(pmt(jurosDaProposta(r) / 100, n, Math.max(0, num(p.valor) - num(p.entrada))) * 100) / 100;
}
function simular(loteId) {
  const l = getLote(loteId); const lot = getLoteamento(l.loteamentoId); const cond = lot.cond || {};
  const entrada = num(val('simEntrada')), n = Math.max(1, Math.round(num(val('simParcelas')) || 1));
  const saldo = Math.max(0, l.preco - entrada);
  const parcela = pmt((num(cond.jurosMes) || 0) / 100, n, saldo);
  const total = entrada + parcela * n;
  const box = $('#simResult'); if (!box) return;
  const avisoEntrada = cond.entradaMinPct && entrada < l.preco * cond.entradaMinPct / 100 ? `<div style="color:#b45309" class="tiny">Entrada abaixo do mínimo de ${fmtNum(cond.entradaMinPct, 0)}% (${fmtMoney(l.preco * cond.entradaMinPct / 100)}).</div>` : '';
  box.innerHTML = `Entrada de <b>${fmtMoney(entrada)}</b> + <b>${n}×</b> de <b>${fmtMoney(parcela)}</b><br><span class="tiny muted">Saldo financiado ${fmtMoney(saldo)} · Total ${fmtMoney(total)}</span>${avisoEntrada}`;
}
function compartilharLote(id) {
  const l = getLote(id); const lot = getLoteamento(l.loteamentoId); const cond = lot.cond || {};
  const p = corretorPerfil();
  const entrada = num(val('simEntrada')), n = Math.round(num(val('simParcelas')) || 0);
  let txt = `*${lot.nome}*${lot.cidade ? ' — ' + lot.cidade : ''}\n📍 ${loteLabel(l)}\n📐 ${fmtNum(l.area, 2)} m²${l.frente ? ` (${fmtNum(l.frente, 1)} × ${fmtNum(l.fundos || 0, 1)} m)` : ''}\n💰 ${fmtMoney(l.preco)}`;
  if (cond.descontoVistaPct) txt += `\n💵 À vista: ${fmtMoney(l.preco * (1 - cond.descontoVistaPct / 100))} (${fmtNum(cond.descontoVistaPct, 0)}% desc.)`;
  if (n > 0) txt += `\n🧮 Simulação: entrada ${fmtMoney(entrada)} + ${n}× ${fmtMoney(pmt((num(cond.jurosMes) || 0) / 100, n, Math.max(0, l.preco - entrada)))}`;
  if (lot.descricao) txt += `\n\n${lot.descricao}`;
  if (p.nome) txt += `\n\n${p.nome}${p.creci ? ' · CRECI ' + p.creci : ''}${p.telefone ? ' · ' + p.telefone : ''}`;
  if (navigator.share) navigator.share({ title: loteLabel(l), text: txt }).catch(() => {});
  else window.open('https://wa.me/?text=' + encodeURIComponent(txt), '_blank');
}

// ---------------------------------------------------------------- pedido de reserva
function abrirReservaForm(loteId) {
  const l = getLote(loteId); if (!l || l.status !== 'disponivel') { toast('⚠️', 'Lote não está disponível', '', true); return; }
  const lot = getLoteamento(l.loteamentoId); const cond = lot.cond || {};
  const p = corretorPerfil();
  const entrada = num(val('simEntrada')) || Math.round(l.preco * (num(cond.entradaMinPct) || 10) / 100);
  const nP = Math.round(num(val('simParcelas'))) || Math.min(60, Number(cond.maxParcelas) || 60);
  /* Só o essencial (decisão do dono, 15/10): o corretor está com o cliente do lado. Nome e
     telefone do cliente e a proposta; CPF, e-mail e cidade são opcionais e ficam recolhidos; a
     qualificação completa (profissão, estado civil, endereço) é pedida pelo escritório no contrato.
     Os dados do próprio corretor vêm do perfil e só abrem se faltar algo. */
  const temPerfil = !!(p.nome && p.telefone);
  const rasc = rascunhoReserva(loteId);
  const v = (k, padrao = '') => esc(rasc && rasc[k] !== undefined ? rasc[k] : padrao);
  const body = `
    ${rasc ? '<div class="alert warn" style="cursor:default"><span>Recuperamos o pedido que não chegou a ser enviado. Confira e toque em <b>Enviar pedido</b>.</span></div>' : ''}
    <p class="small muted mb">${esc(loteLabel(l))} · tabela ${fmtMoney(l.preco)}. Depois de aprovada, a reserva vale ${db.config.reservaDias} dias.</p>
    <div class="fieldset"><span class="lg">Cliente</span>
      <div class="fg"><label>Nome *</label><input type="text" id="rlNome" autocomplete="off" value="${v('rlNome')}"></div>
      <div class="fg"><label>Telefone / WhatsApp *</label><input type="tel" id="rlTel" placeholder="(00) 00000-0000" value="${v('rlTel')}"></div>
      <details class="qualif"><summary>CPF, e-mail e cidade (opcional)</summary>
        <div class="fg" style="margin-top:12px"><label>CPF / CNPJ</label><input type="text" id="rlCpf" inputmode="numeric" placeholder="000.000.000-00" value="${v('rlCpf')}"></div>
        <div class="frow"><div class="fg"><label>E-mail</label><input type="email" id="rlEmail" value="${v('rlEmail')}"></div><div class="fg"><label>Cidade</label><input type="text" id="rlCidade" value="${v('rlCidade')}"></div></div>
      </details>
    </div>
    <div class="fieldset"><span class="lg">Proposta</span>
      <div class="frow3">
        <div class="fg"><label>Valor (R$)</label><input type="number" id="rpValor" inputmode="decimal" value="${v('rpValor', l.preco)}" step="100" min="0"></div>
        <div class="fg"><label>Entrada (R$)</label><input type="number" id="rpEntrada" inputmode="decimal" value="${v('rpEntrada', entrada)}" step="100" min="0"></div>
        <div class="fg"><label>Parcelas</label><input type="number" id="rpParcelas" inputmode="numeric" value="${v('rpParcelas', nP)}" min="0" max="${Number(cond.maxParcelas) || 999}"></div>
      </div>
      <div class="fg"><label>Observações</label><textarea id="rpObs" placeholder="Ex.: visita no sábado, vai financiar a entrada…">${v('rpObs')}</textarea></div>
    </div>
    <details class="qualif" id="rcDados"${temPerfil ? '' : ' open'}><summary>${temPerfil ? `Corretor: ${esc(p.nome)}${p.creci ? ' · ' + esc(p.creci) : ''} · alterar` : 'Seus dados (corretor) *'}</summary>
      <div class="fg" style="margin-top:12px"><label>Nome completo *</label><input type="text" id="rcNome" value="${v('rcNome', p.nome)}"></div>
      <div class="frow"><div class="fg"><label>CRECI</label><input type="text" id="rcCreci" value="${v('rcCreci', p.creci)}" placeholder="UF-00000"></div><div class="fg"><label>Telefone / WhatsApp *</label><input type="tel" id="rcTel" value="${v('rcTel', p.telefone)}" placeholder="(00) 00000-0000"></div></div>
      <div class="frow"><div class="fg"><label>E-mail</label><input type="email" id="rcEmail" value="${v('rcEmail', p.email)}"></div><div class="fg"><label>Imobiliária</label><input type="text" id="rcImob" value="${v('rcImob', p.imobiliaria)}"></div></div>
    </details>`;
  openModal({ title: 'Solicitar reserva', body, footer: `<button class="btn btn-secondary" onclick="abrirLoteCorretor('${l.id}')">Voltar</button><button class="btn btn-primary" onclick="enviarReserva('${l.id}')">Enviar pedido</button>` });
  focarSeLivre(temPerfil ? 'rlNome' : 'rcNome');
}
/* Pedido que não chegou (sem sinal): fica guardado neste aparelho, por lote, até ser enviado. */
const CAMPOS_RESERVA = ['rlNome', 'rlTel', 'rlCpf', 'rlEmail', 'rlCidade', 'rpValor', 'rpEntrada', 'rpParcelas', 'rpObs', 'rcNome', 'rcCreci', 'rcTel', 'rcEmail', 'rcImob'];
function rascunhoReserva(loteId) {
  try { const r = JSON.parse(localStorage.getItem('gl_reserva_rascunho') || 'null'); return r && r.loteId === loteId ? r.campos : null; } catch (e) { return null; }
}
function guardarRascunhoReserva(loteId) {
  const campos = {}; CAMPOS_RESERVA.forEach(k => { const el = document.getElementById(k); if (el) campos[k] = el.value; });
  try { localStorage.setItem('gl_reserva_rascunho', JSON.stringify({ loteId, campos })); } catch (e) {}
}
function apagarRascunhoReserva() { try { localStorage.removeItem('gl_reserva_rascunho'); } catch (e) {} }
async function enviarReserva(loteId) {
  const l = getLote(loteId);
  if (!l || l.status !== 'disponivel') { toast('⚠️', 'Este lote acabou de ficar indisponível', '', true); closeModal(); renderCurrent(); return; }
  const corretor = { nome: val('rcNome'), creci: val('rcCreci'), telefone: val('rcTel'), email: val('rcEmail'), imobiliaria: val('rcImob') };
  const cliente = { nome: val('rlNome'), cpf: val('rlCpf'), telefone: val('rlTel'), email: val('rlEmail'), cidade: val('rlCidade') };
  if (!corretor.nome || !corretor.telefone) { const d = document.getElementById('rcDados'); if (d) d.open = true; toast('⚠️', 'Informe seu nome e telefone', 'Em “Seus dados (corretor)”, no fim do pedido.', true); return; }
  if (!cliente.nome || !cliente.telefone) { toast('⚠️', 'Informe nome e telefone do cliente', '', true); return; }
  if (!Cloud.active && state.role === 'corretor') { prefs.corretor = corretor; savePrefs(); }
  registrarCorretor(corretor);
  const hoje = todayStr();
  const r = { id: genId(), loteId, loteamentoId: l.loteamentoId, corretor, cliente, dataReserva: hoje, validade: addDays(hoje, Number(db.config.reservaDias) || 7),
    status: 'pendente', proposta: { valor: num(val('rpValor')), entrada: num(val('rpEntrada')), nParcelas: Math.round(num(val('rpParcelas'))), jurosMes: num((getLoteamento(l.loteamentoId).cond || {}).jurosMes) }, obs: val('rpObs'), criadoEm: new Date().toISOString() };
  if (Cloud.active) {
    // na nuvem a reserva é criada pelo banco (evita dois corretores no mesmo lote)
    corretor.userId = Cloud.user.id; r.corretorUserId = Cloud.user.id;
    const btn = $('#modalFoot .btn-primary'); botaoOcupado(btn, 'Enviando…');
    try { await Cloud.solicitarReserva(r); }
    catch (e) {
      botaoOcupado(btn);
      if (/disponível/.test(e.message)) { apagarRascunhoReserva(); toast('⚠️', 'Não foi possível reservar', e.message, true); closeModal(); Cloud.loadAll().then(renderCurrent); return; }
      /* Sem sinal (ou o servidor não respondeu): nada se perde. O pedido fica guardado neste
         aparelho e volta preenchido quando o corretor abrir a reserva deste lote de novo. */
      guardarRascunhoReserva(loteId);
      const semSinal = !navigator.onLine || /fetch|network|rede|timeout|Failed/i.test(e.message || '');
      toast('⚠️', semSinal ? 'Sem sinal: o pedido não foi enviado' : 'O pedido não foi enviado', semSinal ? 'Ele ficou guardado neste celular. Toque em Enviar pedido quando o sinal voltar.' : `Ele ficou guardado neste celular. Tente de novo em instantes. (${e.message || 'erro desconhecido'})`, true);
      return;
    }
    // reflete localmente; o tempo real confirma em seguida
    db.reservas.push(r); const li = db.lotes.findIndex(x => x.id === l.id); if (li >= 0) db.lotes[li] = Object.assign({}, l, { status: 'reservado', reservaId: r.id }); saveLocal();
    if (!Cloud.membro.telefone || !Cloud.membro.nome) Cloud.atualizarMeuPerfil({ nome: corretor.nome, telefone: corretor.telefone, creci: corretor.creci, imobiliaria: corretor.imobiliaria }).then(() => Cloud.loadEquipe()).catch(() => {});
  } else {
    upsert('reservas', r);
    upsert('lotes', Object.assign({}, l, { status: 'reservado', reservaId: r.id }));
    logAct(`Reserva solicitada: ${loteLabel(l)} — cliente ${cliente.nome} (corretor ${corretor.nome})`, corretor.nome);
  }
  apagarRascunhoReserva();
  closeModal();
  renderCurrent();
  const lot = getLoteamento(l.loteamentoId);
  const msg = `Olá! Solicitei a reserva do ${loteLabel(l)} (${lot.nome}) para o cliente ${cliente.nome}. Proposta: ${fmtMoney(r.proposta.valor)}, entrada ${fmtMoney(r.proposta.entrada)} + ${r.proposta.nParcelas}x de ${fmtMoney(parcelaDaProposta(r))}. Corretor: ${corretor.nome}${corretor.creci ? ' CRECI ' + corretor.creci : ''}.`;
  openModal({ title: 'Pedido enviado', body: `<p class="small">O lote <b>${esc(loteLabel(l))}</b> ficou marcado como <span class="badge reservado">Reservado</span> aguardando aprovação do administrador.</p><p class="small muted mt">Você acompanha o andamento na aba <b>Reservas</b>.</p>`,
    footer: `${db.config.adminWhatsapp ? `<a class="btn btn-wa" href="${waLink(db.config.adminWhatsapp, msg)}" target="_blank">Avisar administrador</a>` : ''}<button class="btn btn-primary" onclick="closeModal()">OK</button>` });
}
async function cancelarMinhaReserva(id) {
  const r = getReserva(id); if (!r) return;
  if (!(await confirmar({ titulo: 'Cancelar o pedido de reserva deste lote?', acao: 'Cancelar pedido', cancelar: 'Voltar', perigo: true }))) return;
  if (Cloud.active && !Cloud.admin) {
    try { await Cloud.cancelarMinhaReserva(id, 'Corretor cancelou o pedido'); } catch (e) { toast('⚠️', 'Não foi possível cancelar', e.message, true); return; }
    const ri = db.reservas.findIndex(x => x.id === id); if (ri >= 0) db.reservas[ri] = Object.assign({}, r, { status: 'cancelada' });
    const l = getLote(r.loteId); if (l && l.reservaId === id) { const li = db.lotes.findIndex(x => x.id === l.id); db.lotes[li] = Object.assign({}, l, { status: 'disponivel', reservaId: null }); }
    saveLocal(); closeModal(); renderCurrent(); toast('↩️', 'Pedido cancelado', ''); return;
  }
  liberarReserva(r, 'cancelada', 'Corretor cancelou o pedido');
  closeModal(); renderCurrent();
  toast('↩️', 'Pedido cancelado', '');
}
function liberarReserva(r, novoStatus, motivo) {
  const upd = Object.assign({}, r, { status: novoStatus, encerradaEm: new Date().toISOString(), motivo: motivo || '' });
  upsert('reservas', upd);
  const l = getLote(r.loteId);
  if (l && l.status === 'reservado' && l.reservaId === r.id) upsert('lotes', Object.assign({}, l, { status: 'disponivel', reservaId: null }));
  logAct(`Reserva ${statusLabel(novoStatus).toLowerCase()}: ${l ? loteLabel(l) : ''} — ${r.cliente.nome}${motivo ? ' (' + motivo + ')' : ''}`);
}

// ---------------------------------------------------------------- minhas reservas
function renderCReservas() {
  const v = $('#cv-reservas'); const p = corretorPerfil();
  if (!Cloud.active && !p.telefone && !p.creci) {
    v.innerHTML = `<div class="empty"><div class="ic"><i class=ico data-i=user></i></div><p>Preencha seu perfil (telefone ou CRECI) para ver suas reservas.<br><br><button class="btn btn-primary btn-sm" onclick="switchTab('perfil')">Preencher perfil</button></p></div>`; return;
  }
  const list = db.reservas.filter(r => corretorMatch(r.corretor)).sort((a, b) => (b.criadoEm || '').localeCompare(a.criadoEm || ''));
  const vendas = db.vendas.filter(vd => corretorMatch(vd.corretor) && vd.status !== 'distrato');
  v.innerHTML = `
    <div class="kpi-grid cols3">
      <div class="kpi c-amber"><div class="lbl">Reservas ativas</div><div class="val">${list.filter(r => ['pendente', 'aprovada'].includes(reservaStatus(r))).length}</div></div>
      <div class="kpi c-green"><div class="lbl">Vendas</div><div class="val">${vendas.length}</div><div class="sub">${fmtMoneyShort(vendas.reduce((s, x) => s + num(x.valorTotal), 0))}</div></div>
      <div class="kpi c-primary"><div class="lbl">Comissões</div><div class="val">${fmtMoneyShort(vendas.reduce((s, x) => s + num(x.comissaoValor), 0))}</div><div class="sub">${fmtMoneyShort(vendas.filter(x => x.comissaoPaga).reduce((s, x) => s + num(x.comissaoValor), 0))} pagas</div></div>
    </div>
    ${list.length ? list.map(r => reservaCardHtml(r, false)).join('') : `<div class="empty"><div class="ic"><i class=ico data-i=note-pencil></i></div><p>Você ainda não tem reservas.<br>Toque em um lote disponível na planta para solicitar.</p></div>`}`;
}
function reservaCardHtml(r, admin) {
  const l = getLote(r.loteId); const st = reservaStatus(r);
  const dias = r.validade ? daysBetween(todayStr(), r.validade) : null;
  return `<div class="item ${st}" onclick="${admin ? 'abrirReservaAdmin' : 'abrirReservaCorretor'}('${r.id}')">
    <div class="info">
      <div class="title">${l ? esc(loteLabel(l)) : 'Lote removido'} · ${esc(r.cliente.nome)}</div>
      <div class="meta">
        ${admin ? `<span>${esc(r.corretor.nome)}${r.corretor.imobiliaria ? ' (' + esc(r.corretor.imobiliaria) + ')' : ''}</span>` : ''}
        <span>${fmtDate(r.dataReserva)}</span>
        ${['pendente', 'aprovada'].includes(st) && dias !== null ? `<span>· ${dias < 0 ? 'vencida' : dias === 0 ? 'vence hoje' : 'vence em ' + dias + 'd'}</span>` : ''}
        ${r.proposta ? `<span>· ${fmtMoney(r.proposta.valor)} (${fmtMoney(r.proposta.entrada)} + ${r.proposta.nParcelas}×)</span>` : ''}
      </div>
    </div>
    <div class="side"><span class="badge ${st}">${statusLabel(st)}</span></div>
  </div>`;
}
function abrirReservaCorretor(id) {
  const r = getReserva(id); if (!r) return; const l = getLote(r.loteId); const st = reservaStatus(r);
  const body = `${reservaDetalheHtml(r)}`;
  let footer = `<button class="btn btn-secondary" onclick="closeModal()">Fechar</button>`;
  if (st === 'pendente') footer += `<button class="btn btn-outline-danger" onclick="cancelarMinhaReserva('${r.id}')">Cancelar pedido</button>`;
  if (l) footer += `<button class="btn btn-primary" onclick="abrirLoteCorretor('${l.id}')">Ver lote</button>`;
  openModal({ title: `Reserva · ${l ? esc(loteShort(l)) : ''}`, body, footer });
}
/* Detalhe da reserva. A decisão vem primeiro: a proposta, comparada com a tabela (preço, entrada
   mínima, prazo máximo), com a mesma parcela que o corretor mostrou ao cliente. Os dados do
   lote, do cliente e do corretor ficam embaixo, para conferir. */
function reservaDetalheHtml(r) {
  const l = getLote(r.loteId); const st = reservaStatus(r); const c = r.cliente; const k = r.corretor;
  const lot = getLoteamento(r.loteamentoId); const cond = (lot && lot.cond) || {};
  return `
    <div class="row-between mb"><span class="badge ${st}">${statusLabel(st)}</span><span class="small muted">Pedido em ${fmtDate(r.dataReserva)} · válida até ${fmtDate(r.validade)}</span></div>
    ${r.motivo ? `<div class="alert info" style="cursor:default"><span>${esc(r.motivo)}</span></div>` : ''}
    <p class="rs-quem"><b>${l ? esc(loteLabel(l)) : '—'}</b> para <b>${esc(c.nome)}</b> · corretor ${esc(k.nome)}${k.creci ? ' · ' + esc(k.creci) : ''}</p>
    ${r.proposta ? propostaHtml(r, l, cond) : '<p class="help mb">Pedido sem proposta de valores.</p>'}
    <details class="qualif"><summary>Dados do lote, do cliente e do corretor</summary>
      <div class="detail-grid" style="margin-top:12px">
        <div><div class="k">Lote</div><div class="v">${l ? esc(loteLabel(l)) : '—'}</div></div><div><div class="k">Área</div><div class="v">${l && num(l.area) ? fmtNum(l.area, 0) + ' m²' : '—'}</div></div>
        <div><div class="k">Situação atual do lote</div><div class="v">${l ? statusLabel(l.status) : '—'}</div></div><div></div>
        <div><div class="k">Cliente</div><div class="v">${esc(c.nome)}</div></div><div><div class="k">CPF/CNPJ</div><div class="v">${esc(fmtCPF(c.cpf)) || '—'}</div></div>
        <div><div class="k">Telefone</div><div class="v">${c.telefone ? `<a href="${waLink(c.telefone, '')}" target="_blank">${esc(fmtPhone(c.telefone))}</a>` : '—'}</div></div><div><div class="k">E-mail</div><div class="v">${esc(c.email) || '—'}</div></div>
        <div class="full"><div class="k">Endereço</div><div class="v">${esc([c.endereco, c.cidade].filter(Boolean).join(' · ')) || '—'}</div></div>
        ${c.profissao || c.estadoCivil ? `<div><div class="k">Profissão</div><div class="v">${esc(c.profissao) || '—'}</div></div><div><div class="k">Estado civil</div><div class="v">${esc(c.estadoCivil) || '—'}</div></div>` : ''}
        <div><div class="k">Corretor</div><div class="v">${esc(k.nome)}</div></div><div><div class="k">CRECI</div><div class="v">${esc(k.creci) || '—'}</div></div>
        <div><div class="k">Telefone do corretor</div><div class="v">${k.telefone ? `<a href="${waLink(k.telefone, '')}" target="_blank">${esc(fmtPhone(k.telefone))}</a>` : '—'}</div></div><div><div class="k">Imobiliária</div><div class="v">${esc(k.imobiliaria) || '—'}</div></div>
      </div></details>`;
}
/* A proposta ao lado da tabela: quanto o valor difere do preço, quanto a entrada representa e se
   respeita o mínimo, e se o prazo cabe no máximo do empreendimento. */
function propostaHtml(r, l, cond) {
  const p = r.proposta, preco = l ? num(l.preco) : 0, valor = num(p.valor), entrada = num(p.entrada), n = Math.round(num(p.nParcelas));
  const dif = preco ? (valor - preco) / preco * 100 : 0;
  const pctEnt = valor ? entrada / valor * 100 : 0;
  const entMin = num(cond.entradaMinPct), maxP = Number(cond.maxParcelas) || 0;
  const avisos = [];
  if (entMin && pctEnt + 0.05 < entMin) avisos.push(`entrada abaixo do mínimo de ${fmtNum(entMin, 0)}%`);
  if (maxP && n > maxP) avisos.push(`prazo acima do máximo de ${maxP} parcelas`);
  return `<div class="rs-proposta">
      <div class="rs-linha"><span class="k">Valor proposto</span><span class="v">${fmtMoney(valor)}</span>
        <span class="rs-cmp ${Math.abs(dif) < 0.05 ? '' : dif < 0 ? 'abaixo' : 'acima'}">${!preco ? 'sem preço de tabela' : Math.abs(dif) < 0.05 ? 'igual à tabela' : `${dif < 0 ? '−' : '+'}${fmtNum(Math.abs(dif), 1)}% da tabela (${fmtMoney(preco)})`}</span></div>
      <div class="rs-linha"><span class="k">Entrada</span><span class="v">${fmtMoney(entrada)}</span><span class="rs-cmp">${fmtNum(pctEnt, 1)}% do valor${entMin ? ` · mínimo ${fmtNum(entMin, 0)}%` : ''}</span></div>
      ${n ? `<div class="rs-linha"><span class="k">Parcelas</span><span class="v">${n}× ${fmtMoney(parcelaDaProposta(r))}</span><span class="rs-cmp">${jurosDaProposta(r) ? `tabela Price, ${fmtNum(jurosDaProposta(r), 2)}% a.m.` : 'sem juros'}${maxP ? ` · máximo ${maxP}×` : ''}</span></div>` : `<div class="rs-linha"><span class="k">Parcelas</span><span class="v">à vista</span><span class="rs-cmp"></span></div>`}
      ${r.obs ? `<div class="rs-obs">${esc(r.obs)}</div>` : ''}
      ${avisos.length ? `<div class="rs-aviso"><i class=ico data-i=warning></i><span>Fora das condições: ${avisos.join('; ')}.</span></div>` : ''}
    </div>`;
}

// ---------------------------------------------------------------- perfil do corretor
function renderCPerfil() {
  const p = corretorPerfil(); const v = $('#cv-perfil');
  v.innerHTML = `
    <div class="card"><h2>Meus dados</h2>
      <p class="help mb">${Cloud.active ? 'Esses dados aparecem para a administração e são preenchidos automaticamente nos pedidos de reserva.' : 'Esses dados são preenchidos automaticamente nos pedidos de reserva e ficam salvos neste aparelho.'}</p>
      <div class="fg"><label>Nome completo</label><input type="text" id="pfNome" value="${esc(p.nome)}"></div>
      <div class="frow"><div class="fg"><label>CRECI</label><input type="text" id="pfCreci" value="${esc(p.creci)}"></div><div class="fg"><label>Telefone / WhatsApp</label><input type="tel" id="pfTel" value="${esc(p.telefone)}"></div></div>
      <div class="frow"><div class="fg"><label>E-mail</label><input type="email" id="pfEmail" value="${esc(p.email)}"></div><div class="fg"><label>Imobiliária</label><input type="text" id="pfImob" value="${esc(p.imobiliaria)}"></div></div>
      <button class="btn btn-primary btn-block" onclick="salvarPerfil()">Salvar</button>
    </div>
    <div class="card"><h2>ℹ️ Sobre o empreendimento</h2>${(() => { const lot = curLot(); if (!lot) return '<p class="help">Nenhum loteamento.</p>'; const c = lot.cond || {}; return `<p class="help"><b>${esc(lot.nome)}</b>${lot.cidade ? ' · ' + esc(lot.cidade) : ''}${lot.endereco ? '<br>' + esc(lot.endereco) : ''}${lot.descricao ? '<br><br>' + esc(lot.descricao) : ''}</p>
      <div class="detail-grid mt"><div><div class="k">Entrada mínima</div><div class="v">${fmtNum(c.entradaMinPct || 0, 0)}%</div></div><div><div class="k">Parcelas máx.</div><div class="v">${c.maxParcelas || '—'}×</div></div><div><div class="k">Juros</div><div class="v">${c.jurosMes ? fmtNum(c.jurosMes, 2) + '% a.m.' : 'Sem juros'}</div></div><div><div class="k">Desconto à vista</div><div class="v">${fmtNum(c.descontoVistaPct || 0, 0)}%</div></div><div><div class="k">Validade da reserva</div><div class="v">${db.config.reservaDias} dias</div></div><div><div class="k">Comissão</div><div class="v">${fmtNum(db.config.comissaoPct, 1)}%</div></div></div>`; })()}
      ${db.config.adminWhatsapp ? `<a class="btn btn-wa btn-block mt" href="${waLink(db.config.adminWhatsapp, 'Olá! Sou corretor e tenho uma dúvida sobre o loteamento.')}" target="_blank">Falar com a administração</a>` : ''}
    </div>
    <div class="card">${Cloud.active ? `<p class="help mb">Conectado como <b>${esc(Cloud.user.email || '')}</b> · empresa <b>${esc(Cloud.org.nome)}</b> · <span class="badge neutral">${statusLabel(Cloud.papel)}</span></p><div class="btn-row"><button class="btn btn-outline" onclick="renderAuthNovaSenhaModal()">Alterar senha</button>${Cloud.minhasOrgs.length > 1 ? '<button class="btn btn-secondary" onclick="trocarEmpresa()">Trocar de empresa</button>' : ''}${Cloud.admin ? '<button class="btn btn-primary" onclick="voltarAdmin()">Voltar à administração</button>' : ''}<button class="btn btn-secondary" onclick="sair()">Sair</button></div>` : `<button class="btn btn-secondary btn-block" onclick="sair()">Sair da área do corretor</button>`}</div>`;
}
async function salvarPerfil() {
  const d = { nome: val('pfNome'), creci: val('pfCreci'), telefone: val('pfTel'), email: val('pfEmail'), imobiliaria: val('pfImob') };
  if (Cloud.active) {
    try { await Cloud.atualizarMeuPerfil(d); Object.assign(Cloud.membro, d); await Cloud.loadEquipe(); toast('✅', 'Perfil salvo', ''); renderCorretorTab(); }
    catch (e) { toast('⚠️', 'Falha ao salvar', e.message, true); }
    return;
  }
  prefs.corretor = d;
  savePrefs();
  if (prefs.corretor.nome && prefs.corretor.telefone) registrarCorretor(prefs.corretor);
  toast('✅', 'Perfil salvo', '');
  renderCorretorTab();
}
