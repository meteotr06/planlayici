// ================= ARAYÜZ =================
// Burada sadece EKRAN işleri var: takvimi çizmek, tıklamaları/sürüklemeleri dinlemek.
// Hesap ve kayıt işleri cekirdek.js'de.

const GUN_ADLARI = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];
const GUN_KISA = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
const AY_ADLARI = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
                   "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

const KATEGORILER = {
    ders:    { ad: "Ders",        emoji: "📚", renk: "#ffb84d" },
    etut:    { ad: "Etüt / Ödev", emoji: "✍️", renk: "#ff8fa3" },
    spor:    { ad: "Spor",        emoji: "🏃", renk: "#4dd6ff" },
    yemek:   { ad: "Yemek",       emoji: "🍽️", renk: "#9ee37d" },
    uyku:    { ad: "Uyku",        emoji: "😴", renk: "#8a93b8" },
    serbest: { ad: "Serbest",     emoji: "🎮", renk: "#b08cff" },
    genel:   { ad: "Diğer",       emoji: "📝", renk: "#9aa3c0" }
};

const SAAT_YUKSEKLIK = 44;      // 1 saat ekranda kaç piksel
let haftaKaydirma = 0;          // 0 = bu hafta, -1 = geçen, 1 = gelecek
let duzenlenenId = null;        // pencere açıkken düzenlenen blok (yeni ise null)
let ilkCizim = true;
let gizliKategoriler = new Set(); // filtreyle gizlenenler

function bakilanTarih() {
    const t = new Date();
    t.setDate(t.getDate() + haftaKaydirma * 7);
    return t;
}
function bakilanAnahtar() { return haftaAnahtari(bakilanTarih()); }

function dakToSaat(dak) {
    dak = Math.max(0, Math.min(1439, dak));
    return String(Math.floor(dak / 60)).padStart(2, "0") + ":" + String(dak % 60).padStart(2, "0");
}

function esc(m) {
    const d = document.createElement("div");
    d.textContent = m;
    return d.innerHTML;
}

function sureMetni(dk) {
    const s = Math.floor(dk / 60), d = dk % 60;
    if (s === 0) return d + " dk";
    if (d === 0) return s + " sa";
    return s + " sa " + d + " dk";
}

// ---------- Üst bar ----------
function ustBariCiz() {
    const pzt = haftaBaslangici(bakilanTarih());
    const pazar = new Date(pzt);
    pazar.setDate(pazar.getDate() + 6);
    document.getElementById("haftaEtiketi").textContent =
        pzt.getDate() + " " + AY_ADLARI[pzt.getMonth()] + " – " +
        pazar.getDate() + " " + AY_ADLARI[pazar.getMonth()] + " " + pazar.getFullYear();

    const o = haftaOzeti(bakilanAnahtar());
    document.getElementById("ozet").innerHTML = o.toplam === 0
        ? "Bu hafta henüz plan yok"
        : "<b>" + o.biten + "</b>/" + o.toplam + " tamam · " + sureMetni(o.dakikaToplam) + " planlı";

    document.getElementById("ornekBtn").style.display = tamamenBosMu() ? "" : "none";

    // 🔥 Seri göstergesi
    const seri = seriHesapla();
    const seriEl = document.getElementById("seri");
    seriEl.textContent = seri > 0 ? "🔥 " + seri + " gün" : "";
    seriEl.style.display = seri > 0 ? "" : "none";

    // ⭐ Seviye
    const sv = seviyeBilgi();
    document.getElementById("seviye").textContent = sv.xp > 0 ? "⭐ Sv " + sv.seviye : "";

    // 🎯 En yakın hedefe büyük geri sayım
    const yakin = enYakinHedef();
    const sayacEl = document.getElementById("anaSayac");
    if (yakin) {
        sayacEl.textContent = "🎯 " + yakin.ad + ": " + (yakin.kalan === 0 ? "BUGÜN!" : yakin.kalan + " gün");
        sayacEl.style.display = "";
    } else {
        sayacEl.style.display = "none";
    }
}

// ---------- 🔢 Soru sayacı ----------
function soruCiz() {
    const kap = document.getElementById("soruListe");
    kap.innerHTML = "";
    const bugun = bugunSorular();
    const dersler = soruDersleri();
    let bugunToplam = 0;
    for (const d in bugun) bugunToplam += bugun[d];
    document.getElementById("soruOzet").textContent =
        bugunToplam > 0 ? "bugün " + bugunToplam + " · hafta " + haftaSoruToplam() : "";

    if (dersler.length === 0) {
        kap.innerHTML = "<div class='panel-bos'>Ders ekle, çözdükçe +'lara bas. \"Bugün kaç soru çözdün?\" sorusunun cevabı hep burada olsun.</div>";
        return;
    }
    for (const ders of dersler) {
        const satir = document.createElement("div");
        satir.className = "soru-satir";
        const ad = document.createElement("span");
        ad.className = "soru-ad";
        ad.textContent = ders;
        const sayi = document.createElement("b");
        sayi.className = "soru-sayi";
        sayi.textContent = bugun[ders] || 0;
        const dugmeler = document.createElement("span");
        dugmeler.className = "soru-dugmeler";
        for (const adet of [1, 5, 10]) {
            const b = document.createElement("button");
            b.textContent = "+" + adet;
            b.onclick = () => { soruEkle(ders, adet); ciz(); };
            dugmeler.appendChild(b);
        }
        const eksi = document.createElement("button");
        eksi.textContent = "−";
        eksi.title = "Yanlışlıkla bastıysan azalt";
        eksi.onclick = () => { soruEkle(ders, -1); ciz(); };
        dugmeler.appendChild(eksi);
        satir.append(ad, sayi, dugmeler);
        kap.appendChild(satir);
    }
}

document.getElementById("soruDersEkleBtn").onclick = () => {
    const giris = document.getElementById("soruDersGiris");
    soruDersEkle(giris.value);
    giris.value = "";
    ciz();
};

// ---------- 📝 Denemeler ----------
function denemeCiz() {
    const grafKap = document.getElementById("denemeGrafikKap");
    const liste = document.getElementById("denemeListe");
    grafKap.innerHTML = ""; liste.innerHTML = "";
    const denemeler = veri.denemeler;
    document.getElementById("denemeOzet").textContent =
        denemeler.length ? "son net: " + denemeler[denemeler.length - 1].net : "";

    if (denemeler.length === 0) {
        liste.innerHTML = "<div class='panel-bos'>Deneme sonuçlarını gir (D/Y/B), neti ben hesaplayayım ve gelişim grafiğini çizeyim.</div>";
    } else {
        // Grafik: son 12 denemenin net çizgisi + hedef çizgisi
        const son = denemeler.slice(-12);
        const G = 250, Y = 90, kenar = 6;
        const enYuksek = Math.max(...son.map(d => d.net), veri.hedefNet || 0, 10);
        const x = i => son.length === 1 ? G / 2 : kenar + i * (G - 2 * kenar) / (son.length - 1);
        const y = net => Y - kenar - Math.max(0, net) / enYuksek * (Y - 2 * kenar);
        let svg = "<svg viewBox='0 0 " + G + " " + Y + "' class='deneme-grafik'>";
        if (veri.hedefNet) {
            svg += "<line x1='0' y1='" + y(veri.hedefNet) + "' x2='" + G + "' y2='" + y(veri.hedefNet) +
                   "' class='hedef-cizgi'/><text x='2' y='" + (y(veri.hedefNet) - 3) + "' class='grafik-yazi'>hedef " + veri.hedefNet + "</text>";
        }
        svg += "<polyline points='" + son.map((d, i) => x(i) + "," + y(d.net)).join(" ") + "' class='net-cizgi'/>";
        for (let i = 0; i < son.length; i++) {
            svg += "<circle cx='" + x(i) + "' cy='" + y(son[i].net) + "' r='3' class='net-nokta'/>" +
                   "<text x='" + x(i) + "' y='" + (y(son[i].net) - 6) + "' text-anchor='middle' class='grafik-yazi'>" + son[i].net + "</text>";
        }
        svg += "</svg>";
        grafKap.innerHTML = svg;

        for (const d of [...denemeler].reverse().slice(0, 5)) {
            const satir = document.createElement("div");
            satir.className = "deneme-satir";
            satir.innerHTML = "<span>" + esc(d.ad) + " <small>(" + d.tur + " · " + d.tarih + ")</small></span>" +
                              "<b>" + d.net + " net</b>";
            const sil = document.createElement("button");
            sil.textContent = "✕";
            sil.onclick = () => { denemeSil(d.id); ciz(); };
            satir.appendChild(sil);
            liste.appendChild(satir);
        }
    }
    if (veri.hedefNet) document.getElementById("dHedefNet").placeholder = "Hedef net: " + veri.hedefNet;
}

document.getElementById("denemeEkleBtn").onclick = () => {
    const ad = document.getElementById("dAd").value;
    const tarih = document.getElementById("dTarih").value || tarihAnahtari(new Date());
    const dogru = document.getElementById("dDogru").value;
    if (dogru === "") { alert("En azından doğru sayısını gir."); return; }
    denemeEkle(ad, tarih, document.getElementById("dTur").value, dogru,
               document.getElementById("dYanlis").value, document.getElementById("dBos").value);
    for (const id of ["dAd", "dDogru", "dYanlis", "dBos"]) document.getElementById(id).value = "";
    bildirimGoster("✔ Deneme kaydedildi, net hesaplandı.");
    ciz();
};

document.getElementById("hedefNetBtn").onclick = () => {
    hedefNetAyarla(Number(document.getElementById("dHedefNet").value));
    document.getElementById("dHedefNet").value = "";
    ciz();
};

// ---------- 📚 Konu takibi ----------
const KONU_DURUM = ["⬜", "🔁", "✅"];

function konuCiz() {
    const kap = document.getElementById("konuListe");
    kap.innerHTML = "";
    const gruplar = {};
    for (const k of veri.konular) (gruplar[k.ders] = gruplar[k.ders] || []).push(k);

    const toplam = veri.konular.length;
    const biten = veri.konular.filter(k => k.durum === 2).length;
    document.getElementById("konuOzet").textContent = toplam ? biten + "/" + toplam + " bitti" : "";

    for (const ders in gruplar) {
        const grup = gruplar[ders];
        const dersBiten = grup.filter(k => k.durum === 2).length;
        const baslik = document.createElement("div");
        baslik.className = "konu-ders";
        baslik.innerHTML = "<span>" + esc(ders) + "</span><small>" +
            Math.round(dersBiten / grup.length * 100) + "%</small>";
        kap.appendChild(baslik);
        for (const k of grup) {
            const satir = document.createElement("div");
            satir.className = "konu-satir durum-" + k.durum;
            const durum = document.createElement("button");
            durum.className = "konu-durum";
            durum.textContent = KONU_DURUM[k.durum];
            durum.onclick = () => { konuDurumIlerle(k.id); ciz(); };
            const ad = document.createElement("span");
            ad.textContent = k.ad;
            const sil = document.createElement("button");
            sil.className = "konu-sil";
            sil.textContent = "✕";
            sil.onclick = () => { konuSil(k.id); ciz(); };
            satir.append(durum, ad, sil);
            kap.appendChild(satir);
        }
    }
}

document.getElementById("konuEkleBtn").onclick = () => {
    konuEkle(document.getElementById("konuDersGiris").value, document.getElementById("konuAdGiris").value);
    document.getElementById("konuAdGiris").value = "";
    ciz();
};

// ---------- 🏆 Gelişim: XP + ısı haritası + rekorlar ----------
function gelisimCiz() {
    const sv = seviyeBilgi();
    document.getElementById("gelisimOzet").textContent = sv.xp > 0 ? sv.xp + " XP" : "";
    document.getElementById("xpKutu").innerHTML =
        "<div class='tamamlanma-ust'><span>⭐ Seviye " + sv.seviye + "</span><b>" + sv.xp + " / " + sv.sonrakiXp + " XP</b></div>" +
        "<div class='ist-cubuk-kap'><div class='ist-cubuk xp' style='width:" + Math.round(sv.ilerleme * 100) + "%'></div></div>" +
        "<div class='panel-bos'>Blok bitir +10 · odak dakikası +2 · soru +1</div>";

    // Isı haritası: son 15 hafta (105 gün), YPT tarzı
    const gunler = isiHaritasiVerisi(105);
    const enCok = Math.max(...gunler.map(g => g.puan), 1);
    let html = "<div class='isi-izgara'>";
    for (const g of gunler) {
        const seviye = g.puan === 0 ? 0 : Math.min(4, Math.ceil(g.puan / enCok * 4));
        html += "<span class='isi-kare s" + seviye + "' title='" + g.tarih + ": " + g.puan + " puan'></span>";
    }
    html += "</div><div class='panel-bos'>Son 15 hafta — kare ne kadar koyu, o gün o kadar çalışmışsın</div>";
    document.getElementById("isiHaritasi").innerHTML = html;

    // Haftalık rekorlar
    const rekor = haftalikRekorlar();
    const kap = document.getElementById("rekorListe");
    kap.innerHTML = "";
    if (rekor.liste.length > 0 && rekor.liste[0].puan > 0) {
        const baslik = document.createElement("div");
        baslik.className = "konu-ders";
        baslik.innerHTML = "<span>🏆 En iyi haftaların</span>" +
            (rekor.sira ? "<small>bu hafta " + rekor.sira + ". sıradasın</small>" : "");
        kap.appendChild(baslik);
        rekor.liste.forEach((h, i) => {
            const satir = document.createElement("div");
            satir.className = "rekor-satir" + (h.hafta === rekor.buHafta ? " bu-hafta" : "");
            satir.innerHTML = "<span>" + ["🥇", "🥈", "🥉", "4.", "5."][i] + " " + h.hafta.replace("-W", " / ") +
                ". hafta" + (h.hafta === rekor.buHafta ? " (bu hafta)" : "") + "</span><b>" + h.puan + " puan</b>";
            kap.appendChild(satir);
        });
    }
}

// ---------- Kategori filtresi (göstergeler) ----------
function filtreCiz() {
    const kap = document.getElementById("filtreListe");
    kap.innerHTML = "";
    for (const k in KATEGORILER) {
        const kat = KATEGORILER[k];
        const dugme = document.createElement("button");
        dugme.className = "filtre-cip" + (gizliKategoriler.has(k) ? " kapali" : "");
        dugme.style.setProperty("--renk", kat.renk);
        dugme.textContent = kat.emoji + " " + kat.ad;
        dugme.title = gizliKategoriler.has(k) ? "Göster" : "Takvimde gizle";
        dugme.onclick = () => {
            if (gizliKategoriler.has(k)) gizliKategoriler.delete(k);
            else gizliKategoriler.add(k);
            ciz();
        };
        kap.appendChild(dugme);
    }
}

// ---------- İstatistik paneli ----------
function istatistikCiz() {
    const anahtar = bakilanAnahtar();
    const dagilim = kategoriDagilimi(anahtar);
    const kap = document.getElementById("istatistikKutu");
    kap.innerHTML = "";

    const toplamDak = Object.values(dagilim).reduce((a, b) => a + b, 0);
    if (toplamDak === 0) {
        kap.innerHTML = "<div class='panel-bos'>Plan ekledikçe burada saat dağılımını göreceksin.</div>";
    } else {
        const enCok = Math.max(...Object.values(dagilim));
        const sirali = Object.entries(dagilim).sort((a, b) => b[1] - a[1]);
        for (const [k, dk] of sirali) {
            const kat = KATEGORILER[k] || KATEGORILER.genel;
            const satir = document.createElement("div");
            satir.className = "ist-satir";
            satir.innerHTML =
                "<span class='ist-ad'>" + kat.emoji + " " + kat.ad + "</span>" +
                "<div class='ist-cubuk-kap'><div class='ist-cubuk' style='width:" +
                Math.round(dk / enCok * 100) + "%; background:" + kat.renk + "'></div></div>" +
                "<span class='ist-deger'>" + sureMetni(dk) + "</span>";
            kap.appendChild(satir);
        }
    }

    // Geçen haftayla karşılaştırma
    const oncekiTarih = bakilanTarih();
    oncekiTarih.setDate(oncekiTarih.getDate() - 7);
    const onceki = haftaOzeti(haftaAnahtari(oncekiTarih));
    const kiyas = document.createElement("div");
    kiyas.className = "ist-kiyas";
    if (onceki.dakikaToplam === 0 && toplamDak === 0) {
        kiyas.textContent = "";
    } else {
        const fark = toplamDak - onceki.dakikaToplam;
        if (fark === 0) kiyas.textContent = "Geçen haftayla aynı yoğunlukta.";
        else if (fark > 0) kiyas.innerHTML = "Geçen haftadan <b class='arti'>" + sureMetni(fark) + " fazla</b> plan var.";
        else kiyas.innerHTML = "Geçen haftadan <b class='eksi'>" + sureMetni(-fark) + " az</b> plan var.";
    }
    kap.appendChild(kiyas);

    // Tamamlanma çubuğu
    const o = haftaOzeti(anahtar);
    if (o.toplam > 0) {
        const yuzde = Math.round(o.biten / o.toplam * 100);
        const t = document.createElement("div");
        t.className = "tamamlanma";
        t.innerHTML =
            "<div class='tamamlanma-ust'><span>Haftalık ilerleme</span><b>%" + yuzde + "</b></div>" +
            "<div class='ist-cubuk-kap'><div class='ist-cubuk yesil' style='width:" + yuzde + "%'></div></div>";
        kap.appendChild(t);
    }
}

// ---------- Hedefler (sınav geri sayımı) ----------
function hedeflerCiz() {
    const kap = document.getElementById("hedefListe");
    kap.innerHTML = "";
    if (veri.hedefler.length === 0) {
        kap.innerHTML = "<div class='panel-bos'>Sınav ya da teslim tarihi ekle, geri sayım burada dursun.</div>";
    }
    for (const h of veri.hedefler) {
        const kalan = hedefKalanGun(h.tarih);
        const satir = document.createElement("div");
        satir.className = "hedef";
        let rozet, sinif;
        if (kalan < 0)      { rozet = "geçti";            sinif = "gecti"; }
        else if (kalan === 0){ rozet = "BUGÜN!";          sinif = "acil"; }
        else if (kalan <= 3) { rozet = kalan + " gün";    sinif = "acil"; }
        else if (kalan <= 7) { rozet = kalan + " gün";    sinif = "yakin"; }
        else                 { rozet = kalan + " gün";    sinif = "uzak"; }
        const t = new Date(h.tarih + "T00:00:00");
        satir.innerHTML =
            "<span class='hedef-rozet " + sinif + "'>" + rozet + "</span>" +
            "<span class='hedef-ad'>" + esc(h.ad) +
            "<small>" + t.getDate() + " " + AY_ADLARI[t.getMonth()] + " " + GUN_KISA[(t.getDay() + 6) % 7] + "</small></span>";
        const sil = document.createElement("button");
        sil.className = "hedef-sil";
        sil.textContent = "✕";
        sil.onclick = () => { hedefSil(h.id); ciz(); };
        satir.appendChild(sil);
        kap.appendChild(satir);
    }
}

document.getElementById("hedefEkleBtn").onclick = () => {
    const ad = document.getElementById("hedefAd");
    const tarih = document.getElementById("hedefTarih");
    if (!ad.value.trim() || !tarih.value) { alert("Hedef adı ve tarihi gerekli."); return; }
    hedefEkle(ad.value, tarih.value);
    ad.value = ""; tarih.value = "";
    ciz();
};

// ---------- Boş vakitte listesi ----------
function esnekCiz() {
    const anahtar = bakilanAnahtar();
    const kap = document.getElementById("esnekListe");
    kap.innerHTML = "";
    const liste = gunBloklari(anahtar, -1);
    if (liste.length === 0) {
        kap.innerHTML = "<div class='panel-bos'>Belirli saati olmayan işleri buraya yaz.</div>";
    }
    for (const b of liste) {
        const cip = document.createElement("div");
        cip.className = "cip" + (b.tamam ? " tamam" : "");
        const kutu = document.createElement("input");
        kutu.type = "checkbox";
        kutu.checked = b.tamam;
        kutu.onchange = () => { blokIsaretle(anahtar, b.id); ciz(); };
        const yazi = document.createElement("span");
        yazi.className = "cip-yazi";
        yazi.textContent = KATEGORILER[b.kategori].emoji + " " + b.metin + (b.tekrarli ? " 🔁" : "");
        const sil = document.createElement("button");
        sil.textContent = "✕";
        sil.title = "Sil";
        sil.onclick = () => {
            if (!b.tekrarli || confirm("Bu her hafta tekrar ediyor. Tamamen silinsin mi?")) {
                blokSil(anahtar, b.id); ciz();
            }
        };
        cip.append(kutu, yazi, sil);
        kap.appendChild(cip);
    }
}

document.getElementById("esnekEkleBtn").onclick = esnekEkle;
document.getElementById("esnekGiris").onkeydown = e => { if (e.key === "Enter") esnekEkle(); };
function esnekEkle() {
    const giris = document.getElementById("esnekGiris");
    blokEkle(bakilanAnahtar(), { gun: -1, metin: giris.value, kategori: "genel" }, false);
    giris.value = "";
    ciz();
}

// ---------- Çakışan blokları yan yana dizme ----------
function yerlesimHesapla(bloklar) {
    const sonuc = {};
    let aktif = [], kume = [], kumeSutun = 0;
    const kumeKapat = () => {
        for (const k of kume) sonuc[k.id].toplam = kumeSutun;
        kume = []; kumeSutun = 0;
    };
    for (const b of bloklar) {
        const bas = dakika(b.bas), bit = dakika(b.bit) ?? bas + 30;
        aktif = aktif.filter(a => a.bitDak > bas);
        if (aktif.length === 0) kumeKapat();
        const dolu = aktif.map(a => sonuc[a.id].sutun);
        let sutun = 0;
        while (dolu.includes(sutun)) sutun++;
        sonuc[b.id] = { sutun };
        aktif.push({ id: b.id, bitDak: bit });
        kume.push(b);
        kumeSutun = Math.max(kumeSutun, sutun + 1);
    }
    kumeKapat();
    return sonuc;
}

// ---------- Takvim ----------
function takvimCiz() {
    const anahtar = bakilanAnahtar();
    const pzt = haftaBaslangici(bakilanTarih());
    const bugunMetni = new Date().toDateString();
    const kutu = document.getElementById("takvimKutu");
    const eskiKaydirma = ilkCizim ? null : kutu.scrollTop;

    const ic = document.getElementById("takvimIc");
    ic.innerHTML = "";

    const kose = document.createElement("div");
    kose.className = "kose";
    ic.appendChild(kose);

    for (let gun = 0; gun < 7; gun++) {
        const t = new Date(pzt);
        t.setDate(t.getDate() + gun);
        const b = document.createElement("div");
        b.className = "gun-baslik-hucre" + (t.toDateString() === bugunMetni ? " bugun" : "");
        b.innerHTML = "<b>" + GUN_KISA[gun] + "</b><span>" + t.getDate() + " " + AY_ADLARI[t.getMonth()].slice(0, 3) + "</span>";
        ic.appendChild(b);
    }

    const saatSutun = document.createElement("div");
    saatSutun.className = "saat-sutunu";
    saatSutun.style.height = (24 * SAAT_YUKSEKLIK) + "px";
    for (let s = 0; s < 24; s++) {
        const e = document.createElement("div");
        e.className = "saat-etiket";
        e.style.top = (s * SAAT_YUKSEKLIK) + "px";
        e.textContent = String(s).padStart(2, "0") + ":00";
        saatSutun.appendChild(e);
    }
    ic.appendChild(saatSutun);

    for (let gun = 0; gun < 7; gun++) {
        const t = new Date(pzt);
        t.setDate(t.getDate() + gun);
        const sutun = document.createElement("div");
        sutun.className = "gun-sutunu" + (t.toDateString() === bugunMetni ? " bugun" : "");
        sutun.dataset.gun = gun;
        sutun.style.height = (24 * SAAT_YUKSEKLIK) + "px";

        sutun.onclick = (e) => {
            if (e.target !== sutun) return;
            const y = e.offsetY;
            const yarimSaat = Math.floor(y / (SAAT_YUKSEKLIK / 2));
            const basDak = yarimSaat * 30;
            pencereAc(null, gun, dakToSaat(basDak), dakToSaat(Math.min(basDak + 60, 1439)));
        };

        const bloklar = gunBloklari(anahtar, gun)
            .filter(b => b.bas)
            .filter(b => !gizliKategoriler.has(b.kategori));
        const yerlesim = yerlesimHesapla(bloklar);

        for (const b of bloklar) {
            sutun.appendChild(blokElemaniYap(b, yerlesim[b.id], anahtar));
        }

        if (haftaKaydirma === 0 && t.toDateString() === bugunMetni) {
            const simdi = new Date();
            const cizgi = document.createElement("div");
            cizgi.className = "simdi-cizgi";
            cizgi.style.top = ((simdi.getHours() * 60 + simdi.getMinutes()) / 60 * SAAT_YUKSEKLIK) + "px";
            sutun.appendChild(cizgi);
        }

        ic.appendChild(sutun);
    }

    kutu.scrollTop = eskiKaydirma !== null ? eskiKaydirma : 7 * SAAT_YUKSEKLIK - 6;
    ilkCizim = false;
}

function blokElemaniYap(b, yer, anahtar) {
    const basDak = dakika(b.bas);
    const bitDak = Math.max(dakika(b.bit) ?? basDak + 30, basDak + 15);
    const kat = KATEGORILER[b.kategori] || KATEGORILER.genel;

    const el = document.createElement("div");
    el.className = "blok" + (b.tamam ? " tamam" : "");
    el.dataset.id = b.id;
    el.style.top = (basDak / 60 * SAAT_YUKSEKLIK) + "px";
    el.style.height = ((bitDak - basDak) / 60 * SAAT_YUKSEKLIK - 2) + "px";
    el.style.width = "calc(" + (100 / yer.toplam) + "% - 4px)";
    el.style.left = (100 / yer.toplam * yer.sutun) + "%";
    el.style.setProperty("--renk", kat.renk);
    if (b.not) el.title = "📄 " + b.not;

    const kisa = (bitDak - basDak) < 45;
    el.innerHTML =
        (kisa ? "" : "<span class='blok-saat'>" + b.bas + "–" + b.bit +
            (b.tekrarli ? " 🔁" : "") + (b.not ? " 📄" : "") + "</span>") +
        "<span class='blok-ad'>" + kat.emoji + " " + esc(b.metin) +
            (kisa ? (b.tekrarli ? " 🔁" : "") + (b.not ? " 📄" : "") : "") + "</span>";

    const kutucuk = document.createElement("input");
    kutucuk.type = "checkbox";
    kutucuk.checked = b.tamam;
    kutucuk.title = "Tamamlandı";
    kutucuk.onclick = (e) => e.stopPropagation();
    kutucuk.onchange = () => { blokIsaretle(anahtar, b.id); ciz(); };
    el.prepend(kutucuk);

    // Alt kenar: uzatma tutamacı
    const tutamac = document.createElement("div");
    tutamac.className = "uzat-tutamac";
    el.appendChild(tutamac);

    // Sürükleme (taşı) + uzatma + tıklama ayrımı
    el.addEventListener("mousedown", (e) => {
        if (e.button !== 0 || e.target === kutucuk) return;
        surukleBaslat(e, b, el, e.target === tutamac ? "uzat" : "tasi");
    });

    return el;
}

// ---------- Sürükle: taşı / uzat ----------
// Bloğa basılı tutup çekince 15 dakikalık adımlarla taşınır;
// alt kenardan çekince süresi uzar/kısalır. Az oynadıysa tıklama sayılır (pencere açılır).
let surukleme = null;

function surukleBaslat(e, blok, el, tur) {
    const anahtar = bakilanAnahtar();
    const tam = blokBul(anahtar, blok.id);
    surukleme = {
        tur, el,
        id: blok.id,
        baslangicY: e.clientY,
        baslangicX: e.clientX,
        basDak: dakika(tam.bas),
        bitDak: dakika(tam.bit),
        gun: tam.gun,
        yeniGun: tam.gun,
        yeniBas: dakika(tam.bas),
        yeniBit: dakika(tam.bit),
        tasindi: false,
        bilgi: tam
    };
    e.preventDefault();
}

document.addEventListener("mousemove", (e) => {
    if (!surukleme) return;
    const s = surukleme;
    const dy = e.clientY - s.baslangicY;
    const dx = e.clientX - s.baslangicX;
    if (!s.tasindi && Math.abs(dy) < 5 && Math.abs(dx) < 5) return;
    s.tasindi = true;
    s.el.classList.add("suruklenen");

    const dakFark = Math.round(dy / SAAT_YUKSEKLIK * 60 / 15) * 15; // 15 dk'lık adımlar
    const sure = s.bitDak - s.basDak;

    if (s.tur === "tasi") {
        // Hangi günün üstündeyiz?
        const sutunlar = document.querySelectorAll(".gun-sutunu");
        for (const sutun of sutunlar) {
            const r = sutun.getBoundingClientRect();
            if (e.clientX >= r.left && e.clientX < r.right) {
                s.yeniGun = Number(sutun.dataset.gun);
                if (sutun !== s.el.parentElement) sutun.appendChild(s.el);
                break;
            }
        }
        s.yeniBas = Math.max(0, Math.min(1440 - sure, s.basDak + dakFark));
        s.yeniBit = s.yeniBas + sure;
        s.el.style.top = (s.yeniBas / 60 * SAAT_YUKSEKLIK) + "px";
    } else { // uzat
        s.yeniBit = Math.max(s.basDak + 15, Math.min(1440, s.bitDak + dakFark));
        s.el.style.height = ((s.yeniBit - s.basDak) / 60 * SAAT_YUKSEKLIK - 2) + "px";
    }
});

document.addEventListener("mouseup", () => {
    if (!surukleme) return;
    const s = surukleme;
    surukleme = null;
    s.el.classList.remove("suruklenen");

    if (!s.tasindi) {           // Yerinden oynamadı: bu bir tıklamaydı
        pencereAc(s.id);
        return;
    }
    const bilgi = {
        gun: s.yeniGun,
        bas: dakToSaat(s.yeniBas),
        bit: dakToSaat(s.tur === "uzat" ? s.yeniBit : s.yeniBas + (s.bitDak - s.basDak)),
        metin: s.bilgi.metin,
        kategori: s.bilgi.kategori,
        not: s.bilgi.not || ""
    };
    if (s.tur === "uzat") { bilgi.gun = s.gun; bilgi.bas = dakToSaat(s.basDak); }
    blokGuncelle(bakilanAnahtar(), s.id, bilgi, s.bilgi.tekrarli);
    ciz();
});

// ---------- Blok penceresi (ekle / düzenle) ----------
const kaplama = document.getElementById("kaplama");

function pencereAc(id, gun, bas, bit) {
    duzenlenenId = id;
    const b = id ? blokBul(bakilanAnahtar(), id) : null;
    document.getElementById("pencereBaslik").textContent = b ? "Bloğu Düzenle" : "Yeni Blok";
    document.getElementById("mBaslik").value = b ? b.metin : "";
    document.getElementById("mGun").value = b ? b.gun : gun;
    document.getElementById("mBas").value = b ? b.bas : bas;
    document.getElementById("mBit").value = b ? (b.bit || "") : bit;
    document.getElementById("mKategori").value = b ? b.kategori : "ders";
    document.getElementById("mNot").value = b ? (b.not || "") : "";
    document.getElementById("mTekrar").checked = b ? b.tekrarli : true;
    document.getElementById("mSil").style.display = b ? "" : "none";
    document.getElementById("mKopyala").style.display = b ? "" : "none";
    kaplama.classList.remove("gizli");
    document.getElementById("mBaslik").focus();
}

function pencereKapat() { kaplama.classList.add("gizli"); }

function pencereBilgisi() {
    return {
        gun: Number(document.getElementById("mGun").value),
        bas: document.getElementById("mBas").value,
        bit: document.getElementById("mBit").value,
        metin: document.getElementById("mBaslik").value,
        kategori: document.getElementById("mKategori").value,
        not: document.getElementById("mNot").value.trim()
    };
}

function pencereGecerliMi(bilgi) {
    if (!bilgi.metin.trim()) { alert("Bir başlık yaz 🙂"); return false; }
    if (!bilgi.bas || !bilgi.bit) { alert("Başlangıç ve bitiş saatini seç."); return false; }
    if (dakika(bilgi.bit) <= dakika(bilgi.bas)) { alert("Bitiş, başlangıçtan sonra olmalı."); return false; }
    return true;
}

document.getElementById("mIptal").onclick = pencereKapat;
kaplama.onclick = (e) => { if (e.target === kaplama) pencereKapat(); };
document.addEventListener("keydown", (e) => { if (e.key === "Escape") pencereKapat(); });

document.getElementById("mKaydet").onclick = () => {
    const bilgi = pencereBilgisi();
    if (!pencereGecerliMi(bilgi)) return;
    const herHafta = document.getElementById("mTekrar").checked;
    if (duzenlenenId) blokGuncelle(bakilanAnahtar(), duzenlenenId, bilgi, herHafta);
    else blokEkle(bakilanAnahtar(), bilgi, herHafta);
    pencereKapat();
    ciz();
};

document.getElementById("mKopyala").onclick = () => {
    const bilgi = pencereBilgisi();
    if (!pencereGecerliMi(bilgi)) return;
    blokEkle(bakilanAnahtar(), bilgi, document.getElementById("mTekrar").checked);
    pencereKapat();
    ciz();
};

document.getElementById("mSil").onclick = () => {
    const b = blokBul(bakilanAnahtar(), duzenlenenId);
    if (b && b.tekrarli && !confirm("Bu blok her hafta tekrar ediyor. Tamamen silinsin mi?")) return;
    blokSil(bakilanAnahtar(), duzenlenenId);
    pencereKapat();
    ciz();
};

// ---------- ☀️ Günlük karşılama ----------
const checkinKaplama = document.getElementById("checkinKaplama");

function checkinAc() {
    const saat = new Date().getHours();
    document.getElementById("checkinBaslik").textContent =
        saat < 12 ? "☀️ Günaydın!" : saat < 18 ? "👋 İyi günler!" : "🌙 İyi akşamlar!";
    const bugunGun = (new Date().getDay() + 6) % 7;
    const simdi = new Date();
    document.getElementById("checkinDurum").textContent =
        gunlukBrifing(haftaAnahtari(simdi), bugunGun, simdi.getHours() * 60 + simdi.getMinutes());
    checkinKaplama.classList.remove("gizli");
    document.getElementById("checkinGorevler").focus();
}

for (const cip of document.querySelectorAll(".enerji")) {
    cip.onclick = () => {
        document.querySelectorAll(".enerji").forEach(c => c.classList.remove("secili"));
        cip.classList.add("secili");
    };
}

document.getElementById("checkinBtn").onclick = checkinAc;
document.getElementById("checkinGec").onclick = () => {
    checkinKaydet();
    checkinKaplama.classList.add("gizli");
};
checkinKaplama.onclick = (e) => { if (e.target === checkinKaplama) checkinKaplama.classList.add("gizli"); };

document.getElementById("checkinPlanla").onclick = () => {
    const satirlar = document.getElementById("checkinGorevler").value
        .split("\n").map(s => s.trim()).filter(Boolean);
    const enerji = document.querySelector(".enerji.secili")?.dataset.enerji || "normal";
    const simdi = new Date();
    const sonuc = gunlukPlanla(satirlar, enerji, (simdi.getDay() + 6) % 7,
                               simdi.getHours() * 60 + simdi.getMinutes());
    document.getElementById("checkinGorevler").value = "";
    checkinKaplama.classList.add("gizli");
    const parcalar = [];
    if (sonuc.dogrudan) parcalar.push(sonuc.dogrudan + " blok yazdığın saate");
    if (sonuc.yerlesen) parcalar.push(sonuc.yerlesen + " iş boş saatlerine");
    if (sonuc.listeye) parcalar.push(sonuc.listeye + " iş Boş Vakitte listesine");
    bildirimGoster(parcalar.length ? "🪄 Hazır: " + parcalar.join(", ") + " kondu."
                                   : "Bugün için bir şey eklemedin, iyi dinlenmeler 🙂");
    ciz();
};

// ---------- 🎯 Odak modu (Pomodoro) ----------
// 25 dk odak + 5 dk mola döngüsü. Biten her odak turu güne "odak dakikası" yazar,
// bu da 🔥 seriyi besler (Forest/TickTick'teki gibi).
const ODAK_SN = 25 * 60, MOLA_SN = 5 * 60;
const odakKaplama = document.getElementById("odakKaplama");
let odak = null; // {faz, kalan, calisiyor, sayac, tur}

function odakAc(blokAdi) {
    odak = { faz: "odak", kalan: ODAK_SN, calisiyor: false, sayac: null, tur: 1, dagilma: 0 };
    document.getElementById("odakBaslik").textContent = "🎯 " + blokAdi;
    odakGoster();
    odakKaplama.classList.remove("gizli");
}

function odakGoster() {
    const dk = Math.floor(odak.kalan / 60), sn = odak.kalan % 60;
    document.getElementById("odakSayac").textContent =
        String(dk).padStart(2, "0") + ":" + String(sn).padStart(2, "0");
    document.getElementById("odakFaz").textContent =
        odak.faz === "odak" ? "Odaklanma — telefonu bırak! 📵" : "Mola — esne, su iç ☕";
    document.getElementById("odakTur").textContent = odak.tur + ". tur";
    document.getElementById("odakBaslat").textContent = odak.calisiyor ? "⏸ Duraklat" : "▶ Başlat";
    document.querySelector(".odak-pencere").classList.toggle("molada", odak.faz === "mola");
}

document.getElementById("odakBaslat").onclick = () => {
    odak.calisiyor = !odak.calisiyor;
    clearInterval(odak.sayac);
    if (odak.calisiyor) {
        odak.sayac = setInterval(() => {
            odak.kalan--;
            if (odak.kalan <= 0) {
                if (odak.faz === "odak") {
                    odakEkle(25); // tam pomodoro tamamlandı
                    const skor = Math.max(0, 100 - odak.dagilma * 10);
                    odakSkorKaydet(skor);
                    bildirimGoster("🎉 25 dk odak tamamlandı! Odak skorun: " + skor + "/100. Şimdi 5 dk mola.");
                    odak.dagilma = 0;
                    odak.faz = "mola"; odak.kalan = MOLA_SN;
                } else {
                    odak.faz = "odak"; odak.kalan = ODAK_SN; odak.tur++;
                    bildirimGoster("💪 Mola bitti, " + odak.tur + ". tura başlıyoruz!");
                }
                ciz();
            }
            odakGoster();
        }, 1000);
    }
    odakGoster();
};

document.getElementById("odakBitir").onclick = () => {
    clearInterval(odak.sayac);
    if (odak.faz === "odak") {
        const gecenDk = Math.floor((ODAK_SN - odak.kalan) / 60);
        if (gecenDk >= 1) {
            odakEkle(gecenDk);
            const skor = Math.max(0, 100 - odak.dagilma * 10);
            odakSkorKaydet(skor);
            bildirimGoster("✔ " + gecenDk + " dk odak kaydedildi. Skor: " + skor + "/100");
        }
    }
    odak = null;
    odakKaplama.classList.add("gizli");
    ciz();
};

// Odak sırasında sekme değiştirmek / pencereden çıkmak dikkat dağınıklığı sayılır
document.addEventListener("visibilitychange", () => {
    if (document.hidden && odak && odak.calisiyor && odak.faz === "odak") {
        odak.dagilma++;
    }
});

document.getElementById("mOdak").onclick = () => {
    const b = blokBul(bakilanAnahtar(), duzenlenenId);
    pencereKapat();
    odakAc(b ? b.metin : "Odak");
};

// ---------- 🔔 Blok hatırlatmaları ----------
// Uygulama açıkken blok başlamadan 5 dk önce ve başlarken bildirim gösterir.
const bildirilenler = new Set();

function bildirimDugmesiGuncelle() {
    const dugme = document.getElementById("bildirimBtn");
    if (!("Notification" in window)) { dugme.style.display = "none"; return; }
    const kapali = localStorage.getItem("bildirimKapali") === "1";
    const acik = Notification.permission === "granted" && !kapali;
    dugme.textContent = acik ? "🔔" : "🔕";
    dugme.title = acik ? "Hatırlatmalar açık (kapatmak için tıkla)"
                       : "Hatırlatmaları aç: blok başlamadan haber veririm";
}

document.getElementById("bildirimBtn").onclick = async () => {
    if (Notification.permission !== "granted") {
        const izin = await Notification.requestPermission();
        if (izin === "granted") {
            localStorage.removeItem("bildirimKapali");
            bildirimGoster("🔔 Hatırlatmalar açık! Blok başlamadan 5 dk önce haber veririm.");
        }
    } else {
        const kapali = localStorage.getItem("bildirimKapali") === "1";
        if (kapali) localStorage.removeItem("bildirimKapali");
        else localStorage.setItem("bildirimKapali", "1");
    }
    bildirimDugmesiGuncelle();
};

setInterval(() => {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    if (localStorage.getItem("bildirimKapali") === "1") return;
    const simdi = new Date();
    const dk = simdi.getHours() * 60 + simdi.getMinutes();
    const bugunGun = (simdi.getDay() + 6) % 7;
    for (const b of gunBloklari(haftaAnahtari(simdi), bugunGun)) {
        if (!b.bas || b.tamam) continue;
        for (const [fark, ek] of [[5, " 5 dakika sonra başlıyor"], [0, " şimdi başlıyor!"]]) {
            if (dakika(b.bas) - dk === fark) {
                const kimlik = b.id + "-" + fark + "-" + simdi.toDateString();
                if (!bildirilenler.has(kimlik)) {
                    bildirilenler.add(kimlik);
                    new Notification("📅 " + b.metin, { body: b.bas + "–" + b.bit + ek, icon: "ikon-192.png" });
                }
            }
        }
    }
}, 30000);

// ---------- Yedekleme ----------
document.getElementById("yedekAlBtn").onclick = () => {
    const a = document.createElement("a");
    a.href = "data:application/json;charset=utf-8," + encodeURIComponent(disaAktar());
    const t = new Date();
    a.download = "planlayici-yedek-" + t.getFullYear() + "-" +
        String(t.getMonth() + 1).padStart(2, "0") + "-" + String(t.getDate()).padStart(2, "0") + ".json";
    a.click();
};

document.getElementById("icsBtn").onclick = () => {
    const a = document.createElement("a");
    a.href = "data:text/calendar;charset=utf-8," + encodeURIComponent(icsUret());
    a.download = "haftalik-plan.ics";
    a.click();
    bildirimGoster("📅 İndirilen dosyayı Google Takvim'e ya da telefonun takvimine içe aktarabilirsin.");
};

document.getElementById("yedekYukleGiris").onchange = (e) => {
    const dosya = e.target.files[0];
    if (!dosya) return;
    if (!confirm("Yedek yüklenince ŞU ANKİ TÜM VERİ yedektekiyle değişir. Devam edilsin mi?")) {
        e.target.value = "";
        return;
    }
    const okuyucu = new FileReader();
    okuyucu.onload = () => {
        if (iceAktar(okuyucu.result)) { ciz(); alert("Yedek yüklendi ✔"); }
        else alert("Bu dosya geçerli bir yedek değil.");
        e.target.value = "";
    };
    okuyucu.readAsText(dosya);
};

// ---------- 🤖 Asistan ----------
const gizlenenOneriler = new Set(); // bu oturumda "✕" denilen öneriler

function asistanCiz() {
    const anahtar = bakilanAnahtar();
    const bugunGun = haftaKaydirma === 0 ? (new Date().getDay() + 6) % 7 : 0;
    const kap = document.getElementById("asistanListe");
    kap.innerHTML = "";

    // Günlük brifing (sadece bu haftaya bakarken)
    if (haftaKaydirma === 0) {
        const simdi = new Date();
        const brifing = document.createElement("div");
        brifing.className = "brifing";
        brifing.textContent = gunlukBrifing(anahtar, bugunGun, simdi.getHours() * 60 + simdi.getMinutes());
        kap.appendChild(brifing);
    }

    // 💬 Günün sözü
    const soz = document.createElement("div");
    soz.className = "soz";
    soz.textContent = "💬 " + gununSozu();
    kap.appendChild(soz);

    const oneriler = oneriUret(anahtar, bugunGun).filter(o => !gizlenenOneriler.has(o.id));
    if (oneriler.length === 0) {
        const bos = document.createElement("div");
        bos.className = "panel-bos";
        bos.textContent = "Şu an önerim yok — program iyi görünüyor 👍";
        kap.appendChild(bos);
        return;
    }
    for (const o of oneriler) {
        const kart = document.createElement("div");
        kart.className = "oneri";
        kart.innerHTML = "<div class='oneri-baslik'>" + esc(o.baslik) + "</div>" +
                         "<div class='oneri-aciklama'>" + esc(o.aciklama) + "</div>";
        const satir = document.createElement("div");
        satir.className = "oneri-dugmeler";
        const uygula = document.createElement("button");
        uygula.className = "birincil";
        uygula.textContent = "Uygula";
        uygula.onclick = () => {
            for (const b of o.bloklar) blokEkle(anahtar, b, o.herHafta);
            for (const id of (o.silinecekler || [])) blokSil(anahtar, id); // listeden takvime taşınanlar
            gizlenenOneriler.add(o.id);
            bildirimGoster("✔ " + o.bloklar.length + " blok eklendi");
            ciz();
        };
        const gec = document.createElement("button");
        gec.className = "ikincil";
        gec.textContent = "Geç";
        gec.onclick = () => { gizlenenOneriler.add(o.id); asistanCiz(); };
        satir.append(uygula, gec);
        kart.appendChild(satir);
        kap.appendChild(kart);
    }
}

// ---------- 💬 Sohbet asistanı ----------
function sohbetMesajCiz(metin, kimden) {
    const kutu = document.getElementById("sohbetKutu");
    const balon = document.createElement("div");
    balon.className = "sohbet-balon " + kimden;
    balon.textContent = metin;
    kutu.appendChild(balon);
    kutu.scrollTop = kutu.scrollHeight;
}

function sohbetGonder() {
    const giris = document.getElementById("sohbetGiris");
    const mesaj = giris.value.trim();
    if (!mesaj) return;
    giris.value = "";
    sohbetMesajCiz(mesaj, "ben");
    const cevap = sohbetCevabi(mesaj);
    sohbetMesajCiz(cevap, "bot");
    ciz(); // asistan bir şey eklediyse takvim güncellensin (sohbet kutusu ayrı, silinmez)
}

document.getElementById("sohbetGonder").onclick = sohbetGonder;
document.getElementById("sohbetGiris").addEventListener("keydown", (e) => {
    if (e.key === "Enter") sohbetGonder();
});

// ---------- ✍️ Yazım önerileri ----------
function yaziOnerileriniDoldur() {
    // Hızlı ekleme çubuğunun açılır önerileri
    const datalist = document.getElementById("hizliOneriler");
    datalist.innerHTML = "";
    for (const oneri of yaziOnerileri()) {
        const secenek = document.createElement("option");
        secenek.value = oneri;
        datalist.appendChild(secenek);
    }
    // Günlük karşılamadaki tık-ekle çipleri
    const cipKap = document.getElementById("ckCipler");
    cipKap.innerHTML = "";
    for (const oneri of yaziOnerileri().slice(0, 8)) {
        const cip = document.createElement("button");
        cip.type = "button";
        cip.className = "yazi-cip";
        cip.textContent = "+ " + oneri;
        cip.onclick = () => {
            const kutu = document.getElementById("checkinGorevler");
            kutu.value = (kutu.value ? kutu.value.replace(/\n?$/, "\n") : "") + oneri;
            kutu.focus();
        };
        cipKap.appendChild(cip);
    }
}

// ---------- 🪄 Sihirbaz ----------
const sihirbazKaplama = document.getElementById("sihirbazKaplama");

// Spor günü seçim çipleri
(() => {
    const kap = document.getElementById("sSporGunleri");
    GUN_KISA.forEach((ad, i) => {
        const cip = document.createElement("button");
        cip.type = "button";
        cip.className = "gun-cip" + (i === 5 ? " secili" : ""); // varsayılan Cumartesi
        cip.textContent = ad;
        cip.dataset.gun = i;
        cip.onclick = () => cip.classList.toggle("secili");
        kap.appendChild(cip);
    });
})();

document.getElementById("sihirbazBtn").onclick = () => sihirbazKaplama.classList.remove("gizli");
document.getElementById("sIptal").onclick = () => sihirbazKaplama.classList.add("gizli");
sihirbazKaplama.onclick = (e) => { if (e.target === sihirbazKaplama) sihirbazKaplama.classList.add("gizli"); };

// Hazır şablon düğmeleri
for (const dugme of document.querySelectorAll(".sablon")) {
    dugme.onclick = () => {
        const adlar = { okul: "Okul haftası", sinav: "Sınav haftası", tatil: "Tatil haftası" };
        if (veri.tekrarlayan.length > 0 &&
            !confirm("Zaten 🔁 tekrarlayan bir programın var. Silinip yerine \"" +
                     adlar[dugme.dataset.tur] + "\" kurulsun mu?")) {
            return;
        }
        tekrarlayanTemizle();
        sablonYukle(dugme.dataset.tur);
        sihirbazKaplama.classList.add("gizli");
        bildirimGoster("✔ " + adlar[dugme.dataset.tur] + " planı kuruldu — istediğin gibi düzenle!");
        ciz();
    };
}

document.getElementById("sOkulVar").onchange = (e) => {
    document.getElementById("sOkulSaatleri").style.display = e.target.checked ? "" : "none";
};

document.getElementById("sOlustur").onclick = () => {
    if (veri.tekrarlayan.length > 0 &&
        !confirm("Zaten 🔁 tekrarlayan bir programın var. Silinip yerine yenisi kurulsun mu?")) {
        return;
    }
    tekrarlayanTemizle();
    const cevaplar = {
        uyan: document.getElementById("sUyan").value,
        yat: document.getElementById("sYat").value,
        okulVar: document.getElementById("sOkulVar").checked,
        okulBas: document.getElementById("sOkulBas").value,
        okulBit: document.getElementById("sOkulBit").value,
        zayifDersler: document.getElementById("sDersler").value
            .split(",").map(s => s.trim()).filter(Boolean),
        gunlukCalisma: Number(document.getElementById("sCalisma").value),
        sporGunleri: [...document.querySelectorAll("#sSporGunleri .gun-cip.secili")]
            .map(c => Number(c.dataset.gun))
    };
    sihirbazPlanUret(cevaplar);
    sihirbazKaplama.classList.add("gizli");
    bildirimGoster("🪄 Haftalık programın kuruldu! Blokları sürükleyerek istediğin gibi ayarla.");
    ciz();
};

// ---------- Hızlı ekleme çubuğu ----------
function bildirimGoster(mesaj) {
    let kutu = document.getElementById("bildirim");
    if (!kutu) {
        kutu = document.createElement("div");
        kutu.id = "bildirim";
        document.body.appendChild(kutu);
    }
    kutu.textContent = mesaj;
    kutu.classList.add("acik");
    clearTimeout(kutu._zaman);
    kutu._zaman = setTimeout(() => kutu.classList.remove("acik"), 2600);
}

function hizliEkle() {
    const giris = document.getElementById("hizliGiris");
    const bugunGun = (new Date().getDay() + 6) % 7;
    const sonuc = hizliAyristir(giris.value, bugunGun);
    if (!sonuc) {
        bildirimGoster("Anlayamadım 🤔 Örnek: salı 16-17 matematik");
        return;
    }
    blokEkle(bakilanAnahtar(), sonuc, sonuc.herHafta);
    giris.value = "";
    ciz();
    const kat = KATEGORILER[sonuc.kategori];
    if (sonuc.gun === -1) {
        bildirimGoster("✔ Boş vakitte listesine eklendi: " + kat.emoji + " " + sonuc.metin);
    } else {
        bildirimGoster("✔ " + GUN_ADLARI[sonuc.gun] + " " + sonuc.bas + "–" + sonuc.bit +
                       " → " + kat.emoji + " " + sonuc.metin + (sonuc.herHafta ? " (her hafta 🔁)" : ""));
    }
}

document.getElementById("hizliEkleBtn").onclick = hizliEkle;
document.getElementById("hizliGiris").addEventListener("keydown", (e) => {
    if (e.key === "Enter") hizliEkle();
});

// ---------- Üst düğmeler ----------
document.getElementById("oncekiHafta").onclick = () => { haftaKaydirma--; ciz(); };
document.getElementById("sonrakiHafta").onclick = () => { haftaKaydirma++; ciz(); };
document.getElementById("buHafta").onclick = () => { haftaKaydirma = 0; ciz(); };
document.getElementById("yeniBlokBtn").onclick = () => pencereAc(null, (new Date().getDay() + 6) % 7, "16:00", "17:00");
document.getElementById("ornekBtn").onclick = () => {
    if (confirm("Örnek bir lise haftalık programı yüklensin mi? (Sonra istediğin gibi değiştirirsin)")) {
        ornekProgramYukle();
        ciz();
    }
};

// ---------- Ana çizim ----------
function ciz() {
    ustBariCiz();
    filtreCiz();
    asistanCiz();
    istatistikCiz();
    soruCiz();
    denemeCiz();
    konuCiz();
    gelisimCiz();
    hedeflerCiz();
    esnekCiz();
    yaziOnerileriniDoldur();
    takvimCiz();
}

// Şimdi çizgisi her dakika yerini güncellesin
setInterval(() => {
    const cizgi = document.querySelector(".simdi-cizgi");
    if (cizgi) {
        const s = new Date();
        cizgi.style.top = ((s.getHours() * 60 + s.getMinutes()) / 60 * SAAT_YUKSEKLIK) + "px";
    }
}, 60000);

// Başlangıç
yukle();
bildirimDugmesiGuncelle();
ciz();

// Gün içinde ilk açılışsa günlük karşılamayı göster
if (!checkinYapildiMi()) {
    setTimeout(checkinAc, 600);
}
