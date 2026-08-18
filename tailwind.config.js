module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx}',
    './src/components/**/*.{js,ts,jsx,tsx}',
    './src/app/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      maxWidth: {
        content: '72rem'
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'none' }
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-7px)' }
        },
        'float-slow': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-4px)' }
        },
        steam: {
          '0%': { opacity: '0', transform: 'translateY(4px) scale(0.92)' },
          '35%': { opacity: '0.7' },
          '100%': { opacity: '0', transform: 'translateY(-16px) scale(1.08)' }
        },
        'pop-in': {
          '0%': { opacity: '0', transform: 'scale(0.5)' },
          '65%': { opacity: '1', transform: 'scale(1.12)' },
          '100%': { opacity: '1', transform: 'scale(1)' }
        },
        'slide-up-fade': {
          '0%': { opacity: '0', transform: 'translateY(14px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        'slide-in-right': {
          '0%': { opacity: '0', transform: 'translateX(-10px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' }
        },
        'crown-drop': {
          '0%': { opacity: '0', transform: 'translateY(-16px) rotate(-8deg)' },
          '60%': { opacity: '1', transform: 'translateY(2px) rotate(4deg)' },
          '100%': { opacity: '1', transform: 'translateY(0) rotate(0deg)' }
        },
        'coin-fly': {
          '0%': { opacity: '0', transform: 'translate(0, 0) scale(0.6)' },
          '15%': { opacity: '1', transform: 'translate(0, -6px) scale(1)' },
          '85%': { opacity: '1', transform: 'translate(64px, -10px) scale(1)' },
          '100%': { opacity: '0', transform: 'translate(76px, 0) scale(0.7)' }
        },
        'bar-grow': {
          '0%': { transform: 'scaleY(0)' },
          '100%': { transform: 'scaleY(1)' }
        },
        'blink-caret': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' }
        },
        'unlock-shackle': {
          '0%': { opacity: '0', transform: 'translateY(2px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        }
      },
      animation: {
        'fade-up': 'fade-up 0.35s ease-out both',
        float: 'float 5s ease-in-out infinite',
        'float-slow': 'float-slow 7s ease-in-out infinite',
        steam: 'steam 3.4s ease-out infinite',
        'pop-in': 'pop-in 0.5s cubic-bezier(0.34,1.56,0.64,1) both',
        'slide-up-fade': 'slide-up-fade 0.45s ease-out both',
        'slide-in-right': 'slide-in-right 0.4s ease-out both',
        'crown-drop': 'crown-drop 0.7s cubic-bezier(0.34,1.56,0.64,1) both',
        'coin-fly': 'coin-fly 1.6s ease-in-out infinite',
        'bar-grow': 'bar-grow 0.6s ease-out both',
        'blink-caret': 'blink-caret 1s step-end infinite',
        'unlock-shackle': 'unlock-shackle 0.4s ease-out both'
      },
      colors: {
        brand: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81'
        }
      }
    }
  },
  plugins: []
};
