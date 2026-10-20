const CACHE = 'lotifly-v79';
const FILES = ['./', './index.html', './style.css', './icones.css', './fonts/Geist-Variable.woff2', './config.js', './erros.js', './vendor/supabase.js', './core.js', './gestos.js', './permissoes.js', './planta.js', './planta-pdf.js', './planta-dxf.js', './admin-pdf.js', './corretor.js', './admin.js', './indices.js', './antecipacao.js', './cobranca.js', './financeiro.js', './banco.js', './cnab.js', './relatorios.js', './docs.js', './tabela.js', './vendor/jspdf.umd.min.js', './vendor/jspdf.plugin.autotable.min.js', './clientes.js', './contrato.js', './cessao.js', './distrato.js', './auth.js', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    /* Só apaga as versões antigas deste app (as plantas guardadas para uso sem internet ficam;
       quem apaga essas é o próprio app, quando a pessoa sai da conta). O endereço vinicauduro.github.io é dividido com
       outros apps (o CRM), e a memória offline é uma só para o endereço inteiro: apagar tudo
       que não fosse nosso levava junto a do vizinho. */
    Promise.all(keys.filter(k => k !== CACHE && k !== 'lotifly-plantas' && (k.startsWith('lotifly-') || k.startsWith('gestao-loteamento-'))).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  /* Só os arquivos do próprio app ficam guardados no aparelho. Dados e plantas da nuvem não:
     a planta é fechada para quem não é da empresa e não pode sobrar num cache depois de sair. */
  if (new URL(e.request.url).origin !== self.location.origin) return;
  // Rede primeiro (para pegar atualizações), cache como reserva offline.
  e.respondWith(
    fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match(e.request))
  );
});
