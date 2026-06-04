// 디자인 토큰 — '토스풍 네이비 미니멀' (design/tokens.ts 와 동기화)
export const color = {
  navy: '#0F172A',
  primary: '#2563EB',
  primaryDark: '#1D4ED8',
  primarySoft: '#EFF4FF',
  bg: '#FFFFFF',
  surface: '#F8FAFC',
  border: '#E2E8F0',
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#94A3B8',
  success: '#16A34A',
  successSoft: '#ECFDF3',
  error: '#DC2626',
  errorSoft: '#FEF2F2',
  warning: '#F59E0B',
} as const

export const font = {
  family: 'Pretendard',
  display: { size: 28, lineHeight: 36, weight: '700' },
  h1: { size: 22, lineHeight: 30, weight: '700' },
  h2: { size: 18, lineHeight: 26, weight: '600' },
  body: { size: 16, lineHeight: 24, weight: '400' },
  bodyBold: { size: 16, lineHeight: 24, weight: '600' },
  caption: { size: 13, lineHeight: 18, weight: '400' },
} as const

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 } as const
export const radius = { sm: 8, md: 12, lg: 16, xl: 20, pill: 999 } as const
export const shadow = {
  card: {
    shadowColor: '#0F172A',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
} as const
