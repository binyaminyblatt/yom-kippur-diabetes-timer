/**
 * Yom Kippur Diabetes Timer - i18n Localization Engine
 * Powered by i18next with auto-language discovery and RTL support
 */

class I18nManager {
  constructor() {
    this.currentLanguage = 'en';
    this.initialized = false;
    this.availableLanguages = [
    ];
    this.resources = {};
    this.listeners = [];
  }

  /**
   * Discover available language locale files dynamically from backend API
   */
  async discoverLanguages() {
    try {
      const response = await fetch('/api/languages');
      if (response.ok) {
        const data = await response.json();
        if (data.success && Array.isArray(data.languages) && data.languages.length > 0) {
          this.availableLanguages = data.languages;
        }
      }
    } catch (err) {
      console.warn('[i18n] Language discovery note (using defaults):', err.message);
    }
    return this.availableLanguages;
  }

  /**
   * Load JSON dictionary file via fetch or cached object
   */
  async loadLocale(lang) {
    if (this.resources[lang]) {
      return this.resources[lang];
    }
    try {
      const response = await fetch(`locales/${lang}.json?v=2`);
      if (!response.ok) {
        throw new Error(`Failed to load locale: ${lang} (${response.status})`);
      }
      const data = await response.json();
      this.resources[lang] = data;
      return data;
    } catch (err) {
      console.warn(`[i18n] Could not fetch locales/${lang}.json:`, err.message);
      return null;
    }
  }

  /**
   * Auto-populate all language dropdowns (<select class="language-select">) across the DOM
   */
  populateLanguageSelectors(root = null) {
    if (typeof document === 'undefined') return;
    const container = root || document;
    const selects = container.querySelectorAll('.language-select, #selectLanguageHeader, #selectModalLanguage');

    selects.forEach(select => {
      select.innerHTML = '';
      this.availableLanguages.forEach(lang => {
        const opt = document.createElement('option');
        opt.value = lang.code;
        opt.textContent = `${lang.flag ? lang.flag + ' ' : ''}${lang.name}`;
        if (lang.code === this.currentLanguage) {
          opt.selected = true;
        }
        select.appendChild(opt);
      });
      select.value = this.currentLanguage;
    });
  }

  /**
   * Initialize i18n engine, discover languages, and setup DOM
   */
  async init(initialLang = null) {
    // 1. Discover all added languages dynamically from the server
    await this.discoverLanguages();

    // 2. Determine active language (saved in localStorage > default 'en')
    let savedLang = initialLang;
    if (!savedLang && typeof localStorage !== 'undefined') {
      savedLang = localStorage.getItem('ykt_language');
    }

    // Check if saved language is among available languages, else fallback to 'en'
    const isLangAvailable = this.availableLanguages.some(l => l.code === savedLang);
    this.currentLanguage = isLangAvailable ? savedLang : 'en';

    // 3. Always ensure English fallback baseline is loaded
    await this.loadLocale('en');

    // 4. Pre-fetch all available language dictionaries in parallel
    await Promise.all(this.availableLanguages.map(l => this.loadLocale(l.code)));

    // 5. Build resources for i18next (ensuring 'en' fallback is always present)
    const resources = {};
    for (const lang of this.availableLanguages) {
      const data = this.resources[lang.code];
      if (data) {
        resources[lang.code] = { translation: data };
      }
    }
    if (this.resources['en'] && !resources.en) {
      resources.en = { translation: this.resources['en'] };
    }

    // 5. Initialize i18next instance if available
    if (typeof i18next !== 'undefined') {
      await i18next.init({
        lng: this.currentLanguage,
        fallbackLng: 'en',
        debug: false,
        resources: resources,
        interpolation: {
          escapeValue: false
        }
      });
    }

    this.initialized = true;

    // 6. Auto-populate all Language Selectors in header & settings modal
    this.populateLanguageSelectors();

    // 7. Update Document direction and DOM translations
    this.applyLanguageToDocument(this.currentLanguage);
    this.updateDOM();

    return this.currentLanguage;
  }

  /**
   * Change current language to any supported language code
   */
  async changeLanguage(lang) {
    const isAvailable = this.availableLanguages.some(l => l.code === lang);
    if (!isAvailable) {
      lang = 'en';
    }

    // Ensure locale dictionary is loaded
    if (!this.resources[lang]) {
      const data = await this.loadLocale(lang);
      if (data && typeof i18next !== 'undefined' && i18next.addResourceBundle) {
        i18next.addResourceBundle(lang, 'translation', data, true, true);
      }
    }

    this.currentLanguage = lang;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('ykt_language', lang);
    }

    if (typeof i18next !== 'undefined' && i18next.changeLanguage) {
      await i18next.changeLanguage(lang);
    }

    // Synchronize all select elements
    if (typeof document !== 'undefined') {
      document.querySelectorAll('.language-select, #selectLanguageHeader, #selectModalLanguage').forEach(sel => {
        sel.value = lang;
      });
    }

    this.applyLanguageToDocument(lang);
    this.updateDOM();

    // Trigger languageChanged event
    const eventDetail = {
      lang: this.currentLanguage,
      dir: this.getDirection(this.currentLanguage)
    };

    if (typeof document !== 'undefined') {
      document.dispatchEvent(new CustomEvent('languageChanged', { detail: eventDetail }));
    }

    this.listeners.forEach(fn => {
      try { fn(eventDetail); } catch (e) { console.error(e); }
    });

    return this.currentLanguage;
  }

  /**
   * Register a callback listener for language change
   */
  onLanguageChanged(callback) {
    if (typeof callback === 'function') {
      this.listeners.push(callback);
    }
  }

  /**
   * Get layout direction ('rtl' for Hebrew/Arabic/Yiddish, 'ltr' otherwise)
   */
  getDirection(lang = this.currentLanguage) {
    const langObj = this.availableLanguages.find(l => l.code === lang);
    if (langObj && langObj.dir) {
      return langObj.dir;
    }
    return (lang === 'he' || lang === 'iw' || lang === 'yi' || lang === 'ar') ? 'rtl' : 'ltr';
  }

  /**
   * Set lang and dir attributes on <html> element
   */
  applyLanguageToDocument(lang) {
    if (typeof document === 'undefined') return;
    const dir = this.getDirection(lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
    if (document.body) {
      document.body.setAttribute('data-lang', lang);
      document.body.setAttribute('data-dir', dir);
    }
  }

  /**
   * Get current language code
   */
  getCurrentLanguage() {
    return this.currentLanguage;
  }

  /**
   * Helper to safely extract a nested key from a dictionary object
   */
  _lookupKey(dict, key) {
    if (!dict || typeof dict !== 'object') return null;
    const keys = key.split('.');
    let val = dict;
    for (const k of keys) {
      if (val && typeof val === 'object' && k in val) {
        val = val[k];
      } else {
        return null;
      }
    }
    return (val !== undefined && val !== null) ? val : null;
  }

  /**
   * Translate a key with optional interpolation params
   * If the key is missing from the active language, it falls back to the English dictionary.
   * e.g. i18n.t('timer.min', { count: 9 })
   */
  t(key, options = {}) {
    if (typeof i18next !== 'undefined' && i18next.t) {
      const translation = i18next.t(key, options);
      if (translation && translation !== key) {
        return translation;
      }
    }

    // 1. Look up in the active language dictionary
    const targetDict = this.resources[this.currentLanguage];
    let val = this._lookupKey(targetDict, key);

    // 2. Fallback to English dictionary if missing in active language
    if (val === null || val === undefined) {
      const enDict = this.resources['en'];
      val = this._lookupKey(enDict, key);
    }

    if (typeof val === 'string') {
      return val.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, p1) => {
        return options[p1] !== undefined ? options[p1] : `{{${p1}}}`;
      });
    }

    return (val !== null && val !== undefined) ? val : key;
  }

  /**
   * Translate all DOM elements containing data-i18n attributes
   */
  updateDOM(container = null) {
    if (typeof document === 'undefined') return;
    const root = container || document;

    // 1. Text Content: [data-i18n]
    root.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (key) {
        el.textContent = this.t(key);
      }
    });

    // 2. HTML Content: [data-i18n-html]
    root.querySelectorAll('[data-i18n-html]').forEach(el => {
      const key = el.getAttribute('data-i18n-html');
      if (key) {
        el.innerHTML = this.t(key);
      }
    });

    // 3. Title attribute: [data-i18n-title]
    root.querySelectorAll('[data-i18n-title]').forEach(el => {
      const key = el.getAttribute('data-i18n-title');
      if (key) {
        el.setAttribute('title', this.t(key));
      }
    });

    // 4. Placeholder attribute: [data-i18n-placeholder]
    root.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (key) {
        el.setAttribute('placeholder', this.t(key));
      }
    });

    // 5. Aria-label attribute: [data-i18n-aria]
    root.querySelectorAll('[data-i18n-aria]').forEach(el => {
      const key = el.getAttribute('data-i18n-aria');
      if (key) {
        el.setAttribute('aria-label', this.t(key));
      }
    });

    // 6. Preset minute buttons
    root.querySelectorAll('.btn-preset[data-seconds]').forEach(el => {
      const secs = parseInt(el.getAttribute('data-seconds'), 10);
      if (secs && secs >= 60 && !el.hasAttribute('data-i18n')) {
        const mins = Math.round(secs / 60);
        el.textContent = this.t('timer.min', { count: mins });
      }
    });

    // 7. Update Language Selectors if present
    const langSelects = root.querySelectorAll('.language-select, #selectLanguageHeader, #selectModalLanguage');
    langSelects.forEach(select => {
      select.value = this.currentLanguage;
    });
  }
}

// Global instance
const i18n = new I18nManager();

if (typeof window !== 'undefined') {
  window.i18n = i18n;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { I18nManager, i18n };
}
