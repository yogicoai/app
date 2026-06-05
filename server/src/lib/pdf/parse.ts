// 외부 호출 없는 순수 로직: 텍스트 정규화 · AI 추출 결과 검증 · 통합 정답표 파싱 · 정답 병합.

export interface ExtractedItem {
  number: number
  questionText: string
  choices: string[]
}
export interface ParsedQuestion extends ExtractedItem {
  answerIndex: number
}

// pdfjs 는 자간을 공백으로 넣어 "국 어" 처럼 깨지므로, 연속 공백을 한 칸으로 정리.
export function normalizePageText(s: string): string {
  return s.replace(/\s+/g, ' ').trim()
}

// 한 줄로 평탄화된 지문에 구조적 줄바꿈을 보강한다(내용 단어는 보존, 마커 경계에만 \n 삽입).
// 안전장치: " / "(앞뒤 공백)만 줄바꿈 → URL "https://"(공백 없음)은 그대로.
export function structurePassage(text: string): string {
  return text
    .replace(/\s+\/\s+/g, '\n') // 시(詩) 구절 구분 " / "
    .replace(/\s*○\s*/g, '\n○ ') // ○ 불릿 항목
    .replace(/(?<=[.?!])\s+(?=\d{1,2}\.\s)/g, '\n') // 문장부호 뒤 번호 항목(1. 2. …)
    .replace(/(?<=[.?!])\s+(?=[ㄱ-ㅎ]\.\s)/g, '\n') // 문장부호 뒤 <보기> 항목(ㄱ. ㄴ. ㄷ.)
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\s+/, '')
    .trim()
}

// 선택지 앞에 붙은 번호 기호(①②③④⑤)를 제거("① ㄱ"→"ㄱ"). 보기 표지 ㉠㉡ 은 건드리지 않는다.
// 단 번호만 있는 경우(삽입형 문항의 위치 선택지 "①" 등)는 그대로 보존한다.
export function stripChoiceMarker(c: string): string {
  const stripped = c.replace(/^[①②③④⑤]\s*/, '').trim()
  return stripped === '' ? c.trim() : stripped
}

// 문장부호·따옴표·괄호 주변의 남은 공백을 정리(한글 단어 사이 공백은 건드리지 않음).
export function tidyText(s: string): string {
  return s
    .replace(/\s+/g, ' ')
    .replace(/\s+([?!.,;:)\]}>’”」』》])/g, '$1') // 닫는 기호/문장부호 앞 공백 제거
    .replace(/([(\[{<‘“「『《])\s+/g, '$1') // 여는 기호 뒤 공백 제거
    .trim()
}

// AI 가 뱉은 문항 후보 중 형식이 온전한 것(번호·본문·보기 4개 이상)만 남긴다.
export function validateExtracted(items: unknown): ExtractedItem[] {
  if (!Array.isArray(items)) return []
  const out: ExtractedItem[] = []
  for (const it of items) {
    if (typeof it !== 'object' || it === null) continue
    const o = it as Record<string, unknown>
    const number = typeof o.number === 'number' ? o.number : NaN
    const questionText = typeof o.questionText === 'string' ? o.questionText.trim() : ''
    const choices = Array.isArray(o.choices)
      ? o.choices.filter((c) => typeof c === 'string').map((c) => (c as string).trim()).filter(Boolean)
      : []
    if (!Number.isFinite(number) || !questionText || choices.length < 4) continue
    out.push({ number, questionText, choices })
  }
  return out
}

// AI 가 {passages, questions} 로 분리해 준 응답을 조립한다.
// 지문(passages)을 한 번만 받고, 문항의 passageId 로 연결해 코드에서 지문을 본문 앞에 붙인다.
export function assembleDocItems(parsed: unknown): ExtractedItem[] {
  if (typeof parsed !== 'object' || parsed === null) return []
  const o = parsed as Record<string, unknown>
  const passages = new Map<string, string>()
  if (Array.isArray(o.passages)) {
    for (const p of o.passages) {
      if (p && typeof p === 'object') {
        const id = String((p as Record<string, unknown>).id ?? '').trim()
        const text = typeof (p as Record<string, unknown>).text === 'string' ? ((p as Record<string, unknown>).text as string) : ''
        if (id) passages.set(id, tidyText(text))
      }
    }
  }
  const rawQs = Array.isArray(o.questions) ? o.questions : []
  const assembled = rawQs.map((q) => {
    if (!q || typeof q !== 'object') return q
    const qq = q as Record<string, unknown>
    const pid = qq.passageId != null ? String(qq.passageId).trim() : ''
    const passage = pid && passages.has(pid) ? passages.get(pid)! : ''
    const qt = tidyText(typeof qq.questionText === 'string' ? qq.questionText : '')
    const choices = Array.isArray(qq.choices)
      ? qq.choices.map((c) => (typeof c === 'string' ? tidyText(stripChoiceMarker(c)) : c))
      : qq.choices
    return { number: qq.number, questionText: passage ? `${passage}\n\n${qt}` : qt, choices }
  })
  return validateExtracted(assembled)
}

// 국가직/기상직 통합 정답표 텍스트 → { 과목명: [정답 20개(1-based)] }.
// 행 형태: "<연번> <과목명> <책형> d1 d2 ... d20". 책형(한 글자)+20개 숫자를 앵커로 추출.
export function parseAnswerTable(text: string): Record<string, number[]> {
  const flat = normalizePageText(text)
  // 책형: 한글(가/나) · 라틴(A/B) · 원문자(Ⓐ/Ⓑ, 지방직) 모두 허용.
  // 과목명 뒤 괄호 부연(예: "행정학개론 (지방행정 포함)")은 책형 앞에서 건너뛴다.
  const re = /([가-힣]+(?:\s[가-힣]+)*)\s(?:\([^)]*\)\s)?([가-힣A-ZⒶ-Ⓩ])\s((?:[1-5]\s){19}[1-5])/g
  const out: Record<string, number[]> = {}
  let m: RegExpExecArray | null
  while ((m = re.exec(flat)) !== null) {
    const subject = m[1]!.trim()
    const nums = m[3]!.trim().split(/\s+/).map(Number)
    if (nums.length === 20) out[subject] = nums
  }
  return out
}

// 파일명 → 메타. 형식이 섞여 있어("2026_국어_문제.pdf", "[행정법총론] 2026년 … 기출문제.pdf")
// 연도는 4자리, 과목은 알려진 목록 중 포함된 가장 긴 이름, kind 는 '정답' 포함 여부로 판별.
export function parseFileMeta(
  filename: string,
  subjects: string[],
): { year: number; examType: string | null; subject: string | null; kind: '문제' | '정답' } {
  const base = filename.replace(/\.pdf$/i, '')
  const yearM = base.match(/20\d{2}/)
  const year = yearM ? Number(yearM[0]) : NaN
  const kind: '문제' | '정답' = /정답/.test(base) ? '정답' : '문제'
  // 서울시는 지방직과 공통문제이므로 지방직으로 합친다.
  const examType = /지방직|서울시/.test(base) ? '지방직' : /국가직/.test(base) ? '국가직' : null
  const subject = subjects.filter((s) => base.includes(s)).sort((a, b) => b.length - a.length)[0] ?? null
  return { year, examType, subject, kind }
}

// 과목 정답행(1-based) 을 문항에 병합. 정답 없거나 보기 범위를 벗어나면 그 문항 제외.
export function mergeAnswerKey(items: ExtractedItem[], answers: number[]): ParsedQuestion[] {
  const out: ParsedQuestion[] = []
  for (const it of items) {
    const oneBased = answers[it.number - 1]
    if (!oneBased || oneBased < 1 || oneBased > it.choices.length) continue
    out.push({ ...it, answerIndex: oneBased - 1 })
  }
  return out
}
