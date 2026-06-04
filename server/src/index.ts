import { buildApp } from './app'
import { connectDb } from './config/db'
import { env } from './config/env'

async function main() {
  await connectDb()
  const app = await buildApp()
  await app.listen({ port: env.PORT, host: '0.0.0.0' })
  console.log(`[server] http://localhost:${env.PORT} (${env.NODE_ENV})`)
}

main().catch((err) => {
  console.error('서버 시작 실패:', err)
  process.exit(1)
})
