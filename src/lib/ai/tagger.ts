// 외부 API 호출이 없는 순수 로직. OpenAI 호출은 호출측(스크립트)이 주입한다.

export interface TagInput {
  subject: string
  questionText: string
  choices: string[]
}

export interface TagResult {
  unit: string
  concept: string
  difficulty: number
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))

// AI 응답(JSON 문자열) → 검증된 TagResult. 실패 시 null.
export function parseTagResponse(raw: string): TagResult | null {
  let obj: unknown
  try {
    obj = JSON.parse(raw)
  } catch {
    return null
  }
  if (typeof obj !== 'object' || obj === null) return null
  const o = obj as Record<string, unknown>
  const unit = typeof o.unit === 'string' ? o.unit.trim() : ''
  const concept = typeof o.concept === 'string' ? o.concept.trim() : ''
  if (!unit || !concept) return null
  const rawDiff = typeof o.difficulty === 'number' ? o.difficulty : 3
  const difficulty = clamp(Math.round(rawDiff), 1, 5)
  return { unit, concept, difficulty }
}

// 이미 태깅됐거나 수동 태그면 건너뛴다(멱등).
export function needsTagging(q: { unit?: string | null; tagSource?: string | null }): boolean {
  if (q.tagSource === 'manual') return false
  return !q.unit
}

export const TAG_SYSTEM_PROMPT =
  '너는 9급 공무원 시험 문제 분류 전문가다. 주어진 문제를 분석해 단원(unit), ' +
  '핵심개념(concept), 난이도(difficulty: 1~5 정수)를 정한다.\n' +
  '규칙:\n' +
  '1) unit 은 약점 진단의 버킷이다. 과목명(국어/영어/한국사/행정법/행정학)을 그대로 쓰지 말고, ' +
  '교과서 중단원 수준으로 분류한다. 예) 한국사→"고대 통일신라","조선 후기 실학","근대 개항기"; ' +
  '행정법→"행정행위","행정구제"; 행정학→"정책결정론","조직론"; 국어→"맞춤법","표준어","문법(띄어쓰기)","한자성어"; 영어→"어휘","문법","독해".\n' +
  '2) 같은 유형의 문제는 항상 같은 unit 문자열로 표기해 일관성을 유지한다(표기 흔들림 금지).\n' +
  '3) concept 은 unit 보다 더 구체적인 그 문제의 핵심 개념이다.\n' +
  '반드시 {"unit":string,"concept":string,"difficulty":number} 형태의 JSON 만 출력한다.'

export function buildTagUserPrompt(q: TagInput): string {
  const choiceLines = q.choices.map((c, i) => `${i + 1}. ${c}`).join('\n')
  return [
    `과목: ${q.subject}`,
    `문제: ${q.questionText}`,
    `보기:`,
    choiceLines,
  ].join('\n')
}
