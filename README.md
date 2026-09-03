# 🕯️ Yom Kippur Diabetes Interval Timer & LibreLinkUp CGM

[**English**](README.md) | [**עברית (Hebrew)**](README.he.md) | [**Translation Guide**](TRANSLATION_GUIDE.md)

An automated, unattended **Eating Interval (*Achila l'Shiurim*) Timer and Continuous Glucose Monitor (CGM) Display** designed specifically for individuals with diabetes or medical needs who must consume measured portions on **Yom Kippur** (*Pikuach Nefesh*) without operating electronics during the fast.

> [!WARNING]
> ### ⚠️ Medical & Halachic Disclaimer
> **Please consult with your doctor (physician) and your rabbi before using this application.**
>
> - **Medical Guidance**: Managing diabetes or any other medical condition on Yom Kippur involves serious health risks (*Pikuach Nefesh*). Always consult your medical provider for specific instructions on fasting, interval eating, hydration, glucose targets, and medication adjustments.
> - **Halachic Guidance**: Required eating/drinking measurements (*Shiurim*) and interval timing must be established in advance with a qualified orthodox Rabbi.
> - **No Liability**: This tool is provided strictly on an "as-is" basis for informational and convenience purposes. The author(s) and contributor(s) take **no responsibility or liability** for any problems, software malfunctions, inaccurate data, or health issues, complications, or medical emergencies that may arise from using this application. You use this software entirely at your own risk.

---

## 🌟 Overview & Purpose

In Jewish Halacha, individuals whose medical conditions require eating or drinking on Yom Kippur are instructed to consume small halachic measures (*Shiurim* — typically under ~30–45cc food / 40cc liquid) spaced across defined time intervals (typically 9, 8, 6, or 4 minutes, according to rabbinic and medical guidance).

Operating phones, clicking buttons, or touching electronics is prohibited on Yom Kippur. This application is engineered to be **set up once before Yom Kippur starts (Erev Yom Kippur)** and left running completely untouched in **fullscreen mode** for 25+ hours.

---

## ✨ Key Features

### 1. ⏱️ Dual-Track Eating Interval Timer ($T$ & $T/2$)
- **Main Interval ($T$)**: Visual countdown and auditory chime indicating when the next halachic eating/drinking portion can be consumed (e.g., 9:00, 8:00, 6:00, 4:00, or any custom minute/second interval).
- **Halfway Preparation Track ($T/2$)**: Triggers an alert halfway through the interval (e.g., at 4:30 in a 9:00 interval) with a distinct melodic tone, giving you advance notice to prepare water or food portions without feeling rushed.
- **Progress Ring Visualizer**: Glowing neon circular SVG progress ring providing glanceable status from across the room.
- **One-Touch Presets**: Instant halachic presets for 9m, 8m, 6m, 5m, and 4m intervals.

### 2. 🩸 LibreLinkUp CGM Integration & Live Trend Graph
- **Real-Time Cloud Sync**: Connects securely to Abbott's **LibreLinkUp** cloud API (Freestyle Libre 2 / Libre 3 sensors) to monitor live blood glucose levels.
- **Worldwide Regional Support**: Full support for US, EU, Global, Germany, France, Japan, Asia Pacific, Canada, and UAE endpoints.
- **Glanceable Status Cards**: Real-time glucose value (mg/dL), trend direction arrows (↑, ↗, →, ↘, ↓), and time since last reading.
- **Interactive 12-Hour Glucose History Graph**: Color-coded safety zones (Hypoglycemia <70 in red, Target in green, Hyperglycemia >180 in yellow).
- **Simulated Demo Mode**: Built-in simulator with one-click test buttons (Low 58 mg/dL, Normal 110 mg/dL, High 225 mg/dL) for testing alarms before Yom Kippur.

### 3. 🔔 Ambient Gentle Chimes & Auto-Silencing
- **Synthesized Web Audio Engine**: Zero external audio files required. All chimes are dynamically synthesized using warm sine and triangle oscillators with harmonic overtone decay:
  - 🧘 **Zen Meditation Bowl** (Deep, resonant & sleep-friendly)
  - 🪵 **Warm Wooden Marimba** (Soft felt mallet)
  - 🎐 **Whisper Wind Bell** (Airy shimmer)
  - 💧 **Gentle Water Pluck** (Calm & organic)
  - ✈️ **Soft Cabin Chime** (Classic low-octave airplane ding-dong)
- **Automatic Audio Silencing**: Alarms and chimes automatically fade out after 3 to 5 seconds. You never need to touch the computer to silence an alarm.

### 4. 🕯️ Motzei Yom Kippur (Fast End) Countdown Clock
- **Halachic Zmanim Calculation**: Built with `kosher-zmanim` to compute local Sunset (*Shekiya*), Dusk (*Tzeit Hakochavim*), and Motzei Yom Kippur fast conclusion times across the full Hebrew calendar (Erev Yom Kippur candle lighting through Motzei Yom Kippur fast end).
- **Synagogue Calendar Verification**: Includes halachic reminders to verify calculated zmanim against the official calendar provided by your local synagogue or community rabbi.
- **Rabbinic Chumra Offsets**: Supports custom extra time additions (+0m, +18m, +30m, +72m Rabbeinu Tam) and manual date/time override.
- **Live Multi-Phase Countdown**: Displays dynamic status for *Yom Kippur Night*, *Yom Kippur Day*, *Upcoming Fast*, and *Fast Concluded*.

### 5. 🛡️ Cat-Proof & Accidental Touch Lock Shield
- **Complete Keyboard Capture**: Global capture-phase listeners intercept and swallow all physical keystrokes (Spacebar, S, function keys, numbers, and random key mashing from a cat walking across the keyboard).
- **Scroll Wheel & Gesture Suppression**: Locks out mouse wheel scrolling and touch swiping (`overflow: hidden` and `wheel` capture) so the screen layout cannot be scrolled or dislodged.
- **Text Selection & Context Menu Lockout**: Prevents accidental mouse drag text selection and suppresses right-click menus.
- **Escape Key & Fullscreen Lock**: Prevents pressing or holding the Escape key from breaking out of fullscreen mode.
- **Sticky Status Banner**: The red shield banner stays pinned at the top of the viewport with the **"Unlock with PIN"** button always in view.
- **Passcode Modal with 1-Minute Idle Auto-Close**:
  - Centered popup with an on-screen touch keypad and focused PIN input box.
  - Displays the unlock PIN directly on the modal (**"Your Unlock PIN: 1234"**) to ensure you can never be accidentally locked out while keeping pets from modifying settings.
  - Automatically closes and resets after 60 seconds of inactivity.

### 6. ☀️ 25-Hour Display Wake Lock (Never Sleeps)
- **Native OS Power Save Blocker**: Utilizes Electron's `powerSaveBlocker.start('prevent-display-sleep')` to prevent the operating system from dimming the screen, turning off the monitor, or launching screensavers.
- **W3C Screen Wake Lock API**: Browser fallback with live glowing status chip in the top navigation bar.

---

## 🏗️ Project Architecture

```
yom_kiper_timer/
├── main.js                  # Electron main process (Fullscreen, PowerBlocker, Escape interception)
├── server.js                # Express backend (LibreLinkUp proxy, Zmanim engine, Demo state)
├── package.json             # Scripts, dependencies, and electron-builder configs
├── public/                  # Frontend web application
│   ├── index.html           # Semantic HTML5 layout and modal dialogs
│   ├── styles.css           # Glassmorphic dark UI, animations, responsive design
│   ├── app.js               # Main UI controller, event delegation, lock shield
│   ├── timer-engine.js      # Dual-track high-precision interval clock
│   ├── audio-engine.js      # Web Audio harmonic chime synthesizers
│   ├── libre-service.js     # LibreLinkUp client & polling manager
│   ├── chart-renderer.js    # Canvas/SVG 12-hour glucose trend chart
│   └── icon.svg             # Application vector icon
├── tests/
│   ├── test-app.js          # Unit tests (Timer math, PIN logic, Zmanim, Endpoints)
│   └── test-e2e.js          # Playwright end-to-end automated testing suite
└── scripts/
    └── generate-icons.js    # Multi-resolution icon generator for packaging
```

---

## 🚀 Quick Start & Installation

### Prerequisites
- [Node.js](https://nodejs.org/) (version 18 or higher recommended)
- `npm` (included with Node.js)

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/binyaminyblatt/yom-kippur-diabetes-timer.git
cd yom-kippur-diabetes-timer
npm install
```

### 2. Run the Application

#### Option A: Run Full Electron Desktop App (Recommended)
```bash
npm run dev
```
*Starts the local backend server on port 3000 and launches the Electron desktop application in full-screen mode.*

#### Option B: Run Web Server Only (For Browser Access)
```bash
npm start
```
*Open your browser and navigate to `http://localhost:3000`.*

---

## 🧪 Testing

### Automated Unit Tests
Validates interval calculations, dual-track triggers, PIN validation, and API endpoints:
```bash
npm test
```

### Playwright End-to-End (E2E) Browser Tests
Tests starting the timer, engaging the lock shield, cat-proof keyboard suppression, visible PIN input field, 60-second idle auto-close, and passcode unlocking:
```bash
npm run test:e2e
```

---

## 📦 Building Standalone Binaries (Packaged Apps)

You can package the application into standalone distributables for macOS, Windows, or Linux using `electron-builder`:

```bash
# Build for Linux (AppImage & deb)
npm run build:linux

# Build for Windows (.exe installer & portable)
npm run build:win

# Build for macOS (Universal DMG / zip)
npm run build:mac
```

Built executables and installers will be saved to the `dist/` directory.

---

## 📋 Erev Yom Kippur Setup Checklist

Before Yom Kippur begins:
1. **Launch the App**: Open the application and press the **Fullscreen** button (or start via Electron).
2. **Configure Intervals**: Click **Settings** (⚙️) and set your rabbinically/medically prescribed eating interval ($T$) and verify your Fast End time against your local synagogue calendar.
3. **Connect CGM**: If wearing a FreeStyle Libre sensor, toggle **Enable LibreLinkUp**, uncheck Demo Mode, and enter your LibreLinkUp account credentials.
4. **Test Audio**: Click **Test Track A**, **Test Track B**, and **Test Glucose Alert** to confirm volume and sound profile.
5. **Start Timer**: Click **Start Timer**.
6. **Engage Lock Shield**: Click the **Lock Shield** button (🛡️) in the top header. The red shield banner will appear, protecting your screen and timer from accidental touch or pets throughout the fast.

---

## 🌐 Internationalization & Adding Languages

The application features full multi-language support (i18n) across both the UI and backend error diagnostics.
- To add a new language (e.g. French, Spanish, Yiddish, Russian):
  1. Copy [`public/locales/template.json`](public/locales/template.json) to `public/locales/<lang_code>.json`.
  2. Translate the string values and set the `_meta` field.
  3. **Done!** The system automatically discovers the new language and auto-populates all language selector dropdowns without modifying any code.
- For complete step-by-step instructions, see the [**Translation Guide (TRANSLATION_GUIDE.md)**](TRANSLATION_GUIDE.md).

---

## 📜 License

This project is open-source software licensed under the [MIT License](LICENSE).

### 🤝 Non-Binding Community Request
If you or your organization are using this software for commercial purposes, it is respectfully requested (though strictly voluntary and non-binding) that you consider making a donation of $50 USD to an Orthodox Jewish charity (*Tzedakah*) of your choice.

May everyone observing the fast have an easy and meaningful Yom Kippur, and may all those requiring medical sustenance be blessed with complete health and *Refuah Sheleima*.
