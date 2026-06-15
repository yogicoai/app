# 9급 공무원 앱 백엔드 (Fastify + Mongoose). tsx 로 TS 를 그대로 구동(별도 컴파일 없음).
# Railway / Render / Fly 등 어디서나 동일하게 빌드된다.
FROM node:22-alpine

WORKDIR /app

# 의존성 먼저 설치(레이어 캐시). tsx 는 dependencies 에 있으므로 prod 설치에 포함됨.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# 소스 복사
COPY . .

# 플랫폼이 주는 PORT 를 사용(서버는 env.PORT, host 0.0.0.0 로 리슨).
ENV NODE_ENV=production
EXPOSE 4000

CMD ["npm", "start"]
