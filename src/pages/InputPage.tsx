import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/common/Button';
import { calculateSaju } from '@/services/saju/calculator';
import { useSajuContext } from '@/contexts/SajuContext';
import { CHEONGAN_OHENG, OHENG_MAP } from '@/constants/oheng';
import type { CalendarType, Gender, SajuInput, Pillar } from '@/types/saju';
import type { Relation } from '@/types/user';

const TOTAL_STEPS = 6;

const RELATIONS: { value: Relation; label: string }[] = [
  { value: '본인', label: '본인' },
  { value: '친구', label: '친구' },
  { value: '가족', label: '가족' },
  { value: '연인', label: '연인' },
  { value: '기타', label: '직접입력' },
];

const SHIJU_OPTIONS = [
  '자시 (23:00~01:00)', '축시 (01:00~03:00)', '인시 (03:00~05:00)',
  '묘시 (05:00~07:00)', '진시 (07:00~09:00)', '사시 (09:00~11:00)',
  '오시 (11:00~13:00)', '미시 (13:00~15:00)', '신시 (15:00~17:00)',
  '유시 (17:00~19:00)', '술시 (19:00~21:00)', '해시 (21:00~23:00)',
];
const SHIJU_HOURS = [0, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21];

export function InputPage() {
  const navigate = useNavigate();
  const { setInput, setSajuData } = useSajuContext();
  const [step, setStep] = useState(1);

  const [name, setName] = useState('');
  const [relation, setRelation] = useState<Relation>('본인');
  const [birthYear, setBirthYear] = useState('');
  const [birthMonth, setBirthMonth] = useState('');
  const [birthDay, setBirthDay] = useState('');
  const [calendarType, setCalendarType] = useState<CalendarType>('solar');
  const [gender, setGender] = useState<Gender | null>(null);
  const [knowsTime, setKnowsTime] = useState<boolean | null>(null);
  const [timeIndex, setTimeIndex] = useState<number | null>(null);
  const [loveStatus, setLoveStatus] = useState('');
  const [jobStatus, setJobStatus] = useState('');
  const [concern, setConcern] = useState('');

  const canNext = (() => {
    switch (step) {
      case 1: return name.trim().length > 0;
      case 2: return birthYear && birthMonth && birthDay;
      case 3: return gender !== null;
      case 4: return knowsTime !== null && (knowsTime === false || timeIndex !== null);
      case 5: return true;
      case 6: return true;
      default: return false;
    }
  })();

  const sajuInput: SajuInput | null = useMemo(() => {
    if (!birthYear || !birthMonth || !birthDay || !gender) return null;
    const input: SajuInput = {
      name,
      birthYear: Number(birthYear),
      birthMonth: Number(birthMonth),
      birthDay: Number(birthDay),
      calendarType,
      gender,
      hasBirthTime: knowsTime === true && timeIndex !== null,
    };
    if (input.hasBirthTime && timeIndex !== null) {
      input.birthHour = SHIJU_HOURS[timeIndex];
      input.birthMinute = 0;
    }
    return input;
  }, [name, birthYear, birthMonth, birthDay, calendarType, gender, knowsTime, timeIndex]);

  const sajuData = useMemo(() => {
    if (!sajuInput || step < 5) return null;
    try {
      return calculateSaju(sajuInput);
    } catch {
      return null;
    }
  }, [sajuInput, step]);

  function handleNext() {
    if (step < TOTAL_STEPS) {
      setStep(step + 1);
    } else {
      // Context에 데이터 저장 → Loading → Result로 전달
      if (sajuInput) {
        setInput(sajuInput);
        const data = calculateSaju(sajuInput);
        setSajuData(data);
      }
      navigate('/loading');
    }
  }

  function handleBack() {
    if (step > 1) setStep(step - 1);
    else navigate(-1);
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-cream)' }}>
      <Header title="사주 입력" showBack />

      <div className="flex items-center gap-1.5 px-5 pt-3">
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${
              i < step ? 'bg-brand-primary' : 'bg-brand-border'
            }`}
          />
        ))}
      </div>

      <div className="flex-1 px-5 pt-6 pb-4 overflow-y-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.25 }}
          >
            {step === 1 && <Step1 name={name} setName={setName} relation={relation} setRelation={setRelation} />}
            {step === 2 && <Step2 birthYear={birthYear} setBirthYear={setBirthYear} birthMonth={birthMonth} setBirthMonth={setBirthMonth} birthDay={birthDay} setBirthDay={setBirthDay} calendarType={calendarType} setCalendarType={setCalendarType} />}
            {step === 3 && <Step3 gender={gender} setGender={setGender} />}
            {step === 4 && <Step4 knowsTime={knowsTime} setKnowsTime={setKnowsTime} timeIndex={timeIndex} setTimeIndex={setTimeIndex} />}
            {step === 5 && sajuData && sajuInput && <Step5 sajuData={sajuData} name={name} input={sajuInput} />}
            {step === 6 && <Step6 loveStatus={loveStatus} setLoveStatus={setLoveStatus} jobStatus={jobStatus} setJobStatus={setJobStatus} concern={concern} setConcern={setConcern} />}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="px-5 pb-6 pt-2 bg-transparent">
        <div className="flex gap-3">
          {step > 1 && (
            <Button variant="ghost" size="lg" onClick={handleBack} className="w-20">이전</Button>
          )}
          <Button fullWidth size="lg" onClick={handleNext} disabled={!canNext}>
            {step === 5 ? '맞아요, 분석해주세요' : step === 6 ? '분석 시작' : '다음'}
          </Button>
        </div>
        {step === 6 && (
          <button onClick={handleNext} className="w-full text-center text-caption text-brand-muted mt-3">건너뛰기</button>
        )}
      </div>
    </div>
  );
}

function StepTitle({ stepNum, title }: { stepNum: number; title: string }) {
  return (
    <div className="mb-6">
      <p className="text-caption text-brand-primary font-bold mb-1">Step {stepNum}/{TOTAL_STEPS}</p>
      <h2 className="text-h1 text-brand-text">{title}</h2>
    </div>
  );
}

function Chip({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`h-10 px-4 rounded-full text-sm font-semibold transition-all ${
        selected ? 'bg-brand-primary text-white' : 'bg-brand-surface-alt text-brand-text-secondary border border-brand-border'
      }`}
    >
      {label}
    </button>
  );
}

function Step1({ name, setName, relation, setRelation }: { name: string; setName: (v: string) => void; relation: Relation; setRelation: (v: Relation) => void }) {
  return (
    <>
      <StepTitle stepNum={1} title="이름을 알려주세요" />
      <input
        type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="이름 입력" autoFocus
        className="w-full h-12 px-4 rounded-brand-md bg-brand-surface-alt border border-brand-border text-body text-brand-text placeholder:text-brand-hint focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary transition-colors"
      />
      <p className="text-caption text-brand-text-secondary mt-6 mb-3 font-semibold">누구의 사주를 볼까요?</p>
      <div className="flex flex-wrap gap-2">
        {RELATIONS.map((r) => <Chip key={r.value} label={r.label} selected={relation === r.value} onClick={() => setRelation(r.value)} />)}
      </div>
    </>
  );
}

function Step2({ birthYear, setBirthYear, birthMonth, setBirthMonth, birthDay, setBirthDay, calendarType, setCalendarType }: {
  birthYear: string; setBirthYear: (v: string) => void; birthMonth: string; setBirthMonth: (v: string) => void;
  birthDay: string; setBirthDay: (v: string) => void; calendarType: CalendarType; setCalendarType: (v: CalendarType) => void;
}) {
  return (
    <>
      <StepTitle stepNum={2} title="생년월일을 알려주세요" />
      <div className="flex gap-2 mb-4">
        {(['solar', 'lunar', 'lunar_leap'] as CalendarType[]).map((ct) => (
          <Chip key={ct} label={ct === 'solar' ? '양력' : ct === 'lunar' ? '음력' : '윤달'} selected={calendarType === ct} onClick={() => setCalendarType(ct)} />
        ))}
      </div>
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="text-label text-brand-text-secondary mb-1.5 block">년</label>
          <input type="number" value={birthYear} onChange={(e) => setBirthYear(e.target.value)} placeholder="1998"
            className="w-full h-12 px-4 rounded-brand-md bg-brand-surface-alt border border-brand-border text-body text-brand-text placeholder:text-brand-hint focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary" />
        </div>
        <div className="w-20">
          <label className="text-label text-brand-text-secondary mb-1.5 block">월</label>
          <input type="number" value={birthMonth} onChange={(e) => setBirthMonth(e.target.value)} placeholder="3" min={1} max={12}
            className="w-full h-12 px-4 rounded-brand-md bg-brand-surface-alt border border-brand-border text-body text-brand-text placeholder:text-brand-hint focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary" />
        </div>
        <div className="w-20">
          <label className="text-label text-brand-text-secondary mb-1.5 block">일</label>
          <input type="number" value={birthDay} onChange={(e) => setBirthDay(e.target.value)} placeholder="3" min={1} max={31}
            className="w-full h-12 px-4 rounded-brand-md bg-brand-surface-alt border border-brand-border text-body text-brand-text placeholder:text-brand-hint focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary" />
        </div>
      </div>
    </>
  );
}

function Step3({ gender, setGender }: { gender: Gender | null; setGender: (v: Gender) => void }) {
  return (
    <>
      <StepTitle stepNum={3} title="성별을 알려주세요" />
      <div className="flex gap-3">
        {([['male', '남성', '👨'], ['female', '여성', '👩']] as const).map(([val, label, emoji]) => (
          <button key={val} onClick={() => setGender(val as Gender)}
            className={`flex-1 card flex flex-col items-center gap-2 py-6 transition-all ${gender === val ? 'border-brand-primary border-2 shadow-brand-md' : ''}`}>
            <span className="text-3xl">{emoji}</span>
            <span className="text-h2 text-brand-text">{label}</span>
          </button>
        ))}
      </div>
    </>
  );
}

function Step4({ knowsTime, setKnowsTime, timeIndex, setTimeIndex }: {
  knowsTime: boolean | null; setKnowsTime: (v: boolean) => void; timeIndex: number | null; setTimeIndex: (v: number | null) => void;
}) {
  return (
    <>
      <StepTitle stepNum={4} title="출생시간을 알고 계신가요?" />
      <div className="flex gap-3 mb-6">
        <button onClick={() => setKnowsTime(true)}
          className={`flex-1 card flex flex-col items-center gap-2 py-5 transition-all ${knowsTime === true ? 'border-brand-primary border-2 shadow-brand-md' : ''}`}>
          <span className="text-2xl">🕐</span>
          <span className="text-h3 text-brand-text">알아요</span>
          <span className="text-tiny text-brand-muted">8글자 분석 (더 정밀)</span>
        </button>
        <button onClick={() => { setKnowsTime(false); setTimeIndex(null); }}
          className={`flex-1 card flex flex-col items-center gap-2 py-5 transition-all ${knowsTime === false ? 'border-brand-primary border-2 shadow-brand-md' : ''}`}>
          <span className="text-2xl">❓</span>
          <span className="text-h3 text-brand-text">몰라요</span>
          <span className="text-tiny text-brand-muted">6글자 분석 (기본)</span>
        </button>
      </div>
      {knowsTime && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} transition={{ duration: 0.3 }}>
          <p className="text-caption text-brand-text-secondary font-semibold mb-3">시간을 선택해주세요</p>
          <div className="grid grid-cols-3 gap-2">
            {SHIJU_OPTIONS.map((label, i) => (
              <button key={i} onClick={() => setTimeIndex(i)}
                className={`h-10 rounded-brand-md text-xs font-medium transition-all ${timeIndex === i ? 'bg-brand-primary text-white' : 'bg-brand-surface-alt text-brand-text-secondary border border-brand-border'}`}>
                {label.split(' ')[0]}
              </button>
            ))}
          </div>
          {timeIndex !== null && <p className="text-caption text-brand-muted mt-2 text-center">{SHIJU_OPTIONS[timeIndex]}</p>}
        </motion.div>
      )}
    </>
  );
}

function MiniPillarCard({ pillar }: { pillar: Pillar }) {
  const oheng = CHEONGAN_OHENG[pillar.천간];
  const info = oheng ? OHENG_MAP[oheng] : null;

  if (!pillar.available) {
    return (
      <div className="flex-1 rounded-brand-xl border-2 border-dashed border-brand-secondary bg-brand-surface-alt flex flex-col items-center justify-center py-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-brand-surface-alt/60 flex flex-col items-center justify-center">
          <span className="text-lg">🕐</span>
          <span className="text-tiny text-brand-muted mt-1">미입력</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 card-emphasis flex flex-col items-center py-3 gap-1">
      <span className="text-2xl font-black" style={{ color: info?.colorDark }}>{pillar.천간}</span>
      <span className="text-tiny font-bold" style={{ color: info?.color }}>{pillar.천간읽기} · {oheng}</span>
      <div className="w-full h-px bg-gradient-to-r from-transparent via-brand-secondary to-transparent my-1" />
      <span className="text-2xl font-black" style={{ color: OHENG_MAP[pillar.지지오행]?.colorDark }}>{pillar.지지}</span>
      <span className="text-tiny font-bold" style={{ color: OHENG_MAP[pillar.지지오행]?.color }}>{pillar.지지읽기} · {pillar.지지오행}</span>
    </div>
  );
}

function Step5({ sajuData, name, input }: { sajuData: import('@/types/saju').SajuData; name: string; input: SajuInput }) {
  const yearStr = `${input.birthYear}.${String(input.birthMonth).padStart(2, '0')}.${String(input.birthDay).padStart(2, '0')}`;
  return (
    <>
      <StepTitle stepNum={5} title="만세력이 맞는지 확인해주세요" />
      <div className="flex gap-2 mb-4">
        {sajuData.pillars.map((p, i) => <MiniPillarCard key={i} pillar={p} />)}
      </div>
      <div className="card text-center">
        <p className="text-h2 text-brand-text">{name}님</p>
        <p className="text-body-sm text-brand-text-secondary mt-1">{yearStr}</p>
        {sajuData.띠 && <p className="text-caption text-brand-muted mt-1">{sajuData.띠}</p>}
      </div>
    </>
  );
}

function Step6({ loveStatus, setLoveStatus, jobStatus, setJobStatus, concern, setConcern }: {
  loveStatus: string; setLoveStatus: (v: string) => void; jobStatus: string; setJobStatus: (v: string) => void;
  concern: string; setConcern: (v: string) => void;
}) {
  const loveOptions = ['솔로', '연애중', '결혼', '이혼/별거'];
  const jobOptions = ['학생', '취준생', '직장인', '자영업', '프리랜서', '무직'];
  return (
    <>
      <StepTitle stepNum={6} title="조금 더 알려주시면 더 정확해져요" />
      <p className="text-caption text-brand-muted mb-4">선택사항이에요. 건너뛰어도 괜찮아요.</p>
      <p className="text-caption text-brand-text-secondary font-semibold mb-2">연애 상태</p>
      <div className="flex flex-wrap gap-2 mb-5">
        {loveOptions.map((opt) => <Chip key={opt} label={opt} selected={loveStatus === opt} onClick={() => setLoveStatus(loveStatus === opt ? '' : opt)} />)}
      </div>
      <p className="text-caption text-brand-text-secondary font-semibold mb-2">직업 상태</p>
      <div className="flex flex-wrap gap-2 mb-5">
        {jobOptions.map((opt) => <Chip key={opt} label={opt} selected={jobStatus === opt} onClick={() => setJobStatus(jobStatus === opt ? '' : opt)} />)}
      </div>
      <p className="text-caption text-brand-text-secondary font-semibold mb-2">요즘 고민 (자유입력)</p>
      <textarea value={concern} onChange={(e) => setConcern(e.target.value)}
        placeholder="예: 이직을 고민 중이에요, 연애가 잘 안 풀려요..."
        maxLength={100}
        className="w-full h-24 p-4 rounded-brand-md bg-brand-surface-alt border border-brand-border text-body text-brand-text placeholder:text-brand-hint focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary resize-none" />
      <p className="text-right text-tiny text-brand-muted mt-1">{concern.length}/100</p>
    </>
  );
}
