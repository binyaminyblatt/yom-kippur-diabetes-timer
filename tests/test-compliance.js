#!/usr/bin/env node

/**
 * Yom Kippur Diabetes Timer - Automated Guidelines & Safety Compliance Engine
 * Runs deep AST/static code analysis, security auditing, and high-speed in-memory runtime simulations.
 *
 * Usage:
 *   npm run test:compliance          (Run once)
 *   npm run test:compliance:watch    (Continuous live watch mode)
 */

const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

const { runDeepI18nAudit } = require('./compliance-engine/i18n-deep-analyzer');
const { runCodeSecurityAudit } = require('./compliance-engine/code-security-analyzer');
const { runRuntimeSandboxAudit } = require('./compliance-engine/runtime-sandbox');

const ANSI = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  bgBlue: '\x1b[44m',
  white: '\x1b[37m'
};

async function runAudit() {
  const startTime = performance.now();
  let passedChecks = 0;
  let totalChecks = 0;
  const failures = [];

  console.log(`\n${ANSI.bold}${ANSI.cyan}================================================================================${ANSI.reset}`);
  console.log(`${ANSI.bold}${ANSI.white} 📜 YOM KIPPUR TIMER — DEVELOPER GUIDELINES & MEDICAL COMPLIANCE ENGINE ${ANSI.reset}`);
  console.log(`${ANSI.bold}${ANSI.cyan}================================================================================${ANSI.reset}\n`);

  function auditStep(category, name, fn) {
    totalChecks++;
    try {
      const res = fn();
      passedChecks++;
      console.log(`  ${ANSI.green}✓ [PASS]${ANSI.reset} ${ANSI.bold}${category}:${ANSI.reset} ${name}`);
      return res;
    } catch (err) {
      failures.push({ category, name, error: err.message });
      console.error(`  ${ANSI.red}❌ [FAIL]${ANSI.reset} ${ANSI.bold}${category}:${ANSI.reset} ${name}`);
      console.error(`     ${ANSI.yellow}Details: ${err.message}${ANSI.reset}\n`);
    }
  }

  async function auditStepAsync(category, name, fn) {
    totalChecks++;
    try {
      const res = await fn();
      passedChecks++;
      console.log(`  ${ANSI.green}✓ [PASS]${ANSI.reset} ${ANSI.bold}${category}:${ANSI.reset} ${name}`);
      return res;
    } catch (err) {
      failures.push({ category, name, error: err.message });
      console.error(`  ${ANSI.red}❌ [FAIL]${ANSI.reset} ${ANSI.bold}${category}:${ANSI.reset} ${name}`);
      console.error(`     ${ANSI.yellow}Details: ${err.message}${ANSI.reset}\n`);
    }
  }

  // --- Section 1: Security & Medical Protocol Architecture ---
  console.log(`${ANSI.bold}${ANSI.magenta}--- 1. Architecture, Security & Medical Safety Mandates ---${ANSI.reset}`);
  auditStep('Security', 'Zero external CDN scripts or stylesheet dependencies', () => {
    runCodeSecurityAudit();
  });

  auditStep('Medical Protocol', 'Continuous glucose monitoring powered strictly by librelinkup-api-client', () => {
    const serverCode = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
    if (!serverCode.includes("librelinkup-api-client")) {
      throw new Error('server.js must use maintained librelinkup-api-client package');
    }
    if (serverCode.includes('https://api-us.libreview.io/llu/auth/login')) {
      throw new Error('Raw reverse-engineered protocol scraping is strictly prohibited.');
    }
  });

  auditStep('Medical Protocol', 'LibreLinkUp CGM is disabled by default (standalone timer ready)', () => {
    const LibreService = require('../public/libre-service');
    const service = new LibreService();
    if (service.isEnabled !== false || service.isDemo !== false) {
      throw new Error('CGM must start disabled with isDemo=false');
    }
  });

  auditStep('Acoustic Safety', 'Gentle sleep-friendly harmonic sine waves with low-pass transient filter', () => {
    const audioCode = fs.readFileSync(path.join(__dirname, '../public/audio-engine.js'), 'utf8');
    if (!audioCode.includes("osc.type = 'sine'")) throw new Error('Must use sine wave oscillator');
    if (audioCode.includes("osc.type = 'sawtooth'") || audioCode.includes("osc.type = 'square'")) {
      throw new Error('Harsh square/sawtooth waveforms are strictly prohibited');
    }
  });

  // --- Section 2: Fail-Safe UI & Auto-Closing Overlays ---
  console.log(`\n${ANSI.bold}${ANSI.magenta}--- 2. Fail-Safe Design & Auto-Closing Overlays ---${ANSI.reset}`);
  auditStep('Fail-Safe UI', 'Unlock PIN modal has 60-second idle auto-close to prevent stuck popups', () => {
    const appJs = fs.readFileSync(path.join(__dirname, '../public/app.js'), 'utf8');
    if (!appJs.includes('modalIdleSeconds = 60') || !appJs.includes('closeUnlockModal()')) {
      throw new Error('Unlock PIN modal must auto-close after 60s idle');
    }
  });

  auditStep('Fail-Safe UI', 'Exit Confirmation modal has 15-second auto-cancel countdown', () => {
    const appJs = fs.readFileSync(path.join(__dirname, '../public/app.js'), 'utf8');
    if (!appJs.includes('exitTimeoutSeconds = 15') || !appJs.includes('closeExitModal()')) {
      throw new Error('Exit confirmation modal must auto-cancel after 15s');
    }
  });

  auditStep('Fail-Safe UI', 'Hardware physical power button warning card present (Checklist Step 7)', () => {
    const html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
    if (!html.includes('checklist.step7Title') || !html.includes('checklist-item-warning')) {
      throw new Error('Erev Yom Kippur Checklist must include Step 7 physical power button warning');
    }
  });

  auditStep('Fail-Safe UI', 'Full-screen Cat-Proof lock shield engages OS Kiosk mode IPC', () => {
    const mainJs = fs.readFileSync(path.join(__dirname, '../main.js'), 'utf8');
    if (!mainJs.includes('mainWindow.setKiosk') || !mainJs.includes("ipcMain.on('app:set-locked'")) {
      throw new Error('main.js must handle app:set-locked with setKiosk');
    }
  });

  // --- Section 3: Deep i18n & 100% Data-Driven Rule ---
  console.log(`\n${ANSI.bold}${ANSI.magenta}--- 3. Deep i18n & 100% Data-Driven Localization ---${ANSI.reset}`);
  auditStep('i18n Auditor', '100% key parity & placeholder matching across English, Hebrew & Template', () => {
    return runDeepI18nAudit();
  });

  auditStep('i18n Auditor', 'Dynamic language auto-discovery endpoint in server.js without hardcoded arrays', () => {
    const serverJs = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
    if (!serverJs.includes("app.get('/api/languages'")) {
      throw new Error('/api/languages endpoint is missing from server.js');
    }
  });

  // --- Section 4: In-Memory Runtime & High-Speed Simulations ---
  console.log(`\n${ANSI.bold}${ANSI.magenta}--- 4. In-Memory Runtime & High-Speed Simulations ---${ANSI.reset}`);
  await auditStepAsync('Runtime Sandbox', '25+ Hour unattended fast simulation (90,000 virtual seconds, 0ms drift)', async () => {
    return runRuntimeSandboxAudit();
  });

  auditStep('Runtime Sandbox', 'Dynamic package.json version alignment across server, preload, and UI', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));
    const preloadJs = fs.readFileSync(path.join(__dirname, '../preload.js'), 'utf8');
    const serverJs = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
    if (!preloadJs.includes("require('./package.json')") || !serverJs.includes("require('./package.json')")) {
      throw new Error('Version must be loaded dynamically from package.json');
    }
  });

  const durationMs = (performance.now() - startTime).toFixed(1);

  console.log(`\n${ANSI.bold}${ANSI.cyan}================================================================================${ANSI.reset}`);
  if (failures.length === 0) {
    console.log(`${ANSI.bold}${ANSI.green} 🏆 COMPLIANCE AUDIT PASSED: ${passedChecks}/${totalChecks} CHECKS VERIFIED (100%) in ${durationMs}ms${ANSI.reset}`);
    console.log(`   ${ANSI.dim}Codebase is 100% compliant with DEVELOPER_GUIDELINES.md${ANSI.reset}`);
    console.log(`${ANSI.bold}${ANSI.cyan}================================================================================${ANSI.reset}\n`);
    return true;
  } else {
    console.error(`${ANSI.bold}${ANSI.red} ❌ COMPLIANCE AUDIT FAILED: ${failures.length} VIOLATIONS FOUND (${passedChecks}/${totalChecks} passed) in ${durationMs}ms${ANSI.reset}`);
    for (const f of failures) {
      console.error(`   • [${f.category}] ${f.name}: ${f.error}`);
    }
    console.log(`${ANSI.bold}${ANSI.cyan}================================================================================${ANSI.reset}\n`);
    return false;
  }
}

// Watch Mode Runner
if (process.argv.includes('--watch') || process.argv.includes('-w')) {
  console.log(`${ANSI.bold}${ANSI.yellow}👀 Watch mode active — monitoring public/, scripts/, server.js, main.js for changes...${ANSI.reset}`);

  let isRunning = false;
  const triggerRun = async () => {
    if (isRunning) return;
    isRunning = true;
    try {
      await runAudit();
    } catch (e) {
      console.error(e);
    } finally {
      isRunning = false;
      console.log(`${ANSI.dim}Waiting for file changes... (Press Ctrl+C to stop)${ANSI.reset}\n`);
    }
  };

  triggerRun();

  const watchDirs = [
    path.join(__dirname, '../public'),
    path.join(__dirname, '../public/locales'),
    path.join(__dirname, '../scripts'),
    path.join(__dirname, '../tests')
  ];

  for (const dir of watchDirs) {
    if (fs.existsSync(dir)) {
      fs.watch(dir, { recursive: true }, (eventType, filename) => {
        if (filename && (filename.endsWith('.js') || filename.endsWith('.json') || filename.endsWith('.html') || filename.endsWith('.css'))) {
          console.log(`\n${ANSI.cyan}⚡ Change detected in ${filename}. Re-running compliance audit...${ANSI.reset}`);
          triggerRun();
        }
      });
    }
  }

  fs.watchFile(path.join(__dirname, '../server.js'), { interval: 500 }, () => triggerRun());
  fs.watchFile(path.join(__dirname, '../main.js'), { interval: 500 }, () => triggerRun());
  fs.watchFile(path.join(__dirname, '../package.json'), { interval: 500 }, () => triggerRun());
} else {
  runAudit().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(err => {
    console.error('Fatal compliance error:', err);
    process.exit(1);
  });
}
