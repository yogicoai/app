// 용어/단어 학습 상태(로컬). '익힘'과 '복습 필요' 두 세트. 이후 회원별 서버로 교체 가능하도록 분리.
import AsyncStorage from '@react-native-async-storage/async-storage'

async function getSet(key: string): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(key)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}
async function setMember(key: string, id: string, on: boolean): Promise<string[]> {
  const cur = await getSet(key)
  const has = cur.includes(id)
  if (has === on) return cur
  const next = on ? [...cur, id] : cur.filter((x) => x !== id)
  await AsyncStorage.setItem(key, JSON.stringify(next))
  return next
}

const KNOWN = 'termknown'
const REVIEW = 'termreview'

export const getKnownIds = () => getSet(KNOWN)
export const setKnown = (id: string, on: boolean) => setMember(KNOWN, id, on)
export async function toggleKnown(id: string): Promise<string[]> {
  const cur = await getKnownIds()
  return setKnown(id, !cur.includes(id))
}

export const getReviewIds = () => getSet(REVIEW)
export const setReview = (id: string, on: boolean) => setMember(REVIEW, id, on)

// 마지막에 보던 과목(다음에 들어오면 그 과목을 우선으로 불러옴)
const SUBJECT = 'termsubject'
export async function getLastSubject(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(SUBJECT)
  } catch {
    return null
  }
}
export const setLastSubject = (s: string) => AsyncStorage.setItem(SUBJECT, s).catch(() => {})
