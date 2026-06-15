import { useCallback, useState } from 'react'
import { ScrollView, View, Pressable } from 'react-native'
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '../lib/api'
import type { CardsResponse, Term } from '../lib/types'
import { getKnownIds, getReviewIds, setKnown as persistKnown, setReview as persistReview } from '../lib/termProgress'
import { completeDay } from '../lib/dayProgress'
import { Screen } from '../components/Screen'
import { Txt } from '../components/Txt'
import { Button } from '../components/Button'
import { ProgressBar } from '../components/ProgressBar'
import { TermCard } from '../components/TermCard'
import { Choice, ChoiceState } from '../components/Choice'
import { color, space, radius } from '../theme/tokens'

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j]!, a[i]!]
  }
  return a
}
// 정의 첫 줄에서 품사 접두어 떼고 한국어 뜻만(객관식 선택지용)
const cleanMeaning = (t: Term) => (t.definition.split('\n')[0] || '').replace(/^[a-zA-Z]+\.\s*/, '').trim()

interface QuizQ {
  word: Term
  options: string[]
  answer: number
}
function buildQuiz(words: Term[], count = 10): QuizQ[] {
  const pool = words.map((w) => ({ w, m: cleanMeaning(w) })).filter((x) => x.m)
  const picked = shuffle(pool).slice(0, Math.min(count, pool.length))
  return picked.map(({ w, m }) => {
    const distractors = shuffle(pool.filter((x) => x.m !== m)).slice(0, 3).map((x) => x.m)
    const options = shuffle([m, ...distractors])
    return { word: w, options, answer: options.indexOf(m) }
  })
}

// Day 코스 한 회차: 외우기(플래시카드) / 시험보기(4지선다) 토글
export default function CardsScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ track?: string; day?: string }>()
  const track: 'word' | 'term' = params.track === 'term' ? 'term' : 'word'
  const day = Math.max(1, Number(params.day) || 1)
  const [known, setKnownState] = useState<Set<string>>(new Set())
  const [review, setReviewState] = useState<Set<string>>(new Set())
  const [mode, setMode] = useState<'learn' | 'quiz'>('learn')

  const q = useQuery({
    queryKey: ['cards', track, day],
    queryFn: () => apiFetch<CardsResponse>(`/content/cards?track=${track}&day=${day}`, { auth: false }),
  })

  useFocusEffect(
    useCallback(() => {
      let on = true
      Promise.all([getKnownIds(), getReviewIds()]).then(([k, r]) => {
        if (!on) return
        setKnownState(new Set(k))
        setReviewState(new Set(r))
      })
      return () => {
        on = false
      }
    }, []),
  )

  const onKnow = async (id: string) => {
    setKnownState((p) => new Set(p).add(id))
    setReviewState((p) => {
      const n = new Set(p)
      n.delete(id)
      return n
    })
    await persistKnown(id, true)
    await persistReview(id, false)
  }
  const onReviewFlag = async (id: string) => {
    setReviewState((p) => new Set(p).add(id))
    setKnownState((p) => {
      const n = new Set(p)
      n.delete(id)
      return n
    })
    await persistReview(id, true)
    await persistKnown(id, false)
  }

  const items = q.data?.items ?? []
  const knownInSet = items.filter((t) => known.has(t._id)).length
  const title = track === 'word' ? '오늘의 영어 단어' : '오늘의 용어정리'

  // ── 시험(퀴즈) 상태 ──
  const [quiz, setQuiz] = useState<QuizQ[]>([])
  const [qIdx, setQIdx] = useState(0)
  const [qSel, setQSel] = useState<number | null>(null)
  const [qScore, setQScore] = useState(0)
  const [qDone, setQDone] = useState(false)

  const startQuiz = () => {
    setQuiz(buildQuiz(items))
    setQIdx(0)
    setQSel(null)
    setQScore(0)
    setQDone(false)
    setMode('quiz')
  }
  const pick = (i: number) => {
    if (qSel !== null) return
    setQSel(i)
    const cur = quiz[qIdx]!
    if (i === cur.answer) setQScore((s) => s + 1)
    else onReviewFlag(cur.word._id) // 틀린 단어는 복습 큐로
  }
  const nextQ = () => {
    if (qIdx + 1 >= quiz.length) {
      setQDone(true)
      return
    }
    setQIdx((x) => x + 1)
    setQSel(null)
  }
  const choiceState = (i: number): ChoiceState => {
    const cur = quiz[qIdx]
    if (qSel === null || !cur) return qSel === i ? 'selected' : 'default'
    if (i === cur.answer) return 'correct'
    if (i === qSel) return 'wrong'
    return 'default'
  }

  const finish = async () => {
    await completeDay(track, day)
    router.back()
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg }}>
        <View>
          <Txt variant="caption" color={color.primary}>
            {title}
            {q.data ? ` · Day ${day} / ${q.data.totalDays}` : ''}
          </Txt>
          <Txt variant="display" style={{ marginTop: 2 }}>
            Day {day}
          </Txt>
        </View>

        {/* 외우기 / 시험보기 토글 */}
        <View style={{ flexDirection: 'row', backgroundColor: color.surface, borderRadius: radius.lg, padding: 4 }}>
          {([
            ['learn', '📖 외우기'],
            ['quiz', '📝 시험보기'],
          ] as const).map(([m, label]) => {
            const active = mode === m
            return (
              <Pressable
                key={m}
                style={{ flex: 1 }}
                onPress={() => (m === 'quiz' ? startQuiz() : setMode('learn'))}
              >
                <View style={{ alignItems: 'center', paddingVertical: space.sm, borderRadius: radius.md, backgroundColor: active ? color.bg : 'transparent', ...(active ? { shadowColor: '#191F28', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 } : {}) }}>
                  <Txt variant="bodyBold" color={active ? color.textPrimary : color.textMuted}>
                    {label}
                  </Txt>
                </View>
              </Pressable>
            )
          })}
        </View>

        {q.isLoading && <Txt color={color.textMuted}>불러오는 중...</Txt>}
        {!q.isLoading && items.length === 0 && (
          <Txt color={color.textMuted}>이 Day의 카드가 없어요. 마지막 Day까지 다 학습했어요! 🎉</Txt>
        )}

        {/* ── 외우기(플래시카드) ── */}
        {mode === 'learn' && items.length > 0 && (
          <>
            <Txt variant="body" color={color.textSecondary}>
              {items.length}개 · 익힘 {knownInSet}/{items.length}
            </Txt>
            <ProgressBar value={items.length ? (knownInSet / items.length) * 100 : 0} fill={color.success} />
            {items.map((t) => (
              <TermCard key={t._id} t={t} isKnown={known.has(t._id)} inReview={review.has(t._id)} onKnow={onKnow} onReviewFlag={onReviewFlag} />
            ))}
            <Button title="오늘 학습 완료 ✓" onPress={finish} />
          </>
        )}

        {/* ── 시험보기(4지선다) ── */}
        {mode === 'quiz' && quiz.length > 0 && !qDone && (
          <>
            <View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: space.sm }}>
                <Txt variant="caption" color={color.primary}>단어 시험</Txt>
                <Txt variant="caption" color={color.textMuted}>{qIdx + 1} / {quiz.length}</Txt>
              </View>
              <ProgressBar value={(qIdx / quiz.length) * 100} />
            </View>
            <Txt variant="display" style={{ marginTop: space.xs }}>{quiz[qIdx]!.word.term}</Txt>
            <Txt variant="caption" color={color.textMuted} style={{ marginTop: -space.sm }}>
              {track === 'word' ? '의 뜻으로 알맞은 것은?' : '의 설명으로 알맞은 것은?'}
            </Txt>
            <View>
              {quiz[qIdx]!.options.map((opt, i) => (
                <Choice key={i} num={i + 1} text={opt} state={choiceState(i)} disabled={qSel !== null} onPress={() => pick(i)} />
              ))}
            </View>
            {qSel !== null && (
              <Button title={qIdx + 1 >= quiz.length ? '결과 보기' : '다음 문제'} onPress={nextQ} />
            )}
          </>
        )}

        {/* ── 시험 결과 ── */}
        {mode === 'quiz' && qDone && (
          <View style={{ alignItems: 'center', gap: space.md, marginTop: space.lg }}>
            <Txt variant="display" color={color.primary}>{qScore} / {quiz.length}</Txt>
            <Txt variant="body" color={color.textSecondary}>
              {quiz.length - qScore > 0 ? `틀린 ${quiz.length - qScore}개는 복습 큐에 담았어요 🔁` : '전부 맞혔어요! 🎉'}
            </Txt>
            <Button title="다시 시험보기" onPress={startQuiz} style={{ alignSelf: 'stretch' }} />
            <Button title="📖 외우기로" variant="secondary" onPress={() => setMode('learn')} style={{ alignSelf: 'stretch' }} />
          </View>
        )}

        <Button title="← 돌아가기" variant="secondary" onPress={() => router.back()} />
      </ScrollView>
    </Screen>
  )
}
