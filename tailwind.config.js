/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#A08B6A',
          'primary-hover': '#8B7656',
          background: '#F5F0E8',
          text: '#3D3427',
          surface: '#FFFFFF',
          border: '#E8E0D4',
          muted: '#8B7E6F',
        },
        oheng: {
          mok: { light: '#E8F5E9', DEFAULT: '#2D8A4E', dark: '#1B5E20' },
          hwa: { light: '#FFEBEE', DEFAULT: '#D32F2F', dark: '#B71C1C' },
          to: { light: '#FFF8E1', DEFAULT: '#F57F17', dark: '#E65100' },
          geum: { light: '#F5F5F5', DEFAULT: '#757575', dark: '#424242' },
          su: { light: '#E3F2FD', DEFAULT: '#1565C0', dark: '#0D47A1' },
        },
        status: {
          success: '#2E7D32',
          warning: '#E65100',
          danger: '#C62828',
          info: '#6A1B9A',
        },
      },
      fontFamily: {
        sans: ['Pretendard', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
        serif: ['Noto Serif KR', 'serif'],
      },
      maxWidth: {
        mobile: '520px',
      },
    },
  },
  plugins: [],
};
