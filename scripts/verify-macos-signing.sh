#!/usr/bin/env bash
set -e

echo "===================================================="
echo " macOS Code Signing Pre-flight Certificate Test"
echo "===================================================="

if [ -z "$CSC_LINK" ]; then
  echo "ℹ CSC_LINK secret is not provided. Building unsigned macOS application."
  echo "SIGN_STATUS=unsigned" >> "$GITHUB_ENV"
  echo "CSC_IDENTITY_AUTO_DISCOVERY=false" >> "$GITHUB_ENV"
  exit 0
fi

echo "✓ CSC_LINK is present (Length: ${#CSC_LINK} chars)."

if [ -z "$CSC_KEY_PASSWORD" ]; then
  echo "::error::CSC_LINK is set, but CSC_KEY_PASSWORD secret is empty!"
  echo "Please configure CSC_KEY_PASSWORD in GitHub Repository Secrets."
  exit 1
fi

TMP_DIR=$(mktemp -d)
P12_PATH="$TMP_DIR/test_cert.p12"
CERT_LOG="$TMP_DIR/openssl.log"

# Decode base64 certificate safely
if ! echo "$CSC_LINK" | base64 --decode > "$P12_PATH" 2>/dev/null; then
  echo "::error::CSC_LINK could not be decoded as valid Base64 data."
  rm -rf "$TMP_DIR"
  exit 1
fi

echo "✓ Base64 decode successful. Validating .p12 password with OpenSSL..."

VERIFIED=false

# Test 1: Standard PKCS12 password decryption test
if openssl pkcs12 -in "$P12_PATH" -passin "pass:$CSC_KEY_PASSWORD" -nokeys -nodes > "$CERT_LOG" 2>&1; then
  VERIFIED=true
# Test 2: Legacy mode for OpenSSL 3.x compatibility
elif openssl pkcs12 -legacy -in "$P12_PATH" -passin "pass:$CSC_KEY_PASSWORD" -nokeys -nodes > "$CERT_LOG" 2>&1; then
  VERIFIED=true
  echo "ℹ Note: Certificate verified using OpenSSL legacy mode."
fi

if [ "$VERIFIED" = "true" ]; then
  echo "===================================================="
  echo "✓ SUCCESS: CSC_KEY_PASSWORD is VALID and correct!"
  echo "===================================================="
  echo "Certificate Details:"
  openssl pkcs12 -in "$P12_PATH" -passin "pass:$CSC_KEY_PASSWORD" -nokeys 2>/dev/null | openssl x509 -noout -subject -issuer -dates 2>/dev/null || true
  echo "===================================================="
  echo "SIGN_STATUS=signed" >> "$GITHUB_ENV"
  echo "CSC_IDENTITY_AUTO_DISCOVERY=true" >> "$GITHUB_ENV"
else
  echo "===================================================="
  echo "::error::CSC_KEY_PASSWORD is INCORRECT or unable to unlock certificate."
  echo "===================================================="
  echo "OpenSSL Output:"
  cat "$CERT_LOG"
  echo ""
  echo "Troubleshooting Tips:"
  echo "1. Verify the export password for the .p12 certificate in GitHub Secrets."
  echo "2. Ensure CSC_KEY_PASSWORD contains no surrounding quotes or extra spaces."
  echo "3. Ensure the certificate is a valid Apple Developer ID / Codesigning .p12."
  echo "===================================================="
  rm -rf "$TMP_DIR"
  exit 1
fi

rm -rf "$TMP_DIR"
