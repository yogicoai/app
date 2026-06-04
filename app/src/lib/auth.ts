import { Platform } from 'react-native'
import * as SecureStore from 'expo-secure-store'
import { API_BASE } from './config'

const TOKEN_KEY = 'auth_token'
const DEVICE_KEY = 'device_id'

// 웹에서는 SecureStore 가 없으므로 localStorage 폴백
const ls = (globalThis as any).localStorage
async function getItem(k: string): Promise<string | null> {
  if (Platform.OS === 'web') return ls ? ls.getItem(k) : null
  return SecureStore.getItemAsync(k)
}
async function setItem(k: string, v: string): Promise<void> {
  if (Platform.OS === 'web') {
    if (ls) ls.setItem(k, v)
    return
  }
  await SecureStore.setItemAsync(k, v)
}
async function removeItem(k: string): Promise<void> {
  if (Platform.OS === 'web') {
    if (ls) ls.removeItem(k)
    return
  }
  await SecureStore.deleteItemAsync(k)
}

function makeDeviceId(): string {
  const rand = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
  return `device-${Date.now().toString(36)}-${rand}`.slice(0, 40)
}

export async function getToken(): Promise<string | null> {
  return getItem(TOKEN_KEY)
}

async function getDeviceId(): Promise<string> {
  let id = await getItem(DEVICE_KEY)
  if (!id) {
    id = makeDeviceId()
    await setItem(DEVICE_KEY, id)
  }
  return id
}

// 앱 시작 시 호출: 토큰이 없으면 디바이스 익명 로그인(회원가입 없이 베타 진입)
export async function ensureSession(): Promise<void> {
  const existing = await getToken()
  if (existing) return
  const deviceId = await getDeviceId()
  const res = await fetch(`${API_BASE}/auth/device`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId }),
  })
  const json = (await res.json().catch(() => null)) as any
  if (!res.ok || !json?.token) throw new Error(json?.error ?? `디바이스 로그인 실패 (${res.status})`)
  await setItem(TOKEN_KEY, json.token)
}

export async function signOut(): Promise<void> {
  await removeItem(TOKEN_KEY)
}
