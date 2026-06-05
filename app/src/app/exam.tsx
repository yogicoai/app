import { ScrollView, View, Pressable } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '../lib/api'
import type { ExamSummary } from '../lib/types'
import { Screen } from '../components/Screen'
import { Txt } from '../components/Txt'
import { Card } from '../components/Card'
import { color, space } from '../theme/tokens'

// 특정 기출(년도+시험유형)의 과목 목록 → 과목 선택해 풀이
export default function ExamSubjectsScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ year?: string; examType?: string }>()
  const exams = useQuery({
    queryKey: ['exams'],
    queryFn: () => apiFetch<{ exams: ExamSummary[] }>('/content/exams'),
  })

  const subjects = (exams.data?.exams ?? []).filter(
    (e) => String(e.year) === params.year && e.examType === params.examType,
  )
  const total = subjects.reduce((a, s) => a + s.count, 0)

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg }}>
        <View>
          <Txt variant="display">
            {params.year} {params.examType}
          </Txt>
          <Txt variant="body" color={color.textSecondary} style={{ marginTop: space.xs }}>
            과목을 골라 푸세요 · 총 {total}문제
          </Txt>
        </View>

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
              <Txt variant="body" color={color.primary}>
                풀기 ›
              </Txt>
            </Card>
          </Pressable>
        ))}
      </ScrollView>
    </Screen>
  )
}
