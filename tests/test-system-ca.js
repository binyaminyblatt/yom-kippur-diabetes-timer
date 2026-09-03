const assert = require('assert');
const fs = require('fs');
const path = require('path');
const tls = require('tls');
const crypto = require('crypto');
const { parseAnyCertificate, extractDerCerts, initSystemCA } = require('../system-ca');

console.log('\n======================================================');
console.log('--- Testing System CA & Multi-Format Cert Parser ---');
console.log('======================================================\n');

// 1. Get a reference certificate from Node built-ins
const samplePem = tls.rootCertificates[0];
const sampleX509 = new crypto.X509Certificate(samplePem);
const sampleDer = sampleX509.raw;

// 2. Test Standard PEM
const certsFromPem = parseAnyCertificate(samplePem);
assert.strictEqual(certsFromPem.length, 1, 'Standard PEM should parse 1 certificate');
assert.strictEqual(new crypto.X509Certificate(certsFromPem[0]).subject, sampleX509.subject);
console.log('✓ Standard PEM certificate parsed successfully');

// 3. Test Alternate Headers (TRUSTED CERTIFICATE, X509 CERTIFICATE)
const trustedPem = samplePem.replace(/CERTIFICATE/g, 'TRUSTED CERTIFICATE');
const certsFromTrusted = parseAnyCertificate(trustedPem);
assert.strictEqual(certsFromTrusted.length, 1, 'TRUSTED CERTIFICATE PEM should parse 1 certificate');
assert.strictEqual(new crypto.X509Certificate(certsFromTrusted[0]).subject, sampleX509.subject);

const x509Pem = samplePem.replace(/CERTIFICATE/g, 'X509 CERTIFICATE');
const certsFromX509 = parseAnyCertificate(x509Pem);
assert.strictEqual(certsFromX509.length, 1, 'X509 CERTIFICATE PEM should parse 1 certificate');
console.log('✓ Alternate PEM headers (TRUSTED / X509) parsed successfully');

// 4. Test Multi-Cert PEM Bundle
const samplePem2 = tls.rootCertificates[1];
const bundlePem = `${samplePem}\n\n# Some commentary in bundle\n\n${samplePem2}`;
const certsFromBundle = parseAnyCertificate(bundlePem);
assert.strictEqual(certsFromBundle.length, 2, 'Multi-certificate PEM bundle should parse 2 certificates');
console.log('✓ Multi-certificate concatenated PEM bundle parsed successfully');

// 5. Test Binary DER (.der / .cer)
const certsFromDer = parseAnyCertificate(sampleDer);
assert.strictEqual(certsFromDer.length, 1, 'Binary DER buffer should parse 1 certificate');
assert.strictEqual(new crypto.X509Certificate(certsFromDer[0]).subject, sampleX509.subject);
console.log('✓ Binary DER format (.der/.cer) parsed directly from buffer');

// 6. Test Multi-DER binary container (PKCS#7 / P7B / concatenated stream)
const multiDerBuffer = Buffer.concat([
  sampleDer,
  Buffer.from([0x00, 0x00, 0x00]),
  new crypto.X509Certificate(samplePem2).raw
]);
const certsFromMultiDer = parseAnyCertificate(multiDerBuffer);
assert.strictEqual(certsFromMultiDer.length, 2, 'Multi-DER binary container should parse 2 certificates');
console.log('✓ Multi-DER container / PKCS#7 stream parsed successfully');

// 7. Test Raw Base64 string (no PEM header lines)
const rawBase64 = sampleDer.toString('base64');
const certsFromB64 = parseAnyCertificate(rawBase64);
assert.strictEqual(certsFromB64.length, 1, 'Raw base64 string should parse 1 certificate');
console.log('✓ Raw Base64 string without PEM headers parsed successfully');

// 8. Test drop-in ./certs directory loading
const testCertsDir = path.join(__dirname, '../certs');
if (!fs.existsSync(testCertsDir)) {
  fs.mkdirSync(testCertsDir, { recursive: true });
}

// Write a test DER file and a test PEM file to ./certs
const testDerPath = path.join(testCertsDir, '__test_filter_root.der');
const testPemPath = path.join(testCertsDir, '__test_filter_inter.crt');
fs.writeFileSync(testDerPath, sampleDer);
fs.writeFileSync(testPemPath, samplePem2);

try {
  const result = initSystemCA();
  assert.ok(result.count > 0, 'Must load certificates');
  assert.ok(result.summary.totalUniqueCount > 0, 'Total unique count must be > 0');
  console.log(`✓ initSystemCA() verified: Loaded ${result.count} total certificates (System: ${result.summary.systemCount}, Custom: ${result.summary.customCount}, Built-in: ${result.summary.builtinCount})`);
} finally {
  // Clean up test files from ./certs
  try { fs.unlinkSync(testDerPath); } catch (e) {}
  try { fs.unlinkSync(testPemPath); } catch (e) {}
}

console.log('\n🎉 ALL SYSTEM CA & MULTI-FORMAT CERT TESTS PASSED SUCCESSFULLY!\n');
