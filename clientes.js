/* ===== Gestão de Loteamento — cadastro de clientes =====
   A ficha viva de quem compra. O contrato guarda uma cópia do comprador como ele estava no
   dia da assinatura; o cadastro é de onde o próximo contrato puxa os dados, sem digitar de
   novo. Um cliente é o mesmo quando tem o mesmo CPF/CNPJ; sem documento, vale o nome. */
'use strict';

function chaveCliente(p) {
  const d = onlyDigits((p || {}).cpf);
  return d ? 'doc:' + d : 'nome:' + String((p || {}).nome || '').trim().toLowerCase().replace(/\s+/g, ' ');
}
function clientePorChave(k, excetoId) { return db.clientes.find(c => c.id !== excetoId && chaveCliente(c) === k); }
function contratosDoCliente(c) {
  const k = chaveCliente(c);
  return db.vendas.filter(v => todosCompradores(v).some(p => chaveCliente(p) === k))
    .sort((a, b) => String(b.dataVenda || '').localeCompare(String(a.dataVenda || '')));
}
function podeEditarClientes() { return pode('vendas.criar') || pode('vendas.editar'); }

/* Dígitos verificadores. A declaração fiscal recusa documento inválido, então é melhor
   pegar o erro de digitação aqui do que no fim do ano. */
function cpfValido(d) {
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  const dv = n => { let s = 0; for (let i = 0; i < n; i++) s += +d[i] * (n + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
  return dv(9) === +d[9] && dv(10) === +d[10];
}
function cnpjValido(d) {
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
  const dv = n => { const pesos = n === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]; let s = 0; for (let i = 0; i < n; i++) s += +d[i] * pesos[i]; const r = s % 11; return r < 2 ? 0 : 11 - r; };
  return dv(12) === +d[12] && dv(13) === +d[13];
}
function documentoInvalido(p) {
  const d = onlyDigits((p || {}).cpf); if (!d) return '';
  if (ehPJ(p)) return cnpjValido(d) ? '' : 'CNPJ inválido';
  return cpfValido(d) ? '' : 'CPF inválido';
}

/* Só os campos da pessoa; o que é do contrato (cargo de quem assina, por exemplo) não vem. */
const CAMPOS_CLIENTE = () => TABLE_COLS.clientes.filter(k => !['id', 'obs', 'criadoEm'].includes(k));
function clienteDePessoa(p, base) {
  const out = Object.assign({}, base || { id: genId(), criadoEm: new Date().toISOString() });
  /* Nulo só onde o banco aceita (cônjuge e representante); nos outros campos o cadastro
     antigo sem aquele dado fica com o padrão do banco, em vez de recusar a linha. */
  CAMPOS_CLIENTE().forEach(k => {
    const v = (p || {})[k];
    if (v === undefined || (v === null && k !== 'conjuge' && k !== 'representante')) return;
    out[k] = v;
  });
  return out;
}
/* Compradores dos contratos que ainda não têm ficha. Quando o mesmo cliente comprou mais de
   uma vez, vale o contrato mais recente, que tem o endereço e o estado civil de agora. */
function compradoresForaDoCadastro() {
  const tem = new Set(db.clientes.map(chaveCliente));
  const novos = new Map();
  db.vendas.slice().sort((a, b) => String(a.dataVenda || '').localeCompare(String(b.dataVenda || '')))
    .forEach(v => todosCompradores(v).forEach(p => { const k = chaveCliente(p); if (!tem.has(k)) novos.set(k, p); }));
  return [...novos.values()];
}
function importarCompradores() {
  if (!podeEditarClientes()) { toast('🔒', 'Sem permissão', '', true); return; }
  const fora = compradoresForaDoCadastro(); if (!fora.length) return;
  fora.forEach(p => upsert('clientes', clienteDePessoa(p)));
  const q = fora.length === 1 ? '1 comprador trazido' : `${fora.length} compradores trazidos`;
  logAct(`Cadastro de clientes: ${q} dos contratos`);
  renderCurrent(); toast('✅', 'Clientes cadastrados', `${q} dos contratos.`);
}
/* Ao salvar um contrato, os compradores entram no cadastro ou atualizam a ficha que já
   existe. Campo em branco no contrato não apaga o que a ficha já sabia. */
function registrarClientesDaVenda(compradores) {
  (compradores || []).forEach(p => {
    if (!p || !p.nome) return;
    const ja = clientePorChave(chaveCliente(p));
    if (!ja) { upsert('clientes', clienteDePessoa(p)); return; }
    const novo = Object.assign({}, ja); let mudou = false;
    CAMPOS_CLIENTE().forEach(k => {
      const v = p[k];
      if (v === undefined || v === null || v === '') return;
      if (JSON.stringify(v) !== JSON.stringify(ja[k])) { novo[k] = v; mudou = true; }
    });
    if (mudou) upsert('clientes', novo);
  });
}

// ================================================================ TELA: CONTRATOS › CLIENTES
function renderClientes() {
  const v = $('#av-clientes'); if (!v) return;
  const f = state.filters.clientes = Object.assign({ busca: '', grupo: 'all' }, state.filters.clientes || {});
  const edita = podeEditarClientes();
  const b = f.busca.trim().toLowerCase(), bd = onlyDigits(f.busca);
  /* A faixa no alto: o número é o filtro, como nas outras listas */
  const GRUPOS = [['all', 'Todos', () => true], ['com', 'Com contrato', c => contratosDoCliente(c).length > 0], ['sem', 'Sem contrato', c => !contratosDoCliente(c).length], ['incompleto', 'Falta dado para contrato', c => faltaQualificacao(c).length > 0]];
  const doGrupo = (GRUPOS.find(g => g[0] === f.grupo) || GRUPOS[0])[2];
  const lista = db.clientes.filter(doGrupo).filter(c => !b
      || String(c.nome || '').toLowerCase().includes(b)
      || String(c.cidade || '').toLowerCase().includes(b)
      || String(c.email || '').toLowerCase().includes(b)
      || (bd.length >= 3 && (onlyDigits(c.cpf).includes(bd) || onlyDigits(c.telefone).includes(bd))))
    .sort((a, c2) => naturalCmp(a.nome || '', c2.nome || ''));
  const fora = edita ? compradoresForaDoCadastro() : [];
  const incompletos = db.clientes.filter(c => faltaQualificacao(c).length).length;
  /* Cadastro vazio com compradores nos contratos: não mostra números zerados nem "Nenhum cliente";
     a tela inteira vira o convite para trazer quem já comprou. */
  if (!db.clientes.length && fora.length) {
    v.innerHTML = `<div class="empty cli-trazer"><div class="ic"><i class=ico data-i=users></i></div>
      <p><b>${fora.length === 1 ? '1 comprador dos contratos ainda não tem ficha' : `${fora.length} compradores dos contratos ainda não têm ficha`}</b></p>
      <p class="small">Trazendo para o cadastro, os dados de cada um ficam guardados para os próximos contratos. Quem já tem ficha, pelo CPF, não é duplicado.</p>
      <p class="btn-row" style="justify-content:center"><button class="btn btn-primary" onclick="importarCompradores()">${fora.length === 1 ? 'Trazer o comprador' : `Trazer os ${fora.length} compradores`}</button><button class="btn btn-secondary" onclick="abrirClienteForm()"><i class=ico data-i=plus></i>Novo cliente</button></p></div>`;
    return;
  }
  v.innerHTML = `
    ${fora.length ? `<div class="alert info" onclick="importarCompradores()"><span><b>${fora.length === 1 ? '1 comprador dos contratos ainda sem ficha.' : `${fora.length} compradores dos contratos ainda sem ficha.`}</b> Trazer para o cadastro? Quem já tem ficha, pelo CPF, não é duplicado. <u>Trazer agora</u></span><i class=ico data-i=caret-right></i></div>` : ''}
    ${faixaHtml(GRUPOS.map(([k, l, fn]) => { const n = db.clientes.filter(fn).length; return { k: k === 'incompleto' ? 'aguardando' : k, l, n, v: k === 'incompleto' ? (n ? 'precisa completar' : 'todos prontos') : k === 'com' ? 'comprador em contrato' : k === 'sem' ? 'só no cadastro' : 'no cadastro', ativo: f.grupo === k, acao: `state.filters.clientes.grupo='${k}';renderClientes()` }; }), 'Clientes por situação')}
    <div class="filters"><input type="text" placeholder="Nome, CPF, telefone, e-mail ou cidade…" value="${esc(f.busca)}" oninput="aSetFiltro('clientes','busca',this.value,renderClientes,this)">
      ${edita ? '<button class="btn btn-primary btn-sm" onclick="abrirClienteForm()"><i class=ico data-i=plus></i>Novo cliente</button>' : ''}</div>
    ${lista.length ? `<div class="lista">${lista.map(clienteItemHtml).join('')}</div>`
      : `<div class="empty"><div class="ic"><i class=ico data-i=users></i></div><p><b>${db.clientes.length ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado'}</b></p><p class="small">${db.clientes.length ? 'Tente outro nome ou parte do CPF.' : 'Cadastre aqui ou registre um contrato: o comprador entra no cadastro sozinho.'}</p></div>`}`;
}
/* Uma linha por cliente: quem é (e o cônjuge), documento e contato, se a qualificação está
   completa para o contrato, e quantos contratos tem. */
function clienteItemHtml(c) {
  const n = contratosDoCliente(c).length; const falta = faltaQualificacao(c);
  return `<div class="item linha linha2" onclick="abrirClienteForm('${esc(c.id)}')"><div class="info">
      <div class="title">${esc(c.nome)}${ehPJ(c) ? ' <span class="badge neutral">PJ</span>' : ''}${temConjuge(c) && (c.conjuge || {}).nome ? ` <span class="tiny muted">e ${esc(c.conjuge.nome)}</span>` : ''}</div>
      <div class="meta"><span>${esc(fmtCPF(c.cpf)) || 'sem CPF'}</span>${c.telefone ? `<span>· ${esc(fmtPhone(c.telefone))}</span>` : ''}${c.cidade ? `<span>· ${esc(c.cidade)}${c.uf ? '/' + esc(c.uf) : ''}</span>` : ''}</div>
      ${falta.length ? `<div class="tiny cli-falta">Falta para o contrato: ${esc(falta.join(', '))}</div>` : ''}</div>
    <div class="side"><div class="small"><b>${n}</b> contrato${n === 1 ? '' : 's'}</div>${c.telefone ? `<div class="btns"><a class="btn-icon wa" target="_blank" href="${waLink(c.telefone, '')}" onclick="event.stopPropagation()" title="WhatsApp" aria-label="WhatsApp de ${esc(c.nome)}"><i class=ico data-i=whatsapp-logo></i></a></div>` : ''}</div></div>`;
}
function abrirClienteForm(id) {
  const c = id ? db.clientes.find(x => x.id === id) : null;
  if (id && !c) return;
  const edita = podeEditarClientes();
  const contratos = c ? contratosDoCliente(c) : [];
  const body = `<p class="help mb">Estes dados entram na qualificação do comprador no contrato. Um contrato já emitido guarda os dados como estavam no dia da assinatura; o que você mudar aqui vale para os próximos.</p>
    ${pessoaFormHtml('cl', c || {}, { conjuge: true })}
    <div class="fg"><label>Observações</label><textarea id="clObs" rows="2">${esc(c ? c.obs || '' : '')}</textarea></div>
    ${contratos.length ? `<div class="fieldset"><span class="lg">Contratos deste cliente</span>
      ${contratos.map(v => `<div class="item" onclick="setCurLotSilencioso('${esc(v.loteamentoId)}');abrirVendaAdmin('${esc(v.id)}')"><div class="info"><div class="title">${esc(imovelLabel(v))} <span class="tiny muted">· ${esc((getLoteamento(v.loteamentoId) || {}).nome || '')}</span></div>
        <div class="meta"><span>${fmtDate(v.dataVenda)}</span><span>· ${esc(fmtMoney(v.valorTotal))}</span></div></div><div class="side"><span class="badge ${v.status === 'distrato' ? 'distrato' : v.status}">${statusLabel(v.status)}</span></div></div>`).join('')}</div>` : ''}`;
  openModal({ title: c ? '' + esc(c.nome) : 'Novo cliente', body, wide: true,
    footer: `${c && edita ? `<button class="btn btn-outline-danger" onclick="excluirCliente('${esc(c.id)}')">Excluir</button>` : ''}<button class="btn btn-secondary" onclick="closeModal()">${edita ? 'Cancelar' : 'Fechar'}</button>${edita ? `<button class="btn btn-primary" onclick="salvarCliente('${c ? esc(c.id) : ''}')">Salvar</button>` : ''}` });
}
function salvarCliente(id) {
  if (!podeEditarClientes()) { toast('🔒', 'Sem permissão', 'Seu perfil não altera o cadastro de clientes.', true); return; }
  if (!val('clNome')) { toast('⚠️', 'Informe o nome', '', true); return; }
  const prev = id ? db.clientes.find(x => x.id === id) : null;
  const p = pessoaDoForm('cl', prev || {});
  p.conjuge = conjugeDoForm('cl', p, (prev || {}).conjuge);
  const inval = documentoInvalido(p);
  if (inval) { toast('⚠️', inval, 'Confira os números: o dígito verificador não bate.', true); return; }
  const cjInval = p.conjuge && onlyDigits(p.conjuge.cpf) && !cpfValido(onlyDigits(p.conjuge.cpf));
  if (cjInval) { toast('⚠️', 'CPF do cônjuge inválido', 'Confira os números.', true); return; }
  if (onlyDigits(p.cpf)) {
    const dup = clientePorChave(chaveCliente(p), id);
    if (dup) { toast('⚠️', `${ehPJ(p) ? 'CNPJ' : 'CPF'} já cadastrado`, `Pertence a ${dup.nome}. Abra a ficha dele para editar.`, true); return; }
  }
  const rec = Object.assign({}, prev || { id: genId(), criadoEm: new Date().toISOString() }, clienteDePessoa(p, {}), { obs: val('clObs') });
  upsert('clientes', rec);
  logAct(`Cliente ${prev ? 'editado' : 'cadastrado'}: ${rec.nome}`);
  closeModal(); renderCurrent(); toast('✅', prev ? 'Cliente atualizado' : 'Cliente cadastrado', rec.nome);
}
/* Em dois passos, como o contrato: o primeiro mostra o que acontece, o segundo apaga. */
function excluirCliente(id, confirmado) {
  if (!podeEditarClientes()) { toast('🔒', 'Sem permissão', '', true); return; }
  const c = db.clientes.find(x => x.id === id); if (!c) return;
  const n = contratosDoCliente(c).length;
  if (!confirmado) {
    openModal({ title: 'Excluir cliente',
      body: `<p class="mb">Excluir <b>${esc(c.nome)}</b> do cadastro de clientes?</p>
        ${n ? `<div class="alert warn" style="cursor:default"><span>É comprador em <b>${nPlural(n, 'contrato')}</b>. Os contratos não mudam, porque guardam os dados como estavam no dia. Some só a ficha do cadastro; se ele comprar de novo, os dados terão de ser digitados outra vez.</span></div>` : ''}
        <p class="help">Não dá para desfazer.</p>`,
      footer: `<button class="btn btn-secondary" onclick="abrirClienteForm('${esc(id)}')">Voltar</button><button class="btn btn-danger" onclick="excluirCliente('${esc(id)}', true)">Excluir definitivamente</button>` });
    return;
  }
  removeRec('clientes', id);
  logAct(`Cliente excluído do cadastro: ${c.nome}`);
  closeModal(); renderCurrent(); toast('🗑️', 'Cliente excluído', c.nome);
}

// ================================================================ NO CONTRATO: PUXAR DO CADASTRO
function clienteRotulo(c) { return `${c.nome}${c.cpf ? ' — ' + fmtCPF(c.cpf) : ''}`; }
function clientesDatalistHtml() {
  return `<datalist id="clientesDL">${db.clientes.slice().sort((a, b) => naturalCmp(a.nome || '', b.nome || '')).map(c => `<option value="${esc(clienteRotulo(c))}">`).join('')}</datalist>`;
}
function buscaClienteHtml(base, i) {
  if (!db.clientes.length) return '';
  return `<div class="fg cliente-busca"><label>Puxar do cadastro de clientes</label>
    <input type="text" list="clientesDL" id="${pfxPessoa(base, i)}Busca" placeholder="Digite o nome ou o CPF e escolha na lista" oninput="if (clientePorRotulo(this.value)) puxarCliente('${base}', ${i}, this.value)" onchange="puxarCliente('${base}', ${i}, this.value)"></div>`;
}
/* Troca o bloco inteiro pelo formulário já preenchido: cônjuge, endereço e estado civil
   vêm juntos, e o que for digitado depois continua valendo só para este contrato. */
function clientePorRotulo(t) { return db.clientes.find(x => clienteRotulo(x) === t); }
function puxarCliente(base, i, texto) {
  const t = String(texto || '').trim(); if (!t) return;
  const campo = document.getElementById(pfxPessoa(base, i) + 'Busca');
  /* Escolher na lista dispara input e depois change, e trocar o bloco tira o foco do campo,
     o que dispara change de novo. A trava fica no campo velho, que vai embora com o bloco. */
  if (campo && campo.dataset.puxando) return;
  const d = onlyDigits(t);
  const c = clientePorRotulo(t)
    || (d.length >= 11 ? db.clientes.find(x => onlyDigits(x.cpf) === d) : null)
    || db.clientes.find(x => String(x.nome || '').toLowerCase() === t.toLowerCase());
  if (!c) { toast('⚠️', 'Cliente não encontrado', 'Escolha um nome da lista.', true); return; }
  if (campo) campo.dataset.puxando = '1';
  const p = Object.assign({}, c); delete p.id; delete p.obs; delete p.criadoEm;
  setTimeout(() => {
    const bloco = document.getElementById(pfxPessoa(base, i) + 'Bloco'); if (!bloco) return;
    bloco.outerHTML = pessoaBlocoHtml(base, p, i, (window.__pessoasOpc || {})[base] || {});
    toast('📇', 'Dados puxados do cadastro', c.nome);
  }, 0);
}
