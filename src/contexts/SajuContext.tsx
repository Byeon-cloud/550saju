import { createContext, useContext, useState, type ReactNode } from 'react';
import type { SajuData, SajuInput, Situation } from '@/types/saju';

interface SajuState {
  input: SajuInput | null;
  sajuData: SajuData | null;
  situation: Situation | null;
  setInput: (input: SajuInput) => void;
  setSajuData: (data: SajuData) => void;
  setSituation: (sit: Situation) => void;
  clear: () => void;
}

const SajuContext = createContext<SajuState | null>(null);

export function SajuProvider({ children }: { children: ReactNode }) {
  const [input, setInput] = useState<SajuInput | null>(null);
  const [sajuData, setSajuData] = useState<SajuData | null>(null);
  const [situation, setSituation] = useState<Situation | null>(null);

  function clear() {
    setInput(null);
    setSajuData(null);
    setSituation(null);
  }

  return (
    <SajuContext.Provider value={{ input, sajuData, situation, setInput, setSajuData, setSituation, clear }}>
      {children}
    </SajuContext.Provider>
  );
}

export function useSajuContext() {
  const ctx = useContext(SajuContext);
  if (!ctx) throw new Error('useSajuContext must be used within SajuProvider');
  return ctx;
}
