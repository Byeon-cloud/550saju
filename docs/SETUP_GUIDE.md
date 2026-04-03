# PTT MBTI 앱 - 콘솔 설정 가이드

이 문서는 코드 외적으로 직접 해야 하는 콘솔 작업들을 정리한 것입니다.
각 섹션을 클로드 챗봇에 복사+붙여넣기하면 단계별 안내를 받을 수 있습니다.

---

## 1. Firestore 보안 규칙 배포

### 직접 실행 (Windows PowerShell에서)
```powershell
cd D:\appintoss\my-mbti-app
firebase deploy --only firestore:rules
```

끝입니다. `firestore.rules` 파일이 이미 프로젝트 루트에 있으므로 이 한 줄만 실행하면 됩니다.

---

## 2. Toss IAP SKU 등록

### 클로드에게 복사할 내용:

```
나는 토스 미니앱(앱인토스) 개발자야.
토스 개발자 콘솔에서 인앱결제(IAP) 상품을 등록해야 해.

등록해야 할 상품 3개:

1. SKU: mbti_ticket_1
   - 상품명: 패스권 1장
   - 가격: 100원
   - 설명: MBTI 궁합/타로/운세 1회 이용권
   - 아이콘: 🎟️ (티켓 이미지)

2. SKU: mbti_ticket_5
   - 상품명: 패스권 5장
   - 가격: 400원
   - 설명: MBTI 궁합/타로/운세 5회 이용권 (20% 할인)
   - 아이콘: 🎟️

3. SKU: mbti_ticket_10
   - 상품명: 패스권 10장
   - 가격: 700원
   - 설명: MBTI 궁합/타로/운세 10회 이용권 (30% 할인)
   - 아이콘: 🎟️

토스 개발자 콘솔(https://developers.toss.im)에서 IAP 상품 등록하는 방법을 단계별로 알려줘.
앱 이름은 'ptt-s1'이야.
```

---

## 3. Google Ads 연동

### 3-1. Google Ads 계정 생성 + 전환 ID 받기

클로드에게 복사할 내용:

```
나는 토스 미니앱(웹앱)을 운영하고 있고, Google Ads로 광고를 돌리려고 해.
GA4 측정 ID는 G-TMTV44QG6T 이야.

다음을 단계별로 알려줘:
1. Google Ads 계정 만드는 방법 (ads.google.com)
2. Google Ads에서 전환 추적 설정하는 방법
3. GA4 (G-TMTV44QG6T)와 Google Ads를 연결하는 방법
4. 전환 ID (AW-XXXXXXXXXX 형식)를 확인하는 방법

최종적으로 나는 AW-XXXXXXXXXX 형식의 전환 ID를 받아서
내 코드의 analytics.ts 파일에 GOOGLE_ADS_ID 변수에 넣으면 돼.
이미 코드에는 trackConversion() 함수가 구현되어 있어.
```

### 3-2. 전환 ID를 받은 후

Google Ads 전환 ID를 받으면 나한테(클로드 코드) 알려주세요.
`src/utils/analytics.ts` 파일의 17번째 줄에 입력해드립니다:

```typescript
const GOOGLE_ADS_ID = ''; // ← 여기에 'AW-XXXXXXXXXX' 입력
```

---

## 4. Lambda horoscope-reading 액션 추가

### 클로드에게 복사할 내용:

```
나는 AWS Lambda 함수를 가지고 있어.
함수 이름: mbti-toss-auth
URL: https://8s8xtd2umc.execute-api.ap-northeast-2.amazonaws.com/default/mbti-toss-auth
리전: ap-northeast-2 (서울)

이 Lambda에는 이미 'tarot-reading' 액션이 있어서 AI 타로 해석을 해주고 있어.
여기에 'horoscope-reading' 액션을 추가하고 싶어.

프론트엔드에서 보내는 요청 형식:
{
  "action": "horoscope-reading",
  "zodiacId": "aries",
  "zodiacName": "양자리",
  "categoryId": "general",
  "categoryName": "종합운",
  "mbtiType": "INTJ",
  "mbtiContext": "전략적 사고, 장기 계획 수립, 독립적, 효율 중시",
  "date": "2026-03-09",
  "qualityHints": {
    "style": "premium",
    "minSentences": 3,
    "tone": "친근하고 따뜻한 점성술사가 1:1 상담하듯 구체적인 조언",
    "includeScore": true,
    "includeLucky": true,
    "connectToMBTI": true
  }
}

기대하는 응답 형식:
{
  "success": true,
  "reading": {
    "score": 82,
    "stars": 4,
    "summary": "오늘은 창의력이 빛나는 날...",
    "detail": "양자리의 화성 에너지가...",
    "advice": "오전 중에 중요한 결정을...",
    "lucky": {
      "color": "블루",
      "colorHex": "#3B82F6",
      "number": 7,
      "item": "커피",
      "time": "오후 2시",
      "direction": "동쪽"
    },
    "mbtiInsight": "INTJ의 전략적 사고력과 양자리의 추진력이 만나..."
  }
}

기존 tarot-reading 액션의 코드 패턴을 참고해서
horoscope-reading 핸들러 코드를 작성해줘.
Gemini API나 Claude API를 사용하는 것 같은데,
기존 코드 패턴에 맞춰서 프롬프트를 잘 만들어줘.
모든 응답은 한국어로.
```

---

## 5. Lambda Node.js 22.x 업그레이드

### 클로드에게 복사할 내용:

```
AWS Lambda 함수의 런타임을 Node.js 22.x로 업그레이드해야 해.
데드라인: 2026년 4월 30일

함수 정보:
- 함수 이름: mbti-toss-auth
- 리전: ap-northeast-2 (서울)
- 현재 런타임: Node.js 18.x 또는 20.x (확인 필요)

AWS 콘솔에서 Lambda 런타임을 Node.js 22.x로 변경하는 방법을 단계별로 알려줘.
주의할 점이나 호환성 문제가 있으면 같이 알려줘.
```

---

## 참고: 현재 프로젝트 상태

- TypeScript 에러: 0개
- 새 기능: 별자리 운세 (/horoscope), AI 딥 리포트 (/report)
- 라우트: /, /intro, /home, /survey, /result, /history, /alltypes, /compatibility, /tarot, /horoscope, /report, /admin
- 앱 URL: https://apps-in-toss.toss.im/app/ptt-s1
- Firebase 프로젝트: appintoss-ffb5f
- GA4 측정 ID: G-TMTV44QG6T
