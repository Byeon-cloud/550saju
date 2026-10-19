/**
 * 사주 카드(만세력)에 더한 것 (2026-10-18, 무료 만세력 디벨롭)
 *   CalcNote   이렇게 계산했어요 — 30분 보정, 서머타임, 한국 음력 (계산 코드 기준 그대로)
 *   ShareRow   내 만세력 보내기, 이미지 저장 — 결과 바로 아래 (전엔 맨 아래에만)
 *   FlowNow    운의 흐름 — 지금 대운, 올해, 내년 (예전에 빠졌던 대운과 세운) + 대운 전체 펼치기
 *   NextSteps  무료로 이어 보기 — 오늘의 운세, 꿈해몽, 내 일주(웹), 다른 사람 만세력, 궁합 초대장
 *   캡처(이미지 저장)에는 버튼이 찍히지 않게 data-html2canvas-ignore.
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HJ, SERIF } from '@/components/hanji/Hanji';
import { inspectKoreanSolarTime } from '@/services/saju/timeCorrection';
import { toSolarInput } from '@/services/saju/calculator';
import { deriveSipsung, yearGanji, DaeunTable } from './_flow_table';
import { MotionScope, moVars } from '@/components/motion/Motion';
import type { SajuData, SajuInput } from '@/types/saju';

const GAN_KO: Record<string, string> = { 甲: '갑', 乙: '을', 丙: '병', 丁: '정', 戊: '무', 己: '기', 庚: '경', 辛: '신', 壬: '임', 癸: '계' };
const ZHI_KO: Record<string, string> = { 子: '자', 丑: '축', 寅: '인', 卯: '묘', 辰: '진', 巳: '사', 午: '오', 未: '미', 申: '신', 酉: '유', 戌: '술', 亥: '해' };
const GAN_RO: Record<string, string> = { 甲: 'gap', 乙: 'eul', 丙: 'byeong', 丁: 'jeong', 戊: 'mu', 己: 'gi', 庚: 'gyeong', 辛: 'sin', 壬: 'im', 癸: 'gye' };
const ZHI_RO: Record<string, string> = { 子: 'ja', 丑: 'chuk', 寅: 'in', 卯: 'myo', 辰: 'jin', 巳: 'sa', 午: 'o', 未: 'mi', 申: 'sin', 酉: 'yu', 戌: 'sul', 亥: 'hae' };
const ko = (gz: string) => (gz && gz.length >= 2 ? `${GAN_KO[gz[0]] || ''}${ZHI_KO[gz[1]] || ''}` : '');
/** 일간과 대운, 세운 천간의 관계(십성)를 쉬운 말로 */
const SIP_PLAIN: Record<string, string> = {
  비견: '내 힘으로 밀고 가는 때', 겁재: '경쟁과 나눔이 함께 오는 때',
  식신: '하고 싶은 일을 펼치는 때', 상관: '새로 시도하고 말이 많아지는 때',
  편재: '활동 무대와 큰돈이 움직이는 때', 정재: '차곡차곡 모으고 살림을 다지는 때',
  편관: '책임을 견디며 단련되는 때', 정관: '인정받고 자리를 잡는 때',
  편인: '혼자 깊이 배우고 생각하는 때', 정인: '도움과 배움이 들어오는 때',
};

const box: React.CSSProperties = { background: '#FFFDF8', border: `1px solid ${HJ.line}`, borderRadius: 14, padding: '14px 16px' };
const head: React.CSSProperties = { fontFamily: SERIF, fontSize: 17, fontWeight: 700, color: HJ.ink, marginBottom: 8 };

export function CalcNote({ input }: { input: SajuInput }) {
  const lines = useMemo(() => {
    const out: string[] = [];
    const lunar = input.calendarType === 'lunar' || input.calendarType === 'lunar_leap';
    const solar = lunar ? toSolarInput(input) : input;
    if (lunar) {
      out.push(`음력 ${input.birthMonth}월 ${input.birthDay}일${input.calendarType === 'lunar_leap' ? '(윤달)' : ''}은 한국 음력 달력으로 양력 ${solar.birthYear}년 ${solar.birthMonth}월 ${solar.birthDay}일이에요.`);
    }
    if (input.hasBirthTime && input.birthHour != null) {
      out.push('서울은 해가 30분쯤 늦게 떠서, 시가 바뀌는 때를 30분 늦춰 봤어요.'); // 10-19 검토: 실제 계산은 시각에서 30분을 뺀다(06:30 → 06:00), 검색 페이지 FAQ 와 같은 표현
      try {
        const r = inspectKoreanSolarTime(solar.birthYear, solar.birthMonth, solar.birthDay, input.birthHour, input.birthMinute || 0);
        if (r.isDst) out.push('그해 여름 서머타임으로 앞당겨졌던 한 시간도 되돌렸어요.');
      } catch { /* 계산 실패는 줄을 빼기만 */ }
    } else {
      out.push('태어난 시간을 몰라 시주는 비우고 여섯 글자로 봤어요.');
    }
    return out;
  }, [input]);
  return (
    // 저장 이미지(전체 보관용)에는 안 찍는다 — 카드 한 장의 내용이 아니라 화면 안내라서
    <div data-html2canvas-ignore="true" style={{ ...box, marginTop: 14 }}>
      <p style={{ fontSize: 13, fontWeight: 700, color: HJ.mute }}>이렇게 계산했어요</p>
      {lines.map((l) => <p key={l} style={{ fontSize: 14.5, lineHeight: 1.7, color: HJ.ink2, marginTop: 4 }}>{l}</p>)}
      {/* 검색 페이지에서 바로 펼친 경우: 저장된 걸 알려 준다 (ManseQuickPage → ?from=manse) */}
      {new URLSearchParams(window.location.search).get('from') === 'manse' && (
        <p style={{ fontSize: 14, lineHeight: 1.6, color: HJ.goldText, fontWeight: 700, marginTop: 8 }}>
          보관함에 저장했어요. 다음에 오면 홈에서 바로 내 사주로 오늘의 운세를 볼 수 있어요.
        </p>
      )}
    </div>
  );
}

export function ShareRow({ onShare, onSave, busy }: { onShare: () => void; onSave: () => void; busy: boolean }) {
  return (
    <div data-html2canvas-ignore="true" style={{ display: 'flex', gap: 8, marginTop: 12 }}>
      <button type="button" onClick={onShare} disabled={busy}
        style={{ flex: 1.4, height: 48, borderRadius: 12, border: 0, background: 'linear-gradient(180deg, #D2B477 0%, #B8965A 100%)', color: '#17110A', fontSize: 15.5, fontWeight: 800 }}>
        내 만세력 보내기
      </button>
      <button type="button" onClick={onSave} disabled={busy}
        style={{ flex: 1, height: 48, borderRadius: 12, border: '1.5px solid #1A1612', background: 'transparent', color: '#1A1612', fontSize: 15.5, fontWeight: 800 }}>
        이미지 저장
      </button>
    </div>
  );
}

export function FlowNow({ sajuData }: { sajuData: SajuData }) {
  const [open, setOpen] = useState(false);
  const ilgan = String(sajuData?.pillars?.[2]?.천간 || '');
  const dw = sajuData?.currentDaeun;
  const y = new Date().getFullYear();
  const rows: Array<{ k: string; gz: string; sub: string; plain: string }> = [];
  if (dw?.간지) {
    const s = deriveSipsung(ilgan, dw.간지[0]);
    rows.push({ k: '지금 대운', gz: dw.간지, sub: `${dw.시작나이}~${dw.끝나이}세`, plain: SIP_PLAIN[s] ? `${s}, ${SIP_PLAIN[s]}` : '' });
  }
  for (const yy of [y, y + 1]) {
    const g = yearGanji(yy);
    if (!g) continue;
    const s = deriveSipsung(ilgan, g.gan);
    rows.push({ k: yy === y ? '올해' : '내년', gz: g.ganji, sub: `${yy}년`, plain: SIP_PLAIN[s] ? `${s}, ${SIP_PLAIN[s]}` : '' });
  }
  if (!rows.length) return null;
  return (
    <MotionScope style={{ ...box, marginTop: 16 }}>
      <p style={head}>운의 흐름</p>
      {rows.map((r, i) => (
        <div key={r.k} className="mo-rise" style={{ ...moVars({ i, d: 80 }), display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderTop: i ? `1px solid ${HJ.line}` : 0 }}>
          <div style={{ width: 66, flexShrink: 0 }}>
            <p style={{ fontSize: 13.5, fontWeight: 700, color: HJ.mute }}>{r.k}</p>
            <p style={{ fontSize: 13, color: HJ.mute }}>{r.sub}</p>
          </div>
          <div style={{ width: 58, flexShrink: 0, textAlign: 'center' }}>
            <p style={{ fontFamily: SERIF, fontSize: 24, fontWeight: 900, color: HJ.ink, lineHeight: 1.2 }}>{r.gz}</p>
            <p style={{ fontSize: 13, color: HJ.mute }}>{ko(r.gz)}</p>
          </div>
          <p style={{ fontSize: 14.5, lineHeight: 1.6, color: HJ.ink2 }}>{r.plain}</p>
        </div>
      ))}
      {Array.isArray(sajuData?.daeun) && sajuData.daeun.length > 0 && (
        <div data-html2canvas-ignore="true">
          <button type="button" onClick={() => setOpen((v) => !v)}
            style={{ marginTop: 6, fontSize: 14, fontWeight: 700, color: HJ.goldText, background: 'none', border: 0, padding: '6px 0' }}>
            {open ? '대운 전체 접기' : '대운 전체 펼치기 (10년 단위)'}
          </button>
          {open && <div className="mo-unroll" style={{ marginTop: 8 }}><DaeunTable daeun={sajuData.daeun} ilgan={ilgan} birthYear={sajuData.input?.birthYear} /></div>}
        </div>
      )}
      <p style={{ fontSize: 13, color: HJ.mute, lineHeight: 1.6, marginTop: 8 }}>대운은 10년마다, 올해 운(세운)은 해마다 바뀌어요. 내 일간과 그 해 글자의 관계로 쉬운 말을 붙였어요.</p>
    </MotionScope>
  );
}

export function NextSteps({ profileId, ilju, web }: { profileId: string; ilju: string; web: boolean }) {
  const navigate = useNavigate();
  const go = (label: string, fn: () => void) => () => {
    import('@/services/analytics').then((a) => a.trackEvent('cta_click', { label, page: '/saju-card' })).catch(() => {});
    fn();
  };
  const slug = ilju.length >= 2 && GAN_RO[ilju[0]] && ZHI_RO[ilju[1]] ? `${GAN_RO[ilju[0]]}-${ZHI_RO[ilju[1]]}` : '';
  const items: Array<{ k: string; v: string; tag: string; on: () => void }> = [
    { k: '내 사주로 오늘의 운세', v: '좋은 시간과 조심할 일까지', tag: '무료', on: go('만세력 다음 오늘의 운세', () => navigate(`/daily?profileId=${encodeURIComponent(profileId)}`)) },
    { k: '꿈해몽', v: '간밤 꿈을 내 사주와 엮어서', tag: '하루 한 번 무료', on: go('만세력 다음 꿈해몽', () => navigate('/dream')) },
    ...(web && slug ? [{ k: `${ko(ilju)}일주 자세히`, v: '성격, 일, 사랑, 잘 맞는 일주까지', tag: '무료', on: go('만세력 다음 일주', () => { window.location.href = `/ilju/${slug}/`; }) }] : []),
    { k: '가족, 친구 만세력도 보기', v: '생일만 넣으면 한 장 더', tag: '무료', on: go('만세력 다음 다른 사람', () => navigate('/input?new=1&from=manse')) },
    { k: '궁합 초대장 보내기', v: '상대 생일을 몰라도 링크로', tag: '점수 무료', on: go('만세력 다음 궁합 초대장', () => navigate('/compat')) },
  ];
  return (
    <div data-html2canvas-ignore="true" style={{ ...box, marginTop: 16, padding: '6px 16px' }}>
      <p style={{ ...head, margin: '10px 0 2px' }}>이어서 보기</p>
      {items.map((it, i) => (
        <button key={it.k} type="button" onClick={it.on} className="w-full text-left"
          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0', borderTop: i ? `1px solid ${HJ.line}` : 0, background: 'none', borderLeft: 0, borderRight: 0, borderBottom: 0 }}>
          <span style={{ flex: 1 }}>
            <span style={{ display: 'block', fontSize: 15.5, fontWeight: 700, color: HJ.ink }}>{it.k}</span>
            <span style={{ display: 'block', fontSize: 13.5, color: HJ.mute, marginTop: 1 }}>{it.v}</span>
          </span>
          <span style={{ fontSize: 13.5, fontWeight: 700, color: HJ.goldText, flexShrink: 0 }}>{it.tag}</span>
        </button>
      ))}
    </div>
  );
}
