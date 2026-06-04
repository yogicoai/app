// SM-2 lite 간격반복 스케줄러
export interface SrsState {
  reps: number
  interval: number // 일수
  ease: number
}

export interface SrsResult extends SrsState {
  nextReviewAt: Date
}

const DAY = 24 * 60 * 60 * 1000

export function scheduleNext(state: SrsState, correct: boolean, now: Date = new Date()): SrsResult {
  let { reps, interval, ease } = state

  if (correct) {
    reps += 1
    if (reps === 1) interval = 1
    else if (reps === 2) interval = 3
    else interval = Math.round(interval * ease)
    ease = Math.min(2.8, ease + 0.1)
    return { reps, interval, ease, nextReviewAt: new Date(now.getTime() + interval * DAY) }
  }

  // 오답: 처음부터 다시, 10분 뒤 재복습
  reps = 0
  interval = 0
  ease = Math.max(1.3, ease - 0.2)
  return { reps, interval, ease, nextReviewAt: new Date(now.getTime() + 10 * 60 * 1000) }
}
