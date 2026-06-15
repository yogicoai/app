// 약점 진단 순수 로직: 단원별 풀이 집계 → 약점 점수 랭킹. 외부 호출 없음(DB 집계 결과를 입력으로 받음).
// 비용 원칙: 평소 약점 계산은 전부 이 DB 집계 기반(AI 비용 0).

export interface UnitStat {
  subject: string
  unit: string
  attempted: number
  correct: number
}

export interface WeakUnit extends UnitStat {
  accuracy: number // 0~1 (소수 둘째자리 반올림)
  score: number // 약점 점수(높을수록 약함, 소수 셋째자리)
}

const round = (n: number, d: number) => {
  const p = 10 ** d
  return Math.round(n * p) / p
}

// 약점 점수 = (1 - 정답률) × 신뢰도.
//   신뢰도 = attempted / (attempted + K). 시도가 많을수록 1에 수렴(우연·표본부족 보정).
// → 정답률이 낮고 + 충분히 풀어본 단원일수록 점수가 높다(= 더 확실한 약점).
export function rankWeakUnits(stats: UnitStat[], opts?: { minAttempts?: number; k?: number }): WeakUnit[] {
  const minAttempts = opts?.minAttempts ?? 1
  const k = opts?.k ?? 3
  return stats
    .filter((s) => s.attempted >= minAttempts && s.attempted > 0)
    .map((s) => {
      const accuracy = s.correct / s.attempted
      const confidence = s.attempted / (s.attempted + k)
      const score = (1 - accuracy) * confidence
      return { ...s, accuracy: round(accuracy, 2), score: round(score, 3) }
    })
    .sort((a, b) => b.score - a.score || b.attempted - a.attempted || a.unit.localeCompare(b.unit))
}

// 약점 상위 n개(정답률 100% 단원은 자동 제외 — score 0).
export function topWeakUnits(stats: UnitStat[], n: number, opts?: { minAttempts?: number; k?: number }): WeakUnit[] {
  return rankWeakUnits(stats, opts)
    .filter((u) => u.score > 0)
    .slice(0, n)
}
