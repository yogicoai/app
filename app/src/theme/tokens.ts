// 디자인 토큰 — Toss 스타일(클린 그레이 스케일 + 토스 블루, 굵기 위계 강조)
export const color = {
  navy: '#191F28', // 가장 진한 텍스트/강조
  primary: '#3182F6', // Toss Blue
  primaryDark: '#2272EB',
  primarySoft: '#E8F3FF',
  bg: '#FFFFFF',
  surface: '#F2F4F6', // 카드 구분·칩 배경 (gray100)
  border: '#E5E8EB', // 아주 옅은 경계 (gray200)
  textPrimary: '#191F28', // gray900
  textSecondary: '#4E5968', // gray700
  textMuted: '#8B95A1', // gray500
  textFaint: '#B0B8C1', // gray400(테두리급 보조)
  success: '#15B26A',
  successSoft: '#E7F7EF',
  error: '#F04452', // Toss Red
  errorSoft: '#FDECEE',
  warning: '#FF9F1A',
  warningSoft: '#FFF4E6',
} as const

// 타이포 위계 — 제목은 굵게(700)+자간 좁게, 본문은 가독 우선, 강조는 600. 깔끔한 대비.
export const font = {
  display: { size: 26, lineHeight: 34, weight: '700', letterSpacing: -0.5 }, // 화면 타이틀
  h1: { size: 21, lineHeight: 29, weight: '700', letterSpacing: -0.4 },
  h2: { size: 17, lineHeight: 25, weight: '700', letterSpacing: -0.2 }, // 섹션/발문 제목(굵게)
  body: { size: 16, lineHeight: 26, weight: '400', letterSpacing: -0.1 }, // 본문(한글 1.6 줄간격)
  bodyBold: { size: 16, lineHeight: 26, weight: '600', letterSpacing: -0.1 }, // 본문 강조
  caption: { size: 13, lineHeight: 18, weight: '500', letterSpacing: 0 }, // 보조 라벨(살짝 굵게=가독)
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
// Toss풍 부드러운 그림자(은은하게 떠 보이게)
export const shadow = {
  card: {
    shadowColor: '#191F28',
    shadowOpacity: 0.05,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
} as const
