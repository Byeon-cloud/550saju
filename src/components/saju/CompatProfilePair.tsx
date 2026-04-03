import { motion } from 'framer-motion';
import { CHEONGAN_OHENG, OHENG_MAP } from '@/constants/oheng';
import type { OhengType } from '@/types/saju';

interface Person {
  name: string;
  pillars: any[];
  elements?: Record<string, number>;
}

interface Props {
  person1: Person;
  person2: Person;
  overallScore: number;
  relation?: string;
}

/** 궁합 결과 — 두 사람 프로필 나란히 + 중앙 점수 */
export function CompatProfilePair({ person1, person2, overallScore, relation }: Props) {
  const getIlgan = (p: Person) => p.pillars?.[2]?.천간 || '';
  const getOheng = (p: Person) => {
    const ilgan = getIlgan(p);
    return ilgan ? CHEONGAN_OHENG[ilgan] as OhengType : undefined;
  };

  const renderPerson = (p: Person, side: 'left' | 'right') => {
    const ilgan = getIlgan(p);
    const oheng = getOheng(p);
    const info = oheng ? OHENG_MAP[oheng] : null;

    return (
      <motion.div
        className="flex-1 text-center"
        initial={{ opacity: 0, x: side === 'left' ? -20 : 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, delay: side === 'left' ? 0.1 : 0.2 }}
      >
        <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center mb-2"
          style={{ background: info ? `${info.color}15` : 'rgba(201,169,110,0.1)' }}>
          <span className="text-[32px] font-black" style={{ color: info?.color || '#C9A96E' }}>
            {ilgan || '?'}
          </span>
        </div>
        <p className="text-h3 text-white">{p.name}</p>
        {oheng && (
          <p className="text-caption text-white/50 mt-0.5">{oheng}({info?.hanja}) 일간</p>
        )}
      </motion.div>
    );
  };

  const gradeColor = overallScore >= 85 ? '#C9A96E' : overallScore >= 70 ? '#2D8A4E' : overallScore >= 55 ? '#2D4470' : '#D32F2F';
  const gradeLabel = overallScore >= 85 ? '천생연분' : overallScore >= 70 ? '좋은 궁합' : overallScore >= 55 ? '무난한 궁합' : '노력이 필요해요';

  return (
    <div className="card-navy py-8 px-5">
      {relation && (
        <p className="text-center text-caption text-white/40 mb-4">{relation} 궁합</p>
      )}

      <div className="flex items-start gap-4">
        {renderPerson(person1, 'left')}

        {/* 중앙 점수 */}
        <motion.div
          className="flex flex-col items-center pt-2"
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.4, type: 'spring', stiffness: 200 }}
        >
          <div className="w-20 h-20 rounded-full flex items-center justify-center relative"
            style={{ background: `${gradeColor}20`, border: `3px solid ${gradeColor}` }}>
            <span className="text-[28px] font-black text-white">{overallScore}</span>
          </div>
          <p className="text-caption font-bold mt-2" style={{ color: gradeColor }}>{gradeLabel}</p>
        </motion.div>

        {renderPerson(person2, 'right')}
      </div>
    </div>
  );
}
