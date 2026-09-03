# 🌐 Multi-Language (i18n) Translation Guide

This guide explains how the internationalization (i18n) system works in **Yom Kippur Diabetes Timer** and provides step-by-step instructions for translating the application into additional languages (e.g., French, Spanish, Yiddish, Russian, German, etc.).

---

## 📁 Architecture Overview

The application utilizes a unified, JSON-driven translation engine across both frontend and backend:

```
public/locales/
├── en.json          # English reference dictionary (Default language, LTR)
├── he.json          # Hebrew dictionary (RTL)
└── template.json    # Clean template with all strings for translators
```

- **Frontend (`public/i18n.js`)**: Loads the active dictionary and translates HTML elements using `data-i18n`, `data-i18n-title`, `data-i18n-placeholder`, and dynamically via `window.i18n.t(key, options)`.
- **Backend (`server.js`)**: Loads the active dictionary dynamically from `public/locales/` via `getServerText(key, lang, options)` for API diagnostics, validation, test connection logs, and Zmanim location names.

---

## 🚀 How to Add a New Language (Step-by-Step)

### Step 1: Create your language JSON file
Copy [`public/locales/template.json`](public/locales/template.json) to a new file named with your ISO 639-1 language code (e.g., `fr.json` for French, `es.json` for Spanish, `yi.json` for Yiddish):

```bash
cp public/locales/template.json public/locales/fr.json
```

### Step 2: Translate all string values
Open `public/locales/fr.json` and replace the English text with your translations.

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

### Step 3: Configure metadata (`_meta`) in your JSON file
At the top of your `public/locales/<lang>.json` file, fill in the `_meta` section with your language's display name, direction (`ltr` or `rtl`), and country/language flag emoji:

```json
{
  "_meta": {
    "languageCode": "fr",
    "languageName": "Français (French)",
    "direction": "ltr",
    "flag": "🇫🇷"
  },
  "brand": {
    ...
  }
}
```

### Step 4: That's it! (Automatic Discovery & Auto-Population)
The application **automatically discovers** your new JSON file via `/api/languages` and **auto-populates all language selector dropdowns** in both the top navigation header and the Settings modal. **Zero code changes to JavaScript or HTML are needed!**

### Step 5: Validate Key Parity & Test
Run the automated test script to verify that your new language file contains all required keys without any missing translations:

```bash
node tests/test-i18n.js
```

---

## 📋 Translation Namespace Reference

| Namespace | Description | Examples |
|---|---|---|
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
| `server.diagnostics` | Backend LibreLinkUp diagnosis titles & suggestions | `server.diagnostics.invalidCredentialsTitle` |
| `server.validation` | Backend input validation errors | `server.validation.emailPasswordRequired` |
| `server.logs` | Step-by-step diagnostic connection logs | `server.logs.testInit`, `server.logs.step1Auth` |
| `server.sensor` | Warmup warnings and patient labels | `server.sensor.warmingUp`, `server.sensor.patientSelf` |
| `server.app` | Backend shutdown notice | `server.app.shuttingDown` |
| `server.locations` | City display names for automatic Zmanim lookup | `server.locations.jerusalem`, `server.locations.paris` |

---

## 💡 Best Practices for Translators

1. **RTL Languages**: If translating into Arabic, Yiddish, Farsi, etc., set `"direction": "rtl"` in `public/i18n.js`. The layout and progress rings automatically flip directions cleanly.
2. **Numbers & Timers**: Timers, clocks, and PIN codes remain in LTR orientation for universal clarity.
3. **Halachic Terminology**: Retain traditional rabbinic terms where customary (*Shiurim*, *Pikuach Nefesh*, *Achila l'Shiurim*, *Kotevet HaGasa*, *Melo Logmav*, *K'dei Achilat Pras*, *Motzei Yom Kippur*), or provide clear localized explanations alongside them.
4. **HTML in Translations**: Some strings support inline formatting like `<strong>...</strong>` or `<br>`. Preserve these tags to maintain emphasis.
