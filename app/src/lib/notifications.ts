// 매일 학습 드립용 로컬 알림(클라이언트). 서버 푸시 인프라 없이 기기에서 매일 반복 예약.
// 웹은 미지원(expo-notifications iOS/Android 전용)이라 안전하게 no-op 처리.
import { Platform } from 'react-native'
import * as Notifications from 'expo-notifications'
import AsyncStorage from '@react-native-async-storage/async-storage'

const ENABLED_KEY = 'reminder_enabled'
const HOUR_KEY = 'reminder_hour'
const MIN_KEY = 'reminder_minute'
const REMINDER_ID = 'daily-reminder' // 고정 식별자 — 이 알림만 취소(다른 예약 보존)
export const DEFAULT_HOUR = 9
export const DEFAULT_MINUTE = 0

export const remindersSupported = Platform.OS !== 'web'

// 포그라운드에서도 배너가 보이도록(앱 켜져 있을 때). 웹에서는 호출하지 않는다.
if (remindersSupported) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  })
}

export interface ReminderState {
  enabled: boolean
  hour: number
  minute: number
}

export async function getReminder(): Promise<ReminderState> {
  const [e, h, m] = await Promise.all([
    AsyncStorage.getItem(ENABLED_KEY),
    AsyncStorage.getItem(HOUR_KEY),
    AsyncStorage.getItem(MIN_KEY),
  ])
  return { enabled: e === '1', hour: h ? Number(h) : DEFAULT_HOUR, minute: m ? Number(m) : DEFAULT_MINUTE }
}

// 매일 반복 알림 예약. 권한 거부/웹이면 false. 성공 시 상태 저장.
export async function enableDailyReminder(hour = DEFAULT_HOUR, minute = DEFAULT_MINUTE): Promise<boolean> {
  if (!remindersSupported) return false
  const { status } = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: true, allowSound: true },
  })
  if (status !== 'granted') return false
  await Notifications.cancelScheduledNotificationAsync(REMINDER_ID).catch(() => {}) // 이 알림만 중복 제거
  await Notifications.scheduleNotificationAsync({
    identifier: REMINDER_ID,
    content: { title: '오늘의 5문제 💪', body: '5분이면 충분해요. 매일 풀이로 합격에 한 걸음!' },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute },
  })
  await AsyncStorage.multiSet([
    [ENABLED_KEY, '1'],
    [HOUR_KEY, String(hour)],
    [MIN_KEY, String(minute)],
  ])
  return true
}

export async function disableDailyReminder(): Promise<void> {
  if (remindersSupported) await Notifications.cancelScheduledNotificationAsync(REMINDER_ID).catch(() => {})
  await AsyncStorage.setItem(ENABLED_KEY, '0')
}
