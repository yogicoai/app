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
  textMuted: '#64748B', // 대비 강화(기존 #94A3B8 는 흰 배경에서 WCAG AA 미달)
  textFaint: '#94A3B8', // 정말 흐리게(테두리급 보조)만
  success: '#16A34A',
  successSoft: '#ECFDF3',
  error: '#DC2626',
  errorSoft: '#FEF2F2',
  warning: '#F59E0B',
} as const

export const font = {
  family: 'Pretendard',
  display: { size: 28, lineHeight: 38, weight: '700' },
  h1: { size: 22, lineHeight: 32, weight: '700' },
  h2: { size: 18, lineHeight: 28, weight: '600' }, // 발문 등 긴 제목 가독성
  body: { size: 16, lineHeight: 26, weight: '400' }, // 한글 본문 1.6 줄간격
  bodyBold: { size: 16, lineHeight: 26, weight: '600' },
  caption: { size: 13, lineHeight: 19, weight: '400' },
} as const

// 지문·해설처럼 긴 글 읽기용 줄간격
export const readingLineHeight = 28

// 안드로이드는 단일 TTF에서 굵기를 합성하지 못하므로 weight 별로 별도 Pretendard 파일을 지정한다.
export const fontFamilyByWeight: Record<string, string> = {
  '400': 'Pretendard-Regular',
  '500': 'Pretendard-Medium',
  '600': 'Pretendard-SemiBold',
  '700': 'Pretendard-Bold',
}

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
