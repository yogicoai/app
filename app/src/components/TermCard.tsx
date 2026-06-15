import { useRef, useState } from 'react'
import { View, Pressable, Animated, LayoutAnimation, Platform, UIManager } from 'react-native'
import { Txt } from './Txt'
import { Card } from './Card'
import { color, space, radius } from '../theme/tokens'
import type { Term } from '../lib/types'

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true)
}

export function sourceLabel(t: Term): string {
  const yr = (t.years ?? []).slice().sort().join('·')
  const ex = (t.examTypes ?? []).join('/')
  const nums = (t.origins ?? []).map((o) => o.number).filter((n): n is number => typeof n === 'number')
  const numLabel = nums.length ? ` ${t.subject} ${[...new Set(nums)].sort((a, b) => a - b).join('·')}번` : ''
  const head = [yr, ex].filter(Boolean).join(' ')
  return head ? `출처 ${head}${numLabel}` : ''
}
// 앞면용 짧은 출처 힌트(예: "기출 2024·2025 국가직")
export function frontHint(t: Term): string {
  const yr = [...new Set(t.years ?? [])].sort().join('·')
  const ex = [...new Set(t.examTypes ?? [])].join('/')
  const s = [yr, ex].filter(Boolean).join(' ')
  return s ? `기출 ${s}` : ''
}

// 한 용어 = 플래시카드: 용어만 보여주고 탭하면 뜻이 슬라이드 다운, '알아요/몰라요(복습)'로 자가채점
export function TermCard({
  t,
  isKnown,
  inReview,
  onKnow,
  onReviewFlag,
}: {
  t: Term
  isKnown: boolean
  inReview: boolean
  onKnow: (id: string) => void
  onReviewFlag: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const fade = useRef(new Animated.Value(0)).current
  const src = sourceLabel(t)
  const hint = frontHint(t)

  const animateLayout = () => {
    if (Platform.OS !== 'web') LayoutAnimation.configureNext(LayoutAnimation.create(220, 'easeInEaseOut', 'opacity'))
  }
  const reveal = () => {
    animateLayout()
    setOpen(true)
    fade.setValue(0)
    Animated.timing(fade, { toValue: 1, duration: 280, useNativeDriver: true }).start()
  }
  const hide = () => {
    animateLayout()
    setOpen(false)
  }

  return (
    <Card style={{ opacity: isKnown && !open ? 0.6 : 1, borderColor: inReview ? color.warning : undefined, borderWidth: inReview ? 1 : 0 }}>
      <Pressable onPress={open ? hide : reveal}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <Txt variant="bodyBold" style={{ flex: 1 }}>
              {t.term}
            </Txt>
            {isKnown && <Txt variant="caption" color={color.success}>✓</Txt>}
            {inReview && !isKnown && <Txt variant="caption" color={color.warning}>🔁</Txt>}
          </View>
          <Txt variant="caption" color={open ? color.primary : color.textMuted}>
            {open ? '접기 ▲' : '뜻 보기 ▾'}
          </Txt>
        </View>
        {!open && (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
            <Txt variant="caption" color={color.textMuted}>🤔 뜻을 떠올려보고 탭하세요</Txt>
            {hint ? <Txt variant="caption" color={color.textMuted}>{hint}</Txt> : null}
          </View>
        )}
      </Pressable>

      {open && (
        <Animated.View
          style={{ opacity: fade, transform: [{ translateY: fade.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }}
        >
          <Txt variant="body" color={color.textSecondary} style={{ marginTop: space.sm, lineHeight: 25 }}>
            {t.definition}
          </Txt>
          {t.example ? (
            <Txt variant="caption" color={color.textMuted} style={{ marginTop: space.xs }}>
              예: {t.example}
            </Txt>
          ) : null}
          {src ? (
            <Txt variant="caption" color={color.textMuted} style={{ marginTop: space.xs }}>
              {src}
            </Txt>
          ) : null}
          <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.md }}>
            <Pressable onPress={() => { onKnow(t._id); hide() }} style={{ flex: 1 }} hitSlop={4}>
              <View style={{ alignItems: 'center', paddingVertical: space.sm, borderRadius: radius.md, backgroundColor: color.successSoft, borderWidth: 1, borderColor: color.success }}>
                <Txt variant="caption" color={color.success}>✅ 알아요</Txt>
              </View>
            </Pressable>
            <Pressable onPress={() => { onReviewFlag(t._id); hide() }} style={{ flex: 1 }} hitSlop={4}>
              <View style={{ alignItems: 'center', paddingVertical: space.sm, borderRadius: radius.md, backgroundColor: color.warningSoft, borderWidth: 1, borderColor: color.warning }}>
                <Txt variant="caption" color={color.warning}>🔁 몰라요 (복습)</Txt>
              </View>
            </Pressable>
          </View>
        </Animated.View>
      )}
    </Card>
  )
}
