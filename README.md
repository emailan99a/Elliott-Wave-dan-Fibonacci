# Elliott Wave Scanner

Prototype aplikasi web lokal untuk memilih satu aset, melihat chart TradingView 1D, lalu membuat ringkasan Elliott Wave dan Fibonacci.

## Jalankan

```bash
npm start
```

Jika `npm` tidak tersedia, jalankan langsung:

```bash
node server.mjs
```

Buka `http://127.0.0.1:4173`.

Jangan membuka `public/index.html` langsung dengan `file://`, karena API scan, CSS, JavaScript, dan widget chart perlu berjalan melalui server lokal.

## Cara Kerja

- Dropdown market berisi Crypto, Saham Amerika, dan Saham Indonesia.
- Dropdown aset berisi 100 aset sesuai market yang dipilih.
- Chart memakai TradingView Advanced Chart widget dengan interval 1D.
- Analisa berjalan otomatis setelah market atau aset dipilih.
- Crypto: daftar aset dan histori harga 1D berasal dari CoinGecko.
- Saham Amerika: Stooq, lalu Yahoo Finance sebagai fallback.
- Saham Indonesia: Yahoo Finance dengan simbol `.JK`.
- TradingView dipakai sebagai chart viewer resmi, bukan untuk scraping data.
- Output analisa memuat bias bullish/bearish, potensi range top, potensi range bottom, chart prediksi sederhana, entry, TP, SL, minimal risk ratio 2:1, dan status apakah kondisi saat ini sudah ideal untuk trade.
- Jika setup tidak memenuhi confidence dan rasio minimal, aplikasi menampilkan `Skip trade`.

## Catatan

Elliott Wave bersifat subjektif. Output aplikasi ini cocok untuk menyaring kandidat chart yang perlu dicek manual, bukan sinyal trading otomatis.
