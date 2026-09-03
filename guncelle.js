/* 🔄 TESLİMAT — düzeltme KURULU kullanıcıya iniyor mu?
   ==================================================================
   KAYNAK: `HESAP MAKİNESİ\ortak\guncelle.js`. Uygulamalara KOPYALANIR.
   Değişiklik ÖNCE burada yapılır, sonra kopyalar tazelenir — yoksa
   dokuz ayrı sürüm doğar ve biri düzeltilip sekizi unutulur (K-69).

   NEDEN VAR — 5 · Göz Molası'nın ölçümü (02.09.2026):
     "Kurulu uygulamada registration.update() hiç çağrılmıyordu,
      kullanıcı SÜRESİZ eski sürümde kalıyordu.
      Yayın doğruydu, TESLİMAT yoktu."

   Ölçtüm, dokuz uygulamanın SEKİZİNDE aynı durum vardı.

   SESSİZ KAPAN NASIL ÇALIŞIR
   Tarayıcı yeni `sw.js` dosyasını ancak bir GEZİNME olduğunda kontrol
   eder (ve kendi başına en fazla 24 saatte bir). Ana ekrandan açılan
   bir uygulamada gezinme neredeyse hiç olmaz: kullanıcı uygulamayı
   "kapatmaz", arka plana atar, ertesi gün aynı sayfaya döner. Sonuç:
   düzeltme yayında, kullanıcıda değil — ve kimsenin haberi olmaz,
   çünkü yayın tarafındaki her ölçüm "yayınlandı" diyor.

   BU MODÜLÜN YAPTIĞI İKİ ŞEY
   1. AÇILIŞTA VE GERİ DÖNÜNCE SORAR (`registration.update()`).
      Sayfa yeniden görünür olduğunda da sorar — kurulu uygulamada asıl
      an budur. Kısıtlanmıştır (varsayılan 30 dakika): her sekme
      değişiminde ağa gitmek pil ve veri harcar.

   2. YENİ SÜRÜM DEVRALINCA KULLANICIYA SÖYLER (`controllerchange`).
      KENDİLİĞİNDEN TAZELEMEZ. Uygulamalarımızda form var (Muhasebe,
      Kahve, Arsa); habersiz `reload()` yazılmakta olan veriyi siler.
      "Kullanıcıyı korumak" diye yapılan tazeleme, kullanıcıya zarar
      verir. Varsayılan: küçük bir şerit, "Yenile" düğmesi kullanıcıda.

   KENDİ KÖRLÜĞÜ
   · Bu dosya teslimatı GARANTİ ETMEZ; yalnız sormayı sıklaştırır.
     Kanıt ancak gerçek cihazda, eski sürüm kuruluyken ölçülür.
   · Tarayıcı çevrimdışıysa `update()` sessizce başarısız olur — bu
     doğrudur, ama "sordum" demek "yeni sürüm yok" demek değildir.
   ================================================================== */
(function (global) {
    'use strict';

    function Guncelle(ayar) {
        var A = {
            dakika: 30,                       /* iki sorma arası en az */
            metin: 'Yeni sürüm hazır',
            aciklama: 'Yenileyince en son düzeltmeler gelir',
            dugme: 'Yenile',
            sonraDugme: 'Sonra',
            otomatik: false                   /* bkz. yukarıdaki not */
        };
        Object.keys(ayar || {}).forEach(function (k) { A[k] = ayar[k]; });

        if (!('serviceWorker' in navigator)) return;

        /* `controllerchange` ÜÇ ayrı durumda ateşlenir ve yalnız BİRİ
           "yeni sürüm geldi" demektir:

             1. İLK KURULUM — sayfada hiç denetleyici yokken biri geldi.
             2. DEVİR — sayfayı BAŞKA bir uygulamanın işçisi kontrol
                ediyordu, şimdi bizimki devraldı.
             3. GERÇEK GÜNCELLEME — aynı işçinin yeni sürümü geçti.

           2 numara ÖLÇÜLEREK bulundu (03.09.2026, portal → Hava). Portal
           kökte durduğu için işçisinin kapsamı `/` — yani BÜTÜN
           uygulamaları kapsıyor. Kullanıcı portalı açıp bir uygulamaya
           geçtiğinde sayfa portalın işçisi altında açılıyor, sonra
           uygulama kendi işçisini kurup devralıyor.

           Eski kalkan yalnız 1'i eliyordu. Sonuç: kullanıcı uygulamayı
           İLK kez açtığı anda "Yeni sürüm hazır" yalanını görüyordu.
           Üstelik portal tam da bu yol için var — yani en sık yol,
           yalanı tetikleyen yoldu.

           İki yönde de ölçüldü:
             tertemiz → doğrudan uygulama   : şerit YOK
             tertemiz → portal → uygulama   : şerit VARDI (kusur)

           AYIRT EDİCİ: gerçek güncellemede işçinin ADRESİ AYNI KALIR —
           aynı dosyanın yeni sürümü geçer. Devirde adres DEĞİŞİR. */
        var oncekiBetik = navigator.serviceWorker.controller
                        ? navigator.serviceWorker.controller.scriptURL
                        : null;
        var tazelendi = false;
        var serit = null;

        navigator.serviceWorker.addEventListener('controllerchange', function () {
            var yeniBetik = navigator.serviceWorker.controller
                          ? navigator.serviceWorker.controller.scriptURL
                          : null;

            /* 1 (ilk kurulum) ve 2 (devir) AYNI muameleyi görür:
               şerit çıkmaz, ama adres MUTLAKA yazılır.

               Adresi yazmayı atlarsak modül o sayfa oturumu boyunca
               SAĞIR kalır: ilk ziyarette denetleyici yoktur, `null`
               okunur, ve bir daha hiç güncellenmezse aynı oturumda
               gelen GERÇEK bir güncelleme de sessizce elenir.
               (Bulan: 04/12 oturumu, 03.09.2026 — benim birkaç dakika
               önce yazdığım yamadaki açık. Dar ama gerçek: sonraki
               ziyarette kendini toparlıyordu.) */
            if (!oncekiBetik || oncekiBetik !== yeniBetik) {
                oncekiBetik = yeniBetik;
                return;
            }
                                              /* 3: gerçek güncelleme */
            if (tazelendi) return;            /* döngü kalkanı */
            if (A.otomatik) {
                tazelendi = true;
                location.reload();
                return;
            }
            goster();
        });

        function goster() {
            /* `serit` DOLU AMA SAYFADA OLMAYABILIR.
               Sinamada ortaya cikti: baska bir kod seridi DOM'dan
               kaldirdiginda buradaki basvuru duruyordu ve bu ornek bir
               daha ASLA serit acmiyordu -- sessizce. `isConnected`
               sormadan "zaten var" demek, olmayan bir seye guvenmektir. */
            if (serit && serit.isConnected) return;
            serit = null;
            serit = document.createElement('div');
            serit.setAttribute('role', 'status');
            serit.setAttribute('aria-live', 'polite');
            serit.style.cssText =
                'position:fixed;left:12px;right:12px;bottom:12px;z-index:950;' +
                'display:flex;gap:10px;align-items:center;flex-wrap:wrap;' +
                'padding:12px 14px;border-radius:14px;max-width:640px;' +
                'margin:0 auto;font:inherit;' +
                'background:var(--kart,#fff);color:var(--yazi,#111);' +
                'border:1px solid var(--cizgi,#ddd);' +
                'box-shadow:0 8px 30px rgba(0,0,0,.28);';

            var m = document.createElement('div');
            m.style.cssText = 'flex:1 1 200px;min-width:0;';
            m.innerHTML = '<strong></strong><br><span style="opacity:.75;' +
                          'font-size:.9em"></span>';
            m.querySelector('strong').textContent = A.metin;
            m.querySelector('span').textContent = A.aciklama;
            serit.appendChild(m);

            /* Dokunma alanı iki boyutta da 44px -- ekran nöbetçisinin
               ölçtüğü kural; yalnız yükseklik yetmiyor. */
            var evet = document.createElement('button');
            evet.type = 'button';
            evet.textContent = A.dugme;
            evet.style.cssText =
                'min-height:44px;min-width:44px;padding:0 16px;border:0;' +
                'border-radius:10px;font:inherit;font-weight:600;' +
                'cursor:pointer;background:var(--vurgu,#1c5fd6);' +
                'color:var(--vurgu-yazi,#fff);';
            evet.addEventListener('click', function () {
                tazelendi = true;
                location.reload();
            });
            serit.appendChild(evet);

            var sonra = document.createElement('button');
            sonra.type = 'button';
            sonra.textContent = A.sonraDugme;
            sonra.style.cssText =
                'min-height:44px;min-width:44px;padding:0 12px;' +
                'border-radius:10px;font:inherit;cursor:pointer;' +
                'background:transparent;color:var(--yazi2,#666);' +
                'border:1px solid var(--cizgi,#ddd);';
            sonra.addEventListener('click', function () {
                serit.remove();
                serit = null;
            });
            serit.appendChild(sonra);

            document.body.appendChild(serit);
        }

        var sonSordu = 0;
        function sor() {
            var simdi = Date.now();
            if (simdi - sonSordu < A.dakika * 60000) return;
            sonSordu = simdi;
            navigator.serviceWorker.getRegistration().then(function (r) {
                if (r) { try { r.update(); } catch (e) {} }
            }).catch(function () {});
        }

        /* Kayıt tamamlanmadan update() çağırmak boşa gider. */
        navigator.serviceWorker.ready.then(function () { sor(); })
                                     .catch(function () {});

        /* KURULU UYGULAMADA ASIL AN BURASI: kullanıcı uygulamayı
           kapatmaz, arka plana atar ve geri döner. Gezinme olmadığı
           için tarayıcı kendi başına sormaz. */
        document.addEventListener('visibilitychange', function () {
            if (document.visibilityState === 'visible') sor();
        });
        window.addEventListener('online', sor);
    }

    global.Guncelle = Guncelle;
})(typeof window !== 'undefined' ? window : this);
