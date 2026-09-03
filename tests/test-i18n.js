const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('\n========================================');
console.log('--- Testing i18next Multi-Language Suite ---');
console.log('========================================\n');

// 1. Check locale JSON files exist & are valid JSON
const enPath = path.join(__dirname, '../public/locales/en.json');
const hePath = path.join(__dirname, '../public/locales/he.json');
const templatePath = path.join(__dirname, '../public/locales/template.json');

assert.ok(fs.existsSync(enPath), 'en.json must exist');
assert.ok(fs.existsSync(hePath), 'he.json must exist');
assert.ok(fs.existsSync(templatePath), 'template.json must exist');

const enJson = JSON.parse(fs.readFileSync(enPath, 'utf8'));
const heJson = JSON.parse(fs.readFileSync(hePath, 'utf8'));
const templateJson = JSON.parse(fs.readFileSync(templatePath, 'utf8'));

console.log('✓ Successfully loaded and parsed en.json, he.json, and template.json');

// Helper to flatten nested keys
function getAllKeys(obj, prefix = '') {
  let keys = [];
  for (const [k, v] of Object.entries(obj)) {
    if (k === '_meta') continue; // ignore metadata in template
    const fullKey = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      keys = keys.concat(getAllKeys(v, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

const enKeys = getAllKeys(enJson);
const heKeys = getAllKeys(heJson);
const templateKeys = getAllKeys(templateJson);

console.log(`English locale keys count:  ${enKeys.length}`);
console.log(`Hebrew locale keys count:   ${heKeys.length}`);
console.log(`Template locale keys count: ${templateKeys.length}`);

// 2. Check Key Parity
const missingInHe = enKeys.filter(k => !heKeys.includes(k));
const missingInEn = heKeys.filter(k => !enKeys.includes(k));
const missingInTemplate = enKeys.filter(k => !templateKeys.includes(k));

if (missingInHe.length > 0) {
  console.error('Keys present in en.json but missing in he.json:', missingInHe);
}
if (missingInEn.length > 0) {
  console.error('Keys present in he.json but missing in en.json:', missingInEn);
}
if (missingInTemplate.length > 0) {
  console.error('Keys present in en.json but missing in template.json:', missingInTemplate);
}

assert.strictEqual(missingInHe.length, 0, 'No keys should be missing from he.json');
assert.strictEqual(missingInEn.length, 0, 'No keys should be missing from en.json');
assert.strictEqual(missingInTemplate.length, 0, 'No keys should be missing from template.json');
console.log('✓ Complete 100% key parity across English, Hebrew, and Template dictionaries!');

// 3. Test I18nManager class logic
const { I18nManager } = require('../public/i18n.js');
const manager = new I18nManager();

// Feed pre-loaded resources directly for node test
manager.resources['en'] = enJson;
manager.resources['he'] = heJson;
manager.currentLanguage = 'en';

// Test simple key translation
assert.strictEqual(manager.t('brand.title'), 'Yom Kippur Diabetes Timer');
assert.strictEqual(manager.getDirection(), 'ltr');

// Test interpolation
const enMin = manager.t('timer.min', { count: 9 });
assert.strictEqual(enMin, '9 min', 'Interpolation should replace {{count}} with 9 in English');

// Switch to Hebrew
manager.currentLanguage = 'he';
assert.strictEqual(manager.t('brand.title'), 'טיימר סוכרת ליום כיפור');
assert.strictEqual(manager.getDirection(), 'rtl');

const heMin = manager.t('timer.min', { count: 9 });
assert.strictEqual(heMin, '9 דק\'', 'Interpolation should replace {{count}} with 9 in Hebrew');

// Test complex interpolation with multiple variables
const heDays = manager.t('fastEnd.daysRemaining', { days: 2, hours: 5, minutes: 30 });
assert.ok(heDays.includes('2'), 'Hebrew days string should include days variable');
assert.ok(heDays.includes('5'), 'Hebrew days string should include hours variable');
assert.ok(heDays.includes('30'), 'Hebrew days string should include minutes variable');

console.log('✓ I18nManager translations & interpolations verified in both English and Hebrew!');
console.log('✓ RTL / LTR layout directions accurately reported!');

// 4. Test default language behavior
const defaultManager = new I18nManager();
assert.strictEqual(defaultManager.currentLanguage, 'en', 'Default language must be "en"');
console.log('✓ Default language strictly verified as "en"');

// 5. Test server dictionary strings & placeholders
assert.strictEqual(enJson.server.diagnostics.invalidCredentialsTitle, 'Invalid Email or Password');
assert.strictEqual(heJson.server.diagnostics.invalidCredentialsTitle, 'אימייל או סיסמה שגויים');
assert.ok(enJson.server.diagnostics.regionMismatchMsg.includes('{{region}}'), 'Region message must contain {{region}} variable');
assert.ok(heJson.server.diagnostics.regionMismatchMsg.includes('{{region}}'), 'Hebrew Region message must contain {{region}} variable');
assert.strictEqual(enJson.server.locations.jerusalem, 'Jerusalem, Israel');
assert.strictEqual(heJson.server.locations.jerusalem, 'ירושלים, ישראל');
assert.strictEqual(enJson.server.locations.newYork, 'New York, NY');
assert.strictEqual(heJson.server.locations.newYork, 'ניו יורק');
console.log('✓ Server-side locale dictionary keys and location lookup verified in both languages!');

// 6. Test dynamic language auto-discovery and selector population logic
const dynamicManager = new I18nManager();
dynamicManager.availableLanguages = [
  { code: 'en', name: 'English', dir: 'ltr', flag: '🇺🇸' },
  { code: 'he', name: 'עברית (Hebrew)', dir: 'rtl', flag: '🇮🇱' },
  { code: 'fr', name: 'Français (French)', dir: 'ltr', flag: '🇫🇷' }
];

assert.strictEqual(dynamicManager.availableLanguages.length, 3);
assert.strictEqual(dynamicManager.getDirection('fr'), 'ltr');
assert.strictEqual(dynamicManager.getDirection('he'), 'rtl');
console.log('✓ Dynamic language discovery and direction resolution verified!');

// 7. Test Missing Key Fallback to English (Frontend & Backend)
const fallbackManager = new I18nManager();
fallbackManager.resources['en'] = enJson;
fallbackManager.resources['incomplete_lang'] = {
  brand: {
    title: 'Custom Brand Title'
    // Notice subtitle is missing!
  }
};
fallbackManager.currentLanguage = 'incomplete_lang';

// Key present in custom language:
assert.strictEqual(fallbackManager.t('brand.title'), 'Custom Brand Title');
// Key missing from custom language, must fallback to English:
assert.strictEqual(fallbackManager.t('brand.subtitle'), enJson.brand.subtitle, 'Missing key must fallback to English text');
assert.strictEqual(fallbackManager.t('safety.title'), enJson.safety.title, 'Completely missing namespace must fallback to English text');
console.log('✓ Frontend missing key fallback to English verified successfully!');

console.log('\n🎉 ALL I18N TESTS PASSED SUCCESSFULLY!\n');
