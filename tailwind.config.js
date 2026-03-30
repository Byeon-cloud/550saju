/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#B8A080',
          'primary-hover': '#A6906E',
          'primary-active': '#8C7456',
          accent: '#C8956C',
          gold: '#B8A080',
          'gold-light': '#D4C4A8',
          'gold-dark': '#8C7456',
          background: '#FBF8F3',
          'bg-warm': '#F6F1EA',
          text: '#2C2418',
          'text-secondary': '#5C4F3D',
          surface: '#FFFFFF',
          'surface-alt': '#FDFCFA',
          'surface-warm': '#F8F5F0',
          border: '#E8E0D4',
          'border-light': '#F0EBE3',
          muted: '#9C8E7C',
          hint: '#BEB3A4',
          disabled: '#D4C4A8',
        },
        oheng: {
          mok:  { light: '#EDF7F0', mid: '#C8E6C9', DEFAULT: '#3A9D5C', dark: '#1B6E2E' },
          hwa:  { light: '#FFF0F0', mid: '#FFCDD2', DEFAULT: '#E05252', dark: '#B71C1C' },
          to:   { light: '#FFF8ED', mid: '#FFECB3', DEFAULT: '#D4952E', dark: '#B47520' },
          geum: { light: '#F5F5F5', mid: '#E0E0E0', DEFAULT: '#8B8B8B', dark: '#555555' },
          su:   { light: '#EDF4FC', mid: '#BBDEFB', DEFAULT: '#4A8AD4', dark: '#2A5FA0' },
        },
        status: {
          success: '#3A9D5C',
          warning: '#D4952E',
          danger: '#E05252',
          info: '#4A8AD4',
          special: '#7B4DAA',
        },
      },
      fontFamily: {
        sans: ['Pretendard Variable', 'Pretendard', '-apple-system', 'system-ui', 'sans-serif'],
        serif: ['Noto Serif KR', 'Georgia', 'serif'],
      },
      maxWidth: {
        mobile: '520px',
      },
      borderRadius: {
        'brand-sm': '8px',
        'brand-md': '12px',
        'brand-lg': '16px',
        'brand-xl': '20px',
        'brand-2xl': '24px',
      },
      boxShadow: {
        'brand-sm': '0 1px 4px rgba(44,36,24,0.04)',
        'brand-md': '0 2px 12px rgba(44,36,24,0.05), 0 0 0 1px rgba(232,224,212,0.6)',
        'brand-lg': '0 8px 32px rgba(44,36,24,0.08), 0 0 0 1px rgba(232,224,212,0.4)',
        'brand-glow': '0 4px 24px rgba(200,149,108,0.12)',
      },
      animation: {
        'spin-slow': 'spin 3s linear infinite',
        shimmer: 'shimmer 1.5s ease infinite',
        'fade-up': 'fadeUp 0.6s cubic-bezier(0.22,1,0.36,1) forwards',
        'pulse-ring': 'pulse-ring 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
