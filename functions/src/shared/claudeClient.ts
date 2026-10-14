/**
 * Claude 연결 SSOT (2026-10-14 · 4.6 세대 → 5.5 세대 전환)
 *
 *   모든 AI 함수는 `new Anthropic(...)` 대신 `createClaude(apiKey)` 로 연결한다.
 *   모델별 요청 규칙을 여기 한 곳에서 맞추고, 각 콘텐츠 파일은 모델 이름(CLAUDE_MODEL)만 고른다.
 *
 *   5.5 세대가 바뀐 점 (공식 문서 2026-10 기준)
 *     - temperature, top_p, top_k 를 기본값 이외로 보내면 400 → 여기서 지운다 (같은 사주 같은 결과는 저장본 재사용으로 보장)
 *     - 응답 앞에 thinking 블록이 올 수 있다 → 일반 호출은 본문(text) 블록만 남겨 돌려준다 (기존 content[0].text 코드 그대로 동작)
 *     - 생각 단계: Opus 5.5 는 끌 수 없음(effort 로 양 조절), Sonnet 5.5 는 'between_tools' 로 미리 생각 끔, Haiku 5.5 는 'disabled'
 *     - 생각 토큰도 max_tokens 와 출력 요금에 포함, 새 토크나이저는 한글 출력이 약 10% 더 많음 → 상한을 여유 있게 올린다(청구는 실제 사용량만)
 *
 *   같은 사주 A/B 실측 (scratchpad 시험, 2026-10-14)
 *     종합사주 Opus 4.6 115초 927원 → Opus 5.5 medium 121초 약 1,270원(캐시 쓰기 포함), 명리 사실관계 더 정확, 분량 같음
 *       (low 는 57초 674원이지만 실천과 월별 지침이 얕아져 간판 상품엔 medium)
 *     직업운 Sonnet 4.6 117초 287원 → Sonnet 5.5(미리 생각 끔, high) 41초 175원
 *     사주대화 18초 54원 → 7초 34원 / 오늘의 운세 머리 Haiku 40원 → 4원, 본문 29초 → 14초
 *     ⚠️ Sonnet 5.5 를 생각 켬(adaptive) + high 로 긴 JSON 을 만들면 생각에 상한을 다 써 본문이 빈다(실측 2회) → 기본은 between_tools
 */
import Anthropic from '@anthropic-ai/sdk';

export const CLAUDE_MODEL = {
  opus: 'claude-opus-5-5',
  sonnet: 'claude-sonnet-5-5',
  haiku: 'claude-haiku-5-5',
} as const;

export type ClaudeEffort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';
export type ClaudeThinking = { type: 'adaptive' | 'between_tools' | 'disabled' };

/** 사주대화, 오늘의 운세 본문처럼 짧고 대화형인 호출 — 생각 켬(필요할 때만 생각) + medium (실측에서 문단과 깊이가 가장 좋았다) */
export const CONVERSATIONAL: { thinking: ClaudeThinking; output_config: { effort: ClaudeEffort } } = {
  thinking: { type: 'adaptive' },
  output_config: { effort: 'medium' },
};

const ADAPTED = Symbol('claudeAdapted');

/** 모델별 기본값 — 호출부가 thinking, output_config 를 직접 넘기면 그 값을 쓴다 */
function adapt<T extends Record<string, any>>(params: T): T {
  if (!params || (params as any)[ADAPTED]) return params;
  const p: any = { ...params };
  const m = String(p.model || '');
  delete p.temperature;
  delete p.top_p;
  delete p.top_k;
  const mt = Number(p.max_tokens) || 4096;
  if (m.startsWith('claude-opus-5')) {
    p.output_config = p.output_config ?? { effort: 'medium' };
    // 생각 단계가 항상 켜져 있다 — medium 실측 그룹당 생각 포함 최대 약 1.3만 토큰
    p.max_tokens = Math.min(64000, Math.ceil(mt * 1.2) + 16000);
  } else if (m.startsWith('claude-sonnet-5')) {
    p.thinking = p.thinking ?? { type: 'between_tools' };
    p.output_config = p.output_config ?? { effort: 'high' };
    p.max_tokens = Math.ceil(mt * 1.2) + (p.thinking.type === 'adaptive' ? 8000 : 0);
  } else if (m.startsWith('claude-haiku-5')) {
    p.thinking = p.thinking ?? { type: 'disabled' };
    p.output_config = p.output_config ?? { effort: 'medium' };
    p.max_tokens = Math.ceil(mt * 1.2) + (p.thinking.type === 'adaptive' ? 8000 : 0);
  }
  // 스트림은 SDK 안에서 create(stream:true) 를 한 번 더 거친다 → 두 번 바꾸지 않게 표시 (Symbol 키는 요청 본문에 실리지 않음)
  Object.defineProperty(p, ADAPTED, { value: true, enumerable: true });
  return p;
}

/** 일반 호출 응답에서 thinking 블록을 걷어 본문 블록만 남긴다 */
function onlyText(msg: any): any {
  if (msg && Array.isArray(msg.content)) {
    msg.content = msg.content.filter((b: any) => b && b.type === 'text');
  }
  return msg;
}

export function createClaude(apiKey: string): Anthropic {
  // 2026-10-14 요청이 몰릴 때 429 대비 재시도 5회(기본 2회는 1.5초뿐)
  const client = new Anthropic({ apiKey, maxRetries: 5 });
  const messages: any = client.messages;
  const create = messages.create.bind(messages);
  const stream = messages.stream.bind(messages);
  messages.create = (params: any, options?: any) => {
    const p = adapt(params);
    const res = create(p, options);
    // stream:true 는 SDK 스트림이 쓰는 APIPromise(.withResponse) 를 그대로 돌려줘야 한다
    return p.stream ? res : res.then(onlyText);
  };
  messages.stream = (params: any, options?: any) => stream(adapt(params), options);
  return client;
}
