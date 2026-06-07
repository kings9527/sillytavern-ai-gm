# AI-GM Plugin — Windows 安装脚本 (PowerShell)
# Requires: SillyTavern >= 1.18.0, PowerShell 5.1+ (Windows 11兼容)
# Usage: Right-click → "Run with PowerShell" or: .\install.ps1 -SillyTavernPath "C:\Path\To\SillyTavern"

param(
    [Parameter(Mandatory=$false)]
    [string]$SillyTavernPath = "",

    [switch]$SkipExtension = $false,
    [switch]$SkipPlugin = $false,
    [switch]$DevMode = $false
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$PluginName = "ai-gm"
$Version = "0.1.0"

function Write-ColorLine {
    param([string]$Text, [string]$Color = "White")
    Write-Host $Text -ForegroundColor $Color
}

function Find-SillyTavern {
    # 尝试常见路径
    $Candidates = @(
        "${env:USERPROFILE}\SillyTavern",
        "${env:USERPROFILE}\Documents\SillyTavern",
        "${env:USERPROFILE}\Desktop\SillyTavern",
        "C:\SillyTavern",
        "D:\SillyTavern"
    )
    foreach ($c in $Candidates) {
        if (Test-Path "$c\server.js" -PathType Leaf) {
            return $c
        }
    }
    return $null
}

# ==================== 启动信息 ====================
Write-ColorLine "==============================================" "Cyan"
Write-ColorLine "  AI-GM Plugin Installer v${Version}" "Cyan"
Write-ColorLine "  Windows (PowerShell) Edition" "Cyan"
Write-ColorLine "==============================================" "Cyan"
Write-ColorLine ""

# ==================== 定位 SillyTavern ====================
if (-not $SillyTavernPath) {
    $AutoPath = Find-SillyTavern
    if ($AutoPath) {
        Write-ColorLine "[✓] 自动检测到 SillyTavern: ${AutoPath}" "Green"
        $SillyTavernPath = $AutoPath
    } else {
        Write-ColorLine "[!] 未自动找到 SillyTavern" "Yellow"
        Write-ColorLine "    请手动指定路径，例如:" "Yellow"
        Write-ColorLine "    .\install.ps1 -SillyTavernPath 'C:\Users\YourName\SillyTavern'" "Yellow"
        exit 1
    }
}

$STPath = Resolve-Path $SillyTavernPath -ErrorAction SilentlyContinue
if (-not $STPath) {
    Write-ColorLine "[✗] 路径不存在: ${SillyTavernPath}" "Red"
    exit 1
}

# 验证是 SillyTavern 根目录
$ServerJs = Join-Path $STPath "server.js"
if (-not (Test-Path $ServerJs -PathType Leaf)) {
    Write-ColorLine "[✗] 该路径不是 SillyTavern 根目录 (找不到 server.js)" "Red"
    exit 1
}

Write-ColorLine "[✓] SillyTavern 路径: ${STPath}" "Green"
Write-ColorLine ""

# ==================== 安装前端 Extension ====================
if (-not $SkipExtension) {
    Write-ColorLine "[→] 安装前端 Extension..." "Cyan"

    $ExtDir = Join-Path $STPath "public\scripts\extensions\third-party" $PluginName
    if (-not (Test-Path $ExtDir)) {
        New-Item -ItemType Directory -Path $ExtDir -Force | Out-Null
    }

    # 复制前端文件
    $FrontFiles = @(
        "manifest.json",
        "index.js",
        "style.css",
        "icon.png"
    )
    foreach ($f in $FrontFiles) {
        $Src = Join-Path $ScriptDir $f
        $Dst = Join-Path $ExtDir $f
        if (Test-Path $Src -PathType Leaf) {
            Copy-Item $Src $Dst -Force
            Write-ColorLine "    [✓] $f" "Green"
        } else {
            Write-ColorLine "    [⚠] $f 不存在，跳过" "Yellow"
        }
    }

    Write-ColorLine "[✓] Extension 安装完成: ${ExtDir}" "Green"
    Write-ColorLine ""
}

# ==================== 安装后端 Plugin ====================
if (-not $SkipPlugin) {
    Write-ColorLine "[→] 安装后端 Plugin..." "Cyan"

    $PluginDir = Join-Path $STPath "plugins" $PluginName
    if (-not (Test-Path $PluginDir)) {
        New-Item -ItemType Directory -Path $PluginDir -Force | Out-Null
    }

    # 复制整个 plugin 目录
    $SrcPluginDir = Join-Path $ScriptDir "plugin"
    if (Test-Path $SrcPluginDir) {
        Copy-Item "$SrcPluginDir\*" $PluginDir -Recurse -Force
        Write-ColorLine "    [✓] plugin/ 目录" "Green"
    } else {
        Write-ColorLine "    [✗] plugin/ 目录不存在" "Red"
        exit 1
    }

    # 复制根级文件到插件目录（后端需要）
    $RootFiles = @(
        "package.json",
        "package-lock.json",
        "LICENSE",
        "README.md"
    )
    foreach ($f in $RootFiles) {
        $Src = Join-Path $ScriptDir $f
        if (Test-Path $Src -PathType Leaf) {
            Copy-Item $Src $PluginDir -Force
        }
    }

    # 安装依赖
    Write-ColorLine "    [→] 安装 npm 依赖..." "Cyan"
    Push-Location $PluginDir
    try {
        # 使用 SillyTavern 自带的 Node.js 或系统 Node.js
        $NodePath = Get-Command "node" -ErrorAction SilentlyContinue
        if (-not $NodePath) {
            # 尝试 SillyTavern 内置的 node
            $BuiltinNode = Join-Path $STPath "node.exe"
            if (Test-Path $BuiltinNode -PathType Leaf) {
                $NodePath = $BuiltinNode
            } else {
                Write-ColorLine "[✗] 未找到 Node.js。请安装 Node.js 或确保 SillyTavern 已安装。" "Red"
                exit 1
            }
        }

        if ($NodePath -is [System.Management.Automation.ApplicationInfo]) {
            $NodeCmd = $NodePath.Source
        } else {
            $NodeCmd = $NodePath
        }

        & $NodeCmd "--version" | Out-Null
        if ($LASTEXITCODE -ne 0) {
            Write-ColorLine "[✗] Node.js 无法运行" "Red"
            exit 1
        }

        # 使用 npm install
        $NpmCmd = "npm"
        if ($NodeCmd -ne "node") {
            # 如果用的是 SillyTavern 内置 node，找对应的 npm
            $NpmCmd = Join-Path (Split-Path $NodeCmd) "npm.cmd"
            if (-not (Test-Path $NpmCmd)) {
                $NpmCmd = "npm"
            }
        }

        & $NpmCmd "install" --production 2>&1 | ForEach-Object {
            Write-ColorLine "      $_" "Gray"
        }

        if ($LASTEXITCODE -ne 0) {
            Write-ColorLine "[✗] npm install 失败" "Red"
            exit 1
        }
    } finally {
        Pop-Location
    }

    Write-ColorLine "[✓] Plugin 安装完成: ${PluginDir}" "Green"
    Write-ColorLine ""
}

# ==================== 检查 config.yaml ====================
$ConfigPath = Join-Path $STPath "config.yaml"
if (Test-Path $ConfigPath -PathType Leaf) {
    Write-ColorLine "[→] 检查 config.yaml..." "Cyan"
    $Content = Get-Content $ConfigPath -Raw
    if ($Content -match "enableServerPlugins:\s*true") {
        Write-ColorLine "    [✓] enableServerPlugins 已启用" "Green"
    } else {
        Write-ColorLine "    [!] enableServerPlugins 未启用或不确定" "Yellow"
        Write-ColorLine "    请确保 config.yaml 中设置: enableServerPlugins: true" "Yellow"
    }
    Write-ColorLine ""
}

# ==================== 完成 ====================
Write-ColorLine "==============================================" "Cyan"
Write-ColorLine "  安装完成！" "Green"
Write-ColorLine "==============================================" "Cyan"
Write-ColorLine ""
Write-ColorLine "  下一步：" "White"
Write-ColorLine "  1. 重启 SillyTavern 服务器" "White"
Write-ColorLine "  2. 在浏览器中刷新页面" "White"
Write-ColorLine "  3. 在 Extensions 菜单中启用 AI-GM" "White"
Write-ColorLine ""
Write-ColorLine "  插件目录:" "White"
if (-not $SkipExtension) {
    Write-ColorLine "    Extension: ${ExtDir}" "Gray"
}
if (-not $SkipPlugin) {
    Write-ColorLine "    Plugin:    ${PluginDir}" "Gray"
}
Write-ColorLine ""

if ($DevMode) {
    Write-ColorLine "  [DevMode] 已启用开发模式" "Cyan"
    Write-ColorLine "  - 文件变更将自动同步（通过符号链接）" "Cyan"
    Write-ColorLine "  - 使用 'npm run test' 运行测试" "Cyan"
}
