import { Card } from './Card'
import { Txt } from './Txt'
import { color, space } from '../theme/tokens'

export function StatCard({ value, label, accent }: { value: string; label: string; accent?: string }) {
  return (
    <Card style={{ flex: 1, paddingVertical: space.lg }}>
      <Txt variant="h1" color={accent ?? color.textPrimary}>
        {value}
      </Txt>
      <Txt variant="caption" color={color.textMuted} style={{ marginTop: space.xs }}>
        {label}
      </Txt>
    </Card>
  )
}
