/**
 * 받은 궁합 보기 (2026-10-17, 시험 E7) — /share/compat/{id}
 *
 *   보낸 사람이 '궁합 결과 보내기'로 서버에 남긴 일부(점수, 관계 유형, 총평 첫 문장, 항목별 점수, 잘 맞는 점 한 줄)를 보여 주고,
 *   받는 사람을 '나도 궁합 보기'와 무료 오늘의 운세로 잇는다. 조심할 점과 조언은 서버에 없으니 '결과를 받은 사람만 볼 수 있다'고만 쓴다.
 *   웹에서는 두 사람 띠로 띠 궁합 검색 페이지(/gunghap/)도 잇는다(앱 번들에는 그 정적 페이지가 없다).
 */
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FadeIn } from '@/components/common/FadeIn';
import { GoldCta, GhostButton, Verdict, Note, SectionHead, Redact, INK_HERO_BG, SERIF, HJ } from '@/components/hanji/Hanji';
import { isAppsInToss } from '@/services/payment/iapService';
import { PRODUCT_COST } from '@/constants/pricing';
import type { CompatShareDoc } from '@/services/share/compatShare';

const TTI_SLUG: Record<string, [string, string]> = {
  子: ['rat', '쥐띠'], 丑: ['ox', '소띠'], 寅: ['tiger', '호랑이띠'], 卯: ['rabbit', '토끼띠'], 辰: ['dragon', '용띠'], 巳: ['snake', '뱀띠'],
  午: ['horse', '말띠'], 未: ['goat', '양띠'], 申: ['monkey', '원숭이띠'], 酉: ['rooster', '닭띠'], 戌: ['dog', '개띠'], 亥: ['pig', '돼지띠'],
};
const ORDER = '子丑寅卯辰巳午未申酉戌亥';

export function CompatShareView({ data }: { data: CompatShareDoc }) {
  const navigate = useNavigate();
  const inToss = isAppsInToss();
  useEffect(() => {
    import('@/services/analytics').then((a) => a.trackEvent('share_view', { type: 'compat' })).catch(() => {});
  }, []);
  const t1 = TTI_SLUG[data.tti1]; const t2 = TTI_SLUG[data.tti2];
  const ttiKey = t1 && t2
    ? (ORDER.indexOf(data.tti1) <= ORDER.indexOf(data.tti2) ? `${t1[0]}-${t2[0]}` : `${t2[0]}-${t1[0]}`)
    : '';
  const cost = (PRODUCT_COST as any)?.compatibility ?? 3;

  return (
    <div className="min-h-screen" style={{ background: HJ.paper }}>
      <div className="h-safe-top" />
      <div style={{ background: INK_HERO_BG, color: '#F4EFE4', padding: '30px 20px 26px' }}>
        <p style={{ fontSize: 14, color: '#CFC6B6', fontWeight: 700 }}>받은 궁합{data.rel ? `, ${data.rel}` : ''}</p>
        <h1 style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 26, lineHeight: 1.4, margin: '8px 0 6px', wordBreak: 'keep-all' }}>
          {data.n1} 님과 {data.n2} 님의 궁합
        </h1>
        <p style={{ fontFamily: SERIF, fontSize: 40, fontWeight: 900, lineHeight: 1.2 }}>
          {data.score}<span style={{ fontSize: 20, marginLeft: 3 }}>점</span>
        </p>
        {data.rtype && <p style={{ fontSize: 15, color: '#E4DCCD', marginTop: 4 }}>{data.rtype}</p>}
      </div>

      <div className="px-5 pt-5 pb-10 space-y-5">
        {data.head && (
          <FadeIn>
            <Verdict label="궁합 총평">{data.head}</Verdict>
          </FadeIn>
        )}

        {data.cats.length > 0 && (
          <FadeIn delay={0.04}>
            <SectionHead no={1} title="항목별 궁합" />
            <div style={{ background: HJ.card, border: `1px solid ${HJ.line}`, borderRadius: 14, padding: '6px 16px' }}>
              {data.cats.map((c, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '11px 0', borderTop: i ? `1px solid ${HJ.line}` : 0, fontSize: 15.5 }}>
                  <span style={{ color: HJ.ink2 }}>{c.n}</span>
                  <b style={{ color: HJ.ink, fontVariantNumeric: 'tabular-nums' }}>{c.s}점</b>
                </div>
              ))}
            </div>
          </FadeIn>
        )}

        {data.good && (
          <FadeIn delay={0.08}>
            <Note label="잘 맞는 점">{data.good}</Note>
          </FadeIn>
        )}

        <FadeIn delay={0.1}>
          <SectionHead no={2} title="조심할 점과 두 사람에게 주는 조언" />
          <div style={{ background: HJ.card, border: `1px solid ${HJ.line}`, borderRadius: 14, padding: '16px', fontSize: 15, color: HJ.mute, lineHeight: 1.75 }}>
            <p><Redact w={150} /></p>
            <p style={{ marginTop: 8 }}>조심할 점, 시기별 흐름, 조언은 궁합을 본 사람만 볼 수 있어요. 내 생일로 궁합을 보면 전부 풀어 드려요.</p>
          </div>
        </FadeIn>

        <FadeIn delay={0.14}>
          <div className="space-y-3 pt-1">
            <GoldCta sub={`${cost}운`} onClick={() => navigate('/compat?utm_source=share&utm_medium=compat&utm_campaign=compat_view')}>
              나도 궁합 보기
            </GoldCta>
            <GhostButton sub="하루 한 번 무료" onClick={() => navigate('/daily?utm_source=share&utm_medium=compat&utm_campaign=compat_view_daily')}>
              내 사주로 오늘의 운세 보기
            </GhostButton>
            {!inToss && ttiKey && (
              <a href={`/gunghap/${ttiKey}/?utm_source=share&utm_medium=compat&utm_campaign=compat_view_tti`}
                style={{ display: 'block', textAlign: 'center', fontSize: 14.5, fontWeight: 700, color: HJ.goldText, padding: '6px 0' }}>
                {t1![1]}와 {t2![1]} 궁합 무료로 보기 ›
              </a>
            )}
          </div>
        </FadeIn>

        <p style={{ fontSize: 13, color: HJ.mute, textAlign: 'center', lineHeight: 1.7 }}>
          보낸 사람이 입력한 이름과 궁합 점수만 담겨 있어요. 생일은 담기지 않아요.
        </p>
      </div>
    </div>
  );
}
