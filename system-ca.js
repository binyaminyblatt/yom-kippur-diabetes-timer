/**
 * System CA Certificate Loader for Node.js / Electron
 * 
 * Automatically discovers and loads trusted Root and Intermediate Certificate
 * Authorities from the operating system's native certificate store:
 *  - Windows: Windows Certificate Store (LocalMachine\Root, LocalMachine\CA, CurrentUser\Root, CurrentUser\CA)
 *  - macOS: System, Root & User Keychains (/System/Library/Keychains, /Library/Keychains, login.keychain)
 *  - Linux: System CA bundles (/etc/ssl/certs/ca-certificates.crt, /etc/pki/tls/certs/ca-bundle.crt, etc.)
 *  - Custom: Local certs/ directory, SSL_CERT_FILE, and NODE_EXTRA_CA_CERTS
 * 
 * Injects certificates into tls.createSecureContext, https.globalAgent, and global fetch/undici
 * to enable seamless operation behind SSL-inspecting filters (NetFree, NetSpark, Techloq, Meshimer,
 * corporate enterprise firewalls, and proxies).
 */

const fs = require('fs');
const path = require('path');
const tls = require('tls');
const https = require('https');
const crypto = require('crypto');
const { execSync, spawnSync } = require('child_process');

let isInitialized = false;
let loadedCertificates = [];
let loadSummary = {
  systemCount: 0,
  builtinCount: 0,
  customCount: 0,
  totalUniqueCount: 0,
  platform: process.platform,
  sources: []
};

/**
 * Scans a binary Buffer for ASN.1 DER-encoded X.509 certificates.
 * This extracts certificates from:
 *  - Raw binary DER (.der, .cer, .crt)
 *  - PKCS#7 / CMS / P7B / P7C bundles (.p7b, .p7c, .p7s)
 *  - PKCS#12 / PFX certificate stores (.pfx, .p12)
 *  - Multi-certificate concatenated DER streams
 */
function extractDerCerts(buf) {
  if (!buf || !Buffer.isBuffer(buf) || buf.length < 32) return [];
  const certs = [];

  for (let i = 0; i < buf.length - 4; i++) {
    if (buf[i] === 0x30) { // ASN.1 SEQUENCE
      let len = 0;
      let headerLen = 0;
      if (buf[i + 1] === 0x82) {
        len = (buf[i + 2] << 8) | buf[i + 3];
        headerLen = 4;
      } else if (buf[i + 1] === 0x81) {
        len = buf[i + 2];
        headerLen = 3;
      } else if (buf[i + 1] === 0x83) {
        len = (buf[i + 2] << 16) | (buf[i + 3] << 8) | buf[i + 4];
        headerLen = 5;
      }

      if (len > 50 && (i + headerLen + len) <= buf.length) {
        const slice = buf.subarray(i, i + headerLen + len);
        try {
          const x509 = new crypto.X509Certificate(slice);
          certs.push(x509.toString());
          i += headerLen + len - 1; // Skip past this valid certificate
        } catch (e) {
          // Not a valid certificate at this offset; continue scan
        }
      }
    }
  }

  // Fallback: If ASN.1 scan found nothing, attempt direct parse
  if (certs.length === 0) {
    try {
      const directX509 = new crypto.X509Certificate(buf);
      certs.push(directX509.toString());
    } catch (e) {}
  }

  return certs;
}

/**
 * Universal Certificate Parser:
 * Intelligently parses ANY certificate file format:
 *  1. PEM with standard/alternate headers (CERTIFICATE, X509, TRUSTED, PKCS7, CERTIFICATES)
 *  2. Multi-cert PEM bundles & chains
 *  3. Raw Base64 encoded certificates without headers
 *  4. Raw binary DER (.der, .cer, .crt)
 *  5. PKCS#7 / P7B / P7C files (.p7b, .p7c, .p7s)
 *  6. PKCS#12 / PFX certificate stores (.pfx, .p12)
 */
function parseAnyCertificate(input) {
  if (!input) return [];
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(String(input), 'utf8');
  const certs = [];

  // Check if buffer is UTF-8 text (PEM or Base64)
  const text = buf.toString('utf8');

  // 1a. PEM format with standard or alternate headers
  const pemRegex = /-----(?:BEGIN[^-]+)-----[\s\S]+?-----(?:END[^-]+)-----/g;
  let match;
  let foundPem = false;

  while ((match = pemRegex.exec(text)) !== null) {
    foundPem = true;
    const block = match[0];

    // Check if it's a PKCS#7 PEM block
    if (block.includes('PKCS7') || block.includes('PKCS #7') || block.includes('CERTIFICATES')) {
      const b64 = block.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
      try {
        const p7Buf = Buffer.from(b64, 'base64');
        certs.push(...extractDerCerts(p7Buf));
      } catch (e) {}
    } else {
      // Normal or alternate X509 certificate block (e.g. TRUSTED CERTIFICATE, X509 CERTIFICATE)
      try {
        const x509 = new crypto.X509Certificate(block);
        certs.push(x509.toString());
      } catch (e) {
        // Fallback: extract base64 body and try as DER
        const b64 = block.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
        try {
          const raw = Buffer.from(b64, 'base64');
          const x509 = new crypto.X509Certificate(raw);
          certs.push(x509.toString());
        } catch (err) {}
      }
    }
  }

  // 1b. Raw Base64 string without PEM headers
  if (!foundPem) {
    const cleaned = text.replace(/\s+/g, '');
    if (/^[A-Za-z0-9+/=]+$/.test(cleaned) && cleaned.length > 50) {
      try {
        const raw = Buffer.from(cleaned, 'base64');
        const extracted = extractDerCerts(raw);
        if (extracted.length > 0) {
          certs.push(...extracted);
          return certs;
        }
      } catch (e) {}
    }
  }

  // 2. Binary parsing (DER, PKCS#7, P7B, P7C, PFX, DER bundles)
  if (certs.length === 0) {
    certs.push(...extractDerCerts(buf));
  }

  return certs;
}

/**
 * Parses raw PEM certificate data into an array of individual certificate strings.
 */
function parseCertificatesFromPEM(pemString) {
  return parseAnyCertificate(pemString);
}

/**
 * Loads certificates from standard Linux / Unix certificate bundle paths.
 */
function loadLinuxCertificates() {
  const certs = [];
  const knownBundlePaths = [
    '/etc/ssl/certs/ca-certificates.crt',                // Debian, Ubuntu, Arch, Gentoo
    '/etc/pki/tls/certs/ca-bundle.crt',                  // Fedora, RHEL 6
    '/etc/ssl/ca-bundle.pem',                            // openSUSE
    '/etc/pki/ca-trust/extracted/pem/tls-ca-bundle.pem', // CentOS, RHEL 7+
    '/etc/ssl/cert.pem',                                 // Alpine, FreeBSD, OpenBSD, macOS fallback
    '/etc/pki/tls/cacert.pem'                            // OpenELEC
  ];

  for (const filePath of knownBundlePaths) {
    try {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        const parsed = parseCertificatesFromPEM(content);
        if (parsed.length > 0) {
          certs.push(...parsed);
          loadSummary.sources.push(`${filePath} (${parsed.length} certs)`);
          break; // Found primary system bundle
        }
      }
    } catch (e) {
      // Ignore read errors
    }
  }

  // Also check individual certificates in /etc/ssl/certs/ if bundle had few or none
  if (certs.length < 10) {
    try {
      const certDir = '/etc/ssl/certs';
      if (fs.existsSync(certDir)) {
        const files = fs.readdirSync(certDir);
        let individualCount = 0;
        for (const file of files) {
          if (file.endsWith('.crt') || file.endsWith('.pem')) {
            try {
              const fullPath = path.join(certDir, file);
              const content = fs.readFileSync(fullPath, 'utf8');
              const parsed = parseCertificatesFromPEM(content);
              if (parsed.length > 0) {
                certs.push(...parsed);
                individualCount += parsed.length;
              }
            } catch (err) {}
          }
        }
        if (individualCount > 0) {
          loadSummary.sources.push(`/etc/ssl/certs/ directory (${individualCount} certs)`);
        }
      }
    } catch (e) {}
  }

  return certs;
}

/**
 * Loads certificates from macOS System and User Keychains via /usr/bin/security.
 */
function loadMacCertificates() {
  const certs = [];
  const keychainPaths = [
    '/System/Library/Keychains/SystemRootCertificates.keychain',
    '/Library/Keychains/System.keychain'
  ];

  // Also check user login keychain if available
  const homeDir = process.env.HOME || '';
  if (homeDir) {
    const userKeychains = [
      path.join(homeDir, 'Library/Keychains/login.keychain-db'),
      path.join(homeDir, 'Library/Keychains/login.keychain')
    ];
    for (const uk of userKeychains) {
      if (fs.existsSync(uk)) {
        keychainPaths.push(uk);
        break;
      }
    }
  }

  try {
    const existingKeychains = keychainPaths.filter(p => fs.existsSync(p));
    if (existingKeychains.length > 0) {
      const result = spawnSync('/usr/bin/security', ['find-certificate', '-a', '-p', ...existingKeychains], {
        encoding: 'utf8',
        timeout: 5000,
        maxBuffer: 10 * 1024 * 1024
      });

      if (result.status === 0 && result.stdout) {
        const parsed = parseCertificatesFromPEM(result.stdout);
        if (parsed.length > 0) {
          certs.push(...parsed);
          loadSummary.sources.push(`macOS Keychain (${parsed.length} certs)`);
        }
      }
    }
  } catch (e) {
    // Fallback to Unix bundle on macOS
  }

  // Fallback to /etc/ssl/cert.pem if keychain query yielded nothing
  if (certs.length === 0) {
    const fallbackCerts = loadLinuxCertificates();
    certs.push(...fallbackCerts);
  }

  return certs;
}

/**
 * Loads certificates from Windows Certificate Stores (LocalMachine and CurrentUser Root/CA)
 * using PowerShell or certutil. Supports packaged Electron apps by checking System32 paths.
 */
function loadWindowsCertificates() {
  const certs = [];
  const sysRoot = process.env.SystemRoot || process.env.windir || 'C:\\Windows';
  const psCandidates = [
    path.join(sysRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
    path.join(sysRoot, 'SysWOW64', 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
    'powershell.exe'
  ];

  const psScript = `
    $stores = @('Cert:\\LocalMachine\\Root', 'Cert:\\LocalMachine\\CA', 'Cert:\\CurrentUser\\Root', 'Cert:\\CurrentUser\\CA')
    foreach ($store in $stores) {
      if (Test-Path $store) {
        Get-ChildItem -Path $store -ErrorAction SilentlyContinue | ForEach-Object {
          try {
            $bytes = $_.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Cert)
            $b64 = [System.Convert]::ToBase64String($bytes, [System.Base64FormattingOptions]::InsertLineBreaks)
            '-----BEGIN CERTIFICATE-----'
            $b64
            '-----END CERTIFICATE-----'
          } catch {}
        }
      }
    }
  `;

  // Method 1: PowerShell
  for (const psExe of psCandidates) {
    try {
      const result = spawnSync(psExe, [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy', 'Bypass',
        '-Command', psScript
      ], {
        encoding: 'utf8',
        timeout: 8000,
        maxBuffer: 15 * 1024 * 1024
      });

      if (result.status === 0 && result.stdout) {
        const parsed = parseAnyCertificate(result.stdout);
        if (parsed.length > 0) {
          certs.push(...parsed);
          loadSummary.sources.push(`Windows Certificate Store via PowerShell (${parsed.length} certs)`);
          return certs;
        }
      }
    } catch (e) {}
  }

  // Method 2: Fallback to certutil if PowerShell fails
  const certutilCandidates = [
    path.join(sysRoot, 'System32', 'certutil.exe'),
    'certutil.exe'
  ];
  for (const certutilExe of certutilCandidates) {
    try {
      const certStores = ['Root', 'CA'];
      for (const store of certStores) {
        const result = spawnSync(certutilExe, ['-store', store], {
          encoding: 'utf8',
          timeout: 5000,
          maxBuffer: 10 * 1024 * 1024
        });
        if (result.status === 0 && result.stdout) {
          const parsed = parseAnyCertificate(result.stdout);
          if (parsed.length > 0) {
            certs.push(...parsed);
            loadSummary.sources.push(`Windows certutil -store ${store} (${parsed.length} certs)`);
          }
        }
      }
      if (certs.length > 0) return certs;
    } catch (e) {}
  }

  return certs;
}

/**
 * Discovers custom certificate directories across environments:
 *  - Standard dev & unpacked: __dirname/certs, process.cwd()/certs
 *  - Packaged Electron apps: process.resourcesPath/certs, next to executable
 *  - User Data / AppData folders: Electron userData/certs, %APPDATA%, Application Support
 */
function getPossibleCertDirs() {
  const dirs = [
    path.join(__dirname, 'certs'),
    path.join(process.cwd(), 'certs'),
    process.env.SSL_CERT_DIR
  ];

  // Packaged Electron: process.resourcesPath (e.g. /path/to/app/resources/certs)
  if (process.resourcesPath) {
    dirs.push(path.join(process.resourcesPath, 'certs'));
  }

  // Packaged Electron: directory containing the executable binary (.exe / app binary)
  if (process.execPath) {
    dirs.push(path.join(path.dirname(process.execPath), 'certs'));
    dirs.push(path.join(path.dirname(process.execPath), 'resources', 'certs'));
  }

  // User Data directory (writable by user even when app is installed in Program Files or /Applications)
  try {
    let userDataPath = null;
    try {
      const electron = require('electron');
      const appObj = electron.app || (electron.remote && electron.remote.app);
      if (appObj && appObj.getPath) {
        userDataPath = appObj.getPath('userData');
      }
    } catch (e) {}

    if (!userDataPath) {
      if (process.platform === 'win32' && process.env.APPDATA) {
        userDataPath = path.join(process.env.APPDATA, 'yom-kippur-diabetes-timer');
      } else if (process.platform === 'darwin' && process.env.HOME) {
        userDataPath = path.join(process.env.HOME, 'Library', 'Application Support', 'yom-kippur-diabetes-timer');
      } else if (process.env.XDG_CONFIG_HOME) {
        userDataPath = path.join(process.env.XDG_CONFIG_HOME, 'yom-kippur-diabetes-timer');
      } else if (process.env.HOME) {
        userDataPath = path.join(process.env.HOME, '.config', 'yom-kippur-diabetes-timer');
      }
    }

    if (userDataPath) {
      dirs.push(path.join(userDataPath, 'certs'));
    }
  } catch (e) {}

  return [...new Set(dirs.filter(Boolean))];
}

/**
 * Loads custom certificates from environment variables or local ./certs directory.
 * Supports ALL formats: PEM, DER (.cer/.der), PKCS#7 (.p7b/.p7c), PKCS#12 (.pfx/.p12), and bundles.
 */
function loadCustomCertificates() {
  const certs = [];

  // 1. Check NODE_EXTRA_CA_CERTS or EXTRA_CA_CERTS or SSL_CERT_FILE
  const envPaths = [
    process.env.NODE_EXTRA_CA_CERTS,
    process.env.EXTRA_CA_CERTS,
    process.env.SSL_CERT_FILE
  ].filter(Boolean);

  for (const envPath of envPaths) {
    try {
      if (fs.existsSync(envPath)) {
        const stat = fs.statSync(envPath);
        if (stat.isFile()) {
          const content = fs.readFileSync(envPath);
          const parsed = parseAnyCertificate(content);
          if (parsed.length > 0) {
            certs.push(...parsed);
            loadSummary.sources.push(`Custom file: ${envPath} (${parsed.length} certs)`);
          }
        }
      }
    } catch (e) {}
  }

  // 2. Check all discovered certs directories
  const possibleCertDirs = getPossibleCertDirs();

  for (const dirPath of possibleCertDirs) {
    try {
      if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
        const files = fs.readdirSync(dirPath);
        for (const file of files) {
          // Ignore hidden files / directories (e.g. .gitkeep, .DS_Store)
          if (file.startsWith('.')) continue;

          const fullPath = path.join(dirPath, file);
          try {
            const stat = fs.statSync(fullPath);
            if (stat.isFile()) {
              const fileBuffer = fs.readFileSync(fullPath);
              const parsed = parseAnyCertificate(fileBuffer);
              if (parsed.length > 0) {
                certs.push(...parsed);
                loadSummary.sources.push(`Custom folder cert (${path.basename(dirPath)}): ${file} (${parsed.length} certs)`);
              }
            }
          } catch (err) {}
        }
      }
    } catch (e) {}
  }

  return certs;
}

/**
 * Normalizes and extracts standard Base64 body of a PEM certificate for deduplication.
 */
function getCertFingerprint(certString) {
  return certString
    .replace(/-----BEGIN CERTIFICATE-----/g, '')
    .replace(/-----END CERTIFICATE-----/g, '')
    .replace(/\s+/g, '');
}

/**
 * Main initializer: Discovers system certificates, merges with Node.js built-ins,
 * and configures TLS and HTTPS global agent.
 */
function initSystemCA() {
  if (isInitialized) {
    return {
      count: loadedCertificates.length,
      summary: loadSummary,
      certificates: loadedCertificates
    };
  }

  let systemCerts = [];
  try {
    if (process.platform === 'win32') {
      systemCerts = loadWindowsCertificates();
    } else if (process.platform === 'darwin') {
      systemCerts = loadMacCertificates();
    } else {
      systemCerts = loadLinuxCertificates();
    }
  } catch (err) {
    console.warn('[System CA] Warning discovering system certificates:', err.message);
  }

  loadSummary.systemCount = systemCerts.length;

  // Load custom certificates if any
  const customCerts = loadCustomCertificates();
  loadSummary.customCount = customCerts.length;

  // Get Node.js built-in Mozilla root certificates
  const builtinCerts = [];
  if (Array.isArray(tls.rootCertificates)) {
    for (const cert of tls.rootCertificates) {
      if (typeof cert === 'string') {
        if (cert.includes('-----BEGIN CERTIFICATE-----')) {
          builtinCerts.push(cert);
        } else {
          builtinCerts.push(`-----BEGIN CERTIFICATE-----\n${cert}\n-----END CERTIFICATE-----`);
        }
      }
    }
  }
  loadSummary.builtinCount = builtinCerts.length;

  // Combine and deduplicate
  const seenFingerprints = new Set();
  const allUniqueCerts = [];

  const candidateLists = [customCerts, systemCerts, builtinCerts];
  for (const list of candidateLists) {
    for (const cert of list) {
      if (typeof cert !== 'string' || !cert.includes('-----BEGIN CERTIFICATE-----')) continue;
      const fp = getCertFingerprint(cert);
      if (fp.length > 20 && !seenFingerprints.has(fp)) {
        seenFingerprints.add(fp);
        allUniqueCerts.push(cert.trim());
      }
    }
  }

  loadedCertificates = allUniqueCerts;
  loadSummary.totalUniqueCount = allUniqueCerts.length;

  if (allUniqueCerts.length > 0) {
    // 1. Update https.globalAgent options for standard Node.js https requests
    if (https.globalAgent) {
      if (!https.globalAgent.options) https.globalAgent.options = {};
      https.globalAgent.options.ca = allUniqueCerts;
    }

    // 2. Monkey-patch tls.createSecureContext
    // This is the core low-level TLS gateway in Node.js. It guarantees that any TLS
    // socket created by Node https, Axios, undici, globalThis.fetch, or third-party SDKs
    // automatically receives the full system root CA store.
    const originalCreateSecureContext = tls.createSecureContext;
    tls.createSecureContext = function (options) {
      const opts = Object.assign({}, options);
      if (!opts.ca) {
        opts.ca = allUniqueCerts;
      } else if (Array.isArray(opts.ca)) {
        // If caller passed a custom CA list, merge system CAs
        opts.ca = Array.from(new Set([...opts.ca, ...allUniqueCerts]));
      }
      return originalCreateSecureContext.call(this, opts);
    };

    // 3. Explicitly configure Axios default HTTPS Agent if axios is loaded
    try {
      const axios = require('axios');
      if (axios && axios.defaults) {
        axios.defaults.httpsAgent = new https.Agent({
          ca: allUniqueCerts,
          keepAlive: true
        });
      }
    } catch (e) {}

    // 4. Explicitly configure undici / globalThis.fetch dispatcher if available
    try {
      let undici = null;
      try {
        undici = require('undici');
      } catch (err) {}

      if (undici && undici.Agent && undici.setGlobalDispatcher) {
        const agent = new undici.Agent({
          connect: {
            ca: allUniqueCerts
          }
        });
        undici.setGlobalDispatcher(agent);
      }
    } catch (e) {}

    // 5. Write a consolidated CA bundle to temp directory for child processes
    try {
      const os = require('os');
      const tempBundlePath = path.join(os.tmpdir(), 'yom-kippur-timer-system-ca.pem');
      fs.writeFileSync(tempBundlePath, allUniqueCerts.join('\n\n'), 'utf8');
      if (!process.env.NODE_EXTRA_CA_CERTS) {
        process.env.NODE_EXTRA_CA_CERTS = tempBundlePath;
      }
    } catch (e) {}

    console.log(`[System CA] Successfully initialized ${allUniqueCerts.length} Root CA certificates (${systemCerts.length} from system, ${customCerts.length} custom, ${builtinCerts.length} built-in). SSL inspection support is ACTIVE across fetch, axios, and TLS.`);
  } else {
    console.log('[System CA] Using standard Node.js root certificates.');
  }

  isInitialized = true;
  return {
    count: loadedCertificates.length,
    summary: loadSummary,
    certificates: loadedCertificates
  };
}

module.exports = {
  initSystemCA,
  parseAnyCertificate,
  extractDerCerts,
  getLoadedCertificates: () => loadedCertificates,
  getSummary: () => loadSummary,
  isInitialized: () => isInitialized
};
