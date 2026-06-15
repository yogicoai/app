import { useCallback, useState } from 'react'
import { ScrollView, View, Pressable } from 'react-native'
import { useRouter, useFocusEffect } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '../../lib/api'
import type { DailySubjectsResponse, SummaryResponse } from '../../lib/types'
import { getCompletedDay } from '../../lib/dayProgress'
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

  // Day 코스 진도(완료한 Day + 1 = 오늘 학습할 Day). 세션 끝내고 돌아오면 자동 갱신.
  const [wordDay, setWordDay] = useState(1)
  const [termDay, setTermDay] = useState(1)
  useFocusEffect(
    useCallback(() => {
      let on = true
      Promise.all([getCompletedDay('word'), getCompletedDay('term')]).then(([w, t]) => {
        if (!on) return
        setWordDay(w + 1)
        setTermDay(t + 1)
      })
      return () => {
        on = false
      }
    }, []),
  )

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

        {(o?.attempted ?? 0) < 10 && (
          <Pressable onPress={() => router.push('/quiz?diagnostic=1')}>
            <Card style={{ backgroundColor: color.primarySoft }}>
              <Txt variant="bodyBold" color={color.primary}>AI 약점 진단 받기 ›</Txt>
              <Txt variant="caption" color={color.textSecondary} style={{ marginTop: 4 }}>
                5과목 10문제로 시작 — 약점 과목·단원을 AI가 분석해드려요
              </Txt>
            </Card>
          </Pressable>
        )}

        <View>
          <Txt variant="h2">오늘의 암기</Txt>
          <Txt variant="caption" color={color.textMuted} style={{ marginTop: space.xs }}>
            매일 단어·용어를 카드로 차곡차곡 외워요
          </Txt>
        </View>
        <Pressable onPress={() => router.push(`/cards?track=word&day=${wordDay}`)}>
          <Card style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Txt variant="bodyBold">📘 오늘의 영어 단어</Txt>
              <Txt variant="caption" color={color.textMuted} style={{ marginTop: 2 }}>
                Day {wordDay} · 20단어 (★최빈출부터)
              </Txt>
            </View>
            <Txt variant="body" color={color.primary}>시작 ›</Txt>
          </Card>
        </Pressable>
        <Pressable onPress={() => router.push(`/cards?track=term&day=${termDay}`)}>
          <Card style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Txt variant="bodyBold">📗 오늘의 용어정리</Txt>
              <Txt variant="caption" color={color.textMuted} style={{ marginTop: 2 }}>
                Day {termDay} · 15개 (대단원 순)
              </Txt>
            </View>
            <Txt variant="body" color={color.primary}>시작 ›</Txt>
          </Card>
        </Pressable>

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
