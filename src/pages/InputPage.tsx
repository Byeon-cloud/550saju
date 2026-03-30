import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/common/Button';
import { FadeIn } from '@/components/common/FadeIn';
import type { CalendarType, Gender } from '@/types/saju';

export function InputPage() {
  const navigate = useNavigate();

  const [birthYear, setBirthYear] = useState('');
  const [birthMonth, setBirthMonth] = useState('');
  const [birthDay, setBirthDay] = useState('');
  const [calendarType, setCalendarType] = useState<CalendarType>('solar');
  const [gender, setGender] = useState<Gender>('male');
  const [hasBirthTime, setHasBirthTime] = useState(false);
  const [birthHour, setBirthHour] = useState('');
  const [birthMinute, setBirthMinute] = useState('');

  const handleSubmit = () => {
    if (!birthYear || !birthMonth || !birthDay) return;

    const params = new URLSearchParams({
      year: birthYear,
      month: birthMonth,
      day: birthDay,
      calendar: calendarType,
      gender,
      hasTime: String(hasBirthTime),
      ...(hasBirthTime && { hour: birthHour, minute: birthMinute }),
    });

    navigate(`/loading?${params.toString()}`);
  };

  return (
    <div className="page-container">
      <FadeIn>
        <h1 className="section-title mb-6">사주 정보 입력</h1>
      </FadeIn>

      <div className="flex flex-col gap-5">
        {/* 생년월일 */}
        <FadeIn delay={0.1}>
          <div className="card">
            <label className="text-sm font-medium text-brand-text mb-2 block">
              생년월일
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="년"
                value={birthYear}
                onChange={e => setBirthYear(e.target.value)}
                className="flex-1 px-3 py-3 rounded-xl border border-brand-border bg-brand-surface text-center text-brand-text focus:outline-none focus:border-brand-primary"
                min={1920}
                max={2026}
              />
              <input
                type="number"
                placeholder="월"
                value={birthMonth}
                onChange={e => setBirthMonth(e.target.value)}
                className="w-20 px-3 py-3 rounded-xl border border-brand-border bg-brand-surface text-center text-brand-text focus:outline-none focus:border-brand-primary"
                min={1}
                max={12}
              />
              <input
                type="number"
                placeholder="일"
                value={birthDay}
                onChange={e => setBirthDay(e.target.value)}
                className="w-20 px-3 py-3 rounded-xl border border-brand-border bg-brand-surface text-center text-brand-text focus:outline-none focus:border-brand-primary"
                min={1}
                max={31}
              />
            </div>
            {/* 역법 */}
            <div className="flex gap-2 mt-3">
              {(['solar', 'lunar', 'lunar_leap'] as const).map(type => (
                <button
                  key={type}
                  onClick={() => setCalendarType(type)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                    calendarType === type
                      ? 'bg-brand-primary text-white'
                      : 'bg-brand-background text-brand-muted'
                  }`}
                >
                  {{ solar: '양력', lunar: '음력', lunar_leap: '윤달' }[type]}
                </button>
              ))}
            </div>
          </div>
        </FadeIn>

        {/* 성별 */}
        <FadeIn delay={0.15}>
          <div className="card">
            <label className="text-sm font-medium text-brand-text mb-2 block">
              성별
            </label>
            <div className="flex gap-2">
              {(['male', 'female'] as const).map(g => (
                <button
                  key={g}
                  onClick={() => setGender(g)}
                  className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-colors ${
                    gender === g
                      ? 'bg-brand-primary text-white'
                      : 'bg-brand-background text-brand-muted'
                  }`}
                >
                  {g === 'male' ? '남성' : '여성'}
                </button>
              ))}
            </div>
          </div>
        </FadeIn>

        {/* 출생시간 */}
        <FadeIn delay={0.2}>
          <div className="card">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-brand-text">
                출생시간
              </label>
              <button
                onClick={() => setHasBirthTime(!hasBirthTime)}
                className={`w-12 h-7 rounded-full transition-colors relative ${
                  hasBirthTime ? 'bg-brand-primary' : 'bg-brand-border'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white absolute top-1 transition-transform ${
                    hasBirthTime ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            {hasBirthTime ? (
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="시"
                  value={birthHour}
                  onChange={e => setBirthHour(e.target.value)}
                  className="flex-1 px-3 py-3 rounded-xl border border-brand-border bg-brand-surface text-center text-brand-text focus:outline-none focus:border-brand-primary"
                  min={0}
                  max={23}
                />
                <input
                  type="number"
                  placeholder="분"
                  value={birthMinute}
                  onChange={e => setBirthMinute(e.target.value)}
                  className="flex-1 px-3 py-3 rounded-xl border border-brand-border bg-brand-surface text-center text-brand-text focus:outline-none focus:border-brand-primary"
                  min={0}
                  max={59}
                />
              </div>
            ) : (
              <p className="text-brand-muted text-xs">
                모르면 시주를 제외하고 분석합니다
              </p>
            )}
          </div>
        </FadeIn>

        {/* 제출 */}
        <FadeIn delay={0.3}>
          <Button
            fullWidth
            size="lg"
            onClick={handleSubmit}
            disabled={!birthYear || !birthMonth || !birthDay}
          >
            사주 분석하기 (1운)
          </Button>
        </FadeIn>
      </div>
    </div>
  );
}
