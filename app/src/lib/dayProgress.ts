// Day 코스 진도(로컬). 값 = 완료한 Day 수(다음 학습 Day = +1). 이후 회원별 서버로 교체 가능.
import AsyncStorage from '@react-native-async-storage/async-storage'

export type Track = 'word' | 'term'
const key = (track: Track) => `dayprogress:${track}`

// 완료한 Day 수(0이면 아직 Day1도 안 끝냄). 오늘 학습할 Day = 이 값 + 1.
export async function getCompletedDay(track: Track): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(key(track))
    return raw ? Number(raw) || 0 : 0
  } catch {
    return 0
  }
}

// day 차를 완료 처리(되돌아가서 다시 해도 진도는 안 깎임).
export async function completeDay(track: Track, day: number): Promise<void> {
  const cur = await getCompletedDay(track)
  if (day > cur) await AsyncStorage.setItem(key(track), String(day)).catch(() => {})
}
