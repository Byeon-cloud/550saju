"""
사주500 런칭 전 QA 체크리스트 v2 (2026-04-21)
전 surface × 전 상태 × 체크 포인트 커버
"""
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

OUT_PATH = "/sessions/blissful-gifted-hamilton/mnt/사주 500/사주500_런칭전_QA체크리스트_v2.xlsx"

# 공통 스타일
FONT_BASE = "Arial"
HEADER_FILL = PatternFill("solid", start_color="1A1A1A")
HEADER_FONT = Font(name=FONT_BASE, bold=True, color="FFFFFF", size=11)
P0_FILL = PatternFill("solid", start_color="FFD4D4")
P1_FILL = PatternFill("solid", start_color="FFF4D4")
P2_FILL = PatternFill("solid", start_color="E8F0E8")
DONE_FILL = PatternFill("solid", start_color="D4EAD4")
BORDER_THIN = Border(
    left=Side(style='thin', color='CCCCCC'),
    right=Side(style='thin', color='CCCCCC'),
    top=Side(style='thin', color='CCCCCC'),
    bottom=Side(style='thin', color='CCCCCC'),
)
ALIGN_WRAP = Alignment(wrap_text=True, vertical='top', horizontal='left')
ALIGN_CENTER = Alignment(horizontal='center', vertical='center')


def style_header(sheet, row=1):
    for cell in sheet[row]:
        cell.fill = HEADER_FILL
        cell.font = HEADER_FONT
        cell.alignment = ALIGN_CENTER
        cell.border = BORDER_THIN


def set_col_widths(sheet, widths):
    for i, w in enumerate(widths, start=1):
        sheet.column_dimensions[get_column_letter(i)].width = w


def apply_row_style(sheet, row_idx, priority=None, data_cols=8):
    fill = None
    if priority == "P0":
        fill = P0_FILL
    elif priority == "P1":
        fill = P1_FILL
    elif priority == "P2":
        fill = P2_FILL

    for col_idx in range(1, data_cols + 1):
        cell = sheet.cell(row=row_idx, column=col_idx)
        cell.font = Font(name=FONT_BASE, size=10)
        cell.alignment = ALIGN_WRAP
        cell.border = BORDER_THIN
        if fill and col_idx <= 2:  # priority column highlight
            cell.fill = fill


# ==============================================================
# 0. 개요 시트
# ==============================================================
wb = Workbook()
sheet = wb.active
sheet.title = "0_개요"

overview = [
    ["사주500 런칭 전 QA 체크리스트 v2", "", "", ""],
    ["작성일", "2026-04-21", "버전", "v2"],
    ["소유자", "Claude (Cowork)", "검증자", "준기 (물리 기기)"],
    ["대상", "앱인토스 미니앱 + 웹앱", "", ""],
    ["", "", "", ""],
    ["시트 구성", "", "", ""],
    ["탭", "제목", "항목수", "우선순위"],
    ["1_홈", "홈 10 섹션 × 14 포인트", "24", "P0"],
    ["2_결과_오늘의운세", "/daily/:id v2 전면", "32", "P0"],
    ["3_결과_꿈해몽", "/dream/:id v2", "28", "P0"],
    ["4_결과_주제별", "/topic/:slug/:id (5종)", "45", "P0"],
    ["5_결과_프리미엄", "/premium/:id v2 + PDF", "38", "P0"],
    ["6_로딩UX", "Tier A/B/C", "18", "P0"],
    ["7_보관함", "2탭 분리 + 삭제 정책", "16", "P0"],
    ["8_사주대화", "Guard 2-layer + UI", "22", "P1"],
    ["9_충전", "10운·3회·무료 설명", "14", "P1"],
    ["10_입력", "KR 시간 보정 + 양/음력", "18", "P1"],
    ["11_내정보", "앱인토스 축소 메뉴", "12", "P1"],
    ["12_이벤트", "STUB 8 시나리오", "22", "P1"],
    ["13_확장_대운흐름", "/daewoon/:id 신규", "18", "P1"],
    ["14_확장_월운", "/wolun/:id 신규 + 월갱신", "15", "P1"],
    ["15_확장_궁합", "/gunghap/:id 2인 입력", "20", "P1"],
    ["16_확장_토정비결", "/tojeong/:id 연간", "18", "P1"],
    ["17_데이터스키마", "사주정보 vs 이용기록", "16", "P0"],
    ["18_성능_접근성", "로딩 p50/p95 · WCAG AA", "20", "P2"],
    ["19_브랜드톤", "격식체·이모지·원화·AI 금지어", "24", "P0"],
    ["20_엣지케이스", "네트워크·빈화면·오류", "22", "P1"],
]

for row in overview:
    sheet.append(row)

style_header(sheet, row=1)
style_header(sheet, row=7)

for row_idx in range(2, 7):
    for col_idx in range(1, 5):
        cell = sheet.cell(row=row_idx, column=col_idx)
        cell.font = Font(name=FONT_BASE, size=11, bold=(col_idx == 1))
        cell.alignment = ALIGN_WRAP
        cell.border = BORDER_THIN

for row_idx in range(8, len(overview) + 1):
    priority = overview[row_idx - 1][3] if len(overview[row_idx - 1]) > 3 else None
    apply_row_style(sheet, row_idx, priority, data_cols=4)

set_col_widths(sheet, [22, 42, 10, 10])


# ==============================================================
# 공통: QA 시트 생성 함수
# ==============================================================
def make_qa_sheet(wb, title, rows):
    """
    rows: List[dict] with keys: section, item, criteria, method, expected, priority, status, note
    """
    sheet = wb.create_sheet(title)
    headers = ["# ", "섹션/Path", "체크 항목", "판정 기준", "검증 방법", "기대 결과", "우선순위", "상태", "비고"]
    sheet.append(headers)

    for i, r in enumerate(rows, start=1):
        sheet.append([
            i,
            r.get("section", ""),
            r.get("item", ""),
            r.get("criteria", ""),
            r.get("method", ""),
            r.get("expected", ""),
            r.get("priority", "P1"),
            r.get("status", "대기"),
            r.get("note", ""),
        ])

    style_header(sheet, row=1)
    for row_idx in range(2, len(rows) + 2):
        priority = rows[row_idx - 2].get("priority", "P1")
        apply_row_style(sheet, row_idx, priority, data_cols=9)
        # status 센터 정렬
        sheet.cell(row=row_idx, column=8).alignment = ALIGN_CENTER

    set_col_widths(sheet, [5, 22, 30, 28, 26, 24, 8, 8, 26])
    sheet.freeze_panes = "C2"
    return sheet


# ==============================================================
# 1. 홈 14 포인트
# ==============================================================
home_rows = [
    {"section": "홈 · 섹션 순서", "item": "10 섹션 순서 일치", "criteria": "BalanceBar → 오늘 → 꿈 → 프리미엄 → 500원 → 확장 → 대화 → 후기 → 철학 → 해시태그 → footer → TabBar", "method": "위→아래 스크롤 시 순서 확인", "expected": "모든 섹션 순서 일치", "priority": "P0"},
    {"section": "홈 · H1", "item": "카드 가치명 교체 8개", "criteria": "Track A §A1 전부 적용", "method": "각 카드 타이틀 텍스트 확인", "expected": "v3 기능명 0건", "priority": "P0"},
    {"section": "홈 · H2", "item": "카드 순서 재배치", "criteria": "무료→프리미엄→500원→확장→대화→후기", "method": "스크롤 순서", "expected": "듀얼 메인 구분 확인", "priority": "P0"},
    {"section": "홈 · H3", "item": "프리미엄 카드 가격→가치", "criteria": "라벨·타이틀·서브·구성요소·CTA 5요소", "method": "해당 카드 전체 확인", "expected": "원화 0건 · 목차 프리뷰 3줄", "priority": "P0"},
    {"section": "홈 · H4", "item": "후기 16건 연령별 어투", "criteria": "Track A §A9 카피 일치", "method": "캐러셀 전수 확인", "expected": "16건 모두 카피·메타 일치", "priority": "P0"},
    {"section": "홈 · H5", "item": "\"광고 거슬림\" 카피 제거", "criteria": "문자열 \"광고 거슬\" 0건", "method": "grep", "expected": "0건", "priority": "P0"},
    {"section": "홈 · H6", "item": "AI/GPT/챗 기술어 제거", "criteria": "문자열 \"AI\" \"GPT\" \"챗GPT\" \"모델\" 0건", "method": "grep", "expected": "0건", "priority": "P0"},
    {"section": "홈 · H7", "item": "이모지 0건", "criteria": "유니코드 이모지 범위 0건", "method": "regex grep", "expected": "0건", "priority": "P0"},
    {"section": "홈 · H8", "item": "원화 표기 0건", "criteria": "\"500원\" \"5000원\" \"10000원\" 홈에서 0건", "method": "grep HomePage + home/*", "expected": "0건 · /charge만 허용", "priority": "P0"},
    {"section": "홈 · H9", "item": "카운트다운 제거", "criteria": "LaunchCountdown 컴포넌트 미렌더", "method": "grep + 시각 확인", "expected": "홈에 카운트다운 없음", "priority": "P0"},
    {"section": "홈 · H10", "item": "\"왜 사주 500\" 철학 블록", "criteria": "Track A §A7 카피 · 세리프 · 베이지 그라디언트", "method": "[08] 섹션 확인", "expected": "블록 존재 · 서명 골드", "priority": "P0"},
    {"section": "홈 · H11", "item": "하단 디스클레이머 + 원전", "criteria": "Track A §A10 확정 문구", "method": "[10] footer 확인", "expected": "문구 일치 · 링크 3개", "priority": "P0"},
    {"section": "홈 · H12", "item": "해시태그 22개 충분", "criteria": "22개 태그 flex-wrap", "method": "[09] 섹션 확인", "expected": "22개 pill · 탭 가능", "priority": "P0"},
    {"section": "홈 · H13", "item": "? FAB z-index", "criteria": "스크롤 시 FAB 고정 · 가려짐 없음", "method": "스크롤 + safe-area 확인", "expected": "TabBar 위 · 우하단 고정", "priority": "P0"},
    {"section": "홈 · H14", "item": "TabBar 5탭 골드 통일", "criteria": "활성=ink · 비활성=gray-500 · 중앙 사주대화 원형", "method": "5탭 각각 탭", "expected": "색·위치 일치", "priority": "P0"},
    {"section": "홈 · 반응형", "item": "360px ~ 428px 스크린", "criteria": "모든 섹션 레이아웃 정상", "method": "DevTools 3폭 테스트", "expected": "오버플로우 0건", "priority": "P0"},
    {"section": "홈 · [01] Hero Daily", "item": "탭 → /daily/:profileId", "criteria": "active profile 자동 선택", "method": "카드 탭", "expected": "결과 페이지 진입", "priority": "P0"},
    {"section": "홈 · [02] Hero Dream", "item": "탭 → /dream/new", "criteria": "입력 페이지 진입", "method": "카드 탭", "expected": "입력 페이지 표시", "priority": "P0"},
    {"section": "홈 · [03] 프리미엄", "item": "탭 → 결제 or 입력", "criteria": "로그인·사주 조건 분기", "method": "카드 탭", "expected": "올바른 페이지", "priority": "P0"},
    {"section": "홈 · [04] 5주제", "item": "가로 스크롤 + 스냅", "criteria": "scroll-snap-type 작동", "method": "가로 스와이프", "expected": "카드 단위 스냅", "priority": "P0"},
    {"section": "홈 · [05] 4확장", "item": "2열 그리드 · 운 표기", "criteria": "4카드 · 2열 · 각 운 pill", "method": "시각 + 탭", "expected": "카드 4개 · 진입 OK", "priority": "P0"},
    {"section": "홈 · [06] 대화 카드", "item": "\"귀인\" 단어 · 탭 → /chat", "criteria": "AI 단어 0건 · 경로 정확", "method": "카드 탭", "expected": "/chat 진입", "priority": "P0"},
    {"section": "홈 · [07] 후기", "item": "우→좌 자동 · 터치 정지", "criteria": "40s linear · touchstart paused", "method": "터치하고 떼기", "expected": "정지 → 재개", "priority": "P0"},
    {"section": "홈 · [09] 해시태그", "item": "탭 시 결과/검색", "criteria": "각 태그 링크 동작", "method": "3개 랜덤 탭", "expected": "해당 페이지 이동", "priority": "P1"},
]
make_qa_sheet(wb, "1_홈", home_rows)


# ==============================================================
# 2. 오늘의 운세 결과 페이지
# ==============================================================
daily_rows = [
    {"section": "/daily · 진입", "item": "홈 Hero Daily 탭 시 진입", "criteria": "profileId 자동 활성화", "method": "홈 탭 → URL 확인", "expected": "/daily/:id · id=active", "priority": "P0"},
    {"section": "/daily · 로딩", "item": "Tier C 풀스크린 로딩", "criteria": "spinner 아님 · 한자 카드 + 진행 메시지", "method": "Network throttle 확인", "expected": "FullscreenLoading 렌더", "priority": "P0"},
    {"section": "/daily · 원국 첫 화면", "item": "ResultHeader에 원국 4주 표시", "criteria": "연주·월주·일주·시주 한자 + 일간 강조", "method": "상단 뱃지/카드 확인", "expected": "4주 + 일간 丙火 형태", "priority": "P0"},
    {"section": "/daily · 카드 플립 제거", "item": "카드 뒤집기 애니 없음", "criteria": "flip / rotate3d 0건", "method": "grep + 시각", "expected": "바로 결과 표시", "priority": "P0"},
    {"section": "/daily · L1 요약", "item": "600자 · 1문단 · 한자 심볼 1개", "criteria": "글자수 ±60 · 상단 한자", "method": "본문 확인", "expected": "600 ± 60자", "priority": "P0"},
    {"section": "/daily · L2 본문", "item": "1200자 · 3~4 소제목", "criteria": "글자수 ±120", "method": "본문 확인", "expected": "1200 ± 120자", "priority": "P0"},
    {"section": "/daily · L3 심층", "item": "1400자 · 차트 1개", "criteria": "Recharts 존재", "method": "차트 렌더 확인", "expected": "차트 + 해설", "priority": "P0"},
    {"section": "/daily · L4 액션", "item": "400자 · 체크리스트 3", "criteria": "✓ 3~4개 + 오늘의 한 줄", "method": "본문 확인", "expected": "체크리스트 완비", "priority": "P0"},
    {"section": "/daily · 블러", "item": "무료 결과 L3~L4 블러", "criteria": "blur(6px) + LockOverlay", "method": "스크롤 · 시각", "expected": "L3부터 블러 + 오버레이", "priority": "P0"},
    {"section": "/daily · 오버레이", "item": "Lock 아이콘·카피·CTA 2개", "criteria": "\"10운으로 해제\" + \"한 주제만 먼저\"", "method": "오버레이 시각", "expected": "요소 3종", "priority": "P0"},
    {"section": "/daily · PaywallBar", "item": "L2 끝 닿을 때 sticky slide-up", "criteria": "\"더 깊게 · 열어보기\"", "method": "스크롤 300ms", "expected": "등장 · 결제 시 사라짐", "priority": "P0"},
    {"section": "/daily · Actions", "item": "공유·저장·대화 3버튼", "criteria": "각 버튼 동작", "method": "3버튼 각각 탭", "expected": "바텀시트·캡쳐·대화 진입", "priority": "P0"},
    {"section": "/daily · 공유", "item": "카카오·링크·이미지 바텀시트", "criteria": "3 옵션 모두 노출", "method": "공유 버튼 탭", "expected": "3 옵션 표시", "priority": "P0"},
    {"section": "/daily · 저장", "item": "캡처 영역 Header+L1+L2 (무료)", "criteria": "광고·업셀·TabBar 제외", "method": "저장 버튼 → 이미지 확인", "expected": "캡처 범위 정확", "priority": "P0"},
    {"section": "/daily · UpsellCard", "item": "유료 결과에만 1개", "criteria": "무료에선 렌더 X", "method": "무료/유료 각각 확인", "expected": "조건부 렌더 OK", "priority": "P0"},
    {"section": "/daily · AdBanner", "item": "무료에만 표시", "criteria": "adEligible prop 정확", "method": "무료/유료 각각 확인", "expected": "무료만 광고", "priority": "P0"},
    {"section": "/daily · Footer", "item": "\"공유하고 1운 받기\" 기본", "criteria": "footer actions 통일", "method": "footer 확인", "expected": "공유 CTA 존재", "priority": "P0"},
    {"section": "/daily · 일일 할당", "item": "본인 사주 1일 1회 무료", "criteria": "2회째 진입 시 운 차감 안내", "method": "같은 프로필 재진입", "expected": "2회째 캐시 or 1운 안내", "priority": "P0"},
    {"section": "/daily · 타인 사주", "item": "다른 profileId 진입 시 운 소비", "criteria": "1운 차감 확인", "method": "친구 프로필로 진입", "expected": "1운 차감 확인 모달", "priority": "P0"},
    {"section": "/daily · 톤", "item": "격식체 비중 50% 이상", "criteria": "~입니다/~습니다 비중", "method": "10문장 샘플", "expected": "5/10 이상 격식", "priority": "P0"},
    {"section": "/daily · 한자", "item": "상단 심볼 1개 외 본문 한자 ≤4자", "criteria": "본문 반복 금지", "method": "[一-龥] grep", "expected": "심볼 제외 4자 이하", "priority": "P0"},
    {"section": "/daily · 신살", "item": "천을귀인·도화살 등 자연스러움", "criteria": "정의 풀이 아닌 해석", "method": "본문 샘플", "expected": "사전식 X · 해석 O", "priority": "P1"},
    {"section": "/daily · 원전 인용", "item": "적천수 등 1회만 · 정책 확정 후", "criteria": "2~3개 + 등 or 완전 삭제", "method": "본문 grep \"적천수\"", "expected": "정책 일관 적용", "priority": "P1"},
    {"section": "/daily · 일간 색", "item": "헤더 그라디언트 = 오늘 일간 오행", "criteria": "KST 00:00 기준 일간", "method": "만세력 대조", "expected": "오행 색 정확", "priority": "P1"},
    {"section": "/daily · 브랜드 골드", "item": "#B8965A 사용 · 머스타드 #b8941f 0건", "criteria": "CSS grep", "method": "grep #b8941f", "expected": "머스타드 0건", "priority": "P0"},
    {"section": "/daily · 에러", "item": "API 실패 시 안내 + 운 미차감", "criteria": "consumed=0 보장 · 회피 토스트", "method": "Network 차단 테스트", "expected": "운 차감 없음", "priority": "P0"},
    {"section": "/daily · 재진입", "item": "같은 날 재열람 무료", "criteria": "캐시 결과 반환", "method": "뒤로가기 후 재진입", "expected": "즉시 표시 · 운 차감 X", "priority": "P0"},
    {"section": "/daily · 광고 정책", "item": "앱인토스 배너 유닛 ID 올바름", "criteria": "reference_appintos_ids 일치", "method": "코드 grep", "expected": "ID 일치", "priority": "P0"},
    {"section": "/daily · 접근성", "item": "탭 타깃 44×44 · 대비 AA", "criteria": "WCAG 2.1 AA", "method": "Lighthouse", "expected": "AA 통과", "priority": "P1"},
    {"section": "/daily · 해시태그 진입", "item": "홈 #오늘의운세 태그 탭 → /daily", "criteria": "동일 경로", "method": "해시태그 탭", "expected": "진입 성공", "priority": "P1"},
    {"section": "/daily · 저장 파일명", "item": "saju500-daily-{name}-{date}.png", "criteria": "파일명 규칙", "method": "저장 후 파일 확인", "expected": "명명 규칙 일치", "priority": "P2"},
    {"section": "/daily · SVG 매핑", "item": "오행·신살 SVG 사전 라이브러리 연결", "criteria": "실시간 이미지 생성 X", "method": "코드 확인", "expected": "50~100 SVG 또는 fallback", "priority": "P1"},
]
make_qa_sheet(wb, "2_결과_오늘의운세", daily_rows)


# ==============================================================
# 3. 꿈해몽 결과
# ==============================================================
dream_rows = [
    {"section": "/dream · 진입 (free)", "item": "홈 Hero Dream 탭 시 입력 화면", "criteria": "/dream/new 또는 /dream/:id?mode=free", "method": "홈 [02] 탭", "expected": "입력 폼 표시", "priority": "P0"},
    {"section": "/dream · 입력", "item": "꿈 내용 입력 필드", "criteria": "자유 서술 50~500자 제한", "method": "입력 시도", "expected": "글자수 카운터 표시", "priority": "P0"},
    {"section": "/dream · 로딩", "item": "Tier C 풀스크린", "criteria": "한자 카드 · 진행 메시지", "method": "제출 → 로딩", "expected": "Tier C 렌더", "priority": "P0"},
    {"section": "/dream · SVG 매핑", "item": "꿈 키워드 → SVG 아이콘", "criteria": "50~100개 사전 라이브러리", "method": "여러 키워드 테스트", "expected": "매칭되는 SVG 표시", "priority": "P0"},
    {"section": "/dream · fallback", "item": "매칭 안 될 때 한자 카드", "criteria": "夢 한자 fallback", "method": "희귀 키워드 테스트", "expected": "한자카드 렌더", "priority": "P0"},
    {"section": "/dream · 무료 해석", "item": "기본 해석 L1~L2 무료", "criteria": "분량 1800자 내외", "method": "결과 확인", "expected": "무료 해석 완전 표시", "priority": "P0"},
    {"section": "/dream · 유료 전환", "item": "사주 연계 유료 풀이 CTA", "criteria": "1운 · PaywallBar", "method": "스크롤 하단", "expected": "CTA 노출", "priority": "P0"},
    {"section": "/dream · 유료 결과", "item": "사주 연계 심층 L3~L4", "criteria": "본인 사주 + 꿈 결합", "method": "결제 후 확인", "expected": "L1~L4 전체 해제", "priority": "P0"},
    {"section": "/dream · 잠금 티저 연속성", "item": "무료 티저 = 유료 일부", "criteria": "결제 후 동일 목차 이어짐", "method": "무료·유료 비교", "expected": "티저 연속", "priority": "P0"},
    {"section": "/dream · 보관", "item": "자동 resultHistory 저장", "criteria": "profileId + contentType=dream", "method": "Firestore 확인", "expected": "기록 생성", "priority": "P0"},
    {"section": "/dream · 재방문", "item": "/dream/:id 재진입", "criteria": "캐시 결과", "method": "URL 직접 진입", "expected": "즉시 표시", "priority": "P1"},
    {"section": "/dream · Actions", "item": "공유·저장·대화", "criteria": "3버튼", "method": "각각 탭", "expected": "정상 동작", "priority": "P0"},
    {"section": "/dream · 저장 영역", "item": "꿈 서술 + 해석 전체", "criteria": "입력 + 결과 포함", "method": "저장 이미지 확인", "expected": "전체 캡처", "priority": "P1"},
    {"section": "/dream · 로그인 없이", "item": "사주 등록 없이 무료 가능", "criteria": "guest 경로", "method": "로그아웃 후 진입", "expected": "무료 이용 가능", "priority": "P0"},
    {"section": "/dream · 광고", "item": "무료 결과에만", "criteria": "유료 전환 후 0건", "method": "유료 결과 확인", "expected": "광고 X", "priority": "P0"},
    {"section": "/dream · 브랜드 톤", "item": "격식 50%+ · AI 언급 0", "criteria": "grep", "method": "본문 샘플", "expected": "톤 준수", "priority": "P0"},
    {"section": "/dream · 업셀", "item": "프리미엄 10운 CTA", "criteria": "\"꿈 패턴의 뿌리, 사주로 더 깊게\"", "method": "하단 업셀 카드", "expected": "문구 일치", "priority": "P0"},
    {"section": "/dream · 원전", "item": "꿈 관련 원전 인용 정책", "criteria": "정책 확정 적용", "method": "본문 확인", "expected": "일관된 정책", "priority": "P1"},
    {"section": "/dream · 오류", "item": "꿈 입력 너무 짧을 때", "criteria": "인라인 에러 · 제출 차단", "method": "10자 이하 입력", "expected": "에러 표시", "priority": "P1"},
    {"section": "/dream · 길이 제한", "item": "500자 초과 시 잘림 안내", "criteria": "카운터 빨강", "method": "600자 입력", "expected": "제한 안내", "priority": "P1"},
    {"section": "/dream · 로그", "item": "generateDreamInterpretation 정상 호출", "criteria": "401·429·500 없음", "method": "functions:log", "expected": "에러 없음", "priority": "P0"},
    {"section": "/dream · 응답 시간", "item": "p50 < 15s · p95 < 30s", "criteria": "로딩 Tier C UX로 완충", "method": "10회 측정", "expected": "성능 목표 달성", "priority": "P1"},
    {"section": "/dream · responseSchema", "item": "Layer 2 schema 검증 통과", "criteria": "dream 특화 스키마", "method": "파싱 확인", "expected": "validation pass", "priority": "P0"},
    {"section": "/dream · Guard", "item": "위험·자살 키워드 Layer 1 컷", "criteria": "정규식 FP 최소", "method": "경계 사례 5건", "expected": "정상 문장 통과", "priority": "P0"},
    {"section": "/dream · 캐러셀", "item": "SVG 매핑 변화시 전환 부드러움", "criteria": "fade 400ms", "method": "다양한 키워드", "expected": "깜빡임 없음", "priority": "P2"},
    {"section": "/dream · 한자 카드", "item": "fallback 폰트 · 렌더 정상", "criteria": "Noto Serif KR", "method": "시각 확인", "expected": "한자 렌더 OK", "priority": "P1"},
    {"section": "/dream · 접근성", "item": "입력 폼 aria-label", "criteria": "스크린 리더", "method": "VoiceOver", "expected": "라벨 읽힘", "priority": "P2"},
    {"section": "/dream · 프리뷰", "item": "결제 전 유료 풀이 목차 3줄", "criteria": "잠금 티저 연속성", "method": "무료 결과 스크롤", "expected": "목차 프리뷰", "priority": "P1"},
]
make_qa_sheet(wb, "3_결과_꿈해몽", dream_rows)


# ==============================================================
# 4. 주제별 5종
# ==============================================================
topic_common = [
    ("love", "연애운", "桃"),
    ("wealth", "재물운", "財"),
    ("job", "직업운", "官"),
    ("health", "건강운", "壽"),
    ("study", "공부운", "印"),
]
topic_rows = []
for slug, name, hanja in topic_common:
    topic_rows.extend([
        {"section": f"/topic/{slug}", "item": "진입 · ResultHeader 렌더", "criteria": f"한자 {hanja} · 그라디언트 일치", "method": "홈 [04] → 각 카드 탭", "expected": "헤더 정확", "priority": "P0"},
        {"section": f"/topic/{slug}", "item": "L1 600자 · 한자 심볼", "criteria": "분량 ±60자", "method": "본문 확인", "expected": "분량 일치", "priority": "P0"},
        {"section": f"/topic/{slug}", "item": "L2 1200자 · 소제목 4개", "criteria": "주제별 소제목 템플릿 일치", "method": "본문 확인", "expected": "소제목 4개", "priority": "P0"},
        {"section": f"/topic/{slug}", "item": "L3 1400자 · Recharts 1개", "criteria": "주제별 차트 유형 일치", "method": "차트 렌더", "expected": "차트 + 해설", "priority": "P0"},
        {"section": f"/topic/{slug}", "item": "L4 400자 · 체크리스트 3 + 한 줄", "criteria": "체크 구체 행동 + 격언", "method": "하단 확인", "expected": "완비", "priority": "P0"},
        {"section": f"/topic/{slug}", "item": "1운 차감 · rewardClaims 기록", "criteria": "purchase type · 1", "method": "Firestore 확인", "expected": "기록 생성", "priority": "P0"},
        {"section": f"/topic/{slug}", "item": "재열람 무료", "criteria": "캐시 결과 반환", "method": "뒤로·재진입", "expected": "운 차감 X", "priority": "P0"},
        {"section": f"/topic/{slug}", "item": "업셀 프리미엄 10운", "criteria": "\"사주 전체도 볼래요?\"", "method": "하단 확인", "expected": "업셀 존재", "priority": "P0"},
        {"section": f"/topic/{slug}", "item": "광고 X (유료)", "criteria": "AdBanner 미렌더", "method": "시각", "expected": "광고 0", "priority": "P0"},
    ])
# 추가 통일성 체크
topic_rows.append({"section": "/topic · 5종 통일", "item": "5페이지 구조·리듬 동일", "criteria": "L1→L2→L3→L4 순회 시 인지 일치", "method": "5페이지 순회", "expected": "통일성 OK", "priority": "P0"})
topic_rows.append({"section": "/topic · 5종 통일", "item": "헤더 그라디언트 5색 이질감 X", "criteria": "색 팔레트 일관", "method": "시각 비교", "expected": "조화", "priority": "P1"})
make_qa_sheet(wb, "4_결과_주제별", topic_rows)


# ==============================================================
# 5. 프리미엄 종합
# ==============================================================
premium_rows = [
    {"section": "/premium · 진입", "item": "홈 [03] 탭 → 결제 플로우 or 결과", "criteria": "권한 분기 정확", "method": "비구매·구매 각각", "expected": "올바른 라우팅", "priority": "P0"},
    {"section": "/premium · 로딩", "item": "Tier C 풀스크린 · 30초 허용", "criteria": "한자 · 진행 메시지 5단계", "method": "실제 생성 관측", "expected": "Tier C 렌더", "priority": "P0"},
    {"section": "/premium · L1", "item": "전체 요약 800~1000자", "criteria": "핵심 키워드 3개", "method": "본문", "expected": "요약 정확", "priority": "P0"},
    {"section": "/premium · L2", "item": "10대 주제 섹션 각 1000자", "criteria": "총 10000자 · 10섹션", "method": "본문", "expected": "분량 일치", "priority": "P0"},
    {"section": "/premium · L3", "item": "원전·격국·용신 심층", "criteria": "2~3 인용 + \"등\" or 삭제", "method": "본문 grep", "expected": "정책 일관", "priority": "P0"},
    {"section": "/premium · L4", "item": "올해 5 축 + 연간 한 줄", "criteria": "체크리스트 + 인용구", "method": "하단", "expected": "완비", "priority": "P0"},
    {"section": "/premium · 5 주제 통합", "item": "연애·재물·직업·건강·공부 전부 포함", "criteria": "5 섹션 각 1000자", "method": "본문 섹션 확인", "expected": "5 섹션 모두", "priority": "P0"},
    {"section": "/premium · 4 확장 통합", "item": "대운·월운·궁합·토정비결 포함 (Sprint 3 후)", "criteria": "각 섹션 분리", "method": "본문 섹션", "expected": "Sprint 3 후 OK", "priority": "P1"},
    {"section": "/premium · PDF 저장", "item": "서버 Puppeteer · Storage 업로드", "criteria": "generatePremiumPDF 호출", "method": "PDF 버튼 탭", "expected": "다운로드 링크", "priority": "P0"},
    {"section": "/premium · PDF 내용", "item": "전체 결과 담김 · 이미지 아님", "criteria": "선택 가능 텍스트", "method": "PDF 열어 확인", "expected": "텍스트 복사 OK", "priority": "P0"},
    {"section": "/premium · PDF footer", "item": "디스클레이머 + 원전 fine-print", "criteria": "Track A §A10 동일", "method": "PDF 마지막", "expected": "문구 존재", "priority": "P0"},
    {"section": "/premium · Footer 통일", "item": "\"PDF 파일 저장\" 추가 · 공유도 유지", "criteria": "메모리 project_result_page_footer", "method": "footer 확인", "expected": "2 액션", "priority": "P0"},
    {"section": "/premium · 업셀", "item": "사주대화 권유 1개만", "criteria": "과잉 없음", "method": "하단", "expected": "1개", "priority": "P0"},
    {"section": "/premium · 광고 X", "item": "AdBanner 0건", "criteria": "유료", "method": "시각", "expected": "광고 0", "priority": "P0"},
    {"section": "/premium · 블러 X", "item": "L1~L4 전부 해제", "criteria": "locked=false", "method": "스크롤", "expected": "블러 0건", "priority": "P0"},
    {"section": "/premium · 재열람", "item": "같은 월 재열람 무료", "criteria": "캐시 또는 동일 premiumId", "method": "재진입", "expected": "운 차감 X", "priority": "P0"},
    {"section": "/premium · 월 갱신", "item": "다음 달 재생성 유도", "criteria": "\"이달의 깊이\" 컨셉", "method": "월 바뀐 후 진입", "expected": "새 갱신 안내", "priority": "P1"},
    {"section": "/premium · 성능", "item": "p50 < 25s · p95 < 45s", "criteria": "Opus/Sonnet 실측", "method": "10회 측정", "expected": "목표 달성", "priority": "P1"},
    {"section": "/premium · 톤", "item": "격식체 70%+", "criteria": "프리미엄 높은 격식", "method": "20문장 샘플", "expected": "14/20 이상", "priority": "P0"},
    {"section": "/premium · 목차 프리뷰", "item": "결제 전 홈 카드에 목차 3줄", "criteria": "연속성", "method": "홈 [03] 확인", "expected": "목차 일치", "priority": "P0"},
    {"section": "/premium · 결제 플로우", "item": "10운 소비 · 토스페이 단순화", "criteria": "PC_PATCH_A 반영", "method": "결제 시도", "expected": "단순화 반영", "priority": "P0"},
    {"section": "/premium · 에러", "item": "생성 실패 시 운 미차감", "criteria": "consumed=0 보장", "method": "강제 실패", "expected": "환원 보장", "priority": "P0"},
    {"section": "/premium · PDF 파일명", "item": "saju500-premium-{name}-{YYYYMM}.pdf", "criteria": "명명 규칙", "method": "다운로드 확인", "expected": "일치", "priority": "P2"},
    {"section": "/premium · 차트", "item": "오행·십성 차트 각 섹션 적절", "criteria": "섹션당 최대 1개 차트", "method": "시각", "expected": "차트 적정", "priority": "P1"},
    {"section": "/premium · 전문성", "item": "격국·용신 정확한 풀이", "criteria": "자평진전·적천수 기반", "method": "본문 10건 샘플", "expected": "오류 0건", "priority": "P0"},
    {"section": "/premium · 신살", "item": "천을귀인·화개살 등 자연스러움", "criteria": "사전식 X", "method": "본문", "expected": "해석 중심", "priority": "P1"},
    {"section": "/premium · 브랜드 골드", "item": "#B8965A · 머스타드 0건", "criteria": "CSS", "method": "grep", "expected": "일치", "priority": "P0"},
    {"section": "/premium · PDF 로딩", "item": "PDF 생성 중 진행 안내", "criteria": "버튼 disabled + spinner", "method": "PDF 탭", "expected": "중복 방지", "priority": "P1"},
    {"section": "/premium · PDF 재다운로드", "item": "기존 PDF 재다운 무료", "criteria": "Storage 링크 유지", "method": "재진입 후 PDF", "expected": "즉시 다운로드", "priority": "P1"},
    {"section": "/premium · 공유", "item": "링크 공유 시 일부 프리뷰", "criteria": "프라이버시 고려", "method": "공유 링크 확인", "expected": "프리뷰 제한", "priority": "P1"},
    {"section": "/premium · 모델", "item": "Opus 10운만 · Gemini 전량 퇴출", "criteria": "model=claude-opus-4-5 or 4-6", "method": "코드 확인", "expected": "모델 일치", "priority": "P0"},
    {"section": "/premium · 응답 검증", "item": "responseSchema 10섹션 스키마 pass", "criteria": "Layer 2 Guard", "method": "로그 확인", "expected": "validation 0 실패", "priority": "P0"},
    {"section": "/premium · 분량 실측", "item": "실제 10000자 ±10%", "criteria": "character.count", "method": "결과 5건 측정", "expected": "9000~11000자", "priority": "P1"},
    {"section": "/premium · 유닛이코노믹스", "item": "Opus 마진 3원 수준", "criteria": "memory project_unit_economics", "method": "10회 평균 비용", "expected": "마진 유지", "priority": "P1"},
    {"section": "/premium · 모바일 PDF", "item": "아이폰·안드로이드 PDF 뷰어", "criteria": "공유 시트 PDF OK", "method": "실기기 2종", "expected": "뷰어 정상", "priority": "P1"},
    {"section": "/premium · 색 일관성", "item": "헤더 짙은 ink + 금박 악센트", "criteria": "03 결과 스펙 일치", "method": "시각", "expected": "프리미엄 느낌", "priority": "P1"},
    {"section": "/premium · 공유 리워드", "item": "공유 시 1운 적립", "criteria": "공유 1일 3회 · 3운", "method": "공유 후 확인", "expected": "운 증가", "priority": "P1"},
    {"section": "/premium · 환불", "item": "환불 정책 링크 · 유료 결과 숨김 처리", "criteria": "숨김 O · 삭제 X (이용 기록)", "method": "환불 플로우 테스트", "expected": "정책 반영", "priority": "P1"},
]
make_qa_sheet(wb, "5_결과_프리미엄", premium_rows)


# ==============================================================
# 6. 로딩 UX
# ==============================================================
loading_rows = [
    {"section": "Tier A · Skeleton", "item": "홈 카드 탭 시 즉시 스켈레톤", "criteria": "0.5~1s", "method": "홈 탭 관측", "expected": "스켈레톤 노출", "priority": "P0"},
    {"section": "Tier A", "item": "shimmer 금지", "criteria": "정적 회색", "method": "시각", "expected": "애니 없음", "priority": "P0"},
    {"section": "Tier B · Streaming", "item": "스트리밍 텍스트 표시", "criteria": "점진 렌더", "method": "결과 생성 중", "expected": "글자 흐름", "priority": "P1"},
    {"section": "Tier B", "item": "부분 결과 스크롤 가능", "criteria": "L1 끝나면 스크롤 OK", "method": "스크롤 시도", "expected": "반응", "priority": "P1"},
    {"section": "Tier C · Fullscreen", "item": "풀스크린 오버레이", "criteria": "paper 배경", "method": "결과 생성 시", "expected": "전면 표시", "priority": "P0"},
    {"section": "Tier C", "item": "한자 카드 회전 8s", "criteria": "CSS keyframes", "method": "시각 8초 이상", "expected": "느린 회전", "priority": "P0"},
    {"section": "Tier C", "item": "진행 메시지 5단계 순환", "criteria": "6초마다 교체", "method": "30초 관측", "expected": "5개 순환", "priority": "P0"},
    {"section": "Tier C", "item": "spinner 제거", "criteria": "구버전 spinner 0건", "method": "grep + 시각", "expected": "spinner 없음", "priority": "P0"},
    {"section": "Tier C", "item": "\"정성껏 풀어드립니다\" 카피", "criteria": "하단 Body-sm", "method": "본문", "expected": "카피 존재", "priority": "P1"},
    {"section": "Tier C", "item": "진행 도트 3~5개", "criteria": "현재 섹션 ink · 나머지 회색", "method": "시각", "expected": "도트 정확", "priority": "P1"},
    {"section": "Tier C", "item": "최대 지속 30초 · 그 후 안내", "criteria": "타임아웃 UX", "method": "강제 지연", "expected": "안내 표시", "priority": "P1"},
    {"section": "Tier C · 네트워크 오류", "item": "실패 시 \"다시 시도\" CTA", "criteria": "운 미차감 안내", "method": "Network 차단", "expected": "CTA + 보장 안내", "priority": "P0"},
    {"section": "Tier C · 뒤로가기", "item": "진행 중 뒤로가기 시 cancel", "criteria": "Firestore 문서 cleanup", "method": "뒤로 탭", "expected": "중단 처리", "priority": "P1"},
    {"section": "Tier C · prompt cache", "item": "2회째 생성 시 캐시 활용", "criteria": "Anthropic prompt cache", "method": "로그 확인", "expected": "cache hit", "priority": "P2"},
    {"section": "Tier C · keep-alive", "item": "연결 유지로 cold start 감소", "criteria": "minInstances=1", "method": "firebase 설정", "expected": "유지 확인", "priority": "P1"},
    {"section": "Tier C · 병렬", "item": "가능한 부분 병렬 생성", "criteria": "섹션별 병렬 호출", "method": "코드 확인", "expected": "Promise.all", "priority": "P2"},
    {"section": "Tier C · 모바일", "item": "360px·428px 레이아웃", "criteria": "중앙 정렬 유지", "method": "DevTools", "expected": "레이아웃 OK", "priority": "P1"},
    {"section": "Tier C · 접근성", "item": "aria-live polite 안내", "criteria": "스크린리더", "method": "VoiceOver", "expected": "읽힘", "priority": "P2"},
]
make_qa_sheet(wb, "6_로딩UX", loading_rows)


# ==============================================================
# 7. 보관함
# ==============================================================
storage_rows = [
    {"section": "보관함 · 진입", "item": "TabBar 보관함 탭 → /storage", "criteria": "4번째 탭", "method": "TabBar", "expected": "진입 OK", "priority": "P0"},
    {"section": "보관함 · 2탭", "item": "사주 정보 / 이용 기록", "criteria": "상단 Top tab", "method": "시각", "expected": "2탭 노출", "priority": "P0"},
    {"section": "보관함 · 사주 정보", "item": "sajuProfiles 리스트", "criteria": "profile 카드 N개", "method": "Firestore 일치", "expected": "카드 렌더", "priority": "P0"},
    {"section": "보관함 · 사주 삭제", "item": "삭제 확인 모달", "criteria": "\"지난 해석은 보관함에 남아요\"", "method": "삭제 탭", "expected": "모달 문구", "priority": "P0"},
    {"section": "보관함 · 사주 삭제 후", "item": "resultHistory 유지", "criteria": "삭제된 profileId의 결과 노출", "method": "삭제 후 이용 기록 탭", "expected": "결과 표시", "priority": "P0"},
    {"section": "보관함 · 사주 추가", "item": "\"+ 새 사주 추가\"", "criteria": "/input 진입", "method": "+ 탭", "expected": "입력 페이지", "priority": "P0"},
    {"section": "보관함 · 사주 수정", "item": "이름·메모 수정", "criteria": "편집 UI", "method": "편집 버튼", "expected": "수정 가능", "priority": "P1"},
    {"section": "보관함 · 이용 기록", "item": "resultHistory 리스트", "criteria": "날짜별 그룹", "method": "탭 2", "expected": "그룹별 렌더", "priority": "P0"},
    {"section": "보관함 · 이용 기록 그룹", "item": "오늘/이번주/이번달/그 전", "criteria": "4 그룹", "method": "시각", "expected": "4 그룹 OK", "priority": "P0"},
    {"section": "보관함 · 재열람", "item": "결과 카드 탭 → 해당 결과", "criteria": "/daily, /topic, /premium 재진입", "method": "카드 탭", "expected": "결과 표시", "priority": "P0"},
    {"section": "보관함 · 재열람 비용", "item": "운 차감 X", "criteria": "캐시 결과", "method": "재열람 시도", "expected": "0 차감", "priority": "P0"},
    {"section": "보관함 · 숨기기", "item": "결과 숨기기 (삭제 X)", "criteria": "hidden 토글", "method": "롱프레스 or 메뉴", "expected": "숨김 처리", "priority": "P1"},
    {"section": "보관함 · 이용 기록 삭제 X", "item": "삭제 버튼 없음", "criteria": "숨기기만 존재", "method": "UI 확인", "expected": "삭제 UI 없음", "priority": "P0"},
    {"section": "보관함 · Empty", "item": "빈 상태 그래픽 + CTA", "criteria": "\"+ 새 사주 추가\"", "method": "신규 계정", "expected": "빈 상태 UI", "priority": "P1"},
    {"section": "보관함 · 정렬", "item": "최근 생성 순", "criteria": "createdAt desc", "method": "시각", "expected": "정렬 확인", "priority": "P1"},
    {"section": "보관함 · 친구·가족 재사용", "item": "다른 사람 사주 재열람 정책", "criteria": "재사용 정책 확정 후", "method": "정책 확정 후 확인", "expected": "정책 일관", "priority": "P1"},
]
make_qa_sheet(wb, "7_보관함", storage_rows)


# ==============================================================
# 8. 사주대화
# ==============================================================
chat_rows = [
    {"section": "/chat · 진입", "item": "TabBar 중앙 원형 · 홈 [06]", "criteria": "/chat?profileId=active", "method": "중앙 버튼", "expected": "진입 OK", "priority": "P0"},
    {"section": "/chat · 모델", "item": "Sonnet 4.6 (2026-04-21 재할당)", "criteria": "model string", "method": "코드 grep", "expected": "sonnet-4-6", "priority": "P0"},
    {"section": "/chat · Gemini 퇴출", "item": "Gemini 호출 0건", "criteria": "grep \"gemini\"", "method": "코드", "expected": "0건", "priority": "P0"},
    {"section": "/chat · Guard Layer 1", "item": "키워드 정규식 컷", "criteria": "18/18 PASS 유지", "method": "경계 사례 테스트", "expected": "FP 최소", "priority": "P0"},
    {"section": "/chat · Guard Layer 2", "item": "responseSchema 검증", "criteria": "schema 준수", "method": "로그", "expected": "validation OK", "priority": "P0"},
    {"section": "/chat · 대화권", "item": "1운 = 3대화권", "criteria": "운 환율 일치", "method": "대화 시도", "expected": "환율 정확", "priority": "P0"},
    {"section": "/chat · UI 교체", "item": "v2 목업 반영", "criteria": "사주500_UI개편_목업_사주대화.html 일치", "method": "시각 비교", "expected": "픽셀 근접", "priority": "P1"},
    {"section": "/chat · \"귀인\" 톤", "item": "AI 언급 0건 · 귀인 어투", "criteria": "grep AI", "method": "화면·응답", "expected": "0건", "priority": "P0"},
    {"section": "/chat · 컨텍스트", "item": "결과 페이지에서 진입 시 컨텍스트 전달", "criteria": "context=result", "method": "결과 하단 대화 버튼", "expected": "문맥 이어짐", "priority": "P1"},
    {"section": "/chat · 프로필 선택", "item": "multi-profile 지원", "criteria": "profileId 스위치", "method": "다른 프로필", "expected": "정확 전환", "priority": "P1"},
    {"section": "/chat · 대화 기록", "item": "세션별 저장", "criteria": "users/{uid}/chats", "method": "Firestore", "expected": "기록 생성", "priority": "P1"},
    {"section": "/chat · 대화권 부족", "item": "충전 유도", "criteria": "\"운 충전하기\" CTA", "method": "대화권 0 상태", "expected": "CTA 노출", "priority": "P0"},
    {"section": "/chat · 금지 질문", "item": "위험·자살·법률 등 컷", "criteria": "안전 응답 템플릿", "method": "경계 질문 5건", "expected": "컷·대체 응답", "priority": "P0"},
    {"section": "/chat · 응답 속도", "item": "p50 < 8s", "criteria": "Sonnet 성능", "method": "10 질문", "expected": "속도 OK", "priority": "P1"},
    {"section": "/chat · 톤", "item": "격식 60%+ · 친근 30%", "criteria": "메모리 준수", "method": "10문장 샘플", "expected": "비중 OK", "priority": "P1"},
    {"section": "/chat · 한자 정책", "item": "응답 내 한자 최소", "criteria": "심볼 1~2개", "method": "응답 확인", "expected": "반복 없음", "priority": "P1"},
    {"section": "/chat · 신살 언급", "item": "브랜드 자산 정확", "criteria": "천을귀인·화개살 정확", "method": "응답 확인", "expected": "오류 없음", "priority": "P1"},
    {"section": "/chat · 스크롤", "item": "긴 대화 스크롤 부드러움", "criteria": "가상 스크롤 or simple", "method": "50 메시지", "expected": "성능 OK", "priority": "P2"},
    {"section": "/chat · 메시지 복사", "item": "롱프레스 복사", "criteria": "개별 메시지 복사", "method": "롱프레스", "expected": "복사 가능", "priority": "P2"},
    {"section": "/chat · 플레이스홀더", "item": "입력창 플레이스홀더 자연", "criteria": "\"궁금한 것을 여쭤보세요\"", "method": "시각", "expected": "문구 OK", "priority": "P2"},
    {"section": "/chat · 보관함 연결", "item": "이전 대화 보관함 진입점", "criteria": "storage에서 chat 진입", "method": "보관함", "expected": "진입 OK", "priority": "P2"},
    {"section": "/chat · 에러", "item": "응답 실패 시 대화권 미차감", "criteria": "consumed=0 보장", "method": "강제 실패", "expected": "보장", "priority": "P0"},
]
make_qa_sheet(wb, "8_사주대화", chat_rows)


# ==============================================================
# 9. 충전
# ==============================================================
charge_rows = [
    {"section": "/charge · 원화 허용", "item": "유일하게 원화 노출 허용", "criteria": "메모리 project_pricing_hide_amount", "method": "가격 표시", "expected": "원화 명시", "priority": "P0"},
    {"section": "/charge · 10운", "item": "1운→10운으로 변경", "criteria": "충전_갭리포트 반영", "method": "시각", "expected": "10운 표기", "priority": "P0"},
    {"section": "/charge · 3회", "item": "5회→3회 변경", "criteria": "갭리포트 일치", "method": "시각", "expected": "3회 표기", "priority": "P0"},
    {"section": "/charge · 무료 기능 설명", "item": "무료로 할 수 있는 것 안내 추가", "criteria": "오늘의 운세 1일 1회 등", "method": "섹션 확인", "expected": "설명 존재", "priority": "P0"},
    {"section": "/charge · 패키지 가격", "item": "1운 500원 기준 일관", "criteria": "운 환율", "method": "가격 계산", "expected": "환율 일치", "priority": "P0"},
    {"section": "/charge · 토스페이", "item": "단순화 패치 A 반영", "criteria": "PC_PATCH_A_TOSSPAY_SIMPLIFY", "method": "결제 플로우", "expected": "단순화 적용", "priority": "P0"},
    {"section": "/charge · 결제 완료", "item": "rewardClaims 기록 · 운 즉시 반영", "criteria": "type=purchase", "method": "결제 후 확인", "expected": "운 증가", "priority": "P0"},
    {"section": "/charge · 영수증", "item": "간단 영수증 or 보관함 이동", "criteria": "증빙", "method": "결제 완료 화면", "expected": "확인 화면", "priority": "P1"},
    {"section": "/charge · 환불 정책", "item": "정책 링크", "criteria": "footer 링크", "method": "탭", "expected": "정책 페이지", "priority": "P0"},
    {"section": "/charge · 금액 단위", "item": "10운 = 5000원 (무료 1달 회원 혜택 등 고려)", "criteria": "혼동 없는 표기", "method": "가격 표", "expected": "명확", "priority": "P1"},
    {"section": "/charge · 결제 실패", "item": "재시도 · 차감 없음", "criteria": "실패 처리", "method": "실패 테스트", "expected": "운 미증가", "priority": "P0"},
    {"section": "/charge · 중복 결제 방지", "item": "idempotency key", "criteria": "서버 가드", "method": "빠른 더블탭", "expected": "중복 방지", "priority": "P0"},
    {"section": "/charge · UI 시각", "item": "사주500_UI개편_목업_충전_v2 일치", "criteria": "목업 v2", "method": "시각 비교", "expected": "일치", "priority": "P1"},
    {"section": "/charge · 앱인토스 연동", "item": "토스페이 in-app", "criteria": "외부 창 X", "method": "앱인토스 내 결제", "expected": "인앱 처리", "priority": "P0"},
]
make_qa_sheet(wb, "9_충전", charge_rows)


# ==============================================================
# 10. 입력
# ==============================================================
input_rows = [
    {"section": "/input · 진입", "item": "홈·보관함·콘텐츠 3지점", "criteria": "탭바 분산 (사주분석 탭 제거)", "method": "3 경로", "expected": "모두 진입 OK", "priority": "P0"},
    {"section": "/input · 이름", "item": "이름 입력", "criteria": "필수", "method": "빈 제출 차단", "expected": "에러 표시", "priority": "P0"},
    {"section": "/input · 생년월일", "item": "양력·음력 토글", "criteria": "사주500_UI개편_08 스펙", "method": "토글 시도", "expected": "전환 OK", "priority": "P0"},
    {"section": "/input · 출생 시간", "item": "모름 옵션", "criteria": "12지 or 모름", "method": "모름 선택", "expected": "시주 추정 처리", "priority": "P0"},
    {"section": "/input · KR 시간 보정", "item": "±30분 보정 UX", "criteria": "kr_time_correction_ux_copy_v2", "method": "1955년 이전 생년월일", "expected": "보정 안내", "priority": "P0"},
    {"section": "/input · 성별", "item": "선택", "criteria": "남/여", "method": "선택", "expected": "저장", "priority": "P0"},
    {"section": "/input · 제출", "item": "유효성 통과 시 sajuProfiles 저장", "criteria": "Firestore 기록", "method": "제출", "expected": "기록 생성", "priority": "P0"},
    {"section": "/input · 유효성", "item": "미래 날짜 차단", "criteria": "today 이전만", "method": "미래 입력", "expected": "에러", "priority": "P0"},
    {"section": "/input · 유효성 2", "item": "100세 이상 경계", "criteria": "1925 이전 경고", "method": "1900년", "expected": "경고 표시", "priority": "P1"},
    {"section": "/input · 저장 후", "item": "active profile로 설정", "criteria": "첫 사주면 자동", "method": "신규 저장", "expected": "active 설정", "priority": "P0"},
    {"section": "/input · UI", "item": "사주500_UI개편_목업_입력_v1 일치", "criteria": "single screen 폼", "method": "시각", "expected": "목업 일치", "priority": "P1"},
    {"section": "/input · 검증 바", "item": "각 필드 pass/fail 표시", "criteria": "인라인 에러", "method": "필드별 검증", "expected": "에러 정확", "priority": "P1"},
    {"section": "/input · 접근성", "item": "키보드 내비게이션", "criteria": "탭키 이동", "method": "키보드", "expected": "이동 OK", "priority": "P2"},
    {"section": "/input · 자동저장", "item": "입력 중 이탈 시 임시 저장", "criteria": "sessionStorage or UI 경고", "method": "이탈 시도", "expected": "안내 모달", "priority": "P2"},
    {"section": "/input · 여러 사주", "item": "친구·가족 추가", "criteria": "profile type: self | friend | family", "method": "추가 저장", "expected": "type 저장", "priority": "P1"},
    {"section": "/input · 상대 프로필 (궁합)", "item": "궁합 입력 시 선택적 보관", "criteria": "\"상대를 보관함에 저장?\" 토글", "method": "궁합 진입", "expected": "토글 존재", "priority": "P1"},
    {"section": "/input · 모름 케이스", "item": "시간 모를 때 공망·일주 기반", "criteria": "메시지 안내", "method": "모름 선택 후 제출", "expected": "안내 카피", "priority": "P1"},
    {"section": "/input · 오류 톤", "item": "격식체 친절 에러", "criteria": "ux_writing_global_copy_book", "method": "각 에러 메시지", "expected": "톤 일치", "priority": "P1"},
]
make_qa_sheet(wb, "10_입력", input_rows)


# ==============================================================
# 11. 내정보
# ==============================================================
myinfo_rows = [
    {"section": "/my · 진입", "item": "TabBar 내정보", "criteria": "5번째 탭", "method": "탭", "expected": "진입", "priority": "P0"},
    {"section": "/my · 앱인토스 축소", "item": "일부 메뉴 삭제", "criteria": "project_appintos_webapp_split", "method": "메뉴 확인", "expected": "축소 반영", "priority": "P0"},
    {"section": "/my · 내 사주", "item": "sajuProfiles 요약 · 관리 링크", "criteria": "보관함 사주 탭 링크", "method": "확인", "expected": "링크 OK", "priority": "P0"},
    {"section": "/my · 내 기록", "item": "resultHistory 요약", "criteria": "보관함 기록 탭 링크", "method": "확인", "expected": "링크 OK", "priority": "P0"},
    {"section": "/my · 운 잔액", "item": "현재 운 표시", "criteria": "BalanceBar와 일치", "method": "비교", "expected": "일치", "priority": "P0"},
    {"section": "/my · 충전 진입", "item": "/charge 진입", "criteria": "CTA", "method": "탭", "expected": "이동", "priority": "P0"},
    {"section": "/my · 이벤트 기록", "item": "출석·초대·공유 요약", "criteria": "이벤트 탭과 연결", "method": "확인", "expected": "요약 OK", "priority": "P1"},
    {"section": "/my · 로그아웃", "item": "앱인토스는 로그아웃 없음 · 웹앱만", "criteria": "플랫폼 분기", "method": "플랫폼 확인", "expected": "정책 일관", "priority": "P0"},
    {"section": "/my · 고객 문의", "item": "reference_appintos_ids 이메일", "criteria": "문의 메일 정확", "method": "탭", "expected": "메일 앱", "priority": "P0"},
    {"section": "/my · 법률 문서", "item": "이용약관·개인정보·환불", "criteria": "3 링크", "method": "각 탭", "expected": "페이지 OK", "priority": "P0"},
    {"section": "/my · 푸시 알림", "item": "앱인토스 알림 설정", "criteria": "토글 반영", "method": "토글", "expected": "반영", "priority": "P1"},
    {"section": "/my · 앱 버전", "item": "버전 표기", "criteria": "하단 Caption", "method": "확인", "expected": "버전 OK", "priority": "P2"},
]
make_qa_sheet(wb, "11_내정보", myinfo_rows)


# ==============================================================
# 12. 이벤트 탭 (STUB 8 시나리오)
# ==============================================================
event_rows = [
    {"section": "/events · 진입", "item": "TabBar 이벤트", "criteria": "2번째 탭", "method": "탭", "expected": "진입", "priority": "P0"},
    {"section": "/events · 5블록", "item": "HeroBadge·StreakWidget·WeekWidget·InviteBlock·CumulativeCard", "criteria": "EventsPage v4", "method": "시각", "expected": "5블록 순서", "priority": "P0"},
    {"section": "/events · 출석 판정 ①", "item": "오늘 결과 페이지 1회 이상 뷰 시 markAttendance", "criteria": "KST 당일 기준", "method": "결과 진입", "expected": "attendance 기록", "priority": "P0"},
    {"section": "/events · 3일 연속", "item": "Streak 끊김 없이 3일", "criteria": "운 1 즉시 지급", "method": "3일 연속 테스트", "expected": "rewardClaims 생성", "priority": "P0"},
    {"section": "/events · Streak 이동 윈도우", "item": "Day 1 [오늘·내일·모레] 등", "criteria": "09_이벤트_v4 스펙", "method": "각 일자 관측", "expected": "윈도우 이동", "priority": "P0"},
    {"section": "/events · 7일 모두 (cumulative)", "item": "월~일 전부 출석", "criteria": "토스포인트 100원 고정", "method": "7일 테스트", "expected": "STUB 모드 기록만", "priority": "P0"},
    {"section": "/events · 토스포인트 STUB", "item": "rewardClaims.tossTxId = STUB_...", "criteria": "LIVE 전 STUB", "method": "Firestore 확인", "expected": "STUB 기록", "priority": "P0"},
    {"section": "/events · LIVE 전환 조건", "item": "Secrets 3건 주입 후 자동 live", "criteria": "환경변수 존재 시 분기", "method": "LIVE 전환 후", "expected": "실제 지급", "priority": "P0"},
    {"section": "/events · 친구 초대", "item": "하루 3회 · 초대당 1운", "criteria": "inviteEvents dailyCount 3", "method": "초대 3회", "expected": "3운 적립", "priority": "P0"},
    {"section": "/events · 초대 상한 초과", "item": "4회째 차단", "criteria": "서버 가드", "method": "4회 시도", "expected": "에러", "priority": "P0"},
    {"section": "/events · 공유", "item": "1일 3회 · 1운", "criteria": "공유 이벤트", "method": "공유 3회", "expected": "3운 적립", "priority": "P0"},
    {"section": "/events · 누적 운 카드 (블록 5)", "item": "지금까지 받은 운 총합", "criteria": "rewardClaims 집계", "method": "확인", "expected": "정확 집계", "priority": "P0"},
    {"section": "/events · 토스포인트 별도 라인", "item": "type=attendance_week7_tosspoint 제외", "criteria": "별도 표기", "method": "집계", "expected": "분리 표기", "priority": "P0"},
    {"section": "/events · 이모지 0건", "item": "SVG 픽토그램만", "criteria": "grep 이모지", "method": "검증", "expected": "0건", "priority": "P0"},
    {"section": "/events · 금지어", "item": "랜덤·확률·뽑기 0건", "criteria": "grep", "method": "grep", "expected": "0건", "priority": "P0"},
    {"section": "/events · 연출", "item": "Tier A 토스트 1.2s · Tier B 모달", "criteria": "09_이벤트_v4 §연출", "method": "각 경로", "expected": "연출 정확", "priority": "P1"},
    {"section": "/events · Tier B 모달", "item": "네잎클로버 SVG + 天乙貴人", "criteria": "디자인 일관", "method": "완주 시 확인", "expected": "모달 OK", "priority": "P1"},
    {"section": "/events · 자기 수신 루프", "item": "본인 초대 차단", "criteria": "앱인토스 + 서버 가드", "method": "자기 초대 시도", "expected": "차단", "priority": "P0"},
    {"section": "/events · 월요일 리셋", "item": "7일 cumulative 월요일 0시 리셋", "criteria": "주간 경계", "method": "주차 전환 관측", "expected": "리셋 OK", "priority": "P0"},
    {"section": "/events · 카운터 정확", "item": "\"오늘 0/3회\" 실시간", "criteria": "UI 반영", "method": "초대 후 확인", "expected": "카운터 정확", "priority": "P1"},
    {"section": "/events · 프로모션 WEEK7 코드", "item": "APPINTOS_PROMOTION_CODE_WEEK7", "criteria": "Secret 이름 일치", "method": "코드 grep", "expected": "일치", "priority": "P0"},
    {"section": "/events · 3회 재시도", "item": "API 실패 시 3회 재시도 후 운 폴백", "criteria": "폴백 로직", "method": "강제 실패", "expected": "폴백 + 백오피스 알림", "priority": "P1"},
]
make_qa_sheet(wb, "12_이벤트", event_rows)


# ==============================================================
# 13. 대운흐름
# ==============================================================
daewoon_rows = [
    {"section": "/daewoon · 진입", "item": "홈 [05] 또는 결과 업셀", "criteria": "유료 2운", "method": "탭", "expected": "결제 → 진입", "priority": "P1"},
    {"section": "/daewoon · 타임라인", "item": "80년 가로 스크롤", "criteria": "8~10 대운", "method": "가로 스와이프", "expected": "스크롤 OK", "priority": "P1"},
    {"section": "/daewoon · 현재 강조", "item": "골드 테두리 + 1.5s pulse", "criteria": "시각", "method": "관측", "expected": "강조 OK", "priority": "P1"},
    {"section": "/daewoon · 대운 탭", "item": "탭 시 상세 스크롤", "criteria": "선택 대운 상세", "method": "다른 대운 탭", "expected": "상세 갱신", "priority": "P1"},
    {"section": "/daewoon · L1 800자", "item": "전체 아크 조감", "criteria": "분량 ±80", "method": "본문", "expected": "분량 OK", "priority": "P1"},
    {"section": "/daewoon · L2 1800자", "item": "선택 대운 집중 4문단", "criteria": "소제목 4", "method": "본문", "expected": "4문단", "priority": "P1"},
    {"section": "/daewoon · L3 1800자", "item": "다음·과거·대운×세운 + 차트", "criteria": "heatmap 1개", "method": "차트 렌더", "expected": "차트 OK", "priority": "P1"},
    {"section": "/daewoon · L4 600자", "item": "체크리스트 + 한 줄", "criteria": "3 체크 + 격언", "method": "본문", "expected": "완비", "priority": "P1"},
    {"section": "/daewoon · 2운 차감", "item": "rewardClaims · idempotency daewoon_{profileId}", "criteria": "중복 차감 방지", "method": "재진입", "expected": "1회 차감", "priority": "P1"},
    {"section": "/daewoon · 재열람", "item": "변동 없으므로 무료 재열람", "criteria": "캐시 or 동일 결과", "method": "재진입", "expected": "0 차감", "priority": "P1"},
    {"section": "/daewoon · 오행 색", "item": "각 대운 블록 색 매핑", "criteria": "간지→오행 정확", "method": "시각 vs 만세력", "expected": "일치", "priority": "P1"},
    {"section": "/daewoon · 업셀", "item": "프리미엄 10운 권유", "criteria": "\"사주 전체 흐름도\"", "method": "하단", "expected": "업셀 OK", "priority": "P1"},
    {"section": "/daewoon · 광고 X", "item": "유료", "criteria": "AdBanner 0", "method": "시각", "expected": "광고 X", "priority": "P1"},
    {"section": "/daewoon · 블러 X", "item": "전체 해제", "criteria": "locked=false", "method": "스크롤", "expected": "전체 노출", "priority": "P1"},
    {"section": "/daewoon · 공유 저장", "item": "Actions 3버튼", "criteria": "공통 컴포넌트", "method": "각 버튼", "expected": "동작", "priority": "P1"},
    {"section": "/daewoon · 톤", "item": "격식 70%+", "criteria": "프리미엄 수준", "method": "샘플", "expected": "OK", "priority": "P1"},
    {"section": "/daewoon · 차트 반응형", "item": "360px 최소 가독", "criteria": "DevTools", "method": "DevTools", "expected": "가독", "priority": "P1"},
    {"section": "/daewoon · PDF 포함", "item": "프리미엄 PDF에 대운 포함", "criteria": "Sprint 3 후 통합", "method": "PDF 확인", "expected": "포함", "priority": "P2"},
]
make_qa_sheet(wb, "13_확장_대운흐름", daewoon_rows)


# ==============================================================
# 14. 월운
# ==============================================================
wolun_rows = [
    {"section": "/wolun · 진입", "item": "홈 [05] 또는 업셀", "criteria": "1운", "method": "탭", "expected": "진입", "priority": "P1"},
    {"section": "/wolun · 캘린더", "item": "이번 달 7×5 그리드", "criteria": "일별 오행 색 tint", "method": "시각", "expected": "그리드 OK", "priority": "P1"},
    {"section": "/wolun · 오늘 강조", "item": "오늘 시각 하이라이트", "criteria": "ink border", "method": "시각", "expected": "강조", "priority": "P1"},
    {"section": "/wolun · 주간 요약", "item": "1~4주 카드", "criteria": "각 120 높이", "method": "시각", "expected": "4 카드", "priority": "P1"},
    {"section": "/wolun · L1 400자", "item": "전체 기운", "criteria": "±40", "method": "본문", "expected": "분량", "priority": "P1"},
    {"section": "/wolun · L2 900자", "item": "주차별 4 문단 각 200", "criteria": "소제목", "method": "본문", "expected": "4 문단", "priority": "P1"},
    {"section": "/wolun · L3 900자", "item": "특정 일 3~5일 + 차트", "criteria": "달력 차트", "method": "차트", "expected": "차트 OK", "priority": "P1"},
    {"section": "/wolun · L4 300자", "item": "체크리스트 + 한 줄", "criteria": "3 체크", "method": "본문", "expected": "완비", "priority": "P1"},
    {"section": "/wolun · 월 자동 갱신", "item": "매월 1일 00:00 생성", "criteria": "onSchedule cron", "method": "월 전환 관측", "expected": "자동 생성", "priority": "P1"},
    {"section": "/wolun · 이전 월", "item": "보관함에 2026.6월 라벨", "criteria": "월 바뀌면 이동", "method": "7월 1일 후 확인", "expected": "보관함 이동", "priority": "P1"},
    {"section": "/wolun · 재열람", "item": "이번 달 재열람 무료", "criteria": "캐시", "method": "재진입", "expected": "0 차감", "priority": "P1"},
    {"section": "/wolun · 1운 차감", "item": "새 달 첫 진입", "criteria": "wolun_{profileId}_{YYYYMM}", "method": "신규 월 진입", "expected": "1 차감", "priority": "P1"},
    {"section": "/wolun · 7일 이내 재구매", "item": "정책 결정 필요", "criteria": "정책 확정 후", "method": "정책 테스트", "expected": "일관", "priority": "P2"},
    {"section": "/wolun · 오늘 일간 색", "item": "캘린더 전체 오늘 티 구분", "criteria": "시각", "method": "시각", "expected": "OK", "priority": "P1"},
    {"section": "/wolun · 주간 액션", "item": "각 주 추천 행동 1개", "criteria": "90~110자", "method": "본문", "expected": "구체 행동", "priority": "P1"},
]
make_qa_sheet(wb, "14_확장_월운", wolun_rows)


# ==============================================================
# 15. 궁합
# ==============================================================
gunghap_rows = [
    {"section": "/gunghap · 진입", "item": "홈 [05] 탭 → 상대 입력", "criteria": "본인 + 상대", "method": "탭", "expected": "입력 페이지", "priority": "P1"},
    {"section": "/gunghap · 상대 입력", "item": "이름·생년월일·시간·성별", "criteria": "기본 입력 동일", "method": "입력", "expected": "필드 OK", "priority": "P1"},
    {"section": "/gunghap · 보관 토글", "item": "\"상대를 보관함에?\"", "criteria": "선택적 저장", "method": "토글", "expected": "토글 OK", "priority": "P1"},
    {"section": "/gunghap · 비저장 플로우", "item": "결과 후 상대 프로필 삭제", "criteria": "프라이버시", "method": "비저장 선택", "expected": "삭제 확인", "priority": "P1"},
    {"section": "/gunghap · 결과 레이아웃", "item": "좌 본인 · 우 상대 사주 카드", "criteria": "2 카드 병치", "method": "시각", "expected": "OK", "priority": "P1"},
    {"section": "/gunghap · 중앙 평가", "item": "5단계 텍스트 평가", "criteria": "점수·% 금지", "method": "시각", "expected": "텍스트 평가", "priority": "P1"},
    {"section": "/gunghap · L1 600자", "item": "두 사주 큰 그림", "criteria": "±60", "method": "본문", "expected": "분량", "priority": "P1"},
    {"section": "/gunghap · L2 1200자", "item": "오행 궁합 4 문단", "criteria": "소제목 4", "method": "본문", "expected": "4 문단", "priority": "P1"},
    {"section": "/gunghap · L3 1400자", "item": "십성 궁합 + 12개월 차트", "criteria": "타임라인", "method": "차트", "expected": "차트 OK", "priority": "P1"},
    {"section": "/gunghap · L4 600자", "item": "이번 달 3 행동 + 관계 한 줄", "criteria": "3 체크", "method": "본문", "expected": "완비", "priority": "P1"},
    {"section": "/gunghap · 3운 차감", "item": "결제 플로우", "criteria": "idempotency gunghap_{uidA}_{uidB}_{date}", "method": "결제", "expected": "3 차감", "priority": "P1"},
    {"section": "/gunghap · 프리미엄 포함", "item": "프리미엄 10운 상대 1명 무료", "criteria": "프리미엄 사용자", "method": "프리미엄 진입", "expected": "무료", "priority": "P1"},
    {"section": "/gunghap · 수치 점수 0건", "item": "% 점수 grep 0", "criteria": "브랜드 원칙", "method": "grep %", "expected": "0", "priority": "P1"},
    {"section": "/gunghap · 프라이버시", "item": "결과 본인 uid 귀속만", "criteria": "상대 uid 무관", "method": "Firestore 확인", "expected": "본인 only", "priority": "P1"},
    {"section": "/gunghap · 재열람", "item": "같은 조합 재열람 무료", "criteria": "캐시", "method": "재진입", "expected": "0 차감", "priority": "P1"},
    {"section": "/gunghap · 업셀", "item": "프리미엄 10운", "criteria": "\"관계를 사주 전체로 이해\"", "method": "하단", "expected": "업셀", "priority": "P1"},
    {"section": "/gunghap · 광고 X", "item": "유료", "criteria": "AdBanner 0", "method": "시각", "expected": "0", "priority": "P1"},
    {"section": "/gunghap · 이름 마스킹", "item": "저장 안 한 상대 이름은 결과에서만 표시", "criteria": "저장 X 시 로컬만", "method": "저장 안 함 선택 후", "expected": "저장 X 확인", "priority": "P1"},
    {"section": "/gunghap · 저장 후", "item": "sajuProfiles에 type='partner'", "criteria": "FK 저장", "method": "저장 선택", "expected": "type 기록", "priority": "P1"},
    {"section": "/gunghap · 재입력", "item": "저장된 상대 리스트에서 선택", "criteria": "재사용", "method": "보관함에서 선택", "expected": "선택 OK", "priority": "P1"},
]
make_qa_sheet(wb, "15_확장_궁합", gunghap_rows)


# ==============================================================
# 16. 토정비결
# ==============================================================
tojeong_rows = [
    {"section": "/tojeong · 진입", "item": "홈 [05] 또는 연초 배너", "criteria": "2운 · 연 1회", "method": "탭", "expected": "진입", "priority": "P1"},
    {"section": "/tojeong · 연도 분리", "item": "2026 vs 2027 별도", "criteria": "각 연도 별도 결제", "method": "2027 진입 시도", "expected": "별도 2운", "priority": "P1"},
    {"section": "/tojeong · 상단 배너", "item": "\"2026 한 해를 여는\"", "criteria": "한자 표어 1줄", "method": "시각", "expected": "배너 OK", "priority": "P1"},
    {"section": "/tojeong · 12월 아코디언", "item": "1월~12월 각 300자", "criteria": "각 월 소제목 템플릿", "method": "아코디언", "expected": "12 섹션", "priority": "P1"},
    {"section": "/tojeong · 현재 월 펼침", "item": "기본 펼침", "criteria": "다른 월 접힘", "method": "진입 시각", "expected": "현재만 펼침", "priority": "P1"},
    {"section": "/tojeong · 과거 월 투명", "item": "opacity 0.6", "criteria": "시각 구분", "method": "시각", "expected": "흐림", "priority": "P2"},
    {"section": "/tojeong · 미래 월", "item": "탭 시 펼침", "criteria": "상호작용", "method": "탭", "expected": "펼침 OK", "priority": "P1"},
    {"section": "/tojeong · L1 600자", "item": "한 해 표어 + 오행 흐름 + 키워드 3", "criteria": "±60", "method": "본문", "expected": "분량", "priority": "P1"},
    {"section": "/tojeong · L2 3600자", "item": "12월 × 300자", "criteria": "각 ±30자", "method": "본문", "expected": "12개", "priority": "P1"},
    {"section": "/tojeong · L3 1500자", "item": "5축 연간 흐름 라인 차트", "criteria": "관·재·인·관계·건강", "method": "차트", "expected": "5 라인", "priority": "P1"},
    {"section": "/tojeong · L4 300자", "item": "3 체크 + 한 해 한 줄", "criteria": "격언체", "method": "본문", "expected": "완비", "priority": "P1"},
    {"section": "/tojeong · 연간 요약 카드", "item": "\"내년 토정비결 예약\" 12/15 이후", "criteria": "시점 조건", "method": "12월 관측", "expected": "활성화", "priority": "P2"},
    {"section": "/tojeong · 12월 완독", "item": "\"올해 되짚기\" 풀스크린 차트", "criteria": "특별 UX", "method": "전부 펼친 후", "expected": "CTA 노출", "priority": "P2"},
    {"section": "/tojeong · 재열람", "item": "연중 무제한 재열람", "criteria": "캐시", "method": "재진입", "expected": "0 차감", "priority": "P1"},
    {"section": "/tojeong · 2운 차감", "item": "rewardClaims tojeong_{profileId}_{YYYY}", "criteria": "연간 idempotency", "method": "결제", "expected": "1회", "priority": "P1"},
    {"section": "/tojeong · 오픈 시점", "item": "매년 12월 말~1월 오픈", "criteria": "연초 프로모션", "method": "연말 관측", "expected": "오픈", "priority": "P2"},
    {"section": "/tojeong · 한자 표어", "item": "격조 있는 한자 1줄", "criteria": "연도별 고유", "method": "본문", "expected": "OK", "priority": "P2"},
    {"section": "/tojeong · 오행 흐름", "item": "연간 오행 큰 흐름 1줄", "criteria": "L1 포함", "method": "본문", "expected": "포함", "priority": "P1"},
]
make_qa_sheet(wb, "16_확장_토정비결", tojeong_rows)


# ==============================================================
# 17. 데이터 스키마
# ==============================================================
schema_rows = [
    {"section": "Firestore · sajuProfiles", "item": "users/{uid}/sajuProfiles 존재", "criteria": "분리 컬렉션", "method": "Console", "expected": "존재", "priority": "P0"},
    {"section": "Firestore · resultHistory", "item": "users/{uid}/resultHistory 존재", "criteria": "분리 컬렉션", "method": "Console", "expected": "존재", "priority": "P0"},
    {"section": "Firestore · rewardClaims", "item": "users/{uid}/rewardClaims", "criteria": "결제·적립 기록", "method": "Console", "expected": "존재", "priority": "P0"},
    {"section": "Firestore · profileId FK", "item": "resultHistory 문서에 profileId", "criteria": "FK 필드 필수", "method": "샘플 5개 확인", "expected": "FK 존재", "priority": "P0"},
    {"section": "삭제 정책 · 사주", "item": "sajuProfiles 삭제만 사라짐", "criteria": "cascade X", "method": "삭제 테스트", "expected": "result 유지", "priority": "P0"},
    {"section": "삭제 정책 · 기록", "item": "resultHistory 삭제 불가", "criteria": "숨김만", "method": "UI 확인", "expected": "삭제 UI 0", "priority": "P0"},
    {"section": "삭제 정책 · 결제", "item": "rewardClaims 삭제 절대 불가", "criteria": "어드민만", "method": "rules 확인", "expected": "유저 삭제 X", "priority": "P0"},
    {"section": "백필 스크립트", "item": "구 profiles → 분리 이관", "criteria": "migrate_storage_v1.ts", "method": "스크립트 실행", "expected": "이관 OK", "priority": "P0"},
    {"section": "백필 검증", "item": "이관 후 데이터 무결성", "criteria": "count · 매핑 검증", "method": "5 사용자 샘플", "expected": "손실 0", "priority": "P0"},
    {"section": "Firestore rules", "item": "본인 읽기만 · 서버 admin 쓰기", "criteria": "보안 규칙", "method": "rules 확인", "expected": "정확", "priority": "P0"},
    {"section": "idempotency · premium", "item": "premium_{profileId}_{YYYYMM}", "criteria": "월 1회", "method": "중복 결제 시도", "expected": "방지", "priority": "P0"},
    {"section": "idempotency · topic", "item": "topic_{slug}_{profileId}_{YYYYMMDD}", "criteria": "일 1회", "method": "재결제 시도", "expected": "방지", "priority": "P0"},
    {"section": "idempotency · attendance", "item": "attendance_{uid}_{YYYYMMDD}", "criteria": "1일 1회", "method": "재진입", "expected": "중복 X", "priority": "P0"},
    {"section": "idempotency · streak", "item": "streak_{uid}_{startDate}", "criteria": "3일 연속 1회", "method": "달성 후", "expected": "1회만", "priority": "P0"},
    {"section": "idempotency · week7 토스포인트", "item": "tosspoint_week7_{uid}_{weekKey}", "criteria": "주 1회", "method": "주 완주", "expected": "1회", "priority": "P0"},
    {"section": "스키마 문서화", "item": "README 또는 docs/", "criteria": "Firestore 구조도", "method": "문서 확인", "expected": "있음", "priority": "P1"},
]
make_qa_sheet(wb, "17_데이터스키마", schema_rows)


# ==============================================================
# 18. 성능·접근성
# ==============================================================
perf_rows = [
    {"section": "성능 · 첫 페인트", "item": "홈 FCP < 1.5s", "criteria": "Lighthouse", "method": "Lighthouse", "expected": "1.5 이하", "priority": "P1"},
    {"section": "성능 · LCP", "item": "홈 LCP < 2.5s", "criteria": "Lighthouse", "method": "Lighthouse", "expected": "2.5 이하", "priority": "P1"},
    {"section": "성능 · CLS", "item": "CLS < 0.1", "criteria": "Lighthouse", "method": "Lighthouse", "expected": "0.1 이하", "priority": "P1"},
    {"section": "성능 · 번들 크기", "item": "초기 JS < 250KB", "criteria": "build 결과", "method": "dist 분석", "expected": "250 이하", "priority": "P2"},
    {"section": "성능 · 결과 p50", "item": "generateDaily p50 < 10s", "criteria": "서버 로그", "method": "10회 측정", "expected": "10 이하", "priority": "P1"},
    {"section": "성능 · 프리미엄 p50", "item": "generatePremium p50 < 25s", "criteria": "서버 로그", "method": "10회", "expected": "25 이하", "priority": "P1"},
    {"section": "성능 · cold start", "item": "minInstances 설정", "criteria": "Firebase 설정", "method": "설정 확인", "expected": "1 이상", "priority": "P1"},
    {"section": "성능 · 병렬", "item": "가능한 섹션 병렬 호출", "criteria": "Promise.all", "method": "코드", "expected": "병렬", "priority": "P2"},
    {"section": "접근성 · 대비", "item": "WCAG AA 4.5:1", "criteria": "주요 텍스트", "method": "axe DevTools", "expected": "위반 0", "priority": "P1"},
    {"section": "접근성 · 탭 타깃", "item": "최소 44×44", "criteria": "버튼·링크", "method": "측정", "expected": "충족", "priority": "P1"},
    {"section": "접근성 · 포커스 링", "item": "항상 가시", "criteria": "키보드 이동", "method": "Tab키", "expected": "링 노출", "priority": "P1"},
    {"section": "접근성 · aria-label", "item": "아이콘 버튼 라벨", "criteria": "스크린리더", "method": "VoiceOver", "expected": "읽힘", "priority": "P1"},
    {"section": "접근성 · 모달", "item": "role=dialog + trap focus", "criteria": "WCAG", "method": "키보드", "expected": "포커스 갇힘", "priority": "P2"},
    {"section": "접근성 · 컬러 only 금지", "item": "에러 시 텍스트 동반", "criteria": "색에만 의존 X", "method": "에러 상태", "expected": "아이콘·텍스트", "priority": "P2"},
    {"section": "접근성 · 대체 텍스트", "item": "이미지 alt", "criteria": "있음", "method": "검사", "expected": "alt 존재", "priority": "P1"},
    {"section": "성능 · keep-alive", "item": "Anthropic 연결 유지", "criteria": "connection pooling", "method": "구현 확인", "expected": "적용", "priority": "P2"},
    {"section": "성능 · prompt cache", "item": "기본 프롬프트 캐시", "criteria": "ephemeral cache", "method": "로그", "expected": "적용", "priority": "P2"},
    {"section": "성능 · 이미지 0건", "item": "CSS·SVG만", "criteria": "img 태그 최소", "method": "grep", "expected": "최소화", "priority": "P2"},
    {"section": "성능 · 폰트", "item": "Pretendard + Noto Serif 로컬·CDN", "criteria": "font-display swap", "method": "CSS", "expected": "swap 사용", "priority": "P2"},
    {"section": "성능 · Hosting", "item": "CDN 캐시 설정", "criteria": "firebase.json", "method": "설정", "expected": "캐시 OK", "priority": "P2"},
]
make_qa_sheet(wb, "18_성능_접근성", perf_rows)


# ==============================================================
# 19. 브랜드·톤·금지어
# ==============================================================
brand_rows = [
    {"section": "금지어 · AI", "item": "\"AI\" 0건", "criteria": "grep 소문자·대문자", "method": "grep", "expected": "0", "priority": "P0"},
    {"section": "금지어 · GPT", "item": "\"GPT\" 0건", "criteria": "grep", "method": "grep", "expected": "0", "priority": "P0"},
    {"section": "금지어 · 챗", "item": "\"챗GPT\" \"챗봇\" 0건", "criteria": "grep", "method": "grep", "expected": "0", "priority": "P0"},
    {"section": "금지어 · 모델", "item": "\"모델\" (문맥 외) 0건", "criteria": "grep + context check", "method": "grep", "expected": "문맥 외 0", "priority": "P0"},
    {"section": "금지어 · 랜덤", "item": "\"랜덤\" \"확률\" \"뽑기\" \"박스\" 0건", "criteria": "grep", "method": "grep", "expected": "0", "priority": "P0"},
    {"section": "금지어 · 원화 노출", "item": "홈·결과에 원 표기 0건 (footer © 제외)", "criteria": "grep", "method": "grep", "expected": "0 (허용 위치 제외)", "priority": "P0"},
    {"section": "금지어 · 이모지", "item": "유니코드 이모지 0건", "criteria": "regex", "method": "regex grep", "expected": "0", "priority": "P0"},
    {"section": "브랜드 · 골드", "item": "#B8965A 일관 사용", "criteria": "CSS 토큰", "method": "grep", "expected": "사용", "priority": "P0"},
    {"section": "브랜드 · 머스타드 금지", "item": "#b8941f 0건", "criteria": "grep", "method": "grep", "expected": "0", "priority": "P0"},
    {"section": "브랜드 · 파이어플라이", "item": "paper #F8F5EE 배경", "criteria": "CSS", "method": "시각", "expected": "일관", "priority": "P1"},
    {"section": "브랜드 · 네이비", "item": "#1D2D4A 사주대화 등", "criteria": "CSS", "method": "시각", "expected": "일관", "priority": "P1"},
    {"section": "톤 · 격식체 비중", "item": "50% 이상", "criteria": "문장 수동 샘플 10건", "method": "샘플링", "expected": "5/10 이상", "priority": "P0"},
    {"section": "톤 · 프리미엄 격식", "item": "70% 이상", "criteria": "샘플 20건", "method": "샘플링", "expected": "14/20 이상", "priority": "P0"},
    {"section": "톤 · 친근체 비중", "item": "30~40%", "criteria": "샘플", "method": "샘플링", "expected": "범위 내", "priority": "P1"},
    {"section": "한자 · 심볼만", "item": "페이지당 1~4자", "criteria": "regex [一-龥]", "method": "regex", "expected": "4 이하", "priority": "P0"},
    {"section": "한자 · 브랜드·신살 제외", "item": "천을귀인·도화살·화개살 허용", "criteria": "메모리 feedback_shinsal_terms", "method": "정책 확인", "expected": "허용", "priority": "P1"},
    {"section": "후기 · 이름 제거", "item": "후기 카드 이름 0건", "criteria": "메타만", "method": "카드 확인", "expected": "0", "priority": "P0"},
    {"section": "후기 · 별점 제거", "item": "별점·숫자평가 0건", "criteria": "자연 어투", "method": "시각", "expected": "0", "priority": "P0"},
    {"section": "후기 · 연령 메타", "item": "\"20대 여\" 형식", "criteria": "Track A §A9", "method": "카드", "expected": "메타 OK", "priority": "P0"},
    {"section": "후기 · 광고 거짓", "item": "\"광고 거슬\" 0건", "criteria": "grep", "method": "grep", "expected": "0", "priority": "P0"},
    {"section": "디스클레이머", "item": "오락·참고용 + 의료·법률·투자 아님", "criteria": "Track A §A10", "method": "footer", "expected": "문구 일치", "priority": "P0"},
    {"section": "원전 fine-print", "item": "참고용 원전 명시", "criteria": "정책 확정", "method": "확인", "expected": "일관", "priority": "P1"},
    {"section": "\"공망\" \"천을귀인\"", "item": "브랜드 자산 · 금지 X", "criteria": "메모리 적용", "method": "정책", "expected": "허용", "priority": "P1"},
    {"section": "\"운명\" \"팔자\"", "item": "숙명론 표현 최소", "criteria": "결·흐름·참고", "method": "grep", "expected": "최소", "priority": "P1"},
]
make_qa_sheet(wb, "19_브랜드톤", brand_rows)


# ==============================================================
# 20. 엣지 케이스
# ==============================================================
edge_rows = [
    {"section": "엣지 · 네트워크 끊김", "item": "생성 중 네트워크 차단", "criteria": "운 미차감 보장", "method": "DevTools offline", "expected": "재시도 UI", "priority": "P0"},
    {"section": "엣지 · 타임아웃", "item": "30초 초과", "criteria": "안내 + 재시도", "method": "강제 지연", "expected": "타임아웃 UX", "priority": "P0"},
    {"section": "엣지 · 빈 응답", "item": "API 빈 문자열", "criteria": "에러 처리", "method": "강제 empty", "expected": "fallback", "priority": "P0"},
    {"section": "엣지 · 부분 결과", "item": "L1만 있고 L2 누락", "criteria": "디펜시브 렌더", "method": "강제 partial", "expected": "크래시 X", "priority": "P0"},
    {"section": "엣지 · undefined 필드", "item": "result.sections undefined", "criteria": "?. 체크", "method": "Firestore 누락 시뮬", "expected": "크래시 X", "priority": "P0"},
    {"section": "엣지 · 로그인 X", "item": "로그아웃 상태 진입", "criteria": "게스트 경로 or 유도", "method": "로그아웃 후", "expected": "적절 처리", "priority": "P0"},
    {"section": "엣지 · 사주 X", "item": "프로필 없이 결과 진입", "criteria": "입력 페이지 리다이렉트", "method": "신규 사용자", "expected": "입력 유도", "priority": "P0"},
    {"section": "엣지 · 운 부족", "item": "잔액 0 상태 유료 결제", "criteria": "충전 유도", "method": "0 잔액", "expected": "/charge 유도", "priority": "P0"},
    {"section": "엣지 · 결제 중복", "item": "빠른 더블탭", "criteria": "idempotency 가드", "method": "연타", "expected": "1회만", "priority": "P0"},
    {"section": "엣지 · 삭제 후 결과", "item": "사주 삭제 후 해당 결과 진입", "criteria": "historical 렌더 OK", "method": "삭제 후 보관함", "expected": "결과 보임", "priority": "P0"},
    {"section": "엣지 · 월운 월경계", "item": "31일 23:59 진입", "criteria": "1일로 넘어가면 자동 갱신", "method": "시각 설정", "expected": "갱신 OK", "priority": "P1"},
    {"section": "엣지 · streak 끊김", "item": "2일 차 미출석", "criteria": "Day 0 리셋", "method": "2일 건너뜀", "expected": "리셋", "priority": "P0"},
    {"section": "엣지 · KST 경계", "item": "자정 출석 판정", "criteria": "00:00~00:01 안정", "method": "자정 출석", "expected": "당일 인정", "priority": "P0"},
    {"section": "엣지 · 시차", "item": "해외 접속 시 KST 기준", "criteria": "server KST 일관", "method": "UTC 접속", "expected": "KST 기준", "priority": "P1"},
    {"section": "엣지 · 큰 입력", "item": "꿈 500자 초과", "criteria": "절단 + 안내", "method": "600자 입력", "expected": "제한", "priority": "P1"},
    {"section": "엣지 · 특수문자", "item": "이름 이모지·특수문자", "criteria": "필터 or 허용", "method": "특수문자 입력", "expected": "정책 일관", "priority": "P1"},
    {"section": "엣지 · 백그라운드 복귀", "item": "앱 백그라운드 30분 후 복귀", "criteria": "세션 유지 or 재로그인", "method": "실기기", "expected": "정상", "priority": "P1"},
    {"section": "엣지 · 저용량 기기", "item": "저용량 안드로이드", "criteria": "성능 degrade 허용", "method": "갤럭시 A", "expected": "기본 동작", "priority": "P2"},
    {"section": "엣지 · iOS safe-area", "item": "노치·홈 인디케이터", "criteria": "safe-area-inset", "method": "iPhone 14+", "expected": "침범 X", "priority": "P1"},
    {"section": "엣지 · 빠른 라우팅", "item": "연속 탭 시 중복 요청", "criteria": "debounce", "method": "연속 탭", "expected": "1회", "priority": "P1"},
    {"section": "엣지 · 앱인토스 백버튼", "item": "앱인토스 상단 X 버튼", "criteria": "앱 종료 vs 뒤로", "method": "X 버튼 탭", "expected": "정의된 동작", "priority": "P1"},
    {"section": "엣지 · 리프레시", "item": "결과 페이지 F5", "criteria": "같은 결과 렌더", "method": "새로고침", "expected": "일관", "priority": "P1"},
]
make_qa_sheet(wb, "20_엣지케이스", edge_rows)


# ==============================================================
# 저장
# ==============================================================
wb.save(OUT_PATH)
print(f"Saved to {OUT_PATH}")
