import { describe, it, expect } from 'vitest'
import { buildDiagnosePrompt, parseDiagnoseResponse, fallbackDiagnosis, type DiagnoseInput } from './diagnose'

const input: DiagnoseInput = {
  subjectStats: [
    { subject: '한국사', attempted: 6, correct: 2 },
    { subject: '행정법총론', attempted: 6, correct: 5 },
    { subject: '국어', attempted: 4, correct: 3 },
  ],
  weakUnits: [
    { subject: '한국사', unit: '조선 후기 실학', accuracy: 0.33 },
    { subject: '국어', unit: '맞춤법', accuracy: 0.5 },
  ],
}

describe('buildDiagnosePrompt', () => {
  it('과목 통계와 약점 단원을 포함한다', () => {
    const p = buildDiagnosePrompt(input)
    expect(p).toContain('한국사')
    expect(p).toContain('조선 후기 실학')
    expect(p).toContain('행정법총론')
  })
})

describe('parseDiagnoseResponse', () => {
  it('정상 JSON 을 파싱한다', () => {
    const raw = JSON.stringify({ summary: '한국사가 약합니다.', focusAreas: ['조선 후기 실학'], encouragement: '할 수 있어요!' })
    const d = parseDiagnoseResponse(raw)
    expect(d).not.toBeNull()
    expect(d!.summary).toContain('한국사')
    expect(d!.focusAreas).toEqual(['조선 후기 실학'])
  })
  it('focusAreas 가 없으면 빈 배열', () => {
    const d = parseDiagnoseResponse(JSON.stringify({ summary: 'x', encouragement: 'y' }))
    expect(d!.focusAreas).toEqual([])
  })
  it('summary 가 비면 null', () => {
    expect(parseDiagnoseResponse(JSON.stringify({ summary: '', encouragement: 'y' }))).toBeNull()
  })
  it('잘못된 JSON 이면 null', () => {
    expect(parseDiagnoseResponse('not json')).toBeNull()
  })
  it('focusAreas 의 비문자열은 걸러낸다', () => {
    const d = parseDiagnoseResponse(JSON.stringify({ summary: 'x', focusAreas: ['a', 3, null, 'b'], encouragement: 'y' }))
    expect(d!.focusAreas).toEqual(['a', 'b'])
  })
})

describe('fallbackDiagnosis (AI 없이 DB 집계만으로)', () => {
  it('가장 약한 과목과 약점 단원을 짚는다', () => {
    const d = fallbackDiagnosis(input)
    expect(d.summary).toContain('한국사') // 정답률 최저(2/6)
    expect(d.focusAreas.some((f) => f.includes('조선 후기 실학'))).toBe(true)
    expect(d.encouragement.length).toBeGreaterThan(0)
  })
  it('데이터가 없으면 진단 권유 문구', () => {
    const d = fallbackDiagnosis({ subjectStats: [], weakUnits: [] })
    expect(d.summary.length).toBeGreaterThan(0)
    expect(d.focusAreas).toEqual([])
  })
})
