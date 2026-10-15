/* ===== Gestos no celular =====
   A janela (que no celular vira uma gaveta que sobe de baixo) e o menu lateral se movem com
   mola, acompanham o dedo 1:1 e podem ser agarrados no meio do caminho: quem puxa de volta uma
   gaveta que está fechando faz ela voltar, sem esperar terminar.

   A mola segue os dois parâmetros que a Apple usa no lugar de massa/rigidez/atrito:
   - resposta: em segundos, quão rápido chega ao destino (menor = mais ágil);
   - amortecimento: 1 = para sem passar do ponto; menor que 1 = passa um pouco e volta.
   Amortecimento 1 por padrão; um pouco de "quique" (0,8) só quando o gesto teve impulso.

   O teclado do celular também é tratado aqui: com ele aberto, a janela passa a ocupar só a área
   visível e o campo focado rola para ficar à vista. */
(function () {
  const reduzir = matchMedia('(prefers-reduced-motion: reduce)');
  const celular = matchMedia('(max-width: 639px)');      // a janela vira gaveta
  const menuMovel = matchMedia('(max-width: 900px)');    // o menu lateral vira gaveta

  // ---------------------------------------------------------------- física
  function Mola(aoMudar) {
    const m = {
      x: 0, v: 0, alvo: 0, k: 0, c: 0, raf: 0, ultimo: 0, aoParar: null,
      /* Vai até o alvo a partir de onde está agora (o valor que está na tela), levando a
         velocidade atual ou a do dedo. Chamar de novo no meio do caminho só troca o alvo. */
      ir(alvo, { velocidade, resposta = 0.35, amortecimento = 1, aoParar = null } = {}) {
        m.alvo = alvo; m.aoParar = aoParar;
        if (velocidade !== undefined) m.v = velocidade;
        const w = 2 * Math.PI / resposta;
        m.k = w * w; m.c = 2 * amortecimento * w;
        if (!m.raf) { m.ultimo = performance.now(); m.raf = requestAnimationFrame(m.passo); }
      },
      passo(agora) {
        let dt = Math.min(0.064, (agora - m.ultimo) / 1000); m.ultimo = agora;
        while (dt > 0) {   // passos curtos: a mola fica estável mesmo se um quadro atrasar
          const h = Math.min(dt, 1 / 240);
          m.v += (-m.k * (m.x - m.alvo) - m.c * m.v) * h;
          m.x += m.v * h; dt -= h;
        }
        if (Math.abs(m.x - m.alvo) < 0.5 && Math.abs(m.v) < 8) {
          m.x = m.alvo; m.v = 0; m.raf = 0; aoMudar(m.x);
          const f = m.aoParar; m.aoParar = null; if (f) f();
          return;
        }
        aoMudar(m.x); m.raf = requestAnimationFrame(m.passo);
      },
      parar() { if (m.raf) cancelAnimationFrame(m.raf); m.raf = 0; m.aoParar = null; },
      /* Posição definida pelo dedo: sem animação, sem velocidade guardada */
      pular(x) { m.parar(); m.x = x; m.v = 0; aoMudar(x); },
      get andando() { return !!m.raf; }
    };
    return m;
  }
  /* Onde o gesto vai parar se ninguém segurar: a mesma conta da rolagem do iPhone */
  function projetar(v, desaceleracao = 0.998) { return (v / 1000) * desaceleracao / (1 - desaceleracao); }
  /* Além do limite, o elemento resiste cada vez mais, em vez de bater numa parede */
  function elastico(passou, tamanho, c = 0.55) { return (passou * tamanho * c) / (tamanho + c * Math.abs(passou)); }
  /* Velocidade do dedo nos últimos 100 ms, em px/s */
  function Rastro() {
    const pts = [];
    return {
      add(x) { const t = performance.now(); pts.push([x, t]); while (pts.length > 2 && t - pts[0][1] > 100) pts.shift(); },
      vel() { if (pts.length < 2) return 0; const a = pts[0], b = pts[pts.length - 1]; return b[1] > a[1] ? (b[0] - a[0]) / (b[1] - a[1]) * 1000 : 0; },
      limpar() { pts.length = 0; }
    };
  }
  /* Um clique logo depois de um arrasto é do arrasto, não de um botão */
  let engolirCliqueAte = 0;
  document.addEventListener('click', e => { if (performance.now() < engolirCliqueAte) { e.stopPropagation(); e.preventDefault(); } }, true);
  /* Sem um ouvinte de toque, o Safari do iPhone não aplica o :active dos botões */
  document.addEventListener('touchstart', () => {}, { passive: true });

  // ---------------------------------------------------------------- gaveta (janela no celular)
  const overlay = () => document.getElementById('modalOverlay');
  const caixa = () => document.getElementById('modalBox');
  let altura = 0;
  const gaveta = Mola(y => {
    caixa().style.transform = y ? `translate3d(0, ${y}px, 0)` : '';
    overlay().style.setProperty('--scrim', altura ? Math.max(0, Math.min(1, 1 - y / altura)).toFixed(3) : 1);
  });
  const usaGaveta = () => celular.matches && !reduzir.matches;

  /* Chamado por openModal. Só anima quando a janela estava fechada; trocar o conteúdo de uma
     janela aberta não sacode a tela. Se ela estava saindo, volta de onde está. */
  function aoAbrirJanela(jaAberta) {
    /* Abriu outra janela enquanto esta saía: cancela a saída e ela fica, só troca o conteúdo */
    clearTimeout(saida); overlay().classList.remove('saindo');
    if (!usaGaveta()) return;
    if (jaAberta) { if (gaveta.andando && gaveta.alvo > 0) gaveta.ir(0, { resposta: 0.3, amortecimento: 1 }); return; }
    altura = caixa().offsetHeight || innerHeight;
    gaveta.pular(altura);
    gaveta.ir(0, { resposta: 0.35, amortecimento: 1 });
  }
  /* Chamado por closeModal, que continua imediato: o resto do sistema conta com isso */
  function aoFecharJanela() {
    gaveta.parar(); gaveta.x = 0; gaveta.v = 0;
    const c = caixa(); if (c) c.style.transform = '';
    const o = overlay(); if (o) o.style.removeProperty('--scrim');
  }
  /* Fechar pelo ✕, pelo fundo ou pelo Esc: no celular a gaveta desce e só então fecha */
  function fecharJanela(velocidade) {
    if (!overlay().classList.contains('open')) return;
    if (!usaGaveta()) { sairNoComputador(); return; }
    if (document.activeElement && caixa().contains(document.activeElement)) document.activeElement.blur();
    altura = caixa().offsetHeight || innerHeight;
    gaveta.ir(altura, { velocidade, resposta: 0.3, amortecimento: 1, aoParar: () => closeModal() });
  }

  /* No computador a janela some em 140 ms (o fundo clareia e ela encolhe um pouco) e só então
     fecha: sai pelo mesmo caminho por onde entrou, mais rápido que a entrada. */
  let saida = 0;
  function sairNoComputador() {
    const o = overlay(); if (o.classList.contains('saindo')) return;
    o.classList.add('saindo');
    clearTimeout(saida);
    saida = setTimeout(() => { o.classList.remove('saindo'); if (o.classList.contains('open')) closeModal(); }, 140);
  }

  // arrastar a gaveta pela alça / cabeçalho
  let arrasto = null; const rastroG = Rastro();
  function podePegarGaveta(e) {
    if (!usaGaveta() || !overlay().classList.contains('open')) return false;
    if (gaveta.andando) return true;                   // em movimento: segurar em qualquer parte agarra a gaveta
    if (e.target.closest('button, a, input, select, textarea, label')) return false;
    if (e.target.closest('.modal-head')) return true;
    const r = caixa().getBoundingClientRect();
    return e.clientY - r.top < 28;                     // a faixa da alça, acima do título
  }
  document.addEventListener('pointerdown', e => {
    if (!caixa() || !caixa().contains(e.target) || !podePegarGaveta(e)) return;
    altura = caixa().offsetHeight || innerHeight;
    gaveta.parar();                                     // agarrou no meio: começa de onde está
    arrasto = { id: e.pointerId, y0: e.clientY, base: gaveta.x, mexeu: false };
    rastroG.limpar(); rastroG.add(gaveta.x);
    try { caixa().setPointerCapture(e.pointerId); } catch (x) {}
  });
  document.addEventListener('pointermove', e => {
    if (!arrasto || e.pointerId !== arrasto.id) return;
    const dy = e.clientY - arrasto.y0;
    if (!arrasto.mexeu && Math.abs(dy) < 4) return;
    arrasto.mexeu = true;
    let y = arrasto.base + dy;
    if (y < 0) y = elastico(y, altura);                 // para cima: resiste
    gaveta.pular(y); rastroG.add(y);
  });
  function soltarGaveta(e) {
    if (!arrasto || e.pointerId !== arrasto.id) return;
    const mexeu = arrasto.mexeu; arrasto = null;
    if (!mexeu) { if (gaveta.x !== 0) gaveta.ir(0, { resposta: 0.3, amortecimento: 1 }); return; }
    engolirCliqueAte = performance.now() + 80;
    const v = rastroG.vel();
    const destino = gaveta.x + projetar(v);
    /* Decide pelo lugar para onde o dedo jogou, não por onde soltou */
    if (destino > altura * 0.5 || v > 1000) fecharJanela(v);
    else gaveta.ir(0, { velocidade: v, resposta: 0.3, amortecimento: Math.abs(v) > 300 ? 0.8 : 1 });
  }
  document.addEventListener('pointerup', soltarGaveta);
  document.addEventListener('pointercancel', soltarGaveta);

  // ---------------------------------------------------------------- menu lateral (celular)
  const aside = () => document.getElementById('aAside');
  const scrim = () => document.querySelector('.aside-scrim');
  const larguraMenu = () => (aside() && aside().offsetWidth) || 272;
  const menu = Mola(x => {
    const a = aside(); if (!a) return;
    a.style.transition = 'none';
    a.style.transform = `translate3d(${x}px, 0, 0)`;
    const s = scrim(); if (s) s.style.setProperty('--scrim', Math.max(0, Math.min(1, 1 + x / larguraMenu())).toFixed(3));
  });
  const usaMenuMovel = () => menuMovel.matches && !reduzir.matches;
  function limparMenu() {
    const a = aside(); if (a) { a.style.transform = ''; a.style.transition = ''; }
    const s = scrim(); if (s) s.style.removeProperty('--scrim');
  }
  function abrirMenu(velocidade) {
    document.body.classList.add('aside-aberto');
    if (!usaMenuMovel()) { limparMenu(); return; }
    if (!menu.andando && !arrastoMenu) menu.pular(-larguraMenu());
    menu.ir(0, { velocidade, resposta: 0.35, amortecimento: velocidade && Math.abs(velocidade) > 300 ? 0.8 : 1, aoParar: limparMenu });
  }
  function fecharMenu(velocidade) {
    if (!document.body.classList.contains('aside-aberto')) return;
    if (!usaMenuMovel()) { document.body.classList.remove('aside-aberto'); limparMenu(); return; }
    if (!menu.andando && !arrastoMenu) menu.pular(0);
    menu.ir(-larguraMenu(), { velocidade, resposta: 0.3, amortecimento: 1, aoParar: () => { document.body.classList.remove('aside-aberto'); limparMenu(); } });
  }
  // arrastar o menu para a esquerda fecha; a rolagem vertical do menu continua livre
  let arrastoMenu = null; const rastroM = Rastro();
  document.addEventListener('pointerdown', e => {
    const a = aside();
    if (!a || !usaMenuMovel() || !document.body.classList.contains('aside-aberto')) return;
    const noScrim = e.target.closest('.aside-scrim');
    if (!a.contains(e.target) && !noScrim) return;
    arrastoMenu = { id: e.pointerId, x0: e.clientX, y0: e.clientY, base: menu.andando ? menu.x : 0, decidido: false, noScrim: !!noScrim };
    if (menu.andando) { menu.parar(); arrastoMenu.base = menu.x; }
    rastroM.limpar();
  });
  document.addEventListener('pointermove', e => {
    const d = arrastoMenu; if (!d || e.pointerId !== d.id) return;
    const dx = e.clientX - d.x0, dy = e.clientY - d.y0;
    if (!d.decidido) {
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { arrastoMenu = null; return; }   // é rolagem
      if (Math.abs(dx) < 10) return;
      d.decidido = true; d.x0 = e.clientX;              // passou da folga: daqui em diante é 1:1
      try { aside().setPointerCapture(e.pointerId); } catch (x) {}
      return;
    }
    let x = d.base + (e.clientX - d.x0);
    if (x > 0) x = elastico(x, larguraMenu());
    x = Math.max(-larguraMenu(), x);
    menu.pular(x); rastroM.add(x);
  });
  function soltarMenu(e) {
    const d = arrastoMenu; if (!d || e.pointerId !== d.id) return;
    arrastoMenu = null;
    if (!d.decidido) { if (d.base !== 0) abrirMenu(); return; }
    engolirCliqueAte = performance.now() + 80;
    const v = rastroM.vel();
    if (menu.x + projetar(v) < -larguraMenu() / 2) fecharMenu(v); else abrirMenu(v);
  }
  document.addEventListener('pointerup', soltarMenu);
  document.addEventListener('pointercancel', soltarMenu);

  // ---------------------------------------------------------------- teclado
  /* No iPhone o teclado cobre a página sem encolher a tela; só o visualViewport encolhe.
     Guardamos a área visível em variáveis CSS e marcamos o body enquanto o teclado está aberto. */
  const vv = window.visualViewport;
  function medirTeclado() {
    if (!vv) return;
    const raiz = document.documentElement.style;
    raiz.setProperty('--vv-h', vv.height + 'px');
    raiz.setProperty('--vv-top', vv.offsetTop + 'px');
    const coberto = Math.max(0, innerHeight - vv.height - vv.offsetTop);
    raiz.setProperty('--teclado', coberto + 'px');
    document.body.classList.toggle('teclado-aberto', coberto > 120);
  }
  if (vv) { vv.addEventListener('resize', medirTeclado); vv.addEventListener('scroll', medirTeclado); }
  const ehCampo = el => el && el.matches && el.matches('input:not([type=checkbox]):not([type=radio]):not([type=file]), textarea, select, [contenteditable="true"]');
  /* Depois que o teclado sobe, o campo focado precisa estar na parte visível */
  function mostrarCampo(el) {
    if (!el || document.activeElement !== el) return;
    medirTeclado();
    const r = el.getBoundingClientRect();
    const topo = vv ? vv.offsetTop : 0, fundo = vv ? vv.offsetTop + vv.height : innerHeight;
    const rodape = el.closest('.modal') ? (document.getElementById('modalFoot') || {}).offsetHeight || 0 : 0;
    if (r.top < topo + 8 || r.bottom > fundo - rodape - 8) el.scrollIntoView({ block: 'center', behavior: reduzir.matches ? 'auto' : 'smooth' });
  }
  document.addEventListener('focusin', e => { if (ehCampo(e.target)) { setTimeout(() => mostrarCampo(e.target), 320); } });

  window.Gestos = { Mola, projetar, elastico, aoAbrirJanela, aoFecharJanela, medirTeclado, gaveta, menu };
  window.fecharJanela = fecharJanela;
  window.abrirMenu = abrirMenu;
  window.fecharMenu = fecharMenu;
})();
