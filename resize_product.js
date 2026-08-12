#!/usr/bin/env node
/**
 * Resize & center product images for WooCommerce / online store.
 *
 * Input  : gambar produk (background transparan ATAU putih/solid).
 * Output : gambar persegi, produk di tengah, ada padding, aspect ratio
 *          produk tetap (tidak distorsi).
 *
 * Usage
 * -----
 *   # satu file
 *   npm run resize -- source/original.png out.png
 *
 *   # batch (seluruh file di folder)
 *   npm run resize -- source/ output/ --size 1000 --padding 0.15
 *
 *   # override ukuran & padding, background putih
 *   npm run resize -- in.png out.png --size 1200 --padding 0.20 --bg #ffffff
 */

const sharp = require("sharp");
const { existsSync, statSync, mkdirSync } = require("node:fs");
const { join, extname, basename, dirname } = require("node:path");

const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tiff"]);

function parseArgs(argv) {
  const args = { size: 1000, padding: 0.15, bg: null, prefix: "resized_", format: "webp", quality: 82, _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--size") args.size = parseInt(argv[++i], 10);
    else if (a === "--padding") args.padding = parseFloat(argv[++i]);
    else if (a === "--bg") {
      const v = argv[++i];
      if (v == null || v === "" || v.startsWith("--")) {
        console.error('error: --bg butuh nilai. Quote "#" di-shell: --bg "#ffffff" (atau tanpa #: --bg ffffff)');
        process.exit(1);
      }
      args.bg = v;
    }
    else if (a === "--prefix") args.prefix = argv[++i] ?? "";
    else if (a === "--format") args.format = String(argv[++i] || "png").toLowerCase();
    else if (a === "--quality") args.quality = parseInt(argv[++i], 10);
    else if (a === "-h" || a === "--help") args.help = true;
    else args._.push(a);
  }
  return args;
}

function usage() {
  console.log(`Usage: npm run resize -- <input> <output> [options]

  input     file gambar ATAU folder (batch)
  output    file output ATAU folder tujuan (batch)

Options:
  --size N        ukuran canvas persegi (px). default 1000
  --padding F     fraksi padding 0..0.9. default 0.15 (15%)
  --bg COLOR      warna background, mis. "#ffffff". default: transparan
                  (di-shell, "#" harus di-quote: --bg "#ffffff" atau --bg ffffff)
  --format F      png | jpeg | webp. default webp (transparan + kecil)
  --quality N     1..100 (untuk jpeg/webp). default 82
  --prefix STR    prefix nama file output (batch). default "resized_"
                  "" untuk tanpa prefix
  -h, --help      bantuan

Contoh:
  npm run resize -- source/original.png output/out.png
  npm run resize -- source/ output/ --size 1000 --padding 0.15
  npm run resize -- in.png out.png --size 1200 --padding 0.20 --bg "#ffffff"
  npm run resize -- source/ output/ --format webp --quality 80`);
}

/** Bounding box konten produk (exclude background). */
async function getBbox(path) {
  const { data, info } = await sharp(path)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height, ch = info.channels;
  const at = (x, y) => (y * w + x) * ch;

  // cek apakah ada alpha transparan signifikan -> mode transparan
  let hasTransparent = false;
  for (let i = 3; i < data.length; i += ch) {
    if (data[i] < 24) { hasTransparent = true; break; }
  }

  let minX = w, minY = h, maxX = -1, maxY = -1;
  if (hasTransparent) {
    // trim area transparan
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (data[at(x, y) + 3] >= 24) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
  } else {
    // fallback: background = warna pojok kiri-atas, trim warna itu (tol 16)
    const br = data[0], bg = data[1], bb = data[2];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const o = at(x, y);
        const diff =
          Math.abs(data[o] - br) +
          Math.abs(data[o + 1] - bg) +
          Math.abs(data[o + 2] - bb);
        if (diff >= 16) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
  }
  if (maxX < 0) return null;
  return { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

async function resizeCenter(src, dst, opts) {
  const { size, padding, bg, format, quality } = opts;
  const bbox = await getBbox(src);

  // jpeg tidak punya alpha -> default bg putih kalau tidak ditentukan
  const bgColor = bg
    ? hexToRgb(bg)
    : format === "jpeg"
      ? { r: 255, g: 255, b: 255, alpha: 255 }
      : { r: 0, g: 0, b: 0, alpha: 0 };

  if (!bbox) {
    // tidak ada konten -> canvas kosong
    await sharp({
      create: { width: size, height: size, channels: 4, background: bgColor },
    })[format === "jpeg" ? "jpeg" : format === "webp" ? "webp" : "png"](
      format === "png" ? { compressionLevel: 9 } : { quality }
    ).toFile(dst);
    return;
  }

  const box = Math.round(size * (1 - padding));
  const scale = Math.min(box / bbox.width, box / bbox.height);
  const newW = Math.max(1, Math.round(bbox.width * scale));
  const newH = Math.max(1, Math.round(bbox.height * scale));

  const product = await sharp(src)
    .extract(bbox)
    .resize(newW, newH, { fit: "fill" })
    .toBuffer();

  let pipeline = sharp({
    create: { width: size, height: size, channels: 4, background: bgColor },
  }).composite([{
    input: product,
    left: Math.round((size - newW) / 2),
    top: Math.round((size - newH) / 2),
  }]);

  if (format === "jpeg") {
    // jpeg: flatten alpha ke bg
    pipeline = pipeline.flatten({ background: { r: bgColor.r, g: bgColor.g, b: bgColor.b } })
      .jpeg({ quality, mozjpeg: true });
  } else if (format === "webp") {
    pipeline = pipeline.webp({ quality });
  } else {
    pipeline = pipeline.png({ compressionLevel: 9 });
  }

  await pipeline.toFile(dst);
}

function hexToRgb(hex) {
  // tolerate leading '#' (yang di-shell jadi komentar kalau tidak di-quote)
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) throw new Error(`invalid --bg color: ${hex} (pakai #rrggbb atau rrggbb)`);
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, alpha: 255 };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || args._.length < 2) { usage(); process.exit(args.help ? 0 : 1); }

  if (!["png", "jpeg", "webp"].includes(args.format)) {
    console.error(`error: --format harus png | jpeg | webp (dapat: ${args.format})`);
    process.exit(1);
  }
  const opts = {
    size: args.size, padding: args.padding, bg: args.bg,
    format: args.format, quality: args.quality,
  };
  const ext = args.format === "jpeg" ? "jpg" : args.format;

  const [inPath, outPath] = args._;
  if (!existsSync(inPath)) {
    console.error(`error: input tidak ditemukan: ${inPath}`);
    process.exit(1);
  }

  const isDir = statSync(inPath).isDirectory();

  if (!isDir) {
    mkdirSync(dirname(outPath), { recursive: true });
    await resizeCenter(inPath, outPath, opts);
    const kb = (statSync(outPath).size / 1024).toFixed(0);
    console.log(`OK  ${inPath} -> ${outPath}  (${args.size}x${args.size}, ${args.format}, ${kb}KB)`);
    return;
  }

  // batch
  if (!existsSync(outPath)) mkdirSync(outPath, { recursive: true });
  const { readdirSync } = require("node:fs");
  const files = readdirSync(inPath)
    .filter((f) => IMAGE_EXTS.has(extname(f).toLowerCase()))
    .sort();
  if (!files.length) {
    console.error(`tidak ada gambar di ${inPath}`);
    process.exit(1);
  }
  let totalKb = 0;
  for (const f of files) {
    const src = join(inPath, f);
    const dst = join(outPath, `${args.prefix}${basename(f, extname(f))}.${ext}`);
    await resizeCenter(src, dst, opts);
    const kb = statSync(dst).size / 1024;
    totalKb += kb;
    console.log(`OK  ${f} -> ${basename(dst)}  (${kb.toFixed(0)}KB)`);
  }
  console.log(`\n${files.length} gambar diproses -> ${outPath}  (total ${totalKb.toFixed(0)}KB)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
