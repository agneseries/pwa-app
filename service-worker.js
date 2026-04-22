const CACHE_NAME = "rutin-v1.0.0";
const BASE_URL = self.registration.scope;

// Daftar file yang akan di-cache (sesuai dengan aset Rutin)
const urlsToCache = [
  `${BASE_URL}`,
  `${BASE_URL}index.html`,
  `${BASE_URL}offline.html`,
  `${BASE_URL}assets/style.css`,
  `${BASE_URL}manifest.json`,
  `${BASE_URL}icons/icon-192.png`,
  `${BASE_URL}icons/icon-512.png`,
  `${BASE_URL}icons/foto-morning-stretch.jpg`,
  `${BASE_URL}icons/foto-period-friendly.jpg`,
  `${BASE_URL}icons/foto-bed-yoga.png`,
  "https://fonts.googleapis.com/css2?family=Quicksand:wght@300;400;500;600;700&display=swap",
  "https://fonts.gstatic.com/s/quicksand/v24/6xKtdSZaM9iE8KbpRA_hK1QNYuDyP8bh.woff2"
];

// Install Service Worker & simpan file ke cache
self.addEventListener("install", event => {
  console.log("[Service Worker] Installing...");
  self.skipWaiting(); // langsung aktif tanpa reload manual
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log("[Service Worker] Caching files...");
        return cache.addAll(urlsToCache);
      })
      .catch(err => console.error("[Service Worker] Cache gagal dimuat:", err))
  );
});

// Aktivasi dan hapus cache lama
self.addEventListener("activate", event => {
  console.log("[Service Worker] Activating...");
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            console.log("[Service Worker] Menghapus cache lama:", key);
            return caches.delete(key);
          }
        })
      );
      await self.clients.claim(); // langsung klaim kontrol ke halaman
      console.log("[Service Worker] Now ready to handle fetches!");
    })()
  );
});

// Fetch event: cache-first untuk file lokal, network-first untuk API
self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);

  // Abaikan permintaan Chrome Extension, analytics, dll.
  if (url.protocol.startsWith("chrome-extension")) return;
  if (request.method !== "GET") return;

  // File lokal (statis) dan file eksternal yang sudah ditentukan
  if (url.origin === self.location.origin || 
      url.href.includes("fonts.googleapis.com") || 
      url.href.includes("fonts.gstatic.com")) {
    event.respondWith(
      caches.match(request).then(response => {
        return (
          response ||
          fetch(request).catch(() => {
            console.warn("[Service Worker] Gagal fetch:", request.url);
            // Jika request adalah navigasi (halaman), tampilkan offline.html
            if (request.mode === 'navigate') {
              return caches.match(`${BASE_URL}offline.html`);
            }
            return new Response("Offline - Konten tidak tersedia", {
              status: 503,
              statusText: "Service Unavailable",
              headers: new Headers({ "Content-Type": "text/plain" })
            });
          })
        );
      })
    );
  } 
  // Resource eksternal lainnya (API, CDN, dsb.) - strategy: network first, fallback ke cache
  else {
    event.respondWith(
      fetch(request)
        .then(networkResponse => {
          // Cache clone response untuk digunakan nanti
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(request, clone);
          });
          return networkResponse;
        })
        .catch(() => {
          return caches.match(request);
        })
    );
  }
});

// Handle pesan dari client (opsional)
self.addEventListener("message", event => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});