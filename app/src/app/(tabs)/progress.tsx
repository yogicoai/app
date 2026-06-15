import { ScrollView, View, Pressable } from 'react-native'
import { useRouter } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '../../lib/api'
import type { SummaryResponse, WrongResponse, WeaknessResponse } from '../../lib/types'
import { Screen } from '../../components/Screen'
import { Txt } from '../../components/Txt'
import { Card } from '../../components/Card'
import { StatCard } from '../../components/StatCard'
import { ProgressBar } from '../../components/ProgressBar'
import { Button } from '../../components/Button'
import { ReminderCard } from '../../components/ReminderCard'
import { color, space, radius } from '../../theme/tokens'

export default function ProgressScreen() {
  const router = useRouter()
  const summary = useQuery({
    queryKey: ['summary'],
    queryFn: () => apiFetch<SummaryResponse>('/progress/summary'),
  })
  const wrong = useQuery({
    queryKey: ['wrong'],
    queryFn: () => apiFetch<WrongResponse>('/progress/wrong'),
  })
  const weakness = useQuery({
    queryKey: ['weakness'],
    queryFn: () => apiFetch<WeaknessResponse>('/progress/weakness'),
  })
  const o = summary.data?.overall
  const bySubject = summary.data?.bySubject ?? []
  const wrongCount = wrong.data?.count ?? 0
  const weakUnits = weakness.data?.weakUnits ?? []

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg }}>
        <Txt variant="display">진도율</Txt>

        <Pressable onPress={() => router.push('/wrong')}>
          <Card style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Txt variant="bodyBold">오답노트</Txt>
              <Txt variant="caption" color={color.textMuted} style={{ marginTop: 2 }}>
                틀린 문제 {wrongCount}개를 해설과 함께 복습
              </Txt>
            </View>
            <Txt variant="body" color={color.primary}>보기 ›</Txt>
          </Card>
        </Pressable>

        <View style={{ flexDirection: 'row', gap: space.md }}>
          <StatCard value={`${o?.progressRate ?? 0}%`} label="진도율" accent={color.primary} />
          <StatCard value={`${o?.accuracy ?? 0}%`} label="정답률" accent={color.success} />
          <StatCard value={`${o?.attempted ?? 0}`} label="푼 문제" />
        </View>

        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: space.sm }}>
            <Txt variant="h2">약점 단원</Txt>
            <View style={{ backgroundColor: color.primarySoft, paddingHorizontal: space.sm, paddingVertical: 2, borderRadius: radius.pill }}>
              <Txt variant="caption" color={color.primary}>AI 태깅 기반</Txt>
            </View>
          </View>
          {weakUnits.length > 0 ? (
            <>
              {weakUnits.map((u) => {
                const acc = Math.round(u.accuracy * 100)
                return (
                  <View key={`${u.subject}:${u.unit}`} style={{ marginTop: space.md }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                      <Txt variant="body" style={{ flex: 1, marginRight: space.sm }} numberOfLines={1}>
                        {u.unit}
                      </Txt>
                      <Txt variant="caption" color={color.textSecondary}>
                        {u.subject} · {u.correct}/{u.attempted} · {acc}%
                      </Txt>
                    </View>
                    <ProgressBar value={acc} fill={acc < 60 ? color.error : acc < 80 ? color.warning : color.success} />
                  </View>
                )
              })}
              <Button
                title="약점 재출제 풀기"
                onPress={() => router.push('/quiz?review=1')}
                style={{ marginTop: space.lg }}
              />
            </>
          ) : (
            <Txt variant="body" color={color.textMuted} style={{ marginTop: space.sm }}>
              문제를 더 풀면 자주 틀리는 단원을 찾아 집중 재출제해줄게요.
            </Txt>
          )}
        </Card>

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

        <ReminderCard />
      </ScrollView>
    </Screen>
  )
}
