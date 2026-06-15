// 콜드스타트 AI 진단 순수 로직: 프롬프트 생성·응답 파싱·AI 없는 폴백. 외부 호출 없음.
// AI 비용 원칙의 3접점 중 ②콜드스타트 진단. 호출/캐싱은 라우트 책임.

export interface DiagnoseInput {
  subjectStats: { subject: string; attempted: number; correct: number }[]
  weakUnits: { subject: string; unit: string; accuracy: number }[]
}

export interface Diagnosis {
  summary: string // 2~3문장 종합 진단
  focusAreas: string[] // 우선 보완할 단원/과목
  encouragement: string // 동기부여 한 줄
}

export const DIAGNOSE_SYSTEM =
  '너는 9급 공무원 일반행정직 수험 코치다. 수험생의 과목별 정답률과 약점 단원 데이터를 보고 ' +
  '짧고 구체적이며 격려가 담긴 학습 진단을 한국어로 작성한다. 과장·추측 금지, 데이터에 근거한다. ' +
  '반드시 {"summary":string,"focusAreas":string[],"encouragement":string} 형태의 JSON 만 출력한다. ' +
  'summary 는 2~3문장, focusAreas 는 우선 보완할 단원/과목 2~4개, encouragement 는 한 문장.'

function acc(s: { attempted: number; correct: number }): number {
  return s.attempted ? s.correct / s.attempted : 0
}

export function buildDiagnosePrompt(input: DiagnoseInput): string {
  const subjects = input.subjectStats
    .map((s) => `- ${s.subject}: ${s.correct}/${s.attempted} (정답률 ${Math.round(acc(s) * 100)}%)`)
    .join('\n')
  const units = input.weakUnits
    .map((u) => `- ${u.subject} · ${u.unit}: 정답률 ${Math.round(u.accuracy * 100)}%`)
    .join('\n')
  return [
    '[과목별 정답률]',
    subjects || '(아직 푼 문제 없음)',
    '',
    '[약점 단원(정답률 낮은 순)]',
    units || '(데이터 부족)',
    '',
    '위 데이터를 바탕으로 진단 JSON 을 작성하라.',
  ].join('\n')
}

// AI 응답(JSON 문자열) → 검증된 Diagnosis. 실패 시 null.
export function parseDiagnoseResponse(raw: string): Diagnosis | null {
  let obj: unknown
  try {
    obj = JSON.parse(raw)
  } catch {
    return null
  }
  if (typeof obj !== 'object' || obj === null) return null
  const o = obj as Record<string, unknown>
  const summary = typeof o.summary === 'string' ? o.summary.trim() : ''
  if (!summary) return null
  const focusAreas = Array.isArray(o.focusAreas)
    ? o.focusAreas.filter((x): x is string => typeof x === 'string' && x.trim() !== '').map((x) => x.trim())
    : []
  const encouragement = typeof o.encouragement === 'string' ? o.encouragement.trim() : ''
  return { summary, focusAreas, encouragement }
}

// AI 키가 없거나 호출 실패 시: DB 집계만으로 진단을 구성(비용 0).
export function fallbackDiagnosis(input: DiagnoseInput): Diagnosis {
  const attemptedTotal = input.subjectStats.reduce((a, s) => a + s.attempted, 0)
  if (attemptedTotal === 0) {
    return {
      summary: '아직 푼 문제가 없어요. 진단 문제 몇 개를 풀면 약점 과목과 단원을 분석해드릴게요.',
      focusAreas: [],
      encouragement: '가볍게 5문제부터 시작해봐요!',
    }
  }
  const ranked = [...input.subjectStats].sort((a, b) => acc(a) - acc(b))
  const weakest = ranked[0]
  const correctTotal = input.subjectStats.reduce((a, s) => a + s.correct, 0)
  const overall = Math.round((correctTotal / attemptedTotal) * 100)
  const focusAreas = input.weakUnits.slice(0, 4).map((u) => `${u.subject} · ${u.unit}`)
  const summary = weakest
    ? `지금까지 ${attemptedTotal}문제를 풀어 평균 정답률 ${overall}%예요. ` +
      `특히 ${weakest.subject}(정답률 ${Math.round(acc(weakest) * 100)}%)가 약하니 이 과목부터 보완하면 좋아요.`
    : `지금까지 ${attemptedTotal}문제를 풀어 평균 정답률 ${overall}%예요.`
  return { summary, focusAreas, encouragement: '약점 단원을 반복하면 점수는 분명히 올라요. 꾸준함이 합격의 열쇠예요!' }
}
