/* ===== Seleção em lote e lista em partes =====
   Nas listas grandes (Imóveis, Contratos, Clientes, Reservas, A receber, A pagar): uma caixinha
   em cada linha e "Selecionar todas" no alto; a lista mostra 30 de cada vez e traz mais 30 ao
   chegar no fim (ou no botão "Mostrar mais"); com algo marcado, a barra embaixo diz quantas e
   oferece o que fazer com elas: imprimir, exportar, excluir e as ações próprias da tela.

   Cada tela chama listaSelecionavel(chave, itens, linhaHtml, opcoes) no lugar de montar a
   <div class="lista"> à mão. "itens" é a lista já filtrada e ordenada; a seleção vale só para
   ela: o que sai do filtro sai da seleção, para "Excluir" nunca pegar o que não está à vista. */
'use strict';

const POR_VEZ = 30;
const Sel = { telas: {}, atual: null, io: null };

function selConjunto(chave) { state.sel = state.sel || {}; return (state.sel[chave] = state.sel[chave] || new Set()); }
function selIds(chave) { return [...selConjunto(chave)]; }
function selLimpar(chave) { selConjunto(chave).clear(); atualizarSelecao(chave); }

/* A lista: cabeçalho com "Selecionar todas", as primeiras linhas e o marcador de "tem mais".
   opcoes: { id: item => id, rotulo: item => texto para leitor de tela, acoes: [...],
             colunas: [[título, item => texto]] (impressão e planilha), titulo, classe } */
function listaSelecionavel(chave, itens, linhaHtml, opcoes = {}) {
  const idDe = opcoes.id || (x => x.id);
  const ids = itens.map(idDe), sel = selConjunto(chave), vistos = new Set(ids);
  [...sel].forEach(id => { if (!vistos.has(id)) sel.delete(id); });
  /* Quantas mostrar: as mesmas de antes enquanto a lista for a mesma; lista nova começa em 30 */
  state.pag = state.pag || {};
  const assinatura = ids.length + ':' + ids.slice(0, 3).join(',');
  const pag = state.pag[chave] && state.pag[chave].assinatura === assinatura ? state.pag[chave] : (state.pag[chave] = { assinatura, n: POR_VEZ });
  Sel.telas[chave] = { itens, ids, idDe, linhaHtml, opcoes };
  Sel.atual = chave;
  const n = Math.min(pag.n, itens.length);
  setTimeout(() => { observarMais(); atualizarSelecao(chave); }, 0);
  return `<div class="sel-topo" data-sel="${esc(chave)}">
      <label class="sel-todas"><input type="checkbox" data-sel-todas="${esc(chave)}" onchange="selTodas('${esc(chave)}', this.checked)"> <span>Selecionar todas <span class="muted">(${itens.length})</span></span></label>
      <span class="sel-vendo tiny muted" aria-live="polite">${itens.length > n ? `mostrando ${n} de ${itens.length}` : ''}</span></div>
    <div class="${opcoes.classe || 'lista'}" data-sel-lista="${esc(chave)}">${itens.slice(0, n).map(x => linhaComCaixa(chave, x)).join('')}</div>
    ${itens.length > n ? maisHtml(chave, n, itens.length) : ''}`;
}
function maisHtml(chave, n, total) {
  return `<div class="sel-mais" data-sel-mais="${esc(chave)}"><button type="button" class="btn btn-secondary btn-sm" onclick="carregarMais('${esc(chave)}')">Mostrar mais ${Math.min(POR_VEZ, total - n)} <span class="muted">(${n} de ${total})</span></button></div>`;
}
/* A caixinha entra no começo da linha, sem mexer no desenho dela */
function linhaComCaixa(chave, x) {
  const t = Sel.telas[chave], id = t.idDe(x), marcado = selConjunto(chave).has(id);
  const rot = t.opcoes.rotulo ? t.opcoes.rotulo(x) : '';
  const caixa = `<input type="checkbox" class="sel-chk" data-sel-id="${esc(id)}" ${marcado ? 'checked' : ''} aria-label="Selecionar${rot ? ' ' + esc(rot) : ''}" onclick="event.stopPropagation()" onkeydown="event.stopPropagation()" onchange="selMarcar('${esc(chave)}', this.dataset.selId, this.checked)">`;
  return t.linhaHtml(x).replace(/^(\s*<div\b)([^>]*?)class="([^"]*)"([^>]*)>/, (m, a, b, cls, d) => `${a}${b}class="${cls} com-sel${marcado ? ' sel-on' : ''}"${d}>${caixa}`);
}
/* Mais 30: as linhas entram no fim da lista, sem redesenhar a tela (a rolagem não pula) */
function carregarMais(chave) {
  const t = Sel.telas[chave], pag = (state.pag || {})[chave]; if (!t || !pag) return;
  const lista = document.querySelector(`[data-sel-lista="${chave}"]`); if (!lista) return;
  const de = lista.querySelectorAll(':scope > .com-sel').length, ate = Math.min(de + POR_VEZ, t.itens.length);
  if (de >= ate) return;
  lista.insertAdjacentHTML('beforeend', t.itens.slice(de, ate).map(x => linhaComCaixa(chave, x)).join(''));
  pag.n = ate;
  const mais = document.querySelector(`[data-sel-mais="${chave}"]`);
  if (mais) { if (ate >= t.itens.length) mais.remove(); else mais.outerHTML = maisHtml(chave, ate, t.itens.length); }
  const vendo = document.querySelector(`[data-sel="${chave}"] .sel-vendo`); if (vendo) vendo.textContent = ate < t.itens.length ? `mostrando ${ate} de ${t.itens.length}` : '';
  setTimeout(observarMais, 0);
}
/* Chegando perto do fim da lista, carrega sozinho */
function observarMais() {
  if (!('IntersectionObserver' in window)) return;
  if (!Sel.io) Sel.io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) carregarMais(e.target.dataset.selMais); }), { rootMargin: '0px 0px 300px 0px' });
  Sel.io.disconnect();
  document.querySelectorAll('.view.active [data-sel-mais]').forEach(el => Sel.io.observe(el));
}

function selMarcar(chave, id, on) {
  const s = selConjunto(chave); if (on) s.add(id); else s.delete(id);
  atualizarSelecao(chave);
}
function selTodas(chave, on) {
  const t = Sel.telas[chave]; if (!t) return;
  const s = selConjunto(chave); if (on) t.ids.forEach(id => s.add(id)); else s.clear();
  atualizarSelecao(chave);
}
/* Caixinhas, "Selecionar todas" (marcada, vazia ou pela metade) e a barra embaixo */
function atualizarSelecao(chave) {
  const t = Sel.telas[chave], s = selConjunto(chave);
  document.querySelectorAll(`[data-sel-lista="${chave}"] .sel-chk`).forEach(c => { c.checked = s.has(c.dataset.selId); const l = c.closest('.com-sel'); if (l) l.classList.toggle('sel-on', c.checked); });
  const todas = document.querySelector(`[data-sel-todas="${chave}"]`);
  if (todas && t) { todas.checked = s.size > 0 && s.size === t.ids.length; todas.indeterminate = s.size > 0 && s.size < t.ids.length; }
  if (Sel.atual === chave) desenharBarra();
}
function desenharBarra() {
  let barra = document.getElementById('selBarra');
  const chave = Sel.atual, t = chave && Sel.telas[chave], n = chave ? selConjunto(chave).size : 0;
  const visivel = !!(t && n && document.querySelector(`.view.active [data-sel-lista="${chave}"]`));
  document.body.classList.toggle('com-selecao', visivel);
  if (!visivel) { if (barra) barra.hidden = true; return; }
  if (!barra) { barra = document.createElement('div'); barra.id = 'selBarra'; barra.className = 'sel-barra'; barra.setAttribute('role', 'region'); barra.setAttribute('aria-label', 'Ações com as selecionadas'); document.body.appendChild(barra); }
  const itens = selItens(chave), soma = t.opcoes.valor ? itens.reduce((s, x) => s + num(t.opcoes.valor(x)), 0) : null;
  const acoes = acoesDaTela(chave).filter(a => !a.pode || a.pode());
  barra.hidden = false;
  barra.innerHTML = `<div class="sel-conta"><b>${n}</b> ${n === 1 ? 'selecionada' : 'selecionadas'}${soma != null ? ` <span class="muted">· ${fmtMoney(soma)}</span>` : ''}</div>
    <div class="sel-acoes">${acoes.map((a, i) => `<button type="button" class="btn btn-sm ${a.perigo ? 'btn-outline-danger' : i === 0 && a.principal ? 'btn-primary' : 'btn-secondary'}" onclick="executarAcaoSel('${esc(chave)}', ${i})">${a.icone ? `<i class=ico data-i=${a.icone}></i>` : ''}${esc(a.rotulo)}</button>`).join('')}
      <button type="button" class="btn btn-sm btn-secondary sel-limpar" onclick="selLimpar('${esc(chave)}')" aria-label="Limpar a seleção">Limpar</button></div>`;
}
function selItens(chave) { const t = Sel.telas[chave], s = selConjunto(chave); return t ? t.itens.filter(x => s.has(t.idDe(x))) : []; }
/* As ações da tela e, sempre, imprimir e exportar a planilha */
function acoesDaTela(chave) {
  const t = Sel.telas[chave]; if (!t) return [];
  const proprias = t.opcoes.acoes || [];
  const padrao = t.opcoes.colunas ? [
    { rotulo: 'Imprimir', icone: 'printer', fn: itens => imprimirSelecao(chave, itens) },
    { rotulo: 'Planilha (CSV)', icone: 'file-text', fn: itens => exportarSelecao(chave, itens) }
  ] : [];
  return proprias.filter(a => !a.perigo).concat(padrao, proprias.filter(a => a.perigo));
}
function executarAcaoSel(chave, i) {
  const a = acoesDaTela(chave).filter(a => !a.pode || a.pode())[i]; if (!a) return;
  const itens = selItens(chave); if (!itens.length) return;
  a.fn(itens, chave);
}

// ---------------------------------------------------------------- imprimir e planilha
function imprimirSelecao(chave, itens) {
  const t = Sel.telas[chave], cols = t.opcoes.colunas;
  const empresa = db.config.empresa || (Cloud.org && Cloud.org.nome) || '';
  $('#printArea').innerHTML = `${marcaTopoHtml()}<h1>${esc(empresa)}</h1><h2>${esc(t.opcoes.titulo || 'Lista')} — ${nPlural(itens.length, 'item', 'itens')}</h2>
    <table><thead><tr>${cols.map(c => `<th${c[2] ? ' class="num"' : ''}>${esc(c[0])}</th>`).join('')}</tr></thead>
    <tbody>${itens.map(x => `<tr>${cols.map(c => `<td${c[2] ? ' class="num"' : ''}>${esc(c[1](x) ?? '')}</td>`).join('')}</tr>`).join('')}</tbody></table>
    <p style="margin-top:10px">Emitido em ${fmtDate(todayStr())}${Cloud.active && Cloud.membro ? ' por ' + esc(Cloud.membro.nome || '') : ''}.</p>${marcaRodapeHtml()}`;
  window.print();
}
function exportarSelecao(chave, itens) {
  const t = Sel.telas[chave], cols = t.opcoes.colunas;
  const nome = (t.opcoes.titulo || 'lista').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-');
  download(`${nome}-${todayStr()}.csv`, toCSV([cols.map(c => c[0])].concat(itens.map(x => cols.map(c => c[1](x) ?? '')))), 'text/csv');
  toast('✅', 'Planilha gerada', `${nPlural(itens.length, 'linha')} em ${nome}-${todayStr()}.csv`);
}
