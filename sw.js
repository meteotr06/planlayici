// ================= SERVICE WORKER =================
// Uygulamayı çevrimdışı da çalıştırır: dosyaları önbelleğe alır.
// Yeni sürüm çıkarınca SURUM'u artır ki herkese taze dosyalar gitsin.

const SURUM = "planlayici-v11";
const DOSYALAR = [
    "./",
    "./index.html",
    "./stil.css?v=11",
    "./cekirdek.js?v=11",
    "./arayuz.js?v=11",
    "./manifest.json",
    "./ikon-192.png",
    "./ikon-512.png",
    "./ikon-maskeli.png"
];

self.addEventListener("install", (olay) => {
    olay.waitUntil(
        caches.open(SURUM).then((onbellek) => onbellek.addAll(DOSYALAR))
    );
    self.skipWaiting();
});

self.addEventListener("activate", (olay) => {
    // Eski sürümlerin önbelleklerini temizle
    olay.waitUntil(
        caches.keys().then((adlar) =>
            Promise.all(adlar.filter(ad => ad !== SURUM).map(ad => caches.delete(ad)))
        ).then(() => self.clients.claim())
    );
});

self.addEventListener("fetch", (olay) => {
    // Önce ağdan dene (güncel kalsın), olmazsa önbellekten ver (çevrimdışı çalışsın)
    olay.respondWith(
        fetch(olay.request)
            .then((yanit) => {
                const kopya = yanit.clone();
                caches.open(SURUM).then((onbellek) => onbellek.put(olay.request, kopya));
                return yanit;
            })
            .catch(() => caches.match(olay.request).then(y => y || caches.match("./index.html")))
    );
});
