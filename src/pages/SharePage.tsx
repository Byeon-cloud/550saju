import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FadeIn } from '@/components/common/FadeIn';
import { Button } from '@/components/common/Button';
import { usePageTitle } from '@/hooks/usePageTitle';
import { getReport, type LocalReport } from '@/services/storage/localStore';

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
 */
export function SharePage() {
  usePageTitle('사주 결과 미리보기');
  const navigate = useNavigate();
  const { id: shareId } = useParams<{ id: string }>();
  const [report, setReport] = useState<LocalReport | null>(null);

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
  const sajuOwner = report?.name || '';
  const contentType = report?.contentType || 'report';

  /** 콘텐츠 타입별 라벨 (정적 더미 X — SSOT 룩업) */
  const TYPE_LABEL: Record<string, string> = {
    report: '사주 분석',
    topic: '주제 분석',
    daeun: '대운 해설',
    monthly: '월별 운세',
    compat: '궁합 분석',
    tojung: '토정비결',
    deepDream: '꿈 심층 해석',
  };
  const typeLabel = TYPE_LABEL[contentType] || '사주 분석';

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-page-gradient)' }}>
      <div className="h-safe-top" />
      <div className="px-5 pt-6 pb-8 space-y-5">

        {/* 로고 */}
        <FadeIn>
          <div className="flex items-center gap-1.5">
            <svg width="20" height="20" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="11" stroke="#1B2A4A" strokeWidth="1" fill="none" opacity="0.3" />
              <path d="M12 1a11 11 0 010 22c0-3 2-5.5 0-11S12 4 12 1z" fill="#1B2A4A" />
              <circle cx="12" cy="7" r="2" fill="#B8965A" />
              <circle cx="12" cy="17" r="2" fill="#1B2A4A" stroke="#B8965A" strokeWidth="0.8" />
            </svg>
            <span className="text-caption text-text-hint font-semibold">사주500</span>
          </div>
        </FadeIn>

        {/* 히어로 — 동적 (이름 알면 호명, 모르면 generic) */}
        <FadeIn delay={0.03}>
          <div className="card-navy py-7 px-5">
            <p className="text-[10px] text-white/30 mb-1">{typeLabel} 결과</p>
            <h1 className="text-display text-white leading-snug">
              {sajuOwner ? `${sajuOwner}님의 ${typeLabel}\n결과가 도착했어요` : '누군가 당신에게\n사주 결과를 공유했어요'}
            </h1>
            <p className="text-body-sm text-white/45 mt-3 leading-relaxed">
              {report ? '핵심 일부만 미리 보고, 전체는 내 사주 분석 후에 만나보세요.' : '나도 내 사주를 분석하면 같은 깊이로 만날 수 있어요.'}
            </p>
          </div>
        </FadeIn>

        {/* 미리보기 카드 — 사주 데이터 있을 때만 노출, 없으면 skip */}
        {report && dayGanRaw && (
          <FadeIn delay={0.06}>
            <div className="card space-y-4">
              <div>
                <p className="text-label text-brand-gold font-semibold mb-1">일간(日干)</p>
                <p className="text-body-sm text-text-secondary leading-relaxed">
                  {sajuOwner}님은 <b style={{ fontFamily: 'Noto Serif KR, serif' }}>{dayGanRaw}</b> 일간 — 이 기운을 중심으로 평생의 사주가 짜여 있어요.
                </p>
              </div>
              <div className="h-px bg-border-light" />
              <div>
                <p className="text-label text-brand-gold font-semibold mb-1">{typeLabel}</p>
                <p className="text-body-sm text-text-secondary leading-relaxed">
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
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#B8965A" strokeWidth="2" strokeLinecap="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" />
                  <path d="M7 11V7a5 5 0 0110 0v4" />
                </svg>
              </div>
              <p className="text-label text-text-primary font-semibold">전체 분석</p>
              <p className="text-caption text-text-muted mt-0.5">내 사주를 분석하면 전체를 볼 수 있어요</p>
            </div>
          </div>
        </FadeIn>

        {/* 포함 항목 미리보기 — SSOT 라벨 (보일러플레이트 X) */}
        <FadeIn delay={0.12}>
          <div className="flex flex-wrap gap-2 justify-center">
            {/* 2026-05-28 — 미출시 4종(대운/월운/궁합/토정) 제거. 현재 출시 라인업으로만 표시 */}
            {['직업', '재물', '연애', '건강', '공부', '결혼', '시험', '개운'].map((item) => (
              <span key={item} className="px-3 py-1.5 rounded-full text-[11px] text-text-muted bg-bg-surface border border-border-light">
                {item}
              </span>
            ))}
          </div>
        </FadeIn>

        {/* CTA */}
        <FadeIn delay={0.15}>
          <div className="space-y-3 pt-2">
            <Button variant="gold" fullWidth size="lg" onClick={() => navigate('/input')}>
              나도 내 사주 알아보기
            </Button>
            <p className="text-center text-[10px] text-text-hint">
              1운 · 깊이 있는 분석 · 3분 완성
            </p>
            <button
              onClick={() => navigate('/')}
              className="w-full text-center text-caption text-text-muted py-2"
            >
              사주500 둘러보기
            </button>
          </div>
        </FadeIn>
      </div>
    </div>
  );
}
