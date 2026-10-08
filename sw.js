const CACHE = 'lotifly-v45';
const FILES = ['./', './index.html', './style.css', './config.js', './vendor/supabase.js', './core.js', './permissoes.js', './planta.js', './planta-pdf.js', './planta-dxf.js', './admin-pdf.js', './corretor.js', './admin.js', './indices.js', './antecipacao.js', './cobranca.js', './financeiro.js', './banco.js', './cnab.js', './relatorios.js', './docs.js', './clientes.js', './contrato.js', './auth.js', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    /* Só apaga as versões antigas deste app. O endereço vinicauduro.github.io é dividido com
       outros apps (o CRM), e a memória offline é uma só para o endereço inteiro: apagar tudo
       que não fosse nosso levava junto a do vizinho. */
    Promise.all(keys.filter(k => k !== CACHE && (k.startsWith('lotifly-') || k.startsWith('gestao-loteamento-'))).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  // Rede primeiro (para pegar atualizações), cache como reserva offline.
  e.respondWith(
    fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match(e.request))
  );
});
