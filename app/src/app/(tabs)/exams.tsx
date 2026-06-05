import { ScrollView, View, Pressable } from 'react-native'
import { useRouter } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '../../lib/api'
import type { ExamSummary } from '../../lib/types'
import { Screen } from '../../components/Screen'
import { Txt } from '../../components/Txt'
import { Card } from '../../components/Card'
import { color, space } from '../../theme/tokens'

export default function ExamsScreen() {
  const router = useRouter()
  const exams = useQuery({
    queryKey: ['exams'],
    queryFn: () => apiFetch<{ exams: ExamSummary[] }>('/content/exams'),
  })

  const list = exams.data?.exams ?? []
  // (년도, 시험유형) 단위로 합산 → 한 카드. 과목은 상세에서.
  const byYear: Record<number, Record<string, { count: number; subjectCount: number }>> = {}
  list.forEach((e) => {
    const y = (byYear[e.year] ??= {})
    const t = (y[e.examType] ??= { count: 0, subjectCount: 0 })
    t.count += e.count
    t.subjectCount += 1
  })
  const years = Object.keys(byYear)
    .map(Number)
    .sort((a, b) => b - a)

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg }}>
        <View>
          <Txt variant="display">기출문제</Txt>
          <Txt variant="body" color={color.textSecondary} style={{ marginTop: space.xs }}>
            시험을 고르면 과목별로 풀 수 있어요.
          </Txt>
        </View>

        {years.length === 0 && (
          <Card>
            <Txt color={color.textMuted}>등록된 기출이 아직 없어요. 적재 후 표시됩니다.</Txt>
          </Card>
        )}

        {years.map((year) => (
          <View key={year} style={{ gap: space.sm }}>
            <Txt variant="h2">{year}년</Txt>
            {Object.entries(byYear[year] ?? {}).map(([examType, t]) => (
              <Pressable
                key={examType}
                onPress={() => router.push(`/exam?year=${year}&examType=${encodeURIComponent(examType)}`)}
              >
                <Card style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flex: 1 }}>
                    <Txt variant="bodyBold">{examType}</Txt>
                    <Txt variant="caption" color={color.textMuted} style={{ marginTop: 2 }}>
                      {t.count}문제 · {t.subjectCount}과목
                    </Txt>
                  </View>
                  <Txt variant="body" color={color.primary}>과목 선택 ›</Txt>
                </Card>
              </Pressable>
            ))}
          </View>
        ))}
      </ScrollView>
    </Screen>
  )
}
