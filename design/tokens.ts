// 9급 공무원 앱 디자인 토큰 — '토스풍 네이비 미니멀'
// 단일 소스 오브 트루스: Expo(RN) 테마와 Figma 라이브러리가 이 값을 공유한다.

export const color = {
  // 브랜드
  navy: '#0F172A', // 딥 네이비 — 제목/다크 앵커
  primary: '#2563EB', // 메인 블루 — CTA/강조 (토스풍)
  primaryDark: '#1D4ED8', // 눌림 상태
  primarySoft: '#EFF4FF', // 블루 틴트 — 선택/하이라이트 배경

  // 중립 (slate)
  bg: '#FFFFFF',
  surface: '#F8FAFC', // 카드/섹션 배경
  border: '#E2E8F0',
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#94A3B8',

  // 시맨틱
  success: '#16A34A', // 정답
  successSoft: '#ECFDF3',
  error: '#DC2626', // 오답
  errorSoft: '#FEF2F2',
  warning: '#F59E0B',
} as const

export const font = {
  family: 'Pretendard', // 한글 가독성 + 토스 느낌 (Expo: expo-font 로 로드)
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
  // 미니멀 — 아주 옅은 그림자만
  card: {
    shadowColor: '#0F172A',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2, // Android
  },
} as const

export const theme = { color, font, space, radius, shadow } as const
export type Theme = typeof theme
