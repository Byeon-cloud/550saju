// PremiumSelectPage — 종합 사주 시작 페이지 (10운)
// 흐름:
//   /premium → ProfilePicker → CTA → spendBalance(10) → /loading?type=premium → /result/{id}
//   ✓ 잔액 ≥ 10: 차감 후 결과 페이지
//   ✗ 잔액 < 10: 충전 페이지로 이동

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { FadeIn } from '@/components/common/FadeIn';
import { Button } from '@/components/common/Button';
import { ProfilePicker } from '@/components/common/ProfilePicker';
import { useToast } from '@/components/common/Toast';
import { usePageTitle } from '@/hooks/usePageTitle';
import {
  getProfiles,
  getBalance,
  spendBalance,
  type SajuProfile,
} from '@/services/storage/localStore';
import { useSajuContext } from '@/contexts/SajuContext';
import { calculateSaju } from '@/services/saju/calculator';

export function PremiumSelectPage() {
  usePageTitle('종합 사주 풀이');
  const navigate = useNavigate();
  const toast = useToast();
  const sajuCtx = useSajuContext();

  const profiles = useMemo(() => getProfiles(), []);
  const [selected, setSelected] = useState<SajuProfile | null>(null);
  // 잔액 표시 (차감은 spendBalance 후 페이지 navigate 로 갱신)
  const [balance] = useState<number>(getBalance());

  function startPremium() {
    if (!selected) {
      toast.show('사주를 먼저 선택해주세요', 'info');
      return;
    }

    // 사주 데이터 확보
    const sajuData =
      (selected as any).sajuData || calculateSaju(selected.input as any);
    if (!sajuData) {
      toast.show('사주 계산 실패. 다시 시도해주세요', 'warning');
      return;
    }

    // 잔액 차감 — 실패 시 차단 + 충전 페이지로 유도 (런칭 모드)
    const spent = spendBalance(10);
    if (!spent) {
      toast.show(`잔액 부족 — 충전 페이지로 이동합니다`, 'warning');
      navigate('/charge?need=10');
      return;
    }
    toast.show(`10운 차감 (잔액 ${getBalance()}운) — 종합 사주 시작`, 'success');

    // SajuContext set 후 LoadingPage 로 (실제 AI 생성)
    sajuCtx.setInput(selected.input as any);
    sajuCtx.setSajuData(sajuData);
    navigate('/loading?type=premium');
  }

  // 등록된 사주 0건 → 입력 페이지로 유도
  if (profiles.length === 0) {
    return (
      <div
        className="min-h-screen pb-tab-safe"
        style={{ background: 'var(--bg-page-gradient)' }}
      >
        <Header title="종합 사주" />
        <div className="px-5 pt-8 text-center space-y-4">
          <p className="text-h2 text-text-primary">먼저 사주를 입력해주세요</p>
          <p className="text-body-sm text-text-muted">
            사주 데이터가 있어야 종합 사주를 볼 수 있어요.
          </p>
          <Button
            onClick={() => navigate('/input?from=home_body_premium')}
            variant="gold"
            size="lg"
            fullWidth
          >
            사주 입력하러 가기
          </Button>
        </div>
      </div>
    );
  }

  const enough = balance >= 10;

  return (
    <div
      className="min-h-screen pb-tab-safe"
      style={{ background: 'var(--bg-page-gradient)' }}
    >
      <Header title="종합 사주" />
      <div className="px-5 pt-4 space-y-5">
        {/* 인트로 */}
        <FadeIn>
          <div
            className="py-6 px-5 rounded-2xl text-center"
            style={{
              background: 'linear-gradient(135deg, #F5F0E8, #EDE5D5)',
              border: '1px solid rgba(184,150,90,0.2)',
            }}
          >
            <p className="text-caption text-brand-gold font-semibold">
              한국 명리학 6대 원전 기반
            </p>
            <p className="text-display text-text-primary mt-1">
              종합 사주 풀이
            </p>
            <p className="text-body-sm text-text-muted mt-2">
              원국·천간지지·십성·용신·대운·연운·신살·관계·주제·실천 — 10섹션
              깊이 풀이
            </p>
            <p className="text-caption text-text-hint mt-1">10운 / 1회</p>
          </div>
        </FadeIn>

        {/* 잔액 표시 — 큼지막하게 */}
        <FadeIn delay={0.03}>
          <div
            className="py-4 px-5 rounded-xl"
            style={{
              background: enough ? 'rgba(46,125,50,0.08)' : 'rgba(198,40,40,0.08)',
              border: `1px solid ${enough ? 'rgba(46,125,50,0.25)' : 'rgba(198,40,40,0.25)'}`,
            }}
          >
            <div className="flex items-center justify-between">
              <p className="text-caption text-text-muted">내 잔액</p>
              <p
                style={{
                  fontSize: 22,
                  fontWeight: 800,
                  color: enough ? '#2e7d32' : '#c62828',
                  fontFeatureSettings: "'tnum'",
                }}
              >
                {balance}운
              </p>
            </div>
            {!enough && (
              <p
                className="mt-2 text-caption"
                style={{ color: '#c62828', fontWeight: 600 }}
              >
                10운 필요 · 부족 {10 - balance}운
              </p>
            )}
            <div className="mt-3">
              <button
                onClick={() => navigate('/charge?need=10')}
                className="w-full py-2 rounded-lg text-caption font-semibold"
                style={{
                  background: '#FFFFFF',
                  border: '1px solid rgba(184,150,90,0.4)',
                  color: '#B8965A',
                }}
              >
                충전 페이지로
              </button>
            </div>
          </div>
        </FadeIn>

        {/* 프로필 선택 */}
        <FadeIn delay={0.05}>
          <ProfilePicker
            onSelect={(p) => setSelected(p)}
            onNew={() => navigate('/input?from=home_body_premium&new=1')}
            title="누구의 사주를 풀어볼까요?"
          />
        </FadeIn>

        {/* 선택된 프로필 표시 */}
        {selected && (
          <FadeIn delay={0.1}>
            <div className="card-gold py-3 px-4 flex items-center justify-between">
              <p className="text-body-sm text-text-primary">
                <span className="font-bold">{selected.name}</span>님 선택됨
              </p>
              <button
                onClick={() => setSelected(null)}
                className="text-caption text-text-muted"
              >
                변경
              </button>
            </div>
          </FadeIn>
        )}
      </div>

      {/* 하단 sticky CTA */}
      {selected && (
        <div className="sticky-cta-bottom">
          <Button
            onClick={startPremium}
            variant="gold"
            size="lg"
            fullWidth
          >
            {enough
              ? '종합 사주 시작 (10운)'
              : `잔액 부족 — 충전 페이지로 (${balance}/10운)`}
          </Button>
        </div>
      )}
    </div>
  );
}
