#!/bin/sh
# Agent UI 验证系统 — 一次性环境安装
# 用途：容器重建 / 新机器时跑一次，之后 ui:baseline / ui:verify 就能用
# 用法：sh scripts/agent/install-deps.sh
set -e

echo "=== 1. 系统依赖 ==="
# Alpine 容器；若已装会自动 skip
apk add --no-cache \
  chromium \
  rsync git nodejs npm \
  font-noto-cjk \
  fontconfig 2>&1 | tail -5

echo ""
echo "=== 2. fontconfig：让 sans-serif:lang=zh 命中 Noto CJK ==="
# 没有这一步，Chromium 会用 Open Sans 渲染中文 → 全部空白
mkdir -p /root/.config/fontconfig
if [ ! -f /root/.config/fontconfig/fonts.conf ]; then
  cat > /root/.config/fontconfig/fonts.conf <<'FONTCONF'
<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "urn:fontconfig:fonts.dtd">
<fontconfig>
  <match target="pattern">
    <test qual="any" name="family"><string>sans-serif</string></test>
    <edit name="family" mode="prepend" binding="strong"><string>Noto Sans CJK TC</string></edit>
  </match>
  <match target="pattern">
    <test qual="any" name="family"><string>sans-serif</string></test>
    <edit name="family" mode="append" binding="strong"><string>Noto Sans CJK SC</string></edit>
  </match>
</fontconfig>
FONTCONF
  echo "已写入 /root/.config/fontconfig/fonts.conf"
else
  echo "fonts.conf 已存在，跳过"
fi
fc-cache -f >/dev/null 2>&1 || true

echo ""
echo "=== 3. 验证字体 ==="
echo "CJK 字体数：$(fc-list 2>/dev/null | grep -icE 'cjk|noto.*sc')"
echo "sans-serif:lang=zh → $(fc-match 'sans-serif:lang=zh' 2>&1)"
echo "sans-serif:lang=zh-tw → $(fc-match 'sans-serif:lang=zh-tw' 2>&1)"

echo ""
echo "=== 4. npm 依赖 ==="
cd "$(dirname "$0")/../.."
npm install --registry https://registry.npmmirror.com --no-audit --no-fund 2>&1 | tail -3

echo ""
echo "=== 5. 自检（应显示 playwright/pixelmatch/pngjs/pino 全 OK） ==="
node -e 'for (const m of ["playwright","pixelmatch","pngjs","pino"]) { try { require.resolve(m); console.log("OK  ", m); } catch(e) { console.log("MISS", m); } }'

echo ""
echo "=== 完成 ==="
echo "下一步："
echo "  setsid npx vite --config vite.config.mjs --port 5174 --strictPort < /dev/null > /tmp/vite.log 2>&1 &"
echo "  sleep 8"
echo "  TMPDIR=/tmp CHROMIUM_PATH=/usr/bin/chromium node scripts/agent/baseline.mjs"
