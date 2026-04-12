import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FadeIn } from '@/components/common/FadeIn';
import { LoginPrompt } from '@/components/common/LoginPrompt';
import { useAuth } from '@/hooks/useAuth';
import { getBalance, getBalanceBreakdown, getReports } from '@/services/storage/localStore';
import { CHEONGAN_OHENG, OHENG_MAP } from '@/constants/oheng';

import { IconSaju } from '@/components/brand/Icons';
import { useToast } from '@/components/common/Toast';
import { usePageTitle } from '@/hooks/usePageTitle';
import type { OhengType } from '@/types/saju';

const MENU_ITEMS = [
  { label: '분석 기록', path: '/storage', desc: '' },
  { label: '운(運) 충전', path: '/charge', desc: '' },
  { label: '이용약관', path: '/terms', desc: '' },
  { label: '개인정보처리방침', path: '/privacy', desc: '' },
  { label: '고객 문의', path: '', desc: 'saju500help@gmail.com' },
];

export function MyPage() {
  const navigate = useNavigate();
  usePageTitle('내 정보');
  const { loading, isLoggedIn, devLogin } = useAuth();
  const toast = useToast();
  const [balance, setBalanceState] = useState(0);
  const [reportCount, setReportCount] = useState(0);

  const location = useLocation();
  const allReports = useMemo(() => getReports(), [location.pathname]);
  const reports = allReports; // 전체 (보관함 카운트용)
  // 내 정보 = "본인" 관계인 리포트만 (타인 분석은 내 정보에 안 나옴)
  const myReport = useMemo(() =>
    allReports.find(r => !r.input.relation || r.input.relation === '본인' || r.input.relation === 'self') || null
  , [allReports]);
  const latestReport = myReport;

  useEffect(() => {
    setBalanceState(getBalance());
    setReportCount(reports.length);
  }, [reports, location.pathname]);

  // 사주 프로필 데이터
  const sajuProfile = useMemo(() => {
    if (!latestReport) return null;
    const p = latestReport.sajuData.pillars;
    const ilgan = p[2]?.천간 || '';
    const oheng = ilgan ? CHEONGAN_OHENG[ilgan] : '';
    const elements = latestReport.sajuData.elements;
    return {
      name: latestReport.name,
      ilgan,
      oheng,
      birth: `${latestReport.input.birthYear}.${String(latestReport.input.birthMonth).padStart(2,'0')}.${String(latestReport.input.birthDay).padStart(2,'0')}`,
      gender: latestReport.input.gender === 'male' ? '남' : '여',
      hasBirthTime: latestReport.input.hasBirthTime,
      birthHour: latestReport.input.birthHour,
      pillars: p,
      elements,
      zodiac: latestReport.sajuData.띠 || '',
    };
  }, [latestReport]);

  if (loading) return null;

  // 로그인 없이도 로컬 데이터로 마이페이지 진입 가능
  // (앱인토스에서는 토스 로그인, 웹에서는 소셜 로그인 — 별도 섹션으로 처리)

  return (
    <div className="min-h-screen pb-tab-safe" style={{ background: 'var(--bg-page-gradient)' }}>
      <div className="h-safe-top" />
      <div className="px-5 pt-4 space-y-5">

        <FadeIn>
          <h1 className="text-display text-text-primary">마이</h1>
        </FadeIn>

        {/* ====== 내 사주 프로필 or 등록 유도 ====== */}
        {!sajuProfile ? (
          <FadeIn delay={0.03}>
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate('/input')}
              className="card-gold w-full text-left py-5 px-5"
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(201,169,110,0.15)' }}>
                  <IconSaju size={28} color="#C9A96E" />
                </div>
                <div className="flex-1">
                  <p className="text-h3 text-text-primary">아직 분석한 사주가 없어요</p>
                  <p className="text-caption text-text-muted mt-0.5">
                    사주를 분석하면 만세력, 오행, 대운을 한눈에 볼 수 있어요
                  </p>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C9A96E" strokeWidth="2" strokeLinecap="round"><path d="M9 18l6-6-6-6" /></svg>
              </div>
            </motion.button>
          </FadeIn>
        ) : (
          <FadeIn delay={0.03}>
            {/* 프로필 헤더 — 이름 + 일간 */}
            <div className="card-navy py-5 px-5 mb-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-h1 text-white">{sajuProfile.name}</p>
                  <p className="text-body-sm text-white/50 mt-1">
                    {sajuProfile.birth} · {sajuProfile.gender}
                    {sajuProfile.zodiac ? ` · ${sajuProfile.zodiac}띠` : ''}
                    {sajuProfile.hasBirthTime ? ` · ${sajuProfile.birthHour}시` : ''}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-[48px] font-black leading-none text-brand-gold-light">{sajuProfile.ilgan}</p>
                  <p className="text-caption text-white/45 mt-1">{sajuProfile.oheng} 일간</p>
                </div>
              </div>
            </div>

            {/* 만세력 4기둥 */}
            <div className="flex gap-2 mb-3">
              {sajuProfile.pillars.map((p: any, i: number) => {
                if (p.available === false) {
                  return (
                    <div key={i} className="flex-1 rounded-xl border border-dashed border-border py-3 text-center bg-bg-surface">
                      <p className="text-caption text-text-hint">시주</p>
                      <p className="text-body-sm text-text-disabled mt-1">미입력</p>
                    </div>
                  );
                }
                const ohengKey = CHEONGAN_OHENG[p.천간] as OhengType;
                const info = ohengKey ? OHENG_MAP[ohengKey] : null;
                const isMe = i === 2;
                return (
                  <div key={i} className={`flex-1 rounded-xl py-3 text-center ${isMe ? 'border-2 border-brand-gold' : 'border border-border-light'}`}
                    style={{ background: isMe ? 'rgba(201,169,110,0.06)' : 'var(--bg-card)' }}>
                    <p className={`text-caption ${isMe ? 'text-brand-gold font-bold' : 'text-text-hint'}`}>{['년', '월', '일', '시'][i]}주</p>
                    <p className={`text-h1 mt-1 ${isMe ? 'text-brand-gold' : 'text-text-primary'}`}>{p.천간}{p.지지}</p>
                    <p className="text-caption mt-0.5" style={{ color: info?.color || 'var(--text-muted)' }}>{p.천간읽기}{p.지지읽기}</p>
                  </div>
                );
              })}
            </div>

            {/* 오행 분포 — 밝은 카드 */}
            <div className="card">
              <p className="text-h3 text-text-primary mb-4">오행 분포</p>
              {(() => {
                const max = Math.max(...Object.values(sajuProfile.elements) as number[], 1);
                return (Object.entries(sajuProfile.elements) as [OhengType, number][]).map(([key, val], idx) => {
                  const info = OHENG_MAP[key];
                  const pct = (val / max) * 100;
                  const isEmpty = val === 0;
                  return (
                    <div key={key} className="flex items-center gap-3 mb-3">
                      <div className="w-10 text-center">
                        <span className="text-h2 font-black" style={{ color: info?.color || '#888' }}>{info?.hanja}</span>
                      </div>
                      <span className="text-body-sm text-text-secondary w-6 font-semibold">{key}</span>
                      <div className="flex-1 h-3.5 rounded-full bg-bg-surface overflow-hidden">
                        <motion.div
                          className="h-full rounded-full"
                          style={{ background: isEmpty ? 'transparent' : `linear-gradient(90deg, ${info?.color}CC, ${info?.color})` }}
                          initial={{ width: 0 }}
                          animate={{ width: isEmpty ? '0%' : `${Math.max(pct, 8)}%` }}
                          transition={{ duration: 1, delay: idx * 0.1 }}
                        />
                      </div>
                      <span className={`text-h3 w-10 text-right ${isEmpty ? 'text-func-danger' : 'text-text-primary'}`}>
                        {isEmpty ? '없음' : val}
                      </span>
                    </div>
                  );
                });
              })()}
            </div>
          </FadeIn>
        )}

        {/* ====== 잔액 + 충전 ====== */}
        <FadeIn delay={0.06}>
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate('/charge')}
            className="card-gold w-full text-left"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-caption text-text-muted">내 운(運) 잔액</p>
                <div className="flex items-baseline gap-1.5 mt-1">
                  <span className="text-display text-text-primary">{balance}</span>
                  <span className="text-h2 text-brand-gold">운</span>
                </div>
                <p className="text-[10px] text-text-hint mt-1">
                  결제 {getBalanceBreakdown().paid} · 보너스 {getBalanceBreakdown().bonus} · 리워드 {getBalanceBreakdown().reward} · 분석 {reportCount}건
                </p>
              </div>
              <div className="flex-shrink-0 px-4 py-2.5 rounded-xl"
                style={{ background: 'linear-gradient(135deg, #C9A96E, #D4A843)' }}>
                <span className="text-label text-white font-bold">충전</span>
              </div>
            </div>
          </motion.button>
        </FadeIn>

        {/* ====== 메뉴 ====== */}
        <FadeIn delay={0.09}>
          <div className="card divide-y divide-border-light !p-0">
            {MENU_ITEMS.map((item) => (
              <button
                key={item.label}
                onClick={() => item.path && navigate(item.path)}
                disabled={!item.path}
                className={`w-full text-left py-3.5 px-4 text-body flex items-center justify-between transition-colors ${
                  item.path ? 'text-text-secondary hover:text-text-primary hover:bg-bg-surface' : 'text-text-disabled'
                }`}
              >
                <span>{item.label}</span>
                {item.path ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#A8B1C1" strokeWidth="2" strokeLinecap="round">
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                ) : item.desc ? (
                  <span className="text-[10px] text-text-disabled">{item.desc}</span>
                ) : null}
              </button>
            ))}
            <div className="py-3.5 px-4">
              <p className="text-caption text-text-disabled">앱 버전 1.0.0</p>
            </div>
          </div>
        </FadeIn>

        {/* ====== 로그인/로그아웃 ====== */}
        <FadeIn delay={0.12}>
          {isLoggedIn ? (
            <div className="flex gap-4 justify-center pt-2">
              <button onClick={() => toast.show('로그아웃 기능은 준비 중입니다', 'info')} className="text-caption text-text-muted hover:text-text-secondary transition-colors">
                로그아웃
              </button>
              <span className="text-caption text-text-disabled">·</span>
              <button onClick={() => toast.show('회원탈퇴 기능은 준비 중입니다', 'info')} className="text-caption text-text-muted hover:text-func-danger transition-colors">
                회원탈퇴
              </button>
            </div>
          ) : (
            <div className="card text-center py-5 space-y-2">
              <p className="text-body-sm text-text-muted">로그인하면 클라우드 동기화가 가능해요</p>
              <button
                onClick={() => devLogin()}
                className="px-6 py-2.5 rounded-xl text-caption font-bold text-white"
                style={{ background: 'linear-gradient(135deg, #C9A96E, #D4A843)' }}
              >
                로그인
              </button>
            </div>
          )}
        </FadeIn>
      </div>
    </div>
  );
}
