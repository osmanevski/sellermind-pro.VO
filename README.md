# SellerMindPro.VO

eBay satıcıları için yapay zekâ destekli müşteri hizmetleri ve ürün araştırma asistanı.

SellerMindPro.VO, açık eBay konuşmasını okuyarak iki farklı şekilde yardımcı olan, saf JavaScript ile geliştirilmiş bir Chrome Manifest V3 uzantısıdır:

- **Satıcı asistanı:** Sorularınızı yanıtlar ve konuşmayı yorumlamanıza yardımcı olur.
- **Müşteri taslağı:** Mağaza politikalarınıza uygun, eBay'e aktarılabilir İngilizce yanıt hazırlar.

> Sürüm 2.0 · Bera Toprak & Osman Çekilmez

## İçindekiler

- [Öne çıkan özellikler](#öne-çıkan-özellikler)
- [Nasıl çalışır?](#nasıl-çalışır)
- [Kurulum](#kurulum)
- [İlk yapılandırma](#ilk-yapılandırma)
- [Kullanım](#kullanım)
- [API sağlayıcıları ve modeller](#api-sağlayıcıları-ve-modeller)
- [Ürün araştırma](#ürün-araştırma)
- [Alexa'ya Sor akışı](#alexaya-sor-akışı)
- [Şablonlar](#şablonlar)
- [Güncelleme](#güncelleme)
- [Sorun giderme](#sorun-giderme)
- [Gizlilik ve güvenlik](#gizlilik-ve-güvenlik)
- [Teknik yapı](#teknik-yapı)
- [Bilinen kısıtlar](#bilinen-kısıtlar)

## Öne çıkan özellikler

- **Çift API sağlayıcısı:** OpenRouter veya doğrudan Anthropic Claude API.
- **Anlık model seçimi:** Sağlayıcı ve model, eBay üzerindeki SellerMind panelinden değiştirilebilir.
- **İki yanıt modu:** Satıcıyla sohbet eden `ASSISTANT` modu ve müşteriye mesaj hazırlayan `DRAFT` modu.
- **Talimat odaklı çalışma:** Panel açıldığında otomatik yanıt üretmez; satıcının komutunu bekler.
- **Hızlı yönergeler:** Kısa yanıt, empatik yaklaşım, politika açıklaması ve çözüm önerisi tek tıkla uygulanır.
- **Konuşma bağlamı:** Açık eBay konuşmasındaki son müşteri mesajını ve önceki mesajları kullanır.
- **Mağaza politikaları:** Kargo, hazırlık, iade ve tazminat kuralları taslaklara eklenir.
- **Ürün araştırma:** Yüklü CSV listesinden (eBay no ↔ Amazon ASIN) eşleştirme ve Amazon ürün sayfasından bilgi toplama.
- **Alexa'ya Sor:** Müşteri sorusunu haricî asistana sorulabilecek bağımsız bir soruya dönüştüren manuel araştırma akışı.
- **Hazır şablonlar:** Widget'tan veya eBay mesaj kutusunun yanındaki 📋 düğmesinden kullanılabilir.
- **Taslak araçları:** eBay'e aktar, kopyala, yeniden oluştur, puanla ve hızlı rötuş seçenekleri.
- **Bağlama duyarlı görünürlük:** Widget yalnızca eBay mesajlaşma ekranlarında gösterilir.
- **Yerel ayarlar ve yedekleme:** Ayarlar Chrome deposunda tutulur; API anahtarları yedeğe eklenmez.
- **Derleme gerektirmez:** Framework, paket yöneticisi veya build adımı yoktur.

## Nasıl çalışır?

```text
eBay konuşması
      │
      ▼
SellerMind widget'ı konuşma bağlamını çıkarır
      │
      ├── Satıcı soru yazar ──► ASSISTANT ──► Satıcıya açıklama
      │
      ├── Hızlı yönerge ─────► DRAFT ──────► Müşteriye gönderilecek taslak
      │
      ├── Ürün Araştır ──────► CSV eşlemesi + Amazon bilgisi iç bağlama eklenir
      │
      └── Alexa'ya Sor ──────► Manuel araştırma cevabı iç bağlama eklenir
```

Model yanıtlarında dahili olarak `[[ASSISTANT]]` veya `[[DRAFT]]` işareti kullanılır. Bu işaretler kullanıcıya gösterilmez.

### ASSISTANT modu

Satıcının doğrudan sorduğu sorulara cevap verir:

- “Bu müşteri ne istiyor?”
- “Bu sonucu ürün bilgilerinden nasıl çıkardın?”
- “Sence iade teklif etmek doğru mu?”

Bu cevaplarda **eBay'e Aktar** araçları gösterilmez ve cevap müşteri yanıtı istatistiklerine eklenmez.

### DRAFT modu

Müşteriye gönderilecek mesaj oluşturur:

- Hızlı yönerge düğmeleri
- Kısalt / Daha empatik / Daha resmî gibi rötuşlar
- Yeniden oluşturma
- Seçili metni yeniden yazma
- Yapıştırılan Alexa araştırma cevabını müşteri mesajına dönüştürme

Panelin hızlı yönergeleri ve açık taslak işlemleri `DRAFT` moduna zorlanır. Model yanlış modu döndürür veya müşteri mesajını göremediğini söylerse sistem bir kez düzeltme isteği gönderir.

## Kurulum

Uzantı Chrome Web Store'da yayımlanmamıştır. **Paketlenmemiş uzantı** olarak yüklenir.

### Gereksinimler

- Google Chrome veya Chromium tabanlı uyumlu bir tarayıcı
- Git
- OpenRouter ve/veya Anthropic API anahtarı
- Ürün araştırması için (opsiyonel) eBay no ↔ Amazon ASIN eşlemesi içeren bir CSV listesi

### 1. Depoyu klonlayın

Windows PowerShell veya CMD:

```cmd
cd %USERPROFILE%\Desktop
git clone https://github.com/osmanevski/sellermind-pro.VO.git
```

macOS veya Linux:

```bash
cd ~/Desktop
git clone https://github.com/osmanevski/sellermind-pro.VO.git
```

Git yüklü değilse [git-scm.com](https://git-scm.com/downloads) adresinden kurabilirsiniz.

### 2. Chrome'a yükleyin

1. Adres çubuğunda `chrome://extensions` sayfasını açın.
2. Sağ üstten **Geliştirici modu**nu etkinleştirin.
3. **Paketlenmemiş öğe yükle** düğmesine basın.
4. Klonlanan `sellermind-pro.VO` klasörünü seçin.
5. Kolay erişim için SellerMind uzantısını araç çubuğuna sabitleyin.

## İlk yapılandırma

Chrome araç çubuğundaki SellerMind simgesine tıklayın.

### Ayarlar

- **OpenRouter API Anahtarı:** [openrouter.ai/settings/keys](https://openrouter.ai/settings/keys)
- **Claude API Anahtarı:** [console.anthropic.com](https://console.anthropic.com/)
- **Mağaza Adı:** Müşteri mesajının imzasında kullanılabilir.
- **Temsilci Adı:** Yanıt kapanışında kullanılır.
- **Ürün Listesi CSV'si:** Ürün araştırması için (opsiyonel) — **Ürün Araştırma (CSV)** bölümünden yüklenir.

İki API anahtarını birden girmek zorunda değilsiniz. Kullanacağınız sağlayıcının anahtarı yeterlidir.

### Politikalar

Aşağıdaki alanları gerçek mağaza kurallarınıza göre düzenleyin:

- Kargo politikası
- Hazırlık süresi
- İade politikası
- İndirim veya tazminat limiti

Modelin hatalı vaatlerde bulunmasını azaltmak için bu alanları boş bırakmamanız önerilir.

## Kullanım

1. eBay'de **Mesajlar** bölümünde bir konuşma açın veya siparişten **Message Buyer** penceresine geçin.
2. Sağ alttaki **✦** düğmesine basın.
3. SellerMind açık konuşmanın son müşteri mesajını ve konuşma geçmişini alır.
4. Sağlayıcı ve modeli panelin üst kısmından seçin.
5. Satıcı asistanına bir soru yazın veya hızlı yönerge seçin.
6. Oluşturulan müşteri taslağını kontrol edin.
7. **eBay'e Aktar** ile mesaj kutusuna yerleştirin; gönderme işlemini eBay üzerinden siz tamamlayın.

SellerMind mesajları kendiliğinden göndermez.

### Hızlı yönergeler

- **Kısa yanıtla:** Kısa ve doğrudan müşteri taslağı
- **Empatik ol:** Duyguyu kabul eden çözüm odaklı taslak
- **Politikayı açıkla:** İlgili mağaza politikasını açıklayan taslak
- **Çözüm öner:** Sorunu tekrarlamadan uygulanabilir çözüm sunan taslak

### Taslak üzerindeki araçlar

- **eBay'e Aktar:** Taslağı eBay mesaj alanına yerleştirir.
- **Kopyala:** Panoya kopyalar.
- **Yeniden:** Farklı bir sürüm üretir.
- **👍 / 👎:** Yanıt değerlendirmesini yerel istatistiklere kaydeder.
- **Rötuş çipleri:** Kısaltma, empati, resmiyet, indirim veya iade yaklaşımını değiştirir.

### Klavye kısayolları

- `Alt + S`: SellerMind widget'ını açar/kapatır.
- `Alt + R`: Açık konuşmadaki son mesaj için hızlı oturum başlatır.

Kısayolları `chrome://extensions/shortcuts` sayfasından değiştirebilirsiniz.

## API sağlayıcıları ve modeller

| Sağlayıcı | Model | Kullanım yaklaşımı |
|---|---|---|
| OpenRouter | Gemini 3.1 Flash Lite | Ekonomik ve yüksek hacimli kullanım |
| OpenRouter | GPT-5.4 Mini | Dengeli kalite ve maliyet |
| OpenRouter | Claude Haiku 4.5 | Daha güçlü yazım seçeneği |
| Claude API | Claude Haiku 4.5 | Ekonomik doğrudan Anthropic bağlantısı |
| Claude API | Claude Sonnet 5 | Dengeli doğrudan Anthropic seçeneği |
| Claude API | Claude Opus 4.8 | Premium doğrudan Anthropic seçeneği |

Model listesi kodda `content.js` içindeki `PROVIDER_MODELS` yapısında tanımlıdır. Sağlayıcı veya model kullanılabilirliği değişirse bu kimliklerin güncellenmesi gerekebilir.

API kullanımı ücretlidir. Ücretlendirme, kota ve veri saklama kuralları seçtiğiniz sağlayıcıya aittir.

## Ürün araştırma

Ürün eşleştirme artık Easync'e canlı bağlanmaz; bir kez yüklediğin **CSV ürün listesi** üzerinden yerelde yapılır. Bu hem daha hızlıdır (arka planda sekme açılmaz) hem de Easync bağımlılığını kaldırır.

**🔍 Ürün Araştır** akışı şu sırayla çalışır:

1. Açık eBay konuşmasındaki ürün bağlantısından sayısal eBay item ID çıkarılır.
2. Yüklü CSV eşlemesinde bu item ID (Target Product Id) aranır ve karşılığındaki Amazon ASIN'i (Source Product Id) anında alınır.
3. Eşleşme yoksa ürün başlığıyla Amazon araması yapılır (yedek).
4. `https://www.amazon.com/dp/<ASIN>` sayfasından başlık, fiyat, puan, özellikler, teknik bilgiler ve açıklama okunur.
5. Bulunan ASIN için tıklanabilir **Amazon'da Aç** bağlantısı gösterilir.
6. Toplanan bilgiler müşteriye gösterilmeden SellerMind'ın iç bağlamına eklenir.
7. Satıcı bir yönerge verene kadar müşteri taslağı oluşturulmaz.

### CSV ürün listesi nasıl yüklenir?

1. Easync / dropship panelinden ilanlarını CSV olarak dışa aktar. Dosyada en az şu sütunlar bulunmalı:
   - `Target Product Id` — eBay ilan no'su
   - `Source Product Id` — Amazon ASIN
2. Uzantı ikonuna tıkla → **Ayarlar → Ürün Araştırma (CSV) → 📄 CSV Yükle** ve dosyayı seç.
3. Eşleşen ürün sayısı gösterilir (ör. "✅ 7066 ürün eşlemesi yüklü").

Eşleme `chrome.storage.local` içinde saklanır; her araştırmada anında okunur. Liste güncellendiğinde yeni CSV'yi tekrar yükle. **🗑️ Temizle** ile eşlemeyi silebilirsin. CSV yüklü değilse veya ürün listede yoksa, araştırma otomatik olarak Amazon başlık aramasına düşer.

> Bu özellik bir Amazon, Alexa veya Rufus API entegrasyonu değildir. Eşleştirme yerel CSV'den yapılır; ürün bilgisi Amazon ürün sayfasının tarayıcı üzerinden okunmasına dayanır.

## Alexa'ya Sor akışı

**🔊 Alexa'ya Sor** manuel bir araştırma yardımcısıdır:

1. Müşterinin ürün sorusu bağımsız ve kopyalanabilir bir soruya dönüştürülür.
2. Bu soruyu Amazon'un asistanına siz sorarsınız.
3. Aldığınız cevabı SellerMind giriş alanına yapıştırırsınız.
4. SellerMind cevabı iç ürün bilgisi olarak kullanır.
5. Müşteriye uygun bir taslak üretir.

Müşteri taslağında Alexa, Amazon, araştırma veya haricî kaynak adı belirtilmez.

## Şablonlar

Popup ekranındaki **Politikalar → Şablon Yöneticisini Aç** bağlantısıyla şablonlar oluşturulabilir.

Desteklenen kategoriler:

- Genel
- İade
- Kargo
- Geri gönderim
- Arızalı veya hasarlı ürün

Şablon yöneticisi şablon ekleme, düzenleme, silme ve seçilen API sağlayıcısıyla metni iyileştirme işlevlerini içerir.

Kayıtlı şablonlara iki yerden erişilebilir:

- SellerMind widget'ındaki **📋 Şablonlar** düğmesi
- eBay'in mesaj gönderme alanının yanına eklenen küçük **📋** düğmesi

Seçilen şablon eBay mesaj alanına yerleştirilir; otomatik gönderilmez.

## İstatistikler ve yedekleme

Popup içindeki **İstatistik** sekmesi şunları gösterir:

- Toplam oluşturulan müşteri taslağı
- Bugünkü taslaklar
- Son yedi gündeki taslaklar
- Duygu dağılımı
- Kullanıcı puanlarının ortalaması

ASSISTANT modunda satıcıya verilen açıklamalar müşteri taslağı sayılmaz.

**Dışa Aktar** ayarları, politikaları, şablonları ve geçmiş verilerini JSON olarak kaydeder. OpenRouter ve Anthropic API anahtarları dışa aktarılmaz. İçe aktarma sırasında tarayıcıda bulunan mevcut API anahtarları korunur.

## Güncelleme

Yeni sürümü almak için proje klasöründe:

macOS veya Linux:

```bash
git -C ~/Desktop/sellermind-pro.VO pull --ff-only origin main
```

Windows:

```cmd
git -C %USERPROFILE%\Desktop\sellermind-pro.VO pull --ff-only origin main
```

Ardından:

1. `chrome://extensions` sayfasını açın.
2. SellerMind kartındaki **Yeniden yükle** düğmesine basın.
3. Açık eBay sekmelerini kapatıp yeniden açın veya tam yenileme yapın:
   - Windows/Linux: `Ctrl + Shift + R`
   - macOS: `Cmd + Shift + R`

API anahtarları, şablonlar ve politikalar `chrome.storage.local` içinde tutulduğu için Git güncellemesiyle silinmez.

### Yerel dosyalarda değişiklik varsa

Önce değişiklikleri kontrol edin:

```bash
git status
```

Yerel değişiklikleri silmek geri alınamaz. Ne yaptığınızı bilmiyorsanız `git reset --hard` kullanmayın.

## Sorun giderme

### Widget görünmüyor

- Normal bir eBay ürün veya ana sayfasında değil, mesaj konuşmasında olduğunuzu kontrol edin.
- `chrome://extensions` üzerinden uzantıyı yeniden yükleyin.
- eBay sekmesini tam yenileyin veya yeniden açın.
- Mesajlar sayfasının tamamen yüklenmesini bekleyin.

### “Açık bir mesaj konuşması bulunamadı” uyarısı

- Bir konuşmanın gerçekten açık olduğundan emin olun.
- eBay arayüz dili veya DOM yapısı değişmiş olabilir.
- Sekmeyi yenileyip ✦ düğmesine tekrar basın.

### Hızlı yönerge müşteri taslağı yerine satıcıya cevap veriyor

- Uzantının güncel sürümünü çekin ve Chrome'da yeniden yükleyin.
- eBay sekmesini tam yenileyin; eski content script açık sekmede çalışmaya devam edebilir.
- Güncel sürüm hızlı yönergeleri zorunlu `DRAFT` modunda çalıştırır ve yanlış modu bir kez otomatik düzeltir.

### API anahtarı hatası

- Panelde seçilen sağlayıcının anahtarını girdiğinizden emin olun.
- OpenRouter anahtarı `sk-or-...`, Anthropic anahtarı `sk-ant-...` biçimindedir.
- Sağlayıcının bakiye, kota ve model erişimini kontrol edin.

### Ürün bulunamıyor

- Ayarlar → Ürün Araştırma (CSV) bölümünde bir listenin yüklü olduğunu kontrol edin.
- CSV'de `Target Product Id` (eBay no) ve `Source Product Id` (ASIN) sütunlarının bulunduğundan emin olun.
- İlgili eBay item ID'sinin CSV'de yer aldığını kontrol edin; yeni ilanlar için güncel CSV'yi tekrar yükleyin.
- Amazon doğrulama veya bot kontrolü gösteriyorsa sayfa kazıma başarısız olabilir.
- **Amazon'da Aç** bağlantısı oluştuysa ürünü elle doğrulayın.

### eBay'e Aktar çalışmıyor

- Mesaj kutusunun açık olduğundan emin olun.
- eBay sayfasını yenileyin.
- Taslağı **Kopyala** ile alıp elle yapıştırmayı deneyin.
- eBay mesaj alanının HTML yapısı değişmiş olabilir.

## Gizlilik ve güvenlik

- API anahtarları `chrome.storage.local` içinde saklanır.
- API anahtarları dışa aktarılan yedek dosyasına eklenmez.
- Uzantının ayrı bir SellerMind sunucusu veya veritabanı yoktur.
- Model isteği sırasında müşteri mesajı, konuşma bağlamı, mağaza bilgileri ve ilgili politikalar seçilen API sağlayıcısına gönderilebilir.
- Ürün araştırmasında eşleştirme yerel CSV'den yapılır; yalnızca Amazon ürün sayfası arka plan sekmesinde açılıp okunur.
- SellerMind müşteri mesajını otomatik göndermez; son kontrol ve gönderme sorumluluğu satıcıdadır.
- API anahtarlarını kaynak koduna, README'ye, Git deposuna veya ekran görüntülerine eklemeyin.

Kullanımdan önce OpenRouter, Anthropic, eBay ve Amazon'un geçerli kullanım ve gizlilik koşullarını inceleyin.

## İzinler

Manifest aşağıdaki temel Chrome izinlerini kullanır:

| İzin | Amaç |
|---|---|
| `storage` | Ayarları, anahtarları, şablonları ve geçmişi yerel olarak saklamak |
| `tabs` / `activeTab` | Açık eBay konuşmasını ve araştırma sekmelerini yönetmek |
| `scripting` | Amazon ürün sayfalarından gerekli bilgileri okumak |
| `contextMenus` | Seçili eBay metni için SellerMind işlemi sunmak |
| `notifications` | Uzantı bildirimleri için altyapı |

Host izinleri eBay, Amazon, OpenRouter ve Anthropic API alan adlarıyla sınırlıdır; ayrıntılar `manifest.json` dosyasındadır.

## Teknik yapı

SellerMindPro.VO framework kullanmaz. Kod doğrudan Chrome tarafından yüklenen HTML, CSS ve JavaScript dosyalarından oluşur.

| Dosya | Görev |
|---|---|
| `manifest.json` | Manifest V3 tanımı, yetkiler, host izinleri ve kısayollar |
| `background.js` | Service worker, API dağıtımı, geçmiş/istatistik ve ürün araştırma |
| `content.js` | eBay widget'ı, konuşma çıkarma, yanıt modları ve kullanıcı akışları |
| `styles/content.css` | Widget'ın açık/koyu tema ve bileşen stilleri |
| `popup.html` / `popup.js` | Ayarlar, politikalar, istatistik ve yedekleme |
| `templates.html` / `templates.js` | Mesaj şablonu yöneticisi |
| `icons/` | Uzantı simgeleri |

### Geliştirici doğrulaması

JavaScript sözdizimini hızlıca kontrol etmek için:

```bash
node --check background.js
node --check content.js
node --check popup.js
node --check templates.js
```

Manifest JSON doğrulaması:

```bash
node -e "JSON.parse(require('fs').readFileSync('manifest.json', 'utf8')); console.log('manifest valid')"
```

Bu kontroller Chrome üzerinde yapılması gereken canlı eBay/Easync testlerinin yerine geçmez.

## Bilinen kısıtlar

- eBay veya Amazon HTML yapısı değişirse DOM seçicilerinin güncellenmesi gerekebilir.
- Amazon giriş/robot doğrulama ekranları ürün sayfası kazımayı engelleyebilir.
- CSV eşlemesi için eBay item ID'sinin yüklü listede bulunması gerekir; yoksa Amazon başlık aramasına düşülür.
- Amazon başlık araması yanlış varyantı eşleştirebilir; bağlantıyı satıcı doğrulamalıdır.
- Serbest metinde `ASSISTANT`/`DRAFT` seçimini model yapar; açık taslak işlemleri kod seviyesinde zorlanır.
- Sağlayıcı model kimlikleri veya parametre desteği zamanla değişebilir.
- Uzantı yalnızca manifestte listelenen eBay ülke alan adlarında çalışır.
- Mesajlar ve politika kararları gönderilmeden önce satıcı tarafından kontrol edilmelidir.

## Katkı ve dağıtım notları

- Ana dal: `main`
- Uzak depo: `https://github.com/osmanevski/sellermind-pro.VO`
- Build veya paketleme adımı yoktur.
- Değişikliklerden sonra JavaScript ve manifest kontrollerini çalıştırın.
- Chrome'da uzantıyı ve açık eBay sekmelerini yeniden yükleyerek canlı test yapın.
- Gizli anahtarları veya kişisel ayarları commit etmeyin.

## Lisans

Özel proje. Tüm hakları saklıdır. © 2026 SellerMind
