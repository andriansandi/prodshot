<p align="center">
  <img src="web/favicon.svg" width="80" height="80" alt="prodshot logo" />
</p>

<h1 align="center">prodshot</h1>

<p align="center">Resize & center product images for WooCommerce / online stores — entirely in your browser.</p>

---

Resize & center product images for WooCommerce / online stores. The product is
trimmed (background removed), scaled preserving aspect ratio, then placed at the
center of a square canvas with padding.

- Auto-detects transparent **or** white/solid background
- Product aspect ratio preserved (no distortion)
- Output PNG/JPEG/WebP, configurable size & padding
- Single file & batch (folder) support
- `output/` folder auto-cleaned on every run

## Install

```bash
npm install
```

## Usage

### Quick start

```bash
# reproduce result from source/original.png -> output/result_new.png
npm run resize:example

# batch: all images in source/ -> output/ (1000x1000, padding 15%)
npm run resize:batch

# single file, white background, 1200px
npm run resize:white
```

### Custom

```bash
npm run resize -- <input> <output> [options]
```

| Option | Default | Description |
|--------|---------|-------------|
| `--size N` | `1000` | square canvas size (px) |
| `--padding F` | `0.15` | padding fraction (`0.15` = 15%) |
| `--bg COLOR` | transparent | background color, e.g. `#ffffff` |
| `--format F` | `webp` | `png` \| `jpeg` \| `webp`. webp = transparent + small (default) |
| `--quality N` | `82` | 1..100 (for jpeg/webp) |
| `--prefix STR` | `resized_` | output filename prefix (batch). `""` for none |
| `-h` | — | help |

**Examples:**

```bash
# single file
npm run resize -- source/original.png output/out.png --size 1200 --padding 0.20

# batch folder
npm run resize -- source/ output/ --size 1000 --padding 0.15

# white background
npm run resize -- source/original.png output/out.png --size 1200 --padding 0.20 --bg "#ffffff"

# webp (smallest, supports transparency)
npm run resize -- source/ output/ --format webp --quality 80

# jpeg with white bg (product photos, no transparency needed)
npm run resize -- source/ output/ --format jpeg --quality 82 --bg "#ffffff"
```

> **Note on `--bg`:** in the shell, `#` starts a comment. Always quote it:
> `--bg "#ffffff"`, or omit the `#`: `--bg ffffff`.

## How it works

1. **Trim background** — detect the product's bounding box (transparent alpha,
   or fallback to corner-color detection for white/solid backgrounds)
2. **Scale** the product to fit within `size × (1 - padding)`, aspect ratio preserved
3. **Center** on a square `size × size` canvas
4. **Output** PNG (transparent), or `--bg` for a solid color

## npm scripts

| Script | Action |
|--------|--------|
| `npm run resize` | run with custom arguments |
| `npm run resize:example` | example: original → output/result_new.png |
| `npm run resize:batch` | batch source/ → output/ (1000x1000, png) |
| `npm run resize:white` | example, white background 1200px |
| `npm run resize:webp` | batch → webp q80 (smallest) |
| `npm run resize:jpeg` | batch → jpeg q82 + white bg |
| `npm run clean` | delete the `output/` folder |

Every `resize*` script runs a `pre` hook that wipes `output/` first, so stale
outputs never pile up.

## File size comparison

Same image, 1000×1000:

| Format | Size |
|--------|------|
| PNG (transparent) | ~700KB |
| JPEG q82 | ~50KB |
| WebP q80 | ~30KB |

For product photos without transparency, use `--format webp` or
`--format jpeg --bg "#ffffff"`.

## Transparency support

| Format | Transparent? |
|--------|--------------|
| PNG | yes |
| WebP | yes |
| JPEG | no (auto white bg) |

The default (no `--bg`) is transparent. For transparent + small, use WebP:

```bash
npm run resize -- source/ output/ --format webp --quality 80
```

JPEG has no alpha — `--format jpeg` without `--bg` automatically uses a white
background.

## Structure

```
.
├── resize_product.js   # main script (Node.js + sharp)
├── resize_product.py   # alternative (Python + Pillow)
├── package.json
├── source/             # input images
│   └── original.png
└── output/             # results (auto-created & cleaned each run)
```

## Python alternative

`resize_product.py` does the same thing with Pillow:

```bash
pip install Pillow
python resize_product.py source/original.png out.png --size 1000 --padding 0.15
python resize_product.py source/ output/ --size 1000 --padding 0.15
```

## Output format

- PNG/JPEG/WebP, RGBA
- Default transparent; `--bg "#ffffff"` for solid color
- WooCommerce recommends min. 1000×1000px (default `--size 1000`)
