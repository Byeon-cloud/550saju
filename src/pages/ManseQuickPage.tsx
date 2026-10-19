/**
 * 무료 만세력 바로 보기 (2026-10-18) — /manse/view
 *
 *   검색 페이지 /manse/ 의 입력 칸에서 넘어온다. 입력 화면을 한 번 더 거치지 않고, 사주를 계산해 보관함에 저장한 뒤
 *   사주 카드(만세력 한 장)로 바로 보낸다. 계산은 입력 화면과 같은 calculateSaju(30분 보정, 서머타임, 한국 음력 toSolarInput 포함).
 *
 *   10-19 검토 반영:
 *   - 생일은 주소가 아니라 sessionStorage('saju500:manse_form')로 받는다(광고 픽셀과 브라우저 기록에 남지 않게).
 *     예전 주소(?b=..&n=..)로 와도 읽은 즉시 주소에서 지운다(첫 그리기 전에).
 *   - 날짜가 틀리면 말없이 입력 화면으로 보내지 않고 무엇이 틀렸는지 알려 준다.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { calculateSaju, lunarMonthDays } from '@/services/saju/calculator';
import { getProfiles, saveProfileDirect, setMyProfile, findExistingOwnerProfile, generateId } from '@/services/storage/localStore';
import { HJ, SERIF, GoldCta } from '@/components/hanji/Hanji';
import type { SajuInput, CalendarType } from '@/types/saju';
import type { Relation } from '@/types/user';

const REL: Record<string, Relation> = { self: '본인' as Relation, family: '가족' as Relation, friend: '친구' as Relation, lover: '연인' as Relation };
const FORM_KEY = 'saju500:manse_form';

type Form = { b: string; c: string; g: string; t: string; n: string; r: string };

/** 폼 값을 한 번만 읽고 흔적을 지운다 (저장소 항목 삭제, 주소의 개인정보 제거) */
function takeForm(): Form | null {
  let f: Partial<Form> | null = null;
  try {
    const raw = sessionStorage.getItem(FORM_KEY);
    if (raw) { f = JSON.parse(raw); sessionStorage.removeItem(FORM_KEY); }
  } catch { /* noop */ }
  try {
    const q = new URLSearchParams(window.location.search);
    if (!f && q.get('b')) f = { b: q.get('b') || '', c: q.get('c') || '', g: q.get('g') || '', t: q.get('t') || '', n: q.get('n') || '', r: q.get('r') || '' };
    if (['b', 'n', 'g', 't', 'c', 'r'].some((k) => q.has(k))) {
      ['b', 'n', 'g', 't', 'c', 'r'].forEach((k) => q.delete(k));
      const rest = q.toString();
      window.history.replaceState(window.history.state, '', `/manse/view${rest ? `?${rest}` : ''}`);
    }
  } catch { /* noop */ }
  if (!f) return null;
  return { b: String(f.b || ''), c: String(f.c || ''), g: String(f.g || ''), t: String(f.t || ''), n: String(f.n || ''), r: String(f.r || '') };
}

export function ManseQuickPage() {
  const navigate = useNavigate();
  // 첫 그리기 때 바로 읽고 주소를 비운다 (페이지 기록, 광고 기록이 나가기 전에)
  const [form] = useState<Form | null>(() => takeForm());
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const fail = (why: string, msg?: string) => {
      import('@/services/analytics').then((a) => a.trackEvent('manse_view', { ok: 0, why })).catch(() => {});
      if (msg) setErr(msg);
      else navigate('/input?from=manse', { replace: true });
    };
    try {
      if (!form) return fail('nodata');
      const b = form.b.replace(/\D/g, '');
      if (b.length !== 8) return fail('date', '생년월일 8자리를 다시 확인해 주세요.');
      const y = Number(b.slice(0, 4)); const m = Number(b.slice(4, 6)); const d = Number(b.slice(6, 8));
      const nowY = new Date().getFullYear();
      if (y < 1900 || y > nowY || m < 1 || m > 12 || d < 1) return fail('date', '없는 날짜예요. 생년월일을 다시 확인해 주세요.');
      const calendarType: CalendarType = (form.c === 'leap' ? 'lunar_leap' : form.c === 'lunar' ? 'lunar' : 'solar') as CalendarType;
      if (calendarType === 'solar') {
        const dt = new Date(y, m - 1, d);
        if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return fail('date', '없는 날짜예요. 생년월일을 다시 확인해 주세요.');
      } else {
        const max = lunarMonthDays(y, m, calendarType === 'lunar_leap');
        if (!max) return fail('lunar', calendarType === 'lunar_leap' ? `${y}년에는 음력 ${m}월 윤달이 없어요. 윤달이 아니라면 '음력'으로 다시 넣어 주세요.` : '음력 날짜를 다시 확인해 주세요.');
        if (d > max) return fail('lunar', `${y}년 음력 ${m}월${calendarType === 'lunar_leap' ? '(윤달)' : ''}은 ${max}일까지 있어요. 날짜를 다시 확인해 주세요.`);
      }
      const g = form.g === 'm' ? 'male' : form.g === 'f' ? 'female' : '';
      if (!g) return fail('gender', '성별을 골라 주세요.');
      const t = form.t.replace(/\D/g, '');
      const tt = t.length === 3 ? `0${t}` : t; // 6:30 처럼 세 자리로 와도 시각으로
      const hasTime = tt.length === 4 && Number(tt.slice(0, 2)) < 24 && Number(tt.slice(2)) < 60;
      const name = form.n.trim().slice(0, 12) || '나';
      let relation = REL[form.r || 'self'] || REL.self;
      // 이미 다른 '본인'이 있으면 본인을 둘 만들지 않는다
      const owner = findExistingOwnerProfile();
      const key = `${name}_${y}_${m}_${d}`;
      if (relation === REL.self && owner && `${owner.name}_${owner.input.birthYear}_${owner.input.birthMonth}_${owner.input.birthDay}` !== key) relation = REL.friend;

      const input: SajuInput = {
        name, relation, birthYear: y, birthMonth: m, birthDay: d, calendarType, gender: g as SajuInput['gender'], hasBirthTime: hasTime,
        ...(hasTime ? { birthHour: Number(tt.slice(0, 2)), birthMinute: Number(tt.slice(2)) } : {}),
      };
      const data = calculateSaju(input);
      // 같은 사람(이름+생일)이 이미 있으면 그 번호를 그대로 쓴다 (보관함, 기록과 이어지게)
      const same = getProfiles().find((p) => `${p.name}_${p.input.birthYear}_${p.input.birthMonth}_${p.input.birthDay}` === key);
      const id = same?.id || generateId();
      saveProfileDirect({ id, name, input, sajuData: data, relation, createdAt: same?.createdAt || new Date().toISOString() } as any);
      if (relation === REL.self && !owner) setMyProfile(id);
      import('@/services/analytics').then((a) => {
        a.trackEvent('manse_view', { ok: 1, cal: calendarType, hour: hasTime ? 1 : 0, rel: form.r || 'self' });
        if (!same) a.trackEvent('profile_created', { relation, hourKnown: hasTime ? 1 : 0, from: 'manse' });
      }).catch(() => {});
      navigate(`/saju-card/${id}?from=manse`, { replace: true });
    } catch {
      fail('error', '만세력을 펼치지 못했어요. 잠시 뒤 다시 해 주세요.');
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (err) {
    return (
      <div style={{ minHeight: '100vh', background: HJ.paper, padding: '80px 24px', textAlign: 'center' }}>
        <p style={{ fontFamily: SERIF, fontSize: 19, fontWeight: 700, color: HJ.ink, lineHeight: 1.6 }}>{err}</p>
        <GoldCta style={{ marginTop: 22 }} onClick={() => { window.location.href = '/manse/'; }}>다시 넣기</GoldCta>
        <button type="button" onClick={() => navigate('/input?from=manse', { replace: true })}
          style={{ marginTop: 12, padding: 10, fontSize: 14.5, fontWeight: 700, color: HJ.ink2, background: 'transparent', border: 0 }}>
          입력 화면에서 넣기 ›
        </button>
      </div>
    );
  }
  return (
    <div style={{ minHeight: '100vh', background: HJ.paper, display: 'grid', placeItems: 'center' }}>
      <p style={{ fontFamily: SERIF, fontSize: 18, color: HJ.ink2 }}>만세력을 펼치는 중이에요</p>
    </div>
  );
}
