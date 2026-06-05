import { useState } from 'react'
import { ScrollView, View, Pressable } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '../../lib/api'
import type { TermsResponse } from '../../lib/types'
import { Screen } from '../../components/Screen'
import { Txt } from '../../components/Txt'
import { Card } from '../../components/Card'
import { color, space, radius } from '../../theme/tokens'

export default function TermsScreen() {
  const [subject, setSubject] = useState<string | null>(null)
  const q = useQuery({
    queryKey: ['terms'],
    queryFn: () => apiFetch<TermsResponse>('/content/terms', { auth: false }),
  })

  const subjects = q.data?.subjects ?? []
  const all = q.data?.terms ?? []
  const terms = subject ? all.filter((t) => t.subject === subject) : all

  // 단원별 묶기
  const byUnit: Record<string, typeof terms> = {}
  terms.forEach((t) => {
    ;(byUnit[t.unit ?? '기타'] ??= []).push(t)
  })
  const units = Object.keys(byUnit)

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg }}>
        <View>
          <Txt variant="display">용어정리</Txt>
          <Txt variant="body" color={color.textSecondary} style={{ marginTop: space.xs }}>
            단원별 핵심 용어를 익히세요 · {all.length}개
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

        {q.isLoading && <Txt color={color.textMuted}>불러오는 중...</Txt>}
        {!q.isLoading && units.length === 0 && (
          <Card>
            <Txt color={color.textMuted}>아직 용어가 없어요. 적재 후 표시됩니다.</Txt>
          </Card>
        )}

        {units.map((unit) => (
          <View key={unit} style={{ gap: space.sm }}>
            <Txt variant="h2">{unit}</Txt>
            {byUnit[unit]!.map((t) => (
              <Card key={t._id}>
                <Txt variant="bodyBold">{t.term}</Txt>
                <Txt variant="body" color={color.textSecondary} style={{ marginTop: space.xs, lineHeight: 22 }}>
                  {t.definition}
                </Txt>
                {t.example ? (
                  <Txt variant="caption" color={color.textMuted} style={{ marginTop: space.xs }}>
                    예: {t.example}
                  </Txt>
                ) : null}
              </Card>
            ))}
          </View>
        ))}
      </ScrollView>
    </Screen>
  )
}
