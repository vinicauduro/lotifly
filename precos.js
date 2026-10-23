/* ===== Atualização dos preços de venda =====
   Cada empreendimento (os lotes dele) ou imóvel avulso pode ter atualização mensal do preço:
   um percentual ao mês, um valor em reais somado a cada lote, ou um índice (CUB, IGP-M…, os
   de Financeiro › Índices). E, a qualquer hora, a atualização manual: de um empreendimento,
   dos imóveis selecionados ou de todos os imóveis da empresa.

   Vale para o que não foi vendido: lotes disponíveis, bloqueados e reservados (a reserva já
   feita guarda o valor da proposta) e o imóvel avulso sem contrato ativo.

   A mensal fica em config.reajusteAuto[idDoImovel] = { ativo, modo: 'pct'|'valor'|'indice',
   pct, valor, indiceId, arredondar, desde: 'AAAA-MM', ultimoMes, ultimo: { mes, texto } }.
   Percentual e valor entram no dia 1º de cada mês; o índice, assim que o do mês anterior for
   lançado (o índice de um mês sai no seguinte). Se o app ficou sem abrir, os meses que
   faltaram entram um a um, na ordem. Índice que cai não reduz o preço, como nos contratos. */
'use strict';

const MODOS_REAJUSTE = [['pct', 'Percentual ao mês'], ['valor', 'Valor somado a cada lote (R$)'], ['indice', 'Índice']];
const ST_REAJUSTE = ['disponivel', 'bloqueado', 'reservado'];

function reajusteCfg(lotId) { return ((db.config.reajusteAuto || {})[lotId]) || null; }
function podeAtualizarPrecos() { return pode('lotes.preco') && (!Cloud.active || pode('config.editar')); }

/* O que muda de preço num imóvel: os lotes dele que não foram vendidos, ou o próprio imóvel
   avulso, se ainda não tem contrato. opc.status: lista de situações (padrão: ST_REAJUSTE). */
function alvosDePreco(l, opc = {}) {
  const sts = opc.status || ST_REAJUSTE;
  if (ehCarteira(l)) return !vendaAtivaDoImovel(l) && num(l.preco) > 0 ? [{ col: 'loteamentos', rec: l, area: num(l.area) }] : [];
  return lotesDo(l.id).filter(x => sts.includes(x.status) && (!opc.quadra || opc.quadra === 'all' || x.quadra === opc.quadra) && num(x.preco) > 0)
    .map(x => ({ col: 'lotes', rec: x, area: num(x.area) }));
}
/* Preço novo de um alvo pela regra: { modo: 'pct', pct } | { modo: 'valor', valor } |
   { modo: 'm2', m2 } | { modo: 'fator', fator }. null = não dá (m² sem área). */
function precoNovo(a, regra, arredondar) {
  const p = num(a.rec.preco);
  let n = regra.modo === 'pct' ? p * (1 + num(regra.pct) / 100) : regra.modo === 'valor' ? p + num(regra.valor)
    : regra.modo === 'm2' ? (a.area > 0 ? a.area * num(regra.m2) : null) : p * num(regra.fator);
  if (n == null || !(n > 0)) return null;
  if (arredondar) n = Math.round(n / 100) * 100;
  return Math.round(n * 100) / 100;
}
/* Variação de um índice num mês (em %): percentual, o lançado; pontos (CUB), a variação sobre o
   mês anterior. null = ainda não lançado. Queda conta como zero. */
function variacaoDoMes(ind, mes) {
  if (!ind) return null;
  const v = indiceValores(ind);
  if (ind.tipo === 'pontos') {
    const a = Number(v[mes]), b = Number(v[mesAnterior(mes)]);
    return a > 0 && b > 0 ? Math.max(0, (a / b - 1) * 100) : null;
  }
  const p = Number(v[mes]);
  return isFinite(p) && v[mes] !== '' && v[mes] != null ? Math.max(0, p) : null;
}
/* Índice acumulado de um mês a outro (os dois entram). faltando: meses sem lançamento. */
function acumuladoDoPeriodo(ind, de, ate) {
  let f = 1, m = de, guard = 0; const faltando = [];
  while (m && m <= ate && guard++ < 600) { const p = variacaoDoMes(ind, m); if (p == null) faltando.push(m); else f *= 1 + p / 100; m = mesSeguinte(m); }
  return { fator: f, pct: (f - 1) * 100, faltando };
}
function textoRegra(regra, ind) {
  if (regra.modo === 'pct') return `${fmtNum(regra.pct, 2)}%`;
  if (regra.modo === 'valor') return `+${fmtMoney(regra.valor)} por lote`;
  if (regra.modo === 'm2') return `${fmtMoney(regra.m2)} por m²`;
  return `${fmtNum((num(regra.fator) - 1) * 100, 2)}%${ind ? ' (' + ind.codigo + ')' : ''}`;
}
/* Aplica a regra nos alvos; devolve o que era, para desfazer */
function aplicarPrecos(alvos, regra, arredondar) {
  const antes = [], fora = [];
  alvos.forEach(a => {
    const n = precoNovo(a, regra, arredondar);
    if (n == null) { fora.push(a); return; }
    if (Math.abs(n - num(a.rec.preco)) < 0.005) return;
    antes.push({ col: a.col, rec: Object.assign({}, a.rec) });
    upsert(a.col, Object.assign({}, a.rec, { preco: n }));
  });
  return { antes, fora };
}
function desfazerPrecos(antes) { antes.forEach(x => { const atual = db[x.col].find(r => r.id === x.rec.id); if (atual) upsert(x.col, Object.assign({}, atual, { preco: x.rec.preco })); }); }
function somaPrecos(alvos) { return alvos.reduce((s, a) => s + num(a.rec.preco), 0); }

// ---------------------------------------------------------------- mensal, sozinha
/* Roda ao abrir e a cada tela (no máximo uma vez por minuto), só para quem pode mudar preços. */
function aplicarReajustesMensais(agora) {
  const cfgs = db.config.reajusteAuto || {};
  if (state.role !== 'admin' || !Object.keys(cfgs).length || !podeAtualizarPrecos()) return [];
  const t = Date.now();
  if (!agora && state._reajusteEm && t - state._reajusteEm < 60000) return [];
  state._reajusteEm = t;
  const hoje = mesAtual(), novo = Object.assign({}, cfgs), feitos = [];
  Object.entries(cfgs).forEach(([lotId, cfg]) => {
    const l = getLoteamento(lotId);
    if (!cfg || !cfg.ativo || !l) return;
    let m = cfg.ultimoMes ? mesSeguinte(cfg.ultimoMes) : cfg.desde, guard = 0;
    const c = Object.assign({}, cfg);
    while (m && m <= hoje && guard++ < 36) {
      let regra, ind = null;
      if (cfg.modo === 'indice') {
        ind = getIndice(cfg.indiceId);
        const p = variacaoDoMes(ind, mesAnterior(m));
        if (p == null) break;                 // o índice do mês anterior ainda não saiu
        regra = { modo: 'fator', fator: 1 + p / 100 };
      } else regra = cfg.modo === 'valor' ? { modo: 'valor', valor: num(cfg.valor) } : { modo: 'pct', pct: num(cfg.pct) };
      const alvos = alvosDePreco(l), antesTot = somaPrecos(alvos);
      const r = aplicarPrecos(alvos, regra, !!cfg.arredondar);
      const texto = textoRegra(regra, ind);
      feitos.push({ lotId, nome: l.nome, mes: m, texto, n: r.antes.length, antes: r.antes, de: antesTot, para: somaPrecos(alvosDePreco(l)), cfgAntes: cfg });
      logAct(`Preços atualizados (mensal, ${monthLabel(m)}): ${l.nome} — ${texto}, ${nPlural(r.antes.length, 'lote')}`, 'Sistema');
      c.ultimoMes = m; c.ultimo = { mes: m, texto };
      m = mesSeguinte(m);
    }
    novo[lotId] = c;
  });
  if (!feitos.length) return [];
  setConfig({ reajusteAuto: novo });
  /* Fica no Início, com "Desfazer", até a pessoa dispensar ou recarregar o app */
  state.reajusteRecente = (state.reajusteRecente || []).concat(feitos);
  return feitos;
}
function avisoReajusteHtml() {
  const fs = state.reajusteRecente || []; if (!fs.length) return '';
  const porImovel = {};
  fs.forEach(f => { (porImovel[f.lotId] = porImovel[f.lotId] || []).push(f); });
  const partes = Object.values(porImovel).map(xs => `${esc(xs[0].nome)} ${xs.map(x => esc(x.texto)).join(' + ')}${xs.length > 1 ? ` (${xs.map(x => monthLabel(x.mes)).join(', ')})` : ` em ${monthLabel(xs[0].mes)}`}`);
  return `<div class="alert info reaj-aviso" style="cursor:default"><span><b>Preços atualizados sozinhos</b> pela atualização mensal: ${partes.join('; ')}. ${nPlural(fs.reduce((s, f) => s + f.n, 0), 'item mudou', 'itens mudaram')} de preço.</span>
    <span class="btn-row" style="margin:0"><button class="btn btn-secondary btn-sm" onclick="desfazerReajusteMensal()">Desfazer</button><button class="btn btn-secondary btn-sm" onclick="state.reajusteRecente=null;renderCurrent()" aria-label="Dispensar o aviso">OK</button></span></div>`;
}
function desfazerReajusteMensal() {
  const fs = (state.reajusteRecente || []).slice().reverse(); if (!fs.length) return;
  fs.forEach(f => desfazerPrecos(f.antes));
  /* A configuração volta ao ponto anterior ao primeiro mês aplicado de cada imóvel */
  const cfgs = Object.assign({}, db.config.reajusteAuto || {});
  fs.forEach(f => { cfgs[f.lotId] = Object.assign({}, f.cfgAntes); });
  /* Sem isto o mesmo mês voltaria a ser aplicado no minuto seguinte: pausa até alguém revisar */
  [...new Set(fs.map(f => f.lotId))].forEach(id => { cfgs[id] = Object.assign({}, cfgs[id], { ativo: false }); });
  setConfig({ reajusteAuto: cfgs });
  logAct(`Atualização mensal de preços desfeita: ${[...new Set(fs.map(f => f.nome))].join(', ')} (mensal pausada)`);
  state.reajusteRecente = null; renderCurrent();
  toast('↩️', 'Preços voltaram', 'A atualização mensal desses imóveis ficou pausada. Revise em Editar imóvel › Atualização mensal do preço.');
}

// ---------------------------------------------------------------- configuração (no formulário do imóvel)
function reajusteFormHtml(l) {
  if (!podeAtualizarPrecos()) return '';
  const c = (l && reajusteCfg(l.id)) || { ativo: false, modo: 'pct', pct: '', valor: '', indiceId: (db.indices.find(i => i.codigo === 'CUB') || db.indices[0] || {}).id || '', arredondar: true, desde: mesSeguinte(mesAtual()) };
  const ms = m => `${m === 'pct' ? '' : 'display:none'}`;
  return `<details class="qualif" id="lmReajBox" ${c.ativo ? 'open' : ''}><summary>Atualização mensal do preço <span class="tiny muted">${c.ativo ? '— ligada' : '— opcional'}</span></summary>
    <label class="check"><input type="checkbox" id="rmAtivo" ${c.ativo ? 'checked' : ''} onchange="rmMudou()"> Atualizar o preço todo mês, sozinho</label>
    <div id="rmCampos" style="${c.ativo ? '' : 'display:none'}">
      <div class="frow"><div class="fg"><label for="rmModo">Como</label><select id="rmModo" onchange="rmMudou()">${MODOS_REAJUSTE.map(([k, t]) => `<option value="${k}" ${c.modo === k ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
        <div class="fg" id="rmPctBox" style="${ms(c.modo)}"><label for="rmPct">Percentual ao mês (%)</label><input type="number" id="rmPct" step="0.01" inputmode="decimal" value="${c.pct ?? ''}" placeholder="ex.: 0,8"></div>
        <div class="fg" id="rmValorBox" style="${c.modo === 'valor' ? '' : 'display:none'}"><label for="rmValor">Somar a cada lote (R$)</label><input type="number" id="rmValor" step="0.01" inputmode="decimal" value="${c.valor ?? ''}" placeholder="ex.: 1000"></div>
        <div class="fg" id="rmIndiceBox" style="${c.modo === 'indice' ? '' : 'display:none'}"><label for="rmIndice">Índice</label>${db.indices.length ? `<select id="rmIndice">${db.indices.map(i => `<option value="${esc(i.id)}" ${c.indiceId === i.id ? 'selected' : ''}>${esc(i.nome || i.codigo)}</option>`).join('')}</select>` : '<div class="hint">Cadastre o índice em Financeiro › Índices.</div>'}</div></div>
      <div class="frow"><div class="fg"><label for="rmDesde">Primeira atualização em</label><input type="month" id="rmDesde" value="${esc(c.ultimoMes ? mesSeguinte(c.ultimoMes) : c.desde || mesSeguinte(mesAtual()))}"></div>
        <div class="fg" style="align-self:end"><label class="check"><input type="checkbox" id="rmArred" ${c.arredondar !== false ? 'checked' : ''}> Arredondar para centena (R$ 100)</label></div></div>
      <p class="help">Muda o preço dos lotes disponíveis, bloqueados e reservados (o imóvel avulso, enquanto não for vendido). Percentual e valor entram no dia 1º de cada mês; o índice, assim que o do mês anterior for lançado em Financeiro › Índices. Aparece um aviso no Início, com "Desfazer".${c.ultimo ? ` Última: ${esc(monthLabel(c.ultimo.mes))}, ${esc(c.ultimo.texto)}.` : ''}</p></div></details>`;
}
function rmMudou() {
  const on = document.getElementById('rmAtivo').checked, m = val('rmModo');
  document.getElementById('rmCampos').style.display = on ? '' : 'none';
  ['pct', 'valor', 'indice'].forEach(k => { const b = document.getElementById('rm' + k[0].toUpperCase() + k.slice(1) + 'Box'); if (b) b.style.display = m === k ? '' : 'none'; });
}
/* Chamado ao salvar o imóvel. Devolve false (e avisa) quando falta algo. */
function salvarReajusteDoForm(lotId, validarSo) {
  const box = document.getElementById('rmAtivo'); if (!box) return true;
  const prev = reajusteCfg(lotId);
  const ativo = box.checked, modo = val('rmModo');
  if (ativo) {
    if (modo === 'pct' && !(num(val('rmPct')) > 0)) { toast('⚠️', 'Informe o percentual ao mês', 'Ex.: 0,8 para 0,8% ao mês.', true); return false; }
    if (modo === 'valor' && !(num(val('rmValor')) > 0)) { toast('⚠️', 'Informe o valor a somar', 'Ex.: 1000 para somar R$ 1.000 em cada lote.', true); return false; }
    if (modo === 'indice' && !getIndice(val('rmIndice'))) { toast('⚠️', 'Escolha o índice', 'Cadastre o índice em Financeiro › Índices.', true); return false; }
    if (!/^\d{4}-\d{2}$/.test(val('rmDesde'))) { toast('⚠️', 'Informe o mês da primeira atualização', '', true); return false; }
  }
  if (validarSo) return true;
  if (!ativo && !prev) return true;
  const desde = val('rmDesde');
  const c = Object.assign({}, prev || {}, { ativo, modo, pct: num(val('rmPct')), valor: num(val('rmValor')), indiceId: val('rmIndice') || '', arredondar: document.getElementById('rmArred').checked });
  /* Ligar, religar ou mudar o mês da próxima atualização recomeça a contagem a partir dele */
  const proxima = prev && prev.ativo ? (prev.ultimoMes ? mesSeguinte(prev.ultimoMes) : prev.desde) : null;
  if (ativo && desde !== proxima) { c.desde = desde; c.ultimoMes = null; }
  const igual = prev && JSON.stringify(prev) === JSON.stringify(c);
  if (igual) return true;
  setConfig({ reajusteAuto: Object.assign({}, db.config.reajusteAuto || {}, { [lotId]: c }) });
  logAct(`Atualização mensal do preço ${ativo ? `ligada: ${getLoteamento(lotId) ? getLoteamento(lotId).nome : ''} — ${modo === 'indice' ? (getIndice(c.indiceId) || {}).codigo : modo === 'valor' ? '+' + fmtMoney(c.valor) + ' por lote' : fmtNum(c.pct, 2) + '% ao mês'}, a partir de ${monthLabel(c.desde)}` : `desligada: ${getLoteamento(lotId) ? getLoteamento(lotId).nome : ''}`}`);
  return true;
}
function resumoReajusteCfg(l) {
  const c = reajusteCfg(l.id); if (!c || !c.ativo) return '';
  const como = c.modo === 'indice' ? ((getIndice(c.indiceId) || {}).codigo || 'índice') : c.modo === 'valor' ? `+${fmtMoney(c.valor)}/lote` : `${fmtNum(c.pct, 2)}% a.m.`;
  return `Atualização mensal: ${como} · próxima em ${monthLabel(c.ultimoMes ? mesSeguinte(c.ultimoMes) : c.desde)}`;
}

// ---------------------------------------------------------------- manual
/* escopo: id de um imóvel, 'empresa' (todos) ou uma lista de ids (os selecionados em Imóveis) */
function abrirReajuste(escopo) {
  if (!podeAtualizarPrecos()) { toast('🔒', 'Sem permissão', 'Mudar preços pede "alterar preços dos lotes".', true); return; }
  if (escopo == null) escopo = (curLot() || {}).id || 'empresa';
  state.reajusteEscopo = escopo;
  const lista = Array.isArray(escopo), umId = !lista && escopo !== 'empresa' ? escopo : null, um = umId && getLoteamento(umId);
  const quadras = um && !ehCarteira(um) ? quadrasDo(um.id) : [];
  const ind0 = (db.indices.find(i => i.codigo === 'CUB') || db.indices[0] || {}).id || '';
  const body = `${lista ? `<p class="small mb"><b>${nPlural(escopo.length, 'imóvel selecionado', 'imóveis selecionados')}</b></p>` : `<div class="fg"><label for="rjOnde">Onde</label><select id="rjOnde" onchange="state.reajusteEscopo=this.value;abrirReajuste(this.value)"><option value="empresa" ${escopo === 'empresa' ? 'selected' : ''}>Todos os imóveis da empresa</option>${db.loteamentos.map(l => `<option value="${esc(l.id)}" ${umId === l.id ? 'selected' : ''}>${esc(l.nome)}</option>`).join('')}</select></div>`}
    <div class="frow">${quadras.length ? `<div class="fg"><label for="rjQuadra">Quadra</label><select id="rjQuadra" onchange="rjPrevia()"><option value="all">Todas</option>${quadras.map(q => `<option value="${esc(q)}">Quadra ${esc(q)}</option>`).join('')}</select></div>` : ''}
      <div class="fg"><label for="rjStatus">Aplicar em</label><select id="rjStatus" onchange="rjPrevia()"><option value="todos">Disponíveis, bloqueados e reservados</option><option value="disponivel">Só os disponíveis</option></select></div></div>
    <div class="frow"><div class="fg"><label for="rjModo">Como</label><select id="rjModo" onchange="rjModoMudou()"><option value="pct">Percentual (%)</option><option value="valor">Valor somado a cada lote (R$)</option><option value="m2">Novo preço por m² (R$)</option><option value="indice">Índice acumulado</option></select></div>
      <div class="fg" id="rjPctBox"><label for="rjPct">Percentual (%)</label><input type="number" id="rjPct" step="0.01" inputmode="decimal" placeholder="ex.: 5 ou -3" oninput="rjPrevia()"></div>
      <div class="fg" id="rjValorBox" style="display:none"><label for="rjValor">Somar a cada lote (R$)</label><input type="number" id="rjValor" step="0.01" inputmode="decimal" placeholder="ex.: 2000" oninput="rjPrevia()"></div>
      <div class="fg" id="rjM2Box" style="display:none"><label for="rjM2">Preço por m² (R$)</label><input type="number" id="rjM2" step="0.01" inputmode="decimal" placeholder="ex.: 450" oninput="rjPrevia()"></div></div>
    <div class="frow3" id="rjIndiceBox" style="display:none"><div class="fg"><label for="rjIndice">Índice</label>${db.indices.length ? `<select id="rjIndice" onchange="rjPrevia()">${db.indices.map(i => `<option value="${esc(i.id)}" ${i.id === ind0 ? 'selected' : ''}>${esc(i.codigo || i.nome)}</option>`).join('')}</select>` : '<div class="hint">Cadastre o índice em Financeiro › Índices.</div>'}</div>
      <div class="fg"><label for="rjDe">De</label><input type="month" id="rjDe" value="${mesAnterior(mesAnterior(mesAtual()))}" oninput="rjPrevia()"></div>
      <div class="fg"><label for="rjAte">Até</label><input type="month" id="rjAte" value="${mesAnterior(mesAtual())}" oninput="rjPrevia()"></div></div>
    <label class="check"><input type="checkbox" id="rjArredonda" checked onchange="rjPrevia()"> Arredondar para centena (R$ 100)</label>
    <div class="rj-previa" id="rjPrevia" aria-live="polite"></div>`;
  openModal({ title: 'Atualizar preços', body, footer: `<button class="btn btn-secondary" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" id="rjAplicar" onclick="aplicarReajuste()">Atualizar</button>` });
  rjPrevia();
}
function rjModoMudou() {
  const m = val('rjModo');
  [['pct', 'rjPctBox'], ['valor', 'rjValorBox'], ['m2', 'rjM2Box'], ['indice', 'rjIndiceBox']].forEach(([k, id]) => { const b = document.getElementById(id); if (b) b.style.display = m === k ? '' : 'none'; });
  rjPrevia();
}
/* Imóveis, alvos e regra conforme a janela */
function rjPlano() {
  const esc0 = state.reajusteEscopo, ids = Array.isArray(esc0) ? esc0 : esc0 === 'empresa' ? db.loteamentos.map(l => l.id) : [esc0];
  const status = val('rjStatus') === 'disponivel' ? ['disponivel'] : ST_REAJUSTE, quadra = val('rjQuadra') || 'all';
  const alvos = ids.map(getLoteamento).filter(Boolean).flatMap(l => alvosDePreco(l, { status, quadra }));
  const modo = val('rjModo');
  let regra = null, erro = '', ind = null;
  if (modo === 'pct') regra = num(val('rjPct')) ? { modo, pct: num(val('rjPct')) } : null;
  else if (modo === 'valor') regra = num(val('rjValor')) ? { modo, valor: num(val('rjValor')) } : null;
  else if (modo === 'm2') regra = num(val('rjM2')) > 0 ? { modo, m2: num(val('rjM2')) } : null;
  else {
    ind = getIndice(val('rjIndice'));
    const de = val('rjDe'), ate = val('rjAte');
    if (!ind) erro = 'Escolha o índice.';
    else if (!de || !ate || de > ate) erro = 'Confira os meses: "De" vem antes de "Até".';
    else { const a = acumuladoDoPeriodo(ind, de, ate); if (a.faltando.length) erro = `Falta lançar ${ind.codigo} de ${a.faltando.map(monthLabel).join(', ')} em Financeiro › Índices.`; else regra = { modo: 'fator', fator: a.fator }; }
  }
  return { alvos, regra, erro, ind, arred: document.getElementById('rjArredonda') ? document.getElementById('rjArredonda').checked : true };
}
function rjPrevia() {
  const box = document.getElementById('rjPrevia'); if (!box) return;
  const p = rjPlano(), btn = document.getElementById('rjAplicar');
  if (!p.alvos.length) { box.innerHTML = '<span class="muted">Nada para atualizar: nenhum lote ou imóvel à venda aqui.</span>'; if (btn) btn.disabled = true; return; }
  if (p.erro || !p.regra) { box.innerHTML = `<span class="muted">${nPlural(p.alvos.length, 'item à venda', 'itens à venda')} · ${fmtMoney(somaPrecos(p.alvos))}</span>${p.erro ? `<div class="tiny ct-atraso">${esc(p.erro)}</div>` : ''}`; if (btn) btn.disabled = true; return; }
  const novos = p.alvos.map(a => precoNovo(a, p.regra, p.arred)), semArea = novos.filter(n => n == null).length;
  const de = somaPrecos(p.alvos.filter((a, i) => novos[i] != null)), para = novos.reduce((s, n) => s + (n || 0), 0);
  box.innerHTML = `<b>${nPlural(p.alvos.length - semArea, 'item', 'itens')}</b> · de ${fmtMoney(de)} para <b>${fmtMoney(para)}</b> (${para >= de ? '+' : ''}${fmtNum(de ? (para / de - 1) * 100 : 0, 2)}%)${p.regra.modo === 'fator' ? ` · ${esc(textoRegra(p.regra, p.ind))} acumulado` : ''}${semArea ? `<div class="tiny muted">${nPlural(semArea, 'item sem área fica', 'itens sem área ficam')} de fora do preço por m².</div>` : ''}`;
  if (btn) { btn.disabled = false; btn.textContent = `Atualizar ${nPlural(p.alvos.length - semArea, 'preço', 'preços')}`; }
}
async function aplicarReajuste() {
  if (!podeAtualizarPrecos()) { toast('🔒', 'Sem permissão', '', true); return; }
  const p = rjPlano();
  if (!p.regra || p.erro) { toast('⚠️', 'Confira a atualização', p.erro || 'Informe o percentual, o valor ou o índice.', true); return; }
  const r = aplicarPrecos(p.alvos, p.regra, p.arred);
  const texto = textoRegra(p.regra, p.ind), onde = Array.isArray(state.reajusteEscopo) ? nPlural(state.reajusteEscopo.length, 'imóvel selecionado', 'imóveis selecionados') : state.reajusteEscopo === 'empresa' ? 'todos os imóveis' : (getLoteamento(state.reajusteEscopo) || {}).nome || '';
  logAct(`Preços atualizados: ${onde} — ${texto}, ${nPlural(r.antes.length, 'item', 'itens')}`);
  closeModal(); if (Array.isArray(state.reajusteEscopo)) selLimpar('imoveis'); renderCurrent();
  toast('✅', 'Preços atualizados', `${nPlural(r.antes.length, 'item', 'itens')} · ${texto}`, false, { rotulo: 'Desfazer', fn: () => {
    desfazerPrecos(r.antes); logAct(`Atualização de preços desfeita: ${onde}`); renderCurrent(); toast('↩️', 'Preços voltaram', `${nPlural(r.antes.length, 'item voltou', 'itens voltaram')} ao preço anterior.`);
  } });
}
