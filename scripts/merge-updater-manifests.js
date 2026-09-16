#!/usr/bin/env node

/**
 * Yom Kippur Diabetes Timer - Multi-Target Updater Manifest Merger
 *
 * Scans build/release artifacts across all matrix targets (Linux, Windows, macOS),
 * calculates cryptographic SHA-512 hashes and blockmaps, parses existing partial manifests,
 * and generates unified combined updater manifests (latest.yml, latest-linux.yml, latest-mac.yml, latest.json)
 * so all distribution package formats can seamlessly auto-update.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function computeSha512Base64(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  return crypto.createHash('sha512').update(fileBuffer).digest('base64');
}

function parseSimpleYaml(content) {
  const result = { files: [] };
  const lines = content.split('\n');
  let currentFile = null;
  let inFilesArray = false;

  for (let line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    if (trimmed.startsWith('version:')) {
      result.version = trimmed.replace('version:', '').trim().replace(/['"]/g, '');
    } else if (trimmed.startsWith('path:')) {
      result.path = trimmed.replace('path:', '').trim().replace(/['"]/g, '');
    } else if (trimmed.startsWith('sha512:')) {
      if (!currentFile) {
        result.sha512 = trimmed.replace('sha512:', '').trim().replace(/['"]/g, '');
      } else {
        currentFile.sha512 = trimmed.replace('sha512:', '').trim().replace(/['"]/g, '');
      }
    } else if (trimmed.startsWith('releaseDate:')) {
      result.releaseDate = trimmed.replace('releaseDate:', '').trim().replace(/['"]/g, '');
    } else if (trimmed === 'files:') {
      inFilesArray = true;
    } else if (inFilesArray) {
      if (line.match(/^\s*-\s+url:/)) {
        if (currentFile) result.files.push(currentFile);
        currentFile = { url: trimmed.replace(/^-\s+url:/, '').trim().replace(/['"]/g, '') };
      } else if (currentFile && line.match(/^\s+sha512:/)) {
        currentFile.sha512 = trimmed.replace('sha512:', '').trim().replace(/['"]/g, '');
      } else if (currentFile && line.match(/^\s+size:/)) {
        currentFile.size = parseInt(trimmed.replace('size:', '').trim(), 10);
      } else if (currentFile && line.match(/^\s+blockMapSize:/)) {
        currentFile.blockMapSize = parseInt(trimmed.replace('blockMapSize:', '').trim(), 10);
      } else if (!line.startsWith(' ') && !line.startsWith('\t')) {
        inFilesArray = false;
        if (currentFile) {
          result.files.push(currentFile);
          currentFile = null;
        }
      }
    }
  }

  if (currentFile) {
    result.files.push(currentFile);
  }

  return result;
}

function serializeYaml(manifest) {
  let yaml = `version: ${manifest.version}\nfiles:\n`;
  for (const f of manifest.files) {
    yaml += `  - url: ${f.url}\n`;
    yaml += `    sha512: ${f.sha512}\n`;
    yaml += `    size: ${f.size}\n`;
    if (f.blockMapSize) {
      yaml += `    blockMapSize: ${f.blockMapSize}\n`;
    }
  }
  yaml += `path: ${manifest.path}\n`;
  yaml += `sha512: ${manifest.sha512}\n`;
  yaml += `releaseDate: '${manifest.releaseDate}'\n`;
  return yaml;
}

function mergeUpdaterManifests(targetDir) {
  const dir = path.resolve(process.cwd(), targetDir || 'release-assets');
  if (!fs.existsSync(dir)) {
    console.warn(`[WARN] Target directory does not exist: ${dir}`);
    return;
  }

  const pkgPath = path.join(__dirname, '..', 'package.json');
  const pkgVersion = fs.existsSync(pkgPath) ? JSON.parse(fs.readFileSync(pkgPath, 'utf8')).version : '1.0.4';

  console.log('====================================================');
  console.log(` Merging Updater Manifests in: ${dir}`);
  console.log(` Target Version: v${pkgVersion}`);
  console.log('====================================================');

  const filesOnDisk = fs.readdirSync(dir);

  // Groupings by platform
  const groups = {
    linux: {
      outName: 'latest-linux.yml',
      primaryExt: '.AppImage',
      extensions: ['.AppImage', '.deb', '.rpm', '.pacman', '.snap', '.asar'],
      filesMap: new Map(),
      primaryFile: null
    },
    win: {
      outName: 'latest.yml',
      primaryExt: '.exe',
      extensions: ['.exe', '.msi', '.zip', '.asar'],
      filesMap: new Map(),
      primaryFile: null
    },
    mac: {
      outName: 'latest-mac.yml',
      primaryExt: '.zip',
      extensions: ['.zip', '.dmg', '.asar'],
      filesMap: new Map(),
      primaryFile: null
    }
  };

  // 1. Ingest existing partial YAML manifests (e.g. updater-meta-*.yml or generated latest*.yml)
  const yamlFiles = filesOnDisk.filter(f => f.endsWith('.yml') || f.endsWith('.yaml'));
  for (const yf of yamlFiles) {
    try {
      const fullYamlPath = path.join(dir, yf);
      const parsed = parseSimpleYaml(fs.readFileSync(fullYamlPath, 'utf8'));
      if (parsed.files && parsed.files.length > 0) {
        console.log(`[INGEST] Found existing manifest "${yf}" with ${parsed.files.length} file entries.`);
        for (const item of parsed.files) {
          const lowerUrl = item.url.toLowerCase();
          if (lowerUrl.endsWith('.appimage') || lowerUrl.endsWith('.deb') || lowerUrl.endsWith('.rpm') || lowerUrl.endsWith('.pacman') || lowerUrl.endsWith('.snap')) {
            groups.linux.filesMap.set(item.url, item);
          } else if (lowerUrl.endsWith('.exe') || lowerUrl.endsWith('.msi')) {
            groups.win.filesMap.set(item.url, item);
          } else if (lowerUrl.endsWith('.dmg') || (lowerUrl.endsWith('.zip') && lowerUrl.includes('mac'))) {
            groups.mac.filesMap.set(item.url, item);
          }
        }
      }
    } catch (e) {
      console.warn(`[WARN] Failed to parse YAML file "${yf}":`, e.message);
    }
  }

  // 2. Scan all physical installer binaries on disk and compute exact hash / size if not in map
  for (const fileName of filesOnDisk) {
    const fullPath = path.join(dir, fileName);
    if (!fs.statSync(fullPath).isFile()) continue;

    const lower = fileName.toLowerCase();
    let targetGroup = null;

    if (lower.endsWith('.appimage') || lower.endsWith('.deb') || lower.endsWith('.rpm') || lower.endsWith('.pacman') || lower.endsWith('.snap')) {
      targetGroup = groups.linux;
    } else if (lower.endsWith('.exe') || lower.endsWith('.msi') || (lower.endsWith('.zip') && lower.includes('win'))) {
      targetGroup = groups.win;
    } else if (lower.endsWith('.dmg') || (lower.endsWith('.zip') && (lower.includes('mac') || lower.includes('darwin')))) {
      targetGroup = groups.mac;
    } else if (fileName === 'app.asar') {
      // Include app.asar in all manifests
      ['linux', 'win', 'mac'].forEach(k => {
        const g = groups[k];
        if (!g.filesMap.has('app.asar')) {
          const hash = computeSha512Base64(fullPath);
          const size = fs.statSync(fullPath).size;
          g.filesMap.set('app.asar', { url: 'app.asar', sha512: hash, size });
        }
      });
      continue;
    }

    if (targetGroup) {
      if (!targetGroup.filesMap.has(fileName)) {
        console.log(`[HASH] Computing SHA-512 for uncatalogued binary: ${fileName}...`);
        const sha512 = computeSha512Base64(fullPath);
        const size = fs.statSync(fullPath).size;
        const entry = { url: fileName, sha512, size };

        // Check for blockmap
        const blockMapPath = `${fullPath}.blockmap`;
        if (fs.existsSync(blockMapPath)) {
          entry.blockMapSize = fs.statSync(blockMapPath).size;
        }

        targetGroup.filesMap.set(fileName, entry);
      }
    }
  }

  const nowIso = new Date().toISOString();

  // 3. Generate unified manifest for each platform
  for (const [key, group] of Object.entries(groups)) {
    const filesArray = Array.from(group.filesMap.values());
    if (filesArray.length === 0) {
      console.log(`[SKIP] No files found for platform: ${key}`);
      continue;
    }

    // Determine primary file for default path & sha512
    let primary = filesArray.find(f => f.url.endsWith(group.primaryExt));
    if (!primary) primary = filesArray[0];

    const manifestObj = {
      version: pkgVersion,
      files: filesArray,
      path: primary.url,
      sha512: primary.sha512,
      releaseDate: nowIso
    };

    const outPath = path.join(dir, group.outName);
    const yamlContent = serializeYaml(manifestObj);
    fs.writeFileSync(outPath, yamlContent, 'utf8');
    console.log(`✓ [SUCCESS] Generated unified ${group.outName} with ${filesArray.length} asset entries.`);
  }

  // 4. Also generate unified latest.json for HTTP/web check endpoints
  const allAssetEntries = [];
  const seenUrls = new Set();
  for (const g of Object.values(groups)) {
    for (const f of g.filesMap.values()) {
      if (!seenUrls.has(f.url)) {
        seenUrls.add(f.url);
        allAssetEntries.push({
          name: f.url,
          size: f.size,
          browser_download_url: `https://github.com/binyaminyblatt/yom-kippur-diabetes-timer/releases/download/v${pkgVersion}/${f.url}`
        });
      }
    }
  }

  const latestJsonObj = {
    tag_name: `v${pkgVersion}`,
    name: `Yom Kippur Diabetes Timer v${pkgVersion}`,
    releaseDate: nowIso,
    assets: allAssetEntries
  };

  fs.writeFileSync(path.join(dir, 'latest.json'), JSON.stringify(latestJsonObj, null, 2), 'utf8');
  console.log(`✓ [SUCCESS] Generated unified latest.json with ${allAssetEntries.length} total release assets.`);
}

if (require.main === module) {
  const targetDir = process.argv[2] || 'release-assets';
  mergeUpdaterManifests(targetDir);
}

module.exports = { mergeUpdaterManifests };
