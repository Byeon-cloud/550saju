import { type ButtonHTMLAttributes } from 'react';
import { motion } from 'framer-motion';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'gold';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  loading?: boolean;
}

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
  const base = 'font-bold transition-all duration-200 active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2';

  const variants = {
    primary: 'bg-brand-primary text-white hover:bg-brand-primary-hover shadow-brand-sm hover:shadow-brand-md',
    secondary: 'bg-white text-brand-text-secondary border border-brand-border hover:border-brand-primary hover:text-brand-primary',
    ghost: 'bg-transparent text-brand-muted hover:text-brand-text hover:bg-brand-surface-warm',
    gold: 'bg-gradient-to-r from-brand-gold to-brand-accent text-white shadow-brand-glow hover:shadow-brand-lg',
  };

  const sizes = {
    sm: 'h-9 px-4 text-[12px] rounded-full',
    md: 'h-12 px-6 text-[14px] rounded-brand-md',
    lg: 'h-[54px] px-8 text-[15px] rounded-brand-lg',
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
