# YDS Kelime Avı 🎯

Her akşam ~10 dakikada YDS'de en sık çıkan kelimeleri oyunla ezberlemek için küçük bir web uygulaması.
Kurulum gerektirmez, internet olmadan da çalışır, iPhone'da ana ekrana simge olarak eklenir.

## İçerik
- **167 kelime**, 6 grup: Fiiller, İsimler, Sıfatlar, Zarflar, Bağlaçlar/geçiş ifadeleri, Phrasal verb'ler
- Her grup **Kolay / Orta / Zor** olarak ayrılmış
- Her kelimede: Türkçe anlam, eş anlamlılar, YDS tarzı örnek cümle, hafıza ipucu

## Oyunlar
| Mod | Ne yapıyorsun |
|---|---|
| 🃏 Kartlar | Kelimeyle tanış, kartı çevir, ipucunu oku, telaffuzu dinle |
| 🔀 Eşleştir | İngilizce kelimeyi sürükleyip Türkçe anlamına bırak |
| 🧲 Cümleye Sürükle | YDS'deki gibi: doğru kelimeyi cümledeki boşluğa sürükle |
| ⏱️ Hız Turu | 60 saniyede kaç doğru? |

**Günlük görev** bunların hepsini sırayla oynatır: yeni kelimeler + tekrar zamanı gelenler.
Aralıklı tekrar (1-2-4-7-15-30 gün) kullanır; doğru bildiğin kelime daha seyrek, yanlış yaptığın daha sık gelir.
XP, rütbe, combo ve günlük seri (🔥) var. İlerleme telefonda saklanır.

## iPhone'a ekleme
1. Klasörü herhangi bir statik sunucuda yayınla (ör. GitHub Pages)
2. Safari'de adresi aç → Paylaş → **Ana Ekrana Ekle**
3. Artık simgesinden tam ekran uygulama gibi açılır, internet olmadan da çalışır

## Kelime eklemek
`words.js` dosyasına aynı biçimde satır ekle:
```
kelime|türkçe anlam|kategori(v/n/a/r/c/p)|seviye(1-3)|Örnek ___ cümle.|eş, anlamlılar|ipucu
```
