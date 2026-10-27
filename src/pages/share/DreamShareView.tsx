/**
 * 받은 꿈 풀이 보기 (2026-10-17) — /share/dream/{id}
 *
 *   보낸 사람이 남긴 꿈 풀이 첫 장(제목, 한 줄 판정, 첫 문단, 상징 셋)을 보여 주고, 받는 사람을 '내 꿈도 무료로 풀기'로 잇는다.
 *   사주와 엮은 풀이는 서버에 없으니 '꿈을 꾼 사람의 사주로 풀어서 사람마다 다르다'고만 쓴다.
 *   웹에서는 꿈해몽 모음(/kkum/)도 잇는다(앱 번들에는 그 정적 페이지가 없다).
 */
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FadeIn } from '@/components/common/FadeIn';
import { GoldCta, GhostButton, Verdict, Note, SectionHead, INK_HERO_BG, SERIF, HJ } from '@/components/hanji/Hanji';
import { isAppsInToss } from '@/services/payment/iapService';
import { isAppintosBuild } from '@/lib/env';
import type { DreamShareDoc } from '@/services/share/dreamShare';
import { realName } from '@/utils/personName';

export function DreamShareView({ data }: { data: DreamShareDoc }) {
  const navigate = useNavigate();
  const inToss = isAppintosBuild || isAppsInToss(); // 앱 번들에는 /kkum/ 정적 페이지가 없다
  useEffect(() => {
    import('@/services/analytics').then((a) => a.trackEvent('share_view', { type: 'dream' })).catch(() => {});
  }, []);
  // 2026-10-26 — realName 을 거친다. 무료 만세력 프로필 이름 '나' 가 그대로 '나 님이 보낸 꿈 풀이'로 나갔다
  const nm = realName(data.name);
  const who = nm ? `${nm} 님이` : '친구가';

  return (
    <div className="min-h-screen" style={{ background: HJ.paper }}>
      <div className="h-safe-top" />
      <div style={{ background: INK_HERO_BG, color: '#F4EFE4', padding: '30px 20px 26px' }}>
        <p style={{ fontSize: 14, color: '#CFC6B6', fontWeight: 700 }}>{who} 보낸 꿈 풀이{data.cat ? `, ${data.cat}` : ''}</p>
        <h1 style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 25, lineHeight: 1.45, margin: '8px 0 0', wordBreak: 'keep-all' }}>
          {data.title || '간밤의 꿈 풀이'}
        </h1>
        {data.dream && (
          <p style={{ fontSize: 14.5, color: '#E4DCCD', marginTop: 10, lineHeight: 1.7 }}>
            꾼 꿈: {data.dream}{data.dream.length >= 80 ? '…' : ''}
          </p>
        )}
      </div>

      <div className="px-5 pt-5 pb-10 space-y-5">
        {data.quote && (
          <FadeIn>
            <Verdict label="한 줄 풀이">{data.quote}</Verdict>
          </FadeIn>
        )}

        {data.narrative && (
          <FadeIn delay={0.04}>
            <SectionHead no={1} title="이 꿈이 남긴 것" />
            <p style={{ fontSize: 15.5, lineHeight: 1.8, color: HJ.ink2 }}>{data.narrative}</p>
          </FadeIn>
        )}

        {data.symbols.length > 0 && (
          <FadeIn delay={0.08}>
            <SectionHead no={2} title="꿈에 나온 상징" />
            <div className="space-y-3">
              {data.symbols.map((s, i) => (
                <Note key={i} label={s.k}>{s.m}</Note>
              ))}
            </div>
          </FadeIn>
        )}

        <FadeIn delay={0.1}>
          <div style={{ background: HJ.card, border: `1px solid ${HJ.line}`, borderRadius: 14, padding: '16px', fontSize: 15, color: HJ.mute, lineHeight: 1.75 }}>
            이 풀이는 꿈을 꾼 사람의 사주와 엮어 풀어서, 같은 꿈이라도 사람마다 다르게 나와요. 내 꿈은 내 사주로 풀어 볼 수 있어요.
          </div>
        </FadeIn>

        <FadeIn delay={0.14}>
          <div className="space-y-3 pt-1">
            <GoldCta sub="하루 한 번 무료" onClick={() => navigate('/dream?utm_source=share&utm_medium=dream&utm_campaign=dream_view')}>
              내 꿈도 풀어 보기
            </GoldCta>
            <GhostButton sub="하루 한 번 무료" onClick={() => navigate('/daily?utm_source=share&utm_medium=dream&utm_campaign=dream_view_daily')}>
              내 사주로 오늘의 운세 보기
            </GhostButton>
            {!inToss && (
              <a href="/kkum/?utm_source=share&utm_medium=dream&utm_campaign=dream_view_kkum"
                style={{ display: 'block', textAlign: 'center', fontSize: 14.5, fontWeight: 700, color: HJ.ink, padding: '6px 0' }}>
                꿈해몽 모음 보기 ›
              </a>
            )}
          </div>
        </FadeIn>

        <p style={{ fontSize: 13, color: HJ.mute, textAlign: 'center', lineHeight: 1.7 }}>
          보낸 사람이 고른 꿈 풀이 첫 장만 담겨 있어요. 생일과 사주는 담기지 않아요.
        </p>
      </div>
    </div>
  );
}
