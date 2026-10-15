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
          navy: '#1A1612',         // 2026-10-10 v9 — 이름만 navy, 값은 먹(ink)
          'navy-light': '#3A3128', // 라이트 네이비
          'navy-deep': '#0F0C09',  // 딥퍼 네이비
          gold: '#B8965A',         // 메인 골드 — SSOT --gold
          'gold-light': '#E8D9B8', // 라이트 골드 — SSOT --brand-gold-light
          'gold-vivid': '#8C6D3D', // 딥 골드 (호버/프레스) — SSOT --gold-deep
          hover: '#8C6D3D',        // 골드 호버 — SSOT --gold-deep
          muted: '#6F6557',        // 뮤트 (2026-10-15 v9 보조 글자색)
        },
        bg: {
          page: '#F4EFE4',
          card: '#FFFDF8',
          surface: '#F8F4EC',
        },
        text: {
          primary: '#1A1612',
          secondary: '#4B4238',
          muted: '#6F6557',
          hint: '#6F6557',         // 2026-10-15 #8B8070 → #6F6557 (종이 위 대비 3.4:1 → 5:1 이상, v9 보조 글자색)
          disabled: '#CFC6B6',
        },
        border: {
          DEFAULT: '#E1D7C4',
          light: '#ECE4D4',
          focus: '#B8965A',
        },
        func: {
          success: '#4E7A57',
          warning: '#B07F38',
          danger: '#B04A38',
          info: '#3E5F82',
          special: '#7A5C7E',
        },
        oheng: {
          mok:  { light: '#E7EFE6', DEFAULT: '#4E7A57', dark: '#355A3E' },
          hwa:  { light: '#F6E5E0', DEFAULT: '#B04A38', dark: '#8A3326' },
          to:   { light: '#F5EBD9', DEFAULT: '#B07F38', dark: '#8A6226' },
          geum: { light: '#EEECE8', DEFAULT: '#7D7870', dark: '#57534D' },
          su:   { light: '#E4EAF1', DEFAULT: '#3E5F82', dark: '#2A4560' },
        },
        gold: {
          bg: '#FDF8EE',
          card: '#B8965A',
        },
        // === v4.1 통합 토큰 (2026-04-20 · design_system_v4_consolidated.md) ===
        // 주 컬러: gold-brown 계열 (기존 brand.primary #C9A96E와 다른 값)
        'gold-brown': {
          DEFAULT: '#A08B6A',
          dark: '#7A6648',
          soft: '#D4C4A8',
        },
        // 중립: ink(먹빛) / paper(한지 아이보리)
        ink: '#1A1A1A',
        paper: '#F8F5EE',
        // 시스템 색 (기존 func.* 과 병행, v4.1은 더 묵직한 톤)
        success: '#5E8C5A',
        warning: '#B08950',
        error: '#8B4A3A',
        info: '#5A7A8C',
      },
      fontFamily: {
        sans: ['Pretendard Variable', 'Pretendard', '-apple-system', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'display': ['27px', { lineHeight: '1.3', fontWeight: '900' }],
        'h1':      ['21px', { lineHeight: '1.4', fontWeight: '800' }],
        'h2':      ['17px', { lineHeight: '1.4', fontWeight: '700' }],
        'h3':      ['15px', { lineHeight: '1.4', fontWeight: '700' }],
        'body':    ['15px', { lineHeight: '1.8', fontWeight: '400' }],
        'body-sm': ['14px', { lineHeight: '1.7', fontWeight: '400' }],
        'caption': ['13px', { lineHeight: '1.5', fontWeight: '400' }],
        'label':   ['13px', { lineHeight: '1.4', fontWeight: '600' }],
        'tiny':    ['12px', { lineHeight: '1.4', fontWeight: '500' }],
        // === v4.1 추가 ===
        'hero':    ['40px', { lineHeight: '1.2',  fontWeight: '700', letterSpacing: '-0.01em' }],
        'pillar':  ['36px', { lineHeight: '1',    fontWeight: '600' }],
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
        'sm': '0 1px 3px rgba(40,28,14,0.06)',
        'md': '0 4px 12px rgba(40,28,14,0.07)',
        'lg': '0 8px 24px rgba(40,28,14,0.09)',
        'xl': '0 16px 48px rgba(40,28,14,0.12)',
        'glow': '0 4px 20px rgba(184,150,90,0.2)',
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
