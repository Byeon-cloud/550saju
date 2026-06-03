/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // === Deep Navy + Gold Brand ===
        brand: {
          // 2026-06-02 QA — SSOT 정렬 (globals.css 와 동기화). 구 #C9A96E/#D4A843/#B8963F 머스타드 금지색 박멸.
          primary: '#B8965A',      // 골드 (CTA, 악센트) — SSOT --gold
          navy: '#1B2A4A',         // 딥 네이비 (주 배경/텍스트)
          'navy-light': '#2D4470', // 라이트 네이비
          'navy-deep': '#0F1D35',  // 딥퍼 네이비
          gold: '#B8965A',         // 메인 골드 — SSOT --gold
          'gold-light': '#E8D9B8', // 라이트 골드 — SSOT --brand-gold-light
          'gold-vivid': '#8C6D3D', // 딥 골드 (호버/프레스) — SSOT --gold-deep
          hover: '#8C6D3D',        // 골드 호버 — SSOT --gold-deep
          muted: '#A8B1C1',        // 뮤트
        },
        bg: {
          page: '#F4F5F8',
          card: '#FFFFFF',
          surface: '#F8F9FB',
        },
        text: {
          primary: '#1B2A4A',
          secondary: '#4A5568',
          muted: '#8892A4',
          hint: '#A8B1C1',
          disabled: '#CDD3DE',
        },
        border: {
          DEFAULT: '#E2E5EC',
          light: '#EEF0F4',
          focus: '#B8965A',
        },
        func: {
          success: '#2E7D32',
          warning: '#F57C00',
          danger: '#D32F2F',
          info: '#1565C0',
          special: '#7B1FA2',
        },
        oheng: {
          mok:  { light: '#E8F5E9', DEFAULT: '#2D8A4E', dark: '#1B5E20' },
          hwa:  { light: '#FFEBEE', DEFAULT: '#D32F2F', dark: '#B71C1C' },
          to:   { light: '#FFF8E1', DEFAULT: '#F57F17', dark: '#E65100' },
          geum: { light: '#F5F5F5', DEFAULT: '#757575', dark: '#424242' },
          su:   { light: '#E3F2FD', DEFAULT: '#1565C0', dark: '#0D47A1' },
        },
        gold: {
          bg: '#FDF8EE',
          card: '#B8965A',
        },
      },
      fontFamily: {
        sans: ['Pretendard Variable', 'Pretendard', '-apple-system', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'display': ['26px', { lineHeight: '1.3', fontWeight: '900' }],
        'h1':      ['20px', { lineHeight: '1.4', fontWeight: '800' }],
        'h2':      ['16px', { lineHeight: '1.4', fontWeight: '700' }],
        'h3':      ['14px', { lineHeight: '1.4', fontWeight: '700' }],
        'body':    ['14px', { lineHeight: '1.8', fontWeight: '400' }],
        'body-sm': ['13px', { lineHeight: '1.7', fontWeight: '400' }],
        'caption': ['12px', { lineHeight: '1.5', fontWeight: '400' }],
        'label':   ['12px', { lineHeight: '1.4', fontWeight: '600' }],
        'tiny':    ['11px', { lineHeight: '1.4', fontWeight: '500' }],
      },
      maxWidth: { mobile: '520px' },
      spacing: {
        'safe-top': '44px',
        'safe-bottom': '56px',
        'header': '48px',
        'tabbar': '56px',
        'cta': '52px',
        'input-h': '48px',
      },
      borderRadius: {
        'sm': '6px', 'md': '8px', 'lg': '12px', 'xl': '16px', '2xl': '20px',
      },
      boxShadow: {
        'sm': '0 1px 3px rgba(27,42,74,0.06)',
        'md': '0 4px 12px rgba(27,42,74,0.07)',
        'lg': '0 8px 24px rgba(27,42,74,0.09)',
        'xl': '0 16px 48px rgba(27,42,74,0.12)',
        'glow': '0 4px 20px rgba(201,169,110,0.2)',
      },
      animation: {
        'spin-slow': 'spin 3s linear infinite',
        'shimmer': 'shimmer 1.5s ease infinite',
        'fade-up': 'fadeUp 0.6s cubic-bezier(0.22,1,0.36,1) forwards',
        'pulse-ring': 'pulse-ring 2s ease-in-out infinite',
      },
      keyframes: {
        shimmer: {
          '0%': { opacity: '0.5' }, '50%': { opacity: '1' }, '100%': { opacity: '0.5' },
        },
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-ring': {
          '0%, 100%': { transform: 'scale(0.96)', opacity: '0.6' },
          '50%': { transform: 'scale(1)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
