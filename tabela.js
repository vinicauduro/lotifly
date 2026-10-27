/* ===== Gestão de Loteamento — tabela de preços em PDF =====
   A tabela que vai para os corretores todo mês: os lotes disponíveis de cada empreendimento
   (e os reservados, marcados), com área, medidas, valor, entrada, parcela e à vista pelas
   condições do empreendimento, mais os imóveis de terceiros. É de uso interno das vendas: o
   contato no rodapé é sempre o da empresa, mesmo quando quem gera é um corretor.
   O PDF é montado no próprio aparelho (vendor/jspdf), então funciona sem internet, e no
   celular vai direto para o WhatsApp com o arquivo anexado. */
'use strict';

const TABELA_COR = [14, 76, 115];   // a cor da marca (#0e4c73)
const MESES_EXTENSO = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
function mesExtenso(key) { const [y, m] = key.split('-'); return MESES_EXTENSO[Number(m) - 1] + '/' + y; }

/* O CUB do mês mais recente cadastrado em Índices (até o mês atual), para a coluna "em CUB"
   que as construtoras usam. Sem CUB cadastrado, a coluna não aparece. */
function cubDaTabela() {
  const ind = db.indices.find(i => String(i.codigo || '').toUpperCase() === 'CUB' && i.tipo === 'pontos');
  if (!ind) return null;
  const m = Object.keys(ind.valores || {}).filter(k => k <= mesAtual() && num(ind.valores[k]) > 0).sort().pop();
  return m ? { mes: m, valor: num(ind.valores[m]), nome: ind.nome || 'CUB' } : null;
}

/* As condições do empreendimento aplicadas a um preço: entrada mínima, o saldo no maior
   número de parcelas (tabela Price com os juros do empreendimento, ou linear sem juros) e o
   valor à vista com o desconto. */
function condicaoDoPreco(preco, cond) {
  cond = cond || {};
  const n = Math.round(num(cond.maxParcelas));
  const entrada = Math.round(preco * num(cond.entradaMinPct)) / 100;
  const parcela = n > 0 ? Math.round(pmt(num(cond.jurosMes) / 100, n, Math.max(0, preco - entrada)) * 100) / 100 : 0;
  const vista = num(cond.descontoVistaPct) > 0 ? Math.round(preco * (100 - num(cond.descontoVistaPct))) / 100 : 0;
  return { entrada, n, parcela, vista };
}
/* O texto das condições embaixo da tabela: o que a empresa escreveu no empreendimento ou,
   sem texto, um resumo montado das condições cadastradas. */
function obsDaTabela(emp) {
  const c = emp.cond || {};
  if (String(c.obsTabela || '').trim()) return String(c.obsTabela).trim();
  const partes = [];
  if (num(c.entradaMinPct)) partes.push(`Entrada mínima de ${fmtNum(c.entradaMinPct, 0)}% do valor de tabela.`);
  if (Math.round(num(c.maxParcelas))) partes.push(`Saldo em até ${Math.round(num(c.maxParcelas))} parcelas mensais ${num(c.jurosMes) ? `com juros de ${fmtNum(c.jurosMes, 2)}% ao mês (tabela Price)` : 'sem juros'}.`);
  if (num(c.descontoVistaPct)) partes.push(`Desconto de ${fmtNum(c.descontoVistaPct, 0)}% no pagamento à vista.`);
  partes.push('Valores sujeitos a alteração sem aviso prévio. Esta tabela substitui as anteriores.');
  return partes.join(' ');
}

/* O que entra na tabela. escolha: 'todas', 'terceiros' ou o id de um empreendimento.
   Vendido e bloqueado nunca aparecem; reservado só com comReservados, marcado. */
function dadosTabela(escolha, comReservados) {
  const cub = cubDaTabela();
  const emps = db.loteamentos.filter(l => !ehCarteira(l)).sort((a, b) => naturalCmp(a.nome, b.nome));
  const secoes = [];
  const entra = l => l.status === 'disponivel' || (comReservados && l.status === 'reservado');
  (escolha === 'todas' ? emps : emps.filter(e => e.id === escolha)).forEach(emp => {
    const ls = lotesDo(emp.id).filter(l => entra(l) && num(l.preco) > 0);
    const linhas = ls.map(l => Object.assign({ quadra: l.quadra, numero: l.numero, area: num(l.area), frente: num(l.frente), fundos: num(l.fundos), preco: num(l.preco), reservado: l.status === 'reservado', cub: cub ? num(l.preco) / cub.valor : 0 }, condicaoDoPreco(num(l.preco), emp.cond)));
    secoes.push({ tipo: 'emp', emp, linhas, obs: obsDaTabela(emp), disponiveis: linhas.filter(x => !x.reservado).length });
  });
  if (escolha === 'todas' || escolha === 'terceiros') {
    const terc = db.loteamentos.filter(l => ehCarteira(l) && !vendaAtivaDoImovel(l) && num(l.preco) > 0).sort((a, b) => naturalCmp(a.nome, b.nome));
    if (terc.length || escolha === 'terceiros') secoes.push({ tipo: 'terceiros', linhas: terc.map(t => Object.assign({ nome: t.nome, categoria: empLabel(t), cidade: t.cidade || '', area: num(t.area), preco: num(t.preco), cub: cub ? num(t.preco) / cub.valor : 0, temCond: num((t.cond || {}).maxParcelas) > 0 }, condicaoDoPreco(num(t.preco), t.cond))), disponiveis: terc.length });
  }
  return { secoes, cub, mes: mesAtual(), emitida: new Date() };
}

/* O contato da empresa no rodapé: é ela quem atende o corretor, não quem gerou a tabela. */
function contatoDaEmpresa() {
  const c = db.config;
  return [c.empresa, c.telefone ? 'Tel. ' + fmtPhone(c.telefone) : '', c.adminWhatsapp ? 'WhatsApp ' + fmtPhone(c.adminWhatsapp) : '', c.email || ''].filter(Boolean).join('  ·  ');
}

// ---------------------------------------------------------------- tela
function abrirTabelaForm() {
  const emps = db.loteamentos.filter(l => !ehCarteira(l)).sort((a, b) => naturalCmp(a.nome, b.nome));
  const temTerc = db.loteamentos.some(l => ehCarteira(l));
  if (!emps.length && !temTerc) { toast('⚠️', 'Nenhum imóvel cadastrado', '', true); return; }
  const atual = state.role === 'corretor' && curLot() && !ehCarteira(curLot()) ? curLot().id : 'todas';
  const opts = [['todas', 'Todos: empreendimentos e imóveis de terceiros']].concat(emps.map(e => [e.id, e.nome]), temTerc ? [['terceiros', 'Imóveis de terceiros']] : []);
  const podeShare = !!(navigator.share && navigator.canShare);
  openModal({ title: 'Tabela de preços', body: `<div class="fg"><label for="tbEscolha">Tabela de</label><select id="tbEscolha">${opts.map(([k, l]) => `<option value="${esc(k)}" ${k === atual ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></div>
      <div class="fg"><label class="check"><input type="checkbox" id="tbReservados" checked> Incluir os lotes reservados, marcados como "Reservado"</label></div>
      <p class="help">Entram os lotes disponíveis com o valor e as condições de cada empreendimento${cubDaTabela() ? ', e o valor em CUB' : ''}. Lote vendido não aparece. O rodapé leva o contato da empresa: a tabela é para os corretores.</p>
      ${podeShare ? '' : '<p class="help">No computador, o PDF é baixado e o WhatsApp abre com a mensagem: arraste o arquivo para a conversa, o grupo ou a lista de transmissão.</p>'}`,
    footer: `<button class="btn btn-secondary" onclick="closeModal()">Cancelar</button><button class="btn btn-secondary" onclick="baixarTabela()">Baixar PDF</button><button class="btn btn-primary" onclick="enviarTabelaWhatsApp()"><i class=ico data-i=whatsapp-logo></i>Enviar pelo WhatsApp</button>` });
}
function nomeArquivoTabela(dados) {
  const s = dados.secoes;
  const alvo = s.length === 1 && s[0].tipo === 'emp' ? s[0].emp.nome : s.length === 1 ? 'imoveis-de-terceiros' : 'todos-os-imoveis';
  const slug = String(alvo).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `tabela-${slug}-${dados.mes}.pdf`;
}
async function arquivoDaTabela() {
  const dados = dadosTabela(val('tbEscolha') || 'todas', checked('tbReservados'));
  if (!dados.secoes.some(s => s.linhas.length)) { toast('⚠️', 'Nada disponível para a tabela', 'Nenhum lote disponível com valor nesta escolha.', true); return null; }
  const blob = await gerarTabelaPDF(dados);
  return { dados, blob, nome: nomeArquivoTabela(dados) };
}
function textoEnvioTabela(dados) {
  const s = dados.secoes, alvo = s.length === 1 && s[0].tipo === 'emp' ? s[0].emp.nome : s.length === 1 ? 'Imóveis de terceiros' : 'todos os imóveis';
  return `Tabela de preços de ${mesExtenso(dados.mes).toLowerCase()} — ${alvo}${db.config.empresa ? ' · ' + db.config.empresa : ''}`;
}
function salvarBlob(blob, nome) {
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = nome; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
async function baixarTabela() {
  try {
    const r = await arquivoDaTabela(); if (!r) return;
    salvarBlob(r.blob, r.nome); closeModal(); toast('✅', 'Tabela gerada', r.nome);
  } catch (e) { Erros.registrar({ mensagem: 'Tabela de preços: ' + e.message, pilha: e.stack }); toast('⚠️', 'Não deu para gerar a tabela', e.message, true); }
}
/* No celular, o arquivo vai anexado: a pessoa escolhe o WhatsApp e o grupo ou a lista de
   transmissão dos corretores. Sem esse recurso (computador), baixa e abre o WhatsApp com a
   mensagem, para arrastar o arquivo. */
async function enviarTabelaWhatsApp() {
  let r;
  try { r = await arquivoDaTabela(); if (!r) return; }
  catch (e) { Erros.registrar({ mensagem: 'Tabela de preços: ' + e.message, pilha: e.stack }); toast('⚠️', 'Não deu para gerar a tabela', e.message, true); return; }
  const texto = textoEnvioTabela(r.dados);
  const file = typeof File === 'function' ? new File([r.blob], r.nome, { type: 'application/pdf' }) : null;
  if (file && navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: texto, text: texto }); closeModal(); }
    catch (e) { if (e && e.name !== 'AbortError') toast('⚠️', 'Não deu para compartilhar', e.message, true); }
    return;
  }
  salvarBlob(r.blob, r.nome); closeModal();
  window.open('https://wa.me/?text=' + encodeURIComponent(texto), '_blank');
  toast('✅', 'PDF baixado', 'Arraste o arquivo para a conversa do WhatsApp.');
}

// ---------------------------------------------------------------- PDF
let _libTabela = null;
function carregarScriptTabela(src) {
  return new Promise((ok, erro) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => erro(new Error('Sem acesso ao gerador de PDF. Confira a internet e tente de novo.')); document.head.appendChild(s); });
}
function libTabela() {
  if (!_libTabela) _libTabela = (async () => {
    if (!(window.jspdf && window.jspdf.jsPDF)) await carregarScriptTabela('vendor/jspdf.umd.min.js');
    if (typeof window.autoTable !== 'function') await carregarScriptTabela('vendor/jspdf.plugin.autotable.min.js');
    return { jsPDF: window.jspdf.jsPDF, autoTable: window.autoTable };
  })().catch(e => { _libTabela = null; throw e; });
  return _libTabela;
}
/* O PDF usa a fonte padrão (Helvetica), que não tem os espaços especiais do formato de
   moeda nem emoji: troca pelo espaço comum e tira o que a fonte não desenha. */
function txtPdf(s) { return String(s ?? '').replace(/[   ]/g, ' ').replace(/[‐-‒]/g, '-').replace(/[^\x20-\x7e -ÿ–—‘’“”•…]/g, ''); }
function rs(v) { return txtPdf(fmtMoney(v)); }
/* Logo pronta para o PDF: formato e proporção (a imagem já vem reduzida do cadastro) */
async function logoParaPdf(url) {
  if (!url) return null;
  const m = await medidasDaLogo(url); if (!m || !m.w || !m.h) return null;
  return { url, fmt: /^data:image\/jpe?g/.test(url) ? 'JPEG' : 'PNG', w: m.w, h: m.h };
}
/* Desenha a logo dentro de uma caixa (mm), centrada e sem deformar */
function logoNoPdf(doc, lg, x, y, bw, bh) {
  const k = Math.min(bw / lg.w, bh / lg.h), w = lg.w * k, h = lg.h * k;
  try { doc.addImage(lg.url, lg.fmt, x + (bw - w) / 2, y + (bh - h) / 2, w, h); } catch (e) { /* imagem que o PDF não aceita fica de fora */ }
}
async function gerarTabelaPDF(dados) {
  const { jsPDF, autoTable } = await libTabela();
  /* Logo do empreendimento no canto superior esquerdo; a da empresa no fim de cada tabela */
  const logoEmp = await logoParaPdf(logoEmpresa()), logos = {};
  for (const sec of dados.secoes) if (sec.tipo === 'emp') logos[sec.emp.id] = await logoParaPdf(logoDoImovel(sec.emp));
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const W = doc.internal.pageSize.getWidth(), M = 12;
  const emissao = `${pad2(dados.emitida.getDate())}/${pad2(dados.emitida.getMonth() + 1)}/${dados.emitida.getFullYear()} ${pad2(dados.emitida.getHours())}:${pad2(dados.emitida.getMinutes())}`;
  const cabecalho = (titulo, sub, lg) => {
    doc.setFillColor(...TABELA_COR); doc.rect(0, 0, W, 24, 'F');
    /* A logo vai numa caixa branca à esquerda; o título anda para o lado */
    const x0 = lg ? M + 31 : M;
    if (lg) { doc.setFillColor(255, 255, 255); doc.roundedRect(M, 3, 27, 18, 1.5, 1.5, 'F'); logoNoPdf(doc, lg, M + 1.2, 4.2, 24.6, 15.6); }
    doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(15);
    doc.text(txtPdf(titulo), x0, 11, { maxWidth: W - x0 - M - 58 });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
    if (sub) doc.text(txtPdf(sub), x0, 17, { maxWidth: W - x0 - M - 58 });
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
    doc.text(txtPdf('Vigência: ' + mesExtenso(dados.mes)), W - M, 9, { align: 'right' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
    doc.text(txtPdf('Emitida em ' + emissao), W - M, 14, { align: 'right' });
    if (dados.cub) doc.text(txtPdf(`CUB ${monthLabel(dados.cub.mes)}: ${rs(dados.cub.valor)}`), W - M, 19, { align: 'right' });
    doc.setTextColor(30, 41, 59);
  };
  const empresa = db.config.empresa || '';
  dados.secoes.forEach((sec, i) => {
    if (i) doc.addPage();
    let y;
    if (sec.tipo === 'emp') {
      const e = sec.emp;
      const local = [e.logradouro ? [e.logradouro, e.numeroEnd].filter(Boolean).join(', ') : e.endereco, e.bairro, e.cidade, e.uf].filter(Boolean).join(' · ');
      const registro = [e.matriculaMae ? 'Matrícula ' + e.matriculaMae : '', e.cartorio || ''].filter(Boolean).join(' · ');
      cabecalho(e.nome, [local, registro].filter(Boolean).join('   |   '), logos[e.id]);
    } else cabecalho('Imóveis de terceiros', empresa ? 'Carteira de ' + empresa : '', logoEmp);
    const lgSec = sec.tipo === 'emp' ? logos[sec.emp.id] : logoEmp;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5);
    doc.text(txtPdf(`Tabela de preços${empresa ? ' · ' + empresa : ''}`), M, 31);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
    const nRes = sec.linhas.filter(l => l.reservado).length;
    doc.text(txtPdf(`${sec.disponiveis} ${sec.tipo === 'emp' ? 'lote(s) disponível(is)' : 'imóvel(is) à venda'}${nRes ? ` · ${nRes} reservado(s)` : ''}`), W - M, 31, { align: 'right' });
    y = 35;
    let head, body, colunas = {};
    if (sec.tipo === 'emp') {
      const c = sec.emp.cond || {}, temMedida = sec.linhas.some(l => l.frente || l.fundos), temVista = sec.linhas.some(l => l.vista), temParc = sec.linhas.some(l => l.n);
      head = [['Quadra', 'Lote', 'Área (m²)'].concat(temMedida ? ['Frente × fundos (m)'] : [], dados.cub ? ['CUB'] : [], ['Valor de tabela', `Entrada${num(c.entradaMinPct) ? ' (' + fmtNum(c.entradaMinPct, 0) + '%)' : ''}`], temParc ? [`${Math.round(num(c.maxParcelas))}× ${num(c.jurosMes) ? '(Price)' : 'sem juros'}`] : [], temVista ? [`À vista (-${fmtNum(c.descontoVistaPct, 0)}%)`] : [], nRes ? ['Situação'] : [])];
      body = sec.linhas.map(l => [l.quadra, l.numero, l.area ? fmtNum(l.area, 2) : '—'].concat(temMedida ? [`${fmtNum(l.frente, 2)} × ${fmtNum(l.fundos, 2)}`] : [], dados.cub ? [fmtNum(l.cub, 2)] : [], [rs(l.preco), l.entrada ? rs(l.entrada) : '—'], temParc ? [l.parcela ? rs(l.parcela) : '—'] : [], temVista ? [l.vista ? rs(l.vista) : '—'] : [], nRes ? [l.reservado ? 'Reservado' : ''] : []));
    } else {
      head = [['Imóvel', 'Tipo', 'Cidade', 'Área (m²)'].concat(dados.cub ? ['CUB'] : [], ['Valor de venda', 'Condição'])];
      body = sec.linhas.map(l => [l.nome, l.categoria, l.cidade || '—', l.area ? fmtNum(l.area, 2) : '—'].concat(dados.cub ? [fmtNum(l.cub, 2)] : [], [rs(l.preco), l.temCond ? `${l.entrada ? 'Entrada ' + rs(l.entrada) + ' + ' : ''}${l.n}× ${rs(l.parcela)}` : 'A combinar']));
    }
    head[0].forEach((t, k) => { if (!/^(Quadra|Lote|Imóvel|Tipo|Cidade|Situação)$/.test(t)) colunas[k] = { halign: 'right' }; });
    autoTable(doc, {
      startY: y, head: head.map(r => r.map(txtPdf)), body: body.map(r => r.map(txtPdf)), margin: { left: M, right: M, top: 30, bottom: 16 },
      theme: 'grid', styles: { font: 'helvetica', fontSize: 7.6, cellPadding: 1.4, lineColor: [226, 232, 240], lineWidth: 0.15, textColor: [30, 41, 59], overflow: 'linebreak' },
      headStyles: { fillColor: TABELA_COR, textColor: 255, fontStyle: 'bold', halign: 'center', valign: 'middle' },
      alternateRowStyles: { fillColor: [244, 247, 250] }, columnStyles: colunas,
      didParseCell: d => { if (d.section === 'body' && sec.tipo === 'emp' && sec.linhas[d.row.index] && sec.linhas[d.row.index].reservado) { d.cell.styles.textColor = [161, 98, 7]; if (d.column.index === head[0].length - 1) d.cell.styles.fontStyle = 'bold'; } },
      /* páginas seguintes da mesma seção ganham o cabeçalho */
      willDrawPage: d => { if (d.pageNumber > 1) cabecalho(sec.tipo === 'emp' ? sec.emp.nome + ' (continuação)' : 'Imóveis de terceiros (continuação)', '', lgSec); }
    });
    if (!sec.linhas.length) { doc.setFontSize(9); doc.text(txtPdf(sec.tipo === 'emp' ? 'Nenhum lote disponível neste momento.' : 'Nenhum imóvel de terceiro à venda neste momento.'), M, y + 14); }
    let fy = (doc.lastAutoTable && doc.lastAutoTable.finalY || y) + 6;
    const obs = sec.tipo === 'emp' ? sec.obs : 'Condições de cada imóvel a confirmar com a empresa. Valores sujeitos a alteração sem aviso prévio.';
    const linhasObs = doc.splitTextToSize(txtPdf(obs), W - 2 * M);
    const altObs = linhasObs.length * 3.6 + 6;
    if (fy + altObs > doc.internal.pageSize.getHeight() - 16) { doc.addPage(); cabecalho(sec.tipo === 'emp' ? sec.emp.nome + ' (continuação)' : 'Imóveis de terceiros (continuação)', '', lgSec); fy = 32; }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.text('Condições', M, fy);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.text(linhasObs, M, fy + 4.5);
    /* No fim da tabela, a logo da empresa, centralizada na folha */
    if (logoEmp) {
      let ly = fy + altObs + 4;
      if (ly + 16 > doc.internal.pageSize.getHeight() - 16) { doc.addPage(); cabecalho(sec.tipo === 'emp' ? sec.emp.nome + ' (continuação)' : 'Imóveis de terceiros (continuação)', '', lgSec); ly = 32; }
      logoNoPdf(doc, logoEmp, (W - 50) / 2, ly, 50, 14);
    }
  });
  /* Rodapé de todas as páginas: o contato da empresa e a numeração */
  const total = doc.internal.getNumberOfPages(), H = doc.internal.pageSize.getHeight(), contato = txtPdf(contatoDaEmpresa());
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setDrawColor(...TABELA_COR); doc.setLineWidth(0.4); doc.line(M, H - 12, W - M, H - 12);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...TABELA_COR);
    if (contato) doc.text(contato, M, H - 7.5, { maxWidth: W - 2 * M - 22 });
    doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 116, 139);
    doc.text(`Página ${p} de ${total}`, W - M, H - 7.5, { align: 'right' });
  }
  doc.setProperties({ title: txtPdf('Tabela de preços ' + mesExtenso(dados.mes)), subject: txtPdf(empresa), creator: 'Lotfly' });
  return doc.output('blob');
}
