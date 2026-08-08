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
    hedefler: []   // sınav / teslim tarihi geri sayımları [{id, ad, tarih "2026-08-20"}]
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
    const normal = hafta.bloklar.find(b => b.id === id);
    if (normal) {
        normal.tamam = !normal.tamam;
    } else {
        // Tekrarlayan bloğun tamamlanması SADECE o haftaya işlenir,
        // böylece yeni haftada yine işaretsiz gelir.
        const yeri = hafta.tamamlananTekrar.indexOf(id);
        if (yeri === -1) hafta.tamamlananTekrar.push(id);
        else hafta.tamamlananTekrar.splice(yeri, 1);
    }
    kaydet();
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

// Hiç kayıt var mı? (örnek program önerisi için)
function tamamenBosMu() {
    if (veri.tekrarlayan.length > 0) return false;
    for (const anahtar in veri.haftalar) {
        if (veri.haftalar[anahtar].bloklar.length > 0) return false;
    }
    return true;
}

// Boş başlayanlara örnek bir lise programı kurar (hepsi 🔁 tekrarlayan).
function ornekProgramYukle() {
    const ekle = (gun, bas, bit, metin, kategori) =>
        veri.tekrarlayan.push({ id: benzersizId(), gun, bas, bit, metin, kategori });
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
    kaydet();
}
