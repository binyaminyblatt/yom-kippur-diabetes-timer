# 📜 Yom Kippur Diabetes Timer - Project Instructions & Architectural Guidelines

This document outlines the core architectural principles, safety requirements, design standards, and coding conventions for contributing to or developing the **Yom Kippur Diabetes Interval Timer & LibreLinkUp CGM** application.

---

## 🌟 1. Mission, Medical & Halachic Principles

1. **Unattended 25+ Hour Operation**:
   - The application is set up once before Yom Kippur starts (*Erev Yom Kippur*) and must run smoothly, continuously, and unattended without touching electronics, moving mice, or pressing buttons for 25+ hours.
2. **Pikuach Nefesh (Life Safety First)**:
   - Preserving life overrides fasting. Critical alarms (urgent low glucose, severe sensor alerts) must be distinct, audible, and clearly conveyed visually and via gentle speech announcements.
3. **Gentle, Sleep-Friendly Sound Design**:
   - Alarms and interval chimes must be soothing and gentle (warm sine tones, marimba, cabin chimes) with smooth attacks and zero harsh, screeching square/sawtooth transients.
   - Glucose alarms repeat for 15 harmonic pulses (~20 seconds) and automatically self-silence so they do not disturb prayer or sleep indefinitely.
4. **Offline-First Mandate & Disableable Online Features**:
   - All code and features **must work offline as much as possible**. Core interval timers, harmonic audio synthesizers, Zmanim calculations, and UI interactions must never require an active internet connection.
   - If an online connection is required for a feature (such as cloud CGM syncing), the feature **must be completely disableable** via user settings, configuration toggles, and safe defaults.
   - It is permitted to implement online enhancements (e.g. Azure Neural TTS) as long as there is an **automatic, robust offline fallback** (e.g. pre-bundled audio assets, local WebSpeech) that engages seamlessly without error if the network drops or is absent.
   - **CGM Integrations (Safety & Maintenance Mandate)**:
     - **Maintained npm Packages Only**: Any Continuous Glucose Monitor (CGM) integration (e.g. LibreLinkUp, Dexcom) **must use an actively maintained, battle-tested npm package** (e.g. `librelinkup-api-client`).
     - **No Raw Reverse-Engineered Protocol Scraping in this Repo**: Hand-rolled, reverse-engineered API scraping code directly in this codebase is strictly prohibited. Unofficial medical device APIs change without notice; custom protocol implementations are a major safety hazard (*Pikuach Nefesh*) and must be maintained and verified by dedicated open-source teams with active sensor hardware across all device generations.
     - **Physical Hardware Access Required for Contributors**: Any contributor modifying, adding, or maintaining CGM adapters/packages **must have direct physical access to the actual hardware device / continuous glucose sensor** (e.g. FreeStyle Libre 2/3, Dexcom) and an active account for end-to-end real-device verification.
     - **Optional & Disabled by Default**: The CGM cloud monitoring feature is optional and must remain disabled by default. The system must function 100% reliably as a standalone interval timer if cloud monitoring is disabled or unavailable.

---

## 🛡️ 2. Fail-Safe Design & Auto-Closing Overlays

> [!IMPORTANT]
> **Core Principle: The application MUST always fail-safe back to the active home dashboard.**

### A. Mandatory Auto-Close Timers for Popups & Overlays
- **Zero Permanent Blockers**: No accidental touch, keypress, or transient event during the 25-hour fast must ever leave a dialog stuck on screen obscuring the countdown timer or glucose readings.
- **Auto-Close Rules**:
  - **Unlock PIN Modal**: Must have an active countdown timer (default 60 seconds) that automatically dismisses the popup and returns to the locked home screen if left untouched.
  - **Exit Confirmation Modal**: Must have an auto-cancel timer that returns to the home screen.
  - **Informational / Alert Popups**: Must automatically self-dismiss after a safe timeout.
  - **Exceptions**: Only the pre-fast **Settings Modal** and the initial pre-fast **Startup Checklist** (which are only used *before* Yom Kippur begins during initial setup) do not auto-close.

### B. Safe Default Fallbacks & Offline Resilience
- **Offline By Default**: Core features operate entirely offline without network requirements.
- **Network Drop Protection**: If the network goes down, the timer **must continue running locally without interruption**.
- **CGM Disconnect Handling**: If the CGM disconnects, credentials fail, or cloud servers are unreachable, the app **must display clear status indicators and continue timer cadences without freezing**.
- **TTS Fallback Cascade**: If online TTS fails or is unavailable, speech **must cascade seamlessly to pre-bundled offline audio (Tier 2) and local OS WebSpeech (Tier 3)** without uncaught exceptions or UI lag.

---

## ⚠️ 3. Potential Dangers, Halachic Risks & Mitigations

Developers and contributors must ensure the following failure modes are actively guarded against:

| Potential Danger | Impact / Risk | Mandatory Mitigation |
| :--- | :--- | :--- |
| **OS Sleep / Screen Blanking** | Computer enters sleep/standby, stopping timer and alarms mid-fast. | Electron `powerSaveBlocker` (`prevent-display-sleep`) + browser `navigator.wakeLock` + Step 1 of Erev Yom Kippur Checklist. |
| **Battery Depletion / Power Loss** | Laptop battery dies before the 25-hour fast ends. | Prominent warnings in pre-fast checklist to plug laptop into dedicated AC wall power. |
| **Physical Power Button Accidental Press** | A pet or family member physically presses the laptop power button, shutting down the computer. | Explicit pre-fast warning card (Checklist Step 7) instructing users to tape a bottle cap or physical shield over the power button. |
| **Accidental Keypress / Cat Tampering** | Pet walks across keyboard, clicking buttons or changing intervals. | Full-screen **Cat-Proof Lock Shield** intercepting all keyboard, touch, and mouse clicks until unlocked with a PIN. |
| **Accidental App Exit** | Accidental `Cmd+Q` / `Alt+F4` or close button click. | Intercepted exit handler with confirmation dialog and auto-cancel timer. |
| **Network Outage / Cloud Sync Failure** | LibreLinkUp Abbott servers become unreachable. | Visual offline badge, clear diagnostic messaging, and halachic reminders to use a physical blood glucometer if CGM data is unavailable. |
| **OS Hardware Audio Muting** | Computer volume is set to 0% or muted at system level. | Pre-fast sound check buttons in Settings modal and Checklist step to verify physical speaker volume. |
| **Robotic / Illegible Speech** | Legacy 1990s robotic voices (`Alex`, `Albert`, `Fred`) mispronouncing glucose alerts. | 3-tier speech cascade with Azure Neural voices, pre-bundled studio audio assets, and `@readium/speech` quality ranking. |

---

## 🌐 4. Internationalization (i18n) & 100% Data-Driven Rule

> [!IMPORTANT]
> **NO Hardcoded Strings or Language Tables in Code!**
> All user-facing strings, regional mappings, layout directions, and voice configurations MUST live in the locale JSON files (`public/locales/`), NEVER hardcoded in JavaScript or HTML.
> 
> All `_meta` configuration options must be thoroughly documented in [`TRANSLATION_GUIDE.md`](TRANSLATION_GUIDE.md).

### A. The `_meta` Schema
Every locale file (`public/locales/<lang>.json`) must define its complete configuration in `_meta`:
```json
{
  "_meta": {
    "languageCode": "en",
    "languageName": "English",
    "direction": "ltr",
    "flag": "🇺🇸",
    "defaultRegion": "en-US",
    "neuralVoice": "en-US-JennyNeural",
    "regions": [
      "en-US",
      "en-GB",
      "en-CA",
      "en-AU",
      "en-NZ",
      "en-IE",
      "en-ZA",
      "en-IN"
    ]
  },
  "alerts": {
    "speech": {
      "lowGlucose": "Low blood glucose alert. Consume fast-acting carbohydrates according to medical guidance.",
      "highGlucose": "High blood glucose alert.",
      "urgentLowGlucose": "Urgent low blood glucose. Life safety overrides fasting.",
      "testVoiceAlert": "Glucose voice alert test: Low glucose alert"
    }
  }
}
```

### B. Requirements for Locales:
- **Dynamic Discovery**: The backend (`/api/languages`) and frontend discover languages dynamically from `public/locales/*.json`. Never hardcode language arrays in JS.
- **100% Key Parity**: All translation files (`en.json`, `he.json`, `template.json`) must maintain 100% key parity. Verify with `node tests/test-i18n.js`.
- **RTL Support**: Hebrew, Yiddish, Arabic, etc., set `"direction": "rtl"`. The UI and circular SVG countdown rings automatically flip directions.

---

## 🔊 5. Audio & Speech Synthesis (3-Tier Cascade)

The speech announcement pipeline must strictly follow a 3-tier cascade to ensure high-fidelity neural audio when online, while guaranteeing 100% operation when offline or behind filtered internet:

1. **Tier 1 — Online Azure Neural TTS (`msedge-tts` via `/api/tts`)**:
   - Synthesizes dynamic neural speech using Microsoft Azure Cognitive models specified in `_meta.neuralVoice`.
   - Caches audio on disk (`cache/tts/`) with a strict LRU cap (max 50 files / 5 MB).
2. **Tier 2 — Pre-bundled Static Audio Fallback (`public/audio/alerts/`)**:
   - Pre-rendered 24kHz mono MP3 assets (<0.25 MB total footprint) for standard alerts (`lowGlucose`, `highGlucose`, `urgentLowGlucose`, `testVoiceAlert`).
   - Generated dynamically from locale files via `npm run generate:audio`.
   - Plays instantly with zero network access.
3. **Tier 3 — Local OS WebSpeech Fallback (`@readium/speech` + `speechSynthesis`)**:
   - Resolves system voices across macOS, Windows, and Linux.
   - Automatically penalizes/excludes robotic legacy voices (`Alex`, `Albert`, `Fred`, `espeak`) and prioritizes natural/enhanced voices (`Samantha`, `Ava`, `Daniel`, `Carmit`).

---

## 🛡️ 6. Security, SSL Inspection, Offline-First Architecture & Network Resilience

1. **Offline-First Principle & Disableable Online Features**:
   - All components must be built to run offline whenever possible.
   - Any feature requiring an active internet connection (e.g. cloud CGM polling) **must be fully disableable** by the user and defaulted to safe offline states.
   - It is fine to implement online capabilities with higher fidelity (e.g. Azure Neural TTS) provided an **offline fallback** (e.g. pre-bundled audio, WebSpeech) is always present and active.
2. **Kosher / Filtered Internet Compatibility**:
   - The application must support SSL inspection filters (NetFree, Techloq, NetSpark, Meshimer).
   - `system-ca.js` automatically loads and trusts operating system root/intermediate certificates on startup before any network calls.
3. **Local Bundling (Zero External CDN Dependencies)**:
   - All fonts (`@fontsource/`), CSS, audio assets, and vendor bundles (`@readium/speech`, `i18next`) must be bundled locally in `public/`. No runtime dependencies on external CDNs (unpkg, cdnjs, Google Fonts).
4. **License Compatibility**:
   - Keep all dependencies MIT/Apache-2.0/BSD compliant. Avoid GPL copyleft dependencies to preserve the project's permissive MIT license.

---

## 🔒 7. Cat-Proof Lock Shield & Safety Controls

1. **Full-Screen Lock Shield**:
   - Intercepts all spacebar, keyboard, touch, and mouse clicks when locked to prevent accidental touches by pets or children.
2. **Passcode Protection**:
   - PIN unlock dialog with show/hide toggle, PIN reminder, and 60-second auto-close timeout.
3. **App Exit Confirmation**:
   - Requires explicit multi-step confirmation or PIN entry before quitting to prevent accidental closure on Yom Kippur.

---

## 🧪 8. Testing & Quality Verification

Before committing any changes, all three test suites must pass cleanly:

```bash
# 1. Run full Developer Guidelines & Safety Compliance audit
npm run test:compliance

# (Optional) Run continuous watch-mode compliance monitoring during development
npm run test:compliance:watch

# 2. Verify 100% translation key parity across all dictionaries
node tests/test-i18n.js

# 3. Run unit & backend logic tests (timers, audio math, CGM, Zmanim, CA store)
npm test

# 4. Run full Playwright browser end-to-end tests
npm run test:e2e
```

---

## 📦 9. Build & Distribution

- **Cross-Platform**: Packaged with `electron-builder` for macOS (Universal, x64, arm64), Windows (NSIS installer & portable), and Linux (AppImage, deb, rpm, pacman).
- **Scripts**:
  - `npm run dev`: Concurrent server + electron development.
  - `npm run bundle:speech`: Re-bundle `@readium/speech` into `public/vendor/`.
  - `npm run generate:audio`: Re-render pre-bundled compact fallback MP3 audio files.
