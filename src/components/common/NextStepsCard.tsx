/**
 * NextStepsCard — 결과에서 다음 콘텐츠로 이어지는 카드 (2026-10-09)
 *
 * 배경 (30일 실측): 결과 페이지에서 다른 콘텐츠로 넘어가는 클릭이 거의 0 —
 *   주제 결과 하단 '다른 운세도 궁금하다면'은 이름·가격만 있는 타일, 사주대화는 공유 버튼 옆 작은 버튼이었다.
 * 해법: 이 사람의 결과 내용에서 나온 연결 문장(서버 AI · nextHooks)을 보여준다.
 *   - 주제 연결: "이 결과에서 이어지는 궁금증 + 그 주제에서 알 수 있는 것" (최대 2)
 *   - 사주대화: 이 결과를 읽은 사람이 바로 물어볼 질문 3개 → 누르면 결과를 들고 사주대화로 가서 바로 질문
 * 데이터가 없으면(구 결과·생성 실패) 아무것도 렌더하지 않는다.
 */
import { TOPIC_REGISTRY, type TopicId } from '@/constants/topics';
import { getTopicPrice } from '@/constants/pricing';
import { trackEvent } from '@/services/analytics';
import { topicFactOf } from '@/services/saju/topicFacts';
import type { SajuData } from '@/types/saju';

export interface NextTopicHook {
  id: string;
  hook: string;
}

interface Props {
  topics?: NextTopicHook[];
  questions?: string[];
  onTopic: (id: TopicId) => void;
  onAsk: (question: string) => void;
  /** 카드 머리말 (기본: 이 풀이에서 이어지는 이야기) */
  title?: string;
  /** 2026-10-27 어느 결과에서 눌렀는지 (next_click 기록, 'daily', 'topic_love' 등) */
  from?: string;
  /** 2026-10-27 이 사람 사주 — 주제마다 만세력 사실과 남은 날(홈 고민 칸과 같은 계산) */
  sajuData?: SajuData | null;
}

/* 2026-10-27 v9 수묵 고서로 다시 그림(예전 금색 테두리, 주제 색 그림 폐기) — 홈 고민 위 두 칸과 같은 모양.
 *   빨간 도장 글자, 이름과 값, AI 연결 문장, 사실 한 줄, 오른쪽 남은 날 큰 숫자 */
const C = { ink: '#1A1612', ink2: '#4B4238', mute: '#6F6557', line: '#E1D7C4', card: '#FFFDF8', seal: '#A23A2A', paper: '#F4EFE4' };
const SERIF = "'Noto Serif KR', serif";

export function NextStepsCard({ topics, questions, onTopic, onAsk, title = '이 풀이에서 이어지는 이야기', from = 'result', sajuData }: Props) {
  const tps = (topics || []).filter((t) => t && (TOPIC_REGISTRY as Record<string, unknown>)[t.id] && t.hook?.trim()).slice(0, 2);
  const qs = (questions || []).filter((q) => typeof q === 'string' && q.trim()).slice(0, 3);
  if (tps.length === 0 && qs.length === 0) return null;
  const goTopic = (id: string, i: number) => { trackEvent('next_click', { from, to: id, kind: 'topic', pos: i + 1 }); onTopic(id as TopicId); };
  const goAsk = (q: string, i: number) => { trackEvent('next_click', { from, to: 'chat', kind: 'question', pos: i + 1 }); onAsk(q); };

  return (
    <section aria-label={title} style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 16, padding: '18px 16px 14px' }}>
      <p style={{ fontSize: 13, color: C.mute, fontWeight: 700, marginBottom: 2 }}>이어서 보면 좋은 것</p>
      <p style={{ fontFamily: SERIF, fontSize: 19, fontWeight: 700, color: C.ink, letterSpacing: '-0.02em', marginBottom: 12, wordBreak: 'keep-all' }}>
        {title}
      </p>

      {tps.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: qs.length > 0 ? 18 : 0 }}>
          {tps.map((t, i) => {
            const meta = TOPIC_REGISTRY[t.id as TopicId];
            const fact = topicFactOf(sajuData, t.id);
            const days = fact?.days;
            const hasDays = typeof days === 'number' && days > 0 && days <= 400;
            return (
              <button key={t.id} type="button" onClick={() => goTopic(t.id, i)} className="mo-press"
                style={{ display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', background: '#fff', border: `1px solid ${C.line}`, borderRadius: 14, padding: '13px 14px', minHeight: 64, cursor: 'pointer', width: '100%' }}>
                <span aria-hidden="true" style={{ width: 40, height: 40, borderRadius: 6, background: C.seal, color: C.paper, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: SERIF, fontSize: 22, fontWeight: 900, flexShrink: 0 }}>
                  {meta.kanji}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ fontFamily: SERIF, fontSize: 16.5, fontWeight: 700, color: C.ink }}>{meta.label}</span>
                    {!hasDays && <span style={{ fontSize: 13.5, fontWeight: 800, color: C.ink2 }}>{getTopicPrice(t.id).actualPrice}운</span>}
                  </span>
                  <span style={{ display: 'block', fontSize: 14, color: C.ink2, lineHeight: 1.6, marginTop: 3, wordBreak: 'keep-all' }}>{t.hook}</span>
                  {fact && <span style={{ display: 'block', fontSize: 13.5, color: C.ink, fontWeight: 700, lineHeight: 1.5, marginTop: 4, wordBreak: 'keep-all' }}>{fact.line}</span>}
                </span>
                {hasDays ? (
                  <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0, paddingLeft: 10, borderLeft: `1px solid ${C.line}` }}>
                    <span style={{ fontSize: 13, color: C.mute, fontWeight: 700 }}>남은 날</span>
                    <span style={{ fontFamily: SERIF, fontWeight: 900, color: C.ink, lineHeight: 1.05 }}>
                      <span style={{ fontSize: 28 }}>{days}</span><span style={{ fontSize: 13.5, fontWeight: 700 }}>일</span>
                    </span>
                    <span style={{ fontSize: 13.5, fontWeight: 800, color: C.ink2, marginTop: 2, whiteSpace: 'nowrap' }}>{getTopicPrice(t.id).actualPrice}운 ›</span>
                  </span>
                ) : (
                  <span aria-hidden style={{ flexShrink: 0, color: C.ink2, fontSize: 18 }}>›</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {qs.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span aria-hidden style={{ width: 26, height: 26, borderRadius: 5, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: C.ink, color: C.paper, fontFamily: SERIF, fontWeight: 900, fontSize: 14 }}>
              問
            </span>
            <span style={{ fontSize: 14.5, fontWeight: 800, color: C.ink }}>이 결과로 바로 물어보기</span>
            <span style={{ fontSize: 13, color: C.mute }}>사주대화</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {qs.map((q, i) => (
              <button key={q} type="button" onClick={() => goAsk(q, i)} className="mo-press"
                style={{ display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', width: '100%', background: C.paper, border: `1px solid ${C.line}`, borderRadius: 10, padding: '11px 12px', minHeight: 46, cursor: 'pointer' }}>
                <span style={{ flex: 1, fontSize: 14, color: C.ink, lineHeight: 1.55, wordBreak: 'keep-all' }}>“{q}”</span>
                <span aria-hidden style={{ flexShrink: 0, fontSize: 13.5, fontWeight: 800, color: C.ink }}>물어보기 ›</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

/** 결과(콘텐츠 컨텍스트)를 들고 사주대화를 열고, 질문이 있으면 도착하자마자 그 질문을 보낸다 */
export async function openChatWithResult(args: {
  navigate: (to: string, opts?: { state?: unknown }) => void;
  name: string;
  profile?: unknown;
  ctx: { type: string; label?: string; fullResult?: unknown; [k: string]: unknown };
  question?: string;
}): Promise<void> {
  const { createChatRoom } = await import('@/services/storage/chatStore');
  const room = createChatRoom(args.name || '나', 'free', args.ctx as any);
  args.navigate(`/chat/${room.id}`, {
    state: { profile: args.profile, contentContext: args.ctx, ...(args.question ? { autoAsk: args.question } : {}) },
  });
}
