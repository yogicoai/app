import { Text, TextProps, TextStyle } from 'react-native'
import { color as C, font, fontFamilyByWeight } from '../theme/tokens'

type FontVariant = 'display' | 'h1' | 'h2' | 'body' | 'bodyBold' | 'caption'

export function Txt({
  variant = 'body',
  color = C.textPrimary,
  style,
  ...rest
}: TextProps & { variant?: FontVariant; color?: string }) {
  const f = font[variant]
  const base: TextStyle = {
    fontFamily: fontFamilyByWeight[f.weight] ?? 'Pretendard-Regular',
    fontSize: f.size,
    lineHeight: f.lineHeight,
    fontWeight: f.weight as TextStyle['fontWeight'], // 웹 폴백용(네이티브는 fontFamily 가 굵기 결정)
    letterSpacing: 'letterSpacing' in f ? (f as { letterSpacing: number }).letterSpacing : undefined,
    color,
  }
  return <Text style={[base, style]} {...rest} />
}
