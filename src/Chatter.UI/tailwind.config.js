/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
      colors: {
        bg: {
          main: 'var(--bg-main)',
          sidebar: 'var(--bg-sidebar)',
          chat: 'var(--bg-chat)',
          card: 'var(--bg-card)',
          hover: 'var(--bg-hover)',
        },
        accent: {
          primary: '#7DC25F',       // was #B8D4A8 — more vibrant sage, passes WCAG AA with white
          primaryHover: '#6DB34F',
          secondary: '#62AB48',     // was #9BC285
          warm: '#FF8C61',
          warmHover: '#FF7A4D',
          coral: '#FFB394',
          coralHover: '#FFA078',
          purple: '#C9B6E4',
          purpleHover: '#B9A5D4',
          light: 'rgba(125, 194, 95, 0.12)',
          lighter: 'rgba(125, 194, 95, 0.06)',
        },
        text: {
          main: 'var(--text-main)',
          muted: 'var(--text-muted)',
          subtle: 'var(--text-subtle)',
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
        'slide-up': 'slideUp 0.25s cubic-bezier(0.34, 1.4, 0.64, 1) forwards',
        'slide-down': 'slideDown 0.3s ease-out forwards',
        'fade-in': 'fadeIn 0.2s ease-out forwards',
        'ripple': 'ripple 0.6s linear',
        'bounce-soft': 'bounceSoft 1s ease-in-out infinite',
        'message-in': 'messageIn 0.22s cubic-bezier(0.34, 1.3, 0.64, 1)',
        'float': 'float 6s ease-in-out infinite',
        'scale-in': 'scaleIn 0.2s cubic-bezier(0.34, 1.3, 0.64, 1)',
      },
      keyframes: {
        slideUp: {
          '0%': { transform: 'translateY(12px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-12px)', opacity: '0' },
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
        },
        messageIn: {
          '0%': { transform: 'translateY(6px) scale(0.97)', opacity: '0' },
          '100%': { transform: 'translateY(0) scale(1)', opacity: '1' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.9)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
      boxShadow: {
        'soft': '0 2px 8px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(255, 255, 255, 0.04)',
        'soft-lg': '0 6px 24px rgba(0, 0, 0, 0.22), 0 0 0 1px rgba(255, 255, 255, 0.05)',
        'glow': '0 0 20px rgba(125, 194, 95, 0.35)',
        'glow-sm': '0 0 12px rgba(125, 194, 95, 0.22)',
        'glow-lg': '0 0 40px rgba(125, 194, 95, 0.5)',
        'card': '0 1px 3px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(255, 255, 255, 0.05)',
        'card-hover': '0 4px 16px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.07)',
      }
    },
  },
  plugins: [],
}
