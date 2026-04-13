import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FadeIn } from '@/components/common/FadeIn';
import { EmptyState } from '@/components/common/EmptyState';
import { useSajuContext } from '@/contexts/SajuContext';
import { useAuth } from '@/hooks/useAuth';
import { getReports, deleteReport, type LocalReport } from '@/services/storage/localStore';
import { getChatRooms, type ChatRoom } from '@/services/storage/chatStore';
import { CHEONGAN_OHENG } from '@/constants/oheng';
import { usePageTitle } from '@/hooks/usePageTitle';

const CONTENT_TABS = ['전체', '상세 분석', '심층분석', '오늘운세', '꿈해몽', '궁합', '대운·월운', '상담'] as const;

export function StoragePage() {
  usePageTitle('보관함');
  const navigate = useNavigate();
  const { setInput, setSajuData } = useSajuContext();
  useAuth();
  const [contentTab, setContentTab] = useState<string>('전체');
  const [reports, setReports] = useState<LocalReport[]>([]);
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  useEffect(() => {
    setReports(getReports());
    setChatRooms(getChatRooms());
  }, []);

  function openReport(report: LocalReport) {
    // 꿈해몽/일일운세는 사주 결과페이지가 아니므로 해당 페이지로 이동
    if (report.contentType === 'dream') { navigate('/dream'); return; }
    if (report.contentType === 'daily') { navigate('/daily'); return; }
    if (!report.sajuData?.pillars?.length) {
      // sajuData 없으면 결과페이지 진입 불가
      navigate('/input');
      return;
    }
    setInput(report.input);
    setSajuData(report.sajuData);
    navigate(`/result/${report.id}`);
  }

  function handleDelete(id: string) {
    deleteReport(id);
    setReports(getReports());
    setDeleteTarget(null);
  }

  // 프로필 목록 (중복 제거, 궁합/꿈해몽 등 비개인 데이터 제외)
  const profiles = useMemo(() => {
    const seen = new Map<string, LocalReport>();
    for (const r of reports) {
      // 궁합 결과, 사주 데이터 없는 항목, "×" 포함 이름(궁합) 제외
      if (r.contentType === 'compat' || r.input?.relation === 'compat') continue;
      if (r.name?.includes('×') || r.name?.includes('x')) continue;
      if (!r.input?.birthYear) continue;
      const key = `${r.name}_${r.input.birthYear}_${r.input.birthMonth}_${r.input.birthDay}`;
      if (!seen.has(key)) seen.set(key, r);
    }
    return Array.from(seen.values());
  }, [reports]);

  // 콘텐츠 필터
  const contentReports = useMemo(() => {
    if (contentTab === '전체') return reports;
    if (contentTab === '상세 분석') return reports.filter(r => !r.contentType || r.contentType === 'report');
    if (contentTab === '오늘운세') return reports.filter(r => r.contentType === 'daily');
    if (contentTab === '꿈해몽') return reports.filter(r => r.contentType === 'dream');
    if (contentTab === '궁합') return reports.filter(r => r.contentType === 'compat');
    if (contentTab === '심층분석') return reports.filter(r => r.contentType === 'topic');
    if (contentTab === '대운·월운') return reports.filter(r => r.contentType === 'daeun' || r.contentType === 'monthly' || r.contentType === 'tojung');
    if (contentTab === '상담') return []; // 채팅은 별도 chatRooms
    return reports;
  }, [reports, contentTab]);

  function getIlgan(r: LocalReport) {
    const ilgan = r.sajuData?.pillars?.[2]?.천간 || '';
    const oheng = ilgan ? CHEONGAN_OHENG[ilgan] : '';
    return { ilgan, oheng };
  }

  return (
    <div className="min-h-screen pb-tab-safe" style={{ background: 'var(--bg-page-gradient)' }}>
      <div className="px-5 pt-4 space-y-4">

        <FadeIn>
          <h1 className="text-display text-text-primary">보관함</h1>
        </FadeIn>

        {/* ====== 상단: 사주팔자 프로필 ====== */}
        <FadeIn delay={0.03}>
          <div>
            <p className="text-label text-text-hint font-bold mb-2">사주팔자 정보</p>
            {profiles.length > 0 ? (
              <div className="space-y-2">
                {profiles.map((r) => {
                  const { ilgan, oheng } = getIlgan(r);
                  const relation = r.input.relation || '본인';
                  const isMe = relation === '본인' || relation === 'self';
                  return (
                    <button
                      key={r.id}
                      onClick={() => openReport(r)}
                      className={`card w-full text-left py-3.5 px-4 ${isMe ? 'border-l-4 border-l-brand-gold' : ''}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{ background: isMe ? 'rgba(27,42,74,0.08)' : 'rgba(201,169,110,0.08)' }}>
                          <span className="text-h3 font-bold" style={{ color: isMe ? '#1B2A4A' : '#C9A96E' }}>
                            {r.name.charAt(0)}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-h3 text-text-primary">{r.name}</p>
                            {isMe && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-brand-navy text-white">나</span>
                            )}
                            {!isMe && (
                              <span className="text-[10px] text-text-hint">{relation}</span>
                            )}
                          </div>
                          <p className="text-caption text-text-muted">
                            {r.input.birthYear}.{String(r.input.birthMonth).padStart(2,'0')}.{String(r.input.birthDay).padStart(2,'0')}
                            {ilgan ? ` · ${ilgan}(${oheng})` : ''}
                          </p>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeleteTarget(r.id); }}
                          className="w-8 h-8 flex items-center justify-center text-text-disabled hover:text-func-danger transition-colors rounded-lg flex-shrink-0"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      </div>
                    </button>
                  );
                })}
                {/* 새 사주 추가 */}
                <button onClick={() => navigate('/input')} className="w-full py-3 text-center text-caption text-brand-gold font-semibold">
                  + 새 사주 입력하기
                </button>
              </div>
            ) : (
              <button onClick={() => navigate('/input')} className="card w-full text-center py-6">
                <p className="text-body-sm text-text-muted">아직 분석한 사주가 없어요</p>
                <p className="text-caption text-brand-gold font-semibold mt-2">첫 사주 입력하기</p>
              </button>
            )}
          </div>
        </FadeIn>

        {/* 구분선 */}
        <div className="h-px bg-border-light" />

        {/* ====== 하단: 콘텐츠 기록 ====== */}
        <FadeIn delay={0.06}>
          <p className="text-label text-text-hint font-bold mb-2">이용 기록</p>
          <div className="flex gap-1.5 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
            {CONTENT_TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setContentTab(tab)}
                className={`flex-shrink-0 px-3.5 py-2 rounded-full text-caption font-semibold transition-all ${
                  contentTab === tab
                    ? 'bg-brand-navy text-white'
                    : 'bg-bg-surface text-text-muted border border-border-light'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </FadeIn>

        {/* 상담 탭 */}
        {contentTab === '상담' ? (
          <FadeIn delay={0.08}>
            {chatRooms.length > 0 ? (
              <div className="space-y-2">
                {chatRooms.map((room) => (
                  <button key={room.id} onClick={() => navigate(`/chat/${room.id}`)} className="card w-full text-left py-3.5 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: 'rgba(201,169,110,0.1)' }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C9A96E" strokeWidth="1.5">
                          <path d="M21 12a9 9 0 01-9 9c-1.5 0-2.9-.4-4.1-1L3 21l1.1-4.1A9 9 0 1121 12z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-h3 text-text-primary">{room.name}</p>
                        <p className="text-caption text-text-muted truncate">{room.lastMessage || '대화를 시작해보세요'}</p>
                      </div>
                      <span className="text-[10px] text-text-hint flex-shrink-0">
                        {new Date(room.updatedAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#A8B1C1" strokeWidth="1.5"><path d="M21 12a9 9 0 01-9 9c-1.5 0-2.9-.4-4.1-1L3 21l1.1-4.1A9 9 0 1121 12z" /></svg>}
                title="아직 상담 기록이 없어요"
                description="사주대화에서 상담을 시작하면 여기에 저장돼요."
                actionLabel="사주 대화 시작하기"
                onAction={() => navigate('/chat')}
              />
            )}
          </FadeIn>
        ) : (
        /* 콘텐츠 리포트 */
        contentReports.length > 0 ? (
          <FadeIn delay={0.08}>
            <div className="space-y-2">
              {contentReports.map((r) => {
                const { ilgan, oheng } = getIlgan(r);
                return (
                  <motion.button
                    key={r.id}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => openReport(r)}
                    className="card w-full text-left py-3.5 px-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: 'var(--bg-gold-solid)' }}>
                        <span className="text-h3 text-brand-navy font-bold">{r.name.charAt(0)}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-h3 text-text-primary">{r.name || '기록'}</p>
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-brand-gold/10 text-brand-gold">
                            {r.contentType === 'daily' ? '오늘운세' : r.contentType === 'dream' ? '꿈해몽' : r.contentType === 'compat' ? '궁합' : r.contentType === 'daeun' ? '대운' : r.contentType === 'monthly' ? '월별' : r.contentType === 'tojung' ? '토정비결' : r.contentType === 'topic' ? ((r as any).aiResult?.topicId === 'love' ? '연애운' : (r as any).aiResult?.topicId === 'wealth' ? '재물운' : (r as any).aiResult?.topicId === 'career' ? '취업운' : '심층분석') : '상세 분석'}
                          </span>
                        </div>
                        <p className="text-caption text-text-muted truncate">
                          {r.input?.birthYear ? `${r.input.birthYear}.${String(r.input.birthMonth).padStart(2,'0')}.${String(r.input.birthDay).padStart(2,'0')}` : new Date(r.createdAt).toLocaleDateString('ko-KR')}
                          {ilgan ? ` · ${ilgan}(${oheng})` : ''}
                        </p>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteTarget(r.id); }}
                        className="w-8 h-8 flex items-center justify-center text-text-disabled hover:text-func-danger transition-colors rounded-lg flex-shrink-0"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </FadeIn>
        ) : (
          <FadeIn delay={0.08}>
            {contentTab === '심층분석' ? (
              <div className="space-y-4">
                <EmptyState
                  icon={<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#A8B1C1" strokeWidth="1.5"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 9h18" /><path d="M10 13h4" strokeLinecap="round" /></svg>}
                  title="아직 심층분석 기록이 없어요"
                  description="궁금한 운세를 골라서 깊이 있게 분석받아보세요."
                />
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'love', icon: '愛', label: '연애운', color: '#E91E63' },
                    { id: 'wealth', icon: '財', label: '재물운', color: '#C9A96E' },
                    { id: 'career', icon: '事', label: '취업운', color: '#1565C0' },
                    { id: 'health', icon: '健', label: '건강운', color: '#2E7D32' },
                  ].map((t) => (
                    <button key={t.id} onClick={() => navigate(`/topic/${t.id}`)}
                      className="card py-3.5 px-3 flex items-center gap-2">
                      <span className="text-[15px] font-black" style={{ color: t.color }}>{t.icon}</span>
                      <span className="text-caption font-semibold text-text-primary">{t.label}</span>
                      <span className="ml-auto text-[9px] text-brand-gold font-bold">1운</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <EmptyState
                icon={<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#A8B1C1" strokeWidth="1.5"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 9h18" /><path d="M10 13h4" strokeLinecap="round" /></svg>}
                title={contentTab === '전체' ? '아직 이용 기록이 없어요' : `${contentTab} 기록이 없어요`}
                description="서비스를 이용하면 여기에 기록이 남아요."
                actionLabel="사주 분석하기"
                onAction={() => navigate('/input')}
              />
            )}
          </FadeIn>
        ))}
      </div>

      {/* 삭제 확인 모달 */}
      <AnimatePresence>
        {deleteTarget && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center px-8"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/40" onClick={() => setDeleteTarget(null)} />
            <motion.div
              className="relative rounded-2xl px-6 py-5 max-w-[300px] w-full text-center"
              style={{ background: 'var(--bg-card)', boxShadow: '0 16px 48px rgba(0,0,0,0.2)' }}
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
            >
              <p className="text-h3 text-text-primary mb-2">기록을 삭제할까요?</p>
              <p className="text-caption text-text-muted mb-4">삭제하면 되돌릴 수 없어요.</p>
              <div className="flex gap-2">
                <button onClick={() => setDeleteTarget(null)} className="flex-1 py-3 rounded-xl text-caption font-semibold text-text-muted bg-bg-surface">취소</button>
                <button onClick={() => handleDelete(deleteTarget)} className="flex-1 py-3 rounded-xl text-caption font-semibold text-white bg-func-danger">삭제</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
