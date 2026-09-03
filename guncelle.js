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


    /* ---- RENK CIFTI: YAZI, ZEMINDEN TURETILIR ----------------------
       Ilk hali zemini `var(--kart,#fff)`, yaziyi `var(--yazi,#111)`
       aliyordu. IKI YEDEK BIRBIRINDEN BAGIMSIZDI: sayfada `--yazi`
       tanimli ama `--kart` tanimsizsa zemin #fff'e duser, yazi ise
       sayfanin rengini alir -- koyu temada BEYAZ. Sonuc BEYAZ USTUNE
       BEYAZ, karsitlik 1:1. Serit ciziliyor, metin orada, kullanici
       hicbir sey goremiyor. Sessiz kusur: ne hata verir ne bos gorunur.

       Olculdu (03.09.2026, gercek tarayici):
           hava, muhasebe, portal -> `--kart` TANIMSIZ, `--yazi` #ffffff

       ILK DUZELTMEM DE YETMEDI, yaziyorum: sayfanin kendi calisan
       ciftini almayi denedim (`body`nin zemin+yazi rengi). Olctum:
       hava'da `body` ve `html` arka plani `rgba(0,0,0,0)` -- SAYDAM.
       Zincir yine #fff'e dusuyordu. "Sayfadan sor" cozumu, sayfanin
       cevabi olduguu VARSAYIMINA dayaniyordu.

       DOGRUSU SORMAK DEGIL HESAPLAMAK: zemin ne olursa olsun, yazi
       rengi onun PARLAKLIGINDAN turetilir. Boylece cift, varsayimla
       degil KURULUM GEREGI okunur olur. Sayfa hicbir degisken
       tanimlamasa da calisir.

       WCAG goreli parlaklik esigi 0,179'dur: bundan acik zeminde koyu
       yazi, koyuda acik yazi en yuksek karsitligi verir. Ikisi de
       AA'yi (4,5) rahatlikla gecer. */
    function _rgb(renk) {
        renk = (renk || '').trim();
        var m = renk.match(/^#([0-9a-f]{3})$/i);
        if (m) return m[1].split('').map(function (h) { return parseInt(h + h, 16); });
        m = renk.match(/^#([0-9a-f]{6})$/i);
        if (m) return [0, 2, 4].map(function (i) { return parseInt(m[1].substr(i, 2), 16); });
        m = renk.match(/rgba?\(([^)]+)\)/i);
        if (m) {
            var p = m[1].split(',').map(function (x) { return parseFloat(x); });
            if (p.length > 3 && p[3] === 0) return null;      /* saydam */
            return [p[0], p[1], p[2]];
        }
        return null;
    }
    function _parlaklik(renk) {
        var r = _rgb(renk);
        if (!r) return null;
        var v = r.map(function (x) {
            x = x / 255;
            return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
    }
    function renkCifti() {
        var kok = getComputedStyle(document.documentElement);
        var zemin = '';
        /* Sayfanin kart/panel yuzeyini ara; ilk OPAK olani al. */
        ['--kart', '--panel', '--yuzey', '--zemin2', '--zemin'].some(function (ad) {
            var v = (kok.getPropertyValue(ad) || '').trim();
            if (v && _parlaklik(v) !== null) { zemin = v; return true; }
            return false;
        });
        if (!zemin) {
            var g = getComputedStyle(document.body).backgroundColor;
            if (_parlaklik(g) !== null) zemin = g;
        }
        if (!zemin) zemin = '#ffffff';
        var p = _parlaklik(zemin);
        return { zemin: zemin, yazi: (p === null || p > 0.179) ? '#111111' : '#f5f5f5' };
    }

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
            var _c = renkCifti();
            serit.style.cssText =
                'position:fixed;left:12px;right:12px;bottom:12px;z-index:950;' +
                'display:flex;gap:10px;align-items:center;flex-wrap:wrap;' +
                'padding:12px 14px;border-radius:14px;max-width:640px;' +
                'margin:0 auto;font:inherit;' +
                'background:' + _c.zemin + ';color:' + _c.yazi + ';' +
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
