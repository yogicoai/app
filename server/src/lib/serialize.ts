import type { HydratedDocument } from 'mongoose'
import type { User } from '../models/User'

// 비밀번호 해시 등 민감 필드를 제외한 공개용 유저 객체
export function publicUser(u: HydratedDocument<User>) {
  return {
    id: u.id as string,
    email: u.email ?? null,
    anonymous: u.anonymous ?? false,
    displayName: u.displayName ?? null,
    track: u.track,
    targetExamDate: u.targetExamDate ?? null,
    createdAt: (u as { createdAt?: Date }).createdAt,
  }
}
