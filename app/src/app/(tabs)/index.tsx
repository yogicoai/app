import { ScrollView, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '../../lib/api'
import type { TodayResponse, SummaryResponse } from '../../lib/types'
import { Screen } from '../../components/Screen'
import { Txt } from '../../components/Txt'
import { Card } from '../../components/Card'
import { Button } from '../../components/Button'
import { ProgressBar } from '../../components/ProgressBar'
import { StatCard } from '../../components/StatCard'
import { color, space } from '../../theme/tokens'

export default function HomeScreen() {
  const router = useRouter()
  const today = useQuery({
    queryKey: ['today'],
    queryFn: () => apiFetch<TodayResponse>('/content/today', { auth: false }),
  })
  const summary = useQuery({
    queryKey: ['summary'],
    queryFn: () => apiFetch<SummaryResponse>('/progress/summary'),
  })

  const subjects = today.data ? Array.from(new Set(today.data.questions.map((q) => q.subject))) : []
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

        <Card>
          <Txt variant="h2">{today.data?.theme ?? '오늘의 세트'}</Txt>
          <Txt variant="body" color={color.textSecondary} style={{ marginTop: space.xs }}>
            {today.data ? `${today.data.questions.length}문제 · ${subjects.join(' · ')}` : '불러오는 중...'}
          </Txt>
          <Button
            title="학습 시작"
            onPress={() => router.push('/quiz')}
            disabled={!today.data || today.data.questions.length === 0}
            style={{ marginTop: space.lg }}
          />
        </Card>

        {(today.isError || summary.isError) && (
          <Txt variant="caption" color={color.error}>
            데이터를 불러오지 못했어요. 서버 연결(config.ts)을 확인하세요.
          </Txt>
        )}
      </ScrollView>
    </Screen>
  )
}
