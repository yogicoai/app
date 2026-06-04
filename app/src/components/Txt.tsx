import { Text, TextProps, TextStyle } from 'react-native'
import { color as C, font } from '../theme/tokens'

type FontVariant = 'display' | 'h1' | 'h2' | 'body' | 'bodyBold' | 'caption'

export function Txt({
  variant = 'body',
  color = C.textPrimary,
  style,
  ...rest
}: TextProps & { variant?: FontVariant; color?: string }) {
  const f = font[variant]
  const base: TextStyle = {
    fontSize: f.size,
    lineHeight: f.lineHeight,
    fontWeight: f.weight as TextStyle['fontWeight'],
    color,
  }
  return <Text style={[base, style]} {...rest} />
}
