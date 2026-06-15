import { View } from 'react-native'
import { color, radius } from '../theme/tokens'

export function ProgressBar({
  value,
  height = 8,
  fill = color.primary,
}: {
  value: number
  height?: number
  fill?: string
}) {
  const pct = Math.max(0, Math.min(100, value))
  return (
    <View style={{ height, backgroundColor: color.surface, borderRadius: radius.pill, overflow: 'hidden' }}>
      <View style={{ width: `${pct}%`, height: '100%', backgroundColor: fill, borderRadius: radius.pill }} />
    </View>
  )
}
