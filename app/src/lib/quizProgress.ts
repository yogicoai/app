// 이어풀기(진행 중 퀴즈) 로컬 저장. 지금은 AsyncStorage(로컬), 이후 회원별 서버 API 로 교체 가능하도록 분리.
import AsyncStorage from '@react-native-async-storage/async-storage'

export interface QuizAnswer {
  subject: string
  correct: boolean
}

export interface QuizProgress {
  key: string
  label: string // 예: "2026 국가직 국어"
  idx: number // 현재 문항 인덱스
  selected: number | null
  answered: boolean
  results: QuizAnswer[]
  total: number
  updatedAt: number
}

const PREFIX = 'quizprog:'
const INDEX_KEY = 'quizprog:index'

// 퀴즈 식별 키
export function quizKey(p: { year?: string; examType?: string; subject?: string } | 'today'): string {
  if (p === 'today') return 'today'
  return `exam:${p.year ?? ''}:${p.examType ?? ''}:${p.subject ?? 'all'}`
}

async function readIndex(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(INDEX_KEY)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

export async function saveProgress(p: QuizProgress): Promise<void> {
  await AsyncStorage.setItem(PREFIX + p.key, JSON.stringify(p))
  const idx = await readIndex()
  if (!idx.includes(p.key)) {
    idx.push(p.key)
    await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(idx))
  }
}

export async function loadProgress(key: string): Promise<QuizProgress | null> {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + key)
    return raw ? (JSON.parse(raw) as QuizProgress) : null
  } catch {
    return null
  }
}

export async function clearProgress(key: string): Promise<void> {
  await AsyncStorage.removeItem(PREFIX + key)
  const idx = (await readIndex()).filter((k) => k !== key)
  await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(idx))
}

// 진행 중인 모든 퀴즈(이어풀기 표시용)
export async function listProgress(): Promise<QuizProgress[]> {
  const keys = await readIndex()
  const out: QuizProgress[] = []
  for (const k of keys) {
    const p = await loadProgress(k)
    if (p && p.idx < p.total) out.push(p)
  }
  return out
}
