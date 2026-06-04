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
