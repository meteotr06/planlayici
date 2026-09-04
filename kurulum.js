/* 📲 KURULUM DAVETİ — bütün uygulamaların ortak modülü
   ==================================================================
   KAYNAK: bu dosya `HESAP MAKİNESİ\ortak\kurulum.js` içindedir.
   Uygulamalara KOPYALANIR. Değiştirmek gerekirse ÖNCE burası
   değişir, sonra kopyalar tazelenir — yoksa sekiz ayrı sürüm doğar
   ve biri düzeltilip yedisi unutulur (K-69: düzeltme göçü).

   NEDEN VAR: kullanıcı "bütün uygulamalarımızda indirilebilme olayını
   çözmemiz gerekiyor" dedi. Ölçüldü (01.09.2026):
     · 3 uygulamada davet HİÇ YOK   -> kullanıcı kurabileceğini bilmiyor
     · 4 uygulamada davet var ama "zaten kurulu mu" denetimi YOK
       -> kurulu olduğu hâlde "install" demeye devam ediyor

   BUGÜN CANLIDA YAŞANAN İKİ HATA, İKİSİ DE BURADA KAPALI:

   1. "KURULU AMA HÂLÂ INSTALL DİYOR"
      Kurulu olup olmadığına yalnız `display-mode: standalone` ile karar
      veriliyordu. O ölçüt uygulamanın KENDİ PENCERESİNDE doğrudur;
      kullanıcı aynı siteyi tarayıcıda açtığında kurulu olsa bile
      `false` döner. Burada `getInstalledRelatedApps()` ile TARAYICIYA
      SORULUYOR.

   2. "KUR'A BASTIM, SİLDİM, BİR DAHA İNDİREMEDİM"
      `appinstalled` olayında diske "kullanıcı daveti kapattı" yazılıyordu.
      Kurmak "hayır" demek DEĞİLDİR; kullanıcı uygulamayı silince o kayıt
      kalıyor ve davet BİR DAHA ÇIKMIYORDU — kalıcı olarak.
      Burada kurulum diske hiçbir şey yazmaz.

   KAYIT DİSİPLİNİ: yalnız "şimdi değil" diske yazılır ve SÜRELİDİR
   (7 gün). Bir kaydın anlattığı şeyden uzun yaşaması, bu takımın
   adını koyduğu bir hata sınıfıdır.
   ================================================================== */
(function (global) {
    'use strict';

    var VARSAYILAN = {
        anahtar: 'kurulum-ertelendi',   /* uygulama başına ayrı verilmeli */
        kapiMetni: '📲 Uygulama olarak kur',
        gun: 7,                          /* "şimdi değil" kaç gün sussun */
        baslik: 'Uygulama olarak kur',
        metin: 'Ana ekranına ekle, internetsiz de çalışsın',
        kurBtn: 'Kur',
        sonraBtn: 'Şimdi değil',
        nasilBtn: 'Nasıl?',
        /* ISRARSIZLIK — 09 Hesap Araclari'ndan alindi (K-69).
           Oradaki yorum meselenin ozunu soyluyor:
             "Kurmak ister misin?" sorusu, faydayi GORMEDEN sorulunca
             reklamdir; GORDUKTEN sonra sorulunca tekliftir.
           bekle verilirse serit, o islev true donene kadar cikmaz.
           Ornek: bekle: function () { return !!document.querySelector('.sonuc'); }
           Verilmezse davranis degismez (dogrudan gosterilir). */
        bekle: null,
        iosMetin: 'Safari’de paylaş düğmesine (kutudan çıkan ok) dokunun, ' +
                  'sonra “Ana Ekrana Ekle” deyin.',
        digerMetin: 'Tarayıcı menüsünü açın ve “Uygulamayı yükle” ya da ' +
                    '“Ana ekrana ekle” seçeneğini seçin.'
    };

    function Kurulum(ayar) {
        var A = {};
        Object.keys(VARSAYILAN).forEach(function (k) { A[k] = VARSAYILAN[k]; });
        Object.keys(ayar || {}).forEach(function (k) { A[k] = ayar[k]; });

        var olay = null;          /* beforeinstallprompt olayı */
        var serit = null;

        var iOS = /iphone|ipad|ipod/i.test(navigator.userAgent) &&
                  !/crios|fxios/i.test(navigator.userAgent);
        var uygulamaKipi =
            (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
            window.navigator.standalone === true;

        /* ---- "şimdi değil" — SÜRELİ, sonsuz değil ---- */
        function ertelendiMi() {
            try {
                var t = parseInt(localStorage.getItem(A.anahtar), 10);
                if (!t) return false;
                var fark = Date.now() - t;
                /* FARK NEGATIF OLABILIR -- 05 numarali oturum buldu.
                   Kayit GELECEKTE ise (kullanici saati geri aldi, ya da
                   cihaz saati yanlisti) fark eksi cikar ve "< 7 gun"
                   kosulu YINE saglanir; davet hak ettiginden cok daha
                   uzun susar. O oturumda ayni desenden DORT kusur
                   cikmis, en agiri bir sayaci tamamen durduruyormus.
                   Eksi fark, "bilinmeyen zaman" demektir; susmak icin
                   gerekce degildir. */
                return fark >= 0 && fark < A.gun * 86400000;
            } catch (e) { return false; }
        }
        function ertele() {
            try { localStorage.setItem(A.anahtar, String(Date.now())); } catch (e) {}
        }

        /* ---- ZATEN KURULU MU? Tarayıcıya sor, diske YAZMA ----
           Cevabı saklarsak, kullanıcı uygulamayı silince kayıt kalır ve
           davet bir daha çıkmaz. Her açılışta yeniden sorulur. */
        function kuruluMu() {
            if (uygulamaKipi) return Promise.resolve(true);
            if (!navigator.getInstalledRelatedApps) return Promise.resolve(false);
            try {
                return navigator.getInstalledRelatedApps()
                    .then(function (l) {
                        return (l || []).some(function (u) { return u.platform === 'webapp'; });
                    })
                    .catch(function () { return false; });   /* bilemiyorsak GÖSTER */
            } catch (e) { return Promise.resolve(false); }
        }

    
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

    /* ---------------------------------------------------------------
       TURETILMIS RENK, KAYNAGI DEGISINCE YENIDEN TURETILIR.

       Olculdu (04.09.2026, acik temada): `.kurulum-kapi` karsitligi
       1,01 -- beyaz uzerine beyaz, yani GORUNMEZ. Sebep: renk cifti
       oge yaratilirken BIR KEZ hesaplanip satir ici usluba
       donduruluyordu. Sayfa koyu acilip kullanici acik temaya
       gecince yazi `#f5f5f5` olarak kaliyordu.

       Bir kez hesaplanan turetilmis deger, turetilmis degil
       KOPYALANMIS olur. Kaynak degisince kopya bayatlar ve --
       burada oldugu gibi -- sessizce kaybolur.
       --------------------------------------------------------------- */
    var _izlenen = [];
    function _izle(oge, tur) { _izlenen.push({ oge: oge, tur: tur }); }

    function renkleriTazele() {
        var c = renkCifti();
        for (var i = _izlenen.length - 1; i >= 0; i--) {
            var x = _izlenen[i];
            if (!x.oge || !x.oge.parentNode) { _izlenen.splice(i, 1); continue; }
            x.oge.style.color = c.yazi;
            if (x.tur === 'serit') {
                x.oge.style.background = c.zemin;
                /* Ikincil dugme seridin KENDI ciftinden beslenir (K-81);
                   tazelemede de ayni kaynaktan gelmeli, yoksa cift
                   ayrisir ve yine karsitlik duser. */
                var ik = x.oge.querySelector('[data-ikincil]');
                if (ik) ik.style.color = c.yazi;
            }
        }
    }

    /* Iki kaynak da izlenir:
         1. `data-tema` -- kullanicinin kendi secimi,
         2. `prefers-color-scheme` -- secim yoksa cihazin kipi.
       Birini atlarsak o yoldan gelen degisiklikte kusur geri gelir. */
    var _izlemeKurulu = false;
    function temayiIzle() {
        if (_izlemeKurulu) return;
        _izlemeKurulu = true;
        try {
            new MutationObserver(renkleriTazele).observe(
                document.documentElement,
                { attributes: true, attributeFilter: ['data-tema', 'data-renk', 'class'] });
        } catch (e) {}
        try {
            var m = window.matchMedia('(prefers-color-scheme: dark)');
            if (m.addEventListener) m.addEventListener('change', renkleriTazele);
            else if (m.addListener) m.addListener(renkleriTazele);
        } catch (e) {}
    }

    function seridiYap() {
            if (serit) return serit;
            serit = document.createElement('div');
            serit.className = 'kurulum-serit';
            serit.setAttribute('role', 'region');
            serit.setAttribute('aria-label', 'Uygulama kurulumu');
            var _c = renkCifti();
            serit.style.cssText =
                'position:fixed;left:12px;right:12px;bottom:12px;z-index:900;' +
                'display:flex;gap:10px;align-items:center;flex-wrap:wrap;' +
                'padding:12px 14px;border-radius:14px;' +
                'background:' + _c.zemin + ';color:' + _c.yazi + ';' +
                'border:1px solid var(--cizgi,#ddd);' +
                'box-shadow:0 8px 30px rgba(0,0,0,.28);max-width:640px;margin:0 auto;';
            document.body.appendChild(serit);
            _izle(serit, 'serit');
            temayiIzle();
            return serit;
        }

        /* Seridin SON cizim durumu. Tazeleme ayni hali yeniden kurar;
           bilmezsek "Kur" yazan dugmeyi "Nasil?" yapabiliriz ve
           kullanicinin gordugu dugme sessizce anlam degistirir. */
        var _sonKurulabilir = null;

        function goster(kurulabilir) {
            _sonKurulabilir = kurulabilir;
            var s = seridiYap();
            /* KENDI CIFTINI KENDI HESAPLAR.
               Eskiden `seridiYap()` icindeki `_c`ye uzaniyordu -- baska
               kapsam. Kati kipte ReferenceError firlatiyor ve islev
               tam da "Simdi degil" dugmesini eklemeden once kesiliyordu:
               serit ciziliyor ama KAPATILAMIYORDU.
               `renkCifti()` saftir (yalniz kok CSS degiskenlerini okur),
               bu yuzden iki cagri ayni cevabi verir. */
            var _c = renkCifti();
            s.innerHTML = '';
            var metin = document.createElement('div');
            metin.style.cssText = 'flex:1 1 200px;min-width:0;';
            metin.innerHTML = '<strong>' + A.baslik + '</strong><br>' +
                '<span style="opacity:.75;font-size:.9em">' + A.metin + '</span>';
            s.appendChild(metin);

            var asil = document.createElement('button');
            asil.type = 'button';
            asil.textContent = kurulabilir ? A.kurBtn : A.nasilBtn;
            asil.style.cssText =
                'min-height:44px;min-width:44px;padding:0 16px;border-radius:10px;' +
                'border:0;font:inherit;font-weight:600;cursor:pointer;' +
                'background:var(--vurgu,#1c5fd6);color:var(--vurgu-yazi,#fff);';
            asil.addEventListener('click', function () {
                if (kurulabilir && olay) {
                    olay.prompt();
                    /* KURULUM DİSKE HİÇBİR ŞEY YAZMAZ. Kurmak "hayır"
                       demek değildir; yazsaydık kullanıcı uygulamayı
                       silince davet bir daha çıkmazdı. */
                    olay.userChoice.finally(function () { kapat(false); });
                    olay = null;
                } else {
                    alert(iOS ? A.iosMetin : A.digerMetin);
                }
            });
            s.appendChild(asil);

            var sonra = document.createElement('button');
            sonra.type = 'button';
            /* Tazeleme bu dugmeyi bu isaretle bulur. Sinif adiyla
               arasaydik, seridi kullanan bir uygulama sinifi
               degistirdiginde sessizce bulunamaz olurdu. */
            sonra.setAttribute('data-ikincil', '1');
            sonra.textContent = A.sonraBtn;
            sonra.style.cssText =
                'min-height:44px;min-width:44px;padding:0 12px;border-radius:10px;' +
                'font:inherit;cursor:pointer;background:transparent;' +
                /* IKINCIL DUGME DE SERIDIN KENDI CIFTINDEN BESLENIR.
                   Eskiden `var(--yazi2)` kullaniyordu -- yani seridin
                   zeminine degil SAYFANIN soluk rengine bakiyordu.
                   Olculdu (04.09.2026, hava koyu tema): karsitlik 2,22.
                   Serit kendi zeminini hesapliyorsa yazisini da ayni
                   hesaptan almali; iki ayri kaynak es tutmaz (K-81). */
                'color:' + _c.yazi + ';opacity:.85;' +
                'border:1px solid var(--cizgi,rgba(128,128,128,.45));';
            sonra.addEventListener('click', function () { kapat(true); });
            s.appendChild(sonra);
        }

        function kapat(yaz) {
            if (yaz) ertele();
            if (serit) { serit.remove(); serit = null; }
        }

        /* bekle verilmisse, kosul saglanana kadar gosterme.
           En cok 60 saniye bekler; kullanici o sayfada is yapmiyorsa
           sonsuza kadar yoklamak bosuna pil harcamaktir. */
        function kosuluBekle(is) {
            if (typeof A.bekle !== 'function') { is(); return; }
            var bas = Date.now();
            (function bak() {
                var tamam = false;
                try { tamam = !!A.bekle(); } catch (e) { tamam = false; }
                if (tamam) { is(); return; }
                if (Date.now() - bas > 60000) return;   /* vazgec */
                setTimeout(bak, 800);
            })();
        }

        /* ---- KALICI KAPI ------------------------------------------
           Kullanicinin bildirdigi kusur (03.09.2026):
               "uygulamayi siliyorum, geri yuklemek icin secenek cikmiyor"

           Sebep: davet SERIDI tek kapiydi. Serit su durumlarda hic
           cikmaz --
             - kullanici daha once "Simdi degil" demistir (7 gun susar),
             - tarayici `beforeinstallprompt` gondermez (Chrome yakin
               zamanda SILINMIS bir uygulama icin bir sure bastirir;
               Firefox ve uygulama ici tarayicilar hic gondermez),
             - kullanici seridi kapatmistir.
           Bu durumlarda kullanicinin HICBIR yolu kalmiyordu.

           Olculdu: dokuz uygulamanin SEKIZINDE gorunur kurulum yolu
           yoktu; yalnizca portalda vardi.

           Cozum: serit gecici, KAPI kalicidir. Kurulu uygulamada HIC
           eklenmez -- kurana ise yaramaz. Erteleme kaydina BAKMAZ:
           "simdi degil" demek "bir daha kuramayayim" demek degildir.

           SABIT KONUMDA DEGIL, NORMAL AKISTA. Bu ailede sabit konumlu
           serit ayni gun IKI kez icerigi ortup zarar verdi: Hava'da
           gizlilik baglantisini tiklanamaz yapti, Muhasebe'de "Kaydet"
           dugmesinin ustune bindi -- kullanici tutari yazip basiyor,
           tiklama seride gidiyor ve SAYI KAYBOLUYORDU. Kalici kapi o
           hatayi tekrarlamaz: sayfanin akisinda, en altta durur. */
        function kaliciKapi() {
            if (uygulamaKipi) return;
            if (document.querySelector('.kurulum-kapi')) return;
            var yer = document.querySelector('[data-kurulum-yeri]') ||
                      document.querySelector('footer') ||
                      document.body;
            var c = renkCifti();
            var d = document.createElement('button');
            d.type = 'button';
            d.className = 'kurulum-kapi';
            d.textContent = A.kapiMetni;
            /* Dokunma hedefi iki boyutta da 44px -- ekran nobetcisinin
               olctugu kural; yalniz yukseklik yetmiyor. */
            d.style.cssText =
                'display:block;margin:18px auto;padding:0 16px;' +
                'min-height:44px;min-width:44px;border-radius:10px;' +
                'font:inherit;font-size:.9em;cursor:pointer;' +
                'background:transparent;color:' + c.yazi + ';' +
                'border:1px solid var(--cizgi,rgba(128,128,128,.45));' +
                'opacity:.85;';
            d.addEventListener('click', function () {
                /* `ac()` erteleme kaydini temizler ve seridi acar; bip
                   yoksa talimat gosterir. Tek dogru yol odur. */
                if (A.ac) A.ac();
            });
            yer.appendChild(d);
            _izle(d, 'kapi');
            temayiIzle();
        }

        /* METIN TAZELEME KAPISI -- yalniz cok dilli uygulamalar kullanir.
           Sekiz tek dilli uygulama bu olayi hic gondermez; onlar icin
           bu blok hicbir sey yapmaz.

           Modul dil BILMIYOR: yalniz "sana verdigim metinler degisti,
           yeniden ciz" diyen bir olay aliyor. Dil kavrami uygulamada
           kaliyor -- ortak modulu dokuz uygulamanin diline ortak
           etmek, tam da kacindigimiz sey. */
        document.addEventListener('kurulum-metin', function (e) {
            var yeni = (e && e.detail) || {};
            Object.keys(yeni).forEach(function (k) {
                if (k in A) A[k] = yeni[k];
            });
            var kapi = document.querySelector('.kurulum-kapi');
            if (kapi) kapi.textContent = A.kapiMetni;
            /* Serit EKRANDAYSA yeniden ciz -- ayni kurulabilirlik
               haliyle. Ekranda degilse dokunma; gorunmeyen bir seridi
               canlandirmak, kullanicinin kapattigi daveti geri
               getirmek olurdu. */
            if (serit && serit.parentNode && _sonKurulabilir !== null) {
                goster(_sonKurulabilir);
            }
        });

        function baslat() {
            if (uygulamaKipi) {
                /* KURAN BIRI, DAVETI REDDETMIS SAYILAMAZ -- 05 buldu.
                   Zincir: kullanici "simdi degil" der -> sonra kurar ->
                   sonra siler. Kayit duruyorsa davet 7 gun daha susar,
                   oysa o kisi zaten kurmustu. Uygulama kipinde eski
                   erteleme kaydi TEMIZLENIR. */
                try { localStorage.removeItem(A.anahtar); } catch (e) {}
                return;
            }
            /* KAPI, ERTELEME DENETIMINDEN ONCE kurulur:
               serit susabilir, kapi susmaz. */
            kuruluMu().then(function (k) { if (!k) kaliciKapi(); });

            if (ertelendiMi()) return;

            window.addEventListener('beforeinstallprompt', function (e) {
                e.preventDefault();
                olay = e;
                kuruluMu().then(function (k) {
                    if (!k) kosuluBekle(function () { goster(true); });
                });
            });

            /* iOS'ta `beforeinstallprompt` HİÇ gelmez -- olayı beklemek
               orada sonsuza kadar beklemektir. Doğrudan "Nasıl?" gösterilir. */
            if (iOS) {
                setTimeout(function () {
                    kuruluMu().then(function (k) {
                        if (!k && !serit) kosuluBekle(function () { goster(false); });
                    });
                }, 2500);
                return;
            }

            /* Android/masaüstünde olay GELMEYEBİLİR (Chrome dışı tarayıcı,
               uygulama içi tarayıcı, tarayıcının kendi koşulları). Yedek
               olmadan kullanıcı kurabileceğini HİÇ öğrenemez. */
            setTimeout(function () {
                if (olay || serit) return;
                kuruluMu().then(function (k) {
                    if (!k) kosuluBekle(function () { if (!serit) goster(false); });
                });
            }, 3000);

            window.addEventListener('appinstalled', function () {
                kapat(false);      /* diske YAZMADAN kapat */
            });
        }

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', baslat);
        } else { baslat(); }

        /* ---- ELLE ACILABILIR KAPI ----
           Kullanicinin istegi (03.09.2026): "onu da ayri butonlardan
           linklerden acilsin".

           Kendiliginden cikan bir davet, kullanicinin ISTEDIGI anda
           erisemedigi bir davettir. Serit kacirilirsa ya da "simdi
           degil" denirse yedi gun beklemek gerekiyordu. Bu uygulamada
           daha once yasanmis iki sikayet de tam buradan doguyor:
           "kurdum ama hala install diyor" ve "kur'a bastim, sildim,
           bir daha indiremedim".

           `ac()` erteleme kaydini DA temizler: kullanici dugmeye
           basmissa "simdi degil" demis sayilamaz. */
        A.ac = function () {
            try { localStorage.removeItem(A.anahtar); } catch (e) {}
            if (serit && serit.isConnected) {
                serit.scrollIntoView({ block: 'nearest' });
                return true;
            }
            serit = null;
            goster(!!olay);
            return true;
        };

        A.durum = function () {
            return kuruluMu().then(function (k) {
                if (k) return 'kurulu';
                if (olay) return 'kurulabilir';
                return iOS ? 'ios-elle' : 'tarayici-hazir-degil';
            });
        };

        /* Son olusturulan ornek disaridan cagrilabilsin: sayfadaki bir
           dugme `Kurulum.ac()` diyebilsin diye. Birden cok ornek
           kurulmasi beklenmiyor; kurulursa sonuncusu gecerli olur. */
        Kurulum.ac = A.ac;
        Kurulum.durum = A.durum;
    }

    global.Kurulum = Kurulum;
})(typeof window !== 'undefined' ? window : this);
