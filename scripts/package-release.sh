#!/usr/bin/env bash
# 双平台打包脚本 — 生成 Saturday 交付物
# Usage: ./scripts/package-release.sh [VERSION]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
VERSION="${1:-0.1.0}"
RELEASE_DIR="$PROJECT_DIR/release"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo "=============================================="
echo "  AI-GM Plugin Release Packager v${VERSION}"
echo "=============================================="
echo ""

mkdir -p "$RELEASE_DIR"

# 1. 完整仓库 zip（通用）
echo "[→] 打包完整仓库..."
REPO_ZIP="$RELEASE_DIR/ai-gm-plugin-${VERSION}-full.zip"
rm -f "$REPO_ZIP"
(cd "$PROJECT_DIR" && zip -r "$REPO_ZIP" \
    . -x \
    '*.git/*' \
    'node_modules/*' \
    'release/*' \
    '*.log' \
    '.env')
echo "[✓] 完整仓库: ${REPO_ZIP}"

# 2. Windows 便携包（包含 install.ps1）
echo ""
echo "[→] 打包 Windows 便携包..."
WIN_DIR="$RELEASE_DIR/ai-gm-plugin-${VERSION}-windows"
rm -rf "$WIN_DIR" "$WIN_DIR.zip"
mkdir -p "$WIN_DIR"

cp "$PROJECT_DIR/install.ps1" "$WIN_DIR/"
cp -r "$PROJECT_DIR/plugin" "$WIN_DIR/"
for f in manifest.json index.js style.css package.json package-lock.json LICENSE README.md; do
    if [[ -f "$PROJECT_DIR/$f" ]]; then
        cp "$PROJECT_DIR/$f" "$WIN_DIR/"
    fi
done
# 添加测试模组
if [[ -d "$PROJECT_DIR/test-module" ]]; then
    cp -r "$PROJECT_DIR/test-module" "$WIN_DIR/"
fi

cp -r "$PROJECT_DIR/docs" "$WIN_DIR/" 2>/dev/null || true

echo "    文件列表:"
find "$WIN_DIR" -maxdepth 2 -type f | sed 's|^|      |'

(cd "$RELEASE_DIR" && zip -r "ai-gm-plugin-${VERSION}-windows.zip" "$(basename "$WIN_DIR")")
rm -rf "$WIN_DIR"
echo "[✓] Windows 包: ${RELEASE_DIR}/ai-gm-plugin-${VERSION}-windows.zip"

# 3. Linux 便携包（包含 install.sh）
echo ""
echo "[→] 打包 Linux 便携包..."
LIN_DIR="$RELEASE_DIR/ai-gm-plugin-${VERSION}-linux"
rm -rf "$LIN_DIR" "$LIN_DIR.zip"
mkdir -p "$LIN_DIR"

cp "$PROJECT_DIR/install.sh" "$LIN_DIR/"
cp -r "$PROJECT_DIR/plugin" "$LIN_DIR/"
for f in manifest.json index.js style.css package.json package-lock.json LICENSE README.md; do
    if [[ -f "$PROJECT_DIR/$f" ]]; then
        cp "$PROJECT_DIR/$f" "$LIN_DIR/"
    fi
done
if [[ -d "$PROJECT_DIR/test-module" ]]; then
    cp -r "$PROJECT_DIR/test-module" "$LIN_DIR/"
fi

cp -r "$PROJECT_DIR/docs" "$LIN_DIR/" 2>/dev/null || true

echo "    文件列表:"
find "$LIN_DIR" -maxdepth 2 -type f | sed 's|^|      |'

(cd "$RELEASE_DIR" && zip -r "ai-gm-plugin-${VERSION}-linux.zip" "$(basename "$LIN_DIR")")
rm -rf "$LIN_DIR"
echo "[✓] Linux 包: ${RELEASE_DIR}/ai-gm-plugin-${VERSION}-linux.zip"

# 4. 生成 checksum
# echo ""
# echo "[→] 生成 SHA256 checksum..."
# (cd "$RELEASE_DIR" && sha256sum *.zip > "checksums-${TIMESTAMP}.txt")
# echo "[✓] checksums-${TIMESTAMP}.txt"

echo ""
echo "=============================================="
echo "  打包完成！"
echo "  输出目录: ${RELEASE_DIR}"
echo "=============================================="
echo ""
ls -lh "$RELEASE_DIR/"
