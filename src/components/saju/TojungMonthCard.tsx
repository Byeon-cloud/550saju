import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { stripMd, sanitizeAiText } from '@/utils/format';
import { HJ, SERIF, Note, YiGi, Tag } from '@/components/hanji/Hanji';

interface Props {
  month: number;
  괘: string;
  괘의미: string;
  전통해석: string;
  현대해석: string;
  score: number;
  keyword: string;
  /** 2026-10-08 신년운세 7운 — 서버 일진 계산 좋은 날·조심할 날 + 이 달 할 일·피할 일 (없으면 미표시 · 옛 결과 호환) */
  goodDays?: string[];
  cautionDays?: string[];
  todo?: string;
  avoid?: string;
  delay?: number;
}

/* 서버 판정 '辛丑 = 辛(금, 희신) + 丑(토, 기신) → 도움과 부담이 섞인 달' 을 읽는 말로 */
const ROLE_WORD: Record<string, string> = { 용신: '가장 필요한 기운', 희신: '돕는 기운', 기신: '부담 기운', 중립: '무난한 기운' };
const OH_JOSA: Record<string, string> = { 목: '은', 화: '는', 토: '는', 금: '은', 수: '는' };
function friendlyRole(s: string): string {
  const t = stripMd(s);
  const m = t.match(/^(\S)(\S) = \S\((목|화|토|금|수), (용신|희신|기신|중립)\) \+ \S\((목|화|토|금|수), (용신|희신|기신|중립)\) → (.+)$/);
  if (!m) return t;
  const [, g, b, go, gr, bo, br, verdict] = m;
  return `천간 ${g}(${go})${OH_JOSA[go]} ${ROLE_WORD[gr]}, 지지 ${b}(${bo})${OH_JOSA[bo]} ${ROLE_WORD[br]}이라 ${verdict}이에요.`;
}

/** 신년운세 달 카드 — 2026-10-11 프리미엄 고서 양식: 금선 두 줄 카드, 달 칸, 宜忌(할 일/피할 일), 날짜 딱지 */
export function TojungMonthCard({ month, 괘, 괘의미, 전통해석, 현대해석, score, keyword, goodDays, cautionDays, todo, avoid, delay = 0 }: Props) {
  const [expanded, setExpanded] = useState(false);
  // 점수 색은 셋만: 좋은 달 금빛 갈색 · 조심할 달 석간주 · 그 밖 먹
  const tone = score >= 80 ? '#7A5C2E' : score < 56 ? HJ.seal : HJ.ink;

  return (
    <motion.div
      className="hj-pcard"
      style={{ padding: 0 }}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '14px 16px', background: 'none', border: 0, cursor: 'pointer', textAlign: 'left' }}
      >
        <span
          aria-hidden="true"
          style={{ width: 46, height: 46, flexShrink: 0, display: 'grid', placeItems: 'center', border: `1.5px solid ${tone}`, borderRadius: 2, fontFamily: SERIF, fontWeight: 800, color: tone, lineHeight: 1 }}
        >
          <span style={{ fontSize: 18 }}>{month}<small style={{ fontSize: 12, marginLeft: 1 }}>월</small></span>
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontFamily: SERIF, fontSize: 16.5, fontWeight: 700, color: HJ.ink, lineHeight: 1.35, wordBreak: 'keep-all' }}>{stripMd(keyword)}</span>
          <span style={{ display: 'block', fontSize: 13.5, color: HJ.mute, marginTop: 3 }}>{괘}</span>
        </span>
        <span style={{ fontFamily: SERIF, fontSize: 20, fontWeight: 800, color: tone, flexShrink: 0 }}>
          {score}<small style={{ fontSize: 12.5, color: HJ.mute, marginLeft: 2, fontWeight: 700 }}>점</small>
        </span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={HJ.ink2} strokeWidth="2" strokeLinecap="round" aria-hidden="true"
          style={{ flexShrink: 0, transition: 'transform .2s', transform: expanded ? 'rotate(180deg)' : 'none' }}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ padding: '0 18px 20px' }}>
              <p style={{ fontSize: 14, color: HJ.ink2, lineHeight: 1.65, paddingTop: 12, borderTop: '1px dashed var(--hj-rule-2)', wordBreak: 'keep-all' }}>
                {friendlyRole(괘의미)}
              </p>

              {전통해석 && (
                <Note gold style={{ marginTop: 14 }}>
                  <span style={{ fontFamily: SERIF, fontSize: 16.5, fontWeight: 700, lineHeight: 1.65 }}>{stripMd(전통해석)}</span>
                </Note>
              )}

              <p
                style={{ marginTop: 14, fontSize: 15.5, lineHeight: 1.82, color: HJ.ink, wordBreak: 'keep-all' }}
                dangerouslySetInnerHTML={{ __html: sanitizeAiText(String(현대해석 || '')) }}
              />

              {(todo || avoid) && (
                <YiGi
                  good={todo ? [stripMd(todo)] : []}
                  bad={avoid ? [stripMd(avoid)] : []}
                  goodLabel="할 일"
                  badLabel="피할 일"
                  style={{ marginTop: 16 }}
                />
              )}

              {((goodDays && goodDays.length > 0) || (cautionDays && cautionDays.length > 0)) && (
                <div style={{ marginTop: 14, display: 'grid', gap: 8 }}>
                  {goodDays && goodDays.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                      <span style={{ fontSize: 13.5, fontWeight: 700, color: HJ.ink2, minWidth: 62 }}>좋은 날</span>
                      {goodDays.map((d) => <Tag key={`g${d}`} gold>{d}</Tag>)}
                    </div>
                  )}
                  {cautionDays && cautionDays.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                      <span style={{ fontSize: 13.5, fontWeight: 700, color: HJ.ink2, minWidth: 62 }}>조심할 날</span>
                      {cautionDays.map((d) => <Tag key={`c${d}`} seal>{d}</Tag>)}
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
