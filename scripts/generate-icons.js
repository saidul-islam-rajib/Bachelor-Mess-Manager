const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { report, reportError, reportFailure } = require('./reporter');

const PUBLIC_DIR = path.join(process.cwd(), 'public');
const SOURCE = path.join(PUBLIC_DIR, 'logo.svg');
if (!fs.existsSync(SOURCE)) {
  throw new Error(`Source logo not found at ${SOURCE}`);
}
const OUT_DIR = path.join(PUBLIC_DIR, 'icons');

const INK = '#0f172a';
const ACCENT = '#f59e0b';
const PAPER = '#ffffff';

const BASE_SVG = fs.readFileSync(SOURCE, 'utf8');

function markSvg({ size, tile, ink, accent, radius }) {
  let svg = BASE_SVG.replace(/\s(width|height)="64"/g, '');

  if (tile) {
    svg = svg.replace(/<rect[^>]*\/>/, `<rect width="64" height="64" rx="${radius === undefined ? 15 : radius}" fill="${tile}"/>`);
  } else {
    svg = svg.replace(/<rect[^>]*\/>/, '');
  }

  svg = svg.replace(/stroke="#ffffff"/g, `stroke="${ink}"`);
  svg = svg.replace(/fill="#f59e0b"/g, `fill="${accent}"`).replace(/stroke="#f59e0b"/g, `stroke="${accent}"`);
  svg = svg.replace('<svg ', `<svg width="${size}" height="${size}" `);

  return Buffer.from(svg);
}

const TARGETS = [
  { file: 'icon-192.png', size: 192, tile: INK, ink: PAPER, accent: ACCENT },
  { file: 'icon-512.png', size: 512, tile: INK, ink: PAPER, accent: ACCENT },
  { file: 'apple-touch-icon.png', size: 180, tile: INK, ink: PAPER, accent: ACCENT },
  { file: 'favicon-32.png', size: 32, tile: INK, ink: PAPER, accent: ACCENT, radius: 8 }
];

const MASKABLE = [
  { file: 'icon-192-maskable.png', size: 192 },
  { file: 'icon-512-maskable.png', size: 512 }
];

async function build() {
  await fs.promises.mkdir(OUT_DIR, { recursive: true });

  report('Source: public/logo.svg (vector)');
  report('');

  for (const target of TARGETS) {
    const svg = markSvg(target);
    await sharp(svg).png({ compressionLevel: 9 }).toFile(path.join(OUT_DIR, target.file));
    const { size } = await fs.promises.stat(path.join(OUT_DIR, target.file));
    report(`  ${target.file.padEnd(28)} ${String(target.size).padStart(4)}px  ${(size / 1024).toFixed(1)} KB`);
  }

  for (const target of MASKABLE) {
    const inner = Math.round(target.size * 0.62);
    const mark = await sharp(markSvg({ size: inner, tile: null, ink: PAPER, accent: ACCENT }))
      .png()
      .toBuffer();

    await sharp({
      create: { width: target.size, height: target.size, channels: 4, background: INK }
    })
      .composite([{ input: mark, gravity: 'center' }])
      .png({ compressionLevel: 9 })
      .toFile(path.join(OUT_DIR, target.file));

    const { size } = await fs.promises.stat(path.join(OUT_DIR, target.file));
    report(`  ${target.file.padEnd(28)} ${String(target.size).padStart(4)}px  ${(size / 1024).toFixed(1)} KB  (safe-zone padded)`);
  }

  const monoInner = 320;
  const mono = await sharp(markSvg({ size: monoInner, tile: null, ink: PAPER, accent: PAPER })).png().toBuffer();
  await sharp({ create: { width: 512, height: 512, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: mono, gravity: 'center' }])
    .png({ compressionLevel: 9 })
    .toFile(path.join(OUT_DIR, 'icon-monochrome-512.png'));
  report(`  ${'icon-monochrome-512.png'.padEnd(28)}  512px  (transparent, single colour)`);

  await sharp(markSvg({ size: 1024, tile: INK, ink: PAPER, accent: ACCENT }))
    .png({ compressionLevel: 9 })
    .toFile(path.join(PUBLIC_DIR, 'logo.png'));
  report('');
  report('  logo.png                     1024px  (raster fallback)');

  const ogMark = await sharp(markSvg({ size: 260, tile: null, ink: PAPER, accent: ACCENT })).png().toBuffer();
  await sharp({ create: { width: 1200, height: 630, channels: 4, background: INK } })
    .composite([{ input: ogMark, gravity: 'center' }])
    .png({ compressionLevel: 9 })
    .toFile(path.join(PUBLIC_DIR, 'og-image.png'));
  report('  og-image.png             1200x630  (link previews)');

  report('');
  report('Done.');
}

build().catch((error) => {
  reportError('Icon generation failed.');
  reportFailure(error);
  process.exitCode = 1;
});
