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
import { Pictogram, type TopicKey } from '@/components/brand/PictogramRegistry';
import { TOPIC_REGISTRY, type TopicId } from '@/constants/topics';
import { getTopicPrice, formatPriceLabel } from '@/constants/pricing';

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
}

const C = {
  gold: '#B8965A',
  goldDeep: '#8C6D3D',
  ink: '#1A1A1A',
  mute: '#7A7269',
  line: 'rgba(184,150,90,0.22)',
};

export function NextStepsCard({ topics, questions, onTopic, onAsk, title = '이 풀이에서 이어지는 이야기' }: Props) {
  const tps = (topics || []).filter((t) => t && (TOPIC_REGISTRY as Record<string, unknown>)[t.id] && t.hook?.trim()).slice(0, 2);
  const qs = (questions || []).filter((q) => typeof q === 'string' && q.trim()).slice(0, 3);
  if (tps.length === 0 && qs.length === 0) return null;

  return (
    <section
      aria-label={title}
      style={{
        background: '#FFFDF8',
        border: `1px solid ${C.line}`,
        borderRadius: 16,
        padding: '18px 16px 14px',
        boxShadow: '0 4px 16px rgba(184,150,90,0.10)',
      }}
    >
      <p style={{ fontSize: 13, color: C.goldDeep, fontWeight: 800, marginBottom: 4 }}>이어서 보면 좋은 것</p>
      <p style={{ fontFamily: "'Noto Serif KR', serif", fontSize: 17, fontWeight: 800, color: C.ink, letterSpacing: '-0.01em', marginBottom: 12 }}>
        {title}
      </p>

      {tps.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: qs.length > 0 ? 16 : 0 }}>
          {tps.map((t) => {
            const meta = TOPIC_REGISTRY[t.id as TopicId];
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onTopic(t.id as TopicId)}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10, textAlign: 'left',
                  background: '#fff', border: `1px solid ${C.line}`, borderRadius: 12,
                  padding: '12px 12px', minHeight: 56, cursor: 'pointer', width: '100%',
                }}
              >
                <span style={{ flexShrink: 0, marginTop: 1 }}>
                  <Pictogram k={`topic:${t.id as TopicKey}`} size={22} color={meta.color} />
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 3 }}>
                    <span style={{ fontSize: 14, fontWeight: 800, color: C.ink }}>{meta.label}</span>
                    <span style={{ fontSize: 13, color: C.mute }}>{formatPriceLabel(getTopicPrice(t.id))}</span>
                  </span>
                  <span style={{ display: 'block', fontSize: 13, color: '#3D3D3D', lineHeight: 1.55, wordBreak: 'keep-all' }}>{t.hook}</span>
                </span>
                <span aria-hidden style={{ flexShrink: 0, color: C.gold, fontSize: 16, marginTop: 2 }}>›</span>
              </button>
            );
          })}
        </div>
      )}

      {qs.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span
              aria-hidden
              style={{
                width: 24, height: 24, borderRadius: 8, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(184,150,90,0.14)', color: C.goldDeep, fontFamily: "'Noto Serif KR', serif", fontWeight: 900, fontSize: 13,
              }}
            >
              問
            </span>
            <span style={{ fontSize: 13.5, fontWeight: 800, color: C.ink }}>이 결과로 바로 물어보기</span>
            <span style={{ fontSize: 13, color: C.mute }}>사주대화</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {qs.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => onAsk(q)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left', width: '100%',
                  background: 'rgba(184,150,90,0.07)', border: '1px solid rgba(184,150,90,0.16)', borderRadius: 10,
                  padding: '10px 12px', minHeight: 44, cursor: 'pointer',
                }}
              >
                <span style={{ flex: 1, fontSize: 13, color: '#3D3D3D', lineHeight: 1.5, wordBreak: 'keep-all' }}>“{q}”</span>
                <span aria-hidden style={{ flexShrink: 0, fontSize: 13, fontWeight: 700, color: C.goldDeep }}>물어보기</span>
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
