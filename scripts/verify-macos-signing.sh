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

  # If running on macOS runner, configure & unlock keychain to prevent security set-key-partition-list failures
  if [ "$(uname)" = "Darwin" ]; then
    echo "Configuring macOS CI Keychain for codesign access..."
    KEYCHAIN_DIR="${RUNNER_TEMP:-$TMP_DIR}"
    KEYCHAIN_PATH="$KEYCHAIN_DIR/app-signing.keychain"
    KEYCHAIN_PASS="temp_ci_keychain_password"

    # Remove existing build keychain if present
    security delete-keychain "$KEYCHAIN_PATH" 2>/dev/null || true

    # Create and unlock new keychain
    security create-keychain -p "$KEYCHAIN_PASS" "$KEYCHAIN_PATH"
    security set-keychain-settings -lut 21600 "$KEYCHAIN_PATH"
    security unlock-keychain -p "$KEYCHAIN_PASS" "$KEYCHAIN_PATH"

    # Import the certificate into keychain with -A to allow access for all tools
    security import "$P12_PATH" -k "$KEYCHAIN_PATH" -P "$CSC_KEY_PASSWORD" -T /usr/bin/codesign -T /usr/bin/productsign -A

    # Set partition list so codesign can access keys without interactive GUI prompts
    security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k "$KEYCHAIN_PASS" "$KEYCHAIN_PATH" 2>/dev/null || true

    # Add to keychain search list and set as default
    EXISTING_KEYCHAINS=$(security list-keychains -d user 2>/dev/null | tr -d '"' | tr '\n' ' ')
    if [ -n "$EXISTING_KEYCHAINS" ]; then
      security list-keychains -d user -s "$KEYCHAIN_PATH" $EXISTING_KEYCHAINS 2>/dev/null || true
    fi
    security default-keychain -s "$KEYCHAIN_PATH" 2>/dev/null || true
    security unlock-keychain -p "$KEYCHAIN_PASS" "$KEYCHAIN_PATH"
    
    echo "CSC_KEYCHAIN=$KEYCHAIN_PATH" >> "$GITHUB_ENV"
    echo "CSC_KEYCHAIN_PASSWORD=$KEYCHAIN_PASS" >> "$GITHUB_ENV"
    echo "CSC_KEY_PASSWORD=$KEYCHAIN_PASS" >> "$GITHUB_ENV"
    echo "✓ macOS CI Keychain configured, unlocked, and exported to environment."
  fi

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
