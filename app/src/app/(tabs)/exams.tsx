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
  // 년도 → 시험유형 → 과목 목록
  const byYear: Record<number, Record<string, ExamSummary[]>> = {}
  list.forEach((e) => {
    const y = (byYear[e.year] ??= {})
    ;(y[e.examType] ??= []).push(e)
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
            과목별로 풀고 약점을 파악하세요.
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
            {Object.entries(byYear[year] ?? {}).map(([examType, subjects]) => (
              <View key={examType} style={{ gap: space.sm }}>
                <Txt variant="caption" color={color.textMuted}>{examType}</Txt>
                {subjects.map((e) => (
                  <Pressable
                    key={e.subject}
                    onPress={() =>
                      router.push(
                        `/quiz?year=${e.year}&examType=${encodeURIComponent(e.examType)}&subject=${encodeURIComponent(e.subject)}`,
                      )
                    }
                  >
                    <Card style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <View style={{ flex: 1 }}>
                        <Txt variant="bodyBold">{e.subject}</Txt>
                        <Txt variant="caption" color={color.textMuted} style={{ marginTop: 2 }}>
                          {e.count}문제
                        </Txt>
                      </View>
                      <Txt variant="body" color={color.primary}>풀기 ›</Txt>
                    </Card>
                  </Pressable>
                ))}
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
    </Screen>
  )
}
