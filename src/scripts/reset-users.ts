// users 컬렉션을 드롭해 인덱스를 초기화한다(스키마 변경 후 1회). 개발 데이터 전용.
import mongoose from 'mongoose'
import { connectDb } from '../config/db'

async function main() {
  const conn = await connectDb()
  try {
    await conn.db?.collection('users').drop()
    console.log('users 컬렉션 삭제됨 (인덱스 초기화)')
  } catch (e) {
    console.log('users 드롭 스킵:', (e as Error).message)
  }
  await mongoose.disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
