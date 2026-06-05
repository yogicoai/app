import { useEffect, useState } from 'react'
import { View, ActivityIndicator } from 'react-native'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '../lib/queryClient'
import { ensureSession } from '../lib/auth'
import { color, space } from '../theme/tokens'
import { Txt } from '../components/Txt'

export default function RootLayout() {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    ensureSession()
      .then(() => setReady(true))
      .catch((e) => setError(e?.message ?? '세션 초기화에 실패했어요.'))
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        {error ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: color.bg, padding: space.xxl }}>
            <Txt variant="h2" color={color.error}>서버에 연결하지 못했어요</Txt>
            <Txt variant="body" color={color.textSecondary} style={{ marginTop: space.sm, textAlign: 'center' }}>
              {error}
              {'\n\n'}src/lib/config.ts 의 API_BASE 를 PC IP로 설정했는지 확인하세요.
            </Txt>
          </View>
        ) : !ready ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: color.bg }}>
            <ActivityIndicator color={color.primary} />
          </View>
        ) : (
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="exam" options={{ headerShown: true, title: '과목 선택' }} />
            <Stack.Screen name="quiz" options={{ headerShown: true, title: '문제 풀이' }} />
          </Stack>
        )}
      </SafeAreaProvider>
    </QueryClientProvider>
  )
}
