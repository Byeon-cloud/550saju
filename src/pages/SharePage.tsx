import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FadeIn } from '@/components/common/FadeIn';
import { Button } from '@/components/common/Button';
import { usePageTitle } from '@/hooks/usePageTitle';
import { getReport, type LocalReport } from '@/services/storage/localStore';
import { TOPIC_REGISTRY, normalizeTopicId } from '@/constants/topics';
import { CompatShareView } from '@/pages/share/CompatShareView';
import { fetchCompatShare, type CompatShareDoc } from '@/services/share/compatShare';
import { DreamShareView } from '@/pages/share/DreamShareView';
import { fetchDreamShare, isDreamShareId, type DreamShareDoc } from '@/services/share/dreamShare';
import { NewYearShareView } from '@/pages/share/NewYearShareView';
import { CompatJoinView } from '@/pages/share/CompatJoinView';
import { isCompatInviteId } from '@/services/share/compatInvite';
import { fetchNewYearShare, isNewYearShareId, type NewYearShareDoc } from '@/services/share/newYearShare';
import { realName } from '@/utils/personName';

/**
 * 공유 수신 페이지 — 비회원 진입 (2026-05-07 동적화)
 *
 * 정책:
 *   - 보일러플레이트 절대 금지 — 정적 더미 텍스트("己土" 등) 박멸
 *   - 동적 시도 1: 본인 localStorage 에 동일 reportId 있으면 그 사주 미리보기
 *     (자기 링크를 자기가 누르거나 같은 기기에서 받은 경우)
 *   - 동적 시도 2: 미래 — Firestore publicReports/{id} fetch (별도 sprint)
 *   - 둘 다 실패 → 사주 정보 없는 generic CTA (작성자 사주 노출 X)
 *
 * SSR (renderShareOg Cloud Function) 가 OG 미리보기는 별도 처리 — 이 페이지는 SPA fallback.
 *
 * 2026-10-26 v9 정리 — 받은 사람이 모두 보는 화면인데 옛 규칙이 남아 있었다.
 *   먹 머리의 작은 글씨가 흰색 30%(대비 약 2.7:1), 라벨과 자물쇠가 금색(금색은 누르는 주 버튼에만), 본문 14px, '사주500 둘러보기' 높이 약 36px.
 *   → 머리 글씨는 다른 받은 화면들과 같은 #CFC6B6, 라벨과 자물쇠는 먹과 보조색, 본문 15px, 글자 버튼 높이 44px 이상.
 *   이름은 realName 을 거친다(무료 만세력 프로필 이름 '나' 가 '나 님의'로 나가지 않게).
 */
export function SharePage() {
  usePageTitle('사주 결과 미리보기');
  const navigate = useNavigate();
  const { id: shareId, type: urlType, topicId: urlTopicId } = useParams<{ id: string; type?: string; topicId?: string }>();
  const [report, setReport] = useState<LocalReport | null>(null);
  // 2026-10-17 궁합 보내기 (시험 E7) — /share/compat/{id} 는 서버에 남긴 일부를 읽어 받은 궁합 화면을 보여 준다
  const isCompatLink = urlType === 'compat';
  const [compat, setCompat] = useState<CompatShareDoc | null>(null);
  const [compatLoaded, setCompatLoaded] = useState(!isCompatLink);
  // 2026-10-17 꿈해몽 보내기 — /share/dream/{14자 id} 는 서버에 남긴 꿈 풀이 첫 장 (예전 날짜 주소는 그대로 초대 화면)
  const isDreamLink = urlType === 'dream' && isDreamShareId(shareId);
  const [dream, setDream] = useState<DreamShareDoc | null>(null);
  const [dreamLoaded, setDreamLoaded] = useState(!isDreamLink);
  // 2026-10-18 신년운세 미리 보기 보내기 — /share/newyear/{14자 id}
  const isNewYearLink = urlType === 'newyear' && isNewYearShareId(shareId);
  const [newYear, setNewYear] = useState<NewYearShareDoc | null>(null);
  const [newYearLoaded, setNewYearLoaded] = useState(!isNewYearLink);

  useEffect(() => {
    if (!isNewYearLink || !shareId) return;
    let alive = true;
    fetchNewYearShare(shareId).then((d) => { if (alive) { setNewYear(d); setNewYearLoaded(true); } });
    return () => { alive = false; };
  }, [isNewYearLink, shareId]);

  useEffect(() => {
    if (!isDreamLink || !shareId) return;
    let alive = true;
    fetchDreamShare(shareId).then((d) => { if (alive) { setDream(d); setDreamLoaded(true); } });
    return () => { alive = false; };
  }, [isDreamLink, shareId]);

  useEffect(() => {
    if (!isCompatLink || !shareId) return;
    let alive = true;
    fetchCompatShare(shareId).then((d) => { if (alive) { setCompat(d); setCompatLoaded(true); } });
    return () => { alive = false; };
  }, [isCompatLink, shareId]);

  useEffect(() => {
    if (!shareId) return;
    // 시도 1 — 같은 기기 localStorage 에서 reportId 매칭
    const local = getReport(shareId);
    if (local) {
      setReport(local);
      return;
    }
    // 시도 2 (미래): Firestore publicReports/{shareId} fetch — 별도 sprint
    // const fetched = await fetchPublicReport(shareId);
  }, [shareId]);

  // 사주 데이터가 있으면 동적 미리보기, 없으면 generic
  const dayGanRaw = (report?.sajuData?.pillars?.[2] as any)?.['천간'] ?? (report?.sajuData?.pillars?.[2] as any)?.gan ?? '';
  const sajuOwner = realName(report?.name);
  // 2026-10-15 — 받는 사람 기기엔 그 기록이 없으니 공유 주소(/share/{type}/...)의 종류로도 상품명을 맞춘다
  const contentType = report?.contentType || (urlTopicId ? 'topic' : urlType) || 'report';
  const topicKey = (report?.aiResult as any)?.topicId || urlTopicId;

  /** 콘텐츠 종류별 상품명 (지금 상품 이름 SSOT: 종합사주, 월운세, 주간운세, 신년운세, 궁합, 꿈해몽, 오늘의 운세) */
  const TYPE_LABEL: Record<string, string> = {
    report: '종합사주',
    premium: '종합사주',
    result: '사주 풀이',
    daeun: '대운',
    monthly: '월운세',
    weekly: '주간운세',
    compat: '궁합',
    tojung: '신년운세',
    newyear: '신년운세',
    cjoin: '궁합',
    daily: '오늘의 운세',
    dream: '꿈해몽',
    deepDream: '꿈해몽',
  };
  const topicNorm = contentType === 'topic' ? normalizeTopicId(topicKey) : null;
  const typeLabel = topicNorm ? TOPIC_REGISTRY[topicNorm].label : contentType === 'topic' ? '주제별 운세' : (TYPE_LABEL[contentType] || '사주 풀이');

  // 2026-10-18 친구 궁합 초대장 (E16) — /share/cjoin/{14자}
  if (urlType === 'cjoin' && isCompatInviteId(shareId)) return <CompatJoinView id={shareId!} />;
  if (isCompatLink && !compatLoaded) return <div className="min-h-screen" style={{ background: '#F4EFE4' }} />;
  if (compat) return <CompatShareView data={compat} />;
  if (isDreamLink && !dreamLoaded) return <div className="min-h-screen" style={{ background: '#F4EFE4' }} />;
  if (dream) return <DreamShareView data={dream} />;
  if (isNewYearLink && !newYearLoaded) return <div className="min-h-screen" style={{ background: '#F4EFE4' }} />;
  if (newYear) return <NewYearShareView data={newYear} />;

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-page-gradient)' }}>
      <div className="h-safe-top" />
      <div className="px-5 pt-6 pb-8 space-y-5">

        {/* 로고 */}
        <FadeIn>
          <div className="flex items-center gap-1.5">
            <svg width="20" height="20" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="11" stroke="#1A1612" strokeWidth="1" fill="none" opacity="0.3" />
              <path d="M12 1a11 11 0 010 22c0-3 2-5.5 0-11S12 4 12 1z" fill="#1A1612" />
              <circle cx="12" cy="7" r="2" fill="#B8965A" />
              <circle cx="12" cy="17" r="2" fill="#1A1612" stroke="#B8965A" strokeWidth="0.8" />
            </svg>
            <span className="text-caption text-text-hint font-semibold">사주500</span>
          </div>
        </FadeIn>

        {/* 히어로 — 동적 (이름 알면 호명, 모르면 generic) */}
        <FadeIn delay={0.03}>
          <div className="card-navy py-7 px-5">
            <p className="text-[13px] mb-1" style={{ color: '#CFC6B6' }}>{typeLabel} 결과</p>
            <h1 className="text-display text-white leading-snug">
              {sajuOwner ? `${sajuOwner} 님의 ${typeLabel}\n결과가 도착했어요` : '누군가 나에게\n사주 결과를 공유했어요'}
            </h1>
            <p className="text-[15px] mt-3 leading-relaxed" style={{ color: '#CFC6B6' }}>
              {report ? '핵심 일부만 미리 보고, 전체는 내 사주 분석 후에 만나보세요.' : '나도 내 사주를 분석하면 같은 깊이로 만날 수 있어요.'}
            </p>
          </div>
        </FadeIn>

        {/* 미리보기 카드 — 사주 데이터 있을 때만 노출, 없으면 skip */}
        {report && dayGanRaw && (
          <FadeIn delay={0.06}>
            <div className="card space-y-4">
              <div>
                <p className="text-label text-text-primary font-semibold mb-1">일간(日干)</p>
                <p className="text-body text-text-secondary">
                  {sajuOwner ? `${sajuOwner} 님은` : '이 사주는'} <b style={{ fontFamily: 'Noto Serif KR, serif' }}>{dayGanRaw}</b> 일간이에요. 이 기운을 중심으로 평생의 사주가 짜여 있어요.
                </p>
              </div>
              <div className="h-px bg-border-light" />
              <div>
                <p className="text-label text-text-primary font-semibold mb-1">{typeLabel}</p>
                <p className="text-body text-text-secondary">
                  나머지 해석은 내 사주를 입력하면 같은 방식으로 받아볼 수 있어요.
                </p>
              </div>
            </div>
          </FadeIn>
        )}

        {/* 블러 영역 — 잠금 시각 (사주 정보 노출 X) */}
        <FadeIn delay={0.09}>
          <div className="card relative overflow-hidden">
            <div className="space-y-3" style={{ filter: 'blur(6px)' }}>
              <div className="h-3 w-3/4 rounded bg-text-hint/20" />
              <div className="h-3 w-full rounded bg-text-hint/15" />
              <div className="h-3 w-2/3 rounded bg-text-hint/20" />
              <div className="h-3 w-5/6 rounded bg-text-hint/10" />
              <div className="h-3 w-3/4 rounded bg-text-hint/15" />
              <div className="h-3 w-1/2 rounded bg-text-hint/20" />
            </div>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="w-10 h-10 rounded-xl bg-bg-surface flex items-center justify-center mb-2">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6F6557" strokeWidth="2" strokeLinecap="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" />
                  <path d="M7 11V7a5 5 0 0110 0v4" />
                </svg>
              </div>
              <p className="text-[15px] text-text-primary font-semibold">전체 분석</p>
              <p className="text-caption text-text-muted mt-0.5">내 사주를 넣으면 같은 풀이를 내 것으로 볼 수 있어요</p>
            </div>
          </div>
        </FadeIn>

        {/* 포함 항목 미리보기 — SSOT 라벨 (보일러플레이트 X) */}
        <FadeIn delay={0.12}>
          {/* 2026-10-15 — 알약 칩 대신 글자 한 줄 (고서 디자인 규칙) */}
          <p className="text-center text-[15px] text-text-muted leading-relaxed">
            연애와 결혼, 재물, 직업, 합격과 이직, 건강, 공부까지<br />주제별로 깊이 볼 수 있어요
          </p>
        </FadeIn>

        {/* CTA */}
        <FadeIn delay={0.15}>
          <div className="space-y-3 pt-2">
            <Button variant="gold" fullWidth size="lg" onClick={() => navigate('/input')}>
              나도 내 사주 알아보기
            </Button>
            <p className="text-center text-[13px] text-text-hint">
              오늘의 운세와 꿈해몽은 하루 한 번 무료예요
            </p>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="w-full min-h-[44px] text-center text-[14px] font-semibold text-text-muted py-2"
            >
              사주500 둘러보기
            </button>
          </div>
        </FadeIn>
      </div>
    </div>
  );
}
