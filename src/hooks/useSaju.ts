import { useState, useCallback } from 'react';
import type { SajuInput, SajuData } from '@/types/saju';
import { calculateSaju } from '@/services/saju/calculator';

export function useSaju() {
  const [sajuData, setSajuData] = useState<SajuData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const calculate = useCallback((input: SajuInput) => {
    try {
      setError(null);
      const data = calculateSaju(input);
      setSajuData(data);
      return data;
    } catch (e) {
      const msg = e instanceof Error ? e.message : '사주 계산 중 오류가 발생했습니다.';
      setError(msg);
      return null;
    }
  }, []);

  return { sajuData, error, calculate };
}
