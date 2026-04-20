/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  theme: {
    extend: {
      fontFamily: {
        cinzel: ['Cinzel Decorative', 'serif'],
        lato: ['Lato', 'sans-serif'],
        playfair: ['Playfair Display', 'serif']
      },
      colors: {
        gold: { DEFAULT: '#C9963A', light: '#E8C36A', dark: '#8B6520' },
        heaven: { DEFAULT: '#1A3A5C', light: '#2A5A8C', dark: '#0D1F30' },
        cream: { DEFAULT: '#F8F3E8', warm: '#EDE4CF' },
        sacred: '#7B2D8B'
      },
      keyframes: {
        fadeSlideIn: {
          from: { opacity: 0, transform: 'translateY(32px)' },
          to: { opacity: 1, transform: 'translateY(0)' }
        },
        fadeSlideOut: {
          from: { opacity: 1, transform: 'translateY(0)' },
          to: { opacity: 0, transform: 'translateY(-32px)' }
        },
        shimmer: {
          '0%,100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' }
        },
        pulse2: { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.6 } },
        popIn: {
          '0%': { transform: 'scale(0.7)', opacity: 0 },
          '70%': { transform: 'scale(1.08)' },
          '100%': { transform: 'scale(1)', opacity: 1 }
        },
        haloSpin: { from: { transform: 'rotate(0deg)' }, to: { transform: 'rotate(360deg)' } }
      },
      animation: {
        fadeSlideIn: 'fadeSlideIn 0.55s cubic-bezier(.22,.68,0,1.2) forwards',
        fadeSlideOut: 'fadeSlideOut 0.35s ease-in forwards',
        shimmer: 'shimmer 4s ease infinite',
        pulse2: 'pulse2 2s ease-in-out infinite',
        popIn: 'popIn 0.45s cubic-bezier(.22,.68,0,1.2) forwards',
        haloSpin: 'haloSpin 12s linear infinite'
      }
    }
  },
  plugins: []
};

