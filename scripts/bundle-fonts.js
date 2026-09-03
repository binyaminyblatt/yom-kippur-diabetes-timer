/**
 * Bundle all required font weights & subsets from @fontsource into public/fonts/
 * and generate public/fonts.css with local relative paths.
 */

const fs = require('fs');
const path = require('path');

const PUBLIC_DIR = path.join(__dirname, '../public');
const FONTS_DEST_DIR = path.join(PUBLIC_DIR, 'fonts');
const FONTS_CSS_PATH = path.join(PUBLIC_DIR, 'fonts.css');

if (!fs.existsSync(FONTS_DEST_DIR)) {
  fs.mkdirSync(FONTS_DEST_DIR, { recursive: true });
}

// Packages and weights we need for the UI
const FONT_CONFIGS = [
  {
    pkg: 'outfit',
    name: 'Outfit',
    weights: [300, 400, 500, 600, 700, 800, 900]
  },
  {
    pkg: 'heebo',
    name: 'Heebo',
    weights: [300, 400, 500, 600, 700, 800, 900]
  },
  {
    pkg: 'rubik',
    name: 'Rubik',
    weights: [300, 400, 500, 600, 700, 800, 900]
  },
  {
    pkg: 'jetbrains-mono',
    name: 'JetBrains Mono',
    weights: [400, 500, 600, 700]
  }
];

let fullCssContent = `/* ==========================================================================
   Internalized Local Fonts (100% Self-Contained - No External Network Calls)
   Families: Outfit, Heebo, Rubik, JetBrains Mono
   ========================================================================== */\n\n`;

let copiedFileCount = 0;

for (const config of FONT_CONFIGS) {
  const pkgDir = path.join(__dirname, '../node_modules/@fontsource', config.pkg);
  const filesDir = path.join(pkgDir, 'files');

  if (!fs.existsSync(pkgDir)) {
    console.error(`Missing font package: @fontsource/${config.pkg}`);
    continue;
  }

  fullCssContent += `/* --------------------------------------------------------------------------\n`;
  fullCssContent += `   Font Family: ${config.name}\n`;
  fullCssContent += `   -------------------------------------------------------------------------- */\n\n`;

  for (const weight of config.weights) {
    const weightCssPath = path.join(pkgDir, `${weight}.css`);
    if (fs.existsSync(weightCssPath)) {
      let weightCss = fs.readFileSync(weightCssPath, 'utf8');

      // Find all referenced woff2 files in this CSS
      const woff2Regex = /url\(\.\/files\/([^)]+\.woff2)\)/g;
      let match;
      while ((match = woff2Regex.exec(weightCss)) !== null) {
        const filename = match[1];
        const srcPath = path.join(filesDir, filename);
        const destPath = path.join(FONTS_DEST_DIR, filename);

        if (fs.existsSync(srcPath) && !fs.existsSync(destPath)) {
          fs.copyFileSync(srcPath, destPath);
          copiedFileCount++;
        }
      }

      // Rewrite CSS URLs to point to fonts/ directory relative to fonts.css
      // Also drop fallback .woff if .woff2 is present for modern lightweight bundling
      weightCss = weightCss.replace(/url\(\.\/files\/([^)]+)\)/g, "url('./fonts/$1')");

      fullCssContent += weightCss + '\n\n';
    }
  }
}

fs.writeFileSync(FONTS_CSS_PATH, fullCssContent, 'utf8');

console.log(`✓ Generated ${FONTS_CSS_PATH}`);
console.log(`✓ Copied ${copiedFileCount} WOFF2 font files into ${FONTS_DEST_DIR}`);
