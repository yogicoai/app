import { Pressable, ActivityIndicator, ViewStyle } from 'react-native'
import { Txt } from './Txt'
import { color, radius, space } from '../theme/tokens'

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  style,
}: {
  title: string
  onPress?: () => void
  variant?: 'primary' | 'secondary'
  disabled?: boolean
  loading?: boolean
  style?: ViewStyle
}) {
  const isPrimary = variant === 'primary'
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        {
          height: 52,
          borderRadius: radius.md,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          paddingHorizontal: space.lg,
          backgroundColor: isPrimary ? (pressed ? color.primaryDark : color.primary) : color.surface,
          borderWidth: isPrimary ? 0 : 1,
          borderColor: color.border,
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? '#fff' : color.primary} />
      ) : (
        <Txt variant="bodyBold" color={isPrimary ? '#fff' : color.textPrimary}>
          {title}
        </Txt>
      )}
    </Pressable>
  )
}
