/* ===== Lotifly — distrato =====
   Desfaz a venda guardando a história: o contrato fica como "Distrato", com o que foi pago,
   quanto a empresa retém, quanto devolve e como devolve. As parcelas em aberto deixam de ser
   cobradas (e os boletos já registrados vão para a baixa na próxima remessa), o lote volta a
   ficar disponível e a devolução entra em A pagar, à vista ou em até 12 parcelas.
   Retenção padrão de 25% do valor pago, editável em cada distrato. */
'use strict';

const DISTRATO_RETENCAO_PADRAO = 25;
const DISTRATO_MAX_PARCELAS = 12;
/* 25 → "25%", 22,5 → "22,5%" */
function pctTxt(x) { x = num(x); return fmtNum(x, x % 1 ? 1 : 0) + '%'; }
const MOTIVOS_DISTRATO = [
  ['inadimplencia', 'Inadimplência do comprador', 'inadimplência do promitente comprador'],
  ['desistencia', 'Desistência do comprador', 'desistência do promitente comprador'],
  ['acordo', 'Acordo entre as partes', 'acordo entre as partes'],
  ['outro', 'Outro motivo', '']
];

/* O que o comprador pagou: entrada, parcelas e reforços. A taxa de cessão é da empresa e não
   entra na conta da devolução. */
function pagoPeloComprador(v) {
  return Math.round(recebiveisDe(v.id).filter(r => r.tipo !== 'taxa').reduce((s, r) => s + num(r.valorPago), 0) * 100) / 100;
}
/* Divide a devolução em parcelas mensais iguais; a última acerta os centavos. */
function parcelasDevolucao(total, n, primeiro) {
  n = Math.max(1, Math.min(DISTRATO_MAX_PARCELAS, Math.round(n) || 1));
  const base = Math.floor(total / n * 100) / 100;
  return Array.from({ length: n }, (_, i) => ({
    n: i + 1, vencimento: addMonths(primeiro, i),
    valor: i === n - 1 ? Math.round((total - base * (n - 1)) * 100) / 100 : base
  }));
}
/* A conta do distrato a partir do que está no formulário (ou do que foi passado). */
function calculoDistrato(v, o) {
  const pago = pagoPeloComprador(v);
  const retencaoPct = Math.max(0, Math.min(100, num(o.retencaoPct)));
  const retencao = Math.round(pago * retencaoPct) / 100;
  const outros = Math.max(0, num(o.outrosDescontos));
  const devolucao = Math.max(0, Math.round((pago - retencao - outros) * 100) / 100);
  const parcelado = o.forma === 'parcelado';
  const parcelas = devolucao > 0 ? (parcelado ? parcelasDevolucao(devolucao, o.nParcelas, o.primeiro || o.data) : [{ n: 1, vencimento: o.dataVista || o.data, valor: devolucao }]) : [];
  return { pago, retencaoPct, retencao, outrosDescontos: outros, devolucao, forma: parcelado ? 'parcelado' : 'vista', parcelas };
}
function textoFormaDevolucao(d) {
  if (!d.parcelas || !d.parcelas.length) return 'sem valor a devolver';
  if (d.forma !== 'parcelado' || d.parcelas.length === 1) return `à vista, em ${fmtDate(d.parcelas[0].vencimento)}`;
  const p = d.parcelas, n = p.length, ult = p[n - 1];
  const iguais = p.every(x => Math.abs(x.valor - p[0].valor) < 0.005);
  return `em ${n} parcelas mensais e sucessivas de ${fmtMoney(p[0].valor)}${iguais ? '' : ` (a última de ${fmtMoney(ult.valor)})`}, vencendo a primeira em ${fmtDate(p[0].vencimento)}`;
}
function motivoDistratoTexto(tipo, detalhe) {
  const m = MOTIVOS_DISTRATO.find(x => x[0] === tipo);
  return [m && m[2], (detalhe || '').trim()].filter(Boolean).join(' — ');
}

// ================================================================ FORMULÁRIO
function abrirDistrato(vendaId) {
  const v = getVenda(vendaId); if (!v) return;
  if (!pode('vendas.distrato')) { toast('🔒', 'Sem permissão', 'Seu perfil não faz distrato.', true); return; }
  if (v.status === 'distrato') { toast('⚠️', 'Este contrato já foi distratado', '', true); return; }
  const abertas = recebiveisDe(v.id).filter(r => recRestante(r) > 0.005 && r.tipo !== 'taxa');
  const noBanco = abertas.filter(r => registradaNoBancoSeguro(r));
  const pago = pagoPeloComprador(v);
  const hoje = todayStr();
  const body = `
    <p class="help mb">O contrato fica guardado como <b>Distrato</b>, com toda a história. As parcelas em aberto deixam de ser cobradas, o imóvel volta a ficar disponível e a devolução entra em <b>A pagar</b>.</p>
    <div class="detail-grid mb">
      <div><div class="k">Comprador</div><div class="v">${esc(nomesDasPartes(todosCompradores(v)))}</div></div>
      <div><div class="k">Pago pelo comprador</div><div class="v">${fmtMoney(pago)}</div></div>
      <div><div class="k">Parcelas canceladas</div><div class="v">${abertas.length} · ${fmtMoney(abertas.reduce((s, r) => s + recRestante(r), 0))}</div></div>
      <div><div class="k">Imóvel</div><div class="v">${esc(imovelLabel(v))}</div></div>
    </div>
    ${noBanco.length ? `<div class="alert info" style="cursor:default"><span><b>${noBanco.length} parcela(s) têm boleto registrado no banco.</b> Elas entram na próxima remessa para baixa, em Boletos e banco.</span></div>` : ''}
    ${num(v.comissaoValor) && !v.comissaoPaga ? `<div class="alert info" style="cursor:default"><span>A comissão de ${fmtMoney(v.comissaoValor)} de ${esc((v.corretor || {}).nome || 'corretor')} ainda não foi paga. O distrato não mexe nela: combine com o corretor.</span></div>` : ''}
    <div class="frow"><div class="fg"><label for="dtData">Data do distrato *</label><input type="date" id="dtData" value="${hoje}" oninput="dtCalc('${v.id}')"></div>
      <div class="fg"><label for="dtMotivo">Motivo *</label><select id="dtMotivo" onchange="dtCalc('${v.id}')">${MOTIVOS_DISTRATO.map(m => `<option value="${m[0]}">${m[1]}</option>`).join('')}</select></div></div>
    <div class="fg"><label for="dtMotivoTxt">Detalhe do motivo</label><input type="text" id="dtMotivoTxt" placeholder="opcional — ex.: 6 parcelas em atraso desde março"></div>
    <div class="fieldset"><span class="lg">Retenção e descontos</span>
      <div class="frow"><div class="fg"><label for="dtRetPct">Retenção (% do valor pago)</label><input type="number" id="dtRetPct" step="0.1" min="0" max="100" value="${DISTRATO_RETENCAO_PADRAO}" oninput="dtCalc('${v.id}')">
          <div class="hint" id="dtRetHint"></div></div>
        <div class="fg"><label for="dtOutros">Outros descontos (R$)</label><input type="number" id="dtOutros" step="0.01" min="0" placeholder="opcional" oninput="dtCalc('${v.id}')">
          <div class="hint">Fruição do imóvel, comissão integrada ao preço, IPTU em aberto…</div></div></div>
      <div class="fg"><label for="dtOutrosDesc">O que são os outros descontos</label><input type="text" id="dtOutrosDesc" placeholder="ex.: IPTU de 2025 e 2026"></div>
      <p class="help">Em loteamento, a Lei 13.786/2018 limita a multa e as despesas administrativas a 10% do valor atualizado do contrato, e permite descontar à parte a fruição, a comissão integrada ao preço, os encargos de atraso e o IPTU. Em incorporação, a pena vai até 25% do valor pago (50% com patrimônio de afetação). Confirme o percentual com o seu jurídico.</p></div>
    <div class="fieldset"><span class="lg">Devolução ao comprador</span>
      <div class="fg"><label for="dtForma">Forma</label><select id="dtForma" onchange="dtCalc('${v.id}')"><option value="vista">À vista</option><option value="parcelado">Parcelada (até ${DISTRATO_MAX_PARCELAS}×)</option></select></div>
      <div class="frow" id="dtVistaBox"><div class="fg"><label for="dtDataVista">Data do pagamento</label><input type="date" id="dtDataVista" value="${hoje}" oninput="dtCalc('${v.id}')"></div><div class="fg"></div></div>
      <div class="frow" id="dtParcBox" style="display:none"><div class="fg"><label for="dtN">Nº de parcelas (1 a ${DISTRATO_MAX_PARCELAS})</label><input type="text" inputmode="numeric" id="dtN" value="6" oninput="dtCalc('${v.id}')"></div>
        <div class="fg"><label for="dtPrimeiro">1º vencimento</label><input type="date" id="dtPrimeiro" value="${addMonths(hoje, 1)}" oninput="dtCalc('${v.id}')"></div></div>
      <div class="sim-result" id="dtResumo"></div></div>
    <div class="fg"><label for="dtObs">Observações</label><textarea id="dtObs" rows="2"></textarea></div>`;
  openModal({ title: 'Distrato do contrato', body, wide: true,
    footer: `<button class="btn btn-secondary" onclick="abrirContrato('${v.id}')">Cancelar</button><button class="btn btn-danger" onclick="registrarDistrato('${v.id}')">Registrar distrato</button>` });
  dtCalc(v.id);
}
/* Boleto registrado, sem depender de banco.js estar carregado. */
function registradaNoBancoSeguro(r) { return typeof registradaNoBanco === 'function' ? registradaNoBanco(r) : !!(r.nossoNumero && r.remessaEm); }
function dtDoForm() {
  return { data: val('dtData'), retencaoPct: val('dtRetPct') === '' ? DISTRATO_RETENCAO_PADRAO : num(val('dtRetPct')), outrosDescontos: num(val('dtOutros')),
    forma: val('dtForma'), nParcelas: num(val('dtN')), primeiro: val('dtPrimeiro'), dataVista: val('dtDataVista') };
}
function dtCalc(vendaId) {
  const v = getVenda(vendaId); if (!v) return;
  const f = dtDoForm(); const d = calculoDistrato(v, f);
  const parc = f.forma === 'parcelado';
  const mostra = (id, ok) => { const el = document.getElementById(id); if (el) el.style.display = ok ? '' : 'none'; };
  mostra('dtVistaBox', !parc); mostra('dtParcBox', parc);
  const hint = $('#dtRetHint');
  if (hint) hint.innerHTML = `${fmtMoney(d.retencao)} retidos${d.retencaoPct > 25 ? ' · <b style="color:var(--danger)">acima de 25%: confira se a lei permite neste caso</b>' : ''}`;
  const el = $('#dtResumo'); if (!el) return;
  const nInvalido = parc && (Math.round(f.nParcelas) < 1 || Math.round(f.nParcelas) > DISTRATO_MAX_PARCELAS);
  el.innerHTML = `Pago <b>${fmtMoney(d.pago)}</b> − retenção <b>${fmtMoney(d.retencao)}</b>${d.outrosDescontos ? ` − outros <b>${fmtMoney(d.outrosDescontos)}</b>` : ''} = devolver <b>${fmtMoney(d.devolucao)}</b>
    <br><span class="tiny ${nInvalido ? '' : 'muted'}" ${nInvalido ? 'style="color:var(--danger)"' : ''}>${nInvalido ? `O parcelamento vai de 1 a ${DISTRATO_MAX_PARCELAS} parcelas.` : esc(textoFormaDevolucao(d))}</span>`;
}

async function registrarDistrato(vendaId) {
  const v = getVenda(vendaId); if (!v) return;
  if (!pode('vendas.distrato')) { toast('🔒', 'Sem permissão', '', true); return; }
  if (v.status === 'distrato') return;
  const f = dtDoForm();
  if (!f.data) { toast('⚠️', 'Informe a data do distrato', '', true); return; }
  if (v.dataVenda && f.data < v.dataVenda) { toast('⚠️', 'Data antes da venda', `O distrato não pode ser anterior à venda (${fmtDate(v.dataVenda)}).`, true); return; }
  if (val('dtRetPct') !== '' && (num(val('dtRetPct')) < 0 || num(val('dtRetPct')) > 100)) { toast('⚠️', 'Retenção inválida', 'Use um percentual de 0 a 100.', true); return; }
  if (f.forma === 'parcelado' && !(Math.round(f.nParcelas) >= 1 && Math.round(f.nParcelas) <= DISTRATO_MAX_PARCELAS)) { toast('⚠️', `Parcelamento de 1 a ${DISTRATO_MAX_PARCELAS} vezes`, 'A devolução parcelada vai até 12 parcelas mensais.', true); return; }
  if (f.forma === 'parcelado' && !f.primeiro) { toast('⚠️', 'Informe o 1º vencimento da devolução', '', true); return; }
  const motivoTipo = val('dtMotivo'), detalhe = val('dtMotivoTxt');
  if (motivoTipo === 'outro' && !detalhe.trim()) { toast('⚠️', 'Descreva o motivo', 'Com "Outro motivo", o detalhe é obrigatório.', true); return; }
  const d = calculoDistrato(v, f);
  if (num(f.outrosDescontos) > 0 && !val('dtOutrosDesc').trim()) { toast('⚠️', 'Diga o que são os outros descontos', 'Eles vão escritos no termo de distrato.', true); return; }
  if (!(await confirmar({ titulo: `Registrar o distrato de ${imovelLabel(v)}?`, valores: [['Pago pelo comprador', fmtMoney(d.pago)], [`Retenção (${pctTxt(d.retencaoPct)})`, fmtMoney(d.retencao)]].concat(d.outrosDescontos ? [['Outros descontos', fmtMoney(d.outrosDescontos)]] : []).concat([['Devolução', `${fmtMoney(d.devolucao)} ${textoFormaDevolucao(d)}`, true]]), itens: ['As parcelas em aberto deixam de ser cobradas.', 'O imóvel volta a ficar disponível.', 'A devolução entra em A pagar.'], acao: 'Registrar distrato', perigo: true }))) return;

  const motivo = motivoDistratoTexto(motivoTipo, detalhe);
  const distrato = Object.assign({ data: f.data, motivoTipo, motivoDetalhe: detalhe, motivo, outrosDescontosDesc: val('dtOutrosDesc'), obs: val('dtObs'),
    registradoEm: new Date().toISOString(), custoIds: [] }, d);
  /* A devolução vira contas a pagar, uma por parcela, ligadas ao contrato. */
  const podeLancar = pode('custos.editar');
  if (podeLancar && d.parcelas.length) {
    if (!db.categorias.some(c => c.id === CAT_DEVOLUCAO)) upsert('categorias', { id: CAT_DEVOLUCAO, nome: 'Devolução de distrato', cor: '#64748b' });
    const n = d.parcelas.length;
    d.parcelas.forEach(p => {
      const id = genId(); distrato.custoIds.push(id);
      upsert('custos', { id, loteamentoId: v.loteamentoId, loteId: v.loteId || null, vendaId: v.id,
        descricao: `Devolução do distrato — ${imovelShort(v)}${n > 1 ? ` (${p.n}/${n})` : ''}`, categoriaId: CAT_DEVOLUCAO,
        fornecedor: v.cliente.nome, valor: p.valor, formaPagamento: 'Transferência', dataCompetencia: f.data, vencimento: p.vencimento,
        status: 'pendente', dataPagamento: null, obs: `Distrato de ${fmtDate(f.data)}`, criadoEm: new Date().toISOString() });
    });
  }
  upsert('vendas', Object.assign({}, v, { status: 'distrato', distratoEm: f.data, motivo, distrato }));
  const l = v.loteId ? getLote(v.loteId) : null;
  if (l && l.vendaId === v.id) upsert('lotes', Object.assign({}, l, { status: 'disponivel', vendaId: null, reservaId: null }));
  logAct(`Distrato: ${imovelLabel(v)}${v.numeroContrato ? ` (Nº ${v.numeroContrato})` : ''} — ${v.cliente.nome} · retenção ${fmtMoney(d.retencao)} · devolução ${fmtMoney(d.devolucao)}`);
  abrirContrato(v.id, 'resumo');
  toast('✅', 'Distrato registrado', d.devolucao > 0 ? `Devolução de ${fmtMoney(d.devolucao)} lançada em A pagar.` : 'Sem valor a devolver.');
  if (!podeLancar && d.parcelas.length) toast('⚠️', 'Lance a devolução em A pagar', 'Seu perfil não lança despesas: peça a quem lança.', true);
  perguntarTermoDistrato(v.id);
}
function perguntarTermoDistrato(vendaId) {
  const v = getVenda(vendaId); if (!v) return;
  openModal({ title: 'Gerar o termo de distrato agora?',
    body: `<p class="help">O distrato de <b>${esc(imovelLabel(v))}</b> foi registrado. Quer gerar o termo para a empresa e o comprador assinarem? Você ainda pode conferir e corrigir o texto antes de imprimir.</p>`,
    footer: `<button class="btn btn-secondary" onclick="closeModal()">Agora não</button><button class="btn btn-primary" onclick="gerarTermoDistrato('${v.id}')">Gerar termo</button>` });
}

/* Registro feito por engano: volta o contrato enquanto nenhuma devolução foi paga. */
async function desfazerDistrato(vendaId) {
  const v = getVenda(vendaId); if (!v || v.status !== 'distrato') return;
  if (!pode('vendas.distrato')) { toast('🔒', 'Sem permissão', '', true); return; }
  const d = v.distrato || {};
  const custos = (d.custoIds || []).map(id => db.custos.find(c => c.id === id)).filter(Boolean);
  if (custos.some(c => c.status === 'pago')) { toast('⚠️', 'Devolução já paga', 'Com parte da devolução paga, o distrato não pode ser desfeito.', true); return; }
  const l = v.loteId ? getLote(v.loteId) : null;
  if (l && l.status !== 'disponivel' && l.vendaId !== v.id) { toast('⚠️', 'O lote já foi vendido ou reservado de novo', 'Não dá para desfazer este distrato.', true); return; }
  if (!v.loteId && db.vendas.some(x => x.id !== v.id && x.loteamentoId === v.loteamentoId && x.status !== 'distrato' && ehCarteira(getLoteamento(v.loteamentoId)))) { toast('⚠️', 'O imóvel já foi vendido de novo', 'Não dá para desfazer este distrato.', true); return; }
  if (!(await confirmar({ titulo: `Desfazer o distrato de ${imovelLabel(v)}?`, itens: ['O contrato volta a valer e as parcelas voltam a ser cobradas.', 'O imóvel volta a ficar vendido.', 'A devolução lançada em A pagar sai.'], acao: 'Desfazer distrato', perigo: true }))) return;
  custos.forEach(c => removeRec('custos', c.id));
  upsert('vendas', Object.assign({}, v, { status: 'ativa', distratoEm: null, motivo: '', distrato: null }));
  if (l) upsert('lotes', Object.assign({}, l, { status: 'vendido', vendaId: v.id, reservaId: null }));
  atualizarStatusVenda(v.id);
  logAct(`Distrato desfeito: ${imovelLabel(v)}${v.numeroContrato ? ` (Nº ${v.numeroContrato})` : ''} — ${v.cliente.nome}`);
  abrirContrato(v.id, 'resumo'); toast('↩️', 'Distrato desfeito', 'O contrato voltou a valer.');
}

// ================================================================ NA PÁGINA DO CONTRATO
function distratoHtml(v) {
  if (v.status !== 'distrato') return '';
  const d = v.distrato;
  if (!d) return `<div class="card"><h2>Distrato</h2><p class="help">Distrato em ${fmtDate(v.distratoEm)}${v.motivo ? ` — ${esc(v.motivo)}` : ''}. Registrado antes do cálculo de retenção e devolução.</p></div>`;
  const custos = (d.custoIds || []).map(id => db.custos.find(c => c.id === id)).filter(Boolean);
  const devolvido = custos.filter(c => c.status === 'pago').reduce((s, c) => s + num(c.valor), 0);
  const linhas = (d.parcelas || []).map((p, i) => { const c = custos[i]; const st = c ? custoStatus(c) : 'pendente';
    return `<tr><td>${d.parcelas.length > 1 ? `${p.n}/${d.parcelas.length}` : 'À vista'}</td><td>${fmtDate(p.vencimento)}</td><td class="num">${fmtMoney(p.valor)}</td><td><span class="badge ${st}">${statusLabel(st)}</span></td></tr>`; }).join('');
  return `<div class="card ct-distrato"><h2>Distrato <span class="h-actions"><button class="btn btn-secondary btn-sm" onclick="gerarTermoDistrato('${v.id}')"><i class=ico data-i=file-text></i>Termo</button>${pode('vendas.distrato') && !custos.some(c => c.status === 'pago') ? `<button class="btn btn-outline-danger btn-sm" onclick="desfazerDistrato('${v.id}')">Desfazer</button>` : ''}</span></h2>
    <div class="detail-grid">
      <div><div class="k">Data</div><div class="v">${fmtDate(d.data)}</div></div><div><div class="k">Motivo</div><div class="v">${esc(d.motivo || '—')}</div></div>
      <div><div class="k">Pago pelo comprador</div><div class="v">${fmtMoney(d.pago)}</div></div><div><div class="k">Retenção (${pctTxt(d.retencaoPct)})</div><div class="v">${fmtMoney(d.retencao)}</div></div>
      ${d.outrosDescontos ? `<div><div class="k">Outros descontos</div><div class="v">${fmtMoney(d.outrosDescontos)}${d.outrosDescontosDesc ? ` <span class="tiny muted">${esc(d.outrosDescontosDesc)}</span>` : ''}</div></div>` : ''}
      <div><div class="k">Devolução</div><div class="v">${fmtMoney(d.devolucao)} <span class="tiny muted">${esc(textoFormaDevolucao(d))}</span></div></div>
      <div><div class="k">Devolvido até agora</div><div class="v">${fmtMoney(devolvido)}</div></div>
      ${d.obs ? `<div class="full"><div class="k">Observações</div><div class="v">${esc(d.obs)}</div></div>` : ''}
    </div>
    ${linhas ? `<div class="table-wrap mt"><table class="tbl"><thead><tr><th>Devolução</th><th>Vencimento</th><th class="num">Valor</th><th>Situação</th></tr></thead><tbody>${linhas}</tbody></table></div>
      <p class="help mt">As parcelas da devolução ficam em <b>A pagar</b>; é lá que você marca cada uma como paga.</p>` : ''}</div>`;
}

// ================================================================ TERMO DE DISTRATO
function contextoDistrato(v) {
  const d = v.distrato || {};
  const l = v.loteId ? getLote(v.loteId) : null, lot = getLoteamento(v.loteamentoId);
  const vendedores = todosVendedores(v);
  const ctx = docContexto({
    loteamento: lot, lote: l, cliente: v.cliente, compradores: todosCompradores(v), corretor: v.corretor, venda: v,
    vendedor: vendedores[0], vendedores, imovel: v.imovel,
    pagamento: { valorTotal: v.valorTotal, entrada: v.entrada, dataEntrada: v.dataEntrada, nParcelas: v.nParcelas, valorParcela: v.valorParcela, jurosMes: v.jurosMes, primeiroVencimento: v.primeiroVencimento, baloes: v.baloes, indiceId: v.indiceId, indiceBase: v.indiceBase },
    data: d.data || v.distratoEm
  });
  return Object.assign(ctx, {
    'contrato.data': fmtDate(v.dataVenda),
    'distrato.data': fmtDate(d.data || v.distratoEm), 'distrato.motivo': d.motivo || v.motivo || '',
    'distrato.pago': fmtMoney(d.pago), 'distrato.pagoExtenso': moedaExtenso(d.pago),
    'distrato.retencao': fmtMoney(d.retencao), 'distrato.retencaoExtenso': moedaExtenso(d.retencao), 'distrato.retencaoPct': pctTxt(d.retencaoPct),
    'distrato.outrosDescontos': d.outrosDescontos ? fmtMoney(d.outrosDescontos) : '', 'distrato.outrosDescontosDesc': d.outrosDescontosDesc || '',
    'distrato.devolucao': fmtMoney(d.devolucao), 'distrato.devolucaoExtenso': moedaExtenso(d.devolucao), 'distrato.formaDevolucao': textoFormaDevolucao(d)
  });
}
function contextoDistratoExemplo() {
  const d = { data: todayStr(), pago: 42000, retencaoPct: 25, retencao: 10500, outrosDescontos: 1200, devolucao: 30300, forma: 'parcelado', parcelas: parcelasDevolucao(30300, 6, addMonths(todayStr(), 1)) };
  return {
    'distrato.data': fmtDate(d.data), 'distrato.motivo': 'inadimplência do promitente comprador', 'distrato.pago': fmtMoney(d.pago), 'distrato.pagoExtenso': moedaExtenso(d.pago),
    'distrato.retencao': fmtMoney(d.retencao), 'distrato.retencaoExtenso': moedaExtenso(d.retencao), 'distrato.retencaoPct': '25%',
    'distrato.outrosDescontos': fmtMoney(d.outrosDescontos), 'distrato.outrosDescontosDesc': 'IPTU de 2025 e 2026',
    'distrato.devolucao': fmtMoney(d.devolucao), 'distrato.devolucaoExtenso': moedaExtenso(d.devolucao), 'distrato.formaDevolucao': textoFormaDevolucao(d),
    'contrato.data': fmtDate(addMonths(todayStr(), -18))
  };
}
function gerarTermoDistrato(vendaId, modeloId) {
  const v = getVenda(vendaId); if (!v || v.status !== 'distrato') return;
  if (!v.distrato) { toast('⚠️', 'Distrato antigo, sem os valores', 'Este distrato foi registrado antes do cálculo de retenção e devolução.', true); return; }
  const mods = modelosDo('distrato');
  if (mods.length > 1 && !modeloId) {
    openModal({ title: 'Termo de distrato',
      body: `<div class="fg"><label for="tdModelo">Modelo</label><select id="tdModelo">${mods.map(m => `<option value="${esc(m.id)}">${esc(m.nome)}</option>`).join('')}</select></div>`,
      footer: `<button class="btn btn-secondary" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" onclick="gerarTermoDistrato('${v.id}',val('tdModelo'))">Gerar termo</button>` });
    return;
  }
  const mod = mods.find(m => m.id === modeloId) || mods[0];
  const html = docHtml(mod.corpo, contextoDistrato(v));
  logAct(`Termo de distrato gerado: ${imovelLabel(v)} — ${v.cliente.nome}`);
  docPreview({ titulo: 'Termo de distrato · ' + imovelShort(v), html, arquivo: `Distrato ${imovelShort(v)} - ${v.cliente.nome}`, marca: 'agua' });
}
