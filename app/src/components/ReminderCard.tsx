import { useEffect, useState } from 'react'
import { View, Switch } from 'react-native'
import { Card } from './Card'
import { Txt } from './Txt'
import { color, space } from '../theme/tokens'
import {
  getReminder,
  enableDailyReminder,
  disableDailyReminder,
  remindersSupported,
  DEFAULT_HOUR,
  DEFAULT_MINUTE,
} from '../lib/notifications'

export function ReminderCard() {
  const [enabled, setEnabled] = useState(false)
  const [busy, setBusy] = useState(false)
  const [denied, setDenied] = useState(false)

  useEffect(() => {
    getReminder().then((r) => setEnabled(r.enabled))
  }, [])

  const onToggle = async (next: boolean) => {
    setBusy(true)
    setDenied(false)
    try {
      if (next) {
        const ok = await enableDailyReminder(DEFAULT_HOUR, DEFAULT_MINUTE)
        setEnabled(ok)
        if (!ok) setDenied(true)
      } else {
        await disableDailyReminder()
        setEnabled(false)
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flex: 1, marginRight: space.md }}>
          <Txt variant="bodyBold">매일 학습 알림</Txt>
          <Txt variant="caption" color={color.textMuted} style={{ marginTop: 2 }}>
            {remindersSupported
              ? '매일 오전 9시에 오늘의 5문제를 알려드려요'
              : '알림은 모바일 앱(iOS/Android)에서 지원돼요'}
          </Txt>
        </View>
        <Switch value={enabled} onValueChange={onToggle} disabled={busy || !remindersSupported} />
      </View>
      {denied && (
        <Txt variant="caption" color={color.error} style={{ marginTop: space.sm }}>
          알림 권한이 거부됐어요. 기기 설정에서 알림을 허용해주세요.
        </Txt>
      )}
    </Card>
  )
}
