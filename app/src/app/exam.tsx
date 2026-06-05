import { useCallback, useState } from 'react'
import { ScrollView, View, Pressable } from 'react-native'
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '../lib/api'
import { listProgress, quizKey, type QuizProgress } from '../lib/quizProgress'
import type { ExamSummary } from '../lib/types'
import { Screen } from '../components/Screen'
import { Txt } from '../components/Txt'
import { Card } from '../components/Card'
import { color, space, radius } from '../theme/tokens'

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

  // 이어풀기 진행 상태(화면 포커스마다 갱신)
  const [progress, setProgress] = useState<Record<string, QuizProgress>>({})
  useFocusEffect(
    useCallback(() => {
      let active = true
      listProgress().then((list) => {
        if (!active) return
        const map: Record<string, QuizProgress> = {}
        list.forEach((p) => (map[p.key] = p))
        setProgress(map)
      })
      return () => {
        active = false
      }
    }, []),
  )

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

        {total > 0 && (
          <Pressable
            onPress={() => router.push(`/quiz?year=${params.year}&examType=${encodeURIComponent(String(params.examType ?? ''))}&mode=exam`)}
          >
            <Card style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: color.primary }}>
              <View style={{ flex: 1 }}>
                <Txt variant="bodyBold" color={color.primary}>🔴 실전 모의고사</Txt>
                <Txt variant="caption" color={color.textMuted} style={{ marginTop: 2 }}>
                  전 과목 {total}문제 · 시간 측정 · 채점은 마지막에
                </Txt>
              </View>
              <Txt variant="body" color={color.primary}>시작 ›</Txt>
            </Card>
          </Pressable>
        )}

        {subjects.map((e) => {
          const prog = progress[quizKey({ year: String(e.year), examType: e.examType, subject: e.subject })]
          return (
            <Pressable
              key={e.subject ?? e.examType}
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
                {prog ? (
                  <View style={{ backgroundColor: color.primarySoft, paddingHorizontal: space.sm, paddingVertical: 2, borderRadius: radius.pill }}>
                    <Txt variant="caption" color={color.primary}>
                      이어풀기 {prog.idx}/{prog.total}
                    </Txt>
                  </View>
                ) : (
                  <Txt variant="body" color={color.primary}>
                    풀기 ›
                  </Txt>
                )}
              </Card>
            </Pressable>
          )
        })}
      </ScrollView>
    </Screen>
  )
}
