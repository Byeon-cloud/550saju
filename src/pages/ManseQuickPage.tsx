/**
 * 무료 만세력 바로 보기 (2026-10-18) — /manse/view?b=YYYYMMDD&c=solar|lunar|leap&t=HHMM&g=f|m&n=이름&r=self|family|friend|lover
 *
 *   검색 페이지 /manse/ 의 입력 칸에서 넘어온다. 입력 화면을 한 번 더 거치지 않고, 사주를 계산해 보관함에 저장한 뒤
 *   사주 카드(만세력 한 장)로 바로 보낸다. 값이 틀리면 입력 화면(/input?from=manse)으로 보낸다.
 *   계산은 입력 화면과 같은 calculateSaju(30분 보정, 서머타임, 한국 음력 toSolarInput 포함).
 */
import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { calculateSaju, lunarMonthDays } from '@/services/saju/calculator';
import { getProfiles, saveProfileDirect, setMyProfile, findExistingOwnerProfile, generateId } from '@/services/storage/localStore';
import { HJ, SERIF } from '@/components/hanji/Hanji';
import type { SajuInput, CalendarType } from '@/types/saju';
import type { Relation } from '@/types/user';

const REL: Record<string, Relation> = { self: '본인' as Relation, family: '가족' as Relation, friend: '친구' as Relation, lover: '연인' as Relation };

export function ManseQuickPage() {
  const navigate = useNavigate();
  const [q] = useSearchParams();

  useEffect(() => {
    const fail = (why: string) => {
      import('@/services/analytics').then((a) => a.trackEvent('manse_view', { ok: 0, why })).catch(() => {});
      navigate('/input?from=manse', { replace: true });
    };
    try {
      const b = (q.get('b') || '').replace(/\D/g, '');
      if (b.length !== 8) return fail('date');
      const y = Number(b.slice(0, 4)); const m = Number(b.slice(4, 6)); const d = Number(b.slice(6, 8));
      const nowY = new Date().getFullYear();
      if (y < 1900 || y > nowY || m < 1 || m > 12 || d < 1) return fail('date');
      const c = q.get('c') || 'solar';
      const calendarType: CalendarType = (c === 'leap' ? 'lunar_leap' : c === 'lunar' ? 'lunar' : 'solar') as CalendarType;
      if (calendarType === 'solar') {
        const dt = new Date(y, m - 1, d);
        if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return fail('date');
      } else {
        const max = lunarMonthDays(y, m, calendarType === 'lunar_leap');
        if (!max || d > max) return fail('lunar');
      }
      const g = q.get('g') === 'm' ? 'male' : q.get('g') === 'f' ? 'female' : '';
      if (!g) return fail('gender');
      const t = (q.get('t') || '').replace(/\D/g, '');
      const hasTime = t.length === 4 && Number(t.slice(0, 2)) < 24 && Number(t.slice(2)) < 60;
      const name = (q.get('n') || '').trim().slice(0, 12) || '나';
      let relation = REL[q.get('r') || 'self'] || REL.self;
      // 이미 다른 '본인'이 있으면 본인을 둘 만들지 않는다
      const owner = findExistingOwnerProfile();
      const key = `${name}_${y}_${m}_${d}`;
      if (relation === REL.self && owner && `${owner.name}_${owner.input.birthYear}_${owner.input.birthMonth}_${owner.input.birthDay}` !== key) relation = REL.friend;

      const input: SajuInput = {
        name, relation, birthYear: y, birthMonth: m, birthDay: d, calendarType, gender: g as SajuInput['gender'], hasBirthTime: hasTime,
        ...(hasTime ? { birthHour: Number(t.slice(0, 2)), birthMinute: Number(t.slice(2)) } : {}),
      };
      const data = calculateSaju(input);
      // 같은 사람(이름+생일)이 이미 있으면 그 번호를 그대로 쓴다 (보관함, 기록과 이어지게)
      const same = getProfiles().find((p) => `${p.name}_${p.input.birthYear}_${p.input.birthMonth}_${p.input.birthDay}` === key);
      const id = same?.id || generateId();
      saveProfileDirect({ id, name, input, sajuData: data, relation, createdAt: same?.createdAt || new Date().toISOString() } as any);
      if (relation === REL.self && !owner) setMyProfile(id);
      import('@/services/analytics').then((a) => {
        a.trackEvent('manse_view', { ok: 1, cal: calendarType, hour: hasTime ? 1 : 0, rel: q.get('r') || 'self' });
        if (!same) a.trackEvent('profile_created', { relation, hourKnown: hasTime ? 1 : 0, from: 'manse' });
      }).catch(() => {});
      navigate(`/saju-card/${id}?from=manse`, { replace: true });
    } catch {
      fail('error');
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ minHeight: '100vh', background: HJ.paper, display: 'grid', placeItems: 'center' }}>
      <p style={{ fontFamily: SERIF, fontSize: 18, color: HJ.ink2 }}>만세력을 펼치는 중이에요</p>
    </div>
  );
}
