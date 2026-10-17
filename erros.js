/* Registro de erros do app. Quando algo quebra no aparelho de alguém, a pessoa vê só um defeito
   e ninguém mais fica sabendo. Aqui o erro é guardado (mensagem, tela, quem, versão do app,
   navegador) e, na nuvem, enviado para a tabela erros, que dono e administrador leem em
   Configurações › Erros do app. Carrega antes de tudo, para pegar também erro de carregamento. */
const Erros = {
  CHAVE: 'gl_erros',
  MAX_GUARDADOS: 50,
  MAX_POR_SESSAO: 30,
  versao: '',
  vistos: new Set(),
  nSessao: 0,
  semTabela: false,
  _timer: null,

  /* Barulho que não é defeito do app: extensão do navegador, aviso de layout do Chrome,
     erro de outro site sem detalhe nenhum, e falta de internet (o app já trata). */
  ignorar(msg, arquivo) {
    if (!msg) return true;
    if (/ResizeObserver loop/i.test(msg)) return true;
    if (/^Script error\.?$/i.test(msg)) return true;
    if (/AbortError|The user aborted/i.test(msg)) return true;
    if (arquivo && !String(arquivo).startsWith(location.origin)) return true;
    if (!navigator.onLine && /Failed to fetch|NetworkError|Load failed|network/i.test(msg)) return true;
    return false;
  },
  tela() {
    try {
      if (typeof state === 'undefined') return 'carregando';
      return [state.role, state.tab, state.tab === 'cadastros' && state.sub ? state.sub.cad : '', state.contratoId ? 'contrato' : ''].filter(Boolean).join(' › ').slice(0, 120);
    } catch (e) { return ''; }
  },
  registrar(info) {
    const mensagem = String(info.mensagem || '').trim().slice(0, 1000);
    if (this.ignorar(mensagem, info.arquivo)) return;
    const pilha = String(info.pilha || '').slice(0, 4000);
    const chave = mensagem + '|' + pilha.split('\n').slice(0, 2).join('|');
    const lista = this.guardados();
    /* O mesmo erro repetido vira um registro só, com a conta de quantas vezes; e cada erro
       vai uma vez por sessão, para um defeito em laço não encher o banco. */
    const igual = lista.find(e => !e.enviado && e.chave === chave);
    if (igual) { igual.vezes = (igual.vezes || 1) + 1; this.salvar(lista); return; }
    if (this.vistos.has(chave) || this.nSessao >= this.MAX_POR_SESSAO) return;
    this.vistos.add(chave); this.nSessao++;
    const nuvem = typeof Cloud !== 'undefined' && Cloud.active;
    lista.push({
      id: 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7), chave,
      ts: new Date().toISOString(), mensagem, pilha, tela: this.tela(), versao: this.versao,
      navegador: String(navigator.userAgent || '').slice(0, 300), vezes: 1,
      orgId: nuvem && Cloud.org ? Cloud.org.id : null,
      quem: (nuvem && Cloud.membro && Cloud.membro.nome) || (typeof state !== 'undefined' && state.role === 'admin' ? 'Admin' : ''),
      enviado: false
    });
    this.salvar(lista);
    this.agendarEnvio();
  },
  guardados() { try { return JSON.parse(localStorage.getItem(this.CHAVE) || '[]'); } catch (e) { return []; } },
  salvar(lista) { try { localStorage.setItem(this.CHAVE, JSON.stringify(lista.slice(-this.MAX_GUARDADOS))); } catch (e) { /* aparelho sem espaço: segue sem guardar */ } },
  limparLocais() { this.salvar([]); },
  agendarEnvio() { clearTimeout(this._timer); this._timer = setTimeout(() => this.enviar(), 1500); },
  /* Manda para a nuvem o que ainda não foi. Sem internet, sem login ou com o banco ainda sem a
     tabela (schema.sql não rodado de novo), fica guardado no aparelho para a próxima vez. */
  async enviar() {
    if (typeof Cloud === 'undefined' || !Cloud.active || !Cloud.client || !Cloud.user || Cloud.semInternet || !navigator.onLine) return;
    const lista = this.guardados(), pend = lista.filter(e => !e.enviado);
    if (!pend.length) return;
    try {
      const { error } = await Cloud.client.from('erros').insert(pend.map(e => ({
        org_id: e.orgId || null, quem: (e.quem || '').slice(0, 120), ts: e.ts, versao: e.versao || '', tela: e.tela || '',
        mensagem: e.mensagem, pilha: e.pilha || '', navegador: e.navegador || '', vezes: e.vezes || 1
      })));
      if (error) { this.semTabela = /does not exist|schema cache|not find the table/i.test(error.message || ''); return; }
      this.semTabela = false;
      const ids = new Set(pend.map(e => e.id));
      this.salvar(this.guardados().map(e => ids.has(e.id) ? Object.assign(e, { enviado: true }) : e));
    } catch (e) { /* sem rede no meio do envio: tenta de novo depois */ }
  }
};

window.addEventListener('error', ev => {
  const e = ev.error;
  Erros.registrar({ mensagem: (e && e.message) || ev.message, pilha: (e && e.stack) || (ev.filename ? `${ev.filename}:${ev.lineno}:${ev.colno}` : ''), arquivo: ev.filename });
});
window.addEventListener('unhandledrejection', ev => {
  const r = ev.reason;
  Erros.registrar({ mensagem: r && r.message ? r.message : String(r), pilha: (r && r.stack) || '' });
});
window.addEventListener('online', () => Erros.agendarEnvio());
/* A versão do app é a do service worker em uso (lotifly-vNN), para saber se o erro é de uma
   versão velha que ainda estava no aparelho. */
if (typeof caches !== 'undefined') {
  caches.keys().then(ks => {
    const v = ks.map(k => (k.match(/^lotifly-v(\d+)$/) || [])[1]).filter(Boolean).map(Number).sort((a, b) => b - a)[0];
    if (v) Erros.versao = 'v' + v;
  }).catch(() => {});
}
