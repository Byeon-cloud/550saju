import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { usePageTitle } from '@/hooks/usePageTitle';
import { Button } from '@/components/common/Button';
import { FadeIn } from '@/components/common/FadeIn';
import { getReports, getProfiles, getBalance } from '@/services/storage/localStore';
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
        fill="#7B1FA2" fillOpacity="0.06" stroke="#7B1FA2" strokeWidth="0.8" strokeOpacity="0.2" />
      {/* 작은 구름 */}
      <path d="M40 44c-2 0-3-1-3-3s1-3 3-3c0-3 2-5 5-5 2 0 4 1 5 3 0 0 1 0 2 0 2 0 3 1 3 3 0 2-1 3-3 3 0 1-1 2-2 2H40z"
        fill="#C9A96E" fillOpacity="0.1" stroke="#C9A96E" strokeWidth="0.6" strokeOpacity="0.3" />
      {/* 눈 (잠든 눈) */}
      <path d="M22 30c2-2 5-2 7 0" stroke="#7B1FA2" strokeWidth="1.2" strokeLinecap="round" strokeOpacity="0.3" />
      {/* Z 기호 */}
      <text x="48" y="22" fill="#7B1FA2" fillOpacity="0.45" fontSize="10" fontWeight="bold" fontFamily="serif">Z</text>
      <text x="52" y="16" fill="#7B1FA2" fillOpacity="0.3" fontSize="7" fontWeight="bold" fontFamily="serif">z</text>
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
  const allReports = useMemo(() => getReports(), []);
  // 프로필 기반 — 리포트와 독립
  const myProfile = useMemo(() => {
    const profiles = getProfiles();
    return profiles.find(p => !p.relation || p.relation === '본인' || p.relation === 'self') || null;
  }, []);
  const recentReports = allReports.slice(0, 2);
  const hasHistory = !!myProfile;
  const latestReport = myProfile;
  const balance = useMemo(() => getBalance(), []); // 페이지 리렌더 시 갱신

  const sajuSummary = useMemo(() => {
    if (!latestReport) return null;
    const p = latestReport.sajuData.pillars;
    const ilgan = p[2]?.천간 || '';
    const oheng = ilgan ? CHEONGAN_OHENG[ilgan] : '';
    return { name: latestReport.name, ilgan, oheng };
  }, [latestReport]);

  // 주제별 심층 분석 데이터
  const allTopics = [
    { id: 'love',     icon: '愛', label: '연애운',       color: '#E91E63', desc: '이상형, 인연 시기, 연애 패턴', badge: '인기' },
    { id: 'reunion',  icon: '緣', label: '재회운',       color: '#7B1FA2', desc: '재회 가능성, 궁합, 실전 전략', badge: '인기' },
    { id: 'wealth',   icon: '財', label: '재물운',       color: '#C9A96E', desc: '돈 흐름, 투자 적기, 지출 패턴', badge: '추천' },
    { id: 'career',   icon: '事', label: '취업·이직운', color: '#1565C0', desc: '적성, 이직 타이밍, 맞는 직종', badge: '인기' },
    { id: 'marriage', icon: '婚', label: '결혼운',       color: '#E91E63', desc: '결혼 적기, 배우자 성향' },
    { id: 'business', icon: '商', label: '사업운',       color: '#2D8A4E', desc: '창업 시기, 맞는 업종, 동업' },
    { id: 'health',   icon: '健', label: '건강운',       color: '#2E7D32', desc: '취약 장기, 주의 시기, 체질' },
    { id: 'study',    icon: '學', label: '학업운',       color: '#0288D1', desc: '합격운, 학습 스타일, 시간대' },
    { id: 'social',   icon: '人', label: '대인관계운',   color: '#F57F17', desc: '귀인운, 구설수, 관계 패턴' },
    { id: 'moving',   icon: '動', label: '이사운',       color: '#757575', desc: '이동 적기, 길방, 해외운' },
  ];
  // 서비스 카드 렌더 헬퍼
  const renderServiceCard = (svc: { title: string; desc: string; tag?: string; tagColor?: string; cost: number; price: string; path: string; iconBg: string; icon: React.ReactNode }) => (
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
          {svc.tag && (
            <span className="inline-block mt-1.5 px-2 py-0.5 rounded text-[9px] font-bold"
              style={{ background: `${svc.tagColor}12`, color: svc.tagColor }}>
              {svc.tag}
            </span>
          )}
        </div>
        <div className="flex-shrink-0 text-right pl-3">
          <p className="text-h2 text-brand-gold font-bold">{svc.cost}운</p>
          <p className="text-[10px] text-text-hint">{svc.price}</p>
        </div>
      </div>
    </motion.button>
  );

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
            {/* 오늘의 운세 — 따뜻한 크림톤 (비로그인만, returning은 히어로에 포함) */}
            {!hasHistory && <FadeIn delay={0.06}>
              <motion.button
                whileTap={{ scale: 0.97 }}
                whileHover={{ y: -2 }}
                onClick={() => navigate('/daily')}
                className="w-full text-left relative overflow-hidden"
                style={{
                  background: 'linear-gradient(135deg, #FFF8ED 0%, #F5EDDF 100%)',
                  borderRadius: 20,
                  padding: '24px 20px',
                  boxShadow: 'var(--shadow-card)',
                  border: '1px solid rgba(201,169,110,0.15)',
                }}
              >
                {/* 배경 데코 — 금빛 원 */}
                <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full opacity-[0.08]"
                  style={{ background: 'radial-gradient(circle, #C9A96E, transparent 70%)' }} />

                <div className="flex items-center justify-between relative z-10">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide"
                        style={{ background: 'rgba(201,169,110,0.15)', color: '#A08B6A' }}>
                        매일 무료
                      </span>
                      <span className="text-[10px] text-text-hint font-medium">
                        {getTimeGreeting().label}
                      </span>
                    </div>
                    <p className="text-h2 text-text-primary">오늘의 운세</p>
                    <p className="text-body-sm text-text-muted mt-1.5 leading-relaxed">
                      {getTimeGreeting().desc}
                    </p>
                    <div className="flex items-center gap-1 mt-3 text-brand-gold">
                      <span className="text-caption font-semibold">확인하기</span>
                      <IconChevronRight size={14} color="#C9A96E" />
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

            {/* 꿈해몽 — 몽환적 라벤더 카드 */}
            <FadeIn delay={0.09}>
              <motion.button
                whileTap={{ scale: 0.97 }}
                whileHover={{ y: -2 }}
                onClick={() => navigate('/dream')}
                className="w-full text-left relative overflow-hidden"
                style={{
                  background: 'linear-gradient(135deg, #F8F3FB 0%, #F0E8F5 50%, #EDE5F3 100%)',
                  borderRadius: 20,
                  padding: '24px 20px',
                  boxShadow: 'var(--shadow-card)',
                  border: '1px solid rgba(123,31,162,0.08)',
                }}
              >
                {/* 배경 데코 — 연한 보라빛 */}
                <div className="absolute -bottom-4 -left-4 w-24 h-24 rounded-full opacity-[0.05]"
                  style={{ background: 'radial-gradient(circle, #7B1FA2, transparent 70%)' }} />

                <div className="flex items-center justify-between relative z-10">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide"
                        style={{ background: 'rgba(123,31,162,0.08)', color: '#7B1FA2' }}>
                        매일 1회 무료
                      </span>
                    </div>
                    <p className="text-h2 text-text-primary">꿈해몽</p>
                    <p className="text-body-sm text-text-muted mt-1.5 leading-relaxed">
                      간밤에 꾼 꿈, 무슨 의미일까요?<br />
                      꿈의 메시지를 명리학으로 풀어드립니다
                    </p>
                    <div className="flex items-center gap-1 mt-3" style={{ color: '#7B1FA2' }}>
                      <span className="text-caption font-semibold">해몽하기</span>
                      <IconChevronRight size={14} color="#7B1FA2" />
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

        {/* ====== 분석 서비스 (카테고리 구분) ====== */}
        <FadeIn delay={0.1}>
          <div className="space-y-3">

            {/* 내 사주 풀이 — 대표 콘텐츠 */}
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate('/input')}
              className="card-gold w-full text-left py-6 px-5 overflow-hidden relative"
              style={{ border: '1.5px solid rgba(201,169,110,0.3)', boxShadow: '0 2px 12px rgba(201,169,110,0.12)' }}
            >
              <div className="absolute -top-3 -right-3 opacity-[0.06]">
                <IconTaegeuk size={80} />
              </div>
              <div className="relative z-10">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg, rgba(201,169,110,0.2), rgba(201,169,110,0.08))' }}>
                    <IconTaegeuk size={26} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-h1 text-text-primary">내 사주 풀이</p>
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold"
                        style={{ background: 'linear-gradient(135deg, #C9A96E, #D4A843)', color: '#fff' }}>대표</span>
                    </div>
                    <p className="text-body-sm text-text-secondary leading-relaxed">
                      성격·직업·연애·건강 등 총 19개 세부 분류로{'\n'}당신의 사주를 심도 있게 해석합니다
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-4 pt-3" style={{ borderTop: '1px solid rgba(201,169,110,0.15)' }}>
                  <div className="flex items-center gap-2 flex-wrap">
                    {['12항목 심층 리포트', '인포그래픽', 'AI 맞춤 분석'].map((t) => (
                      <span key={t} className="px-2 py-0.5 rounded-full text-[9px] font-medium"
                        style={{ background: 'rgba(201,169,110,0.1)', color: '#A08B6A' }}>{t}</span>
                    ))}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0 pl-3">
                    <p className="text-h2 text-brand-gold font-bold">1운</p>
                    <p className="text-[10px] text-text-hint">(500원)</p>
                  </div>
                </div>
              </div>
            </motion.button>

            {/* ── 시간의 흐름 ── */}
            <div className="flex items-center gap-2 pt-1">
              <span className="text-[10px] font-bold text-text-hint tracking-wide">시간의 흐름</span>
              <div className="flex-1 h-px bg-border-light" />
            </div>

            {renderServiceCard({
              title: '대운 해설',
              desc: '10년 단위 인생의 큰 흐름, 지금이 어떤 시기인지',
              tag: '인생 타임라인 · 사업/연애/재물/건강',
              tagColor: '#1B2A4A',
              cost: 1, price: '500원',
              path: '/daeun',
              iconBg: 'rgba(27,42,74,0.08)',
              icon: (
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#1B2A4A" strokeWidth="1.3">
                  <path d="M3 12h4l3-9 4 18 3-9h4" />
                </svg>
              ),
            })}

            {renderServiceCard({
              title: `${new Date().getFullYear()} 월별 운세`,
              desc: '올해 12개월 흐름, 좋은 달과 조심할 달',
              tag: '월별 점수 그래프 · 베스트/워스트 월',
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
            })}

            {renderServiceCard({
              title: '토정비결',
              desc: '조선시대 이토정 선생의 전통 운세법',
              tag: '주역 64괘 · 6대 카테고리 · 12개월 상세',
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
            })}

            {/* ── 관계와 상담 ── */}
            <div className="flex items-center gap-2 pt-1">
              <span className="text-[10px] font-bold text-text-hint tracking-wide">관계와 상담</span>
              <div className="flex-1 h-px bg-border-light" />
            </div>

            {renderServiceCard({
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
            })}

            {renderServiceCard({
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
            })}

            {/* ── 주제별 심층분석 ── */}
            <div className="flex items-center gap-2 pt-1">
              <span className="text-[10px] font-bold text-text-hint tracking-wide">주제별 심층분석</span>
              <div className="flex-1 h-px bg-border-light" />
              <span className="text-[10px] text-brand-gold font-semibold">각 1운</span>
            </div>
            <p className="text-caption text-text-muted -mt-1">궁금한 운세만 골라서 깊이 있게</p>
            <div className="grid grid-cols-2 gap-2">
              {allTopics.map((t) => {
                const badgeColors: Record<string, { bg: string; text: string }> = { '인기': { bg: '#D32F2F15', text: '#D32F2F' }, '추천': { bg: '#C9A96E18', text: '#C9A96E' } };
                const bs = t.badge ? badgeColors[t.badge] : null;
                return (
                  <motion.button
                    key={t.id}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => navigate(`/topic/${t.id}`)}
                    className="card py-3.5 px-3.5 text-left relative overflow-hidden"
                  >
                    {bs && t.badge && (
                      <span className="absolute top-2.5 right-2.5 px-1.5 py-0.5 rounded text-[8px] font-bold"
                        style={{ background: bs.bg, color: bs.text }}>{t.badge}</span>
                    )}
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: `${t.color}12` }}>
                        <span className="text-[17px] font-black" style={{ color: t.color }}>{t.icon}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-body-sm font-semibold text-text-primary">{t.label}</p>
                        <p className="text-[10px] text-text-muted mt-0.5 line-clamp-1">{t.desc}</p>
                      </div>
                    </div>
                  </motion.button>
                );
              })}
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

        {/* ====== ABOUT ====== */}
        <div id="about-section" className="flex items-center gap-3 py-1 scroll-mt-16">
          <div className="flex-1 h-px bg-border-light" />
          <span className="text-[10px] text-text-disabled font-medium tracking-wider">ABOUT</span>
          <div className="flex-1 h-px bg-border-light" />
        </div>

        <FadeIn delay={0.15}>
          <div className="space-y-4">

            {/* 헤드라인 + 참고 원전 — 골드 카드 */}
            <div className="card-gold py-7 px-5">
              <p className="text-caption text-brand-gold font-semibold mb-3">왜 사주500일까요?</p>
              <h3 className="text-display text-text-primary leading-snug">
                600년간 검증된{'\n'}해석법으로,{'\n'}누구나 쉽게 읽을 수 있게!
              </h3>

              {/* 참고 원전 */}
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

            {/* 포인트 3개 — 하나의 카드에 압축, 가독성 강화 */}
            <div className="card py-7 px-5 space-y-6">
              {[
                { num: '01', title: '어려운 한자 대신,\n보면 바로 이해되는 그림', desc: '내 오행 흐름, 좋은 달, 맞는 직업 — 한눈에 보이는 도표로.\n사주를 처음 보는 사람도 바로 이해할 수 있어요.' },
                { num: '02', title: '성격이 아니라,\n행동 패턴까지 짚어줘요', desc: '밀당을 못하는 이유, 먼저 말하기 어려운 이유 —\n사주에 다 이유가 있어요. \'왜 그런지\'를 설명합니다.' },
                { num: '03', title: '500원이면 충분해요', desc: '자동결제·광고·추가과금 없이\n12가지 항목을 낱낱이 분석해드립니다.' },
              ].map((usp, i) => (
                <div key={usp.num}>
                  {i > 0 && <div className="h-px bg-border-light mb-6" />}
                  <div className="flex items-start gap-4">
                    <span className="text-[14px] font-black mt-1" style={{ color: '#A08B6A' }}>{usp.num}</span>
                    <div className="flex-1">
                      <p className="text-[16px] font-bold text-text-primary leading-snug whitespace-pre-line">{usp.title}</p>
                      <p className="text-[13px] text-text-muted mt-2 leading-[1.7] whitespace-pre-line">{usp.desc}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
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
