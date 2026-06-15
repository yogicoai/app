// 문항 출처 표기. 예: "2025 국가직 9급 국어 4번"
// 기출 메타(year·number)가 없으면 빈 문자열(표기 안 함).
export function questionSource(q: { year?: number; examType?: string; subject: string; number?: number }): string {
  if (!q.year || !q.number) return ''
  const ex = q.examType ? ` ${q.examType}` : ''
  return `${q.year}${ex} 9급 ${q.subject} ${q.number}번`
}
