/**
 * 친구 초대 (2026-10-18) — /invite
 *
 *   내 초대 링크 보내기, 받는 보상, 내 성과(들어온 새 친구, 사주를 넣은 친구, 충전한 친구, 받은 운), 초대 코드 직접 넣기.
 *   금액과 상한은 서버(config/referral)가 정하고 getMyReferral 이 돌려준다. 이 화면은 그대로 보여 주기만 한다.
 *   앱은 '토스로 확인', 웹은 '카카오, 네이버, 구글 로그인'으로 안내 문구가 다르다(같은 규칙).
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { GoldCta, GhostButton, SectionHead, INK_HERO_BG, SERIF, HJ } from '@/components/hanji/Hanji';
import { useToast } from '@/components/common/Toast';
import { usePageTitle } from '@/hooks/usePageTitle';
import { isAppintosBuild } from '@/lib/env';
import { isAppsInToss } from '@/services/payment/iapService';
import { getMyProfile, getProfiles } from '@/services/storage/localStore';
import { getMyInvite, enterInviteCode, pendingInvite, cachedInviteRules, type MyInvite, type InviteRules } from '@/services/referral/referral';
import { InviteWelcomeCard } from '@/components/invite/InviteWelcomeCard';

const FALLBACK: InviteRules = { inviteeUn: 3, referrerUn: 2, purchaseBonusUn: 5, purchaseMinTotalUn: 4, purchaseHoldDays: 7, monthlyCap: 10, lifetimeCap: 50 };

export function InvitePage() {
  usePageTitle('친구 초대');
  const navigate = useNavigate();
  const toast = useToast();
  const inApp = isAppintosBuild || isAppsInToss();
  const myName = ((getMyProfile() as any)?.name as string) || '';
  const hasSaju = getProfiles().length > 0;
  const [info, setInfo] = useState<MyInvite | null>(null);
  const [failed, setFailed] = useState(false);
  const [sending, setSending] = useState(false);
  const [codeIn, setCodeIn] = useState('');
  const [codeBusy, setCodeBusy] = useState(false);
  const [codeOpen, setCodeOpen] = useState(false);
  const rules = info?.rules || cachedInviteRules() || FALLBACK;

  useEffect(() => {
    import('@/services/analytics').then((a) => a.trackEvent('inv_page_view', { hasSaju: hasSaju ? 1 : 0 })).catch(() => {});
    if (!hasSaju) return;
    getMyInvite(myName).then(setInfo).catch(() => setFailed(true));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function send() {
    if (sending) return;
    setSending(true);
    try {
      const { shareInvite } = await import('@/services/share/invite');
      await shareInvite({
        inviteeUn: rules.inviteeUn,
        onShared: () => toast.show('초대 링크를 보냈어요. 친구가 사주를 넣으면 알려 드릴게요', 'success'),
      });
    } finally {
      setSending(false);
    }
  }

  async function submitCode() {
    if (codeBusy) return;
    setCodeBusy(true);
    const r = await enterInviteCode(codeIn);
    setCodeBusy(false);
    if (r.ok && r.isNew) { toast.show(`${r.referrerName ? `${r.referrerName} 님의 ` : ''}초대 코드를 넣었어요`, 'success'); setCodeOpen(false); return; }
    const msg: Record<string, string> = {
      bad_code: '코드를 다시 확인해 주세요. 영문과 숫자 6자예요',
      self: '내 초대 코드는 넣을 수 없어요',
      already: '이미 다른 초대 링크로 들어오셨어요',
    };
    toast.show(r.ok ? '처음 쓰는 날에 넣은 코드만 인정돼요' : (msg[r.reason || ''] || '잠시 뒤 다시 넣어 주세요'), 'info');
  }

  // 10-19 오너: 따닥따닥 붙어 보인다 → 이름 칸(110px)에 두 줄로 접히던 표를 '제목 위, 설명 아래'로 풀고 줄 사이를 넓힌다
  const Row = ({ k, v, last }: { k: string; v: string; last?: boolean }) => (
    <div style={{ padding: '15px 2px 14px', borderBottom: last ? 0 : `1px solid ${HJ.line}` }}>
      <div style={{ fontSize: 15.5, fontWeight: 700, color: HJ.ink }}>{k}</div>
      <div style={{ fontSize: 15, lineHeight: 1.7, color: HJ.ink2, marginTop: 4 }}>{v}</div>
    </div>
  );
  async function copyCode(code: string) {
    try { await navigator.clipboard.writeText(code); toast.show('초대 코드를 복사했어요', 'success'); }
    catch { toast.show(`초대 코드는 ${code} 예요`, 'info'); }
  }
  const Stat = ({ k, v }: { k: string; v: string }) => (
    <div style={{ flex: 1, textAlign: 'center', padding: '16px 4px' }}>
      <div style={{ fontFamily: SERIF, fontSize: 24, fontWeight: 700, color: HJ.ink, fontVariantNumeric: 'tabular-nums' }}>{v}</div>
      <div style={{ fontSize: 13, color: HJ.mute, marginTop: 2 }}>{k}</div>
    </div>
  );
  const s = info?.stats;
  const loginWord = inApp ? '토스로 확인' : '카카오, 네이버, 구글 중 하나로 로그인';
  const showCodeEntry = !pendingInvite()?.recorded;

  return (
    <div className="min-h-screen" style={{ background: HJ.paper, paddingBottom: 110 }}>
      <Header title="친구 초대" />
      <div style={{ background: INK_HERO_BG, color: '#F4EFE4', padding: '28px 20px 24px' }}>
        <p style={{ fontSize: 14, color: '#CFC6B6', fontWeight: 700 }}>친구 초대</p>
        <h1 style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 25, lineHeight: 1.45, margin: '8px 0 6px', wordBreak: 'keep-all' }}>
          친구에게 알려 주면<br />{rules.referrerUn === rules.inviteeUn ? `두 분 모두 ${rules.referrerUn}운씩 드려요` : `나 ${rules.referrerUn}운, 친구 ${rules.inviteeUn}운을 드려요`}
        </h1>
        <p style={{ fontSize: 15, color: '#E4DCCD', lineHeight: 1.6 }}>친구가 내 링크로 들어와 사주를 넣으면 나도 친구도 운을 받아요.</p>
      </div>

      <div className="px-5 pt-6 space-y-8">
        <InviteWelcomeCard />

        {hasSaju ? (
          <div>
            <GoldCta sub="카카오톡, 문자" onClick={send} disabled={sending}>
              {sending ? '링크를 만드는 중이에요' : '친구에게 초대 링크 보내기'}
            </GoldCta>
            {info?.code && (
              <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 12, background: HJ.card, border: `1px solid ${HJ.line}`, borderRadius: 14, padding: '14px 16px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, color: HJ.mute }}>내 초대 코드</div>
                  <div style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 700, color: HJ.ink, letterSpacing: '0.18em', marginTop: 2 }}>{info.code}</div>
                </div>
                <button type="button" onClick={() => copyCode(info.code)}
                  style={{ flexShrink: 0, height: 40, padding: '0 16px', borderRadius: 10, border: `1px solid ${HJ.ink}`, background: 'transparent', color: HJ.ink, fontSize: 14.5, fontWeight: 700 }}>
                  복사
                </button>
              </div>
            )}
            {info?.code && <p style={{ fontSize: 13.5, color: HJ.mute, lineHeight: 1.6, margin: '8px 2px 0' }}>링크 대신 코드만 알려 줘도 돼요. 친구가 친구 초대 화면 아래 '초대 코드를 받으셨나요?'에 넣으면 같아요.</p>}
            {failed && <p style={{ textAlign: 'center', fontSize: 13.5, color: HJ.mute, marginTop: 12 }}>초대 정보를 불러오지 못했어요. 링크는 그대로 보낼 수 있어요.</p>}
          </div>
        ) : (
          <div style={{ background: HJ.card, border: `1px solid ${HJ.line}`, borderRadius: 14, padding: '16px 18px' }}>
            <p style={{ fontSize: 15, lineHeight: 1.7, color: HJ.ink2 }}>내 사주를 먼저 넣으면 초대 링크가 만들어져요. 오늘의 운세는 무료예요.</p>
            <GhostButton style={{ marginTop: 12 }} sub="무료" onClick={() => navigate('/input?from=daily')}>내 사주 넣기</GhostButton>
          </div>
        )}

        <div>
          <SectionHead no={1} title="이렇게 받아요" />
          <div style={{ background: HJ.card, border: `1px solid ${HJ.line}`, borderRadius: 14, padding: '4px 16px 6px' }}>
            <Row k="친구가 사주를 넣으면" v={`친구가 내 링크로 처음 들어와 사주를 넣고 ${loginWord}하면 나 ${rules.referrerUn}운, 친구 ${rules.inviteeUn}운을 드려요.`} />
            <Row k="친구가 처음 충전하면" v={`친구가 처음 ${rules.purchaseMinTotalUn}운 이상 충전하면 나에게 ${rules.purchaseBonusUn}운을 더 드려요. 충전하고 ${rules.purchaseHoldDays}일 뒤에 들어가요.`} />
            <Row k="받는 때" v="친구가 인정되면 다음에 사주500을 열 때 내 운에 자동으로 들어가요." />
            <Row k="받을 수 있는 수" v={`한 달에 친구 ${rules.monthlyCap}명, 모두 ${rules.lifetimeCap}명까지 받을 수 있어요.`} last />
          </div>
        </div>

        {hasSaju && (
          <div>
            <SectionHead no={2} title="내 초대 성과" />
            <div style={{ background: HJ.card, border: `1px solid ${HJ.line}`, borderRadius: 14, padding: '4px 8px' }}>
              <div style={{ display: 'flex' }}>
                <Stat k="들어온 새 친구" v={`${s?.visits ?? 0}명`} />
                <Stat k="사주를 넣은 친구" v={`${s?.qualified ?? 0}명`} />
              </div>
              <div style={{ display: 'flex', borderTop: `1px solid ${HJ.line}` }}>
                <Stat k="충전한 친구" v={`${s?.purchased ?? 0}명`} />
                <Stat k="내가 받은 운" v={`${s?.earnedUn ?? 0}운`} />
              </div>
            </div>
            {s && s.monthQualified >= rules.monthlyCap && (
              <p style={{ fontSize: 13.5, color: HJ.mute, marginTop: 8 }}>이번 달 받을 수 있는 친구 수를 다 채웠어요. 다음 달 1일부터 다시 받아요.</p>
            )}
          </div>
        )}

        <div>
          <SectionHead no={hasSaju ? 3 : 2} title="자주 묻는 질문" />
          <div style={{ background: HJ.card, border: `1px solid ${HJ.line}`, borderRadius: 14, padding: '6px 16px 16px' }}>
            <dl style={{ fontSize: 15, lineHeight: 1.7 }}>
              <dt style={{ fontWeight: 700, color: HJ.ink, marginTop: 14 }}>친구가 이미 사주500을 쓰고 있으면요?</dt>
              <dd style={{ color: HJ.ink2, marginTop: 2 }}>내 링크로 처음 들어온 친구만 인정돼요. 이미 쓰던 친구는 받을 수 없어요.</dd>
              <dt style={{ fontWeight: 700, color: HJ.ink, marginTop: 16 }}>친구는 왜 {inApp ? '토스로 확인' : '로그인'}해야 하나요?</dt>
              <dd style={{ color: HJ.ink2, marginTop: 2 }}>한 사람이 여러 번 받지 않도록 한 사람에 한 번만 드리려고요. {inApp ? '토스 회원인지만 확인하고 다른 정보는 받지 않아요.' : '로그인해 두면 기록도 계정에 지켜져요.'}</dd>
              <dt style={{ fontWeight: 700, color: HJ.ink, marginTop: 16 }}>받은 운은 어디에 쓰나요?</dt>
              <dd style={{ color: HJ.ink2, marginTop: 2 }}>종합사주, 주제운, 궁합, 신년운세 같은 모든 콘텐츠에 쓸 수 있어요. 받은 운은 환불되지 않아요.</dd>
            </dl>
          </div>
        </div>

        {showCodeEntry && (
          <div style={{ textAlign: 'center' }}>
            {!codeOpen ? (
              <button type="button" onClick={() => setCodeOpen(true)} style={{ fontSize: 14.5, fontWeight: 700, color: HJ.goldText, padding: '8px 4px', background: 'none', border: 0 }}>
                초대 코드를 받으셨나요?
              </button>
            ) : (
              <div style={{ background: HJ.card, border: `1px solid ${HJ.line}`, borderRadius: 14, padding: '18px 16px', textAlign: 'left' }}>
                <p style={{ fontSize: 15, color: HJ.ink2, lineHeight: 1.65 }}>친구에게 받은 6자 코드를 넣어 주세요. 사주500을 처음 쓰는 날에만 인정돼요.</p>
                <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                  <input value={codeIn} onChange={(e) => setCodeIn(e.target.value.toUpperCase().slice(0, 6))} placeholder="예: AB12CD" inputMode="text" autoCapitalize="characters"
                    style={{ flex: 1, height: 48, borderRadius: 10, border: `1px solid ${HJ.line}`, padding: '0 14px', fontSize: 17, letterSpacing: '0.12em', background: '#fff', color: HJ.ink }} />
                  <button type="button" onClick={submitCode} disabled={codeBusy || codeIn.length !== 6}
                    style={{ minWidth: 76, height: 48, borderRadius: 10, border: 0, background: codeIn.length === 6 ? HJ.ink : HJ.line, color: '#F4EFE4', fontSize: 15, fontWeight: 700 }}>
                    넣기
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
