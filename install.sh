#!/usr/bin/env bash
# AI-GM Plugin — Linux/macOS 安装脚本
# Requires: SillyTavern >= 1.18.0, bash, Node.js, git
# Usage: ./install.sh [-p /path/to/SillyTavern] [--skip-extension] [--skip-plugin] [--dev]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_NAME="ai-gm"
VERSION="0.1.0"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
GRAY='\033[0;90m'
NC='\033[0m' # No Color

# Defaults
SILLYTAVERN_PATH=""
SKIP_EXTENSION=false
SKIP_PLUGIN=false
DEV_MODE=false

# Parse args
while [[ $# -gt 0 ]]; do
    case $1 in
        -p|--path)
            SILLYTAVERN_PATH="$2"
            shift 2
            ;;
        --skip-extension)
            SKIP_EXTENSION=true
            shift
            ;;
        --skip-plugin)
            SKIP_PLUGIN=true
            shift
            ;;
        --dev)
            DEV_MODE=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [-p /path/to/SillyTavern] [--skip-extension] [--skip-plugin] [--dev]"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

find_sillytavern() {
    local candidates=(
        "$HOME/SillyTavern"
        "$HOME/sillytavern"
        "$HOME/Documents/SillyTavern"
        "$HOME/Desktop/SillyTavern"
        "/opt/SillyTavern"
        "/usr/local/share/SillyTavern"
    )
    for c in "${candidates[@]}"; do
        if [[ -f "$c/server.js" ]]; then
            echo "$c"
            return 0
        fi
    done
    return 1
}

print_info() {
    echo -e "${CYAN}==============================================${NC}"
    echo -e "${CYAN}  AI-GM Plugin Installer v${VERSION}${NC}"
    echo -e "${CYAN}  Linux / macOS Edition${NC}"
    echo -e "${CYAN}==============================================${NC}"
    echo ""
}

print_success() {
    echo -e "${GREEN}[✓] $1${NC}"
}

print_warn() {
    echo -e "${YELLOW}[!] $1${NC}"
}

print_error() {
    echo -e "${RED}[✗] $1${NC}"
}

print_info

# ==================== Locate SillyTavern ====================
if [[ -z "$SILLYTAVERN_PATH" ]]; then
    AUTO_PATH=$(find_sillytavern) || true
    if [[ -n "$AUTO_PATH" ]]; then
        print_success "自动检测到 SillyTavern: ${AUTO_PATH}"
        SILLYTAVERN_PATH="$AUTO_PATH"
    else
        print_warn "未自动找到 SillyTavern"
        echo "    请手动指定路径:"
        echo "    $0 -p /path/to/SillyTavern"
        exit 1
    fi
fi

# Resolve path
if [[ ! -d "$SILLYTAVERN_PATH" ]]; then
    print_error "路径不存在: ${SILLYTAVERN_PATH}"
    exit 1
fi

ST_PATH="$(cd "$SILLYTAVERN_PATH" && pwd)"
if [[ ! -f "$ST_PATH/server.js" ]]; then
    print_error "该路径不是 SillyTavern 根目录 (找不到 server.js)"
    exit 1
fi

print_success "SillyTavern 路径: ${ST_PATH}"
echo ""

# ==================== Install Extension ====================
if [[ "$SKIP_EXTENSION" == false ]]; then
    echo -e "${CYAN}[→] 安装前端 Extension...${NC}"

    EXT_DIR="$ST_PATH/public/scripts/extensions/third-party/$PLUGIN_NAME"
    mkdir -p "$EXT_DIR"

    # Copy frontend files
    for f in manifest.json index.js style.css icon.png; do
        src="$SCRIPT_DIR/$f"
        if [[ -f "$src" ]]; then
            cp -f "$src" "$EXT_DIR/"
            print_success "  $f"
        else
            print_warn "  $f 不存在，跳过"
        fi
    done

    print_success "Extension 安装完成: ${EXT_DIR}"
    echo ""
fi

# ==================== Install Plugin ====================
if [[ "$SKIP_PLUGIN" == false ]]; then
    echo -e "${CYAN}[→] 安装后端 Plugin...${NC}"

    PLUGIN_DIR="$ST_PATH/plugins/$PLUGIN_NAME"
    mkdir -p "$PLUGIN_DIR"

    # Copy plugin directory
    if [[ -d "$SCRIPT_DIR/plugin" ]]; then
        cp -r "$SCRIPT_DIR/plugin/"* "$PLUGIN_DIR/"
        print_success "  plugin/ 目录"
    else
        print_error "plugin/ 目录不存在"
        exit 1
    fi

    # Copy root files
    for f in package.json package-lock.json LICENSE README.md; do
        src="$SCRIPT_DIR/$f"
        if [[ -f "$src" ]]; then
            cp -f "$src" "$PLUGIN_DIR/"
        fi
    done

    # Install dependencies
    echo -e "${CYAN}  [→] 安装 npm 依赖...${NC}"
    pushd "$PLUGIN_DIR" > /dev/null

    if ! command -v node &> /dev/null; then
        # Try SillyTavern bundled node
        BUNDLED_NODE="$ST_PATH/node"
        if [[ -x "$BUNDLED_NODE" ]]; then
            NODE_CMD="$BUNDLED_NODE"
            # Try bundled npm
            BUNDLED_NPM="$ST_PATH/node_modules/.bin/npm"
            if [[ -x "$BUNDLED_NPM" ]]; then
                NPM_CMD="$BUNDLED_NPM"
            else
                NPM_CMD="npm"
            fi
        else
            print_error "未找到 Node.js。请安装 Node.js 或确保 SillyTavern 已安装。"
            exit 1
        fi
    else
        NODE_CMD="node"
        NPM_CMD="npm"
    fi

    # Verify node works
    if ! $NODE_CMD --version > /dev/null 2>&1; then
        print_error "Node.js 无法运行"
        exit 1
    fi

    # Install dependencies
    $NPM_CMD install --production 2>&1 | while read -r line; do
        echo -e "${GRAY}      ${line}${NC}"
    done || true

    popd > /dev/null

    print_success "Plugin 安装完成: ${PLUGIN_DIR}"
    echo ""
fi

# ==================== Check config.yaml ====================
CONFIG_PATH="$ST_PATH/config.yaml"
if [[ -f "$CONFIG_PATH" ]]; then
    echo -e "${CYAN}[→] 检查 config.yaml...${NC}"
    if grep -q "enableServerPlugins: true" "$CONFIG_PATH"; then
        print_success "  enableServerPlugins 已启用"
    else
        print_warn "  enableServerPlugins 未启用或不确定"
        echo -e "${YELLOW}  请确保 config.yaml 中设置: enableServerPlugins: true${NC}"
    fi
    echo ""
fi

# ==================== Finish ====================
echo -e "${CYAN}==============================================${NC}"
echo -e "${GREEN}  安装完成！${NC}"
echo -e "${CYAN}==============================================${NC}"
echo ""
echo "  下一步："
echo "  1. 重启 SillyTavern 服务器"
echo "  2. 在浏览器中刷新页面"
echo "  3. 在 Extensions 菜单中启用 AI-GM"
echo ""
echo "  插件目录："
if [[ "$SKIP_EXTENSION" == false ]]; then
    echo -e "${GRAY}    Extension: ${EXT_DIR}${NC}"
fi
if [[ "$SKIP_PLUGIN" == false ]]; then
    echo -e "${GRAY}    Plugin:    ${PLUGIN_DIR}${NC}"
fi
echo ""

if [[ "$DEV_MODE" == true ]]; then
    echo -e "${CYAN}  [DevMode] 已启用开发模式${NC}"
    echo -e "${CYAN}  - 文件变更将自动同步（通过符号链接）${NC}"
    echo -e "${CYAN}  - 使用 'npm run test' 运行测试${NC}"
fi
