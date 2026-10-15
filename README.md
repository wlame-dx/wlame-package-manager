# WLAME Hub

**Windows için sade ve hızlı uygulama merkezi.** Keşfet, tek tıkla indir, güncellemeleri otomatik al.

<p align="center">
  <b>🔇 Reklam yok · 📦 Takip yok · 🚀 Tek tıkla kurulum</b>
</p>

---

## Ne yapar?

WLAME Hub, uygulamaları tek bir yerden indirmeni ve güncel tutmanı sağlayan küçük bir masaüstü uygulamasıdır:

- **Tek tıkla indir** — istediğin uygulamayı saniyeler içinde indir.
- **Sürüm seçimi** — bir uygulamada birden fazla indirilebilir dosya varsa hangisini istediğin sorulur.
- **Otomatik güncelleme** — program arka planda çalışır; kurulu uygulamalarda yeni sürüm çıktığında indirir ve seni bilgilendirir.
- **Hep güncel kütüphane** — yeni uygulamalar eklendiği anda koleksiyonda belirir, programı yenilemen gerekmez.
- **Sade arayüz** — gözü yormayan koyu gradyan tasarım, arama ve README görüntüleme dahil.

## İndirme

👉 [**Son sürümü indir**](https://github.com/wlame-dx/wlame-package-manager/releases/latest)

Windows 10/11 üzerinde çalışır.

## Kullanım

1. Uygulamayı aç — koleksiyon otomatik yüklenir.
2. Beğendiğin uygulamaya **İndir** de.
3. Birden fazla seçenek varsa istediğin dosyayı seç.
4. Dosyalar `Downloads/WLAME Hub` klasörüne iner.
5. Sağ üstteki ⟳ düğmesiyle güncellemeleri anında kontrol edebilirsin.

### Arka planda çalışmak

Uygulama, **Ayarlar → Bilgisayar açılınca başlat** açıkken Windows açılışında kendiliğinden arka planda başlar ve sistem tepsisinde kalır. Sağ tık menüsünden kontrol yapabilir veya çıkış yapabilirsin.

### Otomatik güncelleme

**Ayarlar → Güncellemeleri otomatik indir** açıkken kurulu uygulamaların yeni sürümleri sessizce indirilir ve masaüstü bildirimi gönderilir.

## Ekran görüntüsü

Koyu gradyan arayüz, kart tabanlı koleksiyon, sürüm seçimi ve README görüntüleme — hepsi tek pencerede.

## Geliştirme

Gereksinimler: [Node.js](https://nodejs.org) 18+

```bash
npm install     # bağımlılıkları kur
npm start       # uygulamayı çalıştır
npm test        # birim testleri (19 test)
npm run test:api  # canlı API bütünleşik testi
npm run smoke   # pencere + renderer duman testi
npm run icons   # simgeleri yeniden üret
```

### Proje yapısı

```
main/        ana süreç: pencere, tray, indirici, güncelleme kontrolü
renderer/    arayüz (HTML/CSS/JS, çerçeve yok)
docs/        GitHub Pages tanıtım sitesi
test/        birim + bütünleşik testler
scripts/     simge üretimi
```

## Lisans

[MIT](LICENSE)
