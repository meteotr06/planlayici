// ================= SERVICE WORKER =================
// Uygulamayı çevrimdışı da çalıştırır: dosyaları önbelleğe alır.
// Yeni sürüm çıkarınca SURUM'u artır ki herkese taze dosyalar gitsin.

const SURUM = "planlayici-v20";
const DOSYALAR = [
    // ⚠️ BU LİSTE index.html'İ BİREBİR YANSITMALI.
    // Ölçüldü (27.08.2026, CANLIDA): index.html "cekirdek.js?v=19" istiyordu,
    // burası "?v=17" saklıyordu. Farklı anahtar = hiç eşleşme. Çevrimiçi
    // hiçbir şey bozulmaz; internet kesikken uygulama YARIM açılır — yani
    // çevrimdışı katmanı tam da iş görmesi gereken anda boş döner.
    // Sürüm artırırken index.html ile birlikte BURAYI da güncelle.
    // `yayin_denetle.py` bunu artık denetliyor.
    "./",
    "./index.html",
    "./stil.css?v=20",
    "./cekirdek.js?v=20",
    "./arayuz.js?v=20",
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

/* ================= FETCH =================
   BU DOSYA ESKI KALIPTAYDI. Bes kardes uygulamada (07 Kur Pusulasi,
   09 Hesap Araclari, 10 Arsa Rehberi ...) olculerek kapatilan uc koruma
   burada YOKTU. Gerekce yorumlari o dosyalarda zaten yaziliydi; buraya
   tasindi (K-69).

   Olculdu (01.09.2026, http://127.0.0.1:8756 uzerinde, sahte bir
   ServiceWorkerGlobalScope icinde bu dosyanin kendi kaynagi kosturularak).
   DUZELTMEDEN ONCEKI DURUM:
     1) Dis kaynakli GET   : KALDI  -- dis istege karisiyor
     2) POST istegi        : KALDI  -- POST'a karisiyor
     3) Gorsel + ag yok    : KALDI  -- gorsel istegine HTML donuyor, durum 200
     4) Sayfa + ag yok     : GECTI
     5) Sunucu 500 dondu   : KALDI  -- 500 onbellege alindi (cekirdek.js?v=19)

   Her birinin ne demek oldugu:
     (1) Baska bir alan adina giden istekler bu servis iscisinden geciyordu.
         Bugun disariya istek yok, ama yarin bir yazi tipi ya da API eklenirse
         cevaplari sessizce onbellege alinir ve ESKI VERI TAZE sanilir.
     (2) POST'a karisilinca istek onbellege alinmaya calisiliyor; POST
         onbelleklenemez, ustelik bu tur istekler zaten ag ister.
     (3) EN AGIRI: ag koptugunda BASARISIZ HER ISTEGE index.html donuyordu.
         Yani bir .js istegine HTML gidiyor ve tarayici
         "Unexpected token '<'" ile uygulamayi komple oldururdu. Ayni hata
         07 Kur Pusulasi'nda olculerek yakalandi; cozum orada da bu.
     (5) Sunucu 500 / 404 dondugunde bozuk cevap onbellege yaziliyordu.
         Bir kez yazildi mi, ag geri gelse bile cevrimdisi acilista o bozuk
         cevap veriliyor.

   KURAL 1: yalniz kendi alan adimiz, yalniz GET.
   KURAL 2: ag once (icerik guncel kalsin), olmazsa onbellek.
   KURAL 3: index.html yedegi YALNIZCA gercek sayfa (navigate) istegine.
            Digerlerinde durust ol: 504 don, sahte icerik verme.
   KURAL 4: yalniz `ok` cevaplar onbellege alinir.

   NOT: SURUM ve yukaridaki DOSYALAR listesi bilerek ELLENMEDI --
   surum damgasini artirmak yayin adimi, merkeze ait. */
self.addEventListener("fetch", (olay) => {
    const istek = olay.request;

    // KURAL 1
    if (istek.method !== "GET") return;
    let adres;
    try { adres = new URL(istek.url); } catch (e) { return; }
    if (adres.origin !== self.location.origin) return;   // dis kaynaklara hic dokunma

    // KURAL 2
    olay.respondWith(
        fetch(istek)
            .then((yanit) => {
                // KURAL 4: bozuk cevabi onbellege yazma
                if (yanit && yanit.ok) {
                    const kopya = yanit.clone();
                    caches.open(SURUM).then((onbellek) => onbellek.put(istek, kopya)).catch(() => {});
                }
                return yanit;
            })
            .catch(() => caches.match(istek).then((y) => {
                if (y) return y;

                /* Damga uyusmazsa onbellek kacirir. Yukaridaki DOSYALAR
                   listesi "?v=19" ile dolar; kullanicinin elindeki SAYFA
                   hala eski olup "?v=18" isteyebilir. Ag zaten koptu, o
                   yuzden burada damgayi yok sayip onbellekteki kopyayi
                   vermek tek dogru davranis -- yoksa cevrimdisi katmani
                   tam da is gormesi gereken anda bos doner.
                   (10 Arsa Rehberi'nde ayni sey olculerek bulundu.)
                   Bu yalnizca AG KOPUKKEN calisir; cevrimiciyken hep
                   taze dosya gelir. */
                return caches.match(istek, { ignoreSearch: true }).then((y2) => {
                    if (y2) return y2;

                    // KURAL 3
                    if (istek.mode === "navigate") return caches.match("./index.html");
                    return new Response("", { status: 504, statusText: "Baglanti yok" });
                });
            }))
    );
});
