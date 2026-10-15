/* ===== Pior caso: dados de teste da interface (só em desenvolvimento) =====
   Os dados de exemplo foram escolhidos, sem querer, para a tela ficar bonita: nomes curtos,
   valores de seis dígitos, todo campo preenchido. Este arquivo troca os dados pelo pior caso
   realista, pelo mesmo caminho que os dados de exemplo entram (replaceDB), para ver o que quebra.

   Só carrega em localhost e com ?dados= no endereço (veja o fim de core.js). Nunca vai para o
   app publicado: o service worker não guarda esta pasta.

   Estados (seletor fixo no rodapé, e no endereço para sobreviver ao recarregar):
   - exemplo: os dados de exemplo de sempre
   - pior:    nomes e e-mails enormes, R$ 10.000.000,00, loteamento com 500 lotes, campos em branco
   - vazio:   um loteamento sem nada: sem lotes, clientes, contratos ou parcelas
   - um:      um de cada (contagens em 1: "1 lote", "1 contrato") */
(function () {
  const clone = o => JSON.parse(JSON.stringify(o));
  const ESTADOS = [['exemplo', 'Exemplo'], ['pior', 'Pior caso'], ['vazio', 'Vazio'], ['um', 'Um de cada']];
  let base = null;

  // ---------------------------------------------------------------- pessoas
  /* Nomes e e-mails que existem de verdade no Brasil: nome completo com todos os sobrenomes,
     razão social de cooperativa, e-mail de departamento em domínio comprido. */
  const NOME_LONGO = 'Maria Aparecida dos Santos Nascimento Ferreira de Albuquerque e Silva';
  const EMAIL_LONGO = 'maria.aparecida.nascimento.albuquerque.financeiro@construtora-vale-do-itajai-empreendimentos.example.com.br';
  const PJ_LONGA = 'Cooperativa Agroindustrial dos Produtores Rurais do Alto Vale do Itajaí Ltda.';
  const EMAIL_PJ = 'departamento.juridico.contratos.imobiliarios@cooperativa-agroindustrial-altovale.example.com.br';
  const pessoa = (o) => Object.assign({ tipo: 'pf', genero: 'm', nome: '', cpf: '', rg: '', rgOrgao: '', nacionalidade: 'brasileiro', profissao: '', estadoCivil: '', telefone: '', email: '',
    cep: '', logradouro: '', numeroEnd: '', complemento: '', bairro: '', cidade: '', uf: '', endereco: '' }, o);
  const clienteLongo = pessoa({ genero: 'f', nome: NOME_LONGO, cpf: '529.982.247-25', rg: '4.123.456', rgOrgao: 'SSP/SC', profissao: 'administradora de empresas', estadoCivil: 'casado',
    telefone: '(47) 99123-4567', email: EMAIL_LONGO, cep: '89280-000', logradouro: 'Rua Coronel Francisco de Paula Ramos de Albuquerque Filho', numeroEnd: '1.284', complemento: 'Sala 1201, Bloco B, Edifício Empresarial Vale do Itajaí',
    bairro: 'Centro Histórico', cidade: 'São Bento do Sul', uf: 'SC' });
  const clientePJ = pessoa({ tipo: 'pj', nome: PJ_LONGA, cpf: '11.222.333/0001-81', telefone: '(47) 3333-4444', email: EMAIL_PJ,
    representante: { nome: 'Konstantin Oberhauser-Wettstein', cpf: '070.808.669-10' }, cidade: 'Rio do Sul', uf: 'SC' });
  const clienteCurto = pessoa({ nome: 'Jo', cpf: '111.444.777-35', telefone: '(47) 98888-0000' });
  const clienteApostrofo = pessoa({ genero: 'f', nome: "Ana D'Ávila Sant'Anna", cpf: '390.533.447-05', email: 'a@b.co', cidade: 'Ituporanga', uf: 'SC' });
  /* Comprador trazido de uma planilha antiga: só o nome, o resto em branco */
  const clienteEmBranco = pessoa({ nome: 'Roberto Costa', cpf: '', telefone: '', email: '', cidade: '' });

  // ---------------------------------------------------------------- loteamento de 500 lotes
  function loteamentoGrande(d) {
    const lot = Object.assign(clone(d.loteamentos[0]), {
      id: 'pior-lot', nome: 'Loteamento Residencial e Comercial Jardim das Palmeiras do Alto Vale — Fase II',
      cidade: 'São João Batista do Itaperiú / SC', endereco: 'Estrada Geral da Linha Tigre, km 12', planta: null
    });
    d.loteamentos.push(lot);
    const quadras = 'ABCDEFGHIJKLMNOPQRST'.split('');   // 20 quadras × 25 lotes = 500
    let i = 0;
    quadras.forEach(q => {
      for (let n = 1; n <= 25; n++) {
        i++;
        const area = i % 97 === 0 ? 12345.67 : 300 + ((i * 37) % 260);
        let preco = Math.round(area * (420 + ((i * 13) % 80)) / 100) * 100;
        if (i === 1) preco = 10000000;                     // a gleba comercial da esquina
        const l = { id: `pl-${q}${n}`, loteamentoId: lot.id, quadra: q, numero: n === 25 && q === 'T' ? '125-A' : String(n), area, frente: 12, fundos: Math.round(area / 12 * 10) / 10,
          preco, tipo: n <= 2 ? 'comercial' : 'residencial', status: i % 5 === 0 ? 'vendido' : i % 7 === 0 ? 'reservado' : i % 41 === 0 ? 'bloqueado' : 'disponivel',
          obs: '', matricula: '', descricaoMatricula: '', logradouro: '', numeroEnd: '', bairro: '', cep: '' };
        if (i === 3) { l.area = 0; l.preco = 0; l.frente = null; l.fundos = null; }   // lote cadastrado às pressas, sem medida nem preço
        d.lotes.push(l);
      }
    });
    return lot;
  }

  // ---------------------------------------------------------------- estados
  function pior(b) {
    const d = clone(b);
    const lot = loteamentoGrande(d);
    // os compradores dos contratos de exemplo viram os casos difíceis
    const casos = [clienteLongo, clientePJ, clienteCurto, clienteEmBranco, clienteApostrofo];
    d.vendas.forEach((v, i) => { if (casos[i]) v.cliente = clone(casos[i]); });
    const semCorretor = d.vendas[3]; if (semCorretor) semCorretor.corretor = { nome: '', creci: '', telefone: '', email: '', imobiliaria: '' };
    // R$ 10.000.000,00: à vista, e em 120 parcelas
    const t = todayStr();
    const gleba = d.lotes.find(l => l.id === 'pl-A1');
    const aVista = { id: 'pior-v-vista', numeroContrato: '0042/' + t.slice(0, 4), loteId: gleba.id, loteamentoId: lot.id, cliente: clone(clientePJ), corretor: { nome: 'Konstantin Oberhauser-Wettstein', creci: 'SC-012345-F', telefone: '(47) 99911-2233', email: 'konstantin.oberhauser@imobiliaria-oberhauser-wettstein.example.com', imobiliaria: 'Oberhauser-Wettstein Negócios Imobiliários' },
      dataVenda: addMonths(t, -2), valorTotal: 10000000, entrada: 10000000, dataEntrada: addMonths(t, -2), nParcelas: 0, valorParcela: 0, primeiroVencimento: null, baloes: [], comissaoPct: 6, comissaoValor: 600000, status: 'quitada' };
    gleba.status = 'vendido'; gleba.vendaId = aVista.id;
    const lote2 = d.lotes.find(l => l.id === 'pl-A2'); lote2.preco = 10000000;
    const parcelado = { id: 'pior-v-120', numeroContrato: '0043/' + t.slice(0, 4), loteId: lote2.id, loteamentoId: lot.id, cliente: clone(clienteLongo), corretor: { nome: 'Ana Paula Souza', creci: 'SC-54321', telefone: '(47) 98877-6655', email: 'ana@souzaimoveis.com', imobiliaria: 'Souza Imóveis' },
      dataVenda: addMonths(t, -14), valorTotal: 10000000, entrada: 1000000, dataEntrada: addMonths(t, -14), nParcelas: 120, valorParcela: 75000, primeiroVencimento: addMonths(t, -13), baloes: [], comissaoPct: 5, comissaoValor: 500000, status: 'ativa' };
    lote2.status = 'vendido'; lote2.vendaId = parcelado.id;
    d.vendas.push(aVista, parcelado);
    [aVista, parcelado].forEach(v => {
      const recs = gerarRecebiveis(v);
      recs.forEach(r => { if (r.vencimento < addMonths(t, -2)) { r.valorPago = r.valor; r.dataPagamento = r.vencimento; r.forma = 'Boleto'; } });
      if (v === aVista) recs.forEach(r => { r.valorPago = r.valor; r.dataPagamento = r.vencimento; r.forma = 'TED'; });
      d.recebiveis.push(...recs);
    });
    // cadastro de clientes com todos os casos
    d.clientes = casos.map((c, i) => Object.assign(clone(c), { id: 'pior-c' + i, criadoEm: new Date().toISOString() }));
    return d;
  }
  function vazio(b) {
    const d = clone(b);
    d.loteamentos = [Object.assign(clone(b.loteamentos[0]), { id: 'vazio-lot', nome: 'Loteamento Novo', planta: null })];
    ['lotes', 'reservas', 'vendas', 'recebiveis', 'clientes', 'custos', 'cobrancas', 'remessas'].forEach(k => { d[k] = []; });
    return d;
  }
  function um(b) {
    const d = clone(b);
    const lot = d.loteamentos[0];
    d.lotes = [Object.assign(clone(b.lotes[0]), { status: 'vendido' })];
    const v = Object.assign(clone(b.vendas[0]), { loteId: d.lotes[0].id, nParcelas: 1, valorParcela: num(b.vendas[0].valorTotal) - num(b.vendas[0].entrada), entrada: 0, baloes: [] });
    v.valorParcela = num(v.valorTotal); d.lotes[0].vendaId = v.id;
    d.vendas = [v]; d.reservas = []; d.custos = d.custos.slice(0, 1); d.cobrancas = [];
    d.recebiveis = gerarRecebiveis(v);
    d.clientes = [Object.assign(clone(v.cliente), { id: 'um-c', tipo: 'pf' })];
    d.loteamentos = [lot];
    return d;
  }
  const MONTA = { exemplo: b => clone(b), pior, vazio, um };

  async function aplicar(estado) {
    /* replaceDB grava na nuvem quando ela está ligada: aqui isso apagaria dados reais. */
    if (typeof Cloud !== 'undefined' && (Cloud.enabled || Cloud.active)) { console.warn('pior-caso: só funciona no modo local, sem nuvem.'); return; }
    if (!base) {
      if (!db.lotes.length || !db.vendas.length) { db.lotes = []; await carregarDemo(); }
      base = clone(db);
    }
    await replaceDB(MONTA[estado](base));
    state.lotId = (estado === 'pior') ? 'pior-lot' : db.loteamentos[0].id;
    state.empAberto = null;
    const u = new URL(location.href); u.searchParams.set('dados', estado); history.replaceState(null, '', u);
    desenharSeletor(estado);
    if (state.role && state.role !== 'landing') renderCurrent(); else renderLanding();
    if (typeof updateTopbars === 'function') updateTopbars();
  }

  // ---------------------------------------------------------------- seletor
  function desenharSeletor(atual) {
    let el = document.getElementById('devDados');
    if (!el) {
      el = document.createElement('div'); el.id = 'devDados';
      el.setAttribute('style', 'position:fixed;left:50%;bottom:calc(10px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);z-index:100000;display:flex;gap:2px;padding:3px;background:#e9e9e7;border:1px solid #cfcfcb;border-radius:8px;font:500 12px/1 system-ui,sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.12)');
      document.body.appendChild(el);
    }
    el.innerHTML = ESTADOS.map(([k, rot]) => `<button data-k="${k}" style="border:0;border-radius:6px;padding:7px 10px;cursor:pointer;font:inherit;background:${k === atual ? '#fff' : 'transparent'};color:#222;${k === atual ? 'box-shadow:0 1px 2px rgba(0,0,0,.15)' : ''}">${rot}</button>`).join('');
    el.querySelectorAll('button').forEach(b => b.onclick = () => aplicar(b.dataset.k));
  }

  window.PiorCaso = { aplicar, MONTA, pior, vazio, um };
  const inicial = new URLSearchParams(location.search).get('dados');
  aplicar(MONTA[inicial] ? inicial : 'pior');
})();
