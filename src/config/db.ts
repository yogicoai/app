import mongoose from 'mongoose'
import { env } from './env'

export async function connectDb() {
  mongoose.set('strictQuery', true)
  await mongoose.connect(env.MONGODB_URI)
  console.log('[db] MongoDB 연결됨')
  return mongoose.connection
}
