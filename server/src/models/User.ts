import { Schema, model, InferSchemaType } from 'mongoose'

const userSchema = new Schema(
  {
    // 베타: 익명(디바이스) 사용자는 email/passwordHash 없이 deviceId 로만 식별.
    // 나중에 /auth/link 로 이메일 계정으로 승격하면 email/passwordHash 가 채워짐.
    email: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
    passwordHash: { type: String },
    deviceId: { type: String, unique: true, sparse: true },
    anonymous: { type: Boolean, default: false },
    displayName: { type: String, trim: true },
    track: { type: String, default: '일반행정' }, // 직렬
    targetExamDate: { type: Date },
  },
  { timestamps: true },
)

export type User = InferSchemaType<typeof userSchema>
export const UserModel = model('User', userSchema)
