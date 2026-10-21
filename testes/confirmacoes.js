// Ajudante dos testes: responde a confirmação do app (a janela que substituiu a caixinha do
// navegador), como o antigo page.on('dialog', d => d.accept()). Precisa ser chamado antes do
// page.goto. Cada confirmação vista fica em window.__confirmacoes (o texto dela).
// resposta: 'aceitar' (padrão), 'recusar', 'manual' (o teste clica) ou uma função (texto) => resposta;
// dá para trocar depois com page.evaluate(() => { window.__respConfirmar = 'recusar'; }).
function responderConfirmacoes(page, resposta = 'aceitar') {
  return page.addInitScript(r => {
    window.__respConfirmar = r; window.__confirmacoes = [];
    new MutationObserver(() => {
      const box = document.getElementById('confirmaBox'); if (!box || box.dataset.visto) return;
      box.dataset.visto = '1';
      const texto = box.innerText;
      window.__confirmacoes.push(texto);
      const resp = typeof window.__respConfirmar === 'function' ? window.__respConfirmar(texto) : window.__respConfirmar;
      if (resp === 'manual') return;
      if (resp === 'aceitar') {
        const dig = box.querySelector('#confDigitar');
        if (dig) { dig.value = box.querySelector('.conf-digitar label b').textContent; dig.dispatchEvent(new Event('input')); }
        box.querySelector('.conf-sim').click();
      } else (box.querySelector('.conf-nao') || box.querySelector('.conf-sim')).click();
    }).observe(document, { childList: true, subtree: true });
  }, resposta);
}
module.exports = { responderConfirmacoes };
