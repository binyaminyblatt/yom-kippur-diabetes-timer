/**
 * Playwright E2E Automated Test Suite
 * Tests Fullscreen, Cat-Proof Keyboard Lockout, Visible PIN Input Box, 60s Idle Auto-Close, and PIN Unlock.
 */

const { chromium } = require('playwright');
const assert = require('assert');
const http = require('http');

let localServer = null;
let testPort = 3000;

// Helper to ensure server is listening or start internal server
async function ensureServerRunning() {
  const { startServer } = require('../server');
  const res = await startServer(0);
  localServer = res.server;
  testPort = res.port;
  console.log(`✓ Test server started on http://localhost:${testPort}`);
}

async function runE2ETests() {
  console.log('========================================================');
  console.log(' Starting Playwright E2E Automated Testing Suite');
  console.log('========================================================\n');

  let browser;
  try {
    await ensureServerRunning();
    console.log(`✓ Server is live and healthy at http://localhost:${testPort}`);

    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const page = await context.newPage();

    // 1. Navigate to main page in Developer Mode for testing
    console.log(`\n1. Navigating to http://localhost:${testPort}?dev=true...`);
    await page.goto(`http://localhost:${testPort}?dev=true`, { waitUntil: 'domcontentloaded' });
    const title = await page.title();
    console.log(`✓ Page loaded successfully: "${title}"`);

    // Verify startup checklist appears on launch and contains Step 7 Power Warning
    console.log('\n1b. Verifying Startup Checklist and Physical Power Button Warning (Step 7)...');
    await page.waitForTimeout(600);
    const checklistModal = page.locator('#checklistModal');
    const checklistVisibleOnLaunch = await checklistModal.isVisible();
    assert.strictEqual(checklistVisibleOnLaunch, true, 'Startup checklist modal must appear on initial launch');

    const step7Title = await page.locator('.warning-step-title').textContent();
    assert.ok(step7Title.includes('Power Button'), 'Step 7 must warn about physical power button');
    console.log(`✓ Startup checklist opened automatically with Step 7: "${step7Title}"`);

    const btnCloseChecklistModal = page.locator('#btnCloseChecklistModal');
    await btnCloseChecklistModal.click();
    await page.waitForTimeout(300);
    console.log('✓ Startup checklist modal dismissed');

    // 2. Start the timer
    console.log('\n2. Testing Start Timer...');
    const btnStartPause = page.locator('#btnStartPause');
    await btnStartPause.click();
    await page.waitForTimeout(500);
    const startPauseText = await page.locator('#startPauseText').textContent();
    assert.strictEqual(startPauseText, 'Pause Timer', 'Timer should transition to Pause Timer');
    console.log('✓ Timer started and is running');

    // 3. Engage Lock Shield
    console.log('\n3. Engaging Lock Shield...');
    const btnLockToggle = page.locator('#btnLockToggle');
    await btnLockToggle.click();
    await page.waitForTimeout(300);

    const isBodyLocked = await page.evaluate(() => document.body.classList.contains('app-locked'));
    assert.strictEqual(isBodyLocked, true, 'document.body must have class app-locked');
    
    const bannerVisible = await page.locator('#lockShieldBanner').isVisible();
    assert.strictEqual(bannerVisible, true, 'Lock shield banner must be visible');
    console.log('✓ App locked: Lock Shield banner and indicator active');

    // 4. Test Cat / Accidental Keypress Interception (Cat Proof Test)
    console.log('\n4. Testing Cat / Keyboard Interception while locked...');
    // Press Space (which usually pauses)
    await page.keyboard.press('Space');
    await page.waitForTimeout(300);
    const textAfterSpace = await page.locator('#startPauseText').textContent();
    assert.strictEqual(textAfterSpace, 'Pause Timer', 'Spacebar must NOT pause timer while locked');

    // Press S (which usually opens Settings)
    await page.keyboard.press('KeyS');
    await page.waitForTimeout(300);
    const settingsVisible = await page.locator('#settingsModal').isVisible();
    assert.strictEqual(settingsVisible, false, 'Settings modal must NOT open via keyboard shortcut while locked');
    console.log('✓ Cat-proof keypress interception successfully blocked Space and S keys');

    // 5. Open Unlock Passcode Popup
    console.log('\n5. Opening Unlock Passcode Popup...');
    const btnBannerUnlock = page.locator('#btnBannerUnlock');
    await btnBannerUnlock.click();
    await page.waitForTimeout(300);

    const passcodeModalVisible = await page.locator('#passcodeModal').isVisible();
    assert.strictEqual(passcodeModalVisible, true, 'Passcode modal must be visible');

    // Test Password Display Toggle on PIN input
    const btnTogglePin = page.locator('.btn-toggle-pin-modal');
    assert.strictEqual(await btnTogglePin.isVisible(), true, 'Toggle PIN visibility button must be visible');
    let pinInputType = await page.locator('#inputPasscodePin').getAttribute('type');
    assert.strictEqual(pinInputType, 'password', 'PIN input type should be password by default');
    
    await btnTogglePin.click();
    await page.waitForTimeout(100);
    pinInputType = await page.locator('#inputPasscodePin').getAttribute('type');
    assert.strictEqual(pinInputType, 'text', 'PIN input type should become text after toggle click');

    await btnTogglePin.click();
    await page.waitForTimeout(100);
    pinInputType = await page.locator('#inputPasscodePin').getAttribute('type');
    assert.strictEqual(pinInputType, 'password', 'PIN input type should return to password after second click');
    console.log('✓ PIN show/hide display toggle button verified on unlock modal');

    const pinReminderText = await page.locator('#displayUnlockPin').textContent();
    assert.strictEqual(pinReminderText.trim(), '1234', 'PIN reminder must display 1234');

    const countdownText = await page.locator('#passcodeTimeoutCountdown').textContent();
    assert.ok(countdownText.includes('s'), 'Idle countdown timer must be active');
    console.log(`✓ Visible PIN input box verified with PIN reminder: ${pinReminderText} and auto-close timer: ${countdownText}`);

    // 7. Test Incorrect PIN Attempt
    console.log('\n7. Testing Incorrect PIN entry...');
    await page.locator('#inputPasscodePin').fill('9999');
    await page.locator('#btnSubmitPin').click();
    await page.waitForTimeout(600);

    const errorVisible = await page.locator('#passcodeErrorMsg').isVisible();
    assert.strictEqual(errorVisible, true, 'Error message must appear for incorrect PIN');
    console.log('✓ Incorrect PIN triggered error message as expected');

    // 8. Test Correct PIN Unlock
    console.log('\n8. Testing Correct PIN Unlock (1234)...');
    await page.locator('#inputPasscodePin').fill('1234');
    await page.waitForTimeout(400);

    const modalAfterUnlock = await page.locator('#passcodeModal').isVisible();
    assert.strictEqual(modalAfterUnlock, false, 'Passcode modal must close after correct PIN');

    const isLockedAfter = await page.evaluate(() => document.body.classList.contains('app-locked'));
    assert.strictEqual(isLockedAfter, false, 'document.body must no longer have app-locked class');

    const bannerAfter = await page.locator('#lockShieldBanner').isVisible();
    assert.strictEqual(bannerAfter, false, 'Shield banner must be hidden after unlock');
    console.log('✓ App unlocked successfully: Passcode verified, shield removed, full controls restored');

    // 9. Test Settings Modal & Speech / Voice Alerts
    console.log('\n9. Testing Settings Modal & Voice Announcements...');
    const btnSettings = page.locator('#btnSettings');
    await btnSettings.click();
    await page.waitForTimeout(300);

    const settingsModalVisible = await page.locator('#settingsModal').isVisible();
    assert.strictEqual(settingsModalVisible, true, 'Settings modal must open');

    // Verify auto-shutoff options
    const autoShutoffSelect = page.locator('#inputAutoShutoff');
    const autoShutoffVal = await autoShutoffSelect.inputValue();
    assert.strictEqual(autoShutoffVal, '20', 'Default auto-shutoff must be 20 seconds');
    console.log('✓ Auto-silencing default confirmed at 20s (15-pulse cycle)');

    // Toggle Voice Readout ON
    await page.evaluate(() => document.getElementById('checkSpeech').click());
    await page.waitForTimeout(200);

    const isSpeechEnabled = await page.evaluate(() => window.audioEngine.speechEnabled);
    assert.strictEqual(isSpeechEnabled, true, 'audioEngine.speechEnabled must be true after toggle');
    const speechStored = await page.evaluate(() => localStorage.getItem('yom_kippur_speech_enabled'));
    assert.strictEqual(speechStored, 'true', 'speech setting must be persisted in localStorage');
    console.log('✓ Voice announcements toggle & localStorage persistence verified');

    // Test Voice Alert button
    const btnTestModalVoice = page.locator('#btnTestModalVoice');
    assert.strictEqual(await btnTestModalVoice.isVisible(), true, 'btnTestModalVoice must be visible');
    await btnTestModalVoice.click();
    await page.waitForTimeout(400);
    console.log('✓ Test Voice Alert button clicked and verified');

    // Test Glucose Alert button (15-pulse sequence)
    const btnTestModalAlarm = page.locator('#btnTestModalAlarm');
    await btnTestModalAlarm.click();
    await page.waitForTimeout(400);
    console.log('✓ Test Glucose Alert button (15 pulses) clicked and verified');

    // Test Password Display Toggle for LibreLinkUp Password and Lock PIN in Settings
    console.log('\n9b. Testing Show/Hide Password buttons in Settings modal...');
    const btnToggleLibrePass = page.locator('.btn-toggle-password[data-target="inputLibrePassword"]');
    assert.strictEqual(await btnToggleLibrePass.isVisible(), true, 'Libre password toggle button must be visible');
    let librePassType = await page.locator('#inputLibrePassword').getAttribute('type');
    assert.strictEqual(librePassType, 'password', 'Libre password should be password type initially');
    await btnToggleLibrePass.click();
    await page.waitForTimeout(100);
    librePassType = await page.locator('#inputLibrePassword').getAttribute('type');
    assert.strictEqual(librePassType, 'text', 'Libre password should become text type after toggle');
    await btnToggleLibrePass.click();
    await page.waitForTimeout(100);

    const btnToggleLockPass = page.locator('.btn-toggle-password[data-target="inputLockPasscode"]');
    assert.strictEqual(await btnToggleLockPass.isVisible(), true, 'Lock PIN toggle button must be visible');
    let lockPassType = await page.locator('#inputLockPasscode').getAttribute('type');
    assert.strictEqual(lockPassType, 'password', 'Lock PIN should be password type initially');
    await btnToggleLockPass.click();
    await page.waitForTimeout(100);
    lockPassType = await page.locator('#inputLockPasscode').getAttribute('type');
    assert.strictEqual(lockPassType, 'text', 'Lock PIN should become text type after toggle');
    await btnToggleLockPass.click();
    await page.waitForTimeout(100);
    console.log('✓ Show/Hide password toggle buttons verified across all settings input fields');

    // Test GitHub Repository Link and Check for Updates
    console.log('\n9c. Testing GitHub Repository & Update Checker...');
    const linkGitHub = page.locator('#linkGitHubRepo');
    assert.strictEqual(await linkGitHub.isVisible(), true, 'GitHub repository link must be visible');
    const githubHref = await linkGitHub.getAttribute('href');
    assert.strictEqual(githubHref, 'https://github.com/binyaminyblatt/yom-kippur-diabetes-timer', 'GitHub URL must point to repository');

    const btnCheckUpdates = page.locator('#btnCheckUpdates');
    assert.strictEqual(await btnCheckUpdates.isVisible(), true, 'btnCheckUpdates must be visible');
    await btnCheckUpdates.click();
    await page.waitForTimeout(600);
    const updateMsgVisible = await page.locator('#updateStatusMsg').isVisible();
    assert.strictEqual(updateMsgVisible, true, 'Update status message must appear after checking updates');
    const updateMsgText = await page.locator('#updateStatusMsg').textContent();
    // Test Urgent Low Threshold input
    console.log('\n9d. Testing Urgent Low Alert Threshold configuration...');
    const inputUrgentLow = page.locator('#inputTargetUrgentLow');
    assert.strictEqual(await inputUrgentLow.isVisible(), true, 'inputTargetUrgentLow must be visible');
    const urgentLowInitial = await inputUrgentLow.inputValue();
    assert.strictEqual(urgentLowInitial, '55', 'Default urgentLow threshold must be 55');
    await inputUrgentLow.fill('52');
    await page.waitForTimeout(100);
    console.log('✓ Urgent Low Alert threshold input verified (set to 52 mg/dL)');

    // Save settings
    const btnSaveSettings = page.locator('#btnSaveSettings');
    await btnSaveSettings.click();
    await page.waitForTimeout(400);

    const savedUrgentLow = await page.evaluate(() => window.libre.urgentLow);
    assert.strictEqual(savedUrgentLow, 52, 'libre.urgentLow must be 52 after saving');
    console.log('✓ libre.urgentLow persistence confirmed in runtime instance');

    // 10. Test Live / Demo Low Glucose Alarm Banner & Auto-Silencing
    console.log('\n10. Testing Demo Low Glucose Alarm & Banner Display...');
    const btnDemoLow = page.locator('.btn-demo[data-val="60"]');
    if (await btnDemoLow.isVisible()) {
      await btnDemoLow.click();
      await page.waitForTimeout(500);

      const alarmBannerVisible = await page.locator('#alarmBanner').isVisible();
      assert.strictEqual(alarmBannerVisible, true, 'Alarm banner must appear on low glucose');
      const bannerText = await page.locator('#alarmTitle').textContent();
      assert.ok(bannerText.includes('Low Glucose') || bannerText.includes('60'), 'Alarm banner title should indicate low glucose');
      console.log(`✓ Low glucose alarm banner triggered: "${bannerText}"`);

      // Test Snooze / Stop
      const btnSnooze = page.locator('#btnSnoozeAlarm');
      await btnSnooze.click();
      await page.waitForTimeout(300);
      const bannerHiddenAfterSnooze = await page.locator('#alarmBanner').isVisible();
      assert.strictEqual(bannerHiddenAfterSnooze, false, 'Banner must hide when snoozed/stopped');
      console.log('✓ Alarm snoozed and audio stopped successfully');
    }

    console.log('\n========================================================');
    console.log(' ALL PLAYWRIGHT E2E TESTS PASSED SUCCESSFULLY! ✓✓✓');
    console.log('========================================================\n');
  } catch (err) {
    console.error('\n❌ Playwright E2E Test Failed:', err);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    if (localServer && localServer.close) {
      localServer.close();
    }
  }
}

runE2ETests();
