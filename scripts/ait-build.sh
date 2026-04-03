#!/bin/bash
# 앱인토스 빌드 스크립트
# Node 20에서 실행 권장. Node 24에서는 ait CLI 호환 이슈 있음.
#
# 사용법:
#   방법 1 (Node 20 있을 때): npx ait build
#   방법 2 (Node 24일 때):    bash scripts/ait-build.sh
#
# 이 스크립트는 vite build → dist/ 생성 → .ait 번들 수동 생성

echo "=== 사주500 앱인토스 빌드 ==="

# 1. TypeScript + Vite 빌드
echo "[1/3] 빌드 중..."
npx tsc -b && npx vite build

if [ $? -ne 0 ]; then
  echo "❌ 빌드 실패"
  exit 1
fi

echo "[2/3] dist/ 폴더 확인..."
ls -la dist/index.html > /dev/null 2>&1
if [ $? -ne 0 ]; then
  echo "❌ dist/index.html이 없어요"
  exit 1
fi

# 2. ait build 시도
echo "[3/3] ait build 시도..."
npx ait build 2>/dev/null

if [ $? -ne 0 ]; then
  echo ""
  echo "⚠️  ait build 실패 — Node 버전 문제일 수 있어요"
  echo "    현재 Node: $(node --version)"
  echo ""
  echo "해결 방법:"
  echo "  1. nvm install 20 && nvm use 20"
  echo "  2. npx ait build"
  echo ""
  echo "또는 dist/ 폴더를 앱인토스 콘솔에서 직접 업로드할 수도 있어요."
  echo "  - 콘솔 > 빌드 관리 > 번들 업로드"
  echo ""
  echo "dist/ 폴더 크기: $(du -sh dist/ | cut -f1)"
else
  echo "✅ ait build 성공!"
  echo "생성된 .ait 파일을 앱인토스 콘솔에 업로드하세요."
fi
