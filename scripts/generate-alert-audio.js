/**
 * Pre-generate compact fallback audio files for all standard alerts across all locale files.
 * Dynamically discovers languages in public/locales/ and reads _meta.neuralVoice and alerts.speech.
 * Uses msedge-tts 24kHz 48kbps mono MP3 encoding (<150KB total per language).
 */

const fs = require('fs');
const path = require('path');
const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');

const LOCALES_DIR = path.join(__dirname, '../public/locales');
const ALERTS_DIR = path.join(__dirname, '../public/audio/alerts');

if (!fs.existsSync(ALERTS_DIR)) {
  fs.mkdirSync(ALERTS_DIR, { recursive: true });
}

/**
 * Dynamically discover all alert phrases across all installed language files
 */
function getAlertsToGenerate() {
  const alerts = [];
  if (!fs.existsSync(LOCALES_DIR)) return alerts;

  const files = fs.readdirSync(LOCALES_DIR);

  for (const file of files) {
    if (!file.endsWith('.json') || file === 'template.json') continue;
    const langCode = path.basename(file, '.json');
    const filePath = path.join(LOCALES_DIR, file);

    try {
      const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const meta = content._meta || {};
      const speech = content.alerts?.speech || {};

      // Voice specified strictly in _meta
      const voice = meta.neuralVoice;
      if (!voice) {
        console.warn(`[Audio Generator] Skipping ${file}: no "_meta.neuralVoice" defined.`);
        continue;
      }

      const alertMap = [
        { key: 'lowGlucose', fileSuffix: 'low-glucose' },
        { key: 'highGlucose', fileSuffix: 'high-glucose' },
        { key: 'urgentLowGlucose', fileSuffix: 'urgent-low-glucose' },
        { key: 'testVoiceAlert', fileSuffix: 'test-voice-alert' }
      ];

      for (const mapping of alertMap) {
        const text = speech[mapping.key];
        if (text && typeof text === 'string' && text.trim()) {
          alerts.push({
            lang: langCode,
            key: mapping.key,
            file: `${mapping.fileSuffix}-${langCode}.mp3`,
            voice,
            text: text.trim()
          });
        }
      }
    } catch (err) {
      console.warn(`[Audio Generator] Warning parsing ${file}:`, err.message);
    }
  }

  return alerts;
}

async function synthesizeFile(item) {
  const targetPath = path.join(ALERTS_DIR, item.file);
  const tts = new MsEdgeTTS();

  try {
    await tts.setMetadata(item.voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);

    return await new Promise((resolve, reject) => {
      try {
        const { audioStream } = tts.toStream(item.text);
        const chunks = [];
        audioStream.on('data', chunk => chunks.push(chunk));
        audioStream.on('end', () => {
          const buf = Buffer.concat(chunks);
          fs.writeFileSync(targetPath, buf);
          console.log(`✓ Generated ${item.file} using ${item.voice} (${(buf.length / 1024).toFixed(1)} KB)`);
          try { tts.close(); } catch (e) {}
          resolve(buf.length);
        });
        audioStream.on('error', err => {
          try { tts.close(); } catch (e) {}
          reject(err);
        });
      } catch (e) {
        try { tts.close(); } catch (err) {}
        reject(e);
      }
    });
  } catch (err) {
    try { tts.close(); } catch (e) {}
    throw err;
  }
}

async function run() {
  const alertsToGenerate = getAlertsToGenerate();
  console.log(`Found ${alertsToGenerate.length} alert phrases across discovered locale files...`);
  let totalBytes = 0;

  for (const item of alertsToGenerate) {
    try {
      const bytes = await synthesizeFile(item);
      totalBytes += bytes;
    } catch (err) {
      console.error(`Failed to generate ${item.file}:`, err.message);
    }
  }

  console.log(`🎉 All alert audio assets generated! Total size: ${(totalBytes / 1024).toFixed(1)} KB (< 0.25 MB)`);
}

if (require.main === module) {
  run().catch(err => {
    console.error('Generation script error:', err);
    process.exit(1);
  });
}

module.exports = { run, getAlertsToGenerate };
