import { useState, useEffect, createContext, useContext, useCallback, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ToastMessage {
  id: number;
  text: string;
  type: 'success' | 'info' | 'warning';
}

interface ToastContextType {
  show: (text: string, type?: 'success' | 'info' | 'warning') => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  let idCounter = 0;

  const show = useCallback((text: string, type: 'success' | 'info' | 'warning' = 'info') => {
    const id = ++idCounter;
    setToasts((prev) => [...prev, { id, text, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 2500);
  }, []);

  // 2026-10-19 — 화면 밖(App 부팅 코드)에서도 알림을 띄운다: window 에 'saju500:toast' {text, type}. 받으면 detail.handled = true
  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent).detail || {};
      if (!d.text) return;
      d.handled = true;
      show(String(d.text), d.type === 'warning' || d.type === 'info' ? d.type : 'success');
    };
    window.addEventListener('saju500:toast', on);
    return () => window.removeEventListener('saju500:toast', on);
  }, [show]);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {/* 토스트 렌더링 */}
      <div className="fixed top-[60px] inset-x-0 z-50 flex flex-col items-center gap-2 pointer-events-none px-5">
        <AnimatePresence>
          {toasts.map((toast) => {
            const colors = {
              success: { bg: '#4E7A57', text: '#fff' },
              info: { bg: '#1A1612', text: '#fff' },
              warning: { bg: '#B07F38', text: '#fff' },
            }[toast.type];
            return (
              <motion.div
                key={toast.id}
                initial={{ opacity: 0, y: -20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="px-5 py-3 rounded-2xl shadow-lg max-w-[320px]"
                style={{ background: colors.bg, color: colors.text }}
              >
                <p className="text-[13px] font-medium text-center">{toast.text}</p>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
