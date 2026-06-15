import { Pressable, View } from 'react-native'
import { Txt } from './Txt'
import { color, radius, space } from '../theme/tokens'

export type ChoiceState = 'default' | 'selected' | 'correct' | 'wrong'

const palette: Record<ChoiceState, { bg: string; border: string; text: string; badgeBg: string; badgeText: string }> = {
  default: { bg: color.bg, border: color.border, text: color.textPrimary, badgeBg: color.bg, badgeText: color.textSecondary },
  selected: { bg: color.primarySoft, border: color.primary, text: color.primary, badgeBg: color.primary, badgeText: color.bg },
  correct: { bg: color.successSoft, border: color.success, text: color.success, badgeBg: color.success, badgeText: color.bg },
  wrong: { bg: color.errorSoft, border: color.error, text: color.error, badgeBg: color.error, badgeText: color.bg },
}

export function Choice({
  num,
  text,
  state = 'default',
  onPress,
  disabled,
}: {
  num: number
  text: string
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
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: p.bg,
        borderColor: p.border,
        borderWidth: 1.5,
        borderRadius: radius.lg,
        paddingVertical: space.md,
        paddingHorizontal: space.md,
        marginBottom: space.sm,
      }}
    >
      <View
        style={{
          width: 26,
          height: 26,
          borderRadius: 13,
          backgroundColor: p.badgeBg,
          borderWidth: state === 'default' ? 1.5 : 0,
          borderColor: color.border,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: space.md,
          marginTop: 1,
        }}
      >
        <Txt variant="caption" color={p.badgeText}>
          {num}
        </Txt>
      </View>
      <Txt variant="body" color={p.text} style={{ flex: 1 }}>
        {text}
      </Txt>
    </Pressable>
  )
}
