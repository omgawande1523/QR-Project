#!/usr/bin/env bash
# iOS cloud build steps, shared by codemagic.yaml and .github/workflows/ios.yml. Needs macOS with Xcode.
# Run from the repository root after `node scripts/app.mjs ios-sync` (in mobile/) has prepared the project.
#
#   bash mobile/scripts/ios-ci.sh build-simulator   compile a Debug build for the iOS Simulator (no signing)
#   bash mobile/scripts/ios-ci.sh screenshots       install it on an iPhone and an iPad simulator, launch it, take
#                                                   screenshots, and sign in to the test API with Maestro if it runs
#   bash mobile/scripts/ios-ci.sh release           signed App Store build, uploaded to App Store Connect
#                                                   (GitHub Actions; Codemagic uses its own signing tools)
set -euo pipefail
cd "$(dirname "$0")/.."

PROJECT=ios/App/App.xcodeproj
DERIVED=ios/build
SHOTS="$PWD/ios/screenshots"
APP_ID=$(node -p "require('./app.config.json').appId")
API_URL=${VITE_API_URL:-http://localhost:5000}

# The newest simulator of a kind: the largest iPhone (6.9" Pro Max, for App Store screenshots) or 13" iPad.
pick_device() {
  xcrun simctl list devices available -j | node -e '
    const kind = process.argv[1];
    const { devices } = JSON.parse(require("fs").readFileSync(0, "utf8"));
    const version = (runtime) => (runtime.match(/iOS-(\d+)-(\d+)/) || [0, 0, 0]).slice(1).map(Number);
    const all = Object.entries(devices).filter(([runtime]) => runtime.includes("iOS"))
      .flatMap(([runtime, list]) => list.map((device) => ({ ...device, v: version(runtime) })))
      .sort((a, b) => b.v[0] - a.v[0] || b.v[1] - a.v[1] || b.name.localeCompare(a.name, "en", { numeric: true }));
    const prefer = kind === "iPhone" ? [/^iPhone \d+ Pro Max$/, /^iPhone \d+ Pro$/, /^iPhone/] : [/^iPad Pro 13/, /^iPad Pro/, /^iPad/];
    for (const pattern of prefer) {
      const device = all.find((d) => pattern.test(d.name));
      if (device) { console.log(`${device.udid} ${device.name}`); process.exit(0); }
    }
    process.exit(1);' "$1"
}

build_simulator() {
  mkdir -p "$DERIVED"
  xcodebuild -project "$PROJECT" -scheme App -configuration Debug \
    -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' \
    -derivedDataPath "$DERIVED" -clonedSourcePackagesDirPath "$DERIVED/SourcePackages" \
    CODE_SIGNING_ALLOWED=NO -quiet build
  ls -d "$DERIVED/Build/Products/Debug-iphonesimulator/App.app"
  echo "iOS Simulator build succeeded"
}

maestro_bin() {
  if ! command -v maestro >/dev/null 2>&1; then
    curl -fsSL "https://get.maestro.mobile.dev" | bash >/dev/null
    export PATH="$PATH:$HOME/.maestro/bin"
  fi
  command -v maestro
}

screenshots() {
  local app="$DERIVED/Build/Products/Debug-iphonesimulator/App.app"
  local flows="$PWD/maestro" api=0 failed=0
  mkdir -p "$SHOTS"
  curl -fs "$API_URL/health" >/dev/null && api=1 || echo "Test API not reachable at $API_URL: login screens only"
  for kind in iPhone iPad; do
    read -r udid name < <(pick_device "$kind")
    echo "== $kind: $name ($udid)"
    xcrun simctl boot "$udid" 2>/dev/null || true
    xcrun simctl bootstatus "$udid" -b
    xcrun simctl status_bar "$udid" override --time "9:41" --batteryState charged --batteryLevel 100 --wifiBars 3 --cellularBars 4 || true
    xcrun simctl install "$udid" "$app"
    # The app's console (Capacitor prints JavaScript console messages and errors) goes to a log file.
    xcrun simctl launch --stdout="$SHOTS/$kind-console.log" --stderr="$SHOTS/$kind-console.log" "$udid" "$APP_ID"
    sleep 25
    xcrun simctl io "$udid" screenshot "$SHOTS/$kind-1-login.png"
    if [ "$api" = 1 ]; then
      # Maestro saves screenshots relative to where it runs.
      (cd "$SHOTS" && "$(maestro_bin)" --device "$udid" test "$flows/$kind.yaml") || { echo "Sign-in flow failed on $kind"; failed=1; }
    fi
    xcrun simctl spawn "$udid" log show --last 15m --style compact --predicate "process == \"App\"" > "$SHOTS/$kind-app.log" 2>/dev/null || true
    xcrun simctl shutdown "$udid" || true
  done
  ls -la "$SHOTS"
  [ "$failed" = 0 ]
}

# App Store build signed with an App Store Connect API key (automatic signing), uploaded straight to
# App Store Connect for TestFlight. Needs ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_PATH, APPLE_TEAM_ID, BUILD_NUMBER.
release() {
  local auth=(-allowProvisioningUpdates -authenticationKeyPath "$ASC_KEY_PATH" -authenticationKeyID "$ASC_KEY_ID" -authenticationKeyIssuerID "$ASC_ISSUER_ID")
  mkdir -p "$DERIVED"
  xcodebuild -project "$PROJECT" -scheme App -configuration Release -destination 'generic/platform=iOS' \
    -archivePath "$DERIVED/App.xcarchive" -derivedDataPath "$DERIVED" \
    DEVELOPMENT_TEAM="$APPLE_TEAM_ID" CODE_SIGN_STYLE=Automatic CURRENT_PROJECT_VERSION="$BUILD_NUMBER" \
    "${auth[@]}" -quiet archive
  cat > "$DERIVED/ExportOptions.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key><string>app-store-connect</string>
  <key>destination</key><string>upload</string>
  <key>signingStyle</key><string>automatic</string>
  <key>teamID</key><string>$APPLE_TEAM_ID</string>
  <key>manageAppVersionAndBuildNumber</key><false/>
</dict>
</plist>
PLIST
  xcodebuild -exportArchive -archivePath "$DERIVED/App.xcarchive" -exportOptionsPlist "$DERIVED/ExportOptions.plist" \
    -exportPath "$DERIVED/export" "${auth[@]}"
  echo "Uploaded build $BUILD_NUMBER to App Store Connect (TestFlight)"
}

case "${1:-}" in
  build-simulator) build_simulator ;;
  screenshots) screenshots ;;
  release) release ;;
  *) echo "Usage: bash mobile/scripts/ios-ci.sh build-simulator | screenshots | release" >&2; exit 1 ;;
esac
