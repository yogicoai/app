import { useEffect, useRef, useState } from 'react'
import { ScrollView, View } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '../lib/api'
import { quizKey, loadProgress, saveProgress, clearProgress } from '../lib/quizProgress'
import { questionSource } from '../lib/source'
import type { Question, ReviewResponse } from '../lib/types'
import { Screen } from '../components/Screen'
import { Txt } from '../components/Txt'
import { Card } from '../components/Card'
import { Button } from '../components/Button'
import { Choice, ChoiceState } from '../components/Choice'
import { ProgressBar } from '../components/ProgressBar'
import { color, space, radius, readingLineHeight } from '../theme/tokens'

type AnswerResult = { subject: string; correct: boolean }

export default function QuizScreen() {
  const router = useRouter()
  const qc = useQueryClient()
  const params = useLocalSearchParams<{ year?: string; examType?: string; subject?: string; mode?: string; daily?: string; review?: string; diagnostic?: string }>()
  const isExam = !!params.year
  const isDaily = params.daily === '1' && !!params.subject // 오늘의 기출(과목 선택)
  const isReview = params.review === '1' // 약점 재출제(약점 단원 집중)
  const isDiagnostic = params.diagnostic === '1' // 콜드스타트 진단(5과목 골고루)
  const fresh = isReview || isDiagnostic // 진입할 때마다 새 세트(이어풀기·캐시 사용 안 함)
  const realMode = params.mode === 'exam' // 실전 모의고사(즉시 채점·해설 없음, 시간측정)
  const examLabel = isExam
    ? `${params.year} ${params.examType ?? ''} ${params.subject ?? ''}`.replace(/\s+/g, ' ').trim()
    : isDiagnostic
      ? '약점 진단'
      : isReview
        ? '약점 재출제'
        : isDaily
          ? `오늘의 ${params.subject}`
          : '오늘의 학습'

  const query = useQuery({
    queryKey: isExam
      ? ['exam', params.year, params.examType, params.subject]
      : isDiagnostic
        ? ['diagnostic']
        : isReview
          ? ['review']
          : isDaily
            ? ['daily', params.subject]
            : ['today'],
    queryFn: () =>
      isExam
        ? apiFetch<{ questions: Question[] }>(
            `/content/exam?year=${params.year}&examType=${encodeURIComponent(String(params.examType ?? ''))}` +
              (params.subject ? `&subject=${encodeURIComponent(String(params.subject))}` : ''),
          )
        : isDiagnostic
          ? apiFetch<{ questions: Question[] }>('/content/diagnostic', { auth: false })
          : isReview
            ? apiFetch<ReviewResponse>('/progress/review?limit=10')
            : isDaily
              ? apiFetch<{ questions: Question[] }>(`/content/daily?subject=${encodeURIComponent(String(params.subject))}`, { auth: false })
              : apiFetch<{ questions: Question[] }>('/content/today', { auth: false }),
    // 약점 재출제·진단은 진입할 때마다 새로 받아야 하므로 캐시를 쓰지 않는다.
    staleTime: fresh ? 0 : undefined,
    refetchOnMount: fresh ? 'always' : undefined,
  })

  const [idx, setIdx] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [answered, setAnswered] = useState(false)
  const [results, setResults] = useState<AnswerResult[]>([])
  const [done, setDone] = useState(false)

  const questions = query.data?.questions ?? []

  // 이어풀기: 진행 상태 로컬 저장/복원
  const progressKey = isExam
    ? quizKey({ year: params.year, examType: params.examType, subject: params.subject })
    : isDiagnostic
      ? 'diagnostic'
      : isReview
        ? 'review'
        : isDaily
          ? `daily:${params.subject}`
          : quizKey('today')
  const [restored, setRestored] = useState(false)
  const [resumed, setResumed] = useState(false)

  useEffect(() => {
    if (restored || questions.length === 0) return
    if (fresh) {
      // 약점 재출제·진단은 매번 새로 구성되므로 이어풀기 복원을 하지 않는다.
      setRestored(true)
      return
    }
    let cancelled = false
    loadProgress(progressKey).then((p) => {
      if (cancelled) return
      if (p && p.total === questions.length && p.idx < p.total && (p.idx > 0 || p.results.length > 0)) {
        setIdx(p.idx)
        setSelected(p.selected)
        setAnswered(p.answered)
        setResults(p.results)
        setResumed(true)
      }
      setRestored(true)
    })
    return () => {
      cancelled = true
    }
  }, [questions.length, restored, progressKey])

  useEffect(() => {
    if (!restored || done || questions.length === 0) return
    if (fresh) return // 약점 재출제·진단은 매번 새 세트 — 이어풀기 저장 안 함(orphan 방지)
    if (idx === 0 && results.length === 0 && !answered) return // 진행 없음
    saveProgress({
      key: progressKey,
      label: examLabel,
      idx,
      selected,
      answered,
      results,
      total: questions.length,
      updatedAt: Date.now(),
    })
  }, [restored, done, idx, selected, answered, results, questions.length, progressKey, examLabel])

  // 타이머: 문항별 소요시간(약점분석용) + 전체 경과(실전 표시용)
  const startedAtRef = useRef(Date.now())
  const qStartRef = useRef(Date.now())
  const [elapsedSec, setElapsedSec] = useState(0)
  // 풀이 기록(fire-and-forget) 프로미스 모음 — 진단 진입 전 커밋 보장용
  const pendingAttempts = useRef<Promise<unknown>[]>([])

  useEffect(() => {
    qStartRef.current = Date.now() // 문항 바뀌면 측정 시작점 리셋
  }, [idx])

  useEffect(() => {
    if (done) return
    const t = setInterval(() => setElapsedSec(Math.floor((Date.now() - startedAtRef.current) / 1000)), 1000)
    return () => clearInterval(t)
  }, [done])

  const fmtTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

  if (query.isLoading) {
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Txt color={color.textMuted}>불러오는 중...</Txt>
        </View>
      </Screen>
    )
  }
  if (questions.length === 0) {
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.lg, gap: space.md }}>
          <Txt color={color.textMuted} style={{ textAlign: 'center' }}>
            {isReview ? '아직 약점으로 잡힌 단원이 없어요.\n문제를 더 풀면 약점을 찾아 재출제해줄게요.' : '문제가 없어요.'}
          </Txt>
          <Button title="← 돌아가기" variant="secondary" onPress={() => router.back()} />
        </View>
      </Screen>
    )
  }

  const correctCount = results.filter((r) => r.correct).length

  if (done) {
    const stat: Record<string, { total: number; correct: number }> = {}
    results.forEach((r) => {
      const s = (stat[r.subject] ??= { total: 0, correct: 0 })
      s.total++
      if (r.correct) s.correct++
    })
    const rows = Object.entries(stat)
      .map(([subject, v]) => ({
        subject,
        total: v.total,
        correct: v.correct,
        acc: Math.round((v.correct / v.total) * 100),
      }))
      .sort((a, b) => a.acc - b.acc)
    const weakest = rows[0]

    const reset = () => {
      clearProgress(progressKey)
      setResumed(false)
      setIdx(0)
      setSelected(null)
      setAnswered(false)
      setResults([])
      setDone(false)
      // 약점 재출제는 '다시 풀기' 때 최신 약점으로 새 세트를 받는다.
      if (isReview) qc.invalidateQueries({ queryKey: ['review'] })
    }

    return (
      <Screen>
        <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg }}>
          <View style={{ alignItems: 'center', gap: space.xs, marginTop: space.lg }}>
            <Txt variant="caption" color={color.textMuted}>{realMode ? `🔴 실전 모의고사 · ${examLabel}` : examLabel}</Txt>
            <Txt variant="display" color={color.primary}>
              {correctCount} / {questions.length}
            </Txt>
            <Txt variant="body" color={color.textSecondary}>
              정답률 {Math.round((correctCount / questions.length) * 100)}%
              {realMode ? ` · 소요 ${fmtTime(elapsedSec)}` : ''}
            </Txt>
          </View>

          <Card>
            <Txt variant="h2" style={{ marginBottom: space.sm }}>
              {isDiagnostic ? '진단 결과 — 과목별' : isReview ? '이번 재출제 결과' : '과목별 약점 분석'}
            </Txt>
            {rows.map((r, i) => (
              <View key={r.subject} style={{ marginTop: space.md }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                    <Txt variant="body">{r.subject}</Txt>
                    {i === 0 && (
                      <View style={{ backgroundColor: color.errorSoft, paddingHorizontal: space.sm, paddingVertical: 2, borderRadius: radius.pill }}>
                        <Txt variant="caption" color={color.error}>집중 보완</Txt>
                      </View>
                    )}
                  </View>
                  <Txt variant="caption" color={color.textSecondary}>
                    {r.correct}/{r.total} · {r.acc}%
                  </Txt>
                </View>
                <ProgressBar value={r.acc} fill={r.acc < 60 ? color.error : r.acc < 80 ? color.warning : color.success} />
              </View>
            ))}
            {weakest && (
              isDiagnostic ? (
                <Txt variant="body" color={color.textSecondary} style={{ marginTop: space.lg }}>
                  🎯 아래 버튼으로 AI 진단을 받아보세요. 약점 과목·단원과 학습 방향을 알려드려요.
                </Txt>
              ) : isReview ? (
                <Txt variant="body" color={color.textSecondary} style={{ marginTop: space.lg }}>
                  🎯 약점 단원을 반복해 풀수록 약점이 줄어들어요. 진도 탭에서 약점 변화를 확인하세요.
                </Txt>
              ) : (
                <Txt variant="body" color={color.textSecondary} style={{ marginTop: space.lg }}>
                  🎯 <Txt variant="bodyBold" color={color.error}>{weakest.subject}</Txt> 과목이 가장 약해요. 이 과목을 더 풀어보세요.
                </Txt>
              )
            )}
          </Card>

          {isDiagnostic ? (
            <Button
              title="AI 진단 결과 보기"
              onPress={async () => {
                // 마지막 풀이 기록이 서버에 반영된 뒤 진단(0풀이 오판 방지)
                await Promise.allSettled(pendingAttempts.current)
                router.replace('/diagnose')
              }}
            />
          ) : (
            <Button title="다시 풀기" onPress={reset} />
          )}
          <Button title="← 돌아가기" variant="secondary" onPress={() => router.back()} />
        </ScrollView>
      </Screen>
    )
  }

  const q = questions[idx]

  const advance = () => {
    if (idx + 1 >= questions.length) {
      // 진도 탭의 요약·약점 단원·오답노트가 방금 풀이를 반영하도록 무효화.
      qc.invalidateQueries({ queryKey: ['summary'] })
      qc.invalidateQueries({ queryKey: ['weakness'] })
      qc.invalidateQueries({ queryKey: ['wrong'] })
      clearProgress(progressKey)
      setDone(true)
      return
    }
    setIdx((i) => i + 1)
    setSelected(null)
    setAnswered(false)
  }

  const submit = () => {
    if (selected === null) return
    const isCorrect = selected === q.answerIndex
    const timeSpentMs = Date.now() - qStartRef.current
    setResults((r) => [...r, { subject: q.subject, correct: isCorrect }])
    // 저장 실패는 학습 흐름을 막지 않음(fire-and-forget). 단 진단 진입 전 커밋 보장 위해 프로미스를 모은다.
    pendingAttempts.current.push(
      apiFetch('/progress/attempt', { method: 'POST', body: { questionId: q._id, correct: isCorrect, timeSpentMs } }).catch(() => {}),
    )
    if (realMode) advance() // 실전: 즉시 채점/해설 없이 다음 문항
    else setAnswered(true)
  }

  const choiceState = (i: number): ChoiceState => {
    if (!answered) return selected === i ? 'selected' : 'default'
    if (i === q.answerIndex) return 'correct'
    if (i === selected) return 'wrong'
    return 'default'
  }

  const isCorrect = selected === q.answerIndex

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg }}>
        <View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: space.sm }}>
            <Txt variant="caption" color={color.primary}>
              {realMode ? '🔴 실전 · ' : ''}{examLabel} · {q.subject}
            </Txt>
            <Txt variant="caption" color={color.textMuted}>
              {realMode ? `${fmtTime(elapsedSec)} · ` : ''}{idx + 1} / {questions.length}
            </Txt>
          </View>
          <ProgressBar value={(idx / questions.length) * 100} />
        </View>

        {resumed && (
          <View style={{ backgroundColor: color.primarySoft, paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.md }}>
            <Txt variant="caption" color={color.primary}>
              이어풀기 · {idx + 1}번부터 계속해요
            </Txt>
          </View>
        )}

        {q.passage ? (
          <Card style={{ backgroundColor: color.surface }}>
            <Txt variant="body" color={color.textSecondary} style={{ lineHeight: readingLineHeight }}>
              {q.passage}
            </Txt>
          </Card>
        ) : null}

        <Txt variant="h2">{q.questionText}</Txt>
        {questionSource(q) ? (
          <Txt variant="caption" color={color.textMuted} style={{ marginTop: -space.sm }}>
            출처 · {questionSource(q)}
          </Txt>
        ) : null}

        <View>
          {q.choices.map((c, i) => (
            <Choice key={i} num={i + 1} text={c} state={choiceState(i)} disabled={answered} onPress={() => setSelected(i)} />
          ))}
        </View>

        {answered && (
          <Card style={{ backgroundColor: color.surface }}>
            <Txt variant="bodyBold" color={isCorrect ? color.success : color.error}>
              {isCorrect ? '정답이에요!' : '아쉬워요'}
            </Txt>
            {q.explanation && (
              <Txt variant="body" color={color.textSecondary} style={{ marginTop: space.xs, lineHeight: readingLineHeight }}>
                {q.explanation}
              </Txt>
            )}
          </Card>
        )}

        {realMode ? (
          <Button
            title={idx + 1 >= questions.length ? '제출하고 채점' : '다음 문제'}
            onPress={submit}
            disabled={selected === null}
          />
        ) : !answered ? (
          <Button title="확인" onPress={submit} disabled={selected === null} />
        ) : (
          <Button title={idx + 1 >= questions.length ? '결과 보기' : '다음 문제'} onPress={advance} />
        )}
      </ScrollView>
    </Screen>
  )
}
