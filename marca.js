/* ===== A cara do cliente: logo da empresa e logo de cada empreendimento =====
   A logo da empresa fica em config.logoEmpresa; a de cada empreendimento ou imóvel, no próprio
   cadastro (loteamento.logo). As duas são guardadas como imagem embutida (data URL), reduzidas
   para no máximo 480 px no lado maior: sai igual na tela, na impressão e no PDF da tabela, sem
   depender de internet nem de link assinado.

   Onde aparecem:
   - topo do app: a logo da empresa ao lado do nome (o corretor vê a do empreendimento);
   - tela do empreendimento: a logo dele ao lado do nome;
   - tabela de preços: a do empreendimento no canto superior esquerdo, a da empresa no fim;
   - relatórios e listas impressas: a do empreendimento quando o relatório é dele, senão a da
     empresa, no alto; a da empresa centralizada no fim;
   - recibo, proposta, extrato e demais documentos: a logo da empresa no alto;
   - contrato, distrato e cessão: a logo da empresa como marca d'água em todas as páginas. */
'use strict';

const LOGO_MAX_PX = 480;
function logoEmpresa() { return db.config.logoEmpresa || ''; }
function logoDoImovel(l) { return (l && l.logo) || ''; }
/* A logo que representa um escopo: a do empreendimento, se tiver; senão a da empresa */
function logoDoEscopo(l) { return logoDoImovel(l) || logoEmpresa(); }

/* Lê o arquivo escolhido e devolve a imagem reduzida (PNG; se ficar grande, JPEG em fundo branco) */
function lerLogo(arquivo) {
  return new Promise((ok, falha) => {
    if (!arquivo) return falha(new Error('Nenhum arquivo'));
    if (!/^image\/(png|jpe?g|webp|gif|svg\+xml)$/.test(arquivo.type)) return falha(new Error('Use uma imagem PNG, JPG, WEBP ou SVG.'));
    if (arquivo.size > 8 * 1024 * 1024) return falha(new Error('Imagem maior que 8 MB. Use uma versão menor da logo.'));
    const fr = new FileReader();
    fr.onerror = () => falha(new Error('Não deu para ler o arquivo.'));
    fr.onload = () => {
      const img = new Image();
      img.onerror = () => falha(new Error('Este arquivo não abriu como imagem.'));
      img.onload = () => {
        const w0 = img.naturalWidth || 400, h0 = img.naturalHeight || 400, k = Math.min(1, LOGO_MAX_PX / Math.max(w0, h0));
        const w = Math.max(1, Math.round(w0 * k)), h = Math.max(1, Math.round(h0 * k));
        const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
        const ctx = cv.getContext('2d'); ctx.drawImage(img, 0, 0, w, h);
        let url = cv.toDataURL('image/png');
        if (url.length > 160000) {   // foto ou logo muito detalhada: JPEG, que é bem menor
          const cv2 = document.createElement('canvas'); cv2.width = w; cv2.height = h;
          const c2 = cv2.getContext('2d'); c2.fillStyle = '#fff'; c2.fillRect(0, 0, w, h); c2.drawImage(img, 0, 0, w, h);
          url = cv2.toDataURL('image/jpeg', 0.86);
        }
        ok(url);
      };
      img.src = fr.result;
    };
    fr.readAsDataURL(arquivo);
  });
}
/* Largura e altura de uma logo (para o PDF manter a proporção) */
function medidasDaLogo(url) {
  return new Promise(ok => { if (!url) return ok(null); const i = new Image(); i.onload = () => ok({ w: i.naturalWidth, h: i.naturalHeight }); i.onerror = () => ok(null); i.src = url; });
}

// ---------------------------------------------------------------- campo de envio (formulários)
/* id: prefixo do campo; atual: a logo que já existe. O valor escolhido fica em
   window.__logos[id] ('' = remover; undefined = não mexeu). */
function campoLogoHtml(id, rotulo, atual, dica) {
  window.__logos = window.__logos || {}; delete window.__logos[id];
  return `<div class="fg campo-logo" id="${id}Box"><label for="${id}Arq">${rotulo}</label>
    <div class="logo-linha"><div class="logo-prev ${atual ? '' : 'vazia'}" id="${id}Prev">${atual ? `<img src="${atual}" alt="Logo atual">` : '<i class=ico data-i=plus></i>'}</div>
      <div class="logo-acoes"><label class="btn btn-secondary btn-sm logo-escolher"><input type="file" id="${id}Arq" accept="image/png,image/jpeg,image/webp,image/svg+xml" onchange="escolherLogo('${id}', this)" hidden>${atual ? 'Trocar' : 'Enviar logo'}</label>
        <button type="button" class="btn btn-secondary btn-sm" id="${id}Rem" onclick="removerLogoCampo('${id}')" ${atual ? '' : 'hidden'}>Remover</button></div></div>
    ${dica ? `<div class="hint">${dica}</div>` : ''}</div>`;
}
async function escolherLogo(id, input) {
  try {
    const url = await lerLogo(input.files && input.files[0]);
    window.__logos[id] = url;
    const p = document.getElementById(id + 'Prev'); p.classList.remove('vazia'); p.innerHTML = `<img src="${url}" alt="Logo escolhida">`;
    document.getElementById(id + 'Rem').hidden = false;
    if (window.__logoAoEscolher && window.__logoAoEscolher[id]) window.__logoAoEscolher[id](url);
  } catch (e) { toast('⚠️', 'Logo não carregada', e.message, true); }
  input.value = '';
}
function removerLogoCampo(id) {
  window.__logos[id] = '';
  const p = document.getElementById(id + 'Prev'); p.classList.add('vazia'); p.innerHTML = '<i class=ico data-i=plus></i>';
  document.getElementById(id + 'Rem').hidden = true;
  if (window.__logoAoEscolher && window.__logoAoEscolher[id]) window.__logoAoEscolher[id]('');
}
function logoDoCampo(id) { return (window.__logos || {})[id]; }

/* Logo da empresa: salva na hora, sem depender do botão dos dados da empresa */
function logoEmpresaCardHtml() {
  window.__logoAoEscolher = Object.assign({}, window.__logoAoEscolher, { cfgLogo: url => {
    if (!pode('config.editar')) { toast('🔒', 'Sem permissão', 'Mudar a logo pede "alterar configurações".', true); return; }
    setConfig({ logoEmpresa: url }); logAct(url ? 'Logo da empresa atualizada' : 'Logo da empresa removida');
    updateTopbars(); toast('✅', url ? 'Logo da empresa salva' : 'Logo da empresa removida', url ? 'Já aparece no topo, nos relatórios, recibos e contratos.' : '');
  } });
  return `<div class="card"><h2>Logo da empresa</h2>
    <p class="help mb">Aparece no topo do sistema, no fim das tabelas impressas, nos relatórios, recibos e documentos, e como marca d'água nos contratos.</p>
    ${campoLogoHtml('cfgLogo', 'Imagem da logo', logoEmpresa(), 'PNG com fundo transparente fica melhor. O sistema reduz a imagem sozinho.')}</div>`;
}

// ---------------------------------------------------------------- impressão (#printArea)
function marcaTopoHtml(l) {
  const src = l === undefined ? logoEmpresa() : logoDoEscopo(l);
  return src ? `<div class="print-logo-topo"><img src="${src}" alt=""></div>` : '';
}
function marcaRodapeHtml() { return logoEmpresa() ? `<div class="print-logo-rodape"><img src="${logoEmpresa()}" alt=""></div>` : ''; }
function marcaDaguaHtml() { return logoEmpresa() ? `<img class="print-marca-dagua" src="${logoEmpresa()}" alt="">` : ''; }
/* Logo da empresa no alto de um documento (recibo, proposta): vai dentro do texto, então dá para
   ver na prévia e tirar se quiser */
function docLogoTopoHtml() { return logoEmpresa() ? `<div class="doc-logo" contenteditable="false"><img src="${logoEmpresa()}" alt=""></div>` : ''; }
