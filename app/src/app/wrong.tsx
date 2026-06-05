import { ScrollView, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '../lib/api'
import type { WrongResponse } from '../lib/types'
import { Screen } from '../components/Screen'
import { Txt } from '../components/Txt'
import { Card } from '../components/Card'
import { color, space, radius, readingLineHeight } from '../theme/tokens'

// 오답노트: 내가 틀린 문제 + 해설(풀이집)
export default function WrongScreen() {
  const q = useQuery({
    queryKey: ['wrong'],
    queryFn: () => apiFetch<WrongResponse>('/progress/wrong'),
  })
  const items = q.data?.items ?? []

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg }}>
        <View>
          <Txt variant="display">오답노트</Txt>
          <Txt variant="body" color={color.textSecondary} style={{ marginTop: space.xs }}>
            틀린 문제를 해설과 함께 복습하세요 · {items.length}개
          </Txt>
        </View>

        {q.isLoading && <Txt color={color.textMuted}>불러오는 중...</Txt>}
        {!q.isLoading && items.length === 0 && (
          <Card>
            <Txt color={color.textMuted}>아직 틀린 문제가 없어요. 기출을 풀어보세요!</Txt>
          </Card>
        )}

        {items.map((it, i) => {
          const Q = it.question
          return (
            <Card key={Q._id ?? i} style={{ gap: space.sm }}>
              <Txt variant="caption" color={color.primary}>
                {Q.subject}
                {Q.number ? ` ${Q.number}번` : ''}
                {Q.year ? ` · ${Q.year}` : ''}
              </Txt>
              {Q.passage ? (
                <Txt variant="caption" color={color.textMuted} style={{ lineHeight: 20 }}>
                  {Q.passage}
                </Txt>
              ) : null}
              <Txt variant="bodyBold">{Q.questionText}</Txt>
              <View style={{ gap: 4 }}>
                {Q.choices.map((c, ci) => (
                  <Txt key={ci} variant="body" color={ci === Q.answerIndex ? color.success : color.textSecondary}>
                    {ci === Q.answerIndex ? '✓ ' : ''}
                    {ci + 1}. {c}
                  </Txt>
                ))}
              </View>
              {Q.explanation ? (
                <View style={{ backgroundColor: color.surface, padding: space.md, borderRadius: radius.md, marginTop: space.xs }}>
                  <Txt variant="body" color={color.textSecondary} style={{ lineHeight: readingLineHeight }}>
                    {Q.explanation}
                  </Txt>
                </View>
              ) : (
                <Txt variant="caption" color={color.textMuted}>해설 준비 중</Txt>
              )}
            </Card>
          )
        })}
      </ScrollView>
    </Screen>
  )
}
