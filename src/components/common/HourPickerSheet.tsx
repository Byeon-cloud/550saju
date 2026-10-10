/**
 * HourPickerSheet — 12지지 + 모름 바텀시트 (재사용)
 *
 * 사용처:
 *   - InputPage (본인 사주 입력)  ← 자체 HourSheet 보유
 *   - TopicAnalysisPage (상대방 정보 입력)  ← 이 컴포넌트로 통일
 *   - 향후: ChatNew 등 partner 입력 화면
 *
 * 디자인 일관성: InputPage HourSheet 동일 톤 (paper bg / 골드 active / Noto Serif KR 한자)
 */
import { AnimatePresence, motion } from 'framer-motion';

const C = {
  paper: '#F8F5EE',
  ink: '#1A1A1A',
  mute: '#7A7269',
  line: '#E5DFD0',
  goldDeep: '#8C6D3D',
  goldSoft: 'rgba(184,150,90,0.14)',
};

/** 12지지 + 시간 매핑 — 23시 자시 시작, 진태양시 보정(-30분, 업계 표준) 포함.
 *  경계는 시계로 :30 정각 (2026-07-14 기준 확정 — 대중 만세력과 동일). calculateSaju 도 -30분이라 라벨=계산 일치.
 *  예: 인시는 3:30부터 → 딱 3:30 출생 = 인시 (유명 만세력 앱들과 같은 판정). */
const HOUR_OPTIONS: Array<{
  /** 한자 */
  hanja: string;
  /** 한글 */
  ko: string;
  /** 시작 시 (24h) — onSelect 호출 시 이 값 반환 */
  hour: number;
  /** 시간 범위 표시 */
  range: string;
}> = [
  // 2026-06-02 시주 fix — hour = 각 시(時) '중앙' 클럭값 (InputPage.HOUR_OPTIONS 와 동일 정책).
  //   진태양시 -30분 보정 후에도 선택한 시 안에 안착 (午 12:00 → 11:30 → 午). 子(=0)는 자정=중앙 유지.
  { hanja: '子', ko: '자시', hour: 0,  range: '23:30 ~ 01:29' },
  { hanja: '丑', ko: '축시', hour: 2,  range: '01:30 ~ 03:29' },
  { hanja: '寅', ko: '인시', hour: 4,  range: '03:30 ~ 05:29' },
  { hanja: '卯', ko: '묘시', hour: 6,  range: '05:30 ~ 07:29' },
  { hanja: '辰', ko: '진시', hour: 8,  range: '07:30 ~ 09:29' },
  { hanja: '巳', ko: '사시', hour: 10, range: '09:30 ~ 11:29' },
  { hanja: '午', ko: '오시', hour: 12, range: '11:30 ~ 13:29' },
  { hanja: '未', ko: '미시', hour: 14, range: '13:30 ~ 15:29' },
  { hanja: '申', ko: '신시', hour: 16, range: '15:30 ~ 17:29' },
  { hanja: '酉', ko: '유시', hour: 18, range: '17:30 ~ 19:29' },
  { hanja: '戌', ko: '술시', hour: 20, range: '19:30 ~ 21:29' },
  { hanja: '亥', ko: '해시', hour: 22, range: '21:30 ~ 23:29' },
];

/** 입력값(0-23 hour 또는 -1 모름) → 표시 라벨 */
export function hourToDisplayLabel(hour: number): string {
  if (hour < 0) return '시간 선택';
  // 가장 가까운 지지 (1시간 단위로 매칭) — 0,1=자/축, 2,3=축/인, ...
  // 단순화: 짝수 시는 그 시간대 시작, 홀수 시도 그 짝의 시작
  const opt =
    HOUR_OPTIONS.find((o) => o.hour === hour) ||
    HOUR_OPTIONS.find((o) => o.hour === hour - 1) ||
    HOUR_OPTIONS[0];
  return `${opt.hanja} ${opt.ko} (${opt.range})`;
}

interface Props {
  open: boolean;
  /** 현재 선택된 hour (0-23) 또는 -1 (모름) */
  currentHour: number;
  onClose: () => void;
  /** -1 = 모름, 0-23 = 시 */
  onSelect: (hour: number) => void;
  /** 헤더 타이틀 (default: "태어난 시간") */
  title?: string;
}

export function HourPickerSheet({ open, currentHour, onClose, onSelect, title = '태어난 시간' }: Props) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="hps-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 110,
            background: 'rgba(15,13,10,0.6)',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
          }}
          aria-modal="true"
          role="dialog"
          aria-label={`${title} 선택`}
        >
          <motion.div
            key="hps-panel"
            initial={{ y: 240 }}
            animate={{ y: 0 }}
            exit={{ y: 240 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
            role="listbox"
            aria-label={title}
            style={{
              width: '100%',
              maxWidth: 520,
              background: C.paper,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: '20px 0',
              maxHeight: '78vh',
              overflowY: 'auto',
              paddingBottom: 'calc(20px + env(safe-area-inset-bottom))',
            }}
          >
            <div
              aria-hidden
              style={{
                width: 36,
                height: 4,
                borderRadius: 999,
                background: C.line,
                margin: '0 auto 16px',
              }}
            />
            <h3
              style={{
                fontSize: 17,
                fontWeight: 700,
                color: C.ink,
                padding: '0 24px',
                margin: '0 0 12px',
              }}
            >
              {title}
            </h3>
            {/* 진태양시 보정 안내 — "왜 :30부터?" 혼동 + 경계 시각 선택 가이드 (2026-07 UX fix) */}
            <div
              style={{
                margin: '0 24px 14px',
                padding: '10px 12px',
                background: C.goldSoft,
                borderRadius: 12,
                fontSize: 12,
                lineHeight: 1.55,
                color: C.mute,
              }}
            >
              우리나라 표준시는 실제 태양 시간보다 약 30분 빨라요. 사주는 태양의 위치가 기준이라, 그만큼 앞당겨 보정한 시간대예요 (서울 기준).
              <br />
              시각이 <b style={{ color: C.goldDeep, fontWeight: 700 }}>경계에 딱 걸치면</b> 태어난 지역에 따라 앞뒤 시(時)로 갈릴 수 있어요.
            </div>
            <div style={{ padding: '4px 8px 0' }}>
              {/* 모름 옵션 — 첫 번째에 두면 시각적 우선순위 ↓ — 매뉴얼 입력 안내 같이 */}
              <button
                type="button"
                role="option"
                aria-selected={currentHour < 0}
                onClick={() => onSelect(-1)}
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  background: currentHour < 0 ? C.goldSoft : 'transparent',
                  border: 'none',
                  borderRadius: 12,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <span
                  style={{
                    fontSize: 15,
                    color: C.mute,
                    width: 32,
                    textAlign: 'center',
                  }}
                  aria-hidden
                >
                  ?
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: C.ink }}>모름</div>
                  <div style={{ fontSize: 12, color: C.mute, marginTop: 2 }}>
                    시간 정보 없이 분석 (시주 제외)
                  </div>
                </div>
              </button>

              {HOUR_OPTIONS.map((o) => {
                const active = currentHour === o.hour;
                return (
                  <button
                    key={o.hanja}
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => onSelect(o.hour)}
                    style={{
                      width: '100%',
                      padding: '14px 16px',
                      background: active ? C.goldSoft : 'transparent',
                      border: 'none',
                      borderRadius: 12,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <span
                      style={{
                        fontSize: 24,
                        fontWeight: 700,
                        color: C.goldDeep,
                        fontFamily: "'Noto Serif KR', serif",
                        width: 32,
                      }}
                    >
                      {o.hanja}
                    </span>
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          fontSize: 15,
                          fontWeight: 600,
                          color: C.ink,
                        }}
                      >
                        {o.ko}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: C.mute,
                          marginTop: 2,
                        }}
                      >
                        {o.range}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** 시트 트리거 버튼 — `시간 선택 ▾` (selected 시 한자+한글+시간 범위 표시) */
export function HourPickerTrigger({
  hour,
  onClick,
  invalid,
}: {
  hour: number;
  onClick: () => void;
  invalid?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-haspopup="listbox"
      aria-expanded={false}
      aria-invalid={!!invalid}
      style={{
        width: '100%',
        height: 52,
        background: '#FFFFFF',
        border: `1px solid ${invalid ? '#B04A38' : C.line}`,
        borderRadius: 12,
        padding: '0 16px',
        fontSize: 15,
        fontWeight: 600,
        color: hour < 0 ? C.mute : C.ink,
        textAlign: 'left',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <span>{hourToDisplayLabel(hour)}</span>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.mute} strokeWidth="2" aria-hidden>
        <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
