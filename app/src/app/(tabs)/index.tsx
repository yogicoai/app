import { ScrollView, View, Pressable } from 'react-native'
import { useRouter } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '../../lib/api'
import type { DailySubjectsResponse, SummaryResponse } from '../../lib/types'
import { Screen } from '../../components/Screen'
import { Txt } from '../../components/Txt'
import { Card } from '../../components/Card'
import { ProgressBar } from '../../components/ProgressBar'
import { StatCard } from '../../components/StatCard'
import { color, space } from '../../theme/tokens'

export default function HomeScreen() {
  const router = useRouter()
  const daily = useQuery({
    queryKey: ['daily-subjects'],
    queryFn: () => apiFetch<DailySubjectsResponse>('/content/daily', { auth: false }),
  })
  const summary = useQuery({
    queryKey: ['summary'],
    queryFn: () => apiFetch<SummaryResponse>('/progress/summary'),
  })

  const dailySubjects = daily.data?.subjects ?? []
  const o = summary.data?.overall

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg }}>
        <View>
          <Txt variant="caption" color={color.textMuted}>오늘의 학습</Txt>
          <Txt variant="display">9급 공무원 · 일반행정</Txt>
        </View>

        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.sm }}>
            <Txt variant="h2">진도율</Txt>
            <Txt variant="bodyBold" color={color.primary}>{o?.progressRate ?? 0}%</Txt>
          </View>
          <ProgressBar value={o?.progressRate ?? 0} />
          <Txt variant="caption" color={color.textSecondary} style={{ marginTop: space.sm }}>
            전체 {o?.attempted ?? 0} / {o?.totalQuestions ?? 0} 문제 학습
          </Txt>
        </Card>

        <View style={{ flexDirection: 'row', gap: space.md }}>
          <StatCard value={`${o?.accuracy ?? 0}%`} label="정답률" accent={color.success} />
          <StatCard value={`${o?.attempted ?? 0}`} label="푼 문제" />
        </View>

        <View>
          <Txt variant="h2">오늘의 기출</Txt>
          <Txt variant="caption" color={color.textMuted} style={{ marginTop: space.xs }}>
            과목을 골라 매일 5문제씩 풀어보세요
          </Txt>
        </View>
        {dailySubjects.map((s) => (
          <Pressable
            key={s.subject}
            onPress={() => router.push(`/quiz?daily=1&subject=${encodeURIComponent(s.subject)}`)}
          >
            <Card style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Txt variant="bodyBold">{s.subject}</Txt>
                <Txt variant="caption" color={color.textMuted} style={{ marginTop: 2 }}>
                  오늘의 {s.count}문제
                </Txt>
              </View>
              <Txt variant="body" color={color.primary}>풀기 ›</Txt>
            </Card>
          </Pressable>
        ))}

        {(daily.isError || summary.isError) && (
          <Txt variant="caption" color={color.error}>
            데이터를 불러오지 못했어요. 서버 연결(config.ts)을 확인하세요.
          </Txt>
        )}
      </ScrollView>
    </Screen>
  )
}
