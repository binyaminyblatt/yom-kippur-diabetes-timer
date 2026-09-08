# 🌐 Multi-Language (i18n) Translation Guide

This guide explains how the internationalization (i18n) and dynamic Text-to-Speech (TTS) systems work in **Yom Kippur Diabetes Timer** and provides step-by-step instructions for translating the application into additional languages (e.g., French, Spanish, Yiddish, Russian, German, etc.).

---

## 📁 Architecture Overview

The application utilizes a unified, 100% JSON-driven translation engine across both frontend and backend:

```
public/locales/
├── en.json          # English reference dictionary (Default language, LTR)
├── he.json          # Hebrew dictionary (RTL)
└── template.json    # Clean template with all strings and _meta schema for translators
```

- **Frontend (`public/i18n.js`)**: Loads the active dictionary and translates HTML elements using `data-i18n`, `data-i18n-title`, `data-i18n-placeholder`, and dynamically via `window.i18n.t(key, options)`.
- **Backend (`server.js`)**: Loads the active dictionary dynamically from `public/locales/` for API diagnostics, validation, test connection logs, Zmanim location names, and neural TTS voice resolution.
- **Audio Engine (`public/audio-engine.js`)**: Resolves regional TTS dialects and Azure Neural voices dynamically using the `_meta` configuration of each language file.
- **Offline Audio Assets (`public/audio/alerts/`)**: Pre-rendered compact 24kHz mono MP3 files for instant offline/kosher playback.

---

## 🚀 How to Add a New Language (Step-by-Step)

### Step 1: Create your language JSON file
Copy [`public/locales/template.json`](public/locales/template.json) to a new file named with your ISO 639-1 language code (e.g., `fr.json` for French, `es.json` for Spanish, `yi.json` for Yiddish, `de.json` for German):

```bash
cp public/locales/template.json public/locales/fr.json
```

---

### Step 2: Configure Language & Regional Voice Metadata (`_meta`)

At the top of your `public/locales/<lang>.json` file, fill in the `_meta` section:

```json
{
  "_meta": {
    "languageCode": "fr",
    "languageName": "Français (French)",
    "direction": "ltr",
    "flag": "🇫🇷",
    "defaultRegion": "fr-FR",
    "neuralVoice": "fr-FR-DeniseNeural",
    "regions": [
      "fr-FR",
      "fr-CA",
      "fr-BE",
      "fr-CH"
    ]
  },
  "brand": {
    ...
  }
}
```

#### Field Descriptions:
- **`languageCode`**: ISO 639-1 two-letter code (e.g. `fr`, `es`, `he`, `de`, `yi`).
- **`languageName`**: Native display name shown in language dropdowns.
- **`direction`**: `"ltr"` (Left-to-Right) or `"rtl"` (Right-to-Left for Hebrew, Yiddish, Arabic, Farsi).
- **`flag`**: Flag emoji displayed next to the language name.
- **`defaultRegion`**: Primary BCP-47 regional code (e.g., `fr-FR`, `es-ES`, `de-DE`).
- **`neuralVoice`**: Microsoft Azure Neural TTS voice identifier used for studio-quality voice announcements (e.g. `fr-FR-DeniseNeural`, `es-ES-ElviraNeural`, `de-DE-KatjaNeural`, `he-IL-AvriNeural`, `ru-RU-SvetlanaNeural`).
- **`regions`**: Ordered array of supported regional BCP-47 dialects (e.g. `["es-ES", "es-MX", "es-US", "es-AR"]`). The Audio Engine prioritizes these regions when querying local and system voices.

---

### Step 3: Translate All String Values

Open `public/locales/<lang>.json` and replace the English text with your translations.

> [!IMPORTANT]
> **Keep all variable placeholders unchanged!**
> Do not translate or modify tokens inside curly braces:
> - `{{count}}` (e.g. `~{{count}} intervals left`)
> - `{{time}}` (e.g. `Starts {{date}} at {{time}}`)
> - `{{date}}`
> - `{{days}}`, `{{hours}}`, `{{minutes}}`
> - `{{val}}` (e.g. `Current Glucose: {{val}} mg/dL`)
> - `{{region}}` (e.g. `Connecting to {{region}} endpoint`)
> - `{{error}}`, `{{status}}`, `{{name}}`, `{{id}}`, `{{glucose}}`, `{{arrow}}`

---

### Step 4: Translate Voice Safety Alerts (`alerts.speech`)

Make sure to translate the 4 glucose safety speech announcements under `alerts.speech`:

```json
  "alerts": {
    "speech": {
      "lowGlucose": "Alerte d'hypoglycémie. Consommez des glucides rapides selon les directives médicales.",
      "highGlucose": "Alerte d'hyperglycémie.",
      "urgentLowGlucose": "Hypoglycémie critique. La préservation de la vie prévaut sur le jeûne.",
      "testVoiceAlert": "Test d'alerte vocale de glycémie : Alerte d'hypoglycémie"
    }
  }
```

---

### Step 5: Pre-generate Compact Offline Audio Assets

Run the audio generator to automatically create pre-rendered fallback MP3 assets in `public/audio/alerts/` (<0.15 MB per language):

```bash
npm run generate:audio
```

This dynamically reads your new JSON file's `_meta.neuralVoice` and `alerts.speech` keys, creating offline-ready audio files for users without internet or on filtered connections.

---

### Step 6: Validate Key Parity

Run the automated test script to verify that your new language file contains 100% key parity without any missing translations:

```bash
node tests/test-i18n.js
```

---

### Step 7: Automatic Discovery & Launch!

The application **automatically discovers** your new JSON file via `/api/languages` and **auto-populates all language selector dropdowns** in both the top navigation header and the Settings modal. **Zero code changes to JavaScript or HTML are required!**

---

## 📋 Translation Namespace Reference

| Namespace | Description | Examples |
|---|---|---|
| `_meta` | Language metadata, layout direction, default BCP-47 region, neural voice, and supported dialects | `_meta.languageCode`, `_meta.neuralVoice`, `_meta.regions` |
| `brand` | Application title & halachic subtitle | `brand.title`, `brand.subtitle` |
| `header` | Navigation bar labels, tooltips & status chips | `header.fastEndsIn`, `header.lockShield` |
| `safety` | Pikuach Nefesh emergency banner | `safety.title`, `safety.text` |
| `lockShield` | Cat & Touch PIN lock screen & keypad dialog | `lockShield.bannerTitle`, `lockShield.yourUnlockPin` |
| `fastEnd` | Motzei Yom Kippur countdown & Zmanim card | `fastEnd.title`, `fastEnd.daysRemaining` |
| `timer` | Dual-track interval clock, presets, controls | `timer.heading`, `timer.trackA`, `timer.min` |
| `halacha` | Halachic advice cards (Shiurim, Melo Logmav) | `halacha.card1Title`, `halacha.card1Text` |
| `cgm` | CGM display card, badges, and 12h trend chart | `cgm.title`, `cgm.badgeLive`, `cgm.chartLabels` |
| `checklistModal` | Erev Yom Kippur 6-step interactive checklist | `checklistModal.step1Title`, `checklistModal.step1Text` |
| `settings` | Settings modal categories & options | `settings.halacha`, `settings.audio`, `settings.cgm` |
| `exitModal` | Exit confirmation dialog | `exitModal.title`, `exitModal.warningText` |
| `messages` | Transient toast notifications | `messages.settingsSaved`, `messages.cgmConnected` |
| `alerts.speech` | Spoken voice alert announcements for low/high glucose and urgent safety alarms | `alerts.speech.lowGlucose`, `alerts.speech.urgentLowGlucose` |
| `server.diagnostics` | Backend LibreLinkUp diagnosis titles & suggestions | `server.diagnostics.invalidCredentialsTitle` |
| `server.validation` | Backend input validation errors | `server.validation.emailPasswordRequired` |
| `server.logs` | Step-by-step diagnostic connection logs | `server.logs.testInit`, `server.logs.step1Auth` |
| `server.sensor` | Warmup warnings and patient labels | `server.sensor.warmingUp`, `server.sensor.patientSelf` |
| `server.app` | Backend shutdown notice | `server.app.shuttingDown` |
| `server.locations` | City display names for automatic Zmanim lookup | `server.locations.jerusalem`, `server.locations.paris` |

---

## 💡 Best Practices for Translators

1. **RTL Languages**: If translating into Yiddish, Hebrew, Arabic, Farsi, etc., set `"direction": "rtl"` in `_meta`. The entire UI layout and circular SVG interval progress rings automatically flip directions cleanly.
2. **Numbers & Timers**: Timers, clocks, and PIN codes remain in LTR orientation for universal readability.
3. **Halachic Terminology**: Retain traditional rabbinic terms where customary (*Shiurim*, *Pikuach Nefesh*, *Achila l'Shiurim*, *Kotevet HaGasa*, *Melo Logmav*, *K'dei Achilat Pras*, *Motzei Yom Kippur*), or provide clear localized explanations alongside them.
4. **HTML in Translations**: Some strings support inline formatting like `<strong>...</strong>` or `<br>`. Preserve these tags to maintain visual emphasis.
