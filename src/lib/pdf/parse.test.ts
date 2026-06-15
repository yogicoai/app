import { describe, it, expect } from 'vitest'
import { validateExtracted, mergeAnswerKey, parseAnswerTable, normalizePageText, tidyText, assembleDocItems, parseFileMeta, stripChoiceMarker, structurePassage, sanitizeGlyphs } from './parse'

// pdfjs 가 책표지 괄호 『 』 를 떨어뜨리는 사설영역 코드포인트(U+F000)
const F = String.fromCodePoint(0xf000)
const REPL = String.fromCodePoint(0xfffd)

describe('sanitizeGlyphs', () => {
  it('사설영역 U+F000(깨진 『』)을 짝 토글로 여닫는 책표지 괄호로 복원한다', () => {
    expect(sanitizeGlyphs(`③ ${F}경국대전${F}을 저술`)).toBe('③ 『경국대전』을 저술')
  })
  it('문장 맨 앞의 U+F000은 여는 『 로 복원한다', () => {
    expect(sanitizeGlyphs(`${F}삼국사기${F}는 역사서`)).toBe('『삼국사기』는 역사서')
  })
  it('낱말(조사/명사) 바로 뒤에 여는 괄호가 와도 올바르게 연다', () => {
    // pdfjs 가 "법전인 『경국대전』" 을 "법전인 <F000>경국대전<F000>" 으로 뱉는 지배적 패턴
    expect(sanitizeGlyphs(`법전인 ${F}경국대전${F}을`)).toBe('법전인 『경국대전』을')
    expect(sanitizeGlyphs(`정약용의 ${F}목민심서${F}를`)).toBe('정약용의 『목민심서』를')
  })
  it('책 제목이 비낱말 문자(한자 병기 괄호 등)로 끝나도 닫는다', () => {
    expect(sanitizeGlyphs(`${F}맹자(孟子)${F}를`)).toBe('『맹자(孟子)』를')
  })
  it('연속된 두 책이름도 각각 짝을 맞춘다', () => {
    expect(sanitizeGlyphs(`${F}가${F}${F}나${F}`)).toBe('『가』『나』')
  })
  it('그 밖의 사설영역·치환문자(U+FFFD)는 제거한다', () => {
    expect(sanitizeGlyphs(`가나${REPL}다`)).toBe('가나다')
  })
  it('정상 텍스트는 그대로 둔다', () => {
    expect(sanitizeGlyphs('경국대전은 조선의 기본 법전이다')).toBe('경국대전은 조선의 기본 법전이다')
  })
})

describe('structurePassage', () => {
  it('○ 불릿을 줄바꿈으로 분리한다', () => {
    expect(structurePassage('원칙 ○ 첫째 ○ 둘째')).toBe('원칙\n○ 첫째\n○ 둘째')
  })
  it('시 구절 구분 " / " 를 줄바꿈으로', () => {
    expect(structurePassage('강호에 병이 깊어 / 관동 팔백리에')).toBe('강호에 병이 깊어\n관동 팔백리에')
  })
  it('URL 의 // 는 깨뜨리지 않는다', () => {
    expect(structurePassage('사이트 https://water.com 참고')).toBe('사이트 https://water.com 참고')
  })
  it('마침표 뒤 번호 항목을 분리한다', () => {
    expect(structurePassage('기원합니다. 2. 본원은')).toBe('기원합니다.\n2. 본원은')
  })
  it('<보기> ㄱㄴㄷ 항목을 분리한다(각 진술은 마침표로 끝남)', () => {
    expect(structurePassage('고르면? ㄱ. 강화한다. ㄴ. 약화한다. ㄷ. 무관하다.')).toBe(
      '고르면?\nㄱ. 강화한다.\nㄴ. 약화한다.\nㄷ. 무관하다.',
    )
  })
})

const SUBJECTS = ['국어', '영어', '한국사', '행정법총론', '행정학개론']

describe('parseFileMeta', () => {
  it('연도·시험·과목·종류를 파싱한다', () => {
    expect(parseFileMeta('2025_국가직_국어_문제.pdf', SUBJECTS)).toEqual({ year: 2025, examType: '국가직', subject: '국어', kind: '문제' })
    expect(parseFileMeta('2025_지방직_정답.pdf', SUBJECTS)).toEqual({ year: 2025, examType: '지방직', subject: null, kind: '정답' })
  })
  it('서울시는 지방직으로 합친다', () => {
    expect(parseFileMeta('2025_서울시_국어_문제.pdf', SUBJECTS).examType).toBe('지방직')
  })
  it('대괄호 제목 형식도 과목·연도·시험을 잡는다', () => {
    const m = parseFileMeta('[행정법총론] 2026년 국가직 9급 행정법총론 기출문제.pdf', SUBJECTS)
    expect(m).toEqual({ year: 2026, examType: '국가직', subject: '행정법총론', kind: '문제' })
  })
  it('과목/시험을 못 찾으면 null', () => {
    expect(parseFileMeta('2026_회계학_문제.pdf', SUBJECTS).subject).toBeNull()
    expect(parseFileMeta('2026_국어_문제.pdf', SUBJECTS).examType).toBeNull()
  })
})

describe('normalizePageText', () => {
  it('연속 공백·줄바꿈을 한 칸으로 정리한다', () => {
    expect(normalizePageText('가   나\n\n다')).toBe('가 나 다')
  })
  it('추출 깨짐 U+F000(『』)도 정화한다', () => {
    expect(normalizePageText(`③ ${F}경국대전${F}을`)).toBe('③ 『경국대전』을')
  })
})

describe('tidyText', () => {
  it('따옴표·괄호·문장부호 주변 공백을 정리한다', () => {
    expect(tidyText('‘ 굳다 ’ 는')).toBe('‘굳다’ 는')
    expect(tidyText('< 공공언어 > 에')).toBe('<공공언어> 에')
    expect(tidyText('( 가 ): 개선')).toBe('(가): 개선')
    expect(tidyText('것은 ? 용언')).toBe('것은? 용언')
  })
  it('한글 단어 사이 정상 공백은 유지한다', () => {
    expect(tidyText('다음 글을 이해한 내용')).toBe('다음 글을 이해한 내용')
  })
  it('책표지 괄호 안쪽 공백을 정리한다(『 경국대전 』→『경국대전』)', () => {
    expect(tidyText('『 경국대전 』 을')).toBe('『경국대전』 을')
  })
})

describe('validateExtracted', () => {
  it('정상 문항(보기 4개)을 통과시킨다', () => {
    const r = validateExtracted([
      { number: 1, questionText: '다음 중 옳은 것은?', choices: ['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ'] },
    ])
    expect(r).toHaveLength(1)
    expect(r[0]!.number).toBe(1)
  })
  it('보기 4개 미만이면 제외한다', () => {
    expect(validateExtracted([{ number: 2, questionText: 'x', choices: ['a', 'b'] }])).toHaveLength(0)
  })
  it('본문이 비면 제외', () => {
    expect(validateExtracted([{ number: 3, questionText: '', choices: ['a', 'b', 'c', 'd'] }])).toHaveLength(0)
  })
  it('배열이 아니면 빈 배열', () => {
    expect(validateExtracted('nope')).toEqual([])
  })
})

describe('parseAnswerTable (2026 국가직 통합 정답표)', () => {
  // 실제 추출 텍스트 형태(자간 공백 다수) 일부
  const real =
    '연번 과목명 책형 1 번 2 번 3 번 4 번 5 번 6 번 7 번 8 번 9 번 10 번 ' +
    '11 번 12 번 13 번 14 번 15 번 16 번 17 번 18 번 19 번 20 번 ' +
    '9 국어 가 3 1 4 3 2 3 1 4 4 2 2 3 4 2 4 2 1 4 3 1 ' +
    '40 행정법총론 가 2 1 3 3 4 1 1 3 4 3 4 2 4 3 2 3 1 1 2 2 ' +
    '41 행정학개론 가 2 3 3 4 4 2 4 1 1 2 3 4 1 3 2 1 4 3 2 2'

  it('과목명 → 정답 20개(1-based) 로 파싱한다', () => {
    const t = parseAnswerTable(real)
    expect(t['국어']).toEqual([3, 1, 4, 3, 2, 3, 1, 4, 4, 2, 2, 3, 4, 2, 4, 2, 1, 4, 3, 1])
    expect(t['행정법총론']).toHaveLength(20)
    expect(t['행정학개론']![0]).toBe(2)
  })

  it('헤더 행(과목명 책형 …번)은 정답으로 잡지 않는다', () => {
    const t = parseAnswerTable(real)
    expect(t['과목명']).toBeUndefined()
  })

  it('공백 포함 과목명(일기분석 및 예보법)도 한 키로 잡는다', () => {
    const t = parseAnswerTable('5 일기분석 및 예보법 가 3 1 2 2 3 2 3 3 1 3 2 1 1 4 4 4 3 4 2 3')
    expect(t['일기분석 및 예보법']).toHaveLength(20)
  })

  it('원문자 책형(Ⓐ, 지방직)과 과목명 뒤 괄호 부연을 처리한다', () => {
    const t = parseAnswerTable('31 한국사 Ⓐ 3 1 4 1 1 2 3 3 3 4 2 2 3 2 2 3 4 4 1 2 33 행정학개론 ( 지방행정 포함 ) Ⓐ 1 2 4 1 3 2 3 1 4 2 4 2 2 1 2 3 4 3 1 4')
    expect(t['한국사']).toHaveLength(20)
    expect(t['행정학개론']).toHaveLength(20)
    expect(t['행정학개론']![0]).toBe(1)
  })
})

describe('stripChoiceMarker', () => {
  it('선택지 앞 번호 ①②③④ 를 제거한다', () => {
    expect(stripChoiceMarker('① ㄱ')).toBe('ㄱ')
    expect(stripChoiceMarker('④ ㄱ, ㄴ, ㄷ')).toBe('ㄱ, ㄴ, ㄷ')
  })
  it('보기 표지 ㉠ 은 건드리지 않는다', () => {
    expect(stripChoiceMarker('㉠')).toBe('㉠')
  })
  it('번호만 있는 선택지(삽입형 위치)는 그대로 보존', () => {
    expect(stripChoiceMarker('①')).toBe('①')
    expect(stripChoiceMarker('②')).toBe('②')
  })
})

describe('assembleDocItems — 삽입형 위치 선택지 보존', () => {
  it('번호만(①②③④) 인 선택지(삽입형)는 보존되어 문항이 유지된다', () => {
    const items = assembleDocItems({
      passages: [],
      questions: [{ number: 16, passageId: null, questionText: '주어진 문장이 들어갈 위치는?', choices: ['①', '②', '③', '④'] }],
    })
    expect(items).toHaveLength(1)
    expect(items[0]!.choices).toEqual(['①', '②', '③', '④'])
  })
  it('내용 있는 선택지는 번호만 떼고 보존', () => {
    const items = assembleDocItems({
      passages: [],
      questions: [{ number: 1, passageId: null, questionText: '발문', choices: ['① ㄱ', '② ㄴ', '③ ㄷ', '④ ㄹ'] }],
    })
    expect(items[0]!.choices).toEqual(['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ'])
  })
})

describe('assembleDocItems (지문 부착)', () => {
  const parsed = {
    passages: [{ id: 'p1', text: '강호에 병이 깊어 죽림에 누웠더니' }],
    questions: [
      { number: 7, passageId: 'p1', questionText: '윗글에서 추론한 내용으로 적절하지 않은 것은?', choices: ['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ'] },
      { number: 3, passageId: null, questionText: '다음 진술이 모두 참일 때?', choices: ['a', 'b', 'c', 'd'] },
    ],
  }
  it('passageId 로 지문을 본문 앞에 붙인다', () => {
    const items = assembleDocItems(parsed)
    const q7 = items.find((i) => i.number === 7)!
    expect(q7.questionText).toContain('강호에 병이 깊어')
    expect(q7.questionText).toContain('윗글에서 추론한')
  })
  it('passageId 가 null 이면 지문을 붙이지 않는다', () => {
    const items = assembleDocItems(parsed)
    const q3 = items.find((i) => i.number === 3)!
    expect(q3.questionText).toBe('다음 진술이 모두 참일 때?')
  })
  it('존재하지 않는 passageId 는 무시(본문만)', () => {
    const items = assembleDocItems({ passages: [], questions: [{ number: 1, passageId: 'zzz', questionText: '발문', choices: ['a', 'b', 'c', 'd'] }] })
    expect(items[0]!.questionText).toBe('발문')
  })
})

describe('mergeAnswerKey', () => {
  const items = [
    { number: 1, questionText: 'q1', choices: ['a', 'b', 'c', 'd'] },
    { number: 2, questionText: 'q2', choices: ['a', 'b', 'c', 'd'] },
  ]
  it('문항번호로 정답행(1-based)을 병합한다 → answerIndex(0-based)', () => {
    const merged = mergeAnswerKey(items, [3, 1]) // 1번=③, 2번=①
    expect(merged[0]!.answerIndex).toBe(2)
    expect(merged[1]!.answerIndex).toBe(0)
  })
  it('정답이 보기 범위를 벗어나면 그 문항 제외', () => {
    const merged = mergeAnswerKey([{ number: 1, questionText: 'q', choices: ['a', 'b'] }], [4])
    expect(merged).toHaveLength(0)
  })
  it('정답 없는 문항(undefined)은 제외', () => {
    const merged = mergeAnswerKey([{ number: 5, questionText: 'q', choices: ['a', 'b', 'c', 'd'] }], [3, 1])
    expect(merged).toHaveLength(0)
  })
})
