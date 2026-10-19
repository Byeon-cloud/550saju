/**
 * 결과 끝 '후기 남기기' (2026-10-10)
 *   - 결과를 다 읽은 뒤에만 보인다(호출처가 완료 시점에만 렌더). 결과 1건당 한 번 — 남기거나 '다음에'를 누르면 다시 안 묻는다.
 *   - 별점 필수 · 한 줄 선택 · "홈에 익명으로 소개해도 좋아요" 체크(기본 꺼짐 — 동의는 직접 켜야).
 *   - 공개는 오너 승인 후에만 (services/reviews.ts · firestore.rules reviews).
 *   - 2026-10-19 앱(토스 안)에서는 토스 별점 창을 여는 버튼으로 바꾼다(오너: 토스 '이용 후기 남기기'로 모으자. 토스 추천 기준에 들어간다).
 *     토스가 창을 띄울지 정하고, 남겼는지는 알 수 없다 → 누르면 고맙다고만 하고 이 결과에서는 다시 안 묻는다.
 *     옛 토스 앱(별점 창 미지원)과 웹은 지금까지의 우리 후기 양식 그대로.
 */
import { useEffect, useState } from 'react';
import { isAppsInToss } from '@/services/payment/iapService';
import { submitReview, reviewHandled, markReviewHandled, type ReviewContent } from '@/services/reviews';
import { HJ, SERIF, GoldCta, Gwang } from '@/components/hanji/Hanji';

export function ReviewAsk({ contentType, contentLabel, reportKey, style }: {
  contentType: ReviewContent;
  contentLabel: string;
  /** 결과 1건을 가리키는 키 (리포트 id 등) — 같은 결과에 두 번 묻지 않는다 */
  reportKey: string;
  style?: React.CSSProperties;
}) {
  const [hidden, setHidden] = useState(() => !reportKey || reviewHandled(reportKey));
  const [rating, setRating] = useState(0);
  const [text, setText] = useState('');
  const [consent, setConsent] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState('');
  // 앱이면 토스 별점 창을 쓸 수 있는지 먼저 본다 (확인 전에는 아무것도 안 그린다 — 양식이 잠깐 보였다 바뀌지 않게)
  const [mode, setMode] = useState<'checking' | 'toss' | 'ours'>(() => (isAppsInToss() ? 'checking' : 'ours'));
  const [tossDone, setTossDone] = useState(false);
  useEffect(() => {
    if (mode !== 'checking') return;
    import('@/services/review/reviewPrompt').then((m) => m.tossReviewSupported()).then((ok) => setMode(ok ? 'toss' : 'ours')).catch(() => setMode('ours'));
  }, [mode]);

  if (hidden || mode === 'checking') return null;

  if (mode === 'toss') {
    const ask = async () => {
      markReviewHandled(reportKey, 'toss');
      setTossDone(true);
      const m = await import('@/services/review/reviewPrompt');
      const r = await m.askTossReview(`result:${contentType}`);
      if (r !== 'shown') setMode('ours'); // 토스가 못 여는 경우엔 우리 양식으로
    };
    return (
      <div style={{ margin: '24px 16px 0', ...style }}>
        <Gwang title="後 記">
          <p style={{ fontFamily: SERIF, fontSize: 18, fontWeight: 700, color: HJ.ink, textAlign: 'center', lineHeight: 1.45 }}>
            {tossDone ? '고마워요' : `이 ${contentLabel}, 어떠셨어요?`}
          </p>
          <p style={{ fontSize: 14.5, color: HJ.ink2, textAlign: 'center', marginTop: 6, lineHeight: 1.6 }}>
            {tossDone ? '남겨 주신 별점은 다른 분들이 사주500을 고를 때 도움이 돼요. 창이 뜨지 않았다면 이미 남기셨을 수 있어요.' : '토스에 별점과 한 줄을 남겨 주세요. 다른 분들이 사주500을 고를 때 도움이 돼요.'}
          </p>
          {!tossDone && (
            <>
              <GoldCta style={{ marginTop: 14 }} onClick={ask}>토스에 별점 남기기</GoldCta>
              <button type="button" onClick={() => { markReviewHandled(reportKey, 'later'); setHidden(true); }}
                style={{ display: 'block', margin: '12px auto 0', fontSize: 14, color: HJ.mute, background: 'transparent', border: 0, padding: 6 }}>
                다음에 할게요
              </button>
            </>
          )}
        </Gwang>
      </div>
    );
  }

  if (sent) {
    return (
      <div style={{ margin: '24px 16px 0', ...style }}>
        <Gwang title="後 記">
          <p style={{ fontFamily: SERIF, fontSize: 17, fontWeight: 700, color: HJ.ink, textAlign: 'center' }}>남겨 주셔서 고마워요</p>
          <p style={{ fontSize: 14.5, color: HJ.ink2, textAlign: 'center', marginTop: 6, lineHeight: 1.6 }}>
            {consent ? '확인을 거쳐 이름 없이 소개될 수 있어요.' : '풀이를 더 낫게 만드는 데 쓸게요.'}
          </p>
        </Gwang>
      </div>
    );
  }

  const send = async () => {
    if (!rating || sending) return;
    setSending(true); setErr('');
    const ok = await submitReview({ contentType, contentLabel, rating, text, consentPublic: consent && text.trim().length > 0 });
    setSending(false);
    if (ok) { markReviewHandled(reportKey, 'sent'); setSent(true); }
    else setErr('지금은 남기지 못했어요. 잠시 후 다시 눌러 주세요.');
  };

  return (
    <div style={{ margin: '24px 16px 0', ...style }}>
      <Gwang title="後 記">
        <p style={{ fontFamily: SERIF, fontSize: 18, fontWeight: 700, color: HJ.ink, textAlign: 'center', lineHeight: 1.45 }}>
          이 풀이, 어떠셨어요?
        </p>
        <div role="radiogroup" aria-label="별점" className="flex justify-center gap-1.5" style={{ marginTop: 12 }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n}점`}
              onClick={() => setRating(n)}
              style={{ width: 46, height: 46, display: 'grid', placeItems: 'center', background: 'transparent', border: 0 }}>
              <svg width="32" height="32" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.3L12 17.1l-5.7 3.1 1.2-6.3L2.8 9.5l6.4-.8z"
                  fill={n <= rating ? HJ.gold : 'none'} stroke={n <= rating ? '#8C6D3D' : '#A89C88'} strokeWidth="1.5" strokeLinejoin="round" />
              </svg>
            </button>
          ))}
        </div>
        {rating > 0 && (
          <>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, 300))}
              placeholder="한 줄이면 충분해요 (안 써도 돼요)"
              rows={3}
              style={{ width: '100%', marginTop: 12, padding: '12px 13px', borderRadius: 10, border: `1px solid ${HJ.line}`, background: HJ.card, fontSize: 16, lineHeight: 1.6, color: HJ.ink, resize: 'none' }}
            />
            <label className="flex items-start gap-2.5" style={{ marginTop: 10, fontSize: 14.5, color: HJ.ink2, lineHeight: 1.55, cursor: 'pointer' }}>
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)}
                style={{ width: 20, height: 20, marginTop: 1, accentColor: HJ.ink, flexShrink: 0 }} />
              <span>홈에 이름 없이 소개해도 좋아요<br /><span style={{ fontSize: 13, color: HJ.mute }}>이름, 나이, 생일은 남지 않아요. 확인을 거친 뒤에만 보여요.</span></span>
            </label>
            <GoldCta style={{ marginTop: 14 }} onClick={send} disabled={sending}>{sending ? '남기는 중…' : '후기 남기기'}</GoldCta>
            {err && <p style={{ fontSize: 13.5, color: HJ.seal, textAlign: 'center', marginTop: 8 }}>{err}</p>}
          </>
        )}
        <button type="button" onClick={() => { markReviewHandled(reportKey, 'later'); setHidden(true); }}
          style={{ display: 'block', margin: '12px auto 0', fontSize: 14, color: HJ.mute, background: 'transparent', border: 0, padding: 6 }}>
          다음에 할게요
        </button>
      </Gwang>
    </div>
  );
}
