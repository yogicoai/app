import { ScrollView, View, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '../lib/api'
import type { DiagnoseResponse } from '../lib/types'
import { Screen } from '../components/Screen'
import { Txt } from '../components/Txt'
import { Card } from '../components/Card'
import { Button } from '../components/Button'
import { color, space, radius, readingLineHeight } from '../theme/tokens'

export default function DiagnoseScreen() {
  const router = useRouter()
  const q = useQuery({
    queryKey: ['diagnose'],
    queryFn: () => apiFetch<DiagnoseResponse>('/progress/diagnose', { method: 'POST' }),
    staleTime: 0,
    refetchOnMount: 'always',
  })

  if (q.isLoading) {
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md }}>
          <ActivityIndicator color={color.primary} />
          <Txt color={color.textMuted}>AI가 약점을 분석하고 있어요...</Txt>
        </View>
      </Screen>
    )
  }
  if (q.isError || !q.data) {
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.lg, gap: space.md }}>
          <Txt color={color.textMuted} style={{ textAlign: 'center' }}>진단을 불러오지 못했어요. 잠시 후 다시 시도해주세요.</Txt>
          <Button title="← 돌아가기" variant="secondary" onPress={() => router.back()} />
        </View>
      </Screen>
    )
  }

  const { diagnosis, weakUnits } = q.data

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg }}>
        <View style={{ alignItems: 'center', gap: space.xs, marginTop: space.md }}>
          <Txt variant="caption" color={color.primary}>AI 약점 진단</Txt>
          <Txt variant="display">진단 결과</Txt>
        </View>

        <Card>
          <Txt variant="body" color={color.textSecondary} style={{ lineHeight: readingLineHeight }}>
            {diagnosis.summary}
          </Txt>
        </Card>

        {diagnosis.focusAreas.length > 0 && (
          <Card>
            <Txt variant="h2" style={{ marginBottom: space.sm }}>우선 보완할 영역</Txt>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
              {diagnosis.focusAreas.map((f) => (
                <View
                  key={f}
                  style={{ backgroundColor: color.errorSoft, paddingHorizontal: space.md, paddingVertical: 6, borderRadius: radius.pill }}
                >
                  <Txt variant="caption" color={color.error}>{f}</Txt>
                </View>
              ))}
            </View>
          </Card>
        )}

        {weakUnits && weakUnits.length > 0 && (
          <Card>
            <Txt variant="h2" style={{ marginBottom: space.sm }}>약점 단원 (정답률)</Txt>
            {weakUnits.map((u) => (
              <View key={`${u.subject}:${u.unit}`} style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: space.sm }}>
                <Txt variant="body" style={{ flex: 1, marginRight: space.sm }} numberOfLines={1}>{u.unit}</Txt>
                <Txt variant="caption" color={color.textSecondary}>{u.subject} · {Math.round(u.accuracy * 100)}%</Txt>
              </View>
            ))}
          </Card>
        )}

        {diagnosis.encouragement.length > 0 && (
          <Card style={{ backgroundColor: color.primarySoft }}>
            <Txt variant="bodyBold" color={color.primary}>🎯 {diagnosis.encouragement}</Txt>
          </Card>
        )}

        <Button title="약점 재출제 풀기" onPress={() => router.replace('/quiz?review=1')} />
        <Button title="홈으로" variant="secondary" onPress={() => router.replace('/(tabs)')} />
      </ScrollView>
    </Screen>
  )
}
