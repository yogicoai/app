import { View, ViewStyle } from 'react-native'
import type { ReactNode } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { color } from '../theme/tokens'

export function Screen({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const insets = useSafeAreaInsets()
  return (
    <View style={[{ flex: 1, backgroundColor: color.bg, paddingTop: insets.top }, style]}>{children}</View>
  )
}
