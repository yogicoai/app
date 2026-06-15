// 한국 표준시(KST = UTC+9) 기준 오늘 날짜 'YYYY-MM-DD'
export function todayKST(at: Date = new Date()): string {
  const kst = new Date(at.getTime() + 9 * 60 * 60 * 1000)
  return kst.toISOString().slice(0, 10)
}
