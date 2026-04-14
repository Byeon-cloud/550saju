import { type ButtonHTMLAttributes } from 'react';
import { motion } from 'framer-motion';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'gold' | 'navy';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  loading?: boolean;
}

/**
 * 사주500 버튼 — Deep Navy + Gold
 * Primary: 골드 배경 (CTA)
 * Navy: 네이비 배경 (보조 CTA)
 * Secondary: 투명 + 골드 테두리
 * Ghost: 텍스트만
 */
export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  loading = false,
  className = '',
  children,
  disabled,
  ...props
}: ButtonProps) {
  const base = 'font-bold transition-all duration-200 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2';

  const variants = {
    primary: 'bg-brand-gold text-white hover:bg-brand-hover shadow-glow',
    navy: 'bg-brand-navy text-white hover:bg-brand-navy-light shadow-md',
    secondary: 'bg-transparent text-brand-gold border-[1.5px] border-brand-gold hover:bg-gold-bg/50',
    ghost: 'bg-transparent text-brand-navy hover:bg-bg-surface',
    gold: 'bg-gradient-to-r from-brand-gold to-brand-gold-vivid text-white shadow-glow',
  };

  const sizes = {
    sm: 'h-9 px-4 text-[12px] rounded-full',
    md: 'h-[48px] px-6 text-[14px] rounded-xl',
    lg: 'h-[52px] px-8 text-[16px] rounded-xl',
  };

  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <motion.div
          className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        />
      ) : children}
    </button>
  );
}
