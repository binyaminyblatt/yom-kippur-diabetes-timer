/**
 * Bundle @readium/speech WebSpeechVoiceManager into public/vendor/readium-speech.bundle.js
 * Exposes window.ReadiumSpeech = { WebSpeechVoiceManager }
 */

const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const VENDOR_DIR = path.join(__dirname, '../public/vendor');
const OUT_FILE = path.join(VENDOR_DIR, 'readium-speech.bundle.js');

if (!fs.existsSync(VENDOR_DIR)) {
  fs.mkdirSync(VENDOR_DIR, { recursive: true });
}

// Temporary entry point file for esbuild
const tempEntryPath = path.join(__dirname, '_temp_readium_entry.js');
const entryCode = `
import { WebSpeechVoiceManager, WebSpeechEngine } from '@readium/speech';

// Expose on global window object
if (typeof window !== 'undefined') {
  window.ReadiumSpeech = {
    WebSpeechVoiceManager,
    WebSpeechEngine
  };
}

export { WebSpeechVoiceManager, WebSpeechEngine };
`;

fs.writeFileSync(tempEntryPath, entryCode, 'utf8');

esbuild.build({
  entryPoints: [tempEntryPath],
  bundle: true,
  minify: true,
  format: 'iife',
  globalName: 'ReadiumSpeechBundle',
  outfile: OUT_FILE,
  target: ['chrome100', 'safari15', 'firefox100', 'edge100'],
  platform: 'browser',
  sourcemap: false
}).then(() => {
  if (fs.existsSync(tempEntryPath)) {
    fs.unlinkSync(tempEntryPath);
  }
  const stats = fs.statSync(OUT_FILE);
  console.log(`✓ Successfully bundled @readium/speech into ${OUT_FILE} (${(stats.size / 1024).toFixed(1)} KB)`);
}).catch((err) => {
  if (fs.existsSync(tempEntryPath)) {
    fs.unlinkSync(tempEntryPath);
  }
  console.error('Failed to bundle @readium/speech:', err);
  process.exit(1);
});
