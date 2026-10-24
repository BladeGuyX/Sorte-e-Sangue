'use strict';
/* Service worker do Sorte & Sangue: guarda o jogo no aparelho para abrir sem internet.
   O build (build.js) troca VERSION e PRECACHE pelos arquivos reais da dist/. */

const VERSION = 'd2c07981';
const PRECACHE = ["./","./icons/apple-touch-icon.png","./icons/favicon-48.png","./icons/icon-192.png","./icons/icon-512.png","./icons/icon-maskable-512.png","./icons/icon.svg","./index.html","./js/ai.bb9f3c94.js","./js/cards.e9adbb46.js","./js/debug.8079b733.js","./js/engine.6aa30ea1.js","./js/khaos.3cf802a4.js","./js/main.7a0b243c.js","./js/net.0a7b340f.js","./js/pwa.e5ae54e3.js","./js/sfx.b4db72af.js","./js/ui.dfefc11f.js","./manifest.webmanifest","./style.98564066.css"];
const CACHE = `sorte-sangue-${VERSION}`;
// bibliotecas e fontes de fora que também ficam guardadas (o servidor de salas do modo online não)
const CDN = ['https://cdnjs.cloudflare.com/', 'https://fonts.googleapis.com/', 'https://fonts.gstatic.com/'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

// versão nova: apaga os caches antigos
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('sorte-sangue-') && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin && !CDN.some((p) => req.url.startsWith(p))) return;

  // a página: tenta a internet primeiro (para pegar atualizações) e, sem conexão, usa a guardada
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req)
      .then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put('./index.html', copy)); return res; })
      .catch(() => caches.match('./index.html').then((r) => r || caches.match('./'))));
    return;
  }

  // scripts, estilos, ícones e fontes: usa o guardado na hora e atualiza em segundo plano
  e.respondWith(caches.match(req).then((hit) => {
    const net = fetch(req).then((res) => {
      if (res && (res.ok || res.type === 'opaque')) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => hit);
    return hit || net;
  }));
});
