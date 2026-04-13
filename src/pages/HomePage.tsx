import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { usePageTitle } from '@/hooks/usePageTitle';
import { Button } from '@/components/common/Button';
import { FadeIn } from '@/components/common/FadeIn';
import { getReports, getBalance } from '@/services/storage/localStore';
import { CHEONGAN_OHENG } from '@/constants/oheng';
import { IconChevronRight } from '@/components/brand/Icons';
import { IconTaegeuk } from '@/components/brand/OhengIcons';

/** 시간대별 인사 — returning user 히어로에서 사용 */
function getTimeGreeting() {
  const h = new Date().getHours();
  if (h < 6)  return { greeting: '좋은 새벽이에요', label: '새벽', desc: '고요한 새벽, 오늘의 기운을 미리 확인하세요' };
  if (h < 9)  return { greeting: '좋은 아침이에요', label: '아침', desc: '하루를 여는 아침, 오늘의 방향을 잡아보세요' };
  if (h < 12) return { greeting: '활기찬 오전이에요', label: '오전', desc: '오전의 양(陽) 기운이 가장 강한 시간이에요' };
  if (h < 14) return { greeting: '점심시간이에요', label: '점심', desc: '잠깐 쉬면서, 오후의 기운을 확인해보세요' };
  if (h < 18) return { greeting: '오후가 됐네요', label: '오후', desc: '남은 하루의 흐름, 지금 확인하세요' };
  if (h < 21) return { greeting: '수고한 하루예요', label: '저녁', desc: '오늘을 돌아보며, 내일의 운세를 미리 만나보세요' };
  return { greeting: '편안한 밤이에요', label: '밤', desc: '밤의 고요 속에서 내면의 기운을 살펴보세요' };
}

/** 오늘의 운세 카드 일러스트 — 해/달 + 별 */
function FortuneSunMoon({ size = 64 }: { size?: number }) {
  const h = new Date().getHours();
  const isNight = h < 6 || h >= 18;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      {isNight ? (
        <>
          {/* 달 */}
          <circle cx="32" cy="28" r="14" fill="#C9A96E" fillOpacity="0.15" />
          <path d="M26 14a14 14 0 0010 24A14 14 0 1126 14z" fill="#C9A96E" fillOpacity="0.3" stroke="#C9A96E" strokeWidth="1" />
          {/* 별 */}
          <circle cx="50" cy="14" r="1.5" fill="#C9A96E" opacity="0.7" />
          <circle cx="14" cy="20" r="1" fill="#C9A96E" opacity="0.5" />
          <circle cx="54" cy="30" r="1" fill="#C9A96E" opacity="0.4" />
          <circle cx="46" cy="44" r="1.2" fill="#C9A96E" opacity="0.6" />
          <circle cx="18" cy="42" r="0.8" fill="#C9A96E" opacity="0.3" />
        </>
      ) : (
        <>
          {/* 해 */}
          <circle cx="32" cy="28" r="10" fill="#C9A96E" fillOpacity="0.2" stroke="#C9A96E" strokeWidth="1.2" />
          <circle cx="32" cy="28" r="6" fill="#C9A96E" fillOpacity="0.35" />
          {/* 광선 */}
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
            const rad = (deg * Math.PI) / 180;
            const x1 = 32 + Math.cos(rad) * 13;
            const y1 = 28 + Math.sin(rad) * 13;
            const x2 = 32 + Math.cos(rad) * 18;
            const y2 = 28 + Math.sin(rad) * 18;
            return <line key={deg} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#C9A96E" strokeWidth="1" strokeLinecap="round" opacity="0.4" />;
          })}
          {/* 구름 */}
          <ellipse cx="20" cy="46" rx="10" ry="4" fill="#C9A96E" fillOpacity="0.08" />
          <ellipse cx="46" cy="48" rx="8" ry="3" fill="#C9A96E" fillOpacity="0.06" />
        </>
      )}
    </svg>
  );
}

/** 꿈해몽 일러스트 — 구름 + 눈 */
function DreamCloudIcon({ size = 64 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      {/* 큰 구름 */}
      <path d="M16 38c-3 0-6-2-6-5s2-5 5-5c0-5 4-9 9-9 4 0 7 2 8 5 1-1 3-1 4-1 4 0 7 3 7 7 0 0 0 1 0 1 2 1 3 3 3 5s-2 4-5 4H16z"
        fill="#1B2A4A" fillOpacity="0.08" stroke="#1B2A4A" strokeWidth="0.8" strokeOpacity="0.2" />
      {/* 작은 구름 */}
      <path d="M40 44c-2 0-3-1-3-3s1-3 3-3c0-3 2-5 5-5 2 0 4 1 5 3 0 0 1 0 2 0 2 0 3 1 3 3 0 2-1 3-3 3 0 1-1 2-2 2H40z"
        fill="#C9A96E" fillOpacity="0.1" stroke="#C9A96E" strokeWidth="0.6" strokeOpacity="0.3" />
      {/* 눈 (잠든 눈) */}
      <path d="M22 30c2-2 5-2 7 0" stroke="#1B2A4A" strokeWidth="1.2" strokeLinecap="round" strokeOpacity="0.3" />
      {/* Z 기호 */}
      <text x="48" y="22" fill="#C9A96E" fillOpacity="0.5" fontSize="10" fontWeight="bold" fontFamily="serif">Z</text>
      <text x="52" y="16" fill="#C9A96E" fillOpacity="0.35" fontSize="7" fontWeight="bold" fontFamily="serif">z</text>
      {/* 별 */}
      <circle cx="10" cy="16" r="1.2" fill="#C9A96E" opacity="0.4" />
      <circle cx="56" cy="28" r="1" fill="#C9A96E" opacity="0.3" />
    </svg>
  );
}

export function HomePage() {
  usePageTitle();
  const navigate = useNavigate();
  const today = new Date();
  const dateStr = today.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' });

  const allReports = useMemo(() => getReports(), [today]);
  // 홈 히어로 = 본인 사주만 표시
  const myReport = useMemo(() =>
    allReports.find(r => !r.input.relation || r.input.relation === '본인' || r.input.relation === 'self') || null
  , [allReports]);
  const recentReports = allReports.slice(0, 2);
  const hasHistory = !!myReport;
  const latestReport = myReport;
  const balance = useMemo(() => getBalance(), [today]); // 페이지 리렌더 시 갱신

  const sajuSummary = useMemo(() => {
    if (!latestReport) return null;
    const p = latestReport.sajuData.pillars;
    const ilgan = p[2]?.천간 || '';
    const oheng = ilgan ? CHEONGAN_OHENG[ilgan] : '';
    return { name: latestReport.name, ilgan, oheng };
  }, [latestReport]);

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-page-gradient)' }}>
      {/* BalanceBar가 상단 safe-area + 로고 + 잔액 처리 */}

      <div className="px-5 pb-tab-safe space-y-5">

        {/* ====== 히어로 (returning user) ====== */}
        {hasHistory && sajuSummary ? (
          <FadeIn delay={0.03}>
            <div className="card-navy py-7 px-6">
              <p className="text-caption text-white/40">{dateStr}</p>
              <h2 className="text-h1 text-white mt-2">
                {sajuSummary.name}님, {getTimeGreeting().greeting}
              </h2>
              <p className="text-body-sm text-white/50 mt-1">
                {sajuSummary.ilgan}({sajuSummary.oheng}) 일간 · 잔액 {balance}운
              </p>
              <div className="mt-5 p-4 rounded-xl bg-white/8 border border-white/10">
                <p className="text-label text-brand-gold-light">{getTimeGreeting().label}의 기운</p>
                <p className="text-body-sm text-white/70 mt-1 leading-relaxed">
                  {getTimeGreeting().desc}
                </p>
              </div>
              <Button variant="gold" size="lg" fullWidth onClick={() => navigate('/daily')} className="mt-5">
                오늘의 운세 확인하기
              </Button>
              <p className="text-center text-[10px] text-white/35 mt-1.5">매일 1회 무료</p>
            </div>
          </FadeIn>
        ) : (
          <FadeIn delay={0.03}>
            <div className="card-navy py-8 px-6">
              <div className="flex items-center gap-3 mb-4">
                <IconTaegeuk size={24} />
                <p className="text-caption text-white/40">{dateStr}</p>
              </div>
              <h2 className="text-display text-white leading-snug">
                나도 몰랐던 나를,<br />사주가 알고 있었습니다
              </h2>
              <p className="text-body-sm text-white/45 mt-3 leading-relaxed">
                생년월일시만 입력하면 3분 안에{'\n'}
                "이걸 어떻게 알지?" 싶은 결과를 만나게 됩니다.
              </p>
              <Button variant="gold" size="lg" fullWidth onClick={() => navigate('/input')} className="mt-6">
                내 사주 알아보기
              </Button>
              <button onClick={() => navigate('/daily')} className="w-full text-center mt-3 text-caption text-white/40 hover:text-white/60 transition-colors">
                먼저 무료 운세 체험하기
              </button>
            </div>
          </FadeIn>
        )}

        {/* ====== 무료 서비스 ====== */}
        {(
          <div className="space-y-4">
            {/* 오늘의 운세 — 비로그인만 (로그인 유저는 히어로에 있음) */}
            {!hasHistory && <FadeIn delay={0.06}>
              <motion.button
                whileTap={{ scale: 0.97 }}
                whileHover={{ y: -2 }}
                onClick={() => navigate('/daily')}
                className="card-navy w-full text-left py-6 px-5 relative overflow-hidden"
              >
                {/* 배경 데코 — 금빛 원 */}
                <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full opacity-[0.06]"
                  style={{ background: 'radial-gradient(circle, #C9A96E, transparent 70%)' }} />

                <div className="flex items-center justify-between relative z-10">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide"
                        style={{ background: 'rgba(201,169,110,0.15)', color: '#E8D5A8' }}>
                        매일 무료
                      </span>
                      <span className="text-[10px] text-white/30 font-medium">
                        {getTimeGreeting().label}
                      </span>
                    </div>
                    <p className="text-h2 text-white">오늘의 운세</p>
                    <p className="text-body-sm text-white/50 mt-1.5 leading-relaxed">
                      {getTimeGreeting().desc}
                    </p>
                    <div className="flex items-center gap-1 mt-3 text-brand-gold-light">
                      <span className="text-caption font-semibold">확인하기</span>
                      <IconChevronRight size={14} color="#E8D5A8" />
                    </div>
                  </div>
                  <div className="flex-shrink-0 ml-3">
                    <motion.div
                      animate={{ y: [0, -4, 0] }}
                      transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                    >
                      <FortuneSunMoon size={72} />
                    </motion.div>
                  </div>
                </div>
              </motion.button>
            </FadeIn>}

            {/* 꿈해몽 — 몽환적 카드 */}
            <FadeIn delay={0.09}>
              <motion.button
                whileTap={{ scale: 0.97 }}
                whileHover={{ y: -2 }}
                onClick={() => navigate('/dream')}
                className="w-full text-left relative overflow-hidden"
                style={{
                  background: 'linear-gradient(135deg, #F8F9FB 0%, #F0F1F5 50%, #EEF0F6 100%)',
                  borderRadius: 20,
                  padding: '24px 20px',
                  boxShadow: 'var(--shadow-card)',
                  border: '1px solid rgba(27,42,74,0.06)',
                }}
              >
                {/* 배경 데코 — 연한 보라빛 */}
                <div className="absolute -bottom-4 -left-4 w-24 h-24 rounded-full opacity-[0.04]"
                  style={{ background: 'radial-gradient(circle, #7B1FA2, transparent 70%)' }} />

                <div className="flex items-center justify-between relative z-10">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide"
                        style={{ background: 'rgba(201,169,110,0.12)', color: '#A08B6A' }}>
                        매일 무료
                      </span>
                    </div>
                    <p className="text-h2 text-text-primary">꿈해몽</p>
                    <p className="text-body-sm text-text-muted mt-1.5 leading-relaxed">
                      간밤에 꾼 꿈, 무슨 의미일까요?<br />
                      꿈의 메시지를 명리학으로 풀어드립니다
                    </p>
                    <div className="flex items-center gap-1 mt-3 text-brand-gold">
                      <span className="text-caption font-semibold">해몽하기</span>
                      <IconChevronRight size={14} color="#C9A96E" />
                    </div>
                  </div>
                  <div className="flex-shrink-0 ml-3">
                    <motion.div
                      animate={{ y: [0, -3, 0] }}
                      transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                    >
                      <DreamCloudIcon size={72} />
                    </motion.div>
                  </div>
                </div>
              </motion.button>
            </FadeIn>
          </div>
        )}

        {/* 사주 상담 카드 — 서비스 목록에 통합됨, 별도 히어로 제거 */}

        {/* ====== 서비스 카드 ====== */}
        <FadeIn delay={0.12}>
          <div className="space-y-3">

            {/* 서비스 카드 */}
            {[
              {
                title: '사주 상담',
                desc: '대화로 궁금한 점을 바로 물어보세요\n매일 1회 무료',
                cost: 1, price: '추가 3회',
                path: '/chat',
                iconBg: 'rgba(27,42,74,0.08)',
                icon: (
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                    <path d="M21 12a9 9 0 01-9 9c-1.5 0-2.9-.4-4.1-1L3 21l1.1-4.1A9 9 0 1121 12z"
                      stroke="#1B2A4A" strokeWidth="1.3" fill="#1B2A4A" fillOpacity="0.05" />
                    <circle cx="8.5" cy="12" r="1" fill="#1B2A4A" /><circle cx="12" cy="12" r="1" fill="#1B2A4A" /><circle cx="15.5" cy="12" r="1" fill="#1B2A4A" />
                  </svg>
                ),
              },
              {
                title: '내 사주 풀이',
                desc: '성격, 직업, 연애, 재물, 건강까지\n12가지 항목을 그림과 함께 분석',
                cost: 1, price: '500원',
                path: '/input',
                iconBg: 'rgba(27,42,74,0.06)',
                icon: <IconTaegeuk size={28} />,
              },
              {
                title: '궁합 분석',
                desc: '두 사람의 사주를 비교해\n연애, 결혼, 직장 궁합을 점수로 확인',
                cost: 1, price: '500원',
                path: '/compat',
                iconBg: 'rgba(201,169,110,0.08)',
                icon: (
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#C9A96E" strokeWidth="1.3">
                    <circle cx="8" cy="8" r="5" /><circle cx="16" cy="8" r="5" />
                    <path d="M12 14c-4 0-8 2-8 5v1h16v-1c0-3-4-5-8-5z" fill="#C9A96E" fillOpacity="0.08" />
                  </svg>
                ),
              },
              {
                title: '대운 해설',
                desc: '10년 단위 인생의 큰 흐름을 읽어드려요',
                tag: '평생 운의 지도',
                tagColor: '#1B2A4A',
                cost: 1, price: '500원',
                path: '/daeun',
                iconBg: 'rgba(27,42,74,0.08)',
                icon: (
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#1B2A4A" strokeWidth="1.3">
                    <path d="M3 12h4l3-9 4 18 3-9h4" />
                  </svg>
                ),
              },
              {
                title: `${new Date().getFullYear()} 월별 운세`,
                desc: '올해 12개월, 좋은 달과 조심할 달을 한눈에',
                tag: '사주 기반 월별 점수',
                tagColor: '#2D8A4E',
                cost: 1, price: '500원',
                path: '/monthly',
                iconBg: 'rgba(45,138,78,0.08)',
                icon: (
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#2D8A4E" strokeWidth="1.3">
                    <rect x="3" y="4" width="18" height="18" rx="2" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                    <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" />
                  </svg>
                ),
              },
              {
                title: '토정비결',
                desc: '조선시대 전통 운세법으로 올해를 풀어봐요',
                tag: '주역 64괘 전통 해석',
                tagColor: '#C9A96E',
                cost: 1, price: '500원',
                path: '/tojung',
                iconBg: 'rgba(201,169,110,0.08)',
                icon: (
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#C9A96E" strokeWidth="1.3">
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                    <line x1="9" y1="7" x2="17" y2="7" /><line x1="9" y1="11" x2="15" y2="11" />
                  </svg>
                ),
              },
            ].map((svc) => (
              <motion.button
                key={svc.title}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate(svc.path)}
                className="card w-full text-left py-5 px-5"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                    style={{ background: svc.iconBg }}>
                    {svc.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-h2 text-text-primary">{svc.title}</p>
                    <p className="text-caption text-text-muted mt-0.5 leading-relaxed whitespace-pre-line">{svc.desc}</p>
                    {(svc as any).tag && (
                      <span className="inline-block mt-1.5 px-2 py-0.5 rounded text-[9px] font-bold"
                        style={{ background: `${(svc as any).tagColor}12`, color: (svc as any).tagColor }}>
                        {(svc as any).tag}
                      </span>
                    )}
                  </div>
                  {/* 가격 — 오른쪽에 크고 명확하게 */}
                  <div className="flex-shrink-0 text-right pl-3">
                    <p className="text-h2 text-brand-gold font-bold">{svc.cost}운</p>
                    <p className="text-[10px] text-text-hint">{svc.price}</p>
                  </div>
                </div>
              </motion.button>
            ))}

            {/* 프리미엄 예고 — 나중에 활성화 */}
            {/*
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate('/input?tier=premium')}
              className="card-emphasis w-full text-left py-5 px-5"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, #C9A96E, #D4A843)' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFF" strokeWidth="1.5">
                    <path d="M12 2l2.4 7.2H22l-6 4.8 2.4 7.2L12 16.8 5.6 21.2 8 14 2 9.2h7.6L12 2z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-h3 text-text-primary">프리미엄 심층 분석</p>
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold text-white"
                      style={{ background: 'linear-gradient(135deg, #C9A96E, #D4A843)' }}>
                      PREMIUM
                    </span>
                  </div>
                  <p className="text-caption text-text-muted mt-0.5 leading-relaxed">
                    기본 12항목 + PDF 리포트 + 월운 상세 + 궁합 포함
                  </p>
                </div>
                <div className="flex-shrink-0 text-right pl-3">
                  <p className="text-h2 text-brand-gold font-bold">10운</p>
                  <p className="text-[10px] text-text-hint">5,000원</p>
                </div>
              </div>
            </motion.button>
            */}

          </div>
        </FadeIn>

        {/* ====== 주제별 심층 분석 ====== */}
        <FadeIn delay={0.15}>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-h2 text-text-primary">주제별 심층 분석</h2>
              <span className="text-caption text-brand-gold font-semibold">각 1운</span>
            </div>
            <p className="text-caption text-text-muted -mt-1">궁금한 운세만 골라서 깊이 있게</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'love',     icon: '愛', label: '연애운',       color: '#E91E63' },
                { id: 'wealth',   icon: '財', label: '재물운',       color: '#C9A96E' },
                { id: 'career',   icon: '事', label: '취업·이직운', color: '#1565C0' },
                { id: 'marriage', icon: '婚', label: '결혼운',       color: '#E91E63' },
                { id: 'business', icon: '商', label: '사업운',       color: '#2D8A4E' },
                { id: 'health',   icon: '健', label: '건강운',       color: '#2E7D32' },
                { id: 'reunion',  icon: '緣', label: '재회운',       color: '#7B1FA2' },
                { id: 'study',    icon: '學', label: '학업운',       color: '#0288D1' },
                { id: 'social',   icon: '人', label: '대인관계운',   color: '#F57F17' },
                { id: 'moving',   icon: '動', label: '이사운',       color: '#757575' },
              ].map((t) => (
                <motion.button
                  key={t.id}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => navigate(`/topic/${t.id}`)}
                  className="card py-4 px-4 flex items-center gap-3"
                >
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: `${t.color}12` }}>
                    <span className="text-[17px] font-black" style={{ color: t.color }}>{t.icon}</span>
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-body-sm font-semibold text-text-primary">{t.label}</p>
                  </div>
                </motion.button>
              ))}
            </div>
          </div>
        </FadeIn>

        {/* ====== 최근 분석 ====== */}
        {hasHistory && (
          <FadeIn delay={0.12}>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-label text-text-hint">최근 분석</p>
                <button onClick={() => navigate('/storage')} className="text-caption text-brand-gold">전체 보기</button>
              </div>
              {recentReports.map((r) => {
                const ilgan = r.sajuData.pillars[2]?.천간 || '';
                const oheng = ilgan ? CHEONGAN_OHENG[ilgan] : '';
                return (
                  <motion.button
                    key={r.id}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => navigate(`/result/${r.id}`)}
                    className="card w-full text-left py-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-bg-surface flex items-center justify-center">
                        <span className="text-h3 text-brand-navy">{r.name.charAt(0)}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-h3 text-text-primary">{r.name}</p>
                        <p className="text-caption text-text-muted truncate">
                          {r.input.birthYear}.{String(r.input.birthMonth).padStart(2,'0')}.{String(r.input.birthDay).padStart(2,'0')} · {ilgan} {oheng} 일간
                        </p>
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </FadeIn>
        )}

        {/* 구분선 */}
        <div className="flex items-center gap-3 py-1">
          <div className="flex-1 h-px bg-border-light" />
          <span className="text-[10px] text-text-disabled font-medium tracking-wider">ABOUT</span>
          <div className="flex-1 h-px bg-border-light" />
        </div>

        {/* ====== 왜 사주500인가 ====== */}
        <FadeIn delay={0.15}>
          <div className="space-y-4">

            {/* 헤드라인 + 참고 원전 — 골드 카드 */}
            <div className="card-gold py-7 px-5">
              <p className="text-caption text-brand-gold font-semibold mb-3">왜 사주500일까요?</p>
              <h3 className="text-display text-text-primary leading-snug">
                600년간 검증된{'\n'}해석법으로,{'\n'}누구나 쉽게 읽을 수 있게!
              </h3>

              {/* 참고 원전 — 헤드라인 바로 아래 */}
              <div className="mt-5 space-y-2.5">
                <p className="text-[10px] text-text-hint font-semibold">참고 원전</p>
                {[
                  { title: '적천수(滴天髓)', era: '明', desc: '일간 강약 판단의 교과서' },
                  { title: '자평진전(子平眞詮)', era: '清', desc: '격국·십성 해석의 정수' },
                  { title: '궁통보감(窮通寶鑑)', era: '清', desc: '월령 용신론의 핵심' },
                  { title: '삼명통회(三命通會)', era: '明', desc: '간지·신살·납음 종합 체계' },
                  { title: '연해자평(淵海子平)', era: '宋', desc: '자평법의 시초' },
                ].map((book) => (
                  <div key={book.title} className="flex items-start gap-2.5">
                    <div className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ background: 'rgba(201,169,110,0.15)' }}>
                      <span className="text-[9px] font-bold text-brand-gold">{book.era}</span>
                    </div>
                    <div>
                      <p className="text-caption text-text-primary font-medium">{book.title}</p>
                      <p className="text-[10px] text-text-muted">{book.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 포인트 3개 */}
            <div className="card py-6 px-5 space-y-2">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[11px] font-black text-brand-gold">01</span>
                <div className="flex-1 h-px bg-border-light" />
              </div>
              <p className="text-h2 text-text-primary leading-snug">
                "이걸 어떻게 알지?"{'\n'}소름 돋는 정확함
              </p>
              <p className="text-body-sm text-text-muted mt-2 leading-relaxed">
                카톡 답장을 보내기 전에 세 번은 고민하는 성격,{'\n'}
                새 프로젝트 앞에서 설레면서도 불안한 그 마음 —{'\n'}
                당신의 일상이 결과지에 그대로 담겨 있습니다.
              </p>
            </div>

            <div className="card py-6 px-5 space-y-2">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[11px] font-black text-brand-gold">02</span>
                <div className="flex-1 h-px bg-border-light" />
              </div>
              <p className="text-h2 text-text-primary leading-snug">
                어려운 한자 대신,{'\n'}보면 바로 이해되는 그림
              </p>
              <p className="text-body-sm text-text-muted mt-2 leading-relaxed">
                내 오행이 어떻게 흐르는지, 올해 몇 월이 좋은지,{'\n'}
                어떤 직업이 나와 맞는지 — 한눈에 보이는 도표로.{'\n'}
                사주를 처음 보는 사람도 바로 이해할 수 있어요.
              </p>
            </div>

            <div className="card py-6 px-5 space-y-2">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[11px] font-black text-brand-gold">03</span>
                <div className="flex-1 h-px bg-border-light" />
              </div>
              <p className="text-h2 text-text-primary leading-snug">
                500원이면 충분해요
              </p>
              <p className="text-body-sm text-text-muted mt-2 leading-relaxed">
                자동결제 없음. 광고 없음. 추가 과금 없음.{'\n'}
                믹스커피 한 잔 가격으로 성격, 직업, 연애, 건강까지{'\n'}
                12가지 항목을 낱낱이 분석해드립니다.
              </p>
            </div>

            {/* (참고 원전은 위 헤드라인 카드에 통합) */}
          </div>
        </FadeIn>

        {/* ====== 기술 각주 + 푸터 ====== */}
        <div className="px-1 pt-2 pb-2 space-y-4">
          <p className="text-[10px] text-text-disabled leading-relaxed">
            사주500은 수백 년간 축적된 명리학 원전과 방대한 해석 자료를
            최신 언어모델 기술로 체계화하여 제공해요.
            분석 결과는 참고용이며, 중요한 결정은 전문가와 상담해주세요.
          </p>
          <div className="text-center space-y-2">
            <p className="text-tiny text-text-hint">사주500 · 정통 명리학의 현대적 해석</p>
            <div className="flex justify-center gap-3">
              <button className="text-tiny text-text-disabled hover:text-text-muted transition-colors">이용약관</button>
              <span className="text-tiny text-text-disabled">·</span>
              <button className="text-tiny text-text-disabled hover:text-text-muted transition-colors">개인정보처리방침</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
