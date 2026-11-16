#!/usr/bin/env bash
#
# Builds an installable Android APK.
#
# Wraps three things that are easy to get wrong by hand:
#   - ANDROID_HOME is not set in a normal shell, and Gradle needs the SDK path
#   - android/ is generated and gitignored, so it may not exist yet
#   - `prebuild --clean` wipes local.properties, which Gradle then cannot find
#
# The APK is signed with the debug keystore: installable anywhere, not publishable.
# For the Play Store you need your own upload key.
set -euo pipefail

# Gradle needs Java 17; the shell may still point at Java 8.
JAVA_HOME="$(/usr/libexec/java_home -v 17)"
export JAVA_HOME

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MOBILE="$REPO/apps/mobile"
ARCH="${ARCH:-arm64-v8a}"   # covers essentially every phone since ~2017
OUT="${OUT:-$HOME/Desktop}"

export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
if [ ! -d "$ANDROID_HOME" ]; then
	echo "Android SDK not found at $ANDROID_HOME" >&2
	echo "Install Android Studio, or set ANDROID_HOME to your SDK." >&2
	exit 1
fi

cd "$MOBILE"

if [ ! -d android ] || [ "${CLEAN:-0}" = "1" ]; then
	echo "==> Generating the native project"
	npx expo prebuild --platform android --clean
fi

# prebuild does not write this, and Gradle will not guess it
echo "sdk.dir=$ANDROID_HOME" > android/local.properties

VERSION="$(node -e "process.stdout.write(require('./app.json').expo.version)")"
NAME="$(node -e "process.stdout.write(require('./app.json').expo.name.replace(/\s+/g,'-'))")"

echo "==> Building $NAME $VERSION for $ARCH"
# Gradle's bundle inputs omit shared packages outside apps/mobile; always rebundle JS.
( cd android && ./gradlew app:createBundleReleaseJsAndAssets --rerun app:assembleRelease --no-daemon -PreactNativeArchitectures="$ARCH" )

APK="$MOBILE/android/app/build/outputs/apk/release/app-release.apk"
DEST="$OUT/$NAME-v$VERSION.apk"
cp "$APK" "$DEST"

APKSIGNER="$(ls "$ANDROID_HOME"/build-tools/*/apksigner | tail -1)"
"$APKSIGNER" verify "$APK" >/dev/null 2>&1 \
	&& SIGNED="signed (debug keystore)" || SIGNED="UNSIGNED — will not install"

echo
echo "APK      $DEST"
echo "size     $(du -h "$DEST" | cut -f1 | tr -d ' ')"
echo "abi      $ARCH"
echo "status   $SIGNED"
