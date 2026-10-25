/* ===== Lotifly — cessão de direitos =====
   O comprador (cedente) passa o contrato para outra pessoa (cessionário), com a anuência da
   empresa. O contrato continua o mesmo — número, lote, parcelas, índice — e muda quem é o
   comprador: daqui em diante as cobranças, os boletos novos e a escritura são do cessionário.
   O que já foi pago continua no contrato, em nome de quem pagou: cada cessão guarda os
   cedentes, e o recibo de um pagamento antigo sai no nome deles (compradoresNaData). */
'use strict';

/* O que está em aberto no contrato agora: o cessionário assume isso. */
function saldoEmAberto(v) {
  const abertas = recebiveisDe(v.id).filter(r => recRestante(r) > 0.005);
  return {
    n: abertas.length,
    total: Math.round(abertas.reduce((s, r) => s + recRestante(r), 0) * 100) / 100,
    atrasadas: abertas.filter(r => recStatus(r) === 'atrasado'),
    boletos: abertas.filter(r => r.nossoNumero)
  };
}
function cessoesDe(v) { return ((v && v.cessoes) || []).slice().sort((a, b) => String(a.data).localeCompare(String(b.data)) || String(a.registradoEm).localeCompare(String(b.registradoEm))); }
function podeCeder(v) { return !!v && v.status !== 'distrato' && pode('vendas.editar'); }

// ================================================================ FORMULÁRIO
function abrirCessao(vendaId) {
  const v = getVenda(vendaId); if (!v) return;
  if (!pode('vendas.editar')) { toast('🔒', 'Sem permissão', 'Seu perfil não altera contratos.', true); return; }
  if (v.status === 'distrato') { toast('⚠️', 'Contrato distratado', 'Não dá para ceder um contrato desfeito.', true); return; }
  const s = saldoEmAberto(v);
  const cedentes = todosCompradores(v);
  const atraso = s.atrasadas.reduce((t, r) => t + recRestante(r), 0);
  const body = `
    <p class="help mb">Quem recebe o contrato (o <b>cessionário</b>) passa a ser o comprador: assume as parcelas em aberto, recebe as cobranças e assina a escritura. As parcelas já pagas continuam no contrato, em nome de quem pagou.</p>
    <div class="detail-grid mb">
      <div><div class="k">Cedente${cedentes.length > 1 ? 's' : ''} (comprador hoje)</div><div class="v">${esc(nomesDasPartes(cedentes))}</div></div>
      <div><div class="k">Fica para o cessionário</div><div class="v">${s.n} parcela(s) · ${fmtMoney(s.total)}</div></div>
    </div>
    ${s.atrasadas.length ? `<div class="alert warn" style="cursor:default"><span><b>${s.atrasadas.length} parcela(s) em atraso</b> (${fmtMoney(atraso)}). Normalmente a cessão só é feita com o contrato em dia: combine quem paga o atraso antes de registrar.</span></div>` : ''}
    ${s.boletos.length ? `<div class="alert info" style="cursor:default"><span><b>${s.boletos.length} parcela(s) já têm boleto registrado no banco</b> em nome de ${esc(cedentes[0] ? cedentes[0].nome : 'quem cedeu')}. O banco continua cobrando o cedente: depois da cessão, gere boletos novos dessas parcelas.</span></div>` : ''}
    <div class="fieldset"><span class="lg">Cessionário (novo comprador)</span>
      ${pessoasListaHtml('cs', [], { recolher: true, conjuge: true, telObrigatorio: true, obrigatorio: true, cadastro: true, rotulo: 'Cessionário', rotuloBotao: 'Adicionar cessionário' })}
      <p class="help mt">Casal não precisa de dois blocos: use o estado civil e o cônjuge, que assina junto.</p></div>
    <div class="fieldset"><span class="lg">Condições da cessão</span>
      <div class="frow"><div class="fg"><label>Data da cessão *</label><input type="date" id="csData" value="${todayStr()}"></div>
        <div class="fg"><label>Valor entre as partes (R$)</label><input type="number" id="csValor" step="0.01" min="0" placeholder="opcional"><div class="hint">O que o cessionário paga ao cedente. Não entra no caixa da empresa, só no termo.</div></div></div>
      <div class="frow"><div class="fg"><label>Taxa de cessão (R$)</label><input type="number" id="csTaxa" step="0.01" min="0" placeholder="opcional"><div class="hint">Cobrada pela empresa para dar a anuência. Entra no contrato como recebida na data da cessão.</div></div>
        <div class="fg"><label>Forma de pagamento da taxa</label><select id="csForma">${['PIX', 'Boleto', 'Transferência', 'Dinheiro', 'Cartão', 'Cheque'].map(o => `<option>${o}</option>`).join('')}</select></div></div>
      <div class="fg"><label>Observações</label><textarea id="csObs" rows="2"></textarea></div></div>`;
  openModal({ title: 'Cessão de direitos', body, wide: true,
    footer: `<button class="btn btn-secondary" onclick="abrirContrato('${v.id}')">Cancelar</button><button class="btn btn-primary" onclick="registrarCessao('${v.id}')">Registrar cessão</button>` });
}

async function registrarCessao(vendaId) {
  const v = getVenda(vendaId); if (!v) return;
  if (!pode('vendas.editar')) { toast('🔒', 'Sem permissão', '', true); return; }
  const data = val('csData');
  if (!data) { toast('⚠️', 'Informe a data da cessão', '', true); return; }
  if (v.dataVenda && data < v.dataVenda) { toast('⚠️', 'Data antes da venda', `A cessão não pode ser anterior à venda (${fmtDate(v.dataVenda)}).`, true); return; }
  const cessionarios = pessoasDoFormLista('cs', []);
  if (!cessionarios.length) { toast('⚠️', 'Informe o cessionário', 'Nome e qualificação de quem recebe o contrato.', true); return; }
  /* Mesma regra da venda: o termo e a escritura não saem sem a qualificação completa. */
  const pend = cessionarios.map((p, i) => ({ i, f: faltaQualificacao(p) })).filter(o => o.f.length);
  if (pend.length) {
    toast('⚠️', 'Qualificação incompleta', `${cessionarios.length > 1 ? `Cessionário ${pend[0].i + 1}: ` : ''}falta ${pend[0].f.join(', ')}.`, true);
    const foco = document.getElementById(pfxPessoa('cs', pend[0].i) + 'Nome'); if (foco) foco.scrollIntoView({ block: 'center' });
    return;
  }
  if (!cessionarios[0].telefone) { toast('⚠️', 'Informe o telefone do cessionário', 'É por ele que as cobranças vão chegar.', true); return; }
  const invalido = typeof documentoInvalido === 'function' ? cessionarios.map(documentoInvalido).find(Boolean) : '';
  if (invalido) { toast('⚠️', invalido, 'Confira os números: o dígito verificador não bate.', true); return; }
  const cedentes = todosCompradores(v);
  const docs = new Set(cedentes.map(p => onlyDigits(p.cpf)).filter(Boolean));
  if (cessionarios.some(p => onlyDigits(p.cpf) && docs.has(onlyDigits(p.cpf)))) { toast('⚠️', 'Cessionário já é comprador', 'Quem recebe o contrato não pode ser quem já é comprador dele.', true); return; }
  const s = saldoEmAberto(v);
  const valor = Math.max(0, num(val('csValor'))), taxa = Math.max(0, num(val('csTaxa')));
  if (!(await confirmar({ titulo: 'Registrar a cessão de direitos?', valores: [['De', nomesDasPartes(cedentes)], ['Para', nomesDasPartes(cessionarios), true]], texto: `A partir de agora o comprador é ${cessionarios[0].nome}: cobranças, boletos novos e escritura vão para ${cessionarios.length > 1 ? 'os cessionários' : 'ele'}.`, acao: 'Registrar cessão' }))) return;

  const cessao = {
    id: genId(), data, cedentes: JSON.parse(JSON.stringify(cedentes)), cessionarios,
    valor, taxa, parcelasEmAberto: s.n, saldo: s.total, obs: val('csObs'),
    registradoEm: new Date().toISOString(), registradoPor: Cloud.active ? ((Cloud.membro || {}).nome || '') : ''
  };
  /* A taxa da empresa entra como recebida na data: aparece no caixa e no extrato, nunca em
     aberto, e não é corrigida pelo índice. */
  let taxaRec = null;
  if (taxa > 0) {
    taxaRec = { id: genId(), vendaId: v.id, loteamentoId: v.loteamentoId, tipo: 'taxa', numero: 2000 + (v.cessoes || []).length,
      descricao: 'Taxa de cessão', vencimento: data, valor: taxa, valorPago: taxa, dataPagamento: data, forma: val('csForma'),
      obsPagamento: `Cessão de ${nomesDasPartes(cedentes)} para ${nomesDasPartes(cessionarios)}` };
    cessao.taxaRecebivelId = taxaRec.id;
  }
  upsert('vendas', Object.assign({}, v, { cliente: cessionarios[0], compradoresExtras: cessionarios.slice(1), cessoes: (v.cessoes || []).concat([cessao]) }));
  if (taxaRec) upsert('recebiveis', taxaRec);
  if (typeof registrarClientesDaVenda === 'function') registrarClientesDaVenda(cessionarios);
  logAct(`Cessão de direitos: ${imovelLabel(v)}${v.numeroContrato ? ` (Nº ${v.numeroContrato})` : ''} — de ${nomesDasPartes(cedentes)} para ${nomesDasPartes(cessionarios)}`);
  atualizarStatusVenda(v.id);
  abrirContrato(v.id, 'partes');
  toast('✅', 'Cessão registrada', `${cessionarios[0].nome} agora é o comprador.`);
  perguntarTermoCessao(v.id, cessao.id);
}
function perguntarTermoCessao(vendaId, cessaoId) {
  const v = getVenda(vendaId); if (!v) return;
  openModal({ title: 'Gerar o termo de cessão agora?',
    body: `<p class="help">A cessão para <b>${esc(v.cliente.nome)}</b> foi registrada. Quer gerar o termo de cessão de direitos para as partes e a empresa assinarem? Você ainda pode conferir e corrigir o texto antes de imprimir.</p>`,
    footer: `<button class="btn btn-secondary" onclick="closeModal()">Agora não</button><button class="btn btn-primary" onclick="gerarTermoCessao('${v.id}','${cessaoId}')">Gerar termo</button>` });
}

/* Registro feito por engano: só a última cessão pode ser desfeita, e o contrato volta para os
   cedentes dela. A taxa lançada junto sai; os pagamentos registrados depois continuam. */
async function desfazerCessao(vendaId, cessaoId) {
  const v = getVenda(vendaId); if (!v) return;
  if (!pode('vendas.editar')) { toast('🔒', 'Sem permissão', '', true); return; }
  const cs = cessoesDe(v); const ult = cs[cs.length - 1];
  if (!ult || ult.id !== cessaoId) { toast('⚠️', 'Só a última cessão pode ser desfeita', '', true); return; }
  if (!(await confirmar({ titulo: `Desfazer a cessão de ${fmtDate(ult.data)}?`, texto: `O contrato volta para ${nomesDasPartes(ult.cedentes)}${ult.taxaRecebivelId ? ' e a taxa de cessão lançada sai do contrato' : ''}. Os pagamentos registrados depois continuam.`, acao: 'Desfazer cessão', perigo: true }))) return;
  const cedentes = (ult.cedentes || []).filter(p => p && p.nome);
  upsert('vendas', Object.assign({}, v, { cliente: cedentes[0] || v.cliente, compradoresExtras: cedentes.slice(1), cessoes: (v.cessoes || []).filter(c => c.id !== ult.id) }));
  if (ult.taxaRecebivelId && db.recebiveis.some(r => r.id === ult.taxaRecebivelId)) removeRec('recebiveis', ult.taxaRecebivelId);
  logAct(`Cessão desfeita: ${imovelLabel(v)}${v.numeroContrato ? ` (Nº ${v.numeroContrato})` : ''} — volta para ${nomesDasPartes(cedentes)}`);
  atualizarStatusVenda(v.id);
  abrirContrato(v.id, 'partes'); toast('↩️', 'Cessão desfeita', `O comprador voltou a ser ${cedentes[0] ? cedentes[0].nome : ''}.`);
}

// ================================================================ NA PÁGINA DO CONTRATO
function cessoesHtml(v) {
  const cs = cessoesDe(v); if (!cs.length) return '';
  const ult = cs[cs.length - 1];
  return `<div class="card"><h2>Cessões de direitos</h2>
    ${cs.slice().reverse().map(c => `<div class="item ct-cessao" style="cursor:default"><div class="info">
        <div class="title">${fmtDate(c.data)} · de ${esc(nomesDasPartes(c.cedentes))} para ${esc(nomesDasPartes(c.cessionarios))}</div>
        <div class="meta"><span>${c.parcelasEmAberto || 0} parcela(s) em aberto · ${fmtMoney(c.saldo)}</span>${c.valor ? `<span>· valor entre as partes ${fmtMoney(c.valor)}</span>` : ''}${c.taxa ? `<span>· taxa ${fmtMoney(c.taxa)}</span>` : ''}${c.obs ? `<span>· ${esc(c.obs)}</span>` : ''}</div></div>
      <div class="side"><div class="btn-row" style="margin:0"><button class="btn btn-secondary btn-sm" onclick="gerarTermoCessao('${v.id}','${c.id}')"><i class=ico data-i=file-text></i>Termo</button>${c.id === ult.id && pode('vendas.editar') ? `<button class="btn btn-outline-danger btn-sm" onclick="desfazerCessao('${v.id}','${c.id}')">Desfazer</button>` : ''}</div></div></div>`).join('')}
    <p class="help mt">Os pagamentos anteriores a cada cessão foram feitos pelos cedentes, e os recibos deles saem no nome de quem pagou.</p></div>`;
}

// ================================================================ TERMO DE CESSÃO
function contextoCessao(v, c) {
  const l = v.loteId ? getLote(v.loteId) : null, lot = getLoteamento(v.loteamentoId);
  const vendedores = todosVendedores(v);
  const ctx = docContexto({
    loteamento: lot, lote: l, cliente: c.cessionarios[0], compradores: c.cessionarios, corretor: v.corretor, venda: v,
    vendedor: vendedores[0], vendedores, imovel: v.imovel,
    pagamento: { valorTotal: v.valorTotal, entrada: v.entrada, dataEntrada: v.dataEntrada, nParcelas: v.nParcelas, valorParcela: v.valorParcela, jurosMes: v.jurosMes, primeiroVencimento: v.primeiroVencimento, baloes: v.baloes, indiceId: v.indiceId, indiceBase: v.indiceBase },
    data: c.data
  });
  return Object.assign(ctx, {
    'cedente.qualificacao': qualificacaoPartes(c.cedentes), 'cedente.nomes': nomesDasPartes(c.cedentes),
    'cessionario.qualificacao': qualificacaoPartes(c.cessionarios), 'cessionario.nomes': nomesDasPartes(c.cessionarios),
    'cessao.data': fmtDate(c.data), 'cessao.valor': c.valor ? fmtMoney(c.valor) : '', 'cessao.valorExtenso': c.valor ? moedaExtenso(c.valor) : '',
    'cessao.taxa': c.taxa ? fmtMoney(c.taxa) : '', 'cessao.parcelasEmAberto': String(c.parcelasEmAberto || 0),
    'cessao.saldo': fmtMoney(c.saldo), 'cessao.saldoExtenso': moedaExtenso(c.saldo),
    'contrato.data': fmtDate(v.dataVenda),
    'assinaturas.cedentes': linhasAssinatura(c.cedentes, 'Cedente'),
    'assinaturas.cessionarios': linhasAssinatura(c.cessionarios, 'Cessionário'),
    'assinaturas.vendedores': linhasAssinatura(vendedores, 'Anuente — promitente vendedora')
  });
}
/* Dados fictícios para o "Ver exemplo" do editor de modelos. */
function contextoCessaoExemplo() {
  const ced = [{ tipo: 'pf', genero: 'm', nome: 'Carlos Pereira', nacionalidade: 'brasileiro', estadoCivil: 'solteiro', profissao: 'comerciante', cpf: '22222222222', logradouro: 'Rua Exemplo', numeroEnd: '200', cidade: 'Sua cidade', uf: 'SC' }];
  const ces = [{ tipo: 'pf', genero: 'f', nome: 'Ana Souza', nacionalidade: 'brasileiro', estadoCivil: 'solteiro', profissao: 'enfermeira', cpf: '33333333333', logradouro: 'Rua Modelo', numeroEnd: '50', cidade: 'Sua cidade', uf: 'SC' }];
  return {
    'cedente.qualificacao': qualificacaoPartes(ced), 'cedente.nomes': nomesDasPartes(ced),
    'cessionario.qualificacao': qualificacaoPartes(ces), 'cessionario.nomes': nomesDasPartes(ces),
    'cessao.data': fmtDate(todayStr()), 'cessao.valor': fmtMoney(45000), 'cessao.valorExtenso': moedaExtenso(45000), 'cessao.taxa': fmtMoney(1500),
    'cessao.parcelasEmAberto': '48', 'cessao.saldo': fmtMoney(91263.84), 'cessao.saldoExtenso': moedaExtenso(91263.84), 'contrato.data': fmtDate(addMonths(todayStr(), -12)),
    'assinaturas.cedentes': linhasAssinatura(ced, 'Cedente'), 'assinaturas.cessionarios': linhasAssinatura(ces, 'Cessionário')
  };
}
function gerarTermoCessao(vendaId, cessaoId, modeloId) {
  const v = getVenda(vendaId); if (!v) return;
  const cs = cessoesDe(v); const c = cs.find(x => x.id === cessaoId) || cs[cs.length - 1];
  if (!c) { toast('⚠️', 'Este contrato não tem cessão registrada', '', true); return; }
  const mods = modelosDo('cessao');
  /* Mais de um modelo de cessão: pergunta qual antes de gerar. */
  if (mods.length > 1 && !modeloId) {
    openModal({ title: 'Termo de cessão',
      body: `<div class="fg"><label>Modelo</label><select id="tcModelo">${mods.map(m => `<option value="${esc(m.id)}">${esc(m.nome)}</option>`).join('')}</select></div>`,
      footer: `<button class="btn btn-secondary" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" onclick="gerarTermoCessao('${v.id}','${c.id}',val('tcModelo'))">Gerar termo</button>` });
    return;
  }
  const mod = mods.find(m => m.id === modeloId) || mods[0];
  const html = docHtml(mod.corpo, contextoCessao(v, c));
  logAct(`Termo de cessão gerado: ${imovelLabel(v)} — ${nomesDasPartes(c.cessionarios)}`);
  docPreview({ titulo: 'Termo de cessão · ' + imovelShort(v), html, arquivo: `Cessão ${imovelShort(v)} - ${c.cessionarios[0].nome}`, marca: 'agua' });
}
