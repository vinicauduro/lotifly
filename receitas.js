/* ===== Receitas avulsas =====
   O que entra fora das parcelas dos contratos: comissões de corretagem da imobiliária, taxa de
   termo de cessão, rendimentos de aplicação, aporte de sócios, empréstimos e as receitas que a
   empresa criar. Ficam em A receber › Outras receitas. Recebida, a receita entra no caixa (na
   conta escolhida) e no balancete na linha do tipo dela; aporte e empréstimo entram no caixa
   mas ficam fora do resultado (não são lucro: são dinheiro de sócio ou dívida). */
'use strict';

/* Tipos de fábrica. "taxa" soma com as taxas de cessão cobradas pelo contrato (linha do
   balancete de mesmo nome); "outras" é a linha "Outras receitas". */
const TIPOS_RECEITA_PADRAO = [
  { id: 'corretagem', nome: 'Comissões de corretagem', resultado: true },
  { id: 'cessao', nome: 'Taxa de termo de cessão', resultado: true, linha: 'taxa' },
  { id: 'rendimentos', nome: 'Rendimentos de aplicação', resultado: true },
  { id: 'aporte', nome: 'Aporte de sócios', resultado: false },
  { id: 'emprestimo', nome: 'Empréstimos recebidos', resultado: false },
  { id: 'outras', nome: 'Outras receitas', resultado: true, linha: 'outras' }
];
function tiposReceita() { return TIPOS_RECEITA_PADRAO.concat((db.config.tiposReceitaExtra || []).filter(t => t && t.id && t.nome)); }
function getTipoReceita(id) { return tiposReceita().find(t => t.id === id) || TIPOS_RECEITA_PADRAO[TIPOS_RECEITA_PADRAO.length - 1]; }
/* Linha do balancete: a da fábrica ("taxa", "outras") ou uma linha própria do tipo */
function linhaDoTipoReceita(t) { return t.linha || 'rt:' + t.id; }
function receitasSemTabela() { return (Cloud.tabelasFaltando || []).includes('receitas'); }
function receitaStatus(x) { if (x.status === 'recebido') return 'pago'; if (x.vencimento && x.vencimento < todayStr()) return 'atrasado'; return 'pendente'; }
function receitasDo(escopo) { return db.receitas.filter(x => noEscopo(x, escopo)); }

// ---------------------------------------------------------------- lista (A receber › Outras receitas)
function abasRecebiveisHtml(atual) {
  return `<div class="subtabs" role="tablist" aria-label="O que está a receber">${[['parcelas', 'Parcelas dos contratos'], ['receitas', 'Outras receitas']].map(([k, l]) =>
    `<div class="chip ${atual === k ? 'active' : ''}" role="tab" aria-selected="${atual === k}" tabindex="0" onclick="filtroRec().sub='${k}';renderRecebiveis()" onkeydown="if(event.key==='Enter')this.click()">${l}${k === 'receitas' && db.receitas.filter(x => x.status !== 'recebido').length ? `<span class="n">${db.receitas.filter(x => x.status !== 'recebido').length}</span>` : ''}</div>`).join('')}</div>`;
}
function renderReceitas(v) {
  const esc0 = escopoAtual();
  const f = state.filters.receitas = Object.assign({ status: 'all', tipo: 'all', busca: '' }, state.filters.receitas || {});
  if (receitasSemTabela()) {
    v.innerHTML = abasRecebiveisHtml('receitas') + `<div class="alert warn" style="cursor:default"><span><b>Falta atualizar o banco de dados.</b> Para lançar receitas avulsas, rode de novo o arquivo <code>supabase/schema.sql</code> no Supabase (SQL Editor) e recarregue a página.</span></div>`;
    return;
  }
  const all = receitasDo(esc0);
  const FAIXA = [['all', 'Todas', () => true], ['pendente', 'A receber', x => receitaStatus(x) === 'pendente'], ['atrasado', 'Vencidas', x => receitaStatus(x) === 'atrasado'], ['pago', 'Recebidas', x => receitaStatus(x) === 'pago']];
  const filtro = (FAIXA.find(x => x[0] === f.status) || FAIXA[0])[2];
  const tipos = tiposReceita();
  const list = all.filter(x => filtro(x) && (f.tipo === 'all' || x.tipoId === f.tipo) && (!f.busca || `${x.descricao} ${x.pagador || ''}`.toLowerCase().includes(f.busca.toLowerCase())))
    .sort((a, b) => (b.dataRecebimento || b.vencimento || b.dataCompetencia || '').localeCompare(a.dataRecebimento || a.vencimento || a.dataCompetencia || ''));
  const podeLancar = pode('financeiro.baixar');
  v.innerHTML = `${abasRecebiveisHtml('receitas')}
    ${faixaHtml(FAIXA.map(([k, l, fn]) => { const xs = all.filter(fn); return { k, l, n: xs.length, v: xs.length ? fmtMoneyShort(xs.reduce((s, x) => s + num(x.valor), 0)) : '—', ativo: f.status === k, acao: `state.filters.receitas.status='${k}';renderRecebiveis()` }; }), 'Situação das receitas')}
    <div class="filters">
      ${escopoSelectHtml('renderRecebiveis()')}
      <select aria-label="Tipo de receita" onchange="state.filters.receitas.tipo=this.value;renderRecebiveis()"><option value="all">Todos os tipos</option>${tipos.map(t => `<option value="${esc(t.id)}" ${f.tipo === t.id ? 'selected' : ''}>${esc(t.nome)}</option>`).join('')}</select>
      <input type="text" placeholder="Descrição ou de quem…" value="${esc(f.busca)}" oninput="aSetFiltro('receitas','busca',this.value,renderRecebiveis,this)">
      ${podeLancar ? `<button class="btn btn-primary btn-sm" onclick="abrirReceitaForm()"><i class=ico data-i=plus></i>Lançar receita</button>` : ''}
    </div>
    <p class="small muted mb">${nPlural(list.length, 'receita')} · ${fmtMoney(list.reduce((s, x) => s + num(x.valor), 0))}</p>
    ${list.length ? `<div class="lista">${list.map(receitaRowHtml).join('')}</div>`
      : `<div class="empty"><div class="ic"><i class=ico data-i=hand-coins></i></div><p>${all.length ? 'Nenhuma receita nesta lista.' : 'Nenhuma receita avulsa lançada.'}</p>${all.length ? '' : '<p>Comissões de corretagem, taxa de cessão, rendimentos, aporte de sócios, empréstimos: o que entra fora das parcelas dos contratos.</p>'}${podeLancar && !all.length ? '<p><button class="btn btn-primary btn-sm" onclick="abrirReceitaForm()"><i class=ico data-i=plus></i>Lançar receita</button></p>' : ''}</div>`}`;
}
function receitaRowHtml(x) {
  const st = receitaStatus(x), t = getTipoReceita(x.tipoId), emp = x.loteamentoId && getLoteamento(x.loteamentoId);
  const prazo = st === 'pago' ? `<div class="ct-data"><span class="tiny muted">recebida em</span> ${fmtDate(x.dataRecebimento)}</div>` : prazoHtml(x.vencimento, st, null, 'Vencida');
  return `<div class="item linha ${st}" tabindex="0" role="button" onclick="abrirReceitaForm('${x.id}')" onkeydown="if(event.key==='Enter')abrirReceitaForm('${x.id}')">
    <div class="ct-venc">${prazo}</div>
    <div class="info"><div class="title">${esc(x.descricao)}</div>
      <div class="meta"><span class="badge neutral">${esc(t.nome)}</span>${t.resultado === false ? '<span class="tiny muted">· fora do resultado</span>' : ''}${x.pagador ? `<span>· ${esc(x.pagador)}</span>` : ''}${emp ? `<span>· ${esc(emp.nome)}</span>` : ''}${x.empresaId ? `<span>· ${esc(nomeEmpresaDe(x.empresaId))}</span>` : ''}</div></div>
    <div class="side"><div class="value">${fmtMoney(x.valor)}</div>
      <div class="btns" onclick="event.stopPropagation()">${st !== 'pago' && pode('financeiro.baixar') ? `<button class="btn-icon ok" title="Registrar recebimento" aria-label="Registrar recebimento" onclick="receberReceita('${x.id}')"><i class=ico data-i=money></i></button>` : ''}</div></div></div>`;
}

// ---------------------------------------------------------------- lançar e editar
function abrirReceitaForm(id) {
  const x = id ? db.receitas.find(r => r.id === id) : null;
  const tipos = tiposReceita(), podeTipo = pode('config.editar');
  const empresas = empresasDoGrupo();
  const pagadores = [...new Set(db.receitas.map(r => r.pagador).filter(Boolean))].sort(naturalCmp);
  const recebida = x && x.status === 'recebido';
  const body = `<div class="frow"><div class="fg"><label for="rtTipo">Tipo de receita *</label><select id="rtTipo" onchange="rtTipoMudou()">${tipos.map(t => `<option value="${esc(t.id)}" ${(x ? x.tipoId : 'corretagem') === t.id ? 'selected' : ''}>${esc(t.nome)}</option>`).join('')}${podeTipo ? '<option value="__novo">+ Criar novo tipo…</option>' : ''}</select>
      <div class="hint" id="rtTipoDica"></div></div>
      <div class="fg"><label for="rtPagador">De quem (pagador)</label><input type="text" id="rtPagador" list="rtPagList" value="${esc(x ? x.pagador || '' : '')}" placeholder="Ex.: Banco, sócio, construtora"><datalist id="rtPagList">${pagadores.map(p => `<option value="${esc(p)}">`).join('')}</datalist></div></div>
    <div class="fieldset" id="rtNovoBox" style="display:none"><span class="lg">Novo tipo de receita</span>
      <div class="fg"><label for="rtNovoNome">Nome *</label><input type="text" id="rtNovoNome" placeholder="Ex.: Aluguel do stand, Venda de material"></div>
      <label class="check"><input type="checkbox" id="rtNovoFora"> Não é lucro (entra no caixa, mas fica fora do resultado, como aporte e empréstimo)</label></div>
    <div class="fg"><label for="rtDesc">Descrição *</label><input type="text" id="rtDesc" value="${esc(x ? x.descricao : '')}" placeholder="Ex.: Comissão da venda do apto 302 — Ed. Aurora"></div>
    <div class="frow"><div class="fg"><label for="rtValor">Valor (R$) *</label><input type="number" id="rtValor" step="0.01" inputmode="decimal" value="${x ? x.valor : ''}"></div>
      ${empresas.length > 1 ? `<div class="fg"><label for="rtEmpresa">Empresa que recebe</label><select id="rtEmpresa" onchange="rtContaDaEmpresa()">${empresas.map(e => `<option value="${esc(e.id)}" ${(x ? x.empresaId || '' : '') === e.id ? 'selected' : ''}>${esc(e.nome)}</option>`).join('')}</select></div>` : `<div class="fg"><label for="rtEmp">Empreendimento (opcional)</label><select id="rtEmp"><option value="">Da empresa (sem empreendimento)</option>${db.loteamentos.map(l => `<option value="${l.id}" ${x && x.loteamentoId === l.id ? 'selected' : ''}>${esc(l.nome)}</option>`).join('')}</select></div>`}</div>
    ${empresas.length > 1 ? `<div class="fg"><label for="rtEmp">Empreendimento (opcional)</label><select id="rtEmp"><option value="">Da empresa (sem empreendimento)</option>${db.loteamentos.map(l => `<option value="${l.id}" ${x && x.loteamentoId === l.id ? 'selected' : ''}>${esc(l.nome)}</option>`).join('')}</select></div>` : ''}
    <div class="frow"><div class="fg"><label for="rtComp">Competência *</label><input type="date" id="rtComp" value="${x ? x.dataCompetencia || '' : todayStr()}"></div>
      <div class="fg"><label for="rtVenc">Vencimento (previsão)</label><input type="date" id="rtVenc" value="${x ? x.vencimento || '' : ''}"></div></div>
    <div class="frow"><div class="fg"><label for="rtStatus">Situação</label><select id="rtStatus" onchange="rtStatusMudou()"><option value="aberto" ${recebida ? '' : 'selected'}>A receber</option><option value="recebido" ${recebida ? 'selected' : ''}>Recebida</option></select></div>
      <div class="fg" id="rtDataBox" style="${recebida ? '' : 'display:none'}"><label for="rtData">Data do recebimento</label><input type="date" id="rtData" max="${todayStr()}" value="${x && x.dataRecebimento ? x.dataRecebimento : todayStr()}"></div></div>
    <div class="frow" id="rtRecBox" style="${recebida ? '' : 'display:none'}"><div class="fg"><label for="rtForma">Forma</label><select id="rtForma">${['PIX', 'Transferência', 'Boleto', 'Dinheiro', 'Cheque', 'Cartão'].map(o => `<option ${x && x.forma === o ? 'selected' : ''}>${o}</option>`).join('')}</select></div>
      ${contaCaixaCampoHtml('rtConta', 'Entrou na conta', x ? x.empresaId || '' : '', x && (db.movimentos.find(m => m.id === 'mr-' + x.id) || {}).contaId)}</div>
    <div class="fg"><label for="rtObs">Observações</label><textarea id="rtObs">${esc(x ? x.obs || '' : '')}</textarea></div>`;
  openModal({ title: x ? 'Editar receita' : 'Lançar receita', body,
    footer: `${x && pode('financeiro.baixar') ? `<button class="btn btn-outline-danger" onclick="excluirReceita('${x.id}')">Excluir</button>` : ''}<button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>${pode('financeiro.baixar') ? `<button class="btn btn-primary" onclick="salvarReceita('${x ? x.id : ''}')">Salvar</button>` : ''}` });
  rtTipoMudou();
  focarSeLivre('rtDesc');
}
function rtTipoMudou() {
  const novo = val('rtTipo') === '__novo', box = document.getElementById('rtNovoBox'), dica = document.getElementById('rtTipoDica');
  if (box) box.style.display = novo ? '' : 'none';
  if (novo) { const n = document.getElementById('rtNovoNome'); if (n) n.focus(); }
  if (dica) dica.textContent = !novo && getTipoReceita(val('rtTipo')).resultado === false ? 'Entra no caixa, mas não é lucro: fica fora do resultado no balancete.' : '';
}
function rtStatusMudou() {
  const rec = val('rtStatus') === 'recebido';
  ['rtDataBox', 'rtRecBox'].forEach(id => { const el = document.getElementById(id); if (el) el.style.display = rec ? '' : 'none'; });
}
function rtContaDaEmpresa() {
  const sel = document.getElementById('rtConta'); if (!sel) return;
  const c = contaPadrao(val('rtEmpresa')); if (c) sel.value = c.id;
}
/* Tipo novo criado no próprio lançamento: vai para a lista da empresa (Configurações) */
function criarTipoReceita(nome, fora) {
  const existe = tiposReceita().find(t => semAcento(t.nome) === semAcento(nome));
  if (existe) return existe;
  const t = { id: 'r' + genId(), nome, resultado: !fora };
  setConfig({ tiposReceitaExtra: (db.config.tiposReceitaExtra || []).concat([t]) });
  logAct(`Tipo de receita criado: ${nome}${fora ? ' (fora do resultado)' : ''}`);
  return t;
}
function salvarReceita(id) {
  if (!pode('financeiro.baixar')) { toast('🔒', 'Sem permissão', 'Lançar receitas pede "registrar pagamentos".', true); return; }
  const prev = id ? db.receitas.find(r => r.id === id) : null;
  const valor = Math.round(num(val('rtValor')) * 100) / 100, st = val('rtStatus'), data = val('rtData');
  if (!val('rtDesc') || !(valor > 0) || !val('rtComp')) { toast('⚠️', 'Preencha descrição, valor e competência', '', true); return; }
  let tipoId = val('rtTipo');
  if (tipoId === '__novo') {
    const nome = val('rtNovoNome');
    if (!nome) { toast('⚠️', 'Dê um nome ao novo tipo', 'Ex.: Aluguel do stand.', true); return; }
    tipoId = criarTipoReceita(nome, document.getElementById('rtNovoFora').checked).id;
  }
  if (st === 'recebido' && (!/^\d{4}-\d{2}-\d{2}$/.test(data) || data > todayStr())) { toast('⚠️', 'Data do recebimento', 'Informe o dia em que o dinheiro entrou (hoje ou antes).', true); return; }
  const rec = Object.assign({}, prev || { id: genId(), criadoEm: new Date().toISOString() }, {
    tipoId, descricao: val('rtDesc'), pagador: val('rtPagador'), valor, empresaId: document.getElementById('rtEmpresa') ? val('rtEmpresa') : (prev ? prev.empresaId || '' : ''),
    loteamentoId: val('rtEmp') || null, dataCompetencia: val('rtComp'), vencimento: val('rtVenc') || null,
    status: st === 'recebido' ? 'recebido' : 'aberto', dataRecebimento: st === 'recebido' ? data : null, forma: st === 'recebido' ? val('rtForma') : null, obs: val('rtObs') });
  comConta(st === 'recebido' ? val('rtConta') : '', () => upsert('receitas', rec));
  if (!prev) logAct(`Receita lançada: ${rec.descricao} — ${fmtMoney(rec.valor)} (${getTipoReceita(rec.tipoId).nome})`);
  else if (prev.status !== rec.status) logAct(`Receita ${rec.status === 'recebido' ? 'recebida' : 'reaberta'}: ${rec.descricao} — ${fmtMoney(rec.valor)}`);
  closeModal(); renderCurrent();
  toast('✅', prev ? 'Receita salva' : 'Receita lançada', `${rec.descricao} · ${fmtMoney(rec.valor)}${rec.status === 'recebido' ? ' · recebida' : ''}`);
}
async function excluirReceita(id) {
  const x = db.receitas.find(r => r.id === id); if (!x) return;
  if (!(await confirmar({ titulo: `Excluir "${x.descricao}"?`, valores: [['Valor', fmtMoney(x.valor)]].concat(x.status === 'recebido' ? [['Recebida em', fmtDate(x.dataRecebimento)]] : []), texto: x.status === 'recebido' ? 'O valor sai também do caixa.' : '', acao: 'Excluir receita', perigo: true }))) return;
  removeRec('receitas', id); logAct(`Receita excluída: ${x.descricao} — ${fmtMoney(x.valor)}`);
  closeModal(); renderCurrent();
}

// ---------------------------------------------------------------- receber
function receberReceita(id) {
  const x = db.receitas.find(r => r.id === id); if (!x) return;
  const t = getTipoReceita(x.tipoId);
  const body = `<p class="small mb"><b>${esc(x.descricao)}</b> · ${esc(t.nome)}${x.pagador ? ` · ${esc(x.pagador)}` : ''}</p>
    <div class="detail-grid"><div><div class="k">Valor</div><div class="v">${fmtMoney(x.valor)}</div></div><div><div class="k">Vencimento</div><div class="v">${x.vencimento ? fmtDate(x.vencimento) : '—'}</div></div></div>
    <div class="frow"><div class="fg"><label for="rrData">Data do recebimento *</label><input type="date" id="rrData" value="${todayStr()}" max="${todayStr()}"></div>
      <div class="fg"><label for="rrForma">Forma</label><select id="rrForma">${['PIX', 'Transferência', 'Boleto', 'Dinheiro', 'Cheque', 'Cartão'].map(o => `<option>${o}</option>`).join('')}</select></div></div>
    ${contaCaixaCampoHtml('rrConta', 'Entrou na conta', x.empresaId || '')}`;
  openModal({ title: 'Registrar recebimento', body, footer: `<button class="btn btn-secondary" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" onclick="salvarRecebimentoReceita('${x.id}')">Confirmar</button>` });
}
function salvarRecebimentoReceita(id) {
  if (!pode('financeiro.baixar')) { toast('🔒', 'Sem permissão', 'Seu perfil não registra recebimentos.', true); return; }
  const x = db.receitas.find(r => r.id === id); if (!x) return;
  const data = val('rrData');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data || '')) { toast('⚠️', 'Informe a data do recebimento', '', true); return; }
  if (data > todayStr()) { toast('⚠️', 'Data no futuro', 'Registre no dia em que o dinheiro entrou.', true); return; }
  const antes = Object.assign({}, x), cx = getContaCaixa(val('rrConta'));
  comConta(val('rrConta'), () => upsert('receitas', Object.assign({}, x, { status: 'recebido', dataRecebimento: data, forma: val('rrForma') })));
  logAct(`Receita recebida: ${x.descricao} — ${fmtMoney(x.valor)}${cx ? ` (${cx.nome})` : ''}`);
  closeModal(); renderCurrent();
  toast('✅', 'Receita recebida', `${x.descricao} · ${fmtMoney(x.valor)}${cx ? ` · entrou em ${cx.nome}` : ''}`, false, { rotulo: 'Desfazer', fn: () => {
    upsert('receitas', antes); logAct(`Recebimento desfeito: ${x.descricao}`); renderCurrent(); toast('↩️', 'Recebimento desfeito', `${x.descricao} voltou para a receber.`);
  } });
}
