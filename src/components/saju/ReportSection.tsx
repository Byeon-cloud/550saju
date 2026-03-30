import { useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ReportSectionProps {
  icon: string;
  title: string;
  content: string;
  defaultOpen?: boolean;
  visual?: ReactNode;
}

export function ReportSection({ icon, title, content, defaultOpen = false, visual }: ReportSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="card overflow-hidden">
      <button onClick={() => setIsOpen(!isOpen)} className="w-full flex items-center gap-3 py-0.5">
        <span className="w-8 h-8 rounded-full flex items-center justify-center text-[15px] shrink-0"
          style={{ background: 'var(--bg-surface)' }}>
          {icon}
        </span>
        <span className="flex-1 text-left text-[14px] font-bold" style={{ color: 'var(--text-primary)' }}>
          {title}
        </span>
        <motion.svg
          width="18" height="18" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
          style={{ color: 'var(--text-hint)' }}
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.3 }}
        >
          <polyline points="6 9 12 15 18 9" />
        </motion.svg>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="pt-3 mt-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
              {visual && <div className="mb-4">{visual}</div>}
              <div className="text-[13.5px] leading-[1.85] whitespace-pre-line"
                style={{ color: 'var(--text-secondary)' }}>
                {content}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
