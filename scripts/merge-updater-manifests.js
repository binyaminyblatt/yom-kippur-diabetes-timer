#!/usr/bin/env node

/**
 * Yom Kippur Diabetes Timer - Multi-Target & Multi-Arch Updater Manifest Merger
 *
 * Scans build/release artifacts across all matrix targets (Linux, Windows, macOS)
 * and architectures (x64, ia32, arm64, armv7l, universal),
 * calculates cryptographic SHA-512 hashes and blockmaps, parses existing partial manifests,
 * and generates unified combined updater manifests:
 *  - Windows: latest.yml (x64), latest-ia32.yml (ia32), latest-arm64.yml (arm64)
 *  - Linux: latest-linux.yml (x64), latest-linux-ia32.yml (ia32), latest-linux-arm64.yml (arm64), latest-linux-arm.yml (armv7l)
 *  - macOS: latest-mac.yml (universal / arm64 / x64)
 *  - Aggregate: latest.json (full asset directory with metadata and architecture tags)
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

function classifyFile(fileName) {
  const lower = fileName.toLowerCase();

  // Ignore updater manifests and checksum files from classification
  if (lower.endsWith('.yml') || lower.endsWith('.yaml') || lower.endsWith('.blockmap') || lower === 'latest.json') {
    return null;
  }

  // macOS
  if (lower.endsWith('.dmg') || (lower.endsWith('.zip') && (lower.includes('mac') || lower.includes('darwin')))) {
    return { platform: 'mac', arch: lower.includes('arm64') ? 'arm64' : (lower.includes('x64') ? 'x64' : 'universal'), groupKey: 'mac' };
  }

  // Windows
  if (lower.endsWith('.exe') || lower.endsWith('.msi') || (lower.endsWith('.zip') && (lower.includes('win') || !lower.includes('mac')))) {
    if (lower.includes('arm64')) {
      return { platform: 'win', arch: 'arm64', groupKey: 'win_arm64' };
    }
    if (lower.includes('ia32') || lower.includes('x86') || lower.includes('32bit') || lower.includes('-ia32') || lower.includes('-32')) {
      return { platform: 'win', arch: 'ia32', groupKey: 'win_ia32' };
    }
    return { platform: 'win', arch: 'x64', groupKey: 'win_x64' };
  }

  // Linux
  if (lower.endsWith('.appimage') || lower.endsWith('.deb') || lower.endsWith('.rpm') || lower.endsWith('.pacman') || lower.endsWith('.snap') || lower.endsWith('.tar.xz') || lower.endsWith('.tar.gz')) {
    if (lower.includes('arm64') || lower.includes('aarch64')) {
      return { platform: 'linux', arch: 'arm64', groupKey: 'linux_arm64' };
    }
    if (lower.includes('armv7l') || lower.includes('armv7') || lower.includes('armhf') || (lower.includes('arm') && !lower.includes('arm64'))) {
      return { platform: 'linux', arch: 'armv7l', groupKey: 'linux_armv7l' };
    }
    if (lower.includes('ia32') || lower.includes('i386') || lower.includes('i686') || lower.includes('32bit') || lower.includes('-ia32') || lower.includes('-32')) {
      return { platform: 'linux', arch: 'ia32', groupKey: 'linux_ia32' };
    }
    return { platform: 'linux', arch: 'x64', groupKey: 'linux_x64' };
  }

  // app.asar
  if (fileName === 'app.asar') {
    return { platform: 'all', arch: 'universal', groupKey: 'all' };
  }

  return null;
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
  console.log(` Merging Multi-Arch Updater Manifests in: ${dir}`);
  console.log(` Target Version: v${pkgVersion}`);
  console.log('====================================================');

  const filesOnDisk = fs.readdirSync(dir);

  // Groupings by platform & architecture
  const groups = {
    win_x64: {
      outName: 'latest.yml',
      primaryExt: '.exe',
      platform: 'windows',
      arch: 'x64',
      filesMap: new Map()
    },
    win_ia32: {
      outName: 'latest-ia32.yml',
      primaryExt: '.exe',
      platform: 'windows',
      arch: 'ia32',
      filesMap: new Map()
    },
    win_arm64: {
      outName: 'latest-arm64.yml',
      primaryExt: '.exe',
      platform: 'windows',
      arch: 'arm64',
      filesMap: new Map()
    },
    linux_x64: {
      outName: 'latest-linux.yml',
      primaryExt: '.AppImage',
      platform: 'linux',
      arch: 'x64',
      filesMap: new Map()
    },
    linux_ia32: {
      outName: 'latest-linux-ia32.yml',
      primaryExt: '.AppImage',
      platform: 'linux',
      arch: 'ia32',
      filesMap: new Map()
    },
    linux_arm64: {
      outName: 'latest-linux-arm64.yml',
      primaryExt: '.AppImage',
      platform: 'linux',
      arch: 'arm64',
      filesMap: new Map()
    },
    linux_armv7l: {
      outName: 'latest-linux-arm.yml',
      primaryExt: '.AppImage',
      platform: 'linux',
      arch: 'armv7l',
      filesMap: new Map()
    },
    mac: {
      outName: 'latest-mac.yml',
      primaryExt: '.zip',
      platform: 'mac',
      arch: 'universal',
      filesMap: new Map()
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
          const classification = classifyFile(item.url);
          if (classification && classification.groupKey && groups[classification.groupKey]) {
            groups[classification.groupKey].filesMap.set(item.url, item);
          } else if (yf.includes('ia32') && yf.includes('linux')) {
            groups.linux_ia32.filesMap.set(item.url, item);
          } else if (yf.includes('arm64') && yf.includes('linux')) {
            groups.linux_arm64.filesMap.set(item.url, item);
          } else if ((yf.includes('armv7l') || yf.includes('arm')) && yf.includes('linux')) {
            groups.linux_armv7l.filesMap.set(item.url, item);
          } else if (yf.includes('ia32') && yf.includes('win')) {
            groups.win_ia32.filesMap.set(item.url, item);
          } else if (yf.includes('arm64') && yf.includes('win')) {
            groups.win_arm64.filesMap.set(item.url, item);
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

    if (fileName === 'app.asar') {
      const hash = computeSha512Base64(fullPath);
      const size = fs.statSync(fullPath).size;
      Object.values(groups).forEach(g => {
        if (!g.filesMap.has('app.asar')) {
          g.filesMap.set('app.asar', { url: 'app.asar', sha512: hash, size });
        }
      });
      continue;
    }

    const classification = classifyFile(fileName);
    if (!classification) continue;

    const group = groups[classification.groupKey];
    if (group) {
      if (!group.filesMap.has(fileName)) {
        console.log(`[HASH] Computing SHA-512 for [${classification.groupKey}] binary: ${fileName}...`);
        const sha512 = computeSha512Base64(fullPath);
        const size = fs.statSync(fullPath).size;
        const entry = { url: fileName, sha512, size };

        // Check for blockmap
        const blockMapPath = `${fullPath}.blockmap`;
        if (fs.existsSync(blockMapPath)) {
          entry.blockMapSize = fs.statSync(blockMapPath).size;
        }

        group.filesMap.set(fileName, entry);
      }
    }
  }

  const nowIso = new Date().toISOString();

  // 3. Generate unified manifest for each platform & architecture
  for (const [key, group] of Object.entries(groups)) {
    const filesArray = Array.from(group.filesMap.values());
    if (filesArray.length === 0) {
      console.log(`[SKIP] No files found for group: ${key} (${group.outName})`);
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

  // 4. Generate unified latest.json for HTTP / API consumers with full metadata
  const allAssetEntries = [];
  const seenUrls = new Set();
  for (const [key, g] of Object.entries(groups)) {
    for (const f of g.filesMap.values()) {
      if (!seenUrls.has(f.url)) {
        seenUrls.add(f.url);
        const classification = classifyFile(f.url);
        allAssetEntries.push({
          name: f.url,
          size: f.size,
          sha512: f.sha512,
          platform: classification ? classification.platform : (g.platform || 'all'),
          arch: classification ? classification.arch : (g.arch || 'universal'),
          browser_download_url: `https://github.com/binyaminyblatt/yom-kippur-diabetes-timer/releases/download/v${pkgVersion}/${f.url}`
        });
      }
    }
  }

  const latestJsonObj = {
    tag_name: `v${pkgVersion}`,
    name: `Yom Kippur Diabetes Timer v${pkgVersion}`,
    releaseDate: nowIso,
    platforms: {
      windows: {
        x64: allAssetEntries.filter(a => a.platform === 'win' && a.arch === 'x64'),
        ia32: allAssetEntries.filter(a => a.platform === 'win' && a.arch === 'ia32'),
        arm64: allAssetEntries.filter(a => a.platform === 'win' && a.arch === 'arm64')
      },
      linux: {
        x64: allAssetEntries.filter(a => a.platform === 'linux' && a.arch === 'x64'),
        ia32: allAssetEntries.filter(a => a.platform === 'linux' && a.arch === 'ia32'),
        arm64: allAssetEntries.filter(a => a.platform === 'linux' && a.arch === 'arm64'),
        armv7l: allAssetEntries.filter(a => a.platform === 'linux' && a.arch === 'armv7l')
      },
      macos: {
        universal: allAssetEntries.filter(a => a.platform === 'mac')
      }
    },
    assets: allAssetEntries
  };

  fs.writeFileSync(path.join(dir, 'latest.json'), JSON.stringify(latestJsonObj, null, 2), 'utf8');
  console.log(`✓ [SUCCESS] Generated unified latest.json with ${allAssetEntries.length} total multi-arch release assets.`);
}

if (require.main === module) {
  const targetDir = process.argv[2] || 'release-assets';
  mergeUpdaterManifests(targetDir);
}

module.exports = { mergeUpdaterManifests, classifyFile };
