/**
 * Opus 4.6 vs Sonnet 4.6 A/B 비교 러너 (Task #61)
 *
 * 목적:
 *   - claudeReport.ts 의 메인 모델(`claude-opus-4-6`) vs 대안(`claude-sonnet-4-6`) 출력 품질 비교
 *   - 퀄리티 다운그레이드 금지 원칙(CLAUDE.md) 준수 검증
 *   - 3가지 사주 원국 (신강/신약/중화 + 식상/편관/정재) 으로 다각 검증
 *
 * 실행 방법:
 *   ANTHROPIC_API_KEY=sk-... npx tsx scripts/ab-test/run.ts
 *
 * 출력물:
 *   - JSON 원시 응답: scripts/ab-test/out/{fixture}_{model}.json
 *   - 비교 리포트:    scripts/ab-test/out/report.md
 *
 * 주의:
 *   - API 사용량 상당 (6회 호출 × 16k tokens)
 *   - 10~15분 소요 가능
 *   - 벤치 결과는 자동 평가 + 사람 리뷰 필수 (CLAUDE.md 원칙 4)
 */

import Anthropic from '@anthropic-ai/sdk';
import { writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { FIXTURES } from './fixtures';

// ─────────────────────────────────────────────────────────────
// 환경 설정
// ─────────────────────────────────────────────────────────────

const API_KEY = process.env.ANTHROPIC_API_KEY;
if (!API_KEY) {
  console.error('❌ ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다.');
  process.exit(1);
}

const MODELS = [
  { id: 'claude-opus-4-6', label: 'Opus 4.6 (main)' },
  { id: 'claude-sonnet-4-6', label: 'Sonnet 4.6 (alt)' },
];

const OUT_DIR = path.resolve(__dirname, 'out');

// ─────────────────────────────────────────────────────────────
// 프롬프트 — functions/src/ai/claudeReport.ts 와 동일하게 유지
// ─────────────────────────────────────────────────────────────

function buildSystemPrompt(_sajuData: any): string {
  const year = new Date().getFullYear();
  const month = new Date().getMonth() + 1;
  return `당신은 명리학(命理學) 40년 대가입니다. "자평진전", "적천수", "궁통보감", "연해자평", "명리정종", "삼명통회" 6대 원전에 정통한 전문가로서, 정통 명리학 분석 프레임워크에 따라 체계적으로 사주를 해석합니다.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## ⭐ 분석 프레임워크 (반드시 이 순서)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
### STEP 1. 일간 강약(身强/身弱) 정밀 판단
득령·득지·득세 3축 중 2축 이상이면 신강.
### STEP 2. 격국(格局) 판단
월지 지장간 투간 확인 → 격국명 결정.
### STEP 3. 용신(用神) 도출
적천수/궁통보감 기준. 희신·기신 명시.
### STEP 4. 각 영역 해석 — 용신 기반
"[사주 요소] 때문에 → [성향]" 근거 형식 엄수.
### STEP 5. "소름 포인트"
일상 행동 → 사주 근거 연결 최소 1개.

## 출력 형식 (JSON)
{
  "sections": [
    {"id":"summary","title":"종합 진단","keyInsight":"...","content":"500자+"},
    {"id":"structure","title":"격국과 일간 분석","keyInsight":"...","content":"500자+"},
    {"id":"personality","title":"성격과 기질","keyInsight":"...","content":"400자+"},
    {"id":"social","title":"대인관계","keyInsight":"...","content":"400자+"},
    {"id":"career","title":"직업과 적성","keyInsight":"...","content":"400자+"},
    {"id":"wealth","title":"재물운","keyInsight":"...","content":"400자+"},
    {"id":"love","title":"애정운","keyInsight":"...","content":"400자+"},
    {"id":"health","title":"건강운","keyInsight":"...","content":"400자+"},
    {"id":"year${year}","title":"${year}년 운세","keyInsight":"...","content":"500자+"},
    {"id":"daeun","title":"대운 흐름","keyInsight":"...","content":"400자+"},
    {"id":"mission","title":"인생 과제","keyInsight":"...","content":"400자+"},
    {"id":"luck","title":"개운법","keyInsight":"...","content":"400자+"}
  ],
  "analysisBase": {"격국":"O격","일간강약":"신강/신약/중화","용신":"O행","용신근거":"한 줄","희신":"O","기신":"O"},
  "scores": {"career":0-100,"love":0-100,"wealth":0-100,"social":0-100,"health":0-100,"potential":0-100},
  "luckyProfile": {"colors":["#hex","#hex"],"colorNames":["",""],"numbers":[0,0],"direction":"","day":"","foods":["","",""],"element":""},
  "careerFit": [{"job":"","score":0,"reason":""}],
  "monthlyFortune": [{"month":1,"score":0}],
  "relationshipMap": {"work":{"score":0,"keyword":""},"friend":{"score":0,"keyword":""},"lover":{"score":0,"keyword":""}},
  "wealthFlow": {"earning":{"score":0,"style":""},"spending":{"score":0,"style":""},"saving":{"score":0,"style":""}}
}

## ⚠️ 작성 규칙
1. 마크다운 서식(**볼드**, # 헤딩) 금지. 순수 한국어.
2. 한자 등장 시 한국어 병기 ("정관(正官)").
3. '${year}년 운세'는 현재 ${month}월 기준 시제 구분.
4. analysisBase/luckyProfile 모든 항목은 용신 오행 기반.
JSON만 출력 (코드블록 없이).`;
}

function buildUserPrompt(sajuData: any, situation?: any): string {
  const p = sajuData.pillars || [];
  const today = new Date();
  const dateStr = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`;

  const labels = ['년주', '월주', '일주', '시주'];
  let pillarsText = '';
  const order = p[3]?.available ? [3, 2, 1, 0] : [2, 1, 0];
  for (const i of order) {
    const x = p[i];
    if (x?.available !== false) {
      pillarsText += `  ${labels[i]}: ${x.천간}(${x.천간읽기}, ${x.천간오행}) ${x.지지}(${x.지지읽기}, ${x.지지오행})\n`;
    }
  }

  const el = sajuData.elements || {};
  const elText = Object.entries(el).map(([k, v]) => `${k}: ${v}개`).join(', ');

  const sipsungText = (sajuData.sipsung || []).map((s: any) => `${s.position}: ${s.글자}(${s.십성})`).join('\n  ');
  const jijangganText = (sajuData.jijanggan || []).map((j: any) => `${j.지지}: [${j.지장간.join(', ')}] → [${j.십성.join(', ')}]`).join('\n  ');
  const unyoungText = (sajuData.unyoung12 || []).map((u: any) => `${u.position}:${u.운성}`).join(', ');

  const ma = sajuData.myeongriAnalysis;
  const myeongri = ma ? `
## 명리학 핵심 분석 참고
일간: ${ma.일간} (${ma.일간오행}) / 월령: ${ma.월령} (${ma.월령오행}) / 득령: ${ma.득령 ? '✓' : '✗'}
일간 강약: ${ma.일간강약} [${ma.강약근거}]
십성 분포: 비겁${ma.십성분포.비겁} 식상${ma.십성분포.식상} 재성${ma.십성분포.재성} 관성${ma.십성분포.관성} 인성${ma.십성분포.인성}
형충합: ${ma.형충합?.length ? ma.형충합.map((h: any) => h.desc).join(' / ') : '없음'}` : '';

  const daeun = sajuData.currentDaeun ? `${sajuData.currentDaeun.간지} (${sajuData.currentDaeun.시작나이}~${sajuData.currentDaeun.끝나이}세)` : '미상';

  return `아래 사주 원국 분석. 현재: ${dateStr}

## 사주 원국
${pillarsText}
일간: ${p[2]?.천간}(${p[2]?.천간읽기}, ${p[2]?.천간오행})
생년월일: ${sajuData.input?.birthYear}/${sajuData.input?.birthMonth}/${sajuData.input?.birthDay}
성별: ${sajuData.input?.gender === 'male' ? '남' : '여'}

## 오행 분포
${elText}

## 십성 배치
  ${sipsungText}

## 지장간
  ${jijangganText}

## 12운성
${unyoungText}
${myeongri}

## 현재 대운
${daeun}

${situation?.concern ? `## 현재 고민\n${situation.concern}` : ''}`;
}

// ─────────────────────────────────────────────────────────────
// 자동 품질 평가 메트릭
// ─────────────────────────────────────────────────────────────

interface QualityMetrics {
  totalChars: number;
  sectionCount: number;
  avgSectionLen: number;
  minSectionLen: number;
  hanjaRatio: number;        // 한자 / 총 글자 (유저 출력은 ≤5% 권장)
  markdownCount: number;     // 마크다운 금지인데 섞여있나
  emojiCount: number;        // 이모지 금지
  structureComplete: boolean; // analysisBase/scores/luckyProfile 존재
  evidencePhrases: number;   // "때문에" "~이니" 등 근거 마커
  soreumPoints: number;      // "~실 거예요" "~하시죠" 등 소름 어투
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  estCostUSD: number;
}

// 공식 가격 (2026-04 기준, 모델별 1M 토큰당 USD)
const PRICING: Record<string, { input: number; output: number }> = {
  'claude-opus-4-6': { input: 15, output: 75 },
  'claude-sonnet-4-6': { input: 3, output: 15 },
};

function evaluateQuality(parsed: any, raw: string, latencyMs: number, usage: any, model: string): QualityMetrics {
  const sections = parsed?.sections || [];
  const contents: string[] = sections.map((s: any) => s?.content || '');
  const totalChars = contents.reduce((a, b) => a + b.length, 0);
  const lens = contents.map((c) => c.length);
  const avgSectionLen = lens.length ? Math.round(totalChars / lens.length) : 0;
  const minSectionLen = lens.length ? Math.min(...lens) : 0;

  const allText = contents.join('\n');
  const hanjaChars = (allText.match(/[\u4e00-\u9fff]/g) || []).length;
  const hanjaRatio = allText.length ? +(hanjaChars / allText.length * 100).toFixed(2) : 0;

  const markdownCount = (allText.match(/\*\*[^*]+\*\*|^#{1,6}\s|`[^`]+`/gm) || []).length;
  const emojiCount = (allText.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu) || []).length;

  const structureComplete = !!(parsed?.analysisBase && parsed?.scores && parsed?.luckyProfile);
  const evidencePhrases = (allText.match(/때문에|~이니|니까|덕분에|탓에|구조이라|구조라서/g) || []).length;
  const soreumPoints = (allText.match(/실 거예요|하시죠\?|있으셨을|느끼실|들으시/g) || []).length;

  const pr = PRICING[model] || { input: 0, output: 0 };
  const inputTokens = usage?.input_tokens || 0;
  const outputTokens = usage?.output_tokens || 0;
  const estCostUSD = +(inputTokens / 1e6 * pr.input + outputTokens / 1e6 * pr.output).toFixed(4);

  return {
    totalChars,
    sectionCount: sections.length,
    avgSectionLen,
    minSectionLen,
    hanjaRatio,
    markdownCount,
    emojiCount,
    structureComplete,
    evidencePhrases,
    soreumPoints,
    latencyMs,
    inputTokens,
    outputTokens,
    estCostUSD,
  };
}

// ─────────────────────────────────────────────────────────────
// JSON 파서 (claudeReport와 동일)
// ─────────────────────────────────────────────────────────────

function parseJsonResponse(text: string): any {
  let cleaned = text.replace(/```(?:json)?\s*([\s\S]*?)```/g, '$1').trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error(`JSON 객체 없음 — 앞 200자: ${text.slice(0, 200)}`);
  try {
    return JSON.parse(jsonMatch[0]);
  } catch {
    const sanitized = jsonMatch[0]
      .replace(/,\s*([}\]])/g, '$1')
      .replace(/[\x00-\x1f\x7f]/g, (ch) => ch === '\n' ? '\\n' : ch === '\t' ? '\\t' : '');
    return JSON.parse(sanitized);
  }
}

// ─────────────────────────────────────────────────────────────
// 실행
// ─────────────────────────────────────────────────────────────

interface RunResult {
  fixtureId: string;
  fixtureDesc: string;
  model: string;
  modelLabel: string;
  ok: boolean;
  error?: string;
  metrics?: QualityMetrics;
  raw?: any;
}

async function runOne(client: Anthropic, fixture: any, model: string): Promise<RunResult> {
  const systemPrompt = buildSystemPrompt(fixture.sajuData);
  const userPrompt = buildUserPrompt(fixture.sajuData, fixture.situation);

  const t0 = Date.now();
  try {
    const msg = await client.messages.create({
      model,
      max_tokens: 16384,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });
    const latencyMs = Date.now() - t0;
    const text = (msg.content[0] as any).text;
    const parsed = parseJsonResponse(text);
    const metrics = evaluateQuality(parsed, text, latencyMs, msg.usage, model);
    return {
      fixtureId: fixture.id,
      fixtureDesc: fixture.desc,
      model,
      modelLabel: MODELS.find((m) => m.id === model)?.label || model,
      ok: true,
      metrics,
      raw: parsed,
    };
  } catch (e: any) {
    return {
      fixtureId: fixture.id,
      fixtureDesc: fixture.desc,
      model,
      modelLabel: MODELS.find((m) => m.id === model)?.label || model,
      ok: false,
      error: e?.message || String(e),
    };
  }
}

function renderMetricsTable(results: RunResult[]): string {
  const headers = ['Fixture', 'Model', 'OK', '총자', '섹션', '평균', '최소', '한자%', 'MD', '이모지', '구조', '근거', '소름', '지연(초)', '출력토큰', 'USD'];
  const rows = results.map((r) => {
    if (!r.ok || !r.metrics) return [r.fixtureId, r.modelLabel, '❌', '', '', '', '', '', '', '', '', '', '', '', '', r.error?.slice(0, 40) || ''];
    const m = r.metrics;
    return [
      r.fixtureId,
      r.modelLabel,
      '✅',
      `${m.totalChars}`,
      `${m.sectionCount}`,
      `${m.avgSectionLen}`,
      `${m.minSectionLen}`,
      `${m.hanjaRatio}`,
      `${m.markdownCount}`,
      `${m.emojiCount}`,
      m.structureComplete ? '✓' : '✗',
      `${m.evidencePhrases}`,
      `${m.soreumPoints}`,
      (m.latencyMs / 1000).toFixed(1),
      `${m.outputTokens}`,
      `$${m.estCostUSD}`,
    ];
  });
  return `| ${headers.join(' | ')} |\n|${headers.map(() => '---').join('|')}|\n${rows.map((r) => `| ${r.join(' | ')} |`).join('\n')}`;
}

function renderVerdict(results: RunResult[]): string {
  const byFixture = new Map<string, RunResult[]>();
  for (const r of results) {
    if (!byFixture.has(r.fixtureId)) byFixture.set(r.fixtureId, []);
    byFixture.get(r.fixtureId)!.push(r);
  }

  const lines: string[] = [];
  for (const [fid, pair] of byFixture) {
    const opus = pair.find((r) => r.model === 'claude-opus-4-6');
    const sonnet = pair.find((r) => r.model === 'claude-sonnet-4-6');
    if (!opus?.metrics || !sonnet?.metrics) {
      lines.push(`### ${fid}\n실패 케이스 있음 — 수동 확인 필요\n`);
      continue;
    }
    const o = opus.metrics, s = sonnet.metrics;
    const charDiff = o.totalChars - s.totalChars;
    const evidenceDiff = o.evidencePhrases - s.evidencePhrases;
    const costMult = o.estCostUSD && s.estCostUSD ? +(o.estCostUSD / s.estCostUSD).toFixed(2) : 0;
    const qualityTie = Math.abs(charDiff) < 500 && Math.abs(evidenceDiff) <= 2;
    lines.push(`### ${fid}
- 글자수 차이: Opus ${charDiff > 0 ? '+' : ''}${charDiff} vs Sonnet
- 근거 문구: Opus ${o.evidencePhrases} / Sonnet ${s.evidencePhrases}
- 소름 포인트: Opus ${o.soreumPoints} / Sonnet ${s.soreumPoints}
- 비용: Opus \$${o.estCostUSD} vs Sonnet \$${s.estCostUSD} (${costMult}× 비쌈)
- 자동 판정: ${qualityTie ? '**품질 근사** — 비용 절약 위해 Sonnet 고려 가능, 단 사람 리뷰 필수' : (charDiff > 0 || evidenceDiff > 2 ? '**Opus 우위** — 기본 유지 권장' : '**Sonnet 우위** — 재검증 필요')}
`);
  }
  return lines.join('\n');
}

async function main() {
  if (!existsSync(OUT_DIR)) await mkdir(OUT_DIR, { recursive: true });
  const client = new Anthropic({ apiKey: API_KEY });

  console.log(`\n▶ 시작: ${FIXTURES.length} 픽스쳐 × ${MODELS.length} 모델 = ${FIXTURES.length * MODELS.length} 호출\n`);

  const results: RunResult[] = [];
  for (const fx of FIXTURES) {
    for (const m of MODELS) {
      console.log(`  ${fx.id} × ${m.label} ...`);
      const r = await runOne(client, fx, m.id);
      results.push(r);
      if (r.ok) {
        await writeFile(
          path.join(OUT_DIR, `${fx.id}_${m.id}.json`),
          JSON.stringify({ metrics: r.metrics, raw: r.raw }, null, 2),
        );
        console.log(`    ✅ ${r.metrics!.totalChars}자 / ${(r.metrics!.latencyMs / 1000).toFixed(1)}s / \$${r.metrics!.estCostUSD}`);
      } else {
        console.log(`    ❌ ${r.error}`);
      }
    }
  }

  const report = `# Opus 4.6 vs Sonnet 4.6 A/B 비교 리포트

**생성 시각:** ${new Date().toISOString()}
**픽스쳐:** ${FIXTURES.length}개 · **모델:** ${MODELS.length}개 · **총 호출:** ${results.length}회

## 1. 메트릭 테이블

${renderMetricsTable(results)}

### 컬럼 설명
- **총자**: 12 섹션 content 총 글자수
- **평균/최소**: 섹션당 글자수 (목표: 400+ 평균, 300+ 최소)
- **한자%**: content 내 한자 비율 (유저 출력 목표: ≤5%)
- **MD/이모지**: 마크다운/이모지 출현 횟수 (목표: 0)
- **구조**: analysisBase+scores+luckyProfile 완성 여부
- **근거**: "때문에 / 니까 / 탓에" 등 인과 마커 횟수
- **소름**: "실 거예요 / 하시죠" 등 대화체 꿰뚫기 횟수

## 2. 케이스별 자동 판정

${renderVerdict(results)}

## 3. 운영 결론 가이드

자동 판정은 **참고용**. 최종 결정은 반드시 다음을 사람이 확인:
1. 출력 JSON을 \`out/*.json\` 에서 직접 대조 (특히 structure/personality 섹션의 실제 문체)
2. 한자 이원화 원칙 준수 여부 — 한자 풀이가 문장에 녹아있나
3. 용신 → 개운법 파생 일관성 (luckyProfile.element vs foods/colors/direction)
4. "소름 포인트" 의 구체성과 공감도 (단순 "당신은 리더십"류 금지)

**기본 정책 (2026-04 현재):** Opus 4.6 유지. Sonnet 전환은 모든 3 케이스에서
"품질 근사" 판정 + 사람 리뷰 통과 시에만. 판정 근거는 이 리포트 아카이브.

— 사주500 Task #61 (브랜드 품질 A/B 러너)
`;

  await writeFile(path.join(OUT_DIR, 'report.md'), report);
  console.log(`\n📄 리포트: scripts/ab-test/out/report.md`);
  console.log(`📦 원시: scripts/ab-test/out/*.json`);
}

main().catch((e) => {
  console.error('💥 러너 실패:', e);
  process.exit(1);
});
