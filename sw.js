// แคชหน้าเว็บไว้เปิดได้แม้เน็ตหลุด: ไฟล์ข้อมูลใช้ของใหม่ก่อน ถ้าโหลดไม่ได้ค่อยใช้ของในแคช
const CACHE = "stockdesk-v27";
const SHELL = ["./", "index.html", "app.css", "app.js", "core.js", "manifest.webmanifest", "icon.svg", "manual.json"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== CACHE).map(x => caches.delete(x)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  if (u.origin === location.origin) {
    e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(CACHE).then(x => x.put(e.request.url.split("?")[0], c)); return r; })
      .catch(() => caches.match(e.request.url.split("?")[0]).then(r => r || caches.match("index.html"))));
  }
});
