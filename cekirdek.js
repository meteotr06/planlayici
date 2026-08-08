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
    gunlukIz: {},  // gün bazlı başarı izi { "2026-08-08": { tamamlanan: 3, odakDk: 50, seans: 2, skorToplam: 180 } }
    sorular: {},   // çözülen soru sayıları { "2026-08-08": { "matematik": 50 } }
    denemeler: [], // deneme sınavları [{id, ad, tarih, tur, dogru, yanlis, bos, net}]
    konular: [],   // konu takip listesi [{id, ders, ad, durum 0=görmedim 1=tekrar 2=bitti}]
    hedefNet: null,// deneme grafiğindeki hedef çizgisi
    soruDersler: [],// soru sayacındaki kalıcı ders adları
    sonCheckin: null,// günlük karşılama en son hangi gün yapıldı ("2026-08-08")
    aliskanliklar: [], // günlük alışkanlıklar [{id, ad}]
    aliskanlikIz: {},  // hangi gün hangileri yapıldı { "2026-08-08": ["id1", "id2"] }
    ayarlar: { odakDk: 25, molaDk: 5, varsayilanSure: 60, ses: true }
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
    veri.sorular = veri.sorular || {};
    veri.denemeler = veri.denemeler || [];
    veri.konular = veri.konular || [];
    veri.soruDersler = veri.soruDersler || [];
    if (veri.hedefNet === undefined) veri.hedefNet = null;
    if (veri.sonCheckin === undefined) veri.sonCheckin = null;
    veri.aliskanliklar = veri.aliskanliklar || [];
    veri.aliskanlikIz = veri.aliskanlikIz || {};
    veri.ayarlar = Object.assign({ odakDk: 25, molaDk: 5, varsayilanSure: 60, ses: true }, veri.ayarlar || {});
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

// ---------- 🔢 Soru sayacı ----------
// Türk öğrenci kültürü: "bugün kaç soru çözdün?" Ders başına günlük sayaç.
function soruEkle(ders, adet) {
    ders = ders.trim().toLocaleLowerCase("tr");
    if (!ders) return;
    const k = tarihAnahtari(new Date());
    if (!veri.sorular[k]) veri.sorular[k] = {};
    veri.sorular[k][ders] = Math.max(0, (veri.sorular[k][ders] || 0) + adet);
    if (veri.sorular[k][ders] === 0) delete veri.sorular[k][ders];
    kaydet();
}

function bugunSorular() {
    return veri.sorular[tarihAnahtari(new Date())] || {};
}

function soruDersEkle(ad) {
    ad = ad.trim().toLocaleLowerCase("tr");
    if (ad && !veri.soruDersler.includes(ad)) {
        veri.soruDersler.push(ad);
        veri.soruDersler.sort();
        kaydet();
    }
}

// Kalıcı ders listesi + geçmişte soru çözülen dersler (butonları kalıcı yapmak için)
function soruDersleri() {
    const adlar = new Set(veri.soruDersler);
    for (const gun in veri.sorular) {
        for (const d in veri.sorular[gun]) adlar.add(d);
    }
    return [...adlar].sort();
}

function gunSoruToplam(tarihK) {
    const g = veri.sorular[tarihK] || {};
    let t = 0;
    for (const d in g) t += g[d];
    return t;
}

function haftaSoruToplam() {
    const pzt = haftaBaslangici(new Date());
    let t = 0;
    for (let i = 0; i < 7; i++) {
        const d = new Date(pzt);
        d.setDate(d.getDate() + i);
        t += gunSoruToplam(tarihAnahtari(d));
    }
    return t;
}

// ---------- 📝 Deneme net takibi ----------
// net = doğru - yanlış/4 (TYT/AYT), LGS'de yanlış/3
function denemeEkle(ad, tarih, tur, dogru, yanlis, bos) {
    dogru = Number(dogru) || 0; yanlis = Number(yanlis) || 0; bos = Number(bos) || 0;
    const net = tur === "LGS" ? dogru - yanlis / 3 : dogru - yanlis / 4;
    veri.denemeler.push({
        id: benzersizId(), ad: (ad || "Deneme").trim(), tarih, tur,
        dogru, yanlis, bos, net: Math.round(net * 100) / 100
    });
    veri.denemeler.sort((a, b) => a.tarih.localeCompare(b.tarih));
    kaydet();
}

function denemeSil(id) {
    veri.denemeler = veri.denemeler.filter(d => d.id !== id);
    kaydet();
}

function hedefNetAyarla(net) {
    veri.hedefNet = net > 0 ? net : null;
    kaydet();
}

// ---------- 📚 Konu takip listesi ----------
function konuEkle(ders, ad) {
    ders = ders.trim(); ad = ad.trim();
    if (!ders || !ad) return;
    veri.konular.push({ id: benzersizId(), ders, ad, durum: 0 });
    kaydet();
}

function konuDurumIlerle(id) {
    const k = veri.konular.find(x => x.id === id);
    if (k) { k.durum = (k.durum + 1) % 3; kaydet(); }
}

function konuSil(id) {
    veri.konular = veri.konular.filter(k => k.id !== id);
    kaydet();
}

// ---------- ⭐ XP / Seviye ----------
// Her iş puan getirir: biten blok 10, odak dakikası 2, soru 1, alışkanlık 5.
function gunPuani(tarihK) {
    const iz = veri.gunlukIz[tarihK] || {};
    return (iz.tamamlanan || 0) * 10 + (iz.odakDk || 0) * 2 + gunSoruToplam(tarihK) +
           (veri.aliskanlikIz[tarihK] || []).length * 5;
}

function puanGunleri() {
    return new Set([...Object.keys(veri.gunlukIz), ...Object.keys(veri.sorular),
                    ...Object.keys(veri.aliskanlikIz)]);
}

function seviyeBilgi() {
    let xp = 0;
    for (const g of puanGunleri()) xp += gunPuani(g);
    const seviye = Math.floor(Math.sqrt(xp / 100)) + 1;
    const buSeviyeXp = (seviye - 1) * (seviye - 1) * 100;
    const sonrakiXp = seviye * seviye * 100;
    return { xp, seviye, ilerleme: (xp - buSeviyeXp) / (sonrakiXp - buSeviyeXp), sonrakiXp };
}

// ---------- 🔥 Isı haritası + 🏆 haftalık rekorlar ----------
function isiHaritasiVerisi(gunSayisi) {
    const sonuc = [];
    const t = new Date();
    t.setDate(t.getDate() - gunSayisi + 1);
    for (let i = 0; i < gunSayisi; i++) {
        const k = tarihAnahtari(t);
        sonuc.push({ tarih: k, puan: gunPuani(k) });
        t.setDate(t.getDate() + 1);
    }
    return sonuc;
}

function haftalikRekorlar() {
    const haftalar = {};
    for (const g of puanGunleri()) {
        const hafta = haftaAnahtari(new Date(g + "T12:00:00"));
        haftalar[hafta] = (haftalar[hafta] || 0) + gunPuani(g);
    }
    const liste = Object.entries(haftalar)
        .map(([hafta, puan]) => ({ hafta, puan }))
        .sort((a, b) => b.puan - a.puan);
    const buHafta = haftaAnahtari(new Date());
    const sira = liste.findIndex(h => h.hafta === buHafta) + 1;
    return { liste: liste.slice(0, 5), buHafta, sira: sira || null, toplamHafta: liste.length };
}

// ---------- 🎯 Odak skoru ----------
// Odak seansında sekme değiştirmek dikkat dağınıklığı sayılır; 100'den düşer.
function odakSkorKaydet(skor) {
    const iz = gunIzi(new Date());
    iz.seans = (iz.seans || 0) + 1;
    iz.skorToplam = (iz.skorToplam || 0) + skor;
    kaydet();
}

function bugunOdakSkoru() {
    const iz = veri.gunlukIz[tarihAnahtari(new Date())] || {};
    if (!iz.seans) return null;
    return Math.round(iz.skorToplam / iz.seans);
}

// ---------- ✅ Alışkanlık takibi ----------
function aliskanlikEkle(ad) {
    ad = ad.trim();
    if (!ad) return;
    veri.aliskanliklar.push({ id: benzersizId(), ad });
    kaydet();
}

function aliskanlikSil(id) {
    veri.aliskanliklar = veri.aliskanliklar.filter(a => a.id !== id);
    for (const g in veri.aliskanlikIz) {
        veri.aliskanlikIz[g] = veri.aliskanlikIz[g].filter(x => x !== id);
    }
    kaydet();
}

function aliskanlikYapildiMi(id, tarihK) {
    return (veri.aliskanlikIz[tarihK] || []).includes(id);
}

// Bugün için işaretle/kaldır
function aliskanlikIsaretle(id) {
    const k = tarihAnahtari(new Date());
    if (!veri.aliskanlikIz[k]) veri.aliskanlikIz[k] = [];
    const yeri = veri.aliskanlikIz[k].indexOf(id);
    if (yeri === -1) veri.aliskanlikIz[k].push(id);
    else veri.aliskanlikIz[k].splice(yeri, 1);
    kaydet();
}

// Bu alışkanlık kaç gündür aralıksız yapılıyor?
function aliskanlikSerisi(id) {
    const t = new Date();
    let seri = 0;
    if (!aliskanlikYapildiMi(id, tarihAnahtari(t))) t.setDate(t.getDate() - 1);
    while (aliskanlikYapildiMi(id, tarihAnahtari(t))) {
        seri++;
        t.setDate(t.getDate() - 1);
    }
    return seri;
}

// Bugün tüm saatli bloklar bitti mi? (konfeti için 🎉)
function bugunHersheyBittiMi() {
    const simdi = new Date();
    const liste = gunBloklari(haftaAnahtari(simdi), (simdi.getDay() + 6) % 7).filter(b => b.bas);
    return liste.length > 0 && liste.every(b => b.tamam);
}

// ---------- 💬 Günün sözü ----------
const SOZLER = [
    "Damlaya damlaya göl olur — bugünkü 1 saat, yarınki 1 sıra fark eder.",
    "Rakibin dün çözdüğün soru sayısı, bugün onu geç.",
    "Motivasyon başlatır, disiplin bitirir.",
    "Zor geliyorsa doğru yoldasın demektir.",
    "Bir saatlik odaklı çalışma, üç saatlik telefonlu çalışmadan iyidir.",
    "Zinciri kırma! 🔥",
    "Sınav, hazırlananlar için bir fırsattır.",
    "Küçük adımlar, büyük netler getirir.",
    "Bugün yapamadıysan bile yarın yeni bir sayfadır.",
    "En iyi program, uyguladığın programdır."
];

function gununSozu() {
    const t = new Date();
    const yilinGunu = Math.floor((t - new Date(t.getFullYear(), 0, 0)) / 86400000);
    return SOZLER[yilinGunu % SOZLER.length];
}

// ---------- ☀️ Günlük karşılama (check-in) ----------
function checkinYapildiMi() {
    return veri.sonCheckin === tarihAnahtari(new Date());
}

function checkinKaydet() {
    veri.sonCheckin = tarihAnahtari(new Date());
    kaydet();
}

// Karşılamada yazılan satırları plana çevirir.
// Saatli satırlar ("16-17 matematik") doğrudan eklenir; saatsizler bugünün
// (doluysa sonraki günlerin) boş saatlerine yerleştirilir. Enerji süreyi belirler.
function gunlukPlanla(satirlar, enerji, bugunGun, simdiDak) {
    const anahtar = haftaAnahtari(new Date());
    const sure = enerji === "yorgun" ? 45 : enerji === "enerjik" ? 90 : 60;
    let dogrudan = 0, yerlesen = 0, listeye = 0;
    const saatsizler = [];

    for (const satir of satirlar) {
        const sonuc = hizliAyristir(satir, bugunGun);
        if (!sonuc) continue;
        if (sonuc.bas) {
            blokEkle(anahtar, sonuc, sonuc.herHafta);
            dogrudan++;
        } else {
            saatsizler.push(sonuc);
        }
    }

    // Saatsizleri boş yerlere dağıt: bugün şu andan sonrası, olmazsa sonraki günler
    const ekDolu = {};
    for (const gorev of saatsizler) {
        let yerlesti = false;
        for (let g = bugunGun; g < 7 && !yerlesti; g++) {
            const enErken = g === bugunGun ? Math.max(simdiDak, 8 * 60) : (g < 5 ? 16 * 60 : 9 * 60);
            for (const a of bosAraliklar(anahtar, g, Math.min(sure, 45), enErken, 22 * 60 + 30)) {
                let bas = Math.max(a.bas, enErken);
                for (const [ds, de] of (ekDolu[g] || []).sort((x, y) => x[0] - y[0])) {
                    if (bas < de && bas + 45 > ds) bas = de;
                }
                if (bas + 45 <= a.bit) {
                    const bit = Math.min(bas + sure, a.bit);
                    blokEkle(anahtar, { gun: g, bas: saatYaz(bas), bit: saatYaz(bit),
                                        metin: gorev.metin, kategori: gorev.kategori }, false);
                    (ekDolu[g] = ekDolu[g] || []).push([bas, bit]);
                    yerlesti = true;
                    yerlesen++;
                    break;
                }
            }
        }
        if (!yerlesti) {
            // Hiç boş yer yoksa "Boş vakitte" listesine koy, kaybolmasın
            blokEkle(anahtar, { gun: -1, metin: gorev.metin, kategori: gorev.kategori }, false);
            listeye++;
        }
    }
    checkinKaydet();
    return { dogrudan, yerlesen, listeye };
}

// ---------- ✍️ Yazım yardımcısı ----------
// Hazır güzel cümleler + kullanıcının en sık kullandığı başlıklar
const HAZIR_CUMLELER = [
    "Matematik soru çözümü", "İngilizce kelime ezberi", "Kitap okuma",
    "Ders / iş notlarını düzenleme", "Yürüyüş / spor", "Ev işleri ve toparlanma",
    "Alışveriş listesini halletme", "Aileyle vakit geçirme", "Yarını planlama",
    "Fatura ve ödemeler"
];

function gecmisBasliklar() {
    const sayim = {};
    const say = (metin) => { const k = metin.trim(); if (k) sayim[k] = (sayim[k] || 0) + 1; };
    veri.tekrarlayan.forEach(b => say(b.metin));
    for (const h in veri.haftalar) veri.haftalar[h].bloklar.forEach(b => say(b.metin));
    return Object.entries(sayim).sort((a, b) => b[1] - a[1]).map(e => e[0]);
}

function yaziOnerileri() {
    const oneriler = [...new Set([...gecmisBasliklar().slice(0, 6), ...HAZIR_CUMLELER])];
    return oneriler.slice(0, 10);
}

// ---------- 💬 Sohbet asistanı ----------
// Yazdığını anlar: plan sorar, istatistik verir, "yarın 16 matematik ekle" derse ekler.
function sohbetCevabi(mesaj) {
    const m = mesaj.toLocaleLowerCase("tr").trim();
    if (!m) return null;
    const simdi = new Date();
    const bugunGun = (simdi.getDay() + 6) % 7;
    const anahtar = haftaAnahtari(simdi);
    const GUNLER = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];

    const gunListesi = (anahtarX, gunX, baslik) => {
        const liste = gunBloklari(anahtarX, gunX).filter(b => b.bas);
        if (!liste.length) return baslik + " planın boş. ☀️ düğmesiyle ya da ⚡ çubukla doldurabilirsin.";
        return baslik + " planın:\n" + liste.map(b =>
            (b.tamam ? "✅ " : "⬜ ") + b.bas + "–" + b.bit + " " + b.metin).join("\n");
    };

    // Ekleme niyeti
    if (/(ekle|koyar mısın|koy|planla|yaz)\b/.test(m)) {
        const temiz = mesaj.replace(/\b(ekleyebilir misin|ekler misin|ekle|koyar mısın|koy|planla|yazar mısın|yaz|bana|lütfen|lutfen|takvime|programa)\b/gi, " ").trim();
        const sonuc = hizliAyristir(temiz, bugunGun);
        if (sonuc && sonuc.metin) {
            blokEkle(anahtar, sonuc, sonuc.herHafta);
            if (sonuc.bas) {
                return "Ekledim ✔ " + GUNLER[sonuc.gun] + " " + sonuc.bas + "–" + sonuc.bit + ": " +
                       sonuc.metin + (sonuc.herHafta ? " (her hafta 🔁)" : "");
            }
            return "Saat söylemedin, \"" + sonuc.metin + "\" işini 🕓 Boş Vakitte listesine koydum. Boş bir saatine yerleştirmemi istersen \"önerin var mı\" diye sor.";
        }
        return "Anlayamadım 🤔 Şöyle dene: \"yarın 16-17 matematik ekle\" ya da \"her cuma 19 spor ekle\"";
    }

    if (/(yarın|yarin)/.test(m)) {
        const yarin = new Date(simdi);
        yarin.setDate(yarin.getDate() + 1);
        return gunListesi(haftaAnahtari(yarin), (yarin.getDay() + 6) % 7, "Yarınki");
    }
    if (/(bugün|bugun|ne yap)/.test(m) && /(ne|var|plan|yap)/.test(m)) {
        return gunListesi(anahtar, bugunGun, "Bugünkü");
    }
    if (/(kaç saat|kac saat|ne kadar çalış|ne kadar calis|istatistik)/.test(m)) {
        const o = haftaOzeti(anahtar);
        const saat = Math.floor(o.dakikaToplam / 60);
        return "Bu hafta " + o.toplam + " blok planladın (" + saat + " saat), " + o.biten +
               " tanesini bitirdin." + (o.toplam ? " Tamamlama: %" + Math.round(o.biten / o.toplam * 100) : "");
    }
    if (/(sınav|sinav|kaç gün|kac gun|hedef)/.test(m)) {
        const yakin = enYakinHedef();
        if (!yakin) return "Kayıtlı bir sınav hedefin yok. 🎯 Hedefler panelinden ekleyebilirsin.";
        return "🎯 " + yakin.ad + " için " + (yakin.kalan === 0 ? "BUGÜN! Başarılar! 🍀" :
               yakin.kalan + " gün kaldı. Az kaldıysa panik yok — plan var 😉");
    }
    if (/(net|deneme)/.test(m)) {
        if (!veri.denemeler.length) return "Henüz deneme girmemişsin. 📝 Denemeler panelinden D/Y/B gir, netini hesaplayayım.";
        const son = veri.denemeler[veri.denemeler.length - 1];
        let cevap = "Son denemen: " + son.ad + " → " + son.net + " net.";
        if (veri.denemeler.length >= 2) {
            const onceki = veri.denemeler[veri.denemeler.length - 2];
            const fark = Math.round((son.net - onceki.net) * 100) / 100;
            cevap += fark > 0 ? " Öncekinden " + fark + " net yükselmişsin, bravo! 📈"
                   : fark < 0 ? " Öncekinden " + (-fark) + " net düşmüş — yanlış analizi yapmayı unutma."
                   : " Öncekiyle aynı.";
        }
        if (veri.hedefNet) cevap += " Hedefin: " + veri.hedefNet + " net.";
        return cevap;
    }
    if (/soru/.test(m)) {
        const bugun = bugunSorular();
        let toplam = 0;
        const parcalar = [];
        for (const d in bugun) { toplam += bugun[d]; parcalar.push(bugun[d] + " " + d); }
        if (!toplam) return "Bugün henüz soru saymadın. 🔢 Soru Sayacı panelinden çözdükçe ekle!";
        return "Bugün " + toplam + " soru çözdün (" + parcalar.join(", ") + "). Devam! 💪";
    }
    if (/(seri|zincir|streak)/.test(m)) {
        const seri = seriHesapla();
        return seri > 0 ? "🔥 " + seri + " gündür zincir kırılmadı. Bugün de bir blok bitir, devam etsin!"
                        : "Zincir şu an sıfır. Bugün tek bir blok bitir, 🔥 seri başlasın!";
    }
    if (/(öneri|oneri|tavsiye|ne yapayım|ne yapayim|yardım|yardim)/.test(m)) {
        const oneriler = oneriUret(anahtar, bugunGun);
        if (!oneriler.length) return "Şu an önerim yok, programın gayet iyi görünüyor 👍";
        const o = oneriler[0];
        return "Önerim: " + o.baslik + " — " + o.aciklama + " (Uygulamak için yandaki karttan \"Uygula\"ya bas.)";
    }
    if (/(motivasyon|söz|soz)/.test(m)) {
        return "💬 " + gununSozu();
    }
    if (/(merhaba|selam|naber|nasılsın|nasilsin|günaydın|gunaydin)/.test(m)) {
        return "Selam! 👋 " + gunlukBrifing(anahtar, bugunGun, simdi.getHours() * 60 + simdi.getMinutes());
    }
    return "Bunu henüz öğrenmedim 🙈 Şunları sorabilirsin:\n" +
           "• \"bugün ne var?\" / \"yarın ne var?\"\n" +
           "• \"yarın 16-17 matematik ekle\"\n" +
           "• \"kaç saat çalıştım?\" · \"sınava kaç gün kaldı?\"\n" +
           "• \"son netim ne?\" · \"kaç soru çözdüm?\" · \"önerin var mı?\"";
}

// En yakın gelecekteki hedef (üstteki büyük geri sayım için)
function enYakinHedef() {
    for (const h of veri.hedefler) {
        const kalan = hedefKalanGun(h.tarih);
        if (kalan >= 0) return { ad: h.ad, kalan };
    }
    return null;
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
    is:      ["iş", "is", "toplantı", "toplanti", "mesai", "vardiya", "müşteri", "musteri",
              "rapor", "sunum", "ofis", "fatura", "banka", "evrak"],
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
        if (c.okulVar) ekle(g, dakika(c.okulBas) ?? 510, dakika(c.okulBit) ?? 930, "Okul / İş", "ders");
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

// ---------- ⚙️ Ayarlar ----------
function ayarGuncelle(ad, deger) {
    veri.ayarlar[ad] = deger;
    kaydet();
}

// Her şeyi siler — sadece Ayarlar'daki çift onaylı düğmeden çağrılır!
function tumVeriyiSil() {
    localStorage.removeItem(KAYIT_ADI);
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
    } else if (tur === "is") {
        // İş haftası: mesai + akşam kendine zaman
        for (let gun = 0; gun < 5; gun++) {
            ekle(gun, "07:30", "08:15", "Kahvaltı + hazırlık", "yemek");
            ekle(gun, "09:00", "12:30", "İş", "is");
            ekle(gun, "12:30", "13:30", "Öğle arası", "yemek");
            ekle(gun, "13:30", "18:00", "İş", "is");
            ekle(gun, "19:00", "19:45", "Akşam yemeği", "yemek");
            ekle(gun, "20:30", "22:00", "Kendine zaman", "serbest");
            ekle(gun, "23:00", "23:59", "Uyku", "uyku");
        }
        ekle(1, "18:15", "19:00", "Spor", "spor");
        ekle(3, "18:15", "19:00", "Spor", "spor");
        ekle(5, "10:00", "12:00", "Ev işleri", "genel");
        ekle(5, "14:00", "18:00", "Sosyal / gezme", "serbest");
        ekle(6, "11:00", "13:00", "Haftalık plan + hazırlık", "genel");
        ekle(6, "15:00", "18:00", "Dinlenme", "serbest");
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
