const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { report, reportError, reportFailure } = require('./reporter');

const SOURCE = path.join(process.cwd(), 'public', 'logo.png');
const OUT_DIR = path.join(process.cwd(), 'public', 'icons');

const BACKGROUND = { r: 255, g: 255, b: 255, alpha: 1 };
const THEME = { r: 15, g: 23, b: 42, alpha: 1 };

const TARGETS = [
  { file: 'icon-192.png', size: 192, inset: 0.86, background: BACKGROUND },
  { file: 'icon-512.png', size: 512, inset: 0.86, background: BACKGROUND },
  { file: 'icon-192-maskable.png', size: 192, inset: 0.6, background: BACKGROUND },
  { file: 'icon-512-maskable.png', size: 512, inset: 0.6, background: BACKGROUND },
  { file: 'apple-touch-icon.png', size: 180, inset: 0.78, background: BACKGROUND },
  { file: 'icon-monochrome-512.png', size: 512, inset: 0.6, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  { file: 'favicon-32.png', size: 32, inset: 0.92, background: BACKGROUND }
];

async function build() {
  if (!fs.existsSync(SOURCE)) {
    throw new Error(`Source logo not found at ${SOURCE}`);
  }

  await fs.promises.mkdir(OUT_DIR, { recursive: true });

  const meta = await sharp(SOURCE).metadata();
  report(`Source: logo.png (${meta.width}x${meta.height})`);
  report(`Writing to public/icons`);
  report('');

  for (const target of TARGETS) {
    const inner = Math.round(target.size * target.inset);

    const logo = await sharp(SOURCE)
      .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .toBuffer();

    await sharp({
      create: {
        width: target.size,
        height: target.size,
        channels: 4,
        background: target.background
      }
    })
      .composite([{ input: logo, gravity: 'center' }])
      .png({ compressionLevel: 9 })
      .toFile(path.join(OUT_DIR, target.file));

    const { size } = await fs.promises.stat(path.join(OUT_DIR, target.file));
    report(`  ${target.file.padEnd(28)} ${String(target.size).padStart(3)}px  ${(size / 1024).toFixed(1)} KB`);
  }

  report('');
  report(`Done. ${TARGETS.length} icons generated.`);
  report(`Theme colour: rgb(${THEME.r} ${THEME.g} ${THEME.b})`);
}

build().catch((error) => {
  reportError('Icon generation failed.');
  reportFailure(error);
  process.exitCode = 1;
});
