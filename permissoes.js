/* ===== Gestão de Loteamento — permissões por função e por pessoa =====
   O papel define o que o banco libera (dono, administrador, financeiro, corretor) e o padrão de
   cada função. Em cima do padrão, o dono marca pessoa a pessoa o que ela pode a mais ou a menos
   (Fase 6). Só fica gravado o que difere do padrão: mudar o padrão do papel continua valendo
   para tudo o que não foi ajustado na pessoa. */
'use strict';

const PERMISSOES = [
  ['Planta e lotes', [
    ['lotes.editar', 'Cadastrar e editar lotes'],
    ['planta.editar', 'Editar a planta e importar PDF/DXF'],
    ['lotes.preco', 'Alterar preços dos lotes']
  ]],
  ['Reservas e vendas', [
    ['reservas.aprovar', 'Aprovar, recusar e liberar reservas'],
    ['vendas.criar', 'Registrar vendas'],
    ['vendas.editar', 'Editar vendas já registradas'],
    ['vendas.distrato', 'Fazer distrato'],
    ['comissao.gerenciar', 'Marcar comissões como pagas']
  ]],
  ['Financeiro', [
    ['financeiro.ver', 'Ver recebíveis'],
    ['financeiro.baixar', 'Registrar e estornar pagamentos'],
    ['financeiro.antecipar', 'Antecipar e quitar contratos'],
    ['cobranca.ver', 'Ver o painel de inadimplência'],
    ['cobranca.registrar', 'Registrar cobranças'],
    ['custos.ver', 'Ver custos da obra'],
    ['custos.editar', 'Lançar e editar custos']
  ]],
  ['Cadastros e configuração', [
    ['relatorios.ver', 'Ver os relatórios'],
    ['documentos.editar', 'Editar modelos de proposta e contrato'],
    ['indices.editar', 'Cadastrar índices e lançar valores'],
    ['equipe.gerenciar', 'Gerenciar a equipe e os convites'],
    ['config.editar', 'Alterar configurações da empresa'],
    ['backup.usar', 'Fazer backup e restaurar dados']
  ]]
];

/* O que cada papel pode por padrão. O dono sempre pode tudo. */
const PERM_PADRAO = {
  admin: { todas: true },
  financeiro: {
    'lotes.editar': false, 'planta.editar': false, 'lotes.preco': false,
    'reservas.aprovar': false, 'vendas.criar': true, 'vendas.editar': true, 'vendas.distrato': false,
    'comissao.gerenciar': true,
    'financeiro.ver': true, 'financeiro.baixar': true, 'financeiro.antecipar': true,
    'cobranca.ver': true, 'cobranca.registrar': true, 'custos.ver': true, 'custos.editar': true,
    'relatorios.ver': true, 'documentos.editar': false, 'indices.editar': true,
    'equipe.gerenciar': false, 'config.editar': false, 'backup.usar': false
  },
  corretor: { nenhuma: true }   // o corretor usa a área dele, não a administração
};

function permsSalvas() { return (db.config && db.config.permissoes) || {}; }
function todasAsChaves() { const out = []; PERMISSOES.forEach(([, itens]) => itens.forEach(([k]) => out.push(k))); return out; }

/* Mapa completo de permissões de um papel, já com o que estiver salvo. */
function permsDoPapel(papel) {
  const chaves = todasAsChaves();
  const out = {};
  if (papel === 'dono') { chaves.forEach(k => { out[k] = true; }); return out; }
  const padrao = PERM_PADRAO[papel] || { nenhuma: true };
  const salvo = permsSalvas()[papel] || null;
  chaves.forEach(k => {
    if (salvo && k in salvo) out[k] = !!salvo[k];
    else if (padrao.todas) out[k] = true;
    else if (padrao.nenhuma) out[k] = false;
    else out[k] = !!padrao[k];
  });
  return out;
}

/* Ajustes pessoa a pessoa: { userId: { chave: true|false } }, só o que difere do papel. */
function permsPessoas() { return (db.config && db.config.permissoesPessoas) || {}; }
function ajustesDaPessoa(userId) { return permsPessoas()[userId] || {}; }
function temAjustes(userId) { return Object.keys(ajustesDaPessoa(userId)).length > 0; }
/* O que a pessoa pode de fato: o padrão do papel com os ajustes dela por cima. */
function permsDaPessoa(userId, papel) {
  const base = permsDoPapel(papel);
  if (papel === 'dono') return base;
  return Object.assign(base, ajustesDaPessoa(userId));
}
/* O banco não deixa o financeiro mexer na planta, no preço e nas medidas dos lotes: marcar
   essas permissões para ele não teria efeito, então elas aparecem travadas. */
const BLOQUEADAS_PELO_BANCO = { financeiro: ['lotes.editar', 'planta.editar', 'lotes.preco'] };

/* Pode fazer isso? No modo local (sem login) o administrador pode tudo. */
function pode(chave) {
  if (!Cloud.active) return true;
  if (Cloud.papel === 'dono') return true;
  return !!permsDaPessoa(Cloud.user && Cloud.user.id, Cloud.papel || 'corretor')[chave];
}
/* Papel atual por extenso, para as telas. */
function meuPapel() { return Cloud.active ? (Cloud.papel || 'corretor') : 'dono'; }

/* Itens do menu lateral e a permissão que cada um pede. */
const TAB_PERM = {
  reservas: 'reservas.aprovar', vendas: 'vendas.criar', contrato: 'vendas.criar', clientes: 'vendas.criar', recebiveis: 'financeiro.ver',
  cobranca: 'cobranca.ver', boletos: 'financeiro.ver', caixa: 'financeiro.ver', custos: 'custos.ver',
  indices: 'indices.editar', relatorios: 'relatorios.ver'
};
function abaPermitida(tab) {
  if (!Cloud.active) return true;
  const chave = TAB_PERM[tab];
  return !chave || pode(chave) || ((tab === 'vendas' || tab === 'contrato' || tab === 'clientes') && pode('vendas.editar'));
}
/* Esconde do menu o que a pessoa não pode ver, e o título do grupo que ficou vazio. */
function aplicarPermissoesNasAbas() {
  let precisaTrocar = false;
  $$('#screen-admin .tab').forEach(t => {
    const ok = abaPermitida(t.dataset.tab);
    t.style.display = ok ? '' : 'none';
    if (!ok && state.tab === t.dataset.tab) precisaTrocar = true;
  });
  const novo = $('#aNovoContrato');
  if (novo) novo.style.display = pode('vendas.criar') ? '' : 'none';
  $$('#screen-admin .aside-grupo').forEach(g => {
    const itens = $$(`#screen-admin [data-g="${g.dataset.grupo}"]`);
    g.style.display = itens.some(i => i.style.display !== 'none') ? '' : 'none';
  });
  if (precisaTrocar) {
    const primeira = $$('#screen-admin .tab').find(t => t.style.display !== 'none');
    if (primeira) switchTab(primeira.dataset.tab);
  }
}
/* Bloqueio padrão quando alguém chega numa tela sem permissão. */
function semPermissaoHtml(oQue) {
  return `<div class="card"><div class="empty"><div class="ic"><i class=ico data-i=lock></i></div><p><b>Sem permissão</b></p>
    <p class="small">Seu perfil (${esc(statusLabel(meuPapel()))}) não tem acesso a ${esc(oQue)}. Fale com o dono da empresa se precisar.</p></div></div>`;
}

// ================================================================ CADASTRO
function cadPermissoesHtml() {
  if (Cloud.active && !pode('equipe.gerenciar') && Cloud.papel !== 'dono') return semPermissaoHtml('permissões');
  const papeis = [['admin', 'Administrador'], ['financeiro', 'Financeiro'], ['corretor', 'Corretor']];
  const sub = state.sub.perm || 'admin';
  const perms = permsDoPapel(sub);
  const salvo = !!permsSalvas()[sub];
  const ajustadas = Cloud.active ? Cloud.membros.filter(m => m.papel !== 'dono' && temAjustes(m.userId)) : [];
  return `<div class="card"><h2>Padrão de cada função</h2>
    <p class="help">O <b>papel</b> é o ponto de partida do que a pessoa vê e pode fazer. Para ajustar <b>uma pessoa</b>, vá em <b>Equipe</b> e toque em <b>Permissões</b> ao lado dela. O dono sempre pode tudo. Nas ações com dinheiro, contratos, despesas, equipe e configuração, o banco de dados confere essas mesmas regras: quem não tem a permissão é recusado mesmo fora do aplicativo.</p>
    ${ajustadas.length ? `<div class="alert info" style="cursor:default"><span><b>${ajustadas.length} pessoa(s) com permissões próprias:</b> ${ajustadas.map(m => `<button class="link" onclick="abrirPermissoesPessoa('${m.id}')">${esc(m.nome || m.email)}</button>`).join(', ')}. Nelas, o que foi ajustado vale mais que o padrão abaixo.</span></div>` : ''}
    ${!Cloud.active ? '<div class="alert info" style="cursor:default"><span>No modo só deste dispositivo existe um único administrador, que pode tudo. As permissões valem na versão em nuvem, com login por pessoa.</span></div>' : ''}
    <div class="subtabs">${papeis.map(([k, l]) => `<div class="chip ${sub === k ? 'active' : ''}" onclick="state.sub.perm='${k}';renderCurrent()">${l}</div>`).join('')}</div>
    <p class="help">${sub === 'corretor'
      ? 'O corretor usa a área dele: planta, lotes, as próprias reservas e as próprias comissões. Marque abaixo só o que ele também poderá fazer na administração.'
      : sub === 'financeiro'
        ? 'Perfil pensado para quem cuida do dinheiro: recebíveis, despesas, cobrança, índices e vendas. O banco de dados impede que ele mexa na planta, no preço e nas medidas dos lotes, mesmo que você marque abaixo.'
        : 'Perfil de administrador: por padrão pode tudo, menos o que você desmarcar aqui.'}</p>
    ${PERMISSOES.map(([grupo, itens]) => `<div class="fieldset"><span class="lg">${esc(grupo)}</span>
      ${itens.map(([k, rot]) => `<label class="check" style="margin-bottom:6px"><input type="checkbox" id="pm_${k.replace(/\W/g, '_')}" ${perms[k] ? 'checked' : ''}> ${esc(rot)}</label>`).join('')}
    </div>`).join('')}
    <div class="btn-row"><button class="btn btn-primary" onclick="salvarPermissoes('${sub}')">Salvar permissões do ${esc(papeis.find(p => p[0] === sub)[1].toLowerCase())}</button>
      ${salvo ? `<button class="btn btn-secondary" onclick="restaurarPermissoes('${sub}')">Voltar ao padrão</button>` : ''}</div>
    <p class="help mt">Quem estiver logado vê a mudança na próxima vez que abrir o app ou trocar de aba.</p></div>`;
}

// ================================================================ POR PESSOA
function abrirPermissoesPessoa(membroId) {
  const m = Cloud.membros.find(x => x.id === membroId); if (!m) return;
  const nome = esc(m.nome || m.email || '(sem nome)');
  const voltar = `<button class="btn btn-secondary" onclick="abrirMembroForm('${m.id}')">Voltar</button>`;
  if (m.papel === 'dono') return openModal({ title: `Permissões · ${nome}`, body: '<p class="small">O dono da empresa pode tudo. Não há o que ajustar.</p>', footer: voltar });
  if (m.papel === 'corretor') return openModal({ title: `Permissões · ${nome}`, body: '<p class="small">Corretor usa a área do corretor (planta, lotes, as próprias reservas e comissões), não a administração. Para dar acesso a telas do escritório, mude o papel dele para <b>Financeiro</b> ou <b>Administrador</b> e depois ajuste aqui.</p>', footer: voltar });
  if (m.userId === Cloud.user.id) return openModal({ title: 'Suas permissões', body: '<p class="small">Ninguém ajusta as próprias permissões, para não se trancar fora sem querer. Quem ajusta as suas é o dono da empresa.</p>', footer: voltar });
  const base = permsDoPapel(m.papel), aj = ajustesDaPessoa(m.userId), efetivo = permsDaPessoa(m.userId, m.papel);
  const travadas = BLOQUEADAS_PELO_BANCO[m.papel] || [];
  const body = `<p class="help mb">Partindo do padrão de <b>${esc(statusLabel(m.papel).toLowerCase())}</b>. Marque ou desmarque o que for diferente para ${nome}; o resto continua seguindo o padrão da função.</p>
    ${PERMISSOES.map(([grupo, itens]) => `<div class="fieldset"><span class="lg">${esc(grupo)}</span>
      ${itens.map(([k, rot]) => { const trav = travadas.includes(k); const ajustada = k in aj && !trav;
        return `<label class="check perm-linha" style="margin-bottom:6px"><input type="checkbox" data-perm="${k}" ${efetivo[k] && !trav ? 'checked' : ''} ${trav ? 'disabled' : ''} onchange="marcarAjustePerm(this, ${!!base[k]})"> <span>${esc(rot)}</span>
          <span class="perm-tag ${ajustada ? 'ajustada' : ''}">${trav ? 'o banco não libera' : ajustada ? 'ajustado' : 'padrão'}</span></label>`; }).join('')}
    </div>`).join('')}`;
  openModal({ title: `Permissões · ${nome}`, body, footer: `${voltar}${temAjustes(m.userId) ? `<button class="btn btn-secondary" onclick="restaurarPermissoesPessoa('${m.id}')">Voltar ao padrão</button>` : ''}<button class="btn btn-primary" onclick="salvarPermissoesPessoa('${m.id}')">Salvar</button>` });
}
/* Mostra na hora, ao lado da opção, se ela ficou igual ao padrão ou ajustada */
function marcarAjustePerm(el, padrao) {
  const tag = el.parentElement.querySelector('.perm-tag'); if (!tag) return;
  const ajustada = el.checked !== padrao;
  tag.classList.toggle('ajustada', ajustada); tag.textContent = ajustada ? 'ajustado' : 'padrão';
}
function salvarPermissoesPessoa(membroId) {
  const m = Cloud.membros.find(x => x.id === membroId); if (!m) return;
  const base = permsDoPapel(m.papel), ajustes = {};
  document.querySelectorAll('#modalBody input[data-perm]:not(:disabled)').forEach(el => { if (el.checked !== !!base[el.dataset.perm]) ajustes[el.dataset.perm] = el.checked; });
  const todas = Object.assign({}, permsPessoas());
  if (Object.keys(ajustes).length) todas[m.userId] = ajustes; else delete todas[m.userId];
  setConfig({ permissoesPessoas: todas });
  const n = Object.keys(ajustes).length;
  logAct(`Permissões de ${m.nome || m.email} atualizadas (${n} ajuste(s) sobre o padrão de ${statusLabel(m.papel).toLowerCase()})`);
  closeModal(); renderCurrent();
  toast('✅', 'Permissões salvas', n ? `${m.nome || m.email}: ${n} ajuste(s) sobre o padrão` : `${m.nome || m.email} segue o padrão da função`);
}
function restaurarPermissoesPessoa(membroId) {
  const m = Cloud.membros.find(x => x.id === membroId); if (!m) return;
  const todas = Object.assign({}, permsPessoas()); delete todas[m.userId];
  setConfig({ permissoesPessoas: todas });
  logAct(`Permissões de ${m.nome || m.email} voltaram ao padrão`);
  closeModal(); renderCurrent(); toast('↩️', 'Padrão da função restaurado', m.nome || m.email);
}

function salvarPermissoes(papel) {
  const mapa = {};
  todasAsChaves().forEach(k => { const el = document.getElementById('pm_' + k.replace(/\W/g, '_')); if (el) mapa[k] = el.checked; });
  const todas = Object.assign({}, permsSalvas());
  todas[papel] = mapa;
  setConfig({ permissoes: todas });
  logAct(`Permissões do papel ${papel} atualizadas`);
  renderCurrent(); renderCurrent();
  toast('✅', 'Permissões salvas', statusLabel(papel));
}
function restaurarPermissoes(papel) {
  const todas = Object.assign({}, permsSalvas());
  delete todas[papel];
  setConfig({ permissoes: todas });
  renderCurrent(); renderCurrent();
  toast('↩️', 'Padrão restaurado', statusLabel(papel));
}
