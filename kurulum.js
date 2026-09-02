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

        function seridiYap() {
            if (serit) return serit;
            serit = document.createElement('div');
            serit.className = 'kurulum-serit';
            serit.setAttribute('role', 'region');
            serit.setAttribute('aria-label', 'Uygulama kurulumu');
            serit.style.cssText =
                'position:fixed;left:12px;right:12px;bottom:12px;z-index:900;' +
                'display:flex;gap:10px;align-items:center;flex-wrap:wrap;' +
                'padding:12px 14px;border-radius:14px;' +
                'background:var(--kart,#fff);color:var(--yazi,#111);' +
                'border:1px solid var(--cizgi,#ddd);' +
                'box-shadow:0 8px 30px rgba(0,0,0,.28);max-width:640px;margin:0 auto;';
            document.body.appendChild(serit);
            return serit;
        }

        function goster(kurulabilir) {
            var s = seridiYap();
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
            sonra.textContent = A.sonraBtn;
            sonra.style.cssText =
                'min-height:44px;min-width:44px;padding:0 12px;border-radius:10px;' +
                'font:inherit;cursor:pointer;background:transparent;' +
                'color:var(--yazi2,#666);border:1px solid var(--cizgi,#ddd);';
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
    }

    global.Kurulum = Kurulum;
})(typeof window !== 'undefined' ? window : this);
