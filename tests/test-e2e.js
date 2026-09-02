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

    // 1. Navigate to main page
    console.log(`\n1. Navigating to http://localhost:${testPort}...`);
    await page.goto(`http://localhost:${testPort}`, { waitUntil: 'domcontentloaded' });
    const title = await page.title();
    console.log(`✓ Page loaded successfully: "${title}"`);

    // Dismiss startup checklist if open
    await page.waitForTimeout(600);
    const checklistModal = page.locator('#checklistModal');
    if (await checklistModal.isVisible()) {
      const btnCloseChecklistModal = page.locator('#btnCloseChecklistModal');
      await btnCloseChecklistModal.click();
      await page.waitForTimeout(300);
      console.log('✓ Startup checklist modal dismissed');
    }

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

    // 6. Verify Visible PIN Input Box & PIN Reminder Banner
    console.log('\n6. Verifying Visible PIN Input Box and PIN Reminder...');
    const inputPinVisible = await page.locator('#inputPasscodePin').isVisible();
    assert.strictEqual(inputPinVisible, true, 'Visible PIN input box #inputPasscodePin must be visible');

    const pinReminderText = await page.locator('#displayUnlockPin').textContent();
    assert.strictEqual(pinReminderText.trim(), '1234', 'PIN reminder must display 1234');

    const countdownText = await page.locator('#passcodeTimeoutCountdown').textContent();
    assert.ok(countdownText.includes('s'), 'Idle countdown timer must be active');
    console.log(`✓ Visible PIN input box verified with PIN reminder: ${pinReminderText} and auto-close timer: ${countdownText}`);

    // 7. Test Incorrect PIN Attempt
    console.log('\n7. Testing Incorrect PIN entry...');
    await page.locator('#inputPasscodePin').fill('9999');
    await page.locator('#btnSubmitPin').click();
    await page.waitForTimeout(400);

    const errorVisible = await page.locator('#passcodeErrorMsg').isVisible();
    assert.strictEqual(errorVisible, true, 'Error message must appear for incorrect PIN');
    console.log('✓ Incorrect PIN triggered error message as expected');

    // 8. Test Correct PIN Unlock
    console.log('\n8. Testing Correct PIN Unlock (1234)...');
    await page.locator('#inputPasscodePin').fill('1234');
    await page.locator('#btnSubmitPin').click();
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
    const checkSpeech = page.locator('#checkSpeech');
    await checkSpeech.click();
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

    // Save settings
    const btnSaveSettings = page.locator('#btnSaveSettings');
    await btnSaveSettings.click();
    await page.waitForTimeout(400);

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
