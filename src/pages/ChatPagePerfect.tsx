// ChatPagePerfect — byte-perfect mockup 복제
// 출처: D:/550saju/docs/mockups/사주500_UI개편_목업_사주대화.html
// 방식: 전체 mockup HTML 을 template literal 로 embed
//   - iframe srcDoc 으로 isolated 렌더 (mockup 글로벌 CSS 가 앱 다른 부분에 영향 없음)
//   - 한 글자도 수정 안 함 (class / inline style / hex 색상 / 폰트 / 픽셀 그대로)

const MOCKUP_HTML = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>사주500 — 사주대화 목업</title>
<link href="https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@400;500;600;700&family=Pretendard:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }
  html, body { background: #0a0a0a; font-family: 'Pretendard', sans-serif; color: #1a1a1a; letter-spacing: -0.01em; height: 100%; }
  .page { max-width: 480px; margin: 0 auto; background: #faf8f3; min-height: 100vh; box-shadow: 0 0 80px rgba(0,0,0,.4); display: flex; flex-direction: column; }

  /* Header */
  .hd {
    background: linear-gradient(180deg, #1a1a1a 0%, #2a2520 100%);
    color: #fff; padding: 14px 16px; display: flex; align-items: center; gap: 12px;
    border-bottom: 1px solid rgba(212,175,55,.3); position: sticky; top: 0; z-index: 10;
  }
  .hd .back { font-size: 20px; opacity: .8; cursor: pointer; }
  .hd .ttl { flex: 1; }
  .hd .ttl .nm { font-family: 'Noto Serif KR', serif; font-size: 14px; font-weight: 600; }
  .hd .ttl .sb { font-size: 10.5px; color: #f4d166; margin-top: 2px; letter-spacing: 0.05em; }
  .hd .tickets { background: rgba(212,175,55,.15); padding: 5px 10px; border-radius: 100px; font-size: 11px; color: #f4d166; font-weight: 600; display: flex; align-items: center; gap: 4px; }

  /* 컨텍스트 카드 — 어떤 사주를 두고 대화 중인지 */
  .ctx {
    margin: 12px 16px 0; background: rgba(212,175,55,.08); border: 1px solid rgba(212,175,55,.25);
    border-radius: 10px; padding: 10px 12px; font-size: 11.5px; color: #6a5d3f; display: flex; gap: 8px; align-items: center;
  }
  .ctx .han { font-family: 'Noto Serif KR', serif; color: #B8965A; font-size: 14px; font-weight: 600; }

  /* 채팅 영역 */
  .chat { flex: 1; padding: 16px; display: flex; flex-direction: column; gap: 14px; overflow-y: auto; }
  .msg { max-width: 85%; }
  .msg.user { align-self: flex-end; background: #1a1a1a; color: #fff; padding: 12px 14px; border-radius: 16px 16px 4px 16px; font-size: 14px; line-height: 1.6; }
  .msg.ai { align-self: flex-start; }
  .msg.ai .label { display: flex; gap: 6px; align-items: center; font-size: 10px; color: #B8965A; margin-bottom: 6px; font-weight: 600; letter-spacing: 0.1em; }
  .msg.ai .label .han { font-family: 'Noto Serif KR', serif; font-size: 14px; font-weight: 700; }
  .msg.ai .bubble { background: #fff; padding: 14px 16px; border-radius: 4px 16px 16px 16px; font-size: 14px; line-height: 1.75; color: #2a2520; box-shadow: 0 2px 8px rgba(0,0,0,.04); border: 1px solid #ebe4d2; word-break: keep-all; }
  .msg.ai .bubble strong { font-weight: 600; background: linear-gradient(180deg, transparent 60%, rgba(212,175,55,.25) 60%); padding: 0 2px; color: #1a1a1a; }
  .msg.ai .bubble .han { font-family: 'Noto Serif KR', serif; color: #6a5d3f; font-size: 13px; }
  .msg.ai .bubble p { margin-bottom: 10px; }
  .msg.ai .bubble p:last-child { margin-bottom: 0; }

  /* 시간 스탬프 */
  .ts { font-size: 10px; color: #8a7d5f; text-align: center; margin: 4px 0 -4px; }

  /* 인용 — 사용자가 풀이 일부를 인용하며 질문한 경우 */
  .quoted {
    background: rgba(212,175,55,.08); border-left: 2px solid #B8965A;
    padding: 6px 10px; border-radius: 4px; font-size: 11.5px; color: #6a5d3f;
    margin-bottom: 8px; font-style: italic;
  }

  /* Suggested follow-ups */
  .followups { display: flex; flex-direction: column; gap: 6px; margin-top: 10px; }
  .followups .chip { background: rgba(184,148,31,.08); border: 1px solid rgba(184,148,31,.25); border-radius: 100px; padding: 8px 14px; font-size: 12px; color: #6a5d3f; cursor: pointer; text-align: left; }

  /* 입력바 */
  .input-bar {
    background: #fff; border-top: 1px solid #ebe4d2; padding: 12px 16px;
    display: flex; gap: 8px; align-items: center; position: sticky; bottom: 0;
  }
  .input-bar input { flex: 1; background: #faf8f3; border: 1px solid #ebe4d2; border-radius: 100px; padding: 10px 16px; font-size: 14px; font-family: 'Pretendard', sans-serif; outline: none; }
  .input-bar input::placeholder { color: #8a7d5f; }
  .input-bar .send { width: 40px; height: 40px; background: linear-gradient(135deg, #f4d166, #B8965A); border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; }
  .input-bar .send svg { width: 18px; height: 18px; color: #1a1a1a; }
  .input-bar .ticket-cost {
    position: absolute; right: 16px; top: -10px;
    background: #1a1a1a; color: #f4d166; padding: 3px 10px; border-radius: 100px; font-size: 10px; font-weight: 600;
  }

  /* 충전 모달 트리거 — 0운/대화권 부족 시 */
  .empty-modal {
    margin: 12px 16px; background: linear-gradient(135deg, #1a1a1a, #2a2520); color: #fff;
    border-radius: 12px; padding: 16px; text-align: center;
  }
  .empty-modal h4 { font-family: 'Noto Serif KR', serif; font-size: 15px; margin-bottom: 4px; }
  .empty-modal p { font-size: 12px; color: #c4baa0; margin-bottom: 12px; }
  .empty-modal .cta { display: inline-block; background: linear-gradient(135deg, #f4d166, #B8965A); color: #1a1a1a; padding: 8px 18px; border-radius: 100px; font-size: 12px; font-weight: 700; }

  .verify-tag { display: inline-block; font-size: 9px; color: #B8965A; background: rgba(184,148,31,.12); padding: 2px 8px; border-radius: 100px; margin: 8px 16px 0; letter-spacing: 0.05em; }
</style>
</head>
<body>
<div class="page">

  <!-- ── HEADER ─────────────── -->
  <header class="hd">
    <div class="back">←</div>
    <div class="ttl">
      <div class="nm">사주대화</div>
      <div class="sb">변준기 님 사주 기준 · 갑(甲) 일간</div>
    </div>
    <div class="tickets">대화권 5</div>
  </header>

  <!-- ── 컨텍스트 ─────────────── -->
  <div class="ctx">
    <span class="han">命</span>
    <span><strong>변준기 (1995.05.12 양 묘시)</strong> 사주를 살피며 대화 중</span>
  </div>

  <!-- ── 채팅 ─────────────── -->
  <main class="chat">

    <div class="ts">2026.04.20 14:32</div>

    <div class="msg user">
      종합 사주에서 9월에 새로운 일 시작하지 말라고 했는데, 그게 정확히 뭐 때문이야?
    </div>

    <div class="msg ai">
      <div class="label"><span class="han">命</span><span>사주를 살피는 중…</span></div>
      <div class="bubble">
        <p>
          9월은 <strong>오오(午午) 자형(自刑)</strong>이 가장 강하게 발동하는 달이에요. 자형은 같은 글자 둘이 만나서 <strong>자기 자신을 자기가 들들 볶는 자리</strong>입니다. 준기 님 일지가 <span class="han">午</span>인데, 9월의 월지에 또 <span class="han">午</span>가 와요.
        </p>
        <p>
          이게 실생활에선 어떻게 느껴지냐면 — <strong>"분명 잘 풀리고 있는데 자꾸 내가 의심된다"</strong>는 패턴으로 와요. 새 프로젝트 결정을 내려놓고 다음 날 뒤집고, 한 번 더 뒤집고. 외부 운이 나쁜 게 아니라 <strong>내 안의 결정이 흔들리는 시기</strong>입니다.
        </p>
        <p>
          그래서 새 시작은 <strong>8월 말까지 마무리</strong>하거나 <strong>10월 이후로</strong>. 9월은 이미 시작한 일을 안정적으로 굴리는 데 쓰면 1년 점수가 올라갑니다.
        </p>
      </div>
      <div class="followups">
        <div class="chip">→ 그럼 9월 안에 꼭 해야 할 일이 있다면 어떡하지?</div>
        <div class="chip">→ 자형(自刑)은 매년 오는 거야?</div>
        <div class="chip">→ 9월에 사람 만나는 것도 조심해야 해?</div>
      </div>
    </div>

    <div class="ts">2026.04.20 14:34</div>

    <div class="msg user">
      <div class="quoted">"5월에 만나는 사람이 1년 내내 갈 인연" — 이 부분</div>
      이건 사업 파트너 같은 거야 아니면 그냥 친구도 포함이야?
    </div>

    <div class="msg ai">
      <div class="label"><span class="han">命</span><span>사주를 살피는 중…</span></div>
      <div class="bubble">
        <p>
          사주에서 5월 인연이 강하게 들어오는 건 <strong>5월 월지가 사(巳)</strong>이고, 이게 준기 님 일지 <span class="han">午</span>와 <strong>사오 합(巳午合)</strong>을 이루기 때문이에요. 합(合)은 <strong>"맞물리는 결"</strong>이라 뜻이라, 어떤 관계든 <strong>오래 가는 형태</strong>로 들어옵니다.
        </p>
        <p>
          종류로 따지면 <strong>사업 파트너·동료·친구·연인 모두 가능</strong>해요. 하지만 한 가지 공통점이 있어요. <strong>"이미 시작된 관계가 5월에 한 단계 더 깊어진다"</strong>는 패턴이 흔합니다. 아예 새 사람보다, 기존에 알던 사람과 5월에 결정적인 한 끼·한 대화를 하게 되는 거죠.
        </p>
        <p>
          그래서 5월에는 <strong>약속을 미루지 말 것</strong>이 가장 중요합니다. 별거 아닌 점심 한 번이 1년 내내 기억나는 자리가 될 수 있어요.
        </p>
      </div>
    </div>

    <div class="ts">방금 전</div>

  </main>

  <!-- ── 입력바 ─────────────── -->
  <div class="input-bar">
    <input type="text" placeholder="궁금한 걸 물어보세요…">
    <div class="send">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
    </div>
    <div class="ticket-cost">대화권 1개 차감</div>
  </div>

  <span class="verify-tag">✓ 자체감사: 스트리밍 X · "AI 분석 중" X → "사주를 살피는 중" · 1운=3대화권 · 답변 후 차감</span>
</div>
</body>
</html>
`;

export function ChatPagePerfect() {
  return (
    <iframe
      srcDoc={MOCKUP_HTML}
      title="사주500 — 사주대화 목업"
      style={{
        width: '100%',
        height: '100vh',
        border: 'none',
        display: 'block',
        margin: 0,
        padding: 0,
      }}
    />
  );
}
