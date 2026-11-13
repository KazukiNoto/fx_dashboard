// アプリの骨組み(HTML/CSS/JS/アイコン)だけをキャッシュする Service Worker。
// チャートとカレンダーは TradingView から読み込むため、オフラインでは表示されない。
const CACHE = "fx-dashboard-v5";
const SHELL = [
  "./",
  "index.html",
  "style.css",
  "app.js",
  "manifest.webmanifest",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "flags/us.svg",
  "flags/eu.svg",
  "flags/gb.svg",
  "flags/au.svg",
  "flags/jp.svg",
];

self.addEventListener("install", (event) => {
  // GitHub Pages は max-age=600 のため、ブラウザの HTTP キャッシュを通さず取得する
  // (ファイルごとに版がずれて「新しい HTML と古い JS」になるのを防ぐ)
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(SHELL.map((url) => new Request(url, { cache: "reload" }))))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

// 同一オリジンのみ対象。ネットワーク優先で、失敗したらキャッシュを返す。
// cache: "no-cache" で毎回サーバーに更新を確認する(ETag により変更がなければ 304 で軽い)
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || new URL(request.url).origin !== location.origin) {
    return;
  }
  event.respondWith(
    fetch(request, { cache: "no-cache" })
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(request, copy));
        return res;
      })
      .catch(() => caches.match(request))
  );
});
