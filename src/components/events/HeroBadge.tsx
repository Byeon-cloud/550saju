// HeroBadge — 블록 1. "콘텐츠 하나만 봐도 오늘 출석 +1"
// 스펙: 09_이벤트_v4.md §2 · 핸드오버 §1-C-7 block 1

export function HeroBadge() {
  return (
    <section
      className="mx-4 mt-3 rounded-2xl px-[18px] py-[18px] flex items-center gap-3.5"
      style={{
        background: 'linear-gradient(135deg, #F8F5EE 0%, #F5EADB 100%)',
        border: '1px solid #F5EADB',
      }}
    >
      {/* 아이콘 (책 + 체크) */}
      <div
        className="flex-shrink-0 w-[52px] h-[52px] rounded-[14px] flex items-center justify-center"
        style={{ background: '#FFFFFF', border: '1px solid #B8965A', color: '#B8965A' }}
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M4 4h12a2 2 0 0 1 2 2v14H6a2 2 0 0 1-2-2z" />
          <path d="M4 4v14a2 2 0 0 0 2 2h12" />
          <path d="M9 11l2 2 4-4" />
        </svg>
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-bold leading-[1.4]"
          style={{ color: '#1D2D4A', fontFamily: "'Noto Serif KR', serif" }}>
          콘텐츠 하나만 봐도 오늘 출석 +1
        </p>
        <p className="mt-1 text-[12px] leading-[1.45]" style={{ color: '#8A7F6E' }}>
          오늘의 운세·꿈해몽·1운 해석 등 결과 1개만 보면 충분해요
        </p>
      </div>
    </section>
  );
}

export default HeroBadge;
