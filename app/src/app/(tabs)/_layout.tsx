import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { color } from '../../theme/tokens'

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: color.primary,
        tabBarInactiveTintColor: color.textMuted,
        // 높이는 고정하지 않음(안전영역 자동 처리) — 토스 색/폰트만. 고정 높이는 한글 받침 잘림 유발.
        tabBarStyle: { backgroundColor: color.bg, borderTopColor: color.border, borderTopWidth: 1 },
        tabBarLabelStyle: { fontFamily: 'Pretendard-Medium', fontSize: 11, letterSpacing: -0.2 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: '학습',
          tabBarIcon: ({ color: c, size }) => <Ionicons name="book-outline" size={size} color={c} />,
        }}
      />
      <Tabs.Screen
        name="terms"
        options={{
          title: '용어정리',
          tabBarIcon: ({ color: c, size }) => <Ionicons name="library-outline" size={size} color={c} />,
        }}
      />
      <Tabs.Screen
        name="exams"
        options={{
          title: '기출',
          tabBarIcon: ({ color: c, size }) => <Ionicons name="documents-outline" size={size} color={c} />,
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: '진도율',
          tabBarIcon: ({ color: c, size }) => <Ionicons name="stats-chart-outline" size={size} color={c} />,
        }}
      />
    </Tabs>
  )
}
