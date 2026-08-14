import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx}', './src/components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: 'hsl(var(--card))',
        cardForeground: 'hsl(var(--card-foreground))',
        muted: 'hsl(var(--muted))',
        mutedForeground: 'hsl(var(--muted-foreground))',
        accent: 'hsl(var(--accent))',
        accentForeground: 'hsl(var(--accent-foreground))',
        primary: 'hsl(var(--primary))',
        primaryForeground: 'hsl(var(--primary-foreground))',
        ring: 'hsl(var(--ring))'
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(255,255,255,0.08), 0 24px 80px rgba(0,0,0,0.45)'
      },
      backgroundImage: {
        'aurora-radial': 'radial-gradient(circle at top, rgba(121, 171, 255, 0.35), transparent 45%), radial-gradient(circle at 80% 0%, rgba(255, 108, 138, 0.2), transparent 30%), linear-gradient(180deg, rgba(8, 15, 32, 1), rgba(4, 8, 18, 1))'
      }
    }
  },
  plugins: []
};

export default config;