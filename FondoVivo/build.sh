#!/bin/bash
# Compila Fondo Vivo y crea "build/Fondo Vivo.app".
# Uso: ./build.sh            → solo compila
#      ./build.sh --install  → además copia la app a /Applications
set -euo pipefail
cd "$(dirname "$0")"

APP="build/Fondo Vivo.app"

if [ ! -f Resources/AppIcon.icns ]; then
    echo "→ Generando icono…"
    WORK="$(mktemp -d)"
    swift scripts/make_icon.swift "$WORK/icon.png"
    mkdir "$WORK/AppIcon.iconset"
    for size in 16 32 128 256 512; do
        sips -z $size $size "$WORK/icon.png" --out "$WORK/AppIcon.iconset/icon_${size}x${size}.png" >/dev/null
        sips -z $((size * 2)) $((size * 2)) "$WORK/icon.png" --out "$WORK/AppIcon.iconset/icon_${size}x${size}@2x.png" >/dev/null
    done
    iconutil -c icns "$WORK/AppIcon.iconset" -o Resources/AppIcon.icns
    cp "$WORK/icon.png" Resources/AppIcon.png
    rm -rf "$WORK"
fi

echo "→ Compilando…"
swift build -c release
BIN_DIR="$(swift build -c release --show-bin-path)"

echo "→ Empaquetando…"
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
cp "$BIN_DIR/FondoVivo" "$APP/Contents/MacOS/FondoVivo"
cp Resources/Info.plist "$APP/Contents/Info.plist"
cp Resources/AppIcon.icns "$APP/Contents/Resources/AppIcon.icns"
codesign --force --sign - "$APP" >/dev/null

if [ "${1:-}" = "--install" ]; then
    echo "→ Instalando en /Applications…"
    pkill -x FondoVivo 2>/dev/null || true
    rm -rf "/Applications/Fondo Vivo.app"
    cp -R "$APP" /Applications/
    echo "✓ Instalada: /Applications/Fondo Vivo.app"
else
    echo "✓ Lista: $APP"
fi
