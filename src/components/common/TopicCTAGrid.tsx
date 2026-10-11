import { motion } from 'framer-motion';
import { Pictogram, type TopicKey } from '@/components/brand/PictogramRegistry';

export interface TopicItem {
  id: TopicKey;
  /** 제목 (예: '연애·결혼') */
  title: string;
  /** 서브텍스트 (예: '이 꿈이 애정운에 주는 신호') */
  desc: string;
  /** 가격 텍스트 (예: '1운 (500원)') */
  price?: string;
  /** 테마 컬러 (카드 좌변 바) */
  color?: string;
}

interface TopicCTAGridProps {
  topics: TopicItem[];
  onTopicTap: (topicId: TopicKey) => void;
  /** 상단 메타 텍스트 */
  meta?: string;
  /** 상단 섹션 제목 */
  title?: string;
}

/**
 * IX-5 주제 CTA 4카드 (꿈해몽·오늘운세 공통).
 * 2x2 그리드. 탭 시 결제 플로우 또는 라우팅.
 */
export function TopicCTAGrid({ topics, onTopicTap, meta, title }: TopicCTAGridProps) {
  return (
    <div className="card-secondary">
      {meta && <p className="sec-meta" style={{ marginBottom: 4, color: 'var(--brand-gold)' }}>{meta}</p>}
      {title && <p className="sec-title-lg" style={{ marginBottom: 12 }}>{title}</p>}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 10,
        }}
      >
        {topics.map((t) => (
          <motion.button
            key={t.id}
            whileTap={{ scale: 0.97 }}
            onClick={() => onTopicTap(t.id)}
            className="card-primary"
            style={{
              padding: 16,
              border: '1px solid #E1D7C4',
              borderRadius: 6,
              boxShadow: 'none',
              textAlign: 'left',
              cursor: 'pointer',
              background: '#FFFDF8',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              minHeight: 118,
            }}
            aria-label={`${t.title} 심층 분석, ${t.price ?? '1운'}`}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 3,
                border: '1px solid rgba(26,22,18,.22)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Pictogram k={`topic:${t.id}`} size={18} color={t.color || '#B8965A'} />
            </div>
            <p style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>{t.title}</p>
            <p style={{ fontSize: 13.5, color: 'var(--text-muted)', lineHeight: 1.4 }}>{t.desc}</p>
            {t.price && (
              <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--brand-gold)', marginTop: 'auto' }}>
                {t.price}
              </p>
            )}
          </motion.button>
        ))}
      </div>
    </div>
  );
}
