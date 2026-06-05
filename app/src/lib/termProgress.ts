// 용어/단어 '익힘' 체크(로컬). 지금은 AsyncStorage, 이후 회원별 서버로 교체 가능하도록 분리.
import AsyncStorage from '@react-native-async-storage/async-storage'

const KEY = 'termknown'

export async function getKnownIds(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

// 익힘 토글. 변경 후 전체 익힘 id 목록을 반환.
export async function toggleKnown(id: string): Promise<string[]> {
  const cur = await getKnownIds()
  const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]
  await AsyncStorage.setItem(KEY, JSON.stringify(next))
  return next
}
