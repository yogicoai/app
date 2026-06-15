import { describe, it, expect } from 'vitest'
import { rankWeakUnits, topWeakUnits, type UnitStat } from './weakness'

const stats: UnitStat[] = [
  { subject: '한국사', unit: '조선 후기 실학', attempted: 10, correct: 3 }, // 30%
  { subject: '행정법총론', unit: '행정행위', attempted: 8, correct: 7 }, // 87.5%
  { subject: '행정학개론', unit: '예산론', attempted: 1, correct: 0 }, // 0% but 1회뿐
  { subject: '국어', unit: '맞춤법', attempted: 6, correct: 3 }, // 50%
]

describe('rankWeakUnits', () => {
  it('정답률이 낮을수록 약점 점수가 높다', () => {
    const r = rankWeakUnits(stats)
    const han = r.find((u) => u.unit === '조선 후기 실학')!
    const haeng = r.find((u) => u.unit === '행정행위')!
    expect(han.score).toBeGreaterThan(haeng.score)
  })

  it('정답률을 0~1로 계산한다', () => {
    const r = rankWeakUnits(stats)
    expect(r.find((u) => u.unit === '조선 후기 실학')!.accuracy).toBeCloseTo(0.3, 5)
  })

  it('시도 횟수가 많을수록 같은 정답률이라도 신뢰가중으로 더 약점으로 본다', () => {
    const r = rankWeakUnits([
      { subject: 'x', unit: 'many', attempted: 20, correct: 10 }, // 50%, 증거 많음
      { subject: 'x', unit: 'few', attempted: 2, correct: 1 }, // 50%, 증거 적음
    ])
    expect(r[0]!.unit).toBe('many')
  })

  it('minAttempts 미만 단원은 제외한다', () => {
    const r = rankWeakUnits(stats, { minAttempts: 3 })
    expect(r.find((u) => u.unit === '예산론')).toBeUndefined()
  })

  it('정답률 내림차순이 아니라 약점점수 내림차순으로 정렬한다', () => {
    const r = rankWeakUnits(stats)
    for (let i = 1; i < r.length; i++) expect(r[i - 1]!.score).toBeGreaterThanOrEqual(r[i]!.score)
  })

  it('빈 입력은 빈 배열', () => {
    expect(rankWeakUnits([])).toEqual([])
  })
})

describe('topWeakUnits', () => {
  it('상위 n개만 돌려준다', () => {
    expect(topWeakUnits(stats, 2)).toHaveLength(2)
  })
  it('완벽(100%) 단원은 약점에서 뺀다', () => {
    const r = topWeakUnits([{ subject: 'x', unit: 'perfect', attempted: 5, correct: 5 }], 5)
    expect(r).toHaveLength(0)
  })
})
