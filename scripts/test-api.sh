#!/bin/bash
# 사주500 API 테스트 스크립트
# Firebase Functions가 실제로 동작하는지 확인
#
# 사전 조건:
# 1. firebase deploy --only functions 완료
# 2. Firebase Secrets 설정: ANTHROPIC_API_KEY, GEMINI_API_KEY
#    firebase functions:secrets:set ANTHROPIC_API_KEY
#    firebase functions:secrets:set GEMINI_API_KEY

PROJECT_ID="appintoss-saju"
REGION="us-central1"
BASE="https://${REGION}-${PROJECT_ID}.cloudfunctions.net"

echo "=== 사주500 API 테스트 ==="
echo "프로젝트: ${PROJECT_ID}"
echo ""

# 1. Functions 목록 확인
echo "[1] Functions 배포 상태..."
firebase functions:list 2>/dev/null | grep -E "generateReport|generateDailyFortune|generateChatAnswer|generateDream|loginWithToss|grantPurchase|grantShareReward" || echo "  → firebase functions:list로 확인하세요"
echo ""

# 2. Secrets 설정 확인
echo "[2] Secrets 설정 확인..."
firebase functions:secrets:access ANTHROPIC_API_KEY --format=json 2>/dev/null | head -1 && echo "  ✅ ANTHROPIC_API_KEY 설정됨" || echo "  ❌ ANTHROPIC_API_KEY 미설정 → firebase functions:secrets:set ANTHROPIC_API_KEY"
firebase functions:secrets:access GEMINI_API_KEY --format=json 2>/dev/null | head -1 && echo "  ✅ GEMINI_API_KEY 설정됨" || echo "  ❌ GEMINI_API_KEY 미설정 → firebase functions:secrets:set GEMINI_API_KEY"
echo ""

# 3. Firestore 규칙 배포 확인
echo "[3] Firestore 규칙..."
firebase deploy --only firestore:rules --dry-run 2>/dev/null && echo "  ✅ 규칙 유효" || echo "  ⚠️ 규칙 확인 필요"
echo ""

# 4. Hosting 상태
echo "[4] Hosting..."
curl -s -o /dev/null -w "  HTTP %{http_code} — " "https://${PROJECT_ID}.web.app"
echo "https://${PROJECT_ID}.web.app"
echo ""

echo "=== 테스트 완료 ==="
echo ""
echo "수동 테스트 방법:"
echo "  1. https://${PROJECT_ID}.web.app 접속"
echo "  2. 사주 입력 → 분석 시작 → 로딩 → 결과 확인"
echo "  3. 결과가 데모 데이터면: API 키 미설정"
echo "  4. 결과가 AI 생성이면: 성공!"
echo ""
echo "API 키 설정:"
echo "  firebase functions:secrets:set ANTHROPIC_API_KEY"
echo "  firebase functions:secrets:set GEMINI_API_KEY"
echo "  firebase functions:secrets:set TOSS_CLIENT_ID"
echo "  firebase functions:secrets:set TOSS_CLIENT_SECRET"
