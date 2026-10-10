import React, { type ButtonHTMLAttributes } from 'react';
import { motion } from 'framer-motion';
import '@/styles/hanji.css';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'gold' | 'navy';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  loading?: boolean;
  /** 버튼 글자 옆 작은 보조 글자 (가격 등) — '궁합 보기  1운' */
  sub?: React.ReactNode;
}

/**
 * 사주500 버튼 — 2026-10-11 v9 한지 디자인과 같은 모양 (GoldCta, GhostButton 과 통일)
 * primary, gold: 금색 주 버튼 (먹색 글씨) / navy: 먹 배경 / secondary: 먹색 테두리 / ghost: 글자만
 */
export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  loading = false,
  className = '',
  children,
  disabled,
  sub,
  ...props
}: ButtonProps) {
  const base = 'font-bold transition-all duration-200 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2';

  const variants = {
    primary: 'hj-btn-gold',
    gold: 'hj-btn-gold',
    navy: 'hj-btn-ink',
    secondary: 'hj-btn-line',
    ghost: 'hj-btn-text',
  };

  const sizes = {
    sm: 'h-10 px-4 text-[14px] rounded-[10px]',
    md: 'h-[50px] px-6 text-[15.5px] rounded-[12px]',
    lg: 'h-[56px] px-8 text-[17px] rounded-[14px] font-extrabold',
  };

  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <motion.div
          className="w-5 h-5 rounded-full border-2"
          style={{ borderColor: 'currentColor', borderTopColor: 'transparent', opacity: 0.7 }}
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        />
      ) : sub != null ? (
        <>
          <span>{children}</span>
          <small style={{ fontSize: '0.84em', fontWeight: 700, opacity: 0.75 }}>{sub}</small>
        </>
      ) : children}
    </button>
  );
}
