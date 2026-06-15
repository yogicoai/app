import { useCallback, useEffect, useState } from 'react'
import { ScrollView, View, Pressable } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '../../lib/api'
import type { Term, TermsResponse } from '../../lib/types'
import { getKnownIds, getReviewIds, setKnown as persistKnown, setReview as persistReview, getLastSubject, setLastSubject } from '../../lib/termProgress'
import { Screen } from '../../components/Screen'
import { Txt } from '../../components/Txt'
import { Card } from '../../components/Card'
import { ProgressBar } from '../../components/ProgressBar'
import { TermCard } from '../../components/TermCard'
import { color, space, radius } from '../../theme/tokens'

interface UnitGroup {
  unit: string
  terms: Term[]
}
interface ChapterGroup {
  key: string
  subject: string
  chapter: string
  units: UnitGroup[]
  total: number
}

export default function TermsScreen() {
  const [subject, setSubject] = useState<string | null>(null)
  const [year, setYear] = useState<number | null>(null)
  const [known, setKnownState] = useState<Set<string>>(new Set())
  const [review, setReviewState] = useState<Set<string>>(new Set())
  const [showKnown, setShowKnown] = useState(false)
  const [onlyReview, setOnlyReview] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const q = useQuery({
    queryKey: ['terms'],
    queryFn: () => apiFetch<TermsResponse>('/content/terms', { auth: false }),
  })

  useFocusEffect(
    useCallback(() => {
      let active = true
      Promise.all([getKnownIds(), getReviewIds()]).then(([k, r]) => {
        if (!active) return
        setKnownState(new Set(k))
        setReviewState(new Set(r))
      })
      return () => {
        active = false
      }
    }, []),
  )

  // '알아요' = 익힘 처리(복습 큐에서 제거)
  const onKnow = async (id: string) => {
    setKnownState((prev) => new Set(prev).add(id))
    setReviewState((prev) => {
      const n = new Set(prev)
      n.delete(id)
      return n
    })
    await persistKnown(id, true)
    await persistReview(id, false)
  }
  // '몰라요' = 복습 큐에 추가(익힘 해제)
  const onReviewFlag = async (id: string) => {
    setReviewState((prev) => new Set(prev).add(id))
    setKnownState((prev) => {
      const n = new Set(prev)
      n.delete(id)
      return n
    })
    await persistReview(id, true)
    await persistKnown(id, false)
  }
  const toggleChapter = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })

  const subjects = q.data?.subjects ?? []
  // '전체' 없이 항상 한 과목만 — 마지막에 보던 과목을 우선 자동 선택(없으면 첫 과목)
  useEffect(() => {
    if (subject || subjects.length === 0) return
    getLastSubject().then((last) => setSubject(last && subjects.includes(last) ? last : subjects[0]!))
  }, [subject, subjects])
  const pickSubject = (s: string) => {
    setSubject(s)
    setLastSubject(s)
  }
  const all = q.data?.terms ?? [] // 서버가 과목→대단원순→단원→용어로 정렬해 보냄
  const years = [...new Set(all.flatMap((t) => t.years ?? []))].sort((a, b) => b - a)
  const scoped = all.filter(
    (t) => (!subject || t.subject === subject) && (!year || (t.years ?? []).includes(year)),
  )
  const knownCount = scoped.filter((t) => known.has(t._id)).length
  const reviewCount = scoped.filter((t) => review.has(t._id)).length

  // 현재 필터에서 카드가 보이는지
  const termVisible = (t: Term) => (onlyReview ? review.has(t._id) : showKnown || !known.has(t._id))

  // 과목→대단원→단원 그룹화(서버 정렬 유지)
  const chapters: ChapterGroup[] = []
  let curCh: ChapterGroup | null = null
  let curUnit: UnitGroup | null = null
  for (const t of scoped) {
    const chName = t.chapter ?? '단어집'
    const key = `${t.subject}|${chName}`
    if (!curCh || curCh.key !== key) {
      curCh = { key, subject: t.subject, chapter: chName, units: [], total: 0 }
      chapters.push(curCh)
      curUnit = null
    }
    const unitName = t.unit ?? '기타'
    if (!curUnit || curUnit.unit !== unitName) {
      curUnit = { unit: unitName, terms: [] }
      curCh.units.push(curUnit)
    }
    curUnit.terms.push(t)
    curCh.total++
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg }}>
        <View>
          <Txt variant="display">용어정리</Txt>
          <Txt variant="body" color={color.textSecondary} style={{ marginTop: space.xs }}>
            대단원별 암기카드 · 총 {scoped.length}개 · 익힘 {knownCount} · 복습 {reviewCount}
          </Txt>
        </View>

        {years.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
            {['전체', ...years.map(String)].map((y) => {
              const active = (y === '전체' && !year) || y === String(year)
              return (
                <Pressable key={y} onPress={() => setYear(y === '전체' ? null : Number(y))}>
                  <View
                    style={{
                      paddingHorizontal: space.md,
                      paddingVertical: space.sm,
                      borderRadius: radius.pill,
                      backgroundColor: active ? color.navy : color.surface,
                      borderWidth: 1,
                      borderColor: active ? color.navy : color.border,
                    }}
                  >
                    <Txt variant="caption" color={active ? color.bg : color.textSecondary}>
                      {y === '전체' ? '전체 연도' : `${y}년`}
                    </Txt>
                  </View>
                </Pressable>
              )
            })}
          </ScrollView>
        )}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
          {subjects.map((s) => {
            const active = s === subject
            return (
              <Pressable key={s} onPress={() => pickSubject(s)}>
                <View
                  style={{
                    paddingHorizontal: space.md,
                    paddingVertical: space.sm,
                    borderRadius: radius.pill,
                    backgroundColor: active ? color.primary : color.surface,
                    borderWidth: 1,
                    borderColor: active ? color.primary : color.border,
                  }}
                >
                  <Txt variant="caption" color={active ? color.bg : color.textSecondary}>
                    {s}
                  </Txt>
                </View>
              </Pressable>
            )
          })}
        </ScrollView>

        <View style={{ flexDirection: 'row', gap: space.md }}>
          <Pressable onPress={() => { setOnlyReview((v) => !v); setShowKnown(false) }}>
            <Txt variant="caption" color={onlyReview ? color.warning : color.textMuted}>
              {onlyReview ? '● 복습할 것만 보는 중' : `🔁 복습할 것 (${reviewCount})`}
            </Txt>
          </Pressable>
          {!onlyReview && (
            <Pressable onPress={() => setShowKnown((v) => !v)}>
              <Txt variant="caption" color={color.primary}>
                {showKnown ? '익힌 것 숨기기' : `익힌 것 보기 (${knownCount})`}
              </Txt>
            </Pressable>
          )}
        </View>

        {(q.isLoading || !subject) && <Txt color={color.textMuted}>불러오는 중...</Txt>}
        {!q.isLoading && subject && (chapters.length === 0 || (onlyReview && reviewCount === 0)) && (
          <Card>
            <Txt color={color.textMuted}>
              {onlyReview ? '복습할 카드가 없어요. 카드를 풀며 \'몰라요\'를 누르면 여기 모여요.' : '표시할 용어가 없어요.'}
            </Txt>
          </Card>
        )}

        {subject && !(onlyReview && reviewCount === 0) &&
          chapters.map((ch) => {
            const isWord = ch.chapter === '단어집'
            const visibleUnits = ch.units
              .map((u) => ({ unit: u.unit, terms: u.terms.filter(termVisible) }))
              .filter((u) => u.terms.length > 0)
            if (visibleUnits.length === 0) return null // 현재 필터에 보일 카드가 없는 대단원은 숨김
            const open = isWord || onlyReview || expanded.has(ch.key)
            const knownInCh = ch.units.reduce((n, u) => n + u.terms.filter((t) => known.has(t._id)).length, 0)
            const pct = ch.total ? Math.round((knownInCh / ch.total) * 100) : 0
            return (
              <View key={ch.key} style={{ gap: space.sm }}>
                <Pressable onPress={isWord || onlyReview ? undefined : () => toggleChapter(ch.key)}>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: color.surface,
                      borderWidth: 1,
                      borderColor: open ? color.primary : color.border,
                      borderRadius: radius.md,
                      paddingHorizontal: space.md,
                      paddingVertical: space.md,
                    }}
                  >
                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                      {!isWord && !onlyReview && <Txt variant="body" color={color.textMuted}>{open ? '▾' : '▸'}</Txt>}
                      <Txt variant="h2">{subject ? ch.chapter : `${ch.subject} · ${ch.chapter}`}</Txt>
                    </View>
                    <Txt variant="caption" color={color.textSecondary}>
                      {ch.total}개 · 익힘 {knownInCh}
                    </Txt>
                  </View>
                </Pressable>
                {ch.total > 0 && !isWord && !onlyReview && (
                  <ProgressBar value={pct} fill={pct >= 80 ? color.success : pct >= 40 ? color.warning : color.primary} />
                )}

                {open &&
                  visibleUnits.map((u) => (
                    <View key={u.unit} style={{ gap: space.sm, marginTop: space.xs }}>
                      {!isWord && (
                        <Txt variant="caption" color={color.textMuted} style={{ marginLeft: space.xs }}>
                          {u.unit}
                        </Txt>
                      )}
                      {u.terms.map((t) => (
                        <TermCard
                          key={t._id}
                          t={t}
                          isKnown={known.has(t._id)}
                          inReview={review.has(t._id)}
                          onKnow={onKnow}
                          onReviewFlag={onReviewFlag}
                        />
                      ))}
                    </View>
                  ))}
              </View>
            )
          })}
      </ScrollView>
    </Screen>
  )
}
