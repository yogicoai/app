import { useCallback, useState } from 'react'
import { ScrollView, View, Pressable } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '../../lib/api'
import type { Term, TermsResponse } from '../../lib/types'
import { getKnownIds, toggleKnown } from '../../lib/termProgress'
import { Screen } from '../../components/Screen'
import { Txt } from '../../components/Txt'
import { Card } from '../../components/Card'
import { color, space, radius } from '../../theme/tokens'

function sourceLabel(t: Term): string {
  const yr = (t.years ?? []).slice().sort().join('·')
  const ex = (t.examTypes ?? []).join('/')
  const nums = (t.origins ?? []).map((o) => o.number).filter((n): n is number => typeof n === 'number')
  const numLabel = nums.length ? ` ${t.subject} ${[...new Set(nums)].sort((a, b) => a - b).join('·')}번` : ''
  const head = [yr, ex].filter(Boolean).join(' ')
  return head ? `출처 ${head}${numLabel}` : ''
}

export default function TermsScreen() {
  const [subject, setSubject] = useState<string | null>(null)
  const [known, setKnown] = useState<Set<string>>(new Set())
  const [showKnown, setShowKnown] = useState(false)

  const q = useQuery({
    queryKey: ['terms'],
    queryFn: () => apiFetch<TermsResponse>('/content/terms', { auth: false }),
  })

  useFocusEffect(
    useCallback(() => {
      let active = true
      getKnownIds().then((ids) => {
        if (active) setKnown(new Set(ids))
      })
      return () => {
        active = false
      }
    }, []),
  )

  const onToggle = async (id: string) => {
    const next = await toggleKnown(id)
    setKnown(new Set(next))
  }

  const subjects = q.data?.subjects ?? []
  const all = q.data?.terms ?? []
  const bySubject = subject ? all.filter((t) => t.subject === subject) : all
  const knownCount = bySubject.filter((t) => known.has(t._id)).length
  const visible = showKnown ? bySubject : bySubject.filter((t) => !known.has(t._id))

  const byUnit: Record<string, Term[]> = {}
  visible.forEach((t) => {
    ;(byUnit[t.unit ?? '기타'] ??= []).push(t)
  })
  const units = Object.keys(byUnit)

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg }}>
        <View>
          <Txt variant="display">용어정리</Txt>
          <Txt variant="body" color={color.textSecondary} style={{ marginTop: space.xs }}>
            단원별 핵심 용어·단어 · 총 {bySubject.length}개 · 익힘 {knownCount}개
          </Txt>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
          {['전체', ...subjects].map((s) => {
            const active = (s === '전체' && !subject) || s === subject
            return (
              <Pressable key={s} onPress={() => setSubject(s === '전체' ? null : s)}>
                <View
                  style={{
                    paddingHorizontal: space.md,
                    paddingVertical: space.sm,
                    borderRadius: radius.pill,
                    backgroundColor: active ? color.primary : color.surface,
                    borderWidth: 1,
                    borderColor: active ? color.primary : color.border,
                  }}
                >
                  <Txt variant="caption" color={active ? color.bg : color.textSecondary}>
                    {s}
                  </Txt>
                </View>
              </Pressable>
            )
          })}
        </ScrollView>

        <Pressable onPress={() => setShowKnown((v) => !v)} style={{ alignSelf: 'flex-start' }}>
          <Txt variant="caption" color={color.primary}>
            {showKnown ? '익힌 것 숨기기' : `익힌 것 보기 (${knownCount})`}
          </Txt>
        </Pressable>

        {q.isLoading && <Txt color={color.textMuted}>불러오는 중...</Txt>}
        {!q.isLoading && units.length === 0 && (
          <Card>
            <Txt color={color.textMuted}>표시할 용어가 없어요.</Txt>
          </Card>
        )}

        {units.map((unit) => (
          <View key={unit} style={{ gap: space.sm }}>
            <Txt variant="h2">{unit}</Txt>
            {byUnit[unit]!.map((t) => {
              const isKnown = known.has(t._id)
              const src = sourceLabel(t)
              return (
                <Card key={t._id} style={{ opacity: isKnown ? 0.55 : 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Txt variant="bodyBold" style={{ flex: 1 }}>
                      {t.term}
                    </Txt>
                    <Pressable onPress={() => onToggle(t._id)} hitSlop={8}>
                      <View
                        style={{
                          paddingHorizontal: space.sm,
                          paddingVertical: 2,
                          borderRadius: radius.pill,
                          backgroundColor: isKnown ? color.successSoft : color.surface,
                          borderWidth: 1,
                          borderColor: isKnown ? color.success : color.border,
                        }}
                      >
                        <Txt variant="caption" color={isKnown ? color.success : color.textMuted}>
                          {isKnown ? '✓ 익힘' : '익힘'}
                        </Txt>
                      </View>
                    </Pressable>
                  </View>
                  <Txt variant="body" color={color.textSecondary} style={{ marginTop: space.xs, lineHeight: 22 }}>
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
                </Card>
              )
            })}
          </View>
        ))}
      </ScrollView>
    </Screen>
  )
}
