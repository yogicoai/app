import { ScrollView, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '../../lib/api'
import type { SummaryResponse } from '../../lib/types'
import { Screen } from '../../components/Screen'
import { Txt } from '../../components/Txt'
import { Card } from '../../components/Card'
import { StatCard } from '../../components/StatCard'
import { ProgressBar } from '../../components/ProgressBar'
import { color, space } from '../../theme/tokens'

export default function ProgressScreen() {
  const summary = useQuery({
    queryKey: ['summary'],
    queryFn: () => apiFetch<SummaryResponse>('/progress/summary'),
  })
  const o = summary.data?.overall
  const bySubject = summary.data?.bySubject ?? []

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg }}>
        <Txt variant="display">진도율</Txt>

        <View style={{ flexDirection: 'row', gap: space.md }}>
          <StatCard value={`${o?.progressRate ?? 0}%`} label="진도율" accent={color.primary} />
          <StatCard value={`${o?.accuracy ?? 0}%`} label="정답률" accent={color.success} />
          <StatCard value={`${o?.attempted ?? 0}`} label="푼 문제" />
        </View>

        <Card>
          <Txt variant="h2" style={{ marginBottom: space.sm }}>과목별 정답률</Txt>
          {bySubject.map((s) => {
            const acc = s.attempted ? Math.round((s.correct / s.attempted) * 100) : 0
            return (
              <View key={s.subject} style={{ marginTop: space.md }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Txt variant="body">{s.subject}</Txt>
                  <Txt variant="caption" color={color.textSecondary}>
                    {s.correct}/{s.attempted} · {acc}%
                  </Txt>
                </View>
                <ProgressBar value={acc} />
              </View>
            )
          })}
          {bySubject.length === 0 && (
            <Txt variant="body" color={color.textMuted} style={{ marginTop: space.sm }}>
              아직 푼 문제가 없어요. 학습을 시작해보세요!
            </Txt>
          )}
        </Card>
      </ScrollView>
    </Screen>
  )
}
