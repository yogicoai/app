import { Pressable } from 'react-native'
import { Txt } from './Txt'
import { color, radius, space } from '../theme/tokens'

export type ChoiceState = 'default' | 'selected' | 'correct' | 'wrong'

const palette: Record<ChoiceState, { bg: string; border: string; text: string }> = {
  default: { bg: color.bg, border: color.border, text: color.textPrimary },
  selected: { bg: color.primarySoft, border: color.primary, text: color.primary },
  correct: { bg: color.successSoft, border: color.success, text: color.success },
  wrong: { bg: color.errorSoft, border: color.error, text: color.error },
}

export function Choice({
  label,
  state = 'default',
  onPress,
  disabled,
}: {
  label: string
  state?: ChoiceState
  onPress?: () => void
  disabled?: boolean
}) {
  const p = palette[state]
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={{
        backgroundColor: p.bg,
        borderColor: p.border,
        borderWidth: 1.5,
        borderRadius: radius.md,
        paddingVertical: space.lg,
        paddingHorizontal: space.lg,
        marginBottom: space.sm,
      }}
    >
      <Txt variant="body" color={p.text}>
        {label}
      </Txt>
    </Pressable>
  )
}
