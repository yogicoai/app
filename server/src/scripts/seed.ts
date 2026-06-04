// 개발용 고정 계정만 보장한다. 문제/세트 콘텐츠는 import-content + build-daily-set 담당.
import mongoose from 'mongoose'
import { connectDb } from '../config/db'
import { UserModel } from '../models/User'
import { hashPassword } from '../lib/password'

async function main() {
  await connectDb()
  const devEmail = 'dev@gongmuwon.test'
  await UserModel.findOneAndUpdate(
    { email: devEmail },
    {
      email: devEmail,
      passwordHash: await hashPassword('devpass1234'),
      displayName: '개발용 계정',
      track: '일반행정',
      anonymous: false,
    },
    { upsert: true, setDefaultsOnInsert: true },
  )
  console.log(`개발용 계정 준비됨: ${devEmail} / devpass1234`)
  await mongoose.disconnect()
}

main().catch((e) => {
  console.error('시드 실패:', e)
  process.exit(1)
})
