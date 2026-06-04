// 백엔드 주소.
// - 안드로이드 에뮬레이터: http://10.0.2.2:4000
// - 실기기(같은 와이파이): http://<PC의 LAN IP>:4000  (예: http://192.168.0.10:4000)
// - 웹/시뮬레이터: http://localhost:4000
// 셸에서 EXPO_PUBLIC_API_URL 로 덮어쓸 수 있습니다.
export const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000'
