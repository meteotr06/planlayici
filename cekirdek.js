// ================= ÇEKİRDEK =================
// Burada sadece MANTIK var: veri saklama, hafta/saat hesabı, blok ekleme/silme.
// Ekranla (HTML ile) ilgili hiçbir şey burada yok — o iş arayuz.js'de.

const KAYIT_ADI = "haftalikPlanVerisi";

// Ana veri yapısı:
// tekrarlayan: her hafta kendiliğinden gelen bloklar [{id, gun, bas, bit, metin, kategori}]
//   gun: 0=Pazartesi ... 6=Pazar, -1 = "Boş vakitte" listesi (saatsiz)
//   bas/bit: "09:30" gibi saat metni (esnek görevlerde null)
// haftalar: her haftanın kendine özel kayıtları
//   { "2026-W32": { bloklar: [...aynı alanlar + tamam], tamamlananTekrar: [id, id...] } }
let veri = {
    surum: 2,
    tekrarlayan: [],
    haftalar: {},
    hedefler: [],  // sınav / teslim tarihi geri sayımları [{id, ad, tarih "2026-08-20"}]
    gunlukIz: {}   // gün bazlı başarı izi { "2026-08-08": { tamamlanan: 3, odakDk: 50 } }
};

// ---------- Kaydet / Yükle ----------
function kaydet() {
    localStorage.setItem(KAYIT_ADI, JSON.stringify(veri));
}

function yukle() {
    const ham = localStorage.getItem(KAYIT_ADI);
    if (!ham) return;
    veri = JSON.parse(ham);
    veri.hedefler = veri.hedefler || [];
    veri.gunlukIz = veri.gunlukIz || {};
    eskiVeriyiTasi();
}

// Eski (saatsiz görev) sürümden kalan veri varsa yeni biçime çevirir.
function eskiVeriyiTasi() {
    if (veri.surum >= 2) return;
    const GUN_KISA = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
    for (const anahtar in veri.haftalar) {
        const h = veri.haftalar[anahtar];
        h.bloklar = h.bloklar || [];
        for (const g of (h.gorevler || [])) {
            const ek = g.gun >= 0 ? " (" + GUN_KISA[g.gun] + ")" : "";
            h.bloklar.push({ id: g.id, gun: -1, bas: null, bit: null,
                             metin: g.metin + ek, kategori: g.kategori || "genel", tamam: !!g.tamam });
        }
        delete h.gorevler;
    }
    veri.tekrarlayan = (veri.tekrarlayan || []).map(g => {
        if (g.bas !== undefined) return g;
        const GUN_KISA2 = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
        const ek = g.gun >= 0 ? " (" + GUN_KISA2[g.gun] + ")" : "";
        return { id: g.id, gun: -1, bas: null, bit: null,
                 metin: g.metin + ek, kategori: g.kategori || "genel" };
    });
    veri.surum = 2;
    kaydet();
}

// ---------- Tarih / Hafta hesapları ----------
// Bir tarihin hangi haftaya ait olduğunu "2026-W32" gibi bir etiketle döndürür.
// Yeni hafta = yeni etiket = boş sayfa. "Her hafta baştan" böyle çalışıyor.
function haftaAnahtari(tarih) {
    const d = new Date(Date.UTC(tarih.getFullYear(), tarih.getMonth(), tarih.getDate()));
    const gunNo = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - gunNo);
    const yilBasi = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const haftaNo = Math.ceil((((d - yilBasi) / 86400000) + 1) / 7);
    return d.getUTCFullYear() + "-W" + String(haftaNo).padStart(2, "0");
}

// Verilen tarihin bulunduğu haftanın Pazartesi gününü döndürür.
function haftaBaslangici(tarih) {
    const d = new Date(tarih.getFullYear(), tarih.getMonth(), tarih.getDate());
    const gunNo = (d.getDay() + 6) % 7; // Pazartesi=0 ... Pazar=6
    d.setDate(d.getDate() - gunNo);
    return d;
}

function haftaKaydi(anahtar) {
    if (!veri.haftalar[anahtar]) {
        veri.haftalar[anahtar] = { bloklar: [], tamamlananTekrar: [] };
    }
    const h = veri.haftalar[anahtar];
    h.bloklar = h.bloklar || [];
    h.tamamlananTekrar = h.tamamlananTekrar || [];
    return h;
}

// ---------- Saat yardımcıları ----------
// "09:30" -> 570 (gece yarısından beri geçen dakika)
function dakika(saatMetni) {
    if (!saatMetni) return null;
    const [s, d] = saatMetni.split(":").map(Number);
    return s * 60 + d;
}

// ---------- Blok işlemleri ----------
function benzersizId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function blokEkle(anahtar, bilgi, herHafta) {
    const metin = (bilgi.metin || "").trim();
    if (!metin) return null;
    const blok = {
        id: benzersizId(),
        gun: bilgi.gun,
        bas: bilgi.bas || null,
        bit: bilgi.bit || null,
        metin: metin,
        kategori: bilgi.kategori || "genel",
        not: bilgi.not || ""
    };
    if (herHafta) {
        veri.tekrarlayan.push(blok);
    } else {
        blok.tamam = false;
        haftaKaydi(anahtar).bloklar.push(blok);
    }
    kaydet();
    return blok.id;
}

function blokSil(anahtar, id) {
    const hafta = haftaKaydi(anahtar);
    hafta.bloklar = hafta.bloklar.filter(b => b.id !== id);
    veri.tekrarlayan = veri.tekrarlayan.filter(b => b.id !== id);
    hafta.tamamlananTekrar = hafta.tamamlananTekrar.filter(x => x !== id);
    kaydet();
}

// Var olan bloğu günceller. herHafta değişirse bloğu doğru listeye taşır.
function blokGuncelle(anahtar, id, bilgi, herHafta) {
    const hafta = haftaKaydi(anahtar);
    let eski = veri.tekrarlayan.find(b => b.id === id) || hafta.bloklar.find(b => b.id === id);
    if (!eski) return;
    const tamamdi = blokTamamMi(anahtar, id);
    // Eski kaydı iki listeden de çıkar
    veri.tekrarlayan = veri.tekrarlayan.filter(b => b.id !== id);
    hafta.bloklar = hafta.bloklar.filter(b => b.id !== id);
    hafta.tamamlananTekrar = hafta.tamamlananTekrar.filter(x => x !== id);

    const yeni = {
        id: id,
        gun: bilgi.gun,
        bas: bilgi.bas || null,
        bit: bilgi.bit || null,
        metin: (bilgi.metin || "").trim() || eski.metin,
        kategori: bilgi.kategori || eski.kategori,
        not: bilgi.not !== undefined ? bilgi.not : (eski.not || "")
    };
    if (herHafta) {
        veri.tekrarlayan.push(yeni);
        if (tamamdi) hafta.tamamlananTekrar.push(id);
    } else {
        yeni.tamam = tamamdi;
        hafta.bloklar.push(yeni);
    }
    kaydet();
}

function blokTamamMi(anahtar, id) {
    const hafta = haftaKaydi(anahtar);
    const normal = hafta.bloklar.find(b => b.id === id);
    if (normal) return !!normal.tamam;
    return hafta.tamamlananTekrar.includes(id);
}

function blokIsaretle(anahtar, id) {
    const hafta = haftaKaydi(anahtar);
    let tamamlandiMi;
    const normal = hafta.bloklar.find(b => b.id === id);
    if (normal) {
        normal.tamam = !normal.tamam;
        tamamlandiMi = normal.tamam;
    } else {
        // Tekrarlayan bloğun tamamlanması SADECE o haftaya işlenir,
        // böylece yeni haftada yine işaretsiz gelir.
        const yeri = hafta.tamamlananTekrar.indexOf(id);
        if (yeri === -1) { hafta.tamamlananTekrar.push(id); tamamlandiMi = true; }
        else { hafta.tamamlananTekrar.splice(yeri, 1); tamamlandiMi = false; }
    }
    // Seri (🔥) takibi için günlük ize işle
    const iz = gunIzi(new Date());
    iz.tamamlanan = Math.max(0, (iz.tamamlanan || 0) + (tamamlandiMi ? 1 : -1));
    kaydet();
}

// ---------- Günlük iz / seri / odak ----------
function tarihAnahtari(t) {
    return t.getFullYear() + "-" + String(t.getMonth() + 1).padStart(2, "0") +
           "-" + String(t.getDate()).padStart(2, "0");
}

function gunIzi(t) {
    const k = tarihAnahtari(t);
    if (!veri.gunlukIz[k]) veri.gunlukIz[k] = { tamamlanan: 0, odakDk: 0 };
    return veri.gunlukIz[k];
}

// Odak (Pomodoro) dakikalarını bugünün izine ekler.
function odakEkle(dk) {
    if (dk <= 0) return;
    const iz = gunIzi(new Date());
    iz.odakDk = (iz.odakDk || 0) + dk;
    kaydet();
}

// Kaç gündür zincir kırılmamış? (o gün 1+ blok bitirmek YA DA 25+ dk odak = sayılır)
function seriHesapla() {
    const sayilirMi = (iz) => iz && ((iz.tamamlanan || 0) > 0 || (iz.odakDk || 0) >= 25);
    const t = new Date();
    let seri = 0;
    if (!sayilirMi(veri.gunlukIz[tarihAnahtari(t)])) {
        t.setDate(t.getDate() - 1); // bugün henüz bir şey yapılmadıysa zinciri bozma, dünden say
    }
    while (sayilirMi(veri.gunlukIz[tarihAnahtari(t)])) {
        seri++;
        t.setDate(t.getDate() - 1);
    }
    return seri;
}

// ---------- Takvim dosyası (.ics) dışa aktarma ----------
// Google Takvim / telefon takvimi bu dosyayı doğrudan içe aktarabilir.
function icsUret() {
    const pzt = haftaBaslangici(new Date());
    const GUN_KODU = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];
    const satirlar = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Planlayici//TR"];
    const zaman = (gunFarki, saat) => {
        const d = new Date(pzt);
        d.setDate(d.getDate() + gunFarki);
        return tarihAnahtari(d).replace(/-/g, "") + "T" + saat.replace(":", "") + "00";
    };
    const olayYaz = (b, tekrarli) => {
        if (!b.bas || !b.bit || b.gun < 0) return;
        satirlar.push("BEGIN:VEVENT");
        satirlar.push("UID:" + b.id + "@planlayici");
        satirlar.push("DTSTART:" + zaman(b.gun, b.bas));
        satirlar.push("DTEND:" + zaman(b.gun, b.bit));
        if (tekrarli) satirlar.push("RRULE:FREQ=WEEKLY;BYDAY=" + GUN_KODU[b.gun]);
        satirlar.push("SUMMARY:" + b.metin.replace(/[,;\\]/g, " "));
        satirlar.push("END:VEVENT");
    };
    for (const b of veri.tekrarlayan) olayYaz(b, true);
    for (const b of haftaKaydi(haftaAnahtari(new Date())).bloklar) olayYaz(b, false);
    satirlar.push("END:VCALENDAR");
    return satirlar.join("\r\n");
}

function blokBul(anahtar, id) {
    const hafta = haftaKaydi(anahtar);
    const b = veri.tekrarlayan.find(x => x.id === id);
    if (b) return { ...b, tekrarli: true, tamam: hafta.tamamlananTekrar.includes(id) };
    const n = hafta.bloklar.find(x => x.id === id);
    if (n) return { ...n, tekrarli: false, tamam: !!n.tamam };
    return null;
}

// Bir günün tüm bloklarını (tekrarlayan + o haftaya özel) saat sırasıyla verir.
function gunBloklari(anahtar, gun) {
    const hafta = haftaKaydi(anahtar);
    const liste = [];
    for (const b of veri.tekrarlayan) {
        if (b.gun === gun) {
            liste.push({ ...b, tamam: hafta.tamamlananTekrar.includes(b.id), tekrarli: true });
        }
    }
    for (const b of hafta.bloklar) {
        if (b.gun === gun) {
            liste.push({ ...b, tamam: !!b.tamam, tekrarli: false });
        }
    }
    liste.sort((a, b) => (dakika(a.bas) ?? 0) - (dakika(b.bas) ?? 0));
    return liste;
}

// Haftalık özet: kaç blok, kaçı bitti, toplam kaç dakika planlı
function haftaOzeti(anahtar) {
    let toplam = 0, biten = 0, dakikaToplam = 0;
    for (let gun = -1; gun < 7; gun++) {
        for (const b of gunBloklari(anahtar, gun)) {
            toplam++;
            if (b.tamam) biten++;
            if (b.bas && b.bit) dakikaToplam += Math.max(0, dakika(b.bit) - dakika(b.bas));
        }
    }
    return { toplam, biten, dakikaToplam };
}

// Kategori başına bu hafta kaç dakika planlı? -> { ders: 420, spor: 90, ... }
function kategoriDagilimi(anahtar) {
    const dagilim = {};
    for (let gun = 0; gun < 7; gun++) {
        for (const b of gunBloklari(anahtar, gun)) {
            if (!b.bas || !b.bit) continue;
            const sure = Math.max(0, dakika(b.bit) - dakika(b.bas));
            dagilim[b.kategori] = (dagilim[b.kategori] || 0) + sure;
        }
    }
    return dagilim;
}

// ---------- Hedefler (sınav / teslim geri sayımı) ----------
function hedefEkle(ad, tarih) {
    ad = (ad || "").trim();
    if (!ad || !tarih) return;
    veri.hedefler.push({ id: benzersizId(), ad: ad, tarih: tarih });
    veri.hedefler.sort((a, b) => a.tarih.localeCompare(b.tarih));
    kaydet();
}

function hedefSil(id) {
    veri.hedefler = veri.hedefler.filter(h => h.id !== id);
    kaydet();
}

// Hedefe kaç gün kaldı? (0 = bugün, eksi = geçti)
function hedefKalanGun(tarih) {
    const bugun = new Date();
    bugun.setHours(0, 0, 0, 0);
    const hedef = new Date(tarih + "T00:00:00");
    return Math.round((hedef - bugun) / 86400000);
}

// ---------- Yedekleme ----------
function disaAktar() {
    return JSON.stringify(veri, null, 2);
}

// Yedek dosyasındaki veriyi geçerliyse yükler. Başarılıysa true döner.
function iceAktar(metin) {
    try {
        const aday = JSON.parse(metin);
        if (!aday || typeof aday !== "object" || !aday.haftalar || !Array.isArray(aday.tekrarlayan)) {
            return false;
        }
        veri = aday;
        veri.hedefler = veri.hedefler || [];
        eskiVeriyiTasi();
        kaydet();
        return true;
    } catch (e) {
        return false;
    }
}

// ---------- Hızlı yazı ayrıştırma ----------
// "salı 16-17 matematik" gibi tek satırı anlayıp blok bilgisine çevirir.
// Saat yoksa "boş vakitte" görevi sayılır. "her" kelimesi = her hafta tekrarla.
const GUN_SOZLUGU = {
    "pazartesi": 0, "pzt": 0,
    "sali": 1, "salı": 1, "sal": 1,
    "carsamba": 2, "çarşamba": 2, "car": 2, "çar": 2, "crs": 2, "çrş": 2,
    "persembe": 3, "perşembe": 3, "per": 3, "prş": 3,
    "cuma": 4, "cum": 4,
    "cumartesi": 5, "cmt": 5,
    "pazar": 6, "paz": 6
};

const KATEGORI_IPUCLARI = {
    ders:    ["matematik", "mat", "fizik", "kimya", "biyoloji", "türkçe", "turkce", "tarih",
              "coğrafya", "cografya", "ingilizce", "edebiyat", "geometri", "felsefe", "din",
              "almanca", "ders", "sınav", "sinav", "deneme", "okul", "kurs", "dershane"],
    etut:    ["ödev", "odev", "etüt", "etut", "tekrar", "çalış", "calis", "soru", "test", "konu", "proje"],
    spor:    ["spor", "futbol", "basketbol", "voleybol", "koşu", "kosu", "antrenman",
              "yüzme", "yuzme", "fitness", "maç", "mac", "yürüyüş", "yuruyus"],
    yemek:   ["kahvaltı", "kahvalti", "yemek", "öğle", "ogle", "akşam", "aksam"],
    uyku:    ["uyku", "uyu", "şekerleme", "sekerleme"],
    serbest: ["oyun", "film", "dizi", "serbest", "mola", "dinlen", "müzik", "muzik",
              "gezme", "arkadaş", "arkadas", "sosyal", "tatil"]
};

function kategoriTahminEt(kelimeler) {
    for (const k of kelimeler) {
        const kucuk = k.toLocaleLowerCase("tr");
        for (const kategori in KATEGORI_IPUCLARI) {
            for (const ipucu of KATEGORI_IPUCLARI[kategori]) {
                if (kucuk === ipucu || (ipucu.length >= 4 && kucuk.startsWith(ipucu))) {
                    return kategori;
                }
            }
        }
    }
    return "genel";
}

// "16", "16:30", "16.30" -> dakika; geçersizse null
function saatOku(parca) {
    const e = parca.match(/^(\d{1,2})(?:[:.](\d{2}))?$/);
    if (!e) return null;
    const s = Number(e[1]), d = Number(e[2] || 0);
    if (s > 23 || d > 59) return null;
    return s * 60 + d;
}

function hizliAyristir(metin, varsayilanGun) {
    metin = metin.trim();
    if (!metin) return null;
    const parcalar = metin.split(/\s+/);
    let gun = null, herHafta = false, basDak = null, bitDak = null;
    const kalan = [];

    for (const parca of parcalar) {
        const kucuk = parca.toLocaleLowerCase("tr").replace(/[,;]+$/, "");

        if (kucuk === "her") { herHafta = true; continue; }
        if (kucuk === "hafta" && herHafta) { continue; }
        if (kucuk === "bugün" || kucuk === "bugun") { gun = varsayilanGun; continue; }
        if (kucuk === "yarın" || kucuk === "yarin") { gun = (varsayilanGun + 1) % 7; continue; }
        if (GUN_SOZLUGU[kucuk] !== undefined && gun === null) { gun = GUN_SOZLUGU[kucuk]; continue; }

        // "16-17" ya da "16:30-18" aralığı
        const aralik = kucuk.match(/^(\d{1,2}(?:[:.]\d{2})?)-(\d{1,2}(?:[:.]\d{2})?)$/);
        if (aralik && basDak === null) {
            const b1 = saatOku(aralik[1]), b2 = saatOku(aralik[2]);
            if (b1 !== null && b2 !== null) { basDak = b1; bitDak = b2; continue; }
        }

        // Tek saat: ilki başlangıç, ikincisi bitiş
        const tek = saatOku(kucuk);
        if (tek !== null && (basDak === null || bitDak === null)) {
            if (basDak === null) basDak = tek;
            else bitDak = tek;
            continue;
        }

        kalan.push(parca);
    }

    const baslik = kalan.join(" ").trim();
    if (!baslik) return null;
    const kategori = kategoriTahminEt(kalan);

    if (basDak === null) {
        // Saat yok: boş vakitte listesine
        return { gun: -1, bas: null, bit: null, metin: baslik, kategori, herHafta };
    }
    if (bitDak === null) bitDak = Math.min(basDak + 60, 1439); // süre verilmediyse 1 saat
    if (bitDak <= basDak) return null;
    if (gun === null) gun = varsayilanGun;

    const cevir = (dk) => String(Math.floor(dk / 60)).padStart(2, "0") + ":" + String(dk % 60).padStart(2, "0");
    return { gun, bas: cevir(basDak), bit: cevir(bitDak), metin: baslik, kategori, herHafta };
}

// ================= AKILLI ASİSTAN =================
// Kural tabanlı "yapay zeka": programı inceler, boşlukları bulur,
// sınavlara göre çalışma önerir, eksikleri (uyku/spor) yakalar.

function saatYaz(dk) {
    dk = Math.max(0, Math.min(1439, Math.round(dk)));
    return String(Math.floor(dk / 60)).padStart(2, "0") + ":" + String(dk % 60).padStart(2, "0");
}

// Bir günün boş zaman aralıklarını bulur (dakika cinsinden {bas, bit} listesi).
function bosAraliklar(anahtar, gun, enAzDk, sinirBas, sinirBit) {
    const dolu = gunBloklari(anahtar, gun)
        .filter(b => b.bas && b.bit)
        .map(b => [dakika(b.bas), dakika(b.bit)])
        .sort((a, b) => a[0] - b[0]);
    const bos = [];
    let imlec = sinirBas;
    for (const [s, e] of dolu) {
        if (s > imlec) bos.push({ bas: imlec, bit: Math.min(s, sinirBit) });
        imlec = Math.max(imlec, e);
        if (imlec >= sinirBit) break;
    }
    if (imlec < sinirBit) bos.push({ bas: imlec, bit: sinirBit });
    return bos.filter(a => a.bit - a.bas >= enAzDk);
}

// Haftada belirli bir kategoriden blok var mı?
function kategoriVarMi(anahtar, kategori) {
    for (let gun = -1; gun < 7; gun++) {
        if (gunBloklari(anahtar, gun).some(b => b.kategori === kategori)) return true;
    }
    return false;
}

// Görev listesini haftanın boş saatlerine dağıtır (bugünden ileriye).
// Hafta içi 16:00 sonrası, hafta sonu 09:00 sonrası; aynı öneride üst üste bindirmez.
function bosYereYerlestir(anahtar, gorevler, bastanGun) {
    const bloklar = [], sil = [];
    const ekDolu = {};
    for (const gorev of gorevler) {
        let yerlesti = false;
        for (let g = Math.max(bastanGun, 0); g < 7 && !yerlesti; g++) {
            const sinirBas = g < 5 ? 16 * 60 : 9 * 60;
            for (const a of bosAraliklar(anahtar, g, 45, sinirBas, 22 * 60)) {
                let bas = a.bas;
                for (const [ds, de] of (ekDolu[g] || []).sort((x, y) => x[0] - y[0])) {
                    if (bas < de && bas + 45 > ds) bas = de;
                }
                if (bas + 45 <= a.bit) {
                    const bit = Math.min(bas + 60, a.bit);
                    bloklar.push({ gun: g, bas: saatYaz(bas), bit: saatYaz(bit),
                                   metin: gorev.metin, kategori: gorev.kategori });
                    (ekDolu[g] = ekDolu[g] || []).push([bas, bit]);
                    sil.push(gorev.id);
                    yerlesti = true;
                    break;
                }
            }
        }
    }
    return { bloklar, sil };
}

// Günlük brifing: "Bugün 6 blok, 2 tamam. Sıradaki: 19:15 Matematik" gibi.
function gunlukBrifing(anahtar, bugunGun, suAnDakika) {
    const bugunku = gunBloklari(anahtar, bugunGun).filter(b => b.bas);
    if (bugunku.length === 0) return "Bugün planın boş 🙂 Hızlı ekleme çubuğuyla bir şeyler ekleyebilirsin.";
    const biten = bugunku.filter(b => b.tamam).length;
    const siradaki = bugunku.find(b => !b.tamam && dakika(b.bit) > suAnDakika);
    let metin = "Bugün " + bugunku.length + " blok var, " + biten + " tamam.";
    if (siradaki) {
        metin += " Sıradaki: " + siradaki.bas + " " + siradaki.metin;
    } else if (biten === bugunku.length) {
        metin += " Hepsi bitti, helal! 🎉";
    } else {
        metin += " Bugünlük program bitti.";
    }
    const odakDk = (veri.gunlukIz[tarihAnahtari(new Date())] || {}).odakDk || 0;
    if (odakDk > 0) metin += " · 🎯 Bugün " + odakDk + " dk odaklandın.";
    return metin;
}

// Asistanın önerileri: [{id, baslik, aciklama, bloklar, herHafta, silinecekler}]
function oneriUret(anahtar, bugunGun) {
    const oneriler = [];

    // 0) "Boş vakitte" bekleyen görevleri boş saatlere yerleştirmeyi öner
    const bekleyen = gunBloklari(anahtar, -1).filter(b => !b.tamam && !b.tekrarli);
    if (bekleyen.length > 0) {
        const sonuc = bosYereYerlestir(anahtar, bekleyen.slice(0, 3), bugunGun);
        if (sonuc.bloklar.length) {
            oneriler.push({
                id: "yerlestir-" + sonuc.sil.join("."),
                baslik: "📋 Yapılacaklarını takvime koyayım",
                aciklama: "Boş vakitte listende " + bekleyen.length + " görev bekliyor. " +
                          sonuc.bloklar.length + " tanesini boş saatlerine yerleştirebilirim (listeden takvime taşınır).",
                bloklar: sonuc.bloklar, silinecekler: sonuc.sil, herHafta: false
            });
        }
    }

    // 0.5) Geçen günlerde kaçan (yapılmamış) blokları ileri taşımayı öner
    const kacanlar = [];
    for (let g = 0; g < bugunGun; g++) {
        for (const b of gunBloklari(anahtar, g)) {
            if (!b.tamam && !b.tekrarli && b.bas) kacanlar.push(b);
        }
    }
    if (kacanlar.length > 0) {
        const sonuc = bosYereYerlestir(anahtar, kacanlar.slice(0, 3), bugunGun);
        if (sonuc.bloklar.length) {
            oneriler.push({
                id: "kacan-" + sonuc.sil.join("."),
                baslik: "⏰ Kaçan " + kacanlar.length + " bloğun var",
                aciklama: "Geçen günlerde yapılmayan işleri unutma! " + sonuc.bloklar.length +
                          " tanesini önümüzdeki boş saatlere taşıyayım mı?",
                bloklar: sonuc.bloklar, silinecekler: sonuc.sil, herHafta: false
            });
        }
    }

    // 1) Yaklaşan sınavlar/hedefler için çalışma blokları
    for (const h of veri.hedefler) {
        const kalan = hedefKalanGun(h.tarih);
        if (kalan < 0 || kalan > 14) continue;
        const anahtarKelime = h.ad.toLocaleLowerCase("tr").split(/\s+/)[0];
        let mevcutCalisma = 0;
        for (let g = 0; g < 7; g++) {
            for (const b of gunBloklari(anahtar, g)) {
                if ((b.kategori === "etut" || b.kategori === "ders") &&
                    b.metin.toLocaleLowerCase("tr").includes(anahtarKelime)) mevcutCalisma++;
            }
        }
        if (mevcutCalisma >= 2) continue; // zaten çalışması planlanmış
        const bloklar = [];
        for (let g = bugunGun; g < 7 && bloklar.length < 2; g++) {
            const araliklar = bosAraliklar(anahtar, g, 90, 17 * 60, 22 * 60 + 30);
            if (araliklar.length) {
                const a = araliklar[0];
                bloklar.push({ gun: g, bas: saatYaz(a.bas), bit: saatYaz(Math.min(a.bas + 90, a.bit)),
                               metin: h.ad + " çalışması", kategori: "etut" });
            }
        }
        if (bloklar.length) {
            oneriler.push({
                id: "hedef-" + h.id,
                baslik: "🎯 \"" + h.ad + "\" yaklaşıyor (" + (kalan === 0 ? "BUGÜN" : kalan + " gün") + ")",
                aciklama: "Programında buna çalışma görünmüyor. Boş akşamlarına " + bloklar.length + " çalışma bloğu ekleyeyim mi?",
                bloklar, herHafta: false
            });
        }
    }

    // 2) Uyku düzeni yoksa öner
    if (!kategoriVarMi(anahtar, "uyku")) {
        const bloklar = [];
        for (let g = 0; g < 7; g++) bloklar.push({ gun: g, bas: "23:00", bit: "23:59", metin: "Uyku", kategori: "uyku" });
        oneriler.push({
            id: "uyku",
            baslik: "😴 Uyku düzenin yok",
            aciklama: "Düzenli uyku, dersten daha önemli! Her gece 23:00 uyku bloğu ekleyeyim mi? (🔁 her hafta)",
            bloklar, herHafta: true
        });
    }

    // 3) Spor yoksa öner
    if (!kategoriVarMi(anahtar, "spor")) {
        const bloklar = [];
        const carAralik = bosAraliklar(anahtar, 2, 75, 16 * 60, 19 * 60);
        if (carAralik.length) bloklar.push({ gun: 2, bas: saatYaz(carAralik[0].bas),
            bit: saatYaz(carAralik[0].bas + 75), metin: "Spor / hareket", kategori: "spor" });
        const cmtAralik = bosAraliklar(anahtar, 5, 90, 9 * 60, 13 * 60);
        if (cmtAralik.length) bloklar.push({ gun: 5, bas: saatYaz(cmtAralik[0].bas),
            bit: saatYaz(cmtAralik[0].bas + 90), metin: "Spor / hareket", kategori: "spor" });
        if (bloklar.length) {
            oneriler.push({
                id: "spor",
                baslik: "🏃 Bu hafta hiç spor yok",
                aciklama: "Hareket etmek kafayı da açar. Boş saatlerine spor ekleyeyim mi? (🔁 her hafta)",
                bloklar, herHafta: true
            });
        }
    }

    // 4) Hafta içi büyük boşluk varsa değerlendir
    for (let g = Math.max(bugunGun, 0); g < 5; g++) {
        const araliklar = bosAraliklar(anahtar, g, 120, 16 * 60, 22 * 60);
        if (araliklar.length) {
            const a = araliklar[0];
            oneriler.push({
                id: "bosluk-" + g + "-" + a.bas,
                baslik: "🕓 " + ["Pazartesi","Salı","Çarşamba","Perşembe","Cuma"][g] + " akşamı boş",
                aciklama: saatYaz(a.bas) + "–" + saatYaz(a.bit) + " arası boş görünüyor. 1 saatlik ders tekrarı koyayım mı?",
                bloklar: [{ gun: g, bas: saatYaz(a.bas), bit: saatYaz(a.bas + 60), metin: "Ders tekrarı", kategori: "etut" }],
                herHafta: false
            });
            break; // tek boşluk önerisi yeter
        }
    }

    return oneriler.slice(0, 4);
}

// Sihirbaz: cevaplara göre komple haftalık program kurar (hepsi 🔁 tekrarlayan).
// cevaplar: {uyan, yat, okulVar, okulBas, okulBit, zayifDersler[], gunlukCalisma, sporGunleri[]}
function sihirbazPlanUret(c) {
    const ekle = (gun, basDk, bitDk, metin, kategori) => {
        if (bitDk <= basDk) return;
        veri.tekrarlayan.push({ id: benzersizId(), gun,
            bas: saatYaz(basDk), bit: saatYaz(bitDk), metin, kategori });
    };
    const uyan = dakika(c.uyan) ?? 7 * 60;
    const yat = dakika(c.yat) ?? 23 * 60;
    const dersler = c.zayifDersler.length ? c.zayifDersler : ["Ders"];
    let dersSira = 0;
    const dersAdi = () => {
        const ad = dersler[dersSira++ % dersler.length];
        return ad.charAt(0).toLocaleUpperCase("tr") + ad.slice(1) + " çalışması";
    };

    for (let g = 0; g < 5; g++) { // hafta içi
        ekle(g, uyan, uyan + 40, "Kahvaltı + hazırlık", "yemek");
        if (c.okulVar) ekle(g, dakika(c.okulBas) ?? 510, dakika(c.okulBit) ?? 930, "Okul", "ders");
        if (c.sporGunleri.includes(g)) ekle(g, 16 * 60 + 45, 18 * 60, "Spor", "spor");
        ekle(g, 18 * 60 + 10, 19 * 60, "Akşam yemeği", "yemek");
        const sure = Math.round((c.gunlukCalisma || 2) * 60);
        ekle(g, 19 * 60 + 15, Math.min(19 * 60 + 15 + sure, yat - 10), dersAdi(), "etut");
    }
    // hafta sonu
    for (const g of [5, 6]) {
        if (c.sporGunleri.includes(g)) ekle(g, 10 * 60, 11 * 60 + 30, "Spor", "spor");
    }
    ekle(5, 13 * 60, 15 * 60, "Haftalık genel tekrar", "etut");
    ekle(6, 11 * 60, 12 * 60 + 30, "Gelecek haftaya hazırlık", "etut");
    ekle(6, 15 * 60, 18 * 60, "Serbest zaman", "serbest");
    // uyku her gün
    for (let g = 0; g < 7; g++) ekle(g, yat, 23 * 60 + 59, "Uyku", "uyku");
    kaydet();
}

function tekrarlayanTemizle() {
    veri.tekrarlayan = [];
    kaydet();
}

// Hiç kayıt var mı? (örnek program önerisi için)
function tamamenBosMu() {
    if (veri.tekrarlayan.length > 0) return false;
    for (const anahtar in veri.haftalar) {
        if (veri.haftalar[anahtar].bloklar.length > 0) return false;
    }
    return true;
}

// Hazır örnek planlar (hepsi 🔁 tekrarlayan): "okul", "sinav", "tatil"
function sablonYukle(tur) {
    const ekle = (gun, bas, bit, metin, kategori) =>
        veri.tekrarlayan.push({ id: benzersizId(), gun, bas, bit, metin, kategori });

    if (tur === "sinav") {
        // Sınav haftası: yoğun ama molali çalışma
        for (let gun = 0; gun < 5; gun++) {
            ekle(gun, "07:00", "07:45", "Kahvaltı + hazırlık", "yemek");
            ekle(gun, "08:30", "15:30", "Okul", "ders");
            ekle(gun, "16:30", "17:00", "Dinlenme", "serbest");
            ekle(gun, "17:00", "18:45", "Soru çözümü", "etut");
            ekle(gun, "19:00", "19:45", "Akşam yemeği", "yemek");
            ekle(gun, "20:00", "21:45", "Konu tekrarı", "etut");
            ekle(gun, "22:30", "23:59", "Uyku", "uyku");
        }
        ekle(5, "10:00", "13:00", "Deneme sınavı", "ders");
        ekle(5, "15:00", "16:30", "Yanlış analizi", "etut");
        ekle(5, "17:00", "19:00", "Serbest zaman", "serbest");
        ekle(5, "23:00", "23:59", "Uyku", "uyku");
        ekle(6, "11:00", "13:00", "Genel tekrar", "etut");
        ekle(6, "15:00", "17:00", "Eksik konular", "etut");
        ekle(6, "22:30", "23:59", "Uyku", "uyku");
    } else if (tur === "tatil") {
        // Tatil haftası: bol serbest, hafif tekrar, düzeni koru
        for (let gun = 0; gun < 7; gun++) {
            ekle(gun, "09:30", "10:15", "Kahvaltı", "yemek");
            ekle(gun, "11:00", "13:00", "Hobi / serbest", "serbest");
            ekle(gun, "13:00", "13:45", "Öğle yemeği", "yemek");
            if (gun < 5) ekle(gun, "15:00", "16:00", "Hafif ders tekrarı", "etut");
            if (gun === 1 || gun === 3 || gun === 5) ekle(gun, "17:00", "18:00", "Spor", "spor");
            ekle(gun, "20:00", "22:00", "Film / oyun", "serbest");
            ekle(gun, "23:30", "23:59", "Uyku", "uyku");
        }
    } else {
        // Normal okul haftası
        for (let gun = 0; gun < 5; gun++) {
            ekle(gun, "07:00", "07:45", "Kahvaltı + hazırlık", "yemek");
            ekle(gun, "08:30", "15:30", "Okul", "ders");
            ekle(gun, "17:00", "18:00", "Dinlenme / serbest", "serbest");
            ekle(gun, "19:00", "20:30", "Ödev + günün tekrarı", "etut");
            ekle(gun, "23:00", "23:59", "Uyku", "uyku");
        }
        ekle(5, "10:00", "12:00", "Haftalık ders tekrarı", "etut");
        ekle(5, "14:00", "15:30", "Spor", "spor");
        ekle(6, "11:00", "13:00", "Gelecek haftaya hazırlık", "etut");
        ekle(6, "15:00", "18:00", "Serbest zaman", "serbest");
    }
    kaydet();
}

// Boş başlayanlara örnek bir lise programı kurar (üst bar düğmesi bunu kullanır).
function ornekProgramYukle() {
    sablonYukle("okul");
}
