/**
 * Smart Compliance Engine - Code Security, Bundling & Architecture Analyzer
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT_DIR = path.join(__dirname, '../..');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');

function runCodeSecurityAudit() {
  const issues = [];

  // 1. Check Zero External CDN Dependencies in index.html
  const htmlPath = path.join(PUBLIC_DIR, 'index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');

  const forbiddenDomains = [
    'unpkg.com',
    'cdnjs.cloudflare.com',
    'fonts.googleapis.com',
    'fonts.gstatic.com',
    'cdn.jsdelivr.net',
    'ajax.googleapis.com',
    'maxcdn.bootstrapcdn.com'
  ];

  for (const domain of forbiddenDomains) {
    if (html.includes(domain)) {
      issues.push(`index.html contains forbidden external CDN dependency: "${domain}". All assets must be bundled locally.`);
    }
  }

  // 2. Verify all local font references in public/fonts.css exist on disk
  const fontsCssPath = path.join(PUBLIC_DIR, 'fonts.css');
  if (!fs.existsSync(fontsCssPath)) {
    issues.push('public/fonts.css is missing.');
  } else {
    const fontsCss = fs.readFileSync(fontsCssPath, 'utf8');
    const fontMatches = fontsCss.matchAll(/url\(['"]\.\/fonts\/([^'"]+)['"]\)/g);
    let fontCount = 0;
    for (const m of fontMatches) {
      fontCount++;
      const fontFile = m[1];
      const fullFontPath = path.join(PUBLIC_DIR, 'fonts', fontFile);
      if (!fs.existsSync(fullFontPath)) {
        issues.push(`fonts.css references "./fonts/${fontFile}", but file does not exist in public/fonts/!`);
      }
    }
    if (fontCount === 0) {
      issues.push('fonts.css has zero font url references.');
    }
  }

  // 3. Audio Sound Design Analysis: Ensure purely gentle harmonic sine tones
  const audioCode = fs.readFileSync(path.join(PUBLIC_DIR, 'audio-engine.js'), 'utf8');
  if (audioCode.includes("osc.type = 'sawtooth'") || audioCode.includes('osc.type = "sawtooth"')) {
    issues.push('audio-engine.js uses harsh "sawtooth" oscillator waveform, violating sleep-friendly sound guidelines.');
  }
  if (audioCode.includes("osc.type = 'square'") || audioCode.includes('osc.type = "square"')) {
    issues.push('audio-engine.js uses harsh "square" oscillator waveform, violating sleep-friendly sound guidelines.');
  }
  if (!audioCode.includes("osc.type = 'sine'") && !audioCode.includes('osc.type = "sine"')) {
    issues.push('audio-engine.js does not use pure "sine" oscillator waveform.');
  }
  if (!audioCode.includes('filter.type = \'lowpass\'') && !audioCode.includes('filter.type = "lowpass"')) {
    issues.push('audio-engine.js is missing low-pass filter smoothing to remove sharp high-frequency transients.');
  }

  // 4. CGM Protocol Safety: Enforce librelinkup-api-client usage only
  const serverCode = fs.readFileSync(path.join(ROOT_DIR, 'server.js'), 'utf8');
  if (!serverCode.includes("librelinkup-api-client")) {
    issues.push('server.js must use the maintained "librelinkup-api-client" npm package for CGM monitoring.');
  }
  if (serverCode.includes("axios.post('https://api-us.libreview.io/llu/auth/login'")) {
    issues.push('server.js contains raw hand-rolled login scraping, strictly forbidden by Medical Safety Mandate.');
  }

  // 5. Permissive License Verification
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'package.json'), 'utf8'));
  if (pkg.license !== 'MIT') {
    issues.push(`package.json license must be "MIT", got "${pkg.license}"`);
  }

  // 6. Dynamic Version Consistency
  const preloadCode = fs.readFileSync(path.join(ROOT_DIR, 'preload.js'), 'utf8');
  if (!preloadCode.includes("require('./package.json')")) {
    issues.push('preload.js must dynamically load version from package.json.');
  }
  if (!serverCode.includes("require('./package.json')")) {
    issues.push('server.js must dynamically load version from package.json.');
  }

  if (issues.length > 0) {
    throw new Error(`Security & Architecture audit failed with ${issues.length} issue(s):\n - ${issues.join('\n - ')}`);
  }

  return {
    success: true,
    fontFilesVerified: true,
    audioWaveformVerified: 'pure-sine',
    cgmEngineVerified: 'librelinkup-api-client',
    license: pkg.license,
    version: pkg.version
  };
}

module.exports = { runCodeSecurityAudit };
