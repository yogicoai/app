import { describe, it, expect } from 'vitest'
import { parseTagResponse, needsTagging, buildTagUserPrompt } from './tagger'

describe('parseTagResponse', () => {
  it('정상 JSON 을 파싱한다', () => {
    const raw = JSON.stringify({ unit: '통일신라', concept: '신라 삼국통일', difficulty: 3 })
    expect(parseTagResponse(raw)).toEqual({ unit: '통일신라', concept: '신라 삼국통일', difficulty: 3 })
  })

  it('difficulty 가 없으면 3 으로 기본값', () => {
    const raw = JSON.stringify({ unit: '행정행위', concept: '무효와 취소' })
    expect(parseTagResponse(raw)!.difficulty).toBe(3)
  })

  it('잘못된 JSON 이면 null', () => {
    expect(parseTagResponse('not json')).toBeNull()
  })

  it('unit 이 비면 null', () => {
    const raw = JSON.stringify({ unit: '', concept: 'x' })
    expect(parseTagResponse(raw)).toBeNull()
  })

  it('difficulty 범위를 벗어나면 1~5 로 클램프', () => {
    const raw = JSON.stringify({ unit: 'a', concept: 'b', difficulty: 9 })
    expect(parseTagResponse(raw)!.difficulty).toBe(5)
  })
})

describe('needsTagging', () => {
  it('unit 이 없으면 태깅 필요', () => {
    expect(needsTagging({ unit: undefined, tagSource: null })).toBe(true)
  })
  it('수동 태그는 건드리지 않는다', () => {
    expect(needsTagging({ unit: '통일신라', tagSource: 'manual' })).toBe(false)
  })
  it('이미 ai 태깅됐고 unit 있으면 스킵', () => {
    expect(needsTagging({ unit: '통일신라', tagSource: 'ai' })).toBe(false)
  })
})

describe('buildTagUserPrompt', () => {
  it('문제 본문과 보기를 포함한다', () => {
    const p = buildTagUserPrompt({
      subject: '한국사',
      questionText: '삼국통일을 이룬 나라는?',
      choices: ['고구려', '백제', '신라', '가야'],
    })
    expect(p).toContain('삼국통일')
    expect(p).toContain('신라')
    expect(p).toContain('한국사')
  })
})
