# Product Image Resizer

Resize & center gambar produk untuk WooCommerce / online store. Gambar produk
dipotong (trim background), di-scale preserve aspect ratio, lalu ditempatkan
di tengah canvas persegi dengan padding.

- Background transparan **atau** putih/solid otomatis terdeteksi
- Aspect ratio produk dipertahankan (tidak distorsi)
- Output PNG, ukuran & padding configurable
- Support single file & batch (folder)
- Folder `output/` dibersihkan otomatis setiap run

## Install

```bash
npm install
```

## Pakai

### Contoh cepat

```bash
# reproduce result dari source/original.png -> output/result_new.png
npm run resize:example

# batch: semua gambar di source/ -> output/ (1000x1000, padding 15%)
npm run resize:batch

# single file, background putih 1200px
npm run resize:white
```

### Custom

```bash
npm run resize -- <input> <output> [options]
```

| Option      | Default       | Keterangan                                    |
|-------------|---------------|-----------------------------------------------|
| `--size N`  | `1000`        | ukuran canvas persegi (px)                     |
| `--padding F` | `0.15`      | fraksi padding (`0.15` = 15%)                  |
| `--bg COLOR` | transparan   | warna background, mis. `#ffffff`              |
| `--format F` | `webp`        | `png` \| `jpeg` \| `webp`. webp = transparan + kecil (default) |
| `--quality N` | `82`        | 1..100 (untuk jpeg/webp)                       |
| `--prefix STR` | `resized_`  | prefix nama file output (batch). `""` tanpa prefix |
| `-h`        | —             | bantuan                                        |

**Contoh:**

```bash
# single file
npm run resize -- source/original.png output/out.png --size 1200 --padding 0.20

# batch folder
npm run resize -- source/ output/ --size 1000 --padding 0.15

# background putih
npm run resize -- source/original.png output/out.png --size 1200 --padding 0.20 --bg "#ffffff"

# webp (paling kecil, support transparan)
npm run resize -- source/ output/ --format webp --quality 80

# jpeg dengan bg putih (foto produk, tidak butuh transparan)
npm run resize -- source/ output/ --format jpeg --quality 82 --bg "#ffffff"
```

> **Penting soal `--bg`:** di shell, `#` = awal komentar. Selalu quote:
> `--bg "#ffffff"`, atau pakai tanpa `#`: `--bg ffffff`.

## Ukuran file (perbandingan)

Untuk gambar yang sama, 1000×1000:

| Format          | Ukuran  |
|-----------------|---------|
| PNG (transparan)| ~700KB  |
| JPEG q82        | ~50KB   |
| WebP q80        | ~30KB   |

Untuk foto produk tanpa perlu transparan, pakai `--format webp` atau `--format jpeg --bg "#ffffff"`.

## Cara kerja

1. **Trim background** — deteksi bounding box konten produk (alpha transparan,
   atau fallback deteksi warna pojok kiri-atas untuk bg putih/solid)
2. **Scale** produk agar muat di `size × (1 - padding)`, aspect ratio dipertahankan
3. **Center** di canvas persegi `size × size`
4. **Output** PNG (transparan, atau `--bg` untuk warna solid)

## npm scripts

| Script             | Aksi                                              |
|--------------------|---------------------------------------------------|
| `npm run resize`   | jalankan dengan argumen custom                    |
| `npm run resize:example` | contoh: original → output/result_new.png    |
| `npm run resize:batch`   | batch source/ → output/ (1000x1000, png)     |
| `npm run resize:white`   | contoh background putih 1200px               |
| `npm run resize:webp`    | batch → webp q80 (paling kecil)              |
| `npm run resize:jpeg`    | batch → jpeg q82 + bg putih                 |
| `npm run clean`    | hapus folder `output/`                            |

Setiap `resize*` menjalankan `pre` hook yang menghapus `output/` dulu, jadi
output lama tidak menumpuk.

## Struktur

```
.
├── resize_product.js   # script utama
├── package.json
├── source/             # gambar input
│   ├── original.png
│   └── result.png
└── output/             # hasil (auto-dibuat & dibersihkan tiap run)
```

## Format output

- PNG, RGBA
- Default transparan; `--bg "#ffffff"` untuk putih
- WooCommerce rekomendasi min. 1000×1000px (default `--size 1000`)
