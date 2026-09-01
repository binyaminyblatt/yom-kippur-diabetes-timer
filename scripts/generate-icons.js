const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function generateIcons() {
  const svgPath = path.join(__dirname, '../public/icon.svg');
  const buildDir = path.join(__dirname, '../build');
  const iconsDir = path.join(buildDir, 'icons');

  if (!fs.existsSync(buildDir)) fs.mkdirSync(buildDir, { recursive: true });
  if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir, { recursive: true });

  // Copy SVG
  fs.copyFileSync(svgPath, path.join(buildDir, 'icon.svg'));

  const svgBuffer = fs.readFileSync(svgPath);

  // Generate 512x512 PNG (standard for Electron Builder)
  await sharp(svgBuffer)
    .resize(512, 512)
    .png()
    .toFile(path.join(buildDir, 'icon.png'));

  // Generate standard sizes for Linux / Windows
  const sizes = [16, 24, 32, 48, 64, 128, 256, 512];
  for (const size of sizes) {
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(path.join(iconsDir, `${size}x${size}.png`));
  }

  console.log('✓ Successfully generated build/icon.png, build/icon.svg, and icon set sizes from public/icon.svg!');
}

generateIcons().catch(err => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
