/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        bg: {
          main: 'var(--bg-main)',
          sidebar: 'var(--bg-sidebar)',
          chat: 'var(--bg-chat)',
          card: 'var(--bg-card)',
          hover: 'var(--bg-hover)', // Hover için ekstra katman
        },
        accent: {
          primary: '#B8D4A8',
          primaryHover: '#a3c593',
          secondary: '#9BC285',
          warm: '#FF8C61',
          warmHover: '#FF7A4D',
          coral: '#FFB394',
          coralHover: '#FFA078',
          purple: '#C9B6E4',
          purpleHover: '#B9A5D4',
          light: 'rgba(184, 212, 168, 0.12)',
          lighter: 'rgba(184, 212, 168, 0.06)', // Daha soft overlay
        },
        text: {
          main: 'var(--text-main)',
          muted: 'var(--text-muted)',
          subtle: 'var(--text-subtle)', // 3. seviye text
        },
        msg: {
          sent: 'var(--msg-sent)',
          received: 'var(--msg-received)',
          sentText: 'var(--msg-sent-text)',
          receivedText: 'var(--msg-received-text)',
        },
        border: {
          DEFAULT: 'var(--border)',
          subtle: 'var(--border-subtle)',
        }
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'slide-up': 'slideUp 0.4s ease-out forwards',
        'slide-down': 'slideDown 0.3s ease-out forwards',
        'fade-in': 'fadeIn 0.2s ease-out forwards',
        'ripple': 'ripple 0.6s linear',
        'bounce-soft': 'bounceSoft 1s ease-in-out infinite',
      },
      keyframes: {
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        ripple: {
          'to': { transform: 'scale(4)', opacity: '0' }
        },
        bounceSoft: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        }
      },
      boxShadow: {
        'soft': '0 2px 8px rgba(0, 0, 0, 0.08)',
        'soft-lg': '0 4px 16px rgba(0, 0, 0, 0.12)',
        'glow': '0 0 20px rgba(184, 212, 168, 0.3)',
      }
    },
  },
  plugins: [],
}