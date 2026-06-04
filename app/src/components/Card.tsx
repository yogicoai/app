import { View, ViewStyle } from 'react-native'
import type { ReactNode } from 'react'
import { color, radius, space, shadow } from '../theme/tokens'

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return (
    <View
      style={[
        {
          backgroundColor: color.bg,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: color.border,
          padding: space.lg,
          ...shadow.card,
        },
        style,
      ]}
    >
      {children}
    </View>
  )
}
